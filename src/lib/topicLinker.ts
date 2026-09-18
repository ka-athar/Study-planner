import { Subject, Topic, Chapter, TestResult, StudySession, TopicStatus } from '../types';

export interface IndexedTopic {
  id: string;
  topicId: string;
  topicName: string;
  topicNumber: string; // e.g. "1.1", "2.3"
  globalNumber: number; // e.g. 1, 2, 3...
  chapterId: string;
  chapterName: string;
  chapterIndex: number;
  subjectId: string;
  subjectName: string;
  subjectIcon: string;
  status: string;
  weakNotes?: string;
  latestTestScore?: string;
  latestTestPercentage?: number;
  testCount?: number;
}

export interface WeakTopicItem {
  topicId: string;
  topicName: string;
  topicNumber?: string;
  chapterName: string;
  subjectName: string;
  subjectIcon: string;
  averageScorePercentage: number;
  latestScore: string;
  testCount: number;
  recentMistakes: string[];
  lastTestedDate: string;
  severity: 'Critical' | 'Moderate' | 'Needs Practice';
  recommendedAction: string;
  tutorPrompt: string;
}

/**
 * Indexes all topics across all subjects with standardized topic numbers (e.g. 1.1, 1.2, 2.1)
 * and global sequential indices (#1, #2, #3).
 */
export function indexSyllabusTopics(subjects: Subject[]): IndexedTopic[] {
  const indexed: IndexedTopic[] = [];
  let globalIndex = 1;

  subjects.forEach((subject) => {
    (subject.chapters || []).forEach((chapter, chapIdx) => {
      const chapterNum = chapIdx + 1;
      (chapter.topics || []).forEach((topic, topIdx) => {
        const topicSubNum = topIdx + 1;
        const canonicalTopicNumber = `${chapterNum}.${topicSubNum}`;
        const displayedTopicNumber = topic.topicNumber || canonicalTopicNumber;

        indexed.push({
          id: `${subject.id}-${chapter.id}-${topic.id}`,
          topicId: topic.id,
          topicName: topic.name,
          topicNumber: displayedTopicNumber,
          globalNumber: globalIndex++,
          chapterId: chapter.id,
          chapterName: chapter.name,
          chapterIndex: chapterNum,
          subjectId: subject.id,
          subjectName: subject.name,
          subjectIcon: subject.icon || '📚',
          status: topic.status || 'Not Started',
          weakNotes: topic.weakNotes,
          latestTestScore: topic.latestTestScore,
          latestTestPercentage: topic.latestTestPercentage,
          testCount: topic.testCount || 0
        });
      });
    });
  });

  return indexed;
}

export interface MultiTopicParseResult {
  matchedTopics: IndexedTopic[];
  rawTokens: string[];
  isRange: boolean;
  isMulti: boolean;
  querySummary: string;
  topicNumbers: string[];
  topicNames: string[];
  unmatchedTokens: string[];
}

/**
 * Parses multiple topics or ranges from user queries such as:
 * - "3.1, 3.2, and 3.3"
 * - "3.1 to 3.3" or "3.1 - 3.3"
 * - "3.1, 3.2, 3.3"
 * - "Topics 3.1 & 3.2 & 3.3"
 * - "1 to 4"
 * - "Thermodynamics, Hess's Law, and Entropy"
 */
export function parseMultiTopicQuery(
  inputQuery: string,
  subjects: Subject[],
  preferredSubject?: string
): MultiTopicParseResult {
  if (!inputQuery || !inputQuery.trim()) {
    return {
      matchedTopics: [],
      rawTokens: [],
      isRange: false,
      isMulti: false,
      querySummary: '',
      topicNumbers: [],
      topicNames: [],
      unmatchedTokens: []
    };
  }

  const query = inputQuery.trim();
  const allIndexed = indexSyllabusTopics(subjects);
  const candidatePool = preferredSubject && preferredSubject !== 'all'
    ? allIndexed.filter(t => t.subjectName.toLowerCase() === preferredSubject.toLowerCase())
    : allIndexed;
  const pool = candidatePool.length > 0 ? candidatePool : allIndexed;

  const matchedSet = new Map<string, IndexedTopic>();
  const rawTokens: string[] = [];
  const unmatchedTokens: string[] = [];
  let isRange = false;

  // 1. Check for Dot Notation Range (e.g. "3.1 to 3.3", "3.1 - 3.3", "3.1..3.3", "3.1 through 3.3")
  const dotRangeRegex = /(?:topic|topics|t|#)?\s*([0-9]+)\.([0-9]+)\s*(?:to|-|\.\.|through|until)\s*(?:topic|topics|t|#)?\s*([0-9]+)\.([0-9]+)/i;
  const dotRangeMatch = query.match(dotRangeRegex);

  if (dotRangeMatch) {
    isRange = true;
    const c1 = parseInt(dotRangeMatch[1], 10);
    const s1 = parseInt(dotRangeMatch[2], 10);
    const c2 = parseInt(dotRangeMatch[3], 10);
    const s2 = parseInt(dotRangeMatch[4], 10);

    if (c1 === c2) {
      const startSub = Math.min(s1, s2);
      const endSub = Math.max(s1, s2);
      for (let s = startSub; s <= endSub; s++) {
        const numStr = `${c1}.${s}`;
        rawTokens.push(numStr);
        const match = pool.find(t => t.topicNumber === numStr || t.topicNumber === `${c1}.${s}`);
        if (match) {
          matchedSet.set(match.topicId, match);
        } else {
          // If not in syllabus pool, try matching by global sequential index or fallback
          const fallback = findMatchingTopic(numStr, subjects, preferredSubject);
          if (fallback) matchedSet.set(fallback.topicId, fallback);
          else unmatchedTokens.push(numStr);
        }
      }
    } else {
      // Cross chapter range
      for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
        const startSub = (c === c1) ? s1 : 1;
        const endSub = (c === c2) ? s2 : 10;
        for (let s = startSub; s <= endSub; s++) {
          const numStr = `${c}.${s}`;
          const match = pool.find(t => t.topicNumber === numStr);
          if (match) {
            rawTokens.push(numStr);
            matchedSet.set(match.topicId, match);
          }
        }
      }
    }
  }

  // 2. Check for Single Integer Range (e.g. "1 to 4", "Topic 1 - 3")
  if (!dotRangeMatch) {
    const intRangeRegex = /(?:topic|topics|t|#)?\s*([0-9]+)\s*(?:to|-|\.\.|through)\s*(?:topic|topics|t|#)?\s*([0-9]+)/i;
    const intRangeMatch = query.match(intRangeRegex);
    if (intRangeMatch && !query.includes('.')) {
      const startInt = parseInt(intRangeMatch[1], 10);
      const endInt = parseInt(intRangeMatch[2], 10);
      if (startInt > 0 && endInt >= startInt && (endInt - startInt) <= 25) {
        isRange = true;
        for (let i = startInt; i <= endInt; i++) {
          const token = String(i);
          rawTokens.push(token);
          const match = pool.find(t => t.globalNumber === i || t.topicNumber === `${i}` || t.topicNumber === `1.${i}`);
          if (match) {
            matchedSet.set(match.topicId, match);
          } else {
            unmatchedTokens.push(token);
          }
        }
      }
    }
  }

  // 3. Check for Delimited Lists (e.g. "3.1, 3.2, and 3.3", "3.1 & 3.2", "3.1; 3.2; 3.3", "3.1 + 3.2")
  if (matchedSet.size === 0) {
    const splitTokens = query
      .split(/(?:,|\band\b|&|;|\+)+/i)
      .map(t => t.trim())
      .filter(t => t.length > 0 && !['topics', 'topic', 'chapter', 'and', 'the'].includes(t.toLowerCase()));

    if (splitTokens.length > 1) {
      splitTokens.forEach(tok => {
        rawTokens.push(tok);
        const match = findMatchingTopic(tok, subjects, preferredSubject);
        if (match) {
          matchedSet.set(match.topicId, match);
        } else {
          unmatchedTokens.push(tok);
        }
      });
    }
  }

  // 4. Single Topic Fallback
  if (matchedSet.size === 0 && rawTokens.length === 0) {
    rawTokens.push(query);
    const singleMatch = findMatchingTopic(query, subjects, preferredSubject);
    if (singleMatch) {
      matchedSet.set(singleMatch.topicId, singleMatch);
    } else {
      unmatchedTokens.push(query);
    }
  }

  const matchedList = Array.from(matchedSet.values());
  const topicNumbers = matchedList.map(t => t.topicNumber);
  const topicNames = matchedList.map(t => t.topicName);

  let summary = '';
  if (matchedList.length > 0) {
    if (isRange && topicNumbers.length > 1) {
      summary = `Range ${topicNumbers[0]} to ${topicNumbers[topicNumbers.length - 1]} (${matchedList.length} topics: ${topicNames.join(', ')})`;
    } else if (matchedList.length > 1) {
      summary = `${matchedList.length} Topics: ${matchedList.map(t => `#${t.topicNumber} ${t.topicName}`).join(', ')}`;
    } else {
      summary = `#${matchedList[0].topicNumber} ${matchedList[0].topicName}`;
    }
  } else {
    summary = query;
  }

  return {
    matchedTopics: matchedList,
    rawTokens,
    isRange,
    isMulti: matchedList.length > 1 || rawTokens.length > 1,
    querySummary: summary,
    topicNumbers,
    topicNames,
    unmatchedTokens
  };
}

/**
 * Finds a matching topic in the syllabus by topic number (e.g. "1.1", "Topic 2", "#4", "2.3"),
 * topic name, or combined subject + number query.
 */
export function findMatchingTopic(
  query: string,
  subjects: Subject[],
  preferredSubject?: string
): IndexedTopic | null {
  if (!query || !query.trim()) return null;
  let clean = query.trim().toLowerCase();
  
  // Strip common noisy prefixes
  clean = clean.replace(/^(topic|topics|t|chapter|ch|subtopic|unit)\s*[:#-]?\s*/i, '').trim();

  const allIndexed = indexSyllabusTopics(subjects);
  if (allIndexed.length === 0) return null;

  // Filter by preferred subject if specified
  const candidatePool = preferredSubject && preferredSubject !== 'all'
    ? allIndexed.filter(t => t.subjectName.toLowerCase() === preferredSubject.toLowerCase())
    : allIndexed;

  const pool = candidatePool.length > 0 ? candidatePool : allIndexed;

  // 1. Exact match on topicNumber (e.g. "1.1", "2.3")
  const exactNumberMatch = pool.find(t => 
    t.topicNumber.toLowerCase() === clean ||
    `#${t.topicNumber}`.toLowerCase() === clean ||
    `t${t.topicNumber}`.toLowerCase() === clean ||
    `topic ${t.topicNumber}`.toLowerCase() === clean ||
    t.topicNumber.toLowerCase() === query.trim().toLowerCase()
  );
  if (exactNumberMatch) return exactNumberMatch;

  // 2. Global sequential number or dot notation match (e.g. "1.2", "4", "#5")
  const numericOnly = clean.replace(/[^0-9.]/g, '');
  if (numericOnly) {
    if (numericOnly.includes('.')) {
      const dotMatch = pool.find(t => t.topicNumber === numericOnly);
      if (dotMatch) return dotMatch;
    } else {
      const intVal = parseInt(numericOnly, 10);
      const globalMatch = pool.find(t => t.globalNumber === intVal);
      if (globalMatch) return globalMatch;
      const ch1Match = pool.find(t => t.topicNumber === `1.${intVal}` || t.topicNumber === `${intVal}`);
      if (ch1Match) return ch1Match;
    }
  }

  // 3. Exact match on topic name
  const exactNameMatch = pool.find(t => t.topicName.toLowerCase() === clean || t.topicName.toLowerCase() === query.trim().toLowerCase());
  if (exactNameMatch) return exactNameMatch;

  // 4. Fuzzy / Contains match on topic name
  const containsNameMatch = pool.find(t => 
    t.topicName.toLowerCase().includes(clean) || clean.includes(t.topicName.toLowerCase())
  );
  if (containsNameMatch) return containsNameMatch;

  // 5. Check if query is "SubjectName TopicNumber" (e.g. "Physics 1.1")
  for (const t of allIndexed) {
    const combined = `${t.subjectName} ${t.topicNumber}`.toLowerCase();
    const combinedWithTopic = `${t.subjectName} topic ${t.topicNumber}`.toLowerCase();
    if (clean.includes(combined) || clean.includes(combinedWithTopic)) {
      return t;
    }
  }

  return null;
}

/**
 * Parses raw score strings (e.g., "85", "42/50", "84%", "18 / 20", "90 out of 100")
 * into normalized numerical percentage, obtained marks, and total marks.
 */
export function calculateScorePercentage(
  scoreStr: string,
  totalMarksHint?: number
): {
  percentage: number;
  obtainedMarks?: number;
  totalMarks?: number;
  formattedScore: string;
} {
  if (!scoreStr) return { percentage: 0, formattedScore: '0%' };

  const clean = scoreStr.trim();

  // Pattern: "42/50" or "42 / 50"
  const fractionMatch = clean.match(/^([0-9.]+)\s*\/\s*([0-9.]+)$/);
  if (fractionMatch) {
    const obtained = parseFloat(fractionMatch[1]);
    const total = parseFloat(fractionMatch[2]);
    if (!isNaN(obtained) && !isNaN(total) && total > 0) {
      const pct = Math.min(100, Math.max(0, Math.round((obtained / total) * 100)));
      return {
        percentage: pct,
        obtainedMarks: obtained,
        totalMarks: total,
        formattedScore: `${obtained}/${total} (${pct}%)`
      };
    }
  }

  // Pattern: "42 out of 50"
  const outOfMatch = clean.match(/^([0-9.]+)\s*out\s*of\s*([0-9.]+)$/i);
  if (outOfMatch) {
    const obtained = parseFloat(outOfMatch[1]);
    const total = parseFloat(outOfMatch[2]);
    if (!isNaN(obtained) && !isNaN(total) && total > 0) {
      const pct = Math.min(100, Math.max(0, Math.round((obtained / total) * 100)));
      return {
        percentage: pct,
        obtainedMarks: obtained,
        totalMarks: total,
        formattedScore: `${obtained}/${total} (${pct}%)`
      };
    }
  }

  // Pattern: "85%" or "85"
  const numericOnly = parseFloat(clean.replace(/[^0-9.]/g, ''));
  if (!isNaN(numericOnly)) {
    if (totalMarksHint && totalMarksHint > 0 && numericOnly <= totalMarksHint && !clean.includes('%')) {
      const pct = Math.min(100, Math.max(0, Math.round((numericOnly / totalMarksHint) * 100)));
      return {
        percentage: pct,
        obtainedMarks: numericOnly,
        totalMarks: totalMarksHint,
        formattedScore: `${numericOnly}/${totalMarksHint} (${pct}%)`
      };
    }
    const pct = Math.min(100, Math.max(0, Math.round(numericOnly)));
    return {
      percentage: pct,
      obtainedMarks: pct,
      totalMarks: 100,
      formattedScore: `${pct}%`
    };
  }

  return { percentage: 0, formattedScore: clean };
}

/**
 * Computes weak topics from the last 7 days (or customizable day lookback)
 * based on tests scored < 70%, logged mistakes, or failed study sessions.
 */
export function getWeakTopicsLastWeek(
  testResults: TestResult[],
  sessions: StudySession[] = [],
  subjects: Subject[] = [],
  daysLookback: number = 7
): WeakTopicItem[] {
  const now = Date.now();
  const lookbackMs = daysLookback * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(now - lookbackMs).toISOString().split('T')[0];

  const indexedTopics = indexSyllabusTopics(subjects);
  const topicMap = new Map<string, {
    topicId: string;
    topicName: string;
    topicNumber?: string;
    chapterName: string;
    subjectName: string;
    subjectIcon: string;
    scores: number[];
    mistakes: string[];
    lastDate: string;
  }>();

  // 1. Scan Test Results within lookback window
  testResults.forEach(test => {
    if (test.date >= cutoffDate) {
      const parsed = calculateScorePercentage(test.score, test.totalMarks || test.maxScore);
      const isWeak = parsed.percentage < 70 || (test.mistakes && test.mistakes.trim().length > 0);

      if (isWeak) {
        // Resolve matching topic
        let matched = test.topicId ? indexedTopics.find(t => t.topicId === test.topicId) : null;
        if (!matched && test.topicNumber) {
          matched = findMatchingTopic(test.topicNumber, subjects, test.subjectName);
        }
        if (!matched && test.topicName) {
          matched = findMatchingTopic(test.topicName, subjects, test.subjectName);
        }
        if (!matched && test.struggledTopics && test.struggledTopics.length > 0) {
          matched = findMatchingTopic(test.struggledTopics[0], subjects, test.subjectName);
        }

        const key = matched ? matched.topicId : `${test.subjectName}-${test.topicName || test.testName}`;
        const existing = topicMap.get(key) || {
          topicId: matched?.topicId || `temp-${key}`,
          topicName: matched?.topicName || test.topicName || test.testName,
          topicNumber: matched?.topicNumber || test.topicNumber,
          chapterName: matched?.chapterName || test.chapterName || 'Core Curriculum',
          subjectName: matched?.subjectName || test.subjectName,
          subjectIcon: matched?.subjectIcon || '📚',
          scores: [],
          mistakes: [],
          lastDate: test.date
        };

        existing.scores.push(parsed.percentage);
        if (test.mistakes && !existing.mistakes.includes(test.mistakes)) {
          existing.mistakes.push(test.mistakes);
        }
        if (test.date > existing.lastDate) {
          existing.lastDate = test.date;
        }

        topicMap.set(key, existing);
      }
    }
  });

  // 2. Scan Study Sessions within lookback window for 'Partially completed' / 'Not completed'
  sessions.forEach(sess => {
    if (sess.date >= cutoffDate && (sess.result === 'Partially completed' || sess.result === 'Not completed')) {
      const matched = findMatchingTopic(sess.topicName, subjects, sess.subjectName);
      const key = matched ? matched.topicId : `${sess.subjectName}-${sess.topicName}`;

      const existing = topicMap.get(key) || {
        topicId: matched?.topicId || `temp-${key}`,
        topicName: matched?.topicName || sess.topicName,
        topicNumber: matched?.topicNumber,
        chapterName: matched?.chapterName || sess.chapterName || 'Core Curriculum',
        subjectName: matched?.subjectName || sess.subjectName,
        subjectIcon: matched?.subjectIcon || '📚',
        scores: [sess.result === 'Partially completed' ? 50 : 30],
        mistakes: sess.notes ? [sess.notes] : [],
        lastDate: sess.date
      };

      if (sess.notes && !existing.mistakes.includes(sess.notes)) {
        existing.mistakes.push(sess.notes);
      }
      if (sess.date > existing.lastDate) {
        existing.lastDate = sess.date;
      }

      topicMap.set(key, existing);
    }
  });

  // Also include topics marked as 'Weak' or 'Needs Revision' in the syllabus
  indexedTopics.forEach(t => {
    if (t.status === 'Weak' || t.status === 'Needs Revision') {
      if (!topicMap.has(t.topicId)) {
        topicMap.set(t.topicId, {
          topicId: t.topicId,
          topicName: t.topicName,
          topicNumber: t.topicNumber,
          chapterName: t.chapterName,
          subjectName: t.subjectName,
          subjectIcon: t.subjectIcon,
          scores: t.latestTestPercentage ? [t.latestTestPercentage] : [t.status === 'Weak' ? 45 : 65],
          mistakes: t.weakNotes ? [t.weakNotes] : [],
          lastDate: new Date().toISOString().split('T')[0]
        });
      }
    }
  });

  // Transform to WeakTopicItem list
  const results: WeakTopicItem[] = Array.from(topicMap.values()).map(item => {
    const avg = item.scores.length > 0
      ? Math.round(item.scores.reduce((a, b) => a + b, 0) / item.scores.length)
      : 50;

    let severity: 'Critical' | 'Moderate' | 'Needs Practice' = 'Needs Practice';
    if (avg < 50) severity = 'Critical';
    else if (avg < 70) severity = 'Moderate';

    let recommendedAction = '30-min targeted drill & formula review';
    if (severity === 'Critical') {
      recommendedAction = 'Fundamental concept review with AI Tutor & flashcards';
    } else if (severity === 'Moderate') {
      recommendedAction = 'Active recall quiz & timed practice test';
    }

    const tutorPrompt = `I need help remediating weak topic "${item.topicName}" in ${item.subjectName} (${item.chapterName}). My recent test score was ${avg}%. Mistakes made: ${item.mistakes.join('; ') || 'General retention gap'}. Please give me a 3-step conceptual explanation and 2 practice drill questions to fix this.`;

    return {
      topicId: item.topicId,
      topicName: item.topicName,
      topicNumber: item.topicNumber,
      chapterName: item.chapterName,
      subjectName: item.subjectName,
      subjectIcon: item.subjectIcon,
      averageScorePercentage: avg,
      latestScore: `${avg}%`,
      testCount: item.scores.length,
      recentMistakes: item.mistakes,
      lastTestedDate: item.lastDate,
      severity,
      recommendedAction,
      tutorPrompt
    };
  });

  // Sort by severity (Critical first) and lowest score
  return results.sort((a, b) => a.averageScorePercentage - b.averageScorePercentage);
}

/**
 * Updates a topic's status and latest test metrics inside the Subject list
 * when a test is scored or uploaded. Supports multi-topic updates (e.g. 3.1, 3.2, 3.3).
 */
export function applyTestScoreToSyllabus(
  subjects: Subject[],
  test: Omit<TestResult, 'id'> | TestResult
): { updatedSubjects: Subject[]; matchedTopic: IndexedTopic | null; matchedTopics: IndexedTopic[] } {
  const parsed = calculateScorePercentage(test.score, test.totalMarks || test.maxScore);
  
  // Resolve all topics associated with the test
  let matchedList: IndexedTopic[] = [];

  // Check if explicit topicIds exist
  if (test.topicIds && test.topicIds.length > 0) {
    const allIndexed = indexSyllabusTopics(subjects);
    matchedList = allIndexed.filter(t => test.topicIds!.includes(t.topicId));
  }

  // Check multi-topic query on topicNumber or topicName
  if (matchedList.length === 0 && (test.topicNumber || test.topicName)) {
    const multiParsed = parseMultiTopicQuery(test.topicNumber || test.topicName || '', subjects, test.subjectName);
    matchedList = multiParsed.matchedTopics;
  }

  // Check single match fallback
  if (matchedList.length === 0) {
    const single = findMatchingTopic(
      test.topicNumber || test.topicName || test.testName,
      subjects,
      test.subjectName
    );
    if (single) matchedList = [single];
  }

  if (matchedList.length === 0) {
    return { updatedSubjects: subjects, matchedTopic: null, matchedTopics: [] };
  }

  // Determine new topic status based on score
  let newStatus: TopicStatus = 'In Progress';
  if (parsed.percentage >= 85) {
    newStatus = 'Mastered';
  } else if (parsed.percentage >= 75) {
    newStatus = 'Completed';
  } else if (parsed.percentage >= 60) {
    newStatus = 'Needs Revision';
  } else {
    newStatus = 'Weak';
  }

  const matchedTopicIds = new Set(matchedList.map(m => m.topicId));
  const matchedSubjectIds = new Set(matchedList.map(m => m.subjectId));

  const updatedSubjects = subjects.map(s => {
    if (!matchedSubjectIds.has(s.id) && s.name.toLowerCase() !== test.subjectName.toLowerCase()) {
      return s;
    }
    return {
      ...s,
      chapters: s.chapters.map(c => {
        return {
          ...c,
          topics: c.topics.map(t => {
            if (!matchedTopicIds.has(t.id)) {
              // Also check matching by name or topicNumber in this chapter
              const matchInList = matchedList.find(m => m.topicName.toLowerCase() === t.name.toLowerCase() || m.topicNumber === t.topicNumber);
              if (!matchInList) return t;
            }
            const matchInfo = matchedList.find(m => m.topicId === t.id) || matchedList[0];
            return {
              ...t,
              status: newStatus,
              topicNumber: t.topicNumber || matchInfo?.topicNumber,
              latestTestScore: parsed.formattedScore,
              latestTestPercentage: parsed.percentage,
              testCount: (t.testCount || 0) + 1,
              weakNotes: test.mistakes ? test.mistakes : t.weakNotes,
              lastStudiedAt: test.date || new Date().toISOString().split('T')[0]
            };
          })
        };
      })
    };
  });

  return { updatedSubjects, matchedTopic: matchedList[0] || null, matchedTopics: matchedList };
}

export interface ParsedScoreRow {
  rawLine: string;
  topicNumberQuery: string;
  matchedTopic: IndexedTopic | null;
  subjectName: string;
  testName: string;
  scoreStr: string;
  percentage: number;
  date: string;
  mistakes: string;
  status: 'valid' | 'warning' | 'error';
  statusMessage?: string;
}

/**
 * Parses multi-line test data (CSV, TSV, JSON, or copy-pasted scores).
 * Auto-resolves topic numbers or names to syllabus topics.
 */
export function parseTestScoreData(
  rawText: string,
  subjects: Subject[],
  defaultSubject?: string
): ParsedScoreRow[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.trim().split('\n').filter(l => l.trim().length > 0);
  const results: ParsedScoreRow[] = [];
  const todayStr = new Date().toISOString().split('T')[0];

  // Check if JSON format
  if (rawText.trim().startsWith('[') && rawText.trim().endsWith(']')) {
    try {
      const parsedJson = JSON.parse(rawText);
      if (Array.isArray(parsedJson)) {
        parsedJson.forEach((item: any) => {
          const topicQuery = item.topicNumber || item.topic || item.topic_id || item.topic_number || item.topicName || '';
          const subject = item.subject || item.subjectName || defaultSubject || subjects[0]?.name || 'General';
          const score = item.score || item.marks || item.percentage || '0';
          const testTitle = item.testName || item.test || item.title || `Test on ${topicQuery || subject}`;
          const date = item.date || todayStr;
          const mistakes = item.mistakes || item.notes || item.weakness || '';

          const matched = findMatchingTopic(String(topicQuery), subjects, subject);
          const scoreCalc = calculateScorePercentage(String(score));

          results.push({
            rawLine: JSON.stringify(item),
            topicNumberQuery: String(topicQuery),
            matchedTopic: matched,
            subjectName: matched ? matched.subjectName : subject,
            testName: testTitle,
            scoreStr: scoreCalc.formattedScore,
            percentage: scoreCalc.percentage,
            date,
            mistakes: String(mistakes),
            status: matched ? 'valid' : 'warning',
            statusMessage: matched ? `Linked to ${matched.topicNumber} (${matched.topicName})` : 'Unmatched topic number — will link by subject'
          });
        });
        return results;
      }
    } catch (e) {}
  }

  // Parse CSV, TSV, or comma/pipe separated lines
  lines.forEach((line) => {
    // Skip comment lines or pure header line if detected
    const lowerLine = line.toLowerCase();
    if (lowerLine.startsWith('topic') && (lowerLine.includes('score') || lowerLine.includes('subject'))) {
      return;
    }

    // Split by delimiter: comma, tab, pipe, or semicolon
    let parts: string[] = [];
    if (line.includes('\t')) parts = line.split('\t');
    else if (line.includes('|')) parts = line.split('|');
    else if (line.includes(';')) parts = line.split(';');
    else parts = line.split(',');

    parts = parts.map(p => p.trim());
    if (parts.length === 0) return;

    // Flexible column interpretations:
    // Format 1: TopicNumber, Score, Mistakes
    // Format 2: TopicNumber, TestName, Score, Date, Mistakes
    // Format 3: Subject, TopicNumber, Score, Mistakes
    let topicQuery = '';
    let testTitle = '';
    let scoreStr = '';
    let date = todayStr;
    let mistakes = '';
    let subjectName = defaultSubject || subjects[0]?.name || 'General';

    if (parts.length === 1) {
      // Single value e.g. "1.1: 85%"
      const colonSplit = parts[0].split(':');
      if (colonSplit.length >= 2) {
        topicQuery = colonSplit[0].trim();
        scoreStr = colonSplit[1].trim();
      } else {
        scoreStr = parts[0];
      }
    } else if (parts.length === 2) {
      // TopicNumber, Score (e.g. "1.1, 85%")
      topicQuery = parts[0];
      scoreStr = parts[1];
    } else if (parts.length === 3) {
      // TopicNumber, Score, Mistakes
      topicQuery = parts[0];
      scoreStr = parts[1];
      mistakes = parts[2];
    } else if (parts.length === 4) {
      // TopicNumber, TestTitle, Score, Mistakes
      topicQuery = parts[0];
      testTitle = parts[1];
      scoreStr = parts[2];
      mistakes = parts[3];
    } else {
      // TopicNumber, Subject, TestTitle, Score, Date, Mistakes
      topicQuery = parts[0];
      subjectName = parts[1] || subjectName;
      testTitle = parts[2];
      scoreStr = parts[3];
      date = parts[4] || todayStr;
      mistakes = parts.slice(5).join(', ');
    }

    const matched = findMatchingTopic(topicQuery, subjects, subjectName);
    const scoreCalc = calculateScorePercentage(scoreStr);
    const finalSubject = matched ? matched.subjectName : subjectName;
    const finalTestTitle = testTitle.trim() || `Test: ${matched ? `${matched.topicNumber} ${matched.topicName}` : topicQuery || finalSubject}`;

    results.push({
      rawLine: line,
      topicNumberQuery: topicQuery,
      matchedTopic: matched,
      subjectName: finalSubject,
      testName: finalTestTitle,
      scoreStr: scoreCalc.formattedScore,
      percentage: scoreCalc.percentage,
      date,
      mistakes,
      status: matched ? 'valid' : 'warning',
      statusMessage: matched
        ? `Linked to ${matched.subjectName} > ${matched.topicNumber} (${matched.topicName})`
        : `Topic "${topicQuery}" not found in syllabus — will save as general test score`
    });
  });

  return results;
}
