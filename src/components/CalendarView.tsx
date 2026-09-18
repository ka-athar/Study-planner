import React, { useState, useRef, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Award, 
  X, 
  Download, 
  Check, 
  Play, 
  ExternalLink, 
  Share2, 
  Plus, 
  BookOpen, 
  FileText,
  RefreshCw,
  Trash2,
  RotateCcw
} from 'lucide-react';
import { StudySession, StudyPlan, StudyPlanTopic, TestResult, RevisionItem, UserProfile, Subject, ActiveTab, Assignment } from '../types';
import { generateIcsCalendarContent, downloadIcsFile } from '../lib/icsExport';
import { AICalendarScheduleImporter } from './AICalendarScheduleImporter';
import { TwoWaySyncModal } from './TwoWaySyncModal';

interface CalendarViewProps {
  sessions: StudySession[];
  plans: StudyPlan[];
  testResults: TestResult[];
  revisions: RevisionItem[];
  assignments?: Assignment[];
  userProfile: UserProfile | null;
  subjects?: Subject[];
  onSavePlan?: (plan: StudyPlan) => void;
  onUpdateProfile?: (profile: UserProfile) => void;
  onStartTimerForTopic?: (subjectName: string, chapterName: string, topicName: string) => void;
  setActiveTab?: (tab: ActiveTab) => void;
  onOpenWorkspaceHub?: (tab?: 'calendar' | 'drive' | 'keep' | 'tasks') => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  sessions,
  plans,
  testResults,
  revisions,
  assignments = [],
  userProfile,
  subjects = [],
  onSavePlan,
  onUpdateProfile,
  onStartTimerForTopic,
  setActiveTab,
  onOpenWorkspaceHub
}) => {
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date());
  const [selectedDayStr, setSelectedDayStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [showImporterBox, setShowImporterBox] = useState<boolean>(true);
  const [isTwoWaySyncOpen, setIsTwoWaySyncOpen] = useState<boolean>(false);
  const importerSectionRef = useRef<HTMLDivElement>(null);

  // ICS Export Modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportScope, setExportScope] = useState<'all' | 'month' | 'day'>('all');
  const [incPlans, setIncPlans] = useState<boolean>(true);
  const [incSessions, setIncSessions] = useState<boolean>(true);
  const [incExams, setIncExams] = useState<boolean>(true);
  const [incRevisions, setIncRevisions] = useState<boolean>(true);
  const [incTests, setIncTests] = useState<boolean>(true);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  // Quick Task Scheduling state for selected day
  const [isAddingTask, setIsAddingTask] = useState<boolean>(false);
  const [newTaskTopic, setNewTaskTopic] = useState<string>('');
  const [newTaskSubject, setNewTaskSubject] = useState<string>('');
  const [newTaskChapter, setNewTaskChapter] = useState<string>('');
  const [newTaskMinutes, setNewTaskMinutes] = useState<number>(45);
  const [newTaskReason, setNewTaskReason] = useState<string>('');
  const [taskActionNotice, setTaskActionNotice] = useState<string | null>(null);

  // Set default subject when subjects prop changes or dialog opens
  useEffect(() => {
    if (subjects.length > 0 && !newTaskSubject) {
      setNewTaskSubject(subjects[0].name);
    }
  }, [subjects]);

  const handleSaveQuickTask = () => {
    if (!newTaskTopic.trim()) return;
    const resolvedSubject = newTaskSubject.trim() || (subjects.length > 0 ? subjects[0].name : 'General');
    const newTopicItem: StudyPlanTopic = {
      id: `topic-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      subjectName: resolvedSubject,
      chapterName: newTaskChapter.trim() || 'General',
      topicName: newTaskTopic.trim(),
      estimatedMinutes: newTaskMinutes || 45,
      priority: 'Medium',
      reason: newTaskReason.trim() || 'Scheduled study task',
      completed: false
    };

    if (dayPlan) {
      const updatedPlan: StudyPlan = {
        ...dayPlan,
        topics: [...dayPlan.topics, newTopicItem]
      };
      if (onSavePlan) onSavePlan(updatedPlan);
    } else {
      const newPlan: StudyPlan = {
        id: `plan-${Date.now()}`,
        userId: userProfile?.id || 'guest',
        title: `Plan for ${selectedDayStr}`,
        date: selectedDayStr,
        topics: [newTopicItem],
        reasoning: 'Self-scheduled calendar study session',
        createdAt: new Date().toISOString()
      };
      if (onSavePlan) onSavePlan(newPlan);
    }

    setTaskActionNotice(`✓ Added "${newTopicItem.topicName}" to ${selectedDayStr} & synced across devices!`);
    setNewTaskTopic('');
    setNewTaskChapter('');
    setNewTaskReason('');
    setIsAddingTask(false);
    setTimeout(() => setTaskActionNotice(null), 4000);
  };

  const handleDeleteQuickTask = (topicIdx: number) => {
    if (!dayPlan) return;
    const removedTopic = dayPlan.topics[topicIdx];
    const updatedTopics = dayPlan.topics.filter((_, idx) => idx !== topicIdx);
    const updatedPlan: StudyPlan = {
      ...dayPlan,
      topics: updatedTopics
    };
    if (onSavePlan) onSavePlan(updatedPlan);
    setTaskActionNotice(`Removed "${removedTopic?.topicName || 'task'}" and synced across devices.`);
    setTimeout(() => setTaskActionNotice(null), 3000);
  };

  const handleTriggerExport = () => {
    let startDate: string | undefined;
    let endDate: string | undefined;

    if (exportScope === 'month') {
      const year = currentMonthDate.getFullYear();
      const monthFormatted = String(currentMonthDate.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, currentMonthDate.getMonth() + 1, 0).getDate();
      const lastDayFormatted = String(lastDay).padStart(2, '0');

      startDate = `${year}-${monthFormatted}-01`;
      endDate = `${year}-${monthFormatted}-${lastDayFormatted}`;
    } else if (exportScope === 'day') {
      startDate = selectedDayStr;
      endDate = selectedDayStr;
    }

    const icsString = generateIcsCalendarContent({
      plans,
      sessions,
      examDates: userProfile?.examDates || [],
      revisions,
      testResults,
      includePlans: incPlans,
      includeSessions: incSessions,
      includeExams: incExams,
      includeRevisions: incRevisions,
      includeTests: incTests,
      calendarName: userProfile?.displayName ? `${userProfile.displayName}'s Study Schedule` : 'StudyFlow Academic Schedule',
      startDate,
      endDate
    });

    const filename = exportScope === 'month' 
      ? `study_schedule_${currentMonthDate.toLocaleString('en-US', { month: 'short', year: 'numeric' }).replace(' ', '_')}.ics`
      : exportScope === 'day'
      ? `study_schedule_${selectedDayStr}.ics`
      : 'study_schedule_full.ics';

    downloadIcsFile(icsString, filename);

    setExportSuccessMsg(`Successfully generated and downloaded ${filename}! Import it into Google Calendar, Outlook, or Apple Calendar.`);
    setTimeout(() => {
      setExportSuccessMsg(null);
    }, 6000);
  };

  // Month navigation
  const nextMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1));
  };

  // When AI importer adds dates
  const handleDatesImported = (dates: string[]) => {
    if (dates.length > 0) {
      const firstDate = dates[0];
      setSelectedDayStr(firstDate);
      const [y, m] = firstDate.split('-');
      setCurrentMonthDate(new Date(parseInt(y), parseInt(m) - 1, 1));
    }
  };

  const monthYearStr = currentMonthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Generate days matrix for calendar grid
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const daysArray: (string | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    daysArray.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dayFormatted = String(d).padStart(2, '0');
    const monthFormatted = String(month + 1).padStart(2, '0');
    daysArray.push(`${year}-${monthFormatted}-${dayFormatted}`);
  }

  // Day specific data filters for selectedDayStr
  const daySessions = sessions.filter(s => s.date === selectedDayStr);
  const dayPlan = plans.find(p => p.date === selectedDayStr);
  const dayTests = testResults.filter(t => t.date === selectedDayStr);
  const dayExams = (userProfile?.examDates || []).filter(e => e.date === selectedDayStr);
  const dayRevisions = revisions.filter(r => r.dueDate === selectedDayStr);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Bar */}
      <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-serif italic font-bold text-[#6B705C] flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-[#6B705C]" />
            <span>Academic Study Calendar</span>
          </h2>
          <p className="text-xs text-[#A5A58D] mt-1">
            View, analyze, and preset your weekly and monthly study schedules with AI.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Two-Way Google Calendar & Tasks Sync Button */}
          <button
            onClick={() => setIsTwoWaySyncOpen(true)}
            className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition flex items-center gap-2 shadow-xs cursor-pointer"
            title="Run Bidirectional Google Calendar & Google Tasks 2-Way Sync"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>2-Way Google Sync</span>
          </button>

          {onOpenWorkspaceHub && (
            <button
              onClick={() => onOpenWorkspaceHub('calendar')}
              className="px-4 py-2 rounded-full bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs transition flex items-center gap-2 shadow-xs cursor-pointer"
              title="Sync study schedule directly with your live Google Calendar"
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Google Calendar Sync</span>
            </button>
          )}

          <button
            onClick={() => {
              setShowImporterBox(true);
              setTimeout(() => {
                importerSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }}
            className="px-4 py-2 rounded-full bg-[#6B705C]/15 hover:bg-[#6B705C]/25 text-[#6B705C] font-bold text-xs transition flex items-center gap-1.5 shadow-2xs border border-[#6B705C]/30 cursor-pointer"
            title="Open paste box to import weekly or monthly timetable"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Paste Schedule Box</span>
          </button>

          <button
            onClick={() => setIsExportModalOpen(true)}
            className="px-4 py-2 rounded-full bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-medium text-xs transition flex items-center gap-2 shadow-xs"
            title="Export schedule as .ics file for Google Calendar / Outlook"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export .ICS</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const today = new Date();
                setCurrentMonthDate(today);
                setSelectedDayStr(today.toISOString().split('T')[0]);
              }}
              className="px-3 py-1.5 rounded-2xl bg-[#F9F7F2] hover:bg-[#F2EFE9] text-[#6B705C] border border-[#E0DBD0] text-xs font-bold font-mono transition shadow-2xs cursor-pointer"
              title="Snap calendar directly back to today"
            >
              Today
            </button>

            <div className="flex items-center gap-2 bg-[#F9F7F2] p-1.5 rounded-2xl border border-[#E0DBD0]">
              <button onClick={prevMonth} className="p-1.5 text-[#A5A58D] hover:text-[#4A4E4D] rounded-xl transition cursor-pointer">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold font-mono text-[#4A4E4D] px-3">{monthYearStr}</span>
              <button onClick={nextMonth} className="p-1.5 text-[#A5A58D] hover:text-[#4A4E4D] rounded-xl transition cursor-pointer">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI CALENDAR & SCHEDULE IMPORTER BOX (Prominently available in Calendar Area) */}
      <div ref={importerSectionRef}>
        {onSavePlan && (
          <AICalendarScheduleImporter
            subjects={subjects}
            userProfile={userProfile}
            onSavePlan={onSavePlan}
            onUpdateProfile={onUpdateProfile}
            onDatesImported={handleDatesImported}
            initialOpen={showImporterBox}
          />
        )}
      </div>

      {/* Calendar Grid & Day Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-4">
          {/* Days Header */}
          <div className="grid grid-cols-7 text-center text-xs font-bold text-[#A5A58D] font-mono py-2 border-b border-[#E0DBD0]">
            <span>SUN</span>
            <span>MON</span>
            <span>TUE</span>
            <span>WED</span>
            <span>THU</span>
            <span>FRI</span>
            <span>SAT</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-2">
            {daysArray.map((dateStr, idx) => {
              if (!dateStr) {
                return <div key={`empty-${idx}`} className="h-20 bg-[#F9F7F2]/40 rounded-2xl"></div>;
              }

              const isSelected = dateStr === selectedDayStr;
              const isToday = dateStr === new Date().toISOString().split('T')[0];

              const hasSessions = sessions.some(s => s.date === dateStr);
              const dayPlansForDate = plans.filter(p => p.date === dateStr);
              const hasPlan = dayPlansForDate.length > 0;
              const totalPlannedTopics = dayPlansForDate.reduce((acc, p) => acc + p.topics.length, 0);
              const hasExam = (userProfile?.examDates || []).some(e => e.date === dateStr);
              const dayRevisionsForDate = revisions.filter(r => r.dueDate === dateStr);
              const hasRevisions = dayRevisionsForDate.length > 0;
              const dayNum = parseInt(dateStr.split('-')[2]);

              // Gather badges for event stacking
              const dayBadges: Array<{ label: string; className: string }> = [];
              if (hasExam) {
                dayBadges.push({ label: 'Exam', className: 'bg-rose-100 text-rose-800' });
              }
              if (hasSessions) {
                dayBadges.push({ label: '✓ Studied', className: 'bg-[#6B705C]/20 text-[#6B705C]' });
              }
              if (hasPlan) {
                dayBadges.push({ label: `Plan (${totalPlannedTopics})`, className: 'bg-amber-100 text-amber-800' });
              }
              if (hasRevisions) {
                dayBadges.push({ label: `Rev (${dayRevisionsForDate.length})`, className: 'bg-purple-100 text-purple-800' });
              }
              const dayAssignmentsForDate = (assignments || []).filter(a => a.dueDate === dateStr && !a.completed);
              if (dayAssignmentsForDate.length > 0) {
                dayBadges.push({ label: `Due (${dayAssignmentsForDate.length})`, className: 'bg-blue-100 text-blue-800' });
              }

              // Event stacking: show first 2 items; if 3 or more, show 1 item + "+N more" badge
              const visibleBadges = dayBadges.length > 2 ? dayBadges.slice(0, 1) : dayBadges;
              const overflowCount = dayBadges.length - visibleBadges.length;

              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedDayStr(dateStr)}
                  className={`min-h-[82px] p-2 rounded-2xl cursor-pointer border transition flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[#6B705C]/15 border-[#6B705C] shadow-xs'
                      : isToday
                      ? 'bg-[#F2EFE9] border-[#6B705C]'
                      : 'bg-[#F9F7F2] border-[#E0DBD0] hover:bg-[#F2EFE9]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-mono font-bold ${isToday ? 'text-[#6B705C]' : 'text-[#4A4E4D]'}`}>
                      {dayNum}
                    </span>
                    {hasExam && (
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shadow-2xs" title="Exam scheduled"></span>
                    )}
                  </div>

                  <div className="space-y-1">
                    {visibleBadges.map((b, bIdx) => (
                      <div
                        key={bIdx}
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded truncate leading-tight ${b.className}`}
                      >
                        {b.label}
                      </div>
                    ))}
                    {overflowCount > 0 && (
                      <div
                        className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#EAE7DF] text-[#4A4E4D] border border-[#E0DBD0] truncate"
                        title={`${overflowCount} more items today. Click day to view all.`}
                      >
                        +{overflowCount} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Detail Drawer */}
        <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-5">
          <div className="border-b border-[#E0DBD0] pb-3 flex items-center justify-between">
            <div>
              <span className="text-xs font-mono text-[#6B705C] uppercase font-bold tracking-widest">Day Details & Logs</span>
              <h3 className="text-base font-serif italic font-bold text-[#6B705C] mt-0.5">{selectedDayStr}</h3>
            </div>

            <div className="flex items-center gap-2">
              {dayPlan && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                  {dayPlan.topics.length} Task(s)
                </span>
              )}
            </div>
          </div>

          {/* Feedback notice for added/deleted task */}
          {taskActionNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium rounded-2xl flex items-center gap-2 animate-fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{taskActionNotice}</span>
            </div>
          )}

          {/* Scheduled Exams */}
          {dayExams.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs space-y-1">
              <span className="font-bold text-rose-800 flex items-center gap-1">
                <Award className="w-3.5 h-3.5" /> Exam Scheduled Today!
              </span>
              {dayExams.map((e) => (
                <div key={e.id} className="text-rose-700 font-medium">
                  {e.examName} ({e.subjectName})
                </div>
              ))}
            </div>
          )}

          {/* Planned Tasks */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#6B705C] uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#6B705C]" />
                <span>Planned Tasks for this Date:</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsAddingTask(!isAddingTask)}
                className="px-2.5 py-1 bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>{isAddingTask ? 'Cancel' : 'Add Task'}</span>
              </button>
            </div>

            {/* Inline Quick Task Creator */}
            {isAddingTask && (
              <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#6B705C]/30 space-y-3 animate-fade-in">
                <div className="text-xs font-bold text-[#6B705C] uppercase tracking-wider font-mono">
                  Schedule Task on {selectedDayStr}
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={newTaskTopic}
                    onChange={(e) => setNewTaskTopic(e.target.value)}
                    placeholder="Topic or task name (e.g., Optics Formulas Review)"
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E0DBD0] rounded-xl focus:outline-hidden focus:border-[#6B705C]"
                    autoFocus
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-[#A5A58D] font-mono mb-1">Subject</label>
                      {subjects.length > 0 ? (
                        <select
                          value={newTaskSubject}
                          onChange={(e) => {
                            setNewTaskSubject(e.target.value);
                            setNewTaskChapter('');
                          }}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E0DBD0] rounded-xl focus:outline-hidden"
                        >
                          {subjects.map((s) => (
                            <option key={s.id} value={s.name}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={newTaskSubject}
                          onChange={(e) => setNewTaskSubject(e.target.value)}
                          placeholder="Subject name"
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E0DBD0] rounded-xl focus:outline-hidden"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] text-[#A5A58D] font-mono mb-1">Chapter / Unit</label>
                      {(() => {
                        const selSub = subjects.find(s => s.name === newTaskSubject);
                        if (selSub && selSub.chapters && selSub.chapters.length > 0) {
                          return (
                            <select
                              value={newTaskChapter}
                              onChange={(e) => setNewTaskChapter(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E0DBD0] rounded-xl focus:outline-hidden"
                            >
                              <option value="">(Select Chapter)</option>
                              {selSub.chapters.map((c) => (
                                <option key={c.id} value={c.name}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          );
                        }
                        return (
                          <input
                            type="text"
                            value={newTaskChapter}
                            onChange={(e) => setNewTaskChapter(e.target.value)}
                            placeholder="Optional chapter"
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E0DBD0] rounded-xl focus:outline-hidden"
                          />
                        );
                      })()}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-[#A5A58D] font-mono mb-1">Estimated Duration</label>
                    <div className="flex flex-wrap gap-1.5">
                      {[15, 30, 45, 60, 90].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setNewTaskMinutes(mins)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition cursor-pointer ${
                            newTaskMinutes === mins
                              ? 'bg-[#6B705C] text-white'
                              : 'bg-white border border-[#E0DBD0] text-[#4A4E4D] hover:bg-[#F2EFE9]'
                          }`}
                        >
                          {mins}m
                        </button>
                      ))}
                    </div>
                  </div>

                  <input
                    type="text"
                    value={newTaskReason}
                    onChange={(e) => setNewTaskReason(e.target.value)}
                    placeholder="Focus objective / notes (optional)"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-[#E0DBD0] rounded-xl focus:outline-hidden"
                  />

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingTask(false)}
                      className="px-3 py-1.5 text-xs font-medium text-[#A5A58D] hover:text-[#4A4E4D]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveQuickTask}
                      disabled={!newTaskTopic.trim()}
                      className="px-4 py-1.5 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                    >
                      Save & Sync Task
                    </button>
                  </div>
                </div>
              </div>
            )}

            {dayPlan && dayPlan.topics.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {dayPlan.topics.map((t, idx) => (
                  <div key={idx} className="p-3 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-xs space-y-1.5 group">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-[#4A4E4D]">{t.topicName}</div>
                        <div className="text-[11px] text-[#A5A58D]">
                          {t.subjectName} {t.chapterName ? `• ${t.chapterName}` : ''} • ~{t.estimatedMinutes} mins
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {onStartTimerForTopic && (
                          <button
                            type="button"
                            onClick={() => {
                              onStartTimerForTopic(t.subjectName, t.chapterName, t.topicName);
                              if (setActiveTab) setActiveTab('timer');
                            }}
                            className="px-2.5 py-1 bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-[10px] font-bold rounded-lg transition flex items-center gap-1 shrink-0 shadow-2xs cursor-pointer"
                            title="Start study timer for this topic"
                          >
                            <Play className="w-2.5 h-2.5 fill-current" />
                            <span>Study</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteQuickTask(idx)}
                          className="p-1 text-[#A5A58D] hover:text-rose-600 rounded-md hover:bg-rose-50 transition cursor-pointer"
                          title="Remove task from plan"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {t.reason && (
                      <div className="text-[10px] text-[#6B705C] bg-white px-2 py-0.5 rounded-md border border-[#E0DBD0] italic">
                        {t.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#A5A58D] italic">No specific plan logged for this day. Click "+ Add Task" to schedule one!</p>
            )}
          </div>

          {/* Revision Topics Due Today */}
          {dayRevisions.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-[#E0DBD0]">
              <h4 className="text-xs font-bold text-purple-800 uppercase tracking-widest flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-purple-700" />
                <span>Revision Topics Due ({dayRevisions.length}):</span>
              </h4>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {dayRevisions.map((r) => (
                  <div key={r.id} className="p-3 rounded-2xl bg-purple-50/70 border border-purple-200 text-xs space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-[#4A4E4D]">{r.topicName}</div>
                        <div className="text-[11px] text-[#A5A58D]">{r.subjectName} • {r.chapterName}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.priority === 'High' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {r.priority}
                        </span>
                        {onStartTimerForTopic && (
                          <button
                            type="button"
                            onClick={() => {
                              onStartTimerForTopic(r.subjectName, r.chapterName, r.topicName);
                              if (setActiveTab) setActiveTab('timer');
                            }}
                            className="px-2 py-1 bg-purple-700 hover:bg-purple-800 text-white text-[10px] font-bold rounded-lg transition flex items-center gap-1 shrink-0 cursor-pointer"
                            title="Start revision session"
                          >
                            <Play className="w-2.5 h-2.5 fill-current" />
                            <span>Review</span>
                          </button>
                        )}
                      </div>
                    </div>
                    {r.reason && (
                      <div className="text-[10px] text-purple-900 bg-white/80 px-2 py-0.5 rounded border border-purple-100 italic">
                        {r.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assignments Due on Selected Day */}
          {(() => {
            const dayAssignments = (assignments || []).filter(a => a.dueDate === selectedDayStr);
            if (dayAssignments.length === 0) return null;
            return (
              <div className="space-y-2 pt-3 border-t border-[#E0DBD0]">
                <h4 className="text-xs font-bold text-blue-800 uppercase tracking-widest flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-700" />
                  <span>Assignments Due ({dayAssignments.length}):</span>
                </h4>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {dayAssignments.map((a) => (
                    <div key={a.id} className="p-3 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-[#4A4E4D]">{a.title}</div>
                          <div className="text-[11px] text-[#A5A58D]">{a.subjectName}</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          a.completed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {a.completed ? 'Completed' : a.priority}
                        </span>
                      </div>
                      {a.description && (
                        <div className="text-[11px] text-[#4A4E4D] italic line-clamp-2">
                          {a.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Actually Accomplished Study Sessions */}
          <div className="space-y-2 pt-3 border-t border-[#E0DBD0]">
            <h4 className="text-xs font-bold text-[#6B705C] uppercase tracking-widest flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#6B705C]" />
              <span>Accomplished Sessions:</span>
            </h4>
            {daySessions.length > 0 ? (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {daySessions.map((s) => (
                  <div key={s.id} className="p-3 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono text-[#A5A58D]">
                      <span>{s.subjectName}</span>
                      <span>{s.startTime} - {s.endTime}</span>
                    </div>
                    <div className="font-bold text-[#4A4E4D]">{s.topicName}</div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#6B705C] font-mono font-bold">{s.durationMinutes} mins</span>
                      <span className="font-bold text-[#4A4E4D]">{s.result}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#A5A58D] italic">No study sessions recorded on this day.</p>
            )}
          </div>
        </div>
      </div>

      {/* Export .ICS Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#4A4E4D]/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#E0DBD0] rounded-3xl max-w-lg w-full p-6 shadow-xl relative text-[#4A4E4D] space-y-5">
            <div className="flex items-center justify-between border-b border-[#E0DBD0] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#6B705C]/10 text-[#6B705C] flex items-center justify-center font-bold">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-serif italic font-bold text-[#6B705C]">Export Calendar (.ICS)</h3>
                  <p className="text-[11px] text-[#A5A58D]">Sync study schedule with Google Calendar, Outlook, or Apple Calendar</p>
                </div>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="text-[#A5A58D] hover:text-[#4A4E4D] p-1.5 rounded-full hover:bg-[#F9F7F2]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Success Banner */}
            {exportSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-2xl flex items-center gap-2 animate-fade-in">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{exportSuccessMsg}</span>
              </div>
            )}

            {/* Scope Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#6B705C] uppercase tracking-wider">1. Date Range Scope</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setExportScope('all')}
                  className={`p-3 rounded-2xl text-xs font-bold border transition text-center ${
                    exportScope === 'all'
                      ? 'bg-[#6B705C] text-white border-[#6B705C]'
                      : 'bg-[#F9F7F2] border-[#E0DBD0] text-[#4A4E4D] hover:bg-[#F2EFE9]'
                  }`}
                >
                  Full Schedule
                </button>
                <button
                  type="button"
                  onClick={() => setExportScope('month')}
                  className={`p-3 rounded-2xl text-xs font-bold border transition text-center ${
                    exportScope === 'month'
                      ? 'bg-[#6B705C] text-white border-[#6B705C]'
                      : 'bg-[#F9F7F2] border-[#E0DBD0] text-[#4A4E4D] hover:bg-[#F2EFE9]'
                  }`}
                >
                  {currentMonthDate.toLocaleString('en-US', { month: 'short' })} Only
                </button>
                <button
                  type="button"
                  onClick={() => setExportScope('day')}
                  className={`p-3 rounded-2xl text-xs font-bold border transition text-center ${
                    exportScope === 'day'
                      ? 'bg-[#6B705C] text-white border-[#6B705C]'
                      : 'bg-[#F9F7F2] border-[#E0DBD0] text-[#4A4E4D] hover:bg-[#F2EFE9]'
                  }`}
                >
                  Selected Day
                </button>
              </div>
            </div>

            {/* Event Types Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#6B705C] uppercase tracking-wider">2. Include Event Types</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] cursor-pointer hover:bg-[#F2EFE9]">
                  <input
                    type="checkbox"
                    checked={incPlans}
                    onChange={(e) => setIncPlans(e.target.checked)}
                    className="w-4 h-4 text-[#6B705C] rounded-md border-[#E0DBD0] focus:ring-[#6B705C]"
                  />
                  <span className="font-medium text-[#4A4E4D]">Study Plans ({plans.length})</span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] cursor-pointer hover:bg-[#F2EFE9]">
                  <input
                    type="checkbox"
                    checked={incExams}
                    onChange={(e) => setIncExams(e.target.checked)}
                    className="w-4 h-4 text-[#6B705C] rounded-md border-[#E0DBD0] focus:ring-[#6B705C]"
                  />
                  <span className="font-medium text-[#4A4E4D]">Target Exams ({(userProfile?.examDates || []).length})</span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] cursor-pointer hover:bg-[#F2EFE9]">
                  <input
                    type="checkbox"
                    checked={incSessions}
                    onChange={(e) => setIncSessions(e.target.checked)}
                    className="w-4 h-4 text-[#6B705C] rounded-md border-[#E0DBD0] focus:ring-[#6B705C]"
                  />
                  <span className="font-medium text-[#4A4E4D]">Studied Sessions ({sessions.length})</span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] cursor-pointer hover:bg-[#F2EFE9]">
                  <input
                    type="checkbox"
                    checked={incRevisions}
                    onChange={(e) => setIncRevisions(e.target.checked)}
                    className="w-4 h-4 text-[#6B705C] rounded-md border-[#E0DBD0] focus:ring-[#6B705C]"
                  />
                  <span className="font-medium text-[#4A4E4D]">Revisions ({revisions.length})</span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] cursor-pointer hover:bg-[#F2EFE9]">
                  <input
                    type="checkbox"
                    checked={incTests}
                    onChange={(e) => setIncTests(e.target.checked)}
                    className="w-4 h-4 text-[#6B705C] rounded-md border-[#E0DBD0] focus:ring-[#6B705C]"
                  />
                  <span className="font-medium text-[#4A4E4D]">Tests & Mocks ({testResults.length})</span>
                </label>
              </div>
            </div>

            {/* Instructions */}
            <div className="p-3.5 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-[11px] text-[#4A4E4D] space-y-1">
              <span className="font-bold text-[#6B705C] block uppercase tracking-wider">How to import into Calendar apps:</span>
              <ul className="list-disc list-inside space-y-0.5 text-[#A5A58D]">
                <li><strong className="text-[#4A4E4D]">Google Calendar:</strong> Open Settings → Import & Export → Upload `.ics` file.</li>
                <li><strong className="text-[#4A4E4D]">Apple Calendar & Outlook:</strong> Double click the downloaded `.ics` file or drag it into your calendar window.</li>
              </ul>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E0DBD0]">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2.5 text-xs font-semibold text-[#A5A58D] hover:text-[#4A4E4D]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTriggerExport}
                className="px-5 py-2.5 bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-medium text-xs rounded-full shadow-xs flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .ICS File</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Two-Way Google Calendar & Google Tasks Sync Modal */}
      <TwoWaySyncModal
        isOpen={isTwoWaySyncOpen}
        onClose={() => setIsTwoWaySyncOpen(false)}
        plans={plans}
        sessions={sessions}
        revisions={revisions}
        examDates={userProfile?.examDates || []}
        setActiveTab={setActiveTab}
      />
    </div>
  );
};
