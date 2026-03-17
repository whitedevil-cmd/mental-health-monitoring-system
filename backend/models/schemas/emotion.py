"""Pydantic schemas for emotion-related API payloads."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class EmotionReadingCreate(BaseModel):
    """Input schema for creating an emotion reading."""

    user_id: str
    audio_id: str | None = None
    emotion_label: str
    confidence: float | None = None
    transcript: str | None = None


class EmotionReadingRead(BaseModel):
    """Output schema for returning an emotion reading to clients."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: str
    audio_id: str | None
    emotion_label: str
    confidence: float | None
    transcript: str | None
    created_at: datetime


class EmotionInsightsSummary(BaseModel):
    """Dashboard summary built from stored emotion logs."""

    sessions: int
    top_emotion: str | None = None
    emotion_distribution: dict[str, int]


class EmotionHistoryItem(BaseModel):
    """History item returned by the top-level and v1 history endpoints."""

    timestamp: datetime
    emotion: str
    confidence: float
    transcript: str | None = None
