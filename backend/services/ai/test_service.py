import logging
import uuid
from typing import Dict, Any, List
from backend.models import Test, Question, TestSubmission
from backend.services.ai.provider import GeminiProvider

logger = logging.getLogger(__name__)

class TestService:
    def __init__(self, provider: GeminiProvider = None):
        self.provider = provider or GeminiProvider()

    def generate_adaptive_test(self, input_data: Dict[str, Any]) -> Test:
        step_title = input_data.get("step_title", "")
        mastery = input_data.get("mastery", 0)
        confidence = input_data.get("confidence", 0)
        self_reported_confidence = input_data.get("self_reported_confidence", 0)
        preferred_style = input_data.get("preferred_style", "")
        previous_wrong_answers = input_data.get("previous_wrong_answers", [])

        # Build adaptation guidelines for the prompt
        guidelines = []
        if mastery < 40:
            guidelines.append("- Target more beginner-level, fundamental conceptual questions.")
        
        if mastery >= 70 and confidence < 40:
            guidelines.append("- Target confidence-building questions: clear, logical, confirming correct mental models.")
            
        if self_reported_confidence > mastery + 30:
            guidelines.append("- Include at least one trick question or common misconception check to test if the high self-reported confidence is calibrated.")
            
        if previous_wrong_answers:
            guidelines.append(f"- Focus questions on targeting previously missed concepts: {previous_wrong_answers}")

        # Choose question types based on preferred style
        style_weighting = "Include a mix of multiple choice questions (mcq) and short answers."
        if preferred_style == "project" or preferred_style == "interactive":
            style_weighting = "Weight question types heavily towards code_completion and scenarios (scenario)."
        elif preferred_style == "article" or preferred_style == "video":
            style_weighting = "Weight question types towards multiple choice (mcq) and short conceptual answers (short_answer)."

        prompt = (
            f"Generate an adaptive test containing exactly 3 distinct questions to assess understanding of the topic: '{step_title}'.\n"
            f"Adaptation Constraints:\n"
            + "\n".join(guidelines) + "\n"
            f"Question Type Mix: {style_weighting}\n"
            f"Ensure each question has a unique ID, a clear prompt, a correct_answer, "
            f"a helpful explanation explaining why the answer is correct, and difficulty ('beginner', 'intermediate', or 'advanced')."
        )

        try:
            test = self.provider.generate_structured(prompt, Test)
            # Ensure each question has an ID if Gemini generated empty or duplicate ones
            for idx, q in enumerate(test.questions):
                if not q.id:
                    q.id = f"q_{idx}_{str(uuid.uuid4())[:8]}"
            return test
        except Exception as e:
            logger.error(f"Failed to generate adaptive test for {step_title}: {e}")
            # Return a simple fallback test in case Gemini fails
            return Test(
                questions=[
                    Question(
                        id=f"fallback_q_{idx}",
                        type="mcq",
                        prompt=f"Explain a core concept behind {step_title}.",
                        options=["Option A (Correct)", "Option B", "Option C", "Option D"],
                        correct_answer="Option A (Correct)",
                        explanation="This is a fallback conceptual question.",
                        difficulty="beginner",
                        confidence_prompt=True
                    ) for idx in range(3)
                ]
            )
