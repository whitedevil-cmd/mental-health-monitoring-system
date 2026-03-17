"""
Domain model for users of the system.

This is a minimal placeholder that can be extended with authentication
and profile information in the future.
"""

from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from backend.database.base import Base


class User(Base):
    """Simple user model placeholder."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(String(64), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

