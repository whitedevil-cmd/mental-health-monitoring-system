"""
Unit tests for the emotion_storage service.

These tests validate that emotion detection results are correctly
persisted into the `emotion_logs` table using the existing async
SQLAlchemy setup.
"""

import pytest

from backend.database.session import AsyncSessionLocal
from backend.services.emotion_storage import save_emotion_result


@pytest.mark.asyncio
async def test_save_emotion_result_persists_log():
    async with AsyncSessionLocal() as session:
        scores = {"sad": 0.64, "happy": 0.09, "angry": 0.11, "neutral": 0.16}

        log = await save_emotion_result(
            session=session,
            dominant_emotion="sad",
            scores=scores,
        )

        assert log.id is not None
        assert log.dominant_emotion == "sad"
        assert log.sad_score == pytest.approx(0.64)
        assert log.happy_score == pytest.approx(0.09)
        assert log.angry_score == pytest.approx(0.11)
        assert log.neutral_score == pytest.approx(0.16)

