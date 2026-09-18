import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  RotateCcw, 
  Award, 
  Clock, 
  FileText, 
  Calendar, 
  CheckCircle2, 
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { StudyPlanTopic, TopicCompletionStatus } from '../types';

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic: StudyPlanTopic | null;
  planId: string;
  onSaveCompletionDetails: (
    planId: string,
    topicId: string,
    details: {
      completed: boolean;
      completionDetails: string;
      completionStatus: TopicCompletionStatus;
      actualMinutes: number;
      scheduleRevision: boolean;
      revisionDays?: number;
      customRevisionDate?: string;
    }
  ) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  isOpen,
  onClose,
  topic,
  planId,
  onSaveCompletionDetails
}) => {
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState<TopicCompletionStatus>('Completed');
  const [actualMinutes, setActualMinutes] = useState<number>(45);
  const [scheduleRevision, setScheduleRevision] = useState(false);
  const [revisionDays, setRevisionDays] = useState<number>(3);

  useEffect(() => {
    if (topic) {
      setDetails(topic.completionDetails || '');
      setStatus(topic.completionStatus || 'Completed');
      setActualMinutes(topic.estimatedMinutes || 45);
      // If previously set to Needs Revision, pre-enable schedule revision
      if (topic.completionStatus === 'Needs Revision') {
        setScheduleRevision(true);
      } else {
        setScheduleRevision(false);
      }
    }
  }, [topic]);

  if (!isOpen || !topic) return null;

  const handleStatusChange = (newStatus: TopicCompletionStatus) => {
    setStatus(newStatus);
    if (newStatus === 'Needs Revision') {
      setScheduleRevision(true);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveCompletionDetails(planId, topic.id, {
      completed: true,
      completionDetails: details.trim(),
      completionStatus: status,
      actualMinutes: actualMinutes > 0 ? actualMinutes : topic.estimatedMinutes || 45,
      scheduleRevision: scheduleRevision || status === 'Needs Revision',
      revisionDays: revisionDays
    });
    onClose();
  };

  const calculateDueDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div 
        className="bg-white border border-[#E0DBD0] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-[#E0DBD0] bg-[#FDFCF9] flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold tracking-widest text-[#6B705C] uppercase bg-[#EAE7DF] px-2.5 py-0.5 rounded-full inline-block">
              {topic.subjectName}
            </span>
            <h2 className="text-base font-bold text-[#4A4E4D] truncate">
              {topic.topicName}
            </h2>
            {topic.chapterName && (
              <p className="text-xs text-[#A5A58D] truncate">
                {topic.chapterName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#EAE7DF] text-[#A5A58D] hover:text-[#4A4E4D] transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-5">
          {/* Status Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#6B705C] uppercase tracking-wider block">
              Outcome & Completion State
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleStatusChange('Completed')}
                className={`flex items-start gap-2.5 p-3 rounded-2xl border text-left transition cursor-pointer ${
                  status === 'Completed'
                    ? 'border-[#6B705C] bg-[#6B705C]/10 text-[#4A4E4D] font-bold shadow-2xs'
                    : 'border-[#E0DBD0] hover:bg-[#F9F7F2] text-[#6B705C]'
                }`}
              >
                <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${status === 'Completed' ? 'text-[#6B705C]' : 'text-[#A5A58D]'}`} />
                <div>
                  <div className="text-xs font-bold">Completed</div>
                  <div className="text-[10px] text-[#A5A58D]">Done & recorded</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleStatusChange('Needs Revision')}
                className={`flex items-start gap-2.5 p-3 rounded-2xl border text-left transition cursor-pointer ${
                  status === 'Needs Revision'
                    ? 'border-[#D4A373] bg-[#D4A373]/15 text-[#4A4E4D] font-bold shadow-2xs'
                    : 'border-[#E0DBD0] hover:bg-[#F9F7F2] text-[#6B705C]'
                }`}
              >
                <RotateCcw className={`w-4 h-4 mt-0.5 shrink-0 ${status === 'Needs Revision' ? 'text-[#D4A373]' : 'text-[#A5A58D]'}`} />
                <div>
                  <div className="text-xs font-bold text-[#A46328]">Needs Revision</div>
                  <div className="text-[10px] text-[#A5A58D]">Adds to Spaced Review</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleStatusChange('Mastered')}
                className={`flex items-start gap-2.5 p-3 rounded-2xl border text-left transition cursor-pointer ${
                  status === 'Mastered'
                    ? 'border-[#588157] bg-[#588157]/15 text-[#4A4E4D] font-bold shadow-2xs'
                    : 'border-[#E0DBD0] hover:bg-[#F9F7F2] text-[#6B705C]'
                }`}
              >
                <Award className={`w-4 h-4 mt-0.5 shrink-0 ${status === 'Mastered' ? 'text-[#588157]' : 'text-[#A5A58D]'}`} />
                <div>
                  <div className="text-xs font-bold text-[#3A5A40]">Mastered (100%)</div>
                  <div className="text-[10px] text-[#A5A58D]">Clear mastery</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleStatusChange('Partially completed')}
                className={`flex items-start gap-2.5 p-3 rounded-2xl border text-left transition cursor-pointer ${
                  status === 'Partially completed'
                    ? 'border-[#C58B6D] bg-[#C58B6D]/15 text-[#4A4E4D] font-bold shadow-2xs'
                    : 'border-[#E0DBD0] hover:bg-[#F9F7F2] text-[#6B705C]'
                }`}
              >
                <Clock className={`w-4 h-4 mt-0.5 shrink-0 ${status === 'Partially completed' ? 'text-[#C58B6D]' : 'text-[#A5A58D]'}`} />
                <div>
                  <div className="text-xs font-bold text-[#8C5835]">Partial Progress</div>
                  <div className="text-[10px] text-[#A5A58D]">Partly done</div>
                </div>
              </button>
            </div>
          </div>

          {/* Details / What I did input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#6B705C] uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#6B705C]" />
                <span>What Did You Do? (Details & Notes)</span>
              </label>
              <span className="text-[10px] text-[#A5A58D]">Optional</span>
            </div>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="e.g., Solved 15 NCERT practice problems, memorized core formulas, reviewed mistake booklet on integration limits..."
              rows={3}
              className="w-full bg-[#FDFCF9] border border-[#E0DBD0] rounded-2xl p-3.5 text-xs text-[#4A4E4D] placeholder-[#A5A58D] focus:outline-hidden focus:border-[#6B705C] focus:ring-1 focus:ring-[#6B705C] transition resize-none"
            />
          </div>

          {/* Actual Duration & Spaced Repetition Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Time spent */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#6B705C] uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#6B705C]" />
                <span>Time Spent (Mins)</span>
              </label>
              <input
                type="number"
                min={5}
                max={480}
                value={actualMinutes}
                onChange={(e) => setActualMinutes(parseInt(e.target.value) || 0)}
                className="w-full bg-[#FDFCF9] border border-[#E0DBD0] rounded-xl px-3 py-2 text-xs text-[#4A4E4D] font-bold focus:outline-hidden focus:border-[#6B705C]"
              />
            </div>

            {/* Revision schedule picker if Needs Revision or toggled */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#6B705C] uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#6B705C]" />
                  <span>Review In</span>
                </label>
                {(status === 'Needs Revision' || scheduleRevision) && (
                  <span className="text-[10px] font-bold text-[#D4A373]">
                    Due: {calculateDueDate(revisionDays)}
                  </span>
                )}
              </div>
              <select
                disabled={!(status === 'Needs Revision' || scheduleRevision)}
                value={revisionDays}
                onChange={(e) => setRevisionDays(parseInt(e.target.value))}
                className="w-full bg-[#FDFCF9] border border-[#E0DBD0] rounded-xl px-3 py-2 text-xs text-[#4A4E4D] font-bold focus:outline-hidden focus:border-[#6B705C] disabled:opacity-50"
              >
                <option value={1}>Tomorrow (1 Day)</option>
                <option value={3}>In 3 Days (Spaced Repetition)</option>
                <option value={7}>In 1 Week (Deep Review)</option>
                <option value={14}>In 2 Weeks</option>
              </select>
            </div>
          </div>

          {/* Auto-schedule Spaced Repetition toggle if status is not Needs Revision */}
          {status !== 'Needs Revision' && (
            <div className="bg-[#F9F7F2] p-3 rounded-2xl border border-[#E0DBD0] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-[#6B705C]" />
                <div>
                  <div className="text-xs font-bold text-[#4A4E4D]">Schedule Spaced Review</div>
                  <div className="text-[10px] text-[#A5A58D]">Add reminder to the Spaced Repetition queue</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={scheduleRevision}
                onChange={(e) => setScheduleRevision(e.target.checked)}
                className="w-4 h-4 rounded text-[#6B705C] focus:ring-[#6B705C] border-[#E0DBD0] cursor-pointer"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-full text-xs font-bold text-[#A5A58D] hover:text-[#4A4E4D] hover:bg-[#F2EFE9] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-full bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Save & Mark Completed</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
