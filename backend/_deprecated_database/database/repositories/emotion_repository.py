"""Repository for emotion-related Supabase operations."""

from __future__ import annotations

from typing import Any

from backend.storage.data_backend import StorageBackend


class EmotionRepository:
    """Data access layer for emotion readings."""

    def __init__(self, data_service: StorageBackend | None = None) -> None:
        self._data_service = data_service or StorageBackend()

    async def create_reading(self, data: dict[str, Any]) -> dict[str, Any]:
        """Persist a new emotion reading."""
        return await self._data_service.insert_row("emotion_readings", data)

    async def list_readings_for_user(self, user_id: str) -> list[dict[str, Any]]:
        """Return emotion readings for a given user."""
        return await self._data_service.select_rows(
            "emotion_readings",
            eq_filters={"user_id": user_id},
            order_by="created_at",
        )

    async def list_readings_for_user_in_last_days(
        self,
        user_id: str,
        days: int,
    ) -> list[dict[str, Any]]:
        """Return emotion readings for a given user within the last `days` days."""
        return await self._data_service.list_rows_since_days(
            "emotion_readings",
            user_id=user_id,
            days=days,
            order_by="created_at",
        )

