"""WebSocket placeholder route for future voice streaming."""

from __future__ import annotations

from fastapi import APIRouter, WebSocket

router = APIRouter(prefix="/voice-stream", tags=["voice-stream"])


@router.websocket("")
async def voice_stream(websocket: WebSocket) -> None:
    """Accept a WebSocket connection and return a test message."""
    await websocket.accept()
    await websocket.send_json({"status": "ok", "message": "voice stream connected"})
    await websocket.close()
