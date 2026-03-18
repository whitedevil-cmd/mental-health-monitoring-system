from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

from backend.storage.repositories.emotion_repository import EmotionRepository
from backend.models.schemas.insight import EmotionTrendPoint, InsightResponse, TrendAnalysisResponse
from backend.services.trend_analyzer import analyze_emotion_trends

logger = logging.getLogger(__name__)


class TrendService:
    """Build dashboard-ready insight and trend responses from stored readings."""

    def __init__(
        self,
        repository_factory: Callable[[], EmotionRepository] | None = None,
    ) -> None:
        self._repository_factory = repository_factory

    def _repository(self) -> EmotionRepository:
        repository_factory = self._repository_factory or EmotionRepository
        return repository_factory()

    async def analyze_user_trend(self, user_id: str, session: object | None = None) -> TrendAnalysisResponse:  # noqa: ARG002
        """Return summarized emotional trend analysis for the last 7 days."""
        repo = self._repository()
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

    async def build_insights(self, user_id: str, session: object | None = None) -> InsightResponse:  # noqa: ARG002
        """Return the stored trend points for a user, ready for supportive messaging."""
        repo = self._repository()
        readings = await repo.list_readings_for_user(user_id)
        trend = [self._build_trend_point(reading) for reading in readings]
        latest_transcript = self._value(readings[-1], "transcript") if readings else None

        logger.info("Built %s insight points for user %s", len(trend), user_id)
        return InsightResponse(
            user_id=user_id,
            trend=trend,
            supportive_message=None,
            transcript=latest_transcript,
        )

    @staticmethod
    def _value(reading: Any, key: str, fallback: Any = None) -> Any:
        if isinstance(reading, dict):
            return reading.get(key, fallback)
        return getattr(reading, key, fallback)

    @classmethod
    def _build_trend_point(cls, reading: dict[str, Any]) -> EmotionTrendPoint:
        timestamp = cls._value(reading, "created_at") or cls._value(reading, "timestamp")
        emotion = cls._value(reading, "emotion_label") or cls._value(reading, "emotion", "neutral")
        confidence = cls._value(reading, "confidence")
        return EmotionTrendPoint(
            timestamp=timestamp,
            dominant_emotion=emotion,
            confidence=confidence,
        )

    @classmethod
    def _reading_to_log(cls, reading: dict[str, Any]) -> dict[str, Any]:
        return {
            "emotion_label": cls._value(reading, "emotion_label") or cls._value(reading, "emotion", ""),
            "confidence": cls._value(reading, "confidence"),
            "created_at": cls._value(reading, "created_at") or cls._value(reading, "timestamp"),
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
