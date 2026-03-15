"""Session state container for future real-time voice streaming."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True)
class SessionState:
    """In-memory session state for streaming audio sessions."""

    session_id: str
    recent_audio_chunks: list[bytes] = field(default_factory=list)
    emotion_history: list[str] = field(default_factory=list)
    transcript_buffer: list[str] = field(default_factory=list)
