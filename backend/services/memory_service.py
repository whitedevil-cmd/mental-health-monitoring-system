"""Conversation memory helpers for recent emotional context."""

from __future__ import annotations

import logging

from sqlalchemy.exc import SQLAlchemyError

from backend.database.repositories.conversation_repository import ConversationRepository
from backend.database.repositories.emotion_repository import EmotionRepository
from backend.database.session import AsyncSessionLocal

logger = logging.getLogger(__name__)


class MemoryService:
    """Build and persist lightweight user memory context."""

    async def get_user_context(self, user_id: str) -> str:
        """Return a compact summary of recent conversations for a user."""
        async with AsyncSessionLocal() as session:
            repo = ConversationRepository(session)
            try:
                conversations = await repo.get_recent_conversations(user_id, limit=5)
            except SQLAlchemyError as exc:
                logger.warning("Could not load conversation memory for user %s: %s", user_id, exc)
                return ""

        if not conversations:
            return ""

        # Reverse to oldest->newest so prompts read naturally.
        lines: list[str] = []
        for conversation in reversed(conversations):
            transcript = (conversation.transcript or "").strip() or "No transcript available"
            lines.append(f'User said: "{transcript}"')
            lines.append(f"Emotion: {conversation.detected_emotion}")
        return "\n".join(lines)

    async def add_conversation(
        self,
        *,
        user_id: str,
        detected_emotion: str,
        ai_response: str,
    ) -> None:
        """Persist the latest conversation using the newest saved transcript when possible."""
        async with AsyncSessionLocal() as session:
            transcript: str | None = None
            emotion_repo = EmotionRepository(session)
            try:
                readings = await emotion_repo.list_readings_for_user(user_id)
                if readings:
                    transcript = readings[-1].transcript
            except SQLAlchemyError as exc:
                logger.warning("Could not load latest transcript for user %s: %s", user_id, exc)

            conversation_repo = ConversationRepository(session)
            try:
                await conversation_repo.add_conversation(
                    user_id=user_id,
                    transcript=transcript,
                    detected_emotion=detected_emotion,
                    ai_response=ai_response,
                )
            except SQLAlchemyError as exc:
                logger.warning("Could not persist conversation memory for user %s: %s", user_id, exc)
