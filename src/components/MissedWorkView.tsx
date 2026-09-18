import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Plus, 
  Sparkles, 
  ArrowRight, 
  Play, 
  RotateCcw, 
  Trash2, 
  Filter, 
  Search, 
  ShieldAlert, 
  CalendarCheck, 
  BookOpen, 
  FileText, 
  Check, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Award,
  Zap,
  Info
} from 'lucide-react';
import { 
  MissedWorkItem, 
  MissedWorkStatus, 
  MissedWorkType, 
  MissedWorkPriority, 
  Subject, 
  UserProfile, 
  StudyPlan,
  ActiveTab
} from '../types';
import { 
  generateRecoveryPlan, 
  applyRecoveryPlanToMissedWork, 
  getTodayDateString 
} from '../lib/missedWorkService';

interface MissedWorkViewProps {
  missedWork: MissedWorkItem[];
  subjects: Subject[];
  userProfile: UserProfile | null;
  plans: StudyPlan[];
  onSaveMissedWorkItem: (item: MissedWorkItem) => Promise<void> | void;
  onSaveAllMissedWork: (items: MissedWorkItem[]) => Promise<void> | void;
  onDeleteMissedWorkItem: (id: string) => Promise<void> | void;
  onStartTimerForTopic?: (subjectName: string, chapterName: string, topicName: string) => void;
  onAutoDetectOverdue?: () => void;
  setActiveTab?: (tab: ActiveTab) => void;
}

export const MissedWorkView: React.FC<MissedWorkViewProps> = ({
  missedWork = [],
  subjects = [],
  userProfile,
  plans = [],
  onSaveMissedWorkItem,
  onSaveAllMissedWork,
  onDeleteMissedWorkItem,
  onStartTimerForTopic,
  onAutoDetectOverdue,
  setActiveTab
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | MissedWorkStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | MissedWorkType>('all');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [reschedulingItemId, setReschedulingItemId] = useState<string | null>(null);
  const [customRescheduleDate, setCustomRescheduleDate] = useState<string>(getTodayDateString());
  const [customRescheduleSlot, setCustomRescheduleSlot] = useState<string>('evening');
  const [recoveryAppliedToast, setRecoveryAppliedToast] = useState<string | null>(null);

  // Form State for Manual Entry
  const [manualTitle, setManualTitle] = useState('');
  const [manualSubject, setManualSubject] = useState(subjects[0]?.name || 'Physics');
  const [manualChapter, setManualChapter] = useState('');
  const [manualType, setManualType] = useState<MissedWorkType>('test');
  const [manualDeadline, setManualDeadline] = useState(getTodayDateString());
  const [manualMinutes, setManualMinutes] = useState(45);
  const [manualPriority, setManualPriority] = useState<MissedWorkPriority>('High');
  const [manualStatus, setManualStatus] = useState<MissedWorkStatus>('Missed');
  const [manualNotes, setManualNotes] = useState('');

  const todayStr = useMemo(() => getTodayDateString(), []);

  // Compute AI Recovery Plan
  const { suggestions, nextActionItem, totalEstimatedMinutes } = useMemo(() => {
    return generateRecoveryPlan(missedWork, userProfile);
  }, [missedWork, userProfile]);

  // Counts
  const counts = useMemo(() => {
    return {
      all: missedWork.length,
      missed: missedWork.filter(m => m.status === 'Missed').length,
      pending: missedWork.filter(m => m.status === 'Pending').length,
      rescheduled: missedWork.filter(m => m.status === 'Rescheduled').length,
      completed: missedWork.filter(m => m.status === 'Completed').length
    };
  }, [missedWork]);

  // Filtered List
  const filteredList = useMemo(() => {
    return missedWork.filter(item => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.subjectName.toLowerCase().includes(q) ||
          (item.chapterName && item.chapterName.toLowerCase().includes(q)) ||
          (item.notes && item.notes.toLowerCase().includes(q))
        );
      }
      return true;
    }).sort((a, b) => {
      // Show active (Missed / Pending) first, then Rescheduled, then Completed
      const statusOrder = { Missed: 1, Pending: 2, Rescheduled: 3, Completed: 4 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return a.originalDeadline.localeCompare(b.originalDeadline);
    });
  }, [missedWork, statusFilter, typeFilter, searchQuery]);

  // Apply Full Recovery Plan
  const handleApplyRecoveryPlan = async () => {
    if (suggestions.length === 0) return;
    const updated = applyRecoveryPlanToMissedWork(missedWork, suggestions);
    await onSaveAllMissedWork(updated);
    setRecoveryAppliedToast(`Successfully scheduled ${suggestions.length} catch-up sessions across your upcoming days.`);
    setTimeout(() => setRecoveryAppliedToast(null), 5000);
  };

  // Change single item status
  const handleStatusChange = async (item: MissedWorkItem, newStatus: MissedWorkStatus) => {
    if (newStatus === 'Rescheduled') {
      setReschedulingItemId(item.id);
      return;
    }

    const updated: MissedWorkItem = {
      ...item,
      status: newStatus,
      completedAt: newStatus === 'Completed' ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString()
    };
    await onSaveMissedWorkItem(updated);
  };

  // Commit Rescheduling
  const handleCommitReschedule = async (item: MissedWorkItem) => {
    const updated: MissedWorkItem = {
      ...item,
      status: 'Rescheduled',
      rescheduledDate: customRescheduleDate,
      rescheduledTimeslot: customRescheduleSlot,
      notes: item.notes 
        ? `${item.notes}\n[Rescheduled to ${customRescheduleDate} (${customRescheduleSlot})]` 
        : `[Rescheduled to ${customRescheduleDate} (${customRescheduleSlot})]`,
      updatedAt: new Date().toISOString()
    };
    await onSaveMissedWorkItem(updated);
    setReschedulingItemId(null);
  };

  // Submit Manual Entry Form
  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim()) return;

    const newItem: MissedWorkItem = {
      id: `manual-missed-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: manualType,
      title: manualTitle.trim(),
      subjectName: manualSubject,
      chapterName: manualChapter.trim() || undefined,
      originalDeadline: manualDeadline,
      status: manualStatus,
      priority: manualPriority,
      detectedAutomatically: false,
      estimatedMinutes: Number(manualMinutes) || 45,
      notes: manualNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await onSaveMissedWorkItem(newItem);
    setIsManualModalOpen(false);

    // Reset Form
    setManualTitle('');
    setManualChapter('');
    setManualNotes('');
    setManualMinutes(45);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-theme">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/25">
              Academic Accountability Engine
            </span>
            <span className="text-xs text-muted">• Overdue Tasks & Catch-up Plan</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-primary tracking-tight mt-1 flex items-center gap-3">
            Missed Work & Recovery Plan
          </h1>
          <p className="text-sm text-muted mt-1 max-w-2xl">
            Automatically track past tests, assignments, and tasks that missed their deadline. 
            Follow your personalized AI recovery timeline so you never fall behind.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {onAutoDetectOverdue && (
            <button
              onClick={onAutoDetectOverdue}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-theme-accent hover:bg-theme-accent/80 text-primary border border-theme text-xs font-semibold transition cursor-pointer shadow-xs"
              title="Scan all plans & assignments to auto-detect any overdue items"
            >
              <RotateCcw className="w-3.5 h-3.5 text-primary" />
              <span>Auto-Detect Overdue</span>
            </button>
          )}

          <button
            onClick={() => setIsManualModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-inverted text-xs font-semibold transition cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Log Missed Work Manually</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {recoveryAppliedToast && (
        <div className="mt-4 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{recoveryAppliedToast}</span>
        </div>
      )}

      {/* AI RECOVERY PLAN CARD */}
      <div className="mt-6 p-5 sm:p-6 rounded-2xl bg-card border border-theme shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-theme/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-primary flex items-center gap-2">
                Automated Recovery Plan & Next Actions
              </h2>
              <p className="text-xs text-muted">
                {counts.missed + counts.pending > 0 
                  ? `AI suggested new timeline for ${counts.missed + counts.pending} active missed items (${totalEstimatedMinutes} mins total)`
                  : 'All missed tests and tasks are currently resolved or rescheduled!'}
              </p>
            </div>
          </div>

          {suggestions.length > 0 && (
            <button
              onClick={handleApplyRecoveryPlan}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-inverted hover:bg-primary/90 text-xs font-bold transition cursor-pointer shadow-xs shrink-0 self-start lg:self-auto"
            >
              <CalendarCheck className="w-4 h-4" />
              <span>Apply All Suggested Catch-up Dates</span>
            </button>
          )}
        </div>

        {/* TOP RECOMMENDED NEXT ATTEMPT */}
        {nextActionItem ? (
          <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                <Zap className="w-4 h-4 fill-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300">
                    What You Should Attempt Next
                  </span>
                  <span className="text-xs font-semibold text-muted">
                    {nextActionItem.subjectName} • {nextActionItem.estimatedMinutes} mins
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-primary mt-1">
                  {nextActionItem.title}
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  {suggestions[0]?.reasoning || 'Highest priority catch-up item. Attempt immediately to prevent learning bottlenecks.'}
                </p>
              </div>
            </div>

            {onStartTimerForTopic && (
              <button
                onClick={() => onStartTimerForTopic(nextActionItem.subjectName, nextActionItem.chapterName || '', nextActionItem.title)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition cursor-pointer shrink-0 self-start sm:self-auto shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Attempt Now (Timer)</span>
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4 p-4 rounded-xl bg-theme-accent/40 border border-theme text-xs text-muted flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Zero pending catch-up items. Your schedule is completely up to date!</span>
          </div>
        )}

        {/* TIMELINE PREVIEW OF SUGGESTED SEQUENCE */}
        {suggestions.length > 1 && (
          <div className="mt-4 pt-3 border-t border-theme/50">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-2.5">
              Suggested Catch-up Timeline Sequence
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {suggestions.slice(0, 6).map((sugg, idx) => {
                const item = missedWork.find(m => m.id === sugg.itemId);
                if (!item) return null;
                return (
                  <div 
                    key={sugg.itemId}
                    className="p-3 rounded-xl border border-theme bg-theme-accent/20 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          Step {idx + 1}
                        </span>
                        <span className="text-[11px] font-semibold text-primary">
                          {sugg.suggestedDate} ({sugg.suggestedTimeslot})
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-primary truncate" title={item.title}>
                        {item.title}
                      </p>
                      <p className="text-[11px] text-muted truncate">
                        {item.subjectName} • {item.estimatedMinutes}m
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* FILTER CONTROLS & SEARCH */}
      <div className="mt-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="inline-flex p-1 bg-theme-accent rounded-xl border border-theme text-xs font-semibold overflow-x-auto scrollbar-none">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 ${
              statusFilter === 'all' ? 'bg-card text-primary shadow-xs' : 'text-muted hover:text-primary'
            }`}
          >
            All ({counts.all})
          </button>
          <button
            onClick={() => setStatusFilter('Missed')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 ${
              statusFilter === 'Missed' ? 'bg-card text-rose-600 dark:text-rose-400 shadow-xs' : 'text-muted hover:text-primary'
            }`}
          >
            Missed ({counts.missed})
          </button>
          <button
            onClick={() => setStatusFilter('Pending')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 ${
              statusFilter === 'Pending' ? 'bg-card text-amber-600 dark:text-amber-400 shadow-xs' : 'text-muted hover:text-primary'
            }`}
          >
            Pending ({counts.pending})
          </button>
          <button
            onClick={() => setStatusFilter('Rescheduled')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 ${
              statusFilter === 'Rescheduled' ? 'bg-card text-blue-600 dark:text-blue-400 shadow-xs' : 'text-muted hover:text-primary'
            }`}
          >
            Rescheduled ({counts.rescheduled})
          </button>
          <button
            onClick={() => setStatusFilter('Completed')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 ${
              statusFilter === 'Completed' ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-muted hover:text-primary'
            }`}
          >
            Completed ({counts.completed})
          </button>
        </div>

        {/* Search & Type Filter */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search missed work..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-card border border-theme text-primary placeholder-muted focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs rounded-xl bg-card border border-theme text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value="test">Tests</option>
            <option value="assignment">Assignments</option>
            <option value="task">Tasks</option>
            <option value="class">Classes</option>
          </select>
        </div>
      </div>

      {/* ITEMS LIST */}
      <div className="mt-5 space-y-3">
        {filteredList.length === 0 ? (
          <div className="py-12 text-center bg-card rounded-2xl border border-dashed border-theme p-6">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500/80 mb-3" />
            <h3 className="text-base font-bold text-primary">No Missed Work Items Found</h3>
            <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                ? "No items match your active search or filters."
                : "You don't have any recorded missed tests or tasks. Keep up the consistent study habits!"}
            </p>
          </div>
        ) : (
          filteredList.map((item, idx) => {
            const isReschedulingThis = reschedulingItemId === item.id;
            return (
              <div
                key={`${item.id}-${idx}`}
                className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                  item.status === 'Completed'
                    ? 'bg-theme-accent/20 border-theme/60 opacity-70'
                    : item.status === 'Missed'
                    ? 'bg-card border-rose-500/30 hover:border-rose-500/50 shadow-xs'
                    : item.status === 'Rescheduled'
                    ? 'bg-card border-blue-500/30 hover:border-blue-500/50 shadow-xs'
                    : 'bg-card border-theme hover:border-primary/40 shadow-xs'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left Metadata & Title */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Type Badge */}
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md ${
                        item.type === 'test'
                          ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300'
                          : item.type === 'assignment'
                          ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                          : item.type === 'class'
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      }`}>
                        {item.type}
                      </span>

                      {/* Subject Name */}
                      <span className="text-xs font-bold text-primary">
                        {item.subjectName}
                      </span>

                      {/* Priority Badge */}
                      <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                        item.priority === 'High'
                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                          : item.priority === 'Low'
                          ? 'bg-theme-accent text-muted'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      }`}>
                        {item.priority} Priority
                      </span>

                      {item.detectedAutomatically && (
                        <span className="text-[10px] text-muted italic">
                          (Auto-detected overdue)
                        </span>
                      )}
                    </div>

                    <h3 className={`text-sm sm:text-base font-bold text-primary mt-1.5 ${
                      item.status === 'Completed' ? 'line-through text-muted' : ''
                    }`}>
                      {item.title}
                    </h3>

                    {item.notes && (
                      <p className="text-xs text-muted mt-1 whitespace-pre-line bg-theme-accent/30 p-2 rounded-lg border border-theme/40">
                        {item.notes}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-muted mt-2 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-muted" />
                        Original Deadline: <strong className="text-primary">{item.originalDeadline}</strong>
                      </span>
                      <span>•</span>
                      <span>Estimated: <strong>{item.estimatedMinutes} mins</strong></span>

                      {item.rescheduledDate && (
                        <>
                          <span>•</span>
                          <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300 font-bold">
                            Rescheduled for: {item.rescheduledDate} {item.rescheduledTimeslot ? `(${item.rescheduledTimeslot})` : ''}
                          </span>
                        </>
                      )}

                      {item.completedAt && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            Completed: {new Date(item.completedAt).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right Actions: Status Selector & Timer */}
                  <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                    {/* Status Dropdown Selector */}
                    <select
                      value={item.status}
                      onChange={e => handleStatusChange(item, e.target.value as MissedWorkStatus)}
                      className={`px-2.5 py-1.5 text-xs font-bold rounded-xl border transition cursor-pointer ${
                        item.status === 'Completed'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          : item.status === 'Missed'
                          ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                          : item.status === 'Rescheduled'
                          ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                      }`}
                    >
                      <option value="Missed">Missed</option>
                      <option value="Pending">Pending</option>
                      <option value="Rescheduled">Rescheduled</option>
                      <option value="Completed">Completed</option>
                    </select>

                    {/* Start Study Timer */}
                    {onStartTimerForTopic && item.status !== 'Completed' && (
                      <button
                        onClick={() => onStartTimerForTopic(item.subjectName, item.chapterName || '', item.title)}
                        className="p-2 rounded-xl bg-theme-accent hover:bg-theme-accent/80 text-primary border border-theme transition cursor-pointer"
                        title="Start timer for this task"
                      >
                        <Play className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500" />
                      </button>
                    )}

                    {/* Delete Item */}
                    <button
                      onClick={() => onDeleteMissedWorkItem(item.id)}
                      className="p-2 rounded-xl text-muted hover:text-rose-600 hover:bg-rose-500/10 transition cursor-pointer"
                      title="Delete from Missed Work list"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline Rescheduling Picker when triggered */}
                {isReschedulingThis && (
                  <div className="mt-3 pt-3 border-t border-theme/60 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-primary">Choose new target date:</span>
                    <input
                      type="date"
                      value={customRescheduleDate}
                      onChange={e => setCustomRescheduleDate(e.target.value)}
                      className="px-2 py-1 rounded-lg bg-card border border-theme text-primary"
                    />
                    <select
                      value={customRescheduleSlot}
                      onChange={e => setCustomRescheduleSlot(e.target.value)}
                      className="px-2 py-1 rounded-lg bg-card border border-theme text-primary"
                    >
                      <option value="morning">Morning</option>
                      <option value="afternoon">Afternoon</option>
                      <option value="evening">Evening</option>
                      <option value="night">Night</option>
                    </select>
                    <button
                      onClick={() => handleCommitReschedule(item)}
                      className="px-3 py-1 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition cursor-pointer"
                    >
                      Confirm Reschedule
                    </button>
                    <button
                      onClick={() => setReschedulingItemId(null)}
                      className="px-2 py-1 text-muted hover:text-primary"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* MANUAL ENTRY MODAL */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-theme rounded-2xl w-full max-w-lg shadow-xl p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-theme">
              <h3 className="text-base font-bold text-primary flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" />
                Manually Enter Missed Test or Task
              </h3>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="text-muted hover:text-primary text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateManual} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Title / Name *
                </label>
                <input
                  type="text"
                  required
                  value={manualTitle}
                  onChange={e => setManualTitle(e.target.value)}
                  placeholder="e.g. Unit 3 Kinetics Test, Math Homework #5..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-card border border-theme text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Subject *
                  </label>
                  <select
                    value={manualSubject}
                    onChange={e => setManualSubject(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-card border border-theme text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    {subjects.length > 0 ? (
                      subjects.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))
                    ) : (
                      <>
                        <option value="Physics">Physics</option>
                        <option value="Chemistry">Chemistry</option>
                        <option value="Mathematics">Mathematics</option>
                        <option value="Biology">Biology</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Type *
                  </label>
                  <select
                    value={manualType}
                    onChange={e => setManualType(e.target.value as MissedWorkType)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-card border border-theme text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="test">Test / Mock Exam</option>
                    <option value="assignment">Assignment / Project</option>
                    <option value="task">Scheduled Study Task</option>
                    <option value="class">Class Session</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Original Deadline *
                  </label>
                  <input
                    type="date"
                    required
                    value={manualDeadline}
                    onChange={e => setManualDeadline(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-card border border-theme text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Estimated Time (Minutes)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="240"
                    value={manualMinutes}
                    onChange={e => setManualMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-card border border-theme text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Priority
                  </label>
                  <select
                    value={manualPriority}
                    onChange={e => setManualPriority(e.target.value as MissedWorkPriority)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-card border border-theme text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="High">High Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="Low">Low Priority</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Initial Status
                  </label>
                  <select
                    value={manualStatus}
                    onChange={e => setManualStatus(e.target.value as MissedWorkStatus)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-card border border-theme text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="Missed">Missed</option>
                    <option value="Pending">Pending</option>
                    <option value="Rescheduled">Rescheduled</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Notes / Reason
                </label>
                <textarea
                  rows={2}
                  value={manualNotes}
                  onChange={e => setManualNotes(e.target.value)}
                  placeholder="Optional context about why this was missed or what topics are involved..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-card border border-theme text-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-theme">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary text-inverted text-xs font-bold hover:bg-primary/90 transition"
                >
                  Save Missed Work
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
