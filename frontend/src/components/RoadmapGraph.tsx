import React, { useMemo, useEffect } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  Edge as FlowEdge, 
  Node as FlowNode,
  useNodesState,
  useEdgesState,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useStore, Node as StoreNode, Edge as StoreEdge } from '../store/useStore';
import NodeCard from './NodeCard';

const nodeTypes = {
  phase: NodeCard,
  topic: NodeCard,
  step: NodeCard
};

export default function RoadmapGraph() {
  const { roadmap, expandedNodeIds, setSelectedNodeId } = useStore();
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Hierarchical layout builder that manages collapsible subflows
  const { layoutNodes, layoutEdges } = useMemo(() => {
    if (!roadmap) return { layoutNodes: [], layoutEdges: [] };

    const { nodes: rawNodes, edges: rawEdges } = roadmap;

    // Filter visible nodes based on parent expansion state
    const visibleNodeIds = new Set<string>();
    
    // Phase nodes are always visible
    rawNodes.forEach(n => {
      if (n.type === 'phase') {
        visibleNodeIds.add(n.id);
      }
    });

    // Topic nodes are visible if their parent Phase is expanded
    rawNodes.forEach(n => {
      if (n.type === 'topic' && n.parent_id && expandedNodeIds.includes(n.parent_id)) {
        visibleNodeIds.add(n.id);
      }
    });

    // Step nodes are visible if their parent Topic is visible AND expanded
    rawNodes.forEach(n => {
      if (n.type === 'step' && n.parent_id && visibleNodeIds.has(n.parent_id) && expandedNodeIds.includes(n.parent_id)) {
        visibleNodeIds.add(n.id);
      }
    });

    const filteredNodes = rawNodes.filter(n => visibleNodeIds.has(n.id));

    // Calculate layout coordinates
    // We group by depth level: Phase (Level 0), Topic (Level 1), Step (Level 2)
    const phases = filteredNodes.filter(n => n.type === 'phase');
    const topics = filteredNodes.filter(n => n.type === 'topic');
    const steps = filteredNodes.filter(n => n.type === 'step');

    const calculatedNodes: FlowNode[] = [];
    
    // Width configuration
    const cardWidth = 280;
    const horizontalGap = 60;
    
    // Determine the width of sub-branches to arrange parents centered above children
    const getSubtreeWidth = (nodeId: string, type: 'phase' | 'topic'): number => {
      if (type === 'phase') {
        // Child topics
        const childTopics = topics.filter(t => t.parent_id === nodeId);
        if (childTopics.length === 0) return cardWidth;
        return childTopics.reduce((acc, t) => acc + getSubtreeWidth(t.id, 'topic') + horizontalGap, 0) - horizontalGap;
      } else {
        // Child steps
        const childSteps = steps.filter(s => s.parent_id === nodeId);
        if (childSteps.length === 0) return cardWidth;
        return childSteps.length * (cardWidth + horizontalGap) - horizontalGap;
      }
    };

    // Keep track of positions to assign
    let currentX = 100;

    // Layout Phases
    phases.forEach((phase) => {
      const subtreeWidth = getSubtreeWidth(phase.id, 'phase');
      const phaseX = currentX + (subtreeWidth - cardWidth) / 2;
      
      calculatedNodes.push({
        id: phase.id,
        type: 'phase',
        data: phase,
        position: { x: phaseX, y: 50 }
      });

      // Layout child topics under this phase
      const childTopics = topics.filter(t => t.parent_id === phase.id);
      let topicX = currentX;

      childTopics.forEach((topic) => {
        const topicSubtreeWidth = getSubtreeWidth(topic.id, 'topic');
        const finalTopicX = topicX + (topicSubtreeWidth - cardWidth) / 2;

        calculatedNodes.push({
          id: topic.id,
          type: 'topic',
          data: topic,
          position: { x: finalTopicX, y: 250 }
        });

        // Layout child steps under this topic
        const childSteps = steps.filter(s => s.parent_id === topic.id);
        let stepX = topicX;

        childSteps.forEach((step, sIdx) => {
          calculatedNodes.push({
            id: step.id,
            type: 'step',
            data: step,
            position: { x: stepX, y: 450 }
          });
          stepX += cardWidth + horizontalGap;
        });

        topicX += Math.max(topicSubtreeWidth, cardWidth) + horizontalGap;
      });

      currentX += Math.max(subtreeWidth, cardWidth) + horizontalGap * 1.5;
    });

    // Map visible edges
    const flowEdges: FlowEdge[] = [];
    rawEdges.forEach((edge, idx) => {
      if (visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)) {
        const isPrereq = edge.type === 'prerequisite';
        flowEdges.push({
          id: `edge-${idx}`,
          source: edge.source,
          target: edge.target,
          type: 'default',
          style: {
            stroke: isPrereq ? '#6B7280' : '#D1D5DB', // Muted dark gray for solid lines, light gray for suggestions
            strokeDasharray: isPrereq ? undefined : '4,4',
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isPrereq ? '#6B7280' : '#9CA3AF',
            width: 10,
            height: 10,
          }
        });
      }
    });

    return { layoutNodes: calculatedNodes, layoutEdges: flowEdges };
  }, [roadmap, expandedNodeIds]);

  useEffect(() => {
    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [layoutNodes, layoutEdges, setNodes, setEdges]);

  const onNodeClick = (event: React.MouseEvent, node: FlowNode) => {
    setSelectedNodeId(node.id);
  };

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        className="bg-[#FAFAFB]"
        minZoom={0.2}
        maxZoom={1.5}
      >
        <Background color="#E5E7EB" gap={20} size={1.5} />
        <Controls />
        <MiniMap zoomable pannable nodeStrokeColor="#E5E7EB" />
      </ReactFlow>
    </div>
  );
}
