"""
Speech Emotion Recognition (SER) module.

This module provides a standalone, reusable function `detect_emotion(audio_path)`
that loads a Hugging Face audio-classification model once and returns
emotion probability scores for a given WAV file.

Model:
  - ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition

Notes:
  - No FastAPI dependencies: this is intentionally framework-agnostic.
  - The model/pipeline is cached so it is loaded only once per process.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf
import torch
import torchaudio
from transformers import pipeline


MODEL_ID = "ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition"
TARGET_SAMPLE_RATE = 16000


def _load_wav_mono(audio_path: Path) -> tuple[np.ndarray, int]:
    """
    Load an audio file and return mono float32 samples and sample rate.

    - Converts stereo/multi-channel to mono by averaging channels.
    - Ensures float32 dtype.
    """
    audio, sr = sf.read(str(audio_path), always_2d=False)

    # soundfile may return shape (n, channels)
    if isinstance(audio, np.ndarray) and audio.ndim == 2:
        audio = audio.mean(axis=1)

    audio = np.asarray(audio, dtype=np.float32)
    return audio, int(sr)


def _normalize_audio(audio: np.ndarray) -> np.ndarray:
    """
    Peak-normalize audio to [-1, 1] if needed.

    This is a conservative normalization step that avoids clipping and
    keeps silence as silence.
    """
    if audio.size == 0:
        return audio
    peak = float(np.max(np.abs(audio)))
    if peak == 0.0:
        return audio
    if peak > 1.0:
        return audio / peak
    return audio


def _resample_if_needed(audio: np.ndarray, sr: int) -> tuple[np.ndarray, int]:
    """
    Resample audio to TARGET_SAMPLE_RATE if the input sample rate differs.
    """
    if sr == TARGET_SAMPLE_RATE or audio.size == 0:
        return audio, sr

    waveform = torch.from_numpy(audio).unsqueeze(0)  # (1, n)
    resampler = torchaudio.transforms.Resample(orig_freq=sr, new_freq=TARGET_SAMPLE_RATE)
    resampled = resampler(waveform).squeeze(0).cpu().numpy().astype(np.float32)
    return resampled, TARGET_SAMPLE_RATE


@lru_cache(maxsize=1)
def _get_classifier() -> Any:
    """
    Create and cache the Hugging Face audio-classification pipeline.

    Caching ensures the model is loaded only once per process.
    """
    device = 0 if torch.cuda.is_available() else -1
    return pipeline(
        task="audio-classification",
        model=MODEL_ID,
        device=device,
        top_k=None,  # return all labels
    )


def detect_emotion(audio_path: str | Path) -> dict[str, float]:
    """
    Detect emotions from a WAV file and return probability scores per label.

    Args:
        audio_path: Path to a .wav audio file.

    Returns:
        Mapping of emotion label -> probability score.
        Example:
            {"happy": 0.10, "sad": 0.65, "angry": 0.12, "neutral": 0.13}
    """
    path = Path(audio_path)
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(f"Audio file not found: {path}")
    if path.suffix.lower() != ".wav":
        raise ValueError("Only WAV audio files are supported.")

    audio, sr = _load_wav_mono(path)
    audio = _normalize_audio(audio)
    audio, sr = _resample_if_needed(audio, sr)

    if audio.size == 0:
        raise ValueError("Audio file contains no samples.")

    classifier = _get_classifier()
    # Pipeline accepts numpy array + sample rate
    outputs = classifier({"array": audio, "sampling_rate": sr})

    # Normalize output into {label: score}
    scores: dict[str, float] = {}
    for item in outputs:
        label = str(item.get("label"))
        score = float(item.get("score", 0.0))
        scores[label] = score

    return scores

