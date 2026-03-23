"""Conversation history persistence and session grouping."""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta
import re
from typing import Any

from backend.models.schemas.conversation import (
    ConversationExchangeCreate,
    ConversationExchangeRead,
    ConversationSessionDetail,
    ConversationSessionSummary,
    ConversationTurn,
)
from backend.services.conversation_payload_codec import (
    decode_transcript_payload,
    encode_transcript_payload,
)
from backend.storage.repositories.conversation_repository import ConversationRepository
from backend.storage.repositories.emotion_repository import EmotionRepository

SESSION_GAP = timedelta(minutes=30)
TURN_MATCH_WINDOW = timedelta(minutes=3)


def _normalize_text(value: Any) -> str:
    return " ".join(str(value or "").split()).strip().casefold()


def _parse_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value

    normalized = str(value).strip()
    if not normalized:
        raise ValueError("Missing datetime value.")

    normalized = normalized.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        # Some persisted rows arrive with fractional seconds that need normalizing
        # before Python's ISO parser will accept them consistently.
        match = re.match(
            r"^(?P<prefix>\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})(?:\.(?P<fraction>\d+))?(?P<suffix>(?:[+-]\d{2}:\d{2})?)$",
            normalized,
        )
        if not match:
            raise

        prefix = match.group("prefix")
        fraction = (match.group("fraction") or "")[:6].ljust(6, "0")
        suffix = match.group("suffix") or ""
        repaired = f"{prefix}.{fraction}{suffix}" if fraction else f"{prefix}{suffix}"
        return datetime.fromisoformat(repaired)


class ConversationHistoryService:
    """Store and retrieve grouped conversation sessions."""

    def __init__(
        self,
        *,
        conversation_repo: ConversationRepository | None = None,
        emotion_repo: EmotionRepository | None = None,
    ) -> None:
        self._conversation_repo = conversation_repo or ConversationRepository()
        self._emotion_repo = emotion_repo or EmotionRepository()

    async def save_exchange(self, payload: ConversationExchangeCreate) -> ConversationExchangeRead:
        record = await self._conversation_repo.add_conversation(
            user_id=payload.user_id,
            transcript=encode_transcript_payload(
                text=payload.transcript,
                session_id=payload.session_id,
                confidence=payload.confidence,
            ),
            detected_emotion=payload.detected_emotion,
            ai_response=payload.ai_response,
        )
        decoded = decode_transcript_payload(record.get("transcript"))
        return ConversationExchangeRead(
            id=record.get("id"),
            user_id=str(record.get("user_id", payload.user_id)),
            session_id=str(decoded.get("session_id") or payload.session_id),
            transcript=decoded.get("text") or payload.transcript,
            detected_emotion=str(record.get("detected_emotion", payload.detected_emotion)),
            confidence=decoded.get("confidence"),
            ai_response=str(record.get("ai_response", payload.ai_response)),
            created_at=_parse_datetime(record.get("created_at")),
        )

    async def list_sessions(self, user_id: str) -> list[ConversationSessionSummary]:
        grouped = await self._load_grouped_sessions(user_id)
        return [
            ConversationSessionSummary(
                id=session["id"],
                started_at=session["started_at"],
                updated_at=session["updated_at"],
                dominant_emotion=session["dominant_emotion"],
                preview=session["preview"],
                turn_count=len(session["turns"]),
            )
            for session in grouped
        ]

    async def get_session(self, user_id: str, session_id: str) -> ConversationSessionDetail | None:
        grouped = await self._load_grouped_sessions(user_id)
        for session in grouped:
            if session["id"] == session_id:
                return ConversationSessionDetail(
                    id=session["id"],
                    started_at=session["started_at"],
                    updated_at=session["updated_at"],
                    dominant_emotion=session["dominant_emotion"],
                    preview=session["preview"],
                    turn_count=len(session["turns"]),
                    turns=session["turns"],
                )
        return None

    async def _load_grouped_sessions(self, user_id: str) -> list[dict[str, Any]]:
        conversations = await self._conversation_repo.list_conversations_for_user(user_id)
        readings = await self._emotion_repo.list_readings_for_user(user_id)
        if not conversations:
            return self._group_legacy_readings(readings)

        grouped = self._group_conversation_rows(conversations)
        return self._merge_legacy_readings(grouped, readings)

    def _group_conversation_rows(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        sessions: list[dict[str, Any]] = []
        current: dict[str, Any] | None = None
        last_created_at: datetime | None = None

        for row in rows:
            created_at = _parse_datetime(row.get("created_at"))
            decoded = decode_transcript_payload(row.get("transcript"))
            session_key = str(decoded.get("session_id") or "")
            row_id = str(row.get("id"))
            derived_session_id = session_key or f"legacy-{row_id}"

            should_start_new = False
            if current is None:
                should_start_new = True
            elif session_key and current["source_session_id"] != session_key:
                should_start_new = True
            elif not session_key and last_created_at and created_at - last_created_at > SESSION_GAP:
                should_start_new = True

            if should_start_new:
                current = {
                    "id": derived_session_id if session_key else f"session-{row_id}",
                    "source_session_id": session_key or None,
                    "started_at": created_at,
                    "updated_at": created_at,
                    "turns": [],
                    "emotions": [],
                    "preview": "",
                }
                sessions.append(current)

            user_text = decoded.get("text") or "No message captured."
            confidence = decoded.get("confidence")
            emotion = str(row.get("detected_emotion") or "").strip() or None
            ai_response = str(row.get("ai_response") or "").strip()

            current["turns"].append(
                ConversationTurn(
                    id=f"user-{row_id}",
                    role="user",
                    text=user_text,
                    timestamp=created_at,
                    emotion=emotion,
                    confidence=float(confidence) if confidence is not None else None,
                )
            )
            if ai_response:
                current["turns"].append(
                    ConversationTurn(
                        id=f"assistant-{row_id}",
                        role="assistant",
                        text=ai_response,
                        timestamp=created_at,
                    )
                )

            if emotion:
                current["emotions"].append(emotion)
            current["updated_at"] = created_at
            current["preview"] = ai_response or user_text
            last_created_at = created_at

        return [self._finalize_session(session) for session in reversed(sessions)]

    def _group_legacy_readings(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        sessions: list[dict[str, Any]] = []
        for row in reversed(rows):
            created_at = _parse_datetime(row.get("created_at") or row.get("timestamp"))
            emotion = str(row.get("emotion_label") or "").strip() or None
            transcript = str(row.get("transcript") or "").strip() or "No transcript available."
            row_id = str(row.get("id") or created_at.isoformat())
            session = {
                "id": f"legacy-reading-{row_id}",
                "source_session_id": None,
                "started_at": created_at,
                "updated_at": created_at,
                "preview": transcript,
                "emotions": [emotion] if emotion else [],
                "turns": [
                    ConversationTurn(
                        id=f"user-{row_id}",
                        role="user",
                        text=transcript,
                        timestamp=created_at,
                        emotion=emotion,
                        confidence=float(row.get("confidence") or 0.0),
                    )
                ],
            }
            sessions.append(self._finalize_session(session))
        return sessions

    def _merge_legacy_readings(
        self,
        sessions: list[dict[str, Any]],
        rows: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        if not rows:
            return sessions

        hydrated = [self._hydrate_session(session) for session in sessions]

        sorted_rows = sorted(
            rows,
            key=lambda row: _parse_datetime(row.get("created_at") or row.get("timestamp")),
        )

        for row in sorted_rows:
            created_at = _parse_datetime(row.get("created_at") or row.get("timestamp"))
            transcript = str(row.get("transcript") or "").strip() or "No transcript available."
            normalized_transcript = _normalize_text(transcript)
            emotion = str(row.get("emotion_label") or "").strip() or None
            confidence_raw = row.get("confidence")
            confidence = float(confidence_raw) if confidence_raw is not None else None
            row_id = str(row.get("id") or created_at.isoformat())

            matched = self._find_matching_user_turn(
                hydrated,
                normalized_transcript=normalized_transcript,
                created_at=created_at,
            )
            if matched is not None:
                matched_session, matched_turn = matched
                if emotion and not matched_turn.emotion:
                    matched_turn.emotion = emotion
                if confidence is not None and matched_turn.confidence is None:
                    matched_turn.confidence = confidence
                if created_at < matched_turn.timestamp:
                    matched_turn.timestamp = created_at
                    matched_session["started_at"] = min(matched_session["started_at"], created_at)
                matched_session["updated_at"] = max(
                    matched_session["updated_at"],
                    matched_turn.timestamp,
                )
                if emotion:
                    matched_session["emotions"].append(emotion)
                continue

            target_session = self._find_session_for_unmatched_reading(hydrated, created_at)
            if target_session is None:
                target_session = {
                    "id": f"legacy-reading-{row_id}",
                    "started_at": created_at,
                    "updated_at": created_at,
                    "preview": transcript,
                    "emotions": [emotion] if emotion else [],
                    "turns": [],
                }
                hydrated.append(target_session)

            target_session["turns"].append(
                ConversationTurn(
                    id=f"user-{row_id}",
                    role="user",
                    text=transcript,
                    timestamp=created_at,
                    emotion=emotion,
                    confidence=confidence,
                )
            )
            if emotion:
                target_session["emotions"].append(emotion)
            target_session["started_at"] = min(target_session["started_at"], created_at)
            target_session["updated_at"] = max(target_session["updated_at"], created_at)

        finalized = [self._finalize_session(session) for session in hydrated]
        return sorted(finalized, key=lambda session: session["updated_at"], reverse=True)

    @staticmethod
    def _hydrate_session(session: dict[str, Any]) -> dict[str, Any]:
        turns = list(session.get("turns", []))
        emotions = [
            turn.emotion
            for turn in turns
            if isinstance(turn, ConversationTurn) and turn.role == "user" and turn.emotion
        ]
        return {
            "id": session["id"],
            "started_at": session["started_at"],
            "updated_at": session["updated_at"],
            "preview": session["preview"],
            "turns": turns,
            "emotions": emotions,
        }

    @staticmethod
    def _find_matching_user_turn(
        sessions: list[dict[str, Any]],
        *,
        normalized_transcript: str,
        created_at: datetime,
    ) -> tuple[dict[str, Any], ConversationTurn] | None:
        for session in sessions:
            for turn in session.get("turns", []):
                if turn.role != "user":
                    continue
                if _normalize_text(turn.text) != normalized_transcript:
                    continue
                if abs(turn.timestamp - created_at) > TURN_MATCH_WINDOW:
                    continue
                return session, turn
        return None

    @staticmethod
    def _find_session_for_unmatched_reading(
        sessions: list[dict[str, Any]],
        created_at: datetime,
    ) -> dict[str, Any] | None:
        candidates = [
            session
            for session in sessions
            if session["started_at"] - SESSION_GAP <= created_at <= session["updated_at"] + SESSION_GAP
        ]
        if not candidates:
            return None
        return min(
            candidates,
            key=lambda session: min(
                abs(session["started_at"] - created_at),
                abs(session["updated_at"] - created_at),
            ),
        )

    @staticmethod
    def _finalize_session(session: dict[str, Any]) -> dict[str, Any]:
        turns = sorted(
            session.get("turns", []),
            key=lambda turn: (
                turn.timestamp,
                0 if turn.role == "user" else 1,
            ),
        )
        emotions = [emotion for emotion in session.get("emotions", []) if emotion]
        preview = turns[-1].text if turns else session.get("preview", "")
        dominant_emotion = Counter(emotions).most_common(1)[0][0] if emotions else None
        return {
            "id": session["id"],
            "started_at": session["started_at"],
            "updated_at": session["updated_at"],
            "turns": turns,
            "preview": preview,
            "dominant_emotion": dominant_emotion,
        }
