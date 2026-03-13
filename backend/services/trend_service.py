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
from backend.models.schemas.insight import EmotionTrendPoint, InsightResponse, TrendAnalysisResponse
from backend.services.trend_analyzer import analyze_emotion_trends


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

    async def analyze_user_trend(self, session: AsyncSession, user_id: str) -> TrendAnalysisResponse:
        """
        Query the last 7 days of emotion logs, run the trend analysis module,
        and return the insights as a TrendAnalysisResponse.
        """
        repo = EmotionRepository(session)
        readings = await repo.list_readings_for_user_in_last_days(user_id, days=7)
        
        # Convert DB models to the expected dictionary format for the analyzer
        logs = [
            {
                "emotion_label": r.emotion_label,
                "confidence": r.confidence,
                "created_at": r.created_at
            }
            for r in readings
        ]
        
        analysis_result = analyze_emotion_trends(logs)
        
        # Generate a placeholder recommendation based on stress level
        recommendation = "keep logging your emotions."
        if analysis_result["stress_level"] == "high":
            recommendation = "user may need immediate emotional support."
        elif analysis_result["stress_level"] == "moderate" or "increasing sadness" in analysis_result["dominant_pattern"]:
            recommendation = "user may need emotional support."

        return TrendAnalysisResponse(
            stress_level=analysis_result["stress_level"],
            pattern=analysis_result["dominant_pattern"],
            recommendation=recommendation
        )


