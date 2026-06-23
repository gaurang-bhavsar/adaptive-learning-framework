import logging
from backend.models import ReteachResponse
from backend.services.ai.provider import GeminiProvider

logger = logging.getLogger(__name__)

class ReteachService:
    def __init__(self, provider: GeminiProvider = None):
        self.provider = provider or GeminiProvider()

    def reteach_topic(self, topic: str, confidence: int, previous_method: str, preferred_style: str) -> ReteachResponse:
        prompt = (
            f"The learner struggled with topic '{topic}' using the method '{previous_method}'. "
            f"Their current confidence is {confidence}/100. Their preferred style is '{preferred_style}'. "
            f"Deliver an alternative teaching method ('new_method') and write a short, targeted 'lesson' "
            f"incorporating this alternative approach."
        )
        try:
            return self.provider.generate_structured(prompt, ReteachResponse)
        except Exception as e:
            logger.error(f"Failed to generate reteach response for {topic}: {e}")
            return ReteachResponse(
                new_method="Interactive Exercise / Practical Sandbox",
                lesson=f"Let's try coding a simple example. Write a quick block of code to explore {topic} manually."
            )
