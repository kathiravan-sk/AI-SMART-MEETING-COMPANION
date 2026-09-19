import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app, reward, rate_windows
from app.database.store import store
from app.services.intelligence import DEMO, clean_questions

@pytest.fixture
def client():
    rate_windows.clear()
    with TestClient(app) as c:
        yield c

@pytest.fixture
def headers(client):
    out=client.post('/auth/register',json={'name':'Test Learner','email':f'{uuid.uuid4().hex}@test.dev','password':'safe-testing-password'})
    assert out.status_code==201
    return {'Authorization':'Bearer '+out.json()['token']}

def meeting(client,headers,language='en',sample=True):
    out=client.post('/meetings',headers=headers,json={'title':'ML lecture','consent':True,'demo':sample,'language':language})
    assert out.status_code==201
    return out.json()['id']

def feed(client,headers,id,language='en',count=8):
    for i,fact in enumerate(DEMO[language]['facts'][:count]):
        out=client.post(f'/meetings/{id}/transcript',headers=headers,json={'text':fact[0],'language':language,'clientId':f'test-{i}'})
        assert out.status_code==200,out.text

def test_full_pipeline_multilingual_quiz_rewards_export_delete(client,headers):
    id=meeting(client,headers)
    feed(client,headers,id)
    live=client.get(f'/meetings/{id}',headers=headers).json()
    assert live['summary']['keyPoints']
    assert live['status']=='live'
    known=client.post(f'/meetings/{id}/ask',headers=headers,json={'question':'What does supervised learning use?','language':'ta'}).json()
    assert known['grounded'] and known['sources']
    assert 'பெயரிடப்பட்ட' in known['answer']
    unknown=client.post(f'/meetings/{id}/ask',headers=headers,json={'question':'Who won Wimbledon?'}).json()
    assert not unknown['grounded'] and unknown['sources']==[]
    stopped=client.post(f'/meetings/{id}/stop',headers=headers).json()
    assert stopped['status']=='completed' and stopped['quizId']
    for lang in ['en','ta','ml','hi']:
        translated=client.post(f'/meetings/{id}/translate',headers=headers,json={'language':lang})
        assert translated.status_code==200
        assert len(translated.json()['summary']['questions'])==8
        q=client.get(f'/meetings/{id}/quiz?language={lang}',headers=headers).json()
        assert len(q['questions'])==8
        assert all('answer' not in x and 'correctIndex' not in x for x in q['questions'])
    original=client.get(f'/meetings/{id}',headers=headers).json()
    assert original['transcript'][0]['originalText']==DEMO['en']['facts'][0][0]
    canonical=store.get('quizzes',stopped['quizId'])
    answers={v['id']:v['correctIndex'] for v in canonical['questions']}
    first=client.post(f"/quiz/{canonical['id']}/submit",headers=headers,json={'answers':answers,'timeTaken':36,'language':'hi'})
    assert first.status_code==200,first.text
    result=first.json()
    assert result['percentage']==100 and result['xpEarned']==200 and result['badge']=='Meeting Master'
    assert result['review'][0]['question']==DEMO['hi']['facts'][0][1]
    second=client.post(f"/quiz/{canonical['id']}/submit",headers=headers,json={'answers':answers}).json()
    assert second['xpEarned']==0
    dashboard=client.get('/dashboard',headers=headers).json()
    assert dashboard['totalXP']==200 and dashboard['meetingsCompleted']==1
    assert dashboard['completedQuizzes']==1 and dashboard['streak']==1
    assert client.get(f'/meetings/{id}/export',headers=headers).json()['id']==id
    assert client.delete(f'/meetings/{id}',headers=headers).status_code==200
    assert client.get('/dashboard',headers=headers).json()['totalXP']==0
    assert client.get(f'/meetings/{id}',headers=headers).status_code==404

@pytest.mark.parametrize('percentage,expected,badge',[(0,0,None),(49.99,0,None),(50,50,'Starter'),(59,50,'Starter'),(60,75,'Quick Learner'),(70,100,'Knowledge Builder'),(80,150,'Smart Learner'),(90,200,'Meeting Master'),(100,200,'Meeting Master')])
def test_reward_boundaries(percentage,expected,badge):
    assert reward(percentage)==(expected,badge)

def test_pause_dedup_and_stopped_ingest(client,headers):
    id=meeting(client,headers)
    body={'text':DEMO['en']['facts'][0][0],'clientId':'retry-safe'}
    first=client.post(f'/meetings/{id}/transcript',headers=headers,json=body).json()
    second=client.post(f'/meetings/{id}/transcript',headers=headers,json=body).json()
    assert first['id']==second['id']
    assert len(client.get(f'/meetings/{id}',headers=headers).json()['transcript'])==1
    assert client.patch(f'/meetings/{id}/status',headers=headers,json={'status':'paused'}).status_code==200
    assert client.post(f'/meetings/{id}/transcript',headers=headers,json=body).status_code==409
    client.patch(f'/meetings/{id}/status',headers=headers,json={'status':'live'})
    client.post(f'/meetings/{id}/stop',headers=headers)
    assert client.patch(f'/meetings/{id}/status',headers=headers,json={'status':'live'}).status_code==409
    assert client.post(f'/meetings/{id}/transcript',headers=headers,json=body).status_code==409

def test_ownership_and_websocket_auth(client,headers):
    id=meeting(client,headers);feed(client,headers,id,count=2)
    stopped=client.post(f'/meetings/{id}/stop',headers=headers).json()
    token=client.post('/auth/register',json={'email':'other-'+uuid.uuid4().hex+'@test.dev','password':'another-password'}).json()['token']
    other={'Authorization':'Bearer '+token}
    for path in [f'/meetings/{id}',f'/meetings/{id}/summary',f'/meetings/{id}/questions',f'/meetings/{id}/quiz',f'/meetings/{id}/export']:
        assert client.get(path,headers=other).status_code==404
    assert client.post(f'/meetings/{id}/ask',headers=other,json={'question':'What is learning?'}).status_code==404
    assert client.post(f"/quiz/{stopped['quizId']}/submit",headers=other,json={'answers':{}}).status_code==404
    assert client.delete(f'/meetings/{id}',headers=other).status_code==404
    with client.websocket_connect(f'/ws/meetings/{id}') as ws:
        ws.send_json({'token':headers['Authorization'].split(' ')[1]})
        assert ws.receive_json()['type']=='connected'
        ws.send_text('ping');assert ws.receive_json()['type']=='pong'
    with client.websocket_connect(f'/ws/meetings/{id}') as ws:
        ws.send_json({'token':token})
        assert ws.receive()['type']=='websocket.close'
    assert client.get('/meetings').status_code==401

def test_consent_auth_validation_empty_quiz(client,headers):
    assert client.post('/meetings',headers=headers,json={'title':'No consent'}).status_code==400
    assert client.post('/auth/login',json={'email':'absent@example.com','password':'wrong-pass'}).status_code==401
    id=meeting(client,headers)
    assert client.post(f'/meetings/{id}/transcript',headers=headers,json={'text':'   ','clientId':'blank'}).status_code==422
    assert client.post(f'/meetings/{id}/translate',headers=headers,json={'language':'fr'}).status_code==422
    assert client.post(f'/meetings/{id}/quiz/generate',headers=headers).status_code==409
    assert client.post(f'/meetings/{id}/stop',headers=headers).json()['quizId'] is None
    assert client.post(f'/meetings/{id}/quiz/generate',headers=headers).status_code==409

@pytest.mark.parametrize('lang',['ta','ml','hi'])
def test_non_english_originals(client,headers,lang):
    id=meeting(client,headers,lang);feed(client,headers,id,lang,count=3)
    m=client.post(f'/meetings/{id}/stop',headers=headers).json()
    assert m['summary']['questions'][0]['question']==DEMO[lang]['facts'][0][1]
    translated=client.post(f'/meetings/{id}/translate',headers=headers,json={'language':'en'}).json()
    assert translated['summary']['questions'][0]['question']==DEMO['en']['facts'][0][1]
    client.delete(f'/meetings/{id}/transcript',headers=headers)
    cleared=client.get(f'/meetings/{id}',headers=headers).json()
    assert cleared['transcript']==[] and cleared['quizId'] is None and not cleared['summary']['keyPoints']

def test_untranslated_custom_content_is_honest_and_short_answer_works(client,headers):
    id=meeting(client,headers,sample=False)
    client.post(f'/meetings/{id}/transcript',headers=headers,json={'text':'Encapsulation protects internal state by controlling access to object fields.','clientId':'custom'})
    assert client.post(f'/meetings/{id}/translate',headers=headers,json={'language':'hi'}).status_code==409
    stopped=client.post(f'/meetings/{id}/stop',headers=headers).json()
    quiz=store.get('quizzes',stopped['quizId'])
    assert quiz['questions'][0]['type']=='short_answer'
    answers={q['id']:q['answer'].upper()+'.' for q in quiz['questions']}
    out=client.post(f"/quiz/{quiz['id']}/submit",headers=headers,json={'answers':answers}).json()
    assert out['percentage']==100
    assert client.post(f"/quiz/{quiz['id']}/submit",headers=headers,json={'answers':{}}).status_code==422

def test_ai_output_validation_rejects_bad_sources_and_indices():
    good={'question':'What is learning?','answer':'Data','type':'multiple_choice','options':['Data','Nothing'],'correctIndex':0,'sourceTranscriptIds':['c1']}
    bad={**good,'sourceTranscriptIds':['invented']}
    invalid={**good,'correctIndex':4}
    assert len(clean_questions([good,bad,invalid],[{'id':'c1'}]))==1

def test_submission_exactly_half_passes_and_only_improvement_earns(client,headers):
    id=meeting(client,headers);feed(client,headers,id,count=4)
    m=client.post(f'/meetings/{id}/stop',headers=headers).json();q=store.get('quizzes',m['quizId'])
    answers={v['id']:v['correctIndex'] if i<2 else (v['correctIndex']+1)%len(v['options']) for i,v in enumerate(q['questions'])}
    r=client.post(f"/quiz/{q['id']}/submit",headers=headers,json={'answers':answers}).json()
    assert r['percentage']==50 and r['passed'] and r['xpEarned']==50
    improved={v['id']:v['correctIndex'] for v in q['questions']}
    r=client.post(f"/quiz/{q['id']}/submit",headers=headers,json={'answers':improved}).json()
    assert r['xpEarned']==150
