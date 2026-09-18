import React, { useState, useMemo } from 'react';
import { 
  X, 
  Calendar as CalendarIcon, 
  Clock, 
  Plus, 
  BookOpen, 
  Tag, 
  Layers, 
  FileText, 
  Sparkles,
  Paperclip,
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from 'lucide-react';
import { 
  Assignment, 
  AssignmentPriority, 
  AssignmentStatus, 
  AssignmentType, 
  Subject, 
  StorageVault,
  AssignmentSubtask,
  StudyPlan,
  UserProfile
} from '../types';
import { generateAdaptivePrepTimeline, prepStagesToSubtasks } from '../lib/autoStudyPlanningService';

interface CreateAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  vaults?: StorageVault[];
  onSaveAssignment: (assignment: Assignment) => Promise<string | void> | void;
  existingAssignments?: Assignment[];
  existingStudyPlans?: StudyPlan[];
  userProfile?: UserProfile | null;
  defaultSubjectName?: string;
  defaultChapterName?: string;
  defaultTopicName?: string;
}

export const CreateAssignmentModal: React.FC<CreateAssignmentModalProps> = ({
  isOpen,
  onClose,
  subjects,
  vaults = [],
  onSaveAssignment,
  existingAssignments = [],
  existingStudyPlans = [],
  userProfile = null,
  defaultSubjectName = '',
  defaultChapterName = '',
  defaultTopicName = ''
}) => {
  if (!isOpen) return null;

  const tomorrowStr = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<AssignmentType>('Homework');
  const [priority, setPriority] = useState<AssignmentPriority>('Medium');
  const [status, setStatus] = useState<AssignmentStatus>('Not Started');
  const [dueDate, setDueDate] = useState(tomorrowStr);
  const [dueTime, setDueTime] = useState('23:59');
  const [estimatedMinutes, setEstimatedMinutes] = useState(60);

  const [subjectName, setSubjectName] = useState(defaultSubjectName);
  const [chapterName, setChapterName] = useState(defaultChapterName);
  const [topicName, setTopicName] = useState(defaultTopicName);

  const [notes, setNotes] = useState('');
  const [includePrepPlan, setIncludePrepPlan] = useState(true);
  const [showTimelinePreview, setShowTimelinePreview] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedSubjectObj = subjects.find(s => s.name === subjectName);
  const selectedChapterObj = selectedSubjectObj?.chapters.find(c => c.name === chapterName);

  // Compute adaptive preparation timeline preview considering existing schedule and workload
  const previewPlan = useMemo(() => {
    if (!includePrepPlan || !dueDate) return null;
    const isTestType = type === 'Test' || type === 'Quiz';
    return generateAdaptivePrepTimeline({
      targetDate: dueDate,
      targetTitle: title.trim() || (isTestType ? 'Upcoming Test' : 'Assignment Deadline'),
      targetType: type,
      subjectName: subjectName || undefined,
      chapterName: chapterName || undefined,
      topicName: topicName || undefined,
      totalEstimatedMinutes: Number(estimatedMinutes) || (isTestType ? 120 : 60),
      assignments: existingAssignments,
      plans: existingStudyPlans,
      userProfile
    });
  }, [
    includePrepPlan,
    dueDate,
    title,
    type,
    subjectName,
    chapterName,
    topicName,
    estimatedMinutes,
    existingAssignments,
    existingStudyPlans,
    userProfile
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;

    setIsSubmitting(true);
    try {
      const selectedSub = subjects.find(s => s.name === subjectName);
      const selectedChap = selectedSub?.chapters.find(c => c.name === chapterName);
      const selectedTop = selectedChap?.topics.find(t => t.name === topicName);

      // Generate automatic adaptive preparation timeline considering workload and schedule
      let subtasks: AssignmentSubtask[] = [];
      if (includePrepPlan) {
        const isTestType = type === 'Test' || type === 'Quiz';
        const adaptivePlan = generateAdaptivePrepTimeline({
          targetDate: dueDate,
          targetTitle: title.trim(),
          targetType: type,
          subjectName: subjectName || undefined,
          chapterName: chapterName || undefined,
          topicName: topicName || undefined,
          totalEstimatedMinutes: Number(estimatedMinutes) || (isTestType ? 120 : 60),
          assignments: existingAssignments,
          plans: existingStudyPlans,
          userProfile
        });
        subtasks = prepStagesToSubtasks(adaptivePlan.stages);
      }

      const newAssignment: Assignment = {
        id: `asg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId: '',
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        priority,
        status,
        dueDate,
        dueTime: dueTime || '23:59',
        estimatedMinutes: Number(estimatedMinutes) || 60,
        timeSpentMinutes: 0,
        subjectId: selectedSub?.id,
        subjectName: subjectName || undefined,
        chapterId: selectedChap?.id,
        chapterName: chapterName || undefined,
        topicId: selectedTop?.id,
        topicName: topicName || undefined,
        notes: notes.trim() || undefined,
        subtasks,
        hasPrepPlan: includePrepPlan && subtasks.length > 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await onSaveAssignment(newAssignment);
      onClose();
    } catch (err) {
      console.error("Error creating assignment:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="bg-white dark:bg-[#1E201E] border border-theme rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6 text-primary">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-theme pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Plus className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold font-serif text-primary">
                New Assignment & Deadline
              </h2>
              <p className="text-xs text-muted">
                Add coursework, test milestones, homework, or projects with smart study scheduling.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted hover:text-primary hover:bg-theme-accent transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted block">
              Assignment / Task Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Physics Chapter 4 Problem Set, Biology Lab Report, Midterm Exam..."
              className="w-full px-4 py-2.5 rounded-2xl bg-theme-accent/40 border border-theme text-xs font-bold text-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Type & Priority Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted block">
                Coursework Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AssignmentType)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-theme-accent/40 border border-theme text-xs font-medium text-primary cursor-pointer"
              >
                <option value="Homework">Homework</option>
                <option value="Assignment">Assignment</option>
                <option value="Project">Project</option>
                <option value="Test">Test / Exam</option>
                <option value="Quiz">Quiz</option>
                <option value="Presentation">Presentation</option>
                <option value="Lab work">Lab Work</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted block">
                Priority Level
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as AssignmentPriority)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-theme-accent/40 border border-theme text-xs font-medium text-primary cursor-pointer"
              >
                <option value="Low">Low Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="High">High Priority</option>
                <option value="Urgent">Urgent Priority</option>
              </select>
            </div>
          </div>

          {/* Due Date, Time & Estimated Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted block">
                Due Date *
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-theme-accent/40 border border-theme text-xs font-medium text-primary"
              >
              </input>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted block">
                Due Time
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-theme-accent/40 border border-theme text-xs font-medium text-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted block">
                Estimated Time (mins)
              </label>
              <input
                type="number"
                min="5"
                step="5"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-theme-accent/40 border border-theme text-xs font-medium text-primary text-center"
              />
            </div>
          </div>

          {/* Optional Syllabus / Curriculum Linkage */}
          <div className="p-4 rounded-2xl bg-theme-accent/30 border border-theme space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-primary">Curriculum / Syllabus Link (Optional)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <select
                value={subjectName}
                onChange={(e) => {
                  setSubjectName(e.target.value);
                  setChapterName('');
                  setTopicName('');
                }}
                className="px-3 py-2 rounded-xl bg-white dark:bg-[#1E201E] border border-theme text-xs font-medium text-primary"
              >
                <option value="">Independent / No Subject</option>
                {subjects.map(s => (
                  <option key={s.id || s.name} value={s.name}>{s.icon || '📚'} {s.name}</option>
                ))}
              </select>

              <select
                value={chapterName}
                disabled={!selectedSubjectObj}
                onChange={(e) => {
                  setChapterName(e.target.value);
                  setTopicName('');
                }}
                className="px-3 py-2 rounded-xl bg-white dark:bg-[#1E201E] border border-theme text-xs font-medium text-primary disabled:opacity-50"
              >
                <option value="">Select Chapter (Optional)</option>
                {selectedSubjectObj?.chapters.map(c => (
                  <option key={c.id || c.name} value={c.name}>{c.name}</option>
                ))}
              </select>

              <select
                value={topicName}
                disabled={!selectedChapterObj}
                onChange={(e) => setTopicName(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white dark:bg-[#1E201E] border border-theme text-xs font-medium text-primary disabled:opacity-50"
              >
                <option value="">Select Topic (Optional)</option>
                {selectedChapterObj?.topics.map(t => (
                  <option key={t.id || t.name} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted block">
              Instructions & Notes (Optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add key rubric requirements, submission links, or research instructions..."
              className="w-full p-3 rounded-2xl bg-theme-accent/40 border border-theme text-xs font-medium text-primary focus:outline-hidden"
            />
          </div>

          {/* Smart Study Plan Generation Toggle & Adaptive Timeline Preview */}
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-primary/5 border border-primary/20 cursor-pointer">
              <input
                type="checkbox"
                checked={includePrepPlan}
                onChange={(e) => setIncludePrepPlan(e.target.checked)}
                className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
              />
              <div className="text-xs flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-primary flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    Automatic Preparation Timeline
                  </span>
                  {includePrepPlan && previewPlan && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowTimelinePreview(!showTimelinePreview);
                      }}
                      className="text-[11px] text-primary font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>{showTimelinePreview ? 'Hide Preview' : 'Show Plan'}</span>
                      {showTimelinePreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}
                </div>
                <span className="text-[11px] text-muted block mt-0.5">
                  Automatically schedules preparation milestones leading up to this {type === 'Test' || type === 'Quiz' ? 'test' : 'deadline'} (revision, practice, review, attempt) based on your existing workload.
                </span>
              </div>
            </label>

            {/* Live Interactive Timeline Preview */}
            {includePrepPlan && previewPlan && showTimelinePreview && (
              <div className="p-3.5 rounded-2xl bg-card border border-theme space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between text-xs pb-1.5 border-b border-theme">
                  <span className="font-bold text-primary flex items-center gap-1">
                    <CalendarIcon className="w-3.5 h-3.5 text-primary" />
                    <span>Generated Prep Timeline ({previewPlan.stages.length} Milestones)</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-theme-accent text-muted font-medium">
                    Workload-balanced
                  </span>
                </div>

                <div className="space-y-2">
                  {previewPlan.stages.map((stage) => (
                    <div
                      key={stage.id}
                      className="p-2.5 rounded-xl bg-theme-accent/40 border border-theme/60 flex items-start justify-between gap-2.5 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                            stage.daysBeforeTarget === 0
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                              : stage.daysBeforeTarget === 1
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'bg-primary/10 text-primary'
                          }`}>
                            {stage.daysBeforeTarget === 0 
                              ? (type === 'Test' || type === 'Quiz' ? 'Test Day' : 'Due Day')
                              : `${stage.daysBeforeTarget} day${stage.daysBeforeTarget > 1 ? 's' : ''} before`}
                          </span>
                          <span className="text-[10px] text-muted font-semibold">
                            {stage.scheduledDate}
                          </span>
                          <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.2 rounded bg-theme-accent text-muted">
                            {stage.phase}
                          </span>
                        </div>
                        <p className="font-semibold text-primary text-xs mt-1 truncate">
                          {stage.title}
                        </p>
                        <p className="text-[11px] text-muted line-clamp-1 mt-0.5">
                          {stage.description}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="text-[11px] font-bold text-primary flex items-center gap-1 justify-end">
                          <Clock className="w-3 h-3 text-muted" />
                          {stage.estimatedMinutes}m
                        </span>
                        <span className="text-[10px] capitalize text-muted block mt-0.5">
                          {stage.timeslot}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-[10px] text-muted flex items-center gap-1 pt-1">
                  <AlertCircle className="w-3 h-3 shrink-0 text-primary" />
                  <span>The timeline is automatically saved to your tasks and calendar, and is fully editable anytime in Assignment Details.</span>
                </p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-theme">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl bg-theme-accent text-primary text-xs font-bold hover:bg-theme-accent/80 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-6 py-2.5 rounded-2xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create Assignment</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
