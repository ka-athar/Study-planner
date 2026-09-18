import React, { useState, useMemo } from 'react';
import { 
  Network, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  Sparkles, 
  Swords, 
  BookOpen, 
  Layers, 
  Compass, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  ArrowRight,
  Brain,
  Activity,
  Flame,
  GitBranch,
  ShieldCheck
} from 'lucide-react';
import { Subject, Topic } from '../types';

interface KnowledgeGraphExplorerViewProps {
  subjects: Subject[];
  activeSubject: Subject | null;
  onSelectSubject?: (subjectId: string) => void;
  onStartFocusSprint?: (topicName: string) => void;
  onLaunchBossBattle?: (topicName: string, subjectName: string) => void;
  onOpenGeminiResearch?: (topicName: string, subjectName: string) => void;
  onLaunchBlurtRecall?: (topicName: string, subjectName: string) => void;
  onReviewFlashcards?: (topicName: string, subjectName: string) => void;
}

interface GraphNode {
  id: string;
  label: string;
  type: 'subject' | 'chapter' | 'topic';
  subjectName: string;
  chapterName?: string;
  status?: string;
  estimatedMinutes?: number;
  retentionPercent?: number;
  prerequisites?: string[];
  unlocks?: string[];
  x: number;
  y: number;
  r: number;
}

interface GraphEdge {
  sourceId: string;
  targetId: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  isPrerequisite?: boolean;
}

export const KnowledgeGraphExplorerView: React.FC<KnowledgeGraphExplorerViewProps> = ({
  subjects,
  activeSubject,
  onSelectSubject,
  onStartFocusSprint,
  onLaunchBossBattle,
  onOpenGeminiResearch,
  onLaunchBlurtRecall,
  onReviewFlashcards,
}) => {
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Mastered' | 'In Progress' | 'Planned'>('all');
  const [viewMode, setViewMode] = useState<'radial' | 'prerequisites' | 'heatmap'>('radial');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Filter subjects based on user selection
  const filteredSubjects = useMemo(() => {
    if (selectedSubjectFilter === 'all') return subjects;
    return subjects.filter(s => s.id === selectedSubjectFilter);
  }, [subjects, selectedSubjectFilter]);

  // Compute Layout: radial clustered orbits vs prerequisite dependency flow
  const { nodes, edges } = useMemo(() => {
    const calculatedNodes: GraphNode[] = [];
    const calculatedEdges: GraphEdge[] = [];

    const centerX = 400;
    const centerY = 350;
    const totalSubjects = filteredSubjects.length;

    if (viewMode === 'prerequisites') {
      // Topological Prerequisite Flow Layout (Left to Right / Dependency Stream)
      filteredSubjects.forEach((subj, sIdx) => {
        const subjNode: GraphNode = {
          id: `subj-${subj.id}`,
          label: subj.name,
          type: 'subject',
          subjectName: subj.name,
          retentionPercent: 88,
          x: 70,
          y: totalSubjects > 1 ? 160 + sIdx * 260 : 350,
          r: 28
        };
        calculatedNodes.push(subjNode);

        const totalChapters = subj.chapters.length;
        let prevChapNode: GraphNode | null = null;

        subj.chapters.forEach((chap, cIdx) => {
          const colX = 220 + (cIdx * 200);
          const baseY = (subjNode.y - 120) + (cIdx % 2 === 0 ? 0 : 30);
          const chapY = Math.max(100, Math.min(600, baseY));

          const chapNode: GraphNode = {
            id: `chap-${subj.id}-${chap.id}`,
            label: chap.name,
            type: 'chapter',
            subjectName: subj.name,
            chapterName: chap.name,
            retentionPercent: 75,
            x: colX,
            y: chapY,
            r: 22,
            prerequisites: prevChapNode ? [prevChapNode.label] : ['Foundational Core'],
            unlocks: []
          };

          if (prevChapNode) {
            prevChapNode.unlocks = [...(prevChapNode.unlocks || []), chapNode.label];
            calculatedEdges.push({
              sourceId: prevChapNode.id,
              targetId: chapNode.id,
              sourceX: prevChapNode.x,
              sourceY: prevChapNode.y,
              targetX: chapNode.x,
              targetY: chapNode.y,
              isPrerequisite: true
            });
          }

          calculatedNodes.push(chapNode);
          prevChapNode = chapNode;

          calculatedEdges.push({
            sourceId: subjNode.id,
            targetId: chapNode.id,
            sourceX: subjNode.x,
            sourceY: subjNode.y,
            targetX: chapNode.x,
            targetY: chapNode.y
          });

          // Layout topics vertically under/beside chapter
          let prevTopNode: GraphNode | null = null;
          chap.topics.forEach((top, tIdx) => {
            const topX = colX + (tIdx % 2 === 0 ? -45 : 45);
            const topY = chapY + 65 + (tIdx * 45);
            const retention = top.status === 'Mastered' ? 95 : top.status === 'In Progress' ? 68 : 34;

            const topNode: GraphNode = {
              id: `top-${top.id || `${subj.id}-${chap.id}-${tIdx}`}`,
              label: top.name,
              type: 'topic',
              subjectName: subj.name,
              chapterName: chap.name,
              status: top.status || 'Planned',
              estimatedMinutes: top.estimatedMinutes || 45,
              retentionPercent: retention,
              prerequisites: prevTopNode ? [prevTopNode.label] : [chap.name],
              unlocks: [],
              x: topX,
              y: topY,
              r: 15
            };

            if (prevTopNode) {
              prevTopNode.unlocks = [...(prevTopNode.unlocks || []), topNode.label];
              calculatedEdges.push({
                sourceId: prevTopNode.id,
                targetId: topNode.id,
                sourceX: prevTopNode.x,
                sourceY: prevTopNode.y,
                targetX: topNode.x,
                targetY: topNode.y,
                isPrerequisite: true
              });
            }

            calculatedNodes.push(topNode);
            prevTopNode = topNode;

            calculatedEdges.push({
              sourceId: chapNode.id,
              targetId: topNode.id,
              sourceX: chapNode.x,
              sourceY: chapNode.y,
              targetX: topNode.x,
              targetY: topNode.y
            });
          });
        });
      });

      return { nodes: calculatedNodes, edges: calculatedEdges };
    }

    // Radial orbit layout (Used for Radial & Heatmap modes)
    filteredSubjects.forEach((subj, sIdx) => {
      // Position subject nodes in inner ring
      const subjAngle = (sIdx / Math.max(1, totalSubjects)) * (2 * Math.PI) - Math.PI / 2;
      const subjDist = totalSubjects > 1 ? 160 : 0;
      const subjX = centerX + subjDist * Math.cos(subjAngle);
      const subjY = centerY + subjDist * Math.sin(subjAngle);

      const subjNode: GraphNode = {
        id: `subj-${subj.id}`,
        label: subj.name,
        type: 'subject',
        subjectName: subj.name,
        retentionPercent: 86,
        x: subjX,
        y: subjY,
        r: 28
      };
      calculatedNodes.push(subjNode);

      const totalChapters = subj.chapters.length;
      let prevChapNode: GraphNode | null = null;

      subj.chapters.forEach((chap, cIdx) => {
        // Position chapters in middle ring around subject
        const chapAngleOffset = ((cIdx - (totalChapters - 1) / 2) / Math.max(1, totalChapters)) * 1.5;
        const chapAngle = totalSubjects > 1 ? subjAngle + chapAngleOffset : (cIdx / Math.max(1, totalChapters)) * (2 * Math.PI);
        const chapDist = totalSubjects > 1 ? 110 : 130;
        const chapX = subjX + chapDist * Math.cos(chapAngle);
        const chapY = subjY + chapDist * Math.sin(chapAngle);

        const chapNode: GraphNode = {
          id: `chap-${subj.id}-${chap.id}`,
          label: chap.name,
          type: 'chapter',
          subjectName: subj.name,
          chapterName: chap.name,
          retentionPercent: 78,
          x: chapX,
          y: chapY,
          r: 20,
          prerequisites: prevChapNode ? [prevChapNode.label] : undefined,
          unlocks: []
        };

        if (prevChapNode) {
          prevChapNode.unlocks = [...(prevChapNode.unlocks || []), chapNode.label];
        }

        calculatedNodes.push(chapNode);
        prevChapNode = chapNode;

        calculatedEdges.push({
          sourceId: subjNode.id,
          targetId: chapNode.id,
          sourceX: subjNode.x,
          sourceY: subjNode.y,
          targetX: chapNode.x,
          targetY: chapNode.y
        });

        // Position topics around chapters
        const totalTopics = chap.topics.length;
        let prevTopNode: GraphNode | null = null;

        chap.topics.forEach((top, tIdx) => {
          const topAngleOffset = ((tIdx - (totalTopics - 1) / 2) / Math.max(1, totalTopics)) * 1.8;
          const topAngle = chapAngle + topAngleOffset;
          const topDist = 70;
          const topX = chapX + topDist * Math.cos(topAngle);
          const topY = chapY + topDist * Math.sin(topAngle);
          const retention = top.status === 'Mastered' ? 95 : top.status === 'In Progress' ? 68 : 34;

          const topNode: GraphNode = {
            id: `top-${top.id || `${subj.id}-${chap.id}-${tIdx}`}`,
            label: top.name,
            type: 'topic',
            subjectName: subj.name,
            chapterName: chap.name,
            status: top.status || 'Planned',
            estimatedMinutes: top.estimatedMinutes || 45,
            retentionPercent: retention,
            prerequisites: prevTopNode ? [prevTopNode.label] : [chap.name],
            unlocks: [],
            x: topX,
            y: topY,
            r: 14
          };

          if (prevTopNode) {
            prevTopNode.unlocks = [...(prevTopNode.unlocks || []), topNode.label];
          }

          calculatedNodes.push(topNode);
          prevTopNode = topNode;

          calculatedEdges.push({
            sourceId: chapNode.id,
            targetId: topNode.id,
            sourceX: chapNode.x,
            sourceY: chapNode.y,
            targetX: topNode.x,
            targetY: topNode.y
          });
        });
      });
    });

    return { nodes: calculatedNodes, edges: calculatedEdges };
  }, [filteredSubjects, viewMode]);

  // Filtered displayed nodes
  const displayNodes = useMemo(() => {
    return nodes.filter(n => {
      if (searchQuery.trim()) {
        const matchesQuery = n.label.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesQuery) return false;
      }
      if (statusFilter !== 'all' && n.type === 'topic') {
        if (n.status !== statusFilter) return false;
      }
      return true;
    });
  }, [nodes, searchQuery, statusFilter]);

  const displayNodeIds = useMemo(() => new Set(displayNodes.map(n => n.id)), [displayNodes]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner - Strict Theme Palette */}
      <div className="bg-[#FAF9F5] dark:bg-card border border-theme rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
              <Network className="w-3.5 h-3.5 text-primary" />
              <span>Visual Concept Web & Knowledge Graph</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif italic font-bold text-primary">
              Interactive Academic Knowledge Map
            </h2>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              Explore the connective tissue of your syllabus. Identify prerequisite pathways, isolate blind spots, and drill topics directly through Focus Sprints, Gemini Research, or RPG Boss Battles.
            </p>
          </div>

          {/* Controls & Quick Stats */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setZoomLevel(prev => Math.min(prev + 0.2, 1.8))}
              className="p-2.5 rounded-xl bg-surface hover:bg-theme-accent border border-theme text-primary transition cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoomLevel(prev => Math.max(prev - 0.2, 0.6))}
              className="p-2.5 rounded-xl bg-surface hover:bg-theme-accent border border-theme text-primary transition cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="p-2.5 rounded-xl bg-surface hover:bg-theme-accent border border-theme text-primary transition cursor-pointer"
              title="Reset Zoom"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 pt-6 mt-6 border-t border-theme">
          {/* Subject Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Subject:</span>
            <select
              value={selectedSubjectFilter}
              onChange={e => setSelectedSubjectFilter(e.target.value)}
              className="bg-surface border border-theme rounded-xl px-2.5 py-1.5 text-xs text-primary font-medium focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Subjects ({subjects.length})</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="bg-surface border border-theme rounded-xl px-2.5 py-1.5 text-xs text-primary font-medium focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Statuses</option>
              <option value="Mastered">Mastered</option>
              <option value="In Progress">In Progress</option>
              <option value="Planned">Planned</option>
            </select>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 bg-surface p-1 rounded-2xl border border-theme">
            <button
              onClick={() => setViewMode('radial')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'radial'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-muted hover:text-primary'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Radial Orbit</span>
            </button>
            <button
              onClick={() => setViewMode('prerequisites')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'prerequisites'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-muted hover:text-primary'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Prerequisites Flow</span>
            </button>
            <button
              onClick={() => setViewMode('heatmap')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'heatmap'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-muted hover:text-primary'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-amber-300" />
              <span>Retention Heatmap</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search concepts or chapters..."
              className="w-full bg-surface border border-theme rounded-xl pl-9 pr-3 py-1.5 text-xs text-primary placeholder-muted focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Main Canvas & Inspector Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Graph Canvas */}
        <div className="lg:col-span-2 bg-card border border-theme rounded-3xl p-4 shadow-xs relative overflow-hidden min-h-[550px] flex items-center justify-center">
          <svg
            viewBox="0 0 800 700"
            className="w-full h-full cursor-grab active:cursor-grabbing transition-transform duration-200"
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
          >
            {/* Background Grid Pattern & Markers */}
            <defs>
              <pattern id="graph-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" className="text-theme opacity-40" strokeWidth="0.5" />
              </pattern>
              <marker
                id="prereq-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#C2843A" />
              </marker>
              <marker
                id="active-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--color-primary)" />
              </marker>
            </defs>
            <rect width="800" height="700" fill="url(#graph-grid)" />

            {/* Render Edges */}
            <g>
              {edges.map((edge, idx) => {
                const isVisible = displayNodeIds.has(edge.sourceId) && displayNodeIds.has(edge.targetId);
                if (!isVisible) return null;

                const isConnectedToSelected = selectedNode && (selectedNode.id === edge.sourceId || selectedNode.id === edge.targetId);
                const strokeColor = isConnectedToSelected 
                  ? 'var(--color-primary)' 
                  : edge.isPrerequisite 
                    ? '#C2843A' 
                    : '#C9C3B6';

                return (
                  <line
                    key={idx}
                    x1={edge.sourceX}
                    y1={edge.sourceY}
                    x2={edge.targetX}
                    y2={edge.targetY}
                    stroke={strokeColor}
                    strokeWidth={isConnectedToSelected ? 2.5 : edge.isPrerequisite ? 2 : 1.2}
                    strokeDasharray={edge.isPrerequisite ? '4,3' : isConnectedToSelected ? undefined : '2,2'}
                    markerEnd={edge.isPrerequisite ? (isConnectedToSelected ? 'url(#active-arrow)' : 'url(#prereq-arrow)') : undefined}
                    className="transition-all duration-300 opacity-70"
                  />
                );
              })}
            </g>

            {/* Render Nodes */}
            <g>
              {displayNodes.map(node => {
                const isSelected = selectedNode?.id === node.id;
                let fillColor = '#4D7C5D';
                let strokeColor = '#3D634A';
                let textColor = '#FFFFFF';

                if (viewMode === 'heatmap' && node.type === 'topic') {
                  const ret = node.retentionPercent ?? 50;
                  if (ret >= 80) {
                    fillColor = '#10B981';
                    strokeColor = '#059669';
                    textColor = '#FFFFFF';
                  } else if (ret >= 50) {
                    fillColor = '#F59E0B';
                    strokeColor = '#D97706';
                    textColor = '#FFFFFF';
                  } else {
                    fillColor = '#EF4444';
                    strokeColor = '#DC2626';
                    textColor = '#FFFFFF';
                  }
                } else if (node.type === 'subject') {
                  fillColor = '#2F523A';
                  strokeColor = '#1F3726';
                  textColor = '#FFFFFF';
                } else if (node.type === 'chapter') {
                  fillColor = '#6A947A';
                  strokeColor = '#4D7C5D';
                  textColor = '#FFFFFF';
                } else {
                  // Topic
                  if (node.status === 'Mastered') {
                    fillColor = '#3D7C52';
                    strokeColor = '#2E613F';
                  } else if (node.status === 'In Progress') {
                    fillColor = '#C2843A';
                    strokeColor = '#9E6727';
                  } else {
                    fillColor = '#FAF9F5';
                    strokeColor = '#C4BEB1';
                    textColor = '#2D312E';
                  }
                }

                return (
                  <g
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    className="cursor-pointer group"
                    transform={`translate(${node.x}, ${node.y})`}
                  >
                    {/* Outer selection ring */}
                    {isSelected && (
                      <circle
                        r={node.r + 6}
                        fill="none"
                        stroke="var(--color-primary)"
                        strokeWidth="2.5"
                        strokeDasharray="4,3"
                        className="animate-spin"
                        style={{ animationDuration: '10s' }}
                      />
                    )}

                    {/* Main Node Circle */}
                    <circle
                      r={node.r}
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth={isSelected ? 3 : 1.5}
                      className="transition-transform duration-200 group-hover:scale-110 shadow-md"
                    />

                    {/* Node Label inside/beside */}
                    {node.type === 'subject' ? (
                      <text
                        textAnchor="middle"
                        dy="0.3em"
                        fill={textColor}
                        fontSize="9"
                        fontWeight="bold"
                        className="pointer-events-none select-none font-sans"
                      >
                        {node.label.length > 8 ? `${node.label.slice(0, 7)}…` : node.label}
                      </text>
                    ) : viewMode === 'heatmap' && node.type === 'topic' ? (
                      <>
                        <text
                          textAnchor="middle"
                          dy="0.3em"
                          fill={textColor}
                          fontSize="8"
                          fontWeight="bold"
                          className="pointer-events-none select-none font-mono"
                        >
                          {node.retentionPercent}%
                        </text>
                        <text
                          textAnchor="middle"
                          y={node.r + 12}
                          fill="currentColor"
                          fontSize="9"
                          fontWeight="600"
                          className="pointer-events-none select-none text-primary font-sans"
                        >
                          {node.label.length > 14 ? `${node.label.slice(0, 12)}…` : node.label}
                        </text>
                      </>
                    ) : (
                      <text
                        textAnchor="middle"
                        y={node.r + 12}
                        fill="currentColor"
                        fontSize="9"
                        fontWeight="600"
                        className="pointer-events-none select-none text-primary font-sans"
                      >
                        {node.label.length > 14 ? `${node.label.slice(0, 12)}…` : node.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Graph Legend */}
          <div className="absolute bottom-4 left-4 bg-surface/90 backdrop-blur-xs border border-theme rounded-2xl p-3 shadow-xs flex items-center gap-3 text-[10px] font-medium text-primary">
            {viewMode === 'heatmap' ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                  <span>≥80% Retained</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                  <span>50-79% Review</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
                  <span>&lt;50% Critical Blindspot</span>
                </div>
              </>
            ) : viewMode === 'prerequisites' ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2F523A]" />
                  <span>Domain</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#6A947A]" />
                  <span>Chapter Stage</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-0.5 border-t-2 border-dashed border-[#C2843A]" />
                  <span>Prerequisite Dependency</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2F523A]" />
                  <span>Subject</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#6A947A]" />
                  <span>Chapter</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3D7C52]" />
                  <span>Mastered Topic</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#C2843A]" />
                  <span>In Progress</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Node Inspector & Action Drawer */}
        <div className="bg-card border border-theme rounded-3xl p-6 shadow-xs space-y-6">
          <div className="border-b border-theme pb-4">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 uppercase tracking-widest">
              CONCEPT INSPECTOR
            </span>
            <h3 className="text-base font-serif italic font-bold text-primary mt-1">
              {selectedNode ? selectedNode.label : 'Select a Concept Node'}
            </h3>
            <p className="text-xs text-muted mt-0.5">
              {selectedNode 
                ? `${selectedNode.type.toUpperCase()} • ${selectedNode.subjectName}`
                : 'Click any subject, chapter, or topic circle on the graph to inspect connections and launch learning workflows.'}
            </p>
          </div>

          {selectedNode ? (
            <div className="space-y-4">
              {/* Hierarchy Info */}
              <div className="bg-surface rounded-2xl p-4 border border-theme space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Syllabus Hierarchy</div>
                <div className="text-xs text-primary font-semibold flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                  <span>{selectedNode.subjectName}</span>
                  {selectedNode.chapterName && (
                    <>
                      <span>›</span>
                      <span>{selectedNode.chapterName}</span>
                    </>
                  )}
                </div>

                {selectedNode.type === 'topic' && (
                  <>
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-theme">
                      <div className="flex items-center gap-1 text-muted">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Est. Focus: {selectedNode.estimatedMinutes || 45} mins</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold text-[10px]">
                        {selectedNode.status || 'Planned'}
                      </span>
                    </div>

                    {/* Retention Memory Health Bar */}
                    <div className="space-y-1.5 pt-2 border-t border-theme">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-muted uppercase tracking-wider flex items-center gap-1">
                          <Activity className="w-3 h-3 text-primary" />
                          Retention Score
                        </span>
                        <span className="font-mono font-bold text-primary">
                          {selectedNode.retentionPercent ?? 50}%
                        </span>
                      </div>
                      <div className="w-full bg-theme rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            (selectedNode.retentionPercent ?? 50) >= 80 
                              ? 'bg-emerald-500' 
                              : (selectedNode.retentionPercent ?? 50) >= 50 
                                ? 'bg-amber-500' 
                                : 'bg-rose-500'
                          }`}
                          style={{ width: `${selectedNode.retentionPercent ?? 50}%` }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Prerequisites & Unlocks */}
              {((selectedNode.prerequisites && selectedNode.prerequisites.length > 0) || 
                (selectedNode.unlocks && selectedNode.unlocks.length > 0)) && (
                <div className="bg-surface rounded-2xl p-4 border border-theme space-y-3">
                  {selectedNode.prerequisites && selectedNode.prerequisites.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                        <GitBranch className="w-3 h-3 text-amber-600" />
                        Prerequisite Concepts (Study First)
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedNode.prerequisites.map((prereq, pIdx) => (
                          <button
                            key={pIdx}
                            onClick={() => {
                              const match = nodes.find(n => n.label.toLowerCase() === prereq.toLowerCase());
                              if (match) setSelectedNode(match);
                            }}
                            className="text-[11px] px-2.5 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 border border-amber-500/20 font-medium transition cursor-pointer flex items-center gap-1"
                          >
                            <span>{prereq}</span>
                            <ArrowRight className="w-2.5 h-2.5 opacity-60" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedNode.unlocks && selectedNode.unlocks.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-theme">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Unlocks Next
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedNode.unlocks.map((unl, uIdx) => (
                          <button
                            key={uIdx}
                            onClick={() => {
                              const match = nodes.find(n => n.label.toLowerCase() === unl.toLowerCase());
                              if (match) setSelectedNode(match);
                            }}
                            className="text-[11px] px-2.5 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-900 border border-emerald-500/20 font-medium transition cursor-pointer flex items-center gap-1"
                          >
                            <span>{unl}</span>
                            <ArrowRight className="w-2.5 h-2.5 opacity-60" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Direct Integrated Actions */}
              <div className="space-y-2 pt-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Direct Workflows</div>

                {/* 1. Launch Focus Sprint */}
                {onStartFocusSprint && (
                  <button
                    onClick={() => onStartFocusSprint(selectedNode.label)}
                    className="w-full py-2.5 rounded-2xl bg-primary hover:opacity-90 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Start 25-Min Focused Sprint</span>
                  </button>
                )}

                {/* 2. Blurt Recall Arena */}
                {onLaunchBlurtRecall && (
                  <button
                    onClick={() => onLaunchBlurtRecall(selectedNode.label, selectedNode.subjectName)}
                    className="w-full py-2.5 rounded-2xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Brain className="w-4 h-4 text-primary" />
                    <span>Blurt Recall & Gap Analysis</span>
                  </button>
                )}

                {/* 3. Flashcards */}
                {onReviewFlashcards && (
                  <button
                    onClick={() => onReviewFlashcards(selectedNode.label, selectedNode.subjectName)}
                    className="w-full py-2.5 rounded-2xl bg-surface hover:bg-theme-accent text-primary border border-theme text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4 text-primary" />
                    <span>Review Topic Flashcards</span>
                  </button>
                )}

                {/* 4. Challenge in Boss Battle */}
                {onLaunchBossBattle && (
                  <button
                    onClick={() => onLaunchBossBattle(selectedNode.label, selectedNode.subjectName)}
                    className="w-full py-2.5 rounded-2xl bg-[#EDE8DE] hover:bg-[#E3DED4] dark:bg-surface text-primary border border-theme text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Swords className="w-4 h-4 text-primary" />
                    <span>Challenge in RPG Boss Arena</span>
                  </button>
                )}

                {/* 5. Deep Concept Research in Gemini */}
                {onOpenGeminiResearch && (
                  <button
                    onClick={() => onOpenGeminiResearch(selectedNode.label, selectedNode.subjectName)}
                    className="w-full py-2.5 rounded-2xl bg-theme-accent hover:bg-theme-accent/80 text-primary border border-theme text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span>Deep Research with Gemini</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center space-y-3 bg-surface/50 rounded-2xl border border-dashed border-theme">
              <Compass className="w-8 h-8 text-muted mx-auto" />
              <p className="text-xs text-muted leading-relaxed">
                Click any node in the map above to view prerequisite links and trigger focused study actions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
