import { 
  MissedWorkItem, 
  MissedWorkPriority, 
  RecoverySuggestion, 
  StudyPlan, 
  Assignment, 
  TestResult, 
  ScheduledStudyTask, 
  UserProfile,
  ExamDate
} from '../types';

/**
 * Service to automatically detect overdue tests, tasks, and assignments,
 * manage manual entries, and compute intelligent recovery catch-up plans.
 */

export function getTodayDateString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

/**
 * Utility to strictly deduplicate MissedWorkItem arrays by item.id,
 * keeping the most recently updated or completed version.
 */
export function deduplicateMissedWork(items: MissedWorkItem[]): MissedWorkItem[] {
  if (!Array.isArray(items)) return [];
  const map = new Map<string, MissedWorkItem>();
  for (const item of items) {
    if (!item || !item.id) continue;
    if (!map.has(item.id)) {
      map.set(item.id, item);
    } else {
      const existing = map.get(item.id)!;
      // If one is completed, prefer keeping completed status
      if (item.status === 'Completed' && existing.status !== 'Completed') {
        map.set(item.id, item);
        continue;
      }
      const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      const newTime = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
      if (newTime >= existingTime) {
        map.set(item.id, { ...existing, ...item });
      }
    }
  }
  return Array.from(map.values());
}

/**
 * Convenient evaluation wrapper that inspects user profile, plans, assignments, and tests.
 */
export function evaluateAndSyncMissedWork(params: {
  existingMissedWork?: MissedWorkItem[];
  assignments?: Assignment[];
  plans?: StudyPlan[];
  userProfile?: UserProfile | null;
  testResults?: TestResult[];
}): MissedWorkItem[] {
  return detectOverdueWork({
    existingMissedWork: deduplicateMissedWork(params.existingMissedWork || []),
    assignments: params.assignments,
    plans: params.plans,
    testResults: params.testResults,
    examDates: params.userProfile?.examDates || [],
    scheduledTasks: []
  });
}

/**
 * Automatically detects past-deadline items and merges them with existing missed work.
 * Preserves user edits (status changes, reschedule dates, notes) and strictly guarantees unique IDs.
 */
export function detectOverdueWork(params: {
  plans?: StudyPlan[];
  assignments?: Assignment[];
  testResults?: TestResult[];
  scheduledTasks?: ScheduledStudyTask[];
  examDates?: ExamDate[];
  existingMissedWork?: MissedWorkItem[];
}): MissedWorkItem[] {
  const {
    plans = [],
    assignments = [],
    testResults = [],
    scheduledTasks = [],
    examDates = [],
    existingMissedWork = []
  } = params;

  const todayStr = getTodayDateString();
  const existingMap = new Map<string, MissedWorkItem>();
  existingMissedWork.forEach(item => {
    if (item && item.id) {
      existingMap.set(item.id, item);
    }
  });

  const detectedMap = new Map<string, MissedWorkItem>();
  const addDetectedItem = (item: MissedWorkItem) => {
    if (!item || !item.id) return;
    if (!detectedMap.has(item.id)) {
      detectedMap.set(item.id, item);
    } else {
      const existing = detectedMap.get(item.id)!;
      detectedMap.set(item.id, { ...existing, ...item });
    }
  };

  // 1. Overdue Assignments
  assignments.forEach(asg => {
    if (!asg.dueDate) return;
    const isPast = asg.dueDate < todayStr;
    const isDone = asg.status === 'Completed' || asg.status === 'Submitted';

    const itemId = `missed-asg-${asg.id}`;
    const existing = existingMap.get(itemId);

    if (isPast && !isDone) {
      if (existing) {
        // Keep user status if they set it to Completed or Rescheduled
        addDetectedItem({
          ...existing,
          title: asg.title,
          subjectName: asg.subjectName,
          originalDeadline: asg.dueDate,
          updatedAt: new Date().toISOString()
        });
      } else {
        const priority: MissedWorkPriority = asg.priority === 'High' ? 'High' : asg.priority === 'Low' ? 'Low' : 'Medium';
        addDetectedItem({
          id: itemId,
          type: asg.type === 'Test' ? 'test' : 'assignment',
          title: asg.title,
          subjectName: asg.subjectName,
          originalDeadline: asg.dueDate,
          status: 'Missed',
          priority,
          detectedAutomatically: true,
          estimatedMinutes: asg.estimatedMinutes || 45,
          notes: asg.description || 'Past assignment deadline',
          sourceId: asg.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    } else if (isDone && existing && existing.status !== 'Completed') {
      // Sync completion if completed elsewhere
      addDetectedItem({
        ...existing,
        status: 'Completed',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } else if (existing) {
      addDetectedItem(existing);
    }
  });

  // 2. Overdue Study Plan Topics
  plans.forEach(plan => {
    if (!plan.date || plan.date >= todayStr) return;
    plan.topics.forEach((topic, idx) => {
      if (topic.completed) return;

      const itemId = `missed-plan-${plan.id}-${topic.id || `topic-${idx}`}`;
      const existing = existingMap.get(itemId);

      if (existing) {
        addDetectedItem({
          ...existing,
          title: topic.topicName,
          subjectName: topic.subjectName,
          chapterName: topic.chapterName,
          originalDeadline: plan.date,
          updatedAt: new Date().toISOString()
        });
      } else {
        addDetectedItem({
          id: itemId,
          type: 'task',
          title: topic.topicName,
          subjectName: topic.subjectName,
          chapterName: topic.chapterName,
          originalDeadline: plan.date,
          status: 'Missed',
          priority: topic.priority === 'High' ? 'High' : topic.priority === 'Low' ? 'Low' : 'Medium',
          detectedAutomatically: true,
          estimatedMinutes: topic.estimatedMinutes || 45,
          notes: `Scheduled study topic in ${topic.subjectName} was not completed`,
          sourceId: topic.id || `${plan.id}-${idx}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    });
  });

  // 3. Overdue Scheduled Tasks
  scheduledTasks.forEach(task => {
    if (!task.date || task.date >= todayStr) return;
    if (task.completed) return;

    const itemId = `missed-task-${task.id}`;
    const existing = existingMap.get(itemId);

    if (existing) {
      addDetectedItem({
        ...existing,
        title: task.title || task.topicName || 'Scheduled Task',
        subjectName: task.subjectName,
        chapterName: task.chapterName,
        originalDeadline: task.date,
        originalTimeslot: task.timeslot,
        updatedAt: new Date().toISOString()
      });
    } else {
      addDetectedItem({
        id: itemId,
        type: 'task',
        title: task.title || task.topicName || 'Scheduled Task',
        subjectName: task.subjectName,
        chapterName: task.chapterName,
        originalDeadline: task.date,
        originalTimeslot: task.timeslot,
        status: 'Missed',
        priority: 'Medium',
        detectedAutomatically: true,
        estimatedMinutes: task.durationMinutes || 45,
        notes: `Scheduled study block on ${task.date} was not marked complete`,
        sourceId: task.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  });

  // 4. Preserve all existing manual items or previously recorded items not captured above
  existingMissedWork.forEach(item => {
    if (item && item.id && !detectedMap.has(item.id)) {
      detectedMap.set(item.id, item);
    }
  });

  return Array.from(detectedMap.values());
}

/**
 * Intelligent Recovery Plan Generator.
 * Analyzes missed/pending items and allocates feasible catch-up slots.
 * Suggests priority and clearly identifies what to attempt next.
 */
export function generateRecoveryPlan(
  missedItems: MissedWorkItem[],
  userProfile?: UserProfile | null
): {
  suggestions: RecoverySuggestion[];
  nextActionItem: MissedWorkItem | null;
  totalEstimatedMinutes: number;
} {
  // Only target active missed or pending items
  const activeMissed = missedItems.filter(
    item => item.status === 'Missed' || item.status === 'Pending'
  );

  if (activeMissed.length === 0) {
    return { suggestions: [], nextActionItem: null, totalEstimatedMinutes: 0 };
  }

  const today = new Date();
  const todayStr = getTodayDateString();

  // Helper to add days
  const addDays = (base: Date, days: number): string => {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  // Rank urgency:
  // Tests & High priority items come first, then oldest overdue items
  const sorted = [...activeMissed].sort((a, b) => {
    const typeWeight = (t: string) => (t === 'test' ? 300 : t === 'assignment' ? 200 : 100);
    const priorityWeight = (p: string) => (p === 'High' ? 50 : p === 'Medium' ? 20 : 0);
    
    const scoreA = typeWeight(a.type) + priorityWeight(a.priority);
    const scoreB = typeWeight(b.type) + priorityWeight(b.priority);

    if (scoreB !== scoreA) return scoreB - scoreA;
    // If equal, older deadline comes first
    return a.originalDeadline.localeCompare(b.originalDeadline);
  });

  let totalMinutes = 0;
  const suggestions: RecoverySuggestion[] = [];

  // Slots available: distribute over today evening, tomorrow morning/evening, etc.
  const timeslots = ['evening', 'afternoon', 'morning', 'night'];
  let currentDayOffset = 0;
  let slotIndex = 0;
  let dayMinutesAllocated = 0;
  const MAX_RECOVERY_MINS_PER_DAY = 90; // Don't overwhelm student with > 90m recovery / day

  sorted.forEach((item, index) => {
    const duration = item.estimatedMinutes || 45;
    totalMinutes += duration;

    // Check if we need to advance to next day
    if (dayMinutesAllocated + duration > MAX_RECOVERY_MINS_PER_DAY && index > 0) {
      currentDayOffset++;
      slotIndex = 0;
      dayMinutesAllocated = 0;
    }

    const targetDate = addDays(today, currentDayOffset);
    const targetTimeslot = timeslots[slotIndex % timeslots.length];
    slotIndex++;
    dayMinutesAllocated += duration;

    let reasoning = '';
    if (index === 0) {
      reasoning = item.type === 'test'
        ? `🔥 Top Priority: Missed test in ${item.subjectName}. Catch up immediately to identify knowledge gaps before upcoming exams.`
        : `🔥 Top Priority: High-impact ${item.type} in ${item.subjectName}. Complete this first to regain academic momentum.`;
    } else if (currentDayOffset === 0) {
      reasoning = `Schedule tonight in an evening catch-up block for ${item.subjectName}.`;
    } else if (currentDayOffset === 1) {
      reasoning = `Schedule tomorrow during ${targetTimeslot} session to maintain steady catch-up progress.`;
    } else {
      reasoning = `Planned for ${targetDate} (${targetTimeslot}) so your regular daily study schedule is not disrupted.`;
    }

    // Suggested priority elevation if overdue by more than 3 days
    let suggestedPriority = item.priority;
    const daysOverdue = Math.max(0, Math.floor((today.getTime() - new Date(item.originalDeadline).getTime()) / (1000 * 3600 * 24)));
    if (daysOverdue > 3 && suggestedPriority === 'Low') {
      suggestedPriority = 'Medium';
    }
    if (item.type === 'test') {
      suggestedPriority = 'High';
    }

    suggestions.push({
      itemId: item.id,
      suggestedDate: targetDate,
      suggestedTimeslot: targetTimeslot,
      suggestedPriority,
      reasoning,
      urgencyRank: index + 1
    });
  });

  return {
    suggestions,
    nextActionItem: sorted[0] || null,
    totalEstimatedMinutes: totalMinutes
  };
}

/**
 * Applies recovery suggestions to the missed work items and returns the updated items.
 */
export function applyRecoveryPlanToMissedWork(
  items: MissedWorkItem[],
  suggestions: RecoverySuggestion[]
): MissedWorkItem[] {
  const suggMap = new Map<string, RecoverySuggestion>();
  suggestions.forEach(s => suggMap.set(s.itemId, s));

  return items.map(item => {
    const sugg = suggMap.get(item.id);
    if (!sugg) return item;

    return {
      ...item,
      status: 'Rescheduled',
      priority: sugg.suggestedPriority,
      rescheduledDate: sugg.suggestedDate,
      rescheduledTimeslot: sugg.suggestedTimeslot,
      notes: item.notes 
        ? `${item.notes}\n[AI Recovery Plan: Rescheduled to ${sugg.suggestedDate} (${sugg.suggestedTimeslot})]` 
        : `[AI Recovery Plan: Rescheduled to ${sugg.suggestedDate} (${sugg.suggestedTimeslot})]`,
      updatedAt: new Date().toISOString()
    };
  });
}
