"""Dashboard analytics helpers built on stored emotion logs."""

from __future__ import annotations

from collections import Counter
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.emotion_log import EmotionLog
from backend.models.schemas.emotion import EmotionHistoryItem, EmotionInsightsSummary


class DashboardService:
    """Read dashboard-friendly analytics from stored detector logs."""

    async def get_insights(self, session: AsyncSession) -> EmotionInsightsSummary:
        """Return high-level counts for the dashboard."""
        logs = await self._list_logs(session)
        distribution = Counter(log.dominant_emotion for log in logs)
        top_emotion = distribution.most_common(1)[0][0] if distribution else None
        return EmotionInsightsSummary(
            sessions=len(logs),
            top_emotion=top_emotion,
            emotion_distribution=dict(distribution),
        )

    async def get_history(self, session: AsyncSession) -> list[EmotionHistoryItem]:
        """Return stored session history ordered from newest to oldest."""
        logs = await self._list_logs(session)
        return [
            EmotionHistoryItem(
                timestamp=log.timestamp,
                emotion=log.dominant_emotion,
                confidence=self._confidence_for_log(log),
                transcript=log.transcript,
            )
            for log in logs
        ]

    @staticmethod
    async def _list_logs(session: AsyncSession) -> Sequence[EmotionLog]:
        result = await session.execute(
            select(EmotionLog).order_by(EmotionLog.timestamp.desc(), EmotionLog.id.desc())
        )
        return result.scalars().all()

    @staticmethod
    def _confidence_for_log(log: EmotionLog) -> float:
        score_map = {
            "sad": log.sad_score,
            "happy": log.happy_score,
            "angry": log.angry_score,
            "neutral": log.neutral_score,
        }
        dominant_key = log.dominant_emotion.strip().lower()
        return float(score_map.get(dominant_key, 0.0))
