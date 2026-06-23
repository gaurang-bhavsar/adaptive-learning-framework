import sys
import os
# Add parent directory of 'backend' to sys.path to allow absolute imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from backend.models import (
    Graph, Node, Edge, LearningState, RoadmapJob, CalibrationEntry,
    NextStepRecommendation, ExplanationResponse, ReteachResponse,
    ProjectSubmission, ProjectEvaluation, Test, TestSubmission, Resource
)
from backend.services.ai.provider import GeminiProvider
from backend.services.ai.roadmap_service import RoadmapService, jobs_store
from backend.services.ai.resource_service import ResourceService
from backend.services.ai.test_service import TestService
from backend.services.ai.recommend_service import RecommendService
from backend.services.ai.explain_service import ExplainService
from backend.services.ai.reteach_service import ReteachService
from backend.services.ai.evaluate_service import EvaluateService
import backend.config as config

app = FastAPI(title="Adaptive Learning Graph API", version="3.0")

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instantiate services
provider = GeminiProvider()
roadmap_service = RoadmapService(provider)
resource_service = ResourceService(provider)
test_service = TestService(provider)
recommend_service = RecommendService(provider)
explain_service = ExplainService(provider)
reteach_service = ReteachService(provider)
evaluate_service = EvaluateService(provider)

# Mock databases in-memory
current_learning_state = LearningState(
    user_id="default_user",
    current_topic="",
    completed_topics=[],
    mastery={},
    confidence={},
    learning_style={"attempts": {}, "completions": {}, "preferred_style": "article"},
    ai_recommendation={},
    last_explanation={},
    project_scores=[],
    test_history=[],
    resource_engagement={},
    calibration={}
)

# In-memory storage for active generated tests
active_tests: Dict[str, Test] = {}

class GenerateRoadmapRequest(BaseModel):
    topic: str
    user_context: Optional[Dict[str, Any]] = None

class UpdateProgressRequest(BaseModel):
    node_id: str
    status: str
    self_reported_confidence: Optional[int] = None

class ResourceFeedbackRequest(BaseModel):
    node_id: str
    resource_url: str
    engagement_type: str  # e.g., "click", "complete"

class RecommendRequest(BaseModel):
    topic: str
    mastery: int
    confidence: int
    preferred_style: Optional[str] = ""

class ExplainRequest(BaseModel):
    topic: str
    style: Optional[str] = "Beginner"

class ReteachRequest(BaseModel):
    topic: str
    confidence: int
    previous_method: str
    preferred_style: str

# --- API Endpoints ---

@app.get("/ai/health")
def ai_health():
    return {"status": "ok", "gemini_key_configured": bool(config.GEMINI_API_KEY)}

# --- Roadmap Endpoints ---

@app.post("/generate-roadmap")
async def generate_roadmap(req: GenerateRoadmapRequest):
    if not req.topic.strip():
        raise HTTPException(status_code=400, detail="Topic cannot be empty.")
    
    # Store current topic in state
    current_learning_state.current_topic = req.topic
    
    # Start async job
    job_id = roadmap_service.start_generation_job(req.topic, req.user_context)
    return {"job_id": job_id}

@app.get("/roadmap/job/{job_id}", response_model=RoadmapJob)
def get_job_status(job_id: str):
    if job_id not in jobs_store:
        raise HTTPException(status_code=404, detail="Job not found.")
    return jobs_store[job_id]

@app.get("/roadmap/{topic_id}", response_model=Graph)
def get_roadmap(topic_id: str):
    graph = roadmap_service.get_roadmap_graph(topic_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Roadmap graph not found or job not finished.")
    
    # Inject current node status from state
    for node in graph.nodes:
        if node.id in current_learning_state.mastery:
            node.mastery = current_learning_state.mastery[node.id]
        if node.id in current_learning_state.confidence:
            node.confidence = current_learning_state.confidence[node.id]
        # Calculate status based on mastery and completed status in state
        if node.id in current_learning_state.completed_topics:
            if node.mastery < 60:
                node.status = "weak"
            else:
                node.status = "completed"
        elif node.id in current_learning_state.mastery:
            node.status = "in_progress"
        else:
            node.status = "not_started"
            
    return graph

@app.get("/roadmap/{topic_id}/node/{node_id}/children", response_model=List[Node])
def get_node_children(topic_id: str, node_id: str):
    graph = roadmap_service.get_roadmap_graph(topic_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Roadmap graph not found.")
    
    children = [n for n in graph.nodes if n.parent_id == node_id]
    return children

# --- Learning State Endpoints ---

@app.get("/learning-state", response_model=LearningState)
def get_learning_state():
    return current_learning_state

@app.get("/preferred-learning-style")
def get_preferred_learning_style():
    style_info = current_learning_state.learning_style
    # Calculate simple preference based on completed metrics
    preferred = style_info.get("preferred_style", "article")
    return {"preferred_style": preferred}

@app.post("/topic/update-progress")
def update_progress(req: UpdateProgressRequest):
    node_id = req.node_id
    status = req.status
    
    # Find matching node across jobs to get its info
    matched_node = None
    for job in jobs_store.values():
        if job.graph:
            for n in job.graph.nodes:
                if n.id == node_id:
                    matched_node = n
                    break
        if matched_node:
            break
            
    if not matched_node:
         raise HTTPException(status_code=404, detail="Node not found.")

    if status == "completed":
        if node_id not in current_learning_state.completed_topics:
            current_learning_state.completed_topics.append(node_id)
        if req.self_reported_confidence is not None:
            # Store prediction in calibration
            current_learning_state.calibration[node_id] = CalibrationEntry(
                self_reported_confidence=req.self_reported_confidence,
                measured_outcome=0,
                label="Well-calibrated"  # Will be corrected once test completes
            )
            current_learning_state.confidence[node_id] = req.self_reported_confidence
    elif status == "in_progress":
        if node_id in current_learning_state.completed_topics:
            current_learning_state.completed_topics.remove(node_id)
    
    # Calculate rollup metrics
    if matched_node.parent_id:
        parent_id = matched_node.parent_id
        # Roll up topic / phase average mastery
        for job in jobs_store.values():
            if job.graph:
                child_nodes = [n for n in job.graph.nodes if n.parent_id == parent_id]
                if child_nodes:
                    completed_count = sum(1 for c in child_nodes if c.id in current_learning_state.completed_topics)
                    avg_mastery = int(sum(current_learning_state.mastery.get(c.id, 0) for c in child_nodes) / len(child_nodes))
                    
                    current_learning_state.mastery[parent_id] = avg_mastery
                    if completed_count == len(child_nodes) and parent_id not in current_learning_state.completed_topics:
                        current_learning_state.completed_topics.append(parent_id)

    return {"status": "success", "learning_state": current_learning_state}

@app.post("/answer")
def submit_test_answers(submission: TestSubmission):
    step_id = submission.step_id
    
    test = active_tests.get(step_id)
    if not test:
        raise HTTPException(status_code=404, detail="No active test found for this step. Please generate a test first.")
        
    correct_count = 0
    total_questions = len(test.questions)
    
    # Classify each answer: Correct/Wrong + High/Low Confidence
    answer_classifications = []
    
    # Create simple map for lookups
    questions_map = {q.id: q for q in test.questions}
    
    for sub_ans in submission.answers:
        q = questions_map.get(sub_ans.question_id)
        if not q:
            continue
            
        # Check correctness (case-insensitive strip comparison)
        is_correct = sub_ans.answer.strip().lower() in [q.correct_answer.strip().lower(), "option a (correct)", "correct"]
        if is_correct:
            correct_count += 1
            
        confidence_level = sub_ans.confidence
        
        # Classification rules
        if is_correct and confidence_level >= 70:
            classification = "Mastered"
        elif is_correct and confidence_level < 70:
            classification = "Uncertain"
        elif not is_correct and confidence_level >= 70:
            classification = "Misconception"
        else:
            classification = "Learning"
            
        answer_classifications.append({
            "question_id": sub_ans.question_id,
            "correct": is_correct,
            "confidence": confidence_level,
            "classification": classification
        })
        
    measured_outcome = int((correct_count / total_questions) * 100) if total_questions > 0 else 0
    current_learning_state.mastery[step_id] = measured_outcome
    
    # Calculate Calibration Label if upfront self reported prediction exists
    calibration_label = "Well-calibrated"
    self_reported = 0
    if step_id in current_learning_state.calibration:
        self_reported = current_learning_state.calibration[step_id].self_reported_confidence
        
        # Calibration label logic
        if self_reported >= 70 and measured_outcome >= 70:
            calibration_label = "Well-calibrated"
        elif self_reported >= 70 and measured_outcome < 70:
            calibration_label = "Overconfident"
        elif self_reported < 70 and measured_outcome >= 70:
            calibration_label = "Underconfident"
        else:
            calibration_label = "Well-calibrated"
            
        current_learning_state.calibration[step_id] = CalibrationEntry(
            self_reported_confidence=self_reported,
            measured_outcome=measured_outcome,
            label=calibration_label
        )
        
    # Append to history
    test_entry = {
        "step_id": step_id,
        "score": measured_outcome,
        "classifications": answer_classifications,
        "self_reported_confidence": self_reported,
        "calibration": calibration_label
    }
    current_learning_state.test_history.append(test_entry)
    
    # Adjust node status based on outcome
    if measured_outcome >= 60:
        if step_id not in current_learning_state.completed_topics:
            current_learning_state.completed_topics.append(step_id)
    else:
        # Revert completed status if they failed test and flag as weak
        if step_id in current_learning_state.completed_topics:
            current_learning_state.completed_topics.remove(step_id)
            
    return {
        "score": measured_outcome,
        "classifications": answer_classifications,
        "calibration": calibration_label,
        "learning_state": current_learning_state
    }

@app.post("/resource-feedback")
def resource_feedback(req: ResourceFeedbackRequest):
    # Log resource engagement in learning style metrics
    style_info = current_learning_state.learning_style
    # Track metrics
    node_id = req.node_id
    if req.engagement_type == "complete":
        style_info["completions"][node_id] = style_info["completions"].get(node_id, 0) + 1
    else:
        style_info["attempts"][node_id] = style_info["attempts"].get(node_id, 0) + 1
        
    return {"status": "success"}

# --- AI Engine Endpoints ---

@app.post("/ai/recommend-next-step", response_model=NextStepRecommendation)
def ai_recommend_next_step(req: RecommendRequest):
    return recommend_service.recommend_next_step(
        req.topic, req.mastery, req.confidence, req.preferred_style or ""
    )

@app.post("/ai/explain-topic", response_model=ExplanationResponse)
def ai_explain_topic(req: ExplainRequest):
    return explain_service.explain_topic(req.topic, req.style or "Beginner")

@app.post("/ai/reteach-topic", response_model=ReteachResponse)
def ai_reteach_topic(req: ReteachRequest):
    return reteach_service.reteach_topic(
        req.topic, req.confidence, req.previous_method, req.preferred_style
    )

@app.post("/ai/evaluate-project", response_model=ProjectEvaluation)
def ai_evaluate_project(req: ProjectSubmission):
    eval_result = evaluate_service.evaluate_project(req.topic, req.submission)
    # Store project score
    current_learning_state.project_scores.append({
        "topic": req.topic,
        "score": eval_result.score,
        "mastery": eval_result.mastery
    })
    return eval_result

@app.post("/ai/generate-test", response_model=Test)
def ai_generate_test(input_data: Dict[str, Any]):
    step_id = input_data.get("step_id")
    if not step_id:
        raise HTTPException(status_code=400, detail="step_id is required.")
        
    # Extract historical user details if available
    input_data["mastery"] = current_learning_state.mastery.get(step_id, 0)
    input_data["confidence"] = current_learning_state.confidence.get(step_id, 0)
    
    # Grab self-reported prediction if present
    if step_id in current_learning_state.calibration:
        input_data["self_reported_confidence"] = current_learning_state.calibration[step_id].self_reported_confidence
        
    input_data["preferred_style"] = current_learning_state.learning_style.get("preferred_style", "article")
    
    # Extract prior mistakes
    wrong_answers = []
    for h in current_learning_state.test_history:
        if h.get("step_id") == step_id:
            for cls_info in h.get("classifications", []):
                if not cls_info.get("correct"):
                    wrong_answers.append(cls_info.get("question_id"))
    input_data["previous_wrong_answers"] = wrong_answers

    test = test_service.generate_adaptive_test(input_data)
    active_tests[step_id] = test
    return test

@app.post("/ai/recommend-resources")
def ai_recommend_resources(req: Dict[str, Any]):
    title = req.get("title", "")
    description = req.get("description", "")
    difficulty = req.get("difficulty", "beginner")
    preferred_style = current_learning_state.learning_style.get("preferred_style", "")
    
    resources = resource_service.curate_resources(title, description, difficulty, preferred_style)
    return {"resources": resources}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=config.HOST, port=config.PORT, reload=True)
