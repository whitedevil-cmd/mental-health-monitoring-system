"""Service layer for emotion persistence."""

from __future__ import annotations

import logging

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.repositories.emotion_repository import EmotionRepository
from backend.models.schemas.emotion import EmotionReadingCreate, EmotionReadingRead
from backend.services.audio_service import AudioService
from backend.services.whisper_transcriber import get_transcriber
from backend.utils.errors import DatabaseOperationError

logger = logging.getLogger(__name__)


class EmotionService:
    """High-level emotion persistence use cases."""

    def __init__(self) -> None:
        self._audio_service = AudioService()

    async def analyze_and_store(
        self,
        session: AsyncSession,
        payload: EmotionReadingCreate,
    ) -> EmotionReadingRead:
        """Persist a validated emotion reading via the repository layer."""
        data = payload.model_dump()

        if not data.get("transcript") and data.get("audio_id"):
            try:
                audio_path = self._audio_service.resolve_uploaded_audio_path(str(data["audio_id"]))
                data["transcript"] = get_transcriber().transcribe(str(audio_path))
            except Exception as exc:  # pragma: no cover - storage/audio dependent
                logger.warning("Could not derive transcript for %s: %s", data.get("audio_id"), exc)

        repo = EmotionRepository(session)
        try:
            record = await repo.create_reading(data)
        except SQLAlchemyError as exc:
            logger.exception("Failed to save emotion reading for user %s: %s", payload.user_id, exc)
            raise DatabaseOperationError(
                "Failed to save emotion reading.",
                details="Database write failed.",
            ) from exc

        logger.info(
            "Emotion reading stored for user %s with label %s",
            payload.user_id,
            payload.emotion_label,
        )
        return EmotionReadingRead.model_validate(record)
