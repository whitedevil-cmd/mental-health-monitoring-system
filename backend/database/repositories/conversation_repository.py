"""Repository for persisted conversation memory via Supabase."""

from __future__ import annotations

from backend.services.supabase_data_service import SupabaseDataService


class ConversationRepository:
    """Data access layer for therapist conversation memory."""

    def __init__(self, data_service: SupabaseDataService | None = None) -> None:
        self._data_service = data_service or SupabaseDataService()

    async def add_conversation(
        self,
        *,
        user_id: str,
        transcript: str | None,
        detected_emotion: str,
        ai_response: str,
    ) -> dict:
        """Persist a new conversation memory row."""
        return await self._data_service.insert_row(
            "conversation_memories",
            {
                "user_id": user_id,
                "transcript": transcript,
                "detected_emotion": detected_emotion,
                "ai_response": ai_response,
            },
        )

    async def get_recent_conversations(
        self,
        user_id: str,
        limit: int = 5,
    ) -> list[dict]:
        """Return the most recent conversation memories for a user."""
        return await self._data_service.select_rows(
            "conversation_memories",
            eq_filters={"user_id": user_id},
            order_by="created_at",
            desc=True,
            limit=limit,
        )
