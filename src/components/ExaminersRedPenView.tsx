import React, { useState, useEffect } from 'react';
import { 
  PenTool, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  BookmarkPlus, 
  RefreshCw, 
  Award, 
  ArrowRight, 
  BookOpen, 
  ChevronRight, 
  Check, 
  RotateCcw,
  FileText,
  HelpCircle,
  Clock,
  Send,
  Zap,
  ShieldCheck,
  TrendingUp,
  Sliders,
  ExternalLink,
  Target,
  Eye,
  AlertCircle,
  Search,
  ListChecks,
  Compass,
  Layers,
  Flame,
  CheckCheck,
  X
} from 'lucide-react';
import { 
  Subject, 
  RedPenResult, 
  RedPenDeduction, 
  CognitiveErrorCategory,
  SpotBlunderChallenge,
  BlunderDetail,
  DeconstructedMarkItem,
  BlunderCategory
} from '../types';
import { addMistake } from '../lib/mistakeVaultStorage';
import { DEFAULT_BLUNDER_CHALLENGES } from '../data/spotBlunderBank';

interface ExaminersRedPenViewProps {
  subjects: Subject[];
  initialSubjectName?: string;
  initialTopicName?: string;
  onNavigateToMistakeVault?: () => void;
  onAwardXP?: (xp: number, reason: string) => void;
}

const EXAM_STANDARDS = [
  'FBISE & Cambridge O/A-Levels',
  'AP & College Board Standard',
  'CBSE / ICSE Senior Secondary',
  'University Examination Standard'
];

const QUICK_MATH_SYMBOLS = ['±', '×', '÷', 'π', 'θ', 'Δ', 'λ', '→', '≈', '²', '³', '√', 'η', 'μ', 'Ω'];

const BLUNDER_CATEGORIES: { id: BlunderCategory; label: string; icon: string; color: string }[] = [
  { id: 'careless_calc', label: 'Calculation / Arithmetic Slip', icon: '🧮', color: 'text-amber-600 bg-amber-500/10 border-amber-500/30' },
  { id: 'missing_unit', label: 'Missing / Wrong SI Unit', icon: '📏', color: 'text-blue-600 bg-blue-500/10 border-blue-500/30' },
  { id: 'sign_error', label: 'Sign / Formula Convention Trap', icon: '±', color: 'text-rose-600 bg-rose-500/10 border-rose-500/30' },
  { id: 'vague_keyword', label: 'Vague Phrasing / Missing Keyword', icon: '🔍', color: 'text-purple-600 bg-purple-500/10 border-purple-500/30' },
  { id: 'concept_gap', label: 'Conceptual Fallacy / Misconception', icon: '🚫', color: 'text-red-600 bg-red-500/10 border-red-500/30' },
  { id: 'premature_rounding', label: 'Premature Rounding Error', icon: '✂️', color: 'text-orange-600 bg-orange-500/10 border-orange-500/30' }
];

export const ExaminersRedPenView: React.FC<ExaminersRedPenViewProps> = ({
  subjects,
  initialSubjectName,
  initialTopicName,
  onNavigateToMistakeVault,
  onAwardXP
}) => {
  // Top primary navigation: Spot the Blunder Game vs Grade My Answer
  const [activeMode, setActiveMode] = useState<'spot_blunder' | 'grade_my_answer'>('spot_blunder');

  // ==========================================
  // SPOT THE BLUNDER STATE (OPTIONS 1, 2, 4)
  // ==========================================
  const [challenges, setChallenges] = useState<SpotBlunderChallenge[]>(DEFAULT_BLUNDER_CHALLENGES);
  const [selectedChallengeId, setSelectedChallengeId] = useState<string>(DEFAULT_BLUNDER_CHALLENGES[0].id);
  const [subjectFilter, setSubjectFilter] = useState<string>('All');
  
  // User interactive marking on active challenge
  // Map of lineIndex -> { isFlagged: boolean; category?: BlunderCategory; note?: string }
  const [userLineFlags, setUserLineFlags] = useState<Record<number, { isFlagged: boolean; category?: BlunderCategory; note?: string }>>({});
  const [selectedLineForAnnotation, setSelectedLineForAnnotation] = useState<number | null>(null);
  const [userAwardedScore, setUserAwardedScore] = useState<number>(2);
  const [isChallengeSubmitted, setIsChallengeSubmitted] = useState<boolean>(false);
  const [activeRevealTab, setActiveRevealTab] = useState<'deconstructed_rubric' | 'examiner_traps' | 'model_answer'>('deconstructed_rubric');

  // AI Generator state
  const [isGeneratingChallenge, setIsGeneratingChallenge] = useState(false);
  const [aiGeneratorSubject, setAiGeneratorSubject] = useState(initialSubjectName || (subjects[0]?.name || 'Physics'));
  const [aiGeneratorTopic, setAiGeneratorTopic] = useState(initialTopicName || 'General Exam Topic');
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Vault saved trackers
  const [addedTrapsToVault, setAddedTrapsToVault] = useState<Record<string, boolean>>({});

  // Examiner Performance Tracking
  const [examinerScoreCard, setExaminerScoreCard] = useState<{
    totalChallengesCompleted: number;
    totalBlundersFound: number;
    examinerAccuracyPct: number;
  }>(() => {
    try {
      const saved = localStorage.getItem('prepforge_examiner_scorecard');
      return saved ? JSON.parse(saved) : { totalChallengesCompleted: 1, totalBlundersFound: 3, examinerAccuracyPct: 92 };
    } catch {
      return { totalChallengesCompleted: 1, totalBlundersFound: 3, examinerAccuracyPct: 92 };
    }
  });

  // Current active challenge object
  const activeChallenge = challenges.find(c => c.id === selectedChallengeId) || challenges[0];

  // Filtered challenges
  const filteredChallenges = challenges.filter(c => {
    if (subjectFilter === 'All') return true;
    return c.subjectName.toLowerCase() === subjectFilter.toLowerCase();
  });

  // Reset annotations when changing challenge
  const handleSelectChallenge = (id: string) => {
    setSelectedChallengeId(id);
    setUserLineFlags({});
    setSelectedLineForAnnotation(null);
    setIsChallengeSubmitted(false);
    setActiveRevealTab('deconstructed_rubric');
    const ch = challenges.find(c => c.id === id);
    if (ch) {
      setUserAwardedScore(Math.max(1, Math.round(ch.totalMarks / 2)));
    }
  };

  // Toggle or annotate line
  const handleFlagLine = (lineIndex: number, category: BlunderCategory, note?: string) => {
    setUserLineFlags(prev => ({
      ...prev,
      [lineIndex]: { isFlagged: true, category, note: note || '' }
    }));
    setSelectedLineForAnnotation(null);
  };

  const handleUnflagLine = (lineIndex: number) => {
    setUserLineFlags(prev => {
      const next = { ...prev };
      delete next[lineIndex];
      return next;
    });
    setSelectedLineForAnnotation(null);
  };

  // Submit Chief Examiner verdict
  const handleSubmitExaminerReview = () => {
    if (!activeChallenge) return;

    // Calculate score
    const actualBlunderLineIndices = activeChallenge.blunders.map(b => b.lineIndex);
    const userFlaggedIndices = Object.keys(userLineFlags).map(Number);
    
    // Correctly identified
    const correctlyFound = actualBlunderLineIndices.filter(idx => userFlaggedIndices.includes(idx)).length;
    const falsePositives = userFlaggedIndices.filter(idx => !actualBlunderLineIndices.includes(idx)).length;

    // Score accuracy
    const scoreDiff = Math.abs(userAwardedScore - activeChallenge.studentActualScore);
    const scoreAccuracy = Math.max(0, 100 - (scoreDiff * 25));
    const detectionAccuracy = Math.round((correctlyFound / actualBlunderLineIndices.length) * 100);
    const combinedAccuracy = Math.max(40, Math.round((detectionAccuracy * 0.7) + (scoreAccuracy * 0.3) - (falsePositives * 10)));

    setIsChallengeSubmitted(true);

    // Update scoreboard
    const newCard = {
      totalChallengesCompleted: examinerScoreCard.totalChallengesCompleted + 1,
      totalBlundersFound: examinerScoreCard.totalBlundersFound + correctlyFound,
      examinerAccuracyPct: Math.round((examinerScoreCard.examinerAccuracyPct + combinedAccuracy) / 2)
    };
    setExaminerScoreCard(newCard);
    try {
      localStorage.setItem('prepforge_examiner_scorecard', JSON.stringify(newCard));
    } catch (e) {
      // ignore
    }

    // Award XP
    if (onAwardXP) {
      const earnedXP = Math.max(40, correctlyFound * 35 + (scoreDiff === 0 ? 25 : 10));
      onAwardXP(earnedXP, `Spotted ${correctlyFound} examiner blunders in ${activeChallenge.subjectName}`);
    }
  };

  // Add blunder trap directly to Mistake Vault (Option 4)
  const handleAddTrapToMistakeVault = (blunder: BlunderDetail) => {
    if (!activeChallenge) return;

    // Convert category to CognitiveErrorCategory
    let cogCat: CognitiveErrorCategory = 'careless_calc';
    if (blunder.category === 'vague_keyword') cogCat = 'concept_gap';
    else if (blunder.category === 'sign_error') cogCat = 'formula_confusion';
    else if (blunder.category === 'missing_unit') cogCat = 'careless_calc';
    else if (blunder.category === 'concept_gap') cogCat = 'concept_gap';
    else if (blunder.category === 'misread_question') cogCat = 'misread_question';

    addMistake({
      subjectName: activeChallenge.subjectName,
      topicName: activeChallenge.topicName,
      question: `${activeChallenge.questionText}\n\n[EXAMINER TRAP]: ${blunder.title}`,
      userAttempt: blunder.studentMistakeQuote,
      correctAnswer: blunder.correctCorrection,
      errorCategory: cogCat,
      notes: `Trap Analysis: ${blunder.examinerTrapAnalysis}\nPrevention Rule: ${blunder.howToPrevent}`,
      source: 'red_pen'
    });

    setAddedTrapsToVault(prev => ({ ...prev, [blunder.id]: true }));
  };

  // Generate dynamic AI blunder challenge
  const handleGenerateAiChallenge = async () => {
    setIsGeneratingChallenge(true);
    try {
      const res = await fetch('/api/ai/generate-spot-blunder-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectName: aiGeneratorSubject,
          topicName: aiGeneratorTopic || 'Fundamental Principles',
          examBoard: 'Cambridge A-Level / CBSE Standard'
        })
      });

      const data = await res.json();
      if (data.success && data.challenge) {
        setChallenges(prev => [data.challenge, ...prev]);
        setSelectedChallengeId(data.challenge.id);
        setUserLineFlags({});
        setSelectedLineForAnnotation(null);
        setIsChallengeSubmitted(false);
        setIsAiModalOpen(false);
        setUserAwardedScore(Math.max(1, Math.round(data.challenge.totalMarks / 2)));
      }
    } catch (err) {
      console.error('Failed to generate AI blunder challenge:', err);
    } finally {
      setIsGeneratingChallenge(false);
    }
  };

  // ==========================================
  // GRADE MY OWN ANSWER STATE (EXISTING RED PEN)
  // ==========================================
  const [selectedSubject, setSelectedSubject] = useState<string>(
    initialSubjectName || (subjects.length > 0 ? subjects[0].name : 'Physics')
  );
  const [selectedTopic, setSelectedTopic] = useState<string>(
    initialTopicName || ''
  );
  const [examStandard, setExamStandard] = useState<string>(EXAM_STANDARDS[0]);
  const [totalMarks, setTotalMarks] = useState<number>(8);
  const [questionText, setQuestionText] = useState<string>('');
  const [studentAnswer, setStudentAnswer] = useState<string>('');
  
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<Array<{
    id: string;
    questionText: string;
    totalMarks: number;
    type: string;
    focusSkill: string;
    sampleKeyPoints: string[];
  }>>([]);

  const [isGrading, setIsGrading] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<RedPenResult | null>(null);
  const [addedDeductions, setAddedDeductions] = useState<Record<string, boolean>>({});
  const [myAnswerActiveTab, setMyAnswerActiveTab] = useState<'marking' | 'model_answer'>('marking');

  // Update available topics when subject changes
  const currentSubjectObj = subjects.find(s => s.name === selectedSubject);
  const availableTopics = currentSubjectObj ? currentSubjectObj.chapters.flatMap(c => c.topics) : [];

  useEffect(() => {
    if (availableTopics.length > 0 && !selectedTopic) {
      setSelectedTopic(availableTopics[0].title);
    }
  }, [selectedSubject, availableTopics, selectedTopic]);

  const handleFetchSuggestedQuestions = async (subject = selectedSubject, topic = selectedTopic) => {
    setIsLoadingQuestions(true);
    try {
      const res = await fetch('/api/ai/suggest-past-paper-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectName: subject,
          topicName: topic || 'Core Principles'
        })
      });
      const data = await res.json();
      if (data.questions && data.questions.length > 0) {
        setSuggestedQuestions(data.questions);
      }
    } catch (err) {
      console.error('Failed to load past paper questions:', err);
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  useEffect(() => {
    if (activeMode === 'grade_my_answer') {
      handleFetchSuggestedQuestions();
    }
  }, [selectedSubject, activeMode]);

  const handleApplyQuestion = (q: { questionText: string; totalMarks: number }) => {
    setQuestionText(q.questionText);
    setTotalMarks(q.totalMarks);
    setEvaluationResult(null);
  };

  const handleInsertSymbol = (symbol: string) => {
    setStudentAnswer(prev => prev + symbol);
  };

  const handleGradeWithRedPen = async () => {
    if (!questionText.trim() || !studentAnswer.trim()) return;

    setIsGrading(true);
    setEvaluationResult(null);
    setAddedDeductions({});

    try {
      const res = await fetch('/api/ai/grade-examiner-red-pen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectName: selectedSubject,
          topicName: selectedTopic || 'General',
          questionText,
          studentAnswer,
          totalMarks,
          examStandard
        })
      });

      const data = await res.json();
      if (data.success) {
        const result: RedPenResult = {
          id: 'redpen-' + Date.now(),
          subjectName: selectedSubject,
          topicName: selectedTopic || 'General',
          questionText,
          studentAnswer,
          totalMarks: data.totalMarks || totalMarks,
          awardedMarks: data.awardedMarks || 0,
          percentage: data.percentage || 0,
          examinerGrade: data.examinerGrade || 'Grade A',
          examinerFeedback: data.examinerFeedback || '',
          markingCriteria: data.markingCriteria || [],
          deductions: data.deductions || [],
          modelAnswer: data.modelAnswer || '',
          examinerTip: data.examinerTip || '',
          assessedAt: new Date().toISOString()
        };
        setEvaluationResult(result);

        if (onAwardXP) {
          const earnedXP = Math.max(30, Math.round((result.percentage / 100) * 80));
          onAwardXP(earnedXP, `Completed Examiner Red Pen marking for ${selectedSubject}`);
        }
      }
    } catch (err) {
      console.error('Error grading answer:', err);
    } finally {
      setIsGrading(false);
    }
  };

  const handleAddDeductionToMistakeVault = (deduction: RedPenDeduction) => {
    addMistake({
      subjectName: selectedSubject,
      topicName: selectedTopic || 'Past Paper Revision',
      question: `${questionText}\n[Marking Issue]: ${deduction.title}`,
      userAttempt: studentAnswer.substring(0, 300) + (studentAnswer.length > 300 ? '...' : ''),
      correctAnswer: deduction.recommendation,
      errorCategory: deduction.errorCategory,
      notes: `Examiner Deduction (-${deduction.marksLost} marks): ${deduction.reason}`,
      source: 'red_pen'
    });

    setAddedDeductions(prev => ({ ...prev, [deduction.id]: true }));
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Primary Header Banner with Unified Mode Switcher */}
      <div className="p-6 rounded-3xl bg-surface border border-theme shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
              <PenTool className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-serif font-bold text-primary">The Examiner’s Red Pen</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[10px] font-bold uppercase tracking-wider">
                  Option 2 • Mark Scheme Deconstructor
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <Flame className="w-3 h-3 text-amber-500" />
                  <span>Option 1 • Past Paper Trends</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted mt-1 max-w-2xl leading-relaxed">
                Step into the shoes of the <strong>Chief Examiner</strong> to spot candidate traps, deconstruct step-by-step marking rubrics <code>[M1, A1, B1]</code>, and sync recurring traps to your Mistake Vault.
              </p>
            </div>
          </div>

          {/* Quick stats & Mistake Vault link */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="px-3 py-1.5 rounded-2xl bg-surface-raised border border-theme text-right">
              <div className="text-[10px] uppercase font-bold text-muted">Examiner Eye</div>
              <div className="text-xs font-bold text-rose-600 dark:text-rose-400">
                {examinerScoreCard.examinerAccuracyPct}% Accuracy
              </div>
            </div>

            {onNavigateToMistakeVault && (
              <button
                onClick={onNavigateToMistakeVault}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-theme-accent hover:opacity-85 text-primary border border-theme text-xs font-semibold transition shadow-2xs cursor-pointer"
                title="View your saved examiner traps in the Mistake Vault"
              >
                <BookmarkPlus className="w-4 h-4 text-rose-500" />
                <span className="hidden sm:inline">Mistake Vault</span>
              </button>
            )}
          </div>
        </div>

        {/* Big Dual-Mode Switcher */}
        <div className="flex items-center p-1 rounded-2xl bg-surface-raised border border-theme max-w-md">
          <button
            onClick={() => setActiveMode('spot_blunder')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeMode === 'spot_blunder'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-muted hover:text-primary'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Spot the Blunder (Be Examiner)</span>
            <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-extrabold ${
              activeMode === 'spot_blunder' ? 'bg-white/20 text-white' : 'bg-rose-500/15 text-rose-600'
            }`}>
              GAME
            </span>
          </button>

          <button
            onClick={() => setActiveMode('grade_my_answer')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeMode === 'grade_my_answer'
                ? 'bg-primary text-white shadow-xs'
                : 'text-muted hover:text-primary'
            }`}
          >
            <PenTool className="w-4 h-4" />
            <span>Grade My Own Answer</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: SPOT THE BLUNDER (BE THE CHIEF EXAMINER GAME) */}
      {/* ========================================================================= */}
      {activeMode === 'spot_blunder' && (
        <div className="space-y-6">
          {/* Challenge Selector & Past Paper Trend Filters (Option 1) */}
          <div className="p-5 rounded-3xl bg-surface border border-theme shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-rose-500" />
                <h2 className="text-sm font-bold text-primary">Select Past Paper Trap Challenge</h2>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                {/* Subject filter */}
                <select
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl bg-surface-raised border border-theme text-primary text-xs font-semibold focus:outline-none"
                >
                  <option value="All">All Subjects</option>
                  <option value="Physics">Physics</option>
                  <option value="Chemistry">Chemistry</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Biology">Biology</option>
                </select>

                {/* AI Challenge Generator button */}
                <button
                  onClick={() => setIsAiModalOpen(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate AI Trap</span>
                </button>
              </div>
            </div>

            {/* Horizontal list of challenges with Trend Badges (Option 1) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              {filteredChallenges.map((ch) => {
                const isSelected = ch.id === selectedChallengeId;
                return (
                  <button
                    key={ch.id}
                    onClick={() => handleSelectChallenge(ch.id)}
                    className={`text-left p-3.5 rounded-2xl border transition relative flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-rose-500/10 border-rose-500/40 shadow-xs'
                        : 'bg-surface-raised hover:bg-theme-accent/60 border-theme/70'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] mb-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-surface font-bold text-primary border border-theme">
                          {ch.subjectName}
                        </span>
                        <span className="text-muted font-medium">{ch.pastPaperYear}</span>
                      </div>
                      <h3 className="text-xs font-bold text-primary line-clamp-2 leading-tight mb-2">
                        {ch.title}
                      </h3>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-theme/40 text-[10px]">
                      {/* Option 1: Trend & Casualty Rate */}
                      <div className="flex items-center justify-between text-muted">
                        <span>Trap Casualty:</span>
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          {ch.trapCasualtyRate}% of candidates
                        </span>
                      </div>
                      <div className="text-amber-600 dark:text-amber-400 font-semibold truncate">
                        {ch.examFrequency}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Challenge Arena */}
          {activeChallenge && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Official Question Stem & Persona */}
              <div className="lg:col-span-5 space-y-4">
                <div className="p-6 rounded-3xl bg-surface border border-theme shadow-xs space-y-4">
                  {/* Past Paper Metadata Header */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-surface-raised border border-theme text-[10px] font-bold text-primary">
                        {activeChallenge.examBoard}
                      </span>
                      <span className="text-[11px] text-muted font-medium">
                        {activeChallenge.pastPaperYear}
                      </span>
                    </div>
                    <h2 className="text-base font-serif font-bold text-primary pt-1">
                      {activeChallenge.title}
                    </h2>
                  </div>

                  {/* Option 1: Trend Frequency Box */}
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                      <Flame className="w-3.5 h-3.5 text-amber-500" />
                      <span>Past Paper Predictor & Historical Trend</span>
                    </div>
                    <p className="text-[11px] text-muted leading-relaxed">
                      {activeChallenge.examFrequency}. An estimated <strong>{activeChallenge.trapCasualtyRate}%</strong> of real board candidates lost marks to the traps hidden in this question.
                    </p>
                  </div>

                  {/* Question Stem */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-primary flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-rose-500" />
                        <span>Official Exam Question Stem</span>
                      </label>
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold text-[10px]">
                        {activeChallenge.totalMarks} Total Marks
                      </span>
                    </div>
                    <div className="p-4 rounded-2xl bg-surface-raised border border-theme text-xs text-primary font-serif whitespace-pre-line leading-relaxed shadow-2xs">
                      {activeChallenge.questionText}
                    </div>
                  </div>

                  {/* Candidate Persona Card */}
                  <div className="p-3.5 rounded-2xl bg-surface-raised border border-theme/80 text-xs flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-muted">Submitted By Candidate</div>
                      <div className="font-bold text-primary">{activeChallenge.fictionalStudentName}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-muted">Target Grade</div>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold text-[10px]">
                        {activeChallenge.fictionalStudentTargetGrade}
                      </span>
                    </div>
                  </div>

                  {/* Instructions for user */}
                  <div className="p-4 rounded-2xl bg-theme-accent/40 border border-theme/50 text-[11px] text-muted space-y-1">
                    <p className="font-bold text-primary flex items-center gap-1">
                      <Compass className="w-3.5 h-3.5 text-rose-500" />
                      <span>Your Task as Chief Examiner:</span>
                    </p>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>Click any suspicious line on the student's paper to flag it with your <strong>Red Pen</strong>.</li>
                      <li>Specify the blunder category (e.g. Unit Missing, Sign Error, Vague Phrasing).</li>
                      <li>Decide how many marks to award and click <strong>Submit Review</strong>.</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Right Column: Interactive Student Answer Sheet (Red Pen Canvas) */}
              <div className="lg:col-span-7 space-y-5">
                <div className="p-6 rounded-3xl bg-surface border border-theme shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-theme pb-3">
                    <div className="flex items-center gap-2">
                      <PenTool className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                      <h3 className="text-sm font-bold text-primary">
                        Student Answer Paper (Click lines to flag blunders)
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted font-medium">
                        Flagged: <strong>{Object.keys(userLineFlags).length}</strong> lines
                      </span>
                      {Object.keys(userLineFlags).length > 0 && (
                        <button
                          onClick={() => setUserLineFlags({})}
                          className="text-[11px] text-rose-600 hover:underline cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Lined Paper Container */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/5 dark:bg-zinc-900/50 border border-amber-500/20 space-y-2.5 font-sans">
                    {activeChallenge.answerLines.map((line) => {
                      const isFlagged = userLineFlags[line.lineIndex]?.isFlagged;
                      const flagData = userLineFlags[line.lineIndex];
                      const isAnnotatingThis = selectedLineForAnnotation === line.lineIndex;

                      return (
                        <div key={line.id} className="relative group">
                          <div
                            onClick={() => {
                              if (isChallengeSubmitted) return;
                              setSelectedLineForAnnotation(isAnnotatingThis ? null : line.lineIndex);
                            }}
                            className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                              isFlagged
                                ? 'bg-rose-500/10 border-rose-500/40 text-rose-950 dark:text-rose-100 shadow-2xs'
                                : 'bg-surface hover:bg-surface-raised border-theme/60 text-primary'
                            }`}
                          >
                            <span className="font-mono text-[10px] text-muted/80 font-bold shrink-0 mt-0.5">
                              L{line.lineIndex + 1}
                            </span>

                            <div className="flex-1 text-xs sm:text-sm font-serif leading-relaxed">
                              {line.text}
                            </div>

                            {/* Status badge */}
                            <div className="shrink-0 flex items-center gap-1.5">
                              {isFlagged ? (
                                <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white font-bold text-[10px] flex items-center gap-1 shadow-2xs">
                                  <PenTool className="w-3 h-3" />
                                  <span>BLUNDER FLAGGED</span>
                                </span>
                              ) : (
                                <span className="text-[11px] text-muted opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                  <PenTool className="w-3 h-3 text-rose-500" />
                                  <span>Click to Flag</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Annotation Menu Dropdown */}
                          {isAnnotatingThis && !isChallengeSubmitted && (
                            <div className="p-4 rounded-2xl bg-surface border border-rose-500/40 shadow-lg mt-2 space-y-3 z-10 animate-in fade-in duration-150">
                              <div className="flex items-center justify-between text-xs font-bold text-primary">
                                <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                                  <PenTool className="w-3.5 h-3.5" />
                                  <span>Tag Blunder on Line {line.lineIndex + 1}</span>
                                </span>
                                <button
                                  onClick={() => setSelectedLineForAnnotation(null)}
                                  className="text-muted hover:text-primary cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                {BLUNDER_CATEGORIES.map(cat => (
                                  <button
                                    key={cat.id}
                                    onClick={() => handleFlagLine(line.lineIndex, cat.id)}
                                    className={`p-2 rounded-xl text-left border text-[11px] font-bold transition flex items-center gap-2 cursor-pointer ${
                                      flagData?.category === cat.id
                                        ? 'bg-rose-600 text-white border-rose-600'
                                        : 'bg-surface-raised hover:bg-theme-accent/80 border-theme text-primary'
                                    }`}
                                  >
                                    <span>{cat.icon}</span>
                                    <span className="truncate">{cat.label}</span>
                                  </button>
                                ))}
                              </div>

                              {isFlagged && (
                                <div className="pt-2 border-t border-theme/60 flex justify-end">
                                  <button
                                    onClick={() => handleUnflagLine(line.lineIndex)}
                                    className="text-[11px] font-bold text-muted hover:text-rose-600 cursor-pointer"
                                  >
                                    Remove Red Pen Flag from Line {line.lineIndex + 1}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Examiner Review Decision & Award Bar */}
                  {!isChallengeSubmitted ? (
                    <div className="p-4 rounded-2xl bg-surface-raised border border-theme space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <label className="text-xs font-bold text-primary block">
                            Your Examiner Mark Award:
                          </label>
                          <span className="text-[11px] text-muted">
                            How many marks should {activeChallenge.fictionalStudentName} receive?
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={0}
                            max={activeChallenge.totalMarks}
                            value={userAwardedScore}
                            onChange={(e) => setUserAwardedScore(Number(e.target.value))}
                            className="w-28 sm:w-36 accent-rose-600"
                          />
                          <span className="px-3 py-1 rounded-xl bg-surface border border-theme text-sm font-bold text-primary">
                            {userAwardedScore} / {activeChallenge.totalMarks}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={handleSubmitExaminerReview}
                        className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Submit Chief Examiner Verdict & Deconstruct Mark Scheme</span>
                      </button>
                    </div>
                  ) : (
                    /* The Big Reveal Banner */
                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-500/15 via-surface-raised to-surface border border-rose-500/30 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                            Examiner Verdict Comparison
                          </span>
                          <div className="flex items-baseline gap-2 mt-0.5">
                            <span className="text-2xl font-serif font-bold text-primary">
                              Official Board Score: {activeChallenge.studentActualScore} / {activeChallenge.totalMarks}
                            </span>
                            <span className="text-xs text-muted font-semibold">
                              (You awarded {userAwardedScore}/{activeChallenge.totalMarks})
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setIsChallengeSubmitted(false);
                            setUserLineFlags({});
                          }}
                          className="px-3 py-1.5 rounded-xl bg-surface border border-theme text-xs font-bold text-muted hover:text-primary transition shrink-0 cursor-pointer"
                        >
                          Retry Marking
                        </button>
                      </div>

                      <p className="text-xs text-secondary leading-relaxed">
                        {Math.abs(userAwardedScore - activeChallenge.studentActualScore) === 0
                          ? '🎯 Outstanding! Your score matches the Official Chief Examiner mark scheme exactly!'
                          : `The Chief Examiner awarded ${activeChallenge.studentActualScore} marks. Explore the Deconstructed Mark Scheme below to see where candidate marks were lost.`}
                      </p>
                    </div>
                  )}

                  {/* POST-SUBMISSION DECONSTRUCTED TABS (OPTIONS 2 & 4) */}
                  {isChallengeSubmitted && (
                    <div className="space-y-4 pt-2 animate-in fade-in duration-300">
                      {/* Sub-tab switcher */}
                      <div className="flex items-center p-1 rounded-xl bg-surface-raised border border-theme text-xs font-bold">
                        <button
                          onClick={() => setActiveRevealTab('deconstructed_rubric')}
                          className={`flex-1 py-1.5 px-2 rounded-lg transition text-center ${
                            activeRevealTab === 'deconstructed_rubric'
                              ? 'bg-rose-600 text-white shadow-2xs'
                              : 'text-muted hover:text-primary'
                          }`}
                        >
                          Option 2: Mark Scheme Deconstructor
                        </button>
                        <button
                          onClick={() => setActiveRevealTab('examiner_traps')}
                          className={`flex-1 py-1.5 px-2 rounded-lg transition text-center ${
                            activeRevealTab === 'examiner_traps'
                              ? 'bg-rose-600 text-white shadow-2xs'
                              : 'text-muted hover:text-primary'
                          }`}
                        >
                          Option 4: Trap Autopsy & Mistake Vault
                        </button>
                        <button
                          onClick={() => setActiveRevealTab('model_answer')}
                          className={`flex-1 py-1.5 px-2 rounded-lg transition text-center ${
                            activeRevealTab === 'model_answer'
                              ? 'bg-rose-600 text-white shadow-2xs'
                              : 'text-muted hover:text-primary'
                          }`}
                        >
                          10/10 Model Board Answer
                        </button>
                      </div>

                      {/* TAB 1: OPTION 2 DECONSTRUCTED MARK SCHEME */}
                      {activeRevealTab === 'deconstructed_rubric' && (
                        <div className="space-y-3">
                          <div className="text-xs text-muted">
                            Official step-by-step mark allocations with board annotation codes <code>[M1, A1, B1]</code>:
                          </div>

                          <div className="space-y-2">
                            {activeChallenge.deconstructedRubric.map((item) => (
                              <div
                                key={item.id}
                                className={`p-3.5 rounded-2xl border transition flex items-start justify-between gap-3 text-xs ${
                                  item.awardedToStudent
                                    ? 'bg-emerald-500/5 border-emerald-500/25'
                                    : 'bg-rose-500/5 border-rose-500/25'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <span className={`px-2 py-1 rounded-lg font-mono font-bold text-xs shrink-0 ${
                                    item.code === 'M1'
                                      ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                                      : item.code === 'A1'
                                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                      : item.code === 'B1'
                                      ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300'
                                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                  }`}>
                                    [{item.code}]
                                  </span>

                                  <div className="space-y-1">
                                    <div className="font-bold text-primary">{item.title}</div>
                                    <p className="text-[11px] text-muted leading-relaxed">
                                      {item.examinerRationale}
                                    </p>

                                    {/* Mandatory Keywords badge */}
                                    {item.mandatoryKeywords.length > 0 && (
                                      <div className="flex flex-wrap items-center gap-1 pt-1">
                                        <span className="text-[10px] text-muted uppercase font-bold">Mandatory Trigger Words:</span>
                                        {item.mandatoryKeywords.map((kw, idx) => (
                                          <span
                                            key={idx}
                                            className="px-1.5 py-0.5 rounded bg-surface border border-theme font-mono text-[10px] text-primary"
                                          >
                                            "{kw}"
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="shrink-0 text-right">
                                  <span className={`font-bold ${item.awardedToStudent ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {item.awardedToStudent ? `+${item.marksAllocated}` : '0'}
                                  </span>
                                  <span className="text-muted font-normal"> / {item.marksAllocated}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* TAB 2: OPTION 4 EXAMINER TRAP AUTOPSY & 1-CLICK MISTAKE VAULT SYNC */}
                      {activeRevealTab === 'examiner_traps' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-xs text-muted">
                            <span>Hidden traps designed by the board exam setters:</span>
                            <span>Click to log to your Mistake Vault</span>
                          </div>

                          <div className="space-y-3">
                            {activeChallenge.blunders.map((blunder) => {
                              const isAdded = addedTrapsToVault[blunder.id];
                              return (
                                <div
                                  key={blunder.id}
                                  className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/25 space-y-3 text-xs"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white font-mono font-bold text-[10px]">
                                          -{blunder.marksDeducted} Mark Trap
                                        </span>
                                        <h4 className="font-bold text-primary">{blunder.title}</h4>
                                      </div>
                                      <p className="text-muted text-[11px] mt-1 italic">
                                        Student wrote: {blunder.studentMistakeQuote}
                                      </p>
                                    </div>

                                    <button
                                      onClick={() => handleAddTrapToMistakeVault(blunder)}
                                      disabled={isAdded}
                                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs ${
                                        isAdded
                                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                          : 'bg-rose-600 hover:bg-rose-700 text-white active:scale-95'
                                      }`}
                                    >
                                      {isAdded ? (
                                        <>
                                          <Check className="w-3.5 h-3.5" />
                                          <span>Logged in Vault</span>
                                        </>
                                      ) : (
                                        <>
                                          <BookmarkPlus className="w-3.5 h-3.5" />
                                          <span>Log to Mistake Vault</span>
                                        </>
                                      )}
                                    </button>
                                  </div>

                                  <div className="p-3 rounded-xl bg-surface border border-theme/60 space-y-1.5 text-[11px]">
                                    <p className="text-secondary leading-relaxed">
                                      <strong>Why the Setter Placed This Trap:</strong> {blunder.examinerTrapAnalysis}
                                    </p>
                                    <p className="text-rose-700 dark:text-rose-300 leading-relaxed font-semibold">
                                      🛡️ <strong>Golden Prevention Rule:</strong> {blunder.howToPrevent}
                                    </p>
                                    <p className="text-emerald-700 dark:text-emerald-300 leading-relaxed font-mono">
                                      ✓ <strong>Examiner Correction:</strong> {blunder.correctCorrection}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* TAB 3: 10/10 MODEL ANSWER */}
                      {activeRevealTab === 'model_answer' && (
                        <div className="space-y-4">
                          <div className="p-4 rounded-2xl bg-surface-raised border border-theme space-y-3">
                            <div className="flex items-center justify-between border-b border-theme pb-2">
                              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                <Award className="w-4 h-4" />
                                <span>Chief Examiner's 10/10 Model Solution</span>
                              </span>
                              <span className="text-[11px] text-muted">{activeChallenge.examBoard}</span>
                            </div>

                            <div className="text-xs text-primary font-serif whitespace-pre-line leading-relaxed">
                              {activeChallenge.modelAnswer}
                            </div>
                          </div>

                          {/* Secret tip */}
                          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-primary flex items-start gap-2.5">
                            <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                              <strong className="text-amber-800 dark:text-amber-300">Chief Examiner Pro-Tip:</strong>
                              <p className="text-muted mt-0.5 leading-relaxed">{activeChallenge.chiefExaminerSecretTip}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: GRADE MY OWN ANSWER (ORIGINAL RED PEN WORKSPACE) */}
      {/* ========================================================================= */}
      {activeMode === 'grade_my_answer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Configuration & Suggested Question Bank */}
          <div className="lg:col-span-5 space-y-5">
            <div className="p-5 rounded-3xl bg-surface border border-theme shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-primary flex items-center gap-2">
                <Sliders className="w-4 h-4 text-muted" />
                <span>Exam Paper Parameters</span>
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1.5">Subject</label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => {
                      setSelectedSubject(e.target.value);
                      setSelectedTopic('');
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-raised border border-theme text-primary text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                    {subjects.length === 0 && (
                      <>
                        <option value="Physics">Physics</option>
                        <option value="Chemistry">Chemistry</option>
                        <option value="Mathematics">Mathematics</option>
                        <option value="Biology">Biology</option>
                      </>
                    )}
                  </select>
                </div>

                {availableTopics.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1.5">Topic / Chapter Focus</label>
                    <select
                      value={selectedTopic}
                      onChange={(e) => setSelectedTopic(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-raised border border-theme text-primary text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {availableTopics.map(t => (
                        <option key={t.id} value={t.title}>{t.title}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1.5">Exam Standard</label>
                    <select
                      value={examStandard}
                      onChange={(e) => setExamStandard(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl bg-surface-raised border border-theme text-primary text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {EXAM_STANDARDS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1.5">Max Marks</label>
                    <select
                      value={totalMarks}
                      onChange={(e) => setTotalMarks(Number(e.target.value))}
                      className="w-full px-2.5 py-2 rounded-xl bg-surface-raised border border-theme text-primary text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value={3}>3 Marks (Short Def)</option>
                      <option value={4}>4 Marks (Short Concept)</option>
                      <option value={5}>5 Marks (Standard)</option>
                      <option value={8}>8 Marks (Derivation)</option>
                      <option value={10}>10 Marks (Section C)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Past Paper Questions Bank */}
            <div className="p-5 rounded-3xl bg-surface border border-theme shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-primary flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-rose-500" />
                  <span>Suggested Past Paper Prompts</span>
                </h2>
                <button
                  onClick={() => handleFetchSuggestedQuestions()}
                  disabled={isLoadingQuestions}
                  className="text-[11px] font-semibold text-primary/70 hover:text-primary flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingQuestions ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {isLoadingQuestions ? (
                <div className="py-8 text-center text-xs text-muted">
                  <Sparkles className="w-5 h-5 mx-auto mb-2 text-rose-500 animate-pulse" />
                  <span>Extracting authentic board questions...</span>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {suggestedQuestions.map((q) => (
                    <button
                      key={q.id}
                      onClick={() => handleApplyQuestion(q)}
                      className="w-full text-left p-3 rounded-2xl bg-surface-raised hover:bg-theme-accent/70 border border-theme/60 transition group cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-bold text-primary group-hover:text-rose-600 transition-colors">
                          {q.focusSkill}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-surface text-muted border border-theme text-[10px] font-semibold">
                          {q.totalMarks} Marks
                        </span>
                      </div>
                      <p className="text-xs text-secondary line-clamp-2 leading-relaxed">
                        {q.questionText}
                      </p>
                    </button>
                  ))}

                  {suggestedQuestions.length === 0 && (
                    <div className="p-4 rounded-2xl bg-theme-accent/40 text-center text-xs text-muted">
                      Click refresh to generate past paper questions for {selectedSubject}.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Answer Input & Grading Workspace */}
          <div className="lg:col-span-7 space-y-5">
            <div className="p-6 rounded-3xl bg-surface border border-theme shadow-xs space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-rose-500" />
                    <span>Exam Question (Max {totalMarks} Marks)</span>
                  </label>
                  <span className="text-[11px] text-muted">{selectedSubject} • {selectedTopic || 'General'}</span>
                </div>
                <textarea
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="Type or paste the exam question here (e.g. State Lenz's Law and show how it is an example of the Law of Conservation of Energy...)"
                  rows={2}
                  className="w-full p-3 rounded-2xl bg-surface-raised border border-theme text-primary text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 leading-relaxed font-sans"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5 text-rose-500" />
                    <span>Your Written Response</span>
                  </label>
                  <span className="text-[11px] text-muted">
                    {studentAnswer.trim().split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>

                {/* Math Symbols Bar */}
                <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-none mb-1 text-xs">
                  <span className="text-[10px] text-muted uppercase font-bold shrink-0 mr-1">Symbols:</span>
                  {QUICK_MATH_SYMBOLS.map(sym => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => handleInsertSymbol(sym)}
                      className="px-2 py-0.5 rounded-lg bg-theme-accent/60 hover:bg-theme-accent text-primary text-xs font-mono font-bold shrink-0 transition border border-theme/40 cursor-pointer"
                    >
                      {sym}
                    </button>
                  ))}
                </div>

                <textarea
                  value={studentAnswer}
                  onChange={(e) => setStudentAnswer(e.target.value)}
                  placeholder="Write your full exam answer here. State laws, show intermediate steps, equations, and final conclusions with units..."
                  rows={8}
                  className="w-full p-4 rounded-2xl bg-surface-raised border border-theme text-primary text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 leading-relaxed font-sans"
                />
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => {
                    setStudentAnswer('');
                    setEvaluationResult(null);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-muted hover:text-primary transition cursor-pointer"
                >
                  Clear
                </button>

                <button
                  onClick={handleGradeWithRedPen}
                  disabled={isGrading || !questionText.trim() || !studentAnswer.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  {isGrading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Examiner is Marking with Red Pen...</span>
                    </>
                  ) : (
                    <>
                      <PenTool className="w-4 h-4" />
                      <span>Grade with Examiner’s Red Pen</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Evaluation Output */}
            {evaluationResult && (
              <div className="p-6 rounded-3xl bg-surface border border-rose-500/30 shadow-md space-y-6 animate-in fade-in duration-300">
                {/* Score Header */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-500/10 via-surface-raised to-surface border border-rose-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                      Examiner Assessment & Verdict
                    </span>
                    <div className="flex items-baseline gap-2.5 mt-0.5">
                      <span className="text-3xl font-serif font-bold text-primary">
                        {evaluationResult.awardedMarks}
                      </span>
                      <span className="text-sm font-bold text-muted">
                        / {evaluationResult.totalMarks} Marks ({evaluationResult.percentage}%)
                      </span>
                      <span className="ml-2 px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-xs font-bold">
                        {evaluationResult.examinerGrade}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center p-1 rounded-xl bg-surface border border-theme text-xs font-semibold">
                    <button
                      onClick={() => setMyAnswerActiveTab('marking')}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                        myAnswerActiveTab === 'marking' ? 'bg-primary text-white shadow-2xs' : 'text-muted hover:text-primary'
                      }`}
                    >
                      Red Pen Rubric
                    </button>
                    <button
                      onClick={() => setMyAnswerActiveTab('model_answer')}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                        myAnswerActiveTab === 'model_answer' ? 'bg-primary text-white shadow-2xs' : 'text-muted hover:text-primary'
                      }`}
                    >
                      Model 10/10 Answer
                    </button>
                  </div>
                </div>

                {/* Examiner Voice Feedback */}
                <div className="p-4 rounded-2xl bg-theme-accent/40 border border-theme/60 text-xs text-primary leading-relaxed flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-primary">{evaluationResult.examinerFeedback}</p>
                    {evaluationResult.examinerTip && (
                      <p className="mt-2 text-muted italic">
                        💡 <strong>Examiner Pro-Tip:</strong> {evaluationResult.examinerTip}
                      </p>
                    )}
                  </div>
                </div>

                {/* Rubric Breakdown */}
                {myAnswerActiveTab === 'marking' && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-2.5">
                        Mark Allocation Breakdown
                      </h3>
                      <div className="space-y-2">
                        {evaluationResult.markingCriteria.map((crit) => (
                          <div
                            key={crit.id}
                            className="p-3.5 rounded-xl bg-surface-raised border border-theme flex items-start justify-between gap-3 text-xs"
                          >
                            <div className="flex items-start gap-2.5">
                              {crit.passed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              ) : (
                                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                              )}
                              <div>
                                <p className="font-bold text-primary">{crit.criterion}</p>
                                <p className="text-[11px] text-muted mt-0.5">{crit.comment}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className={`font-bold ${crit.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                +{crit.awardedMarks}
                              </span>
                              <span className="text-muted font-normal"> / {crit.maxMarks}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Deductions & Log to Mistake Vault */}
                    {evaluationResult.deductions.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2.5">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                            Red Pen Penalties & Lost Marks ({evaluationResult.deductions.length})
                          </h3>
                          <span className="text-[11px] text-muted">Click to add to your Mistake Vault</span>
                        </div>

                        <div className="space-y-2.5">
                          {evaluationResult.deductions.map((ded) => {
                            const isAdded = addedDeductions[ded.id];
                            return (
                              <div
                                key={ded.id}
                                className="p-3.5 rounded-2xl bg-rose-500/5 border border-rose-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300 font-mono font-bold text-xs">
                                      -{ded.marksLost} Mark
                                    </span>
                                    <span className="font-bold text-xs text-primary">{ded.title}</span>
                                  </div>
                                  <p className="text-xs text-secondary mt-1 leading-relaxed">
                                    {ded.reason}
                                  </p>
                                  <p className="text-[11px] text-muted mt-1">
                                    <strong>Examiner Fix:</strong> {ded.recommendation}
                                  </p>
                                </div>

                                <button
                                  onClick={() => handleAddDeductionToMistakeVault(ded)}
                                  disabled={isAdded}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer shadow-2xs ${
                                    isAdded
                                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                      : 'bg-rose-600 hover:bg-rose-700 text-white active:scale-95'
                                  }`}
                                >
                                  {isAdded ? (
                                    <>
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Added to Vault</span>
                                    </>
                                  ) : (
                                    <>
                                      <BookmarkPlus className="w-3.5 h-3.5" />
                                      <span>Log to Mistake Vault</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Model Answer */}
                {myAnswerActiveTab === 'model_answer' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-surface-raised border border-theme">
                      <div className="flex items-center justify-between mb-3 border-b border-theme pb-2">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <Award className="w-4 h-4" />
                          <span>Flawless 10/10 Model Board Answer</span>
                        </span>
                        <span className="text-[11px] text-muted">{examStandard}</span>
                      </div>

                      <div className="text-xs text-primary leading-relaxed whitespace-pre-line font-sans space-y-2">
                        {evaluationResult.modelAnswer}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-theme-accent/50 text-[11px] text-muted flex items-center justify-between">
                      <span>Notice how the model answer uses numbered points and bold keywords.</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(evaluationResult.modelAnswer);
                        }}
                        className="text-primary font-bold hover:underline cursor-pointer"
                      >
                        Copy Model Answer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Challenge Generator Modal */}
      {isAiModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-theme rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-rose-500" />
                <h3 className="text-base font-bold text-primary">Generate AI Blunder Challenge</h3>
              </div>
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="text-muted hover:text-primary cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Create an authentic past-paper exam question with subtle candidate traps for any subject or topic from your curriculum.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Subject</label>
                <select
                  value={aiGeneratorSubject}
                  onChange={(e) => setAiGeneratorSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-raised border border-theme text-primary text-xs font-medium focus:outline-none"
                >
                  {subjects.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                  {subjects.length === 0 && (
                    <>
                      <option value="Physics">Physics</option>
                      <option value="Chemistry">Chemistry</option>
                      <option value="Mathematics">Mathematics</option>
                      <option value="Biology">Biology</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Topic / Concept Focus</label>
                <input
                  type="text"
                  value={aiGeneratorTopic}
                  onChange={(e) => setAiGeneratorTopic(e.target.value)}
                  placeholder="e.g. Projectile Motion, Organic Synthesis, Quadratic Roots..."
                  className="w-full px-3 py-2 rounded-xl bg-surface-raised border border-theme text-primary text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-muted hover:text-primary transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateAiChallenge}
                disabled={isGeneratingChallenge || !aiGeneratorTopic.trim()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isGeneratingChallenge ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Synthesizing Exam Traps...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Challenge</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
