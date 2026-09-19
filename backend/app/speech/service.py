import os
from abc import ABC, abstractmethod
from fastapi import HTTPException

class SpeechProvider(ABC):
    @abstractmethod
    def transcribe(self, path: str, language: str | None): ...

class FasterWhisperProvider(SpeechProvider):
    def __init__(self):
        self.model = None
    def transcribe(self, path, language=None):
        if os.getenv('STT_PROVIDER', 'disabled') != 'faster-whisper':
            raise HTTPException(503, 'Server transcription is disabled. Enable faster-whisper or use captions/browser microphone.')
        if self.model is None:
            try:
                from faster_whisper import WhisperModel
            except ImportError:
                raise HTTPException(503, 'Install backend/requirements-speech.txt to enable faster-whisper')
            self.model = WhisperModel(os.getenv('WHISPER_MODEL', 'base'), device='cpu', compute_type='int8')
        segments, info = self.model.transcribe(path, language=language, vad_filter=True)
        return {'text': ' '.join(s.text.strip() for s in segments), 'language': info.language}
speech = FasterWhisperProvider()
