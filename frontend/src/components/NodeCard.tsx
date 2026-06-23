import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { Check, BookOpen, Flag, Layers, HelpCircle } from 'lucide-react';
import { useStore, Node as StoreNode } from '../store/useStore';

interface NodeCardProps {
  data: StoreNode;
  id: string;
}

export default function NodeCard({ data, id }: NodeCardProps) {
  const { updateNodeProgress, generateTest, expandedNodeIds, toggleExpandNode } = useStore();
  const [hovered, setHovered] = useState(false);
  const [showConfidencePrompt, setShowConfidencePrompt] = useState(false);
  const [confidence, setConfidence] = useState(70);

  // Status-based styling (primarily borders and progress indicators)
  const statusColors = {
    not_started: { border: '', bar: 'bg-[#9CA3AF]', text: 'text-[#6B6B75]' },
    in_progress: { border: 'border-blue-200 shadow-sm shadow-blue-50', bar: 'bg-[#3B82F6]', text: 'text-blue-700' },
    completed: { border: 'border-green-200 shadow-sm shadow-green-50', bar: 'bg-[#10B981]', text: 'text-green-700' },
    weak: { border: 'border-amber-200 shadow-sm shadow-amber-50', bar: 'bg-[#F59E0B]', text: 'text-amber-700' }
  };

  // Node type-based backgrounds and fallback borders (for not_started status)
  const typeColors = {
    phase: { bg: 'bg-[#F9FAFB]', border: 'border-[#E5E7EB]' },
    topic: { bg: 'bg-[#F3F4F6]', border: 'border-[#D1D5DB]' },
    step: { bg: 'bg-[#E5E7EB]', border: 'border-[#9CA3AF]' },
    micro_step: { bg: 'bg-[#D1D5DB]', border: 'border-[#6B7280]' }
  };

  const currentStatusColors = statusColors[data.status] || statusColors.not_started;
  const currentTypeColors = typeColors[data.type] || typeColors.phase;
  
  // Use status border if active, otherwise use node type border
  const borderClass = currentStatusColors.border || currentTypeColors.border;
  const bgClass = currentTypeColors.bg;

  // Icon per node type
  const getIcon = () => {
    switch (data.type) {
      case 'phase':
        return <Flag className="w-4 h-4 text-indigo-500" />;
      case 'topic':
        return <Layers className="w-4 h-4 text-purple-500" />;
      case 'step':
        return <BookOpen className="w-4 h-4 text-blue-500" />;
      default:
        return <HelpCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const handleMarkComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfidencePrompt(true);
  };

  const handleConfirmConfidence = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfidencePrompt(false);
    
    // 1. Mark complete and store confidence in backend
    await updateNodeProgress(id, 'completed', confidence);
    
    // 2. Automatically generate test and pop up test modal
    if (data.type === 'step' && data.has_test) {
      await generateTest(id, data.title);
    }
  };

  const isExpandable = data.type === 'phase' || data.type === 'topic';
  const isExpanded = expandedNodeIds.includes(id);

  const handleCardClick = () => {
    if (isExpandable) {
      toggleExpandNode(id);
    }
  };

  return (
    <div
      className={`relative w-64 ${bgClass} rounded-lg border ${borderClass} p-3 text-left transition-all duration-300 ease-in-out cursor-pointer hover:shadow-md`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setShowConfidencePrompt(false);
      }}
      onClick={handleCardClick}
    >
      {/* Handles for React Flow connections */}
      <Handle type="target" position={Position.Top} className="!bg-gray-300 !w-2 !h-2" />
      
      {/* Left status color bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg ${currentStatusColors.bar}`} />

      {/* Card Content */}
      <div className="pl-2.5">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5">
            {getIcon()}
            <span className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
              {data.type}
            </span>
          </div>
          
          {/* Completion checkmark affordance revealed on hover */}
          {hovered && data.status !== 'completed' && !showConfidencePrompt && (
            <button
              onClick={handleMarkComplete}
              className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors cursor-pointer"
              title="Mark as complete"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Mastery ring if completed / weak */}
          {data.mastery > 0 && (
            <div className="flex items-center gap-1 text-[11px] font-medium text-gray-500">
              <span>{data.mastery}%</span>
              <div className="w-6 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${data.status === 'weak' ? 'bg-[#F59E0B]' : 'bg-[#10B981]'}`}
                  style={{ width: `${data.mastery}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Node Title & Description */}
        <h4 className="text-[13px] font-semibold text-[#16161A] line-clamp-1 mb-0.5">
          {data.title}
        </h4>
        <p className="text-[11px] text-[#6B6B75] line-clamp-2 leading-relaxed">
          {data.description}
        </p>

        {/* Dynamic Controls / Expanding Afordance */}
        {isExpandable && (
          <div className="mt-2 text-[10px] text-indigo-600 font-medium hover:underline">
            {isExpanded ? 'Collapse node' : 'Expand details'}
          </div>
        )}

        {/* Confidence Prompt overlay inside the card */}
        {showConfidencePrompt && (
          <div 
            className="absolute inset-0 bg-white/95 rounded-lg p-2.5 flex flex-col justify-between z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[11px] font-medium text-gray-600">
              Confidence level: <span className="font-bold text-indigo-600">{confidence}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={confidence}
              onChange={(e) => setConfidence(parseInt(e.target.value))}
              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 my-1"
            />
            <div className="flex justify-end gap-1.5 mt-1">
              <button
                onClick={(e) => { e.stopPropagation(); setShowConfidencePrompt(false); }}
                className="px-2 py-0.5 text-[10px] text-gray-500 hover:bg-gray-100 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmConfidence}
                className="px-2.5 py-0.5 text-[10px] text-white bg-indigo-600 hover:bg-indigo-700 rounded font-medium transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-gray-300 !w-2 !h-2" />
    </div>
  );
}
