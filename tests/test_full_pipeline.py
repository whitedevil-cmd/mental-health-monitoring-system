"""
Full pipeline integration test.

This test simulates the complete system flow:
  upload audio -> detect emotion -> store emotion -> query trend

All ML model calls are mocked so tests remain fast and deterministic.
"""

import io

from fastapi.testclient import TestClient  # pyre-ignore[21]

from backend.services.emotion_detection_service import EmotionDetectionResult


def test_health_endpoint(client: TestClient):
    """The /health endpoint should return 200 with status ok."""
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_upload_audio_via_top_level_alias(client: TestClient):
    """POST /upload-audio (top-level alias) should accept a WAV file."""
    wav_bytes = b"RIFF\x00\x00\x00\x00WAVE"
    files = {
        "file": ("recording.wav", io.BytesIO(wav_bytes), "audio/wav"),
    }
    resp = client.post("/upload-audio", files=files)
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "success"
    assert data["file_path"].startswith("audio_storage/recording_")
    assert data["file_path"].endswith(".wav")


def test_upload_audio_alias_rejects_invalid_file(client: TestClient):
    """Top-level upload alias should reject invalid formats with a stable error."""
    files = {
        "file": ("bad.mp3", io.BytesIO(b"fake-mp3"), "audio/mpeg"),
    }
    resp = client.post("/upload-audio", files=files)
    assert resp.status_code == 400
    assert resp.json()["error"] == "Only WAV audio files are supported."


def test_full_pipeline(client: TestClient, monkeypatch):
    """
    End-to-end: upload -> detect (mocked) -> store -> query trend.

    This test verifies the entire system flow produces a valid
    TrendAnalysisResponse at the end.
    """
    from pathlib import Path

    wav_bytes = b"RIFF\x00\x00\x00\x00WAVE"
    files = {"file": ("pipeline_test.wav", io.BytesIO(wav_bytes), "audio/wav")}
    upload_resp = client.post("/upload-audio", files=files)
    assert upload_resp.status_code == 201
    file_path = upload_resp.json()["file_path"]

    async def fake_detect_from_audio_path_async(self, path):  # noqa: ANN001
        return EmotionDetectionResult(
            dominant_emotion="sad",
            scores={"sad": 0.65, "happy": 0.10, "angry": 0.12, "neutral": 0.13},
            transcript="",
            audio_scores={"sad": 0.65, "happy": 0.10, "angry": 0.12, "neutral": 0.13},
            text_scores={},
            combined_scores={"sad": 0.65, "happy": 0.10, "angry": 0.12, "neutral": 0.13},
        )

    storage_dir = Path("backend") / "audio_storage"
    storage_dir.mkdir(parents=True, exist_ok=True)
    fake_audio = Path("backend") / file_path
    if not fake_audio.exists():
        fake_audio.write_bytes(b"RIFFxxxxWAVE")

    monkeypatch.setattr(
        "backend.services.emotion_detection_service.EmotionDetectionService.detect_from_audio_path_async",
        fake_detect_from_audio_path_async,
        raising=True,
    )

    detect_resp = client.post("/detect-emotion", json={"audio_path": file_path})
    assert detect_resp.status_code == 200
    detect_data = detect_resp.json()
    assert detect_data["dominant_emotion"] == "sad"
    assert detect_data["scores"]["sad"] == 0.65

    store_resp = client.post("/api/v1/emotions/analyze", json={
        "user_id": "pipeline-user",
        "audio_id": file_path,
        "emotion_label": detect_data["dominant_emotion"],
        "confidence": detect_data["scores"][detect_data["dominant_emotion"]],
    })
    assert store_resp.status_code == 201
    stored = store_resp.json()
    assert stored["emotion_label"] == "sad"
    assert stored["user_id"] == "pipeline-user"

    trend_resp = client.get("/api/v1/insights/emotion-trend?user_id=pipeline-user")
    assert trend_resp.status_code == 200
    trend_data = trend_resp.json()

    assert "stress_level" in trend_data
    assert "pattern" in trend_data
    assert "recommendation" in trend_data
    assert trend_data["stress_level"] in ("low", "moderate", "high", "unknown")
    assert isinstance(trend_data["recommendation"], str)
    assert len(trend_data["recommendation"]) > 0


def test_cors_headers_present(client: TestClient):
    """Verify CORS headers are present for allowed origins."""
    resp = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:8080",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert resp.status_code == 200
    assert "access-control-allow-origin" in resp.headers
