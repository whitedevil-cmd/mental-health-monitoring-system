"""Schemas for persisted conversation history."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ConversationExchangeCreate(BaseModel):
    """Persisted user -> assistant exchange payload."""

    user_id: str
    session_id: str = Field(..., min_length=1)
    transcript: str = Field(..., min_length=1)
    detected_emotion: str = Field(..., min_length=1)
    confidence: float | None = None
    ai_response: str = Field(..., min_length=1)


class ConversationExchangeRead(BaseModel):
    """Created conversation exchange row."""

    id: int | str | None = None
    user_id: str
    session_id: str
    transcript: str
    detected_emotion: str
    confidence: float | None = None
    ai_response: str
    created_at: datetime


class ConversationTurn(BaseModel):
    """Renderable turn in a conversation session."""

    id: str
    role: Literal["user", "assistant"]
    text: str
    timestamp: datetime
    emotion: str | None = None
    confidence: float | None = None


class ConversationSessionSummary(BaseModel):
    """List item for conversation history."""

    id: str
    started_at: datetime
    updated_at: datetime
    dominant_emotion: str | None = None
    preview: str
    turn_count: int


class ConversationSessionDetail(ConversationSessionSummary):
    """Detailed conversation history for a single session."""

    turns: list[ConversationTurn]
