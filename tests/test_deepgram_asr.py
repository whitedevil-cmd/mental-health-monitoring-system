"""Unit tests for the Deepgram prerecorded STT wrapper."""

from __future__ import annotations

import pytest

from backend.services import deepgram_asr
from backend.utils.errors import AudioProcessingError


class _FakeMediaClient:
    def __init__(self, transcript: str) -> None:
        self.transcript = transcript
        self.calls: list[dict[str, object]] = []

    async def transcribe_file(self, **kwargs):  # noqa: ANN003
        self.calls.append(kwargs)
        return {
            "results": {
                "channels": [
                    {
                        "alternatives": [
                            {"transcript": self.transcript},
                        ]
                    }
                ]
            }
        }


class _FakeListenClient:
    def __init__(self, transcript: str) -> None:
        self.v1 = type("V1", (), {"media": _FakeMediaClient(transcript)})()


class _FakeDeepgramClient:
    def __init__(self, transcript: str) -> None:
        self.listen = _FakeListenClient(transcript)


@pytest.mark.asyncio
async def test_transcribe_audio_deepgram_uses_nova3_and_smart_format(monkeypatch) -> None:
    fake_client = _FakeDeepgramClient("hello from deepgram")

    monkeypatch.setattr(deepgram_asr, "get_deepgram_client", lambda: fake_client)

    transcript = await deepgram_asr.transcribe_audio_deepgram(b"RIFF\x00\x00\x00\x00WAVE")

    assert transcript == "hello from deepgram"
    calls = fake_client.listen.v1.media.calls
    assert len(calls) == 1
    assert calls[0]["request"] == b"RIFF\x00\x00\x00\x00WAVE"
    assert calls[0]["model"] == "nova-3"
    assert calls[0]["smart_format"] is True


@pytest.mark.asyncio
async def test_transcribe_audio_deepgram_rejects_empty_audio() -> None:
    with pytest.raises(AudioProcessingError) as exc_info:
        await deepgram_asr.transcribe_audio_deepgram(b"")

    assert exc_info.value.details == "Empty audio input."
