"""Lazy Supabase client accessors for the storage layer."""

from __future__ import annotations

from functools import lru_cache

from dotenv import load_dotenv
from supabase import Client, create_client

from backend.utils.config import get_settings
from backend.utils.errors import DatabaseOperationError

load_dotenv()


def _resolve_supabase_config() -> tuple[str | None, str | None]:
    settings = get_settings()
    return settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY


def has_supabase_config() -> bool:
    url, key = _resolve_supabase_config()
    return bool(url and key)


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    url, key = _resolve_supabase_config()
    if not url or not key:
        raise DatabaseOperationError(
            "Supabase configuration missing.",
            details="Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY).",
            status_code=500,
        )
    return create_client(url, key)

