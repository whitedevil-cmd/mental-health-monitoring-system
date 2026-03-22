"""Realtime assistant routes for streaming Groq text and ElevenLabs TTS."""

from __future__ import annotations

import json
from typing import AsyncIterator, Literal

from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.services.elevenlabs_tts_service import ElevenLabsTtsService
from backend.services.groq_stream_service import GroqStreamService

router = APIRouter(prefix="/assistant", tags=["assistant"])


class AssistantMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(..., min_length=1)


class AssistantStreamRequest(BaseModel):
    messages: list[AssistantMessage] = Field(..., min_length=1)
    user_id: str | None = None


class TtsSynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1)
    previous_text: str | None = None
    next_text: str | None = None


def get_groq_stream_service() -> GroqStreamService:
    return GroqStreamService()


def get_tts_service() -> ElevenLabsTtsService:
    return ElevenLabsTtsService()


@router.post(
    "/stream",
    status_code=status.HTTP_200_OK,
)
async def stream_assistant_response(
    payload: AssistantStreamRequest,
    service: GroqStreamService = Depends(get_groq_stream_service),
) -> StreamingResponse:
    async def event_stream() -> AsyncIterator[bytes]:
        async for token in service.stream_chat(
            messages=[message.model_dump() for message in payload.messages],
            user_id=payload.user_id,
        ):
            yield (json.dumps({"type": "token", "text": token}) + "\n").encode("utf-8")

        yield b'{"type":"done"}\n'

    return StreamingResponse(
        event_stream(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-store",
            "X-Accel-Buffering": "no",
        },
    )


@router.post(
    "/tts",
    status_code=status.HTTP_200_OK,
)
async def synthesize_assistant_audio(
    payload: TtsSynthesizeRequest,
    service: ElevenLabsTtsService = Depends(get_tts_service),
) -> StreamingResponse:
    audio = await service.synthesize(
        text=payload.text,
        previous_text=payload.previous_text,
        next_text=payload.next_text,
    )

    return StreamingResponse(
        iter([audio]),
        media_type="audio/mpeg",
        headers={"Cache-Control": "no-store"},
    )
