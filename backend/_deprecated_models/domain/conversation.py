"""Domain model for persisted therapist conversation memory."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, Column, DateTime, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from backend._deprecated_database.database.base import Base


class ConversationMemory(Base):
    """Store recent user transcript and AI response pairs for memory."""

    __tablename__ = "conversation_memories"

    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=False), ForeignKey("auth.users.id"), index=True, nullable=False)
    transcript = Column(Text, nullable=True)
    detected_emotion = Column(String(32), nullable=False)
    ai_response = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

