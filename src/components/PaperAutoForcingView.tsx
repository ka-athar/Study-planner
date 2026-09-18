import React, { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  HelpCircle, 
  ArrowRight, 
  Sparkles, 
  FileText, 
  ShieldAlert, 
  Compass, 
  Award,
  Flame,
  Check,
  RotateCcw
} from 'lucide-react';
import { 
  TestResult, 
  ForcedQuestionDiagnostic, 
  AutoForcingErrorCategory, 
  MetacognitiveConfidence, 
  AutoForcingPaperSession 
} from '../types';
import { addMistake } from '../lib/mistakeVaultStorage';
import { AppLanguage, translations } from '../lib/translations';

interface PaperAutoForcingViewProps {
  testResults: TestResult[];
  userLanguage?: AppLanguage;
  onNavigateToTab?: (tabId: string) => void;
}

const ERROR_CATEGORIES: { id: AutoForcingErrorCategory; label: string; description: string }[] = [
  { id: 'couldnt_apply', label: 'Couldn’t Apply Concept', description: 'Understood theory, but failed to apply to numerical or problem scenario' },
  { id: 'misread_question', label: 'Misread Question / Trap', description: 'Overlooked "NOT", wrong units, or misinterpreted the requested variable' },
  { id: 'forgot_concept', label: 'Memory Slip / Blanked', description: 'Knew it before, but completely forgot the formula or rule under pressure' },
  { id: 'calculation_error', label: 'Calculation / Arithmetic', description: 'Correct formula, but made an algebra or arithmetic calculation slip' },
  { id: 'carelessness', label: 'Carelessness / Rushed', description: 'Wrote the wrong option or missed a minus sign due to haste' },
  { id: 'time_pressure', label: 'Time Pressure / Panic', description: 'Ran out of time and guessed or made a frantic unverified attempt' },
  { id: 'presentation_units', label: 'Presentation / Missing Units', description: 'Lost partial marks for missing SI units, vector arrows, or diagram labels' },
  { id: 'unprepared_topic', label: 'Never Studied Topic', description: 'Concept was entirely unfamiliar or missing from study coverage' }
];

export const PaperAutoForcingView: React.FC<PaperAutoForcingViewProps> = ({
  testResults,
  userLanguage = 'en',
  onNavigateToTab
}) => {
  const [lang, setLang] = useState<AppLanguage>(userLanguage);
  const t = translations[lang] || translations.en;

  // Active paper session
  const [activeSession, setActiveSession] = useState<AutoForcingPaperSession>(() => {
    // Initial demo / template session if no active one
    return {
      id: 'session_' + Date.now(),
      testTitle: testResults[0]?.testName || 'Full Length Mock Exam 1',
      subjectName: testResults[0]?.subjectName || 'Physics & Mathematics',
      completedAt: new Date().toISOString(),
      totalQuestions: 5,
      questionsChecked: 2,
      totalMarksPossible: 20,
      totalMarksScored: 12,
      questions: [
        {
          id: 'q1',
          questionNumber: 'Q1',
          questionText: 'Derive kinetic energy of rotation in terms of angular velocity ω and moment of inertia I.',
          correctAnswer: 'E_k = 0.5 * I * ω^2',
          totalMarks: 4,
          marksLost: 0,
          isCorrect: true,
          preConfidence: 'High',
          metacognitiveAlignment: 'calibrated_mastery',
          prescribedAction: 'Mastery confirmed. Retain via standard 14-day spaced repetition.'
        },
        {
          id: 'q2',
          questionNumber: 'Q2',
          questionText: 'Calculate the magnetic flux through a coil tilted at 60° to a 0.5T field with area 0.2m².',
          correctAnswer: 'Φ = B * A * cos(60°) = 0.5 * 0.2 * 0.5 = 0.05 Wb',
          totalMarks: 4,
          marksLost: 4,
          isCorrect: false,
          preConfidence: 'High', // DANGEROUS OVERCONFIDENCE!
          errorCategory: 'couldnt_apply',
          rootCauseNotes: 'Used sin(60) instead of the normal surface angle cos(60)',
          metacognitiveAlignment: 'dangerous_overconfidence',
          prescribedAction: 'Dangerous Overconfidence detected! Re-audit angle definitions between B and surface normal vs plane.'
        },
        {
          id: 'q3',
          questionNumber: 'Q3',
          questionText: 'Explain why a dielectric slab increases capacitance when inserted between capacitor plates.',
          correctAnswer: 'Polarization induces opposite surface charges, reducing E-field, lowering voltage V for same Q, so C = Q/V increases.',
          totalMarks: 4,
          marksLost: 2,
          isCorrect: false,
          preConfidence: 'Low',
          errorCategory: 'forgot_concept',
          rootCauseNotes: 'Mentioned polarization but forgot that V decreases so C increases',
          metacognitiveAlignment: 'aware_incompetence',
          prescribedAction: 'Log dielectric polarization mechanism directly to Mistake Vault.'
        }
      ],
      errorBreakdown: {
        couldnt_apply: 1,
        misread_question: 0,
        forgot_concept: 1,
        calculation_error: 0,
        time_pressure: 0,
        carelessness: 0,
        presentation_units: 0,
        unprepared_topic: 0
      },
      alignmentSummary: {
        dangerousOverconfidenceCount: 1,
        hesitantMasteryCount: 0,
        calibratedCount: 1
      }
    };
  });

  // Current question being diagnosed
  const [currentQIndex, setCurrentQIndex] = useState<number>(1);
  const [notification, setNotification] = useState<string | null>(null);

  const currentQ = activeSession.questions[currentQIndex];

  const handleUpdateConfidence = (conf: MetacognitiveConfidence) => {
    if (!currentQ) return;
    const isCorrect = currentQ.isCorrect;
    let alignment: ForcedQuestionDiagnostic['metacognitiveAlignment'] = 'calibrated_mastery';

    if (conf === 'High' && !isCorrect) {
      alignment = 'dangerous_overconfidence';
    } else if (conf === 'Low' && isCorrect) {
      alignment = 'hesitant_mastery';
    } else if (conf === 'Low' && !isCorrect) {
      alignment = 'aware_incompetence';
    }

    const updatedQuestions = [...activeSession.questions];
    updatedQuestions[currentQIndex] = {
      ...currentQ,
      preConfidence: conf,
      metacognitiveAlignment: alignment
    };

    setActiveSession({
      ...activeSession,
      questions: updatedQuestions
    });
  };

  const handleSelectErrorCategory = (cat: AutoForcingErrorCategory) => {
    if (!currentQ) return;
    const updatedQuestions = [...activeSession.questions];
    updatedQuestions[currentQIndex] = {
      ...currentQ,
      errorCategory: cat
    };

    setActiveSession({
      ...activeSession,
      questions: updatedQuestions
    });
  };

  const handleExecuteRemedy = (q: ForcedQuestionDiagnostic) => {
    addMistake({
      subjectName: activeSession.subjectName,
      topicName: q.questionText.slice(0, 45) + '...',
      question: q.questionText,
      correctAnswer: q.correctAnswer,
      errorCategory: q.errorCategory === 'calculation_error' ? 'careless_calc' : q.errorCategory === 'misread_question' ? 'misread_question' : 'concept_gap',
      notes: `Root cause: ${q.errorCategory || 'Concept gap'}. Metacognitive status: ${q.metacognitiveAlignment}. Notes: ${q.rootCauseNotes || ''}`,
      source: 'auto_forcing_paper'
    });

    const updatedQuestions = [...activeSession.questions];
    updatedQuestions[currentQIndex] = {
      ...q,
      isActionExecuted: true
    };

    setActiveSession({
      ...activeSession,
      questions: updatedQuestions
    });

    setNotification('Prescribed action executed! Mistake logged with root-cause diagnostic.');
    setTimeout(() => setNotification(null), 3500);
  };

  const alignmentPill = (alignment: ForcedQuestionDiagnostic['metacognitiveAlignment']) => {
    switch (alignment) {
      case 'dangerous_overconfidence':
        return (
          <span className="px-3 py-1 bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 font-bold text-xs rounded-full flex items-center gap-1.5 border border-rose-300 dark:border-rose-800">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Dangerous Overconfidence (Illusion of Competence)</span>
          </span>
        );
      case 'hesitant_mastery':
        return (
          <span className="px-3 py-1 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold text-xs rounded-full flex items-center gap-1.5 border border-amber-300 dark:border-amber-800">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Hesitant Mastery (Lacks Exam Conviction)</span>
          </span>
        );
      case 'calibrated_mastery':
        return (
          <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold text-xs rounded-full flex items-center gap-1.5 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Calibrated Mastery</span>
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold text-xs rounded-full">
            Aware Incompetence (Expected Gap)
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8" dir={lang === 'ur' ? 'rtl' : 'ltr'}>
      {/* Toast */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-stone-900 text-stone-100 px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-stone-700 animate-fade-in text-sm font-medium">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-stone-900 text-stone-100 rounded-3xl p-6 sm:p-8 border border-stone-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-semibold uppercase tracking-wider border border-rose-500/30">
              <Compass className="w-3.5 h-3.5" />
              <span>Mandatory Reflection Protocol</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-50">
              {t.auto_forcing_title}
            </h1>
            <p className="text-stone-300 max-w-2xl text-sm sm:text-base leading-relaxed">
              {t.auto_forcing_subtitle}
            </p>
          </div>

          <div className="bg-stone-800/80 px-5 py-3 rounded-2xl border border-stone-700 space-y-1">
            <p className="text-xs text-stone-400 font-semibold uppercase">Exam Under Review</p>
            <p className="text-sm font-bold text-stone-100">{activeSession.testTitle}</p>
            <p className="text-xs font-mono text-emerald-400 font-bold">
              Score: {activeSession.totalMarksScored} / {activeSession.totalMarksPossible} Marks
            </p>
          </div>
        </div>
      </div>

      {/* Main Diagnostic Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Questions List & Navigator */}
        <div className="lg:col-span-4 space-y-4">
          <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span>Questions in Paper ({activeSession.questions.length})</span>
          </h2>

          <div className="space-y-2.5">
            {activeSession.questions.map((q, idx) => (
              <div
                key={q.id}
                onClick={() => setCurrentQIndex(idx)}
                className={`p-4 rounded-2xl border transition cursor-pointer space-y-2 ${
                  idx === currentQIndex
                    ? 'bg-white dark:bg-stone-800 border-rose-500 shadow-md ring-1 ring-rose-500'
                    : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:border-stone-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-stone-900 dark:text-stone-100">
                    {q.questionNumber}
                  </span>
                  <div className="flex items-center gap-2">
                    {q.isCorrect ? (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Full Marks
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" /> -{q.marksLost} Marks
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-2">
                  {q.questionText}
                </p>

                <div className="flex items-center justify-between text-[11px] text-stone-400 pt-1">
                  <span>Confidence: {q.preConfidence}</span>
                  {q.errorCategory && (
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">
                      {q.errorCategory.replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Active Question Forced Diagnosis */}
        <div className="lg:col-span-8 space-y-6">
          {currentQ ? (
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
              {/* Question Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-4">
                <div>
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                    Detailed Question Audit
                  </span>
                  <h3 className="text-lg font-bold text-stone-900 dark:text-stone-50 mt-1">
                    {currentQ.questionNumber}: {currentQ.questionText}
                  </h3>
                </div>

                <div className="shrink-0">
                  {alignmentPill(currentQ.metacognitiveAlignment)}
                </div>
              </div>

              {/* Standard Correct Answer Reference */}
              <div className="p-4 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700/50 space-y-1">
                <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                  Examiner Marking Scheme / Correct Working:
                </span>
                <p className="text-xs font-mono text-emerald-700 dark:text-emerald-300 font-medium">
                  {currentQ.correctAnswer}
                </p>
              </div>

              {/* 1. Pre-Answer Confidence vs Actual Outcome Calibration */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200 uppercase tracking-wider flex items-center gap-2">
                  <Compass className="w-4 h-4 text-rose-500" />
                  <span>1. Confidence Calibration: What was your confidence before answering?</span>
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  {(['High', 'Medium', 'Low'] as MetacognitiveConfidence[]).map(conf => (
                    <button
                      key={conf}
                      onClick={() => handleUpdateConfidence(conf)}
                      className={`p-3 rounded-xl border text-xs font-bold text-center transition ${
                        currentQ.preConfidence === conf
                          ? 'bg-rose-500 text-white border-rose-600 shadow-sm'
                          : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100'
                      }`}
                    >
                      {conf} Confidence
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Mandatory Error Cause Categorization */}
              {!currentQ.isCorrect && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200 uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    <span>2. Auto-Forcing: Why did you lose marks on this question?</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {ERROR_CATEGORIES.map(cat => (
                      <div
                        key={cat.id}
                        onClick={() => handleSelectErrorCategory(cat.id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition space-y-1 ${
                          currentQ.errorCategory === cat.id
                            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 shadow-sm'
                            : 'bg-stone-50 dark:bg-stone-800/40 border-stone-200 dark:border-stone-800 hover:border-stone-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-stone-900 dark:text-stone-100">
                            {cat.label}
                          </span>
                          {currentQ.errorCategory === cat.id && (
                            <Check className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                          )}
                        </div>
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-snug">
                          {cat.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Prescribed Action & Remediation */}
              <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/30 rounded-2xl space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider block">
                      Automatic Prescriptive Action
                    </span>
                    <p className="text-xs text-stone-800 dark:text-stone-200 font-medium mt-1 leading-relaxed">
                      {currentQ.prescribedAction}
                    </p>
                  </div>

                  {!currentQ.isCorrect && (
                    <button
                      onClick={() => handleExecuteRemedy(currentQ)}
                      disabled={currentQ.isActionExecuted}
                      className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 ${
                        currentQ.isActionExecuted
                          ? 'bg-emerald-600 text-white cursor-default'
                          : 'bg-rose-600 hover:bg-rose-700 text-white shadow'
                      }`}
                    >
                      {currentQ.isActionExecuted ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Logged to Mistake Vault</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Auto-Log Remediation</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Next/Prev Navigation */}
              <div className="flex items-center justify-between pt-4 border-t border-stone-200 dark:border-stone-800">
                <button
                  onClick={() => setCurrentQIndex(i => Math.max(0, i - 1))}
                  disabled={currentQIndex === 0}
                  className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-300 disabled:opacity-40 transition"
                >
                  ← Previous Question
                </button>
                <button
                  onClick={() => setCurrentQIndex(i => Math.min(activeSession.questions.length - 1, i + 1))}
                  disabled={currentQIndex === activeSession.questions.length - 1}
                  className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-black dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-950 text-xs font-bold disabled:opacity-40 transition flex items-center gap-1"
                >
                  <span>Next Question</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-stone-400">
              Select a question to inspect.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
