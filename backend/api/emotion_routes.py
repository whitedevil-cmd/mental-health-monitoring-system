"""Emotion detection API routes."""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from pydantic import BaseModel, Field

from backend.services.audio_service import AudioService
from backend.services.emotion_detection_service import EmotionDetectionService
from backend.services.emotion_storage import save_emotion_result
from backend.services.support_generator import SupportGeneratorService
from backend.services.text_emotion_service import TextEmotionService
from backend.utils.errors import (
    DatabaseOperationError,
    EmotionDetectionError,
    InsightGenerationError,
    ServiceError,
)

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


class AnalyzeTextRequest(BaseModel):
    """Request body for text-only emotion analysis."""

    text: str = Field(..., min_length=1)


class AnalyzeTextResponse(BaseModel):
    """Response body for text-only emotion analysis."""

    emotion: str
    confidence: float


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


def get_text_emotion_service() -> TextEmotionService:
    """Dependency wrapper for text-only emotion analysis."""
    return TextEmotionService()


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


async def _generate_support_message(
    support_service: SupportGeneratorService,
    *,
    emotion: str,
    confidence: float | None,
) -> str:
    """Offload support generation to a worker thread to avoid blocking the event loop."""
    trend_summary = _trend_summary_from_confidence(emotion, confidence)
    try:
        return await asyncio.to_thread(
            support_service.generate_support_message,
            current_emotion=emotion,
            trend_summary=trend_summary,
            memory_context=None,
        )
    except Exception as exc:  # pragma: no cover - provider/runtime dependent
        logger.exception("Support generation failed for emotion=%s: %s", emotion, exc)
        raise InsightGenerationError(details="Support message generation failed.") from exc


async def _persist_emotion_log(
    *,
    user_id: str | None,
    dominant_emotion: str,
    scores: dict[str, float],
    transcript: str,
) -> None:
    """Persist detector output with consistent error logging."""
    try:
        if user_id:
            await save_emotion_result(
                session=None,
                user_id=user_id,
                dominant_emotion=dominant_emotion,
                scores=scores,
                transcript=transcript,
            )
        else:
            await save_emotion_result(
                session=None,
                dominant_emotion=dominant_emotion,
                scores=scores,
                transcript=transcript,
            )
    except DatabaseOperationError:
        logger.exception("Emotion log persistence failed for user_id=%s", user_id)
        raise


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
    try:
        result = await service.detect_from_audio_path_async(payload.audio_path)
    except ServiceError:
        logger.exception("Detect-emotion request failed for audio_path=%s", payload.audio_path)
        raise
    except Exception as exc:  # pragma: no cover - safety net
        logger.exception("Unexpected detect-emotion failure for audio_path=%s: %s", payload.audio_path, exc)
        raise EmotionDetectionError(details="Unexpected emotion detection error.") from exc
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
    user_id: str | None = Form(default=None, description="Supabase auth user id"),
    audio_service: AudioService = Depends(get_audio_service),
    detection_service: EmotionDetectionService = Depends(get_emotion_detection_service),
    support_service: SupportGeneratorService = Depends(get_support_generator_service),
) -> AnalyzeAudioResponse:
    """Accept a WAV upload and return emotion probabilities."""
    logger.info("analyze-audio endpoint called with filename=%s content_type=%s", file.filename, file.content_type)
    try:
        upload_result = await audio_service.handle_wav_upload(file=file)
        file_path = upload_result["file_path"]
    except ServiceError:
        logger.exception("Audio upload failed for filename=%s", file.filename)
        raise

    try:
        detection = await detection_service.detect_from_audio_path_async(file_path)
    except ServiceError:
        logger.exception("Emotion detection failed for stored file=%s", file_path)
        raise
    except Exception as exc:  # pragma: no cover - safety net
        logger.exception("Unexpected analyze-audio detection failure for file=%s: %s", file_path, exc)
        raise EmotionDetectionError(details="Unexpected emotion detection error.") from exc

    confidence = detection.scores.get(detection.dominant_emotion, 0.0)
    await _persist_emotion_log(
        user_id=user_id,
        dominant_emotion=detection.dominant_emotion,
        scores=detection.scores,
        transcript=detection.transcript,
    )
    response_message = await _generate_support_message(
        support_service,
        emotion=detection.dominant_emotion,
        confidence=confidence,
    )
    return AnalyzeAudioResponse(
        transcript=detection.transcript,
        emotion=detection.dominant_emotion,
        confidence=confidence,
        probabilities=detection.scores,
        response=response_message,
    )


@router.post(
    "/analyze-text",
    response_model=AnalyzeTextResponse,
    status_code=status.HTTP_200_OK,
)
async def analyze_text_endpoint(
    payload: AnalyzeTextRequest,
    text_service: TextEmotionService = Depends(get_text_emotion_service),
) -> AnalyzeTextResponse:
    """Analyze text only and return the dominant emotion with confidence."""
    logger.info("analyze-text endpoint called")
    try:
        result = await text_service.analyze_text(payload.text)
    except ServiceError:
        logger.exception("Text emotion analysis failed")
        raise
    except Exception as exc:  # pragma: no cover - safety net
        logger.exception("Unexpected analyze-text failure: %s", exc)
        raise EmotionDetectionError(details="Unexpected text emotion analysis error.") from exc

    return AnalyzeTextResponse(
        emotion=result.emotion,
        confidence=result.confidence,
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
    message = await _generate_support_message(
        support_service,
        emotion=payload.emotion,
        confidence=payload.confidence,
    )
    return GenerateSupportResponse(message=message)
