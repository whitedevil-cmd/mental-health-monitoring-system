"""Service layer for generating supportive responses via an LLM."""

from __future__ import annotations

import logging

from backend.models.schemas.insight import InsightResponse
from backend.services.memory_service import MemoryService
from backend.services.support_generator import SupportGeneratorService
from backend.utils.errors import InsightGenerationError

logger = logging.getLogger(__name__)


class ResponseService:
    """High-level supportive response generation."""

    def __init__(
        self,
        support_generator: SupportGeneratorService | None = None,
        memory_service: MemoryService | None = None,
    ) -> None:
        self._support_generator = support_generator or SupportGeneratorService()
        self._memory_service = memory_service or MemoryService()

    async def generate_supportive_message(self, insight: InsightResponse) -> str:
        """Generate a supportive message from the latest insight payload."""
        if insight.trend:
            latest = insight.trend[-1]
            current_emotion = latest.dominant_emotion
            unique_emotions = {point.dominant_emotion for point in insight.trend}
            if len(unique_emotions) == 1:
                trend_summary = f"mostly {current_emotion}"
            else:
                trend_summary = f"mixed pattern with recent {current_emotion}"
        else:
            current_emotion = "neutral"
            trend_summary = "insufficient data"

        try:
            memory_context = await self._memory_service.get_user_context(insight.user_id)
            message = self._support_generator.generate_support_message(
                current_emotion=current_emotion,
                trend_summary=trend_summary,
                memory_context=memory_context,
            )
            await self._memory_service.add_conversation(
                user_id=insight.user_id,
                detected_emotion=current_emotion,
                ai_response=message,
            )
        except Exception as exc:  # pragma: no cover - support service has its own fallback
            logger.exception("Failed to generate supportive message: %s", exc)
            raise InsightGenerationError(
                "Failed to generate supportive message.",
                details="Insight generation error.",
            ) from exc

        logger.info("Supportive insight generated for emotion %s", current_emotion)
        return message
