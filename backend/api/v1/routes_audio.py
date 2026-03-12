"""
API routes for audio upload and management (v1).

These routes provide endpoints that frontend clients can call to upload
user audio recordings. They delegate business logic to `AudioService`
or handle simple file-based uploads.
"""

import logging
from datetime import datetime
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)

from backend.models.schemas.audio import AudioUploadResponse
from backend.services.audio_service import AudioService

router = APIRouter(prefix="/audio", tags=["audio"])
logger = logging.getLogger(__name__)


def get_audio_service() -> AudioService:
    """
    Dependency wrapper for AudioService.

    Using a function here allows easy swapping with a DI container or
    mocking during tests.
    """
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
    """
    Upload a user audio recording using the higher-level AudioService.

    This endpoint stores the audio using the configured storage backend
    and returns structured metadata.
    """
    return await service.handle_upload(user_id=user_id, file=file)


@router.post(
    "/upload-audio",
    status_code=status.HTTP_201_CREATED,
)
async def upload_audio_wav(
    file: UploadFile = File(..., description="WAV audio file"),
) -> dict[str, str]:
    """
    Upload a raw WAV audio file and store it on disk.

    Requirements addressed:
    - Accepts WAV audio files via `UploadFile`.
    - Validates MIME type and `.wav` extension.
    - Saves under `backend/audio_storage/` with a timestamp-based name.
    - Returns a JSON response with a relative file path.
    - Logs upload success and failure events.
    """
    # Validate content type and extension
    allowed_types = {"audio/wav", "audio/x-wav", "audio/wave"}
    if file.content_type not in allowed_types:
        logger.warning(
            "Rejected upload with invalid content type: %s", file.content_type
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only WAV audio files are supported.",
        )

    filename = (file.filename or "").lower()
    if not filename.endswith(".wav"):
        logger.warning("Rejected upload with invalid file extension: %s", file.filename)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must have a .wav extension.",
        )

    try:
        # Ensure target directory exists
        base_dir = Path("backend") / "audio_storage"
        base_dir.mkdir(parents=True, exist_ok=True)

        # Generate unique filename using timestamp
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
        new_filename = f"recording_{timestamp}.wav"
        file_path = base_dir / new_filename

        # Save file contents asynchronously
        contents = await file.read()
        with file_path.open("wb") as f:
            f.write(contents)

        # Relative path used in API response (without "backend/" prefix)
        relative_path = f"audio_storage/{new_filename}"
        logger.info("WAV audio uploaded successfully: %s", file_path)

        return {
            "status": "success",
            "file_path": relative_path,
        }
    except Exception as exc:  # pragma: no cover - generic safeguard
        logger.exception("Failed to save uploaded audio file: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save audio file.",
        ) from exc

