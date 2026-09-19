from copy import deepcopy
from fastapi import HTTPException
from app.config import PROVIDER, LANGUAGES
from app.ai.providers import provider
from app.services.intelligence import DEMO, fact_index, demo_question

class TranslationService:
    async def translate(self, meeting, language):
        summary = deepcopy(meeting['summary'])
        if language == meeting['detectedLanguage']:
            return {'summary': summary, 'language': language, 'revision': meeting['revision']}
        cached = meeting.get('translations', {}).get(language)
        if cached and cached['revision'] == meeting['revision']:
            return cached
        if PROVIDER == 'demo':
            if any(fact_index(c['originalText']) is None for c in meeting['transcript']):
                raise HTTPException(409, 'Demo translations cover the sample lesson. Configure an AI provider to translate your own meetings.')
            locale = DEMO[language]
            facts = [fact_index(c['originalText']) for c in meeting['transcript']]
            summary.update(overview=' '.join(locale['facts'][i][0] for i in facts[:3]), currentTopic=locale['title'],
                keyPoints=[locale['facts'][i][0] for i in facts], concepts=[locale['facts'][i][0] for i in facts], topics=locale['topics'] if facts else [])
            summary['questions'] = [demo_question(fact_index(c['originalText']), c['id'], language) for c in meeting['transcript']]
        else:
            # Always translates the canonical summary, never another translation.
            raw = await provider.complete('Translate the original content to ' + LANGUAGES[language] + '. '
                'Return the identical JSON shape. Translate human text only. Keep ids, sourceTranscriptIds, type, difficulty, correctIndex and order unchanged.', summary)
            from app.models import SummaryData
            validated = SummaryData.model_validate(raw).model_dump()
            original = summary['questions']
            if len(raw['questions']) != len(original):
                raise ValueError('Translation changed question count')
            for i, q in enumerate(raw['questions']):
                if q.get('id') != original[i]['id'] or len(q.get('options', [])) != len(original[i]['options']):
                    raise ValueError('Translation changed question structure')
                validated['questions'][i].update({k: original[i][k] for k in ['id','sourceTranscriptIds','correctIndex','type','difficulty']})
            summary = validated
        result = {'summary': summary, 'language': language, 'revision': meeting['revision']}
        meeting.setdefault('translations', {})[language] = result
        return result
translator = TranslationService()
