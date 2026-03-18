"""Service layer for audio-related operations."""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import UploadFile

from backend.audio_storage.filesystem_backend import FileSystemAudioStorage
from backend.models.schemas.audio import AudioUploadResponse
from backend.storage.data_backend import StorageBackend

logger = logging.getLogger(__name__)


class AudioService:
    """High-level audio use cases."""

    def __init__(self, storage: FileSystemAudioStorage | None = None) -> None:
        self._storage = storage or FileSystemAudioStorage()
        self._data_service = StorageBackend()

    async def handle_upload(self, user_id: str, file: UploadFile) -> AudioUploadResponse:
        """Store a user-scoped audio file and return metadata."""
        logger.info("Audio upload start for user %s", user_id)
        audio_id, file_path, stored_at = await self._storage.save(user_id, file)
        record = await self._data_service.insert_row(
            "audio_recordings",
            {
                "user_id": user_id,
                "file_path": str(file_path),
                "mime_type": file.content_type or "application/octet-stream",
            },
        )
        stored_id = str(record.get("id", audio_id))
        logger.info("Audio upload completed for user %s with audio_id %s", user_id, stored_id)
        return AudioUploadResponse(
            audio_id=stored_id,
            user_id=user_id,
            stored_at=stored_at,
        )

    async def handle_wav_upload(self, file: UploadFile) -> dict[str, str]:
        """Store a raw WAV upload and return the relative path expected by the frontend."""
        logger.info("WAV audio upload start")
        relative_path = await self._storage.save_wav_upload(file)
        logger.info("WAV audio upload completed")
        return {
            "status": "success",
            "file_path": relative_path,
        }

    def resolve_uploaded_audio_path(self, relative_path: str) -> Path:
        """Resolve a client-provided audio path to a validated file path."""
        return self._storage.resolve_uploaded_audio_path(relative_path)
