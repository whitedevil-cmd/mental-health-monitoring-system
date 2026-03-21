"""
API tests for the /detect-emotion endpoint.
"""

from pathlib import Path

from fastapi.testclient import TestClient

from backend.services.emotion_detection_service import EmotionDetectionResult


def test_detect_emotion_success(client: TestClient, monkeypatch, tmp_path: Path):
    # Create a fake stored audio file location under backend/audio_storage/
    storage_dir = Path("backend") / "audio_storage"
    storage_dir.mkdir(parents=True, exist_ok=True)
    fake_audio = storage_dir / "recording_123.wav"
    fake_audio.write_bytes(b"RIFFxxxxWAVE")

    async def fake_detect_from_audio_path_async(self, path):  # noqa: ANN001
        assert str(path) == "audio_storage/recording_123.wav"
        return EmotionDetectionResult(
            dominant_emotion="sad",
            scores={"sad": 0.64, "happy": 0.09, "angry": 0.11, "neutral": 0.16},
            transcript="",
            audio_scores={"sad": 0.64, "happy": 0.09, "angry": 0.11, "neutral": 0.16},
            text_scores={},
            combined_scores={"sad": 0.64, "happy": 0.09, "angry": 0.11, "neutral": 0.16},
        )

    monkeypatch.setattr(
        "backend.services.emotion_detection_service.EmotionDetectionService.detect_from_audio_path_async",
        fake_detect_from_audio_path_async,
        raising=True,
    )

    resp = client.post("/detect-emotion", json={"audio_path": "audio_storage/recording_123.wav"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["dominant_emotion"] == "sad"
    assert data["scores"]["sad"] == 0.64


def test_detect_emotion_rejects_path_traversal(client: TestClient):
    resp = client.post("/detect-emotion", json={"audio_path": "../secrets.wav"})
    assert resp.status_code == 400
