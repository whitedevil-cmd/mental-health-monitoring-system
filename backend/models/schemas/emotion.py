"""
Pydantic schemas for emotion-related API payloads.

These models define the shape of request and response bodies for the
emotion APIs, decoupling API contracts from database models.
"""

from datetime import datetime

from pydantic import BaseModel


class EmotionReadingCreate(BaseModel):
    """Input schema for creating an emotion reading (placeholder)."""

    user_id: str
    audio_id: str | None = None
    emotion_label: str
    confidence: float | None = None


class EmotionReadingRead(BaseModel):
    """Output schema for returning an emotion reading to clients."""

    id: int
    user_id: str
    audio_id: str | None
    emotion_label: str
    confidence: float | None
    created_at: datetime

    class Config:
        from_attributes = True

"""
Pydantic schemas for emotion-related API payloads.

These models define the shape of request and response bodies for the
emotion APIs, decoupling API contracts from database models.
"""

from datetime import datetime

from pydantic import BaseModel


class EmotionReadingCreate(BaseModel):
    """Input schema for creating an emotion reading (placeholder)."""

    user_id: str
    audio_id: str | None = None
    emotion_label: str
    confidence: float | None = None


class EmotionReadingRead(BaseModel):
    """Output schema for returning an emotion reading to clients."""

    id: int
    user_id: str
    audio_id: str | None
    emotion_label: str
    confidence: float | None
    created_at: datetime

    class Config:
        from_attributes = True

