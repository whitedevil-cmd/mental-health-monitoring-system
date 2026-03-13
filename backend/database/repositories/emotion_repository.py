"""
Repository for emotion-related database operations.

This module abstracts raw SQLAlchemy queries into clearly named methods.
Services should depend on this repository instead of directly using the
ORM, which keeps business logic decoupled from persistence details.
"""

from collections.abc import Sequence
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.domain.emotion import EmotionReading


class EmotionRepository:
    """
    Data access layer for emotion readings.

    All methods are placeholders and do not contain sophisticated logic
    yet; they simply illustrate the intended architecture.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_reading(self, data: dict[str, Any]) -> EmotionReading:
        """
        Persist a new emotion reading.

        In a real implementation, `data` would be validated and possibly
        converted from a Pydantic schema into an ORM instance.
        """
        reading = EmotionReading(**data)  # type: ignore[arg-type]
        self._session.add(reading)
        await self._session.commit()
        await self._session.refresh(reading)
        return reading

    async def list_readings_for_user(self, user_id: str) -> Sequence[EmotionReading]:
        """
        Return emotion readings for a given user.

        The query is intentionally simple; later you can add filters,
        pagination, and aggregation for trend analysis.
        """
        result = await self._session.execute(
            EmotionReading.__table__.select().where(  # type: ignore[attr-defined]
                EmotionReading.user_id == user_id
            )
        )
        return result.scalars().all()

"""
Repository for emotion-related database operations.

This module abstracts raw SQLAlchemy queries into clearly named methods.
Services should depend on this repository instead of directly using the
ORM, which keeps business logic decoupled from persistence details.
"""

from collections.abc import Sequence
from typing import Any
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.domain.emotion import EmotionReading


class EmotionRepository:
    """
    Data access layer for emotion readings.

    All methods are placeholders and do not contain sophisticated logic
    yet; they simply illustrate the intended architecture.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_reading(self, data: dict[str, Any]) -> EmotionReading:
        """
        Persist a new emotion reading.

        In a real implementation, `data` would be validated and possibly
        converted from a Pydantic schema into an ORM instance.
        """
        reading = EmotionReading(**data)  # type: ignore[arg-type]
        self._session.add(reading)
        await self._session.commit()
        await self._session.refresh(reading)
        return reading

    async def list_readings_for_user(self, user_id: str) -> Sequence[EmotionReading]:
        """
        Return emotion readings for a given user.

        The query is intentionally simple; later you can add filters,
        pagination, and aggregation for trend analysis.
        """
        result = await self._session.execute(
            select(EmotionReading).where(EmotionReading.user_id == user_id)
        )
        return result.scalars().all()

    async def list_readings_for_user_in_last_days(self, user_id: str, days: int) -> Sequence[EmotionReading]:
        """
        Return emotion readings for a given user within the last `days` days.
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        result = await self._session.execute(
            select(EmotionReading)
            .where(EmotionReading.user_id == user_id)
            .where(EmotionReading.created_at >= cutoff_date)
            .order_by(EmotionReading.created_at.asc())
        )
        return result.scalars().all()


