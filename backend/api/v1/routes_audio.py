"""API routes for audio upload and management (v1)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile, status

from backend.models.schemas.audio import AudioUploadResponse
from backend.services.audio_service import AudioService

router = APIRouter(prefix="/audio", tags=["audio"])


def get_audio_service() -> AudioService:
    """Dependency wrapper for AudioService."""
    return AudioService()


@router.post(
    "/upload",
    response_model=AudioUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_audio(
    user_id: str = Form(..., description="Identifier for the user"),
    file: UploadFile = File(..., description="User audio file"),
    service: AudioService = Depends(get_audio_service),
) -> AudioUploadResponse:
    """Upload a user audio recording using the higher-level AudioService."""
    return await service.handle_upload(user_id=user_id, file=file)


@router.post(
    "/upload-audio",
    status_code=status.HTTP_201_CREATED,
)
async def upload_audio_wav(
    file: UploadFile = File(..., description="WAV audio file"),
    service: AudioService = Depends(get_audio_service),
) -> dict[str, str]:
    """Upload a raw WAV audio file and store it on disk."""
    return await service.handle_wav_upload(file=file)
