"use client";

import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import RoadmapGraph from '../components/RoadmapGraph';
import LearningDrawer from '../components/LearningDrawer';
import TestModal from '../components/TestModal';
import { Sparkles, HelpCircle, ArrowRight, RefreshCw, Layers } from 'lucide-react';

export default function Home() {
  const { 
    startRoadmapJob, 
    roadmapJob, 
    roadmap, 
    loading, 
    fetchLearningState, 
    learningState,
    resetJob,
    error
  } = useStore();
  
  const [topic, setTopic] = useState('');
  const [preferredStyle, setPreferredStyle] = useState('article');

  useEffect(() => {
    fetchLearningState();
  }, [fetchLearningState]);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (topic.trim()) {
      startRoadmapJob(topic.trim(), { preferred_style: preferredStyle });
    }
  };

  // Compute rolled up metrics for progress indicators
  const totalSteps = roadmap?.nodes.filter(n => n.type === 'step').length || 0;
  const completedSteps = roadmap?.nodes.filter(n => n.type === 'step' && (learningState?.completed_topics || []).includes(n.id)).length || 0;
  const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <main className="relative flex flex-col w-screen h-screen overflow-hidden bg-[#FAFAFB]">
      {/* Floating Header Toolbar */}
      <header className="absolute top-4 left-4 right-4 h-14 bg-white border border-[#E7E7EA] rounded-xl shadow-md z-20 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center p-2 bg-indigo-50 rounded-lg text-indigo-600">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#16161A]">Adaptive Learning Graph</h1>
            <p className="text-[10px] text-[#6B6B75] font-semibold">Gemini AI Personalized Roadmap</p>
          </div>
        </div>

        {/* Search / Generation Form */}
        <form onSubmit={handleGenerate} className="flex items-center gap-2 max-w-lg flex-1 mx-4">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={loading}
            placeholder="Enter learning topic (e.g. Learn Django, AWS Cloud, Rust Lang)..."
            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-[12.5px] focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
          />
          <select
            value={preferredStyle}
            onChange={(e) => setPreferredStyle(e.target.value)}
            disabled={loading}
            className="text-[12px] bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="article">Article Learner</option>
            <option value="video">Video Learner</option>
            <option value="project">Project Learner</option>
            <option value="interactive">Interactive Learner</option>
          </select>
          <button
            type="submit"
            disabled={loading || !topic.trim()}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium rounded-lg text-[12.5px] flex items-center gap-1 cursor-pointer transition-colors"
          >
            {loading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>Generate</span>
          </button>
        </form>

        {/* Global Progress Pill */}
        {roadmap && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] text-gray-400 font-bold block uppercase">Overall Progress</span>
              <span className="text-[12px] font-bold text-gray-700">{completedSteps}/{totalSteps} steps ({progressPercent}%)</span>
            </div>
            <button
              onClick={resetJob}
              className="text-[11px] font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1.5 rounded transition-all cursor-pointer"
            >
              Reset
            </button>
          </div>
        )}
      </header>

      {/* Floating Error Notification */}
      {error && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg shadow-md z-35 flex items-center gap-2 max-w-md text-[12.5px] font-medium animate-bounce">
          <span className="font-bold">Error:</span> {error}
        </div>
      )}

      {/* Main Canvas Area */}
      <div className="flex-1 w-full h-full pt-20">
        {roadmapJob && roadmapJob.status !== 'ready' && roadmapJob.status !== 'failed' ? (
          /* Job generation loading overlay */
          <div className="absolute inset-0 bg-[#FAFAFB]/90 backdrop-blur-xs flex flex-col items-center justify-center z-15 gap-4">
            <div className="w-64 bg-gray-150 h-2 rounded-full overflow-hidden border border-gray-200">
              <div 
                className="bg-indigo-600 h-full transition-all duration-300"
                style={{ width: `${roadmapJob.progress_percent}%` }}
              />
            </div>
            <div className="text-center">
              <p className="text-[13px] font-bold text-gray-700 capitalize">
                {roadmapJob.status.replace('_', ' ')}...
              </p>
              <p className="text-[11px] text-gray-500 font-medium">
                {roadmapJob.progress_percent}% complete (Gemini AI recursive parsing)
              </p>
            </div>
          </div>
        ) : null}

        {roadmap ? (
          /* Graph rendering */
          <RoadmapGraph />
        ) : (
          /* Welcome screen */
          <div className="flex flex-col items-center justify-center h-full max-w-xl mx-auto px-6 text-center gap-6">
            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl shadow-inner">
              <Sparkles className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-[#16161A] tracking-tight sm:text-2xl">
                Ready to learn anything?
              </h2>
              <p className="text-[14px] text-[#6B6B75] mt-2 leading-relaxed">
                Type a topic above to recursively construct a custom multilevel learning graph. Gemini will generate major phases, child topics, detailed actionable steps, and curate valid resources for your preferred learning style.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 w-full text-left">
              <div 
                onClick={() => { setTopic('Learn Django'); setPreferredStyle('project'); }}
                className="p-3 border border-[#E7E7EA] bg-white rounded-xl hover:border-indigo-200 cursor-pointer transition-all hover:shadow-xs group"
              >
                <div className="font-semibold text-gray-800 text-[13px] group-hover:text-indigo-600 flex items-center justify-between">
                  <span>Learn Django</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Generate a project-based Python web app graph.</p>
              </div>
              <div 
                onClick={() => { setTopic('Introduction to Rust'); setPreferredStyle('interactive'); }}
                className="p-3 border border-[#E7E7EA] bg-white rounded-xl hover:border-indigo-200 cursor-pointer transition-all hover:shadow-xs group"
              >
                <div className="font-semibold text-gray-800 text-[13px] group-hover:text-indigo-600 flex items-center justify-between">
                  <span>Introduction to Rust</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Learn systems programming with interactive checks.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Side Detail Drawer & Test Modals */}
      <LearningDrawer />
      <TestModal />
    </main>
  );
}
