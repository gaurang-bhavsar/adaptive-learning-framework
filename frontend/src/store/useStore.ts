import { create } from 'zustand';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

export interface Resource {
  title: string;
  type: 'official_docs' | 'video' | 'article' | 'interactive' | 'course' | 'book';
  url: string;
  estimated_time_minutes: number;
  why_recommended: string;
  is_free: boolean;
}

export interface Node {
  id: string;
  type: 'phase' | 'topic' | 'step' | 'micro_step';
  title: string;
  description: string;
  parent_id: string | null;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimated_time_minutes: number;
  mastery: number;
  confidence: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'weak';
  resources: Resource[];
  has_test: boolean;
}

export interface Edge {
  source: string;
  target: string;
  type: 'contains' | 'prerequisite' | 'suggests';
}

export interface Graph {
  nodes: Node[];
  edges: Edge[];
}

export interface CalibrationEntry {
  self_reported_confidence: number;
  measured_outcome: number;
  label: 'Well-calibrated' | 'Overconfident' | 'Underconfident';
}

export interface LearningState {
  user_id: string;
  current_topic: string;
  completed_topics: string[];
  mastery: Record<string, number>;
  confidence: Record<string, number>;
  learning_style: Record<string, any>;
  ai_recommendation: Record<string, any>;
  last_explanation: Record<string, any>;
  project_scores: any[];
  test_history: any[];
  resource_engagement: Record<string, any>;
  calibration: Record<string, CalibrationEntry>;
}

export interface RoadmapJob {
  job_id: string;
  topic: string;
  status: 'pending' | 'generating_phases' | 'generating_topics' | 'generating_steps' | 'curating_resources' | 'ready' | 'failed';
  progress_percent: number;
  graph?: Graph;
}

export interface Question {
  id: string;
  type: 'mcq' | 'short_answer' | 'code_completion' | 'scenario';
  prompt: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  confidence_prompt: boolean;
}

export interface Test {
  questions: Question[];
}

interface State {
  roadmap: Graph | null;
  learningState: LearningState | null;
  selectedNodeId: string | null;
  drawerOpen: boolean;
  testModalOpen: boolean;
  loading: boolean;
  error: string | null;
  expandedNodeIds: string[];
  roadmapJob: RoadmapJob | null;
  activeTest: Test | null;
  calibrationResult: any | null;
  
  // Actions
  fetchLearningState: () => Promise<void>;
  startRoadmapJob: (topic: string, context?: any) => Promise<void>;
  pollJobStatus: (jobId: string) => Promise<void>;
  fetchRoadmap: (topicId: string) => Promise<void>;
  updateNodeProgress: (nodeId: string, status: string, selfReportedConfidence?: number) => Promise<void>;
  generateTest: (stepId: string, stepTitle: string) => Promise<void>;
  submitTestAnswers: (stepId: string, answers: any[]) => Promise<any>;
  toggleExpandNode: (nodeId: string) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  setDrawerOpen: (open: boolean) => void;
  setTestModalOpen: (open: boolean) => void;
  resetJob: () => void;
}

export const useStore = create<State>((set, get) => ({
  roadmap: null,
  learningState: null,
  selectedNodeId: null,
  drawerOpen: false,
  testModalOpen: false,
  loading: false,
  error: null,
  expandedNodeIds: [],
  roadmapJob: null,
  activeTest: null,
  calibrationResult: null,

  fetchLearningState: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/learning-state`);
      set({ learningState: response.data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  startRoadmapJob: async (topic, context = {}) => {
    set({ loading: true, error: null, roadmapJob: null });
    try {
      const response = await axios.post(`${API_BASE_URL}/generate-roadmap`, { topic, user_context: context });
      const { job_id } = response.data;
      set({ roadmapJob: { job_id, topic, status: 'pending', progress_percent: 0 } });
      get().pollJobStatus(job_id);
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  pollJobStatus: async (jobId) => {
    const interval = setInterval(async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/roadmap/job/${jobId}`);
        const job: RoadmapJob = response.data;
        set({ roadmapJob: job });

        if (job.graph) {
          set({ roadmap: job.graph });
        }

        if (job.status === 'ready' || job.status === 'failed') {
          clearInterval(interval);
          set({ loading: false });
          if (job.status === 'ready') {
            get().fetchLearningState();
          } else {
            set({ error: "Roadmap generation job failed. You may have exceeded your Gemini API key quota or rate limits." });
          }
        }
      } catch (err: any) {
        clearInterval(interval);
        set({ error: err.message, loading: false });
      }
    }, 1500);
  },

  fetchRoadmap: async (topicId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/roadmap/${topicId}`);
      set({ roadmap: response.data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  updateNodeProgress: async (nodeId, status, selfReportedConfidence) => {
    try {
      await axios.post(`${API_BASE_URL}/topic/update-progress`, {
        node_id: nodeId,
        status,
        self_reported_confidence: selfReportedConfidence
      });
      await get().fetchLearningState();
      
      // Update local node status immediately to match
      const currentRoadmap = get().roadmap;
      if (currentRoadmap) {
        const updatedNodes = currentRoadmap.nodes.map(n => {
          if (n.id === nodeId) {
            return {
              ...n,
              status: status as any,
              confidence: selfReportedConfidence !== undefined ? selfReportedConfidence : n.confidence
            };
          }
          return n;
        });
        set({ roadmap: { ...currentRoadmap, nodes: updatedNodes } });
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  generateTest: async (stepId, stepTitle) => {
    set({ loading: true, activeTest: null, calibrationResult: null });
    try {
      const response = await axios.post(`${API_BASE_URL}/ai/generate-test`, {
        step_id: stepId,
        step_title: stepTitle
      });
      set({ activeTest: response.data, testModalOpen: true, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  submitTestAnswers: async (stepId, answers) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/answer`, {
        step_id: stepId,
        answers
      });
      set({ calibrationResult: response.data });
      await get().fetchLearningState();
      // Reload roadmap to refresh node states/masteries
      const job = get().roadmapJob;
      if (job) {
        await get().fetchRoadmap(job.job_id);
      }
      return response.data;
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  toggleExpandNode: (nodeId) => {
    const current = get().expandedNodeIds;
    if (current.includes(nodeId)) {
      set({ expandedNodeIds: current.filter(id => id !== nodeId) });
    } else {
      set({ expandedNodeIds: [...current, nodeId] });
    }
  },

  setSelectedNodeId: (nodeId) => {
    set({ selectedNodeId: nodeId, drawerOpen: nodeId !== null });
  },

  setDrawerOpen: (open) => set({ drawerOpen: open }),
  setTestModalOpen: (open) => set({ testModalOpen: open }),
  resetJob: () => set({ roadmapJob: null, roadmap: null, expandedNodeIds: [] })
}));
