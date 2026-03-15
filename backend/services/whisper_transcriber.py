"""Whisper transcription service using faster-whisper."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from faster_whisper import WhisperModel


class WhisperTranscriber:
    """Transcribe speech audio to text using a cached Whisper model."""

    def __init__(self, model_name: str = "base") -> None:
        self._model_name = model_name

    def transcribe(self, audio_path: str) -> str:
        """Run whisper transcription for the given audio path and return full text."""
        path = Path(audio_path)
        if not path.exists() or not path.is_file():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        model = get_model(self._model_name)
        segments, _info = model.transcribe(str(path))

        parts = [segment.text.strip() for segment in segments if segment.text.strip()]
        return " ".join(parts)


@lru_cache()
def get_model(model_name: str = "base") -> WhisperModel:
    """Load and cache a Whisper model for CPU int8 inference."""
    return WhisperModel(model_name, device="cpu", compute_type="int8")


def _load_model(model_name: str = "base") -> WhisperModel:
    """Backward-compatible alias for cached model loader."""
    return get_model(model_name)


@lru_cache(maxsize=1)
def get_transcriber() -> WhisperTranscriber:
    """Return a cached transcriber instance."""
    return WhisperTranscriber(model_name="base")
