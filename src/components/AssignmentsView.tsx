import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Play, 
  Sparkles, 
  BookOpen, 
  Tag, 
  Layers, 
  FileText, 
  Paperclip, 
  ExternalLink, 
  Check, 
  Trash2, 
  Edit3, 
  Brain, 
  Award, 
  Kanban, 
  List, 
  ArrowUpDown, 
  CalendarDays, 
  AlertCircle,
  MoreVertical,
  CheckCircle,
  FolderOpen,
  ArrowRight,
  RotateCcw,
  Zap,
  Flame,
  FileCheck
} from 'lucide-react';
import { 
  Assignment, 
  AssignmentPriority, 
  AssignmentStatus, 
  AssignmentType, 
  Subject, 
  StorageVault, 
  ActiveTab 
} from '../types';
import { AssignmentDetailModal } from './AssignmentDetailModal';
import { CreateAssignmentModal } from './CreateAssignmentModal';
import { DumpAssignmentsModal } from './DumpAssignmentsModal';

interface AssignmentsViewProps {
  assignments: Assignment[];
  subjects: Subject[];
  vaults?: StorageVault[];
  onSaveAssignment: (assignment: Assignment) => Promise<string | void> | void;
  onDeleteAssignment: (assignmentId: string) => Promise<void> | void;
  onStartTimerForAssignment?: (assignment: Assignment) => void;
  onAskTutor?: (prompt: string, subjectName?: string, topicName?: string) => void;
  onCreateFlashcards?: (title: string, subjectName: string, notes?: string) => void;
  onLogTestResult?: (assignment: Assignment) => void;
  setActiveTab?: (tab: ActiveTab) => void;
}

type ViewMode = 'list' | 'kanban' | 'calendar';
type FilterStatus = 'all' | 'urgent' | 'due_week' | 'overdue' | 'in_progress' | 'completed';

export const AssignmentsView: React.FC<AssignmentsViewProps> = ({
  assignments = [],
  subjects = [],
  vaults = [],
  onSaveAssignment,
  onDeleteAssignment,
  onStartTimerForAssignment,
  onAskTutor,
  onCreateFlashcards,
  onLogTestResult,
  setActiveTab
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'estimatedTime' | 'title'>('dueDate');

  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDumpModalOpen, setIsDumpModalOpen] = useState(false);

  // Handle batch saving of dumped assignments
  const handleSaveDumpBatch = async (batch: Assignment[]) => {
    for (const asg of batch) {
      await onSaveAssignment(asg);
    }
  };

  // Stats calculation
  const stats = useMemo(() => {
    const total = assignments.length;
    const completed = assignments.filter(a => a.status === 'Completed' || a.status === 'Submitted').length;
    const inProgress = assignments.filter(a => a.status === 'In Progress').length;
    
    // Check overdue
    const todayStr = new Date().toISOString().split('T')[0];
    const overdue = assignments.filter(a => {
      if (a.status === 'Completed' || a.status === 'Submitted') return false;
      return a.dueDate < todayStr;
    }).length;

    const urgent = assignments.filter(a => {
      if (a.status === 'Completed' || a.status === 'Submitted') return false;
      return a.priority === 'Urgent' || a.priority === 'High';
    }).length;

    const totalEstHours = Math.round(assignments.reduce((acc, a) => acc + (a.estimatedMinutes || 60), 0) / 60);
    const totalSpentHours = Math.round(assignments.reduce((acc, a) => acc + (a.timeSpentMinutes || 0), 0) / 60);

    return { total, completed, inProgress, overdue, urgent, totalEstHours, totalSpentHours };
  }, [assignments]);

  // Filtering & Sorting
  const filteredAssignments = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    return assignments.filter(asg => {
      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = asg.title.toLowerCase().includes(query);
        const matchSub = asg.subjectName?.toLowerCase().includes(query);
        const matchChap = asg.chapterName?.toLowerCase().includes(query);
        const matchDesc = asg.description?.toLowerCase().includes(query);
        const matchType = asg.type.toLowerCase().includes(query);
        if (!matchTitle && !matchSub && !matchChap && !matchDesc && !matchType) {
          return false;
        }
      }

      // Status Filter
      if (statusFilter === 'urgent') {
        if (asg.status === 'Completed' || asg.status === 'Submitted' || (asg.priority !== 'Urgent' && asg.priority !== 'High')) return false;
      } else if (statusFilter === 'due_week') {
        if (asg.status === 'Completed' || asg.status === 'Submitted') return false;
        if (asg.dueDate < todayStr || asg.dueDate > sevenDaysFromNow) return false;
      } else if (statusFilter === 'overdue') {
        if (asg.status === 'Completed' || asg.status === 'Submitted' || asg.dueDate >= todayStr) return false;
      } else if (statusFilter === 'in_progress') {
        if (asg.status !== 'In Progress') return false;
      } else if (statusFilter === 'completed') {
        if (asg.status !== 'Completed' && asg.status !== 'Submitted') return false;
      }

      // Subject Filter
      if (subjectFilter !== 'all') {
        if (subjectFilter === 'independent') {
          if (asg.subjectName) return false;
        } else if (asg.subjectName !== subjectFilter) {
          return false;
        }
      }

      // Type Filter
      if (typeFilter !== 'all' && asg.type !== typeFilter) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'dueDate') {
        return a.dueDate.localeCompare(b.dueDate);
      }
      if (sortBy === 'priority') {
        const pOrder: Record<AssignmentPriority, number> = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
        return (pOrder[b.priority] || 0) - (pOrder[a.priority] || 0);
      }
      if (sortBy === 'estimatedTime') {
        return (b.estimatedMinutes || 0) - (a.estimatedMinutes || 0);
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });
  }, [assignments, searchQuery, statusFilter, subjectFilter, typeFilter, sortBy]);

  const handleOpenDetail = (asg: Assignment) => {
    setSelectedAssignment(asg);
    setIsDetailModalOpen(true);
  };

  const handleQuickToggleStatus = async (asg: Assignment, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus: AssignmentStatus = (asg.status === 'Completed' || asg.status === 'Submitted') ? 'In Progress' : 'Completed';
    const updated: Assignment = {
      ...asg,
      status: nextStatus,
      completedAt: nextStatus === 'Completed' ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString()
    };
    await onSaveAssignment(updated);
  };

  const getDueCountdown = (asg: Assignment) => {
    try {
      const dueDateTimeStr = asg.dueTime ? `${asg.dueDate}T${asg.dueTime}:00` : `${asg.dueDate}T23:59:59`;
      const dueTimestamp = new Date(dueDateTimeStr).getTime();
      const diffMs = dueTimestamp - Date.now();

      if (asg.status === 'Completed' || asg.status === 'Submitted') {
        return { text: 'Done', isOverdue: false, isUrgent: false };
      }

      if (diffMs < 0) {
        const overdueDays = Math.abs(Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        return {
          text: overdueDays === 0 ? 'Due Today (Overdue)' : `${overdueDays}d overdue`,
          isOverdue: true,
          isUrgent: true
        };
      }

      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);

      if (diffDays === 0) {
        return { text: `${diffHours}h left`, isOverdue: false, isUrgent: true };
      }
      if (diffDays === 1) {
        return { text: 'Tomorrow', isOverdue: false, isUrgent: true };
      }
      return { text: `In ${diffDays} days`, isOverdue: false, isUrgent: diffDays <= 2 };
    } catch {
      return { text: asg.dueDate, isOverdue: false, isUrgent: false };
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-primary">
      
      {/* Top Header & Stat Metric Cards */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif italic text-primary tracking-tight flex items-center gap-3">
            <span>Assignment & Deadline Manager</span>
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary not-italic">
              {assignments.length} Tasks
            </span>
          </h1>
          <p className="text-xs text-muted mt-1">
            Track coursework, homework, projects, and upcoming exam deadlines with AI study prep breakdowns.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Switcher */}
          <div className="p-1 rounded-2xl bg-theme-accent/60 border border-theme flex items-center">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'list' ? 'bg-white dark:bg-[#252825] text-primary shadow-xs' : 'text-muted hover:text-primary'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'kanban' ? 'bg-white dark:bg-[#252825] text-primary shadow-xs' : 'text-muted hover:text-primary'
              }`}
              title="Kanban View"
            >
              <Kanban className="w-4 h-4" />
              <span className="hidden sm:inline">Board</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'calendar' ? 'bg-white dark:bg-[#252825] text-primary shadow-xs' : 'text-muted hover:text-primary'
              }`}
              title="Timeline View"
            >
              <CalendarDays className="w-4 h-4" />
              <span className="hidden sm:inline">Schedule</span>
            </button>
          </div>

          {/* AI Fast Dump Button */}
          <button
            id="btn-dump-assignments"
            onClick={() => setIsDumpModalOpen(true)}
            className="px-3.5 py-2 rounded-2xl bg-theme-accent/60 border border-theme text-xs font-bold flex items-center gap-2 hover:bg-theme-accent hover:border-primary/40 text-primary transition shadow-2xs cursor-pointer shrink-0"
            title="Dump all coursework & homework tasks at once via text list or PDF syllabus upload"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Fast Dump / Bulk Import</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-primary text-white text-xs font-bold flex items-center gap-2 hover:bg-primary/90 transition shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Assignment</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl bg-card border border-theme">
          <span className="text-[10px] font-mono text-muted uppercase block font-bold">Total Deadlines</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-primary">{stats.total}</span>
            <span className="text-xs text-muted">items</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-theme">
          <span className="text-[10px] font-mono text-muted uppercase block font-bold">High / Urgent</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-amber-600">{stats.urgent}</span>
            <span className="text-xs text-muted">due soon</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-theme">
          <span className="text-[10px] font-mono text-muted uppercase block font-bold">Overdue Tasks</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-rose-600">{stats.overdue}</span>
            <span className="text-xs text-muted">late</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-theme">
          <span className="text-[10px] font-mono text-muted uppercase block font-bold">Completed / Submitted</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-emerald-600">{stats.completed}</span>
            <span className="text-xs text-muted">finished</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-theme col-span-2 sm:col-span-1">
          <span className="text-[10px] font-mono text-muted uppercase block font-bold">Study Time Logged</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-primary">{stats.totalSpentHours}h</span>
            <span className="text-xs text-muted">/ {stats.totalEstHours}h est</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="p-4 rounded-3xl bg-card border border-theme space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assignments, topics, guidelines, notes..."
              className="w-full pl-10 pr-4 py-2 rounded-2xl bg-theme-accent/40 border border-theme text-xs font-medium text-primary focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            {/* Subject filter */}
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-theme-accent/40 border border-theme text-xs font-medium text-primary"
            >
              <option value="all">All Subjects</option>
              <option value="independent">Independent / General</option>
              {subjects.map(s => (
                <option key={s.id || s.name} value={s.name}>{s.icon || '📚'} {s.name}</option>
              ))}
            </select>

            {/* Type filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-theme-accent/40 border border-theme text-xs font-medium text-primary"
            >
              <option value="all">All Types</option>
              <option value="Homework">Homework</option>
              <option value="Assignment">Assignment</option>
              <option value="Project">Project</option>
              <option value="Test">Test / Exam</option>
              <option value="Quiz">Quiz</option>
              <option value="Presentation">Presentation</option>
              <option value="Lab work">Lab Work</option>
            </select>

            {/* Sort by */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-theme-accent/40 border border-theme text-xs font-medium text-primary font-mono"
            >
              <option value="dueDate">Sort: Due Date</option>
              <option value="priority">Sort: Priority</option>
              <option value="estimatedTime">Sort: Est. Time</option>
              <option value="title">Sort: Title</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: 'All Items' },
            { id: 'urgent', label: '🔥 Urgent & High Priority' },
            { id: 'due_week', label: '📅 Due This Week' },
            { id: 'overdue', label: '⚠️ Overdue' },
            { id: 'in_progress', label: '⚡ In Progress' },
            { id: 'completed', label: '✅ Completed' }
          ].map(chip => (
            <button
              key={chip.id}
              onClick={() => setStatusFilter(chip.id as FilterStatus)}
              className={`px-3 py-1.5 rounded-full font-bold transition whitespace-nowrap cursor-pointer ${
                statusFilter === chip.id
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-theme-accent text-muted hover:text-primary'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Views */}

      {/* 1. LIST VIEW */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {filteredAssignments.length > 0 ? (
            filteredAssignments.map((asg) => {
              const countdown = getDueCountdown(asg);
              const subtasks = asg.subtasks || [];
              const completedSubtasks = subtasks.filter(s => s.completed).length;
              const isFinished = asg.status === 'Completed' || asg.status === 'Submitted';

              return (
                <div
                  key={asg.id}
                  onClick={() => handleOpenDetail(asg)}
                  className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isFinished
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300/60 dark:border-emerald-900/30 opacity-85'
                      : countdown.isOverdue
                      ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/50 hover:border-rose-400'
                      : 'bg-card border-theme hover:border-primary/50 shadow-xs'
                  }`}
                >
                  {/* Left block: Checkbox, Icon, Title, Subject, Badges */}
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    <button
                      onClick={(e) => handleQuickToggleStatus(asg, e)}
                      className={`w-6 h-6 rounded-xl flex items-center justify-center transition shrink-0 cursor-pointer border mt-0.5 sm:mt-0 ${
                        isFinished
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-theme bg-surface hover:border-primary text-transparent'
                      }`}
                      title={isFinished ? 'Mark In Progress' : 'Mark as Completed'}
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                    </button>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold bg-theme-accent text-primary border border-theme">
                          {asg.type}
                        </span>

                        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold ${
                          asg.priority === 'Urgent' ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300' :
                          asg.priority === 'High' ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' :
                          asg.priority === 'Medium' ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' :
                          'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                        }`}>
                          {asg.priority}
                        </span>

                        {asg.subjectName && (
                          <span className="text-[11px] font-bold text-primary flex items-center gap-1">
                            <BookOpen className="w-3 h-3 text-primary/70" />
                            {asg.subjectName}
                          </span>
                        )}

                        {asg.chapterName && (
                          <span className="text-[10px] text-muted truncate max-w-[150px]">
                            › {asg.chapterName}
                          </span>
                        )}
                      </div>

                      <h3 className={`font-bold text-sm sm:text-base tracking-tight truncate ${isFinished ? 'line-through text-muted' : 'text-primary'}`}>
                        {asg.title}
                      </h3>

                      {/* Subtask count or preview */}
                      <div className="flex items-center gap-3 text-[11px] text-muted flex-wrap">
                        {subtasks.length > 0 && (
                          <span className="flex items-center gap-1 font-mono">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            {completedSubtasks}/{subtasks.length} subtasks
                          </span>
                        )}
                        <span>• Est: {asg.estimatedMinutes || 60}m</span>
                        {asg.timeSpentMinutes ? (
                          <span className="text-primary font-medium">• Spent: {asg.timeSpentMinutes}m</span>
                        ) : null}
                        {(asg.attachments || []).length > 0 && (
                          <span className="flex items-center gap-1 text-primary">
                            <Paperclip className="w-3 h-3" />
                            {asg.attachments?.length} files
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right block: Countdown Badge & Quick Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-theme/40">
                    <div className="text-left sm:text-right">
                      <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-xl flex items-center gap-1 border ${
                        countdown.isOverdue
                          ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
                          : countdown.isUrgent
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                          : isFinished
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300'
                          : 'bg-theme-accent text-primary border-theme'
                      }`}>
                        <Clock className="w-3 h-3" />
                        {countdown.text}
                      </span>
                      <span className="text-[10px] text-muted font-mono block mt-0.5">
                        Due {new Date(asg.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onStartTimerForAssignment) onStartTimerForAssignment(asg);
                        }}
                        className="p-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition shadow-xs cursor-pointer"
                        title="Start Focus Timer on this Assignment"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onAskTutor) {
                            onAskTutor(`Guide me on: ${asg.title} (${asg.subjectName || 'General'})`, asg.subjectName, asg.topicName);
                          }
                        }}
                        className="p-2 rounded-xl bg-theme-accent border border-theme text-primary hover:bg-theme-accent/80 transition cursor-pointer"
                        title="Ask AI Tutor for guidance"
                      >
                        <Brain className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 rounded-3xl bg-card border border-dashed border-theme text-center space-y-3">
              <FileCheck className="w-12 h-12 text-muted mx-auto" />
              <h3 className="font-bold text-base text-primary">No assignments found matching filters</h3>
              <p className="text-xs text-muted max-w-sm mx-auto">
                Create a new assignment or clear your search filters to view upcoming deadlines.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setIsDumpModalOpen(true)}
                  className="px-5 py-2.5 rounded-2xl bg-theme-accent/70 border border-theme text-primary text-xs font-bold hover:bg-theme-accent hover:border-primary/40 transition shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Fast Dump All Coursework</span>
                </button>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-5 py-2.5 rounded-2xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Assignment</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. KANBAN BOARD VIEW */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { status: 'Not Started', label: 'Not Started', color: 'border-zinc-300 dark:border-zinc-700' },
            { status: 'In Progress', label: 'In Progress', color: 'border-blue-300 dark:border-blue-800' },
            { status: 'Overdue', label: 'Overdue / Urgent', color: 'border-rose-300 dark:border-rose-800' },
            { status: 'Completed', label: 'Completed / Submitted', color: 'border-emerald-300 dark:border-emerald-800' }
          ].map(col => {
            const colItems = filteredAssignments.filter(a => {
              if (col.status === 'Completed') return a.status === 'Completed' || a.status === 'Submitted';
              if (col.status === 'Overdue') {
                const today = new Date().toISOString().split('T')[0];
                return a.status !== 'Completed' && a.status !== 'Submitted' && (a.dueDate < today || a.priority === 'Urgent');
              }
              return a.status === col.status;
            });

            return (
              <div key={col.status} className="p-4 rounded-3xl bg-card border border-theme space-y-3 min-h-[400px] flex flex-col">
                <div className="flex items-center justify-between border-b border-theme/60 pb-2.5">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                    <span>{col.label}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-theme-accent text-primary font-bold">
                      {colItems.length}
                    </span>
                  </h3>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto">
                  {colItems.map(asg => {
                    const countdown = getDueCountdown(asg);
                    return (
                      <div
                        key={asg.id}
                        onClick={() => handleOpenDetail(asg)}
                        className="p-3.5 rounded-2xl bg-surface border border-theme hover:border-primary/50 transition cursor-pointer space-y-2"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-card border border-theme font-bold">
                            {asg.type}
                          </span>
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold ${
                            countdown.isOverdue ? 'bg-rose-500 text-white' : 'bg-primary/10 text-primary'
                          }`}>
                            {countdown.text}
                          </span>
                        </div>

                        <h4 className="font-bold text-xs text-primary leading-snug line-clamp-2">
                          {asg.title}
                        </h4>

                        {asg.subjectName && (
                          <div className="text-[10px] text-muted flex items-center gap-1 truncate">
                            <BookOpen className="w-3 h-3 text-primary" />
                            <span>{asg.subjectName}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-theme/40 text-[10px] text-muted">
                          <span>{asg.estimatedMinutes}m est</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onStartTimerForAssignment) onStartTimerForAssignment(asg);
                            }}
                            className="p-1 rounded-lg bg-primary text-white hover:bg-primary/90"
                          >
                            <Play className="w-2.5 h-2.5 fill-white" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {colItems.length === 0 && (
                    <div className="h-24 rounded-2xl border border-dashed border-theme flex items-center justify-center text-[11px] text-muted">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. CALENDAR TIMELINE VIEW */}
      {viewMode === 'calendar' && (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl bg-card border border-theme space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-primary">
              Upcoming Deadlines Timeline
            </h3>

            {/* Group by Due Date */}
            {(() => {
              const groupedByDate: Record<string, Assignment[]> = {};
              filteredAssignments.forEach(asg => {
                const dateKey = asg.dueDate;
                if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
                groupedByDate[dateKey].push(asg);
              });

              const sortedDates = Object.keys(groupedByDate).sort();

              if (sortedDates.length === 0) {
                return (
                  <div className="p-8 text-center text-xs text-muted">
                    No scheduled assignment dates found.
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {sortedDates.map(dateStr => {
                    const items = groupedByDate[dateStr];
                    const dateObj = new Date(dateStr);
                    const isToday = new Date().toISOString().split('T')[0] === dateStr;

                    return (
                      <div key={dateStr} className="p-4 rounded-2xl bg-theme-accent/20 border border-theme space-y-2.5">
                        <div className="flex items-center justify-between border-b border-theme/50 pb-2">
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4 text-primary" />
                            <span className="font-bold text-xs text-primary">
                              {dateObj.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            {isToday && (
                              <span className="px-2 py-0.5 rounded-full bg-primary text-white text-[9px] font-bold">
                                Today
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-muted font-bold">
                            {items.length} Due
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {items.map(asg => (
                            <div
                              key={asg.id}
                              onClick={() => handleOpenDetail(asg)}
                              className="p-3 rounded-xl bg-card border border-theme hover:border-primary/40 transition cursor-pointer flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded-md bg-theme-accent text-primary font-bold">
                                    {asg.type}
                                  </span>
                                  <span className="font-bold text-xs text-primary truncate">{asg.title}</span>
                                </div>
                                <span className="text-[10px] text-muted block truncate mt-0.5">
                                  {asg.subjectName ? `${asg.subjectName} • ` : ''}Due {asg.dueTime || '23:59'}
                                </span>
                              </div>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onStartTimerForAssignment) onStartTimerForAssignment(asg);
                                }}
                                className="p-1.5 rounded-lg bg-primary text-white shrink-0 hover:bg-primary/90"
                              >
                                <Play className="w-3 h-3 fill-white" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modals */}
      {isDetailModalOpen && (
        <AssignmentDetailModal
          assignment={selectedAssignment}
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedAssignment(null);
          }}
          subjects={subjects}
          vaults={vaults}
          onSaveAssignment={onSaveAssignment}
          onDeleteAssignment={onDeleteAssignment}
          onStartTimerForAssignment={onStartTimerForAssignment}
          onAskTutor={onAskTutor}
          onCreateFlashcards={onCreateFlashcards}
          onLogTestResult={onLogTestResult}
          setActiveTab={setActiveTab}
        />
      )}

      {isCreateModalOpen && (
        <CreateAssignmentModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          subjects={subjects}
          vaults={vaults}
          onSaveAssignment={onSaveAssignment}
          existingAssignments={assignments}
        />
      )}

      {isDumpModalOpen && (
        <DumpAssignmentsModal
          isOpen={isDumpModalOpen}
          onClose={() => setIsDumpModalOpen(false)}
          subjects={subjects}
          vaults={vaults}
          onSaveBatch={handleSaveDumpBatch}
        />
      )}

    </div>
  );
};
