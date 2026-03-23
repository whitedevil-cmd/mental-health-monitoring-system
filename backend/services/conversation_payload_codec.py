"""Helpers for encoding conversation metadata into existing storage fields."""

from __future__ import annotations

import json
from typing import Any


def encode_transcript_payload(
    *,
    text: str,
    session_id: str,
    confidence: float | None,
) -> str:
    return json.dumps(
        {
            "session_id": session_id,
            "text": text,
            "confidence": confidence,
        },
        separators=(",", ":"),
    )


def decode_transcript_payload(raw: str | None) -> dict[str, Any]:
    text = (raw or "").strip()
    if not text:
        return {"session_id": None, "text": "", "confidence": None}

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return {"session_id": None, "text": text, "confidence": None}

    if not isinstance(parsed, dict):
        return {"session_id": None, "text": text, "confidence": None}

    return {
        "session_id": parsed.get("session_id"),
        "text": str(parsed.get("text") or "").strip(),
        "confidence": parsed.get("confidence"),
    }
