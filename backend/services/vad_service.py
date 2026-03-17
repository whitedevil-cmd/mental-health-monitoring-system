"""Voice Activity Detection (VAD) service using Silero VAD."""

from __future__ import annotations

import logging
import os
import tempfile
from functools import lru_cache

logger = logging.getLogger(__name__)

_silero_vad_module = None
_vad_model = None


def _get_silero_vad_module():
    global _silero_vad_module
    if _silero_vad_module is None:
        import silero_vad as silero_module

        _silero_vad_module = silero_module
    return _silero_vad_module


def _get_vad_model():
    global _vad_model
    if _vad_model is None:
        silero_module = _get_silero_vad_module()
        _vad_model = silero_module.load_silero_vad()
    return _vad_model


class VADService:
    """Detect whether an audio chunk contains speech."""

    def __init__(self) -> None:
        self._model = None

    def is_speech(self, audio_chunk: bytes) -> bool:
        """Return True if speech is detected in the provided audio bytes."""
        if not audio_chunk:
            return False

        tmp_path = ""
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                tmp.write(audio_chunk)
                tmp_path = tmp.name

            silero_module = _get_silero_vad_module()
            wav = silero_module.read_audio(tmp_path, sampling_rate=16000)
            # If the chunk is too short, skip VAD filtering to avoid false negatives.
            if wav.numel() < 3200:  # 0.2s at 16kHz
                return True
            timestamps = silero_module.get_speech_timestamps(
                wav,
                _get_vad_model(),
                sampling_rate=16000,
                threshold=0.3,
                min_speech_duration_ms=100,
                min_silence_duration_ms=100,
            )
            if timestamps:
                return True

            # Fallback: treat non-silent chunks as speech to avoid false skips.
            energy = float(wav.abs().mean().item())
            return energy > 0.005
        except Exception:
            logger.exception("VAD inference failed")
            raise
        finally:
            if tmp_path:
                try:
                    os.remove(tmp_path)
                except OSError:
                    logger.warning("Failed to remove VAD temp file: %s", tmp_path)


@lru_cache()
def get_vad_service() -> VADService:
    """Return a cached VAD service instance."""
    return VADService()
