"""Streaming Gemini text service using the official Google GenAI SDK."""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import AsyncIterator

from google import genai
from google.genai import types

from backend.utils.config import get_settings
from backend.utils.errors import ServiceError

logger = logging.getLogger(__name__)


class GeminiStreamService:
    """Proxy realtime text generation through the official Gemini SDK."""

    def __init__(self) -> None:
        self._settings = get_settings()
        self._api_key = self._settings.GEMINI_API_KEY or self._settings.LLM_API_KEY
        if not self._api_key:
            raise ServiceError(
                "Gemini configuration missing.",
                details="Set GEMINI_API_KEY or LLM_API_KEY before using the realtime assistant.",
                status_code=503,
            )

    @staticmethod
    @lru_cache(maxsize=1)
    def _get_client(api_key: str) -> genai.Client:
        return genai.Client(api_key=api_key)

    @staticmethod
    def _extract_system_instruction(messages: list[dict[str, str]]) -> str | None:
        instructions = [
            message["content"].strip()
            for message in messages
            if message["role"] == "system" and message["content"].strip()
        ]
        if not instructions:
            return None
        return "\n\n".join(instructions)

    @staticmethod
    def _build_contents(messages: list[dict[str, str]]) -> list[types.Content]:
        contents: list[types.Content] = []

        for message in messages:
            if message["role"] == "system":
                continue

            role = "model" if message["role"] == "assistant" else "user"
            contents.append(
                types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=message["content"])],
                )
            )

        if not contents:
            raise ServiceError(
                "Gemini request missing conversation content.",
                details="At least one user or assistant message is required.",
                status_code=400,
            )

        return contents

    async def stream_chat(
        self,
        *,
        messages: list[dict[str, str]],
        user_id: str | None = None,
    ) -> AsyncIterator[str]:
        del user_id

        config = types.GenerateContentConfig(
            temperature=0.5,
            max_output_tokens=140,
            system_instruction=self._extract_system_instruction(messages),
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
            tool_config=types.ToolConfig(
                function_calling_config=types.FunctionCallingConfig(mode="NONE"),
            ),
        )

        client = self._get_client(self._api_key)

        try:
            stream = await client.aio.models.generate_content_stream(
                model=self._settings.GEMINI_MODEL,
                contents=self._build_contents(messages),
                config=config,
            )

            async for chunk in stream:
                text = getattr(chunk, "text", None)
                finish_reason = None
                prompt_feedback = getattr(chunk, "prompt_feedback", None)
                usage_metadata = getattr(chunk, "usage_metadata", None)
                candidates = getattr(chunk, "candidates", None) or []
                if candidates:
                    finish_reason = getattr(candidates[0], "finish_reason", None)

                if finish_reason or prompt_feedback or usage_metadata:
                    logger.info(
                        "Gemini stream chunk metadata finish_reason=%s prompt_feedback=%r usage_metadata=%r",
                        finish_reason,
                        prompt_feedback,
                        usage_metadata,
                    )

                if text:
                    yield text
        except Exception as exc:  # pragma: no cover - provider failures are environment-specific
            logger.exception("Gemini streaming request failed: %s", exc)
            raise ServiceError(
                "Gemini streaming request failed.",
                details=str(exc),
                status_code=502,
            ) from exc
