from __future__ import annotations

import pytest

from backend.models.schemas.conversation import ConversationExchangeCreate
from backend.services.conversation_history_service import ConversationHistoryService


class FakeConversationRepository:
    def __init__(self, rows: list[dict] | None = None) -> None:
        self.rows = rows or []
        self.saved: list[dict] = []

    async def add_conversation(
        self,
        *,
        user_id: str,
        transcript: str | None,
        detected_emotion: str,
        ai_response: str,
    ) -> dict:
        row = {
            "id": len(self.rows) + len(self.saved) + 1,
            "user_id": user_id,
            "transcript": transcript,
            "detected_emotion": detected_emotion,
            "ai_response": ai_response,
            "created_at": "2026-03-23T07:00:00",
        }
        self.saved.append(row)
        return row

    async def list_conversations_for_user(self, user_id: str) -> list[dict]:
        return [row for row in self.rows if row.get("user_id") == user_id]


class FakeEmotionRepository:
    def __init__(self, rows: list[dict] | None = None) -> None:
        self.rows = rows or []

    async def list_readings_for_user(self, user_id: str) -> list[dict]:
        return [row for row in self.rows if row.get("user_id") == user_id]


@pytest.mark.asyncio
async def test_save_exchange_encodes_and_returns_session_metadata() -> None:
    conversation_repo = FakeConversationRepository()
    service = ConversationHistoryService(
        conversation_repo=conversation_repo,
        emotion_repo=FakeEmotionRepository(),
    )

    created = await service.save_exchange(
        ConversationExchangeCreate(
            user_id="user-1",
            session_id="session-123",
            transcript="I had a rough morning.",
            detected_emotion="sad",
            confidence=0.82,
            ai_response="That sounds heavy. Take one slow breath with me.",
        )
    )

    assert conversation_repo.saved[0]["detected_emotion"] == "sad"
    assert '"session_id":"session-123"' in str(conversation_repo.saved[0]["transcript"])
    assert created.session_id == "session-123"
    assert created.transcript == "I had a rough morning."
    assert created.ai_response == "That sounds heavy. Take one slow breath with me."
    assert created.confidence == 0.82


@pytest.mark.asyncio
async def test_list_sessions_groups_multiple_exchanges_into_one_session() -> None:
    conversation_repo = FakeConversationRepository(
        [
            {
                "id": 1,
                "user_id": "user-1",
                "transcript": '{"session_id":"voice-1","text":"Hello","confidence":0.6}',
                "detected_emotion": "neutral",
                "ai_response": "Hi, I am here.",
                "created_at": "2026-03-23T07:00:00",
            },
            {
                "id": 2,
                "user_id": "user-1",
                "transcript": '{"session_id":"voice-1","text":"I am stressed.","confidence":0.8}',
                "detected_emotion": "anxious",
                "ai_response": "Let us slow it down together.",
                "created_at": "2026-03-23T07:02:00",
            },
        ]
    )
    service = ConversationHistoryService(
        conversation_repo=conversation_repo,
        emotion_repo=FakeEmotionRepository(),
    )

    sessions = await service.list_sessions("user-1")
    detail = await service.get_session("user-1", "voice-1")

    assert len(sessions) == 1
    assert sessions[0].id == "voice-1"
    assert sessions[0].turn_count == 4
    assert sessions[0].dominant_emotion == "neutral" or sessions[0].dominant_emotion == "anxious"
    assert detail is not None
    assert [turn.role for turn in detail.turns] == ["user", "assistant", "user", "assistant"]
    assert detail.turns[2].text == "I am stressed."
    assert detail.turns[3].text == "Let us slow it down together."


@pytest.mark.asyncio
async def test_list_sessions_falls_back_to_legacy_emotion_readings_when_no_conversation_rows() -> None:
    service = ConversationHistoryService(
        conversation_repo=FakeConversationRepository(),
        emotion_repo=FakeEmotionRepository(
            [
                {
                    "id": 11,
                    "user_id": "user-1",
                    "created_at": "2026-03-23T07:10:00",
                    "emotion_label": "anger",
                    "confidence": 0.45,
                    "transcript": "I felt dismissed in that meeting.",
                }
            ]
        ),
    )

    sessions = await service.list_sessions("user-1")
    detail = await service.get_session("user-1", sessions[0].id)

    assert len(sessions) == 1
    assert sessions[0].preview == "I felt dismissed in that meeting."
    assert detail is not None
    assert detail.turns[0].role == "user"
    assert detail.turns[0].emotion == "anger"


@pytest.mark.asyncio
async def test_list_sessions_handles_legacy_timestamps_with_short_fractional_seconds() -> None:
    service = ConversationHistoryService(
        conversation_repo=FakeConversationRepository(),
        emotion_repo=FakeEmotionRepository(
            [
                {
                    "id": 21,
                    "user_id": "user-1",
                    "created_at": "2026-03-23T07:27:00.64293",
                    "emotion_label": "neutral",
                    "confidence": 0.62,
                    "transcript": "Hello?",
                }
            ]
        ),
    )

    sessions = await service.list_sessions("user-1")

    assert len(sessions) == 1
    assert sessions[0].id == "legacy-reading-21"
    assert sessions[0].preview == "Hello?"


@pytest.mark.asyncio
async def test_list_sessions_merges_unsaved_user_readings_into_existing_session() -> None:
    service = ConversationHistoryService(
        conversation_repo=FakeConversationRepository(
            [
                {
                    "id": 1,
                    "user_id": "user-1",
                    "transcript": '{"session_id":"voice-1","text":"I am excited about this project.","confidence":0.9}',
                    "detected_emotion": "joy",
                    "ai_response": "That sounds energizing. What part feels most exciting?",
                    "created_at": "2026-03-23T11:04:40",
                }
            ]
        ),
        emotion_repo=FakeEmotionRepository(
            [
                {
                    "id": 11,
                    "user_id": "user-1",
                    "created_at": "2026-03-23T11:04:05",
                    "emotion_label": "joy",
                    "confidence": 0.93,
                    "transcript": "I am excited about this project.",
                },
                {
                    "id": 12,
                    "user_id": "user-1",
                    "created_at": "2026-03-23T11:05:10",
                    "emotion_label": "neutral",
                    "confidence": 0.9,
                    "transcript": "I want to make it more optimal.",
                },
            ]
        ),
    )

    sessions = await service.list_sessions("user-1")
    detail = await service.get_session("user-1", "voice-1")

    assert len(sessions) == 1
    assert sessions[0].turn_count == 3
    assert detail is not None
    assert [turn.role for turn in detail.turns] == ["user", "assistant", "user"]
    assert detail.turns[0].text == "I am excited about this project."
    assert detail.turns[0].confidence == 0.9
    assert detail.turns[2].text == "I want to make it more optimal."


@pytest.mark.asyncio
async def test_list_sessions_does_not_duplicate_matching_user_turns_when_reading_exists() -> None:
    service = ConversationHistoryService(
        conversation_repo=FakeConversationRepository(
            [
                {
                    "id": 1,
                    "user_id": "user-1",
                    "transcript": '{"session_id":"voice-1","text":"Hello there.","confidence":0.6}',
                    "detected_emotion": "neutral",
                    "ai_response": "Hi, I am here.",
                    "created_at": "2026-03-23T07:00:20",
                }
            ]
        ),
        emotion_repo=FakeEmotionRepository(
            [
                {
                    "id": 21,
                    "user_id": "user-1",
                    "created_at": "2026-03-23T07:00:00",
                    "emotion_label": "neutral",
                    "confidence": 0.61,
                    "transcript": "Hello there.",
                }
            ]
        ),
    )

    detail = await service.get_session("user-1", "voice-1")

    assert detail is not None
    assert [turn.role for turn in detail.turns] == ["user", "assistant"]
    assert detail.turns[0].text == "Hello there."
