"""
Service layer for generating supportive, non-clinical mental health responses.

This module leverages the Groq LLM API to provide empathetic feedback based on a user's
current emotion and recent emotional trend. 
"""

import logging
from typing import Any
from groq import Groq, GroqError

from backend.utils.config import get_settings

logger = logging.getLogger(__name__)


class SupportGeneratorService:
    """
    Generates supportive messages using an LLM.
    
    This service is designed to be empathetic but explicitly non-clinical.
    """

    def __init__(self) -> None:
        self.settings = get_settings()
        
        # Initialize Groq client only if API key is provided
        self.client = None
        if self.settings.LLM_API_KEY:
            try:
                self.client = Groq(api_key=self.settings.LLM_API_KEY)
            except Exception as e:
                logger.error("Failed to initialize Groq client: %s", e)

    def generate_support_message(self, current_emotion: str, trend_summary: str) -> str:
        """
        Generate a short, supportive message using the Groq LLM based on the user's
        current emotion and their emotional trend.

        Args:
            current_emotion: The most recently detected emotion (e.g., "sad", "stressed").
            trend_summary: A short description of their recent trend (e.g., "sadness increasing over 5 days").

        Returns:
            A short supportive string.
        """
        if not self.client:
            logger.warning("Groq client not initialized. Returning fallback message.")
            return self._get_fallback_message(current_emotion)

        # The prompt design required by the user:
        # 1. Act as a supportive mental health assistant.
        # 2. Provide empathetic but non-clinical guidance.
        # 3. Output a short supportive message.
        system_prompt = (
            "You are a supportive, empathetic mental health assistant. "
            "Your goal is to provide comforting, non-clinical guidance to the user. "
            "Always keep your response short (1-3 sentences maximum). "
            "Do not provide medical advice or diagnoses."
        )

        user_prompt = (
            f"The user's current emotion is: '{current_emotion}'.\n"
            f"Their recent emotional trend is: '{trend_summary}'.\n\n"
            "Please provide a short, supportive message for them."
        )

        try:
            # We use a fast, common model on Groq for text generation
            # If the user specified a specific model via environment, we could use that instead.
            model_name = "llama3-8b-8192" 
            
            chat_completion = self.client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt,
                    },
                    {
                        "role": "user",
                        "content": user_prompt,
                    }
                ],
                model=model_name,
                temperature=0.7,
                max_tokens=150,
            )
            
            # Extract the actual response text
            response_content = chat_completion.choices[0].message.content
            if response_content:
                return response_content.strip()
                
            return self._get_fallback_message(current_emotion)

        except GroqError as e:
            logger.error("Groq API error during message generation: %s", e)
            return self._get_fallback_message(current_emotion)
        except Exception as e:
            logger.error("Unexpected error generating support message: %s", e)
            return self._get_fallback_message(current_emotion)

    def _get_fallback_message(self, current_emotion: str) -> str:
        """
        Provide a safe, static fallback message if the LLM is unavailable.
        """
        if current_emotion.lower() in ["sad", "sadness", "depressed"]:
            return "I'm sorry you're feeling this way. Remember to take things one step at a time and be kind to yourself."
        elif current_emotion.lower() in ["stress", "anxiety", "angry"]:
            return "It sounds like things are intense right now. Try taking a few deep breaths and stepping away for a moment if you can."
        elif current_emotion.lower() in ["happy", "calm", "joy"]:
            return "I'm glad to hear you're feeling positive! Keep up the good momentum."
        else:
            return "Thank you for checking in. Remember that whatever you're feeling is valid, and you don't have to carry it all alone."
