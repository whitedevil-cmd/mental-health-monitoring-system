"""Dashboard analytics helpers built on stored emotion logs."""

from __future__ import annotations

from collections import Counter

from backend.models.schemas.emotion import EmotionHistoryItem, EmotionInsightsSummary
from backend.storage.data_backend import StorageBackend


class DashboardService:
    """Read dashboard-friendly analytics from stored detector logs."""

    def __init__(self, data_service: StorageBackend | None = None) -> None:
        self._data_service = data_service or StorageBackend()

    async def get_insights(self, session: object | None = None, user_id: str | None = None) -> EmotionInsightsSummary:  # noqa: ARG002
        """Return high-level counts for the dashboard."""
        logs = await self._list_logs(user_id=user_id)
        distribution = Counter(str(log.get("dominant_emotion", "")) for log in logs if log.get("dominant_emotion"))
        top_emotion = distribution.most_common(1)[0][0] if distribution else None
        return EmotionInsightsSummary(
            sessions=len(logs),
            top_emotion=top_emotion,
            emotion_distribution=dict(distribution),
        )

    async def get_history(self, session: object | None = None, user_id: str | None = None) -> list[EmotionHistoryItem]:  # noqa: ARG002
        """Return stored session history ordered from newest to oldest."""
        logs = await self._list_logs(user_id=user_id)
        return [
            EmotionHistoryItem(
                timestamp=log["timestamp"],
                emotion=str(log.get("dominant_emotion", "")),
                confidence=self._confidence_for_log(log),
                transcript=log.get("transcript"),
            )
            for log in logs
        ]

    async def _list_logs(self, user_id: str | None = None) -> list[dict]:
        filters = {"user_id": user_id} if user_id else None
        return await self._data_service.select_rows("emotion_logs", eq_filters=filters, order_by="timestamp", desc=True)

    @staticmethod
    def _confidence_for_log(log: dict) -> float:
        score_map = {
            "sad": log.get("sad_score", 0.0),
            "happy": log.get("happy_score", 0.0),
            "angry": log.get("angry_score", 0.0),
            "neutral": log.get("neutral_score", 0.0),
        }
        dominant_key = str(log.get("dominant_emotion", "")).strip().lower()
        return float(score_map.get(dominant_key, 0.0))
