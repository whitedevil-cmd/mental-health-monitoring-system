"""Text emotion detection service powered by Hugging Face Transformers."""

from __future__ import annotations

from functools import lru_cache
from typing import Any

MODEL_ID = "j-hartmann/emotion-english-distilroberta-base"


class TextEmotionDetector:
    """Detect emotion probabilities from text."""

    def __init__(self, model_id: str = MODEL_ID) -> None:
        self._model_id = model_id

    def detect(self, text: str) -> dict[str, float]:
        """Return emotion probability scores for the provided text."""
        if not text or not text.strip():
            raise ValueError("Text input is required for emotion detection.")

        classifier = _get_classifier(self._model_id)
        predictions = classifier(text, truncation=True)

        # With top_k=None, HF returns a list with one list per input item.
        if predictions and isinstance(predictions[0], list):
            items = predictions[0]
        else:
            items = predictions

        scores: dict[str, float] = {}
        for item in items:
            label = str(item.get("label", "")).lower()
            score = float(item.get("score", 0.0))
            if label:
                scores[label] = score

        return scores


@lru_cache()
def get_model(model_id: str = MODEL_ID) -> Any:
    """Load and cache the text-classification pipeline."""
    from transformers import pipeline

    return pipeline(
        task="text-classification",
        model=model_id,
        top_k=None,
    )


def _get_classifier(model_id: str = MODEL_ID) -> Any:
    """Backward-compatible alias for cached model loader."""
    return get_model(model_id)


@lru_cache(maxsize=1)
def get_text_emotion_detector() -> TextEmotionDetector:
    """Return a cached text emotion detector instance."""
    return TextEmotionDetector(model_id=MODEL_ID)
