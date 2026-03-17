"""
Tests for configuration utilities.

These tests validate that environment variables are correctly loaded
into the Settings object and that defaults behave as expected.
"""

import os

from backend.utils.config import Settings, get_settings


def test_settings_defaults(monkeypatch):
    """Settings should expose sensible default values."""
    monkeypatch.delenv("DATABASE_URL", raising=False)
    settings = Settings(_env_file=None)
    assert settings.APP_NAME
    assert settings.ENVIRONMENT == "development"
    assert settings.DATABASE_URL.startswith("sqlite+aiosqlite:///")


def test_get_settings_cached_and_uses_env(monkeypatch):
    """
    get_settings should respect environment variables on first load and
    return a cached instance on subsequent calls.
    """
    get_settings.cache_clear()
    monkeypatch.setenv("APP_NAME", "Test App")

    settings = Settings(_env_file=None)
    assert settings.APP_NAME == "Test App"

    cached = get_settings()
    assert cached.APP_NAME
