"""
Service layer for emotion detection and persistence.

This module represents the central place to call an external or
pretrained emotion model (to be added later), then store the detected
emotions in the database through repositories.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.repositories.emotion_repository import EmotionRepository
from backend.models.schemas.emotion import EmotionReadingCreate, EmotionReadingRead


class EmotionService:
    """
    High-level emotion-related use cases.

    The actual emotion model is not implemented yet; this service
    currently creates placeholder records to illustrate the flow.
    """

    async def analyze_and_store(
        self,
        session: AsyncSession,
        payload: EmotionReadingCreate,
    ) -> EmotionReadingRead:
        """
        Placeholder method that simulates emotion analysis.

        In the future, this method will:
        1. Call a speech emotion recognition model.
        2. Normalize results.
        3. Persist them via the repository.
        """
        repo = EmotionRepository(session)
        data = payload.model_dump()
        record = await repo.create_reading(data)
        return EmotionReadingRead.model_validate(record)

"""
Service layer for emotion detection and persistence.

This module represents the central place to call an external or
pretrained emotion model (to be added later), then store the detected
emotions in the database through repositories.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.repositories.emotion_repository import EmotionRepository
from backend.models.schemas.emotion import EmotionReadingCreate, EmotionReadingRead


class EmotionService:
    """
    High-level emotion-related use cases.

    The actual emotion model is not implemented yet; this service
    currently creates placeholder records to illustrate the flow.
    """

    async def analyze_and_store(
        self,
        session: AsyncSession,
        payload: EmotionReadingCreate,
    ) -> EmotionReadingRead:
        """
        Placeholder method that simulates emotion analysis.

        In the future, this method will:
        1. Call a speech emotion recognition model.
        2. Normalize results.
        3. Persist them via the repository.
        """
        repo = EmotionRepository(session)
        data = payload.model_dump()
        record = await repo.create_reading(data)
        return EmotionReadingRead.model_validate(record)

