"""
Domain model for stored audio recordings.

This model keeps metadata about uploaded audio files so that they can be
linked to emotion readings and retrieved or re-processed later.
"""

from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from backend.database.base import Base


class AudioRecording(Base):
    """ORM model representing a stored user audio recording."""

    __tablename__ = "audio_recordings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(64), index=True, nullable=False)
    file_path = Column(String(512), nullable=False)
    mime_type = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


