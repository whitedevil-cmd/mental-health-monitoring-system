"""
Service layer for audio-related operations.

This module defines high-level operations for handling user audio
uploads. It coordinates between the storage backend and any future
metadata persistence logic, but avoids direct framework or DB details.
"""

from fastapi import UploadFile

from backend.audio_storage.filesystem_backend import FileSystemAudioStorage
from backend.models.schemas.audio import AudioUploadResponse


class AudioService:
    """
    High-level audio use cases.

    Methods here should remain framework-agnostic so they can be
    reused from different API versions or even background workers.
    """

    def __init__(self) -> None:
        self._storage = FileSystemAudioStorage()

    async def handle_upload(self, user_id: str, file: UploadFile) -> AudioUploadResponse:
        """
        Process a user audio upload and return basic metadata.

        The current implementation only stores the file and returns
        a placeholder response. It does not trigger emotion detection.
        """
        audio_id, _path, stored_at = await self._storage.save(user_id, file)
        return AudioUploadResponse(
            audio_id=audio_id,
            user_id=user_id,
            stored_at=stored_at,
        )

"""
Service layer for audio-related operations.

This module defines high-level operations for handling user audio
uploads. It coordinates between the storage backend and any future
metadata persistence logic, but avoids direct framework or DB details.
"""

from fastapi import UploadFile

from backend.audio_storage.filesystem_backend import FileSystemAudioStorage
from backend.models.schemas.audio import AudioUploadResponse


class AudioService:
    """
    High-level audio use cases.

    Methods here should remain framework-agnostic so they can be
    reused from different API versions or even background workers.
    """

    def __init__(self) -> None:
        self._storage = FileSystemAudioStorage()

    async def handle_upload(self, user_id: str, file: UploadFile) -> AudioUploadResponse:
        """
        Process a user audio upload and return basic metadata.

        The current implementation only stores the file and returns
        a placeholder response. It does not trigger emotion detection.
        """
        audio_id, _path, stored_at = await self._storage.save(user_id, file)
        return AudioUploadResponse(
            audio_id=audio_id,
            user_id=user_id,
            stored_at=stored_at,
        )

