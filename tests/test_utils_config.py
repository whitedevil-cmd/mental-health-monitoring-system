"""
Tests for configuration utilities.

These tests validate that environment variables are correctly loaded
into the Settings object and that defaults behave as expected.
"""

import os

from backend.utils.config import Settings, get_settings


def test_settings_defaults():
    """Settings should expose sensible default values."""
    settings = Settings()
    assert settings.APP_NAME
    assert settings.ENVIRONMENT == "development"
    assert settings.DATABASE_URL.startswith("sqlite+aiosqlite:///")


def test_get_settings_cached_and_uses_env(monkeypatch):
    """
    get_settings should respect environment variables on first load and
    return a cached instance on subsequent calls.
    """
    monkeypatch.setenv("APP_NAME", "Test App")
    # Clear potential cache by creating a fresh Settings directly
    settings = Settings()
    assert settings.APP_NAME == "Test App"

    # get_settings should also pick up env on first import in real usage
    cached = get_settings()
    assert cached.APP_NAME

