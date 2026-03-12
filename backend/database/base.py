"""
SQLAlchemy ORM base model declaration.

All ORM models should inherit from `Base`. This centralizes metadata so
that tools like Alembic or custom migration scripts can discover models.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all ORM models in this project."""

"""
SQLAlchemy ORM base model declaration.

All ORM models should inherit from `Base`. This centralizes metadata so
that tools like Alembic or custom migration scripts can discover models.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all ORM models in this project."""

