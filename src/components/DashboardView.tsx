import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Clock, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Circle, 
  AlertTriangle, 
  TrendingUp, 
  Sparkles, 
  Play, 
  ArrowRight, 
  BookOpen, 
  BookMarked,
  Award,
  Zap,
  BarChart3,
  Users,
  Check,
  RotateCcw,
  ListChecks,
  Mail,
  FileText,
  Edit3,
  Brain,
  ListTodo,
  PartyPopper,
  Moon,
  RefreshCw,
  Smartphone,
  Mic,
  Layers,
  PenTool,
  BookmarkCheck,
  Bell
} from 'lucide-react';
import { loadMistakes, calculateMistakeStats, subscribeMistakes } from '../lib/mistakeVaultStorage';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  CartesianGrid 
} from 'recharts';
import { 
  Subject, 
  StudySession, 
  StudyPlan, 
  StudyPlanTopic,
  TopicCompletionStatus,
  TestResult, 
  RevisionItem, 
  ActivityLog,
  ActiveTab,
  UserProfile,
  Assignment,
  MissedWorkItem,
  TopicStatus
} from '../types';
import { QuickSyllabusCoverageModal } from './QuickSyllabusCoverageModal';
import { DailyRemindersCard } from './DailyRemindersCard';
import { SmartPriorityCard } from './SmartPriorityCard';
import { MotivationWidget } from './MotivationWidget';
import { DailyGoalTracker } from './DailyGoalTracker';
import { WeeklyScheduleManager } from './WeeklyScheduleManager';
import { BadgesComponent } from './BadgesComponent';
import { UrgentStudyPriorityCard } from './UrgentStudyPriorityCard';
import { BulkScheduleUploader } from './BulkScheduleUploader';
import { TaskDetailModal } from './TaskDetailModal';
import { SyllabusGoalSuggester, SuggestedGoal } from './SyllabusGoalSuggester';
import { EveningRetroModal } from './EveningRetroModal';
import { TwoWaySyncModal } from './TwoWaySyncModal';
import { YearProfileCard } from './YearProfileCard';
import { EditYearProfileModal } from './EditYearProfileModal';
import { FeynmanConceptAnalyzer } from './FeynmanConceptAnalyzer';
import { ExamReadinessIndexCard } from './ExamReadinessIndexCard';
import { StudyHabitHeatmapCard } from './StudyHabitHeatmapCard';
import { RetentionForgettingCurveCard } from './RetentionForgettingCurveCard';
import { triggerStudyGoalConfetti } from '../lib/confetti';
import { sendDailyCompletedWorkEmail } from '../lib/gmailService';
import { getActiveUserEmail, addActivityLogToDb, resolveActiveUserId } from '../lib/db';
import { Loader2, Send, GraduationCap, Target, Calendar } from 'lucide-react';

interface DashboardViewProps {
  subjects: Subject[];
  sessions: StudySession[];
  plans: StudyPlan[];
  testResults: TestResult[];
  revisions: RevisionItem[];
  activityLogs?: ActivityLog[];
  assignments?: Assignment[];
  missedWork?: MissedWorkItem[];
  userProfile: UserProfile | null;
  setActiveTab: (tab: ActiveTab) => void;
  onStartTimerForTopic: (subjectName: string, chapterName: string, topicName: string) => void;
  onStartBlurtForTopic?: (subjectName: string, chapterName: string, topicName: string) => void;
  onStartTimerForAssignment?: (assignment: Assignment) => void;
  onSaveAssignment?: (assignment: Assignment) => Promise<string | void> | void;
  onUpdateProfile?: (profileUpdates: Partial<UserProfile>) => void;
  onSavePlan?: (plan: Omit<StudyPlan, 'id'>) => Promise<void> | void;
  onTogglePlanTopic?: (planId: string, topicId: string, completed?: boolean, details?: any) => void;
  onOpenExamAutomationModal?: () => void;
  onOpenEmailAgendaModal?: () => void;
  onOpenWhatsAppModal?: () => void;
  onOpenVoiceFeynman?: () => void;
  onOpenKnowledgeTree?: () => void;
  onOpenPredictiveGrades?: () => void;
  onOpenWorkspaceHub?: (tab?: 'calendar' | 'drive' | 'keep' | 'tasks') => void;
  onOpenMaterialImport?: () => void;
  onOpenZenSprint?: (subjectName?: string, topicName?: string) => void;
  onOpenCheatSheet?: (subjectName?: string, topicName?: string) => void;
  onUpdateTopicStatus?: (subjectName: string, topicName: string, status: TopicStatus) => Promise<void> | void;
  onAddTestResult?: (test: Omit<TestResult, 'id'>) => Promise<void> | void;
  onAdjustPlanTopicDuration?: (planId: string, topicId: string, deltaMinutes: number) => void;
}

// Weekly Study Summary Component with Recharts Bar Chart
export const WeeklySummaryCard: React.FC<{
  subjects: Subject[];
  sessions: StudySession[];
  activityLogs?: ActivityLog[];
  setActiveTab: (tab: ActiveTab) => void;
}> = ({ subjects, sessions, activityLogs = [], setActiveTab }) => {
  const [viewMode, setViewMode] = useState<'subject' | 'day'>('subject');

  // Compute 7 days date range (YYYY-MM-DD)
  const now = new Date();
  const past7DaysDates: { dateStr: string; dayLabel: string; shortDay: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
    const shortDay = d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
    past7DaysDates.push({ dateStr, dayLabel: `${dayLabel} (${shortDay})`, shortDay: dayLabel });
  }

  const past7DaysSet = new Set(past7DaysDates.map(p => p.dateStr));

  // Combine sessions and activity logs in past 7 days
  const weeklySessions = sessions.filter(s => past7DaysSet.has(s.date) || (s.timestamp && (Date.now() - s.timestamp) <= 7 * 24 * 60 * 60 * 1000));
  const weeklyLogs = activityLogs.filter(l => past7DaysSet.has(l.date) || (l.timestamp && (Date.now() - l.timestamp) <= 7 * 24 * 60 * 60 * 1000));

  // Map subjects to minutes
  const subjectMap: { [name: string]: { minutes: number; icon: string; color: string } } = {};
  subjects.forEach(s => {
    subjectMap[s.name] = { minutes: 0, icon: s.icon || '📚', color: s.color || '#6B705C' };
  });

  let totalWeeklyMinutes = 0;
  let sessionCount = 0;

  // Aggregate from sessions
  weeklySessions.forEach(s => {
    const mins = s.durationMinutes || 0;
    totalWeeklyMinutes += mins;
    sessionCount++;
    if (s.subjectName) {
      if (!subjectMap[s.subjectName]) {
        subjectMap[s.subjectName] = { minutes: 0, icon: '📚', color: '#6B705C' };
      }
      subjectMap[s.subjectName].minutes += mins;
    }
  });

  // Aggregate from activity logs if duration exists
  weeklyLogs.forEach(l => {
    if (l.durationMinutes && l.durationMinutes > 0 && l.subjectName) {
      if (!subjectMap[l.subjectName]) {
        subjectMap[l.subjectName] = { minutes: 0, icon: '📚', color: '#6B705C' };
      }
      subjectMap[l.subjectName].minutes += l.durationMinutes;
      totalWeeklyMinutes += l.durationMinutes;
    }
  });

  const hasRealData = totalWeeklyMinutes > 0;

  // Prepare Subject Chart Data
  let subjectChartData: { name: string; icon: string; hours: number; rawMinutes: number; color: string }[] = [];

  if (hasRealData) {
    subjectChartData = Object.keys(subjectMap).map(subName => {
      const info = subjectMap[subName];
      return {
        name: subName,
        icon: info.icon,
        hours: Number((info.minutes / 60).toFixed(1)),
        rawMinutes: info.minutes,
        color: info.color
      };
    }).filter(d => d.rawMinutes > 0);
  } else {
    // Generate realistic sample preview data based on active syllabus subjects
    const presetColors = ['#6B705C', '#A5A58D', '#B7B7A4', '#DDBEA9', '#CB997E', '#6366F1', '#EC4899'];
    subjectChartData = subjects.map((sub, idx) => {
      const sampleHours = [3.5, 2.5, 2.0, 1.5, 1.0][idx % 5] || 1.5;
      return {
        name: sub.name,
        icon: sub.icon || '📚',
        hours: sampleHours,
        rawMinutes: Math.round(sampleHours * 60),
        color: sub.color || presetColors[idx % presetColors.length]
      };
    });
  }

  subjectChartData.sort((a, b) => b.hours - a.hours);

  // Prepare Day Chart Data
  const dayChartData = past7DaysDates.map(p => {
    let dayMins = 0;
    weeklySessions.forEach(s => {
      if (s.date === p.dateStr) dayMins += (s.durationMinutes || 0);
    });
    weeklyLogs.forEach(l => {
      if (l.date === p.dateStr && l.durationMinutes) dayMins += l.durationMinutes;
    });

    if (!hasRealData) {
      const sampleDayHours = [1.5, 2.0, 2.5, 1.0, 3.0, 2.2, 1.8];
      const idx = past7DaysDates.findIndex(d => d.dateStr === p.dateStr);
      const hours = sampleDayHours[idx % 7];
      return {
        name: p.shortDay,
        icon: '📅',
        hours,
        rawMinutes: Math.round(hours * 60),
        color: '#6B705C'
      };
    }

    const hours = Number((dayMins / 60).toFixed(1));
    return {
      name: p.shortDay,
      icon: '📅',
      hours,
      rawMinutes: dayMins,
      color: '#6B705C'
    };
  });

  const displayTotalHours = hasRealData ? (totalWeeklyMinutes / 60).toFixed(1) : '11.5';
  const topSubject = subjectChartData.length > 0 ? subjectChartData[0] : { name: 'N/A', hours: 0, icon: '📚' };
  const dailyAverageHours = hasRealData ? (totalWeeklyMinutes / 60 / 7).toFixed(1) : '1.6';

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const totalHoursNum = parseFloat(displayTotalHours) || 0;
      const pct = totalHoursNum > 0 && data.hours ? Math.round((parseFloat(data.hours) / totalHoursNum) * 100) : 0;
      return (
        <div className="bg-card border-2 border-theme p-3 rounded-2xl shadow-xl text-xs space-y-1.5 font-sans text-primary min-w-[160px] z-50">
          <p className="font-bold flex items-center gap-1.5 text-sm border-b border-theme pb-1">
            <span className="text-base">{data.icon || '📚'}</span>
            <span>{data.name || data.fullLabel || data.day}</span>
          </p>
          <div className="flex items-center justify-between text-primary font-semibold pt-0.5">
            <span className="text-muted">Study Time:</span>
            <span className="font-mono font-bold text-sm text-primary">{data.hours} hrs</span>
          </div>
          {totalHoursNum > 0 && pct > 0 && (
            <div className="flex items-center justify-between text-[11px] text-muted font-mono">
              <span>Weekly Share:</span>
              <span className="font-bold text-primary">{pct}%</span>
            </div>
          )}
          {data.rawMinutes !== undefined && (
            <p className="text-[10px] text-muted pt-0.5 border-t border-theme/50">
              Total {data.rawMinutes} minutes logged
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-card border border-theme rounded-3xl p-6 shadow-xs space-y-5 transition-colors">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-theme pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-theme-accent border border-theme flex items-center justify-center text-primary shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-primary flex items-center gap-2">
              <span>Weekly Study Summary</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-theme-accent text-primary border border-theme rounded-full">
                Past 7 Days
              </span>
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Summary of study hours per subject fetched from study sessions & activity logs
            </p>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex items-center p-1 bg-surface border border-theme rounded-2xl shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setViewMode('subject')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
              viewMode === 'subject'
                ? 'bg-card text-primary shadow-2xs border border-theme'
                : 'text-muted hover:text-primary'
            }`}
          >
            By Subject
          </button>
          <button
            onClick={() => setViewMode('day')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
              viewMode === 'day'
                ? 'bg-card text-primary shadow-2xs border border-theme'
                : 'text-muted hover:text-primary'
            }`}
          >
            By Day
          </button>
        </div>
      </div>

      {/* Summary KPI Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="p-3.5 rounded-2xl bg-surface border border-theme"
        >
          <div className="text-[10px] font-bold text-muted uppercase tracking-wider">Weekly Study Hours</div>
          <div className="text-lg font-bold text-primary font-mono mt-0.5">{displayTotalHours} hrs</div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="p-3.5 rounded-2xl bg-surface border border-theme"
        >
          <div className="text-[10px] font-bold text-muted uppercase tracking-wider">Most Studied Subject</div>
          <div className="text-xs font-bold text-primary truncate mt-1 flex items-center gap-1">
            <span>{topSubject.icon}</span>
            <span className="truncate">{topSubject.name}</span>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          className="p-3.5 rounded-2xl bg-surface border border-theme"
        >
          <div className="text-[10px] font-bold text-muted uppercase tracking-wider">Daily Average</div>
          <div className="text-lg font-bold text-primary font-mono mt-0.5">{dailyAverageHours} hrs/day</div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
          className="p-3.5 rounded-2xl bg-surface border border-theme"
        >
          <div className="text-[10px] font-bold text-muted uppercase tracking-wider">Sessions Logged</div>
          <div className="text-lg font-bold text-primary font-mono mt-0.5">
            {hasRealData ? sessionCount : '7'} sessions
          </div>
        </motion.div>
      </div>

      {!hasRealData && (
        <div className="px-4 py-2.5 bg-theme-accent border border-theme rounded-2xl flex items-center justify-between text-xs text-primary">
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <span>Showing projected weekly breakdown. Log study sessions with the timer to track live hours!</span>
          </span>
          <button
            onClick={() => setActiveTab('timer')}
            className="px-3 py-1 bg-primary text-white rounded-xl font-bold hover:opacity-90 transition text-xs shrink-0 cursor-pointer ml-2 shadow-2xs"
          >
            Start Timer
          </button>
        </div>
      )}

      {/* Recharts Bar Chart */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.25, ease: 'easeOut' }}
        className="h-64 w-full pt-2"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={viewMode === 'subject' ? subjectChartData : dayChartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-15" vertical={false} />
            <XAxis
              dataKey={viewMode === 'subject' ? 'name' : 'day'}
              stroke="currentColor"
              className="text-muted"
              fontSize={11}
              tickLine={false}
              interval={0}
              tick={(props: any) => {
                const { x, y, payload } = props;
                const item = viewMode === 'subject' ? subjectChartData.find(d => d.name === payload.value) : null;
                return (
                  <g transform={`translate(${x},${y})`}>
                    <text
                      x={0}
                      y={0}
                      dy={14}
                      textAnchor="middle"
                      fill="currentColor"
                      className="text-[11px] font-semibold font-sans fill-current text-primary"
                    >
                      {item ? `${item.icon} ${item.name.length > 9 ? item.name.slice(0, 8) + '…' : item.name}` : payload.value}
                    </text>
                  </g>
                );
              }}
            />
            <YAxis
              stroke="currentColor"
              className="text-muted"
              fontSize={11}
              tickLine={false}
              unit="h"
            />
            <Tooltip 
              content={<CustomTooltip />} 
              cursor={{ fill: 'currentColor', opacity: 0.08 }} 
            />
            <Bar
              dataKey="hours"
              radius={[10, 10, 0, 0]}
              maxBarSize={48}
              isAnimationActive={true}
              animationDuration={900}
              animationEasing="ease-out"
            >
              {(viewMode === 'subject' ? subjectChartData : dayChartData).map((entry: any, index: number) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color || (index % 2 === 0 ? 'var(--color-primary)' : 'var(--color-primary-hover)')} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  subjects,
  sessions,
  plans,
  testResults,
  revisions,
  activityLogs = [],
  assignments = [],
  missedWork = [],
  userProfile,
  setActiveTab,
  onStartTimerForTopic,
  onStartBlurtForTopic,
  onStartTimerForAssignment,
  onSaveAssignment,
  onUpdateProfile,
  onSavePlan,
  onTogglePlanTopic,
  onOpenExamAutomationModal,
  onOpenEmailAgendaModal,
  onOpenWhatsAppModal,
  onOpenVoiceFeynman,
  onOpenKnowledgeTree,
  onOpenPredictiveGrades,
  onOpenWorkspaceHub,
  onOpenMaterialImport,
  onOpenZenSprint,
  onOpenCheatSheet,
  onUpdateTopicStatus,
  onAddTestResult,
  onAdjustPlanTopicDuration
}) => {
  // Live clock
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  // Quick Syllabus Coverage & Mastery Modal state
  const [isQuickCoverageModalOpen, setIsQuickCoverageModalOpen] = useState<boolean>(false);

  // Evening Retro & Two-Way Sync Modal states
  const [isEveningRetroOpen, setIsEveningRetroOpen] = useState<boolean>(false);
  const [isTwoWaySyncOpen, setIsTwoWaySyncOpen] = useState<boolean>(false);

  // Auto-trigger modal if accessed via email link action parameters
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const action = params.get('action');
      if (action === 'evening_retro' || action === 'draft_tomorrow') {
        setIsEveningRetroOpen(true);
      } else if (action === 'two_way_sync') {
        setIsTwoWaySyncOpen(true);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Task Completion Details Modal state
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<{
    planId: string;
    topic: StudyPlanTopic;
  } | null>(null);

  // Edit Year Profile Modal state
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState<boolean>(false);

  const handleUpdateTargetHours = (hours: number) => {
    if (onUpdateProfile) {
      onUpdateProfile({ targetHoursPerDay: hours });
    }
  };

  const handleSavePlanWrapper = async (planPayload: Omit<StudyPlan, 'id'>) => {
    if (onSavePlan) {
      await onSavePlan(planPayload);
    }
  };

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCurrentDate(now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', weekday: 'short' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Today's YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];

  // Real-time Mistake Vault stats for Dashboard
  const [mistakeStats, setMistakeStats] = useState(() => calculateMistakeStats(loadMistakes()));

  useEffect(() => {
    const unsub = subscribeMistakes((entries) => {
      setMistakeStats(calculateMistakeStats(entries));
    });
    return unsub;
  }, []);

  // Email Completed Work Today state & handler
  const [isSendingCompletedWorkEmail, setIsSendingCompletedWorkEmail] = useState<boolean>(false);
  const [completedWorkEmailFeedback, setCompletedWorkEmailFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleEmailCompletedWorkToday = async () => {
    const targetEmail = userProfile?.email || getActiveUserEmail() || '';
    if (!targetEmail) {
      setCompletedWorkEmailFeedback({
        type: 'error',
        text: 'No email found in your user profile. Please enter your email in Settings.'
      });
      return;
    }

    setIsSendingCompletedWorkEmail(true);
    setCompletedWorkEmailFeedback(null);
    try {
      const completedTopicsList = completedPlanTopics.map(t => ({
        topicName: t.topicName,
        subjectName: t.subjectName,
        duration: t.durationMinutes
      }));

      // Also include topics completed in today's study sessions
      todaySessions
        .filter(s => s.result === 'Completed')
        .forEach(s => {
          if (!completedTopicsList.some(item => item.topicName === s.topicName)) {
            completedTopicsList.push({
              topicName: s.topicName,
              subjectName: s.subjectName,
              duration: s.durationMinutes
            });
          }
        });

      await sendDailyCompletedWorkEmail({
        recipientEmail: targetEmail,
        recipientName: userProfile?.name || 'Student',
        completedTopics: completedTopicsList,
        todaySessions: todaySessions,
        totalStudyMinutes: totalMinutesToday,
        userProfile: userProfile
      });

      setCompletedWorkEmailFeedback({
        type: 'success',
        text: `Today's completed work summary (${completedTopicsList.length} completed topics, ${hoursToday} hrs study) sent to ${targetEmail}!`
      });
    } catch (err: any) {
      console.error('Completed work email error:', err);
      setCompletedWorkEmailFeedback({
        type: 'error',
        text: err?.message?.includes('popup')
          ? 'Browser pop-up blocked. Please enable pop-ups for this tab to authenticate Gmail.'
          : `Failed to dispatch email: ${err?.message || 'Unknown error'}`
      });
    } finally {
      setIsSendingCompletedWorkEmail(false);
    }
  };

  // Sessions done today
  const todaySessions = sessions.filter(s => s.date === todayStr);
  const totalMinutesToday = todaySessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  const hoursToday = (totalMinutesToday / 60).toFixed(1);
  const targetDailyHours = userProfile?.targetHoursPerDay || 3;
  const targetDailyMinutes = targetDailyHours * 60;
  const isDailyGoalAchieved = totalMinutesToday >= targetDailyMinutes && targetDailyMinutes > 0;
  const studyGoalProgressPercent = targetDailyMinutes > 0 
    ? Math.min(100, Math.round((totalMinutesToday / targetDailyMinutes) * 100)) 
    : 0;

  // Track if celebration confetti has triggered for the dashboard goal
  const hasTriggeredDashboardConfetti = useRef<boolean>(false);

  useEffect(() => {
    if (isDailyGoalAchieved && !hasTriggeredDashboardConfetti.current) {
      hasTriggeredDashboardConfetti.current = true;
      const timer = setTimeout(() => {
        triggerStudyGoalConfetti();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isDailyGoalAchieved]);

  // Today's plan
  const todayPlan = plans.find(p => p.date === todayStr) || plans[0] || null;

  // Filter assigned vs completed topics for today
  const assignedPlanTopics = todayPlan ? todayPlan.topics.filter(t => !t.completed) : [];
  const completedPlanTopics = todayPlan ? todayPlan.topics.filter(t => Boolean(t.completed)) : [];
  const planCompletionPercent = todayPlan && todayPlan.topics.length > 0
    ? Math.round((completedPlanTopics.length / todayPlan.topics.length) * 100)
    : 0;

  // Overall Syllabus Progress
  let totalTopics = 0;
  let completedTopicsCount = 0;
  let masteredTopicsCount = 0;
  let weakTopicsList: { subject: string; topic: string; notes?: string }[] = [];

  subjects.forEach(sub => {
    sub.chapters.forEach(ch => {
      ch.topics.forEach(t => {
        totalTopics++;
        if (t.status === 'Mastered') {
          masteredTopicsCount++;
          completedTopicsCount++;
        } else if (t.status === 'Completed') {
          completedTopicsCount++;
        }
        if (t.status === 'Weak' || t.status === 'Needs Revision') {
          weakTopicsList.push({ subject: sub.name, topic: t.name, notes: t.weakNotes });
        }
      });
    });
  });

  const remainingTopicsCount = Math.max(0, totalTopics - completedTopicsCount);
  const overallProgressPercent = totalTopics > 0 ? Math.round((completedTopicsCount / totalTopics) * 100) : 0;

  // Planned duration and session metrics for today's focus plan
  const totalPlannedMinutes = todayPlan ? todayPlan.topics.reduce((acc, t) => acc + (t.estimatedMinutes || 45), 0) : 0;
  const plannedHours = (totalPlannedMinutes / 60).toFixed(1);
  const plannedSessionsCount = todayPlan ? todayPlan.topics.length : 0;

  // Next Upcoming Exam Countdown
  const now = new Date();
  const upcomingExams = userProfile?.examDates || [];
  const nextExam = upcomingExams
    .filter(e => new Date(e.date).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] || null;

  const daysToNextExam = nextExam 
    ? Math.max(0, Math.ceil((new Date(nextExam.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  // Activity logger for Feynman Concept Analyzer
  const handleLogFeynmanActivity = async (logPayload: any) => {
    try {
      const uid = resolveActiveUserId(userProfile?.uid, userProfile?.email || null);
      if (uid) {
        await addActivityLogToDb(uid, logPayload);
      }
    } catch (e) {
      console.error('Failed to log Feynman activity:', e);
    }
  };

  // Pending Revisions
  const pendingRevisions = revisions.filter(r => r.status === 'Pending');

  // Helper to get emoji for a subject
  const getSubjectEmoji = (subjectName?: string) => {
    if (!subjectName) return '📚';
    const cleanSub = subjectName.trim().toLowerCase();
    const found = subjects.find(s => (s.name || '').trim().toLowerCase() === cleanSub);
    return found?.icon || '📚';
  };

  // Adopt a syllabus-suggested micro study goal into today's active plan
  const handleAdoptSuggestedGoal = async (goal: SuggestedGoal) => {
    const newTopic: StudyPlanTopic = {
      id: `tp-sugg-${Date.now()}`,
      subjectName: goal.subjectName,
      chapterName: goal.chapterName,
      topicName: goal.topicName,
      estimatedMinutes: goal.estimatedMinutes,
      priority: 'High',
      reason: goal.reason,
      completed: false
    };

    if (todayPlan) {
      const updatedPlan: StudyPlan = {
        ...todayPlan,
        topics: [...todayPlan.topics, newTopic]
      };
      if (onSavePlan) {
        await onSavePlan(updatedPlan);
      }
    } else {
      const newPlan: Omit<StudyPlan, 'id'> = {
        userId: userProfile?.uid || 'current-user',
        date: todayStr,
        title: `Daily Focus (${todayStr})`,
        reasoning: `Created by adopting a ${goal.stageName} syllabus goal (${overallProgressPercent}% coverage).`,
        createdAt: new Date().toISOString(),
        topics: [newTopic]
      };
      if (onSavePlan) {
        await onSavePlan(newPlan);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* AUTONOMOUS STUDY MATERIAL INGESTION CALLOUT BANNER */}
      {subjects.length === 0 && (
        <div className="bg-gradient-to-r from-[#2D3142] via-[#4F5D75] to-[#2D3142] text-white rounded-3xl p-6 sm:p-8 shadow-md border border-[#4F5D75]/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Autonomous Study System</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-serif italic">
              Provide your material once. Let AI build your workspace.
            </h3>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              Upload your syllabus, lecture notes, textbook chapters, or Google Docs. The system autonomously extracts topics, builds active-recall flashcard decks, synthesizes self-test questions, and plans your adaptive schedule.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 w-full sm:w-auto">
            {onOpenMaterialImport && (
              <button
                onClick={onOpenMaterialImport}
                className="px-6 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Import Study Material (AI)</span>
              </button>
            )}
            <button
              onClick={() => setActiveTab('syllabus')}
              className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>Manual Setup</span>
            </button>
          </div>
        </div>
      )}

      {/* Academic Profile Banner (Top): Welcome, Grade, FBISE Track, Exam Countdown, Quick Action buttons */}
      <div className="bg-card border border-theme rounded-3xl p-5 sm:p-7 shadow-xs relative overflow-hidden transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          {/* Left Column: Welcome & Academic Track Badges */}
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold uppercase tracking-widest font-mono text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                {currentDate}
              </span>
              <span className="text-[11px] font-mono text-muted">
                Session Time: <span className="text-primary font-bold">{currentTime}</span>
              </span>
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-serif italic font-bold text-primary tracking-tight">
                Good day, {userProfile?.displayName || userProfile?.name || 'Student'}.
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-theme text-xs font-bold text-primary shadow-2xs">
                  <GraduationCap className="w-3.5 h-3.5 text-primary" />
                  <span>{userProfile?.yearLevel || 'Grade 11 (HSSC-I)'}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-theme text-xs font-bold text-primary shadow-2xs">
                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                  <span>{userProfile?.majorOrStream || 'Pre-Medical / Pre-Engineering (FBISE)'}</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-theme-accent border border-theme text-[11px] font-mono text-muted">
                  {userProfile?.academicYear || '2026 - 2027'}
                </span>
                <button
                  onClick={() => setIsEditProfileModalOpen(true)}
                  className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 ml-1 cursor-pointer py-1"
                  title="Update Grade, FBISE Stream, or Exam Targets"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Edit Profile</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Target Pace: <strong className="text-primary">{userProfile?.targetHoursPerDay || 3} hrs/day</strong> • {subjects.length} FBISE curriculum subjects active. Progress and active retrieval metrics sync directly with your workspace.
            </p>
          </div>

          {/* Right Column: Exam Countdown & Quick Action Buttons */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end justify-between gap-4 shrink-0">
            {/* Exam Countdown Box */}
            <div 
              onClick={onOpenExamAutomationModal}
              className={`bg-surface border border-theme rounded-2xl p-4 shadow-2xs min-w-[220px] transition ${
                onOpenExamAutomationModal ? 'cursor-pointer hover:border-primary/50 group' : ''
              }`}
              title="Click to view syllabus completion stats & configure 24/7 automated email digests"
            >
              <div className="flex items-center justify-between text-[10px] font-mono font-bold text-muted uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <Target className="w-3.5 h-3.5 text-primary" />
                  <span>Exam Target</span>
                </span>
                {onOpenExamAutomationModal && (
                  <span className="text-primary text-[10px] font-sans font-bold underline group-hover:opacity-80">
                    24/7 Email Digest
                  </span>
                )}
              </div>

              {nextExam && daysToNextExam !== null ? (
                <div className="mt-1">
                  <div className="text-xs font-bold text-primary truncate max-w-[200px]">
                    {nextExam.examName}
                  </div>
                  <div className="text-xl sm:text-2xl font-mono font-bold text-primary mt-0.5">
                    {daysToNextExam} <span className="text-xs font-sans not-italic text-muted font-normal">days left</span>
                  </div>
                </div>
              ) : (
                <div className="mt-1">
                  <div className="text-xs font-bold text-primary">
                    Target Year: {userProfile?.targetExamYear || '2027'}
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {userProfile?.semesterOrTerm || 'FBISE Annual Finals'}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Action Buttons - Harmonious cohesive aesthetic */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto py-1">
              {/* Focused Timer Primary Action */}
              <button
                onClick={() => setActiveTab('timer')}
                className="px-4 py-2 rounded-xl bg-primary hover:opacity-90 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 shrink-0"
                title="Start a focused study timer session"
              >
                <Clock className="w-3.5 h-3.5 text-white" />
                <span>Focus Sprint</span>
              </button>

              {/* 24/7 Automated Exam Alerts Quick Action */}
              {onOpenExamAutomationModal && (
                <button
                  onClick={onOpenExamAutomationModal}
                  className="px-3 py-2 rounded-xl bg-theme-accent hover:border-primary/40 border border-theme text-primary text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 shrink-0"
                  title="24/7 Automated Exam Countdown & Syllabus Digest"
                >
                  <Bell className="w-3.5 h-3.5 text-primary" />
                  <span>Exam Alerts</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[9px] font-mono font-bold">24/7</span>
                </button>
              )}

              {/* WhatsApp Coach & Alerts Button */}
              {onOpenWhatsAppModal && (
                <button
                  onClick={onOpenWhatsAppModal}
                  className="px-3 py-2 rounded-xl bg-theme-accent hover:border-primary/40 border border-theme text-primary text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 shrink-0"
                  title="Open WhatsApp Study Companion: Automated Flight Plans & 2-Way AI Coach"
                >
                  <Smartphone className="w-3.5 h-3.5 text-primary" />
                  <span>WhatsApp Coach</span>
                </button>
              )}

              {/* Voice Socratic Feynman Oral Exam */}
              {onOpenVoiceFeynman && (
                <button
                  onClick={onOpenVoiceFeynman}
                  className="px-3 py-2 rounded-xl bg-theme-accent hover:border-primary/40 border border-theme text-primary text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 shrink-0"
                  title="Voice Socratic Oral Exam: Defend your understanding aloud like Richard Feynman"
                >
                  <Mic className="w-3.5 h-3.5 text-primary" />
                  <span>Feynman Exam</span>
                </button>
              )}

              {/* Predictive Grade Simulator */}
              {onOpenPredictiveGrades && (
                <button
                  onClick={onOpenPredictiveGrades}
                  className="px-3 py-2 rounded-xl bg-theme-accent hover:border-primary/40 border border-theme text-primary text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 shrink-0"
                  title="Predictive Grade & Readiness Simulator"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  <span>Predictive Grade</span>
                </button>
              )}

              {/* Zen Study Sprint (Option 1) */}
              {onOpenZenSprint && (
                <button
                  onClick={() => onOpenZenSprint()}
                  className="px-3 py-2 rounded-xl bg-theme-accent hover:border-primary/40 border border-theme text-primary text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 shrink-0"
                  title="Open Zen Study Mode: Ambient soundscapes, breathing pacing, and post-session Feynman blurt"
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>Zen Sprint</span>
                </button>
              )}

              {/* AI Cheat Sheet Generator */}
              {onOpenCheatSheet && (
                <button
                  onClick={() => onOpenCheatSheet()}
                  className="px-3 py-2 rounded-xl bg-theme-accent hover:border-primary/40 border border-theme text-primary text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 shrink-0"
                  title="Generate AI High-Yield Cheat Sheet: Core formulas, examiner traps, and mnemonics"
                >
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  <span>AI Cheat Sheet</span>
                </button>
              )}

              {/* Email Work */}
              <button
                onClick={handleEmailCompletedWorkToday}
                disabled={isSendingCompletedWorkEmail}
                className="px-3 py-2 rounded-xl bg-theme-accent hover:border-primary/40 border border-theme text-primary text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50 shrink-0"
                title="Email today's completed study summary to your Gmail"
              >
                {isSendingCompletedWorkEmail ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                ) : (
                  <Send className="w-3.5 h-3.5 text-primary" />
                )}
                <span>Email Work</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Top Email Feedback Notification if dispatched from banner */}
      {completedWorkEmailFeedback && (
        <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
          completedWorkEmailFeedback.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
            : 'bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/30'
        }`}>
          <div className="flex items-center gap-2">
            {completedWorkEmailFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span className="font-medium">{completedWorkEmailFeedback.text}</span>
          </div>
          <button
            onClick={() => setCompletedWorkEmailFeedback(null)}
            className="text-current opacity-70 hover:opacity-100 cursor-pointer font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* HIGH-LEVEL STATS GRID: Total Topics, Completed, Mastered, and Remaining counters */}
      <div className="bg-card border border-theme rounded-3xl p-5 shadow-xs space-y-4 transition-colors">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {/* 1. Total Topics */}
          <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-theme flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center justify-between text-muted text-[11px] font-bold uppercase tracking-wider">
              <span>Total Topics</span>
              <BookOpen className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-primary mt-2 mb-1 leading-tight select-none">
              {totalTopics}
            </div>
            <div className="text-[11px] text-muted">
              Across {subjects.length} enrolled subjects
            </div>
          </div>

          {/* 2. Completed */}
          <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-theme flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center justify-between text-muted text-[11px] font-bold uppercase tracking-wider">
              <span>Completed</span>
              <CheckCircle2 className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-primary mt-2 mb-1 leading-tight select-none">
              {completedTopicsCount}
            </div>
            <div className="text-[11px] text-muted">
              {overallProgressPercent}% syllabus finished
            </div>
          </div>

          {/* 3. Mastered */}
          <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-theme flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center justify-between text-muted text-[11px] font-bold uppercase tracking-wider">
              <span>Mastered</span>
              <Award className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-primary mt-2 mb-1 leading-tight select-none">
              {masteredTopicsCount}
            </div>
            <div className="text-[11px] text-muted">
              ⭐ Top retention tier
            </div>
          </div>

          {/* 4. Remaining */}
          <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-theme flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center justify-between text-muted text-[11px] font-bold uppercase tracking-wider">
              <span>Remaining</span>
              <Target className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-primary mt-2 mb-1 leading-tight select-none">
              {remainingTopicsCount}
            </div>
            <div className="text-[11px] text-muted">
              Target to finish syllabus
            </div>
          </div>
        </div>

        {/* Overall Syllabus Coverage Progress Bar & Direct Action */}
        <div className="pt-2 border-t border-theme space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="font-semibold text-primary font-serif text-xs sm:text-sm">
                Overall Academic Syllabus Coverage
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono font-bold text-xs sm:text-sm text-primary">
                {overallProgressPercent}% ({completedTopicsCount}/{totalTopics} topics)
              </span>
              <button
                onClick={() => setIsQuickCoverageModalOpen(true)}
                className="px-3 py-1 rounded-xl bg-primary hover:opacity-90 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                title="Open Syllabus Coverage Manager with all 6 update pathways"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Update Coverage</span>
              </button>
            </div>
          </div>
          <div 
            onClick={() => setIsQuickCoverageModalOpen(true)}
            className="w-full bg-theme-accent h-3 rounded-full overflow-hidden cursor-pointer hover:opacity-95 transition"
            title="Click to view all 6 syllabus update methods and quick topic toggles"
          >
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${overallProgressPercent}%` }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
              className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 h-full rounded-full"
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted">
            <span>Tap "Update Coverage" to toggle topics, log quizzes, or use any of the 6 update pathways.</span>
            <span className="font-semibold text-primary">
              {totalTopics - completedTopicsCount} topics to 100%
            </span>
          </div>
        </div>
      </div>

      {/* OPTION 3: EXAM READINESS INDEX CARD */}
      <ExamReadinessIndexCard
        subjects={subjects}
        testResults={testResults}
        revisions={revisions}
        sessions={sessions}
        onStartSprintForTopic={(subj, _ch, top) => {
          if (onOpenZenSprint) onOpenZenSprint(subj, top);
          else onStartTimerForTopic(subj, _ch, top);
        }}
        onOpenCheatSheetForTopic={(subj, top) => {
          if (onOpenCheatSheet) onOpenCheatSheet(subj, top);
        }}
        onOpenBlurtForTopic={onStartBlurtForTopic}
        onNavigateTab={setActiveTab}
      />

      {/* DAILY FRONT: Today's Focus Plan & Real-Time Action Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Focus Plan Card */}
        <div className="lg:col-span-2 bg-card border border-theme rounded-3xl p-6 shadow-xs space-y-4 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-theme pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-theme-accent text-primary border border-theme uppercase tracking-widest font-sans">
                  DAILY AGENDA
                </span>
                <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Today's Focus Plan</h3>
                {todayPlan && todayPlan.topics.length > 0 && (
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-theme-accent text-primary border border-theme">
                    {completedPlanTopics.length}/{todayPlan.topics.length} Done
                  </span>
                )}
              </div>
              <p className="text-xs text-primary mt-1 font-semibold">
                {todayPlan ? todayPlan.title : 'No custom plan generated for today yet.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              {/* Email Completed Work Today */}
              <button
                onClick={handleEmailCompletedWorkToday}
                disabled={isSendingCompletedWorkEmail}
                className="px-3.5 py-2 rounded-full bg-primary hover:opacity-90 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                title="Email summary of all completed work, study sessions, and finished topics for today to your Gmail"
              >
                {isSendingCompletedWorkEmail ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Email Completed Work</span>
              </button>

              {onOpenWorkspaceHub && (
                <>
                  <button
                    onClick={() => onOpenWorkspaceHub('tasks')}
                    className="px-3.5 py-2 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    title="Open Google Tasks (Sync study tasks & todo items)"
                  >
                    <ListTodo className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Google Tasks</span>
                  </button>
                  <button
                    onClick={() => onOpenWorkspaceHub('calendar')}
                    className="px-3.5 py-2 rounded-full bg-theme-accent hover:opacity-90 text-primary border border-theme text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    title="Open Google Workspace Hub (Tasks, Calendar, Drive, Keep)"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                    <span>Workspace Hub</span>
                  </button>
                </>
              )}

              {/* Two-Way Google Calendar & Tasks Sync Hub */}
              <button
                onClick={() => setIsTwoWaySyncOpen(true)}
                className="px-3.5 py-2 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                title="Bidirectional Google Calendar & Tasks Sync (auto-blocks study sessions and pulls task completions)"
              >
                <RefreshCw className="w-3.5 h-3.5 text-emerald-700" />
                <span>2-Way Google Sync</span>
              </button>

              {/* Evening Study Wrap-Up & Retro Briefing */}
              <button
                onClick={() => setIsEveningRetroOpen(true)}
                className="px-3.5 py-2 rounded-full bg-primary hover:opacity-90 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                title="Evening Study Wrap-Up & Retro Briefing (End-of-day reflection, Gmail summary, and 1-click plan for tomorrow)"
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Evening Wrap-Up</span>
              </button>

              {onOpenEmailAgendaModal && (
                <button
                  onClick={onOpenEmailAgendaModal}
                  className="px-3.5 py-2 rounded-full bg-theme-accent hover:opacity-90 text-primary border border-theme text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  title="Automated Morning Briefing: Schedule daily Gmail delivery or dispatch actionable agenda with 1-click completion links"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Morning Briefing</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab('planner')}
                className="px-4 py-2 rounded-full bg-theme-accent hover:opacity-90 text-primary border border-theme text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Planner</span>
              </button>
            </div>
          </div>

          {/* Email Completed Work Alert Feedback */}
          {completedWorkEmailFeedback && (
            <div className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
              completedWorkEmailFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              <div className="flex items-center gap-2">
                {completedWorkEmailFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{completedWorkEmailFeedback.text}</span>
              </div>
              <button
                onClick={() => setCompletedWorkEmailFeedback(null)}
                className="text-current opacity-70 hover:opacity-100 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Animated Plan Progress Bar */}
          {todayPlan && todayPlan.topics.length > 0 && (
            <div className="space-y-1.5 pb-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-muted">
                <span>Daily Plan Progress</span>
                <span className="font-bold text-primary">{planCompletionPercent}% Completed</span>
              </div>
              <div className="w-full bg-theme-accent h-2 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${planCompletionPercent}%` }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                  className={`h-full rounded-full ${
                    planCompletionPercent === 100
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      : 'bg-primary'
                  }`}
                />
              </div>
            </div>
          )}

          {/* Daily Focus Schedule & Target Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 rounded-2xl bg-surface border border-theme">
            <div>
              <div className="text-[10px] font-mono text-muted uppercase font-bold">Planned Schedule</div>
              <div className="text-xs sm:text-sm font-mono font-bold text-primary mt-0.5">
                {plannedSessionsCount} Target Sessions
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono text-muted uppercase font-bold">Planned Duration</div>
              <div className="text-xs sm:text-sm font-mono font-bold text-primary mt-0.5">
                {totalPlannedMinutes} mins ({plannedHours} hrs)
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono text-muted uppercase font-bold">Daily Study Goal</div>
              <div className="text-xs sm:text-sm font-mono font-bold text-primary mt-0.5">
                {userProfile?.targetHoursPerDay || 3} hrs Target
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono text-muted uppercase font-bold">Completion Rate</div>
              <div className="text-xs sm:text-sm font-mono font-bold text-emerald-700 mt-0.5">
                {completedPlanTopics.length}/{plannedSessionsCount} Finished
              </div>
            </div>
          </div>

          {todayPlan && todayPlan.topics.length > 0 ? (
            <div className="space-y-4">
              {/* 1. ASSIGNED WORK TO DO */}
              {assignedPlanTopics.length > 0 ? (
                <div className="space-y-3">
                  <div className="sticky top-0 sm:top-2 z-10 bg-card/95 backdrop-blur-sm border border-theme/80 rounded-2xl p-2.5 shadow-xs flex items-center justify-between text-xs text-muted font-mono font-bold uppercase tracking-widest px-3">
                    <span className="flex items-center gap-1.5 text-primary">
                      <ListChecks className="w-3.5 h-3.5 text-primary" />
                      <span>Assigned Tasks To Do ({assignedPlanTopics.length})</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-normal text-muted lowercase">
                        {totalPlannedMinutes}m total
                      </span>
                      <span className="text-[10px] font-normal lowercase italic text-muted hidden sm:inline">
                        Tick ✓ to complete without timer
                      </span>
                    </div>
                  </div>

                  {assignedPlanTopics.map((t, idx) => (
                    <div 
                      key={t.id || idx}
                      className="bg-surface border border-theme rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-primary/50 transition group"
                    >
                      <div className="flex items-start gap-3">
                        {/* Quick Tick / Checkmark Box */}
                        <button
                          onClick={() => onTogglePlanTopic && onTogglePlanTopic(todayPlan.id, t.id, true)}
                          title="Tick to mark assigned work as completed (without timer)"
                          className="mt-0.5 w-7 h-7 rounded-xl border-2 border-theme group-hover:border-emerald-600 hover:bg-emerald-50 text-emerald-700 flex items-center justify-center transition shrink-0 shadow-2xs cursor-pointer"
                        >
                          <Check className="w-4 h-4 text-emerald-600 opacity-30 group-hover:opacity-100 transition-opacity" />
                        </button>

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-theme-accent text-primary flex items-center gap-1">
                              <span>{getSubjectEmoji(t.subjectName)}</span>
                              <span>{t.subjectName}</span>
                            </span>
                            <span className="text-xs font-mono text-muted">
                              {t.chapterName}
                            </span>
                            {t.priority === 'High' && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                                HIGH PRIORITY
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-primary">{t.topicName}</h4>
                          <p className="text-xs text-muted">{t.reason}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center pl-10 sm:pl-0 flex-wrap sm:flex-nowrap">
                        {/* Quick Duration Tuning (+15m / -15m) */}
                        <div className="flex items-center gap-1 bg-surface border border-theme rounded-full px-2 py-0.5 shadow-2xs">
                          {onAdjustPlanTopicDuration && (
                            <button
                              onClick={() => onAdjustPlanTopicDuration(todayPlan.id, t.id, -15)}
                              disabled={(t.estimatedMinutes || 45) <= 15}
                              className="text-[10px] font-bold text-muted hover:text-primary disabled:opacity-25 px-1 py-0.5 rounded hover:bg-theme-accent transition cursor-pointer"
                              title="Decrease scheduled duration by 15 mins"
                            >
                              -15m
                            </button>
                          )}
                          <span className="text-xs font-mono font-bold text-primary px-1">
                            ~{t.estimatedMinutes || 45}m
                          </span>
                          {onAdjustPlanTopicDuration && (
                            <button
                              onClick={() => onAdjustPlanTopicDuration(todayPlan.id, t.id, 15)}
                              disabled={(t.estimatedMinutes || 45) >= 240}
                              className="text-[10px] font-bold text-muted hover:text-primary disabled:opacity-25 px-1 py-0.5 rounded hover:bg-theme-accent transition cursor-pointer"
                              title="Increase scheduled duration by 15 mins"
                            >
                              +15m
                            </button>
                          )}
                        </div>

                        {/* Log Work & Add Details button */}
                        <button
                          onClick={() => setSelectedTaskForDetail({ planId: todayPlan.id, topic: t })}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-card hover:bg-theme-accent text-primary border border-theme font-medium text-xs transition shadow-2xs cursor-pointer"
                          title="Add details of what you did and set completion state (e.g. Needs Revision, Mastered)"
                        >
                          <FileText className="w-3 h-3 text-primary" />
                          <span>+ Details</span>
                        </button>
                        
                        {/* Quick Mark Done button */}
                        <button
                          onClick={() => onTogglePlanTopic && onTogglePlanTopic(todayPlan.id, t.id, true)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-card hover:bg-emerald-50 text-emerald-800 border border-emerald-300 font-medium text-xs transition shadow-2xs cursor-pointer"
                          title="Complete assigned task (quick tick)"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Done</span>
                        </button>

                        {/* Study Now timer button */}
                        <button
                          onClick={() => onStartTimerForTopic(t.subjectName, t.chapterName, t.topicName)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary hover:opacity-90 text-white font-medium text-xs transition shadow-xs cursor-pointer"
                          title="Start live stopwatch timer"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Timer</span>
                        </button>

                        {/* Quick Blurt Recall button */}
                        {onStartBlurtForTopic && (
                          <button
                            onClick={() => onStartBlurtForTopic(t.subjectName, t.chapterName, t.topicName)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-medium text-xs transition shadow-2xs cursor-pointer"
                            title="Start Blurt Recall active brain dump on this topic"
                          >
                            <Zap className="w-3 h-3 text-amber-600 fill-amber-600" />
                            <span>Blurt</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Celebration State when all assigned work is completed */
                <div className="space-y-4">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    className="p-5 rounded-3xl bg-gradient-to-br from-emerald-50 via-teal-50/60 to-emerald-100/40 border border-emerald-300 text-center space-y-2.5 shadow-xs relative overflow-hidden"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-1 shadow-2xs">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-base font-bold text-emerald-950 font-serif flex items-center justify-center gap-2">
                        <span>All Today's Assigned Tasks Are Completed!</span>
                        <PartyPopper className="w-4 h-4 text-emerald-700 inline animate-bounce" />
                      </h4>
                      <p className="text-xs text-emerald-800 max-w-md mx-auto">
                        Outstanding focus! You've checked off every planned topic for today. Completed items are archived below.
                      </p>
                    </div>

                    <div className="pt-1 flex items-center justify-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => triggerStudyGoalConfetti()}
                        className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Celebrate Victory 🎊</span>
                      </motion.button>
                    </div>
                  </motion.div>

                  {/* Suggest a new, small study goal based on current syllabus completion */}
                  <SyllabusGoalSuggester
                    subjects={subjects}
                    overallProgressPercent={overallProgressPercent}
                    totalTopics={totalTopics}
                    completedTopicsCount={completedTopicsCount}
                    weakTopicsList={weakTopicsList}
                    todayPlan={todayPlan}
                    onAdoptGoal={handleAdoptSuggestedGoal}
                    onStartTimerForTopic={onStartTimerForTopic}
                    setActiveTab={setActiveTab}
                  />
                </div>
              )}

              {/* 2. COMPLETED WORK TODAY (Cut off & moved here) */}
              {completedPlanTopics.length > 0 && (
                <div className="pt-3 border-t border-theme space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-primary font-mono font-bold uppercase tracking-widest px-1">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Completed Work Today ({completedPlanTopics.length})</span>
                    </span>
                    <span className="text-[11px] font-normal text-muted">
                      {completedPlanTopics.reduce((acc, t) => acc + (t.estimatedMinutes || 45), 0)} mins logged
                    </span>
                  </div>

                  <div className="space-y-2">
                    {completedPlanTopics.map((t, idx) => {
                      const isNeedsRev = t.completionStatus === 'Needs Revision';
                      const isMastered = t.completionStatus === 'Mastered';
                      const isPartial = t.completionStatus === 'Partially completed';

                      return (
                        <div 
                          key={t.id || `comp-${idx}`}
                          className="bg-surface border border-theme rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                              isNeedsRev 
                                ? 'bg-amber-100 text-amber-800' 
                                : isMastered 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : isPartial
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {isNeedsRev ? <RotateCcw className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                            </div>
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="line-through opacity-70 font-bold text-sm truncate text-primary">
                                  {t.topicName}
                                </span>
                                
                                {isNeedsRev && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                                    <RotateCcw className="w-2.5 h-2.5" />
                                    <span>Scheduled for Revision</span>
                                  </span>
                                )}
                                {isMastered && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                                    <span>⭐ Mastered (100%)</span>
                                  </span>
                                )}
                                {isPartial && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-900 border border-orange-300 flex items-center gap-1">
                                    <span>⏳ Partial Progress</span>
                                  </span>
                                )}
                                {!isNeedsRev && !isMastered && !isPartial && (
                                  <span className="text-[10px] font-medium px-2 py-0.2 rounded bg-emerald-100/70 text-emerald-800 shrink-0">
                                    Completed
                                  </span>
                                )}
                              </div>

                              <div className="text-[11px] text-muted flex items-center gap-1.5 truncate">
                                <span>{getSubjectEmoji(t.subjectName)} {t.subjectName}</span>
                                <span>•</span>
                                <span>{t.chapterName}</span>
                              </div>

                              {/* Details note if entered by the user */}
                              {t.completionDetails && (
                                <div className="mt-1 text-[11px] text-primary bg-card border-l-2 border-primary pl-2.5 py-1 rounded-r-lg font-medium italic">
                                  "{t.completionDetails}"
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                            {/* Edit Details & Status button */}
                            <button
                              onClick={() => setSelectedTaskForDetail({ planId: todayPlan.id, topic: t })}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card hover:bg-theme-accent text-primary border border-theme text-[11px] font-medium transition cursor-pointer shadow-2xs"
                              title="Edit what you did or change status"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit Details</span>
                            </button>

                            {/* Undo button to move back if needed */}
                            <button
                              onClick={() => onTogglePlanTopic && onTogglePlanTopic(todayPlan.id, t.id, false)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card hover:bg-theme-accent text-muted hover:text-primary border border-theme text-[11px] transition shrink-0 cursor-pointer shadow-2xs"
                              title="Restore to assigned tasks"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Undo</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Mini-component that uses current syllabus completion percentage to suggest a new, small study goal if no goals are currently active */}
              <SyllabusGoalSuggester
                subjects={subjects}
                overallProgressPercent={overallProgressPercent}
                totalTopics={totalTopics}
                completedTopicsCount={completedTopicsCount}
                weakTopicsList={weakTopicsList}
                todayPlan={todayPlan}
                onAdoptGoal={handleAdoptSuggestedGoal}
                onStartTimerForTopic={onStartTimerForTopic}
                setActiveTab={setActiveTab}
              />

              <div className="text-center py-5 bg-surface rounded-2xl border border-dashed border-theme flex flex-col sm:flex-row items-center justify-between gap-3 px-5">
                <div className="flex items-center gap-2.5 text-left">
                  <BookOpen className="w-4 h-4 text-muted shrink-0" />
                  <p className="text-xs text-muted">
                    Want a full customized multi-topic schedule built by AI for today?
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('planner')}
                  className="px-4 py-2 bg-primary hover:opacity-90 text-white rounded-full text-xs font-semibold transition shrink-0 cursor-pointer shadow-2xs"
                >
                  Open AI Planner
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Side Column: Today's Recent Study & Exam Countdown */}
        <div className="space-y-4">
          {/* Today / Recent Study Feed */}
          <div className="bg-card border border-theme rounded-3xl p-5 shadow-xs space-y-3 transition-colors">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span>Recent Study Log</span>
              </h3>
              <button
                onClick={() => setActiveTab('activity')}
                className="text-xs text-primary hover:underline font-semibold"
              >
                View All
              </button>
            </div>

            {sessions.length > 0 ? (
              <div className="space-y-2.5">
                {sessions.slice(0, 3).map((s) => (
                  <div key={s.id} className="p-3 rounded-2xl bg-surface border border-theme text-xs space-y-1">
                    <div className="flex items-center justify-between text-muted font-mono text-[11px]">
                      <span className="font-semibold text-primary flex items-center gap-1">
                        <span>{getSubjectEmoji(s.subjectName)}</span>
                        <span>{s.subjectName}</span>
                      </span>
                      <span>{s.date}</span>
                    </div>
                    <div className="font-semibold text-primary truncate">{s.topicName}</div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-primary font-mono font-medium">{s.durationMinutes} mins</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        s.result === 'Completed' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : s.result === 'Partially completed' 
                          ? 'bg-amber-100 text-amber-800' 
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {s.result}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted italic py-3 text-center">No study sessions recorded yet. Click "Start Studying" to begin!</p>
            )}
          </div>

          {/* Upcoming Exams Card */}
          <div className="bg-card border border-theme rounded-3xl p-5 shadow-xs space-y-3 transition-colors">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" />
              <span>Exam Targets</span>
            </h3>

            {upcomingExams.length > 0 ? (
              <div className="space-y-2">
                {upcomingExams.slice(0, 2).map((ex) => (
                  <div key={ex.id} className="flex items-center justify-between p-3 rounded-2xl bg-surface border border-theme text-xs">
                    <div>
                      <div className="font-semibold text-primary">{ex.examName}</div>
                      <div className="text-muted text-[11px] flex items-center gap-1">
                        <span>{getSubjectEmoji(ex.subjectName)}</span>
                        <span>{ex.subjectName}</span>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-primary font-bold">{ex.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted italic">No upcoming exams set. Add exam target dates in Settings.</p>
            )}
          </div>

          {/* Upcoming Assignments & Coursework Deadlines Card */}
          <div className="bg-card border border-theme rounded-3xl p-5 shadow-xs space-y-3 transition-colors">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Deadlines & Tasks</span>
              </h3>
              <button
                onClick={() => setActiveTab('assignments')}
                className="text-xs text-primary hover:underline font-semibold"
              >
                View All ({assignments.length})
              </button>
            </div>

            {(() => {
              const pendingAssignments = assignments.filter(a => a.status !== 'Completed' && a.status !== 'Submitted');
              const sortedPending = [...pendingAssignments].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

              if (sortedPending.length === 0) {
                return (
                  <div className="p-3 text-center rounded-2xl bg-surface border border-theme">
                    <p className="text-xs text-muted italic">All caught up! No pending deadlines.</p>
                    <button
                      onClick={() => setActiveTab('assignments')}
                      className="mt-2 text-xs font-bold text-primary hover:underline"
                    >
                      + Add an Assignment
                    </button>
                  </div>
                );
              }

              return (
                <div className="space-y-2">
                  {sortedPending.slice(0, 3).map(asg => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const isOverdue = asg.dueDate < todayStr;

                    return (
                      <div
                        key={asg.id}
                        onClick={() => setActiveTab('assignments')}
                        className={`p-3 rounded-2xl border text-xs transition cursor-pointer flex items-center justify-between gap-2.5 ${
                          isOverdue 
                            ? 'bg-rose-50/50 border-rose-200 hover:border-rose-300'
                            : 'bg-surface border-theme hover:border-primary/50'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-card border border-theme font-bold text-primary">
                              {asg.type}
                            </span>
                            <span className="font-semibold text-primary truncate">{asg.title}</span>
                          </div>
                          <div className="text-muted text-[10px] flex items-center gap-1 mt-0.5">
                            {asg.subjectName && <span>{asg.subjectName} • </span>}
                            <span>Est: {asg.estimatedMinutes}m</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex items-center gap-2">
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                            isOverdue
                              ? 'bg-rose-500 text-white'
                              : asg.priority === 'Urgent'
                              ? 'bg-amber-500 text-white'
                              : 'bg-theme-accent text-primary'
                          }`}>
                            {isOverdue ? 'Overdue' : asg.dueDate.slice(5)}
                          </span>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onStartTimerForAssignment) {
                                onStartTimerForAssignment(asg);
                              } else {
                                onStartTimerForTopic(asg.subjectName || 'General', asg.chapterName || 'Coursework', asg.title);
                              }
                            }}
                            className="p-1 rounded-lg bg-primary text-white hover:opacity-90"
                            title="Start study timer for this deadline"
                          >
                            <Play className="w-2.5 h-2.5 fill-white" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Subject Progress Breakdown: Clean visual progress bars for each subject */}
      <div className="bg-card border border-theme rounded-3xl p-6 shadow-xs space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-theme pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-theme-accent text-primary flex items-center justify-center font-bold">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-theme-accent text-primary border border-theme uppercase tracking-widest font-sans">
                  FBISE TRACK
                </span>
                <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Subject Progress Breakdown</h3>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Visual progress bars across {subjects.length} FBISE subjects ({completedTopicsCount}/{totalTopics} topics completed)
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('syllabus')}
            className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 self-start sm:self-auto cursor-pointer"
          >
            <span>Open Syllabus & Topics</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {subjects.map((sub, idx) => {
            let subTopics = 0;
            let subDone = 0;
            sub.chapters.forEach(ch => {
              ch.topics.forEach(t => {
                subTopics++;
                if (t.status === 'Completed' || t.status === 'Mastered') subDone++;
              });
            });
            const pct = subTopics > 0 ? Math.round((subDone / subTopics) * 100) : 0;

            return (
              <button
                key={sub.id}
                onClick={() => setActiveTab('syllabus')}
                className="p-3.5 rounded-2xl bg-surface border border-theme hover:border-primary hover:bg-theme-accent transition flex flex-col items-center text-center space-y-2.5 group shadow-2xs cursor-pointer"
                title={`Open ${sub.name} in Syllabus`}
              >
                <div className="w-11 h-11 rounded-2xl bg-card border border-theme flex items-center justify-center text-2xl shadow-2xs group-hover:scale-110 transition-transform">
                  {sub.icon || '📚'}
                </div>
                <div className="w-full">
                  <div className="text-xs font-bold text-primary truncate group-hover:text-primary transition-colors">
                    {sub.name}
                  </div>
                  <div className="text-[10px] text-muted font-mono mt-0.5">
                    {pct}% • {subDone}/{subTopics}
                  </div>
                </div>
                <div className="w-full bg-theme-accent h-1.5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, delay: idx * 0.04, ease: 'easeOut' }}
                    className="bg-primary h-full rounded-full"
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Feynman Concept Analyzer: Directly accessible on the dashboard for instant concept checks */}
      <FeynmanConceptAnalyzer
        subjects={subjects}
        userProfile={userProfile}
        onLogActivity={handleLogFeynmanActivity}
        onStartTimerForTopic={onStartTimerForTopic}
        onOpenBlurtForTopic={onStartBlurtForTopic}
      />

      {/* Today's Interlinked Action Agenda & Daily Reminders (Lowered): Positioned cleanly below the academic profile and today's focus plan, keeping the top of the dashboard focused and uncluttered */}
      <div className="space-y-6 pt-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
          <h3 className="text-xs font-bold uppercase tracking-widest text-primary font-mono">
            Today's Interlinked Action Agenda & Daily Reminders
          </h3>
        </div>

        {/* SMART ACADEMIC PRIORITY SYSTEM */}
        <SmartPriorityCard
          assignments={assignments}
          missedWork={missedWork}
          plans={plans}
          userProfile={userProfile}
          scheduledTasks={userProfile?.weeklySchedule?.scheduledTasks || []}
          revisions={revisions}
          setActiveTab={setActiveTab}
          onStartTimerForTopic={onStartTimerForTopic}
          onToggleAssignmentComplete={onStartTimerForAssignment}
          onSaveSubtasks={async (targetId, updatedSubtasks) => {
            const targetAsg = assignments.find(a => a.id === targetId);
            if (targetAsg && onSaveAssignment) {
              await onSaveAssignment({
                ...targetAsg,
                subtasks: updatedSubtasks,
                hasPrepPlan: updatedSubtasks.length > 0,
                updatedAt: new Date().toISOString()
              });
            }
          }}
          onSavePlan={onSavePlan}
        />

        {/* DAILY REMINDERS: Classes, Tests, Deadlines, Missed Data, and Scheduled Freedom Tasks */}
        <DailyRemindersCard
          plans={plans}
          assignments={assignments}
          testResults={testResults}
          userProfile={userProfile}
          scheduledTasks={userProfile?.weeklySchedule?.scheduledTasks || []}
          missedWork={missedWork}
          onStartTimerForTopic={onStartTimerForTopic}
          onToggleTopicComplete={(planId, topicId, currentVal) => {
            if (onTogglePlanTopic) {
              onTogglePlanTopic(planId, topicId, !currentVal);
            }
          }}
          onToggleAssignmentComplete={(assignment) => {
            if (onStartTimerForAssignment) {
              onStartTimerForAssignment(assignment);
            }
          }}
          onNavigateTab={setActiveTab}
        />
      </div>

      {/* DAILY GOAL TRACKER */}
      <DailyGoalTracker
        sessions={sessions}
        userProfile={userProfile}
        onUpdateTargetHours={handleUpdateTargetHours}
        setActiveTab={setActiveTab}
        onStartTimer={() => setActiveTab('timer')}
      />

      {/* MOST URGENT STUDY PRIORITY FOR TODAY */}
      <UrgentStudyPriorityCard
        plans={plans}
        subjects={subjects}
        revisions={revisions}
        userProfile={userProfile}
        sessions={sessions}
        setActiveTab={setActiveTab}
        onStartTimerForTopic={onStartTimerForTopic}
        onMarkTopicComplete={onTogglePlanTopic}
      />

      {/* Metrics Row: Today's Live Study & Academic Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Today's Study Time */}
        <motion.div 
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          whileHover={{ y: -2 }}
          className={`bg-card border rounded-3xl p-5 shadow-xs transition-colors duration-500 cursor-default ${
            isDailyGoalAchieved ? 'border-emerald-300 ring-2 ring-emerald-500/10' : 'border-theme hover:border-primary/50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-muted font-bold uppercase tracking-widest">Today's Study</span>
            <div className="flex items-center gap-1.5">
              {isDailyGoalAchieved && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerStudyGoalConfetti();
                  }}
                  className="px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] font-bold flex items-center gap-1 shadow-2xs hover:bg-emerald-200 transition cursor-pointer"
                  title="Click to celebrate!"
                >
                  <PartyPopper className="w-3 h-3 text-emerald-600 animate-bounce" />
                  <span>Goal Met 🎊</span>
                </motion.button>
              )}
              <div className={`p-2 rounded-xl transition-colors ${
                isDailyGoalAchieved ? 'bg-emerald-100 text-emerald-700' : 'bg-theme-accent text-primary'
              }`}>
                <Zap className="w-4 h-4" />
              </div>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-serif italic ${isDailyGoalAchieved ? 'text-emerald-700 font-bold' : 'text-primary'}`}>
              {hoursToday}
            </span>
            <span className="text-xs text-muted">hours ({totalMinutesToday} mins)</span>
          </div>
          <div className="w-full bg-theme-accent h-2 rounded-full mt-3 overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${studyGoalProgressPercent}%` }}
              transition={{ duration: 1.1, ease: 'easeOut' }}
              className={`h-full rounded-full ${
                isDailyGoalAchieved
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : 'bg-primary'
              }`}
            />
          </div>
        </motion.div>

        {/* Syllabus Progress */}
        <motion.div 
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          whileHover={{ y: -2 }}
          onClick={() => setIsQuickCoverageModalOpen(true)}
          className="bg-card border border-theme rounded-3xl p-5 shadow-xs hover:border-primary transition cursor-pointer group"
          title="Click to open Syllabus Coverage Manager"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-muted font-bold uppercase tracking-widest">Syllabus Coverage</span>
            <div className="p-2 rounded-xl bg-theme-accent text-primary group-hover:bg-primary group-hover:text-white transition">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-serif italic text-primary">{overallProgressPercent}%</span>
              <span className="text-xs text-muted">({completedTopicsCount}/{totalTopics})</span>
            </div>
            <span className="text-[11px] font-bold text-primary flex items-center gap-0.5 group-hover:underline">
              Update <ArrowRight className="w-3 h-3" />
            </span>
          </div>
          <div className="w-full bg-theme-accent h-2 rounded-full mt-3 overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${overallProgressPercent}%` }}
              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.1 }}
              className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 h-full rounded-full"
            />
          </div>
        </motion.div>

        {/* Weak Topics Alert */}
        <motion.div 
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          whileHover={{ y: -2 }}
          className="bg-card border border-theme rounded-3xl p-5 shadow-xs hover:border-primary/50 transition cursor-default"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-muted font-bold uppercase tracking-widest">Weak / Struggling</span>
            <div className="p-2 rounded-xl bg-theme-accent text-amber-700">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-serif italic text-amber-800">{weakTopicsList.length}</span>
            <span className="text-xs text-muted">require revision</span>
          </div>
          <button 
            onClick={() => setActiveTab('revision')} 
            className="text-xs text-primary hover:underline font-semibold mt-2 inline-flex items-center gap-1 cursor-pointer"
          >
            Review Weak Areas <ArrowRight className="w-3 h-3" />
          </button>
        </motion.div>

        {/* Pending Revisions */}
        <motion.div 
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
          whileHover={{ y: -2 }}
          className="bg-card border border-theme rounded-3xl p-5 shadow-xs hover:border-primary/50 transition cursor-default"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-muted font-bold uppercase tracking-widest">Scheduled Revisions</span>
            <div className="p-2 rounded-xl bg-theme-accent text-primary">
              <BookMarked className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-serif italic text-primary">{pendingRevisions.length}</span>
            <span className="text-xs text-muted">topics queued</span>
          </div>
          <button 
            onClick={() => setActiveTab('revision')} 
            className="text-xs text-primary hover:underline font-semibold mt-2 inline-flex items-center gap-1 cursor-pointer"
          >
            Open Revision Queue <ArrowRight className="w-3 h-3" />
          </button>
        </motion.div>
      </div>

      {/* Daily Academic Motivation Widget */}
      <MotivationWidget />

      {/* Spot the Blunder & Examiner's Red Pen Banner (Options 1, 2, 4) */}
      <div className="bg-gradient-to-r from-rose-500/10 via-amber-500/5 to-surface border border-rose-500/30 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold shrink-0 shadow-2xs">
            <PenTool className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-widest text-primary font-sans">
                The Examiner’s Red Pen & Spot the Blunder
              </h4>
              <span className="text-[9px] font-bold px-2 py-0.2 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                Option 2 • Mark Scheme Deconstructor
              </span>
              <span className="text-[9px] font-bold px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                Option 1 • Past Paper Trends
              </span>
            </div>
            <p className="text-xs text-secondary mt-1 max-w-2xl leading-relaxed">
              Step into the shoes of the Chief Examiner. Spot fatal candidate traps in student answers, deconstruct step-by-step <code>[M1, A1, B1]</code> marks, and log recurring board traps straight to your Mistake Vault.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('examiner_red_pen')}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Spot the Blunder Game</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Blurt Recall Active Brain-Dump Arena Card */}
      <div className="bg-gradient-to-r from-amber-50/80 via-orange-50/30 to-white border border-amber-200/80 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-700 flex items-center justify-center font-bold shrink-0">
            <Zap className="w-5 h-5 text-amber-600 fill-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-widest text-amber-950 font-sans">
                Blurt Recall Arena (Active Brain-Dump Retrieval)
              </h4>
              <span className="text-[9px] font-bold px-2 py-0.2 rounded-full bg-amber-200/70 text-amber-900 border border-amber-300">
                Cognitive Science
              </span>
              {activityLogs && activityLogs.filter(l => l.action === 'Blurt Recall').length > 0 && (
                <span className="text-[10px] font-mono font-bold text-amber-800 bg-white/80 px-2 py-0.5 rounded-full border border-amber-200">
                  {activityLogs.filter(l => l.action === 'Blurt Recall').length} Evaluated
                </span>
              )}
            </div>
            <p className="text-xs text-[#4A4E4D]/80 mt-0.5 max-w-2xl">
              Type out everything you know from memory without notes. Gemini compares your recall against syllabus notes, highlights specific knowledge gaps, and saves your performance metric to activity logs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('blurt_recall')}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-full text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 fill-white" />
            <span>Open Blurt Arena</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Active Recall & Flashcard Deck Arena Banner */}
      <div className="bg-gradient-to-r from-amber-50/60 via-card to-surface border border-theme rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-theme-accent text-primary flex items-center justify-center font-bold shrink-0">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-widest text-primary">
                Active Recall & Flashcard Arena (SM-2 Spaced Repetition)
              </h4>
              <span className="text-[9px] font-bold px-2 py-0.2 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                High-Yield
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Reinforce long-term retention with 3D interactive flashcards, AI deck generation for weak topics, and audio pronunciation.
            </p>
          </div>
        </div>

        <button
          onClick={() => setActiveTab('flashcards')}
          className="px-4 py-2 bg-primary hover:opacity-90 text-white rounded-full text-xs font-medium transition flex items-center gap-1.5 shadow-xs shrink-0 self-start sm:self-auto cursor-pointer"
        >
          <span>Open Flashcard Arena</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Study Groups & Collaborative Milestones Banner */}
      <div className="bg-card border border-theme rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-theme-accent text-primary flex items-center justify-center font-bold shrink-0">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-widest text-primary">
                Collaborative Study Groups & AI Facilitator
              </h4>
              <span className="text-[9px] font-bold px-2 py-0.2 rounded-full bg-theme-accent text-primary border border-theme">
                New
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Study together with classmates, share syllabus progress, track combined goals, and get AI-suggested joint review topics!
            </p>
          </div>
        </div>

        <button
          onClick={() => setActiveTab('groups')}
          className="px-4 py-2 bg-primary hover:opacity-90 text-white rounded-full text-xs font-medium transition flex items-center gap-1.5 shadow-xs shrink-0 self-start sm:self-auto cursor-pointer"
        >
          <span>Open Study Circles</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Academic Year Profile & Timeline Hub */}
      <YearProfileCard
        userProfile={userProfile}
        subjects={subjects}
        onUpdateProfile={onUpdateProfile || (() => {})}
        onNavigateTab={setActiveTab}
      />

      {/* OPTION 11: STUDY HABIT HEATMAP CARD */}
      <StudyHabitHeatmapCard
        sessions={sessions}
        testResults={testResults}
      />

      {/* OPTION 4: RETENTION ANALYTICS & VISUAL FORGETTING CURVE (30-DAY FORECAST) */}
      <RetentionForgettingCurveCard
        subjects={subjects}
        revisions={revisions}
        sessions={sessions}
        onStartRevision={(subjectName, chapterName, topicName) => {
          onStartTimerForTopic(subjectName, chapterName, topicName);
        }}
      />

      {/* Weekly Study Summary Bar Chart Section */}
      <WeeklySummaryCard
        subjects={subjects}
        sessions={sessions}
        activityLogs={activityLogs}
        setActiveTab={setActiveTab}
      />

      {/* Weekly Schedule Manager & Deadline Workload Divider */}
      <WeeklyScheduleManager
        subjects={subjects}
        sessions={sessions}
        userProfile={userProfile}
        setActiveTab={setActiveTab}
        onStartTimerForTopic={onStartTimerForTopic}
      />

      {/* Multi-Week & Monthly Data Uploader Box */}
      <BulkScheduleUploader
        subjects={subjects}
        userProfile={userProfile}
        existingPlans={plans}
        onSavePlan={handleSavePlanWrapper}
        setActiveTab={setActiveTab}
      />

      {/* Digital Badges & Study Milestones Component */}
      <BadgesComponent
        sessions={sessions}
        subjects={subjects}
        testResults={testResults}
        revisions={revisions}
        activityLogs={activityLogs}
        userProfile={userProfile}
        setActiveTab={setActiveTab}
      />

      {/* Task Completion Detail & State Modal */}
      {selectedTaskForDetail && (
        <TaskDetailModal
          isOpen={Boolean(selectedTaskForDetail)}
          onClose={() => setSelectedTaskForDetail(null)}
          planId={selectedTaskForDetail.planId}
          topic={selectedTaskForDetail.topic}
          onSaveCompletionDetails={(planId, topicId, details) => {
            if (onTogglePlanTopic) {
              onTogglePlanTopic(planId, topicId, true, details);
            }
          }}
        />
      )}

      {/* Evening Study Wrap-Up & Retro Briefing Modal */}
      <EveningRetroModal
        isOpen={isEveningRetroOpen}
        onClose={() => setIsEveningRetroOpen(false)}
        todaySessions={todaySessions}
        todayPlan={todayPlan}
        subjects={subjects}
        revisions={revisions}
        userProfile={userProfile}
        testResults={testResults}
        onSavePlan={handleSavePlanWrapper}
        setActiveTab={setActiveTab}
      />

      {/* Two-Way Google Calendar & Google Tasks Sync Modal */}
      <TwoWaySyncModal
        isOpen={isTwoWaySyncOpen}
        onClose={() => setIsTwoWaySyncOpen(false)}
        plans={plans}
        sessions={sessions}
        revisions={revisions}
        examDates={userProfile?.examDates || []}
        onToggleTopicCompletion={(planDate, topicName, completed) => {
          const plan = plans.find(p => p.date === planDate);
          if (plan && onTogglePlanTopic) {
            const topic = plan.topics.find(t => (t.topicName || '').toLowerCase() === (topicName || '').toLowerCase());
            if (topic) {
              onTogglePlanTopic(plan.id, topic.id, completed);
            }
          }
        }}
        setActiveTab={setActiveTab}
      />

      {/* Edit Academic Year & Exam Profile Modal */}
      <EditYearProfileModal
        isOpen={isEditProfileModalOpen}
        onClose={() => setIsEditProfileModalOpen(false)}
        userProfile={userProfile}
        onUpdateProfile={(updates) => {
          if (onUpdateProfile) {
            onUpdateProfile(updates);
          }
        }}
      />

      {/* Quick Syllabus Coverage & Mastery Manager Modal */}
      <QuickSyllabusCoverageModal
        isOpen={isQuickCoverageModalOpen}
        onClose={() => setIsQuickCoverageModalOpen(false)}
        subjects={subjects}
        onUpdateTopicStatus={onUpdateTopicStatus}
        onStartTimerForTopic={onStartTimerForTopic}
        setActiveTab={setActiveTab}
        onAddTestResult={onAddTestResult}
      />
    </div>
  );
};
