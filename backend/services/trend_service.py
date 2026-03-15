from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.repositories.emotion_repository import EmotionRepository
from backend.models.domain.emotion import EmotionReading
from backend.models.schemas.insight import EmotionTrendPoint, InsightResponse, TrendAnalysisResponse
from backend.services.trend_analyzer import analyze_emotion_trends

logger = logging.getLogger(__name__)


class TrendService:
    """Build dashboard-ready insight and trend responses from stored readings."""

    def __init__(
        self,
        repository_factory: Callable[[AsyncSession], EmotionRepository] | None = None,
    ) -> None:
        self._repository_factory = repository_factory

    def _repository(self, session: AsyncSession) -> EmotionRepository:
        repository_factory = self._repository_factory or EmotionRepository
        return repository_factory(session)

    async def analyze_user_trend(self, session: AsyncSession, user_id: str) -> TrendAnalysisResponse:
        """Return summarized emotional trend analysis for the last 7 days."""
        repo = self._repository(session)
        readings = await repo.list_readings_for_user_in_last_days(user_id=user_id, days=7)
        analysis = analyze_emotion_trends([self._reading_to_log(reading) for reading in readings])

        stress_level = str(analysis.get("stress_level", "unknown"))
        pattern = str(analysis.get("dominant_pattern", "insufficient data"))
        recommendation = self._build_recommendation(stress_level=stress_level, pattern=pattern)

        logger.info("Trend analysis generated for user %s with pattern %s", user_id, pattern)
        return TrendAnalysisResponse(
            stress_level=stress_level,
            pattern=pattern,
            recommendation=recommendation,
        )

    async def build_insights(self, session: AsyncSession, user_id: str) -> InsightResponse:
        """Return the stored trend points for a user, ready for supportive messaging."""
        repo = self._repository(session)
        readings = await repo.list_readings_for_user(user_id)
        trend = [self._build_trend_point(reading) for reading in readings]
        latest_transcript = getattr(readings[-1], "transcript", None) if readings else None

        logger.info("Built %s insight points for user %s", len(trend), user_id)
        return InsightResponse(
            user_id=user_id,
            trend=trend,
            supportive_message=None,
            transcript=latest_transcript,
        )

    @staticmethod
    def _build_trend_point(reading: EmotionReading | Any) -> EmotionTrendPoint:
        timestamp = getattr(reading, "created_at", None) or getattr(reading, "timestamp", None)
        emotion = getattr(reading, "emotion_label", None) or getattr(reading, "emotion", "neutral")
        confidence = getattr(reading, "confidence", None)
        return EmotionTrendPoint(
            timestamp=timestamp,
            dominant_emotion=emotion,
            confidence=confidence,
        )

    @staticmethod
    def _reading_to_log(reading: EmotionReading | Any) -> dict[str, Any]:
        return {
            "emotion_label": getattr(reading, "emotion_label", None) or getattr(reading, "emotion", ""),
            "confidence": getattr(reading, "confidence", None),
            "created_at": getattr(reading, "created_at", None) or getattr(reading, "timestamp", None),
        }

    @staticmethod
    def _build_recommendation(*, stress_level: str, pattern: str) -> str:
        if stress_level == "high":
            return "Consider slowing down, checking in with someone you trust, and taking a short calming break today."
        if "increasing sadness" in pattern.lower():
            return "Acknowledge the recent downward trend and add one supportive routine or connection point to your day."
        if stress_level == "moderate":
            return "Try a brief reset like hydration, a walk, or a few quiet minutes to keep stress from building."
        if stress_level == "low":
            return "Your recent pattern looks fairly manageable; keep using the habits that are helping."
        return "There is not enough recent data yet, so keep checking in and the dashboard will grow more useful over time."
