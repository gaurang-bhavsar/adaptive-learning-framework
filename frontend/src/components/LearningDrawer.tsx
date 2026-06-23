import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, BookOpen, ExternalLink, Lightbulb, Play, Layers, Sparkles, Send, Award } from 'lucide-react';
import { useStore } from '../store/useStore';

const API_BASE_URL = 'http://localhost:8000';

export default function LearningDrawer() {
  const { selectedNodeId, roadmap, drawerOpen, setSelectedNodeId } = useStore();
  const [activeTab, setActiveTab] = useState<'details' | 'explain' | 'recommend' | 'reteach' | 'project'>('details');
  
  // AI States
  const [explanation, setExplanation] = useState('');
  const [explainStyle, setExplainStyle] = useState('Beginner');
  const [recommendation, setRecommendation] = useState<any>(null);
  const [reteachMethod, setReteachMethod] = useState('');
  const [reteachLesson, setReteachLesson] = useState('');
  const [projectText, setProjectText] = useState('');
  const [projectEval, setProjectEval] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Find selected node details
  const node = roadmap?.nodes.find(n => n.id === selectedNodeId);

  useEffect(() => {
    // Reset state when selection changes
    setExplanation('');
    setRecommendation(null);
    setReteachMethod('');
    setReteachLesson('');
    setProjectText('');
    setProjectEval(null);
    setActiveTab('details');
  }, [selectedNodeId]);

  if (!drawerOpen || !node) return null;

  const handleResourceClick = async (url: string) => {
    try {
      await axios.post(`${API_BASE_URL}/resource-feedback`, {
        node_id: node.id,
        resource_url: url,
        engagement_type: 'click'
      });
    } catch (e) {
      console.error(e);
    }
  };

  const loadExplanation = async () => {
    setLoading(true);
    try {
      const resp = await axios.post(`${API_BASE_URL}/ai/explain-topic`, {
        topic: node.title,
        style: explainStyle
      });
      setExplanation(resp.data.explanation);
    } catch (e) {
      setExplanation('Failed to fetch explanation from AI provider.');
    } finally {
      setLoading(false);
    }
  };

  const loadRecommendation = async () => {
    setLoading(true);
    try {
      const resp = await axios.post(`${API_BASE_URL}/ai/recommend-next-step`, {
        topic: node.title,
        mastery: node.mastery,
        confidence: node.confidence
      });
      setRecommendation(resp.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadReteach = async () => {
    setLoading(true);
    try {
      const resp = await axios.post(`${API_BASE_URL}/ai/reteach-topic`, {
        topic: node.title,
        confidence: node.confidence,
        previous_method: 'Standard Reading',
        preferred_style: 'interactive'
      });
      setReteachMethod(resp.data.new_method);
      setReteachLesson(resp.data.lesson);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const submitProject = async () => {
    setLoading(true);
    try {
      const resp = await axios.post(`${API_BASE_URL}/ai/evaluate-project`, {
        topic: node.title,
        submission: projectText
      });
      setProjectEval(resp.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const resourceIcon = (type: string) => {
    switch (type) {
      case 'video': return <Play className="w-4 h-4 text-red-500" />;
      case 'official_docs': return <BookOpen className="w-4 h-4 text-green-500" />;
      default: return <ExternalLink className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="absolute top-0 right-0 bottom-0 w-96 bg-white border-l border-[#E7E7EA] shadow-2xl flex flex-col z-30 transition-transform duration-300">
      {/* Header */}
      <div className="p-4 border-b border-[#E7E7EA] flex items-center justify-between">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
            {node.type} node
          </span>
          <h3 className="text-base font-semibold text-[#16161A] line-clamp-1">{node.title}</h3>
        </div>
        <button
          onClick={() => setSelectedNodeId(null)}
          className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-50 border-b border-[#E7E7EA] text-[12px] font-medium overflow-x-auto">
        <button
          onClick={() => setActiveTab('details')}
          className={`flex-1 py-2 px-3 text-center border-b-2 cursor-pointer whitespace-nowrap ${activeTab === 'details' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('explain')}
          className={`flex-1 py-2 px-3 text-center border-b-2 cursor-pointer whitespace-nowrap ${activeTab === 'explain' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
        >
          Explain
        </button>
        <button
          onClick={() => setActiveTab('recommend')}
          className={`flex-1 py-2 px-3 text-center border-b-2 cursor-pointer whitespace-nowrap ${activeTab === 'recommend' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
        >
          Action
        </button>
        <button
          onClick={() => setActiveTab('reteach')}
          className={`flex-1 py-2 px-3 text-center border-b-2 cursor-pointer whitespace-nowrap ${activeTab === 'reteach' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
        >
          Reteach
        </button>
        <button
          onClick={() => setActiveTab('project')}
          className={`flex-1 py-2 px-3 text-center border-b-2 cursor-pointer whitespace-nowrap ${activeTab === 'project' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
        >
          Project
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-[13px] leading-relaxed">
        {activeTab === 'details' && (
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-gray-800 mb-1">Description</h4>
              <p className="text-gray-600">{node.description}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg border border-[#E7E7EA]">
              <div>
                <span className="text-[11px] text-gray-400 block font-medium">Difficulty</span>
                <span className="font-semibold text-gray-700 capitalize">{node.difficulty}</span>
              </div>
              <div>
                <span className="text-[11px] text-gray-400 block font-medium">Est. Duration</span>
                <span className="font-semibold text-gray-700">{node.estimated_time_minutes} mins</span>
              </div>
            </div>

            {/* Recommended Resources */}
            {node.resources && node.resources.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-800 mb-2">Curated Resources</h4>
                <div className="space-y-2.5">
                  {node.resources.map((res, i) => (
                    <a
                      key={i}
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleResourceClick(res.url)}
                      className="flex items-start gap-3 p-3 bg-white rounded-lg border border-[#E7E7EA] hover:border-indigo-200 hover:bg-indigo-50/20 transition-all group"
                    >
                      <div className="mt-0.5">{resourceIcon(res.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[#16161A] line-clamp-1 group-hover:text-indigo-600 flex items-center gap-1">
                          {res.title}
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{res.why_recommended}</p>
                        <div className="flex gap-2 mt-1.5 text-[10px] text-gray-400 font-medium">
                          <span>{res.estimated_time_minutes} min</span>
                          <span>•</span>
                          <span className={res.is_free ? "text-green-600" : "text-amber-600"}>
                            {res.is_free ? 'Free' : 'Paid'}
                          </span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'explain' && (
          <div className="space-y-4">
            <div className="flex gap-2 items-center">
              <select
                value={explainStyle}
                onChange={(e) => setExplainStyle(e.target.value)}
                className="flex-1 text-[12px] bg-white border border-[#E7E7EA] rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="Beginner">Beginner style</option>
                <option value="Concise">Concise style</option>
                <option value="Visual">Visual analogies</option>
                <option value="Project-Based">Project explanation</option>
              </select>
              <button
                onClick={loadExplanation}
                disabled={loading}
                className="px-3.5 py-1.5 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 text-[12px] flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Generate
              </button>
            </div>

            {loading ? (
              <div className="text-gray-400 text-center py-8">AI is explaining...</div>
            ) : explanation ? (
              <div className="bg-gray-50 border border-[#E7E7EA] rounded-lg p-3 text-gray-700 whitespace-pre-line leading-relaxed">
                {explanation}
              </div>
            ) : (
              <div className="text-gray-400 text-center py-8">Click Generate to explain this topic.</div>
            )}
          </div>
        )}

        {activeTab === 'recommend' && (
          <div className="space-y-4">
            <button
              onClick={loadRecommendation}
              disabled={loading}
              className="w-full py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Lightbulb className="w-4 h-4" />
              Get Next Recommendation
            </button>

            {loading ? (
              <div className="text-gray-400 text-center py-8 font-medium">Calculating path...</div>
            ) : recommendation ? (
              <div className="space-y-3 bg-gray-50 border border-[#E7E7EA] rounded-lg p-4">
                <div>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide">Suggested Action</span>
                  <p className="font-semibold text-gray-800 text-[13px]">{recommendation.action}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide">Rationale</span>
                  <p className="text-gray-600 text-[12px]">{recommendation.reason}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide">Task Checklist</span>
                  <div className="p-3 bg-white border border-gray-150 rounded-md mt-1 font-medium text-gray-700">
                    {recommendation.task}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {activeTab === 'reteach' && (
          <div className="space-y-4">
            <button
              onClick={loadReteach}
              disabled={loading}
              className="w-full py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Re-Explain Differently
            </button>

            {loading ? (
              <div className="text-gray-400 text-center py-8">Rethinking lessons...</div>
            ) : reteachLesson ? (
              <div className="space-y-3">
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-[12px] text-indigo-800">
                  <span className="font-bold block">New approach:</span>
                  {reteachMethod}
                </div>
                <div className="bg-gray-50 border border-[#E7E7EA] rounded-lg p-4 text-gray-700 whitespace-pre-line leading-relaxed">
                  {reteachLesson}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {activeTab === 'project' && (
          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1">
                Project Code / Explanation
              </label>
              <textarea
                value={projectText}
                onChange={(e) => setProjectText(e.target.value)}
                placeholder="Paste your source code or write a detailed explanation of your project to validate understanding..."
                rows={6}
                className="w-full bg-white border border-[#E7E7EA] rounded-lg p-3 text-[12.5px] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>
            
            <button
              onClick={submitProject}
              disabled={loading || !projectText.trim()}
              className="w-full py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              Submit Project
            </button>

            {loading ? (
              <div className="text-gray-400 text-center py-8">Evaluating project...</div>
            ) : projectEval ? (
              <div className="bg-gray-50 border border-[#E7E7EA] rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                  <span className="font-semibold text-gray-700">Project Evaluation</span>
                  <div className="flex items-center gap-1 bg-green-100 text-green-800 px-2 py-0.5 rounded text-[11px] font-bold">
                    <Award className="w-3.5 h-3.5" />
                    <span>{projectEval.score}/100</span>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-green-600 block uppercase">Key Strengths</span>
                  <ul className="list-disc list-inside text-gray-600 mt-1 pl-1 space-y-0.5">
                    {projectEval.strengths.map((s: string, idx: number) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-amber-600 block uppercase">Areas for Improvement</span>
                  <ul className="list-disc list-inside text-gray-600 mt-1 pl-1 space-y-0.5">
                    {projectEval.weaknesses.map((w: string, idx: number) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
