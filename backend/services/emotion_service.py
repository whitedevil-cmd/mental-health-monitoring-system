"""Service layer for emotion persistence."""

from __future__ import annotations

import asyncio
import logging

from backend.storage.repositories.emotion_repository import EmotionRepository
from backend.models.schemas.emotion import EmotionReadingCreate, EmotionReadingRead
from backend.services.audio_service import AudioService
from backend.services.elevenlabs_asr import transcribe_audio_elevenlabs
from backend.utils.errors import DatabaseOperationError

logger = logging.getLogger(__name__)


class EmotionService:
    """High-level emotion persistence use cases."""

    def __init__(self) -> None:
        self._audio_service = AudioService()

    async def analyze_and_store(
        self,
        payload: EmotionReadingCreate,
        session: object | None = None,  # noqa: ARG002
    ) -> EmotionReadingRead:
        """Persist a validated emotion reading via the repository layer."""
        data = payload.model_dump()

        if not data.get("transcript") and data.get("audio_id"):
            try:
                audio_path = self._audio_service.resolve_uploaded_audio_path(str(data["audio_id"]))
                audio_bytes = audio_path.read_bytes()
                data["transcript"] = await asyncio.to_thread(transcribe_audio_elevenlabs, audio_bytes)
            except Exception as exc:  # pragma: no cover - storage/audio dependent
                logger.warning("Could not derive transcript for %s: %s", data.get("audio_id"), exc)

        repo = EmotionRepository()
        try:
            logger.info("Database write start for emotion reading user %s", payload.user_id)
            record = await repo.create_reading(data)
        except DatabaseOperationError as exc:
            logger.exception("Failed to save emotion reading for user %s: %s", payload.user_id, exc)
            raise

        logger.info(
            "Emotion reading stored for user %s with label %s",
            payload.user_id,
            payload.emotion_label,
        )
        return EmotionReadingRead.model_validate(record)
