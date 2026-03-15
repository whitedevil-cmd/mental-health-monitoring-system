"""Streaming-friendly orchestration for multimodal emotion analysis."""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from backend.services.emotion_detector import detect_emotion as default_detect_emotion
from backend.services.emotion_fusion import fuse_emotions
from backend.services.text_emotion_detector import get_text_emotion_detector
from backend.services.whisper_transcriber import get_transcriber
from backend.utils.errors import EmotionDetectionError

logger = logging.getLogger(__name__)

AudioDetector = Callable[[str | Path], dict[str, float]]


@dataclass(slots=True)
class EmotionAnalysisResult:
    """Normalized multimodal analysis result."""

    emotion: str
    transcript: str
    audio_scores: dict[str, float]
    text_scores: dict[str, float]
    combined_scores: dict[str, float]


class EmotionPipelineService:
    """Run the audio -> transcript -> text -> fusion pipeline."""

    def __init__(self, audio_detector: AudioDetector = default_detect_emotion) -> None:
        self._audio_detector = audio_detector

    def analyze_file(self, audio_path: str | Path) -> EmotionAnalysisResult:
        """Analyze a stored audio file with the existing multimodal stack."""
        audio_scores = self._audio_detector(audio_path)
        if not audio_scores:
            raise EmotionDetectionError("Emotion detection returned no scores.", details="Model inference error.")

        transcript = ""
        try:
            transcript = get_transcriber().transcribe(str(audio_path))
        except Exception as exc:  # pragma: no cover - environment/audio quality dependent
            logger.warning("Transcription failed for %s: %s", audio_path, exc)

        text_scores: dict[str, float] = {}
        if transcript.strip():
            try:
                text_scores = get_text_emotion_detector().detect(transcript)
            except Exception as exc:  # pragma: no cover - model/runtime dependent
                logger.warning("Text emotion detection failed for %s: %s", audio_path, exc)

        final_emotion, combined_scores = fuse_emotions(audio_scores, text_scores)
        logger.info("Multimodal emotion analysis completed for %s with final emotion %s", audio_path, final_emotion)
        return EmotionAnalysisResult(
            emotion=final_emotion,
            transcript=transcript,
            audio_scores=audio_scores,
            text_scores=text_scores,
            combined_scores=combined_scores,
        )
