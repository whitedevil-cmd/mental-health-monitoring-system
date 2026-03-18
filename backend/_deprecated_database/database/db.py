"""Compatibility shims for the retired direct database utilities."""

from __future__ import annotations

from collections.abc import AsyncGenerator

from backend.utils.errors import DatabaseOperationError


async def init_db() -> None:
    """Direct schema initialization is disabled under Supabase REST mode."""
    raise DatabaseOperationError(
        "Direct database initialization is disabled.",
        details="Use Supabase-managed schema and the REST client layer instead.",
    )


async def get_db_session() -> AsyncGenerator[None, None]:
    """Direct database sessions are disabled."""
    raise DatabaseOperationError(
        "Direct database sessions are disabled.",
        details="Use the Supabase client service layer instead of SQLAlchemy sessions.",
    )
    yield None

