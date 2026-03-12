"""
Database configuration helpers.

This module exposes utility functions for working with the database URL.
It serves as an abstraction layer above `utils.config` so other database
modules can stay focused on SQLAlchemy details.
"""

from backend.utils.config import get_settings


def get_database_url() -> str:
    """
    Return the database URL from settings.

    The default points to a local SQLite database; in production you can
    set DATABASE_URL to a managed Postgres/MySQL instance via env vars.
    """
    return get_settings().DATABASE_URL

