import logging
from backend.models import ProjectEvaluation
from backend.services.ai.provider import GeminiProvider

logger = logging.getLogger(__name__)

class EvaluateService:
    def __init__(self, provider: GeminiProvider = None):
        self.provider = provider or GeminiProvider()

    def evaluate_project(self, topic: str, submission: str) -> ProjectEvaluation:
        prompt = (
            f"Evaluate the project submission for topic '{topic}'.\n"
            f"Submission text:\n{submission}\n\n"
            f"Provide an evaluation containing:\n"
            f"- A score from 0 to 100\n"
            f"- An updated mastery score (0 to 100)\n"
            f"- A list of identified strengths\n"
            f"- A list of identified weaknesses / areas for improvement"
        )
        try:
            return self.provider.generate_structured(prompt, ProjectEvaluation)
        except Exception as e:
            logger.error(f"Failed to evaluate project for {topic}: {e}")
            return ProjectEvaluation(
                score=50,
                mastery=50,
                strengths=["Submitted project code"],
                weaknesses=["Automatic evaluation failed; default results returned."]
            )
