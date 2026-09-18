import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight, 
  CalendarPlus, 
  Layers, 
  AlertTriangle,
  RotateCcw,
  Check,
  Zap,
  Info
} from 'lucide-react';
import { 
  Assignment, 
  StudyPlan, 
  ScheduledStudyTask, 
  UserProfile 
} from '../types';
import { 
  PrepTimelineStage, 
  generateAdaptivePrepTimeline, 
  prepStagesToSubtasks, 
  subtasksToPrepStages,
  syncPrepStagesToDailyPlans,
  syncPrepStagesToScheduledTasks 
} from '../lib/autoStudyPlanningService';

interface PreparationTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetItem: {
    id: string;
    title: string;
    type?: string;
    subjectName?: string;
    chapterName?: string;
    topicName?: string;
    dueDate: string; // YYYY-MM-DD
    dueTime?: string;
    subtasks?: any[];
  };
  plans?: StudyPlan[];
  scheduledTasks?: ScheduledStudyTask[];
  assignments?: Assignment[];
  userProfile?: UserProfile | null;
  onSaveSubtasks: (targetId: string, updatedSubtasks: any[]) => Promise<void> | void;
  onSavePlan?: (plan: StudyPlan | Omit<StudyPlan, 'id'>) => Promise<void> | void;
  onAddScheduledTask?: (task: ScheduledStudyTask) => void;
  onStartTimerForTopic?: (subject: string, chapter: string, topic: string) => void;
}

export const PreparationTimelineModal: React.FC<PreparationTimelineModalProps> = ({
  isOpen,
  onClose,
  targetItem,
  plans = [],
  scheduledTasks = [],
  assignments = [],
  userProfile = null,
  onSaveSubtasks,
  onSavePlan,
  onAddScheduledTask,
  onStartTimerForTopic
}) => {
  if (!isOpen || !targetItem) return null;

  // Initialize stages from existing subtasks, or generate new adaptive timeline
  const [stages, setStages] = useState<PrepTimelineStage[]>(() => {
    if (targetItem.subtasks && targetItem.subtasks.length > 0) {
      return subtasksToPrepStages(targetItem.subtasks, targetItem.dueDate, plans, scheduledTasks, assignments);
    }
    const generated = generateAdaptivePrepTimeline({
      targetDate: targetItem.dueDate,
      targetTitle: targetItem.title,
      targetType: targetItem.type || 'Test',
      subjectName: targetItem.subjectName,
      chapterName: targetItem.chapterName,
      topicName: targetItem.topicName,
      plans,
      scheduledTasks,
      assignments,
      userProfile
    });
    return generated.stages;
  });

  const [isSaving, setIsSaving] = useState(false);
  const [syncedPlansSuccess, setSyncedPlansSuccess] = useState(false);
  const [syncedCalendarSuccess, setSyncedCalendarSuccess] = useState(false);

  // New stage form state
  const [showAddStage, setShowAddStage] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPhase, setNewPhase] = useState<PrepTimelineStage['phase']>('practice');
  const [newDate, setNewDate] = useState(targetItem.dueDate);
  const [newTimeslot, setNewTimeslot] = useState<PrepTimelineStage['timeslot']>('afternoon');
  const [newMinutes, setNewMinutes] = useState(45);

  const completedCount = stages.filter(s => s.completed).length;
  const totalMinutes = stages.reduce((sum, s) => sum + s.estimatedMinutes, 0);

  // Toggle stage completed
  const handleToggleStage = (stageId: string) => {
    const updated = stages.map(st => {
      if (st.id === stageId) {
        const nextCompleted = !st.completed;
        return {
          ...st,
          completed: nextCompleted,
          completedAt: nextCompleted ? new Date().toISOString() : undefined
        };
      }
      return st;
    });
    setStages(updated);
  };

  // Update stage field
  const handleUpdateStage = (stageId: string, updates: Partial<PrepTimelineStage>) => {
    const updated = stages.map(st => st.id === stageId ? { ...st, ...updates } : st);
    setStages(updated);
  };

  // Delete a stage
  const handleDeleteStage = (stageId: string) => {
    setStages(stages.filter(st => st.id !== stageId));
  };

  // Add custom stage
  const handleAddStage = () => {
    if (!newTitle.trim()) return;
    const newStage: PrepTimelineStage = {
      id: `prep_custom_${Date.now()}`,
      title: newTitle.trim(),
      description: `Custom stage: ${newPhase}.`,
      phase: newPhase,
      scheduledDate: newDate,
      timeslot: newTimeslot,
      estimatedMinutes: Number(newMinutes) || 30,
      completed: false,
      daysBeforeTarget: Math.max(0, Math.round((new Date(targetItem.dueDate).getTime() - new Date(newDate).getTime()) / (1000 * 3600 * 24))),
      workloadContext: {
        dayLevel: 'Moderate',
        totalMinutesOnDay: 0,
        taskCountOnDay: 0,
        note: 'Custom timeline stage'
      }
    };

    setStages([...stages, newStage]);
    setNewTitle('');
    setShowAddStage(false);
  };

  // Regenerate timeline based on current schedule
  const handleRegenerate = () => {
    const result = generateAdaptivePrepTimeline({
      targetDate: targetItem.dueDate,
      targetTitle: targetItem.title,
      targetType: targetItem.type || 'Test',
      subjectName: targetItem.subjectName,
      chapterName: targetItem.chapterName,
      topicName: targetItem.topicName,
      plans,
      scheduledTasks,
      assignments,
      userProfile
    });
    setStages(result.stages);
  };

  // Save changes back to assignment/test
  const handleSaveAndClose = async () => {
    setIsSaving(true);
    try {
      const subtasks = prepStagesToSubtasks(stages);
      await onSaveSubtasks(targetItem.id, subtasks);
      onClose();
    } catch (err) {
      console.error("Error saving prep timeline:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Sync to Daily Study Plans
  const handleSyncToPlans = () => {
    if (!onSavePlan) return;
    const { addedCount } = syncPrepStagesToDailyPlans(
      stages,
      targetItem.subjectName || 'Study Prep',
      targetItem.chapterName || 'Exam Preparation',
      plans,
      onSavePlan
    );
    setSyncedPlansSuccess(true);
    setTimeout(() => setSyncedPlansSuccess(false), 2500);
  };

  // Sync to Calendar Tasks
  const handleSyncToCalendar = () => {
    if (!onAddScheduledTask) return;
    const tasks = syncPrepStagesToScheduledTasks(
      stages,
      targetItem.subjectName || 'Study Prep',
      targetItem.id
    );
    tasks.forEach(t => onAddScheduledTask(t));
    setSyncedCalendarSuccess(true);
    setTimeout(() => setSyncedCalendarSuccess(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="bg-card border border-theme rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-primary">
        
        {/* MODAL HEADER */}
        <div className="p-5 sm:p-6 border-b border-theme/60 bg-header flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-theme-accent text-primary border border-theme">
                  Automatic Study Planning
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400">
                  Target: {targetItem.dueDate}
                </span>
                {targetItem.subjectName && (
                  <span className="text-xs font-medium text-muted">
                    {targetItem.subjectName}
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-primary truncate mt-1">
                {targetItem.title}
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Workload-aware preparation timeline leading up to test or deadline. Fully customizable.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-theme-accent text-muted hover:text-primary transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STATS BAR & QUICK ACTIONS */}
        <div className="px-6 py-3 border-b border-theme/60 bg-theme-accent/20 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-semibold text-primary">
              Progress: <strong className="text-emerald-600 dark:text-emerald-400">{completedCount} of {stages.length} Completed</strong>
            </span>
            <span className="text-muted">•</span>
            <span className="text-muted">
              Total Prep Time: <strong className="text-primary">{totalMinutes} mins</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleRegenerate}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-theme hover:bg-theme-accent text-xs font-medium text-muted hover:text-primary transition cursor-pointer"
              title="Recalculate timeline based on updated schedule"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Template</span>
            </button>

            {onSavePlan && (
              <button
                onClick={handleSyncToPlans}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-theme-accent hover:bg-theme-accent/80 text-primary border border-theme text-xs font-semibold transition cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                <span>{syncedPlansSuccess ? "Synced to Plans!" : "Sync to Daily Plans"}</span>
              </button>
            )}

            {onAddScheduledTask && (
              <button
                onClick={handleSyncToCalendar}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-theme-accent hover:bg-theme-accent/80 text-primary border border-theme text-xs font-semibold transition cursor-pointer"
              >
                <CalendarPlus className="w-3.5 h-3.5 text-emerald-500" />
                <span>{syncedCalendarSuccess ? "Added to Calendar!" : "Add to Timetable"}</span>
              </button>
            )}
          </div>
        </div>

        {/* TIMELINE STAGES LIST */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-3">
          {stages.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-theme rounded-2xl bg-theme-accent/20 p-6">
              <Sparkles className="w-8 h-8 mx-auto text-amber-500/70 mb-2" />
              <p className="text-sm font-semibold text-primary">No Preparation Stages Configured</p>
              <p className="text-xs text-muted mt-1">Generate a recommended timeline or add your own milestones.</p>
              <button
                onClick={handleRegenerate}
                className="mt-3 px-4 py-2 rounded-xl bg-primary text-inverted text-xs font-semibold hover:opacity-90 transition cursor-pointer"
              >
                Generate 4-Stage Adaptive Timeline
              </button>
            </div>
          ) : (
            stages.map((stage, idx) => {
              const daysLabel = stage.daysBeforeTarget === 0 
                ? 'Test / Due Day' 
                : stage.daysBeforeTarget === 1 
                ? '1 Day Before' 
                : `${stage.daysBeforeTarget} Days Before`;

              return (
                <div
                  key={stage.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    stage.completed
                      ? 'bg-theme-accent/30 border-theme/50 opacity-65'
                      : 'bg-card border-theme hover:border-theme/80 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Completion checkbox */}
                      <button
                        onClick={() => handleToggleStage(stage.id)}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition cursor-pointer shrink-0 mt-0.5 ${
                          stage.completed
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-theme hover:border-primary text-transparent'
                        }`}
                        title={stage.completed ? "Mark pending" : "Mark completed"}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Days Before Badge */}
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            stage.daysBeforeTarget === 0
                              ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                              : stage.daysBeforeTarget === 1
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                              : stage.daysBeforeTarget === 2
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                          }`}>
                            {daysLabel}
                          </span>

                          {/* Phase Pill */}
                          <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded-full bg-theme-accent border border-theme text-muted">
                            {stage.phase}
                          </span>

                          {/* Workload Indicator Pill */}
                          {stage.workloadContext && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              stage.workloadContext.dayLevel === 'Heavy'
                                ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                                : stage.workloadContext.dayLevel === 'Moderate'
                                ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                            }`}>
                              <span>Load: {stage.workloadContext.dayLevel}</span>
                            </span>
                          )}
                        </div>

                        {/* Title (Inline Editable) */}
                        <input
                          type="text"
                          value={stage.title}
                          onChange={(e) => handleUpdateStage(stage.id, { title: e.target.value })}
                          className={`w-full text-sm font-semibold bg-transparent border-b border-transparent hover:border-theme focus:border-primary focus:outline-hidden py-0.5 text-primary ${
                            stage.completed ? 'line-through text-muted' : ''
                          }`}
                        />

                        {/* Description */}
                        {stage.description && (
                          <p className="text-xs text-muted">
                            {stage.description}
                          </p>
                        )}

                        {/* Editable Scheduling Meta */}
                        <div className="flex items-center gap-3 flex-wrap pt-1 text-xs text-muted">
                          {/* Date input */}
                          <div className="flex items-center gap-1 bg-theme-accent/60 px-2 py-1 rounded-lg border border-theme">
                            <Calendar className="w-3.5 h-3.5 text-muted" />
                            <input
                              type="date"
                              value={stage.scheduledDate}
                              onChange={(e) => handleUpdateStage(stage.id, { scheduledDate: e.target.value })}
                              className="bg-transparent text-primary text-xs focus:outline-hidden cursor-pointer"
                            />
                          </div>

                          {/* Timeslot Selector */}
                          <div className="flex items-center gap-1 bg-theme-accent/60 px-2 py-1 rounded-lg border border-theme">
                            <Clock className="w-3.5 h-3.5 text-muted" />
                            <select
                              value={stage.timeslot}
                              onChange={(e) => handleUpdateStage(stage.id, { timeslot: e.target.value as any })}
                              className="bg-transparent text-primary text-xs focus:outline-hidden capitalize cursor-pointer"
                            >
                              <option value="morning">Morning</option>
                              <option value="afternoon">Afternoon</option>
                              <option value="evening">Evening</option>
                              <option value="night">Night</option>
                            </select>
                          </div>

                          {/* Duration */}
                          <div className="flex items-center gap-1 bg-theme-accent/60 px-2 py-1 rounded-lg border border-theme">
                            <input
                              type="number"
                              min="15"
                              max="180"
                              step="5"
                              value={stage.estimatedMinutes}
                              onChange={(e) => handleUpdateStage(stage.id, { estimatedMinutes: Number(e.target.value) || 30 })}
                              className="w-10 bg-transparent text-primary text-xs focus:outline-hidden font-medium text-center"
                            />
                            <span>mins</span>
                          </div>

                          {/* Timer study button if not completed */}
                          {!stage.completed && onStartTimerForTopic && (
                            <button
                              onClick={() => onStartTimerForTopic(
                                targetItem.subjectName || 'Study Prep',
                                targetItem.chapterName || 'Revision',
                                stage.title
                              )}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold hover:bg-emerald-500/25 transition cursor-pointer"
                            >
                              <Zap className="w-3 h-3 fill-emerald-500 text-emerald-500" />
                              <span>Start Timer</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stage Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleDeleteStage(stage.id)}
                        className="p-1.5 rounded-lg text-muted hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                        title="Delete this stage"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* ADD CUSTOM STAGE ACCORDION */}
          {!showAddStage ? (
            <button
              onClick={() => setShowAddStage(true)}
              className="w-full py-2.5 rounded-xl border border-dashed border-theme hover:border-primary/60 text-xs font-semibold text-muted hover:text-primary flex items-center justify-center gap-2 transition cursor-pointer bg-theme-accent/15"
            >
              <Plus className="w-4 h-4" />
              <span>Add Custom Preparation Stage</span>
            </button>
          ) : (
            <div className="p-4 rounded-2xl border border-primary/30 bg-card space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-primary" />
                <span>New Preparation Stage</span>
              </h4>

              <div>
                <label className="block text-[11px] font-medium text-muted mb-1">Stage Title & Focus</label>
                <input
                  type="text"
                  placeholder="e.g. Past Paper Practice Drill, Active Flashcard Recall"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-theme-accent/40 border border-theme text-xs text-primary focus:outline-hidden focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-muted mb-1">Phase</label>
                  <select
                    value={newPhase}
                    onChange={(e) => setNewPhase(e.target.value as any)}
                    className="w-full px-2 py-1.5 rounded-lg bg-theme-accent/40 border border-theme text-xs text-primary capitalize"
                  >
                    <option value="research">Learning / Revision</option>
                    <option value="practice">Practice Questions</option>
                    <option value="drafting">Problem Solving</option>
                    <option value="review">Final Review</option>
                    <option value="submission">Test Attempt</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-muted mb-1">Date</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg bg-theme-accent/40 border border-theme text-xs text-primary"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-muted mb-1">Timeslot</label>
                  <select
                    value={newTimeslot}
                    onChange={(e) => setNewTimeslot(e.target.value as any)}
                    className="w-full px-2 py-1.5 rounded-lg bg-theme-accent/40 border border-theme text-xs text-primary capitalize"
                  >
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="evening">Evening</option>
                    <option value="night">Night</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-muted mb-1">Duration (mins)</label>
                  <input
                    type="number"
                    min="15"
                    max="180"
                    step="5"
                    value={newMinutes}
                    onChange={(e) => setNewMinutes(Number(e.target.value) || 30)}
                    className="w-full px-2 py-1.5 rounded-lg bg-theme-accent/40 border border-theme text-xs text-primary"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowAddStage(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-primary hover:bg-theme-accent transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddStage}
                  className="px-3.5 py-1.5 rounded-lg bg-primary text-inverted text-xs font-semibold hover:opacity-90 transition cursor-pointer shadow-xs"
                >
                  Add Milestone
                </button>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 sm:p-5 border-t border-theme/60 bg-header flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Timeline automatically adjusts based on remaining days and daily study workload.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-muted hover:text-primary hover:bg-theme-accent transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAndClose}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-primary text-inverted text-xs font-bold hover:opacity-90 transition cursor-pointer shadow-md flex items-center gap-1.5"
            >
              {isSaving ? "Saving Plan..." : "Save Preparation Plan"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
