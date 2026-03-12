"""
Service layer for generating supportive responses via an LLM.

This module defines the interface that will later call an external LLM
provider (OpenAI, Claude, etc.). For now it returns a static, safe
placeholder message.
"""

from backend.models.schemas.insight import InsightResponse


class ResponseService:
    """
    High-level supportive response generation.

    This service accepts insights about the user's emotional state and
    returns a message that could eventually be LLM-generated.
    """

    async def generate_supportive_message(self, insight: InsightResponse) -> str:  # noqa: ARG002
        """
        Placeholder supportive response.

        Replace this method's body with a real LLM call when integrating
        with your preferred provider.
        """
        return (
            "We're here for you. Your emotional patterns show ups and downs, "
            "which is completely human. If you're ever feeling overwhelmed, "
            "consider reaching out to a trusted friend, family member, or "
            "a licensed mental health professional."
        )

"""
Service layer for generating supportive responses via an LLM.

This module defines the interface that will later call an external LLM
provider (OpenAI, Claude, etc.). For now it returns a static, safe
placeholder message.
"""

from backend.models.schemas.insight import InsightResponse


class ResponseService:
    """
    High-level supportive response generation.

    This service accepts insights about the user's emotional state and
    returns a message that could eventually be LLM-generated.
    """

    async def generate_supportive_message(self, insight: InsightResponse) -> str:  # noqa: ARG002
        """
        Placeholder supportive response.

        Replace this method's body with a real LLM call when integrating
        with your preferred provider.
        """
        return (
            "We're here for you. Your emotional patterns show ups and downs, "
            "which is completely human. If you're ever feeling overwhelmed, "
            "consider reaching out to a trusted friend, family member, or "
            "a licensed mental health professional."
        )

