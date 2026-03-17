"""Repository for emotion-related database operations."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.schema_utils import ensure_sqlite_column
from backend.models.domain.emotion import EmotionReading


class EmotionRepository:
    """Data access layer for emotion readings."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_reading(self, data: dict[str, Any]) -> EmotionReading:
        """Persist a new emotion reading, including transcript when provided."""
        # Ensure legacy SQLite tables are upgraded before insert.
        await ensure_sqlite_column(
            self._session,
            table_name="emotion_readings",
            column_name="transcript",
            column_definition="transcript TEXT",
        )

        # Keep inserts resilient to extra payload keys while preserving known columns.
        allowed_fields = {column.name for column in EmotionReading.__table__.columns}
        filtered_data = {key: value for key, value in data.items() if key in allowed_fields}

        reading = EmotionReading(**filtered_data)  # type: ignore[arg-type]
        self._session.add(reading)
        try:
            await self._session.commit()
            await self._session.refresh(reading)
        except SQLAlchemyError:
            await self._session.rollback()
            raise
        return reading

    async def list_readings_for_user(self, user_id: str) -> Sequence[EmotionReading]:
        """Return emotion readings for a given user."""
        result = await self._session.execute(
            select(EmotionReading)
            .where(EmotionReading.user_id == user_id)
            .order_by(EmotionReading.created_at.asc())
        )
        return result.scalars().all()

    async def list_readings_for_user_in_last_days(
        self,
        user_id: str,
        days: int,
    ) -> Sequence[EmotionReading]:
        """Return emotion readings for a given user within the last `days` days."""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        result = await self._session.execute(
            select(EmotionReading)
            .where(EmotionReading.user_id == user_id)
            .where(EmotionReading.created_at >= cutoff_date)
            .order_by(EmotionReading.created_at.asc())
        )
        return result.scalars().all()
