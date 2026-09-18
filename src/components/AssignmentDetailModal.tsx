import React, { useState, useEffect } from 'react';
import { 
  X, 
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
  Plus, 
  Trash2, 
  Edit3, 
  Brain, 
  Award, 
  Share2, 
  RotateCcw,
  ListTodo,
  CalendarPlus,
  Send,
  Download,
  AlertCircle
} from 'lucide-react';
import { 
  Assignment, 
  AssignmentPriority, 
  AssignmentStatus, 
  AssignmentType, 
  AssignmentSubtask, 
  AssignmentAttachment,
  Subject, 
  StorageVault,
  ActiveTab
} from '../types';
import { PreparationTimelineModal } from './PreparationTimelineModal';
import { generateAdaptivePrepTimeline, prepStagesToSubtasks } from '../lib/autoStudyPlanningService';

interface AssignmentDetailModalProps {
  assignment: Assignment | null;
  isOpen: boolean;
  onClose: () => void;
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

export const AssignmentDetailModal: React.FC<AssignmentDetailModalProps> = ({
  assignment,
  isOpen,
  onClose,
  subjects,
  vaults = [],
  onSaveAssignment,
  onDeleteAssignment,
  onStartTimerForAssignment,
  onAskTutor,
  onCreateFlashcards,
  onLogTestResult,
  setActiveTab
}) => {
  if (!isOpen || !assignment) return null;

  const [isEditing, setIsEditing] = useState(false);
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
  const [formData, setFormData] = useState<Assignment>({ ...assignment });
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskPhase, setNewSubtaskPhase] = useState<'research' | 'outline' | 'drafting' | 'review' | 'practice' | 'submission'>('drafting');
  const [newSubtaskMinutes, setNewSubtaskMinutes] = useState(30);
  const [newSubtaskDate, setNewSubtaskDate] = useState(new Date().toISOString().split('T')[0]);

  const [newAttachmentName, setNewAttachmentName] = useState('');
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [isAddingAttachment, setIsAddingAttachment] = useState(false);
  const [selectedVaultId, setSelectedVaultId] = useState('');

  // Sync state if assignment prop changes
  useEffect(() => {
    setFormData({ ...assignment });
  }, [assignment]);

  const handleFieldChange = (field: keyof Assignment, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      updatedAt: new Date().toISOString()
    }));
  };

  const handleSaveInPlace = async (updated?: Assignment) => {
    const dataToSave = updated || formData;
    await onSaveAssignment(dataToSave);
    setIsEditing(false);
  };

  const handleStatusChange = async (newStatus: AssignmentStatus) => {
    const completedAt = (newStatus === 'Completed' || newStatus === 'Submitted') ? new Date().toISOString() : undefined;
    const updated = {
      ...formData,
      status: newStatus,
      completedAt,
      updatedAt: new Date().toISOString()
    };
    setFormData(updated);
    await handleSaveInPlace(updated);
  };

  const handlePriorityChange = async (newPriority: AssignmentPriority) => {
    const updated = {
      ...formData,
      priority: newPriority,
      updatedAt: new Date().toISOString()
    };
    setFormData(updated);
    await handleSaveInPlace(updated);
  };

  // Subtasks management
  const handleToggleSubtask = async (subtaskId: string) => {
    const updatedSubtasks = (formData.subtasks || []).map(st => {
      if (st.id === subtaskId) {
        const nextCompleted = !st.completed;
        return {
          ...st,
          completed: nextCompleted,
          completedAt: nextCompleted ? new Date().toISOString() : undefined
        };
      }
      return st;
    });

    const allCompleted = updatedSubtasks.length > 0 && updatedSubtasks.every(st => st.completed);
    const updated = {
      ...formData,
      subtasks: updatedSubtasks,
      status: allCompleted && formData.status !== 'Submitted' ? 'Completed' as AssignmentStatus : formData.status,
      updatedAt: new Date().toISOString()
    };
    setFormData(updated);
    await handleSaveInPlace(updated);
  };

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;
    const newSubtask: AssignmentSubtask = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: newSubtaskTitle.trim(),
      phase: newSubtaskPhase,
      estimatedMinutes: Number(newSubtaskMinutes) || 30,
      completed: false,
      scheduledDate: newSubtaskDate || new Date().toISOString().split('T')[0],
      timeslot: 'morning'
    };

    const updated = {
      ...formData,
      subtasks: [...(formData.subtasks || []), newSubtask],
      hasPrepPlan: true,
      updatedAt: new Date().toISOString()
    };
    setFormData(updated);
    setNewSubtaskTitle('');
    await handleSaveInPlace(updated);
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    const updated = {
      ...formData,
      subtasks: (formData.subtasks || []).filter(st => st.id !== subtaskId),
      updatedAt: new Date().toISOString()
    };
    setFormData(updated);
    await handleSaveInPlace(updated);
  };

  // Auto Adaptive Study & Preparation Timeline leading up to deadline/test
  const handleGenerateStudyPlan = async () => {
    const adaptiveResult = generateAdaptivePrepTimeline({
      targetDate: formData.dueDate,
      targetTitle: formData.title,
      targetType: formData.type,
      subjectName: formData.subjectName,
      chapterName: formData.chapterName,
      topicName: formData.topicName,
      totalEstimatedMinutes: formData.estimatedMinutes || (formData.type === 'Test' || formData.type === 'Quiz' ? 120 : 90)
    });

    const generatedSubtasks = prepStagesToSubtasks(adaptiveResult.stages);

    const updated = {
      ...formData,
      subtasks: generatedSubtasks,
      hasPrepPlan: true,
      updatedAt: new Date().toISOString()
    };
    setFormData(updated);
    await handleSaveInPlace(updated);
  };

  // Reschedule unfinished prep tasks forward
  const handleReschedulePrepTasks = async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const updatedSubtasks = (formData.subtasks || []).map((st, index) => {
      if (!st.completed) {
        const offset = Math.min(index, 3);
        const newDate = new Date(Date.now() + offset * 86400000).toISOString().split('T')[0];
        return { ...st, scheduledDate: newDate };
      }
      return st;
    });

    const updated = {
      ...formData,
      subtasks: updatedSubtasks,
      updatedAt: new Date().toISOString()
    };
    setFormData(updated);
    await handleSaveInPlace(updated);
  };

  // Add attachment
  const handleAddAttachment = async () => {
    if (!newAttachmentName.trim()) return;

    let attachment: AssignmentAttachment = {
      id: `att_${Date.now()}`,
      name: newAttachmentName.trim(),
      type: newAttachmentUrl ? 'link' : selectedVaultId ? 'vault' : 'file',
      url: newAttachmentUrl.trim() || undefined,
      vaultId: selectedVaultId || undefined,
      addedAt: new Date().toISOString()
    };

    const updated = {
      ...formData,
      attachments: [...(formData.attachments || []), attachment],
      updatedAt: new Date().toISOString()
    };
    setFormData(updated);
    setNewAttachmentName('');
    setNewAttachmentUrl('');
    setSelectedVaultId('');
    setIsAddingAttachment(false);
    await handleSaveInPlace(updated);
  };

  const handleDeleteAttachment = async (attId: string) => {
    const updated = {
      ...formData,
      attachments: (formData.attachments || []).filter(a => a.id !== attId),
      updatedAt: new Date().toISOString()
    };
    setFormData(updated);
    await handleSaveInPlace(updated);
  };

  // Calculate live countdown
  const getDueCountdown = () => {
    try {
      const dueDateTimeStr = formData.dueTime ? `${formData.dueDate}T${formData.dueTime}:00` : `${formData.dueDate}T23:59:59`;
      const dueTimestamp = new Date(dueDateTimeStr).getTime();
      const diffMs = dueTimestamp - Date.now();

      if (formData.status === 'Completed' || formData.status === 'Submitted') {
        return { text: 'Completed', isOverdue: false, isUrgent: false };
      }

      if (diffMs < 0) {
        const overdueDays = Math.abs(Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        return {
          text: overdueDays === 0 ? 'Overdue today' : `Overdue by ${overdueDays} day${overdueDays > 1 ? 's' : ''}`,
          isOverdue: true,
          isUrgent: true
        };
      }

      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      const remainingHours = diffHours % 24;

      if (diffDays === 0) {
        return {
          text: `Due in ${diffHours} hour${diffHours > 1 ? 's' : ''}`,
          isOverdue: false,
          isUrgent: diffHours <= 6
        };
      }
      if (diffDays === 1) {
        return {
          text: `Due tomorrow (${remainingHours}h left)`,
          isOverdue: false,
          isUrgent: true
        };
      }
      return {
        text: `Due in ${diffDays} days`,
        isOverdue: false,
        isUrgent: diffDays <= 3
      };
    } catch {
      return { text: `Due ${formData.dueDate}`, isOverdue: false, isUrgent: false };
    }
  };

  const countdown = getDueCountdown();
  const subtasks = formData.subtasks || [];
  const completedSubtasks = subtasks.filter(s => s.completed).length;
  const subtasksProgress = subtasks.length > 0 ? Math.round((completedSubtasks / subtasks.length) * 100) : 0;

  // Selected subject helper for syllabus picker
  const selectedSubjectObj = subjects.find(s => s.name === formData.subjectName);
  const selectedChapterObj = selectedSubjectObj?.chapters.find(c => c.name === formData.chapterName);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="bg-white dark:bg-[#1E201E] border border-theme rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6 text-primary">
        
        {/* Top Action Header */}
        <div className="flex items-start justify-between gap-4 border-b border-theme pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              formData.priority === 'Urgent' 
                ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' 
                : formData.priority === 'High'
                ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                : 'bg-primary/10 text-primary border border-primary/20'
            }`}>
              {formData.type === 'Test' || formData.type === 'Quiz' ? (
                <Award className="w-6 h-6" />
              ) : formData.type === 'Project' || formData.type === 'Lab work' ? (
                <Layers className="w-6 h-6" />
              ) : (
                <FileText className="w-6 h-6" />
              )}
            </div>
            
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full font-bold bg-theme-accent text-primary border border-theme">
                  {formData.type}
                </span>

                {/* Priority Selector Pill */}
                <select
                  value={formData.priority}
                  onChange={(e) => handlePriorityChange(e.target.value as AssignmentPriority)}
                  className={`text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full font-bold cursor-pointer border focus:outline-hidden ${
                    formData.priority === 'Urgent' ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-300' :
                    formData.priority === 'High' ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300' :
                    formData.priority === 'Medium' ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300' :
                    'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300'
                  }`}
                >
                  <option value="Low">Low Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="High">High Priority</option>
                  <option value="Urgent">Urgent Priority</option>
                </select>

                {/* Status Selector Pill */}
                <select
                  value={formData.status}
                  onChange={(e) => handleStatusChange(e.target.value as AssignmentStatus)}
                  className={`text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full font-bold cursor-pointer border focus:outline-hidden ${
                    formData.status === 'Submitted' || formData.status === 'Completed'
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300'
                      : formData.status === 'In Progress'
                      ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300'
                      : formData.status === 'Overdue'
                      ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-300'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300'
                  }`}
                >
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Overdue">Overdue</option>
                </select>

                {/* Live Countdown Badge */}
                <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 border ${
                  countdown.isOverdue 
                    ? 'bg-rose-500 text-white border-rose-600 animate-pulse' 
                    : countdown.isUrgent
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                    : 'bg-theme-accent text-muted border-theme'
                }`}>
                  <Clock className="w-3 h-3" />
                  {countdown.text}
                </span>
              </div>

              {/* Title Header */}
              {isEditing ? (
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                  className="w-full text-lg sm:text-xl font-bold font-serif text-primary border-b border-primary/40 focus:outline-hidden bg-transparent py-1"
                />
              ) : (
                <h2 className="text-lg sm:text-2xl font-bold font-serif text-primary tracking-tight">
                  {formData.title}
                </h2>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`p-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                isEditing ? 'bg-primary text-white' : 'bg-theme-accent text-primary hover:bg-theme-accent/80'
              }`}
              title={isEditing ? 'Done Editing' : 'Edit Details'}
            >
              <Edit3 className="w-4 h-4" />
              <span className="hidden sm:inline">{isEditing ? 'Save' : 'Edit'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-muted hover:text-primary hover:bg-theme-accent transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Action Ribbon: Launch Focus Timer, Ask AI Tutor, Generate Flashcards, Record Test */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-theme-accent/40 border border-theme">
          <button
            onClick={() => onStartTimerForAssignment && onStartTimerForAssignment(formData)}
            className="p-3 rounded-xl bg-primary text-white text-xs font-bold flex flex-col items-center justify-center gap-1.5 hover:bg-primary/90 transition shadow-xs cursor-pointer text-center"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Launch Focus Timer</span>
          </button>

          <button
            onClick={() => {
              if (onAskTutor) {
                const prompt = `I am working on the ${formData.type} "${formData.title}" for ${formData.subjectName || 'General Studies'}. \n\nDetails: ${formData.description || 'No description'}\nNotes: ${formData.notes || 'None'}\n\nPlease provide a clear academic guide, outline, key concepts to understand, and potential trap questions.`;
                onAskTutor(prompt, formData.subjectName, formData.topicName);
              }
            }}
            className="p-3 rounded-xl bg-white dark:bg-[#252825] border border-theme text-primary text-xs font-bold flex flex-col items-center justify-center gap-1.5 hover:bg-theme-accent transition cursor-pointer text-center"
          >
            <Brain className="w-4 h-4 text-primary" />
            <span>Ask AI Tutor</span>
          </button>

          <button
            onClick={() => {
              if (onCreateFlashcards) {
                onCreateFlashcards(formData.title, formData.subjectName || 'General', formData.notes || formData.description);
              }
            }}
            className="p-3 rounded-xl bg-white dark:bg-[#252825] border border-theme text-primary text-xs font-bold flex flex-col items-center justify-center gap-1.5 hover:bg-theme-accent transition cursor-pointer text-center"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Make Flashcards</span>
          </button>

          {(formData.type === 'Test' || formData.type === 'Quiz') ? (
            <button
              onClick={() => onLogTestResult && onLogTestResult(formData)}
              className="p-3 rounded-xl bg-white dark:bg-[#252825] border border-theme text-primary text-xs font-bold flex flex-col items-center justify-center gap-1.5 hover:bg-theme-accent transition cursor-pointer text-center"
            >
              <Award className="w-4 h-4 text-emerald-600" />
              <span>Log Test Score</span>
            </button>
          ) : (
            <button
              onClick={() => handleGenerateStudyPlan()}
              className="p-3 rounded-xl bg-white dark:bg-[#252825] border border-theme text-primary text-xs font-bold flex flex-col items-center justify-center gap-1.5 hover:bg-theme-accent transition cursor-pointer text-center"
            >
              <ListTodo className="w-4 h-4 text-primary" />
              <span>AI Study Breakdown</span>
            </button>
          )}
        </div>

        {/* Academic Hierarchy & Scheduling Metadata Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-white dark:bg-[#252825] border border-theme">
          {/* Syllabus Link (Optional & Editable) */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase text-muted font-bold block flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-primary" />
              Subject & Curriculum Link
            </span>
            
            {isEditing ? (
              <div className="space-y-1.5 pt-1">
                <select
                  value={formData.subjectName || ''}
                  onChange={(e) => {
                    const subName = e.target.value;
                    const sub = subjects.find(s => s.name === subName);
                    handleFieldChange('subjectName', subName);
                    handleFieldChange('subjectId', sub?.id);
                    handleFieldChange('chapterName', '');
                    handleFieldChange('topicName', '');
                  }}
                  className="w-full text-xs p-1.5 rounded-xl border border-theme bg-theme-accent/50 text-primary font-medium"
                >
                  <option value="">Independent / General</option>
                  {subjects.map(s => (
                    <option key={s.id || s.name} value={s.name}>{s.icon || '📚'} {s.name}</option>
                  ))}
                </select>

                {selectedSubjectObj && (
                  <select
                    value={formData.chapterName || ''}
                    onChange={(e) => {
                      const chapName = e.target.value;
                      const chap = selectedSubjectObj.chapters.find(c => c.name === chapName);
                      handleFieldChange('chapterName', chapName);
                      handleFieldChange('chapterId', chap?.id);
                      handleFieldChange('topicName', '');
                    }}
                    className="w-full text-xs p-1.5 rounded-xl border border-theme bg-theme-accent/50 text-primary font-medium"
                  >
                    <option value="">Select Chapter (Optional)</option>
                    {selectedSubjectObj.chapters.map(c => (
                      <option key={c.id || c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                )}

                {selectedChapterObj && (
                  <select
                    value={formData.topicName || ''}
                    onChange={(e) => {
                      const topName = e.target.value;
                      const top = selectedChapterObj.topics.find(t => t.name === topName);
                      handleFieldChange('topicName', topName);
                      handleFieldChange('topicId', top?.id);
                    }}
                    className="w-full text-xs p-1.5 rounded-xl border border-theme bg-theme-accent/50 text-primary font-medium"
                  >
                    <option value="">Select Topic (Optional)</option>
                    {selectedChapterObj.topics.map(t => (
                      <option key={t.id || t.name} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <div className="pt-0.5">
                <span className="font-bold text-xs text-primary block">
                  {formData.subjectName ? `${formData.subjectName}` : 'Independent Coursework'}
                </span>
                {formData.chapterName && (
                  <span className="text-[11px] text-muted block truncate">
                    {formData.chapterName} {formData.topicName ? `› ${formData.topicName}` : ''}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Due Date & Time */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase text-muted font-bold block flex items-center gap-1">
              <CalendarIcon className="w-3.5 h-3.5 text-primary" />
              Due Date & Time
            </span>
            {isEditing ? (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => handleFieldChange('dueDate', e.target.value)}
                  className="w-full text-xs p-1.5 rounded-xl border border-theme bg-theme-accent/50 text-primary font-medium"
                />
                <input
                  type="time"
                  value={formData.dueTime || '23:59'}
                  onChange={(e) => handleFieldChange('dueTime', e.target.value)}
                  className="w-24 text-xs p-1.5 rounded-xl border border-theme bg-theme-accent/50 text-primary font-medium"
                />
              </div>
            ) : (
              <div className="pt-0.5">
                <span className="font-bold text-xs text-primary block">
                  {new Date(formData.dueDate).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="text-[11px] text-muted block">
                  {formData.dueTime ? `Due by ${formData.dueTime}` : 'Due by End of Day (23:59)'}
                </span>
              </div>
            )}
          </div>

          {/* Time Spent vs Estimated */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase text-muted font-bold block flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-primary" />
              Estimated vs Spent Time
            </span>
            {isEditing ? (
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1">
                  <span className="text-[9px] font-mono text-muted block">Estimated Mins</span>
                  <input
                    type="number"
                    value={formData.estimatedMinutes || 60}
                    onChange={(e) => handleFieldChange('estimatedMinutes', Number(e.target.value))}
                    className="w-full text-xs p-1.5 rounded-xl border border-theme bg-theme-accent/50 text-primary font-medium"
                  />
                </div>
                <div className="flex-1">
                  <span className="text-[9px] font-mono text-muted block">Spent Mins</span>
                  <input
                    type="number"
                    value={formData.timeSpentMinutes || 0}
                    onChange={(e) => handleFieldChange('timeSpentMinutes', Number(e.target.value))}
                    className="w-full text-xs p-1.5 rounded-xl border border-theme bg-theme-accent/50 text-primary font-medium"
                  />
                </div>
              </div>
            ) : (
              <div className="pt-0.5 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-primary">{formData.timeSpentMinutes || 0} mins logged</span>
                  <span className="text-muted text-[11px]">/ {formData.estimatedMinutes || 60} mins est.</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-theme-accent overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.round(((formData.timeSpentMinutes || 0) / (formData.estimatedMinutes || 60)) * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Description & Overview */}
        <div className="space-y-2">
          <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted block">
            Assignment Details & Guidelines
          </label>
          {isEditing ? (
            <textarea
              value={formData.description || ''}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              rows={3}
              placeholder="Describe objectives, grading rubrics, professor instructions..."
              className="w-full p-3 rounded-2xl border border-theme bg-theme-accent/30 text-xs font-medium text-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            />
          ) : (
            <div className="p-4 rounded-2xl bg-theme-accent/20 border border-theme/60 text-xs leading-relaxed text-primary">
              {formData.description || <span className="text-muted italic">No extra guidelines added yet. Click Edit to add description.</span>}
            </div>
          )}
        </div>

        {/* Preparation Subtasks & Timeline Plan */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                <span>Preparation Subtasks & Daily Schedule</span>
                {subtasks.length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                    {completedSubtasks}/{subtasks.length} ({subtasksProgress}%)
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-muted">
                Actionable study milestones scheduled across days leading up to the deadline.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsTimelineModalOpen(true)}
                className="px-2.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer"
                title="Open interactive preparation timeline leading to deadline"
              >
                <CalendarPlus className="w-3.5 h-3.5 text-primary" />
                <span>Preparation Timeline</span>
              </button>

              {subtasks.length === 0 && (
                <button
                  type="button"
                  onClick={handleGenerateStudyPlan}
                  className="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-1.5 hover:bg-primary/90 transition shadow-xs cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auto Plan</span>
                </button>
              )}

              {subtasks.length > 0 && (
                <button
                  type="button"
                  onClick={handleReschedulePrepTasks}
                  className="px-2.5 py-1.5 rounded-xl bg-theme-accent border border-theme text-primary text-[11px] font-bold flex items-center gap-1 hover:bg-theme-accent/80 transition cursor-pointer"
                  title="Reschedule unfinished tasks forward from today"
                >
                  <RotateCcw className="w-3 h-3 text-primary" />
                  <span>Reschedule</span>
                </button>
              )}
            </div>
          </div>

          {/* Subtask list */}
          {subtasks.length > 0 ? (
            <div className="space-y-2">
              {subtasks.map((st) => (
                <div
                  key={st.id}
                  className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs transition ${
                    st.completed 
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/40 opacity-80' 
                      : 'bg-white dark:bg-[#252825] border-theme hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => handleToggleSubtask(st.id)}
                      className={`w-5 h-5 rounded-lg flex items-center justify-center transition shrink-0 cursor-pointer border ${
                        st.completed 
                          ? 'bg-emerald-600 border-emerald-600 text-white' 
                          : 'border-theme bg-white dark:bg-[#1E201E] hover:border-primary'
                      }`}
                    >
                      {st.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>

                    <div className="min-w-0">
                      <span className={`font-medium block truncate ${st.completed ? 'line-through text-muted' : 'text-primary font-bold'}`}>
                        {st.title}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] text-muted flex-wrap">
                        <span className="uppercase font-mono font-bold text-primary/70">{st.phase}</span>
                        <span>• {st.estimatedMinutes} mins</span>
                        {st.scheduledDate && (
                          <span className="flex items-center gap-1 font-mono text-primary/80">
                            <CalendarIcon className="w-3 h-3" />
                            {new Date(st.scheduledDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteSubtask(st.id)}
                    className="p-1 rounded-lg text-muted hover:text-rose-600 transition cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-theme-accent/30 border border-dashed border-theme text-center text-xs text-muted">
              No preparation subtasks added yet. Click <strong>Generate 4-Phase Study Plan</strong> or add custom study tasks below.
            </div>
          )}

          {/* Quick Add Subtask row */}
          <div className="p-3 rounded-2xl bg-white dark:bg-[#252825] border border-theme flex flex-col sm:flex-row items-center gap-2">
            <input
              type="text"
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
              placeholder="e.g. Read chapters 3 & 4; solve odd numbered problems..."
              className="flex-1 w-full px-3 py-1.5 rounded-xl bg-theme-accent/40 border border-theme text-xs font-medium text-primary focus:outline-hidden"
            />
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={newSubtaskPhase}
                onChange={(e) => setNewSubtaskPhase(e.target.value as any)}
                className="px-2 py-1.5 rounded-xl bg-theme-accent/40 border border-theme text-xs text-primary font-mono"
              >
                <option value="research">Research</option>
                <option value="outline">Outline</option>
                <option value="drafting">Drafting</option>
                <option value="practice">Practice</option>
                <option value="review">Review</option>
                <option value="submission">Submission</option>
              </select>

              <input
                type="number"
                value={newSubtaskMinutes}
                onChange={(e) => setNewSubtaskMinutes(Number(e.target.value))}
                placeholder="Mins"
                className="w-16 px-2 py-1.5 rounded-xl bg-theme-accent/40 border border-theme text-xs text-primary font-mono text-center"
              />

              <input
                type="date"
                value={newSubtaskDate}
                onChange={(e) => setNewSubtaskDate(e.target.value)}
                className="px-2 py-1.5 rounded-xl bg-theme-accent/40 border border-theme text-xs text-primary font-mono"
              />

              <button
                onClick={handleAddSubtask}
                disabled={!newSubtaskTitle.trim()}
                className="px-3.5 py-1.5 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-1 hover:bg-primary/90 transition cursor-pointer disabled:opacity-50 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Task</span>
              </button>
            </div>
          </div>
        </div>

        {/* Coursework Attachments & Storage Vault Links */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-primary flex items-center gap-2">
              <Paperclip className="w-3.5 h-3.5 text-primary" />
              <span>Attachments & Study Vault Materials</span>
              {(formData.attachments || []).length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                  {formData.attachments?.length} Attached
                </span>
              )}
            </h3>

            <button
              onClick={() => setIsAddingAttachment(!isAddingAttachment)}
              className="text-xs text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Attach Resource</span>
            </button>
          </div>

          {/* Attachments List */}
          {(formData.attachments || []).length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {formData.attachments?.map((att) => (
                <div
                  key={att.id}
                  className="p-3 rounded-2xl bg-white dark:bg-[#252825] border border-theme flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-theme-accent text-primary flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-primary block truncate">{att.name}</span>
                      <span className="text-[10px] text-muted block uppercase font-mono">
                        {att.type} {att.fileSize ? `• ${att.fileSize}` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {att.url && (
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg text-primary hover:bg-theme-accent transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => handleDeleteAttachment(att.id)}
                      className="p-1.5 rounded-lg text-muted hover:text-rose-600 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-theme-accent/20 border border-dashed border-theme text-xs text-muted text-center">
              No documents, links, or study vault materials linked yet.
            </div>
          )}

          {/* Add Attachment Form */}
          {isAddingAttachment && (
            <div className="p-4 rounded-2xl bg-theme-accent/40 border border-theme space-y-3 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newAttachmentName}
                  onChange={(e) => setNewAttachmentName(e.target.value)}
                  placeholder="Resource Name (e.g. Lab Protocol, Lecture Slides)"
                  className="px-3 py-2 rounded-xl bg-white dark:bg-[#1E201E] border border-theme text-xs font-medium text-primary focus:outline-hidden"
                />

                <input
                  type="url"
                  value={newAttachmentUrl}
                  onChange={(e) => setNewAttachmentUrl(e.target.value)}
                  placeholder="URL link (e.g. Google Drive, Classroom post, Web)"
                  className="px-3 py-2 rounded-xl bg-white dark:bg-[#1E201E] border border-theme text-xs font-medium text-primary focus:outline-hidden"
                />
              </div>

              {vaults.length > 0 && (
                <div>
                  <span className="text-[10px] font-mono text-muted uppercase block mb-1 font-bold">Or Link Existing Study Vault</span>
                  <select
                    value={selectedVaultId}
                    onChange={(e) => setSelectedVaultId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1E201E] border border-theme text-xs font-medium text-primary"
                  >
                    <option value="">Select a Storage Vault...</option>
                    {vaults.map(v => (
                      <option key={v.id} value={v.id}>{v.name} ({v.subjectName})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setIsAddingAttachment(false)}
                  className="px-3 py-1.5 rounded-xl bg-theme-accent text-xs font-bold text-muted hover:text-primary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddAttachment}
                  disabled={!newAttachmentName.trim()}
                  className="px-4 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition cursor-pointer disabled:opacity-50"
                >
                  Attach Resource
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Rich Notes & Self-Study Scratchpad */}
        <div className="space-y-2">
          <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted block">
            Personal Notes & Solution Draft
          </label>
          <textarea
            value={formData.notes || ''}
            onChange={(e) => handleFieldChange('notes', e.target.value)}
            onBlur={() => handleSaveInPlace()}
            rows={3}
            placeholder="Write reminders, formulas, key steps, draft thoughts..."
            className="w-full p-3 rounded-2xl border border-theme bg-white dark:bg-[#252825] text-xs font-medium text-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20"
          />
          <span className="text-[10px] text-muted block text-right font-mono">
            Auto-saves locally and syncs to Google Cloud Firestore on blur.
          </span>
        </div>

        {/* Modal Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-theme">
          <button
            onClick={() => {
              if (window.confirm(`Delete "${formData.title}"?`)) {
                onDeleteAssignment(formData.id);
                onClose();
              }
            }}
            className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Assignment</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl bg-theme-accent text-primary text-xs font-bold hover:bg-theme-accent/80 transition cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={() => {
                handleSaveInPlace();
                onClose();
              }}
              className="px-6 py-2.5 rounded-2xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition shadow-xs cursor-pointer"
            >
              Save & Close
            </button>
          </div>
        </div>

      </div>

      {/* Interactive Preparation Timeline Modal */}
      {isTimelineModalOpen && (
        <PreparationTimelineModal
          isOpen={isTimelineModalOpen}
          onClose={() => setIsTimelineModalOpen(false)}
          targetItem={{
            id: formData.id,
            title: formData.title,
            type: formData.type,
            subjectName: formData.subjectName,
            chapterName: formData.chapterName,
            topicName: formData.topicName,
            dueDate: formData.dueDate,
            dueTime: formData.dueTime,
            subtasks: formData.subtasks || []
          }}
          onSaveSubtasks={async (targetId, updatedSubtasks) => {
            const updated = {
              ...formData,
              subtasks: updatedSubtasks,
              hasPrepPlan: updatedSubtasks.length > 0,
              updatedAt: new Date().toISOString()
            };
            setFormData(updated);
            await handleSaveInPlace(updated);
          }}
        />
      )}
    </div>
  );
};
