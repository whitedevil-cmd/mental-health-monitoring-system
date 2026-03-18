"""
Audio storage backend using the local filesystem.

This module centralizes file validation, persistence, and path
resolution for stored audio so routes stay thin and service-oriented.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import UploadFile, status

from backend.utils.config import get_settings
from backend.utils.errors import AudioUploadError, AudioValidationError

logger = logging.getLogger(__name__)


class FileSystemAudioStorage:
    """Simple audio storage implementation that writes files to disk."""

    _ALLOWED_WAV_TYPES = frozenset({"audio/wav", "audio/x-wav", "audio/wave"})
    _MAX_WAV_SIZE_BYTES = 10 * 1024 * 1024

    def __init__(self) -> None:
        settings = get_settings()
        self._base_dir = Path(settings.AUDIO_STORAGE_DIR)
        self._base_dir.mkdir(parents=True, exist_ok=True)
        self._wav_upload_dir = Path("backend") / "audio_storage"
        self._wav_upload_dir.mkdir(parents=True, exist_ok=True)

    async def save(self, user_id: str, file: UploadFile) -> tuple[str, Path, datetime]:
        """Store a user-scoped audio file and return its metadata."""
        audio_id = str(uuid.uuid4())
        suffix = Path(file.filename or "").suffix or ".wav"
        filename = f"{audio_id}{suffix}"
        user_dir = self._base_dir / user_id
        user_dir.mkdir(parents=True, exist_ok=True)

        file_path = user_dir / filename
        stored_at = datetime.now(timezone.utc)
        await self._write_file(file_path, file)
        logger.info("Stored audio upload for user %s at %s", user_id, file_path)
        return audio_id, file_path, stored_at

    async def save_wav_upload(self, file: UploadFile) -> str:
        """Validate and store a WAV upload under backend/audio_storage."""
        self._validate_wav_upload(file)
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
        filename = f"recording_{timestamp}.wav"
        file_path = self._wav_upload_dir / filename

        await self._write_file(file_path, file)
        logger.info("Stored WAV upload at %s", file_path)
        return f"audio_storage/{filename}"

    def resolve_uploaded_audio_path(self, relative_path: str) -> Path:
        """Resolve a client-provided relative audio path safely."""
        relative = Path(relative_path)
        resolved = (Path("backend") / relative).resolve()
        allowed_root = self._wav_upload_dir.resolve()

        if allowed_root not in resolved.parents and resolved != allowed_root:
            raise AudioValidationError("Invalid audio_path.", details="Audio path must stay inside backend/audio_storage.")

        return resolved

    def _validate_wav_upload(self, file: UploadFile) -> None:
        """Validate content type, extension, and size for WAV uploads."""
        if file.content_type not in self._ALLOWED_WAV_TYPES:
            raise AudioValidationError("Only WAV audio files are supported.")

        filename = (file.filename or "").lower()
        if not filename.endswith(".wav"):
            raise AudioValidationError("File must have a .wav extension.")

        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)
        if file_size > self._MAX_WAV_SIZE_BYTES:
            raise AudioValidationError(
                "File size exceeds the 10MB limit.",
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

    async def _write_file(self, file_path: Path, file: UploadFile) -> None:
        """Persist an uploaded file to disk."""
        try:
            with file_path.open("wb") as handle:
                file.file.seek(0)
                while True:
                    chunk = await file.read(1024 * 1024)
                    if not chunk:
                        break
                    handle.write(chunk)
        except Exception as exc:  # pragma: no cover - safety net
            logger.exception("Failed writing audio file to %s: %s", file_path, exc)
            raise AudioUploadError(details="File write failed.") from exc
