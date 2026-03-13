"""
API tests for the /detect-emotion endpoint.

We mock the underlying emotion detector so tests remain fast and do not
download Hugging Face models.
"""

from pathlib import Path

from fastapi.testclient import TestClient


def test_detect_emotion_success(client: TestClient, monkeypatch, tmp_path: Path):
    # Create a fake stored audio file location under backend/audio_storage/
    storage_dir = Path("backend") / "audio_storage"
    storage_dir.mkdir(parents=True, exist_ok=True)
    fake_audio = storage_dir / "recording_123.wav"
    fake_audio.write_bytes(b"RIFFxxxxWAVE")

    # Patch the symbol imported by the route module (not the original service module),
    # since the endpoint does: `from backend.services.emotion_detector import detect_emotion`.
    import backend.api.emotion_routes as routes_module

    def fake_detect_emotion(path):  # noqa: ANN001
        assert str(path).endswith("backend\\audio_storage\\recording_123.wav") or str(path).endswith(
            "backend/audio_storage/recording_123.wav"
        )
        return {"sad": 0.64, "happy": 0.09, "angry": 0.11, "neutral": 0.16}

    monkeypatch.setattr(routes_module, "detect_emotion", fake_detect_emotion, raising=True)

    resp = client.post("/detect-emotion", json={"audio_path": "audio_storage/recording_123.wav"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["dominant_emotion"] == "sad"
    assert data["scores"]["sad"] == 0.64


def test_detect_emotion_rejects_path_traversal(client: TestClient):
    resp = client.post("/detect-emotion", json={"audio_path": "../secrets.wav"})
    assert resp.status_code == 400

