"""Streaming Groq chat service for realtime assistant responses."""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any, AsyncIterator

from groq import AsyncGroq, GroqError

from backend.utils.config import get_settings
from backend.utils.errors import ServiceError

logger = logging.getLogger(__name__)


class GroqStreamService:
    """Proxy realtime text generation through Groq's streaming chat API."""

    def __init__(self) -> None:
        self._settings = get_settings()
        if not self._settings.LLM_API_KEY:
            raise ServiceError(
                "Groq configuration missing.",
                details="Set LLM_API_KEY before using the realtime assistant.",
                status_code=503,
            )

    @staticmethod
    @lru_cache(maxsize=1)
    def _get_client(api_key: str) -> AsyncGroq:
        return AsyncGroq(api_key=api_key)

    async def stream_chat(
        self,
        *,
        messages: list[dict[str, str]],
        user_id: str | None = None,
    ) -> AsyncIterator[str]:
        client = self._get_client(self._settings.LLM_API_KEY)

        try:
            stream = await client.chat.completions.create(
                model=self._settings.GROQ_STREAM_MODEL,
                messages=messages,
                stream=True,
                temperature=0.7,
                max_completion_tokens=220,
                user=user_id,
            )
        except GroqError as exc:
            logger.exception("Groq streaming request failed: %s", exc)
            raise ServiceError(
                "Groq streaming request failed.",
                details=str(exc),
                status_code=502,
            ) from exc

        try:
            async for chunk in stream:
                delta = chunk.choices[0].delta.content if chunk.choices else None
                if delta:
                    yield delta
        except GroqError as exc:
            logger.exception("Groq streaming interrupted: %s", exc)
            raise ServiceError(
                "Groq stream interrupted.",
                details=str(exc),
                status_code=502,
            ) from exc
