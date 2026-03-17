"""
Speech Emotion Recognition (SER) module.

This module provides a reusable function `detect_emotion(audio_path)`
that loads a Hugging Face audio-classification model once and returns
emotion probability scores for a given WAV file.

Model:
  - ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition
"""

from __future__ import annotations

from functools import lru_cache
import logging
from pathlib import Path
from typing import Any

import librosa
import numpy as np
import soundfile as sf

from backend.utils.config import get_settings

logger = logging.getLogger(__name__)

MODEL_ID = get_settings().MODEL_NAME
TARGET_SAMPLE_RATE = 16000


def _get_torch():
    import torch

    return torch


def _get_torchaudio():
    import torchaudio

    return torchaudio


# ---------------------------------------------------------
# AUDIO LOADING
# ---------------------------------------------------------
def _load_wav_mono(audio_path: Path) -> tuple[np.ndarray, int]:
    """
    Load audio file and return mono float32 samples and sample rate.
    """

    audio, sr = sf.read(str(audio_path), always_2d=False)

    # Convert multi-channel audio to mono
    if isinstance(audio, np.ndarray) and audio.ndim == 2:
        audio = audio.mean(axis=1)

    audio = np.asarray(audio, dtype=np.float32)

    # Remove DC offset
    audio = audio - np.mean(audio)

    return audio, int(sr)


# ---------------------------------------------------------
# AUDIO NORMALIZATION
# ---------------------------------------------------------
def _normalize_audio(audio: np.ndarray) -> np.ndarray:
    """
    Normalize audio amplitude to [-1, 1].
    """

    if audio.size == 0:
        return audio

    peak = float(np.max(np.abs(audio)))

    if peak > 0:
        audio = audio / peak

    return audio


# ---------------------------------------------------------
# RESAMPLING
# ---------------------------------------------------------
@lru_cache(maxsize=4)
def _get_resampler(orig_sr: int):
    torchaudio = _get_torchaudio()
    return torchaudio.transforms.Resample(
        orig_freq=orig_sr,
        new_freq=TARGET_SAMPLE_RATE
    )


def _resample_if_needed(audio: np.ndarray, sr: int) -> tuple[np.ndarray, int]:
    """
    Resample audio to TARGET_SAMPLE_RATE if needed.
    """

    if sr == TARGET_SAMPLE_RATE or audio.size == 0:
        return audio, sr

    torch = _get_torch()
    waveform = torch.from_numpy(audio).unsqueeze(0)

    resampler = _get_resampler(sr)

    resampled = resampler(waveform).squeeze(0).cpu().numpy().astype(np.float32)

    return resampled, TARGET_SAMPLE_RATE


# ---------------------------------------------------------
# MODEL LOADING
# ---------------------------------------------------------
@lru_cache()
def get_model() -> Any:
    """
    Load Hugging Face audio classification pipeline once.
    """

    from transformers import pipeline
    torch = _get_torch()

    device = 0 if torch.cuda.is_available() else -1

    return pipeline(
        task="audio-classification",
        model=MODEL_ID,
        device=device,
        top_k=None,
    )


# Backward-compatible alias for cached model loader (keeps cache_clear attribute).
_get_classifier = get_model


# ---------------------------------------------------------
# MAIN EMOTION DETECTION FUNCTION
# ---------------------------------------------------------
def detect_emotion(audio_path: str | Path) -> dict[str, float]:
    """
    Detect emotions from WAV file.

    Args:
        audio_path: Path to WAV file

    Returns:
        Dictionary mapping emotion labels to probabilities.
    """

    path = Path(audio_path)

    if not path.exists() or not path.is_file():
        raise FileNotFoundError(f"Audio file not found: {path}")

    if path.suffix.lower() != ".wav":
        raise ValueError("Only WAV audio files are supported.")

    # -----------------------------------------------------
    # Load audio
    # -----------------------------------------------------
    audio, sr = _load_wav_mono(path)

    # -----------------------------------------------------
    # Trim silence
    # -----------------------------------------------------
    audio, _ = librosa.effects.trim(audio, top_db=30)

    # -----------------------------------------------------
    # Normalize
    # -----------------------------------------------------
    audio = _normalize_audio(audio)

    # -----------------------------------------------------
    # Resample
    # -----------------------------------------------------
    audio, sr = _resample_if_needed(audio, sr)

    # -----------------------------------------------------
    # Duration check
    # -----------------------------------------------------
    duration = len(audio) / sr

    if duration < 2.0:
        raise ValueError("Audio too short for emotion detection.")

    logger.debug(
        "Emotion detector input duration=%s sample_rate=%s max_amplitude=%s",
        duration,
        sr,
        float(np.max(audio)) if audio.size else 0.0,
    )

    # -----------------------------------------------------
    # Run emotion classifier
    # -----------------------------------------------------
    classifier = get_model()

    outputs = classifier(
        {
            "array": audio,
            "sampling_rate": sr
        }
    )

    # -----------------------------------------------------
    # Format scores
    # -----------------------------------------------------
    # superb/wav2vec2-base-superb-er outputs labels like 'neu', 'hap', 'ang', 'sad'
    LABEL_MAPPING = {
        "neu": "neutral",
        "hap": "happy",
        "ang": "angry",
        "sad": "sad",
    }

    scores: dict[str, float] = {}

    for item in outputs:
        raw_label = str(item.get("label")).lower()
        # Fallback to the raw label if it isn't in our mapping
        mapped_label = LABEL_MAPPING.get(raw_label, raw_label)
        score = float(item.get("score", 0.0))
        scores[mapped_label] = score

    return scores
