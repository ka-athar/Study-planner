import { Subject, TestResult, StudySession, RevisionItem, StudyPlanTopic } from '../types';

/**
 * High-performance computation caching & decoupled analytics module (Option 2 & 3).
 * Pre-aggregates topic mastery, test statistics, and forgetting curve health.
 * Prevents redundant $O(n^2)$ re-calculations across deep visualization cards.
 */

export interface CachedTopicDiagnostic {
  topicKey: string;
  subjectName: string;
  topicName: string;
  averageTestScore: number | null;
  testsCount: number;
  totalStudyMinutes: number;
  lastStudiedDate: string | null;
  retentionPercent: number; // 0 - 100 based on Ebbinghaus decay
  urgencyLevel: 'Critical' | 'Urgent' | 'Stable' | 'Mastered';
  suggestedAction: 'Flashcard Drill' | 'Timed Practice' | 'Feynman Recall' | 'Initial Study';
}

export interface NextBestActionItem {
  id: string;
  title: string;
  reason: string;
  subjectName: string;
  topicName: string;
  priority: 'Critical' | 'High' | 'Medium';
  actionType: 'flashcards' | 'timer' | 'tutor' | 'test' | 'blurt';
  targetTab: 'flashcards' | 'timer' | 'tutor' | 'tests' | 'blurt_recall';
  estimatedMinutes: number;
}

// In-memory computation cache
let cachedDiagnostics: {
  key: string;
  timestamp: number;
  data: CachedTopicDiagnostic[];
} | null = null;

let cachedNextAction: {
  key: string;
  timestamp: number;
  data: NextBestActionItem | null;
} | null = null;

/**
 * Generate a cache signature from array lengths and newest modification timestamps
 */
function makeCacheKey(
  subjects: Subject[],
  testResults: TestResult[],
  sessions: StudySession[],
  revisions: RevisionItem[]
): string {
  const latestTest = testResults[0]?.date || '';
  const latestSession = sessions[0]?.date || '';
  return `sub:${subjects.length}_test:${testResults.length}_sess:${sessions.length}_rev:${revisions.length}_t:${latestTest}_s:${latestSession}`;
}

/**
 * Safely compute retention percentage using Ebbinghaus decay curve
 */
export function calculateRetentionPercent(lastStudiedDateStr: string | null | undefined, repetitionCount: number = 1): number {
  if (!lastStudiedDateStr) return 15;
  const lastTime = new Date(lastStudiedDateStr).getTime();
  if (isNaN(lastTime)) return 20;

  const now = Date.now();
  const daysElapsed = Math.max(0, (now - lastTime) / (1000 * 60 * 60 * 24));
  
  // Stability factor increases with repetitions
  const stabilityDays = Math.max(1, Math.min(30, (repetitionCount || 1) * 3));
  // S = e^(-t / S)
  const retention = Math.exp(-daysElapsed / stabilityDays) * 100;
  return Math.max(10, Math.min(100, Math.round(retention)));
}

/**
 * Get pre-computed and cached topic diagnostic metrics
 */
export function getCachedTopicDiagnostics(
  subjects: Subject[],
  testResults: TestResult[],
  sessions: StudySession[],
  revisions: RevisionItem[] = []
): CachedTopicDiagnostic[] {
  const currentKey = makeCacheKey(subjects, testResults, sessions, revisions);
  const now = Date.now();

  // Return cached result if valid (cache TTL 15 seconds)
  if (cachedDiagnostics && cachedDiagnostics.key === currentKey && (now - cachedDiagnostics.timestamp < 15000)) {
    return cachedDiagnostics.data;
  }

  // Pre-index test results by subject and topic using normalized keys
  const testsByTopic = new Map<string, TestResult[]>();
  for (const test of testResults) {
    const key = `${(test.subjectName || '').trim().toLowerCase()}:::${(test.topicName || '').trim().toLowerCase()}`;
    const list = testsByTopic.get(key) || [];
    list.push(test);
    testsByTopic.set(key, list);
  }

  // Pre-index sessions by subject and topic
  const sessionsByTopic = new Map<string, StudySession[]>();
  for (const sess of sessions) {
    const key = `${(sess.subjectName || '').trim().toLowerCase()}:::${(sess.topicName || '').trim().toLowerCase()}`;
    const list = sessionsByTopic.get(key) || [];
    list.push(sess);
    sessionsByTopic.set(key, list);
  }

  // Pre-index revisions
  const revisionsByTopic = new Map<string, RevisionItem>();
  for (const rev of revisions) {
    const key = `${(rev.subjectName || '').trim().toLowerCase()}:::${(rev.topicName || '').trim().toLowerCase()}`;
    revisionsByTopic.set(key, rev);
  }

  const diagnostics: CachedTopicDiagnostic[] = [];

  // Single pass through syllabus
  for (const sub of subjects) {
    const subName = sub.name || 'General';
    for (const ch of sub.chapters || []) {
      for (const top of ch.topics || []) {
        const topName = top.name || '';
        const key = `${subName.trim().toLowerCase()}:::${topName.trim().toLowerCase()}`;

        const matchingTests = testsByTopic.get(key) || [];
        const matchingSessions = sessionsByTopic.get(key) || [];
        const matchingRev = revisionsByTopic.get(key);

        // Aggregate test scores
        let avgScore: number | null = null;
        if (matchingTests.length > 0) {
          const sum = matchingTests.reduce((acc, t) => {
            const val = typeof t.percentage === 'number' 
              ? t.percentage 
              : (typeof t.obtainedMarks === 'number' && t.totalMarks ? (t.obtainedMarks / t.totalMarks) * 100 : 0);
            return acc + val;
          }, 0);
          avgScore = Math.round(sum / matchingTests.length);
        }

        // Aggregate study time
        const totalMinutes = matchingSessions.reduce((acc, s) => acc + (s.durationMinutes || 0), top.timeSpentMinutes || 0);

        // Determine last studied date
        let latestDate: string | null = null;
        if (matchingSessions.length > 0) {
          latestDate = matchingSessions[0].date || null;
        } else if (matchingRev?.lastStudied) {
          latestDate = matchingRev.lastStudied;
        }

        const repCount = Math.max(matchingSessions.length, (matchingRev as any)?.repetitionCount || 1);
        const retention = calculateRetentionPercent(latestDate, repCount);

        // Determine urgency & action
        let urgency: CachedTopicDiagnostic['urgencyLevel'] = 'Stable';
        let action: CachedTopicDiagnostic['suggestedAction'] = 'Timed Practice';

        if (avgScore !== null && avgScore < 60) {
          urgency = 'Critical';
          action = 'Flashcard Drill';
        } else if (retention < 45) {
          urgency = 'Urgent';
          action = 'Feynman Recall';
        } else if (totalMinutes === 0 && (top.status === 'Not Started' || !top.status)) {
          urgency = 'Urgent';
          action = 'Initial Study';
        } else if (avgScore !== null && avgScore >= 85 && retention >= 75) {
          urgency = 'Mastered';
          action = 'Timed Practice';
        }

        diagnostics.push({
          topicKey: key,
          subjectName: subName,
          topicName: topName,
          averageTestScore: avgScore,
          testsCount: matchingTests.length,
          totalStudyMinutes: totalMinutes,
          lastStudiedDate: latestDate,
          retentionPercent: retention,
          urgencyLevel: urgency,
          suggestedAction: action
        });
      }
    }
  }

  cachedDiagnostics = {
    key: currentKey,
    timestamp: now,
    data: diagnostics
  };

  return diagnostics;
}

/**
 * Unified Study Queue: Computes the single highest-yield "Next Best Action" (Option 6).
 */
export function getNextBestAction(
  subjects: Subject[],
  testResults: TestResult[],
  sessions: StudySession[],
  revisions: RevisionItem[] = []
): NextBestActionItem | null {
  const currentKey = makeCacheKey(subjects, testResults, sessions, revisions);
  const now = Date.now();

  if (cachedNextAction && cachedNextAction.key === currentKey && (now - cachedNextAction.timestamp < 15000)) {
    return cachedNextAction.data;
  }

  const diagnostics = getCachedTopicDiagnostics(subjects, testResults, sessions, revisions);
  if (diagnostics.length === 0) return null;

  // 1. Critical Priority: Test score < 60%
  const lowScoreTopic = diagnostics.find(d => d.averageTestScore !== null && d.averageTestScore < 60);
  if (lowScoreTopic) {
    const item: NextBestActionItem = {
      id: `nba-${lowScoreTopic.topicKey}`,
      title: `Remediate Weak Area: ${lowScoreTopic.topicName}`,
      reason: `Recent test average is ${lowScoreTopic.averageTestScore}%. Immediate flashcard & active recall needed to prevent marks loss.`,
      subjectName: lowScoreTopic.subjectName,
      topicName: lowScoreTopic.topicName,
      priority: 'Critical',
      actionType: 'flashcards',
      targetTab: 'flashcards',
      estimatedMinutes: 25
    };
    cachedNextAction = { key: currentKey, timestamp: now, data: item };
    return item;
  }

  // 2. Urgent Priority: Forgetting curve retention < 40%
  const decayingTopic = diagnostics
    .filter(d => d.lastStudiedDate !== null && d.retentionPercent < 40)
    .sort((a, b) => a.retentionPercent - b.retentionPercent)[0];

  if (decayingTopic) {
    const item: NextBestActionItem = {
      id: `nba-${decayingTopic.topicKey}`,
      title: `Spaced Repetition: ${decayingTopic.topicName}`,
      reason: `Retention dropped to ~${decayingTopic.retentionPercent}% per Ebbinghaus curve. Quick blurt recall will reset memory decay.`,
      subjectName: decayingTopic.subjectName,
      topicName: decayingTopic.topicName,
      priority: 'High',
      actionType: 'blurt',
      targetTab: 'blurt_recall',
      estimatedMinutes: 20
    };
    cachedNextAction = { key: currentKey, timestamp: now, data: item };
    return item;
  }

  // 3. Unstudied Topic
  const unstudiedTopic = diagnostics.find(d => d.totalStudyMinutes === 0);
  if (unstudiedTopic) {
    const item: NextBestActionItem = {
      id: `nba-${unstudiedTopic.topicKey}`,
      title: `Start Core Topic: ${unstudiedTopic.topicName}`,
      reason: `Foundational syllabus topic in ${unstudiedTopic.subjectName} not yet covered.`,
      subjectName: unstudiedTopic.subjectName,
      topicName: unstudiedTopic.topicName,
      priority: 'Medium',
      actionType: 'timer',
      targetTab: 'timer',
      estimatedMinutes: 35
    };
    cachedNextAction = { key: currentKey, timestamp: now, data: item };
    return item;
  }

  // Default next action: practice top topic
  const topTopic = diagnostics[0];
  const defaultItem: NextBestActionItem = {
    id: `nba-${topTopic.topicKey}`,
    title: `Reinforce Mastery: ${topTopic.topicName}`,
    reason: `Review core concepts and practice exam-level problems in ${topTopic.subjectName}.`,
    subjectName: topTopic.subjectName,
    topicName: topTopic.topicName,
    priority: 'Medium',
    actionType: 'timer',
    targetTab: 'timer',
    estimatedMinutes: 30
  };

  cachedNextAction = { key: currentKey, timestamp: now, data: defaultItem };
  return defaultItem;
}
