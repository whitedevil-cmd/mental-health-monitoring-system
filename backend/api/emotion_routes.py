"""
Emotion detection API routes.

This module exposes an endpoint that runs speech emotion recognition
against a stored WAV file path and returns:
- probability scores for all emotions
- the dominant (highest-probability) emotion

It is intentionally thin and delegates ML work to
`backend.services.emotion_detector`.
"""

import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from backend.services.emotion_detector import detect_emotion


logger = logging.getLogger(__name__)
router = APIRouter(tags=["emotion-detection"])


class DetectEmotionRequest(BaseModel):
    """Request body for emotion detection."""

    audio_path: str


class DetectEmotionResponse(BaseModel):
    """Response body for emotion detection."""

    dominant_emotion: str
    scores: dict[str, float]


@router.post(
    "/detect-emotion",
    response_model=DetectEmotionResponse,
    status_code=status.HTTP_200_OK,
)
async def detect_emotion_endpoint(payload: DetectEmotionRequest) -> DetectEmotionResponse:
    """
    Run emotion detection on a stored WAV file and return scores + dominant label.

    Expected input path format matches the upload endpoint output, e.g.:
      "audio_storage/recording_123.wav"
    which maps to:
      backend/audio_storage/recording_123.wav
    """
    # Resolve the provided path against the backend directory
    relative = Path(payload.audio_path)
    resolved = (Path("backend") / relative).resolve()

    # Basic safety check: keep reads within backend/audio_storage
    allowed_root = (Path("backend") / "audio_storage").resolve()
    if allowed_root not in resolved.parents and resolved != allowed_root:
        logger.warning("Rejected audio_path outside allowed storage: %s", payload.audio_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid audio_path.",
        )

    try:
        scores = detect_emotion(resolved)
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audio file not found.",
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except Exception as exc:  # pragma: no cover
        logger.exception("Emotion detection failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Emotion detection failed.",
        )

    if not scores:
        logger.warning("Emotion detector returned empty scores for %s", payload.audio_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Emotion detection returned no scores.",
        )

    dominant_emotion = max(scores.items(), key=lambda kv: kv[1])[0]
    logger.info(
        "Emotion detection completed for %s | dominant=%s",
        payload.audio_path,
        dominant_emotion,
    )

    return DetectEmotionResponse(dominant_emotion=dominant_emotion, scores=scores)

