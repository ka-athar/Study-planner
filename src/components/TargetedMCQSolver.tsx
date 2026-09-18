import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Brain, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Award, 
  ArrowRight, 
  ArrowLeft, 
  RefreshCw, 
  Lightbulb, 
  Flag, 
  Check, 
  Copy, 
  ChevronRight, 
  ChevronDown, 
  TrendingUp, 
  Zap, 
  FileText, 
  BarChart2, 
  Target, 
  BookOpen, 
  Layers, 
  Sliders, 
  X,
  ExternalLink,
  ShieldAlert,
  HelpCircle,
  Flame,
  Star
} from 'lucide-react';
import { Subject, Chapter, Topic, TopicStatus, TestResult, PracticeQuestion } from '../types';
import { apiGenerateQuestions } from '../lib/aiApi';

export interface TargetedMCQSolverProps {
  topic: Topic;
  chapter?: Chapter;
  subject?: Subject;
  syllabusContext?: {
    subjectName?: string;
    chapterName?: string;
    topicNumber?: string;
    subtopics?: string[];
    examBoard?: string;
    customNotes?: string;
  };
  pastTestResults?: TestResult[];
  onTestCompleted?: (result: {
    score: number;
    totalMarks: number;
    percentage: number;
    mistakes: string[];
    struggledSubtopics: string[];
    timeSpentSeconds: number;
  }) => void | Promise<void>;
  onUpdateTopicStatus?: (newStatus: TopicStatus, scorePercentage?: number) => void;
  onClose?: () => void;
  standalone?: boolean;
}

type QuizMode = 'practice' | 'exam';
type DifficultyLevel = 'Easy' | 'Medium' | 'Hard' | 'Mixed';

export const TargetedMCQSolver: React.FC<TargetedMCQSolverProps> = ({
  topic,
  chapter,
  subject,
  syllabusContext,
  pastTestResults = [],
  onTestCompleted,
  onUpdateTopicStatus,
  onClose,
  standalone = false
}) => {
  // Active Tab
  const [activeTab, setActiveTab] = useState<'solver' | 'analytics' | 'prompt'>('solver');

  // Quiz Configuration
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('Medium');
  const [quizMode, setQuizMode] = useState<QuizMode>('practice');
  const [examBoard, setExamBoard] = useState<string>(syllabusContext?.examBoard || 'Standard Academic / Exam Board');
  const [includeWeakMistakes, setIncludeWeakMistakes] = useState<boolean>(true);

  // Generation & Execution State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  
  // Interactive Session State
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<number, boolean>>({});
  const [showHint, setShowHint] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Timer
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // AI Prompt Tab State
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);

  // Resolved Identifiers
  const subjectName = syllabusContext?.subjectName || subject?.name || 'Academic Subject';
  const chapterName = syllabusContext?.chapterName || chapter?.name || 'Core Chapter';
  const topicName = topic?.name || 'Targeted Topic';
  const topicNumber = topic?.topicNumber || syllabusContext?.topicNumber || '1.1';
  const subtopicsList = topic?.subtopics?.map(s => s.name) || syllabusContext?.subtopics || [];

  // Filter historical test records for this topic/chapter
  const relevantPastTests = useMemo(() => {
    return pastTestResults.filter(t => {
      if (!t) return false;
      const subMatch = t.subjectName?.toLowerCase() === subjectName.toLowerCase();
      const numMatch = t.topicNumber && t.topicNumber.toLowerCase() === topicNumber.toLowerCase();
      const nameMatch = t.topicName && t.topicName.toLowerCase() === topicName.toLowerCase();
      const chMatch = t.chapterName && t.chapterName.toLowerCase() === chapterName.toLowerCase();
      return subMatch && (numMatch || nameMatch || chMatch);
    });
  }, [pastTestResults, subjectName, topicNumber, topicName, chapterName]);

  const pastMistakesSummary = useMemo(() => {
    return relevantPastTests
      .map(t => t.mistakes)
      .filter(Boolean)
      .join('; ');
  }, [relevantPastTests]);

  const previousBestScore = useMemo(() => {
    if (!relevantPastTests.length) return null;
    return Math.max(...relevantPastTests.map(t => t.percentage ?? 0));
  }, [relevantPastTests]);

  // Timer Effect
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setSecondsElapsed(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning]);

  // Format Timer
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  // Generate Questions via Gemini API
  const handleStartGeneration = async () => {
    setIsGenerating(true);
    setGenerationError(null);
    setIsCompleted(false);
    setSelectedAnswers({});
    setRevealedAnswers({});
    setFlaggedQuestions({});
    setCurrentIndex(0);
    setShowHint(false);
    setSaveSuccessMsg(null);
    setSecondsElapsed(0);

    try {
      const userContext = {
        topicNumber,
        topicName,
        subtopics: subtopicsList,
        weakTopics: (topic?.status === 'Weak' || topic?.status === 'Needs Revision') ? [topicName] : [],
        pastMistakes: pastMistakesSummary,
        testResults: relevantPastTests.slice(0, 3).map(t => ({
          testName: t.testName,
          mistakes: t.mistakes,
          score: t.score
        })),
        examBoard,
        quizMode
      };

      const res = await apiGenerateQuestions({
        subjectName,
        chapterName,
        topicName: `Topic ${topicNumber}: ${topicName}`,
        focusWeakAreas: includeWeakMistakes && !!pastMistakesSummary,
        count: questionCount,
        difficulty,
        userContext
      });

      if (res.success && res.questionSet?.questions?.length > 0) {
        setQuestions(res.questionSet.questions);
        setTimerRunning(true);
      } else {
        throw new Error(res.error || 'Failed to formulate questions for this topic. Please try again.');
      }
    } catch (err: any) {
      console.error('Error generating targeted MCQs:', err);
      setGenerationError(err.message || 'Failed to load questions. Please check connection and try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Option Click Handler
  const handleSelectOption = (qIdx: number, optionIdx: number) => {
    if (quizMode === 'practice' && revealedAnswers[qIdx]) return; // In practice mode, lock once revealed
    if (isCompleted) return;

    setSelectedAnswers(prev => ({ ...prev, [qIdx]: optionIdx }));

    if (quizMode === 'practice') {
      setRevealedAnswers(prev => ({ ...prev, [qIdx]: true }));
    }
  };

  // Flag toggle
  const toggleFlag = (qIdx: number) => {
    setFlaggedQuestions(prev => ({ ...prev, [qIdx]: !prev[qIdx] }));
  };

  // Calculate Scores
  const correctCount = useMemo(() => {
    return questions.reduce((acc, q, idx) => {
      return selectedAnswers[idx] === q.correctOptionIndex ? acc + 1 : acc;
    }, 0);
  }, [questions, selectedAnswers]);

  const totalQuestions = questions.length;
  const scorePercentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  // Recommended Topic Status after completing test
  const recommendedStatus: TopicStatus = useMemo(() => {
    if (scorePercentage >= 85) return 'Mastered';
    if (scorePercentage >= 65) return 'Completed';
    return 'Needs Revision';
  }, [scorePercentage]);

  // Finish Quiz
  const handleFinishQuiz = () => {
    setTimerRunning(false);
    // In exam mode, reveal all answers at the end
    if (quizMode === 'exam') {
      const allRevealed: Record<number, boolean> = {};
      questions.forEach((_, idx) => {
        allRevealed[idx] = true;
      });
      setRevealedAnswers(allRevealed);
    }
    setIsCompleted(true);
  };

  // Save Progress to Syllabus & Test History
  const handleSaveResult = async () => {
    setIsSaving(true);
    try {
      const mistakesList: string[] = [];
      const struggledSubtopics: string[] = [];

      questions.forEach((q, idx) => {
        if (selectedAnswers[idx] !== q.correctOptionIndex) {
          const selectedText = q.options ? q.options[selectedAnswers[idx] ?? -1] : 'Unanswered';
          const correctText = q.options ? q.options[q.correctOptionIndex ?? 0] : 'Unknown';
          mistakesList.push(`Q${idx + 1}: ${q.question} (Your Answer: ${selectedText} | Correct: ${correctText})`);
          if (q.topicName) struggledSubtopics.push(q.topicName);
        }
      });

      if (onTestCompleted) {
        await onTestCompleted({
          score: correctCount,
          totalMarks: totalQuestions,
          percentage: scorePercentage,
          mistakes: mistakesList,
          struggledSubtopics: Array.from(new Set(struggledSubtopics)),
          timeSpentSeconds: secondsElapsed
        });
      }

      if (onUpdateTopicStatus) {
        onUpdateTopicStatus(recommendedStatus, scorePercentage);
      }

      setSaveSuccessMsg(`Score ${correctCount}/${totalQuestions} (${scorePercentage}%) saved! Topic updated to '${recommendedStatus}'.`);
    } catch (err: any) {
      console.error('Failed to save score:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Construct Master AI Prompt for ChatGPT/Gemini
  const constructMasterAiPrompt = (): string => {
    return `You are a high-level academic examiner and specialist tutor in ${subjectName}.

TASK: Generate a targeted Multiple Choice Question (MCQ) mastery drill for:
- Subject: ${subjectName}
- Chapter: ${chapterName}
- Topic: ${topicNumber} - ${topicName}
- Key Subtopics to Test: ${subtopicsList.join(', ') || 'Core concepts and formulas'}
- Difficulty Level: ${difficulty}
- Target Exam Standard: ${examBoard}

INSTRUCTIONS:
1. Provide exactly ${questionCount} challenging, high-yield Multiple Choice Questions.
2. For each question, provide 4 options (A, B, C, D) where distractors represent authentic student calculation traps or subtle conceptual misunderstandings.
3. DO NOT reveal the answers immediately beside the questions. Output all questions in Section 1 first.
4. In Section 2 ("Answer Key & Detailed Mathematical/Conceptual Explanations"):
   - Clearly state the correct option.
   - Provide a step-by-step solution showing underlying laws and formula derivations.
   - Provide "⚠️ Trap to Avoid" and "💡 Golden Exam Rule" for every question.
${pastMistakesSummary ? `\nSPECIAL FOCUS ON MY PAST WEAKNESSES:\nIn my previous tests, I made mistakes with: "${pastMistakesSummary}". Please ensure at least one question directly targets this exact gap.` : ''}`;
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(constructMasterAiPrompt());
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const currentQ = questions[currentIndex];
  const isCurrentRevealed = revealedAnswers[currentIndex];
  const isCurrentFlagged = flaggedQuestions[currentIndex];

  return (
    <div className={`w-full bg-white dark:bg-[#1E201E] border border-theme rounded-3xl flex flex-col shadow-xl overflow-hidden transition-all text-primary ${standalone ? 'max-w-4xl mx-auto my-6' : ''}`}>
      
      {/* 1. Header Banner */}
      <div className="p-5 sm:p-6 bg-surface text-primary flex items-start justify-between gap-4 border-b border-theme shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-xs">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-lg bg-primary/10 text-primary font-mono text-[11px] font-bold uppercase tracking-wider border border-primary/20">
                Topic {topicNumber}
              </span>
              <span className="text-xs text-muted font-semibold truncate">
                {subjectName} • {chapterName}
              </span>
              {topic?.status && (
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase font-mono ${
                  topic.status === 'Mastered' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30' :
                  topic.status === 'Completed' ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-400/30' :
                  topic.status === 'Needs Revision' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-400/30' :
                  topic.status === 'Weak' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-400/30' :
                  'bg-theme-accent text-primary border border-theme'
                }`}>
                  Status: {topic.status}
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-bold font-serif text-primary mt-1">
              {topicName}
            </h2>
            <p className="text-xs text-muted">
              Solve Gemini-generated targeted MCQs with real-time feedback or export exam prompts.
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted hover:text-primary hover:bg-theme-accent transition cursor-pointer"
            title="Close Solver"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* 2. Subtopic Scope & Past History Ribbon */}
      <div className="px-5 py-3 bg-theme-accent/40 border-b border-theme flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono uppercase text-muted font-bold">Subtopics Included:</span>
          {subtopicsList.length > 0 ? (
            subtopicsList.map((st, idx) => (
              <span key={idx} className="px-2 py-0.5 rounded-md bg-white dark:bg-[#252825] border border-theme text-[11px] font-medium text-primary">
                {st}
              </span>
            ))
          ) : (
            <span className="text-[11px] text-muted italic">Core syllabus concepts for Topic {topicNumber}</span>
          )}
        </div>

        {previousBestScore !== null && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[11px] font-mono">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Best Past Score: {previousBestScore}%</span>
          </div>
        )}
      </div>

      {/* 3. Tab Bar */}
      <div className="flex items-center gap-1 px-5 pt-3 border-b border-theme bg-white dark:bg-[#1E201E] shrink-0">
        <button
          onClick={() => setActiveTab('solver')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'solver'
              ? 'bg-theme-accent text-primary border-t-2 border-primary shadow-2xs'
              : 'text-muted hover:text-primary'
          }`}
        >
          <Brain className="w-4 h-4 text-emerald-600" />
          <span>Interactive MCQ Drill</span>
          {questions.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono">
              {questions.length} Qs
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'analytics'
              ? 'bg-theme-accent text-primary border-t-2 border-primary shadow-2xs'
              : 'text-muted hover:text-primary'
          }`}
        >
          <BarChart2 className="w-4 h-4 text-blue-600" />
          <span>Topic Mastery & History</span>
        </button>

        <button
          onClick={() => setActiveTab('prompt')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'prompt'
              ? 'bg-theme-accent text-primary border-t-2 border-primary shadow-2xs'
              : 'text-muted hover:text-primary'
          }`}
        >
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span>Copy AI Prompt (ChatGPT/Claude)</span>
        </button>
      </div>

      {/* 4. Body Content */}
      <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">

        {/* TAB 1: INTERACTIVE MCQ DRILL */}
        {activeTab === 'solver' && (
          <div className="space-y-6">

            {/* PRE-QUIZ CONFIGURATION PANEL (Shown when no quiz is active or quiz is finished) */}
            {(!questions.length || isCompleted) && (
              <div className="p-5 rounded-3xl bg-theme-accent/30 border border-theme space-y-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-primary">
                      Configure Topic Drill Parameters
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-muted">
                    Topic #{topicNumber} ({topicName})
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {/* Number of Questions */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-bold uppercase text-muted block">
                      Number of Questions
                    </label>
                    <div className="flex gap-1.5">
                      {[3, 5, 10].map(cnt => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setQuestionCount(cnt)}
                          className={`flex-1 py-2 rounded-xl font-bold font-mono text-xs border transition cursor-pointer ${
                            questionCount === cnt
                              ? 'bg-primary text-white border-primary shadow-2xs'
                              : 'bg-card text-muted border-theme hover:text-primary'
                          }`}
                        >
                          {cnt} Qs
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Difficulty */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-bold uppercase text-muted block">
                      Target Difficulty
                    </label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                      className="w-full px-3 py-2 rounded-xl bg-card border border-theme text-xs font-bold text-primary focus:outline-none cursor-pointer"
                    >
                      <option value="Easy">Easy (Recall & Core Definitions)</option>
                      <option value="Medium">Medium (Standard Board Exam)</option>
                      <option value="Hard">Hard (Olympiad & Complex Traps)</option>
                      <option value="Mixed">Mixed Difficulty</option>
                    </select>
                  </div>

                  {/* Practice vs Timed Exam Mode */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-bold uppercase text-muted block">
                      Solving Mode
                    </label>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setQuizMode('practice')}
                        className={`flex-1 py-2 rounded-xl font-bold text-xs border transition cursor-pointer flex items-center justify-center gap-1 ${
                          quizMode === 'practice'
                            ? 'bg-primary text-white border-primary shadow-2xs'
                            : 'bg-card text-muted border-theme hover:text-primary'
                        }`}
                        title="Instant feedback & conceptual explanations on click"
                      >
                        <Lightbulb className="w-3.5 h-3.5" />
                        <span>Practice</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setQuizMode('exam')}
                        className={`flex-1 py-2 rounded-xl font-bold text-xs border transition cursor-pointer flex items-center justify-center gap-1 ${
                          quizMode === 'exam'
                            ? 'bg-primary text-white border-primary shadow-2xs'
                            : 'bg-card text-muted border-theme hover:text-primary'
                        }`}
                        title="Timed simulation, review all answers at the end"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Timed Exam</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Exam Board Style */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold uppercase text-muted block">
                      Target Exam Board Curriculum
                    </label>
                    <select
                      value={examBoard}
                      onChange={(e) => setExamBoard(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-card border border-theme text-xs font-bold text-primary focus:outline-none cursor-pointer"
                    >
                      <option value="Standard Academic / Exam Board">Standard Academic / Exam Board</option>
                      <option value="Cambridge IGCSE / A-Level">Cambridge IGCSE / A-Level</option>
                      <option value="CBSE / Board Examinations">CBSE / Board Examinations</option>
                      <option value="AP Physics / College Board">AP Physics / College Board</option>
                      <option value="JEE / NEET Medical & Engineering">JEE / NEET Medical & Engineering</option>
                      <option value="SAT / General Science">SAT / General Science</option>
                    </select>
                  </div>

                  {pastMistakesSummary ? (
                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 text-xs text-primary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeWeakMistakes}
                          onChange={(e) => setIncludeWeakMistakes(e.target.checked)}
                          className="rounded border-theme text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                        />
                        <span className="leading-snug">
                          Target past test traps on this topic: <strong className="text-rose-600">"{pastMistakesSummary.slice(0, 45)}..."</strong>
                        </span>
                      </label>
                    </div>
                  ) : (
                    <div className="flex items-center pt-5 text-xs text-muted">
                      <span>✨ Fresh drill generated directly from syllabus specifications.</span>
                    </div>
                  )}
                </div>

                {/* Launch Button */}
                <button
                  type="button"
                  onClick={handleStartGeneration}
                  disabled={isGenerating}
                  className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm cursor-pointer disabled:opacity-50 active:scale-[0.99]"
                >
                  {isGenerating ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>
                    {isGenerating 
                      ? `Generating ${questionCount} Targeted MCQs for Topic ${topicNumber}...` 
                      : `Start Solving MCQs for Topic ${topicNumber}: ${topicName}`
                    }
                  </span>
                </button>

                {generationError && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 border border-rose-300 text-xs flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{generationError}</span>
                  </div>
                )}
              </div>
            )}

            {/* ACTIVE QUIZ QUESTION RUNNER */}
            {questions.length > 0 && !isCompleted && currentQ && (
              <div className="p-5 sm:p-6 rounded-3xl bg-card border border-theme space-y-6 shadow-sm animate-fade-in">
                
                {/* Question Navigation Ribbon & Timer */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-theme pb-4">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {questions.map((_, idx) => {
                      const isAnswered = selectedAnswers[idx] !== undefined;
                      const isFlagged = flaggedQuestions[idx];
                      const isCurrent = currentIndex === idx;

                      let btnStyle = "bg-theme-accent text-muted border-theme";
                      if (isCurrent) {
                        btnStyle = "bg-primary text-white border-primary shadow-xs font-bold";
                      } else if (isAnswered) {
                        btnStyle = "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-bold";
                      }

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setCurrentIndex(idx);
                            setShowHint(false);
                          }}
                          className={`w-8 h-8 rounded-xl font-mono text-xs border transition flex items-center justify-center relative cursor-pointer ${btnStyle}`}
                        >
                          <span>{idx + 1}</span>
                          {isFlagged && (
                            <span className="w-2 h-2 rounded-full bg-amber-500 absolute -top-0.5 -right-0.5 ring-2 ring-card" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleFlag(currentIndex)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        isCurrentFlagged 
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40' 
                          : 'bg-theme-accent border-theme text-muted hover:text-primary'
                      }`}
                    >
                      <Flag className="w-3.5 h-3.5" />
                      <span>{isCurrentFlagged ? 'Flagged' : 'Flag'}</span>
                    </button>

                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-theme-accent border border-theme text-xs font-mono font-bold text-primary">
                      <Clock className="w-3.5 h-3.5 text-muted" />
                      <span>{formatTime(secondsElapsed)}</span>
                    </div>
                  </div>
                </div>

                {/* Question Statement */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted">
                      Question {currentIndex + 1} of {questions.length}
                    </span>
                    {currentQ.difficulty && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-theme-accent text-muted border border-theme">
                        {currentQ.difficulty}
                      </span>
                    )}
                    {currentQ.topicName && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                        {currentQ.topicName}
                      </span>
                    )}
                  </div>
                  <h4 className="text-base sm:text-lg font-bold text-primary leading-relaxed">
                    {currentQ.question}
                  </h4>
                </div>

                {/* Options List */}
                <div className="space-y-3">
                  {currentQ.options?.map((opt, optIdx) => {
                    const isSelected = selectedAnswers[currentIndex] === optIdx;
                    const isCorrect = currentQ.correctOptionIndex === optIdx;
                    const isRevealed = revealedAnswers[currentIndex];

                    let optionClass = "bg-surface border-theme hover:border-primary/50 text-primary";
                    if (isRevealed) {
                      if (isCorrect) {
                        optionClass = "bg-emerald-500/15 border-emerald-500 text-emerald-950 dark:text-emerald-200 font-bold shadow-xs";
                      } else if (isSelected && !isCorrect) {
                        optionClass = "bg-rose-500/15 border-rose-500 text-rose-950 dark:text-rose-200";
                      } else {
                        optionClass = "bg-surface/60 border-theme/50 text-muted opacity-70";
                      }
                    } else if (isSelected) {
                      optionClass = "bg-primary/10 border-primary text-primary font-bold";
                    }

                    return (
                      <div
                        key={optIdx}
                        onClick={() => handleSelectOption(currentIndex, optIdx)}
                        className={`p-4 rounded-2xl border transition flex items-center justify-between gap-3 text-xs cursor-pointer ${optionClass}`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 border ${
                            isRevealed && isCorrect ? 'bg-emerald-600 text-white border-emerald-600' :
                            isRevealed && isSelected && !isCorrect ? 'bg-rose-600 text-white border-rose-600' :
                            isSelected ? 'bg-primary text-white border-primary' : 'bg-theme-accent text-muted border-theme'
                          }`}>
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span className="leading-snug text-xs sm:text-sm">{opt}</span>
                        </div>

                        {isRevealed && isCorrect && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        )}
                        {isRevealed && isSelected && !isCorrect && (
                          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Hint Button */}
                {currentQ.hint && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowHint(!showHint)}
                      className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Lightbulb className="w-4 h-4" />
                      <span>{showHint ? 'Hide Conceptual Hint' : 'Need a Hint for this problem?'}</span>
                    </button>

                    {showHint && (
                      <div className="mt-2.5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 animate-fade-in">
                        💡 <strong>Hint:</strong> {currentQ.hint}
                      </div>
                    )}
                  </div>
                )}

                {/* Explanation Block (Shown in Practice Mode when answered) */}
                {isCurrentRevealed && (
                  <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 space-y-1.5 text-xs animate-fade-in">
                    <span className="font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Conceptual Breakdown & Solution:
                    </span>
                    <p className="text-emerald-900/90 dark:text-emerald-200/90 leading-relaxed text-xs">
                      {currentQ.explanation}
                    </p>
                  </div>
                )}

                {/* Question Runner Bottom Navigation */}
                <div className="flex items-center justify-between pt-4 border-t border-theme">
                  <button
                    type="button"
                    disabled={currentIndex === 0}
                    onClick={() => {
                      setCurrentIndex(prev => Math.max(0, prev - 1));
                      setShowHint(false);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-theme-accent border border-theme text-xs font-bold text-primary disabled:opacity-30 flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>

                  {currentIndex < questions.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentIndex(prev => prev + 1);
                        setShowHint(false);
                      }}
                      className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-1.5 hover:bg-primary/90 transition cursor-pointer shadow-xs"
                    >
                      <span>Next Question</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleFinishQuiz}
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-xs"
                    >
                      <Award className="w-4 h-4" />
                      <span>Submit & View Results</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* QUIZ COMPLETION SUMMARY & TOPIC PROGRESS DASHBOARD */}
            {isCompleted && (
              <div className="p-6 sm:p-8 rounded-3xl bg-card border border-theme space-y-6 shadow-sm text-center animate-fade-in">
                <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-500/20">
                  <Award className="w-8 h-8" />
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-mono uppercase text-muted font-bold block">
                    Targeted Topic Assessment Completed
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-bold font-serif text-primary">
                    Score: {correctCount} / {totalQuestions} ({scorePercentage}%)
                  </h3>
                  <p className="text-xs text-muted max-w-lg mx-auto">
                    {scorePercentage >= 85 
                      ? `🎉 Outstanding mastery of Topic ${topicNumber}! You understand the core principles and successfully navigated exam traps.`
                      : scorePercentage >= 65
                      ? `👍 Good performance on Topic ${topicNumber}. Review the explanations for missed questions to achieve full mastery.`
                      : `⚠️ Needs revision. Revisit core formulas and subtopics for Topic ${topicNumber} before taking the next mock exam.`
                    }
                  </p>
                </div>

                {/* Detailed Performance Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                  <div className="p-3.5 rounded-2xl bg-theme-accent/40 border border-theme space-y-1">
                    <span className="text-[10px] font-mono text-muted uppercase font-bold block">Correct</span>
                    <span className="text-base font-bold text-emerald-600">{correctCount} Questions</span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-theme-accent/40 border border-theme space-y-1">
                    <span className="text-[10px] font-mono text-muted uppercase font-bold block">Incorrect</span>
                    <span className="text-base font-bold text-rose-600">{totalQuestions - correctCount} Questions</span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-theme-accent/40 border border-theme space-y-1">
                    <span className="text-[10px] font-mono text-muted uppercase font-bold block">Time Taken</span>
                    <span className="text-base font-bold text-primary">{formatTime(secondsElapsed)}</span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-theme-accent/40 border border-theme space-y-1">
                    <span className="text-[10px] font-mono text-muted uppercase font-bold block">New Status</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md inline-block ${
                      recommendedStatus === 'Mastered' ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' :
                      recommendedStatus === 'Completed' ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300' :
                      'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                    }`}>
                      {recommendedStatus}
                    </span>
                  </div>
                </div>

                {/* Save Confirmation Message */}
                {saveSuccessMsg && (
                  <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border border-emerald-300 text-xs font-bold flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{saveSuccessMsg}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleSaveResult}
                    disabled={isSaving || !!saveSuccessMsg}
                    className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-primary text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
                    <span>{saveSuccessMsg ? 'Saved to Syllabus & History' : 'Save Score & Update Topic Status'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleStartGeneration}
                    className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-theme-accent border border-theme text-xs font-bold text-primary flex items-center justify-center gap-2 hover:bg-theme-accent/80 transition cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Retake Drill with New Questions</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* TAB 2: TOPIC MASTERY & HISTORICAL BENCHMARK */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="p-5 rounded-3xl bg-theme-accent/30 border border-theme space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-bold text-primary">
                    Historical Mastery for Topic {topicNumber}
                  </h3>
                </div>
                <span className="text-xs text-muted font-mono">
                  {relevantPastTests.length} Recorded Tests
                </span>
              </div>

              {relevantPastTests.length > 0 ? (
                <div className="space-y-3">
                  {relevantPastTests.map((t, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-card border border-theme flex items-center justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-primary">{t.testName}</span>
                          <span className="text-[10px] font-mono text-muted">{t.date}</span>
                        </div>
                        {t.mistakes && (
                          <p className="text-[11px] text-rose-600 line-clamp-1">
                            Trap: {t.mistakes}
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-sm font-mono font-bold text-emerald-600 block">
                          {t.score || `${t.percentage}%`}
                        </span>
                        <span className="text-[10px] font-mono text-muted">{t.percentage}% Score</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-card border border-theme text-center space-y-2">
                  <p className="text-xs text-muted">No previous tests logged specifically for Topic {topicNumber}.</p>
                  <p className="text-xs font-bold text-primary">Complete a drill above to start tracking topic mastery trends!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: MASTER AI PROMPT EXPORTER */}
        {activeTab === 'prompt' && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-purple-900 dark:text-purple-200 font-bold">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Export to ChatGPT, Google Gemini, or Claude</span>
              </div>
              <p className="text-purple-900/80 dark:text-purple-300/80 leading-relaxed">
                Take your study session to any external AI. This prompt is pre-configured with Topic #{topicNumber} ({topicName}), your subtopics, and previous mistakes.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-[10px] font-bold uppercase text-muted">
                  Generated Topic Prompt:
                </span>
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="text-xs font-bold text-primary hover:text-emerald-600 flex items-center gap-1 transition cursor-pointer"
                >
                  {copiedPrompt ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPrompt ? 'Copied!' : 'Copy Prompt'}</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-surface text-primary font-mono text-xs leading-relaxed max-h-56 overflow-y-auto border border-theme select-all whitespace-pre-wrap">
                {constructMasterAiPrompt()}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 flex-wrap">
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                {copiedPrompt ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedPrompt ? 'Copied to Clipboard!' : 'Copy Master Prompt'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleCopyPrompt();
                  window.open('https://chatgpt.com/', '_blank');
                }}
                className="px-4 py-3 rounded-2xl bg-[#10A37F] hover:bg-[#0e8e6e] text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <span>Open in ChatGPT</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  handleCopyPrompt();
                  window.open('https://gemini.google.com/', '_blank');
                }}
                className="px-4 py-3 rounded-2xl bg-[#4285F4] hover:bg-[#3367D6] text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <span>Open in Gemini</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};
