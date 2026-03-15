"""ORM model for stored emotion detection results.

The `emotion_logs` table is intended to capture the output of the
speech emotion recognition pipeline in a denormalized form for
analytics and auditing.
"""

from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String, Text

from backend.database.base import Base


class EmotionLog(Base):
    """
    Represents a single emotion detection event.

    - `timestamp` uses UTC and is set automatically.
    - Scores are stored for a fixed set of emotions; additional labels
      from the model can be handled separately if needed.
    """

    __tablename__ = "emotion_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    dominant_emotion = Column(String(32), nullable=False)

    sad_score = Column(Float, nullable=False, default=0.0)
    happy_score = Column(Float, nullable=False, default=0.0)
    angry_score = Column(Float, nullable=False, default=0.0)
    neutral_score = Column(Float, nullable=False, default=0.0)
    transcript = Column(Text, nullable=True)
