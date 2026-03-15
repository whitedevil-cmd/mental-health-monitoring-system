"""
Unit tests for the standalone speech emotion recognition module.

These tests mock the Hugging Face pipeline so:
- No model is downloaded during tests.
- We can verify the "load model only once" behavior deterministically.
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

from backend.services import emotion_detector


def test_detect_emotion_rejects_nonexistent_file(tmp_path: Path):
    with pytest.raises(FileNotFoundError):
        emotion_detector.detect_emotion(tmp_path / "missing.wav")


def test_detect_emotion_rejects_non_wav(tmp_path: Path):
    p = tmp_path / "audio.mp3"
    p.write_bytes(b"not-wav")
    with pytest.raises(ValueError, match="Only WAV"):
        emotion_detector.detect_emotion(p)


def test_detect_emotion_returns_scores_and_caches_model(tmp_path: Path):
    # Create a tiny "wav-like" file path; we'll mock the loader so no real parsing.
    p = tmp_path / "audio.wav"
    p.write_bytes(b"RIFFxxxxWAVE")  # content irrelevant due to mocks

    fake_audio = np.ones(33000, dtype=np.float32) * 0.1

    mock_classifier = MagicMock()
    mock_classifier.return_value = [
        {"label": "hap", "score": 0.10},
        {"label": "sad", "score": 0.65},
        {"label": "ang", "score": 0.12},
        {"label": "neu", "score": 0.13},
    ]

    # Ensure we start with a clean cache for this test
    emotion_detector._get_classifier.cache_clear()

    with patch.object(emotion_detector, "_load_wav_mono", return_value=(fake_audio, 16000)), patch.object(
        emotion_detector, "_resample_if_needed", return_value=(fake_audio, 16000)
    ), patch.object(emotion_detector, "pipeline", autospec=True) as pipeline_mock:
        pipeline_mock.return_value = mock_classifier

        out1 = emotion_detector.detect_emotion(p)
        out2 = emotion_detector.detect_emotion(p)

    assert out1["sad"] == pytest.approx(0.65)
    assert out1["happy"] == pytest.approx(0.10)
    assert set(out1.keys()) == {"happy", "sad", "angry", "neutral"}
    assert out2 == out1

    # Pipeline should have been constructed only once due to caching
    assert pipeline_mock.call_count == 1

