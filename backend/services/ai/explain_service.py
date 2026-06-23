import logging
from backend.models import ExplanationResponse
from backend.services.ai.provider import GeminiProvider

logger = logging.getLogger(__name__)

class ExplainService:
    def __init__(self, provider: GeminiProvider = None):
        self.provider = provider or GeminiProvider()

    def explain_topic(self, topic: str, style: str = "Beginner") -> ExplanationResponse:
        prompt = (
            f"Explain the topic '{topic}' in a personalized manner. "
            f"Style: '{style}' (e.g. Visual, Project-Based, Beginner, Concise). "
            f"Provide a clear, rich markdown explanation, utilizing examples where appropriate."
        )
        try:
            return self.provider.generate_structured(prompt, ExplanationResponse)
        except Exception as e:
            logger.error(f"Failed to generate explanation for {topic}: {e}")
            return ExplanationResponse(
                explanation=f"Here is a brief fallback explanation about **{topic}**. Look up official docs for complete information."
            )
