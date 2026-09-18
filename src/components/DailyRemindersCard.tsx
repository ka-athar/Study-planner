import React, { useState, useMemo } from 'react';
import { 
  Bell, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Play, 
  BookOpen, 
  FileText, 
  GraduationCap, 
  Sparkles, 
  ChevronRight, 
  ChevronDown, 
  Flame, 
  ShieldAlert,
  Check
} from 'lucide-react';
import { 
  StudyPlan, 
  Assignment, 
  TestResult, 
  UserProfile, 
  ScheduledStudyTask, 
  MissedWorkItem,
  ActiveTab
} from '../types';
import { 
  evaluateSmartPriority, 
  PRIORITY_CONFIG, 
  SmartPriorityLevel,
  SmartPriorityColor 
} from '../lib/smartPriorityEngine';

interface DailyRemindersCardProps {
  plans: StudyPlan[];
  assignments: Assignment[];
  testResults: TestResult[];
  userProfile: UserProfile | null;
  scheduledTasks?: ScheduledStudyTask[];
  missedWork?: MissedWorkItem[];
  onStartTimerForTopic?: (subjectName: string, chapterName: string, topicName: string) => void;
  onToggleTopicComplete?: (planId: string, topicId: string, currentVal: boolean) => void;
  onToggleAssignmentComplete?: (assignment: Assignment) => void;
  onNavigateTab: (tab: ActiveTab) => void;
}

type ReminderCategory = 'all' | 'classes' | 'tests' | 'deadlines' | 'tasks';
type TabView = 'today' | 'upcoming';

export const DailyRemindersCard: React.FC<DailyRemindersCardProps> = ({
  plans = [],
  assignments = [],
  testResults = [],
  userProfile,
  scheduledTasks = [],
  missedWork = [],
  onStartTimerForTopic,
  onToggleTopicComplete,
  onToggleAssignmentComplete,
  onNavigateTab
}) => {
  const [activeView, setActiveView] = useState<TabView>('today');
  const [activeCategory, setActiveCategory] = useState<ReminderCategory>('all');
  const [onlyUrgent, setOnlyUrgent] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  // Compute Today's Items with Smart Priorities
  const todayItems = useMemo(() => {
    const items: Array<{
      id: string;
      category: 'classes' | 'tests' | 'deadlines' | 'tasks';
      title: string;
      subject: string;
      timeOrDuration: string;
      isCompleted: boolean;
      priorityLevel: SmartPriorityLevel;
      priorityBadge: '🔴 Urgent' | '🟠 High' | '🟡 Normal' | '🟢 Low';
      priorityColor: SmartPriorityColor;
      reasons: string[];
      score: number;
      rawItem: any;
      actionType: 'timer' | 'navigate' | 'toggle';
    }> = [];

    // 1. Today's Study Plan Tasks
    const todayPlan = plans.find(p => p.date === todayStr);
    if (todayPlan) {
      todayPlan.topics.forEach((topic, idx) => {
        const isDone = !!topic.completed;
        const evalRes = evaluateSmartPriority({
          dueDate: todayStr,
          isMissed: false,
          type: 'Assignment',
          userPriority: topic.priority === 'High' ? 'High' : 'Medium',
          title: topic.topicName,
          isCompleted: isDone
        });

        items.push({
          id: `plan-topic-${todayPlan.id}-${topic.id || idx}`,
          category: 'tasks',
          title: topic.topicName,
          subject: todayPlan.title || topic.subjectName,
          timeOrDuration: `${topic.estimatedMinutes || 45} mins`,
          isCompleted: isDone,
          priorityLevel: evalRes.priorityLevel,
          priorityBadge: evalRes.priorityBadge,
          priorityColor: PRIORITY_CONFIG[evalRes.priorityLevel].colors,
          reasons: evalRes.reasons,
          score: evalRes.score,
          rawItem: { planId: todayPlan.id, topicId: topic.id || `${idx}`, topic },
          actionType: 'timer'
        });
      });
    }

    // 2. Today's Scheduled Tasks
    scheduledTasks.forEach(task => {
      if (task.date === todayStr) {
        const isDone = !!task.completed;
        const evalRes = evaluateSmartPriority({
          dueDate: todayStr,
          isMissed: false,
          type: 'Assignment',
          userPriority: task.priority === 'High' ? 'High' : 'Medium',
          title: task.title,
          isCompleted: isDone
        });

        items.push({
          id: `sched-task-${task.id}`,
          category: 'tasks',
          title: task.title || 'Scheduled Study Session',
          subject: task.subjectName,
          timeOrDuration: task.timeslot ? `${task.timeslot} • ${task.durationMinutes || 45}m` : `${task.durationMinutes || 45}m`,
          isCompleted: isDone,
          priorityLevel: evalRes.priorityLevel,
          priorityBadge: evalRes.priorityBadge,
          priorityColor: PRIORITY_CONFIG[evalRes.priorityLevel].colors,
          reasons: evalRes.reasons,
          score: evalRes.score,
          rawItem: task,
          actionType: 'timer'
        });
      }
    });

    // 3. Preparation Timeline Subtasks Scheduled for Today
    assignments.forEach(asg => {
      if (asg.subtasks && asg.subtasks.length > 0) {
        asg.subtasks.forEach(st => {
          if (st.scheduledDate === todayStr) {
            const isDone = !!st.completed;
            const evalRes = evaluateSmartPriority({
              dueDate: asg.dueDate,
              isMissed: false,
              type: asg.type,
              userPriority: asg.priority,
              title: st.title,
              isCompleted: isDone
            });

            items.push({
              id: `prep-sub-${asg.id}-${st.id}`,
              category: 'tasks',
              title: `${st.title} (${asg.title})`,
              subject: asg.subjectName || 'Exam Preparation',
              timeOrDuration: `${st.timeslot || 'afternoon'} • ${st.estimatedMinutes || 30}m`,
              isCompleted: isDone,
              priorityLevel: evalRes.priorityLevel,
              priorityBadge: evalRes.priorityBadge,
              priorityColor: PRIORITY_CONFIG[evalRes.priorityLevel].colors,
              reasons: [`Prep Stage for ${asg.dueDate}`, ...evalRes.reasons],
              score: evalRes.score + 5,
              rawItem: { asg, subtask: st },
              actionType: 'timer'
            });
          }
        });
      }
    });

    // 4. Today's Deadlines (Assignments & Tests)
    assignments.forEach(asg => {
      if (asg.dueDate === todayStr) {
        const isDone = asg.status === 'Completed' || asg.status === 'Submitted';
        const evalRes = evaluateSmartPriority({
          dueDate: todayStr,
          isMissed: false,
          type: asg.type,
          userPriority: asg.priority,
          subtasks: asg.subtasks || [],
          title: asg.title,
          isCompleted: isDone
        });

        items.push({
          id: `asg-due-${asg.id}`,
          category: asg.type === 'Test' || asg.type === 'Quiz' ? 'tests' : 'deadlines',
          title: asg.title,
          subject: asg.subjectName || 'Academic',
          timeOrDuration: `Due Today • ${asg.estimatedMinutes || 45}m`,
          isCompleted: isDone,
          priorityLevel: evalRes.priorityLevel,
          priorityBadge: evalRes.priorityBadge,
          priorityColor: PRIORITY_CONFIG[evalRes.priorityLevel].colors,
          reasons: evalRes.reasons,
          score: evalRes.score,
          rawItem: asg,
          actionType: 'toggle'
        });
      }
    });

    // 5. Today's Exam Dates
    if (userProfile?.examDates) {
      userProfile.examDates.forEach(exam => {
        if (exam.date === todayStr) {
          const evalRes = evaluateSmartPriority({
            dueDate: todayStr,
            isMissed: false,
            type: 'Exam',
            userPriority: 'Urgent',
            title: exam.examName,
            isCompleted: false
          });

          items.push({
            id: `exam-${exam.id || exam.subjectName}`,
            category: 'tests',
            title: `${exam.subjectName} Official Exam`,
            subject: exam.subjectName,
            timeOrDuration: 'Test Day',
            isCompleted: false,
            priorityLevel: 'urgent',
            priorityBadge: '🔴 Urgent',
            priorityColor: PRIORITY_CONFIG.urgent.colors,
            reasons: ['Official Exam Day', 'High Importance'],
            score: 95,
            rawItem: exam,
            actionType: 'navigate'
          });
        }
      });
    }

    // 6. Overdue / Missed Work Items needing immediate attention
    missedWork.forEach(mw => {
      if (mw.status === 'Missed' || mw.status === 'Pending') {
        items.push({
          id: `mw-item-${mw.id}`,
          category: mw.type === 'test' ? 'tests' : 'deadlines',
          title: `[Missed] ${mw.title}`,
          subject: mw.subjectName,
          timeOrDuration: `Overdue from ${mw.originalDeadline}`,
          isCompleted: false,
          priorityLevel: 'urgent',
          priorityBadge: '🔴 Urgent',
          priorityColor: PRIORITY_CONFIG.urgent.colors,
          reasons: ['Missed Work', 'Overdue Task'],
          score: 90,
          rawItem: mw,
          actionType: 'navigate'
        });
      }
    });

    // 7. Today's Classes
    const todayDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    if (userProfile?.weeklyAvailability && (userProfile.weeklyAvailability as any)[todayDayName]) {
      const daySlots = (userProfile.weeklyAvailability as any)[todayDayName];
      if (Array.isArray(daySlots) && daySlots.length > 0) {
        items.push({
          id: `class-day-${todayDayName}`,
          category: 'classes',
          title: `${todayDayName} Academic Classes & Study Availability`,
          subject: 'Academic Schedule',
          timeOrDuration: daySlots.join(', '),
          isCompleted: false,
          priorityLevel: 'normal',
          priorityBadge: '🟡 Normal',
          priorityColor: PRIORITY_CONFIG.normal.colors,
          reasons: ['Regular Daily Schedule'],
          score: 25,
          rawItem: daySlots,
          actionType: 'navigate'
        });
      }
    }

    // Deduplicate daily items strictly by unique ID
    const seenIds = new Set<string>();
    const uniqueItems: typeof items = [];
    for (const item of items) {
      if (item && item.id && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        uniqueItems.push(item);
      }
    }

    // Sort items so:
    // 1. Uncompleted comes first
    // 2. 🔴 Urgent > 🟠 High > 🟡 Normal > 🟢 Low
    // 3. Score descending
    const tierWeight: Record<SmartPriorityLevel, number> = {
      urgent: 4,
      high: 3,
      normal: 2,
      low: 1
    };

    return uniqueItems.sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) {
        return a.isCompleted ? 1 : -1;
      }
      const weightDiff = tierWeight[b.priorityLevel] - tierWeight[a.priorityLevel];
      if (weightDiff !== 0) return weightDiff;
      return b.score - a.score;
    });
  }, [plans, assignments, scheduledTasks, missedWork, userProfile, todayStr]);

  // Compute Upcoming Items with Smart Priorities
  const upcomingItems = useMemo(() => {
    const items: Array<{
      id: string;
      category: 'classes' | 'tests' | 'deadlines' | 'tasks';
      title: string;
      subject: string;
      date: string;
      relativeLabel: string;
      priorityLevel: SmartPriorityLevel;
      priorityBadge: '🔴 Urgent' | '🟠 High' | '🟡 Normal' | '🟢 Low';
      priorityColor: SmartPriorityColor;
      reasons: string[];
      score: number;
      rawItem: any;
    }> = [];

    const now = new Date();

    // 1. Upcoming Deadlines & Tests in next 7 days
    assignments.forEach(asg => {
      if (asg.dueDate && asg.dueDate > todayStr) {
        const asgDate = new Date(asg.dueDate);
        const diffDays = Math.ceil((asgDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
        if (diffDays <= 7) {
          const isDone = asg.status === 'Completed' || asg.status === 'Submitted';
          if (!isDone) {
            const evalRes = evaluateSmartPriority({
              dueDate: asg.dueDate,
              isMissed: false,
              type: asg.type,
              userPriority: asg.priority,
              subtasks: asg.subtasks || [],
              title: asg.title,
              isCompleted: false
            });

            items.push({
              id: `up-asg-${asg.id}`,
              category: asg.type === 'Test' || asg.type === 'Quiz' ? 'tests' : 'deadlines',
              title: asg.title,
              subject: asg.subjectName || 'Academic',
              date: asg.dueDate,
              relativeLabel: asg.dueDate === tomorrowStr ? 'Tomorrow' : `In ${diffDays} days`,
              priorityLevel: evalRes.priorityLevel,
              priorityBadge: evalRes.priorityBadge,
              priorityColor: PRIORITY_CONFIG[evalRes.priorityLevel].colors,
              reasons: evalRes.reasons,
              score: evalRes.score,
              rawItem: asg
            });
          }
        }
      }
    });

    // 2. Upcoming Exams in User Profile
    if (userProfile?.examDates) {
      userProfile.examDates.forEach(exam => {
        if (exam.date && exam.date > todayStr) {
          const examDate = new Date(exam.date);
          const diffDays = Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
          if (diffDays <= 14) {
            const evalRes = evaluateSmartPriority({
              dueDate: exam.date,
              isMissed: false,
              type: 'Exam',
              userPriority: 'Urgent',
              title: exam.examName,
              isCompleted: false
            });

            items.push({
              id: `up-exam-${exam.id || exam.subjectName}`,
              category: 'tests',
              title: `${exam.subjectName} Exam (${exam.examName || 'Official Test'})`,
              subject: exam.subjectName,
              date: exam.date,
              relativeLabel: exam.date === tomorrowStr ? 'Tomorrow' : `In ${diffDays} days`,
              priorityLevel: evalRes.priorityLevel,
              priorityBadge: evalRes.priorityBadge,
              priorityColor: PRIORITY_CONFIG[evalRes.priorityLevel].colors,
              reasons: evalRes.reasons,
              score: evalRes.score + 10,
              rawItem: exam
            });
          }
        }
      });
    }

    // 3. Upcoming Plans in next 3 days
    plans.forEach(plan => {
      if (plan.date && plan.date > todayStr) {
        const planDate = new Date(plan.date);
        const diffDays = Math.ceil((planDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
        if (diffDays <= 3) {
          const uncompleted = plan.topics.filter(t => !t.completed);
          if (uncompleted.length > 0) {
            items.push({
              id: `up-plan-${plan.id}`,
              category: 'tasks',
              title: `${uncompleted.length} Planned Topics in ${plan.title || 'Daily Focus'}`,
              subject: plan.title || 'Study Plan',
              date: plan.date,
              relativeLabel: plan.date === tomorrowStr ? 'Tomorrow' : `In ${diffDays} days`,
              priorityLevel: diffDays === 1 ? 'high' : 'normal',
              priorityBadge: diffDays === 1 ? '🟠 High' : '🟡 Normal',
              priorityColor: PRIORITY_CONFIG[diffDays === 1 ? 'high' : 'normal'].colors,
              reasons: [`Scheduled Study Plan for ${plan.date}`],
              score: diffDays === 1 ? 50 : 30,
              rawItem: plan
            });
          }
        }
      }
    });

    // Deduplicate upcoming items strictly by unique ID
    const seenUpcomingIds = new Set<string>();
    const uniqueUpcoming: typeof items = [];
    for (const item of items) {
      if (item && item.id && !seenUpcomingIds.has(item.id)) {
        seenUpcomingIds.add(item.id);
        uniqueUpcoming.push(item);
      }
    }

    // Sort by priority first, then date ascending
    const tierWeight: Record<SmartPriorityLevel, number> = {
      urgent: 4,
      high: 3,
      normal: 2,
      low: 1
    };

    return uniqueUpcoming.sort((a, b) => {
      const weightDiff = tierWeight[b.priorityLevel] - tierWeight[a.priorityLevel];
      if (weightDiff !== 0) return weightDiff;
      return a.date.localeCompare(b.date);
    });
  }, [assignments, userProfile, plans, todayStr, tomorrowStr]);

  // Active missed work count
  const activeMissedCount = useMemo(() => {
    return missedWork.filter(m => m.status === 'Missed' || m.status === 'Pending').length;
  }, [missedWork]);

  // Filter items by category
  const filteredTodayItems = useMemo(() => {
    if (activeCategory === 'all') return todayItems;
    return todayItems.filter(item => item.category === activeCategory);
  }, [todayItems, activeCategory]);

  const filteredUpcomingItems = useMemo(() => {
    if (activeCategory === 'all') return upcomingItems;
    return upcomingItems.filter(item => item.category === activeCategory);
  }, [upcomingItems, activeCategory]);

  const completedTodayCount = todayItems.filter(i => i.isCompleted).length;
  const totalTodayCount = todayItems.length;
  const progressPercent = totalTodayCount > 0 ? Math.round((completedTodayCount / totalTodayCount) * 100) : 100;

  return (
    <div className="bg-card border border-theme rounded-2xl p-4 sm:p-5 shadow-sm transition-all mb-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-theme/60">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Bell className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-primary flex items-center gap-2">
                Daily Freedom Reminders & Missed Data
              </h2>
              {totalTodayCount > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-theme-accent text-primary border border-theme">
                  {completedTodayCount}/{totalTodayCount} Done ({progressPercent}%)
                </span>
              )}
            </div>
            <p className="text-xs text-muted">
              Classes, tests, deadlines, missed data recovery, and scheduled tasks organized for today and next
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Collapse Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-theme-accent transition cursor-pointer"
            title={isCollapsed ? "Expand Reminders" : "Collapse Reminders"}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 rotate-180 transition-transform" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Overdue / Missed Work Alert Notice if any */}
          {activeMissedCount > 0 && (
            <div className="mt-3.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span className="text-xs font-semibold">
                  You have <strong className="font-bold underline">{activeMissedCount} missed or overdue</strong> test/task{activeMissedCount > 1 ? 's' : ''}.
                </span>
              </div>
              <button
                onClick={() => onNavigateTab('missed_work')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition cursor-pointer self-start sm:self-auto shrink-0 shadow-xs"
              >
                <span>View Missed Work & Recovery Plan</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* View Toggles (Today vs Upcoming) + Filter Category Pills */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* View Switcher: Today vs Coming Next */}
            <div className="inline-flex p-1 bg-theme-accent rounded-xl border border-theme text-xs font-medium">
              <button
                onClick={() => setActiveView('today')}
                className={`px-3 py-1.5 rounded-lg transition font-semibold flex items-center gap-1.5 cursor-pointer ${
                  activeView === 'today'
                    ? 'bg-card text-primary shadow-xs'
                    : 'text-muted hover:text-primary'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Today ({todayItems.length})</span>
              </button>
              <button
                onClick={() => setActiveView('upcoming')}
                className={`px-3 py-1.5 rounded-lg transition font-semibold flex items-center gap-1.5 cursor-pointer ${
                  activeView === 'upcoming'
                    ? 'bg-card text-primary shadow-xs'
                    : 'text-muted hover:text-primary'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Coming Next ({upcomingItems.length})</span>
              </button>
            </div>

            {/* Category Filter Pills & Urgent Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                onClick={() => setOnlyUrgent(!onlyUrgent)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-1 ${
                  onlyUrgent
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30 hover:bg-rose-500/20'
                }`}
              >
                <span>🔴 Urgent Only</span>
              </button>

              {(['all', 'classes', 'tests', 'deadlines', 'tasks'] as ReminderCategory[]).map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition cursor-pointer shrink-0 ${
                    activeCategory === cat
                      ? 'bg-primary text-inverted'
                      : 'bg-theme-accent/60 text-muted hover:text-primary hover:bg-theme-accent'
                  }`}
                >
                  {cat === 'all' ? 'All Reminders' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* CONTENT LIST */}
          <div className="mt-4">
            {activeView === 'today' ? (
              // TODAY'S LIST
              filteredTodayItems.filter(item => !onlyUrgent || item.priorityLevel === 'urgent').length === 0 ? (
                <div className="py-8 text-center bg-theme-accent/30 rounded-xl border border-dashed border-theme">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/80 mb-2" />
                  <p className="text-sm font-semibold text-primary">All caught up for today!</p>
                  <p className="text-xs text-muted mt-0.5">
                    {onlyUrgent 
                      ? 'No 🔴 Urgent tasks pending for today.' 
                      : `No scheduled ${activeCategory !== 'all' ? activeCategory : 'reminders'} pending for today.`}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTodayItems
                    .filter(item => !onlyUrgent || item.priorityLevel === 'urgent')
                    .map((item, idx) => (
                    <div
                      key={`${item.id}-${idx}`}
                      className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                        item.isCompleted 
                          ? 'bg-theme-accent/30 border-theme/50 opacity-60' 
                          : `${item.priorityColor.bg} ${item.priorityColor.border} shadow-2xs`
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Status Checkbox */}
                        <button
                          onClick={() => {
                            if (item.category === 'tasks' && item.rawItem.planId && item.rawItem.topicId && onToggleTopicComplete) {
                              onToggleTopicComplete(item.rawItem.planId, item.rawItem.topicId, item.isCompleted);
                            } else if (item.category === 'deadlines' && onToggleAssignmentComplete) {
                              onToggleAssignmentComplete(item.rawItem);
                            }
                          }}
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition cursor-pointer shrink-0 ${
                            item.isCompleted
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-theme hover:border-primary text-transparent bg-card'
                          }`}
                          title={item.isCompleted ? "Mark Incomplete" : "Mark Completed"}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Smart Priority Badge */}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.priorityColor.badgeBg}`}>
                              {item.priorityBadge}
                            </span>

                            <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md ${
                              item.category === 'classes'
                                ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300'
                                : item.category === 'tests'
                                ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                                : item.category === 'deadlines'
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            }`}>
                              {item.category === 'classes' ? 'Class' : item.category === 'tests' ? 'Test' : item.category === 'deadlines' ? 'Deadline' : 'Task'}
                            </span>
                            <span className="text-xs font-semibold text-muted">
                              {item.subject}
                            </span>
                          </div>
                          <h4 className={`text-xs sm:text-sm font-semibold text-primary mt-0.5 truncate ${
                            item.isCompleted ? 'line-through text-muted' : ''
                          }`}>
                            {item.title}
                          </h4>
                          <div className="flex items-center gap-2 flex-wrap mt-0.5 text-[11px] text-muted">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{item.timeOrDuration}</span>
                            </span>
                            {item.reasons && item.reasons.length > 0 && (
                              <span className="text-[10px] bg-theme-accent px-1.5 py-0.2 rounded text-muted">
                                {item.reasons[0]}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Action Button */}
                      <div className="shrink-0">
                        {item.category === 'tasks' && onStartTimerForTopic && !item.isCompleted && (
                          <button
                            onClick={() => onStartTimerForTopic(item.subject, item.rawItem.topic?.chapterName || '', item.title)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-theme-accent hover:bg-theme-accent/80 text-primary border border-theme text-xs font-semibold transition cursor-pointer shadow-2xs"
                            title="Start Timer for this topic"
                          >
                            <Play className="w-3 h-3 text-emerald-500 fill-emerald-500" />
                            <span className="hidden xs:inline">Study</span>
                          </button>
                        )}
                        {item.category === 'deadlines' && (
                          <button
                            onClick={() => onNavigateTab('assignments')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-theme-accent hover:bg-theme-accent/80 text-primary border border-theme text-xs font-medium transition cursor-pointer"
                          >
                            <span>Details</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                        {item.category === 'tests' && (
                          <button
                            onClick={() => onNavigateTab('tests')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30 hover:bg-purple-500/20 text-xs font-medium transition cursor-pointer"
                          >
                            <span>Open Tests</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              // UPCOMING LIST (Coming Next)
              filteredUpcomingItems.filter(item => !onlyUrgent || item.priorityLevel === 'urgent').length === 0 ? (
                <div className="py-8 text-center bg-theme-accent/30 rounded-xl border border-dashed border-theme">
                  <Calendar className="w-8 h-8 mx-auto text-muted/60 mb-2" />
                  <p className="text-sm font-semibold text-primary">No upcoming items in next 7 days</p>
                  <p className="text-xs text-muted mt-0.5">
                    {onlyUrgent ? 'No upcoming 🔴 Urgent items.' : 'Your upcoming schedule is clear. Plan new study sessions in the AI Planner.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredUpcomingItems
                    .filter(item => !onlyUrgent || item.priorityLevel === 'urgent')
                    .map((item, idx) => (
                    <div
                      key={`${item.id}-${idx}`}
                      className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 shadow-2xs ${item.priorityColor.bg} ${item.priorityColor.border}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Smart Priority Badge */}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.priorityColor.badgeBg}`}>
                            {item.priorityBadge}
                          </span>

                          <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md ${
                            item.category === 'classes'
                              ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300'
                              : item.category === 'tests'
                              ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                              : item.category === 'deadlines'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {item.category === 'classes' ? 'Class' : item.category === 'tests' ? 'Test' : item.category === 'deadlines' ? 'Deadline' : 'Task'}
                          </span>
                          <span className="text-xs font-semibold text-muted">
                            {item.subject}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-primary/10 text-primary border border-theme">
                            {item.relativeLabel} ({item.date})
                          </span>
                        </div>
                        <h4 className="text-xs sm:text-sm font-semibold text-primary mt-0.5 truncate">
                          {item.title}
                        </h4>
                      </div>

                      <div className="shrink-0">
                        <button
                          onClick={() => {
                            if (item.category === 'tests') onNavigateTab('tests');
                            else if (item.category === 'deadlines') onNavigateTab('assignments');
                            else onNavigateTab('calendar');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-theme-accent hover:bg-theme-accent/80 text-primary border border-theme text-xs font-medium transition cursor-pointer"
                        >
                          <span>View</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
};
