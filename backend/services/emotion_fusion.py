"""Utilities to fuse audio and text emotion probability predictions."""

from __future__ import annotations

from collections import defaultdict

AUDIO_WEIGHT = 0.35
TEXT_WEIGHT = 0.65


_LABEL_MAP = {
    "anger": "angry",
    "angry": "angry",
    "happiness": "happy",
    "joy": "happy",
    "happy": "happy",
    "sadness": "sad",
    "sad": "sad",
    "calm": "neutral",
    "neutral": "neutral",
    "surprised": "surprise",
    "surprise": "surprise",
    "anxiety": "fear",
    "anxious": "fear",
    "stress": "fear",
    "stressed": "fear",
    "fear": "fear",
    "disgust": "disgust",
}


def _normalize_label(label: str) -> str:
    """Map related labels to a canonical emotion label."""
    normalized = label.strip().lower()
    return _LABEL_MAP.get(normalized, normalized)


def _coerce_probs(probs: dict) -> dict[str, float]:
    """Normalize labels and coerce values to float scores."""
    merged: dict[str, float] = defaultdict(float)
    for label, score in probs.items():
        canonical = _normalize_label(str(label))
        merged[canonical] += float(score)
    return dict(merged)


def fuse_emotions(audio_probs: dict, text_probs: dict) -> tuple[str, dict[str, float]]:
    """
    Fuse audio and text emotion probability dictionaries.

    Returns:
        (final_emotion, combined_scores)
    """
    normalized_audio = _coerce_probs(audio_probs or {})
    normalized_text = _coerce_probs(text_probs or {})

    labels = set(normalized_audio) | set(normalized_text)
    if not labels:
        return "uncertain", {}

    combined: dict[str, float] = {}
    for label in labels:
        audio_score = normalized_audio.get(label, 0.0)
        text_score = normalized_text.get(label, 0.0)
        combined[label] = (AUDIO_WEIGHT * audio_score) + (TEXT_WEIGHT * text_score)

    total = sum(combined.values())
    if total > 0:
        combined = {label: score / total for label, score in combined.items()}

    final_emotion = max(combined, key=combined.get) if combined else "uncertain"
    return final_emotion, combined
