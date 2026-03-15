"""Emotion detection API routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel

from backend.services.emotion_detection_service import EmotionDetectionService

router = APIRouter(tags=["emotion-detection"])


class DetectEmotionRequest(BaseModel):
    """Request body for emotion detection."""

    audio_path: str


class DetectEmotionResponse(BaseModel):
    """Response body for emotion detection."""

    dominant_emotion: str
    scores: dict[str, float]
    transcript: str
    audio_scores: dict[str, float]
    text_scores: dict[str, float]
    combined_scores: dict[str, float]


def get_emotion_detection_service() -> EmotionDetectionService:
    """Dependency wrapper for emotion detection orchestration."""
    return EmotionDetectionService()


@router.post(
    "/detect-emotion",
    response_model=DetectEmotionResponse,
    status_code=status.HTTP_200_OK,
)
async def detect_emotion_endpoint(
    payload: DetectEmotionRequest,
    service: EmotionDetectionService = Depends(get_emotion_detection_service),
) -> DetectEmotionResponse:
    """Run emotion detection on a stored WAV file and return multimodal results."""
    result = service.detect_from_audio_path(payload.audio_path)
    return DetectEmotionResponse(
        dominant_emotion=result.dominant_emotion,
        scores=result.scores,
        transcript=result.transcript,
        audio_scores=result.audio_scores,
        text_scores=result.text_scores,
        combined_scores=result.combined_scores,
    )
