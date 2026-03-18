"""Compatibility shim for the retired SQLAlchemy session layer."""

from __future__ import annotations

from collections.abc import AsyncGenerator

from backend.utils.errors import DatabaseOperationError

engine = None
AsyncSessionLocal = None


async def get_session() -> AsyncGenerator[None, None]:
    """Direct database sessions are disabled in the Supabase REST integration."""
    raise DatabaseOperationError(
        "Direct database sessions are disabled.",
        details="Use the Supabase client service layer instead of SQLAlchemy sessions.",
    )
    yield None
