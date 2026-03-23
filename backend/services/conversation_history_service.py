"""Conversation history persistence and session grouping."""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta
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


def _parse_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value))


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
        if conversations:
            return self._group_conversation_rows(conversations)

        readings = await self._emotion_repo.list_readings_for_user(user_id)
        return self._group_legacy_readings(readings)

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
            created_at = _parse_datetime(row.get("created_at"))
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

    @staticmethod
    def _finalize_session(session: dict[str, Any]) -> dict[str, Any]:
        emotions = [emotion for emotion in session.get("emotions", []) if emotion]
        dominant_emotion = Counter(emotions).most_common(1)[0][0] if emotions else None
        return {
            "id": session["id"],
            "started_at": session["started_at"],
            "updated_at": session["updated_at"],
            "turns": session["turns"],
            "preview": session["preview"],
            "dominant_emotion": dominant_emotion,
        }
