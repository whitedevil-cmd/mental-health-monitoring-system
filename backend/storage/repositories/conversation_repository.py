"""Repository for persisted conversation memory."""

from __future__ import annotations

from backend.storage.data_backend import StorageBackend


class ConversationRepository:
    """Data access layer for therapist conversation memory."""

    def __init__(self, data_backend: StorageBackend | None = None) -> None:
        self._data_backend = data_backend or StorageBackend()

    async def add_conversation(
        self,
        *,
        user_id: str,
        transcript: str | None,
        detected_emotion: str,
        ai_response: str,
    ) -> dict:
        return await self._data_backend.insert_row(
            "conversation_memories",
            {
                "user_id": user_id,
                "transcript": transcript,
                "detected_emotion": detected_emotion,
                "ai_response": ai_response,
            },
        )

    async def get_recent_conversations(self, user_id: str, limit: int = 5) -> list[dict]:
        return await self._data_backend.select_rows(
            "conversation_memories",
            eq_filters={"user_id": user_id},
            order_by="created_at",
            desc=True,
            limit=limit,
        )

    async def list_conversations_for_user(self, user_id: str) -> list[dict]:
        return await self._data_backend.select_rows(
            "conversation_memories",
            eq_filters={"user_id": user_id},
            order_by="created_at",
            desc=False,
        )
