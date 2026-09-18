import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  Clock, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink, 
  Download, 
  FileText, 
  Copy, 
  Check, 
  Layers, 
  AlertCircle, 
  Play, 
  Share2, 
  Printer, 
  ArrowRight,
  TrendingUp,
  Award,
  Zap,
  Sliders
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Subject, 
  StudySession, 
  UserProfile, 
  ScheduledStudyTask, 
  DayTimeslotSchedule, 
  TimeslotPeriod, 
  ActiveTab 
} from '../types';
import { 
  getWeekDates, 
  parseBusyScheduleText, 
  createGoogleCalendarUrl, 
  generateDailyActionDocument 
} from '../lib/scheduleParser';
import { generateIcsCalendarContent, downloadIcsFile } from '../lib/icsExport';
import { SmartScheduleAdjusterModal } from './SmartScheduleAdjusterModal';
import { 
  subscribeScheduledTasks, 
  saveScheduledTasksToDb, 
  resolveActiveUserId 
} from '../lib/db';

interface WeeklyScheduleManagerProps {
  subjects: Subject[];
  sessions: StudySession[];
  userProfile: UserProfile | null;
  setActiveTab: (tab: ActiveTab) => void;
  onStartTimerForTopic: (subjectName: string, chapterName: string, topicName: string) => void;
}

export const WeeklyScheduleManager: React.FC<WeeklyScheduleManagerProps> = ({
  subjects,
  sessions,
  userProfile,
  setActiveTab,
  onStartTimerForTopic
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const weekDates = getWeekDates(new Date());

  // Active selected day in the week
  const [selectedDayStr, setSelectedDayStr] = useState<string>(todayStr);

  // Storage keys for persistence in localStorage & sync
  const TASKS_STORAGE_KEY = `studyflow_weekly_tasks_${userProfile?.uid || 'guest'}`;
  const SLOTS_STORAGE_KEY = `studyflow_weekly_slots_${userProfile?.uid || 'guest'}`;

  // Initial tasks state
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledStudyTask[]>(() => {
    const saved = localStorage.getItem(TASKS_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    // Default seed tasks for current week
    const defaultTasks: ScheduledStudyTask[] = [];
    weekDates.forEach((w, idx) => {
      const sub = subjects[idx % subjects.length] || { name: 'Mathematics', chapters: [] };
      const ch = sub.chapters[0];
      const tp = ch?.topics[0];

      defaultTasks.push({
        id: `task-seed-${w.dateStr}-1`,
        date: w.dateStr,
        title: tp ? `${tp.name}` : `Core Review`,
        subjectName: sub.name,
        chapterName: ch?.name || 'Fundamentals',
        topicName: tp?.name || 'Key Principles',
        durationMinutes: 45,
        completed: idx === 0,
        priority: idx % 2 === 0 ? 'High' : 'Medium',
        timeslot: idx % 2 === 0 ? 'morning' : 'evening'
      });

      if (idx % 3 === 0) {
        const sub2 = subjects[(idx + 1) % subjects.length] || { name: 'Physics', chapters: [] };
        defaultTasks.push({
          id: `task-seed-${w.dateStr}-2`,
          date: w.dateStr,
          title: `Practice Problems`,
          subjectName: sub2.name,
          chapterName: 'Exercise Sets',
          topicName: 'Problem Solving & Drills',
          durationMinutes: 60,
          completed: false,
          priority: 'Medium',
          timeslot: 'afternoon'
        });
      }
    });
    return defaultTasks;
  });

  // Initial timeslot schedules
  const [timeslotSchedules, setTimeslotSchedules] = useState<{ [date: string]: DayTimeslotSchedule }>(() => {
    const saved = localStorage.getItem(SLOTS_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    const initial: { [date: string]: DayTimeslotSchedule } = {};
    weekDates.forEach((w, idx) => {
      initial[w.dateStr] = {
        date: w.dateStr,
        morning: { available: true },
        afternoon: { available: idx % 3 !== 1, note: idx % 3 === 1 ? 'Class / Lecture' : undefined },
        evening: { available: true },
        night: { available: true }
      };
    });
    return initial;
  });

  const effectiveUid = resolveActiveUserId(undefined, userProfile?.email || null);

  // Subscribe to real-time cross-device task changes from Firestore
  useEffect(() => {
    if (!effectiveUid) return;
    const unsub = subscribeScheduledTasks(effectiveUid, (tasks) => {
      if (tasks && tasks.length > 0) {
        setScheduledTasks(tasks);
      }
    });
    return () => unsub();
  }, [effectiveUid]);

  // Save to local storage & Firestore on changes (debounced cloud save)
  useEffect(() => {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(scheduledTasks));
    if (effectiveUid) {
      const timer = setTimeout(() => {
        saveScheduledTasksToDb(effectiveUid, scheduledTasks).catch((e) => {
          console.warn("Failed to sync scheduled tasks:", e);
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [scheduledTasks, TASKS_STORAGE_KEY, effectiveUid]);

  useEffect(() => {
    localStorage.setItem(SLOTS_STORAGE_KEY, JSON.stringify(timeslotSchedules));
  }, [timeslotSchedules, SLOTS_STORAGE_KEY]);

  // Timeslot recognition paste box state
  const [pasteBoxText, setPasteBoxText] = useState<string>('');
  const [isPasteBoxOpen, setIsPasteBoxOpen] = useState<boolean>(false);
  const [pasteResultMsg, setPasteResultMsg] = useState<string | null>(null);

  // Deadline Workload Divider state
  const [isDeadlineModalOpen, setIsDeadlineModalOpen] = useState<boolean>(false);
  const [deadlineTargetDate, setDeadlineTargetDate] = useState<string>(
    weekDates[weekDates.length - 1]?.dateStr || todayStr
  );
  const [deadlineSubject, setDeadlineSubject] = useState<string>(subjects[0]?.name || 'General');
  const [deadlineHoursRequired, setDeadlineHoursRequired] = useState<number>(6);
  const [deadlineTopicName, setDeadlineTopicName] = useState<string>('Exam Preparation & Revision');
  const [deadlineDivisionMode, setDeadlineDivisionMode] = useState<'divide_evenly' | 'divide_weighted' | 'single_day'>('divide_evenly');
  const [deadlineSuccessMsg, setDeadlineSuccessMsg] = useState<string | null>(null);

  // Add Task Modal/Form
  const [isAddTaskOpen, setIsAddTaskOpen] = useState<boolean>(false);
  const [newTaskSubject, setNewTaskSubject] = useState<string>(subjects[0]?.name || '');
  const [newTaskChapter, setNewTaskChapter] = useState<string>('');
  const [newTaskTopic, setNewTaskTopic] = useState<string>('');
  const [newTaskDuration, setNewTaskDuration] = useState<number>(45);
  const [newTaskPriority, setNewTaskPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [newTaskTimeslot, setNewTaskTimeslot] = useState<TimeslotPeriod>('morning');

  // Document Transfer Modal
  const [isDocModalOpen, setIsDocModalOpen] = useState<boolean>(false);
  const [copiedDoc, setCopiedDoc] = useState<boolean>(false);

  // Smart Schedule Adjuster Modal State
  const [isScheduleAdjusterOpen, setIsScheduleAdjusterOpen] = useState<boolean>(false);

  // Toggle Task Completion ("Cross off in this app")
  const handleToggleTask = (taskId: string) => {
    setScheduledTasks(prev =>
      prev.map(t => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
  };

  const handleDeleteTask = (taskId: string) => {
    setScheduledTasks(prev => prev.filter(t => t.id !== taskId));
  };

  // Toggle Timeslot availability
  const handleToggleSlot = (dateStr: string, slot: TimeslotPeriod) => {
    setTimeslotSchedules(prev => {
      const currentDay = prev[dateStr] || {
        date: dateStr,
        morning: { available: true },
        afternoon: { available: true },
        evening: { available: true },
        night: { available: true }
      };

      const isCurrentlyAvailable = currentDay[slot].available;
      return {
        ...prev,
        [dateStr]: {
          ...currentDay,
          [slot]: {
            available: !isCurrentlyAvailable,
            note: isCurrentlyAvailable ? 'Busy / Blocked' : undefined
          }
        }
      };
    });
  };

  // Run Smart Parser on Pasted Schedule Text
  const handleParsePastedSchedule = () => {
    const { matchedSlots, summary } = parseBusyScheduleText(pasteBoxText, weekDates);
    if (matchedSlots.length > 0) {
      setTimeslotSchedules(prev => {
        const next = { ...prev };
        matchedSlots.forEach(({ dateStr, period, reason }) => {
          if (!next[dateStr]) {
            next[dateStr] = {
              date: dateStr,
              morning: { available: true },
              afternoon: { available: true },
              evening: { available: true },
              night: { available: true }
            };
          }
          next[dateStr] = {
            ...next[dateStr],
            [period]: {
              available: false,
              note: reason
            }
          };
        });
        return next;
      });
      setPasteResultMsg(`Success: ${summary}`);
      setTimeout(() => {
        setPasteResultMsg(null);
        setIsPasteBoxOpen(false);
      }, 2500);
    } else {
      setPasteResultMsg(summary);
    }
  };

  // Calculate & Apply Deadline Workload Division
  const handleApplyDeadlineDivision = () => {
    const selectedDeadline = new Date(deadlineTargetDate + 'T00:00:00');
    const today = new Date(todayStr + 'T00:00:00');

    // Filter available days between today and deadline
    const eligibleWeekDays = weekDates.filter(w => {
      const wDate = new Date(w.dateStr + 'T00:00:00');
      return wDate >= today && wDate <= selectedDeadline;
    });

    if (eligibleWeekDays.length === 0) {
      setDeadlineSuccessMsg('Deadline date must be today or later in the week.');
      return;
    }

    const totalMinutes = deadlineHoursRequired * 60;
    const newTasksToInject: ScheduledStudyTask[] = [];

    if (deadlineDivisionMode === 'single_day') {
      // Put whole block on deadline day
      newTasksToInject.push({
        id: `deadline-task-${Date.now()}-single`,
        date: deadlineTargetDate,
        title: `${deadlineTopicName} (Full Study Block)`,
        subjectName: deadlineSubject,
        chapterName: 'Target Deadline Coverage',
        topicName: deadlineTopicName,
        durationMinutes: totalMinutes,
        completed: false,
        priority: 'High',
        timeslot: 'morning'
      });
    } else if (deadlineDivisionMode === 'divide_evenly') {
      // Divide evenly across eligible days
      const daysCount = eligibleWeekDays.length;
      const minsPerDay = Math.round(totalMinutes / daysCount);

      eligibleWeekDays.forEach((day, idx) => {
        newTasksToInject.push({
          id: `deadline-task-${Date.now()}-${idx}`,
          date: day.dateStr,
          title: `${deadlineTopicName} (Part ${idx + 1}/${daysCount})`,
          subjectName: deadlineSubject,
          chapterName: `Deadline prep: ~${(minsPerDay / 60).toFixed(1)}h/day`,
          topicName: `${deadlineTopicName} - Day ${idx + 1}`,
          durationMinutes: minsPerDay,
          completed: false,
          priority: 'High',
          timeslot: idx % 2 === 0 ? 'morning' : 'afternoon'
        });
      });
    } else {
      // Weighted division based on available timeslots
      const daysWithWeights = eligibleWeekDays.map(day => {
        const sched = timeslotSchedules[day.dateStr];
        let freeSlots = 0;
        if (!sched || sched.morning.available) freeSlots += 1;
        if (!sched || sched.afternoon.available) freeSlots += 1;
        if (!sched || sched.evening.available) freeSlots += 1;
        if (!sched || sched.night.available) freeSlots += 1;
        return { day, freeSlots: Math.max(1, freeSlots) };
      });

      const totalWeight = daysWithWeights.reduce((acc, d) => acc + d.freeSlots, 0);

      daysWithWeights.forEach(({ day, freeSlots }, idx) => {
        const mins = Math.round((freeSlots / totalWeight) * totalMinutes);
        if (mins > 0) {
          newTasksToInject.push({
            id: `deadline-task-${Date.now()}-${idx}`,
            date: day.dateStr,
            title: `${deadlineTopicName} (${freeSlots} slots free)`,
            subjectName: deadlineSubject,
            chapterName: `Availability-weighted session`,
            topicName: `${deadlineTopicName} - Part ${idx + 1}`,
            durationMinutes: mins,
            completed: false,
            priority: 'High',
            timeslot: 'morning'
          });
        }
      });
    }

    setScheduledTasks(prev => [...prev, ...newTasksToInject]);
    setDeadlineSuccessMsg(`Added ${newTasksToInject.length} distributed study tasks leading to deadline on ${deadlineTargetDate}!`);
    setTimeout(() => {
      setDeadlineSuccessMsg(null);
      setIsDeadlineModalOpen(false);
    }, 2000);
  };

  // Add a single custom task
  const handleAddNewTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskSubject) return;

    const task: ScheduledStudyTask = {
      id: `task-manual-${Date.now()}`,
      date: selectedDayStr,
      title: newTaskTopic || `${newTaskSubject} Study Session`,
      subjectName: newTaskSubject,
      chapterName: newTaskChapter || 'General Study',
      topicName: newTaskTopic || 'Topic Review',
      durationMinutes: newTaskDuration,
      completed: false,
      priority: newTaskPriority,
      timeslot: newTaskTimeslot
    };

    setScheduledTasks(prev => [task, ...prev]);
    setIsAddTaskOpen(false);
    setNewTaskTopic('');
    setNewTaskChapter('');
  };

  // Export current week schedule to ICS
  const handleExportWeekIcs = () => {
    const icsString = generateIcsCalendarContent({
      plans: [],
      sessions,
      examDates: userProfile?.examDates || [],
      includePlans: false,
      includeSessions: true,
      includeExams: true,
      calendarName: `StudyFlow Weekly Schedule (${weekDates[0]?.dayLabel})`
    });
    downloadIcsFile(icsString, `studyflow_week_${weekDates[0]?.dateStr}.ics`);
  };

  // Filter tasks for the selected day
  const selectedDayTasks = scheduledTasks.filter(t => t.date === selectedDayStr);
  const selectedDayTimeslots = timeslotSchedules[selectedDayStr] || {
    date: selectedDayStr,
    morning: { available: true },
    afternoon: { available: true },
    evening: { available: true },
    night: { available: true }
  };

  // Actual study sessions for selected day
  const selectedDaySessions = sessions.filter(s => s.date === selectedDayStr);
  const selectedDayActualHours = Number(
    (selectedDaySessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0) / 60).toFixed(1)
  );

  // End of Week summary calculations
  const weekSet = new Set(weekDates.map(w => w.dateStr));
  const weekTasks = scheduledTasks.filter(t => weekSet.has(t.date));
  const weekCompletedTasks = weekTasks.filter(t => t.completed);
  const weekRemainingTasks = weekTasks.filter(t => !t.completed);
  const weekCompletionRate = weekTasks.length > 0 
    ? Math.round((weekCompletedTasks.length / weekTasks.length) * 100) 
    : 0;

  const weekSessions = sessions.filter(s => weekSet.has(s.date));
  const weekActualMinutes = weekSessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  const weekActualHours = Number((weekActualMinutes / 60).toFixed(1));
  const weeklyTargetHours = (userProfile?.targetHoursPerDay || 3) * 7;

  // Selected Day completion
  const dayDoneCount = selectedDayTasks.filter(t => t.completed).length;
  const dayTotalCount = selectedDayTasks.length;
  const dayRemainingCount = dayTotalCount - dayDoneCount;

  return (
    <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-6">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E0DBD0] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#6B705C]/10 text-[#6B705C]">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#4A4E4D]">
              Weekly Study Schedule & Deadline Divider
            </h3>
          </div>
          <p className="text-xs text-[#A5A58D] mt-1">
            Organize what to do this week, divide workloads evenly before deadlines, toggle unavailable timeslots, and export to Google Calendar or action documents.
          </p>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Smart Schedule Adjuster Button */}
          <button
            onClick={() => setIsScheduleAdjusterOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[#F2EFE9] hover:bg-[#EAE7DF] text-[#6B705C] border border-[#E0DBD0] text-xs font-semibold transition cursor-pointer"
            title="Point out minor task and pick open day to add"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Smart Slot Adjuster</span>
          </button>

          {/* Deadline Workload Divider Button */}
          <button
            onClick={() => setIsDeadlineModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-semibold transition shadow-2xs cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Divide Deadline</span>
          </button>

          {/* Paste Busy Slots Recognizer */}
          <button
            onClick={() => setIsPasteBoxOpen(!isPasteBoxOpen)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[#F2EFE9] hover:bg-[#EAE7DF] text-[#6B705C] border border-[#E0DBD0] text-xs font-semibold transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Paste Busy Times</span>
          </button>

          {/* Transfer to Document Action Sheet */}
          <button
            onClick={() => setIsDocModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[#F2EFE9] hover:bg-[#EAE7DF] text-[#4A4E4D] border border-[#E0DBD0] text-xs font-semibold transition cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-[#6B705C]" />
            <span>Export Action Doc</span>
          </button>

          {/* Export Week ICS */}
          <button
            onClick={handleExportWeekIcs}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#F9F7F2] hover:bg-[#F2EFE9] text-[#A5A58D] hover:text-[#4A4E4D] border border-[#E0DBD0] text-xs font-semibold transition cursor-pointer"
            title="Download .ics Calendar for Week"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">.ICS File</span>
          </button>
        </div>
      </div>

      {/* Smart Paste Box Collapsible */}
      <AnimatePresence>
        {isPasteBoxOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-[#6B705C] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Natural Language Timeslot Recognizer
              </span>
              <span className="text-[11px] text-[#A5A58D]">
                Paste your busy schedule / commitments below
              </span>
            </div>

            <textarea
              rows={2}
              value={pasteBoxText}
              onChange={(e) => setPasteBoxText(e.target.value)}
              placeholder="e.g. Mon 9am-1pm College Class, Tue 2-5pm Lab, Wed morning busy, Friday 18:00-21:00 Gym..."
              className="w-full p-3 rounded-xl bg-white border border-[#E0DBD0] text-xs text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
            />

            <div className="flex items-center justify-between">
              <div className="text-xs text-[#6B705C] font-medium">
                {pasteResultMsg && <span>{pasteResultMsg}</span>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPasteBoxOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-[#A5A58D] hover:text-[#4A4E4D] cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={handleParsePastedSchedule}
                  className="px-4 py-1.5 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-semibold transition cursor-pointer"
                >
                  Recognize & Toggle Slots
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Week Day Selector Strip */}
      <div className="grid grid-cols-7 gap-2">
        {weekDates.map((w) => {
          const isToday = w.dateStr === todayStr;
          const isSelected = w.dateStr === selectedDayStr;
          const dayTasks = scheduledTasks.filter(t => t.date === w.dateStr);
          const done = dayTasks.filter(t => t.completed).length;
          const total = dayTasks.length;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;

          // Check if day has busy timeslots
          const sched = timeslotSchedules[w.dateStr];
          const hasBusy = sched && (!sched.morning.available || !sched.afternoon.available || !sched.evening.available || !sched.night.available);

          return (
            <button
              key={w.dateStr}
              onClick={() => setSelectedDayStr(w.dateStr)}
              className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-between gap-1.5 cursor-pointer relative ${
                isSelected
                  ? 'bg-[#6B705C] text-white border-[#6B705C] shadow-xs'
                  : isToday
                  ? 'bg-[#F2EFE9] text-[#4A4E4D] border-[#6B705C]'
                  : 'bg-[#F9F7F2] text-[#4A4E4D] border-[#E0DBD0] hover:border-[#6B705C]/40 hover:bg-[#F2EFE9]'
              }`}
            >
              {isToday && (
                <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 rounded-md ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-[#6B705C] text-white'
                }`}>
                  Today
                </span>
              )}

              <div className="text-xs font-bold leading-tight">
                {w.dayLabel.split(' ')[0]}
              </div>
              <div className={`text-[11px] font-mono ${isSelected ? 'text-white/80' : 'text-[#A5A58D]'}`}>
                {w.dayLabel.split(' ').slice(1).join(' ')}
              </div>

              {/* Progress bar or badge */}
              <div className="w-full mt-1">
                {total > 0 ? (
                  <div className="space-y-0.5">
                    <div className={`w-full h-1.5 rounded-full overflow-hidden ${isSelected ? 'bg-white/30' : 'bg-[#E0DBD0]'}`}>
                      <div
                        className={`h-full rounded-full transition-all ${isSelected ? 'bg-white' : 'bg-[#6B705C]'}`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                    <span className={`text-[9px] font-mono block ${isSelected ? 'text-white/90' : 'text-[#A5A58D]'}`}>
                      {done}/{total} done
                    </span>
                  </div>
                ) : (
                  <span className={`text-[9px] font-mono ${isSelected ? 'text-white/60' : 'text-[#A5A58D]'}`}>
                    Free
                  </span>
                )}
              </div>

              {hasBusy && (
                <span className={`w-1.5 h-1.5 rounded-full absolute top-2 right-2 ${
                  isSelected ? 'bg-amber-300' : 'bg-amber-500'
                }`} title="Has busy commitments" />
              )}
            </button>
          );
        })}
      </div>

      {/* Main Selected Day Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Tasks Checklist & In-App Cross Off */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E0DBD0] pb-3">
            <div>
              <h4 className="text-sm font-bold text-[#4A4E4D] flex items-center gap-2">
                <span>Tasks for {new Date(selectedDayStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                <span className="text-xs font-mono font-normal text-[#A5A58D]">
                  ({dayDoneCount} of {dayTotalCount} done • {dayRemainingCount} remaining)
                </span>
              </h4>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAddTaskOpen(!isAddTaskOpen)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-semibold transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Task</span>
              </button>
            </div>
          </div>

          {/* Add Task Mini Form */}
          <AnimatePresence>
            {isAddTaskOpen && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleAddNewTask}
                className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-3"
              >
                <div className="text-xs font-bold uppercase tracking-widest text-[#6B705C]">
                  Schedule New Study Task
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono text-[#A5A58D] mb-1">Subject</label>
                    <select
                      value={newTaskSubject}
                      onChange={(e) => setNewTaskSubject(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-[#E0DBD0] text-xs text-[#4A4E4D]"
                    >
                      {subjects.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-[#A5A58D] mb-1">Chapter / Unit</label>
                    <input
                      type="text"
                      placeholder="e.g. Cell Structure"
                      value={newTaskChapter}
                      onChange={(e) => setNewTaskChapter(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-[#E0DBD0] text-xs text-[#4A4E4D]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-[#A5A58D] mb-1">Topic / Task Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mitochondria & Respiration"
                      value={newTaskTopic}
                      onChange={(e) => setNewTaskTopic(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-[#E0DBD0] text-xs text-[#4A4E4D]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                  <div>
                    <label className="block text-[10px] font-mono text-[#A5A58D] mb-1">Duration (mins)</label>
                    <input
                      type="number"
                      min="15"
                      max="360"
                      step="15"
                      value={newTaskDuration}
                      onChange={(e) => setNewTaskDuration(parseInt(e.target.value, 10) || 45)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-[#E0DBD0] text-xs font-mono text-[#4A4E4D]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-[#A5A58D] mb-1">Time Block</label>
                    <select
                      value={newTaskTimeslot}
                      onChange={(e) => setNewTaskTimeslot(e.target.value as TimeslotPeriod)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-[#E0DBD0] text-xs text-[#4A4E4D]"
                    >
                      <option value="morning">Morning (08:00 - 12:00)</option>
                      <option value="afternoon">Afternoon (12:00 - 17:00)</option>
                      <option value="evening">Evening (17:00 - 21:00)</option>
                      <option value="night">Night (21:00 - 24:00)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-[#A5A58D] mb-1">Priority</label>
                    <select
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-[#E0DBD0] text-xs text-[#4A4E4D]"
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddTaskOpen(false)}
                    className="px-3 py-1 rounded-xl text-xs text-[#A5A58D] hover:text-[#4A4E4D] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1 rounded-xl bg-[#6B705C] text-white text-xs font-semibold hover:bg-[#5a5f4e] transition cursor-pointer"
                  >
                    Add to Schedule
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Checklist of Tasks */}
          {selectedDayTasks.length > 0 ? (
            <div className="space-y-2.5">
              {selectedDayTasks.map((t) => {
                const gCalUrl = createGoogleCalendarUrl({
                  title: t.title,
                  date: t.date,
                  subjectName: t.subjectName,
                  chapterName: t.chapterName,
                  topicName: t.topicName,
                  durationMinutes: t.durationMinutes,
                  timeslot: t.timeslot
                });

                return (
                  <motion.div
                    key={t.id}
                    layout
                    className={`p-3.5 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      t.completed
                        ? 'bg-[#F2EFE9]/60 border-[#E0DBD0] text-[#A5A58D]'
                        : 'bg-[#F9F7F2] border-[#E0DBD0] hover:border-[#6B705C]/40 text-[#4A4E4D]'
                    }`}
                  >
                    {/* Checkbox & Details */}
                    <div className="flex items-start sm:items-center gap-3 flex-1">
                      <button
                        onClick={() => handleToggleTask(t.id)}
                        className={`mt-0.5 sm:mt-0 p-1 rounded-lg transition cursor-pointer shrink-0 ${
                          t.completed
                            ? 'text-emerald-600 bg-emerald-50'
                            : 'text-[#A5A58D] hover:text-[#6B705C] hover:bg-[#EAE7DF]'
                        }`}
                        title={t.completed ? 'Mark pending' : 'Cross off task'}
                      >
                        {t.completed ? (
                          <CheckCircle2 className="w-5 h-5 fill-emerald-600 text-white" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>

                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            t.completed
                              ? 'bg-[#E0DBD0] text-[#A5A58D]'
                              : 'bg-[#EAE7DF] text-[#6B705C]'
                          }`}>
                            {t.subjectName}
                          </span>
                          {t.timeslot && (
                            <span className="text-[10px] font-mono text-[#A5A58D] uppercase">
                              [{t.timeslot}]
                            </span>
                          )}
                          {t.priority === 'High' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                              HIGH
                            </span>
                          )}
                        </div>

                        <div className={`text-xs font-semibold ${t.completed ? 'line-through text-[#A5A58D]' : 'text-[#4A4E4D]'}`}>
                          {t.topicName || t.title}
                        </div>

                        {t.chapterName && (
                          <div className="text-[11px] text-[#A5A58D] font-mono">
                            {t.chapterName}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions: Timer, Google Cal, Delete */}
                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <span className="text-xs font-mono text-[#A5A58D]">
                        ~{t.durationMinutes}m
                      </span>

                      {!t.completed && (
                        <button
                          onClick={() => onStartTimerForTopic(t.subjectName, t.chapterName || '', t.topicName || t.title)}
                          className="flex items-center gap-1 px-3 py-1 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-semibold transition cursor-pointer"
                          title="Start timer for this task"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Study</span>
                        </button>
                      )}

                      {/* Add to Google Calendar Link */}
                      <a
                        href={gCalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-xl hover:bg-[#EAE7DF] text-[#A5A58D] hover:text-[#4A4E4D] transition"
                        title="Add to Google Calendar"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>

                      <button
                        onClick={() => handleDeleteTask(t.id)}
                        className="p-1.5 rounded-xl hover:bg-rose-50 text-[#A5A58D] hover:text-rose-600 transition cursor-pointer"
                        title="Delete task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 rounded-2xl bg-[#F9F7F2] border border-dashed border-[#E0DBD0] space-y-2">
              <CheckCircle2 className="w-8 h-8 text-[#A5A58D] mx-auto" />
              <p className="text-xs text-[#A5A58D]">
                No study tasks scheduled for this day yet.
              </p>
              <button
                onClick={() => setIsAddTaskOpen(true)}
                className="px-4 py-1.5 rounded-xl bg-[#6B705C] text-white text-xs font-semibold hover:bg-[#5a5f4e] transition cursor-pointer"
              >
                Add First Task
              </button>
            </div>
          )}
        </div>

        {/* Right Column (4 cols): Timeslot Availability & Toggles */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-3">
            <div className="flex items-center justify-between border-b border-[#E0DBD0] pb-2">
              <span className="text-xs font-bold uppercase tracking-widest text-[#6B705C] flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Timeslot Availability
              </span>
              <span className="text-[10px] text-[#A5A58D]">Click to toggle</span>
            </div>

            <p className="text-[11px] text-[#A5A58D]">
              Toggle unavailable timeslots for {new Date(selectedDayStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}:
            </p>

            <div className="space-y-2">
              {(['morning', 'afternoon', 'evening', 'night'] as TimeslotPeriod[]).map((slot) => {
                const isAvailable = selectedDayTimeslots[slot]?.available !== false;
                const note = selectedDayTimeslots[slot]?.note;
                const labelMap = {
                  morning: 'Morning (08:00 - 12:00)',
                  afternoon: 'Afternoon (12:00 - 17:00)',
                  evening: 'Evening (17:00 - 21:00)',
                  night: 'Night (21:00 - 24:00)'
                };

                return (
                  <button
                    key={slot}
                    onClick={() => handleToggleSlot(selectedDayStr, slot)}
                    className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                      isAvailable
                        ? 'bg-white border-emerald-200 text-[#4A4E4D] hover:border-emerald-400'
                        : 'bg-[#F2EFE9] border-amber-300 text-[#A5A58D] hover:border-amber-400'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <span>{labelMap[slot]}</span>
                      </div>
                      {note && !isAvailable && (
                        <div className="text-[10px] text-amber-800 italic pl-3.5">
                          {note}
                        </div>
                      )}
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isAvailable
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {isAvailable ? 'Available' : 'Busy'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* End of Week Retrospective Card */}
          <div className="p-4 rounded-2xl bg-[#F2EFE9] border border-[#E0DBD0] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-[#4A4E4D] flex items-center gap-1.5">
                <Award className="w-4 h-4 text-[#6B705C]" /> Week Retrospective
              </span>
              <span className="text-xs font-mono font-bold text-[#6B705C]">
                {weekCompletionRate}% Done
              </span>
            </div>

            <div className="w-full bg-white h-2 rounded-full overflow-hidden border border-[#E0DBD0]">
              <div
                className="bg-[#6B705C] h-full rounded-full transition-all duration-500"
                style={{ width: `${weekCompletionRate}%` }}
              ></div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 text-center">
              <div className="p-2 rounded-xl bg-white border border-[#E0DBD0]">
                <div className="text-base font-serif italic font-bold text-[#4A4E4D]">
                  {weekCompletedTasks.length}
                </div>
                <div className="text-[10px] text-[#A5A58D] font-mono">Tasks Crossed Off</div>
              </div>

              <div className="p-2 rounded-xl bg-white border border-[#E0DBD0]">
                <div className="text-base font-serif italic font-bold text-[#6B705C]">
                  {weekRemainingTasks.length}
                </div>
                <div className="text-[10px] text-[#A5A58D] font-mono">Tasks Remaining</div>
              </div>
            </div>

            <p className="text-[11px] text-[#A5A58D] italic pt-1">
              Logged {weekActualHours}h of study this week towards your {weeklyTargetHours}h weekly goal.
            </p>
          </div>
        </div>
      </div>

      {/* Deadline Workload Divider Modal */}
      <AnimatePresence>
        {isDeadlineModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[#E0DBD0] rounded-3xl p-6 max-w-lg w-full shadow-lg space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[#E0DBD0] pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-[#6B705C]" />
                  <h3 className="text-base font-serif italic font-bold text-[#4A4E4D]">
                    Deadline Workload Divider
                  </h3>
                </div>
                <button
                  onClick={() => setIsDeadlineModalOpen(false)}
                  className="text-xs text-[#A5A58D] hover:text-[#4A4E4D] cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-[#A5A58D]">
                Enter an exam or revision deadline. StudyFlow will automatically divide and distribute the required study hours across your available days!
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#A5A58D] mb-1">
                    Subject
                  </label>
                  <select
                    value={deadlineSubject}
                    onChange={(e) => setDeadlineSubject(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-[#F9F7F2] border border-[#E0DBD0] text-xs text-[#4A4E4D]"
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#A5A58D] mb-1">
                    Deadline Goal / Topic Focus
                  </label>
                  <input
                    type="text"
                    value={deadlineTopicName}
                    onChange={(e) => setDeadlineTopicName(e.target.value)}
                    placeholder="e.g. Chapter 4 & 5 Complete Mastery"
                    className="w-full p-2.5 rounded-xl bg-[#F9F7F2] border border-[#E0DBD0] text-xs text-[#4A4E4D]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#A5A58D] mb-1">
                      Deadline Date
                    </label>
                    <input
                      type="date"
                      value={deadlineTargetDate}
                      min={todayStr}
                      onChange={(e) => setDeadlineTargetDate(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-[#F9F7F2] border border-[#E0DBD0] text-xs font-mono text-[#4A4E4D]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#A5A58D] mb-1">
                      Total Hours Needed
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="40"
                      value={deadlineHoursRequired}
                      onChange={(e) => setDeadlineHoursRequired(parseFloat(e.target.value) || 4)}
                      className="w-full p-2.5 rounded-xl bg-[#F9F7F2] border border-[#E0DBD0] text-xs font-mono text-[#4A4E4D]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#A5A58D] mb-1">
                    How Should We Divide It?
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setDeadlineDivisionMode('divide_evenly')}
                      className={`p-2.5 rounded-xl border text-center text-xs font-semibold transition cursor-pointer ${
                        deadlineDivisionMode === 'divide_evenly'
                          ? 'bg-[#6B705C] text-white border-[#6B705C]'
                          : 'bg-[#F9F7F2] text-[#4A4E4D] border-[#E0DBD0] hover:bg-[#F2EFE9]'
                      }`}
                    >
                      Divide Evenly
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeadlineDivisionMode('divide_weighted')}
                      className={`p-2.5 rounded-xl border text-center text-xs font-semibold transition cursor-pointer ${
                        deadlineDivisionMode === 'divide_weighted'
                          ? 'bg-[#6B705C] text-white border-[#6B705C]'
                          : 'bg-[#F9F7F2] text-[#4A4E4D] border-[#E0DBD0] hover:bg-[#F2EFE9]'
                      }`}
                    >
                      By Free Slots
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeadlineDivisionMode('single_day')}
                      className={`p-2.5 rounded-xl border text-center text-xs font-semibold transition cursor-pointer ${
                        deadlineDivisionMode === 'single_day'
                          ? 'bg-[#6B705C] text-white border-[#6B705C]'
                          : 'bg-[#F9F7F2] text-[#4A4E4D] border-[#E0DBD0] hover:bg-[#F2EFE9]'
                      }`}
                    >
                      Single Day
                    </button>
                  </div>
                </div>

                {deadlineSuccessMsg && (
                  <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
                    {deadlineSuccessMsg}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E0DBD0]">
                <button
                  type="button"
                  onClick={() => setIsDeadlineModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-[#A5A58D] hover:text-[#4A4E4D] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyDeadlineDivision}
                  className="px-5 py-2 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-semibold transition cursor-pointer"
                >
                  Calculate & Distribute
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Document Transfer / Export Action Sheet Modal */}
      <AnimatePresence>
        {isDocModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[#E0DBD0] rounded-3xl p-6 max-w-2xl w-full shadow-lg space-y-4 max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-[#E0DBD0] pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#6B705C]" />
                  <h3 className="text-base font-serif italic font-bold text-[#4A4E4D]">
                    Daily Study Action Document
                  </h3>
                </div>
                <button
                  onClick={() => setIsDocModalOpen(false)}
                  className="text-xs text-[#A5A58D] hover:text-[#4A4E4D] cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] font-mono text-xs text-[#4A4E4D] whitespace-pre-wrap">
                {generateDailyActionDocument(
                  selectedDayStr,
                  userProfile?.targetHoursPerDay || 3,
                  selectedDayActualHours,
                  selectedDayTasks,
                  selectedDayTimeslots
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E0DBD0]">
                <div className="text-xs text-emerald-700 font-semibold">
                  {copiedDoc && '✓ Copied formatted action sheet to clipboard!'}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const docContent = generateDailyActionDocument(
                        selectedDayStr,
                        userProfile?.targetHoursPerDay || 3,
                        selectedDayActualHours,
                        selectedDayTasks,
                        selectedDayTimeslots
                      );
                      navigator.clipboard.writeText(docContent).then(() => {
                        setCopiedDoc(true);
                        setTimeout(() => setCopiedDoc(false), 2500);
                      });
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F2EFE9] hover:bg-[#EAE7DF] text-[#4A4E4D] text-xs font-semibold transition cursor-pointer"
                  >
                    {copiedDoc ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copy Text</span>
                  </button>

                  <button
                    onClick={() => {
                      const docContent = generateDailyActionDocument(
                        selectedDayStr,
                        userProfile?.targetHoursPerDay || 3,
                        selectedDayActualHours,
                        selectedDayTasks,
                        selectedDayTimeslots
                      );
                      const blob = new Blob([docContent], { type: 'text/markdown;charset=utf-8;' });
                      const link = document.createElement('a');
                      link.href = URL.createObjectURL(blob);
                      link.download = `StudyFlow_Action_Sheet_${selectedDayStr}.md`;
                      link.click();
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-semibold transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .MD Document</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Smart Schedule Adjuster Modal */}
      <SmartScheduleAdjusterModal
        isOpen={isScheduleAdjusterOpen}
        onClose={() => setIsScheduleAdjusterOpen(false)}
        initialTopicName=""
        initialSubjectName={subjects[0]?.name || 'General'}
        initialDurationMinutes={30}
        subjects={subjects}
        plans={[]}
        sessions={sessions}
        userProfile={userProfile}
        onAddScheduledTask={(newTask) => {
          setScheduledTasks(prev => [newTask, ...prev]);
        }}
      />
    </div>
  );
};
