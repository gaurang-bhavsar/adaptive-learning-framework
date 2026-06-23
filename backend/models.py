from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal

# --- Resources ---
class Resource(BaseModel):
    title: str
    type: Literal["official_docs", "video", "article", "interactive", "course", "book"]
    url: str
    estimated_time_minutes: int
    why_recommended: str
    is_free: bool

class ResourceList(BaseModel):
    resources: List[Resource]

# --- Graph Structure ---
class Node(BaseModel):
    id: str
    type: Literal["phase", "topic", "step", "micro_step"]
    title: str
    description: str
    parent_id: Optional[str] = None
    difficulty: Literal["beginner", "intermediate", "advanced"]
    estimated_time_minutes: int
    mastery: int = 0  # 0 to 100
    confidence: int = 0  # 0 to 100
    status: Literal["not_started", "in_progress", "completed", "weak"] = "not_started"
    resources: List[Resource] = []
    has_test: bool = True

class Edge(BaseModel):
    source: str
    target: str
    type: Literal["contains", "prerequisite", "suggests"]

class Graph(BaseModel):
    nodes: List[Node]
    edges: List[Edge]

# --- Learning State ---
class CalibrationEntry(BaseModel):
    self_reported_confidence: int
    measured_outcome: int
    label: Literal["Well-calibrated", "Overconfident", "Underconfident"]

class LearningState(BaseModel):
    user_id: str
    current_topic: str
    completed_topics: List[str] = []
    mastery: Dict[str, int] = {}          # node_id -> mastery score
    confidence: Dict[str, int] = {}       # node_id -> confidence score
    learning_style: Dict[str, Any] = {}   # preferred styles / metrics
    ai_recommendation: Dict[str, Any] = {}
    last_explanation: Dict[str, Any] = {}
    project_scores: List[Dict[str, Any]] = []
    test_history: List[Dict[str, Any]] = []
    resource_engagement: Dict[str, Any] = {}
    calibration: Dict[str, CalibrationEntry] = {}  # node_id -> calibration data

# --- Roadmap Generation Job ---
class RoadmapJob(BaseModel):
    job_id: str
    topic: str
    status: Literal["pending", "generating_phases", "generating_topics", "generating_steps", "curating_resources", "ready", "failed"]
    progress_percent: int
    graph: Optional[Graph] = None

# --- AI Test / Assessment ---
class Question(BaseModel):
    id: str
    type: Literal["mcq", "short_answer", "code_completion", "scenario"]
    prompt: str
    options: List[str] = []
    correct_answer: str
    explanation: str
    difficulty: Literal["beginner", "intermediate", "advanced"]
    confidence_prompt: bool = True

class Test(BaseModel):
    questions: List[Question]

class AnswerSubmission(BaseModel):
    question_id: str
    answer: str
    confidence: int  # 0 to 100

class TestSubmission(BaseModel):
    step_id: str
    answers: List[AnswerSubmission]

# --- Recommendation / Explanation / Reteach / Projects ---
class NextStepRecommendation(BaseModel):
    action: str
    task: str
    reason: str
    resources: List[Resource] = []

class ExplanationResponse(BaseModel):
    explanation: str

class ReteachResponse(BaseModel):
    new_method: str
    lesson: str

class ProjectSubmission(BaseModel):
    topic: str
    submission: str

class ProjectEvaluation(BaseModel):
    score: int
    mastery: int
    strengths: List[str]
    weaknesses: List[str]
