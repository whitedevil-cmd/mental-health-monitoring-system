"""
Service for persisting emotion detection results.

This module provides a small abstraction for writing the outputs of the
emotion detector into the `emotion_logs` table. It is intentionally
simple and framework-agnostic so it can be reused from API routes,
background jobs, or batch scripts.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from backend.storage.data_backend import StorageBackend
from backend.utils.config import get_settings
from backend.utils.errors import DatabaseOperationError


async def save_emotion_result(
    session: object | None = None,  # noqa: ARG001
    user_id: str | None = None,
    dominant_emotion: str = "",
    scores: Mapping[str, float] | None = None,
    transcript: str | None = None,
) -> dict[str, Any]:
    """
    Persist a single emotion detection result to the database.

    Args:
        dominant_emotion: The label with the highest probability.
        scores: Mapping of label -> probability score. Only the keys
            "sad", "happy", "angry", "neutral" are stored explicitly;
            missing keys are treated as 0.0.
        transcript: Optional transcript text associated with the detection.

    Returns:
        The newly created Supabase row payload.
    """
    # Normalize scores with defaults for missing labels
    normalized_scores = scores or {}
    sad = float(normalized_scores.get("sad", 0.0))
    happy = float(normalized_scores.get("happy", 0.0))
    angry = float(normalized_scores.get("angry", 0.0))
    neutral = float(normalized_scores.get("neutral", 0.0))
    resolved_user_id = user_id or get_settings().SUPABASE_DEBUG_USER_ID
    if not resolved_user_id:
        if get_settings().ENVIRONMENT == "production":
            raise DatabaseOperationError(
                "Missing user_id for emotion log persistence.",
                details="Provide a user_id or configure SUPABASE_DEBUG_USER_ID.",
                status_code=400,
            )
        resolved_user_id = "local-debug-user"

    return await StorageBackend().insert_row(
        "emotion_logs",
        {
            "user_id": resolved_user_id,
            "dominant_emotion": dominant_emotion,
            "sad_score": sad,
            "happy_score": happy,
            "angry_score": angry,
            "neutral_score": neutral,
            "transcript": transcript,
        },
    )
