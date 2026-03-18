"""Unit tests for the emotion_storage service."""

import pytest

from backend.services.emotion_storage import save_emotion_result


@pytest.mark.asyncio
async def test_save_emotion_result_persists_log():
    scores = {"sad": 0.64, "happy": 0.09, "angry": 0.11, "neutral": 0.16}

    log = await save_emotion_result(
        user_id="local-debug-user",
        dominant_emotion="sad",
        scores=scores,
    )

    assert log["id"] is not None
    assert log["dominant_emotion"] == "sad"
    assert log["sad_score"] == pytest.approx(0.64)
    assert log["happy_score"] == pytest.approx(0.09)
    assert log["angry_score"] == pytest.approx(0.11)
    assert log["neutral_score"] == pytest.approx(0.16)

