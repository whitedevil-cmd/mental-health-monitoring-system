"""Streaming Gemini text service for realtime assistant responses."""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from typing import AsyncIterator

import httpx

from backend.utils.config import get_settings
from backend.utils.errors import ServiceError

logger = logging.getLogger(__name__)


class GeminiStreamService:
    """Proxy realtime text generation through Gemini's streaming API."""

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
    def _get_client() -> httpx.AsyncClient:
        return httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0))

    @staticmethod
    def _extract_system_instruction(messages: list[dict[str, str]]) -> str | None:
        instructions = [message['content'].strip() for message in messages if message['role'] == 'system' and message['content'].strip()]
        if not instructions:
            return None
        return "\n\n".join(instructions)

    @staticmethod
    def _build_contents(messages: list[dict[str, str]]) -> list[dict[str, object]]:
        conversation: list[dict[str, object]] = []

        for message in messages:
            if message['role'] == 'system':
                continue

            role = 'model' if message['role'] == 'assistant' else 'user'
            conversation.append(
                {
                    'role': role,
                    'parts': [{'text': message['content']}],
                }
            )

        if not conversation:
            raise ServiceError(
                'Gemini request missing conversation content.',
                details='At least one user or assistant message is required.',
                status_code=400,
            )

        return conversation

    @staticmethod
    def _extract_text_from_chunk(payload: dict[str, object]) -> str:
        texts: list[str] = []
        candidates = payload.get('candidates') or []
        for candidate in candidates:
            if not isinstance(candidate, dict):
                continue
            content = candidate.get('content')
            if not isinstance(content, dict):
                continue
            parts = content.get('parts') or []
            for part in parts:
                if isinstance(part, dict):
                    text = part.get('text')
                    if isinstance(text, str) and text:
                        texts.append(text)
        return ''.join(texts)

    async def stream_chat(
        self,
        *,
        messages: list[dict[str, str]],
        user_id: str | None = None,
    ) -> AsyncIterator[str]:
        del user_id  # Gemini REST does not support a user field on this endpoint.

        payload: dict[str, object] = {
            'contents': self._build_contents(messages),
            'generationConfig': {
                'temperature': 0.7,
                'maxOutputTokens': 220,
            },
        }

        system_instruction = self._extract_system_instruction(messages)
        if system_instruction:
            payload['systemInstruction'] = {
                'parts': [{'text': system_instruction}],
            }

        url = (
            f"{self._settings.GEMINI_API_BASE_URL}/models/"
            f"{self._settings.GEMINI_MODEL}:streamGenerateContent?alt=sse"
        )

        client = self._get_client()

        try:
            async with client.stream(
                'POST',
                url,
                headers={
                    'x-goog-api-key': self._api_key,
                    'Content-Type': 'application/json',
                },
                json=payload,
            ) as response:
                if response.status_code >= 400:
                    error_body = await response.aread()
                    details = error_body.decode('utf-8', errors='ignore')
                    logger.error('Gemini streaming request failed: %s', details)
                    raise ServiceError(
                        'Gemini streaming request failed.',
                        details=details,
                        status_code=502,
                    )

                async for line in response.aiter_lines():
                    if not line or not line.startswith('data: '):
                        continue

                    raw_json = line[6:].strip()
                    if not raw_json:
                        continue

                    try:
                        chunk_payload = json.loads(raw_json)
                    except json.JSONDecodeError:
                        logger.warning('Skipping malformed Gemini stream chunk: %s', raw_json)
                        continue

                    text = self._extract_text_from_chunk(chunk_payload)
                    if text:
                        yield text
        except httpx.HTTPError as exc:
            logger.exception('Gemini streaming request failed: %s', exc)
            raise ServiceError(
                'Gemini streaming request failed.',
                details=str(exc),
                status_code=502,
            ) from exc
