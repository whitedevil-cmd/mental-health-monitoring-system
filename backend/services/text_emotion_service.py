"""High-level text-only emotion analysis service."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

from backend.services.text_emotion_detector import get_text_emotion_detector
from backend.utils.errors import EmotionDetectionError

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class TextEmotionAnalysisResult:
    """Normalized text emotion output for API routes."""

    emotion: str
    confidence: float
    scores: dict[str, float]


class TextEmotionService:
    """Analyze free-form text without any audio or storage dependency."""

    async def analyze_text(self, text: str) -> TextEmotionAnalysisResult:
        """Run text emotion detection off the event loop and normalize the result."""
        normalized = text.strip()
        if not normalized:
            raise EmotionDetectionError(
                "Text input is required.",
                details="Provide non-empty text for emotion analysis.",
                status_code=400,
            )

        try:
            scores = await asyncio.to_thread(get_text_emotion_detector().detect, normalized)
        except ValueError as exc:
            raise EmotionDetectionError(
                "Text input is required.",
                details="Provide non-empty text for emotion analysis.",
                status_code=400,
            ) from exc
        except Exception as exc:  # pragma: no cover - model/runtime dependent
            logger.exception("Text emotion analysis failed: %s", exc)
            raise EmotionDetectionError(details="Text emotion model inference failed.") from exc

        if not scores:
            raise EmotionDetectionError(
                "Emotion detection failed.",
                details="Text emotion model returned no scores.",
            )

        dominant_emotion, confidence = max(scores.items(), key=lambda item: item[1])
        return TextEmotionAnalysisResult(
            emotion=dominant_emotion,
            confidence=float(confidence),
            scores=dict(scores),
        )
