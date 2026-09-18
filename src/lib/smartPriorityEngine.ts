import { 
  Assignment, 
  MissedWorkItem, 
  StudyPlan, 
  ScheduledStudyTask, 
  UserProfile, 
  ExamDate,
  RevisionItem 
} from '../types';

export type SmartPriorityLevel = 'urgent' | 'high' | 'normal' | 'low';

export interface SmartPriorityColor {
  bg: string;
  text: string;
  border: string;
  dot: string;
  badgeBg: string;
}

export interface PrioritizedAcademicTask {
  id: string;
  sourceType: 'assignment' | 'test' | 'exam' | 'missed_work' | 'plan_topic' | 'scheduled_task';
  title: string;
  subjectName: string;
  chapterName?: string;
  topicName?: string;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string;
  daysRemaining: number;
  isMissed: boolean;
  isCompleted: boolean;
  status: string;
  priorityLevel: SmartPriorityLevel;
  priorityBadge: '🔴 Urgent' | '🟠 High' | '🟡 Normal' | '🟢 Low';
  priorityColor: SmartPriorityColor;
  score: number; // 0 to 100+
  factors: {
    daysScore: number;
    missedScore: number;
    importanceScore: number;
    prepScore: number;
    workloadScore: number;
  };
  reasons: string[]; // human-readable explanation chips
  prepStatus?: {
    totalStages: number;
    completedStages: number;
    remainingStages: number;
    percentage: number;
  };
  estimatedMinutes: number;
  rawItem: any;
}

export const PRIORITY_CONFIG: Record<SmartPriorityLevel, {
  label: string;
  badge: '🔴 Urgent' | '🟠 High' | '🟡 Normal' | '🟢 Low';
  colors: SmartPriorityColor;
  description: string;
}> = {
  urgent: {
    label: 'Urgent',
    badge: '🔴 Urgent',
    colors: {
      bg: 'bg-rose-500/10 dark:bg-rose-950/30',
      text: 'text-rose-700 dark:text-rose-300',
      border: 'border-rose-500/30 dark:border-rose-500/40',
      dot: 'bg-rose-500',
      badgeBg: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
    },
    description: 'Requires immediate attention. Due today/tomorrow, overdue missed work, or imminent test with unfinished preparation.'
  },
  high: {
    label: 'High',
    badge: '🟠 High',
    colors: {
      bg: 'bg-amber-500/10 dark:bg-amber-950/30',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-500/30 dark:border-amber-500/40',
      dot: 'bg-amber-500',
      badgeBg: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
    },
    description: 'High priority. Due in 2–3 days, significant preparation required, or high-weight academic exam.'
  },
  normal: {
    label: 'Normal',
    badge: '🟡 Normal',
    colors: {
      bg: 'bg-blue-500/10 dark:bg-blue-950/30',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-500/30 dark:border-blue-500/40',
      dot: 'bg-blue-500',
      badgeBg: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
    },
    description: 'Standard academic workload. Due in 4–7 days with steady progress.'
  },
  low: {
    label: 'Low',
    badge: '🟢 Low',
    colors: {
      bg: 'bg-emerald-500/10 dark:bg-emerald-950/30',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-500/30 dark:border-emerald-500/40',
      dot: 'bg-emerald-500',
      badgeBg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
    },
    description: 'Lower urgency or flexible timeline. Due in > 7 days or already well-prepared.'
  }
};

/**
 * Calculates days remaining between today and target date.
 * Returns negative numbers for past dates.
 */
export function calculateDaysRemaining(targetDate: string): number {
  if (!targetDate) return 999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const [y, m, d] = targetDate.split('-').map(Number);
  if (!y || !m || !d) return 999;
  const target = new Date(y, m - 1, d);
  target.setHours(0, 0, 0, 0);
  
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Evaluates current workload (minutes and task count) for a given date.
 */
export function getWorkloadForDate(
  date: string,
  plans: StudyPlan[] = [],
  scheduledTasks: ScheduledStudyTask[] = [],
  assignments: Assignment[] = [],
  targetHoursPerDay: number = 3
): { totalMinutes: number; taskCount: number; level: 'Light' | 'Moderate' | 'Heavy' } {
  let minutes = 0;
  let count = 0;

  // Study plans on that date
  const plan = plans.find(p => p.date === date);
  if (plan && plan.topics) {
    plan.topics.forEach(t => {
      minutes += t.estimatedMinutes || 45;
      count++;
    });
  }

  // Scheduled tasks on that date
  scheduledTasks.forEach(st => {
    if (st.date === date && !st.completed) {
      minutes += st.durationMinutes || 45;
      count++;
    }
  });

  // Assignments due on that date
  assignments.forEach(asg => {
    if (asg.dueDate === date && asg.status !== 'Completed' && asg.status !== 'Submitted') {
      minutes += asg.estimatedMinutes || 45;
      count++;
    }
  });

  const targetMinutes = targetHoursPerDay * 60;
  let level: 'Light' | 'Moderate' | 'Heavy' = 'Light';
  if (minutes > targetMinutes * 0.85 || count >= 4) {
    level = 'Heavy';
  } else if (minutes > targetMinutes * 0.45 || count >= 2) {
    level = 'Moderate';
  }

  return { totalMinutes: minutes, taskCount: count, level };
}

/**
 * Evaluates a single task and computes its smart priority level, score, and explanation reasons.
 */
export function evaluateSmartPriority(params: {
  dueDate: string;
  isMissed?: boolean;
  type?: string; // 'Test' | 'Quiz' | 'Exam' | 'Assignment' | 'Homework' | 'Project'
  userPriority?: 'Urgent' | 'High' | 'Medium' | 'Low';
  subtasks?: { completed: boolean }[];
  isWeakTopic?: boolean;
  workloadLevel?: 'Light' | 'Moderate' | 'Heavy';
  title?: string;
  isCompleted?: boolean;
}): {
  priorityLevel: SmartPriorityLevel;
  priorityBadge: '🔴 Urgent' | '🟠 High' | '🟡 Normal' | '🟢 Low';
  score: number;
  factors: {
    daysScore: number;
    missedScore: number;
    importanceScore: number;
    prepScore: number;
    workloadScore: number;
  };
  reasons: string[];
} {
  const {
    dueDate,
    isMissed = false,
    type = 'Assignment',
    userPriority = 'Medium',
    subtasks = [],
    isWeakTopic = false,
    workloadLevel = 'Light',
    isCompleted = false
  } = params;

  if (isCompleted) {
    return {
      priorityLevel: 'low',
      priorityBadge: '🟢 Low',
      score: 0,
      factors: { daysScore: 0, missedScore: 0, importanceScore: 0, prepScore: 0, workloadScore: 0 },
      reasons: ['Task Completed']
    };
  }

  const daysRemaining = calculateDaysRemaining(dueDate);
  const reasons: string[] = [];

  // 1. HOW SOON THE DEADLINE/TEST IS (Urgency)
  let daysScore = 0;
  if (daysRemaining < 0) {
    daysScore = 45;
    reasons.push(`Overdue by ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) > 1 ? 's' : ''}`);
  } else if (daysRemaining === 0) {
    daysScore = 42;
    reasons.push('Due Today');
  } else if (daysRemaining === 1) {
    daysScore = 32;
    reasons.push('Due Tomorrow');
  } else if (daysRemaining === 2) {
    daysScore = 24;
    reasons.push('In 2 days');
  } else if (daysRemaining === 3) {
    daysScore = 18;
    reasons.push('In 3 days');
  } else if (daysRemaining <= 7) {
    daysScore = 10;
    reasons.push(`In ${daysRemaining} days`);
  } else {
    daysScore = 4;
    reasons.push(`Due in ${daysRemaining} days`);
  }

  // 2. WHETHER THE TASK IS MISSED
  let missedScore = 0;
  if (isMissed || daysRemaining < 0) {
    missedScore = 35;
    reasons.push('Missed Work / Catch-up Needed');
  }

  // 3. IMPORTANCE
  let importanceScore = 0;
  const isTestOrExam = type === 'Test' || type === 'Quiz' || type === 'Exam' || type === 'MockExam';
  if (isTestOrExam) {
    importanceScore += 22;
    reasons.push('High-Stakes Test/Exam');
  }

  if (userPriority === 'Urgent') {
    importanceScore += 20;
    reasons.push('Marked Urgent');
  } else if (userPriority === 'High') {
    importanceScore += 14;
    reasons.push('High Importance');
  } else if (userPriority === 'Medium') {
    importanceScore += 8;
  } else {
    importanceScore += 3;
  }

  // 4. REMAINING PREPARATION
  let prepScore = 0;
  if (subtasks.length > 0) {
    const uncompletedSubtasks = subtasks.filter(st => !st.completed).length;
    const remainingRatio = uncompletedSubtasks / subtasks.length;

    if (uncompletedSubtasks > 0) {
      if (daysRemaining <= 2 && remainingRatio > 0.5) {
        prepScore = 22;
        reasons.push(`${uncompletedSubtasks}/${subtasks.length} Prep Stages Incomplete`);
      } else if (daysRemaining <= 4 && remainingRatio > 0.3) {
        prepScore = 14;
        reasons.push(`${uncompletedSubtasks} Prep Milestones Remaining`);
      } else {
        prepScore = 8;
        reasons.push(`${uncompletedSubtasks} Prep Tasks Pending`);
      }
    } else {
      reasons.push('All Preparation Completed');
    }
  }

  if (isWeakTopic) {
    prepScore += 10;
    reasons.push('Syllabus Weak Topic');
  }

  // 5. CURRENT WORKLOAD
  let workloadScore = 0;
  if (workloadLevel === 'Heavy') {
    workloadScore = 12;
    reasons.push('Heavy Day Workload');
  } else if (workloadLevel === 'Moderate') {
    workloadScore = 6;
  }

  const totalScore = daysScore + missedScore + importanceScore + prepScore + workloadScore;

  // Determine Level according to clear user rules:
  // 🔴 Urgent: imminent deadline/test with remaining prep, missed work, or score >= 65
  // 🟠 High: score 45-64
  // 🟡 Normal: score 25-44
  // 🟢 Low: score < 25
  let priorityLevel: SmartPriorityLevel = 'normal';

  if (isMissed || daysRemaining < 0 || (daysRemaining <= 1 && totalScore >= 50) || totalScore >= 65) {
    priorityLevel = 'urgent';
  } else if (totalScore >= 45 || (daysRemaining <= 3 && isTestOrExam)) {
    priorityLevel = 'high';
  } else if (totalScore >= 25) {
    priorityLevel = 'normal';
  } else {
    priorityLevel = 'low';
  }

  return {
    priorityLevel,
    priorityBadge: PRIORITY_CONFIG[priorityLevel].badge,
    score: totalScore,
    factors: {
      daysScore,
      missedScore,
      importanceScore,
      prepScore,
      workloadScore
    },
    reasons: Array.from(new Set(reasons)).slice(0, 4)
  };
}

/**
 * Aggregates all academic tasks across the app and outputs a unified, sorted list
 * with calculated Smart Priorities.
 */
export function getSmartPrioritizedTasks(params: {
  assignments?: Assignment[];
  missedWork?: MissedWorkItem[];
  plans?: StudyPlan[];
  userProfile?: UserProfile | null;
  scheduledTasks?: ScheduledStudyTask[];
  revisions?: RevisionItem[];
}): PrioritizedAcademicTask[] {
  const {
    assignments = [],
    missedWork = [],
    plans = [],
    userProfile = null,
    scheduledTasks = [],
    revisions = []
  } = params;

  const targetHours = userProfile?.targetHoursPerDay || 3;
  const items: PrioritizedAcademicTask[] = [];
  const processedIds = new Set<string>();

  // 1. Process Assignments & Deadlines
  assignments.forEach(asg => {
    if (processedIds.has(asg.id)) return;
    processedIds.add(asg.id);

    const isCompleted = asg.status === 'Completed' || asg.status === 'Submitted';
    const isMissed = asg.status === 'Overdue' || (!isCompleted && calculateDaysRemaining(asg.dueDate) < 0);
    const workload = getWorkloadForDate(asg.dueDate, plans, scheduledTasks, assignments, targetHours);

    const evaluation = evaluateSmartPriority({
      dueDate: asg.dueDate,
      isMissed,
      type: asg.type,
      userPriority: asg.priority,
      subtasks: asg.subtasks || [],
      workloadLevel: workload.level,
      title: asg.title,
      isCompleted
    });

    const subtasks = asg.subtasks || [];
    const completedStages = subtasks.filter(st => st.completed).length;
    const remainingStages = subtasks.length - completedStages;

    items.push({
      id: asg.id,
      sourceType: asg.type === 'Test' || asg.type === 'Quiz' ? 'test' : 'assignment',
      title: asg.title,
      subjectName: asg.subjectName || 'General Academic',
      chapterName: asg.chapterName,
      topicName: asg.topicName,
      dueDate: asg.dueDate,
      dueTime: asg.dueTime,
      daysRemaining: calculateDaysRemaining(asg.dueDate),
      isMissed,
      isCompleted,
      status: asg.status,
      priorityLevel: evaluation.priorityLevel,
      priorityBadge: evaluation.priorityBadge,
      priorityColor: PRIORITY_CONFIG[evaluation.priorityLevel].colors,
      score: evaluation.score,
      factors: evaluation.factors,
      reasons: evaluation.reasons,
      prepStatus: subtasks.length > 0 ? {
        totalStages: subtasks.length,
        completedStages,
        remainingStages,
        percentage: Math.round((completedStages / subtasks.length) * 100)
      } : undefined,
      estimatedMinutes: asg.estimatedMinutes || 45,
      rawItem: asg
    });
  });

  // 2. Process Missed Work Items (Not yet marked completed)
  missedWork.forEach(mw => {
    const isDone = mw.status === 'Completed';
    const isMissed = mw.status === 'Missed' || mw.status === 'Pending';
    const effectiveDate = mw.rescheduledDate || mw.originalDeadline;

    const evaluation = evaluateSmartPriority({
      dueDate: effectiveDate,
      isMissed,
      type: mw.type === 'test' ? 'Test' : 'Assignment',
      userPriority: mw.priority === 'High' ? 'High' : mw.priority === 'Low' ? 'Low' : 'Medium',
      workloadLevel: 'Moderate',
      title: mw.title,
      isCompleted: isDone
    });

    items.push({
      id: `mw_${mw.id}`,
      sourceType: 'missed_work',
      title: mw.title,
      subjectName: mw.subjectName,
      chapterName: mw.chapterName,
      dueDate: effectiveDate,
      daysRemaining: calculateDaysRemaining(effectiveDate),
      isMissed,
      isCompleted: isDone,
      status: mw.status,
      priorityLevel: evaluation.priorityLevel,
      priorityBadge: evaluation.priorityBadge,
      priorityColor: PRIORITY_CONFIG[evaluation.priorityLevel].colors,
      score: evaluation.score,
      factors: evaluation.factors,
      reasons: evaluation.reasons,
      estimatedMinutes: mw.estimatedMinutes || 45,
      rawItem: mw
    });
  });

  // 3. Process Target Exam Dates from User Profile
  if (userProfile?.examDates) {
    userProfile.examDates.forEach(exam => {
      const examId = `exam_${exam.id || exam.subjectName}_${exam.date}`;
      // Check if already captured in assignments
      const alreadyHasAsg = assignments.some(a => 
        (a.type === 'Test' || a.type === 'Quiz') && 
        a.dueDate === exam.date && 
        a.subjectName?.toLowerCase() === exam.subjectName?.toLowerCase()
      );
      if (alreadyHasAsg) return;

      const daysRemaining = calculateDaysRemaining(exam.date);
      const isPast = daysRemaining < 0;
      const workload = getWorkloadForDate(exam.date, plans, scheduledTasks, assignments, targetHours);

      const evaluation = evaluateSmartPriority({
        dueDate: exam.date,
        isMissed: isPast,
        type: 'Exam',
        userPriority: 'Urgent',
        workloadLevel: workload.level,
        title: `${exam.subjectName} ${exam.examName || 'Official Exam'}`,
        isCompleted: false
      });

      items.push({
        id: examId,
        sourceType: 'exam',
        title: `${exam.subjectName} — ${exam.examName || 'Official Exam'}`,
        subjectName: exam.subjectName,
        dueDate: exam.date,
        daysRemaining,
        isMissed: isPast,
        isCompleted: false,
        status: isPast ? 'Overdue' : 'Scheduled',
        priorityLevel: evaluation.priorityLevel,
        priorityBadge: evaluation.priorityBadge,
        priorityColor: PRIORITY_CONFIG[evaluation.priorityLevel].colors,
        score: evaluation.score + 10, // slight boost for major exam dates
        factors: evaluation.factors,
        reasons: evaluation.reasons,
        estimatedMinutes: 90,
        rawItem: exam
      });
    });
  }

  // 4. Process Urgent Spaced Revisions due today or overdue
  revisions.forEach(rev => {
    if (rev.status === 'Completed') return;
    const daysRemaining = calculateDaysRemaining(rev.dueDate);
    if (daysRemaining > 3) return; // only pull in near-term revisions

    const evaluation = evaluateSmartPriority({
      dueDate: rev.dueDate,
      isMissed: daysRemaining < 0,
      type: 'Assignment',
      userPriority: rev.priority === 'High' ? 'High' : 'Medium',
      title: `Revision: ${rev.topicName}`,
      isCompleted: false
    });

    items.push({
      id: `rev_${rev.id}`,
      sourceType: 'plan_topic',
      title: `Spaced Revision: ${rev.topicName}`,
      subjectName: rev.subjectName,
      chapterName: rev.chapterName,
      topicName: rev.topicName,
      dueDate: rev.dueDate,
      daysRemaining,
      isMissed: daysRemaining < 0,
      isCompleted: false,
      status: 'Pending',
      priorityLevel: evaluation.priorityLevel,
      priorityBadge: evaluation.priorityBadge,
      priorityColor: PRIORITY_CONFIG[evaluation.priorityLevel].colors,
      score: evaluation.score,
      factors: evaluation.factors,
      reasons: evaluation.reasons,
      estimatedMinutes: 30,
      rawItem: rev
    });
  });

  // Deduplicate tasks strictly by unique ID
  const seenIds = new Set<string>();
  const uniqueItems: PrioritizedAcademicTask[] = [];
  for (const item of items) {
    if (item && item.id && !seenIds.has(item.id)) {
      seenIds.add(item.id);
      uniqueItems.push(item);
    }
  }

  // Sort tasks:
  // 1. Highest priority tier: 🔴 Urgent > 🟠 High > 🟡 Normal > 🟢 Low
  // 2. Score descending
  // 3. Due date ascending
  const tierWeight: Record<SmartPriorityLevel, number> = {
    urgent: 4,
    high: 3,
    normal: 2,
    low: 1
  };

  return uniqueItems.sort((a, b) => {
    // Uncompleted items come before completed
    if (a.isCompleted !== b.isCompleted) {
      return a.isCompleted ? 1 : -1;
    }
    // Tier weight
    const weightDiff = tierWeight[b.priorityLevel] - tierWeight[a.priorityLevel];
    if (weightDiff !== 0) return weightDiff;
    // Score
    if (b.score !== a.score) return b.score - a.score;
    // Due date
    return a.dueDate.localeCompare(b.dueDate);
  });
}
