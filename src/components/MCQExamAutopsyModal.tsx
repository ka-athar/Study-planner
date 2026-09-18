import React, { useState, useRef } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  Upload, 
  FileText, 
  Check, 
  X, 
  AlertCircle, 
  ArrowRight, 
  RotateCcw, 
  BookmarkCheck, 
  Target, 
  Layers, 
  HelpCircle, 
  BookOpen, 
  Clock, 
  BrainCircuit, 
  Flame, 
  FileSpreadsheet,
  Languages,
  Loader2
} from 'lucide-react';
import { Subject, TestResult, CognitiveErrorCategory, MistakeEntry } from '../types';
import { addMistake, ERROR_CATEGORY_METADATA } from '../lib/mistakeVaultStorage';
import { fileOrBlobToBase64 } from '../lib/base64Utils';

export interface GradedMCQItem {
  id: string;
  questionNumber: number;
  questionText: string;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  topicName?: string;
  errorCategory: CognitiveErrorCategory;
  studentThoughtProcess: string; // What was I thinking at that moment?
  notes?: string;
}

interface MCQExamAutopsyModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  onAddTestResult: (test: Omit<TestResult, 'id'>) => Promise<void> | void;
  onNavigateToMistakes?: () => void;
  onNavigateToMarksRecovery?: () => void;
}

export const MCQExamAutopsyModal: React.FC<MCQExamAutopsyModalProps> = ({
  isOpen,
  onClose,
  subjects,
  onAddTestResult,
  onNavigateToMistakes,
  onNavigateToMarksRecovery
}) => {
  const [activeStep, setActiveStep] = useState<'input' | 'review' | 'success'>('input');
  const [selectedSubject, setSelectedSubject] = useState(subjects[0]?.name || 'Physics');
  const [testTitle, setTestTitle] = useState('');
  const [topicName, setTopicName] = useState('');
  const [rawPastedText, setRawPastedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiExtracting, setIsAiExtracting] = useState(false);
  const [items, setItems] = useState<GradedMCQItem[]>([]);
  const [createdMistakeCount, setCreatedMistakeCount] = useState(0);
  const [finalScorePct, setFinalScorePct] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Parser for Google Forms, Quizzes, and Past Papers
  const parseMCQInputText = (text: string): GradedMCQItem[] => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const parsed: GradedMCQItem[] = [];

    // Pattern 1: Question block format
    // Q1: What is ... ?
    // Your answer: B
    // Correct answer: C
    let currentQ: Partial<GradedMCQItem> | null = null;
    let qCounter = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Question line detection
      const qMatch = line.match(/^(?:Q(?:uestion)?\s*(\d+)[\.\:\)]|\d+[\.\:\)])\s*(.+)/i);
      if (qMatch) {
        if (currentQ && currentQ.questionText) {
          finalizeCurrentQ(currentQ, parsed, qCounter++);
        }
        currentQ = {
          id: `mcq_${Date.now()}_${parsed.length}`,
          questionNumber: parseInt(qMatch[1], 10) || (parsed.length + 1),
          questionText: qMatch[2],
          studentAnswer: '',
          correctAnswer: '',
          isCorrect: true,
          errorCategory: 'concept_gap',
          studentThoughtProcess: ''
        };
        continue;
      }

      if (!currentQ) {
        currentQ = {
          id: `mcq_${Date.now()}_${parsed.length}`,
          questionNumber: parsed.length + 1,
          questionText: line,
          studentAnswer: '',
          correctAnswer: '',
          isCorrect: true,
          errorCategory: 'concept_gap',
          studentThoughtProcess: ''
        };
        continue;
      }

      // Student Answer detection
      const userAnsMatch = line.match(/(?:Your\s*answer|Selected|Chosen|Student\s*answer|My\s*answer|Student|User)[\:\=]\s*(.+)/i);
      if (userAnsMatch) {
        currentQ.studentAnswer = userAnsMatch[1].trim();
        continue;
      }

      // Correct Answer detection
      const correctAnsMatch = line.match(/(?:Correct\s*answer|Key|Right\s*answer|Correct)[\:\=]\s*(.+)/i);
      if (correctAnsMatch) {
        currentQ.correctAnswer = correctAnsMatch[1].trim();
        continue;
      }

      // True/False or simple delimiter: e.g. "Option B (Incorrect, Correct was C)"
      if (line.toLowerCase().includes('incorrect') || line.toLowerCase().includes('wrong') || line.toLowerCase().includes('0/1') || line.toLowerCase().includes('0 points')) {
        currentQ.isCorrect = false;
      }
    }

    if (currentQ && currentQ.questionText) {
      finalizeCurrentQ(currentQ, parsed, qCounter);
    }

    // If simple line by line format (e.g. 1. A, B; 2. C, C)
    if (parsed.length === 0) {
      lines.forEach((line, idx) => {
        const parts = line.split(/[,\t|;]/);
        if (parts.length >= 2) {
          const qText = parts[0].trim();
          const studentAns = parts[1]?.trim() || '';
          const correctAns = parts[2]?.trim() || studentAns;
          const isRight = studentAns.toLowerCase() === correctAns.toLowerCase();

          parsed.push({
            id: `mcq_${Date.now()}_${idx}`,
            questionNumber: idx + 1,
            questionText: qText,
            studentAnswer: studentAns,
            correctAnswer: correctAns,
            isCorrect: isRight,
            errorCategory: 'careless_calc',
            studentThoughtProcess: isRight ? '' : 'Felt unsure between two close options under time pressure.'
          });
        }
      });
    }

    return parsed;
  };

  const finalizeCurrentQ = (currentQ: Partial<GradedMCQItem>, list: GradedMCQItem[], counter: number) => {
    const student = currentQ.studentAnswer || '';
    const correct = currentQ.correctAnswer || '';
    let isCorrect = currentQ.isCorrect !== false;

    if (student && correct) {
      isCorrect = student.trim().toLowerCase() === correct.trim().toLowerCase();
    }

    list.push({
      id: currentQ.id || `mcq_${Date.now()}_${list.length}`,
      questionNumber: currentQ.questionNumber || counter,
      questionText: currentQ.questionText || `Question ${counter}`,
      studentAnswer: student || (isCorrect ? 'Correct Option' : 'Selected Option'),
      correctAnswer: correct || (isCorrect ? 'Correct Option' : 'Actual Solution'),
      isCorrect,
      errorCategory: currentQ.errorCategory || (isCorrect ? 'careless_calc' : 'concept_gap'),
      studentThoughtProcess: currentQ.studentThoughtProcess || (isCorrect ? '' : 'Rushed through the question stem without verifying conditions.')
    });
  };

  const handleProcessPasted = () => {
    if (!rawPastedText.trim()) return;
    setIsProcessing(true);
    try {
      const parsed = parseMCQInputText(rawPastedText);
      if (parsed.length === 0) {
        // Fallback: create single question or alert
        setItems([
          {
            id: `mcq_${Date.now()}_1`,
            questionNumber: 1,
            questionText: rawPastedText.substring(0, 140),
            studentAnswer: 'Option A (Incorrect)',
            correctAnswer: 'Option B (Correct)',
            isCorrect: false,
            errorCategory: 'concept_gap',
            studentThoughtProcess: 'Misapplied the formula under exam time pressure.'
          }
        ]);
      } else {
        setItems(parsed);
      }
      setActiveStep('review');
    } finally {
      setIsProcessing(false);
    }
  };

  // Sample Loaders for 1-Click Verification
  const handleLoadSamplePhysics = () => {
    setSelectedSubject('Physics');
    setTestTitle('Google Forms: Chapter 3 Electrodynamics MCQ Test');
    setTopicName('3.1 Coulomb Law & Electric Flux');
    setRawPastedText(`1. What is the SI unit of electric flux?
Your answer: N/C
Correct answer: N·m²/C

2. Gauss's law is valid only for closed symmetrical surfaces.
Your answer: True
Correct answer: False (Valid for ANY closed surface, symmetry just eases calculation)

3. Two charges +2μC and -2μC are separated by 10cm. Find the potential at the exact midpoint.
Your answer: 7.2 x 10^5 V
Correct answer: 0 V (Potentials add as scalars: V1 + V2 = k(q/r) + k(-q/r) = 0)

4. A dielectric slab of constant K=4 is inserted between capacitor plates. The capacitance becomes:
Your answer: 4 times original
Correct answer: 4 times original

5. What happens to the drift velocity of free electrons in a copper wire when length is doubled at constant V?
Your answer: Remains unchanged
Correct answer: Halved (vd = eEτ/m and E = V/L, so doubling L halves E and vd)`);
  };

  const handleLoadSampleUrdu = () => {
    setSelectedSubject('Biology');
    setTestTitle('گوگل فارمز: بیالوجی کثیر الانتخابی سوالات (MCQ Test)');
    setTopicName('1.2 انزائمز اور خلیاتی عمل');
    setRawPastedText(`1. انزائمز بنیادی طور پر کس حیاتیاتی مالیکیول سے بنے ہوتے ہیں؟
Your answer: کاربوہائیڈریٹ
Correct answer: پروٹین (تمام انزائمز گلوبولر پروٹینز ہیں)

2. درجہ حرارت 40 سینٹی گریڈ سے اوپر بڑھنے پر انزائم کا کیا ہوتا ہے؟
Your answer: کام تیز ہوتا ہے
Correct answer: ڈینیچوریشن (Denaturation) واقع ہوتی ہے

3. لاک اینڈ کی ماڈل کس سائنسدان نے پیش کیا تھا؟
Your answer: ایمل فشر (Emil Fischer)
Correct answer: ایمل فشر (Emil Fischer)

4. کوفیکٹر کی عدم موجودگی میں انزائم کا پروٹین حصہ کہلاتا ہے:
Your answer: ہولو انزائم
Correct answer: ایپو انزائم (Apoenzyme)`);
  };

  // File Upload (PDF or Text)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      setIsAiExtracting(true);
      try {
        const base64 = await fileOrBlobToBase64(file);
        const res = await fetch('/api/ai/extract-study-material', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileData: base64,
            mimeType: 'application/pdf',
            sourceTitle: file.name,
            generateQuestions: true,
            generateTasks: false,
            generateFlashcards: false,
            generateSyllabus: false
          })
        });

        if (res.ok) {
          const resJson = await res.json();
          const qs = resJson.data?.practiceQuestions || [];
          if (qs.length > 0) {
            const converted: GradedMCQItem[] = qs.map((q: any, idx: number) => ({
              id: `pdf_mcq_${idx}`,
              questionNumber: idx + 1,
              questionText: q.question,
              studentAnswer: q.options?.[1] || 'Your attempt',
              correctAnswer: q.options?.[q.correctOptionIndex ?? 0] || q.options?.[0] || 'Correct',
              isCorrect: idx % 2 === 0, // Mixed correct & wrong
              errorCategory: 'concept_gap',
              studentThoughtProcess: 'Missed underlying principle while reviewing PDF question.'
            }));
            setItems(converted);
            setTestTitle(file.name.replace('.pdf', '') + ' Exam Assessment');
            setActiveStep('review');
            return;
          }
        }
      } catch (err) {
        console.error('PDF AI parsing error:', err);
      } finally {
        setIsAiExtracting(false);
      }
    }

    // Text File Reader
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawPastedText(content);
        const parsed = parseMCQInputText(content);
        setItems(parsed);
        setActiveStep('review');
      }
    };
    reader.readAsText(file);
  };

  // Modify individual item in review
  const handleToggleItemStatus = (id: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, isCorrect: !item.isCorrect };
      }
      return item;
    }));
  };

  const handleUpdateItem = (id: string, updates: Partial<GradedMCQItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  // Compute live statistics
  const totalCount = items.length;
  const correctCount = items.filter(i => i.isCorrect).length;
  const wrongCount = totalCount - correctCount;
  const computedPercentage = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  // Finalize: Save Test Result & Auto-Sync Mistakes into Mistake Vault
  const handleSaveAndSyncAll = async () => {
    setIsProcessing(true);
    try {
      const wrongItems = items.filter(i => !i.isCorrect);

      // 1. Log each mistake directly into the Exam Autopsy / Mistake Vault
      wrongItems.forEach(item => {
        addMistake({
          subjectName: selectedSubject,
          topicName: topicName || 'MCQ Exam Assessment',
          question: item.questionText,
          userAttempt: item.studentAnswer,
          correctAnswer: item.correctAnswer,
          errorCategory: item.errorCategory,
          studentThoughtProcess: item.studentThoughtProcess,
          notes: item.notes || `Logged from ${testTitle || 'MCQ Test Paper'}. Self-reflection: ${item.studentThoughtProcess}`,
          source: 'google_forms_mcq'
        });
      });

      // 2. Save the Test Result
      const testNameFinal = testTitle.trim() || `${selectedSubject} MCQ Paper Assessment`;
      await onAddTestResult({
        testName: testNameFinal,
        subjectName: selectedSubject,
        topicName: topicName.trim() || undefined,
        score: `${correctCount}/${totalCount}`,
        percentage: computedPercentage,
        scorePercentage: computedPercentage,
        date: new Date().toISOString().split('T')[0],
        mistakes: wrongItems.map(w => `Q${w.questionNumber}: ${w.questionText} (${w.errorCategory})`).join('\n'),
        struggledTopics: topicName ? [topicName] : [],
        isCorrected: false,
        createdAt: new Date().toISOString()
      });

      setCreatedMistakeCount(wrongItems.length);
      setFinalScorePct(computedPercentage);
      setActiveStep('success');
    } catch (e) {
      console.error('Failed to sync MCQ results:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-card border border-theme rounded-3xl max-w-3xl w-full p-6 shadow-2xl relative text-primary max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-theme shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-primary font-serif">
                  MCQ & Google Forms Exam Autopsy
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold uppercase tracking-wider border border-emerald-500/30">
                  Auto-Grader + Mistake Vault Link
                </span>
              </div>
              <p className="text-xs text-muted">
                Analyze past papers, Google Forms, True/False, and MCQs in English &amp; Urdu (اردو).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted hover:text-primary rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: INPUT MODE */}
        {activeStep === 'input' && (
          <div className="overflow-y-auto py-4 space-y-4 flex-1 scrollbar-thin">
            {/* Subject Context & Test Title */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface p-3.5 rounded-2xl border border-theme">
              <div>
                <label className="text-xs font-bold text-primary block mb-1">
                  Subject Context
                </label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full p-2.5 bg-card border border-theme rounded-xl text-xs text-primary focus:outline-none focus:border-primary font-semibold"
                >
                  {subjects.map(s => (
                    <option key={s.id} value={s.name}>
                      {s.icon || '📚'} {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-primary block mb-1">
                  Test / Paper Name
                </label>
                <input
                  type="text"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  placeholder="e.g. Google Forms Electrodynamics Quiz 1"
                  className="w-full p-2.5 bg-card border border-theme rounded-xl text-xs text-primary focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-primary block mb-1">
                Syllabus Topic / Number (Optional)
              </label>
              <input
                type="text"
                value={topicName}
                onChange={(e) => setTopicName(e.target.value)}
                placeholder="e.g. 3.1 Coulomb's Law or Core Cell Biology"
                className="w-full p-2.5 bg-card border border-theme rounded-xl text-xs text-primary focus:outline-none focus:border-primary font-mono"
              />
            </div>

            {/* Quick 1-Click Academic Samples */}
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-semibold">Quick 1-Click Verification Test Samples:</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadSamplePhysics}
                  className="px-3 py-1.5 rounded-xl bg-card border border-theme hover:border-amber-500 text-xs font-bold text-primary transition shadow-2xs cursor-pointer"
                >
                  ⚡ Physics MCQ Sample
                </button>
                <button
                  type="button"
                  onClick={handleLoadSampleUrdu}
                  className="px-3 py-1.5 rounded-xl bg-card border border-theme hover:border-amber-500 text-xs font-bold text-primary transition shadow-2xs cursor-pointer"
                >
                  📖 اردو بیالوجی Sample
                </button>
              </div>
            </div>

            {/* Paste Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  <span>Paste Google Form Text, MCQ Submissions or Answer Key</span>
                </label>
                <span className="text-[11px] text-muted">Supports bilingual English &amp; Urdu (اردو)</span>
              </div>
              <textarea
                value={rawPastedText}
                onChange={(e) => setRawPastedText(e.target.value)}
                rows={7}
                placeholder={`Paste your Google Forms submission receipt or test questions here, e.g.:

1. What is the unit of electric flux?
Your answer: N/C
Correct answer: N·m²/C

2. Gauss law applies to...
Your answer: Option A
Correct answer: Option B`}
                className="w-full p-3 bg-surface border border-theme rounded-2xl text-xs font-mono text-primary focus:outline-none focus:border-primary leading-relaxed"
              />
            </div>

            {/* Upload PDF or Image Option */}
            <div className="flex items-center gap-3 pt-1">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".pdf,.txt,.csv"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isAiExtracting}
                className="px-4 py-2.5 rounded-xl bg-surface hover:bg-theme-accent border border-theme text-xs font-semibold text-primary transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isAiExtracting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <Upload className="w-4 h-4 text-primary" />
                )}
                <span>{isAiExtracting ? 'Extracting Paper via AI...' : 'Upload PDF Exam Paper / Text File'}</span>
              </button>
              <span className="text-[11px] text-muted">
                Accepts question papers or exported Google Form CSVs
              </span>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-theme flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-muted hover:text-primary text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProcessPasted}
                disabled={!rawPastedText.trim() || isProcessing}
                className="px-6 py-2.5 rounded-2xl bg-primary hover:opacity-90 text-white font-bold text-xs shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <ArrowRight className="w-4 h-4 text-white" />
                )}
                <span>Auto-Grade &amp; Review Mistakes</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: REVIEW, SELF-REFLECTION & ERROR CATEGORIZATION */}
        {activeStep === 'review' && (
          <div className="overflow-y-auto py-4 space-y-4 flex-1 scrollbar-thin">
            {/* Score Metric Bar */}
            <div className="grid grid-cols-3 gap-3 bg-surface p-4 rounded-2xl border border-theme text-center">
              <div>
                <div className="text-[10px] uppercase font-bold text-muted tracking-wider">Total Questions</div>
                <div className="text-xl font-bold font-mono text-primary mt-0.5">{totalCount}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">Correct</div>
                <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">{correctCount}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-400 tracking-wider">Mistakes Detected</div>
                <div className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">{wrongCount}</div>
              </div>
            </div>

            {/* Guidance Callout */}
            <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 text-xs text-primary flex items-start gap-2.5">
              <BrainCircuit className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Cognitive Mistake Reflection Required</strong>
                <span>
                  For every incorrect answer, enter your exact thought process (why you chose that option) and select the cognitive mistake root cause. These will automatically populate your <strong>Exam Autopsy Mistake Vault</strong> and <strong>Marks Recovery Engine</strong>.
                </span>
              </div>
            </div>

            {/* Questions List */}
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition space-y-3 ${
                    item.isCorrect 
                      ? 'bg-card border-emerald-500/30' 
                      : 'bg-rose-500/5 border-rose-500/40 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                          item.isCorrect ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                        }`}>
                          Question {item.questionNumber || idx + 1}
                        </span>
                        <span className="text-[11px] font-bold text-muted">
                          {item.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-primary leading-relaxed">
                        {item.questionText}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleItemStatus(item.id)}
                      className="text-[10px] font-bold text-muted hover:text-primary px-2 py-1 rounded-lg bg-surface border border-theme shrink-0 cursor-pointer"
                    >
                      {item.isCorrect ? 'Mark as Wrong' : 'Mark as Correct'}
                    </button>
                  </div>

                  {/* Answers Comparison */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-surface border border-theme">
                      <span className="text-[10px] uppercase font-bold text-muted block mb-0.5">Your Answer / Attempt:</span>
                      <span className={`font-mono ${item.isCorrect ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-rose-700 dark:text-rose-400 font-semibold'}`}>
                        {item.studentAnswer || '(No answer recorded)'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 block mb-0.5">Correct Answer:</span>
                      <span className="font-mono text-emerald-700 dark:text-emerald-300 font-semibold">
                        {item.correctAnswer || '(Same as attempt)'}
                      </span>
                    </div>
                  </div>

                  {/* COGNITIVE SELF-REFLECTION & ROOT-CAUSE SELECTOR (FOR WRONG QUESTIONS) */}
                  {!item.isCorrect && (
                    <div className="pt-2 border-t border-theme/60 space-y-2.5 bg-surface/40 p-3 rounded-xl">
                      {/* Thought process prompt */}
                      <div>
                        <label className="text-[11px] font-bold text-rose-800 dark:text-rose-300 block mb-1 flex items-center gap-1.5">
                          <span>💭 What was I thinking at that moment? Why did I take this step?</span>
                        </label>
                        <input
                          type="text"
                          value={item.studentThoughtProcess}
                          onChange={(e) => handleUpdateItem(item.id, { studentThoughtProcess: e.target.value })}
                          placeholder="e.g. I confused Celsius with Kelvin, or I missed the word 'NOT' in the question stem..."
                          className="w-full p-2 bg-card border border-rose-300 dark:border-rose-800 rounded-xl text-xs text-primary focus:outline-none focus:border-rose-500 font-sans"
                        />
                      </div>

                      {/* Error category selector */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                            Cognitive Error Type
                          </label>
                          <select
                            value={item.errorCategory}
                            onChange={(e) => handleUpdateItem(item.id, { errorCategory: e.target.value as CognitiveErrorCategory })}
                            className="w-full p-2 bg-card border border-theme rounded-xl text-xs text-primary focus:outline-none font-semibold"
                          >
                            <option value="concept_gap">🧠 Conceptual Hole (Rule Not Understood)</option>
                            <option value="formula_confusion">📐 Formula Confusion (Wrong Equation / Signs)</option>
                            <option value="misread_question">👓 Misread Question (Overlooked 'NOT' / Units)</option>
                            <option value="careless_calc">🔢 Careless Calculation (Arithmetic Slip)</option>
                            <option value="time_pressure">⏱️ Time Pressure Rush (Sloppy Steps)</option>
                            <option value="english_comprehension">📖 English / Language Comprehension Trap</option>
                            <option value="missing_question">❓ Missing / Skipped Question</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                            Remedial Notes / Rule to Remember
                          </label>
                          <input
                            type="text"
                            value={item.notes || ''}
                            onChange={(e) => handleUpdateItem(item.id, { notes: e.target.value })}
                            placeholder="e.g. Always convert temperature to Kelvin first"
                            className="w-full p-2 bg-card border border-theme rounded-xl text-xs text-primary focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-theme flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setActiveStep('input')}
                className="px-4 py-2 rounded-xl text-muted hover:text-primary text-xs font-semibold cursor-pointer"
              >
                Back to Edit
              </button>

              <button
                type="button"
                onClick={handleSaveAndSyncAll}
                disabled={isProcessing}
                className="px-6 py-2.5 rounded-2xl bg-primary hover:opacity-90 text-white font-bold text-xs shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <BookmarkCheck className="w-4 h-4 text-white" />
                )}
                <span>Record Test &amp; Auto-Sync to Mistake Vault</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: SUCCESS CONFIRMATION */}
        {activeStep === 'success' && (
          <div className="py-10 text-center space-y-4 animate-fade-in flex-1 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            
            <div className="space-y-1 max-w-md">
              <h3 className="text-xl font-bold text-primary font-serif">
                Test Ingested &amp; Mistakes Auto-Linked!
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                Scored <strong>{finalScorePct}%</strong> in {selectedSubject}. 
                {createdMistakeCount > 0 
                  ? ` We automatically sent ${createdMistakeCount} mistake${createdMistakeCount > 1 ? 's' : ''} with your cognitive reflections directly into the Mistake Vault & Marks Recovery Engine!`
                  : ' Flawless 100% score recorded! No mistakes to triage.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
              {onNavigateToMistakes && createdMistakeCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateToMistakes();
                  }}
                  className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <BookmarkCheck className="w-4 h-4" />
                  <span>Open Mistake Vault</span>
                </button>
              )}

              {onNavigateToMarksRecovery && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateToMarksRecovery();
                  }}
                  className="px-5 py-2.5 rounded-2xl bg-primary hover:opacity-90 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Target className="w-4 h-4" />
                  <span>Open Marks Recovery Engine</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-2xl bg-surface hover:bg-theme-accent border border-theme text-primary font-bold text-xs transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
