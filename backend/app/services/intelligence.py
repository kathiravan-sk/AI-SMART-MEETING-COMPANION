import json
import re
import hashlib
from pathlib import Path
from app.ai.providers import provider
from app.config import PROVIDER, LANGUAGES
from app.models import SummaryData, AIQuestion
DEMO_PATH = Path(__file__).resolve().parents[3] / 'shared/demo.json'
if not DEMO_PATH.exists():
    DEMO_PATH = Path(__file__).resolve().parents[4] / 'shared/demo.json'
DEMO = json.loads(DEMO_PATH.read_text(encoding='utf-8'))

def blank_summary():
    return SummaryData().model_dump()

def fact_index(text):
    for lang in DEMO.values():
        for i, fact in enumerate(lang['facts']):
            if text.strip() == fact[0]:
                return i
    return None

def demo_question(i, chunk_id, lang='en'):
    fact = DEMO[lang]['facts'][i]
    return {'id': 'q-' + chunk_id, 'question': fact[1], 'answer': fact[2][fact[3]],
            'options': fact[2], 'correctIndex': fact[3], 'type': 'true_false' if i == 2 else 'multiple_choice',
            'difficulty': 'Easy' if i < 3 else 'Medium' if i < 6 else 'Hard', 'sourceTranscriptIds': [chunk_id], 'factIndex': i}

def clean_questions(questions, chunks):
    valid_ids = {c['id'] for c in chunks}
    result, seen = [], set()
    for q in questions:
        try:
            v = AIQuestion.model_validate(q).model_dump()
            key = v['question'].strip().casefold()
            if key in seen or not set(v['sourceTranscriptIds']).issubset(valid_ids):
                continue
            if v['type'] != 'short_answer':
                index = v['correctIndex']
                if len(v['options']) < 2 or index is None or index < 0 or index >= len(v['options']) or len(set(v['options'])) != len(v['options']):
                    continue
                if v['type'] == 'true_false' and len(v['options']) != 2:
                    continue
                v['answer'] = v['options'][index]
            v['id'] = q.get('id') or 'q-' + hashlib.sha256((key + '|'.join(v['sourceTranscriptIds'])).encode()).hexdigest()[:20]
            seen.add(key)
            result.append(v)
        except (ValueError, TypeError):
            continue
    return result[:30]

async def summarize(meeting, force=False):
    chunks = meeting['transcript']
    start = meeting.get('processedCount', 0)
    new = chunks[start:]
    if not new:
        return
    previous = meeting.get('summary') or blank_summary()
    if PROVIDER == 'demo':
        result = dict(previous)
        meaningful = [c for c in new if len(c['originalText'].split()) >= 5 or len(c['originalText']) >= 35]
        result['keyPoints'] = list(dict.fromkeys(previous['keyPoints'] + [c['originalText'] for c in meaningful]))[-24:]
        result['overview'] = ' '.join(result['keyPoints'][:3])
        result['currentTopic'] = meeting['title']
        result['topics'] = [meeting['title']]
        questions = list(previous['questions'])
        for c in meaningful:
            i = fact_index(c['originalText'])
            if i is not None:
                questions.append(demo_question(i, c['id'], meeting['detectedLanguage']))
            elif len(c['originalText'].split()) >= 8:
                words = c['originalText'].split()
                answer = max((w.strip('.,:;!?') for w in words), key=len)
                question = 'Complete this meeting statement: ' + c['originalText'].replace(answer, '____', 1)
                questions.append({'id': 'q-' + c['id'], 'question': question, 'answer': answer, 'type': 'short_answer', 'difficulty': 'Easy', 'options': [], 'correctIndex': None, 'sourceTranscriptIds': [c['id']]})
        result['questions'] = list({q['id']: q for q in questions}.values())[:30]
        result['concepts'] = result['keyPoints'][:8]
    else:
        result = previous
        # Bounded batches avoid repeatedly shipping the complete meeting.
        for offset in range(0, len(new), 12):
            batch = new[offset:offset + 12]
            raw = await provider.complete(
                'Update the rolling summary with only the new chunks. Preserve important prior facts. '
                'Write in the original meeting language. Return {overview,currentTopic,keyPoints,concepts,topics,decisions,actionItems,questions}. '
                'All list fields except questions are arrays of strings. questions contain {question,answer,type,difficulty,options,correctIndex,sourceTranscriptIds}. '
                'type is multiple_choice, true_false or short_answer; difficulty Easy/Medium/Hard. correctIndex is zero-based. '
                'Only include questions supported by supplied source IDs. Keep at most 24 key points and 15 questions. No filler.',
                {'previous': result, 'newChunks': batch})
            result = SummaryData.model_validate(raw).model_dump()
            result['questions'] = clean_questions(result['questions'], chunks)
    meeting['summary'] = result
    meeting['processedCount'] = len(chunks)
    meeting['revision'] += 1
    meeting['translations'] = {}
    meeting['aiError'] = None

STOPWORDS = set('what which how when where why is are a an the of to in on for this that explain does do me about please'.split())
def tokens(text):
    return set(re.findall(r'[^\W_]+', text.casefold(), flags=re.UNICODE)) - STOPWORDS

def retrieve(chunks, question, limit=6):
    query = tokens(question)
    ranked = []
    for c in chunks:
        words = tokens(c['originalText'])
        i = fact_index(c['originalText'])
        if i is not None:
            for locale in DEMO.values():
                words |= tokens(locale['facts'][i][0]) | tokens(locale['facts'][i][1])
        score = len(query & words) / max(1, len(query))
        if score:
            ranked.append((score, c))
    return [c for _, c in sorted(ranked, key=lambda x: x[0], reverse=True)[:limit]]

async def answer(meeting, question, language):
    relevant = retrieve(meeting['transcript'], question)
    if PROVIDER == 'demo':
        if not relevant:
            return {'answer': DEMO[language]['notDiscussed'], 'sources': [], 'grounded': False}
        sources = relevant[:2]
        texts = []
        for c in sources:
            i = fact_index(c['originalText'])
            texts.append(DEMO[language]['facts'][i][0] if i is not None else c['originalText'])
        return {'answer': ' '.join(texts), 'sources': sources, 'grounded': True, 'mode': 'extractive'}
    # Multilingual lexical misses can still use recent context; the model must abstain if unsupported.
    candidates = relevant or meeting['transcript'][-6:]
    raw = await provider.complete('Answer briefly in ' + LANGUAGES[language] + '. Use only the meeting sources. '
        'If unsupported, say the topic was not discussed. Return {answer:string, grounded:boolean, sourceTranscriptIds:string[]}. '
        'Use 2-5 sentences. Source IDs must come from supplied chunks.',
        {'question': question, 'sources': candidates, 'summary': meeting['summary']['overview']})
    ids = set(raw.get('sourceTranscriptIds', []))
    sources = [c for c in candidates if c['id'] in ids]
    grounded = raw.get('grounded') is True and bool(sources)
    return {'answer': str(raw.get('answer', ''))[:6000] if grounded else DEMO[language]['notDiscussed'], 'grounded': grounded, 'sources': sources}
