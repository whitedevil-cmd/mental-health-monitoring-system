import logging
import os
import time
from pathlib import Path

logger = logging.getLogger(__name__)

def cleanup_old_audio_files(max_age_hours: int = 24) -> None:
    """
    Deletes audio files in the storage directory that are older than max_age_hours.
    """
    storage_dir = Path("backend") / "audio_storage"
    if not storage_dir.exists() or not storage_dir.is_dir():
        logger.warning(f"Audio storage directory does not exist: {storage_dir}")
        return

    current_time = time.time()
    max_age_seconds = max_age_hours * 3600
    deleted_count = 0

    try:
        for file_path in storage_dir.glob("*.wav"):
            if not file_path.is_file():
                continue
                
            file_age = current_time - os.path.getmtime(file_path)
            if file_age > max_age_seconds:
                try:
                    file_path.unlink()
                    deleted_count += 1
                    logger.debug(f"Deleted old audio file: {file_path}")
                except Exception as exc:
                    logger.error(f"Failed to delete {file_path}: {exc}")
        
        if deleted_count > 0:
            logger.info(f"Cleaned up {deleted_count} audio files older than {max_age_hours} hours.")
    except Exception as exc:
        logger.exception(f"Error during audio cleanup: {exc}")
