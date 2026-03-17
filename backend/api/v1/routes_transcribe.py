"""Realtime transcription WebSocket endpoint."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.services.elevenlabs_asr import (
    ElevenLabsRealtimeSession,
    WebRtcVadGate,
    normalize_audio_bytes,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def _safe_schedule_send(websocket: WebSocket, payload: dict[str, Any]) -> None:
    """Schedule a JSON send without blocking callbacks."""
    asyncio.create_task(websocket.send_json(payload))


@router.websocket("/ws/transcribe")
async def transcribe_ws(websocket: WebSocket) -> None:
    """Stream microphone audio to ElevenLabs and return partial/final transcripts."""
    await websocket.accept()

    vad_gate = WebRtcVadGate(sample_rate=16000, frame_ms=20, silence_ms=500)

    def on_partial(data: dict[str, Any]) -> None:
        text = str(data.get("text", "")).strip()
        if text:
            logger.info("STT partial transcript")
            _safe_schedule_send(websocket, {"type": "partial", "text": text})

    def on_committed(data: dict[str, Any]) -> None:
        text = str(data.get("text", "")).strip()
        if text:
            logger.info("STT committed transcript")
            _safe_schedule_send(websocket, {"type": "final", "text": text})

    def on_error(payload: dict[str, Any]) -> None:
        logger.error("STT error: %s", payload)
        _safe_schedule_send(websocket, {"type": "error", "message": "stt_error", "details": payload})

    def on_close(_: dict[str, Any]) -> None:
        logger.info("STT connection closed")

    session = ElevenLabsRealtimeSession(
        on_partial=on_partial,
        on_committed=on_committed,
        on_error=on_error,
        on_close=lambda: on_close({}),
    )

    try:
        await session.connect()
        while True:
            try:
                message = await websocket.receive()
            except RuntimeError as exc:
                if "disconnect" in str(exc).lower():
                    return
                raise

            if "bytes" in message and message["bytes"] is not None:
                pcm_bytes, _ = normalize_audio_bytes(message["bytes"])
                should_send, should_commit = vad_gate.inspect(pcm_bytes)
                if should_send:
                    await session.send_audio(pcm_bytes)
                if should_commit:
                    await session.commit()
                continue

            if "text" in message and message["text"] is not None:
                if message["text"] == "ping":
                    await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        return
    except Exception as exc:  # pragma: no cover - safety net
        logger.exception("Transcribe websocket failed: %s", exc)
        _safe_schedule_send(websocket, {"type": "error", "message": "ws_error", "details": str(exc)})
    finally:
        await session.close()
