"""Emotion detection API routes."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from pydantic import BaseModel, Field

from backend.services.audio_service import AudioService
from backend.services.emotion_detection_service import EmotionDetectionService
from backend.services.emotion_storage import save_emotion_result
from backend.services.support_generator import SupportGeneratorService

router = APIRouter(tags=["emotion-detection"])
logger = logging.getLogger(__name__)


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


class AnalyzeAudioResponse(BaseModel):
    """Response body for raw audio analysis."""

    transcript: str
    emotion: str
    confidence: float
    probabilities: dict[str, float]
    response: str


class GenerateSupportRequest(BaseModel):
    """Request body for generating a supportive message."""

    emotion: str = Field(..., min_length=1)
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)


class GenerateSupportResponse(BaseModel):
    """Response body for generating a supportive message."""

    message: str


def get_emotion_detection_service() -> EmotionDetectionService:
    """Dependency wrapper for emotion detection orchestration."""
    return EmotionDetectionService()


def get_audio_service() -> AudioService:
    """Dependency wrapper for audio uploads."""
    return AudioService()


def get_support_generator_service() -> SupportGeneratorService:
    """Dependency wrapper for support generation."""
    return SupportGeneratorService()


def _trend_summary_from_confidence(emotion: str, confidence: float | None) -> str:
    """Derive a lightweight trend summary from confidence."""
    normalized = emotion.strip().lower() or "neutral"
    if confidence is None:
        return f"mixed pattern with recent {normalized}"
    if confidence >= 0.7:
        return f"mostly {normalized}"
    if confidence >= 0.5:
        return f"recent {normalized}"
    return f"mixed pattern with recent {normalized}"


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
    logger.info("detect-emotion endpoint called with audio_path=%s", payload.audio_path)
    result = service.detect_from_audio_path(payload.audio_path)
    return DetectEmotionResponse(
        dominant_emotion=result.dominant_emotion,
        scores=result.scores,
        transcript=result.transcript,
        audio_scores=result.audio_scores,
        text_scores=result.text_scores,
        combined_scores=result.combined_scores,
    )


@router.post(
    "/analyze-audio",
    response_model=AnalyzeAudioResponse,
    status_code=status.HTTP_200_OK,
)
async def analyze_audio_endpoint(
    file: UploadFile = File(..., description="WAV audio file"),
    user_id: str = Form(..., description="Supabase auth user id"),
    audio_service: AudioService = Depends(get_audio_service),
    detection_service: EmotionDetectionService = Depends(get_emotion_detection_service),
    support_service: SupportGeneratorService = Depends(get_support_generator_service),
) -> AnalyzeAudioResponse:
    """Accept a WAV upload and return emotion probabilities."""
    logger.info("analyze-audio endpoint called with filename=%s content_type=%s", file.filename, file.content_type)
    upload_result = await audio_service.handle_wav_upload(file=file)
    file_path = upload_result["file_path"]
    detection = detection_service.detect_from_audio_path(file_path)
    confidence = detection.scores.get(detection.dominant_emotion, 0.0)
    await save_emotion_result(
        user_id=user_id,
        dominant_emotion=detection.dominant_emotion,
        scores=detection.scores,
        transcript=detection.transcript,
    )
    trend_summary = _trend_summary_from_confidence(detection.dominant_emotion, confidence)
    response_message = support_service.generate_support_message(
        current_emotion=detection.dominant_emotion,
        trend_summary=trend_summary,
        memory_context=None,
    )
    return AnalyzeAudioResponse(
        transcript=detection.transcript,
        emotion=detection.dominant_emotion,
        confidence=confidence,
        probabilities=detection.scores,
        response=response_message,
    )


@router.post(
    "/generate-support",
    response_model=GenerateSupportResponse,
    status_code=status.HTTP_200_OK,
)
async def generate_support_endpoint(
    payload: GenerateSupportRequest,
    support_service: SupportGeneratorService = Depends(get_support_generator_service),
) -> GenerateSupportResponse:
    """Generate a short supportive message for the supplied emotion."""
    logger.info("generate-support endpoint called with emotion=%s confidence=%s", payload.emotion, payload.confidence)
    trend_summary = _trend_summary_from_confidence(payload.emotion, payload.confidence)
    message = support_service.generate_support_message(
        current_emotion=payload.emotion,
        trend_summary=trend_summary,
        memory_context=None,
    )
    return GenerateSupportResponse(message=message)
