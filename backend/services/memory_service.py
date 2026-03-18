"""Conversation memory helpers for recent emotional context."""

from __future__ import annotations

import logging

from backend.database.repositories.conversation_repository import ConversationRepository
from backend.database.repositories.emotion_repository import EmotionRepository
from backend.utils.errors import DatabaseOperationError

logger = logging.getLogger(__name__)


class MemoryService:
    """Build and persist lightweight user memory context."""

    async def get_user_context(self, user_id: str) -> str:
        """Return a compact summary of recent conversations for a user."""
        repo = ConversationRepository()
        try:
            conversations = await repo.get_recent_conversations(user_id, limit=5)
        except DatabaseOperationError as exc:
            logger.warning("Could not load conversation memory for user %s: %s", user_id, exc)
            return ""

        if not conversations:
            return ""

        lines: list[str] = []
        for conversation in reversed(conversations):
            transcript = (conversation.get("transcript") or "").strip() or "No transcript available"
            lines.append(f'User said: "{transcript}"')
            lines.append(f"Emotion: {conversation.get('detected_emotion', 'unknown')}")
        return "\n".join(lines)

    async def add_conversation(
        self,
        *,
        user_id: str,
        detected_emotion: str,
        ai_response: str,
    ) -> None:
        """Persist the latest conversation using the newest saved transcript when possible."""
        transcript: str | None = None
        emotion_repo = EmotionRepository()
        try:
            readings = await emotion_repo.list_readings_for_user(user_id)
            if readings:
                transcript = readings[-1].get("transcript")
        except DatabaseOperationError as exc:
            logger.warning("Could not load latest transcript for user %s: %s", user_id, exc)

        conversation_repo = ConversationRepository()
        try:
            await conversation_repo.add_conversation(
                user_id=user_id,
                transcript=transcript,
                detected_emotion=detected_emotion,
                ai_response=ai_response,
            )
        except DatabaseOperationError as exc:
            logger.warning("Could not persist conversation memory for user %s: %s", user_id, exc)
