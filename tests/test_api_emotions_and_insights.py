"""
API tests for emotion and insights endpoints.

These tests validate that:
- Emotion readings can be created via the API.
- Insights can be retrieved for a user.
- The LLM-like response service can be mocked.
"""

from fastapi.testclient import TestClient


def test_emotion_analyze_and_insights_flow(client: TestClient, monkeypatch):
    """End-to-end flow: create an emotion reading, then fetch insights."""

    # 1) Create an emotion reading for a user
    payload = {
        "user_id": "user-123",
        "audio_id": "audio-1",
        "emotion_label": "calm",
        "confidence": 0.8,
    }
    resp_create = client.post("/api/v1/emotions/analyze", json=payload)
    assert resp_create.status_code == 201
    created = resp_create.json()
    assert created["user_id"] == "user-123"
    assert created["emotion_label"] == "calm"

    # 2) Mock the LLM-like response in ResponseService
    from backend.services import response_service as response_module

    async def fake_generate_supportive_message(self, insight):  # noqa: ARG001, ANN001
        return "Test supportive message."

    monkeypatch.setattr(
        response_module.ResponseService,
        "generate_supportive_message",
        fake_generate_supportive_message,
        raising=True,
    )

    # 3) Fetch insights for that user
    resp_insights = client.get("/api/v1/insights/user-123")
    assert resp_insights.status_code == 200
    data = resp_insights.json()

    assert data["user_id"] == "user-123"
    # At least one trend point should exist for the created reading
    assert len(data["trend"]) >= 1
    assert data["supportive_message"] == "Test supportive message."

