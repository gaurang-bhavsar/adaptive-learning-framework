import uuid
import logging
import asyncio
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import networkx as nx

from backend.models import Node, Edge, Graph, RoadmapJob, Resource
from backend.services.ai.provider import GeminiProvider
from backend.services.ai.resource_service import ResourceService

logger = logging.getLogger(__name__)

# --- Intermediate Pydantic schemas for Gemini Structured Output ---
class PhaseGen(BaseModel):
    id: str
    title: str
    description: str
    difficulty: str  # beginner | intermediate | advanced
    estimated_time_minutes: int

class PhaseListGen(BaseModel):
    phases: List[PhaseGen]
    prerequisites: List[dict]  # {"source": str, "target": str}

class TopicGen(BaseModel):
    id: str
    title: str
    description: str
    difficulty: str
    estimated_time_minutes: int

class TopicListGen(BaseModel):
    topics: List[TopicGen]
    prerequisites: List[dict]  # {"source": str, "target": str}

class StepGen(BaseModel):
    id: str
    title: str
    description: str
    difficulty: str
    estimated_time_minutes: int

class StepListGen(BaseModel):
    steps: List[StepGen]
    prerequisites: List[dict]  # {"source": str, "target": str}


# In-memory store for active jobs and generated roadmaps
jobs_store: Dict[str, RoadmapJob] = {}

class RoadmapService:
    def __init__(self, provider: GeminiProvider = None, resource_service: ResourceService = None):
        self.provider = provider or GeminiProvider()
        self.resource_service = resource_service or ResourceService(self.provider)

    def start_generation_job(self, topic: str, user_context: Optional[Dict[str, Any]] = None) -> str:
        job_id = str(uuid.uuid4())
        job = RoadmapJob(
            job_id=job_id,
            topic=topic,
            status="pending",
            progress_percent=0,
            graph=Graph(nodes=[], edges=[])
        )
        jobs_store[job_id] = job
        
        # Start async background generation
        asyncio.create_task(self._generate_roadmap_task(job_id, topic, user_context or {}))
        
        return job_id

    async def _generate_roadmap_task(self, job_id: str, topic: str, user_context: Dict[str, Any]):
        job = jobs_store[job_id]
        try:
            # 1. Generate Phases
            job.status = "generating_phases"
            job.progress_percent = 10
            logger.info(f"Job {job_id}: Generating phases for '{topic}'")
            
            phase_prompt = (
                f"Create a high-level roadmap of learning phases for the topic '{topic}'. "
                f"Consider the user's prior experience or goals if provided: {user_context}. "
                f"List 3 to 5 logical sequential phases. For each phase, generate a unique machine ID (e.g. 'phase_python_basics') "
                f"and define the prerequisite connections between these phases."
            )
            
            # Offload blocking Gemini call to threadpool
            phases_data = await asyncio.to_thread(
                self.provider.generate_structured, phase_prompt, PhaseListGen
            )
            
            nodes: List[Node] = []
            edges: List[Edge] = []
            
            # Map generated phases to Node objects
            for p in phases_data.phases:
                nodes.append(Node(
                    id=p.id,
                    type="phase",
                    title=p.title,
                    description=p.description,
                    difficulty=p.difficulty,  # type: ignore
                    estimated_time_minutes=p.estimated_time_minutes,
                    parent_id=None,
                    status="not_started",
                    has_test=False
                ))
            
            for edge_dict in phases_data.prerequisites:
                edges.append(Edge(
                    source=edge_dict["source"],
                    target=edge_dict["target"],
                    type="prerequisite"
                ))
            
            # Update job state with phase nodes
            job.graph = Graph(nodes=nodes, edges=edges)
            job.progress_percent = 30
            
            # 2. Generate Topics per Phase
            job.status = "generating_topics"
            phase_nodes = [n for n in nodes if n.type == "phase"]
            num_phases = len(phase_nodes)
            
            for idx, phase in enumerate(phase_nodes):
                logger.info(f"Job {job_id}: Generating topics for phase '{phase.title}'")
                topic_prompt = (
                    f"For the learning phase '{phase.title}' (Description: {phase.description}) under topic '{topic}', "
                    f"generate a list of 2 to 4 major Topics or Modules. "
                    f"Create a unique machine ID for each topic (e.g. 'topic_django_models') and define internal prerequisite connections."
                )
                topics_data = await asyncio.to_thread(
                    self.provider.generate_structured, topic_prompt, TopicListGen
                )
                
                # Add topic nodes
                for t in topics_data.topics:
                    nodes.append(Node(
                        id=t.id,
                        type="topic",
                        title=t.title,
                        description=t.description,
                        difficulty=t.difficulty,  # type: ignore
                        estimated_time_minutes=t.estimated_time_minutes,
                        parent_id=phase.id,
                        status="not_started",
                        has_test=False
                    ))
                    # Link contains edge: Phase contains Topic
                    edges.append(Edge(source=phase.id, target=t.id, type="contains"))
                
                # Link prerequisite edges between topics within the phase
                for edge_dict in topics_data.prerequisites:
                    edges.append(Edge(
                        source=edge_dict["source"],
                        target=edge_dict["target"],
                        type="prerequisite"
                    ))
                
                # Increment progress
                job.graph = Graph(nodes=nodes, edges=edges)
                job.progress_percent = int(30 + (idx + 1) / num_phases * 30)

            # 3. Generate Steps per Topic
            job.status = "generating_steps"
            topic_nodes = [n for n in nodes if n.type == "topic"]
            num_topics = len(topic_nodes)
            
            for idx, t_node in enumerate(topic_nodes):
                logger.info(f"Job {job_id}: Generating steps for topic '{t_node.title}'")
                step_prompt = (
                    f"For the topic '{t_node.title}' (Description: {t_node.description}), "
                    f"generate 3 to 5 granular, concrete learning Steps (e.g. 'step_defining_models'). "
                    f"Each step represents a single actionable learning unit. "
                    f"Define prerequisite connections between steps within this topic."
                )
                steps_data = await asyncio.to_thread(
                    self.provider.generate_structured, step_prompt, StepListGen
                )
                
                # Add step nodes
                topic_steps = []
                for s in steps_data.steps:
                    step_node = Node(
                        id=s.id,
                        type="step",
                        title=s.title,
                        description=s.description,
                        difficulty=s.difficulty,  # type: ignore
                        estimated_time_minutes=s.estimated_time_minutes,
                        parent_id=t_node.id,
                        status="not_started",
                        has_test=True
                    )
                    nodes.append(step_node)
                    topic_steps.append(step_node)
                    
                    # Link contains edge: Topic contains Step
                    edges.append(Edge(source=t_node.id, target=s.id, type="contains"))
                
                # Link prerequisite edges between steps
                for edge_dict in steps_data.prerequisites:
                    edges.append(Edge(
                        source=edge_dict["source"],
                        target=edge_dict["target"],
                        type="prerequisite"
                    ))

                # Update progress
                job.graph = Graph(nodes=nodes, edges=edges)
                job.progress_percent = int(60 + (idx + 1) / num_topics * 20)

            # 4. Curate resources for each Step (runs async/concurrently or in threads)
            job.status = "curating_resources"
            step_nodes = [n for n in nodes if n.type == "step"]
            num_steps = len(step_nodes)
            
            for idx, s_node in enumerate(step_nodes):
                logger.info(f"Job {job_id}: Curating resources for step '{s_node.title}'")
                resources = await asyncio.to_thread(
                    self.resource_service.curate_resources,
                    s_node.title,
                    s_node.description,
                    s_node.difficulty,
                    user_context.get("preferred_style", "")
                )
                s_node.resources = resources
                job.progress_percent = int(80 + (idx + 1) / num_steps * 20)
                job.graph = Graph(nodes=nodes, edges=edges)

            job.status = "ready"
            job.progress_percent = 100
            logger.info(f"Job {job_id}: Successfully completed generation!")
        except Exception as e:
            logger.error(f"Job {job_id} failed: {e}. Falling back to mock roadmap generation.")
            self._generate_mock_roadmap(job, topic)

    def _generate_mock_roadmap(self, job: RoadmapJob, topic: str):
        nodes = []
        edges = []
        
        # 3 mock phases
        phase_titles = [f"{topic} Foundations", f"Intermediate {topic} Development", f"Advanced {topic} & Architecture"]
        phase_ids = [f"phase_{idx}" for idx in range(3)]
        
        for idx, title in enumerate(phase_titles):
            nodes.append(Node(
                id=phase_ids[idx],
                type="phase",
                title=title,
                description=f"Master the core elements and structure of {title}.",
                parent_id=None,
                difficulty="beginner" if idx == 0 else ("intermediate" if idx == 1 else "advanced"),
                estimated_time_minutes=120,
                status="not_started",
                has_test=False
            ))
            
            # Prereq edge between phases
            if idx > 0:
                edges.append(Edge(source=phase_ids[idx-1], target=phase_ids[idx], type="prerequisite"))
                
            # 2 topics per phase
            topic_titles = [
                [f"Getting Started with {topic}", f"{topic} Syntax & Rules"],
                [f"Core APIs in {topic}", f"Managing State & Context"],
                [f"Scaling {topic} Apps", f"Security & Performance Optimization"]
            ][idx]
            
            topic_ids = [f"topic_{idx}_{t_idx}" for t_idx in range(2)]
            
            for t_idx, t_title in enumerate(topic_titles):
                nodes.append(Node(
                    id=topic_ids[t_idx],
                    type="topic",
                    title=t_title,
                    description=f"Deep dive into the syntax, execution, and best practices of {t_title}.",
                    parent_id=phase_ids[idx],
                    difficulty="beginner" if idx == 0 else ("intermediate" if idx == 1 else "advanced"),
                    estimated_time_minutes=60,
                    status="not_started",
                    has_test=False
                ))
                edges.append(Edge(source=phase_ids[idx], target=topic_ids[t_idx], type="contains"))
                if t_idx > 0:
                    edges.append(Edge(source=topic_ids[t_idx-1], target=topic_ids[t_idx], type="prerequisite"))
                    
                # 3 steps per topic
                step_titles = [
                    [f"Introduction to {t_title}", f"Setting up {t_title}", f"Writing your first {t_title} snippet"],
                    [f"Exploring {t_title} features", f"Handling errors in {t_title}", f"Building a module for {t_title}"]
                ][t_idx]
                
                for s_idx, s_title in enumerate(step_titles):
                    step_id = f"step_{idx}_{t_idx}_{s_idx}"
                    nodes.append(Node(
                        id=step_id,
                        type="step",
                        title=s_title,
                        description=f"Actionable step to master: {s_title}. Practice coding and review official examples.",
                        parent_id=topic_ids[t_idx],
                        difficulty="beginner" if idx == 0 else ("intermediate" if idx == 1 else "advanced"),
                        estimated_time_minutes=30,
                        status="not_started",
                        has_test=True,
                        resources=[
                            Resource(
                                title=f"Official Guide on {s_title}",
                                type="official_docs",
                                url=f"https://www.google.com/search?q={s_title.replace(' ', '+')}",
                                estimated_time_minutes=15,
                                why_recommended="Provides structured official documentation and setup steps.",
                                is_free=True
                            ),
                            Resource(
                                title=f"Video tutorial: {s_title}",
                                type="video",
                                url=f"https://www.youtube.com/results?search_query={s_title.replace(' ', '+')}",
                                estimated_time_minutes=10,
                                why_recommended="Visual explanation of the step concepts.",
                                is_free=True
                            )
                        ]
                    ))
                    edges.append(Edge(source=topic_ids[t_idx], target=step_id, type="contains"))
                    if s_idx > 0:
                        edges.append(Edge(source=f"step_{idx}_{t_idx}_{s_idx-1}", target=step_id, type="prerequisite"))
                        
        job.graph = Graph(nodes=nodes, edges=edges)
        job.status = "ready"
        job.progress_percent = 100

    def get_roadmap_graph(self, topic_id: str) -> Optional[Graph]:
        # Helper to find a ready job matching the topic_id (or search title/job_id)
        for job in jobs_store.values():
            if job.job_id == topic_id or job.topic.lower() == topic_id.lower():
                return job.graph
        return None
