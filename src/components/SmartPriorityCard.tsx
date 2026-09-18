import React, { useState, useMemo } from 'react';
import { 
  Flame, 
  Clock, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronRight, 
  Sparkles, 
  ArrowRight, 
  Calendar, 
  Layers, 
  Check, 
  ShieldAlert,
  Info,
  Filter,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { 
  Assignment, 
  MissedWorkItem, 
  StudyPlan, 
  ScheduledStudyTask, 
  UserProfile, 
  ActiveTab,
  RevisionItem 
} from '../types';
import { 
  getSmartPrioritizedTasks, 
  PrioritizedAcademicTask, 
  SmartPriorityLevel,
  PRIORITY_CONFIG 
} from '../lib/smartPriorityEngine';
import { PreparationTimelineModal } from './PreparationTimelineModal';

interface SmartPriorityCardProps {
  assignments?: Assignment[];
  missedWork?: MissedWorkItem[];
  plans?: StudyPlan[];
  userProfile?: UserProfile | null;
  scheduledTasks?: ScheduledStudyTask[];
  revisions?: RevisionItem[];
  setActiveTab: (tab: ActiveTab) => void;
  onStartTimerForTopic: (subjectName: string, chapterName: string, topicName: string) => void;
  onToggleAssignmentComplete?: (assignment: Assignment) => void;
  onSaveSubtasks?: (targetId: string, updatedSubtasks: any[]) => Promise<void> | void;
  onSavePlan?: (plan: StudyPlan | Omit<StudyPlan, 'id'>) => Promise<void> | void;
  onAddScheduledTask?: (task: ScheduledStudyTask) => void;
  onSelectAssignmentForDetail?: (assignment: Assignment) => void;
}

export const SmartPriorityCard: React.FC<SmartPriorityCardProps> = ({
  assignments = [],
  missedWork = [],
  plans = [],
  userProfile = null,
  scheduledTasks = [],
  revisions = [],
  setActiveTab,
  onStartTimerForTopic,
  onToggleAssignmentComplete,
  onSaveSubtasks,
  onSavePlan,
  onAddScheduledTask,
  onSelectAssignmentForDetail
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | SmartPriorityLevel>('all');
  const [selectedTimelineItem, setSelectedTimelineItem] = useState<any | null>(null);

  // Compute prioritized tasks
  const prioritizedTasks = useMemo(() => {
    return getSmartPrioritizedTasks({
      assignments,
      missedWork,
      plans,
      userProfile,
      scheduledTasks,
      revisions
    });
  }, [assignments, missedWork, plans, userProfile, scheduledTasks, revisions]);

  // Priority counts
  const counts = useMemo(() => {
    const res: Record<'urgent' | 'high' | 'normal' | 'low', number> = {
      urgent: 0,
      high: 0,
      normal: 0,
      low: 0
    };
    prioritizedTasks.forEach(t => {
      if (!t.isCompleted) {
        res[t.priorityLevel]++;
      }
    });
    return res;
  }, [prioritizedTasks]);

  // Filtered list
  const filteredTasks = useMemo(() => {
    if (activeFilter === 'all') return prioritizedTasks;
    return prioritizedTasks.filter(t => t.priorityLevel === activeFilter);
  }, [prioritizedTasks, activeFilter]);

  // Highest priority spotlight item (first uncompleted task)
  const spotlightItem = useMemo(() => {
    return prioritizedTasks.find(t => !t.isCompleted) || null;
  }, [prioritizedTasks]);

  return (
    <div className="bg-card border border-theme rounded-3xl p-5 sm:p-6 shadow-sm mb-6 transition-all">
      
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-theme/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold shrink-0">
            <Flame className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-primary flex items-center gap-1.5">
                <span>Smart Priority System</span>
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-theme-accent text-primary border border-theme">
                AI Auto-Ranked
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Prioritized by deadline urgency, missed work, importance, remaining prep, and daily workload.
            </p>
          </div>
        </div>

        {/* Priority Count Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveFilter('urgent')}
            className={`px-2.5 py-1 rounded-full text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'urgent'
                ? 'bg-rose-500 text-white border-rose-500 shadow-xs'
                : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
            }`}
          >
            <span>🔴 Urgent</span>
            <span className="bg-white/20 dark:bg-black/20 px-1.5 py-0.2 rounded-full text-[11px] font-mono">
              {counts.urgent}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter('high')}
            className={`px-2.5 py-1 rounded-full text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'high'
                ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
            }`}
          >
            <span>🟠 High</span>
            <span className="bg-white/20 dark:bg-black/20 px-1.5 py-0.2 rounded-full text-[11px] font-mono">
              {counts.high}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter('normal')}
            className={`px-2.5 py-1 rounded-full text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'normal'
                ? 'bg-primary text-white border-primary shadow-xs'
                : 'bg-theme-accent text-primary border-theme hover:bg-theme-accent/80'
            }`}
          >
            <span>🟡 Normal</span>
            <span className="bg-white/20 dark:bg-black/20 px-1.5 py-0.2 rounded-full text-[11px] font-mono">
              {counts.normal}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter('low')}
            className={`px-2.5 py-1 rounded-full text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'low'
                ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs'
                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
            }`}
          >
            <span>🟢 Low</span>
            <span className="bg-white/20 dark:bg-black/20 px-1.5 py-0.2 rounded-full text-[11px] font-mono">
              {counts.low}
            </span>
          </button>

          {activeFilter !== 'all' && (
            <button
              onClick={() => setActiveFilter('all')}
              className="text-xs text-muted hover:text-primary underline ml-1 cursor-pointer font-medium"
            >
              Reset filter
            </button>
          )}
        </div>
      </div>

      {/* #1 MOST CRITICAL SPOTLIGHT (IF URGENT / HIGH EXISTS) */}
      {spotlightItem && (spotlightItem.priorityLevel === 'urgent' || spotlightItem.priorityLevel === 'high') && (
        <div className={`mt-4 p-4 rounded-2xl border transition-all ${
          spotlightItem.priorityLevel === 'urgent'
            ? 'bg-rose-500/10 dark:bg-rose-950/20 border-rose-500/30'
            : 'bg-amber-500/10 dark:bg-amber-950/20 border-amber-500/30'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-rose-600 text-white shadow-2xs">
                  {spotlightItem.priorityBadge}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Highest Focus Recommendation
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-theme-accent text-primary border border-theme">
                  {spotlightItem.subjectName}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-primary truncate">
                {spotlightItem.title}
              </h3>
              <div className="flex items-center gap-2 flex-wrap text-xs text-muted pt-0.5">
                {spotlightItem.reasons.map((r, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-white/40 dark:bg-black/40 px-2 py-0.5 rounded-md border border-theme/40 text-[11px] font-medium text-primary">
                    <span>•</span>
                    <span>{r}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
              {/* Prep Timeline Button */}
              <button
                onClick={() => setSelectedTimelineItem({
                  id: spotlightItem.id,
                  title: spotlightItem.title,
                  type: spotlightItem.sourceType === 'test' ? 'Test' : 'Assignment',
                  subjectName: spotlightItem.subjectName,
                  chapterName: spotlightItem.chapterName,
                  topicName: spotlightItem.topicName,
                  dueDate: spotlightItem.dueDate,
                  subtasks: spotlightItem.rawItem?.subtasks
                })}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card hover:bg-theme-accent text-primary border border-theme text-xs font-semibold transition cursor-pointer shadow-2xs"
                title="View workload-aware preparation timeline"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Prep Timeline</span>
              </button>

              {/* Study Timer Button */}
              <button
                onClick={() => onStartTimerForTopic(
                  spotlightItem.subjectName,
                  spotlightItem.chapterName || 'Exam Prep',
                  spotlightItem.title
                )}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-inverted text-xs font-bold hover:opacity-90 transition cursor-pointer shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Study Session</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FILTER TABS */}
      <div className="mt-4 flex items-center justify-between gap-3 overflow-x-auto pb-1 scrollbar-none">
        <div className="inline-flex p-1 bg-theme-accent/60 rounded-xl border border-theme text-xs font-semibold">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-card text-primary shadow-xs'
                : 'text-muted hover:text-primary'
            }`}
          >
            All Tasks ({prioritizedTasks.length})
          </button>
          <button
            onClick={() => setActiveFilter('urgent')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
              activeFilter === 'urgent'
                ? 'bg-card text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-muted hover:text-primary'
            }`}
          >
            <span>🔴 Urgent ({counts.urgent})</span>
          </button>
          <button
            onClick={() => setActiveFilter('high')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
              activeFilter === 'high'
                ? 'bg-card text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-muted hover:text-primary'
            }`}
          >
            <span>🟠 High ({counts.high})</span>
          </button>
          <button
            onClick={() => setActiveFilter('normal')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
              activeFilter === 'normal'
                ? 'bg-card text-primary font-bold shadow-xs'
                : 'text-muted hover:text-primary'
            }`}
          >
            <span>🟡 Normal ({counts.normal})</span>
          </button>
          <button
            onClick={() => setActiveFilter('low')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
              activeFilter === 'low'
                ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-muted hover:text-primary'
            }`}
          >
            <span>🟢 Low ({counts.low})</span>
          </button>
        </div>

        <span className="text-xs text-muted shrink-0 hidden sm:inline">
          Showing {filteredTasks.length} task{filteredTasks.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* TASK LIST */}
      <div className="mt-3.5 space-y-2.5">
        {filteredTasks.length === 0 ? (
          <div className="py-10 text-center bg-theme-accent/20 rounded-2xl border border-dashed border-theme p-6">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
            <p className="text-sm font-semibold text-primary">No tasks in this priority tier!</p>
            <p className="text-xs text-muted mt-0.5">
              All tasks in this category are completed or none currently meet these conditions.
            </p>
          </div>
        ) : (
          filteredTasks.slice(0, 8).map((task, idx) => {
            const daysLabel = task.daysRemaining < 0
              ? `Overdue (${Math.abs(task.daysRemaining)}d)`
              : task.daysRemaining === 0
              ? 'Due Today'
              : task.daysRemaining === 1
              ? 'Tomorrow'
              : `In ${task.daysRemaining} days`;

            return (
              <div
                key={`${task.id}-${idx}`}
                className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  task.isCompleted
                    ? 'bg-theme-accent/20 border-theme/40 opacity-60'
                    : `${task.priorityColor.bg} ${task.priorityColor.border} hover:shadow-xs`
                }`}
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  {/* Completion Checkbox */}
                  <button
                    onClick={() => {
                      if (task.sourceType === 'assignment' || task.sourceType === 'test') {
                        onToggleAssignmentComplete && onToggleAssignmentComplete(task.rawItem);
                      }
                    }}
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition cursor-pointer shrink-0 mt-0.5 sm:mt-0 ${
                      task.isCompleted
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-theme hover:border-primary text-transparent bg-card'
                    }`}
                    title={task.isCompleted ? "Mark pending" : "Mark completed"}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Clear Priority Level Badge */}
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border shadow-2xs ${task.priorityColor.badgeBg}`}>
                        {task.priorityBadge}
                      </span>

                      {/* Subject Name */}
                      <span className="text-xs font-semibold text-primary">
                        {task.subjectName}
                      </span>

                      {/* Due Countdown Pill */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        task.daysRemaining <= 0
                          ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                          : task.daysRemaining === 1
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                          : 'bg-theme-accent text-muted border-theme'
                      }`}>
                        {daysLabel} ({task.dueDate})
                      </span>
                    </div>

                    {/* Task Title */}
                    <h4 className={`text-xs sm:text-sm font-semibold text-primary truncate ${
                      task.isCompleted ? 'line-through text-muted' : ''
                    }`}>
                      {task.title}
                    </h4>

                    {/* Reasons & Prep Status */}
                    <div className="flex items-center gap-2 flex-wrap text-xs text-muted">
                      {task.reasons.map((reason, rIdx) => (
                        <span key={rIdx} className="text-[11px] text-muted flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-theme-accent" />
                          <span>{reason}</span>
                        </span>
                      ))}

                      {task.prepStatus && (
                        <span className="text-[11px] font-semibold text-primary bg-theme-accent/60 px-2 py-0.5 rounded-md border border-theme flex items-center gap-1">
                          <Layers className="w-3 h-3 text-primary" />
                          <span>Prep: {task.prepStatus.completedStages}/{task.prepStatus.totalStages} stages ({task.prepStatus.percentage}%)</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {/* Preparation Timeline Button */}
                  <button
                    onClick={() => setSelectedTimelineItem({
                      id: task.id,
                      title: task.title,
                      type: task.sourceType === 'test' ? 'Test' : 'Assignment',
                      subjectName: task.subjectName,
                      chapterName: task.chapterName,
                      topicName: task.topicName,
                      dueDate: task.dueDate,
                      subtasks: task.rawItem?.subtasks
                    })}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-card hover:bg-theme-accent text-primary border border-theme text-xs font-medium transition cursor-pointer"
                    title="View / Edit Preparation Timeline"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span className="hidden sm:inline">Timeline</span>
                  </button>

                  {/* Study Timer Button */}
                  {!task.isCompleted && (
                    <button
                      onClick={() => onStartTimerForTopic(
                        task.subjectName,
                        task.chapterName || 'General',
                        task.title
                      )}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition cursor-pointer shadow-2xs"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Study</span>
                    </button>
                  )}

                  {/* Details Button */}
                  {task.sourceType === 'assignment' && onSelectAssignmentForDetail && (
                    <button
                      onClick={() => onSelectAssignmentForDetail(task.rawItem)}
                      className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-theme-accent transition cursor-pointer"
                      title="View Details"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {filteredTasks.length > 8 && (
          <div className="text-center pt-1">
            <button
              onClick={() => setActiveTab('assignments')}
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>View all {filteredTasks.length} prioritized tasks in Assignments</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* EDITABLE PREPARATION TIMELINE MODAL */}
      {selectedTimelineItem && (
        <PreparationTimelineModal
          isOpen={!!selectedTimelineItem}
          onClose={() => setSelectedTimelineItem(null)}
          targetItem={selectedTimelineItem}
          plans={plans}
          scheduledTasks={scheduledTasks}
          assignments={assignments}
          userProfile={userProfile}
          onSaveSubtasks={async (targetId, updatedSubtasks) => {
            if (onSaveSubtasks) {
              await onSaveSubtasks(targetId, updatedSubtasks);
            }
          }}
          onSavePlan={onSavePlan}
          onAddScheduledTask={onAddScheduledTask}
          onStartTimerForTopic={onStartTimerForTopic}
        />
      )}

    </div>
  );
};
