"""
Pydantic schemas for audio upload and metadata.

This module defines the minimal contracts used by audio-related APIs,
separate from persistence models or storage implementation details.
"""

from datetime import datetime

from pydantic import BaseModel


class AudioUploadResponse(BaseModel):
    """Response returned after a successful audio upload."""

    audio_id: str
    user_id: str
    stored_at: datetime

"""
Pydantic schemas for audio upload and metadata.

This module defines the minimal contracts used by audio-related APIs,
separate from persistence models or storage implementation details.
"""

from datetime import datetime

from pydantic import BaseModel


class AudioUploadResponse(BaseModel):
    """Response returned after a successful audio upload."""

    audio_id: str
    user_id: str
    stored_at: datetime

