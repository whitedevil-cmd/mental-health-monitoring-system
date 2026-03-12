"""
Service layer for emotion trend analysis.

This module is responsible for aggregating emotion readings over time
and turning them into higher-level insights for users.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.repositories.emotion_repository import EmotionRepository
from backend.models.schemas.insight import EmotionTrendPoint, InsightResponse


class TrendService:
    """
    High-level operations for building emotion trends and insights.

    The current implementation returns a synthetic trend based on raw
    readings; real aggregation logic can be added later.
    """

    async def build_insights(self, session: AsyncSession, user_id: str) -> InsightResponse:
        """
        Construct a minimal insight response from existing readings.

        In a real system this could:
        - Aggregate by day/week.
        - Detect long-term patterns.
        - Flag potential risk signals.
        """
        repo = EmotionRepository(session)
        readings = await repo.list_readings_for_user(user_id)

        trend_points: list[EmotionTrendPoint] = []
        for r in readings:
            trend_points.append(
                EmotionTrendPoint(
                    timestamp=r.created_at,
                    dominant_emotion=r.emotion_label,
                    confidence=r.confidence,
                )
            )

        return InsightResponse(
            user_id=user_id,
            trend=trend_points,
            supportive_message=None,
        )

"""
Service layer for emotion trend analysis.

This module is responsible for aggregating emotion readings over time
and turning them into higher-level insights for users.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.repositories.emotion_repository import EmotionRepository
from backend.models.schemas.insight import EmotionTrendPoint, InsightResponse


class TrendService:
    """
    High-level operations for building emotion trends and insights.

    The current implementation returns a synthetic trend based on raw
    readings; real aggregation logic can be added later.
    """

    async def build_insights(self, session: AsyncSession, user_id: str) -> InsightResponse:
        """
        Construct a minimal insight response from existing readings.

        In a real system this could:
        - Aggregate by day/week.
        - Detect long-term patterns.
        - Flag potential risk signals.
        """
        repo = EmotionRepository(session)
        readings = await repo.list_readings_for_user(user_id)

        trend_points: list[EmotionTrendPoint] = []
        for r in readings:
            trend_points.append(
                EmotionTrendPoint(
                    timestamp=r.created_at,
                    dominant_emotion=r.emotion_label,
                    confidence=r.confidence,
                )
            )

        return InsightResponse(
            user_id=user_id,
            trend=trend_points,
            supportive_message=None,
        )

