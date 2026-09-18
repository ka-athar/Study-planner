import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Award, 
  Play, 
  Pause, 
  RotateCcw, 
  Flag, 
  Send, 
  BookOpen, 
  Check, 
  X, 
  HelpCircle, 
  ChevronLeft, 
  ChevronRight, 
  Layers, 
  BarChart3, 
  Bot, 
  Calendar, 
  Mail, 
  FileText, 
  ArrowRight,
  Maximize2,
  Minimize2,
  Edit3,
  Flame,
  ShieldCheck,
  Zap,
  Info,
  Languages,
  Camera,
  Upload,
  Image as ImageIcon,
  ZoomIn,
  Eye
} from 'lucide-react';
import { 
  Subject, 
  TestResult, 
  UserProfile, 
  ActiveTab, 
  StudyPlan, 
  ScheduledStudyTask,
  MockExam, 
  MockExamQuestion, 
  GradedMockExam, 
  GradedQuestionResult,
  EXAM_BOARD_PRESETS,
  ExamBoard,
  ExamBoardPreset
} from '../types';
import { apiGenerateMockExam, apiGradeMockExam } from '../lib/aiApi';
import { getOrRequestGmailToken, sendTestImprovementEmail } from '../lib/gmailService';

interface MockExamSimulatorProps {
  subjects: Subject[];
  testResults?: TestResult[];
  userProfile?: UserProfile | null;
  plans?: StudyPlan[];
  onAddTestResult: (test: Omit<TestResult, 'id'>) => void;
  onUpdateSubjects?: (updatedSubjects: Subject[]) => void;
  onSavePlan?: (plan: StudyPlan | Omit<StudyPlan, 'id'>) => Promise<void> | void;
  onAddScheduledTask?: (task: ScheduledStudyTask) => void;
  setActiveTab?: (tab: ActiveTab) => void;
  onSendPromptToTutor: (promptText: string) => void;
  onSelectTopicInSyllabus?: (subjectId: string, topicId: string) => void;
  initialSubject?: string;
  initialTopic?: string;
}

type SimulatorPhase = 'setup' | 'generating' | 'active_exam' | 'grading' | 'results';

const PRESETS = [
  {
    id: 'cie_p1_mcq',
    name: 'Cambridge Paper 1 (MCQ)',
    duration: 60,
    marks: 40,
    type: 'mcq' as const,
    difficulty: 'Past Paper Style' as const,
    paperFormatCode: 'cie_p1_mcq',
    badge: 'CIE P1',
    desc: '40 authentic Cambridge MCQs • 1.0 min/mark pacing'
  },
  {
    id: 'cie_p2_structured',
    name: 'Cambridge Paper 2 (Theory)',
    duration: 75,
    marks: 60,
    type: 'structured' as const,
    difficulty: 'Past Paper Style' as const,
    paperFormatCode: 'cie_p2_structured',
    badge: 'CIE P2',
    desc: 'Structured subparts ((a)(i), (b)), definitions & derivations'
  },
  {
    id: 'cie_p4_extended',
    name: 'Cambridge Paper 4 (Extended)',
    duration: 120,
    marks: 100,
    type: 'structured' as const,
    difficulty: 'Past Paper Style' as const,
    paperFormatCode: 'cie_p4_extended',
    badge: 'A-Level P4',
    desc: 'Advanced synoptic multi-part derivations & calculations'
  },
  {
    id: 'fbise_ssc_theory',
    name: 'FBISE Federal Board',
    duration: 90,
    marks: 65,
    type: 'mixed' as const,
    difficulty: 'Past Paper Style' as const,
    paperFormatCode: 'fbise_ssc_theory',
    badge: 'FBISE',
    desc: 'Sec A MCQs + Sec B Short Answers + Sec C Long Problems'
  },
  {
    id: 'punjab_bise',
    name: 'Punjab Board BISE',
    duration: 75,
    marks: 60,
    type: 'mixed' as const,
    difficulty: 'Past Paper Style' as const,
    paperFormatCode: 'punjab_bise',
    badge: 'BISE',
    desc: 'Objective MCQs + Subjective Short & Long numerical pairs'
  },
  {
    id: 'mdcat_speed',
    name: 'MDCAT Entrance Sprint',
    duration: 45,
    marks: 50,
    type: 'mcq' as const,
    difficulty: 'Challenging' as const,
    paperFormatCode: 'mdcat_speed',
    badge: 'MDCAT',
    desc: 'Rapid medical entrance drill • 50 MCQs in 45 mins'
  },
  {
    id: 'standard_30',
    name: '30-Min Diagnostic Drill',
    duration: 30,
    marks: 25,
    type: 'mixed' as const,
    difficulty: 'Standard' as const,
    paperFormatCode: 'custom',
    badge: 'Standard',
    desc: 'Balanced diagnostic test with MCQs and short problems'
  }
];

const MATH_SYMBOLS = ['π', '√', 'Δ', 'θ', '±', '²', '³', '→', 'Ω', 'λ', 'μ', '∫', '∑', '°', '×', '÷', '≈', '≠', '≤', '≥', '∞'];

export const MockExamSimulator: React.FC<MockExamSimulatorProps> = ({
  subjects,
  testResults = [],
  userProfile = null,
  plans = [],
  onAddTestResult,
  onUpdateSubjects,
  onSavePlan,
  onAddScheduledTask,
  setActiveTab,
  onSendPromptToTutor,
  onSelectTopicInSyllabus,
  initialSubject,
  initialTopic
}) => {
  // Phase state
  const [phase, setPhase] = useState<SimulatorPhase>('setup');

  // Setup Form Configuration State
  const [selectedSubjectName, setSelectedSubjectName] = useState<string>(
    initialSubject || (subjects.length > 0 ? subjects[0].name : '')
  );
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>('cie_p1_mcq');
  const [paperFormatCode, setPaperFormatCode] = useState<string>('cie_p1_mcq');
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [totalMarks, setTotalMarks] = useState<number>(40);
  const [examType, setExamType] = useState<'mixed' | 'mcq' | 'structured' | 'numerical'>('mcq');
  const [difficulty, setDifficulty] = useState<'Foundation' | 'Standard' | 'Challenging' | 'Past Paper Style'>('Past Paper Style');
  const [selectedBoardId, setSelectedBoardId] = useState<ExamBoard>(() => {
    return (subjects[0]?.boardAffiliation as ExamBoard) || 'cie_olevel';
  });
  const [examBoard, setExamBoard] = useState<string>('Cambridge CIE O-Level / IGCSE');
  const [examLanguage, setExamLanguage] = useState<'en' | 'ur' | 'bilingual'>('en');
  const [customInstructions, setCustomInstructions] = useState<string>('');
  const [focusWeakTopics, setFocusWeakTopics] = useState<boolean>(true);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Active Exam State
  const [currentExam, setCurrentExam] = useState<MockExam | null>(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [studentAnswers, setStudentAnswers] = useState<Record<string, string>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [secondsRemaining, setSecondsRemaining] = useState<number>(1800);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [examStartTime, setExamStartTime] = useState<number>(0);
  const [timeSpentSeconds, setTimeSpentSeconds] = useState<number>(0);
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showScratchpad, setShowScratchpad] = useState<boolean>(false);
  const [scratchpadText, setScratchpadText] = useState<string>('');

  // Vision OCR and Optical Handwriting State
  const [handwrittenImages, setHandwrittenImages] = useState<Record<string, string>>({});
  const [previewImageModalUrl, setPreviewImageModalUrl] = useState<string | null>(null);

  // Results State
  const [gradedResult, setGradedResult] = useState<GradedMockExam | null>(null);
  const [resultsActiveSubTab, setResultsActiveSubTab] = useState<'rubric' | 'topics' | 'report' | 'timesink'>('rubric');
  const [expandedRubrics, setExpandedRubrics] = useState<Record<string, boolean>>({});
  const [savedToVaultStatus, setSavedToVaultStatus] = useState<boolean>(false);
  const [emailStatus, setEmailStatus] = useState<{ loading: boolean; msg: string; success?: boolean } | null>(null);
  const [questionTimeSpent, setQuestionTimeSpent] = useState<Record<string, number>>({});
  const [examHallAtmosphere, setExamHallAtmosphere] = useState<boolean>(true);

  // Active Subject Object
  const currentSubjectObj = subjects.find(s => (s.name || '').toLowerCase() === (selectedSubjectName || '').toLowerCase()) || subjects[0];

  // Sync board and language when subject selection changes
  useEffect(() => {
    if (currentSubjectObj?.boardAffiliation) {
      setSelectedBoardId(currentSubjectObj.boardAffiliation as ExamBoard);
      const found = EXAM_BOARD_PRESETS.find(p => p.id === currentSubjectObj.boardAffiliation);
      if (found) {
        setExamBoard(found.name);
      }
    }
    if (currentSubjectObj?.language === 'ur') {
      setExamLanguage('ur');
    }
  }, [currentSubjectObj]);

  // Extract student weak topics for this subject
  const subjectWeakTopics = React.useMemo(() => {
    const weakList: string[] = [];
    // From subjects syllabus status
    if (currentSubjectObj) {
      currentSubjectObj.chapters?.forEach(ch => {
        ch.topics?.forEach(tp => {
          if (tp.status === 'Weak' || tp.status === 'Needs Revision') {
            weakList.push(`${tp.name} (${ch.name})`);
          }
        });
      });
    }
    // From test results mistakes
    testResults
      .filter(t => (t.subjectName || '').toLowerCase() === (selectedSubjectName || '').toLowerCase())
      .forEach(t => {
        if (t.struggledTopics) {
          t.struggledTopics.forEach(st => {
            if (!weakList.includes(st)) weakList.push(st);
          });
        }
      });
    return weakList;
  }, [currentSubjectObj, testResults, selectedSubjectName]);

  // Handle Preset Change
  const handlePresetSelect = (presetId: string) => {
    setSelectedPreset(presetId);
    const p = PRESETS.find(pr => pr.id === presetId);
    if (p) {
      setDurationMinutes(p.duration);
      setTotalMarks(p.marks);
      setExamType(p.type);
      setDifficulty(p.difficulty);
      if (p.paperFormatCode) {
        setPaperFormatCode(p.paperFormatCode);
      }
    }
  };

  // Timer Effect during Active Exam
  useEffect(() => {
    let timer: any = null;
    if (phase === 'active_exam' && !isPaused && secondsRemaining > 0) {
      timer = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            // Auto submit when time expires
            handleAutoSubmitOnTimeOut();
            return 0;
          }
          return prev - 1;
        });
        setTimeSpentSeconds(prev => prev + 1);

        // Track per-question time for time-sink analytics
        if (currentExam && currentExam.questions && currentExam.questions[currentQuestionIdx]) {
          const activeQId = currentExam.questions[currentQuestionIdx].id;
          setQuestionTimeSpent(prev => ({
            ...prev,
            [activeQId]: (prev[activeQId] || 0) + 1
          }));
        }
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [phase, isPaused, secondsRemaining, currentExam, currentQuestionIdx]);

  // Helper: Format Time (MM:SS)
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Start Exam Generation
  const handleGenerateExam = async () => {
    setGenerationError(null);
    setPhase('generating');
    try {
      const response = await apiGenerateMockExam({
        subjectName: selectedSubjectName,
        chapterNames: selectedChapters,
        topics: initialTopic ? [initialTopic] : undefined,
        paperFormatCode,
        examType,
        totalMarks,
        durationMinutes,
        difficulty,
        examBoard,
        language: examLanguage,
        customInstructions,
        focusWeakTopics,
        userWeakTopics: subjectWeakTopics
      });

      if (!response.success || !response.exam) {
        throw new Error('Could not generate exam paper. Please try again.');
      }

      const exam: MockExam = response.exam;
      if (paperFormatCode) {
        exam.paperFormatCode = paperFormatCode;
      }
      setCurrentExam(exam);
      setCurrentQuestionIdx(0);
      setStudentAnswers({});
      setFlaggedQuestions({});
      setHandwrittenImages({});
      setSecondsRemaining(exam.durationMinutes * 60);
      setTimeSpentSeconds(0);
      setExamStartTime(Date.now());
      setIsPaused(false);
      setSavedToVaultStatus(false);
      setPhase('active_exam');
    } catch (err: any) {
      console.error('Exam generation error:', err);
      setGenerationError(err.message || 'Failed to generate mock exam paper.');
      setPhase('setup');
    }
  };

  // Auto submit when countdown reaches zero
  const handleAutoSubmitOnTimeOut = () => {
    handleSubmitExam();
  };

  // Submit Exam for AI Rubric Grading
  const handleSubmitExam = async () => {
    if (!currentExam) return;
    setIsSubmitConfirmOpen(false);
    setPhase('grading');

    try {
      const response = await apiGradeMockExam({
        exam: currentExam,
        studentAnswers,
        handwrittenImages,
        timeSpentSeconds,
        userProfile
      });

      if (!response.success || !response.gradedExam) {
        throw new Error('Grading failed. Please retry.');
      }

      const graded: GradedMockExam = response.gradedExam;
      setGradedResult(graded);

      // Expand first 2 rubrics by default
      const defaultExpanded: Record<string, boolean> = {};
      if (graded.gradedQuestions) {
        graded.gradedQuestions.forEach((q, idx) => {
          if (idx < 2 || !q.isCorrect) defaultExpanded[q.questionId] = true;
        });
      }
      setExpandedRubrics(defaultExpanded);

      // Auto-save into User's Test Vault and sync syllabus
      autoSaveToTestVault(graded);

      setPhase('results');
    } catch (err: any) {
      console.error('Grading error:', err);
      alert('Error during grading: ' + (err.message || 'Unknown error'));
      setPhase('active_exam');
    }
  };

  // Auto-Save Result to Test Vault
  const autoSaveToTestVault = (graded: GradedMockExam) => {
    if (savedToVaultStatus) return;

    // Collect struggled topics
    const struggled = graded.gradedQuestions
      .filter(q => (q.awardedMarks / q.totalMarks) < 0.6)
      .map(q => q.topicName || `Question ${q.questionNumber}`)
      .filter(Boolean);

    // Create mistake notes
    const mistakeNotes = graded.gradedQuestions
      .filter(q => !q.isCorrect || q.awardedMarks < q.totalMarks)
      .map(q => `Q${q.questionNumber} (${q.topicName || 'Topic'}): ${q.feedback}`)
      .join('\n');

    // Create correction prompts for AI tutor
    const prompts = graded.gradedQuestions
      .filter(q => q.remedyTutorPrompt)
      .map(q => q.remedyTutorPrompt as string);

    const testRecord: Omit<TestResult, 'id'> = {
      userId: userProfile?.id || 'default-user',
      testName: graded.title || `${graded.subjectName} Timed Mock Exam`,
      paperCode: `MOCK-${graded.grade}`,
      subjectName: graded.subjectName,
      score: `${graded.totalScore} / ${graded.totalPossibleMarks}`,
      totalMarks: graded.totalPossibleMarks,
      obtainedMarks: graded.totalScore,
      percentage: graded.percentage,
      date: new Date().toISOString().split('T')[0],
      mistakes: mistakeNotes || 'All questions completed accurately.',
      struggledTopics: struggled.length > 0 ? struggled : [],
      correctionPrompts: prompts,
      notes: `${graded.summaryAssessment} • Pace: ${graded.paceAssessment}`,
      isCorrected: false,
      questionsCount: graded.gradedQuestions.length,
      correctCount: graded.gradedQuestions.filter(q => q.isCorrect).length,
      incorrectCount: graded.gradedQuestions.filter(q => !q.isCorrect).length
    };

    onAddTestResult(testRecord);
    setSavedToVaultStatus(true);
  };

  // Insert Math Symbol at cursor in textarea
  const handleInsertSymbol = (sym: string) => {
    if (!currentExam) return;
    const activeQ = currentExam.questions[currentQuestionIdx];
    if (!activeQ) return;
    const currentVal = studentAnswers[activeQ.id] || '';
    setStudentAnswers({
      ...studentAnswers,
      [activeQ.id]: currentVal + sym
    });
  };

  // Dispatch Graded Exam Transcript via Gmail
  const handleSendExamEmail = async () => {
    if (!gradedResult) return;
    const emailToUse = userProfile?.email || userProfile?.parentEmail;
    if (!emailToUse) {
      alert('Please set your email address in Settings or Profile.');
      return;
    }

    setEmailStatus({ loading: true, msg: 'Connecting to Gmail...' });
    try {
      const token = await getOrRequestGmailToken();
      if (!token) {
        setEmailStatus({ loading: false, msg: 'Gmail permission declined.', success: false });
        return;
      }

      // Convert graded result into synthetic test for email template
      const syntheticTest: TestResult = {
        id: `mock-${Date.now()}`,
        userId: userProfile?.id || 'default-user',
        testName: gradedResult.title,
        paperCode: `MOCK-${gradedResult.grade}`,
        subjectName: gradedResult.subjectName,
        score: `${gradedResult.totalScore} / ${gradedResult.totalPossibleMarks}`,
        percentage: gradedResult.percentage,
        date: new Date().toISOString().split('T')[0],
        mistakes: gradedResult.summaryAssessment,
        struggledTopics: gradedResult.weakestTopics,
        correctionPrompts: gradedResult.gradedQuestions.filter(q => q.remedyTutorPrompt).map(q => q.remedyTutorPrompt as string)
      };

      const res = await sendTestImprovementEmail({
        recipientEmail: emailToUse,
        recipientName: userProfile?.displayName || 'Student',
        testResults: [syntheticTest],
        subjects,
        userProfile: userProfile || null,
        customNote: `Timed Mock Exam Graded Transcript • Grade: ${gradedResult.grade} (${gradedResult.percentage}%) • Time spent: ${gradedResult.timeSpentMinutes} mins.`
      }, token);

      if (res.success) {
        setEmailStatus({ loading: false, msg: `Graded exam transcript sent to ${emailToUse}!`, success: true });
      } else {
        setEmailStatus({ loading: false, msg: 'Failed to send email.', success: false });
      }
    } catch (e: any) {
      setEmailStatus({ loading: false, msg: e.message || 'Error sending email.', success: false });
    }
  };

  // Schedule Remedial Revision in Planner
  const handleAddRemedialToPlan = async (topicName: string) => {
    if (onSavePlan) {
      const remedialPlan: Omit<StudyPlan, 'id'> = {
        userId: userProfile?.id || 'default-user',
        date: new Date().toISOString().split('T')[0],
        title: `Mock Exam Remediation: ${topicName}`,
        reasoning: `Targeted revision for weaknesses identified in ${selectedSubjectName} Mock Exam.`,
        topics: [
          {
            id: `topic-remedial-${Date.now()}`,
            subjectName: selectedSubjectName,
            chapterName: currentSubjectObj?.chapters[0]?.name || 'Core Curriculum',
            topicName,
            estimatedMinutes: 30,
            priority: 'High',
            reason: `Scored below benchmark in timed mock exam.`
          }
        ],
        createdAt: new Date().toISOString()
      };
      await onSavePlan(remedialPlan);
      alert(`Added 30-min targeted remediation session for "${topicName}" to your Study Planner!`);
    } else if (onAddScheduledTask) {
      onAddScheduledTask({
        id: `task-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        dayLabel: 'Today',
        timeSlot: '16:00 - 16:30',
        subjectName: selectedSubjectName,
        chapterName: 'Mock Exam Review',
        topicName,
        estimatedMinutes: 30,
        priority: 'High',
        itemType: 'revision',
        notes: `Focus on exam rubric criteria missed during timed paper.`
      });
      alert(`Scheduled study task for "${topicName}"!`);
    }
  };

  // -------------------------------------------------------------
  // RENDER PHASE 1: SETUP SCREEN
  // -------------------------------------------------------------
  if (phase === 'setup') {
    return (
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-[#2D312E] to-[#1A1C1B] text-white shadow-md relative overflow-hidden">
          <div className="absolute right-0 top-0 w-80 h-80 bg-[#6B705C]/20 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 space-y-3 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold backdrop-blur-md text-[#E0DBD0]">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Real-Time Exam Simulator & Official Rubric Grader</span>
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Timed Mock Exam Mode
            </h2>
            
            <p className="text-sm text-[#D4CFC4] leading-relaxed">
              Experience genuine exam-hall pressure with an authentic countdown timer, full multi-part questions, scratchpad support, and instant step-by-step marking against official academic criteria.
            </p>
          </div>
        </div>

        {generationError && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{generationError}</span>
            </div>
            <button onClick={() => setGenerationError(null)} className="text-rose-600 font-bold hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Configuration Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Setup Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. Select Subject */}
            <div className="p-6 rounded-3xl bg-white border border-[#E0DBD0] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#4A4E4D] uppercase tracking-wider flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#6B705C]" />
                  <span>1. Select Examination Subject</span>
                </h3>
                <span className="text-xs text-[#A5A58D] font-mono">{subjects.length} Subjects Loaded</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {subjects.map(s => {
                  const isSelected = (s.name || '').toLowerCase() === (selectedSubjectName || '').toLowerCase();
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSelectedSubjectName(s.name);
                        setSelectedChapters([]);
                      }}
                      className={`p-3 rounded-2xl text-left border transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                        isSelected 
                          ? 'bg-[#2D312E] text-white border-[#2D312E] shadow-sm' 
                          : 'bg-[#F9F7F2] text-[#4A4E4D] border-[#E0DBD0] hover:border-[#6B705C]'
                      }`}
                    >
                      <span className="text-xl">{s.icon || '📚'}</span>
                      <span className="text-xs font-bold truncate">{s.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Specific Chapter Scope (Optional) */}
              {currentSubjectObj && currentSubjectObj.chapters.length > 0 && (
                <div className="pt-3 border-t border-[#E0DBD0] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#4A4E4D]">Chapter Focus (Optional):</span>
                    <button
                      type="button"
                      onClick={() => setSelectedChapters([])}
                      className="text-[11px] text-[#6B705C] hover:underline font-bold"
                    >
                      {selectedChapters.length === 0 ? 'Full Subject Selected' : 'Reset to Full Subject'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {currentSubjectObj.chapters.map(ch => {
                      const isChSelected = selectedChapters.includes(ch.name);
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => {
                            if (isChSelected) {
                              setSelectedChapters(selectedChapters.filter(c => c !== ch.name));
                            } else {
                              setSelectedChapters([...selectedChapters, ch.name]);
                            }
                          }}
                          className={`px-3 py-1 rounded-xl text-[11px] font-medium border transition cursor-pointer ${
                            isChSelected
                              ? 'bg-[#6B705C] text-white border-[#6B705C]'
                              : 'bg-white text-[#4A4E4D] border-[#E0DBD0] hover:bg-[#F2EFE9]'
                          }`}
                        >
                          {ch.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Choose Exam Preset */}
            <div className="p-6 rounded-3xl bg-white border border-[#E0DBD0] shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-[#4A4E4D] uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#6B705C]" />
                <span>2. Select Exam Format & Preset</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {PRESETS.map(preset => {
                  const isSelected = selectedPreset === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => handlePresetSelect(preset.id)}
                      className={`p-4 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between gap-3 ${
                        isSelected
                          ? 'border-[#2D312E] bg-[#F9F7F2] shadow-sm'
                          : 'border-[#E0DBD0] bg-white hover:border-[#6B705C]/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <h4 className="text-xs font-bold text-[#2D312E]">{preset.name}</h4>
                            {preset.badge && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#2D312E] text-white">
                                {preset.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#A5A58D] mt-0.5">{preset.desc}</p>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#2D312E] text-white flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] font-mono text-[#6B705C] font-semibold">
                        <span className="px-2 py-0.5 rounded-md bg-[#EAE7DF]">⏱️ {preset.duration} Mins</span>
                        <span className="px-2 py-0.5 rounded-md bg-[#EAE7DF]">🎯 {preset.marks} Marks</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Custom Fine-Tuning */}
              <div className="pt-3 border-t border-[#E0DBD0] grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#A5A58D] uppercase tracking-wider mb-1">
                    Duration
                  </label>
                  <select
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl text-xs font-bold text-[#4A4E4D] focus:outline-none"
                  >
                    <option value={10}>10 Mins</option>
                    <option value={15}>15 Mins</option>
                    <option value={20}>20 Mins</option>
                    <option value={30}>30 Mins</option>
                    <option value={45}>45 Mins</option>
                    <option value={60}>60 Mins</option>
                    <option value={75}>75 Mins</option>
                    <option value={90}>90 Mins</option>
                    <option value={120}>120 Mins</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#A5A58D] uppercase tracking-wider mb-1">
                    Total Marks
                  </label>
                  <select
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl text-xs font-bold text-[#4A4E4D] focus:outline-none"
                  >
                    <option value={10}>10 Marks</option>
                    <option value={15}>15 Marks</option>
                    <option value={25}>25 Marks</option>
                    <option value={35}>35 Marks</option>
                    <option value={40}>40 Marks</option>
                    <option value={50}>50 Marks</option>
                    <option value={60}>60 Marks</option>
                    <option value={65}>65 Marks</option>
                    <option value={75}>75 Marks</option>
                    <option value={100}>100 Marks</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#A5A58D] uppercase tracking-wider mb-1">
                    Question Type
                  </label>
                  <select
                    value={examType}
                    onChange={(e) => setExamType(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl text-xs font-bold text-[#4A4E4D] focus:outline-none"
                  >
                    <option value="mixed">Mixed (MCQ + Structured)</option>
                    <option value="mcq">100% Multiple Choice</option>
                    <option value="structured">Structured & Derivations</option>
                    <option value="numerical">Numerical Calculations</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#A5A58D] uppercase tracking-wider mb-1">
                    Difficulty
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl text-xs font-bold text-[#4A4E4D] focus:outline-none"
                  >
                    <option value="Foundation">Foundation</option>
                    <option value="Standard">Standard</option>
                    <option value="Challenging">Challenging</option>
                    <option value="Past Paper Style">Past Paper Style</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#A5A58D] uppercase tracking-wider mb-1">
                    Board Format Blueprint
                  </label>
                  <select
                    value={paperFormatCode}
                    onChange={(e) => setPaperFormatCode(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl text-xs font-bold text-[#4A4E4D] focus:outline-none"
                  >
                    <option value="custom">Standard / Custom</option>
                    <option value="cie_p1_mcq">Cambridge Paper 1 (MCQ)</option>
                    <option value="cie_p2_structured">Cambridge Paper 2 (Theory)</option>
                    <option value="cie_p4_extended">Cambridge Paper 4 (Extended)</option>
                    <option value="fbise_ssc_theory">FBISE Federal Board</option>
                    <option value="punjab_bise">Punjab BISE Board</option>
                    <option value="mdcat_speed">MDCAT Entrance Drill</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Right Col: Adaptive Options & Start Panel */}
          <div className="space-y-6">
            {/* Adaptive Weakness Targeting */}
            <div className="p-6 rounded-3xl bg-white border border-[#E0DBD0] shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-[#4A4E4D] uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-600" />
                <span>3. Weakness Prioritization</span>
              </h3>

              <label className="flex items-start gap-3 p-3 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] cursor-pointer">
                <input
                  type="checkbox"
                  checked={focusWeakTopics}
                  onChange={(e) => setFocusWeakTopics(e.target.checked)}
                  className="mt-0.5 rounded text-[#6B705C] focus:ring-0 cursor-pointer"
                />
                <div className="text-xs space-y-1">
                  <span className="font-bold text-[#2D312E]">Prioritize Diagnosed Weak Topics</span>
                  <p className="text-[11px] text-[#A5A58D] leading-relaxed">
                    AI will inject questions specifically targeting concepts where you previously lost marks or marked 'Weak'.
                  </p>
                </div>
              </label>

              {subjectWeakTopics.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-[#A5A58D] uppercase tracking-wider">
                    Detected Weak Points ({subjectWeakTopics.length})
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {subjectWeakTopics.slice(0, 4).map((w, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-[10px] font-medium truncate max-w-[200px]">
                        {w}
                      </span>
                    ))}
                    {subjectWeakTopics.length > 4 && (
                      <span className="text-[10px] text-[#A5A58D] self-center">
                        +{subjectWeakTopics.length - 4} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Target Board & Marks-to-Time Pacing Preset */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold text-[#A5A58D] uppercase tracking-wider">
                    Curriculum / Exam Board Preset
                  </label>
                  {(() => {
                    const preset = EXAM_BOARD_PRESETS.find(p => p.id === selectedBoardId);
                    return preset ? (
                      <span className="text-[10px] font-mono font-semibold text-[#6B705C] bg-[#F2EFE9] px-2 py-0.5 rounded-md border border-[#E0DBD0]">
                        Standard: {preset.defaultMinutesPerMark}m / mark
                      </span>
                    ) : null;
                  })()}
                </div>

                <select
                  value={selectedBoardId}
                  onChange={(e) => {
                    const nextId = e.target.value as ExamBoard;
                    setSelectedBoardId(nextId);
                    const found = EXAM_BOARD_PRESETS.find(p => p.id === nextId);
                    if (found) {
                      setExamBoard(found.name);
                      // Auto calculate recommended duration for this board
                      const recDuration = Math.round(totalMarks * found.defaultMinutesPerMark);
                      setDurationMinutes(Math.max(10, recDuration));
                    }
                  }}
                  className="w-full px-3 py-2 bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl text-xs font-bold text-[#4A4E4D] focus:outline-none"
                >
                  {EXAM_BOARD_PRESETS.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.defaultMinutesPerMark}m / mark)
                    </option>
                  ))}
                </select>

                {/* Auto Pacing Duration Sync Button */}
                {(() => {
                  const preset = EXAM_BOARD_PRESETS.find(p => p.id === selectedBoardId);
                  if (!preset) return null;
                  const recDuration = Math.max(10, Math.round(totalMarks * preset.defaultMinutesPerMark));
                  const isSynced = durationMinutes === recDuration;
                  return (
                    <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#F9F7F2] border border-[#E0DBD0] text-[11px]">
                      <span className="text-[#6B705C] font-semibold">
                        🎯 {preset.shortName} Ratio: {recDuration} mins for {totalMarks} marks
                      </span>
                      {!isSynced && (
                        <button
                          type="button"
                          onClick={() => setDurationMinutes(recDuration)}
                          className="px-2 py-1 rounded-lg bg-[#2D312E] hover:bg-[#1A1C1B] text-white font-bold text-[10px] cursor-pointer"
                        >
                          Sync to {recDuration}m
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Language / Bilingual Toggle */}
                <div className="pt-2">
                  <label className="block text-[10px] font-bold text-[#A5A58D] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Languages className="w-3.5 h-3.5 text-[#6B705C]" />
                    <span>Examination Language (زبان)</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setExamLanguage('en')}
                      className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition cursor-pointer text-center ${
                        examLanguage === 'en'
                          ? 'bg-[#2D312E] text-white border-[#2D312E]'
                          : 'bg-[#F9F7F2] text-[#4A4E4D] border-[#E0DBD0] hover:bg-white'
                      }`}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      onClick={() => setExamLanguage('ur')}
                      className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition cursor-pointer text-center font-nastaliq ${
                        examLanguage === 'ur'
                          ? 'bg-[#2D312E] text-white border-[#2D312E]'
                          : 'bg-[#F9F7F2] text-[#4A4E4D] border-[#E0DBD0] hover:bg-white'
                      }`}
                    >
                      اردو (Urdu)
                    </button>
                    <button
                      type="button"
                      onClick={() => setExamLanguage('bilingual')}
                      className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition cursor-pointer text-center ${
                        examLanguage === 'bilingual'
                          ? 'bg-[#2D312E] text-white border-[#2D312E]'
                          : 'bg-[#F9F7F2] text-[#4A4E4D] border-[#E0DBD0] hover:bg-white'
                      }`}
                    >
                      Bilingual (دو لسانی)
                    </button>
                  </div>
                </div>
              </div>

              {/* Custom Prompt Instructions */}
              <div>
                <label className="block text-[10px] font-bold text-[#A5A58D] uppercase tracking-wider mb-1">
                  Specific Focus / Prompt (Optional)
                </label>
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="e.g., Include questions with circuit diagrams and conservation of energy derivations..."
                  rows={2}
                  className="w-full px-3 py-1.5 bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl text-xs font-semibold text-[#4A4E4D] focus:outline-none resize-none"
                />
              </div>
            </div>

            {/* Launch Action Card */}
            <div className="p-6 rounded-3xl bg-[#2D312E] text-white shadow-sm space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-[#E0DBD0]">
                  <span>Ready to Begin?</span>
                  <span className="font-mono">{durationMinutes} Mins • {totalMarks} Marks</span>
                </div>
                <h4 className="text-base font-bold text-white">
                  Start Official Timed Paper
                </h4>
              </div>

              <button
                type="button"
                onClick={handleGenerateExam}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Generate & Enter Exam Hall</span>
              </button>

              <div className="flex items-center justify-center gap-4 text-[11px] text-[#A5A58D] text-center">
                <span>⏱️ Live Timer</span>
                <span>•</span>
                <span>📐 Rubric Mark Scheme</span>
                <span>•</span>
                <span>🤖 AI Examiner</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER PHASE 2: GENERATING SCREEN
  // -------------------------------------------------------------
  if (phase === 'generating') {
    return (
      <div className="min-h-[450px] flex flex-col items-center justify-center p-8 rounded-3xl bg-white border border-[#E0DBD0] shadow-xs text-center space-y-6">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-[#E0DBD0] border-t-[#6B705C] animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-[#6B705C] animate-pulse" />
          </div>
        </div>

        <div className="space-y-2 max-w-md">
          <h3 className="text-lg font-bold text-[#2D312E]">
            Authoring Examination Paper...
          </h3>
          <p className="text-xs text-[#A5A58D] leading-relaxed">
            AI Chief Examiner is crafting official question stems, rigorous mark distribution, multi-part structured problems, and marking rubrics for <span className="font-semibold text-[#4A4E4D]">{selectedSubjectName}</span>.
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] max-w-sm w-full text-left space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-[#6B705C] font-semibold">
            <span>Duration: {durationMinutes} Minutes</span>
            <span>Target: {totalMarks} Marks</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#A5A58D]">
            <span>Format: {examType.toUpperCase()}</span>
            <span>Difficulty: {difficulty}</span>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER PHASE 3: ACTIVE EXAM SIMULATOR (TIMED EXAM HALL)
  // -------------------------------------------------------------
  if (phase === 'active_exam' && currentExam) {
    const activeQ = currentExam.questions[currentQuestionIdx];
    const totalQCount = currentExam.questions.length;
    const answeredCount = Object.keys(studentAnswers).filter(k => studentAnswers[k]?.trim().length > 0).length;
    const isCurrentFlagged = flaggedQuestions[activeQ?.id] || false;
    const isLastQuestion = currentQuestionIdx === totalQCount - 1;

    // Time warning color
    const isCriticalTime = secondsRemaining <= 300; // < 5 mins
    const isWarningTime = secondsRemaining <= 600; // < 10 mins

    return (
      <div className={`space-y-4 ${isFullscreen ? 'fixed inset-0 z-50 bg-[#F9F7F2] p-6 overflow-y-auto' : ''}`}>
        {/* Sticky Exam Simulator Header */}
        <div className="p-4 md:p-5 rounded-3xl bg-[#2D312E] text-white shadow-md flex flex-wrap items-center justify-between gap-4 sticky top-2 z-20">
          {/* Exam Title & Subject */}
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-xl bg-white/10 text-xs font-bold font-mono text-[#E0DBD0] flex items-center gap-1.5">
              <span>{currentExam.subjectName}</span>
              <span>•</span>
              <span>{currentExam.totalMarks} Marks</span>
            </div>
            <h3 className="text-sm font-bold text-white hidden sm:block truncate max-w-xs">
              {currentExam.title}
            </h3>
          </div>

          {/* Center: Live Timer */}
          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-2xl font-mono font-bold text-base md:text-lg flex items-center gap-2 border transition-all ${
              isCriticalTime
                ? 'bg-rose-950 text-rose-200 border-rose-500 animate-pulse'
                : isWarningTime
                ? 'bg-amber-950 text-amber-200 border-amber-600'
                : 'bg-white/10 text-white border-white/20'
            }`}>
              <Clock className={`w-4 h-4 ${isCriticalTime ? 'text-rose-400' : 'text-[#A5A58D]'}`} />
              <span>{formatTime(secondsRemaining)}</span>
              {isCriticalTime && <span className="text-[10px] uppercase font-sans font-bold bg-rose-600 text-white px-1.5 py-0.2 rounded">Last 5m</span>}
            </div>

            {/* Pause / Resume */}
            <button
              type="button"
              onClick={() => setIsPaused(!isPaused)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition cursor-pointer"
              title={isPaused ? 'Resume Exam' : 'Pause Exam'}
            >
              {isPaused ? <Play className="w-4 h-4 fill-white" /> : <Pause className="w-4 h-4" />}
            </button>
          </div>

          {/* Right: Progress & Finish Button */}
          <div className="flex items-center gap-2.5">
            <div className="text-right hidden md:block">
              <div className="text-[11px] text-[#A5A58D]">Progress</div>
              <div className="text-xs font-mono font-bold text-white">
                {answeredCount} of {totalQCount} Answered
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsSubmitConfirmOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Paper</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer hidden sm:block"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Paused Overlay Modal */}
        {isPaused && (
          <div className="p-8 rounded-3xl bg-white border-2 border-amber-300 shadow-lg text-center space-y-4 my-6">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
              <Pause className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#2D312E]">Examination Paused</h3>
              <p className="text-xs text-[#A5A58D] max-w-md mx-auto">
                Timer is halted. Questions are temporarily hidden to maintain academic integrity. Click below when you are ready to resume.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPaused(false)}
              className="px-6 py-2.5 rounded-2xl bg-[#2D312E] text-white font-bold text-xs hover:bg-[#1A1C1B] transition cursor-pointer"
            >
              Resume Examination
            </button>
          </div>
        )}

        {!isPaused && activeQ && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Question Navigation Matrix (3 Cols) */}
            <div className="lg:col-span-3 space-y-4">
              <div className="p-5 rounded-3xl bg-white border border-[#E0DBD0] shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[#4A4E4D] uppercase tracking-wider">
                    Question Palette
                  </h4>
                  <span className="text-[10px] font-mono text-[#A5A58D]">
                    {answeredCount}/{totalQCount}
                  </span>
                </div>

                {/* Question Grid */}
                <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-4 gap-2">
                  {currentExam.questions.map((q, idx) => {
                    const isAnswered = Boolean(studentAnswers[q.id]?.trim());
                    const isFlagged = Boolean(flaggedQuestions[q.id]);
                    const isCurrent = idx === currentQuestionIdx;

                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setCurrentQuestionIdx(idx)}
                        className={`h-10 rounded-xl font-mono text-xs font-bold transition flex items-center justify-center relative cursor-pointer ${
                          isCurrent
                            ? 'ring-2 ring-[#2D312E] ring-offset-2 bg-[#2D312E] text-white shadow-xs'
                            : isFlagged
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : isAnswered
                            ? 'bg-[#EAE7DF] text-[#4A4E4D] font-bold border border-[#D4CFC4]'
                            : 'bg-[#F9F7F2] text-[#A5A58D] hover:bg-[#EAE7DF]'
                        }`}
                      >
                        <span>{idx + 1}</span>
                        {isFlagged && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="pt-3 border-t border-[#E0DBD0] space-y-1.5 text-[11px] text-[#A5A58D]">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-md bg-[#2D312E]" />
                    <span>Current Question</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-md bg-[#EAE7DF] border border-[#D4CFC4]" />
                    <span>Answered</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-md bg-amber-100 border border-amber-300" />
                    <span>Flagged for Review</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-md bg-[#F9F7F2]" />
                    <span>Unattempted</span>
                  </div>
                </div>

                {/* Scratchpad Toggle */}
                <button
                  type="button"
                  onClick={() => setShowScratchpad(!showScratchpad)}
                  className="w-full py-2 px-3 rounded-xl bg-[#F9F7F2] hover:bg-[#EAE7DF] text-[#4A4E4D] text-xs font-bold border border-[#E0DBD0] transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#6B705C]" />
                  <span>{showScratchpad ? 'Hide Scratchpad' : 'Show Rough Working'}</span>
                </button>
              </div>

              {/* On-Screen Scratchpad */}
              {showScratchpad && (
                <div className="p-4 rounded-3xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-[#4A4E4D]">
                    <span>Rough Scratchpad</span>
                    <button
                      onClick={() => setScratchpadText('')}
                      className="text-[10px] text-[#A5A58D] hover:text-rose-600 font-normal"
                    >
                      Clear
                    </button>
                  </div>
                  <textarea
                    value={scratchpadText}
                    onChange={(e) => setScratchpadText(e.target.value)}
                    placeholder="Use this space for quick calculations, formulas, or draft reasoning..."
                    rows={5}
                    className="w-full p-2.5 bg-white border border-[#E0DBD0] rounded-xl text-xs font-mono text-[#4A4E4D] focus:outline-none resize-none"
                  />
                </div>
              )}
            </div>

            {/* Right: Active Question Workspace (9 Cols) */}
            <div className="lg:col-span-9 space-y-4">
              <div className="p-6 md:p-8 rounded-3xl bg-white border border-[#E0DBD0] shadow-xs space-y-6">
                {/* Question Metadata Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E0DBD0]">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-xl bg-[#2D312E] text-white font-mono text-xs font-bold">
                      Question {currentQuestionIdx + 1}
                    </span>

                    {activeQ.topicName && (
                      <span className="px-2.5 py-1 rounded-lg bg-[#F2EFE9] text-[#6B705C] text-xs font-semibold border border-[#E0DBD0]">
                        {activeQ.topicNumber ? `#${activeQ.topicNumber} ` : ''}{activeQ.topicName}
                      </span>
                    )}

                    <span className="px-2.5 py-1 rounded-lg bg-[#F9F7F2] text-[#A5A58D] text-xs font-mono font-bold border border-[#E0DBD0]">
                      {activeQ.marks} {activeQ.marks === 1 ? 'Mark' : 'Marks'}
                    </span>

                    {/* Board Pacing Benchmark */}
                    {(() => {
                      const preset = EXAM_BOARD_PRESETS.find(p => p.id === selectedBoardId);
                      const targetMinutes = Math.round(activeQ.marks * (preset?.defaultMinutesPerMark || 1.5) * 10) / 10;
                      return (
                        <span className="px-2.5 py-1 rounded-lg bg-[#F2EFE9] text-[#6B705C] text-xs font-mono font-semibold border border-[#E0DBD0] hidden sm:inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{preset?.shortName || 'Board'}: ~{targetMinutes}m target</span>
                        </span>
                      );
                    })()}
                  </div>

                  {/* Flag for Review */}
                  <button
                    type="button"
                    onClick={() => {
                      setFlaggedQuestions({
                        ...flaggedQuestions,
                        [activeQ.id]: !isCurrentFlagged
                      });
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                      isCurrentFlagged
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-[#F9F7F2] text-[#A5A58D] border-[#E0DBD0] hover:text-[#4A4E4D]'
                    }`}
                  >
                    <Flag className={`w-3.5 h-3.5 ${isCurrentFlagged ? 'fill-amber-600 text-amber-600' : ''}`} />
                    <span>{isCurrentFlagged ? 'Flagged for Review' : 'Flag Question'}</span>
                  </button>
                </div>

                {/* Real-time Pacing Cue & Time-Sink Guard (Option 7) */}
                {(() => {
                  const qSeconds = questionTimeSpent[activeQ.id] || 0;
                  const totalExamSeconds = (currentExam?.durationMinutes || 30) * 60;
                  const expectedSecs = Math.max(60, Math.round(totalExamSeconds / Math.max(1, currentExam?.questions.length || 1)));
                  const isTimeSink = qSeconds > expectedSecs * 1.35;
                  const m = Math.floor(qSeconds / 60);
                  const s = qSeconds % 60;
                  const expM = Math.ceil(expectedSecs / 60);
                  return (
                    <div className={`flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl border text-xs ${
                      isTimeSink
                        ? 'bg-rose-50 text-rose-900 border-rose-200 animate-pulse'
                        : 'bg-[#F9F7F2] text-[#4A4E4D] border-[#E0DBD0]'
                    }`}>
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <Clock className={`w-3.5 h-3.5 ${isTimeSink ? 'text-rose-600' : 'text-[#6B705C]'}`} />
                        <span>Question Pace: <strong>{m}m {s}s</strong></span>
                        <span className="text-[#A5A58D]">/ ideal ~{expM}m</span>
                      </div>
                      {isTimeSink ? (
                        <span className="text-[11px] font-bold text-rose-700 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Pacing Warning: Time sink detected! Flag and move on to secure remaining marks.</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#6B705C] font-semibold">
                          ✓ On Target Pace ({Math.round(((expectedSecs - qSeconds) / expectedSecs) * 100)}% budget remaining)
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Question Stem Text */}
                <div 
                  className={`text-sm md:text-base font-medium text-[#2D312E] leading-relaxed whitespace-pre-line select-text ${
                    /[\u0600-\u06FF]/.test(activeQ.questionText) ? 'font-nastaliq text-right text-base md:text-lg leading-loose' : ''
                  }`}
                  dir={/[\u0600-\u06FF]/.test(activeQ.questionText) ? 'rtl' : 'ltr'}
                >
                  {activeQ.questionText}
                </div>

                {/* Answer Input Controls */}
                <div className="pt-4 border-t border-[#E0DBD0] space-y-4">
                  {activeQ.type === 'mcq' && activeQ.options && activeQ.options.length > 0 ? (
                    /* Multiple Choice Options */
                    <div className="space-y-2.5">
                      <div className="text-xs font-bold text-[#A5A58D] uppercase tracking-wider">
                        Select one answer:
                      </div>
                      <div className="grid grid-cols-1 gap-2.5">
                        {activeQ.options.map((opt, oIdx) => {
                          const optionLetter = String.fromCharCode(65 + oIdx); // A, B, C, D
                          const isSelected = studentAnswers[activeQ.id] === optionLetter || studentAnswers[activeQ.id] === opt;

                          return (
                            <button
                              key={oIdx}
                              type="button"
                              onClick={() => {
                                setStudentAnswers({
                                  ...studentAnswers,
                                  [activeQ.id]: optionLetter
                                });
                              }}
                              className={`p-4 rounded-2xl text-left border-2 transition cursor-pointer flex items-start gap-3 ${
                                isSelected
                                  ? 'border-[#2D312E] bg-[#F2EFE9] text-[#2D312E] font-semibold shadow-2xs'
                                  : 'border-[#E0DBD0] bg-white text-[#4A4E4D] hover:bg-[#F9F7F2] hover:border-[#6B705C]/40'
                              }`}
                            >
                              <span className={`w-7 h-7 rounded-xl font-mono text-xs font-bold flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-[#2D312E] text-white' : 'bg-[#EAE7DF] text-[#4A4E4D]'
                              }`}>
                                {optionLetter}
                              </span>
                              <span className="text-xs md:text-sm pt-0.5">{opt}</span>
                            </button>
                          );
                        })}
                      </div>

                      {studentAnswers[activeQ.id] && (
                        <button
                          type="button"
                          onClick={() => {
                            const newAnswers = { ...studentAnswers };
                            delete newAnswers[activeQ.id];
                            setStudentAnswers(newAnswers);
                          }}
                          className="text-[11px] text-[#A5A58D] hover:text-rose-600 underline font-medium"
                        >
                          Clear selection
                        </button>
                      )}
                    </div>
                  ) : (
                    /* Structured / Short Answer / Numerical Text Area */
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-xs font-bold text-[#A5A58D] uppercase tracking-wider">
                          Your Written Response & Working:
                        </label>
                        
                        {/* Math Symbols Bar */}
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[10px] text-[#A5A58D] mr-1 hidden sm:inline">Insert Symbol:</span>
                          {MATH_SYMBOLS.map(sym => (
                            <button
                              key={sym}
                              type="button"
                              onClick={() => handleInsertSymbol(sym)}
                              className="px-2 py-0.5 rounded-lg bg-[#F2EFE9] hover:bg-[#EAE7DF] text-[#4A4E4D] font-mono text-xs font-bold border border-[#E0DBD0] transition cursor-pointer"
                              title={`Insert ${sym}`}
                            >
                              {sym}
                            </button>
                          ))}
                        </div>
                      </div>

                      <textarea
                        value={studentAnswers[activeQ.id] || ''}
                        onChange={(e) => {
                          setStudentAnswers({
                            ...studentAnswers,
                            [activeQ.id]: e.target.value
                          });
                        }}
                        placeholder="Type your complete answer here. Show formulas, substitutions, step-by-step working, and state final units clearly..."
                        rows={8}
                        dir={/[\u0600-\u06FF]/.test(studentAnswers[activeQ.id] || '') || /[\u0600-\u06FF]/.test(activeQ.questionText) ? 'rtl' : 'ltr'}
                        className={`w-full p-4 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs md:text-sm text-[#2D312E] focus:outline-none focus:border-[#6B705C] focus:bg-white transition leading-relaxed ${
                          /[\u0600-\u06FF]/.test(studentAnswers[activeQ.id] || '') || /[\u0600-\u06FF]/.test(activeQ.questionText)
                            ? 'font-nastaliq text-right text-sm md:text-base leading-loose'
                            : 'font-mono'
                        }`}
                      />

                      <div className="flex items-center justify-between text-[11px] text-[#A5A58D]">
                        <span>Character Count: {(studentAnswers[activeQ.id] || '').length}</span>
                        <span>Marks available: {activeQ.marks}</span>
                      </div>
                    </div>
                  )}

                  {/* Optical Handwriting & Diagram Upload Card (Vision OCR) */}
                  <div className="pt-3 border-t border-[#E0DBD0] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#4A4E4D]">
                        <Camera className="w-3.5 h-3.5 text-[#6B705C]" />
                        <span>Optical Handwritten Working Sheet & Diagram (OCR Evaluated)</span>
                      </div>
                      <span className="text-[10px] text-[#6B705C] bg-[#F2EFE9] px-2 py-0.5 rounded-md font-semibold border border-[#E0DBD0]">
                        Vision Multimodal OCR
                      </span>
                    </div>

                    {handwrittenImages[activeQ.id] ? (
                      <div className="p-3.5 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img 
                            src={handwrittenImages[activeQ.id]} 
                            alt="Handwritten work preview" 
                            className="w-16 h-16 object-cover rounded-xl border border-[#E0DBD0] shadow-2xs cursor-pointer hover:opacity-90"
                            onClick={() => setPreviewImageModalUrl(handwrittenImages[activeQ.id])}
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <div className="text-xs font-bold text-[#2D312E] flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Handwritten Sheet Attached</span>
                            </div>
                            <p className="text-[11px] text-[#A5A58D] mt-0.5">
                              AI Examiner will transcribe math formulas, evaluate sketched diagrams, and award method marks (M1/A1).
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setPreviewImageModalUrl(handwrittenImages[activeQ.id])}
                            className="px-2.5 py-1.5 rounded-xl bg-white border border-[#E0DBD0] hover:bg-[#F2EFE9] text-xs font-bold text-[#4A4E4D] transition flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = { ...handwrittenImages };
                              delete updated[activeQ.id];
                              setHandwrittenImages(updated);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 hover:bg-rose-100 text-xs font-bold text-rose-700 transition cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-2xl bg-[#F9F7F2] border border-dashed border-[#E0DBD0] flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-[#A5A58D]">
                          <span className="font-semibold text-[#4A4E4D]">Prefer paper and pen?</span> Snap or upload a photo of your notebook derivations or diagrams.
                        </div>
                        <label className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#F2EFE9] border border-[#E0DBD0] text-[#2D312E] font-bold text-xs shadow-2xs transition flex items-center gap-1.5 cursor-pointer">
                          <Upload className="w-3.5 h-3.5 text-[#6B705C]" />
                          <span>Upload Working / Diagram</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = () => {
                                  if (typeof reader.result === 'string') {
                                    setHandwrittenImages(prev => ({
                                      ...prev,
                                      [activeQ.id]: reader.result as string
                                    }));
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Navigation Buttons */}
                <div className="pt-6 border-t border-[#E0DBD0] flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentQuestionIdx(Math.max(0, currentQuestionIdx - 1))}
                    disabled={currentQuestionIdx === 0}
                    className="px-4 py-2.5 rounded-xl border border-[#E0DBD0] text-xs font-bold text-[#4A4E4D] hover:bg-[#F9F7F2] disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {isLastQuestion ? (
                      <button
                        type="button"
                        onClick={() => setIsSubmitConfirmOpen(true)}
                        className="px-6 py-2.5 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                        <span>Finish & Submit Exam</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCurrentQuestionIdx(Math.min(totalQCount - 1, currentQuestionIdx + 1))}
                        className="px-6 py-2.5 rounded-xl bg-[#2D312E] hover:bg-[#1A1C1B] text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>Next Question</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal to Submit */}
        {isSubmitConfirmOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#E0DBD0]">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#2D312E]">Submit Examination Paper?</h3>
                <button onClick={() => setIsSubmitConfirmOpen(false)} className="text-[#A5A58D] hover:text-[#4A4E4D]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-2 text-xs text-[#4A4E4D]">
                <div className="flex justify-between">
                  <span>Total Questions:</span>
                  <span className="font-bold">{totalQCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Questions Attempted:</span>
                  <span className="font-bold text-[#6B705C]">{answeredCount} of {totalQCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Unanswered Questions:</span>
                  <span className={`font-bold ${totalQCount - answeredCount > 0 ? 'text-rose-600' : 'text-[#6B705C]'}`}>
                    {totalQCount - answeredCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Time Remaining:</span>
                  <span className="font-mono font-bold">{formatTime(secondsRemaining)}</span>
                </div>
              </div>

              <p className="text-xs text-[#A5A58D] leading-relaxed">
                Once submitted, your paper will immediately be graded by the AI Chief Examiner against official mark schemes and criteria rubrics.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSubmitConfirmOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#4A4E4D] hover:bg-[#F2EFE9] transition cursor-pointer"
                >
                  Return to Paper
                </button>
                <button
                  type="button"
                  onClick={handleSubmitExam}
                  className="px-5 py-2 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  Confirm & Submit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Fullscreen Image Preview Modal */}
        {previewImageModalUrl && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="relative max-w-4xl w-full max-h-[90vh] bg-white rounded-3xl p-4 shadow-2xl flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#E0DBD0]">
                <span className="text-xs font-bold text-[#2D312E] flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-[#6B705C]" />
                  <span>Handwritten Working Sheet & Diagram Inspection</span>
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewImageModalUrl(null)}
                  className="p-1.5 rounded-xl bg-[#F2EFE9] hover:bg-[#EAE7DF] text-[#4A4E4D] transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-auto max-h-[75vh] flex items-center justify-center bg-[#F9F7F2] rounded-2xl p-2">
                <img 
                  src={previewImageModalUrl} 
                  alt="Enlarged handwritten work" 
                  className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-xs"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER PHASE 4: GRADING IN PROGRESS
  // -------------------------------------------------------------
  if (phase === 'grading') {
    return (
      <div className="min-h-[450px] flex flex-col items-center justify-center p-8 rounded-3xl bg-white border border-[#E0DBD0] shadow-xs text-center space-y-6">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-[#E0DBD0] border-t-[#6B705C] animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Award className="w-6 h-6 text-[#6B705C] animate-pulse" />
          </div>
        </div>

        <div className="space-y-2 max-w-md">
          <h3 className="text-lg font-bold text-[#2D312E]">
            Examiner Evaluating Paper...
          </h3>
          <p className="text-xs text-[#A5A58D] leading-relaxed">
            Comparing your submissions against the official mark scheme, verifying intermediate calculation steps, and evaluating criteria rubrics.
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER PHASE 5: RESULTS & MARKING RUBRIC DECONSTRUCTION
  // -------------------------------------------------------------
  if (phase === 'results' && gradedResult) {
    const isPassing = gradedResult.percentage >= 50;

    return (
      <div className="space-y-6">
        {/* Top Grade Scorecard Banner */}
        <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-[#2D312E] to-[#1A1C1B] text-white shadow-md space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-[#E0DBD0]">
                <span>{gradedResult.subjectName} Mock Exam Result</span>
                <span>•</span>
                <span>{new Date().toLocaleDateString()}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                {gradedResult.title}
              </h2>
              <p className="text-xs md:text-sm text-[#D4CFC4] max-w-2xl leading-relaxed">
                {gradedResult.summaryAssessment}
              </p>
            </div>

            {/* Big Grade Badge */}
            <div className="flex items-center gap-4 bg-white/10 p-4 rounded-3xl backdrop-blur-md border border-white/15 shrink-0">
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-extrabold text-amber-400 font-mono">
                  {gradedResult.grade}
                </div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-[#A5A58D]">
                  Letter Grade
                </div>
              </div>

              <div className="h-10 w-px bg-white/20" />

              <div className="text-center">
                <div className="text-2xl md:text-3xl font-extrabold text-white font-mono">
                  {gradedResult.percentage}%
                </div>
                <div className="text-[10px] font-mono text-[#D4CFC4]">
                  {gradedResult.totalScore} / {gradedResult.totalPossibleMarks} Marks
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-[#A5A58D] block text-[10px] uppercase tracking-wider">Time Spent</span>
              <span className="font-mono font-bold text-white text-sm">
                {gradedResult.timeSpentMinutes} mins / {gradedResult.durationAllottedMinutes} mins
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-[#A5A58D] block text-[10px] uppercase tracking-wider">Pace Analysis</span>
              <span className="font-medium text-white text-xs truncate block">
                {gradedResult.paceAssessment}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-[#A5A58D] block text-[10px] uppercase tracking-wider">Vault Status</span>
              <span className="font-medium text-emerald-300 text-xs flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Saved & Linked</span>
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-[#A5A58D] block text-[10px] uppercase tracking-wider">Remediation Ready</span>
              <span className="font-medium text-amber-300 text-xs flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{gradedResult.weakestTopics.length} Weak Spots</span>
              </span>
            </div>
          </div>

          {/* Quick Action Ribbon */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleSendExamEmail}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5 text-blue-300" />
              <span>Email Graded Transcript</span>
            </button>

            {gradedResult.weakestTopics.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const prompt = `I just took a timed mock exam in ${gradedResult.subjectName} and scored ${gradedResult.percentage}%. I struggled with ${gradedResult.weakestTopics.join(', ')}. Please quiz me step-by-step to master these concepts.`;
                  onSendPromptToTutor(prompt);
                  if (setActiveTab) setActiveTab('tutor');
                }}
                className="px-4 py-2 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Bot className="w-3.5 h-3.5 text-amber-300" />
                <span>Launch Socratic AI Tutor Drill</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setPhase('setup');
                setCurrentExam(null);
                setGradedResult(null);
              }}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ml-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Take Another Exam</span>
            </button>
          </div>

          {emailStatus && (
            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              emailStatus.success ? 'bg-emerald-900/50 text-emerald-200 border border-emerald-500' : 'bg-rose-900/50 text-rose-200 border border-rose-500'
            }`}>
              <Info className="w-4 h-4 shrink-0" />
              <span>{emailStatus.msg}</span>
            </div>
          )}
        </div>

        {/* Results Navigation Subtabs */}
        <div className="flex items-center gap-2 border-b border-[#E0DBD0] pb-2">
          <button
            type="button"
            onClick={() => setResultsActiveSubTab('rubric')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              resultsActiveSubTab === 'rubric'
                ? 'bg-[#2D312E] text-white'
                : 'bg-white text-[#4A4E4D] hover:bg-[#F2EFE9]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Marking Scheme & Rubrics ({gradedResult.gradedQuestions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setResultsActiveSubTab('topics')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              resultsActiveSubTab === 'topics'
                ? 'bg-[#2D312E] text-white'
                : 'bg-white text-[#4A4E4D] hover:bg-[#F2EFE9]'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Topic Mastery Analysis</span>
          </button>

          <button
            type="button"
            onClick={() => setResultsActiveSubTab('report')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              resultsActiveSubTab === 'report'
                ? 'bg-[#2D312E] text-white'
                : 'bg-white text-[#4A4E4D] hover:bg-[#F2EFE9]'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Examiner Guidance & Action Plan</span>
          </button>

          <button
            type="button"
            onClick={() => setResultsActiveSubTab('timesink')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              resultsActiveSubTab === 'timesink'
                ? 'bg-[#2D312E] text-white'
                : 'bg-white text-[#4A4E4D] hover:bg-[#F2EFE9]'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Time-Sink & Pacing Analysis (Option 7)</span>
          </button>
        </div>

        {/* SUBTAB 1: QUESTION-BY-QUESTION RUBRIC AUDIT */}
        {resultsActiveSubTab === 'rubric' && (
          <div className="space-y-4">
            {gradedResult.gradedQuestions.map((q, idx) => {
              const isFullMarks = q.awardedMarks === q.totalMarks;
              const isZeroMarks = q.awardedMarks === 0;
              const isExpanded = expandedRubrics[q.questionId] !== false;

              return (
                <div
                  key={q.questionId}
                  className="p-5 md:p-6 rounded-3xl bg-white border border-[#E0DBD0] shadow-xs space-y-4 transition"
                >
                  {/* Question Header Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-xl font-mono text-xs font-bold flex items-center justify-center ${
                        isFullMarks
                          ? 'bg-emerald-100 text-emerald-800'
                          : isZeroMarks
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {isFullMarks ? <Check className="w-4 h-4" /> : isZeroMarks ? <X className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-[#2D312E]">
                          Question {q.questionNumber || idx + 1}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-[#A5A58D]">
                          {q.topicName && <span>{q.topicNumber ? `#${q.topicNumber} ` : ''}{q.topicName}</span>}
                          <span>•</span>
                          <span className="capitalize">{q.type}</span>
                        </div>
                      </div>
                    </div>

                    {/* Marks Pill & Expand Button */}
                    <div className="flex items-center gap-3">
                      <div className={`px-3 py-1 rounded-xl text-xs font-mono font-bold border ${
                        isFullMarks
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : isZeroMarks
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {q.awardedMarks} / {q.totalMarks} Marks
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setExpandedRubrics({
                            ...expandedRubrics,
                            [q.questionId]: !isExpanded
                          });
                        }}
                        className="text-xs font-bold text-[#6B705C] hover:underline cursor-pointer"
                      >
                        {isExpanded ? 'Collapse Rubric' : 'Show Rubric Breakdown'}
                      </button>
                    </div>
                  </div>

                  {/* Feedback Summary Box */}
                  <div className={`p-3.5 rounded-2xl text-xs leading-relaxed border ${
                    isFullMarks
                      ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                      : isZeroMarks
                      ? 'bg-rose-50/60 border-rose-200 text-rose-900'
                      : 'bg-amber-50/60 border-amber-200 text-amber-900'
                  }`}>
                    <span className="font-bold">Examiner Note: </span>
                    {q.feedback}
                  </div>

                  {isExpanded && (
                    <div className="space-y-4 pt-2">
                      {/* Grid: Student Submission vs Official Model Answer */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        {/* Student Answer */}
                        <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-2">
                          <span className="text-[10px] font-bold text-[#A5A58D] uppercase tracking-wider block">
                            Your Submitted Answer
                          </span>
                          <div className="font-mono text-xs text-[#2D312E] whitespace-pre-wrap leading-relaxed">
                            {q.studentAnswer || <span className="text-[#A5A58D] italic">No answer provided.</span>}
                          </div>
                        </div>

                        {/* Model Answer */}
                        <div className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-200/70 space-y-2">
                          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                            Official Model Answer / Scheme
                          </span>
                          <div className="font-mono text-xs text-emerald-950 whitespace-pre-wrap leading-relaxed">
                            {q.modelAnswer}
                          </div>
                        </div>
                      </div>

                      {/* Multimodal Optical Handwriting & Diagram Evaluation Card */}
                      {(q.handwrittenImageUrl || q.ocrTranscribedText || q.diagramAnalysis || q.methodMarksNotes) && (
                        <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200/80 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                              <Camera className="w-3.5 h-3.5 text-indigo-700" />
                              <span>Multimodal Optical Evaluation & Handwriting OCR</span>
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold">
                              Vision Graded
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {q.handwrittenImageUrl && (
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">
                                  Original Paper Sheet / Diagram
                                </span>
                                <div 
                                  onClick={() => setPreviewImageModalUrl(q.handwrittenImageUrl || null)}
                                  className="relative group cursor-pointer rounded-xl overflow-hidden border border-indigo-200 bg-white"
                                >
                                  <img 
                                    src={q.handwrittenImageUrl} 
                                    alt="Student handwritten sheet" 
                                    className="w-full h-28 object-cover group-hover:scale-105 transition duration-200" 
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1">
                                    <ZoomIn className="w-4 h-4" />
                                    <span>Expand Sheet</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className={`${q.handwrittenImageUrl ? 'md:col-span-2' : 'md:col-span-3'} space-y-2.5 text-xs`}>
                              {q.ocrTranscribedText && (
                                <div className="p-2.5 rounded-xl bg-white border border-indigo-100 space-y-1">
                                  <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">
                                    Transcribed Mathematical Working (OCR)
                                  </span>
                                  <div className="font-mono text-xs text-indigo-950 whitespace-pre-wrap leading-relaxed">
                                    {q.ocrTranscribedText}
                                  </div>
                                </div>
                              )}

                              {q.methodMarksNotes && (
                                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
                                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                                    Method Marks (M) & Accuracy Marks (A) Breakdown
                                  </span>
                                  <div className="text-xs text-emerald-950 font-medium">
                                    {q.methodMarksNotes}
                                  </div>
                                </div>
                              )}

                              {q.diagramAnalysis && (
                                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                                  <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">
                                    Diagrammatic Analysis (Ray / Circuit / Axes / Vectors)
                                  </span>
                                  <div className="text-xs text-amber-950">
                                    {q.diagramAnalysis}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Granular Criteria Marking Rubric */}
                      {q.rubricEvaluations && q.rubricEvaluations.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold text-[#A5A58D] uppercase tracking-wider">
                            Marking Rubric Breakdown:
                          </span>
                          <div className="rounded-2xl border border-[#E0DBD0] overflow-hidden">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-[#F2EFE9] text-[#4A4E4D] border-b border-[#E0DBD0]">
                                  <th className="p-2.5 font-bold">Assessment Criterion</th>
                                  <th className="p-2.5 font-bold w-24 text-center">Marks</th>
                                  <th className="p-2.5 font-bold">Examiner Evaluation</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#E0DBD0]">
                                {q.rubricEvaluations.map((r, rIdx) => {
                                  const gotFull = r.awardedMarks === r.allocatedMarks;
                                  return (
                                    <tr key={rIdx} className={gotFull ? 'bg-white' : 'bg-rose-50/30'}>
                                      <td className="p-2.5 text-[#2D312E]">{r.criterion}</td>
                                      <td className="p-2.5 font-mono text-center font-bold">
                                        <span className={gotFull ? 'text-emerald-700' : 'text-rose-700'}>
                                          {r.awardedMarks}
                                        </span>
                                        <span className="text-[#A5A58D]"> / {r.allocatedMarks}</span>
                                      </td>
                                      <td className="p-2.5 text-[11px] text-[#4A4E4D]">
                                        {r.note || (gotFull ? 'Mark Awarded' : 'Criterion missed')}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Targeted Practice Prompt */}
                      {q.remedyTutorPrompt && (
                        <div className="p-3 rounded-2xl bg-[#F2EFE9] border border-[#E0DBD0] flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2 text-[#4A4E4D]">
                            <Bot className="w-4 h-4 text-[#6B705C] shrink-0" />
                            <span className="italic">{q.remedyTutorPrompt}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              onSendPromptToTutor(q.remedyTutorPrompt!);
                              if (setActiveTab) setActiveTab('tutor');
                            }}
                            className="px-3 py-1 bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-bold text-[11px] rounded-xl shrink-0 transition cursor-pointer"
                          >
                            Drill with AI
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* SUBTAB 2: TOPIC MASTERY & WEAKNESS MATRIX */}
        {resultsActiveSubTab === 'topics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl bg-white border border-[#E0DBD0] shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-[#4A4E4D] uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#6B705C]" />
                <span>Exam Topic Mastery Breakdown</span>
              </h3>

              <div className="space-y-4">
                {gradedResult.topicPerformance.map((tp, idx) => {
                  const isMastered = tp.percentage >= 80;
                  const isNeedsReview = tp.percentage < 60;

                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#2D312E]">
                          {tp.topicNumber ? `#${tp.topicNumber} ` : ''}{tp.topicName}
                        </span>
                        <span className="font-mono font-bold text-[#4A4E4D]">
                          {tp.score} / {tp.total} ({tp.percentage}%)
                        </span>
                      </div>

                      <div className="w-full h-2.5 rounded-full bg-[#EAE7DF] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isMastered ? 'bg-emerald-600' : isNeedsReview ? 'bg-rose-600' : 'bg-amber-600'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(5, tp.percentage))}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-[#A5A58D]">
                        <span className={`font-semibold ${
                          isMastered ? 'text-emerald-700' : isNeedsReview ? 'text-rose-700' : 'text-amber-700'
                        }`}>
                          {tp.status}
                        </span>

                        {isNeedsReview && (
                          <button
                            type="button"
                            onClick={() => handleAddRemedialToPlan(tp.topicName)}
                            className="text-[#6B705C] hover:underline font-bold"
                          >
                            + Schedule Remedial Revision
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Weakest Concepts Remediation Card */}
            <div className="p-6 rounded-3xl bg-white border border-[#E0DBD0] shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-[#4A4E4D] uppercase tracking-wider flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-600" />
                <span>Priority Remedial Actions</span>
              </h3>

              {gradedResult.weakestTopics.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-xs text-[#A5A58D] leading-relaxed">
                    Based on missed marks in this timed paper, tackle these high-yield topics before your next test:
                  </p>

                  <div className="space-y-2.5">
                    {gradedResult.weakestTopics.map((top, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          <span className="font-bold text-[#2D312E]">{top}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleAddRemedialToPlan(top)}
                            className="px-2.5 py-1 rounded-xl bg-white hover:bg-[#EAE7DF] border border-[#E0DBD0] text-[11px] font-bold text-[#4A4E4D] transition cursor-pointer"
                          >
                            Add to Plan
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onSendPromptToTutor(`Teach me the core exam strategies and common traps for ${top} in ${gradedResult.subjectName}.`);
                              if (setActiveTab) setActiveTab('tutor');
                            }}
                            className="px-2.5 py-1 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-[11px] font-bold transition cursor-pointer"
                          >
                            AI Drill
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <h4 className="text-xs font-bold text-emerald-900">Zero Critical Weaknesses Detected</h4>
                  <p className="text-[11px] text-emerald-800">
                    Outstanding score across all tested syllabus concepts!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SUBTAB 3: EXAMINER GUIDANCE & ACTION PLAN */}
        {resultsActiveSubTab === 'report' && (
          <div className="p-6 md:p-8 rounded-3xl bg-white border border-[#E0DBD0] shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-[#E0DBD0] pb-4">
              <div>
                <h3 className="text-base font-bold text-[#2D312E]">
                  Official Chief Examiner Academic Transcript
                </h3>
                <p className="text-xs text-[#A5A58D]">
                  Student: {userProfile?.displayName || 'Student'} • Subject: {gradedResult.subjectName} • Paper: {gradedResult.title}
                </p>
              </div>
              <div className="text-right">
                <span className="font-mono font-extrabold text-2xl text-[#2D312E]">{gradedResult.grade}</span>
                <span className="text-xs text-[#A5A58D] block">{gradedResult.percentage}% Score</span>
              </div>
            </div>

            <div className="space-y-4 text-xs text-[#4A4E4D] leading-relaxed">
              <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-2">
                <h4 className="font-bold text-[#2D312E] text-xs uppercase tracking-wider">
                  Diagnostic Performance Evaluation
                </h4>
                <p>{gradedResult.summaryAssessment}</p>
              </div>

              <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-2">
                <h4 className="font-bold text-[#2D312E] text-xs uppercase tracking-wider">
                  Time Management & Examination Technique
                </h4>
                <p>
                  Spent {gradedResult.timeSpentMinutes} minutes out of {gradedResult.durationAllottedMinutes} minutes allotted. {gradedResult.paceAssessment}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2">
                <h4 className="font-bold text-emerald-900 text-xs uppercase tracking-wider">
                  Recommended Next Strategic Step
                </h4>
                <p>{gradedResult.recommendedNextAction}</p>
              </div>
            </div>

            {/* Print / Save Trigger */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E0DBD0]">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-[#F2EFE9] hover:bg-[#EAE7DF] text-[#4A4E4D] font-bold text-xs border border-[#E0DBD0] transition cursor-pointer"
              >
                Print Transcript
              </button>
            </div>
          </div>
        )}

        {/* SUBTAB 4: TIME-SINK & PACING ANALYSIS (OPTION 7) */}
        {resultsActiveSubTab === 'timesink' && (
          <div className="space-y-6">
            {/* Overview Metric Cards */}
            {(() => {
              const totalQ = gradedResult.gradedQuestions.length || 1;
              const allottedSecs = (gradedResult.durationAllottedMinutes || 30) * 60;
              const expectedSecsPerQ = Math.round(allottedSecs / totalQ);

              let timeSinkQuestionsCount = 0;
              let bestEfficiencyQ: { num: number; rate: number } = { num: 1, rate: 0 };
              let worstEfficiencyQ: { num: number; rate: number } = { num: 1, rate: 999 };

              gradedResult.gradedQuestions.forEach((q, idx) => {
                const spent = questionTimeSpent[q.questionId] || expectedSecsPerQ;
                const marksEarned = q.awardedMarks;
                const rate = spent > 0 ? (marksEarned / (spent / 60)) : 0;
                if (spent > expectedSecsPerQ * 1.3 && marksEarned < q.totalMarks) {
                  timeSinkQuestionsCount++;
                }
                if (rate > bestEfficiencyQ.rate) bestEfficiencyQ = { num: idx + 1, rate };
                if (rate < worstEfficiencyQ.rate && marksEarned < q.totalMarks) worstEfficiencyQ = { num: idx + 1, rate };
              });

              return (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-3xl bg-white border border-[#E0DBD0] shadow-xs space-y-1">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#A5A58D]">Ideal Question Budget</div>
                      <div className="text-xl font-mono font-bold text-[#2D312E]">{Math.ceil(expectedSecsPerQ / 60)} mins</div>
                      <p className="text-[11px] text-[#6B705C]">Per question based on {gradedResult.durationAllottedMinutes}m paper</p>
                    </div>

                    <div className="p-4 rounded-3xl bg-white border border-[#E0DBD0] shadow-xs space-y-1">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#A5A58D]">Time-Sink Questions</div>
                      <div className={`text-xl font-mono font-bold ${timeSinkQuestionsCount > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {timeSinkQuestionsCount} Question{timeSinkQuestionsCount === 1 ? '' : 's'}
                      </div>
                      <p className="text-[11px] text-[#6B705C]">Exceeded budget with marks left on table</p>
                    </div>

                    <div className="p-4 rounded-3xl bg-white border border-[#E0DBD0] shadow-xs space-y-1">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#A5A58D]">Pacing Strategy</div>
                      <div className="text-xl font-mono font-bold text-[#2D312E]">
                        {timeSinkQuestionsCount === 0 ? 'Optimal Pace' : 'Needs Flag Discipline'}
                      </div>
                      <p className="text-[11px] text-[#6B705C]">
                        {timeSinkQuestionsCount === 0 ? 'Balanced time allocation across all marks' : `Cut losses on Q${worstEfficiencyQ.num} earlier`}
                      </p>
                    </div>
                  </div>

                  {/* Question-By-Question Time Sink Table */}
                  <div className="p-6 rounded-3xl bg-white border border-[#E0DBD0] shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-[#2D312E] uppercase tracking-wider flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#6B705C]" />
                        <span>Question Pacing & Mark Efficiency Audit</span>
                      </h4>
                      <span className="text-xs text-[#A5A58D] font-mono">Exam Hall Pacing Log</span>
                    </div>

                    <div className="space-y-3">
                      {gradedResult.gradedQuestions.map((q, idx) => {
                        const spent = questionTimeSpent[q.questionId] || expectedSecsPerQ;
                        const spentMins = Math.floor(spent / 60);
                        const spentSecs = spent % 60;
                        const isSevereSink = spent > expectedSecsPerQ * 1.35 && q.awardedMarks < q.totalMarks;
                        const isFullMarksFast = q.awardedMarks === q.totalMarks && spent <= expectedSecsPerQ;

                        return (
                          <div
                            key={q.questionId}
                            className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              isSevereSink
                                ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                                : isFullMarksFast
                                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                                : 'bg-[#F9F7F2] border-[#E0DBD0] text-[#4A4E4D]'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs font-mono">Question {idx + 1}</span>
                                {q.topicName && (
                                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white border border-[#E0DBD0] text-[#6B705C]">
                                    {q.topicName}
                                  </span>
                                )}
                                <span className="text-xs font-bold">
                                  {q.awardedMarks} / {q.totalMarks} Marks
                                </span>
                              </div>
                              <p className="text-xs line-clamp-1 opacity-85">
                                {q.examinerFeedback}
                              </p>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <div className="text-xs font-mono font-bold">
                                  {spentMins}m {spentSecs}s spent
                                </div>
                                <div className="text-[10px] opacity-75">
                                  Ideal: ~{Math.ceil(expectedSecsPerQ / 60)}m
                                </div>
                              </div>

                              <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border ${
                                isSevereSink
                                  ? 'bg-rose-100 border-rose-300 text-rose-800'
                                  : isFullMarksFast
                                  ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                                  : 'bg-white border-[#E0DBD0] text-[#4A4E4D]'
                              }`}>
                                {isSevereSink ? '⚠️ Time Sink' : isFullMarksFast ? '⚡ High ROI' : '⏱️ On Pace'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Examiner Tactical Rule */}
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1.5">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Chief Examiner Time-Management Rule for Hall Simulation</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        Never spend more than 1.5 minutes per available mark. If a 3-mark question takes longer than 4.5 minutes, flag it, write your working-so-far for partial credit, and immediately move on. The highest scoring candidates always attempt 100% of the paper.
                      </p>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Fullscreen Image Preview Modal */}
        {previewImageModalUrl && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="relative max-w-4xl w-full max-h-[90vh] bg-white rounded-3xl p-4 shadow-2xl flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#E0DBD0]">
                <span className="text-xs font-bold text-[#2D312E] flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-[#6B705C]" />
                  <span>Handwritten Working Sheet & Diagram Inspection</span>
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewImageModalUrl(null)}
                  className="p-1.5 rounded-xl bg-[#F2EFE9] hover:bg-[#EAE7DF] text-[#4A4E4D] transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-auto max-h-[75vh] flex items-center justify-center bg-[#F9F7F2] rounded-2xl p-2">
                <img 
                  src={previewImageModalUrl} 
                  alt="Enlarged handwritten work" 
                  className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-xs"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};
