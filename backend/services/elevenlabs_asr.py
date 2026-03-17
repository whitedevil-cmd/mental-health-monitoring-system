"""ElevenLabs Speech-to-Text integration (Realtime SDK)."""

from __future__ import annotations
from elevenlabs.realtime import AudioFormat
import asyncio
import queue
import threading
from dataclasses import dataclass
import io
import logging
from typing import Any, Callable
from urllib.parse import urlparse

import librosa
import numpy as np
import soundfile as sf
try:
    import webrtcvad  # type: ignore
    _WEBRTCVAD_AVAILABLE = True
except Exception:  # pragma: no cover - optional dependency on Windows
    webrtcvad = None  # type: ignore
    _WEBRTCVAD_AVAILABLE = False

from elevenlabs import ElevenLabs, RealtimeEvents

from backend.utils.config import get_settings
from backend.utils.errors import AudioProcessingError

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ElevenLabsASRConfig:
    """Configuration for ElevenLabs realtime STT."""

    api_key: str | None
    stt_url: str
    model_id: str
    timeout_seconds: float


def _get_config() -> ElevenLabsASRConfig:
    settings = get_settings()
    logger.info(
        "ElevenLabs config: api_key=%s stt_url_set=%s model_id=%s",
        "set" if settings.ELEVENLABS_API_KEY else "missing",
        "set" if settings.ELEVENLABS_STT_URL else "missing",
        settings.ELEVENLABS_STT_MODEL_ID,
    )
    return ElevenLabsASRConfig(
        api_key=settings.ELEVENLABS_API_KEY,
        stt_url=settings.ELEVENLABS_STT_URL,
        model_id=settings.ELEVENLABS_STT_MODEL_ID,
        timeout_seconds=float(settings.ELEVENLABS_TIMEOUT_SECONDS),
    )


def _decode_audio_to_pcm16(audio_bytes: bytes, *, target_sr: int = 16000) -> tuple[bytes, int]:
    """Decode WAV bytes into 16-bit PCM mono at target sample rate."""
    if not audio_bytes:
        raise AudioProcessingError("Audio processing failed.", details="Empty audio input.")

    try:
        audio, sr = sf.read(io.BytesIO(audio_bytes), always_2d=False)
    except Exception as exc:
        logger.exception("Failed to decode audio bytes: %s", exc)
        raise AudioProcessingError("Invalid audio format.", details="Unable to decode WAV audio.") from exc

    if isinstance(audio, np.ndarray) and audio.ndim == 2:
        audio = audio.mean(axis=1)

    audio = np.asarray(audio, dtype=np.float32)
    if sr != target_sr and audio.size:
        audio = librosa.resample(audio, orig_sr=sr, target_sr=target_sr)
        sr = target_sr

    audio = np.clip(audio, -1.0, 1.0)
    pcm16 = (audio * 32767.0).astype(np.int16)
    return pcm16.tobytes(), int(sr)


def _pcm_frames(pcm_bytes: bytes, *, sample_rate: int, frame_ms: int = 20) -> list[bytes]:
    frame_size = int(sample_rate * 2 * frame_ms / 1000)
    return [pcm_bytes[i:i + frame_size] for i in range(0, len(pcm_bytes), frame_size) if len(pcm_bytes[i:i + frame_size]) == frame_size]


class WebRtcVadGate:
    """Simple VAD gate to skip silent chunks and detect end-of-utterance."""

    def __init__(self, *, sample_rate: int = 16000, frame_ms: int = 20, silence_ms: int = 500) -> None:
        if not _WEBRTCVAD_AVAILABLE:
            logger.warning("webrtcvad not available; VAD gating disabled.")
        self._vad = webrtcvad.Vad(2) if _WEBRTCVAD_AVAILABLE else None
        self._sample_rate = sample_rate
        self._frame_ms = frame_ms
        self._silence_ms = silence_ms
        self._silence_accum = 0
        self._had_speech = False

    def inspect(self, pcm_bytes: bytes) -> tuple[bool, bool]:
        """Return (should_send, should_commit)."""
        if not pcm_bytes:
            return False, False
        if not self._vad:
            return True, False

        has_speech = False
        for frame in _pcm_frames(pcm_bytes, sample_rate=self._sample_rate, frame_ms=self._frame_ms):
            if self._vad.is_speech(frame, self._sample_rate):
                has_speech = True
                break

        if has_speech:
            self._had_speech = True
            self._silence_accum = 0
            return True, False

        self._silence_accum += self._frame_ms * max(1, len(pcm_bytes) // int(self._sample_rate * 2 * self._frame_ms / 1000))
        should_commit = self._had_speech and self._silence_accum >= self._silence_ms
        if should_commit:
            self._had_speech = False
            self._silence_accum = 0
        return False, should_commit


def _dispatch_callback(callback: Callable[[dict[str, Any]], Any] | None, payload: dict[str, Any]) -> None:
    if callback is None:
        return
    try:
        result = callback(payload)
        if asyncio.iscoroutine(result):
            asyncio.create_task(result)
    except Exception as exc:  # pragma: no cover - callback safety net
        logger.exception("STT callback failed: %s", exc)


def normalize_audio_bytes(audio_bytes: bytes) -> tuple[bytes, int]:
    """Ensure audio is PCM16 mono 16kHz for ElevenLabs."""
    if audio_bytes[:4] == b"RIFF" and b"WAVE" in audio_bytes[:12]:
        return _decode_audio_to_pcm16(audio_bytes, target_sr=16000)
    # Assume already PCM16 mono 16kHz.
    return audio_bytes, 16000


def _derive_base_url(stt_url: str) -> str | None:
    """Derive an HTTPS base URL from the realtime websocket URL."""
    if not stt_url:
        return None
    parsed = urlparse(stt_url)
    if parsed.scheme in {"wss", "ws"}:
        scheme = "https" if parsed.scheme == "wss" else "http"
        return f"{scheme}://{parsed.netloc}"
    if parsed.scheme in {"https", "http"}:
        return f"{parsed.scheme}://{parsed.netloc}"
    return None


class ElevenLabsRealtimeSession:
    """Manage a realtime ElevenLabs STT session via the SDK."""

    def __init__(
        self,
        *,
        on_partial: Callable[[dict[str, Any]], Any] | None = None,
        on_committed: Callable[[dict[str, Any]], Any] | None = None,
        on_error: Callable[[dict[str, Any]], Any] | None = None,
        on_close: Callable[[], Any] | None = None,
    ) -> None:
        self._config = _get_config()
        base_url = _derive_base_url(self._config.stt_url)
        try:
            self._client = ElevenLabs(api_key=self._config.api_key, base_url=base_url) if base_url else ElevenLabs(api_key=self._config.api_key)
        except TypeError:
            self._client = ElevenLabs(api_key=self._config.api_key)
        self._connection: Any | None = None
        self._on_partial = on_partial
        self._on_committed = on_committed
        self._on_error = on_error
        self._on_close = on_close

    async def connect(self) -> None:
        """Open the realtime connection."""
        if not self._config.api_key:
            raise AudioProcessingError(
                "ASR configuration missing.",
                details="ELEVENLABS_API_KEY is not set.",
            )

        options: dict[str, Any] = {
            "model_id": self._config.model_id,
            "audio_format": AudioFormat.PCM_16000,
            "sample_rate":16000,
        }

        self._connection = await self._client.speech_to_text.realtime.connect(options)
        logger.info("STT session started")

        if hasattr(self._connection, "on"):
            self._connection.on(
                RealtimeEvents.SESSION_STARTED,
                lambda data: logger.info("STT session started: %s", data),
            )
            self._connection.on(
                RealtimeEvents.PARTIAL_TRANSCRIPT,
                lambda data: _dispatch_callback(self._on_partial, data),
            )
            self._connection.on(
                RealtimeEvents.COMMITTED_TRANSCRIPT,
                lambda data: _dispatch_callback(self._on_committed, data),
            )
            self._connection.on(
                RealtimeEvents.COMMITTED_TRANSCRIPT_WITH_TIMESTAMPS,
                lambda data: _dispatch_callback(self._on_committed, data),
            )
            self._connection.on(
                RealtimeEvents.ERROR,
                lambda error: _dispatch_callback(self._on_error, {"error": error}),
            )
            self._connection.on(
                RealtimeEvents.CLOSE,
                lambda: _dispatch_callback(self._on_close, {}),
            )

    async def send_audio(self, pcm_bytes: bytes) -> None:
        """Send PCM16 audio to ElevenLabs."""
        if not self._connection:
            raise AudioProcessingError(
                "ASR session not connected.",
                details="Realtime connection missing."
            )

        try:
            import base64

            audio_base64 = base64.b64encode(pcm_bytes).decode("utf-8")

            await self._connection.send({
                "audio_base_64": audio_base64,
                "sample_rate": 16000,
            })

        except Exception as exc:
            logger.exception("Failed to send audio chunk: %s", exc)
            raise AudioProcessingError(
                "ASR send failed.",
                details="ElevenLabs audio streaming error."
            ) from exc

    async def commit(self) -> None:
        """Force commit of the current utterance."""
        if not self._connection:
            return
        if hasattr(self._connection, "commit"):
            await self._connection.commit()
            return
        if hasattr(self._connection, "send_audio_chunk"):
            await self._connection.send_audio_chunk(b"", commit=True)
            return
        if hasattr(self._connection, "send_audio"):
            await self._connection.send_audio(b"", commit=True)
            return

    async def close(self) -> None:
        """Close the realtime connection."""
        if self._connection and hasattr(self._connection, "close"):
            await self._connection.close()
        logger.info("STT connection closed")


async def transcribe_audio_bytes(
    audio_bytes: bytes,
    *,
    language_code: str | None = None,
) -> str:
    """Stream audio bytes to ElevenLabs and return the committed transcript."""
    config = _get_config()
    transcript_parts: list[str] = []
    committed_event = asyncio.Event()

    def on_committed(data: dict[str, Any]) -> None:
        text = str(data.get("text", "")).strip()
        if text:
            transcript_parts.append(text)
        committed_event.set()
        logger.info("STT committed transcript")

    session = ElevenLabsRealtimeSession(on_committed=on_committed)
    await session.connect()

    pcm_bytes, _ = normalize_audio_bytes(audio_bytes)
    vad_gate = WebRtcVadGate(sample_rate=16000, frame_ms=20, silence_ms=500)
    chunk_size = 640 # ~1s @ 16kHz mono PCM16
    for i in range(0, len(pcm_bytes), chunk_size):
        chunk = pcm_bytes[i:i + chunk_size]
        should_send, should_commit = vad_gate.inspect(chunk)
        if should_send:
            await session.send_audio(chunk)
        if should_commit:
            await session.commit()

    await session.commit()

    try:
        await asyncio.wait_for(committed_event.wait(), timeout=config.timeout_seconds)
    except asyncio.TimeoutError as exc:
        raise AudioProcessingError(
            "ASR service timed out.",
            details="ElevenLabs realtime STT did not respond in time.",
            status_code=504,
        ) from exc
    finally:
        await session.close()

    transcript = " ".join(transcript_parts).strip()
    if not transcript:
        raise AudioProcessingError(
            "Empty transcript returned.",
            details="ElevenLabs returned an empty transcript.",
        )
    return transcript


def transcribe_audio_elevenlabs(audio_bytes: bytes, *, language_code: str | None = None) -> str:
    """Sync wrapper around realtime STT for pipeline usage."""
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(transcribe_audio_bytes(audio_bytes, language_code=language_code))

    result_queue: "queue.Queue[object]" = queue.Queue()

    def _runner() -> None:
        try:
            result = asyncio.run(transcribe_audio_bytes(audio_bytes, language_code=language_code))
        except Exception as exc:  # pragma: no cover - threading safety net
            result_queue.put(exc)
            return
        result_queue.put(result)

    thread = threading.Thread(target=_runner, daemon=True)
    thread.start()
    outcome = result_queue.get()
    if isinstance(outcome, Exception):
        raise outcome
    return str(outcome)
