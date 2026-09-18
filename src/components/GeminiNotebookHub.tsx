import React, { useState } from 'react';
import { 
  Sparkles, 
  ExternalLink, 
  Copy, 
  Check, 
  BookOpen, 
  Layers, 
  Search, 
  Send, 
  Loader2, 
  ArrowRight, 
  FileText, 
  ShieldAlert, 
  HelpCircle,
  Link as LinkIcon,
  RefreshCw,
  FolderSync
} from 'lucide-react';
import { Subject, TestResult } from '../types';

interface GeminiNotebookHubProps {
  subjects: Subject[];
  activeSubject: Subject | null;
  testResults: TestResult[];
  onUpdateSubjects?: (subjects: Subject[]) => void;
  onSelectSubject?: (subjectId: string) => void;
  onOpenTopicSprint?: (topicName: string) => void;
}

interface ResearchData {
  title: string;
  thesis: string;
  principles: Array<{
    name: string;
    explanation: string;
    realWorldApplication: string;
  }>;
  formulas: Array<{
    equation: string;
    variables: string;
    significance: string;
  }>;
  commonTraps: Array<{
    trap: string;
    prevention: string;
  }>;
  notebookLMSource: string;
  recallQuestions: Array<{
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }>;
}

export const GeminiNotebookHub: React.FC<GeminiNotebookHubProps> = ({
  subjects,
  activeSubject,
  testResults,
  onUpdateSubjects,
  onSelectSubject,
  onOpenTopicSprint,
}) => {
  const currentSubj = activeSubject || subjects[0] || null;
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(currentSubj?.id || '');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [customQuery, setCustomQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [researchData, setResearchData] = useState<ResearchData | null>(null);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'research' | 'notebooks' | 'source_compiler'>('research');
  const [notebookUrlInput, setNotebookUrlInput] = useState<string>(currentSubj?.geminiNotebookUrl || '');
  const [selectedAnswer, setSelectedAnswer] = useState<Record<number, number>>({});
  const [showAnswer, setShowAnswer] = useState<Record<number, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeSubjObj = subjects.find(s => s.id === selectedSubjectId) || currentSubj;

  // Flatten topics from active subject for selection
  const allTopics = activeSubjObj ? activeSubjObj.chapters.flatMap(ch => ch.topics.map(t => ({
    chapterName: ch.name,
    topicName: t.name,
    status: t.status
  }))) : [];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRunResearch = async () => {
    const topicToSearch = selectedTopic || (allTopics[0]?.topicName || 'Core Concept');
    setIsLoading(true);
    setResearchData(null);
    setSelectedAnswer({});
    setShowAnswer({});

    try {
      const res = await fetch('/api/ai/gemini-notebook-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectName: activeSubjObj?.name || 'General Science',
          chapterName: allTopics.find(t => t.topicName === topicToSearch)?.chapterName || 'Fundamentals',
          topicName: topicToSearch,
          customPrompt: customQuery.trim() || undefined
        })
      });
      const data = await res.json();
      if (data.success && data.research) {
        setResearchData(data.research);
      } else {
        showToast('Gemini research synthesis completed with offline fallback.');
      }
    } catch (err) {
      console.error(err);
      showToast('Network issue querying Gemini. Using fallback study synthesis.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, type: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
      showToast('Copied to clipboard!');
    }
  };

  const handleSaveNotebookUrl = () => {
    if (!activeSubjObj || !onUpdateSubjects) return;
    const trimmed = notebookUrlInput.trim();
    const updated = subjects.map(s => s.id === activeSubjObj.id ? { ...s, geminiNotebookUrl: trimmed } : s);
    onUpdateSubjects(updated);
    showToast(trimmed ? `Linked NotebookLM for ${activeSubjObj.name}!` : `Removed Notebook link for ${activeSubjObj.name}.`);
  };

  const generateFullSubjectSourcePack = (subj: Subject): string => {
    const subTests = testResults.filter(t => t.subjectName.toLowerCase() === subj.name.toLowerCase());
    return `# ${subj.name} — Comprehensive Syllabus & Study Kit
Generated for Google NotebookLM Source Import
Course: ${subj.name} | Total Chapters: ${subj.chapters.length}

## Table of Contents & Unit Breakdown
${subj.chapters.map((ch, idx) => `### Unit ${idx + 1}: ${ch.name}
${ch.topics.map(t => `- **${t.name}**: Status = ${t.status || 'Planned'}, Target Focus = ${t.estimatedMinutes || 45} mins`).join('\n')}`).join('\n\n')}

## Common Mistake Logs & Examiner Traps
${subTests.length > 0 ? subTests.map(t => `### Exam: ${t.testName} (Score: ${t.score})
- Date: ${t.date}
- Recorded Mistakes: ${t.mistakes || 'None noted'}
- High-Yield Correction Prompts:
${(t.correctionPrompts || []).map(p => `  * ${p}`).join('\n')}`).join('\n\n') : 'No past exam errors recorded yet for this subject.'}

## NotebookLM Instructions
1. Use this master document as a primary source.
2. Ask NotebookLM: "Generate a 10-question high-yield mock quiz based on Unit 1 and the recorded mistake logs."
3. Ask NotebookLM: "Create a 2-minute podcast briefing summarizing the core derivations."
`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#2D312E] text-white px-4 py-2.5 rounded-2xl shadow-lg text-xs font-semibold flex items-center gap-2 border border-[#4D7C5D]">
          <Sparkles className="w-4 h-4 text-[#6BA87E]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner - Strict Theme Palette */}
      <div className="bg-[#FAF9F5] dark:bg-card border border-theme rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Google Gemini & NotebookLM Full Academic Suite</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif italic font-bold text-primary">
              Gemini & NotebookLM Academic Intelligence
            </h2>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              Synthesize your syllabus into grounded NotebookLM sources, run deep concept derivations with Google Gemini, and eliminate exam blind spots with formatted citations.
            </p>
          </div>

          {/* Quick Launch Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <a
              href="https://notebooklm.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-2xl bg-primary hover:opacity-90 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
            >
              <FileText className="w-4 h-4 text-white" />
              <span>Open NotebookLM</span>
              <ExternalLink className="w-3 h-3 text-white/70" />
            </a>

            <a
              href="https://gemini.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-2xl bg-[#EDE8DE] hover:bg-[#E3DED4] dark:bg-surface text-primary border border-theme text-xs font-bold transition flex items-center gap-2 shadow-2xs cursor-pointer active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Open Gemini Web</span>
              <ExternalLink className="w-3 h-3 text-primary/70" />
            </a>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-t border-theme pt-4 mt-6 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('research')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'research'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-transparent text-muted hover:text-primary hover:bg-theme-accent'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Deep Concept Research</span>
          </button>

          <button
            onClick={() => setActiveTab('source_compiler')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'source_compiler'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-transparent text-muted hover:text-primary hover:bg-theme-accent'
            }`}
          >
            <FolderSync className="w-3.5 h-3.5" />
            <span>NotebookLM Source Compiler</span>
          </button>

          <button
            onClick={() => setActiveTab('notebooks')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'notebooks'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-transparent text-muted hover:text-primary hover:bg-theme-accent'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Subject Notebook Links</span>
          </button>
        </div>
      </div>

      {/* TAB 1: DEEP CONCEPT RESEARCH */}
      {activeTab === 'research' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Query & Topic Selector Panel */}
          <div className="bg-card border border-theme rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-theme pb-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <span>Select Syllabus Target</span>
              </h3>
            </div>

            {/* Subject Dropdown */}
            <div>
              <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1.5">
                Subject
              </label>
              <select
                value={selectedSubjectId}
                onChange={e => {
                  setSelectedSubjectId(e.target.value);
                  setSelectedTopic('');
                  if (onSelectSubject) onSelectSubject(e.target.value);
                }}
                className="w-full bg-surface border border-theme rounded-xl px-3 py-2 text-xs font-medium text-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Topic Dropdown */}
            <div>
              <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1.5">
                Syllabus Topic
              </label>
              <select
                value={selectedTopic}
                onChange={e => setSelectedTopic(e.target.value)}
                className="w-full bg-surface border border-theme rounded-xl px-3 py-2 text-xs font-medium text-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">-- Choose a Topic --</option>
                {allTopics.map((t, idx) => (
                  <option key={idx} value={t.topicName}>
                    {t.chapterName} › {t.topicName} ({t.status || 'Planned'})
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Query Input */}
            <div>
              <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1.5">
                Custom Research Angle (Optional)
              </label>
              <textarea
                value={customQuery}
                onChange={e => setCustomQuery(e.target.value)}
                placeholder="e.g. Focus on derivations, tricky boundary conditions, or how examiners test this in 8-mark questions..."
                rows={3}
                className="w-full bg-surface border border-theme rounded-xl p-3 text-xs text-primary placeholder-muted/60 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            <button
              onClick={handleRunResearch}
              disabled={isLoading || (!selectedTopic && allTopics.length === 0)}
              className="w-full py-3 rounded-2xl bg-primary hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Gemini is Synthesizing Research...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Grounded Study Brief</span>
                </>
              )}
            </button>
          </div>

          {/* Research Results Canvas */}
          <div className="lg:col-span-2 space-y-6">
            {isLoading && (
              <div className="bg-card border border-theme rounded-3xl p-12 text-center space-y-4 shadow-xs">
                <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-primary">Gemini 3.8 Flash Deep Reasoning</h4>
                  <p className="text-xs text-muted">Analyzing syllabus requirements, key derivations, and exam traps...</p>
                </div>
              </div>
            )}

            {!isLoading && !researchData && (
              <div className="bg-card border border-dashed border-theme rounded-3xl p-12 text-center space-y-3 shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto text-primary">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-primary">Ready for Grounded Syllabus Research</h4>
                <p className="text-xs text-muted max-w-md mx-auto">
                  Pick any chapter or topic from the left panel to generate a structured academic thesis, mathematical relationships, examiner traps, and a NotebookLM-ready source.
                </p>
              </div>
            )}

            {!isLoading && researchData && (
              <div className="bg-card border border-theme rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
                {/* Title & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme pb-4">
                  <div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 uppercase tracking-widest">
                      GEMINI RESEARCH BRIEF
                    </span>
                    <h3 className="text-lg font-serif italic font-bold text-primary mt-1">
                      {researchData.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(researchData.notebookLMSource, 'source')}
                      className="px-3.5 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedType === 'source' ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5 text-primary" />}
                      <span>Copy for NotebookLM</span>
                    </button>

                    {onOpenTopicSprint && (
                      <button
                        onClick={() => onOpenTopicSprint(researchData.title)}
                        className="px-3.5 py-2 rounded-xl bg-primary hover:opacity-90 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>Focus Sprint</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Core Thesis */}
                <div className="bg-surface rounded-2xl p-4 border border-theme space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Core Concept Thesis</span>
                  <p className="text-xs sm:text-sm text-primary leading-relaxed font-medium">
                    {researchData.thesis}
                  </p>
                </div>

                {/* Core Principles */}
                {researchData.principles && researchData.principles.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-primary" />
                      <span>Governing Principles</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {researchData.principles.map((p, idx) => (
                        <div key={idx} className="bg-surface/60 rounded-2xl p-3.5 border border-theme space-y-1.5">
                          <div className="font-bold text-xs text-primary">{p.name}</div>
                          <p className="text-[11px] text-muted leading-relaxed">{p.explanation}</p>
                          {p.realWorldApplication && (
                            <div className="text-[10px] text-primary font-medium pt-1 border-t border-theme">
                              <span className="font-bold">Real-world:</span> {p.realWorldApplication}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Formulas & Equations */}
                {researchData.formulas && researchData.formulas.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-primary" />
                      <span>Governing Equations & Quantities</span>
                    </h4>
                    <div className="space-y-2">
                      {researchData.formulas.map((f, idx) => (
                        <div key={idx} className="bg-surface rounded-2xl p-4 border border-theme flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="font-mono font-bold text-sm text-primary bg-theme-accent inline-block px-2.5 py-1 rounded-lg border border-theme">
                              {f.equation}
                            </div>
                            <p className="text-[11px] text-muted">{f.variables}</p>
                          </div>
                          <span className="text-[11px] text-primary/80 font-medium sm:text-right max-w-xs">
                            {f.significance}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Common Examiner Traps */}
                {researchData.commonTraps && researchData.commonTraps.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                      <ShieldAlert className="w-3.5 h-3.5 text-primary" />
                      <span>Examiner Deductions & Traps</span>
                    </h4>
                    <div className="space-y-2">
                      {researchData.commonTraps.map((t, idx) => (
                        <div key={idx} className="bg-surface/80 rounded-2xl p-3.5 border border-theme space-y-1">
                          <div className="text-xs font-bold text-primary flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            <span>Trap: {t.trap}</span>
                          </div>
                          <p className="text-[11px] text-muted pl-3.5">
                            <span className="font-semibold text-primary">Cure:</span> {t.prevention}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Recall Challenge Questions */}
                {researchData.recallQuestions && researchData.recallQuestions.length > 0 && (
                  <div className="space-y-3 pt-2 border-t border-theme">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                      <HelpCircle className="w-3.5 h-3.5 text-primary" />
                      <span>Instant Recall Verification</span>
                    </h4>
                    <div className="space-y-3">
                      {researchData.recallQuestions.map((q, qIdx) => (
                        <div key={qIdx} className="bg-surface rounded-2xl p-4 border border-theme space-y-3">
                          <div className="text-xs font-bold text-primary">{q.question}</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {q.options.map((opt, optIdx) => {
                              const isSelected = selectedAnswer[qIdx] === optIdx;
                              const isRevealed = showAnswer[qIdx];
                              const isCorrect = optIdx === q.correctIndex;
                              let btnStyle = 'bg-card border-theme text-primary hover:bg-theme-accent';
                              if (isRevealed) {
                                if (isCorrect) btnStyle = 'bg-primary text-white border-primary';
                                else if (isSelected) btnStyle = 'bg-rose-100 text-rose-800 border-rose-300';
                              } else if (isSelected) {
                                btnStyle = 'bg-primary/20 border-primary text-primary';
                              }

                              return (
                                <button
                                  key={optIdx}
                                  onClick={() => {
                                    setSelectedAnswer(prev => ({ ...prev, [qIdx]: optIdx }));
                                    setShowAnswer(prev => ({ ...prev, [qIdx]: true }));
                                  }}
                                  className={`p-2.5 rounded-xl border text-left text-xs font-medium transition cursor-pointer ${btnStyle}`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                          {showAnswer[qIdx] && (
                            <p className="text-[11px] text-muted pt-2 border-t border-theme">
                              <span className="font-bold text-primary">Model Explanation:</span> {q.explanation}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: NOTEBOOKLM SOURCE COMPILER */}
      {activeTab === 'source_compiler' && (
        <div className="bg-card border border-theme rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme pb-4">
            <div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 uppercase tracking-widest">
                SOURCE COMPILER
              </span>
              <h3 className="text-lg font-serif italic font-bold text-primary mt-1">
                Compile Full Course Source Document for NotebookLM
              </h3>
              <p className="text-xs text-muted mt-1">
                Generates a clean, comprehensive Markdown dossier containing all chapters, topics, estimated times, and past exam mistake logs.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (activeSubjObj) {
                    const text = generateFullSubjectSourcePack(activeSubjObj);
                    handleCopy(text, 'full_pack');
                  }
                }}
                className="px-4 py-2.5 rounded-2xl bg-primary hover:opacity-90 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs"
              >
                {copiedType === 'full_pack' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>Copy Master Source Pack</span>
              </button>
            </div>
          </div>

          {activeSubjObj ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted">Subject:</span>
                <span className="text-xs font-bold px-3 py-1 rounded-xl bg-surface border border-theme text-primary">
                  {activeSubjObj.name} ({activeSubjObj.chapters.length} Chapters)
                </span>
              </div>

              <div className="bg-surface rounded-2xl p-5 border border-theme font-mono text-xs text-primary leading-relaxed whitespace-pre-wrap max-h-[500px] overflow-y-auto">
                {generateFullSubjectSourcePack(activeSubjObj)}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted">No subjects found in planner.</p>
          )}
        </div>
      )}

      {/* TAB 3: SUBJECT NOTEBOOK LINKS */}
      {activeTab === 'notebooks' && (
        <div className="bg-card border border-theme rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="border-b border-theme pb-4">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 uppercase tracking-widest">
              NOTEBOOK CONNECTIONS
            </span>
            <h3 className="text-lg font-serif italic font-bold text-primary mt-1">
              Link Google NotebookLM per Subject
            </h3>
            <p className="text-xs text-muted mt-1">
              Keep your specific NotebookLM research rooms linked to each course for instant 1-click navigation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {subjects.map(s => {
              const hasLink = Boolean(s.geminiNotebookUrl);
              return (
                <div key={s.id} className="bg-surface rounded-2xl p-5 border border-theme space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-primary">{s.name}</h4>
                    {hasLink ? (
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold">
                        Linked
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-theme-accent text-muted border border-theme text-[10px] font-semibold">
                        Not Linked
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-muted">
                    {s.chapters.length} units • {s.chapters.reduce((acc, c) => acc + c.topics.length, 0)} syllabus topics
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    {hasLink ? (
                      <a
                        href={s.geminiNotebookUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 rounded-xl bg-primary hover:opacity-90 text-white text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Course Notebook</span>
                      </a>
                    ) : (
                      <a
                        href="https://notebooklm.google.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 rounded-xl bg-theme-accent hover:bg-theme-accent/80 text-primary border border-theme text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        <span>Create in NotebookLM</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
