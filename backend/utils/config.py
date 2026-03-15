"""
Configuration utilities for the backend.

This module centralizes environment-based configuration using Pydantic.
All other modules should import settings from here instead of reading
environment variables directly.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Core app settings
    APP_NAME: str = "AI Mental Health Monitoring API"
    ENVIRONMENT: str = "development"  # e.g. "development" | "staging" | "production"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./backend.db"

    # Security (placeholder; extend later)
    API_KEY: str | None = None

    # Audio storage
    AUDIO_STORAGE_DIR: str = "backend/audio_storage/data"

    # Logging
    LOG_LEVEL: str = "info"

    # LLM / Emotion model
    MODEL_NAME: str = "superb/wav2vec2-base-superb-er"
    LLM_PROVIDER: str | None = None
    LLM_API_KEY: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """
    Return a cached Settings instance.

    Using a cached settings object avoids repeatedly reading environment
    variables or .env files on every import.
    """
    return Settings()

