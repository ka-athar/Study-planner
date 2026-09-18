import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Search, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Play, 
  Mic, 
  Zap, 
  Brain, 
  Info,
  Maximize2,
  Filter,
  Layers
} from 'lucide-react';
import { Subject, Topic } from '../types';

interface KnowledgeTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  onStartTimerForTopic: (subjectName: string, chapterName: string, topicName: string) => void;
  onStartBlurtForTopic?: (subjectName: string, chapterName: string, topicName: string) => void;
  onStartFeynmanForTopic?: (subjectName: string, topicName: string) => void;
}

interface TreeNode {
  id: string;
  name: string;
  type: 'subject' | 'chapter' | 'topic';
  subjectName: string;
  chapterName?: string;
  x: number;
  y: number;
  radius: number;
  mastery: number; // 0 - 100
  status: 'mastered' | 'learning' | 'blind_spot';
  color: string;
  icon?: string;
}

interface TreeLink {
  sourceId: string;
  targetId: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  color: string;
}

export const KnowledgeTreeModal: React.FC<KnowledgeTreeModalProps> = ({
  isOpen,
  onClose,
  subjects,
  onStartTimerForTopic,
  onStartBlurtForTopic,
  onStartFeynmanForTopic
}) => {
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [blindSpotsOnly, setBlindSpotsOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const startPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Compute Layout of Nodes and Links
  const { nodes, links, stats } = useMemo(() => {
    const calculatedNodes: TreeNode[] = [];
    const calculatedLinks: TreeLink[] = [];

    let totalTopics = 0;
    let masteredCount = 0;
    let blindSpotCount = 0;

    const filteredSubjects = selectedSubjectFilter === 'all' 
      ? subjects 
      : subjects.filter(s => s.name === selectedSubjectFilter);

    const centerX = 480;
    const centerY = 360;
    const subjectRadius = 180;

    filteredSubjects.forEach((sub, subIdx) => {
      // Calculate Subject Root Node
      const subAngle = (subIdx / Math.max(1, filteredSubjects.length)) * 2 * Math.PI - Math.PI / 2;
      const subX = filteredSubjects.length === 1 ? centerX : centerX + Math.cos(subAngle) * subjectRadius;
      const subY = filteredSubjects.length === 1 ? centerY : centerY + Math.sin(subAngle) * subjectRadius;

      const subjectNode: TreeNode = {
        id: `sub-${sub.id}`,
        name: sub.name,
        type: 'subject',
        subjectName: sub.name,
        x: subX,
        y: subY,
        radius: 28,
        mastery: 75,
        status: 'mastered',
        color: sub.color || '#6B705C',
        icon: sub.icon || '📚'
      };
      calculatedNodes.push(subjectNode);

      // Chapters
      const chapters = sub.chapters || [];
      const chapterSpreadRadius = 90;

      chapters.forEach((chap, chapIdx) => {
        const chapAngle = subAngle + ((chapIdx - (chapters.length - 1) / 2) * 0.45);
        const chapX = subX + Math.cos(chapAngle) * chapterSpreadRadius;
        const chapY = subY + Math.sin(chapAngle) * chapterSpreadRadius;

        const chapterNode: TreeNode = {
          id: `chap-${chap.id}`,
          name: chap.name,
          type: 'chapter',
          subjectName: sub.name,
          chapterName: chap.name,
          x: chapX,
          y: chapY,
          radius: 18,
          mastery: 60,
          status: 'learning',
          color: '#A5A58D'
        };
        calculatedNodes.push(chapterNode);

        calculatedLinks.push({
          sourceId: subjectNode.id,
          targetId: chapterNode.id,
          sourceX: subX,
          sourceY: subY,
          targetX: chapX,
          targetY: chapY,
          color: sub.color || '#6B705C'
        });

        // Topics (Orbital stars around chapter)
        const topics = chap.topics || [];
        const topicSpreadRadius = 60;

        topics.forEach((top, topIdx) => {
          totalTopics++;
          const topAngle = chapAngle + ((topIdx - (topics.length - 1) / 2) * 0.55);
          const topX = chapX + Math.cos(topAngle) * topicSpreadRadius;
          const topY = chapY + Math.sin(topAngle) * topicSpreadRadius;

          // Estimate topic mastery
          const isCompleted = top.completed;
          const mastery = isCompleted ? 90 : (top.priority === 'High' ? 25 : 55);
          const status = mastery >= 80 ? 'mastered' : mastery < 40 ? 'blind_spot' : 'learning';

          if (status === 'mastered') masteredCount++;
          if (status === 'blind_spot') blindSpotCount++;

          const topicNode: TreeNode = {
            id: `top-${top.id}`,
            name: top.name,
            type: 'topic',
            subjectName: sub.name,
            chapterName: chap.name,
            x: topX,
            y: topY,
            radius: 11,
            mastery,
            status,
            color: status === 'mastered' ? '#10B981' : status === 'blind_spot' ? '#F43F5E' : '#F59E0B'
          };

          calculatedNodes.push(topicNode);

          calculatedLinks.push({
            sourceId: chapterNode.id,
            targetId: topicNode.id,
            sourceX: chapX,
            sourceY: chapY,
            targetX: topX,
            targetY: topY,
            color: status === 'blind_spot' ? '#F43F5E66' : '#E0DBD0'
          });
        });
      });
    });

    return { 
      nodes: calculatedNodes, 
      links: calculatedLinks,
      stats: { totalTopics, masteredCount, blindSpotCount }
    };
  }, [subjects, selectedSubjectFilter]);

  // Filter nodes based on search & blind spot toggles
  const visibleNodes = useMemo(() => {
    return nodes.filter(n => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return n.name.toLowerCase().includes(query) || n.subjectName.toLowerCase().includes(query);
      }
      if (blindSpotsOnly && n.type === 'topic') {
        return n.status === 'blind_spot';
      }
      return true;
    });
  }, [nodes, searchQuery, blindSpotsOnly]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map(n => n.id)), [visibleNodes]);

  const visibleLinks = useMemo(() => {
    return links.filter(l => visibleNodeIds.has(l.sourceId) && visibleNodeIds.has(l.targetId));
  }, [links, visibleNodeIds]);

  // Handle Drag & Pan Canvas
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName.toLowerCase() === 'circle') return;
    isDraggingRef.current = true;
    startPanRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    setPanOffset({
      x: e.clientX - startPanRef.current.x,
      y: e.clientY - startPanRef.current.y
    });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-fade-in" onClick={onClose}>
      <div 
        className="w-full max-w-6xl h-[92vh] rounded-3xl bg-[#FAF8F5] shadow-2xl border border-[#E0DBD0] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Control Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-[#E0DBD0] bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-700">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#4A4E4D]">Visual Knowledge Tree & Concept Map</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 hidden sm:inline">
                  Interactive Constellation
                </span>
              </div>
              <p className="text-xs text-[#6B705C] hidden sm:block">Explore syllabus dependencies, masteries & spot exam blind spots</p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{stats.masteredCount} Mastered</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 font-semibold">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span>{stats.blindSpotCount} Blind Spots</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#A5A58D] hover:text-[#4A4E4D] hover:bg-[#F2EFE9] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter and Search Action Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-[#FAF8F5] border-b border-[#E0DBD0] text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Subject Selector */}
            <select
              value={selectedSubjectFilter}
              onChange={e => setSelectedSubjectFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-[#E0DBD0] bg-white font-semibold text-[#4A4E4D]"
            >
              <option value="all">🌌 All Subjects ({subjects.length})</option>
              {subjects.map(s => (
                <option key={s.id} value={s.name}>{s.icon || '📚'} {s.name}</option>
              ))}
            </select>

            {/* Blind Spot Filter Button */}
            <button
              onClick={() => setBlindSpotsOnly(!blindSpotsOnly)}
              className={`px-3 py-1.5 rounded-xl font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                blindSpotsOnly
                  ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                  : 'bg-white text-[#6B705C] border-[#E0DBD0] hover:bg-rose-50'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{blindSpotsOnly ? 'Showing Blind Spots Only' : 'Highlight Blind Spots'}</span>
            </button>
          </div>

          {/* Search Bar & Zoom Controls */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#A5A58D] absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search concepts or topics..."
                className="pl-8 pr-3 py-1.5 rounded-xl border border-[#E0DBD0] bg-white text-xs w-44 sm:w-56 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center rounded-xl border border-[#E0DBD0] bg-white overflow-hidden">
              <button 
                onClick={() => setZoomLevel(prev => Math.min(2.5, prev + 0.2))} 
                className="p-1.5 hover:bg-[#F2EFE9] text-[#6B705C] cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setZoomLevel(prev => Math.max(0.6, prev - 0.2))} 
                className="p-1.5 hover:bg-[#F2EFE9] text-[#6B705C] cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => { setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); }} 
                className="p-1.5 hover:bg-[#F2EFE9] text-[#6B705C] cursor-pointer"
                title="Reset View"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Interactive Constellation SVG Canvas */}
        <div 
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing bg-[#121316] select-none"
        >
          {/* Ambient Background Grid */}
          <div 
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
              backgroundSize: '24px 24px'
            }}
          />

          <svg 
            className="w-full h-full"
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
              transformOrigin: 'center center',
              transition: isDraggingRef.current ? 'none' : 'transform 0.15s ease-out'
            }}
          >
            {/* Synaptic Links */}
            {visibleLinks.map((link, idx) => (
              <line
                key={`link-${idx}`}
                x1={link.sourceX}
                y1={link.sourceY}
                x2={link.targetX}
                y2={link.targetY}
                stroke={link.color}
                strokeWidth={1.5}
                strokeOpacity={0.4}
                strokeDasharray={link.color.includes('F43F5E') ? '3 3' : 'none'}
              />
            ))}

            {/* Nodes */}
            {visibleNodes.map(node => {
              const isSelected = selectedNode?.id === node.id;
              return (
                <g 
                  key={node.id} 
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={() => setSelectedNode(node)}
                  className="cursor-pointer group"
                >
                  {/* Outer Glow Halo */}
                  <circle
                    r={node.radius + (isSelected ? 6 : 3)}
                    fill={node.color}
                    fillOpacity={node.status === 'blind_spot' ? 0.35 : 0.15}
                    className={node.status === 'blind_spot' ? 'animate-pulse' : ''}
                  />

                  {/* Core Node Circle */}
                  <circle
                    r={node.radius}
                    fill={node.color}
                    stroke={isSelected ? '#ffffff' : 'rgba(255,255,255,0.4)'}
                    strokeWidth={isSelected ? 3 : 1.5}
                    className="transition-transform duration-200 group-hover:scale-110"
                  />

                  {/* Icon or Status dot */}
                  {node.type === 'subject' && (
                    <text
                      textAnchor="middle"
                      dy="0.35em"
                      fill="#ffffff"
                      fontSize={16}
                      fontWeight="bold"
                    >
                      {node.icon || '📚'}
                    </text>
                  )}

                  {/* Label Text */}
                  <text
                    textAnchor="middle"
                    y={node.radius + 12}
                    fill="#FDFCF9"
                    fontSize={node.type === 'subject' ? 12 : node.type === 'chapter' ? 10 : 8.5}
                    fontWeight={node.type === 'subject' ? 'bold' : 'normal'}
                    className="pointer-events-none drop-shadow-md"
                  >
                    {node.name.length > 20 ? `${node.name.slice(0, 18)}...` : node.name}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Node Action Drawer / Detail Card */}
          {selectedNode && (
            <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:w-96 rounded-3xl bg-white/95 backdrop-blur-md p-5 border border-[#E0DBD0] shadow-2xl animate-fade-in text-xs space-y-3 z-10">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#A5A58D]">
                    {selectedNode.type.toUpperCase()} • {selectedNode.subjectName}
                  </span>
                  <h3 className="text-sm font-bold text-[#4A4E4D] mt-0.5">{selectedNode.name}</h3>
                </div>
                <button 
                  onClick={() => setSelectedNode(null)}
                  className="text-[#A5A58D] hover:text-[#4A4E4D] p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {selectedNode.type === 'topic' && (
                <>
                  <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#FAF8F5] border border-[#E0DBD0]">
                    <span className="text-[#6B705C]">Calculated Mastery</span>
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className={
                        selectedNode.status === 'mastered' ? 'text-emerald-600' :
                        selectedNode.status === 'blind_spot' ? 'text-rose-600' : 'text-amber-600'
                      }>
                        {selectedNode.mastery}%
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white border border-[#E0DBD0] uppercase">
                        {selectedNode.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {onStartFeynmanForTopic && (
                      <button
                        onClick={() => {
                          onStartFeynmanForTopic(selectedNode.subjectName, selectedNode.name);
                          onClose();
                        }}
                        className="p-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                      >
                        <Mic className="w-3.5 h-3.5" />
                        <span>Feynman Defense</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        onStartTimerForTopic(selectedNode.subjectName, selectedNode.chapterName || '', selectedNode.name);
                        onClose();
                      }}
                      className="p-2.5 rounded-xl bg-[#6B705C] hover:bg-[#585D4A] text-white font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>Start 25m Timer</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Canvas Guide Legend */}
          <div className="absolute top-4 left-4 p-3 rounded-2xl bg-black/60 backdrop-blur-md text-white/90 text-[11px] space-y-1.5 pointer-events-none hidden sm:block">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span>Mastered Topic (80%+)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span>In-Progress / Review</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <span>Critical Blind Spot (&lt;40%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
