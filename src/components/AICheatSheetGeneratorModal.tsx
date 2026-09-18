import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Sparkles, 
  Download, 
  Printer, 
  Copy, 
  Check, 
  AlertTriangle, 
  BookOpen, 
  Zap, 
  Lightbulb, 
  HelpCircle, 
  X, 
  Layers, 
  Play, 
  FolderPlus,
  RefreshCw,
  Clock,
  ArrowRight
} from 'lucide-react';
import { Subject, Topic } from '../types';
import { apiGenerateCheatSheet } from '../lib/aiApi';

interface CheatSheetData {
  title: string;
  subject: string;
  chapter?: string;
  topic: string;
  coreSummary: string;
  keyFormulasAndDefinitions: Array<{
    term: string;
    formulaOrDef: string;
    unitsOrVariables?: string;
    notes?: string;
  }>;
  examinerTrapsAndPitfalls: Array<{
    trap: string;
    correctApproach: string;
    explanation: string;
  }>;
  mnemonicsAndMemoryAnchors: Array<{
    concept: string;
    mnemonic: string;
    explanation: string;
  }>;
  highYieldExamQuestions: Array<{
    question: string;
    marks: number;
    frequency: 'Very High' | 'High' | 'Medium';
    answerKey: string;
  }>;
  quickRevisionChecklist: string[];
}

interface AICheatSheetGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  initialSubject?: string;
  initialTopic?: string;
  onStartSprintForTopic?: (subjectName: string, chapterName: string, topicName: string) => void;
  onSaveToVault?: (title: string, content: string, subjectName: string) => void;
}

export const AICheatSheetGeneratorModal: React.FC<AICheatSheetGeneratorModalProps> = ({
  isOpen,
  onClose,
  subjects,
  initialSubject,
  initialTopic,
  onStartSprintForTopic,
  onSaveToVault
}) => {
  const [selectedSubjectName, setSelectedSubjectName] = useState<string>(initialSubject || subjects[0]?.name || '');
  const [selectedTopicName, setSelectedTopicName] = useState<string>(initialTopic || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cheatSheet, setCheatSheet] = useState<CheatSheetData | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [savedToVaultStatus, setSavedToVaultStatus] = useState<boolean>(false);

  const activeSubject = subjects.find(s => s.name === selectedSubjectName) || subjects[0];
  const allTopicsInSubject = activeSubject?.chapters.flatMap(ch => ch.topics.map(t => ({ ...t, chapterName: ch.name }))) || [];

  useEffect(() => {
    if (initialSubject) setSelectedSubjectName(initialSubject);
  }, [initialSubject]);

  useEffect(() => {
    if (initialTopic) {
      setSelectedTopicName(initialTopic);
    } else if (allTopicsInSubject.length > 0 && !selectedTopicName) {
      setSelectedTopicName(allTopicsInSubject[0].name);
    }
  }, [initialTopic, selectedSubjectName]);

  // Auto-generate if opened with a specific topic and not yet generated
  useEffect(() => {
    if (isOpen && initialTopic && (!cheatSheet || cheatSheet.topic !== initialTopic)) {
      handleGenerate(initialSubject || selectedSubjectName, initialTopic);
    }
  }, [isOpen, initialTopic]);

  const handleGenerate = async (subjectToUse?: string, topicToUse?: string) => {
    const sub = subjectToUse || selectedSubjectName;
    const top = topicToUse || selectedTopicName;
    if (!sub || !top) return;

    setLoading(true);
    setError(null);
    setSavedToVaultStatus(false);

    try {
      const activeTopicObj = allTopicsInSubject.find(t => t.name === top);
      const res = await apiGenerateCheatSheet({
        subjectName: sub,
        chapterName: activeTopicObj?.chapterName || 'Core Curriculum',
        topicName: top,
        curriculum: 'FBISE / Board Past Paper Standard'
      });

      if (res && res.keyFormulasAndDefinitions) {
        setCheatSheet(res);
      } else {
        throw new Error('Invalid cheat sheet response format');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate cheat sheet');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyMarkdown = () => {
    if (!cheatSheet) return;
    const md = `# ${cheatSheet.title}
**Subject**: ${cheatSheet.subject} | **Topic**: ${cheatSheet.topic}

## Executive Summary
${cheatSheet.coreSummary}

## Key Formulas & Core Definitions
${cheatSheet.keyFormulasAndDefinitions.map(f => `- **${f.term}**: \`${f.formulaOrDef}\` (${f.unitsOrVariables || 'N/A'})\n  *Note*: ${f.notes || ''}`).join('\n')}

## Examiner Traps & Common Pitfalls
${cheatSheet.examinerTrapsAndPitfalls.map(t => `### ⚠️ ${t.trap}\n- **Correct Marking Scheme Approach**: ${t.correctApproach}\n- **Why it matters**: ${t.explanation}`).join('\n\n')}

## High-Yield Mnemonics
${cheatSheet.mnemonicsAndMemoryAnchors.map(m => `- **${m.concept}**: \`${m.mnemonic}\` — ${m.explanation}`).join('\n')}

## High-Yield Past Exam Questions
${cheatSheet.highYieldExamQuestions.map(q => `### Q [${q.marks} Marks | ${q.frequency} Frequency]: ${q.question}\n**Model Answer Key**: ${q.answerKey}`).join('\n\n')}

## 60-Second Last Minute Checklist
${cheatSheet.quickRevisionChecklist.map(c => `- [ ] ${c}`).join('\n')}
`;
    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveVault = () => {
    if (!cheatSheet || !onSaveToVault) return;
    const content = JSON.stringify(cheatSheet, null, 2);
    onSaveToVault(`Cheat Sheet: ${cheatSheet.topic}`, content, cheatSheet.subject);
    setSavedToVaultStatus(true);
    setTimeout(() => setSavedToVaultStatus(false), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto print:p-0 print:bg-white">
      <div className="relative w-full max-w-4xl bg-white border border-[#E0DBD0] rounded-3xl shadow-2xl flex flex-col max-h-[92vh] print:max-h-none print:border-0 print:shadow-none print:rounded-none">
        
        {/* MODAL HEADER */}
        <div className="p-5 border-b border-[#E0DBD0] flex items-center justify-between bg-gradient-to-r from-[#F9F7F2] to-white rounded-t-3xl print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-800 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#4A4E4D]">AI 1-Page High-Yield Cheat Sheet</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  Option 6 • Print Ready
                </span>
              </div>
              <p className="text-xs text-[#A5A58D]">
                Distills complete chapters into ultra-dense formula sheets, examiner traps, and mnemonics.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#A5A58D] hover:text-[#4A4E4D] hover:bg-[#F2EFE9] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TOPIC PICKER BAR (Hidden in print) */}
        <div className="p-4 bg-[#F9F7F2] border-b border-[#E0DBD0] flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex flex-wrap items-center gap-2.5">
            <div>
              <select
                value={selectedSubjectName}
                onChange={(e) => {
                  setSelectedSubjectName(e.target.value);
                  const newSub = subjects.find(s => s.name === e.target.value);
                  const firstTop = newSub?.chapters[0]?.topics[0]?.name || '';
                  setSelectedTopicName(firstTop);
                }}
                className="px-3 py-1.5 bg-white border border-[#E0DBD0] rounded-xl text-xs font-semibold text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
              >
                {subjects.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={selectedTopicName}
                onChange={(e) => setSelectedTopicName(e.target.value)}
                className="px-3 py-1.5 bg-white border border-[#E0DBD0] rounded-xl text-xs font-semibold text-[#4A4E4D] focus:outline-none focus:border-[#6B705C] max-w-xs"
              >
                {allTopicsInSubject.map(t => (
                  <option key={t.id} value={t.name}>
                    {t.chapterName ? `${t.chapterName} • ` : ''}{t.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => handleGenerate()}
              disabled={loading || !selectedTopicName}
              className="px-4 py-1.5 bg-[#6B705C] hover:bg-[#5a5f4e] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{loading ? 'Synthesizing...' : 'Generate 1-Page Summary'}</span>
            </button>
          </div>

          {cheatSheet && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePrint}
                className="px-3 py-1.5 bg-white border border-[#E0DBD0] hover:bg-[#F2EFE9] text-[#4A4E4D] rounded-xl text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Print or Save as PDF"
              >
                <Printer className="w-3.5 h-3.5 text-[#6B705C]" />
                <span>Print / PDF</span>
              </button>

              <button
                onClick={handleCopyMarkdown}
                className="px-3 py-1.5 bg-white border border-[#E0DBD0] hover:bg-[#F2EFE9] text-[#4A4E4D] rounded-xl text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Copy Markdown"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#6B705C]" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              {onSaveToVault && (
                <button
                  onClick={handleSaveVault}
                  className="px-3 py-1.5 bg-white border border-[#E0DBD0] hover:bg-[#F2EFE9] text-[#4A4E4D] rounded-xl text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Save to Storage Vaults"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-[#6B705C]" />
                  <span>{savedToVaultStatus ? 'Saved!' : 'Vault'}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* MODAL BODY (SCROLLABLE & PRINT-OPTIMIZED) */}
        <div className="p-6 overflow-y-auto space-y-6 print:p-0 print:overflow-visible">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={() => handleGenerate()}
                className="text-xs font-bold text-rose-700 underline"
              >
                Retry
              </button>
            </div>
          )}

          {loading && (
            <div className="py-20 text-center space-y-3">
              <div className="w-12 h-12 border-3 border-[#6B705C] border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#4A4E4D]">Extracting High-Yield Formulas & Exam Traps</h4>
                <p className="text-xs text-[#A5A58D]">
                  Synthesizing official board past papers, definitions, and model answer keys for "{selectedTopicName}"...
                </p>
              </div>
            </div>
          )}

          {!loading && !cheatSheet && !error && (
            <div className="py-16 text-center space-y-4 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-3xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto border border-amber-200 shadow-xs">
                <FileText className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-bold text-[#4A4E4D]">Ready to Generate Cheat Sheet</h4>
                <p className="text-xs text-[#A5A58D] leading-relaxed">
                  Select any subject and topic above to generate a dense, print-ready 1-page summary covering formulas, common examiner tricks, and high-frequency past paper questions.
                </p>
              </div>
              <button
                onClick={() => handleGenerate()}
                className="px-5 py-2.5 bg-[#6B705C] hover:bg-[#5a5f4e] text-white rounded-full text-xs font-bold shadow-xs transition inline-flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate for "{selectedTopicName || 'Selected Topic'}"</span>
              </button>
            </div>
          )}

          {!loading && cheatSheet && (
            <div id="cheat-sheet-printable" className="space-y-6 print:space-y-4">
              
              {/* DOCUMENT HEADER / MASTHEAD */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-[#2D312E] to-[#1A1C1B] text-white border border-[#2D312E] space-y-2 print:bg-white print:text-black print:border-b-2 print:border-black print:rounded-none print:p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white font-mono text-[10px] font-bold uppercase tracking-wider print:bg-gray-200 print:text-black">
                      {cheatSheet.subject}
                    </span>
                    {cheatSheet.chapter && (
                      <span className="text-xs text-[#D4CFC4] print:text-gray-600">
                        • {cheatSheet.chapter}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-[#A5A58D] print:text-gray-500">
                    High-Yield 1-Page Summary • PrepForge AI
                  </span>
                </div>

                <h1 className="text-xl sm:text-2xl font-serif font-bold text-white print:text-black tracking-tight">
                  {cheatSheet.title}
                </h1>

                <p className="text-xs text-[#EAE7DF] leading-relaxed print:text-gray-700 italic border-t border-white/10 pt-2 print:border-gray-300">
                  {cheatSheet.coreSummary}
                </p>
              </div>

              {/* 2-COLUMN GRID FOR FORMULAS & EXAMINER TRAPS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2 print:gap-3">
                
                {/* 1. KEY FORMULAS & CORE DEFINITIONS */}
                <div className="p-4 rounded-2xl bg-white border border-[#E0DBD0] space-y-3 shadow-2xs print:border-gray-300">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#E0DBD0]">
                    <div className="w-6 h-6 rounded-lg bg-[#6B705C]/15 text-[#6B705C] flex items-center justify-center font-bold text-xs">
                      ∑
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#4A4E4D]">
                      Key Formulas & Core Definitions
                    </h3>
                  </div>

                  <div className="space-y-2.5">
                    {cheatSheet.keyFormulasAndDefinitions.map((item, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#2D312E]">{item.term}</span>
                          {item.unitsOrVariables && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white text-[#6B705C] border border-[#E0DBD0]">
                              {item.unitsOrVariables}
                            </span>
                          )}
                        </div>
                        <div className="font-mono font-bold text-[#4A4E4D] bg-white px-2.5 py-1.5 rounded-lg border border-[#E0DBD0] text-[11px] select-all">
                          {item.formulaOrDef}
                        </div>
                        {item.notes && (
                          <div className="text-[10px] text-[#A5A58D] italic pt-0.5">
                            💡 {item.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. EXAMINER TRAPS & PITFALLS */}
                <div className="p-4 rounded-2xl bg-white border border-rose-200/70 space-y-3 shadow-2xs print:border-gray-300">
                  <div className="flex items-center gap-2 pb-2 border-b border-rose-100">
                    <div className="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs">
                      ⚠️
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-rose-900">
                      Examiner Traps & Common Marks Loss
                    </h3>
                  </div>

                  <div className="space-y-2.5">
                    {cheatSheet.examinerTrapsAndPitfalls.map((trap, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-rose-50/50 border border-rose-200/60 space-y-1.5 text-xs">
                        <div className="font-bold text-rose-950 flex items-start gap-1.5">
                          <span className="text-rose-600 font-bold shrink-0">✕ Trap:</span>
                          <span>{trap.trap}</span>
                        </div>
                        <div className="text-[11px] text-emerald-900 bg-emerald-50/80 p-2 rounded-lg border border-emerald-200/70 font-medium">
                          <span className="font-bold text-emerald-700">✓ Marking Scheme Rule: </span>
                          {trap.correctApproach}
                        </div>
                        <p className="text-[10px] text-[#4A4E4D] italic pl-1">
                          {trap.explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. MNEMONICS & INTUITIVE MEMORY HOOKS */}
              {cheatSheet.mnemonicsAndMemoryAnchors.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-amber-200/60">
                    <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                      🧠
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-950">
                      Intuitive Mnemonics & Memory Anchors
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {cheatSheet.mnemonicsAndMemoryAnchors.map((m, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-white border border-amber-200/80 space-y-1 text-xs shadow-2xs">
                        <div className="font-bold text-[#2D312E]">{m.concept}</div>
                        <div className="font-mono font-bold text-amber-900 text-sm bg-amber-50/80 px-2 py-1 rounded border border-amber-200 inline-block">
                          {m.mnemonic}
                        </div>
                        <p className="text-[11px] text-[#6B705C] pt-1">
                          {m.explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. HIGH-YIELD EXAM QUESTIONS & MODEL ANSWER KEYS */}
              <div className="p-4 rounded-2xl bg-white border border-[#E0DBD0] space-y-3 shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-[#E0DBD0]">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                      🎯
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#4A4E4D]">
                      Recurring Board Exam Questions & Model Answer Hints
                    </h3>
                  </div>
                  <span className="text-[10px] text-[#A5A58D] font-mono">
                    Official Rubric Allocation
                  </span>
                </div>

                <div className="space-y-3">
                  {cheatSheet.highYieldExamQuestions.map((q, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-[#2D312E] leading-snug">
                          <span className="text-[#6B705C] font-mono mr-1">Q{idx + 1}.</span>
                          {q.question}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            q.frequency === 'Very High' 
                              ? 'bg-rose-100 text-rose-800' 
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {q.frequency}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white border border-[#E0DBD0] font-mono font-bold text-[#4A4E4D] text-[10px]">
                            {q.marks} Marks
                          </span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-white border border-[#E0DBD0] text-[11px] text-[#4A4E4D] leading-relaxed">
                        <span className="font-bold text-[#6B705C]">Expected Model Key: </span>
                        {q.answerKey}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. 60-SECOND PRE-EXAM CHECKLIST */}
              <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-emerald-200">
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                    ✓
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                    60-Second Last-Minute Revision Checklist
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {cheatSheet.quickRevisionChecklist.map((check, idx) => (
                    <label key={idx} className="flex items-start gap-2 text-xs text-[#2D312E] p-2 bg-white rounded-xl border border-emerald-100 cursor-pointer hover:bg-emerald-50/40 transition">
                      <input type="checkbox" className="mt-0.5 rounded text-emerald-600 focus:ring-0 cursor-pointer" />
                      <span className="leading-snug">{check}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* FOOTER ACTIONS (Hidden in print) */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 print:hidden">
                <div className="text-xs text-[#A5A58D]">
                  Topic: <strong className="text-[#4A4E4D]">{cheatSheet.topic}</strong> ({cheatSheet.subject})
                </div>

                {onStartSprintForTopic && (
                  <button
                    onClick={() => {
                      onClose();
                      onStartSprintForTopic(cheatSheet.subject, cheatSheet.chapter || '', cheatSheet.topic);
                    }}
                    className="px-4 py-2 bg-[#6B705C] hover:bg-[#5a5f4e] text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Start Zen Sprint on "{cheatSheet.topic}"</span>
                  </button>
                )}
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
};
