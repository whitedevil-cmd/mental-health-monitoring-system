"""WebSocket route for streaming voice chunks."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.services.audio_pipeline import process_audio_chunk_streaming
from backend.services.support_generator import SupportGeneratorService

router = APIRouter(prefix="/voice-stream", tags=["voice-stream"])
logger = logging.getLogger(__name__)

BYTES_PER_SECOND_16K_MONO_PCM = 16000 * 2  # 16kHz * 16-bit mono
BUFFER_MIN_BYTES = int(BYTES_PER_SECOND_16K_MONO_PCM * 1.0)
BUFFER_MAX_BYTES = int(BYTES_PER_SECOND_16K_MONO_PCM * 2.0)


def _trend_summary_from_confidence(emotion: str, confidence: float | None) -> str:
    """Derive a lightweight trend summary from confidence."""
    normalized = emotion.strip().lower() or "neutral"
    if confidence is None:
        return f"mixed pattern with recent {normalized}"
    if confidence >= 0.7:
        return f"mostly {normalized}"
    if confidence >= 0.5:
        return f"recent {normalized}"
    return f"mixed pattern with recent {normalized}"


async def _safe_send_json(websocket: WebSocket, payload: dict[str, Any]) -> None:
    """Send JSON payloads over the socket, logging failures."""
    try:
        await websocket.send_json(payload)
    except Exception as exc:  # pragma: no cover - transport errors
        logger.exception("Failed sending WebSocket payload: %s", exc)


async def _build_final_response(
    result: dict[str, object],
    support_service: SupportGeneratorService,
) -> dict[str, object]:
    """Generate the final response payload with LLM support."""
    emotion = str(result.get("emotion", "")).strip() or "neutral"
    probabilities = result.get("combined_scores") or {}
    confidence = float(probabilities.get(emotion, 0.0)) if isinstance(probabilities, dict) else 0.0
    transcript = str(result.get("transcript", "")).strip()

    trend_summary = _trend_summary_from_confidence(emotion, confidence)
    response_message = await asyncio.to_thread(
        support_service.generate_support_message,
        current_emotion=emotion,
        trend_summary=trend_summary,
        memory_context=None,
    )

    return {
        "type": "final_result",
        "transcript": transcript,
        "emotion": emotion,
        "response": response_message,
        "confidence": confidence,
        "probabilities": probabilities,
    }


@router.websocket("")
async def voice_stream(websocket: WebSocket) -> None:
    """Accept a WebSocket connection and process audio chunks."""
    await websocket.accept()
    await _safe_send_json(websocket, {"status": "ok", "message": "voice stream connected"})

    support_service = SupportGeneratorService()
    buffer = bytearray()

    try:
        while True:
            try:
                message = await websocket.receive()
            except RuntimeError as exc:
                if "disconnect" in str(exc).lower():
                    return
                raise

            if "bytes" in message and message["bytes"] is not None:
                buffer.extend(message["bytes"])
                if len(buffer) < BUFFER_MIN_BYTES:
                    continue

                if len(buffer) > BUFFER_MAX_BYTES:
                    logger.warning(
                        "Voice stream buffer exceeded max (%s bytes). Truncating.",
                        BUFFER_MAX_BYTES,
                    )
                    buffer = buffer[-BUFFER_MAX_BYTES:]

                audio_bytes = bytes(buffer)
                buffer.clear()

                try:
                    result = await process_audio_chunk_streaming(audio_bytes)
                except Exception as exc:  # pragma: no cover - safety net
                    logger.exception("Streaming pipeline failed: %s", exc)
                    await _safe_send_json(
                        websocket,
                        {"type": "error", "message": "Streaming pipeline failed", "details": str(exc)},
                    )
                    continue

                if result.get("status") == "skipped":
                    await _safe_send_json(
                        websocket,
                        {"type": "partial_transcript", "text": ""},
                    )
                    continue
                if result.get("status") == "error":
                    await _safe_send_json(
                        websocket,
                        {
                            "type": "error",
                            "message": result.get("message", "Processing failed"),
                            "details": result.get("details"),
                        },
                    )
                    continue

                transcript = str(result.get("transcript", "")).strip()
                await _safe_send_json(
                    websocket,
                    {"type": "partial_transcript", "text": transcript},
                )

                final_payload = await _build_final_response(result, support_service)
                await _safe_send_json(websocket, final_payload)
                continue

            if "text" in message and message["text"] is not None:
                text = message["text"]
                if text == "ping":
                    await _safe_send_json(websocket, {"status": "ok", "message": "pong"})
                    continue

                try:
                    payload = json.loads(text)
                except json.JSONDecodeError:
                    await _safe_send_json(
                        websocket,
                        {"type": "error", "message": "Malformed message", "details": "Invalid JSON payload."},
                    )
                    continue

                if payload.get("type") == "flush":
                    if not buffer:
                        await _safe_send_json(
                            websocket,
                            {"type": "partial_transcript", "text": ""},
                        )
                        continue

                    audio_bytes = bytes(buffer)
                    buffer.clear()
                    try:
                        result = await process_audio_chunk_streaming(audio_bytes)
                    except Exception as exc:  # pragma: no cover
                        logger.exception("Streaming pipeline failed: %s", exc)
                        await _safe_send_json(
                            websocket,
                            {"type": "error", "message": "Streaming pipeline failed", "details": str(exc)},
                        )
                        continue

                    transcript = str(result.get("transcript", "")).strip()
                    await _safe_send_json(
                        websocket,
                        {"type": "partial_transcript", "text": transcript},
                    )
                    final_payload = await _build_final_response(result, support_service)
                    await _safe_send_json(websocket, final_payload)
    except WebSocketDisconnect:
        return
    except Exception as exc:  # pragma: no cover - outer safety net
        logger.exception("Voice stream handler crashed: %s", exc)
        await _safe_send_json(
            websocket,
            {"type": "error", "message": "Voice stream crashed", "details": str(exc)},
        )
