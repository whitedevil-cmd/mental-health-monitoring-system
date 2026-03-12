"""
Audio storage backend using the local filesystem.

This module abstracts away how audio files are persisted. In the
future, you can provide alternative backends (e.g. S3, GCS) that expose
the same interface.
"""

import uuid
from datetime import datetime
from pathlib import Path

from fastapi import UploadFile

from backend.utils.config import get_settings


class FileSystemAudioStorage:
    """
    Simple audio storage implementation that writes files to disk.

    The implementation is intentionally minimal and does not perform
    advanced validation or security checks yet.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._base_dir = Path(settings.AUDIO_STORAGE_DIR)
        self._base_dir.mkdir(parents=True, exist_ok=True)

    async def save(self, user_id: str, file: UploadFile) -> tuple[str, Path, datetime]:
        """
        Store an uploaded audio file on disk.

        Returns a tuple (audio_id, file_path, stored_at). The actual
        content of the audio file is not inspected here.
        """
        audio_id = str(uuid.uuid4())
        suffix = Path(file.filename or "").suffix or ".wav"
        filename = f"{audio_id}{suffix}"
        user_dir = self._base_dir / user_id
        user_dir.mkdir(parents=True, exist_ok=True)

        file_path = user_dir / filename
        stored_at = datetime.utcnow()

        # Minimal placeholder write logic
        with file_path.open("wb") as f:
            content = await file.read()
            f.write(content)

        return audio_id, file_path, stored_at

"""
Audio storage backend using the local filesystem.

This module abstracts away how audio files are persisted. In the
future, you can provide alternative backends (e.g. S3, GCS) that expose
the same interface.
"""

import uuid
from datetime import datetime
from pathlib import Path

from fastapi import UploadFile

from backend.utils.config import get_settings


class FileSystemAudioStorage:
    """
    Simple audio storage implementation that writes files to disk.

    The implementation is intentionally minimal and does not perform
    advanced validation or security checks yet.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._base_dir = Path(settings.AUDIO_STORAGE_DIR)
        self._base_dir.mkdir(parents=True, exist_ok=True)

    async def save(self, user_id: str, file: UploadFile) -> tuple[str, Path, datetime]:
        """
        Store an uploaded audio file on disk.

        Returns a tuple (audio_id, file_path, stored_at). The actual
        content of the audio file is not inspected here.
        """
        audio_id = str(uuid.uuid4())
        suffix = Path(file.filename or "").suffix or ".wav"
        filename = f"{audio_id}{suffix}"
        user_dir = self._base_dir / user_id
        user_dir.mkdir(parents=True, exist_ok=True)

        file_path = user_dir / filename
        stored_at = datetime.utcnow()

        # Minimal placeholder write logic
        with file_path.open("wb") as f:
            content = await file.read()
            f.write(content)

        return audio_id, file_path, stored_at

