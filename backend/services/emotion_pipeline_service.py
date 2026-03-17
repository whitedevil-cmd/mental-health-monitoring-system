"""Streaming-friendly orchestration for multimodal emotion analysis."""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from backend.services.audio_pipeline import _process_audio_file_sync
from backend.services.emotion_detector import detect_emotion as default_detect_emotion

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
        result = _process_audio_file_sync(str(audio_path), audio_detector=self._audio_detector)
        return EmotionAnalysisResult(
            emotion=str(result["emotion"]),
            transcript=str(result["transcript"]),
            audio_scores=dict(result["audio_scores"]),
            text_scores=dict(result["text_scores"]),
            combined_scores=dict(result["combined_scores"]),
        )
