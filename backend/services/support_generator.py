"""Service layer for generating supportive, non-clinical mental health responses."""

from __future__ import annotations

import logging
from functools import lru_cache

import httpx

from backend.utils.config import get_settings

logger = logging.getLogger(__name__)


class SupportGeneratorService:
    """Generate supportive messages using Gemini when available."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.api_key = self.settings.GEMINI_API_KEY or self.settings.LLM_API_KEY

    @staticmethod
    @lru_cache(maxsize=1)
    def _get_client() -> httpx.Client:
        return httpx.Client(timeout=httpx.Timeout(30.0, connect=10.0))

    def generate_support_message(
        self,
        current_emotion: str,
        trend_summary: str,
        memory_context: str | None = None,
    ) -> str:
        """Generate a short, supportive message using Gemini when available."""
        normalized_emotion = current_emotion.strip().lower() or 'neutral'
        normalized_trend = trend_summary.strip().lower() or 'stable'
        normalized_memory = (memory_context or '').strip()

        if not self.api_key:
            logger.warning('Gemini client not configured. Returning fallback message.')
            return self._get_fallback_message(normalized_emotion, normalized_trend, normalized_memory)

        system_prompt = (
            'You are a supportive, empathetic mental health assistant. '
            'Provide non-clinical guidance in 2 or 3 sentences. '
            "Reflect the user's recent pattern, avoid generic phrasing, "
            'and do not provide diagnoses or medical advice.'
        )

        memory_block = f"Recent memory:\n{normalized_memory}\n" if normalized_memory else ''
        user_prompt = (
            f'Current emotion: {normalized_emotion}\n'
            f'Recent trend: {normalized_trend}\n'
            f'{memory_block}'
            'Write a short supportive message that references the current '
            'emotion and recent trend. If memory is available, acknowledge it naturally without sounding repetitive. '
            'Include one practical, gentle suggestion.'
        )

        payload = {
            'systemInstruction': {
                'parts': [{'text': system_prompt}],
            },
            'contents': [
                {
                    'role': 'user',
                    'parts': [{'text': user_prompt}],
                }
            ],
            'generationConfig': {
                'temperature': 0.9,
                'maxOutputTokens': 180,
            },
        }

        url = (
            f"{self.settings.GEMINI_API_BASE_URL}/models/"
            f"{self.settings.GEMINI_MODEL}:generateContent"
        )

        try:
            response = self._get_client().post(
                url,
                headers={
                    'x-goog-api-key': self.api_key,
                    'Content-Type': 'application/json',
                },
                json=payload,
            )
            response.raise_for_status()
            body = response.json()
            candidates = body.get('candidates') or []
            if candidates:
                content = candidates[0].get('content') if isinstance(candidates[0], dict) else None
                parts = content.get('parts') if isinstance(content, dict) else []
                text = ''.join(
                    part.get('text', '') for part in parts if isinstance(part, dict)
                ).strip()
                if text:
                    return text
        except httpx.HTTPError as exc:
            logger.error('Gemini API error during message generation: %s', exc)
        except Exception as exc:  # pragma: no cover - network/provider failures are environment-specific
            logger.error('Unexpected error generating support message: %s', exc)

        return self._get_fallback_message(normalized_emotion, normalized_trend, normalized_memory)

    def _get_fallback_message(
        self,
        current_emotion: str,
        trend_summary: str,
        memory_context: str,
    ) -> str:
        """Provide a contextual fallback message if the LLM is unavailable."""
        memory_prefix = "You've shared some of this weight before. " if memory_context else ''
        if 'increasing sadness' in trend_summary:
            return (
                f"{memory_prefix}It looks like the heavier moments have been building lately. "
                'Try making today a little smaller by focusing on one grounding task and one person you trust.'
            )
        if 'mostly' in trend_summary and 'happy' in trend_summary:
            return (
                f"{memory_prefix}There are encouraging signs in your recent check-ins. "
                'Notice what helped create those lighter moments so you can return to them intentionally.'
            )
        if current_emotion in {'sad', 'sadness', 'depressed'}:
            return (
                f"{memory_prefix}I'm sorry this feels heavy right now. "
                'Go gently with yourself today and aim for one small, steadying step instead of solving everything at once.'
            )
        if current_emotion in {'stress', 'stressed', 'anxiety', 'anxious', 'angry'}:
            return (
                f"{memory_prefix}Things seem tense at the moment. "
                'A short pause, slower breathing, or even a brief walk could help your body come down a notch.'
            )
        if current_emotion in {'happy', 'happiness', 'calm', 'joy', 'neutral'}:
            return (
                f"{memory_prefix}There is some steadiness in your recent state. "
                'If you can, protect a little of whatever is helping so that calm has room to last.'
            )

        return (
            f"{memory_prefix}Thanks for checking in. "
            'Whatever today feels like, you do not have to carry it perfectly to deserve care and support.'
        )
