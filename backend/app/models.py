from typing import Literal
from pydantic import BaseModel, Field, field_validator
Language = Literal['en', 'ta', 'ml', 'hi']
class Credentials(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(default='Learner', min_length=1, max_length=60)
    @field_validator('email')
    @classmethod
    def valid_email(cls, value):
        value = value.strip().lower()
        if '@' not in value or '.' not in value.split('@')[-1]:
            raise ValueError('Enter a valid email address')
        return value
class GoogleCredential(BaseModel):
    credential: str = Field(min_length=20)
class NewMeeting(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    platform: str = Field(default='Browser', max_length=80)
    language: Language = 'en'
    consent: bool = False
    demo: bool = False
class ChunkInput(BaseModel):
    text: str = Field(min_length=1, max_length=6000)
    speaker: str = Field(default='Speaker', max_length=100)
    language: Language = 'en'
    clientId: str = Field(min_length=1, max_length=100)
    startTime: float = Field(default=0, ge=0)
    endTime: float = Field(default=0, ge=0)
    @field_validator('text')
    @classmethod
    def no_blank(cls, value):
        if not value.strip():
            raise ValueError('Transcript must not be blank')
        return value.strip()
class AskInput(BaseModel):
    question: str = Field(min_length=2, max_length=2000)
    language: Language = 'en'
class TranslateInput(BaseModel):
    language: Language
class StatusInput(BaseModel):
    status: Literal['live', 'paused']
class Submission(BaseModel):
    language: Language = 'en'
    answers: dict[str, str | int]
    timeTaken: int = Field(default=0, ge=0, le=86400)
class AIQuestion(BaseModel):
    question: str = Field(min_length=3, max_length=1500)
    answer: str = Field(min_length=1, max_length=1500)
    difficulty: Literal['Easy', 'Medium', 'Hard'] = 'Medium'
    type: Literal['multiple_choice', 'true_false', 'short_answer'] = 'multiple_choice'
    options: list[str] = Field(default_factory=list, max_length=6)
    correctIndex: int | None = None
    sourceTranscriptIds: list[str] = Field(min_length=1)
class SummaryData(BaseModel):
    overview: str = ''
    currentTopic: str = ''
    keyPoints: list[str] = Field(default_factory=list, max_length=30)
    concepts: list[str] = Field(default_factory=list, max_length=20)
    topics: list[str] = Field(default_factory=list, max_length=20)
    decisions: list[str] = Field(default_factory=list, max_length=20)
    actionItems: list[str] = Field(default_factory=list, max_length=20)
    questions: list[AIQuestion] = Field(default_factory=list, max_length=30)
