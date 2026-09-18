import { fallbackParseCalendarSchedule } from './scheduleParserFallback';

export async function apiExtractStudyMaterial(params: {
  text?: string;
  fileData?: string;
  mimeType?: string;
  sourceTitle?: string;
  targetExamDate?: string;
  dailyHours?: number;
  generateFlashcards?: boolean;
  generateQuestions?: boolean;
  generateTasks?: boolean;
  generateSyllabus?: boolean;
}) {
  const response = await fetch('/api/ai/extract-study-material', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to extract study material');
  }
  return await response.json();
}

export async function apiParseSyllabus(params: { text?: string; fileData?: string; mimeType?: string; currentSubjects?: string[] }) {
  const response = await fetch('/api/ai/parse-syllabus', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to parse syllabus');
  }
  return await response.json();
}

export async function apiGenerateStudyPlan(params: {
  syllabus: any;
  recentSessions: any[];
  testResults: any[];
  availableHours: number;
  targetDate?: string;
  planType?: 'daily' | 'weekly';
  userPrompt?: string;
}) {
  const response = await fetch('/api/ai/generate-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate study plan');
  }
  return await response.json();
}

export async function apiParseCalendarSchedule(params: {
  pastedScheduleText?: string;
  text?: string;
  syllabus?: any[];
  knownSubjects?: string[];
  startDate?: string;
  referenceDate?: string;
  targetExam?: string;
  targetHorizon?: 'week' | 'month' | 'multi_month' | 'auto';
  userPreferences?: any;
}) {
  const inputText = params.text || params.pastedScheduleText || '';
  const refDate = params.referenceDate || params.startDate || new Date().toISOString().split('T')[0];
  const subjects = params.knownSubjects || (params.syllabus || []).map((s: any) => s.name || s);

  try {
    const response = await fetch('/api/ai/parse-calendar-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: inputText,
        pastedScheduleText: inputText,
        syllabus: params.syllabus,
        knownSubjects: subjects,
        startDate: refDate,
        referenceDate: refDate,
        targetExam: params.targetExam,
        targetHorizon: params.targetHorizon,
        userPreferences: params.userPreferences
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data && (data.schedule || data.data?.tasks)) {
        return data;
      }
    }
  } catch (netErr) {
    console.warn('Network request to /api/ai/parse-calendar-schedule failed, falling back to local parser:', netErr);
  }

  // Fallback to local intelligent schedule parser
  const fallbackSchedule = fallbackParseCalendarSchedule(inputText, refDate, subjects);
  return {
    success: true,
    schedule: fallbackSchedule,
    data: {
      analysisSummary: fallbackSchedule.analysisSummary,
      totalEstimatedHours: fallbackSchedule.totalEstimatedHours,
      tasks: fallbackSchedule.scheduledItems
    }
  };
}

export async function apiAnalyzeMistakes(params: {
  testName: string;
  subjectName: string;
  score: string;
  mistakes: string;
  struggledTopics?: string[];
  topicNumbers?: string[];
  topicsList?: { topicNumber: string; topicName: string }[];
}) {
  const response = await fetch('/api/ai/analyze-mistakes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to analyze mistakes');
  }
  return await response.json();
}

export async function apiTutorChat(params: {
  message: string;
  chatHistory: { role: 'user' | 'assistant'; content: string }[];
  userContext: any;
}) {
  const response = await fetch('/api/ai/tutor-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to get tutor response');
  }
  return await response.json();
}

export async function apiGenerateQuestions(params: {
  subjectName?: string;
  chapterName?: string;
  topicName?: string;
  focusWeakAreas?: boolean;
  count?: number;
  difficulty?: 'Easy' | 'Medium' | 'Hard' | 'Mixed';
  userContext?: any;
}) {
  const response = await fetch('/api/ai/generate-questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate practice questions');
  }
  return await response.json();
}

export async function apiSuggestGroupStudy(params: {
  groupName: string;
  subjectFocus?: string[];
  members: any[];
  groupGoals?: any[];
  targetExam?: string;
  targetExamDate?: string;
}) {
  const response = await fetch('/api/ai/suggest-group-study', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate group study suggestions');
  }
  return await response.json();
}

export async function apiGenerateFlashcards(params: {
  subjectName: string;
  chapterName?: string;
  topicName?: string;
  notesOrContext?: string;
  count?: number;
  difficulty?: 'Easy' | 'Medium' | 'Hard' | 'Mixed';
  isWeakTopicFocus?: boolean;
}) {
  const response = await fetch('/api/ai/generate-flashcards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate flashcards');
  }
  return await response.json();
}

export async function apiGenerateMockExam(params: {
  subjectName: string;
  chapterNames?: string[];
  topics?: string[];
  paperFormatCode?: string;
  examType?: 'mixed' | 'mcq' | 'structured' | 'numerical';
  totalMarks?: number;
  durationMinutes?: number;
  difficulty?: 'Foundation' | 'Standard' | 'Challenging' | 'Past Paper Style';
  examBoard?: string;
  language?: 'en' | 'ur' | 'bilingual';
  customInstructions?: string;
  focusWeakTopics?: boolean;
  userWeakTopics?: string[];
}) {
  const response = await fetch('/api/ai/generate-mock-exam', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate mock exam paper');
  }
  return await response.json();
}

export async function apiGradeMockExam(params: {
  exam: any;
  studentAnswers: Record<string, any>;
  timeSpentSeconds: number;
  handwrittenImages?: Record<string, string>;
  userProfile?: any;
}) {
  const response = await fetch('/api/ai/grade-mock-exam', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to grade mock exam');
  }
  return await response.json();
}

export async function apiGenerateBlurtPrompt(params: {
  topicName: string;
  subjectName: string;
  chapterName?: string;
  subtopics?: string[];
  weakNotes?: string;
}) {
  const response = await fetch('/api/ai/blurt-recall-prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate blurt prompt');
  }
  return await response.json();
}

export async function apiEvaluateBlurtRecall(params: {
  topicName: string;
  subjectName: string;
  chapterName?: string;
  subtopics?: string[];
  syllabusNotes?: string;
  userNotes?: string;
  blurtText?: string;
  imageBase64?: string;
  imageMimeType?: string;
  promptUsed?: string;
  durationSeconds?: number;
}) {
  const response = await fetch('/api/ai/blurt-recall-evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to evaluate blurt recall');
  }
  return await response.json();
}

export async function apiRefurbishKnowledge(params: {
  topicName: string;
  subjectName: string;
  chapterName?: string;
  syllabusNotes?: string;
  userRecallText: string;
  language?: 'en' | 'ur';
}) {
  const response = await fetch('/api/ai/knowledge-refurbish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to refurbish knowledge');
  }
  return await response.json();
}

export async function apiEvaluateFeynmanExplanation(params: {
  conceptName: string;
  explanation: string;
  subjectName?: string;
  targetAudience?: string;
}) {
  const response = await fetch('/api/ai/feynman-evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to analyze concept with Feynman technique');
  }
  return await response.json();
}

export async function apiConvertHandwrittenNotesToStudySet(params: {
  imageBase64: string;
  imageMimeType?: string;
  targetMode?: 'both' | 'quiz' | 'flashcards';
  topicName?: string;
  subjectName?: string;
  chapterName?: string;
  numCards?: number;
  numQuestions?: number;
}) {
  const response = await fetch('/api/ai/handwritten-notes-to-study-set', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to analyze handwritten notes with vision AI');
  }
  return await response.json();
}

export async function apiSocraticOralTurn(params: {
  conceptName: string;
  subjectName?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; text: string }>;
  userSpeech: string;
  isFinalTurn?: boolean;
  turnCount?: number;
}) {
  const response = await fetch('/api/ai/socratic-oral-turn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to process Socratic oral examination turn');
  }
  return await response.json();
}

export async function apiWhatsAppCoachReply(params: {
  userMessage: string;
  chatHistory?: Array<{ sender: 'user' | 'coach'; text: string; time?: string }>;
  studentData?: {
    streak?: number;
    dailyGoalHours?: number;
    hoursStudiedToday?: number;
    enrolledSubjects?: string[];
    targetExamYear?: string;
  };
}) {
  const response = await fetch('/api/ai/whatsapp-coach-reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to get study coach response');
  }
  return await response.json();
}

export async function apiGenerateCheatSheet(params: {
  subjectName: string;
  chapterName?: string;
  topicName: string;
  curriculum?: string;
  notesOrContext?: string;
}) {
  const response = await fetch('/api/ai/generate-cheat-sheet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate 1-page cheat sheet');
  }
  return await response.json();
}



