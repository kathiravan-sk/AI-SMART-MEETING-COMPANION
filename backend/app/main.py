import asyncio
import json
import logging
import os
import tempfile
import time
import uuid
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from pathlib import Path
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from starlette.concurrency import run_in_threadpool
from app.auth import current_user, passwords, issue, decode
from app.config import PROVIDER, LANGUAGES, GOOGLE_CLIENT_ID
from app.database.store import store
from app.models import Credentials, GoogleCredential, NewMeeting, ChunkInput, AskInput, TranslateInput, StatusInput, Submission
from app.services.intelligence import summarize, blank_summary, answer, DEMO, clean_questions
from app.translation.service import translator
from app.speech.service import speech

log = logging.getLogger('meetmind')
locks = defaultdict(asyncio.Lock)
clients = defaultdict(set)
rate_windows = defaultdict(deque)
def now(): return datetime.now(timezone.utc).isoformat()
def uid(): return uuid.uuid4().hex

def owned(id, user):
    m = store.get('meetings', id)
    if not m or m['userId'] != user['id']:
        raise HTTPException(404, 'Meeting not found')
    return m

def public_meeting(m):
    return {k: v for k, v in m.items() if k not in ['translations', 'processedCount']}

def list_meeting(m):
    return {k: v for k, v in m.items() if k not in ['translations', 'processedCount', 'transcript', 'summary']}

async def broadcast(id, kind='updated'):
    for ws in list(clients[id]):
        try:
            await asyncio.wait_for(ws.send_json({'type': kind, 'meetingId': id}), timeout=2)
        except Exception:
            clients[id].discard(ws)

async def process(id):
    async with locks[id]:
        m = store.get('meetings', id)
        if not m:
            return
        try:
            await summarize(m)
        except Exception:
            log.exception('Summary processing failed')
            m['aiError'] = 'AI processing failed. Your transcript is saved. Check provider settings and retry.'
        store.put('meetings', m)
    await broadcast(id)

@asynccontextmanager
async def lifespan(app):
    yield

app = FastAPI(title='MeetMind AI', version='1.0.0', lifespan=lifespan)
app.add_middleware(CORSMiddleware,
    allow_origins=os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(','),
    allow_origin_regex=r'chrome-extension://[a-p]{32}', allow_credentials=False,
    allow_methods=['GET','POST','PATCH','DELETE','OPTIONS'], allow_headers=['Authorization','Content-Type'])

@app.middleware('http')
async def limits(request: Request, call_next):
    # Single-process protection; deploy a shared rate limiter before horizontal scaling.
    if request.method == 'POST':
        ip = request.client.host if request.client else 'unknown'
        bucket = 'auth' if request.url.path.startswith('/auth/') else 'api'
        key = (ip, bucket)
        stamp = time.monotonic()
        window = rate_windows[key]
        while window and window[0] < stamp - 60:
            window.popleft()
        if len(window) >= (20 if bucket == 'auth' else 180):
            return JSONResponse({'detail': 'Too many requests. Please wait a minute.'}, status_code=429)
        window.append(stamp)
    return await call_next(request)

@app.exception_handler(Exception)
async def unknown_error(request, exc):
    log.exception('Request failed', exc_info=exc)
    return JSONResponse({'detail':'The request could not be completed. Check the server configuration and try again.'}, status_code=500)

@app.get('/health')
def health():
    return {'status':'ok', 'aiProvider': PROVIDER, 'database':os.getenv('DB_BACKEND','sqlite'), 'speech':os.getenv('STT_PROVIDER','disabled')}

@app.post('/auth/register', status_code=201)
async def register(data: Credentials):
    async with locks['registration']:
        if store.find('users', email=data.email):
            raise HTTPException(409, 'An account with this email already exists')
        user = {'id':uid(), 'email':data.email, 'name':data.name, 'passwordHash':await run_in_threadpool(passwords.hash, data.password), 'createdAt':now()}
        try:
            store.insert('users', user)
        except Exception as exc:
            log.exception('Account registration failed')
            if 'unique' in str(exc).lower() or 'constraint' in str(exc).lower():
                raise HTTPException(409, 'An account with this email already exists') from exc
            raise HTTPException(500, 'Your account could not be created. Check the database configuration.') from exc
        return issue(user)

@app.post('/auth/login')
async def login(data: Credentials):
    found = store.find('users', email=data.email)
    try:
        if not found or not await run_in_threadpool(passwords.verify, found[0]['passwordHash'], data.password):
            raise ValueError()
    except Exception:
        raise HTTPException(401, 'Email or password is incorrect')
    return issue(found[0])

@app.post('/auth/google')
async def google_login(data: GoogleCredential):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(503, 'Google sign-in is not configured on this server')
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests as google_requests
        claims = await run_in_threadpool(
            id_token.verify_oauth2_token,
            data.credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except Exception:
        raise HTTPException(401, 'Google sign-in could not be verified')
    email = claims.get('email', '').strip().lower()
    if not email or not claims.get('email_verified'):
        raise HTTPException(401, 'Google did not provide a verified email address')
    async with locks['registration']:
        found = store.find('users', email=email)
        if found:
            user = found[0]
        else:
            user = {
                'id': uid(),
                'email': email,
                'name': (claims.get('name') or email.split('@')[0])[:60],
                'passwordHash': None,
                'createdAt': now(),
                'authProvider': 'google',
            }
            store.insert('users', user)
    return issue(user)

@app.get('/users/me')
def me(user=Depends(current_user)):
    return {k:user[k] for k in ['id','name','email']}

@app.post('/meetings', status_code=201)
def create_meeting(data: NewMeeting, user=Depends(current_user)):
    if not data.consent:
        raise HTTPException(400, 'Confirm that you have permission before starting the assistant')
    m = {'id':uid(), 'userId':user['id'], 'title':data.title, 'platform':data.platform,
         'startedAt':now(), 'endedAt':None, 'duration':0, 'status':'live', 'detectedLanguage':data.language,
         'selectedDisplayLanguage':data.language, 'demo':data.demo, 'transcript':[], 'summary':blank_summary(),
         'processedCount':0, 'revision':0, 'translations':{}, 'aiError':None, 'quizId':None}
    store.insert('meetings', m)
    return public_meeting(m)

@app.get('/meetings')
def meetings(user=Depends(current_user)):
    return sorted([list_meeting(m) for m in store.find('meetings', userId=user['id'])], key=lambda m:m['startedAt'], reverse=True)

@app.get('/meetings/{id}')
def get_meeting(id: str, user=Depends(current_user)):
    return public_meeting(owned(id, user))

@app.patch('/meetings/{id}/status')
async def status(id: str, data: StatusInput, user=Depends(current_user)):
    async with locks[id]:
        m = owned(id, user)
        if m['status'] == 'completed':
            raise HTTPException(409, 'This meeting has ended')
        m['status'] = data.status
        store.put('meetings', m)
    await broadcast(id)
    return public_meeting(m)

@app.post('/meetings/{id}/transcript')
async def transcript(id: str, data: ChunkInput, tasks: BackgroundTasks, user=Depends(current_user)):
    async with locks[id]:
        m = owned(id, user)
        if m['status'] != 'live':
            raise HTTPException(409, 'Resume the meeting before adding transcript')
        duplicate = next((c for c in m['transcript'] if c['clientId'] == data.clientId), None)
        if duplicate:
            return duplicate
        if len(m['transcript']) >= 5000 or sum(len(c['originalText']) for c in m['transcript']) + len(data.text) > 500000:
            raise HTTPException(413, 'This meeting reached the transcript limit (5,000 chunks or 500,000 characters). Start another meeting.')
        c = {'id':uid(), 'meetingId':id, **data.model_dump(), 'originalText':data.text, 'originalLanguage':data.language,
             'translatedText':{}, 'timestamp':now()}
        if not m['transcript']:
            m['detectedLanguage'] = data.language
        m['transcript'].append(c)
        store.put('meetings', m)
        if len(m['transcript']) - m['processedCount'] >= 2 or len(m['transcript']) == 1:
            tasks.add_task(process, id)
    await broadcast(id)
    return c

@app.post('/meetings/{id}/process')
async def retry_process(id: str, user=Depends(current_user)):
    owned(id, user)
    await process(id)
    return public_meeting(owned(id, user))

@app.get('/demo/lesson')
def demo_lesson(language: str='en', user=Depends(current_user)):
    if language not in LANGUAGES:
        raise HTTPException(422, 'Unsupported language')
    return {'title':DEMO[language]['title'], 'chunks':[f[0] for f in DEMO[language]['facts']]}

@app.get('/meetings/{id}/summary')
def summary(id: str, user=Depends(current_user)):
    return owned(id,user)['summary']

@app.get('/meetings/{id}/questions')
def questions(id: str, user=Depends(current_user)):
    return owned(id,user)['summary']['questions']

@app.post('/meetings/{id}/ask')
async def ask(id: str, data: AskInput, user=Depends(current_user)):
    m = owned(id, user)
    if not m['transcript']:
        raise HTTPException(409, 'Add meeting content first')
    try:
        return await answer(m, data.question, data.language)
    except Exception:
        log.exception('Q&A failed')
        raise HTTPException(502, 'AI could not answer. Check the provider and retry.')

@app.post('/meetings/{id}/translate')
async def translate(id: str, data: TranslateInput, user=Depends(current_user)):
    async with locks[id]:
        m = owned(id,user)
        try:
            result = await translator.translate(m,data.language)
        except HTTPException:
            raise
        except Exception:
            log.exception('Translation failed')
            raise HTTPException(502, 'Translation failed. Original content is preserved; please retry.')
        m['selectedDisplayLanguage'] = data.language
        store.put('meetings',m)
        return result

def ensure_quiz(m):
    old = store.get('quizzes', m['quizId']) if m['quizId'] else None
    if old:
        return old
    if m.get('aiError'):
        return None
    questions = m['summary']['questions'][:15]
    if not questions:
        return None
    quiz = {'id':uid(), 'meetingId':m['id'], 'userId':m['userId'], 'questions':questions, 'createdAt':now(), 'language':m['detectedLanguage']}
    store.insert('quizzes',quiz)
    m['quizId'] = quiz['id']
    store.put('meetings',m)
    return quiz

@app.post('/meetings/{id}/stop')
async def stop(id: str, user=Depends(current_user)):
    async with locks[id]:
        m = owned(id,user)
        if m['status'] != 'completed':
            m['status']='completed'
            m['endedAt']=now()
            m['duration']=int((datetime.now(timezone.utc)-datetime.fromisoformat(m['startedAt'])).total_seconds())
            store.put('meetings',m)  # Stop capture even if the provider subsequently fails.
        try:
            await summarize(m,force=True)
        except Exception:
            log.exception('Finalization failed')
            m['aiError']='Final AI processing failed. Transcript is saved. Use Retry processing, then Generate quiz.'
        store.put('meetings',m)
        ensure_quiz(m)
    await broadcast(id)
    return public_meeting(m)

@app.post('/meetings/{id}/quiz/generate')
async def generate(id: str, user=Depends(current_user)):
    async with locks[id]:
        m=owned(id,user)
        if m['status']!='completed':
            raise HTTPException(409,'Stop the meeting before generating its test')
        q=ensure_quiz(m)
        if not q:
            raise HTTPException(409,'Not enough meaningful content for a quiz yet. Retry AI processing if needed.')
    return {'id':q['id'],'questionCount':len(q['questions'])}

@app.get('/meetings/{id}/quiz')
async def quiz(id: str, language: str='en', user=Depends(current_user)):
    if language not in LANGUAGES:
        raise HTTPException(422, 'Unsupported language')
    m=owned(id,user)
    q=store.get('quizzes',m['quizId']) if m['quizId'] else None
    if not q:
        raise HTTPException(404,'No quiz yet. Stop the meeting, then generate its test.')
    questions=q['questions']
    if language != m['detectedLanguage']:
        async with locks[id]:
            m=owned(id,user)
            translated=await translator.translate(m,language)
            mapping={v['id']:v for v in translated['summary']['questions']}
            questions=[mapping.get(v['id'],v) for v in questions]
            store.put('meetings',m)
    return {**q,'language':language,'questions':[{k:v for k,v in item.items() if k not in ['answer','correctIndex','factIndex']} for item in questions]}

def reward(percent):
    if percent >= 90: return 200,'Meeting Master'
    if percent >= 80: return 150,'Smart Learner'
    if percent >= 70: return 100,'Knowledge Builder'
    if percent >= 60: return 75,'Quick Learner'
    if percent >= 50: return 50,'Starter'
    return 0,None

def normalize(value):
    import re, unicodedata
    return re.sub(r'[^\w\s]', '', unicodedata.normalize('NFKC',str(value)).casefold()).strip()

@app.post('/quiz/{quiz_id}/submit')
async def submit(quiz_id: str, data: Submission, user=Depends(current_user)):
    async with locks['user:'+user['id']]:
        q=store.get('quizzes',quiz_id)
        if not q or q['userId']!=user['id']:
            raise HTTPException(404,'Quiz not found')
        if set(data.answers)!={v['id'] for v in q['questions']}:
            raise HTTPException(422,'Answer every quiz question before submitting')
        review=[]
        display_questions = q['questions']
        m = owned(q['meetingId'], user)
        if data.language != m['detectedLanguage']:
            translated = await translator.translate(m, data.language)
            mapping = {v['id']: v for v in translated['summary']['questions']}
            display_questions = [mapping.get(v['id'], v) for v in q['questions']]
        for canonical, v in zip(q['questions'], display_questions):
            given=data.answers[v['id']]
            correct = normalize(given) in {normalize(v['answer']),normalize(canonical['answer'])} if v['type']=='short_answer' else str(given)==str(canonical['correctIndex'])
            review.append({**v,'given':given,'correct':correct})
        count=sum(v['correct'] for v in review)
        percentage=round(100*count/len(review),2)
        total,badge=reward(percentage)
        previous=store.find('attempts',userId=user['id'],quizId=quiz_id)
        earned=max(0,total-max([a['rewardTotal'] for a in previous],default=0))
        result={'id':uid(),'quizId':quiz_id,'meetingId':q['meetingId'],'userId':user['id'], 'score':count,'correctAnswers':count,
                'wrongAnswers':len(review)-count,'percentage':percentage,'passed':percentage>=50,'xpEarned':earned,'rewardTotal':total,
                'badge':badge,'review':review,'completedAt':now(),'timeTaken':data.timeTaken}
        store.insert('attempts',result)
        return result

@app.get('/users/me/rewards')
def rewards(user=Depends(current_user)):
    attempts=sorted(store.find('attempts',userId=user['id']),key=lambda a:a['completedAt'],reverse=True)
    best={}
    for a in attempts:
        best[a['quizId']]=max(best.get(a['quizId'],0),a['rewardTotal'])
    xp=sum(best.values())
    days={datetime.fromisoformat(a['completedAt']).date() for a in attempts}
    today=datetime.now(timezone.utc).date()
    day=today if today in days else today-timedelta(days=1)
    streak=0
    while day in days:
        streak+=1
        day-=timedelta(days=1)
    return {'totalXP':xp,'level':xp//500+1,'levelXP':xp%500,'nextLevelXP':500,'streak':streak,
            'badges':sorted({a['badge'] for a in attempts if a['badge']}),
            'completedQuizzes':len(best),'averageScore':round(sum(a['percentage'] for a in attempts)/len(attempts),1) if attempts else 0,
            'attempts':[{k:v for k,v in a.items() if k!='review'} for a in attempts]}

@app.get('/dashboard')
def dashboard(user=Depends(current_user)):
    items=meetings(user)
    r=rewards(user)
    return {**r,'meetingsCompleted':sum(m['status']=='completed' for m in items),
            'learningSeconds':sum(m['duration'] for m in items),'recentMeetings':items[:6]}

async def remove_related(id,user):
    for name in ['quizzes','attempts']:
        for item in store.find(name,meetingId=id,userId=user['id']):
            store.delete(name,item['id'])

@app.delete('/meetings/{id}/transcript')
async def delete_transcript(id: str,user=Depends(current_user)):
    async with locks[id]:
        m=owned(id,user)
        if m['status']!='completed':
            raise HTTPException(409,'Stop the meeting before deleting its transcript')
        await remove_related(id,user)
        m.update(transcript=[],summary=blank_summary(),translations={},processedCount=0,quizId=None,aiError=None,revision=m['revision']+1)
        store.put('meetings',m)
    await broadcast(id)
    return {'deleted':True}

@app.delete('/meetings/{id}')
async def delete_meeting(id: str,user=Depends(current_user)):
    async with locks[id]:
        owned(id,user)
        await remove_related(id,user)
        store.delete('meetings',id)
    await broadcast(id,'deleted')
    return {'deleted':True}

@app.delete('/users/me/history')
async def clear_history(user=Depends(current_user)):
    for m in store.find('meetings',userId=user['id']):
        await delete_meeting(m['id'],user)
    return {'deleted':True}

@app.get('/meetings/{id}/export')
def export(id: str,user=Depends(current_user)):
    m=owned(id,user)
    return Response(json.dumps(public_meeting(m),ensure_ascii=False,indent=2),media_type='application/json',headers={'Content-Disposition':'attachment; filename="meetmind-meeting.json"'})

@app.post('/meetings/{id}/audio')
async def audio(id: str,file: UploadFile=File(...),user=Depends(current_user)):
    m=owned(id,user)
    if m['status']!='live':
        raise HTTPException(409,'Meeting is not live')
    raw=await file.read(12*1024*1024+1)
    if len(raw)>12*1024*1024:
        raise HTTPException(413,'Audio segment exceeds 12 MB')
    suffix=Path(file.filename or 'audio.webm').suffix
    if suffix not in ['.webm','.wav','.mp3','.m4a','.ogg']:
        raise HTTPException(415,'Unsupported audio format')
    path=None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix,delete=False) as temp:
            temp.write(raw)
            path=temp.name
        result=await run_in_threadpool(speech.transcribe,path,None)
        return result
    finally:
        if path: Path(path).unlink(missing_ok=True)

@app.websocket('/ws/meetings/{id}')
async def live(ws: WebSocket,id: str):
    # Authentication is the first frame, so JWTs do not appear in URL/access logs.
    origin=ws.headers.get('origin','')
    allowed=os.getenv('CORS_ORIGINS','http://localhost:5173,http://127.0.0.1:5173').split(',')
    if origin and origin not in allowed and not origin.startswith('chrome-extension://'):
        await ws.close(code=1008)
        return
    await ws.accept()
    try:
        auth=await asyncio.wait_for(ws.receive_json(),timeout=8)
        user=decode(auth.get('token',''))
        owned(id,user)
        clients[id].add(ws)
        await ws.send_json({'type':'connected'})
        while True:
            await asyncio.wait_for(ws.receive_text(),timeout=60)
            decode(auth.get('token',''))
            owned(id,user)
            await ws.send_json({'type':'pong'})
    except (HTTPException,WebSocketDisconnect,asyncio.TimeoutError,ValueError):
        pass
    finally:
        clients[id].discard(ws)
        try: await ws.close()
        except RuntimeError: pass
