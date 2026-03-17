"""Service layer for generating supportive, non-clinical mental health responses."""

from __future__ import annotations

import logging
from functools import lru_cache

from groq import Groq, GroqError

from backend.utils.config import get_settings

logger = logging.getLogger(__name__)


class SupportGeneratorService:
    """Generate supportive messages using Groq when available."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.client = None

        if self.settings.LLM_API_KEY:
            try:
                self.client = self._get_client(self.settings.LLM_API_KEY)
            except Exception as exc:  # pragma: no cover - client init errors are environment-specific
                logger.error("Failed to initialize Groq client: %s", exc)

    @staticmethod
    @lru_cache(maxsize=1)
    def _get_client(api_key: str) -> Groq:
        """Create and cache the Groq client for reuse."""
        return Groq(api_key=api_key)

    def generate_support_message(
        self,
        current_emotion: str,
        trend_summary: str,
        memory_context: str | None = None,
    ) -> str:
        """Generate a short, supportive message using Groq when available."""
        normalized_emotion = current_emotion.strip().lower() or "neutral"
        normalized_trend = trend_summary.strip().lower() or "stable"
        normalized_memory = (memory_context or "").strip()

        if not self.client:
            logger.warning("Groq client not initialized. Returning fallback message.")
            return self._get_fallback_message(normalized_emotion, normalized_trend, normalized_memory)

        system_prompt = (
            "You are a supportive, empathetic mental health assistant. "
            "Provide non-clinical guidance in 2 or 3 sentences. "
            "Reflect the user's recent pattern, avoid generic phrasing, "
            "and do not provide diagnoses or medical advice."
        )

        memory_block = f"Recent memory:\n{normalized_memory}\n" if normalized_memory else ""
        user_prompt = (
            f"Current emotion: {normalized_emotion}\n"
            f"Recent trend: {normalized_trend}\n"
            f"{memory_block}"
            "Write a short supportive message that references the current "
            "emotion and recent trend. If memory is available, acknowledge it naturally without sounding repetitive. "
            "Include one practical, gentle suggestion."
        )

        try:
            chat_completion = self.client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                model="llama-3.1-8b-instant",
                temperature=0.9,
                max_tokens=180,
            )
            response_content = chat_completion.choices[0].message.content
            if response_content:
                return response_content.strip()
        except GroqError as exc:
            logger.error("Groq API error during message generation: %s", exc)
        except Exception as exc:  # pragma: no cover - network/provider failures are environment-specific
            logger.error("Unexpected error generating support message: %s", exc)

        return self._get_fallback_message(normalized_emotion, normalized_trend, normalized_memory)

    def _get_fallback_message(
        self,
        current_emotion: str,
        trend_summary: str,
        memory_context: str,
    ) -> str:
        """Provide a contextual fallback message if the LLM is unavailable."""
        memory_prefix = "You've shared some of this weight before. " if memory_context else ""
        if "increasing sadness" in trend_summary:
            return (
                f"{memory_prefix}It looks like the heavier moments have been building lately. "
                "Try making today a little smaller by focusing on one grounding task and one person you trust."
            )
        if "mostly" in trend_summary and "happy" in trend_summary:
            return (
                f"{memory_prefix}There are encouraging signs in your recent check-ins. "
                "Notice what helped create those lighter moments so you can return to them intentionally."
            )
        if current_emotion in {"sad", "sadness", "depressed"}:
            return (
                f"{memory_prefix}I'm sorry this feels heavy right now. "
                "Go gently with yourself today and aim for one small, steadying step instead of solving everything at once."
            )
        if current_emotion in {"stress", "stressed", "anxiety", "anxious", "angry"}:
            return (
                f"{memory_prefix}Things seem tense at the moment. "
                "A short pause, slower breathing, or even a brief walk could help your body come down a notch."
            )
        if current_emotion in {"happy", "happiness", "calm", "joy", "neutral"}:
            return (
                f"{memory_prefix}There is some steadiness in your recent state. "
                "If you can, protect a little of whatever is helping so that calm has room to last."
            )

        return (
            f"{memory_prefix}Thanks for checking in. "
            "Whatever today feels like, you do not have to carry it perfectly to deserve care and support."
        )
