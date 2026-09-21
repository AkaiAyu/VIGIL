from abc import ABC, abstractmethod
from typing import Any


class AIProvider(ABC):
    """
    Common interface for all CallShield AI providers.

    CallShield talks to this interface instead of directly
    depending on Gemini, Groq, or any other AI service.
    """

    @abstractmethod
    def analyze_conversation(
        self,
        conversation: str,
    ) -> dict[str, Any]:
        """
        Analyze a conversation and return a structured
        risk assessment.
        """
        raise NotImplementedError