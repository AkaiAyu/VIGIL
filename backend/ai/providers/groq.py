import os
import json
from typing import Any

from groq import Groq

from ai.provider import AIProvider


class GroqProvider(AIProvider):
    def __init__(self):
        api_key = os.getenv("GROQ_API_KEY")

        if not api_key:
            raise RuntimeError(
                "GROQ_API_KEY is not configured."
            )

        self.client = Groq(api_key=api_key)

        self.model = os.getenv(
            "GROQ_MODEL",
            "openai/gpt-oss-20b",
        )

    def analyze_conversation(
        self,
        conversation: str,
    ) -> dict[str, Any]:

        system_instruction = """
You are the AI security analysis engine for VIGIL CallShield.

Your job is to analyze a conversation and assess whether it
contains signs of a scam, social engineering attack, impersonation,
credential theft, financial fraud, or other suspicious behavior.

IMPORTANT RULES:

1. Do not automatically assume the caller is a criminal.
2. Analyze the actual context of the conversation.
3. Look for indicators such as:
   - impersonation of banks, government agencies, companies,
     family members, colleagues, or other trusted entities
   - requests for OTPs, PINs, passwords, CVV, authentication codes,
     or other sensitive information
   - requests for money or financial transfers
   - requests to install remote-access software
   - unusual verification requests
   - urgency or pressure
   - threats or intimidation
   - suspicious requests for personal information
   - social engineering techniques
4. A keyword alone is NOT enough to classify a conversation as a scam.
5. Consider the combination and context of multiple indicators.
6. Be conservative when evidence is weak.
7. Do not invent facts that are not present in the conversation.

Return ONLY valid JSON.

The JSON must have exactly this structure:

{
    "risk_level": "LOW | MEDIUM | HIGH | CRITICAL",
    "risk_score": 0,
    "reasons": [
        "reason 1",
        "reason 2"
    ],
    "recommendation": "recommended action"
}

The risk_score must be an integer from 0 to 100.

Risk guidance:

LOW:
Normal conversation with little or no suspicious behavior.

MEDIUM:
Some suspicious indicators exist, but there is not enough evidence
to strongly indicate an attack.

HIGH:
Multiple strong indicators of social engineering, impersonation,
fraud, or suspicious requests are present.

CRITICAL:
Very strong evidence of an active scam or impersonation attack,
especially when sensitive credentials, OTPs, money, or urgent
financial actions are requested.
"""

        prompt = f"""
Analyze the following conversation.

CONVERSATION:
{conversation}
"""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": system_instruction,
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            temperature=0.1,
        )

        text = response.choices[0].message.content.strip()

        # Handle cases where the model wraps JSON in ```json ... ```
        if text.startswith("```"):
            lines = text.splitlines()

            if lines and lines[0].startswith("```"):
                lines = lines[1:]

            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]

            text = "\n".join(lines).strip()

        try:
            result = json.loads(text)
        except json.JSONDecodeError as error:
            raise RuntimeError(
                f"Groq returned invalid JSON: {text}"
            ) from error

        return result