"""API routes for session-based conversation history."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.models.schemas.conversation import (
    ConversationExchangeCreate,
    ConversationExchangeRead,
    ConversationSessionDetail,
    ConversationSessionSummary,
)
from backend.services.conversation_history_service import ConversationHistoryService

router = APIRouter(prefix="/conversations", tags=["conversations"])


def get_conversation_history_service() -> ConversationHistoryService:
    return ConversationHistoryService()


@router.get("", response_model=list[ConversationSessionSummary])
async def list_conversation_sessions(
    user_id: str = Query(..., min_length=1),
    service: ConversationHistoryService = Depends(get_conversation_history_service),
) -> list[ConversationSessionSummary]:
    return await service.list_sessions(user_id)


@router.get("/{session_id}", response_model=ConversationSessionDetail)
async def get_conversation_session(
    session_id: str,
    user_id: str = Query(..., min_length=1),
    service: ConversationHistoryService = Depends(get_conversation_history_service),
) -> ConversationSessionDetail:
    session = await service.get_session(user_id, session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation session not found.")
    return session


@router.post("", response_model=ConversationExchangeRead, status_code=status.HTTP_201_CREATED)
async def create_conversation_exchange(
    payload: ConversationExchangeCreate,
    service: ConversationHistoryService = Depends(get_conversation_history_service),
) -> ConversationExchangeRead:
    return await service.save_exchange(payload)
