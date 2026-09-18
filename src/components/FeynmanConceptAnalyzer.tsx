import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Lightbulb, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  ArrowRight, 
  RefreshCw, 
  BookOpen, 
  Zap, 
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  Award,
  Layers
} from 'lucide-react';
import { Subject, UserProfile } from '../types';
import { apiEvaluateFeynmanExplanation } from '../lib/aiApi';

interface FeynmanAnalysisResult {
  conceptName: string;
  subjectName?: string;
  feynmanScore: number;
  verdict: string;
  summary: string;
  clarityPillars: {
    simplicity: number;
    accuracy: number;
    analogy: number;
  };
  jargonIdentified: Array<{
    term: string;
    suggestedSimpleAlternative: string;
    explanation: string;
  }>;
  missingPrinciples: string[];
  recommendedAnalogy: string;
  refinedExplanation: string;
  evaluatedAt: string;
}

interface FeynmanConceptAnalyzerProps {
  subjects: Subject[];
  userProfile?: UserProfile | null;
  onLogActivity?: (log: any) => void;
  onStartTimerForTopic?: (subjectName: string, chapterName: string, topicName: string) => void;
  onOpenBlurtForTopic?: (subjectName: string, chapterName: string, topicName: string) => void;
}

export const FeynmanConceptAnalyzer: React.FC<FeynmanConceptAnalyzerProps> = ({
  subjects,
  userProfile,
  onLogActivity,
  onStartTimerForTopic,
  onOpenBlurtForTopic
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [conceptName, setConceptName] = useState<string>('');
  const [explanation, setExplanation] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<FeynmanAnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLogged, setIsLogged] = useState<boolean>(false);

  // Quick concept suggestions gathered from active syllabus
  const sampleSuggestions: { subject: string; concept: string }[] = [];
  subjects.forEach(sub => {
    sub.chapters.forEach(ch => {
      ch.topics.slice(0, 2).forEach(t => {
        if (sampleSuggestions.length < 6) {
          sampleSuggestions.push({ subject: sub.name, concept: t.name });
        }
      });
    });
  });

  const handleSelectSuggestion = (subName: string, conc: string) => {
    setSelectedSubject(subName);
    setConceptName(conc);
    setErrorMessage(null);
    setIsExpanded(true);
  };

  const handleAnalyze = async () => {
    if (!conceptName.trim()) {
      setErrorMessage('Please specify the concept you want to explain.');
      return;
    }
    if (!explanation.trim() || explanation.trim().split(/\s+/).length < 6) {
      setErrorMessage('Please provide a brief explanation (at least 6 words) in simple terms.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);
    setIsLogged(false);

    try {
      const response = await apiEvaluateFeynmanExplanation({
        conceptName: conceptName.trim(),
        explanation: explanation.trim(),
        subjectName: selectedSubject || 'General',
        targetAudience: 'a 12-year-old beginner with no prior background'
      });

      if (response && response.analysis) {
        setAnalysisResult(response.analysis);

        // Auto log to activity logs if callback provided
        if (onLogActivity) {
          const logPayload = {
            action: 'Feynman Concept Check',
            subjectName: selectedSubject || 'General',
            topicName: conceptName.trim(),
            scorePercentage: response.analysis.feynmanScore,
            durationMinutes: 5,
            date: new Date().toISOString().split('T')[0],
            details: `Feynman technique check: "${conceptName}" scored ${response.analysis.feynmanScore}% (${response.analysis.verdict}).`
          };
          onLogActivity(logPayload);
          setIsLogged(true);
        }
      }
    } catch (err: any) {
      console.error('Feynman evaluation error:', err);
      setErrorMessage(err?.message || 'Failed to complete Feynman concept analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setAnalysisResult(null);
    setExplanation('');
    setErrorMessage(null);
    setIsLogged(false);
  };

  const wordCount = explanation.trim() ? explanation.trim().split(/\s+/).length : 0;

  return (
    <div className="bg-gradient-to-br from-[#FAF9F5] via-white to-[#F6F4EE] border border-[#E0DBD0] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E0DBD0] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-800 flex items-center justify-center font-bold shrink-0 shadow-2xs">
            <Lightbulb className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                Cognitive Mastery
              </span>
              <h3 className="text-sm sm:text-base font-bold text-[#4A4E4D]">
                Feynman Concept Analyzer
              </h3>
            </div>
            <p className="text-xs text-[#6B705C] mt-0.5">
              Test true understanding: Explain any syllabus concept in simple words. Gemini identifies jargon, checks clarity, and tests conceptual depth.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3.5 py-1.5 rounded-full bg-white hover:bg-[#F2EFE9] border border-[#E0DBD0] text-[#6B705C] text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
          >
            <span>{isExpanded ? 'Minimize' : 'Instant Concept Check'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Quick Suggestion Chips (Visible even when collapsed) */}
      {!isExpanded && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] font-mono text-[#A5A58D] font-bold">Quick test topics:</span>
          {sampleSuggestions.map((sugg, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectSuggestion(sugg.subject, sugg.concept)}
              className="px-2.5 py-1 rounded-full bg-white border border-[#E0DBD0] hover:border-[#6B705C] text-xs text-[#4A4E4D] hover:text-[#6B705C] transition flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <Sparkles className="w-2.5 h-2.5 text-amber-500" />
              <span>{sugg.concept}</span>
              <span className="text-[9px] text-[#A5A58D]">({sugg.subject})</span>
            </button>
          ))}
          {sampleSuggestions.length === 0 && (
            <button
              onClick={() => setIsExpanded(true)}
              className="text-xs text-[#6B705C] font-semibold hover:underline cursor-pointer"
            >
              + Click here to enter any concept
            </button>
          )}
        </div>
      )}

      {/* Expanded Analyzer Form & Results */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-4 pt-1"
          >
            {!analysisResult ? (
              /* Input Form */
              <div className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Subject Selector (Optional) */}
                  <div className="sm:col-span-1">
                    <label className="block text-[11px] font-mono font-bold text-[#6B705C] uppercase tracking-wider mb-1">
                      Subject (Optional)
                    </label>
                    <select
                      value={selectedSubject}
                      onChange={(e) => setSelectedSubject(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-[#E0DBD0] bg-white text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
                    >
                      <option value="">General Academic</option>
                      {subjects.map(s => (
                        <option key={s.id} value={s.name}>{s.icon || '📚'} {s.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Concept / Topic Input */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-mono font-bold text-[#6B705C] uppercase tracking-wider mb-1">
                      Target Concept or Mechanism <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={conceptName}
                      onChange={(e) => setConceptName(e.target.value)}
                      placeholder="e.g. Newton's 3rd Law, Photosynthesis, Electric Flux, Recursion..."
                      className="w-full text-xs p-2.5 rounded-xl border border-[#E0DBD0] bg-white text-[#4A4E4D] placeholder:text-[#A5A58D] focus:outline-none focus:border-[#6B705C]"
                    />
                  </div>
                </div>

                {/* Explanation Textarea */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-mono font-bold text-[#6B705C] uppercase tracking-wider">
                      Explain Simply (As if teaching a 12-year-old) <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] font-mono text-[#A5A58D]">
                      {wordCount} words
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    placeholder="Imagine teaching a middle schooler. Avoid dense textbook formulas and jargon. Describe what actually happens, why it happens, and what it looks like in real life..."
                    className="w-full text-xs p-3 rounded-2xl border border-[#E0DBD0] bg-white text-[#4A4E4D] placeholder:text-[#A5A58D] focus:outline-none focus:border-[#6B705C] leading-relaxed resize-y"
                  />
                </div>

                {errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div className="text-[11px] text-[#A5A58D] italic flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>"If you cannot explain it simply, you do not understand it well enough." — Feynman</span>
                  </div>

                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || !conceptName.trim() || !explanation.trim()}
                    className="px-5 py-2.5 rounded-full bg-[#6B705C] hover:bg-[#5A5E4E] disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Evaluating Explanation...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Run Concept Check</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* Analysis Result Display */
              <div className="space-y-4">
                {/* Score & Verdict Banner */}
                <div className="p-4 rounded-2xl bg-white border border-[#E0DBD0] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
                  <div className="flex items-center gap-3.5">
                    <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-mono font-bold shrink-0 border ${
                      analysisResult.feynmanScore >= 80
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : analysisResult.feynmanScore >= 60
                        ? 'bg-amber-50 text-amber-900 border-amber-300'
                        : 'bg-rose-50 text-rose-900 border-rose-300'
                    }`}>
                      <span className="text-xl font-bold">{analysisResult.feynmanScore}%</span>
                      <span className="text-[9px] uppercase tracking-wider font-sans opacity-75">Feynman</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-[#4A4E4D]">
                          {analysisResult.conceptName}
                        </h4>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          analysisResult.feynmanScore >= 80
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : analysisResult.feynmanScore >= 60
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-rose-100 text-rose-900 border-rose-300'
                        }`}>
                          {analysisResult.verdict}
                        </span>
                      </div>
                      <p className="text-xs text-[#6B705C] mt-1 leading-relaxed">
                        {analysisResult.summary}
                      </p>
                    </div>
                  </div>

                  {/* Clarity Pillars */}
                  {analysisResult.clarityPillars && (
                    <div className="flex items-center gap-2 sm:border-l sm:border-[#E0DBD0] sm:pl-4 shrink-0">
                      <div className="text-center p-2 rounded-xl bg-[#F9F7F2] border border-[#E0DBD0] min-w-[65px]">
                        <div className="text-[9px] font-mono text-[#A5A58D] uppercase font-bold">Simplicity</div>
                        <div className="text-xs font-mono font-bold text-[#4A4E4D]">
                          {analysisResult.clarityPillars.simplicity}%
                        </div>
                      </div>
                      <div className="text-center p-2 rounded-xl bg-[#F9F7F2] border border-[#E0DBD0] min-w-[65px]">
                        <div className="text-[9px] font-mono text-[#A5A58D] uppercase font-bold">Accuracy</div>
                        <div className="text-xs font-mono font-bold text-[#4A4E4D]">
                          {analysisResult.clarityPillars.accuracy}%
                        </div>
                      </div>
                      <div className="text-center p-2 rounded-xl bg-[#F9F7F2] border border-[#E0DBD0] min-w-[65px]">
                        <div className="text-[9px] font-mono text-[#A5A58D] uppercase font-bold">Analogy</div>
                        <div className="text-xs font-mono font-bold text-[#4A4E4D]">
                          {analysisResult.clarityPillars.analogy}%
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2-Column Findings: Jargon Detected & Missing Principles */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Jargon Identified */}
                  <div className="p-3.5 rounded-2xl bg-white border border-[#E0DBD0] space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#6B705C] font-mono uppercase tracking-wider">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Jargon / Dense Phrasing Identified</span>
                    </div>

                    {analysisResult.jargonIdentified && analysisResult.jargonIdentified.length > 0 ? (
                      <div className="space-y-2">
                        {analysisResult.jargonIdentified.map((j, jIdx) => (
                          <div key={jIdx} className="p-2.5 rounded-xl bg-[#F9F7F2] border border-[#E0DBD0] text-xs space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded font-mono text-[10px]">
                                "{j.term}"
                              </span>
                              <span className="text-[10px] text-[#A5A58D]">Substitute with:</span>
                            </div>
                            <div className="text-[#4A4E4D] font-medium text-[11px]">
                              👉 {j.suggestedSimpleAlternative}
                            </div>
                            <div className="text-[#A5A58D] text-[10px] italic">
                              {j.explanation}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#6B705C] italic p-2 bg-emerald-50 rounded-xl border border-emerald-200">
                        ✨ Fantastic! No unexplained jargon detected. Your vocabulary was plain and accessible.
                      </p>
                    )}
                  </div>

                  {/* Missing Principles & Refinement */}
                  <div className="p-3.5 rounded-2xl bg-white border border-[#E0DBD0] space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#6B705C] font-mono uppercase tracking-wider">
                      <HelpCircle className="w-3.5 h-3.5 text-[#6B705C]" />
                      <span>Key Principles to Include</span>
                    </div>

                    {analysisResult.missingPrinciples && analysisResult.missingPrinciples.length > 0 ? (
                      <ul className="space-y-1.5 text-xs text-[#4A4E4D]">
                        {analysisResult.missingPrinciples.map((mp, pIdx) => (
                          <li key={pIdx} className="flex items-start gap-2 p-2 rounded-xl bg-[#F9F7F2] border border-[#E0DBD0] text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                            <span>{mp}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-[#6B705C] italic p-2 bg-emerald-50 rounded-xl border border-emerald-200">
                        ✅ All primary mechanisms and core scientific principles were addressed!
                      </p>
                    )}
                  </div>
                </div>

                {/* Recommended Analogy & Refined Model Explanation */}
                <div className="p-4 rounded-2xl bg-[#F2EFE9] border border-[#E0DBD0] space-y-3 text-xs">
                  {analysisResult.recommendedAnalogy && (
                    <div className="space-y-1">
                      <span className="font-mono font-bold text-[#6B705C] uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                        <span>Recommended Real-World Analogy:</span>
                      </span>
                      <p className="text-[#4A4E4D] italic pl-2 border-l-2 border-amber-500 leading-relaxed font-medium">
                        "{analysisResult.recommendedAnalogy}"
                      </p>
                    </div>
                  )}

                  {analysisResult.refinedExplanation && (
                    <div className="space-y-1 pt-1 border-t border-[#E0DBD0]">
                      <span className="font-mono font-bold text-[#6B705C] uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#6B705C]" />
                        <span>Model Plain-Language Explanation:</span>
                      </span>
                      <p className="text-[#4A4E4D] leading-relaxed">
                        {analysisResult.refinedExplanation}
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleReset}
                      className="px-3 py-1.5 rounded-full bg-white hover:bg-[#F2EFE9] border border-[#E0DBD0] text-[#6B705C] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Test Another Concept</span>
                    </button>
                    {isLogged && (
                      <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Saved to Performance Logs</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {onStartTimerForTopic && (
                      <button
                        onClick={() => onStartTimerForTopic(selectedSubject || 'General', 'Concept Review', analysisResult.conceptName)}
                        className="px-3 py-1.5 rounded-full bg-[#6B705C] hover:bg-[#5A5E4E] text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                        title="Start timer to study this concept deeper"
                      >
                        <Zap className="w-3 h-3" />
                        <span>Study Timer</span>
                      </button>
                    )}
                    {onOpenBlurtForTopic && (
                      <button
                        onClick={() => onOpenBlurtForTopic(selectedSubject || 'General', 'Concept Review', analysisResult.conceptName)}
                        className="px-3 py-1.5 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                        title="Open in Blurt Recall Arena"
                      >
                        <BookOpen className="w-3 h-3" />
                        <span>Blurt Recall</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
