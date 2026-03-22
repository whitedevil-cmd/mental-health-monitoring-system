"""ElevenLabs text-to-speech helpers for realtime assistant playback."""

from __future__ import annotations

import logging
from functools import lru_cache

from elevenlabs.client import AsyncElevenLabs

from backend.utils.config import get_settings
from backend.utils.errors import ServiceError

logger = logging.getLogger(__name__)


class ElevenLabsTtsService:
    """Generate low-latency speech chunks through ElevenLabs."""

    def __init__(self) -> None:
        self._settings = get_settings()
        if not self._settings.ELEVENLABS_API_KEY:
            raise ServiceError(
                "ElevenLabs configuration missing.",
                details="Set ELEVENLABS_API_KEY before using realtime TTS.",
                status_code=503,
            )

    @staticmethod
    @lru_cache(maxsize=1)
    def _get_client(api_key: str) -> AsyncElevenLabs:
        return AsyncElevenLabs(api_key=api_key)

    async def synthesize(
        self,
        *,
        text: str,
        voice_id: str | None = None,
        previous_text: str | None = None,
        next_text: str | None = None,
    ) -> bytes:
        normalized_text = text.strip()
        if not normalized_text:
            raise ServiceError(
                "Invalid TTS input.",
                details="TTS text must not be empty.",
                status_code=400,
            )

        client = self._get_client(self._settings.ELEVENLABS_API_KEY)
        audio = bytearray()

        try:
            stream = client.text_to_speech.convert(
                voice_id=voice_id or self._settings.ELEVENLABS_TTS_VOICE_ID,
                text=normalized_text,
                model_id=self._settings.ELEVENLABS_TTS_MODEL_ID,
                output_format=self._settings.ELEVENLABS_TTS_OUTPUT_FORMAT,
                optimize_streaming_latency=3,
                previous_text=previous_text,
                next_text=next_text,
                apply_text_normalization="off",
            )
            async for chunk in stream:
                audio.extend(chunk)
        except Exception as exc:
            logger.exception("ElevenLabs synthesis failed: %s", exc)
            raise ServiceError(
                "ElevenLabs synthesis failed.",
                details=str(exc),
                status_code=502,
            ) from exc

        if not audio:
            raise ServiceError(
                "ElevenLabs synthesis failed.",
                details="ElevenLabs returned empty audio.",
                status_code=502,
            )

        return bytes(audio)
