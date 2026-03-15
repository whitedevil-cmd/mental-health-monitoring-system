"""
SQLAlchemy ORM base model declaration.

All ORM models should inherit from `Base`. This centralizes metadata so
that tools like Alembic or custom migration scripts can discover models.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all ORM models in this project."""


# Import ORM models so they are registered on Base.metadata.
# These imports are intentionally placed at the bottom to avoid
# circular import issues.
try:  # pragma: no cover - import side effects only
    from backend.models.domain import audio, conversation, emotion, user  # noqa: F401
    from backend.models import emotion_log  # noqa: F401
except Exception:
    # During certain tooling or partial import scenarios, models may not
    # be importable; this is non-fatal for most operations.
    pass
