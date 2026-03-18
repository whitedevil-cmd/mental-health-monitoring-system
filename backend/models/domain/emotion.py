"""
Domain model for emotion readings.

This module defines how emotion data is stored in the database using
SQLAlchemy ORM. It is intentionally minimal and does not enforce complex
business rules.
"""

from datetime import datetime

from sqlalchemy import BigInteger, Column, DateTime, Float, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from backend.database.base import Base


class EmotionReading(Base):
    """
    ORM model representing a single emotion reading derived from audio.

    `emotion_label` could be values such as "happy", "sad", "anxious",
    etc. `confidence` represents the model confidence in [0.0, 1.0].
    """

    __tablename__ = "emotion_readings"

    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=False), ForeignKey("auth.users.id"), index=True, nullable=False)
    audio_id = Column(String(128), nullable=True)
    emotion_label = Column(String(32), nullable=False)
    confidence = Column(Float, nullable=True)
    transcript = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
