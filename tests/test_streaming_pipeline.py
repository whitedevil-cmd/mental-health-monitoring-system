"""
Streaming pipeline readiness tests.
"""

from __future__ import annotations

import pytest

from backend.services import audio_pipeline
from backend.services.session_state import SessionState


class _DummyVAD:
    def __init__(self, is_speech: bool) -> None:
        self._is_speech = is_speech

    def is_speech(self, audio_chunk: bytes) -> bool:  # noqa: ARG002
        return self._is_speech


@pytest.mark.asyncio
async def test_process_audio_chunk_returns_emotion(monkeypatch) -> None:
    async def fake_process(audio_path, resolved, *, audio_detector=None):  # noqa: ANN001
        return {
            "emotion": "happy",
            "transcript": "hello",
            "audio_scores": {"happy": 0.9},
            "text_scores": {"happy": 0.8},
            "combined_scores": {"happy": 0.85},
        }

    monkeypatch.setattr(audio_pipeline, "_process_audio_path_async", fake_process)
    monkeypatch.setattr(audio_pipeline, "get_vad_service", lambda: _DummyVAD(True))

    result = await audio_pipeline.process_audio_chunk(b"RIFF\x00\x00\x00\x00WAVE")
    assert result["emotion"] == "happy"
    assert "transcript" in result
    assert "audio_scores" in result
    assert "text_scores" in result
    assert "combined_scores" in result


@pytest.mark.asyncio
async def test_vad_silence_skips_pipeline(monkeypatch) -> None:
    async def fail(*_args, **_kwargs):  # noqa: ANN001
        raise AssertionError("Pipeline should not run when VAD detects silence")

    monkeypatch.setattr(audio_pipeline, "_process_audio_path_async", fail)
    monkeypatch.setattr(audio_pipeline, "get_vad_service", lambda: _DummyVAD(False))

    result = await audio_pipeline.process_audio_chunk(b"RIFF\x00\x00\x00\x00WAVE")
    assert result == {"status": "skipped", "reason": "silence"}


def test_session_state_tracks_emotions() -> None:
    state = SessionState(session_id="session-1")
    state.emotion_history.append("calm")
    state.emotion_history.append("stressed")

    assert state.session_id == "session-1"
    assert state.emotion_history == ["calm", "stressed"]


def test_voice_stream_websocket_accepts_connection(client) -> None:
    with client.websocket_connect("/api/v1/voice-stream") as websocket:
        message = websocket.receive_json()
        assert message["status"] == "ok"
        assert "voice stream" in message["message"]
