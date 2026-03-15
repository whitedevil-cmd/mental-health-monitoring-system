"""Pydantic schemas for emotion insights and trends."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class EmotionTrendPoint(BaseModel):
    """Represents aggregated emotion information for a time bucket."""

    timestamp: datetime
    dominant_emotion: str
    confidence: float | None = None


class InsightResponse(BaseModel):
    """High-level emotional insight for a user."""

    user_id: str
    trend: list[EmotionTrendPoint]
    supportive_message: str | None = None
    transcript: str | None = None


class TrendAnalysisResponse(BaseModel):
    """Detailed emotional trend analysis over a specified period."""

    stress_level: str
    pattern: str
    recommendation: str
