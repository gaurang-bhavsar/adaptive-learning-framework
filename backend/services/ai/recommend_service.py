import logging
from backend.models import NextStepRecommendation, Resource
from backend.services.ai.provider import GeminiProvider

logger = logging.getLogger(__name__)

class RecommendService:
    def __init__(self, provider: GeminiProvider = None):
        self.provider = provider or GeminiProvider()

    def recommend_next_step(self, topic: str, mastery: int, confidence: int, preferred_style: str = "") -> NextStepRecommendation:
        prompt = (
            f"Given a learner studying the topic '{topic}' with a current mastery score of {mastery}/100 "
            f"and a confidence level of {confidence}/100. "
            f"Their preferred learning style is '{preferred_style or 'not specified'}'. "
            f"Recommend the next best learning action, including a specific practice task, a clear rationale for this action, "
            f"and curate 1-2 fallback Resource links (title, type, url, estimated_time_minutes, why_recommended, is_free)."
        )
        try:
            return self.provider.generate_structured(prompt, NextStepRecommendation)
        except Exception as e:
            logger.error(f"Failed to generate next step recommendation: {e}")
            return NextStepRecommendation(
                action="Review foundational concepts",
                task="Re-read the documentation and do basic exercises.",
                reason="Default recommendation due to failure in recommendation engine.",
                resources=[
                    Resource(
                        title="Google Search for " + topic,
                        type="official_docs",
                        url=f"https://www.google.com/search?q={topic.replace(' ', '+')}",
                        estimated_time_minutes=15,
                        why_recommended="Explore resources on Google.",
                        is_free=True
                    )
                ]
            )
