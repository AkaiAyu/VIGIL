import os

from dotenv import load_dotenv

from ai.provider import AIProvider
from ai.providers.gemini import GeminiProvider
from ai.providers.groq import GroqProvider

load_dotenv()


class AIManager:
    """
    Central manager for CallShield AI providers.

    CallShield interacts only with this manager.
    The actual AI provider can be changed through
    configuration without changing CallShield itself.
    """

    def __init__(self):
        provider_name = os.getenv(
            "SCAM_AI_PROVIDER",
            "gemini"
        ).strip().lower()

        self.provider = self._create_provider(provider_name)

        print(
            f"CALLSHIELD AI PROVIDER: "
            f"{provider_name.upper()}"
        )

    def _create_provider(
        self,
        provider_name: str,
    ) -> AIProvider:

        if provider_name == "gemini":
            return GeminiProvider()

        if provider_name == "groq":
            return GroqProvider()

        raise ValueError(
            f"Unsupported AI provider: {provider_name}"
        )

    def analyze_conversation(
        self,
        conversation: str,
    ) -> dict:
        return self.provider.analyze_conversation(
            conversation
        )