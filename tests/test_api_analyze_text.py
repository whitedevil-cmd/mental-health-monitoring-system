"""Tests for the text-only emotion analysis endpoint."""

from __future__ import annotations

from backend.services.text_emotion_service import TextEmotionAnalysisResult


def test_analyze_text_success(client, monkeypatch) -> None:
    async def fake_analyze_text(self, text: str):  # noqa: ANN001
        assert text == "I feel calm today."
        return TextEmotionAnalysisResult(
            emotion="calm",
            confidence=0.91,
            scores={"calm": 0.91, "sad": 0.05, "angry": 0.04},
        )

    monkeypatch.setattr(
        "backend.services.text_emotion_service.TextEmotionService.analyze_text",
        fake_analyze_text,
        raising=True,
    )

    response = client.post("/analyze-text", json={"text": "I feel calm today."})

    assert response.status_code == 200
    assert response.json() == {
        "emotion": "calm",
        "confidence": 0.91,
    }


def test_analyze_text_rejects_empty_text(client) -> None:
    response = client.post("/analyze-text", json={"text": ""})

    assert response.status_code == 422
