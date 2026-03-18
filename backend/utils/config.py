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

    # Legacy direct database URL (deprecated in favor of Supabase REST)
    DATABASE_URL: str = "sqlite+aiosqlite:///./backend.db"

    # Supabase
    SUPABASE_URL: str | None = None
    SUPABASE_SERVICE_ROLE_KEY: str | None = None
    SUPABASE_DEBUG_USER_ID: str | None = None

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

    # ElevenLabs Speech-to-Text
    ELEVENLABS_API_KEY: str | None = None
    ELEVENLABS_STT_URL: str = "wss://api.elevenlabs.io/v1/speech-to-text/realtime"
    ELEVENLABS_STT_MODEL_ID: str = "scribe_v2_realtime"
    ELEVENLABS_TIMEOUT_SECONDS: float = 15.0

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

