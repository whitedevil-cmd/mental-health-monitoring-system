"""Service layer for audio-related operations."""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import UploadFile

from backend.audio_storage.filesystem_backend import FileSystemAudioStorage
from backend.models.schemas.audio import AudioUploadResponse

logger = logging.getLogger(__name__)


class AudioService:
    """High-level audio use cases."""

    def __init__(self, storage: FileSystemAudioStorage | None = None) -> None:
        self._storage = storage or FileSystemAudioStorage()

    async def handle_upload(self, user_id: str, file: UploadFile) -> AudioUploadResponse:
        """Store a user-scoped audio file and return metadata."""
        audio_id, _path, stored_at = await self._storage.save(user_id, file)
        logger.info("Audio metadata prepared for user %s with audio_id %s", user_id, audio_id)
        return AudioUploadResponse(
            audio_id=audio_id,
            user_id=user_id,
            stored_at=stored_at,
        )

    async def handle_wav_upload(self, file: UploadFile) -> dict[str, str]:
        """Store a raw WAV upload and return the relative path expected by the frontend."""
        relative_path = await self._storage.save_wav_upload(file)
        return {
            "status": "success",
            "file_path": relative_path,
        }

    def resolve_uploaded_audio_path(self, relative_path: str) -> Path:
        """Resolve a client-provided audio path to a validated file path."""
        return self._storage.resolve_uploaded_audio_path(relative_path)
