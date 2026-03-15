"""Repository for persisted conversation memory."""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.domain.conversation import ConversationMemory


class ConversationRepository:
    """Data access layer for therapist conversation memory."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add_conversation(
        self,
        *,
        user_id: str,
        transcript: str | None,
        detected_emotion: str,
        ai_response: str,
    ) -> ConversationMemory:
        """Persist a new conversation memory row."""
        conversation = ConversationMemory(
            user_id=user_id,
            transcript=transcript,
            detected_emotion=detected_emotion,
            ai_response=ai_response,
        )
        self._session.add(conversation)
        try:
            await self._session.commit()
            await self._session.refresh(conversation)
        except SQLAlchemyError:
            await self._session.rollback()
            raise
        return conversation

    async def get_recent_conversations(
        self,
        user_id: str,
        limit: int = 5,
    ) -> Sequence[ConversationMemory]:
        """Return the most recent conversation memories for a user."""
        result = await self._session.execute(
            select(ConversationMemory)
            .where(ConversationMemory.user_id == user_id)
            .order_by(ConversationMemory.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()
