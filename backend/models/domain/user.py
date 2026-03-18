"""
Domain model for users of the system.

This is a minimal placeholder that can be extended with authentication
and profile information in the future.
"""

from datetime import datetime

from sqlalchemy import Column, DateTime, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from backend.database.base import Base


class User(Base):
    """Simple user model placeholder."""

    __tablename__ = "users"

    id = Column(UUID(as_uuid=False), ForeignKey("auth.users.id"), primary_key=True, index=True)
    external_id = Column(Text, unique=True, index=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

