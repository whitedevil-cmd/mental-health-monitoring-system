"""Pydantic schemas for audio upload and metadata."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class AudioUploadResponse(BaseModel):
    """Response returned after a successful audio upload."""

    audio_id: str
    user_id: str
    stored_at: datetime
