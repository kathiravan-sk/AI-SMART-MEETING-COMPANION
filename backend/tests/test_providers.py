import asyncio
import json
import httpx
import pytest
from app.ai.providers import OpenAIProvider, GeminiProvider, OllamaProvider
from app.services.intelligence import summarize
from app.translation.service import TranslationService

@pytest.mark.parametrize('provider_class,kind',[(OpenAIProvider,'openai'),(GeminiProvider,'gemini'),(OllamaProvider,'ollama')])
def test_provider_request_contracts_and_json_parsing(monkeypatch,provider_class,kind):
    monkeypatch.setenv('AI_API_KEY','test-key-not-real')
    monkeypatch.setenv('AI_MODEL','test-model')
    calls=[]
    def handle(request):
        data=json.loads(request.content);calls.append((request,data))
        if kind=='openai':return httpx.Response(200,json={'choices':[{'message':{'content':'{"ok":true}'}}]})
        if kind=='gemini':return httpx.Response(200,json={'candidates':[{'content':{'parts':[{'text':'{"ok":true}'}]}}]})
        return httpx.Response(200,json={'message':{'content':'{"ok":true}'}})
    original=httpx.AsyncClient
    monkeypatch.setattr(httpx,'AsyncClient',lambda **kwargs:original(transport=httpx.MockTransport(handle),**kwargs))
    assert asyncio.run(provider_class().complete('Be grounded',{'source':'hello'}))=={'ok':True}
    request,data=calls[0]
    assert 'Be grounded' in request.content.decode()
    if kind=='openai':
        assert request.headers['authorization']=='Bearer test-key-not-real'
        assert data['response_format']=={'type':'json_object'}
    elif kind=='gemini':
        assert request.headers['x-goog-api-key']=='test-key-not-real'
        assert data['generationConfig']['responseMimeType']=='application/json'
    else:
        assert data['stream'] is False and data['format']=='json'


def test_real_summary_uses_only_new_chunks_and_validates_sources(monkeypatch):
    import app.services.intelligence as service
    monkeypatch.setattr(service,'PROVIDER','openai')
    calls=[]
    class FakeProvider:
        async def complete(self,instruction,data):
            calls.append(data)
            return {'overview':'A summary','currentTopic':'Topic','keyPoints':['New evidence'], 'questions':[{'question':'What changed?','answer':'New evidence','sourceTranscriptIds':['new'],'options':['New evidence','Nothing'],'correctIndex':0}]}
    monkeypatch.setattr(service,'provider',FakeProvider())
    m={'title':'Topic','transcript':[{'id':'old','originalText':'Old information'},{'id':'new','originalText':'New evidence'}], 'processedCount':1,'revision':2,'summary':service.blank_summary(),'translations':{'ta':{}},'detectedLanguage':'en'}
    asyncio.run(summarize(m))
    assert [c['id'] for c in calls[0]['newChunks']]==['new']
    assert m['processedCount']==2 and m['revision']==3 and not m['translations']
    assert m['summary']['questions'][0]['sourceTranscriptIds']==['new']


def test_translation_uses_original_not_previous_target(monkeypatch):
    import app.translation.service as service
    from app.services.intelligence import blank_summary
    monkeypatch.setattr(service,'PROVIDER','openai')
    calls=[]
    class FakeProvider:
        async def complete(self,instruction,data):
            calls.append(dict(data))
            return {**data,'overview':'Translated content'}
    monkeypatch.setattr(service,'provider',FakeProvider())
    summary=blank_summary();summary['overview']='Original content'
    m={'summary':summary,'detectedLanguage':'en','revision':1,'translations':{}}
    translation=TranslationService()
    asyncio.run(translation.translate(m,'ta'))
    asyncio.run(translation.translate(m,'ml'))
    assert len(calls)==2 and all(c['overview']=='Original content' for c in calls)
    assert m['summary']['overview']=='Original content'
