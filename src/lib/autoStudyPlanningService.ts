import { 
  AssignmentSubtask, 
  Assignment, 
  StudyPlan, 
  ScheduledStudyTask, 
  UserProfile,
  StudyPlanTopic 
} from '../types';
import { getWorkloadForDate } from './smartPriorityEngine';

export interface PrepTimelineStage {
  id: string;
  title: string;
  description: string;
  phase: 'research' | 'outline' | 'drafting' | 'review' | 'practice' | 'submission';
  scheduledDate: string; // YYYY-MM-DD
  timeslot: 'morning' | 'afternoon' | 'evening' | 'night';
  estimatedMinutes: number;
  completed: boolean;
  completedAt?: string;
  daysBeforeTarget: number; // 3, 2, 1, 0
  workloadContext?: {
    dayLevel: 'Light' | 'Moderate' | 'Heavy';
    totalMinutesOnDay: number;
    taskCountOnDay: number;
    note: string;
  };
}

export interface AutoStudyPlanResult {
  stages: PrepTimelineStage[];
  totalMinutes: number;
  workloadSummary: string;
}

/**
 * Calculates a date offset string (YYYY-MM-DD) from a base date.
 */
export function addDaysToDate(baseDateStr: string, offsetDays: number): string {
  const [y, m, d] = baseDateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().split('T')[0];
}

/**
 * Determines the best available timeslot on a given date by looking at scheduled tasks.
 */
export function chooseBestTimeslot(
  dateStr: string,
  scheduledTasks: ScheduledStudyTask[] = []
): 'morning' | 'afternoon' | 'evening' | 'night' {
  const tasksOnDate = scheduledTasks.filter(t => t.date === dateStr);
  const slotCounts: Record<'morning' | 'afternoon' | 'evening' | 'night', number> = {
    morning: 0,
    afternoon: 0,
    evening: 0,
    night: 0
  };

  tasksOnDate.forEach(t => {
    if (t.timeslot && slotCounts[t.timeslot] !== undefined) {
      slotCounts[t.timeslot]++;
    }
  });

  // Pick least crowded slot, prioritizing morning/afternoon for study
  const order: ('morning' | 'afternoon' | 'evening' | 'night')[] = ['afternoon', 'morning', 'evening', 'night'];
  let bestSlot: 'morning' | 'afternoon' | 'evening' | 'night' = 'afternoon';
  let minCount = 999;

  for (const slot of order) {
    if (slotCounts[slot] < minCount) {
      minCount = slotCounts[slot];
      bestSlot = slot;
    }
  }

  return bestSlot;
}

/**
 * Automatically creates a preparation timeline leading up to a test or deadline.
 *
 * For example:
 * - 3 days before: Revision / learning
 * - 2 days before: Practice questions
 * - 1 day before: Final revision
 * - Test day: Attempt test
 *
 * Considers existing schedule and workload for each day.
 */
export function generateAdaptivePrepTimeline(params: {
  targetDate: string; // YYYY-MM-DD
  targetTitle: string;
  targetType?: string; // 'Test' | 'Quiz' | 'Exam' | 'Assignment' | 'Project' | 'Homework'
  subjectName?: string;
  chapterName?: string;
  topicName?: string;
  totalEstimatedMinutes?: number;
  plans?: StudyPlan[];
  scheduledTasks?: ScheduledStudyTask[];
  assignments?: Assignment[];
  userProfile?: UserProfile | null;
}): AutoStudyPlanResult {
  const {
    targetDate,
    targetTitle,
    targetType = 'Test',
    subjectName = 'Academic',
    chapterName,
    topicName,
    totalEstimatedMinutes = 120,
    plans = [],
    scheduledTasks = [],
    assignments = [],
    userProfile = null
  } = params;

  const todayStr = new Date().toISOString().split('T')[0];
  const targetHours = userProfile?.targetHoursPerDay || 3;

  // Calculate days difference between today and target date
  const [ty, tm, td] = targetDate.split('-').map(Number);
  const targetObj = new Date(ty, tm - 1, td);
  targetObj.setHours(0, 0, 0, 0);

  const todayObj = new Date();
  todayObj.setHours(0, 0, 0, 0);

  const diffDays = Math.round((targetObj.getTime() - todayObj.getTime()) / (1000 * 60 * 60 * 24));
  const isTest = targetType === 'Test' || targetType === 'Quiz' || targetType === 'Exam';

  const stages: PrepTimelineStage[] = [];

  // Helper to build stage with workload awareness
  const createStage = (opts: {
    daysBefore: number;
    title: string;
    description: string;
    phase: PrepTimelineStage['phase'];
    defaultMinutes: number;
  }): PrepTimelineStage => {
    // Determine the scheduled date for this stage
    // If daysBefore leads to a date prior to today, clamp it to today
    let candidateDate = addDaysToDate(targetDate, -opts.daysBefore);
    if (candidateDate < todayStr) {
      candidateDate = todayStr;
    }

    // Inspect workload on that candidate date
    const workload = getWorkloadForDate(candidateDate, plans, scheduledTasks, assignments, targetHours);
    const chosenSlot = chooseBestTimeslot(candidateDate, scheduledTasks);

    // If candidate date is heavily loaded, adjust duration slightly
    let adjustedMinutes = opts.defaultMinutes;
    let workloadNote = `Workload is ${workload.level.toLowerCase()} (${workload.totalMinutes}m scheduled).`;
    if (workload.level === 'Heavy') {
      adjustedMinutes = Math.max(25, Math.round(opts.defaultMinutes * 0.75));
      workloadNote = `Heavy day workload detected. Adjusted to high-yield ${adjustedMinutes}m session during ${chosenSlot}.`;
    }

    return {
      id: `prep_stage_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: opts.title,
      description: opts.description,
      phase: opts.phase,
      scheduledDate: candidateDate,
      timeslot: chosenSlot,
      estimatedMinutes: adjustedMinutes,
      completed: false,
      daysBeforeTarget: opts.daysBefore,
      workloadContext: {
        dayLevel: workload.level,
        totalMinutesOnDay: workload.totalMinutes,
        taskCountOnDay: workload.taskCount,
        note: workloadNote
      }
    };
  };

  const subjectTopicContext = topicName || chapterName || targetTitle;

  if (isTest) {
    if (diffDays >= 4) {
      // Extended preparation timeline (e.g. 5–7 days window)
      stages.push(createStage({
        daysBefore: Math.min(diffDays, 5),
        title: `Comprehensive Concept Review: ${subjectTopicContext}`,
        description: `Review syllabus lecture notes, core theoretical definitions, and formula sheets for ${subjectName}.`,
        phase: 'research',
        defaultMinutes: 45
      }));
      stages.push(createStage({
        daysBefore: 3,
        title: `Revision / Learning: High-Yield Topic Drill`,
        description: `Active recall, conceptual flashcards, and summary diagram review on ${subjectTopicContext}.`,
        phase: 'research',
        defaultMinutes: 45
      }));
      stages.push(createStage({
        daysBefore: 2,
        title: `Practice Questions & Problem Sets`,
        description: `Solve past paper questions, timed quiz drills, and identify problem areas.`,
        phase: 'practice',
        defaultMinutes: 50
      }));
      stages.push(createStage({
        daysBefore: 1,
        title: `Final Revision & Formula Audit`,
        description: `Mistake notebook review, high-yield formula check, and calm conceptual consolidation.`,
        phase: 'review',
        defaultMinutes: 30
      }));
      stages.push(createStage({
        daysBefore: 0,
        title: `Test Day: Attempt ${targetTitle}`,
        description: `Execute test calmly, pace questions systematically, and review all answers.`,
        phase: 'submission',
        defaultMinutes: Math.round(totalEstimatedMinutes * 0.5) || 45
      }));
    } else if (diffDays === 3) {
      // Exact user requested pattern:
      // - 3 days before: Revision / learning
      // - 2 days before: Practice questions
      // - 1 day before: Final revision
      // - Test day: Attempt test
      stages.push(createStage({
        daysBefore: 3,
        title: `Revision / Learning: ${subjectTopicContext}`,
        description: `Deep conceptual revision of notes, syllabus definitions, and key formulas for ${subjectName}.`,
        phase: 'research',
        defaultMinutes: 45
      }));
      stages.push(createStage({
        daysBefore: 2,
        title: `Practice Questions & Drills: ${subjectTopicContext}`,
        description: `Work through targeted problem sets, mock questions, and active recall drills.`,
        phase: 'practice',
        defaultMinutes: 50
      }));
      stages.push(createStage({
        daysBefore: 1,
        title: `Final Revision: Mistake Audit & Formulas`,
        description: `Review challenging questions, quick formula sheet check, and final readiness review.`,
        phase: 'review',
        defaultMinutes: 30
      }));
      stages.push(createStage({
        daysBefore: 0,
        title: `Test Day: Attempt ${targetTitle}`,
        description: `Take official test / timed mock, review solutions, and log score afterwards.`,
        phase: 'submission',
        defaultMinutes: 45
      }));
    } else if (diffDays === 2) {
      // 2 days remaining
      stages.push(createStage({
        daysBefore: 2,
        title: `Revision & Practice Questions: ${subjectTopicContext}`,
        description: `Focused review of core syllabus concepts combined with high-yield practice drills.`,
        phase: 'practice',
        defaultMinutes: 50
      }));
      stages.push(createStage({
        daysBefore: 1,
        title: `Final Revision & Formula Audit`,
        description: `Consolidate key concepts, review past mistakes, and double-check high-frequency problem types.`,
        phase: 'review',
        defaultMinutes: 35
      }));
      stages.push(createStage({
        daysBefore: 0,
        title: `Test Day: Attempt ${targetTitle}`,
        description: `Official test attempt and performance tracking.`,
        phase: 'submission',
        defaultMinutes: 45
      }));
    } else if (diffDays === 1) {
      // 1 day remaining (Tomorrow)
      stages.push(createStage({
        daysBefore: 1,
        title: `High-Yield Crash Revision & Practice Questions`,
        description: `Intensive revision of key concepts and practice of high-probability questions.`,
        phase: 'practice',
        defaultMinutes: 60
      }));
      stages.push(createStage({
        daysBefore: 0,
        title: `Test Day: Final Formula Check & Attempt Test`,
        description: `Quick morning refresh followed by official test execution.`,
        phase: 'submission',
        defaultMinutes: 45
      }));
    } else {
      // Same day test
      stages.push(createStage({
        daysBefore: 0,
        title: `Pre-Test Quick Formula & Notes Check`,
        description: `Brief 20-minute review of formulas and key rules.`,
        phase: 'review',
        defaultMinutes: 20
      }));
      stages.push(createStage({
        daysBefore: 0,
        title: `Attempt ${targetTitle}`,
        description: `Official test execution and submission.`,
        phase: 'submission',
        defaultMinutes: 45
      }));
    }
  } else {
    // Assignment / Project / Homework timeline
    if (diffDays >= 3) {
      stages.push(createStage({
        daysBefore: Math.min(diffDays, 3),
        title: `Phase 1: Research & Problem Decomposition`,
        description: `Gather requirements, review syllabus concepts, and outline the solution structure.`,
        phase: 'research',
        defaultMinutes: Math.round(totalEstimatedMinutes * 0.3) || 30
      }));
      stages.push(createStage({
        daysBefore: 2,
        title: `Phase 2: Core Execution & Problem Solving`,
        description: `Draft primary solutions, code/write main sections, and resolve difficult components.`,
        phase: 'drafting',
        defaultMinutes: Math.round(totalEstimatedMinutes * 0.45) || 45
      }));
      stages.push(createStage({
        daysBefore: 1,
        title: `Phase 3: Verification, Citation & Quality Polish`,
        description: `Verify answers against marking rubric, proofread, and format neatly.`,
        phase: 'review',
        defaultMinutes: Math.round(totalEstimatedMinutes * 0.25) || 25
      }));
      stages.push(createStage({
        daysBefore: 0,
        title: `Deadline Day: Final Submission of ${targetTitle}`,
        description: `Final check and upload or submission before the deadline.`,
        phase: 'submission',
        defaultMinutes: 15
      }));
    } else if (diffDays >= 1) {
      stages.push(createStage({
        daysBefore: 1,
        title: `Core Execution & Drafting: ${targetTitle}`,
        description: `Work through assignment questions and assemble final solution draft.`,
        phase: 'drafting',
        defaultMinutes: Math.round(totalEstimatedMinutes * 0.7) || 50
      }));
      stages.push(createStage({
        daysBefore: 0,
        title: `Final Review & Submission`,
        description: `Proofread, format, and submit before deadline.`,
        phase: 'submission',
        defaultMinutes: 20
      }));
    } else {
      stages.push(createStage({
        daysBefore: 0,
        title: `Same-Day Completion & Submission: ${targetTitle}`,
        description: `Focused sprint to finish and submit today.`,
        phase: 'submission',
        defaultMinutes: Math.min(totalEstimatedMinutes, 60)
      }));
    }
  }

  const totalMinutes = stages.reduce((acc, s) => acc + s.estimatedMinutes, 0);
  const workloadSummary = `Timeline optimized across ${stages.length} milestones considering daily study load.`;

  return {
    stages,
    totalMinutes,
    workloadSummary
  };
}

/**
 * Converts PrepTimelineStage[] to standard AssignmentSubtask[] for storage.
 */
export function prepStagesToSubtasks(stages: PrepTimelineStage[]): AssignmentSubtask[] {
  return stages.map(s => ({
    id: s.id,
    title: s.title,
    phase: s.phase,
    estimatedMinutes: s.estimatedMinutes,
    completed: s.completed,
    completedAt: s.completedAt,
    scheduledDate: s.scheduledDate,
    timeslot: s.timeslot
  }));
}

/**
 * Converts stored AssignmentSubtask[] to PrepTimelineStage[] with full workload evaluation.
 */
export function subtasksToPrepStages(
  subtasks: AssignmentSubtask[],
  targetDate: string,
  plans: StudyPlan[] = [],
  scheduledTasks: ScheduledStudyTask[] = [],
  assignments: Assignment[] = []
): PrepTimelineStage[] {
  return subtasks.map(st => {
    const candidateDate = st.scheduledDate || targetDate;
    const workload = getWorkloadForDate(candidateDate, plans, scheduledTasks, assignments);
    const daysBefore = targetDate && candidateDate ? Math.max(0, Math.round((new Date(targetDate).getTime() - new Date(candidateDate).getTime()) / (1000 * 3600 * 24))) : 0;

    return {
      id: st.id,
      title: st.title,
      description: `Phase: ${st.phase}. Scheduled for ${st.timeslot || 'afternoon'}.`,
      phase: st.phase,
      scheduledDate: candidateDate,
      timeslot: st.timeslot || 'afternoon',
      estimatedMinutes: st.estimatedMinutes || 30,
      completed: !!st.completed,
      completedAt: st.completedAt,
      daysBeforeTarget: daysBefore,
      workloadContext: {
        dayLevel: workload.level,
        totalMinutesOnDay: workload.totalMinutes,
        taskCountOnDay: workload.taskCount,
        note: `Workload on ${candidateDate} is ${workload.level.toLowerCase()} (${workload.totalMinutes}m).`
      }
    };
  });
}

/**
 * Syncs prep timeline stages into the user's daily study plans (StudyPlan[]).
 */
export function syncPrepStagesToDailyPlans(
  stages: PrepTimelineStage[],
  subjectName: string,
  chapterName: string = 'Test Preparation',
  plans: StudyPlan[] = [],
  onSavePlan?: (plan: StudyPlan | Omit<StudyPlan, 'id'>) => Promise<void> | void
): { addedCount: number } {
  let addedCount = 0;

  stages.forEach(stage => {
    const targetDate = stage.scheduledDate;
    const newTopic: StudyPlanTopic = {
      id: `plan_prep_${stage.id}`,
      subjectName,
      chapterName,
      topicName: stage.title,
      estimatedMinutes: stage.estimatedMinutes,
      priority: stage.daysBeforeTarget <= 1 ? 'High' : 'Medium',
      reason: `Automated preparation timeline for upcoming test/deadline (${stage.daysBeforeTarget} day${stage.daysBeforeTarget === 1 ? '' : 's'} before).`,
      completed: stage.completed
    };

    const existingPlan = plans.find(p => p.date === targetDate);
    if (existingPlan) {
      const alreadyHas = (existingPlan.topics || []).some(t => t.topicName === stage.title);
      if (!alreadyHas && onSavePlan) {
        const updatedTopics = [...(existingPlan.topics || []), newTopic];
        onSavePlan({
          ...existingPlan,
          topics: updatedTopics
        });
        addedCount++;
      }
    } else if (onSavePlan) {
      onSavePlan({
        userId: '',
        date: targetDate,
        title: `Daily Plan — ${subjectName} Prep`,
        topics: [newTopic],
        reasoning: `Intelligent preparation schedule for upcoming test on ${targetDate}.`,
        availableHours: 3,
        createdAt: new Date().toISOString()
      });
      addedCount++;
    }
  });

  return { addedCount };
}

/**
 * Syncs prep timeline stages into ScheduledStudyTask[] for calendar display.
 */
export function syncPrepStagesToScheduledTasks(
  stages: PrepTimelineStage[],
  subjectName: string,
  deadlineId?: string
): ScheduledStudyTask[] {
  return stages.map(s => ({
    id: `sched_prep_${s.id}`,
    date: s.scheduledDate,
    title: s.title,
    subjectName,
    durationMinutes: s.estimatedMinutes,
    completed: s.completed,
    priority: s.daysBeforeTarget <= 1 ? 'High' : 'Medium',
    timeslot: s.timeslot,
    deadlineId
  }));
}
