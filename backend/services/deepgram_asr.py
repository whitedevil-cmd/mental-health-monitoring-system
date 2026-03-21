"""Deepgram prerecorded speech-to-text for REST audio uploads."""

from __future__ import annotations

from functools import lru_cache
import logging

from dotenv import load_dotenv

from backend.utils.config import get_settings
from backend.utils.errors import AudioProcessingError

load_dotenv()

logger = logging.getLogger(__name__)


def _extract_transcript(response: object) -> str:
    """Return the top Deepgram transcript from an SDK response object."""
    results = getattr(response, "results", None)
    if results is None and isinstance(response, dict):
        results = response.get("results")

    channels = getattr(results, "channels", None)
    if channels is None and isinstance(results, dict):
        channels = results.get("channels")
    if not channels:
        return ""

    channel = channels[0]
    alternatives = getattr(channel, "alternatives", None)
    if alternatives is None and isinstance(channel, dict):
        alternatives = channel.get("alternatives")
    if not alternatives:
        return ""

    alternative = alternatives[0]
    transcript = getattr(alternative, "transcript", None)
    if transcript is None and isinstance(alternative, dict):
        transcript = alternative.get("transcript")
    return str(transcript or "").strip()


@lru_cache(maxsize=1)
def get_deepgram_client():
    """Return a lazily initialized global async Deepgram client."""
    settings = get_settings()
    if not settings.DEEPGRAM_API_KEY:
        raise AudioProcessingError(
            "ASR configuration missing.",
            details="DEEPGRAM_API_KEY is not set.",
        )

    try:
        from deepgram import AsyncDeepgramClient
    except ImportError as exc:  # pragma: no cover - dependency resolution dependent
        raise AudioProcessingError(
            "ASR dependency missing.",
            details="Install deepgram-sdk to enable transcription.",
            status_code=500,
        ) from exc

    return AsyncDeepgramClient(api_key=settings.DEEPGRAM_API_KEY)


async def transcribe_audio_deepgram(audio_bytes: bytes) -> str:
    """Transcribe prerecorded WAV audio bytes using Deepgram's async SDK."""
    if not audio_bytes:
        raise AudioProcessingError(
            "Audio processing failed.",
            details="Empty audio input.",
        )

    client = get_deepgram_client()
    logger.info("Deepgram transcription start")

    try:
        response = await client.listen.v1.media.transcribe_file(
            request=audio_bytes,
            model="nova-3",
            smart_format=True,
            request_options={
                "timeout_in_seconds": 30,
                "max_retries": 2,
            },
        )
    except Exception as exc:  # pragma: no cover - provider/runtime dependent
        logger.exception("Deepgram transcription request failed: %s", exc)
        raise AudioProcessingError(
            "Transcription failed.",
            details="Deepgram transcription request failed.",
        ) from exc

    transcript = _extract_transcript(response)
    if not transcript:
        raise AudioProcessingError(
            "Transcription failed.",
            details="Deepgram returned an empty transcript.",
        )

    logger.info("Deepgram transcription completed")
    return transcript
