import os
import json
from typing import Any

from google import genai

from ai.provider import AIProvider


class GeminiProvider(AIProvider):
    """
    Gemini implementation of the CallShield AI provider.

    CallShield communicates with Gemini through this adapter,
    allowing the provider to be replaced later without
    changing the CallShield logic.
    """

    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")

        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not configured."
            )

        self.client = genai.Client(api_key=api_key)

        self.model = os.getenv(
            "GEMINI_MODEL",
            "gemini-3.5-flash-lite"
        )

    def analyze_conversation(
        self,
        conversation: str,
    ) -> dict[str, Any]:

        system_instruction = """
You are the conversation-risk analysis engine for
VIGIL CallShield.

Analyze conversations for indicators of scams,
fraud, impersonation, or social engineering.

Do NOT assume that the caller is a criminal.

Evaluate the meaning and context of the conversation.

Look for patterns such as:
- impersonation of banks or organizations
- requests for OTPs, PINs, passwords, CVV,
  authentication codes, or other credentials
- requests for money or financial transfers
- requests to install remote-access software
- threats or unusual urgency
- attempts to obtain sensitive personal information
- suspicious verification procedures
- manipulation or social-engineering techniques

A keyword alone is NOT enough to classify a
conversation as risky.

Return ONLY valid JSON using this structure:

{
    "risk_level": "LOW",
    "risk_score": 0,
    "reasons": [],
    "recommendation": ""
}

Rules:

- risk_level must be LOW, MEDIUM, HIGH, or CRITICAL.
- risk_score must be an integer from 0 to 100.
- reasons must contain concise factual explanations.
- recommendation must be practical and safety-oriented.
- Do not identify or accuse a person of being a criminal.
- Do not invent information that is not present.
"""

        prompt = f"""
Analyze the following conversation.

CONVERSATION:
{conversation}
"""

        response = self.client.interactions.create(
            model=self.model,
            input=prompt,
            system_instruction=system_instruction,
        )

        text = response.output_text.strip()

        # Gemini may occasionally wrap valid JSON in Markdown
        # code fences such as ```json ... ```.
        if text.startswith("```"):
            text = text.removeprefix("```json")
            text = text.removeprefix("```")
            text = text.removesuffix("```")
            text = text.strip()

        try:
            return json.loads(text)

        except json.JSONDecodeError as error:
            raise RuntimeError(
                f"Gemini returned invalid JSON: {text}"
            ) from error