"""Compatibility tests for top-level Lovable frontend endpoints."""

from __future__ import annotations

import io
from types import SimpleNamespace

from fastapi.testclient import TestClient


def test_health_endpoint(client: TestClient):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_insights_endpoint_returns_dashboard_summary(client: TestClient, monkeypatch):
    async def fake_get_insights(self, session):  # noqa: ANN001, ARG001
        return {
            "sessions": 10,
            "top_emotion": "sad",
            "emotion_distribution": {"sad": 5, "neutral": 3, "happy": 2},
        }

    monkeypatch.setattr(
        "backend.services.dashboard_service.DashboardService.get_insights",
        fake_get_insights,
    )

    response = client.get("/insights")

    assert response.status_code == 200
    assert response.json() == {
        "sessions": 10,
        "top_emotion": "sad",
        "emotion_distribution": {"sad": 5, "neutral": 3, "happy": 2},
    }


def test_history_endpoint_returns_session_history(client: TestClient, monkeypatch):
    async def fake_get_history(self, session):  # noqa: ANN001, ARG001
        return [
            {
                "timestamp": "2026-03-17T10:00:00",
                "emotion": "sad",
                "confidence": 0.83,
                "transcript": "I feel overwhelmed.",
            }
        ]

    monkeypatch.setattr(
        "backend.services.dashboard_service.DashboardService.get_history",
        fake_get_history,
    )

    response = client.get("/history")

    assert response.status_code == 200
    assert response.json() == [
        {
            "timestamp": "2026-03-17T10:00:00",
            "emotion": "sad",
            "confidence": 0.83,
            "transcript": "I feel overwhelmed.",
        }
    ]


def test_analyze_audio_stores_result_and_returns_payload(client: TestClient, monkeypatch):
    saved = {}

    async def fake_handle_wav_upload(self, file):  # noqa: ANN001, ARG001
        return {"status": "success", "file_path": "audio_storage/test.wav"}

    def fake_detect_from_audio_path(self, audio_path):  # noqa: ANN001, ARG001
        return SimpleNamespace(
            dominant_emotion="neutral",
            scores={"neutral": 0.83, "sad": 0.1, "happy": 0.04, "angry": 0.03},
            transcript="Test transcript",
        )

    def fake_generate_support_message(self, current_emotion, trend_summary, memory_context):  # noqa: ANN001, ARG001
        return f"support for {current_emotion}"

    async def fake_save_emotion_result(session, dominant_emotion, scores, transcript):  # noqa: ANN001
        saved.update(
            dominant_emotion=dominant_emotion,
            scores=scores,
            transcript=transcript,
            session_bound=session is not None,
        )

    monkeypatch.setattr(
        "backend.services.audio_service.AudioService.handle_wav_upload",
        fake_handle_wav_upload,
    )
    monkeypatch.setattr(
        "backend.services.emotion_detection_service.EmotionDetectionService.detect_from_audio_path",
        fake_detect_from_audio_path,
    )
    monkeypatch.setattr(
        "backend.services.support_generator.SupportGeneratorService.generate_support_message",
        fake_generate_support_message,
    )
    monkeypatch.setattr(
        "backend.api.emotion_routes.save_emotion_result",
        fake_save_emotion_result,
    )

    files = {"file": ("sample.wav", io.BytesIO(b"RIFF\x00\x00\x00\x00WAVE"), "audio/wav")}

    response = client.post("/analyze-audio", files=files)

    assert response.status_code == 200
    assert response.json() == {
        "transcript": "Test transcript",
        "emotion": "neutral",
        "confidence": 0.83,
        "probabilities": {"neutral": 0.83, "sad": 0.1, "happy": 0.04, "angry": 0.03},
        "response": "support for neutral",
    }
    assert saved == {
        "dominant_emotion": "neutral",
        "scores": {"neutral": 0.83, "sad": 0.1, "happy": 0.04, "angry": 0.03},
        "transcript": "Test transcript",
        "session_bound": False,
    }
