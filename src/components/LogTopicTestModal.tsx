import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileCheck, 
  Sparkles, 
  AlertCircle, 
  X, 
  CheckCircle2, 
  Hash, 
  BookOpen, 
  Check, 
  Calculator,
  Brain,
  Layers
} from 'lucide-react';
import { Subject, TestResult, StorageVault } from '../types';
import { findMatchingTopic, calculateScorePercentage, indexSyllabusTopics, IndexedTopic } from '../lib/topicLinker';
import { apiAnalyzeMistakes } from '../lib/aiApi';

interface LogTopicTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  vaults?: StorageVault[];
  initialTopic?: {
    topicNumber?: string;
    topicId?: string;
    topicName?: string;
    chapterName?: string;
    subjectName?: string;
  };
  onSaveTest: (test: Omit<TestResult, 'id'>) => Promise<void> | void;
}

export const LogTopicTestModal: React.FC<LogTopicTestModalProps> = ({
  isOpen,
  onClose,
  subjects,
  vaults = [],
  initialTopic,
  onSaveTest
}) => {
  const [topicNumberQuery, setTopicNumberQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState(subjects[0]?.name || '');
  const [selectedVaultId, setSelectedVaultId] = useState('none');
  const [testName, setTestName] = useState('');
  const [scoreInput, setScoreInput] = useState('');
  const [totalMarksInput, setTotalMarksInput] = useState('100');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [mistakes, setMistakes] = useState('');
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize from initialTopic if provided
  useEffect(() => {
    if (initialTopic) {
      if (initialTopic.topicNumber) setTopicNumberQuery(initialTopic.topicNumber);
      if (initialTopic.subjectName) setSelectedSubject(initialTopic.subjectName);
      if (initialTopic.topicName) {
        setTestName(`${initialTopic.topicName} Quiz`);
      }
    }
  }, [initialTopic]);

  // Live Topic Lookup
  const matchedTopic: IndexedTopic | null = useMemo(() => {
    if (!topicNumberQuery.trim()) return null;
    return findMatchingTopic(topicNumberQuery, subjects, selectedSubject);
  }, [topicNumberQuery, subjects, selectedSubject]);

  // If topic is matched, sync subject if appropriate
  useEffect(() => {
    if (matchedTopic && matchedTopic.subjectName !== selectedSubject) {
      setSelectedSubject(matchedTopic.subjectName);
    }
  }, [matchedTopic]);

  // Live Score Math
  const computedScore = useMemo(() => {
    const totalMarksNum = parseFloat(totalMarksInput) || 100;
    return calculateScorePercentage(scoreInput, totalMarksNum);
  }, [scoreInput, totalMarksInput]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scoreInput.trim()) return;

    setIsSaving(true);
    const finalTestTitle = testName.trim() || (
      matchedTopic ? `${matchedTopic.topicName} Test` : `Topic ${topicNumberQuery || selectedSubject} Test`
    );

    let analysisData = undefined;
    let generatedPrompts: string[] = [];

    if (mistakes.trim()) {
      setIsAnalyzing(true);
      try {
        const res = await apiAnalyzeMistakes({
          testName: finalTestTitle,
          subjectName: selectedSubject,
          score: computedScore.formattedScore,
          mistakes,
          struggledTopics: matchedTopic ? [matchedTopic.topicName] : []
        });
        if (res.success && res.analysis) {
          analysisData = res.analysis;
          if (Array.isArray(res.analysis.tutorPrompts)) {
            generatedPrompts = res.analysis.tutorPrompts;
          }
        }
      } catch (e) {
        console.warn('AI analysis skipped/failed:', e);
      } finally {
        setIsAnalyzing(false);
      }
    }

    if (generatedPrompts.length === 0 && mistakes.trim()) {
      generatedPrompts = [
        `Review foundational concept for ${finalTestTitle}: "${mistakes}"`,
        `Solve 2 target drill problems regarding: "${mistakes}"`
      ];
    }

    const chosenVault = vaults.find(v => v.id === selectedVaultId);

    const newTest: Omit<TestResult, 'id'> = {
      userId: '',
      vaultId: selectedVaultId !== 'none' ? selectedVaultId : undefined,
      vaultName: chosenVault ? chosenVault.name : undefined,
      testName: finalTestTitle,
      testNumber: `Test #${Date.now().toString().slice(-4)}`,
      topicNumber: matchedTopic ? matchedTopic.topicNumber : topicNumberQuery.trim() || undefined,
      topicId: matchedTopic ? matchedTopic.topicId : undefined,
      topicName: matchedTopic ? matchedTopic.topicName : undefined,
      chapterName: matchedTopic ? matchedTopic.chapterName : undefined,
      subjectName: selectedSubject,
      score: computedScore.formattedScore,
      percentage: computedScore.percentage,
      scorePercentage: computedScore.percentage,
      totalMarks: computedScore.totalMarks || parseFloat(totalMarksInput) || 100,
      obtainedMarks: computedScore.obtainedMarks,
      date,
      mistakes: mistakes.trim(),
      struggledTopics: matchedTopic ? [matchedTopic.topicName] : (mistakes ? [mistakes] : []),
      correctionPrompts: generatedPrompts,
      correctionNotes: correctionNotes.trim() || undefined,
      isCorrected: false,
      analysis: analysisData,
      createdAt: new Date().toISOString()
    };

    await onSaveTest(newTest);
    setIsSaving(false);
    onClose();
  };

  const allIndexed = indexSyllabusTopics(subjects);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#4A4E4D]/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-card border border-theme rounded-3xl max-w-xl w-full p-6 shadow-2xl relative text-primary max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1 text-muted hover:text-primary rounded-lg transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-theme">
          <div className="w-10 h-10 rounded-2xl bg-theme-accent/60 border border-theme flex items-center justify-center text-primary">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-primary">Log Topic Test Score</h2>
            <p className="text-xs text-muted">
              Record score, link to syllabus topic number, and track mastery.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Topic Number Auto-Link Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-primary flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-[#6B705C]" />
                <span>Topic Number or Topic Name</span>
              </span>
              <span className="text-[10px] text-muted font-normal">
                e.g. "1.1", "2.3", "Kinematics", "#4"
              </span>
            </label>
            
            <div className="relative">
              <input
                type="text"
                value={topicNumberQuery}
                onChange={(e) => setTopicNumberQuery(e.target.value)}
                placeholder="Type topic number (e.g. 1.1, 2.2) or topic title..."
                className="w-full p-3 bg-theme-accent/30 border border-theme rounded-2xl text-xs text-primary focus:outline-none focus:border-primary pr-20"
              />
              {topicNumberQuery && (
                <button
                  type="button"
                  onClick={() => setTopicNumberQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary text-xs"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Live Matched Topic Badge */}
            {matchedTopic ? (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs animate-fade-in">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-200 text-emerald-800 font-mono font-bold text-[10px]">
                    #{matchedTopic.topicNumber}
                  </span>
                  <div>
                    <span className="font-bold text-emerald-950">{matchedTopic.subjectIcon} {matchedTopic.topicName}</span>
                    <span className="text-[10px] text-emerald-700 block">
                      {matchedTopic.subjectName} • {matchedTopic.chapterName}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800">
                  Topic Linked
                </span>
              </div>
            ) : topicNumberQuery.trim().length > 0 ? (
              <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>No exact topic number match found in syllabus — will log under selected subject.</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] text-muted font-medium mr-1">Quick Select Topic:</span>
                {allIndexed.slice(0, 5).map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTopicNumberQuery(t.topicNumber);
                      setSelectedSubject(t.subjectName);
                      setTestName(`${t.topicName} Test`);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-theme-accent/50 hover:bg-theme-accent text-primary text-[10px] font-mono border border-theme transition cursor-pointer"
                  >
                    #{t.topicNumber} {t.topicName.slice(0, 14)}...
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Test Name & Subject */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-primary block mb-1">Subject</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full p-2.5 bg-theme-accent/30 border border-theme rounded-2xl text-xs text-primary focus:outline-none focus:border-primary"
              >
                {subjects.map(s => (
                  <option key={s.id} value={s.name}>
                    {s.icon || '📚'} {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-primary block mb-1">Test Title</label>
              <input
                type="text"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder={matchedTopic ? `${matchedTopic.topicName} Test` : 'e.g. Chapter 1 Quiz'}
                className="w-full p-2.5 bg-theme-accent/30 border border-theme rounded-2xl text-xs text-primary focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Score & Max Marks */}
          <div className="bg-theme-accent/20 p-3.5 rounded-2xl border border-theme space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-primary block mb-1">
                  Score / Marks Obtained
                </label>
                <input
                  type="text"
                  required
                  value={scoreInput}
                  onChange={(e) => setScoreInput(e.target.value)}
                  placeholder="e.g. 42/50, 85%, or 42"
                  className="w-full p-2.5 bg-card border border-theme rounded-xl text-xs text-primary focus:outline-none focus:border-primary font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-primary block mb-1">
                  Total Marks / Max
                </label>
                <input
                  type="number"
                  value={totalMarksInput}
                  onChange={(e) => setTotalMarksInput(e.target.value)}
                  placeholder="100"
                  className="w-full p-2.5 bg-card border border-theme rounded-xl text-xs text-primary focus:outline-none focus:border-primary font-mono"
                />
              </div>
            </div>

            {/* Calculated Percentage Preview */}
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-muted flex items-center gap-1">
                <Calculator className="w-3.5 h-3.5" />
                <span>Calculated Mastery Percentage:</span>
              </span>
              <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${
                computedScore.percentage >= 80
                  ? 'bg-emerald-100 text-emerald-800'
                  : computedScore.percentage >= 60
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-rose-100 text-rose-800'
              }`}>
                {computedScore.formattedScore}
              </span>
            </div>
          </div>

          {/* Storage Vault Bucket Selection */}
          <div>
            <label className="text-xs font-bold text-primary block mb-1">
              Store in Vault / Study Wallet (Optional)
            </label>
            <select
              value={selectedVaultId}
              onChange={(e) => setSelectedVaultId(e.target.value)}
              className="w-full p-2.5 bg-theme-accent/30 border border-theme rounded-2xl text-xs text-primary focus:outline-none focus:border-primary"
            >
              <option value="none">General Test Records</option>
              {vaults.map(v => (
                <option key={v.id} value={v.id}>
                  {v.icon || '📦'} {v.name} ({v.subjectName})
                </option>
              ))}
            </select>
          </div>

          {/* Date & Mistakes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-primary block mb-1">Date Taken</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2.5 bg-theme-accent/30 border border-theme rounded-2xl text-xs text-primary focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-primary block mb-1">
                Specific Mistakes / Struggled Questions
              </label>
              <input
                type="text"
                value={mistakes}
                onChange={(e) => setMistakes(e.target.value)}
                placeholder="e.g. Formula derivation, minus sign error"
                className="w-full p-2.5 bg-theme-accent/30 border border-theme rounded-2xl text-xs text-primary focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Reflection / Correction Notes */}
          <div>
            <label className="text-xs font-bold text-primary block mb-1">
              Correction Notes & Key Learnings (Optional)
            </label>
            <textarea
              value={correctionNotes}
              onChange={(e) => setCorrectionNotes(e.target.value)}
              placeholder="What step will prevent this mistake next time?"
              rows={2}
              className="w-full p-2.5 bg-theme-accent/30 border border-theme rounded-2xl text-xs text-primary focus:outline-none focus:border-primary"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-theme">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-primary transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !scoreInput.trim()}
              className="px-6 py-2.5 bg-[#6B705C] hover:bg-[#5a5f4e] disabled:opacity-50 text-white font-bold text-xs rounded-full shadow-xs transition flex items-center gap-2 cursor-pointer"
            >
              {isSaving ? (
                <span>Saving Test Score...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Test Score</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
