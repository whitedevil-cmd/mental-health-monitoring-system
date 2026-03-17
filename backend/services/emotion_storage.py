"""
Service for persisting emotion detection results.

This module provides a small abstraction for writing the outputs of the
emotion detector into the `emotion_logs` table. It is intentionally
simple and framework-agnostic so it can be reused from API routes,
background jobs, or batch scripts.
"""

from __future__ import annotations

from collections.abc import Mapping

from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.schema_utils import ensure_sqlite_column
from backend.models.emotion_log import EmotionLog


async def save_emotion_result(
    session: AsyncSession,
    dominant_emotion: str,
    scores: Mapping[str, float],
    transcript: str | None = None,
) -> EmotionLog:
    """
    Persist a single emotion detection result to the database.

    Args:
        session: Active AsyncSession to use for persistence.
        dominant_emotion: The label with the highest probability.
        scores: Mapping of label -> probability score. Only the keys
            "sad", "happy", "angry", "neutral" are stored explicitly;
            missing keys are treated as 0.0.
        transcript: Optional transcript text associated with the detection.

    Returns:
        The newly created EmotionLog ORM instance (after flush/refresh).
    """
    # Ensure legacy SQLite tables are upgraded before insert.
    await ensure_sqlite_column(
        session,
        table_name="emotion_logs",
        column_name="transcript",
        column_definition="transcript TEXT",
    )

    # Normalize scores with defaults for missing labels
    sad = float(scores.get("sad", 0.0))
    happy = float(scores.get("happy", 0.0))
    angry = float(scores.get("angry", 0.0))
    neutral = float(scores.get("neutral", 0.0))

    log = EmotionLog(
        dominant_emotion=dominant_emotion,
        sad_score=sad,
        happy_score=happy,
        angry_score=angry,
        neutral_score=neutral,
        transcript=transcript,
    )

    session.add(log)
    await session.commit()
    await session.refresh(log)
    return log
