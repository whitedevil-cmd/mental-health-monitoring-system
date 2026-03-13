"""
API tests for audio-related endpoints.

These tests focus on validating request/response behavior and basic
file-type validation for the upload endpoints.
"""

import io

from fastapi.testclient import TestClient


def test_upload_audio_wav_success(client: TestClient):
    """Uploading a valid WAV file should succeed and return file_path."""
    wav_bytes = b"RIFF\x00\x00\x00\x00WAVE"  # minimal WAV header bytes
    files = {
        "file": ("test.wav", io.BytesIO(wav_bytes), "audio/wav"),
    }

    response = client.post("/api/v1/audio/upload-audio", files=files)

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "success"
    assert data["file_path"].startswith("audio_storage/recording_")
    assert data["file_path"].endswith(".wav")


def test_upload_audio_wav_rejects_non_wav(client: TestClient):
    """Uploading a non-WAV file should be rejected with 400."""
    files = {
        "file": ("test.mp3", io.BytesIO(b"fake-mp3"), "audio/mpeg"),
    }

    response = client.post("/api/v1/audio/upload-audio", files=files)

    assert response.status_code == 400
    body = response.json()
    assert body["detail"] == "Only WAV audio files are supported."

