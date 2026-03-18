"""
Database configuration helpers.

This module exposes utility functions for working with the database URL.
It serves as an abstraction layer above `utils.config` so other database
modules can stay focused on SQLAlchemy details.
"""

from backend.utils.config import get_settings


def _normalize_database_url(url: str) -> str:
    """
    Normalize database URLs for async SQLAlchemy engines.

    Supabase provides PostgreSQL URLs in the form "postgresql://..." (or
    "postgres://..."). SQLAlchemy async engines expect an async driver
    such as "postgresql+asyncpg://...".
    """
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    if url.startswith("postgresql://") and "+asyncpg" not in url:
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


def get_database_url() -> str:
    """
    Return the database URL from settings.

    The default points to a local SQLite database; in production you can
    set DATABASE_URL to a managed Postgres/MySQL instance via env vars.
    """
    return _normalize_database_url(get_settings().DATABASE_URL)


