"""Centralized audio processing pipeline for multimodal emotion analysis."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
import uuid

from backend.services.audio_service import AudioService
from backend.services.emotion_detector import detect_emotion as default_detect_emotion
from backend.services.emotion_fusion import fuse_emotions
from backend.services.elevenlabs_asr import transcribe_audio_elevenlabs
from backend.services.text_emotion_detector import get_text_emotion_detector
from backend.services.vad_service import get_vad_service
from backend.utils.errors import (
    AudioProcessingError,
    AudioValidationError,
    EmotionDetectionError,
    ResourceNotFoundError,
)

logger = logging.getLogger(__name__)


def _resolve_audio_path(audio_path: str) -> Path:
    """Resolve a relative audio path into the stored audio location."""
    path = Path(audio_path)
    if path.is_absolute():
        resolved = path.resolve()
        allowed_root = (Path("backend") / "audio_storage").resolve()
        if allowed_root not in resolved.parents and resolved != allowed_root:
            raise AudioValidationError(
                "Invalid audio_path.",
                details="Audio path must stay inside backend/audio_storage.",
            )
        return resolved
    return AudioService().resolve_uploaded_audio_path(audio_path)


def _detect_audio_scores(
    audio_path: str,
    resolved: Path,
    *,
    audio_detector=default_detect_emotion,
) -> dict[str, float]:
    """Run tone emotion detection with consistent error handling."""
    logger.info("Emotion detection start for %s", audio_path)
    try:
        audio_scores = audio_detector(resolved)
    except FileNotFoundError as exc:
        logger.exception("Audio file missing during detection: %s", audio_path)
        raise ResourceNotFoundError("Audio file not found.", details="The referenced audio file does not exist.") from exc
    except ValueError as exc:
        logger.exception("Audio processing failed for %s: %s", audio_path, exc)
        raise AudioProcessingError(str(exc), details="Audio processing error.") from exc
    except EmotionDetectionError:
        raise
    except Exception as exc:  # pragma: no cover - safety net
        logger.exception("Emotion detection failed for %s: %s", audio_path, exc)
        raise EmotionDetectionError(details="Model inference error.") from exc

    if not audio_scores:
        raise EmotionDetectionError("Emotion detection returned no scores.", details="Model inference error.")

    return audio_scores


def _safe_transcribe(audio_path: str, resolved: Path) -> str:
    """Transcribe audio via ElevenLabs STT with explicit error handling."""
    logger.info("Transcription start for %s", audio_path)
    try:
        audio_bytes = resolved.read_bytes()
    except OSError as exc:
        logger.exception("Failed reading audio for %s: %s", audio_path, exc)
        raise AudioProcessingError(
            "Audio processing failed.",
            details="Unable to read audio file.",
        ) from exc

    try:
        transcript = transcribe_audio_elevenlabs(audio_bytes)
    except AudioProcessingError as exc:
        logger.warning("ElevenLabs STT failed for %s: %s", audio_path, exc)
        raise
    except Exception as exc:  # pragma: no cover - environment/audio quality dependent
        logger.exception("Transcription failed for %s: %s", audio_path, exc)
        raise AudioProcessingError(
            "Transcription failed.",
            details="Unexpected ElevenLabs STT error.",
        ) from exc

    logger.info("Transcription completed for %s", audio_path)
    return transcript


def _process_audio_path_sync(
    audio_path: str,
    resolved: Path,
    *,
    audio_detector=default_detect_emotion,
) -> dict[str, object]:
    """Run the full audio pipeline synchronously for a resolved path."""
    audio_scores = _detect_audio_scores(audio_path, resolved, audio_detector=audio_detector)
    transcript = _safe_transcribe(audio_path, resolved)

    text_scores: dict[str, float] = {}
    if transcript.strip():
        try:
            text_scores = get_text_emotion_detector().detect(transcript)
        except Exception as exc:  # pragma: no cover - model/runtime dependent
            logger.exception("Text emotion detection failed for %s: %s", audio_path, exc)

    final_emotion, combined_scores = fuse_emotions(audio_scores, text_scores)
    if not combined_scores:
        raise EmotionDetectionError("Emotion detection returned no scores.", details="Model inference error.")

    logger.info("Emotion detection completed for %s", audio_path)
    return {
        "emotion": final_emotion,
        "transcript": transcript,
        "audio_scores": dict(audio_scores),
        "text_scores": dict(text_scores),
        "combined_scores": dict(combined_scores),
    }


async def _process_audio_path_async(
    audio_path: str,
    resolved: Path,
    *,
    audio_detector=default_detect_emotion,
) -> dict[str, object]:
    """Run the full audio pipeline asynchronously for a resolved path."""
    # Run ASR and emotion detection concurrently to minimize latency.
    audio_task = asyncio.to_thread(
        _detect_audio_scores,
        audio_path,
        resolved,
        audio_detector=audio_detector,
    )
    transcribe_task = asyncio.to_thread(_safe_transcribe, audio_path, resolved)

    audio_scores, transcript = await asyncio.gather(audio_task, transcribe_task)

    text_scores: dict[str, float] = {}
    if transcript.strip():
        try:
            text_scores = get_text_emotion_detector().detect(transcript)
        except Exception as exc:  # pragma: no cover - model/runtime dependent
            logger.exception("Text emotion detection failed for %s: %s", audio_path, exc)

    final_emotion, combined_scores = fuse_emotions(audio_scores, text_scores)
    if not combined_scores:
        raise EmotionDetectionError("Emotion detection returned no scores.", details="Model inference error.")

    logger.info("Emotion detection completed for %s", audio_path)
    return {
        "emotion": final_emotion,
        "transcript": transcript,
        "audio_scores": dict(audio_scores),
        "text_scores": dict(text_scores),
        "combined_scores": dict(combined_scores),
    }


def _process_audio_file_sync(
    audio_path: str,
    *,
    audio_detector=default_detect_emotion,
) -> dict[str, object]:
    """Run the full audio pipeline synchronously."""
    resolved = _resolve_audio_path(audio_path)
    if not resolved.exists() or not resolved.is_file():
        raise ResourceNotFoundError("Audio file not found.", details="The referenced audio file does not exist.")
    return _process_audio_path_sync(audio_path, resolved, audio_detector=audio_detector)


async def process_audio_file(
    audio_path: str,
    *,
    service: object | None = None,
) -> dict[str, object]:
    """Orchestrate audio detection, transcription, text analysis, and fusion."""
    try:
        if service is not None and hasattr(service, "detect_from_audio_path"):
            result = await asyncio.to_thread(service.detect_from_audio_path, audio_path)
            return {
                "emotion": result.dominant_emotion,
                "transcript": result.transcript,
                "audio_scores": dict(result.audio_scores),
                "text_scores": dict(result.text_scores),
                "combined_scores": dict(result.combined_scores),
            }

        resolved = _resolve_audio_path(audio_path)
        if not resolved.exists() or not resolved.is_file():
            raise ResourceNotFoundError("Audio file not found.", details="The referenced audio file does not exist.")

        return await _process_audio_path_async(audio_path, resolved, audio_detector=default_detect_emotion)
    except AudioValidationError:
        logger.exception("Audio pipeline failed for %s", audio_path)
        return {
            "status": "error",
            "message": "Emotion detection failed",
            "details": "Invalid audio path",
            "status_code": 400,
        }
    except AudioProcessingError as exc:
        logger.exception("Audio pipeline failed for %s: %s", audio_path, exc)
        return {
            "status": "error",
            "message": exc.message,
            "details": exc.details,
            "status_code": exc.status_code,
        }
    except Exception:
        logger.exception("Audio pipeline failed for %s", audio_path)
        return {
            "status": "error",
            "message": "Emotion detection failed",
            "details": "Processing error",
        }


async def process_audio_chunk(audio_bytes: bytes) -> dict[str, object]:
    """Process a raw audio chunk using the shared pipeline."""
    try:
        if not audio_bytes:
            raise AudioProcessingError("Audio processing failed.", details="Empty audio input.")

        try:
            vad = get_vad_service()
            if not vad.is_speech(audio_bytes):
                return {
                    "status": "skipped",
                    "reason": "silence",
                }
        except Exception:
            logger.exception("VAD failed; falling back to full processing")

        storage_dir = Path("backend") / "audio_storage"
        storage_dir.mkdir(parents=True, exist_ok=True)
        filename = f"chunk_{uuid.uuid4().hex}.wav"
        file_path = storage_dir / filename
        relative_path = f"audio_storage/{filename}"

        try:
            file_path.write_bytes(audio_bytes)
            return await _process_audio_path_async(relative_path, file_path, audio_detector=default_detect_emotion)
        finally:
            try:
                file_path.unlink(missing_ok=True)
            except Exception:  # pragma: no cover - cleanup safety net
                logger.warning("Failed to remove temporary audio chunk file: %s", file_path)
    except Exception:
        logger.exception("Audio chunk pipeline failed")
        return {
            "status": "error",
            "message": "Emotion detection failed",
            "details": "Processing error",
        }


async def process_audio_chunk_streaming(audio_bytes: bytes) -> dict[str, object]:
    """
    Process a raw audio chunk for streaming.

    Performs VAD, runs ASR + emotion detection concurrently, and returns
    a payload suitable for WebSocket responses.
    """
    try:
        if not audio_bytes:
            raise AudioProcessingError("Audio processing failed.", details="Empty audio input.")

        try:
            vad = get_vad_service()
            if not vad.is_speech(audio_bytes):
                return {
                    "status": "skipped",
                    "reason": "silence",
                }
        except Exception:
            logger.exception("VAD failed; falling back to full processing")

        storage_dir = Path("backend") / "audio_storage"
        storage_dir.mkdir(parents=True, exist_ok=True)
        filename = f"chunk_{uuid.uuid4().hex}.wav"
        file_path = storage_dir / filename
        relative_path = f"audio_storage/{filename}"

        try:
            file_path.write_bytes(audio_bytes)

            # Run ASR and emotion detection concurrently.
            audio_task = asyncio.to_thread(
                _detect_audio_scores,
                relative_path,
                file_path,
                audio_detector=default_detect_emotion,
            )
            asr_task = asyncio.to_thread(_safe_transcribe, relative_path, file_path)

            transcript, audio_scores = await asyncio.gather(asr_task, audio_task)

            text_scores: dict[str, float] = {}
            if transcript.strip():
                try:
                    text_scores = get_text_emotion_detector().detect(transcript)
                except Exception as exc:  # pragma: no cover
                    logger.exception("Text emotion detection failed for %s: %s", relative_path, exc)

            final_emotion, combined_scores = fuse_emotions(audio_scores, text_scores)
            if not combined_scores:
                raise EmotionDetectionError("Emotion detection returned no scores.", details="Model inference error.")

            return {
                "emotion": final_emotion,
                "transcript": transcript,
                "audio_scores": dict(audio_scores),
                "text_scores": dict(text_scores),
                "combined_scores": dict(combined_scores),
            }
        finally:
            try:
                file_path.unlink(missing_ok=True)
            except Exception:  # pragma: no cover - cleanup safety net
                logger.warning("Failed to remove temporary audio chunk file: %s", file_path)
    except AudioProcessingError as exc:
        logger.exception("Audio chunk pipeline failed: %s", exc)
        return {
            "status": "error",
            "message": exc.message,
            "details": exc.details,
        }
    except Exception:
        logger.exception("Audio chunk pipeline failed")
        return {
            "status": "error",
            "message": "Emotion detection failed",
            "details": "Processing error",
        }
