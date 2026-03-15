"""Service layer for speech emotion inference over stored audio files."""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from backend.services.audio_service import AudioService
from backend.services.emotion_detector import detect_emotion as default_detect_emotion
from backend.services.emotion_pipeline_service import EmotionPipelineService
from backend.utils.errors import (
    AudioProcessingError,
    EmotionDetectionError,
    ResourceNotFoundError,
)

logger = logging.getLogger(__name__)

EmotionDetector = Callable[[str | Path], dict[str, float]]


@dataclass(slots=True)
class EmotionDetectionResult:
    """Normalized output returned by the detection service."""

    dominant_emotion: str
    scores: dict[str, float]
    transcript: str
    audio_scores: dict[str, float]
    text_scores: dict[str, float]
    combined_scores: dict[str, float]


class EmotionDetectionService:
    """Coordinate audio-path validation and multimodal emotion inference."""

    def __init__(
        self,
        *,
        audio_service: AudioService | None = None,
        detector: EmotionDetector = default_detect_emotion,
        pipeline_service: EmotionPipelineService | None = None,
    ) -> None:
        self._audio_service = audio_service or AudioService()
        self._pipeline_service = pipeline_service or EmotionPipelineService(audio_detector=detector)

    def detect_from_audio_path(self, audio_path: str) -> EmotionDetectionResult:
        """Detect the dominant emotion from a previously stored audio file."""
        resolved = self._audio_service.resolve_uploaded_audio_path(audio_path)
        if not resolved.exists() or not resolved.is_file():
            raise ResourceNotFoundError("Audio file not found.", details="The referenced audio file does not exist.")

        try:
            result = self._pipeline_service.analyze_file(resolved)
        except FileNotFoundError as exc:
            logger.warning("Audio file missing during detection: %s", audio_path)
            raise ResourceNotFoundError("Audio file not found.", details="The referenced audio file does not exist.") from exc
        except ValueError as exc:
            logger.warning("Audio processing failed for %s: %s", audio_path, exc)
            raise AudioProcessingError(str(exc), details="Audio processing error.") from exc
        except EmotionDetectionError:
            raise
        except Exception as exc:  # pragma: no cover - safety net
            logger.exception("Emotion detection failed for %s: %s", audio_path, exc)
            raise EmotionDetectionError(details="Model inference error.") from exc

        combined_scores = dict(result.combined_scores)
        dominant_emotion = result.emotion
        if not combined_scores:
            raise EmotionDetectionError("Emotion detection returned no scores.", details="Model inference error.")

        logger.info("Emotion detection completed for %s with dominant=%s", audio_path, dominant_emotion)
        return EmotionDetectionResult(
            dominant_emotion=dominant_emotion,
            scores=combined_scores,
            transcript=result.transcript,
            audio_scores=dict(result.audio_scores),
            text_scores=dict(result.text_scores),
            combined_scores=combined_scores,
        )
