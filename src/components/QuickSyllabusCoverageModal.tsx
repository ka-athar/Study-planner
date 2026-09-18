import React, { useState, useMemo } from 'react';
import { 
  Subject, 
  TopicStatus, 
  ActiveTab, 
  TestResult 
} from '../types';
import { 
  X, 
  CheckCircle2, 
  Award, 
  TrendingUp, 
  Target, 
  Search, 
  Sparkles, 
  Clock, 
  ArrowRight, 
  BookOpen, 
  RotateCcw, 
  FileText, 
  Calendar,
  Layers,
  ChevronRight
} from 'lucide-react';
import { motion } from 'motion/react';

interface QuickSyllabusCoverageModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  onUpdateTopicStatus?: (subjectName: string, topicName: string, status: TopicStatus) => Promise<void> | void;
  onStartTimerForTopic: (subjectName: string, chapterName: string, topicName: string) => void;
  setActiveTab: (tab: ActiveTab) => void;
  onAddTestResult?: (test: Omit<TestResult, 'id'>) => Promise<void> | void;
}

export const QuickSyllabusCoverageModal: React.FC<QuickSyllabusCoverageModalProps> = ({
  isOpen,
  onClose,
  subjects,
  onUpdateTopicStatus,
  onStartTimerForTopic,
  setActiveTab,
  onAddTestResult,
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'uncompleted' | 'all'>('uncompleted');
  const [activePathwayTab, setActivePathwayTab] = useState<'topics' | 'pathways' | 'quick_test'>('topics');

  // Quick Test Form State
  const [testSubject, setTestSubject] = useState<string>(subjects[0]?.name || '');
  const [testTopicName, setTestTopicName] = useState<string>('');
  const [testScoreEarned, setTestScoreEarned] = useState<string>('85');
  const [testScoreTotal, setTestScoreTotal] = useState<string>('100');
  const [isSubmittingTest, setIsSubmittingTest] = useState<boolean>(false);
  const [testSuccessMessage, setTestSuccessMessage] = useState<string | null>(null);

  // Calculate Overall Syllabus Stats
  const { totalTopics, completedCount, masteredCount, coveredCount, coveragePercent } = useMemo(() => {
    let tot = 0;
    let comp = 0;
    let mast = 0;

    subjects.forEach(sub => {
      sub.chapters.forEach(ch => {
        ch.topics.forEach(t => {
          tot++;
          if (t.status === 'Mastered') {
            mast++;
            comp++;
          } else if (t.status === 'Completed') {
            comp++;
          }
        });
      });
    });

    const covered = comp;
    const pct = tot > 0 ? Math.round((covered / tot) * 100) : 0;

    return {
      totalTopics: tot,
      completedCount: comp - mast,
      masteredCount: mast,
      coveredCount: covered,
      coveragePercent: pct
    };
  }, [subjects]);

  // Flattened Topics List with Filtering
  const flattenedTopics = useMemo(() => {
    const list: {
      subjectName: string;
      subjectColor?: string;
      chapterName: string;
      topicName: string;
      topicId: string;
      status: TopicStatus;
      topicNumber?: string;
    }[] = [];

    subjects.forEach(sub => {
      if (selectedSubjectId !== 'all' && sub.id !== selectedSubjectId && sub.name !== selectedSubjectId) {
        return;
      }

      sub.chapters.forEach(ch => {
        ch.topics.forEach(t => {
          const isCovered = t.status === 'Completed' || t.status === 'Mastered';
          if (filterMode === 'uncompleted' && isCovered) {
            return;
          }

          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchName = t.name.toLowerCase().includes(q);
            const matchCh = ch.name.toLowerCase().includes(q);
            const matchSub = sub.name.toLowerCase().includes(q);
            if (!matchName && !matchCh && !matchSub) return;
          }

          list.push({
            subjectName: sub.name,
            subjectColor: sub.color,
            chapterName: ch.name,
            topicName: t.name,
            topicId: t.id,
            status: t.status,
            topicNumber: t.topicNumber
          });
        });
      });
    });

    return list;
  }, [subjects, selectedSubjectId, filterMode, searchQuery]);

  if (!isOpen) return null;

  const handleStatusChange = async (subjectName: string, topicName: string, newStatus: TopicStatus) => {
    if (onUpdateTopicStatus) {
      await onUpdateTopicStatus(subjectName, topicName, newStatus);
    }
  };

  const handleQuickTestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddTestResult || !testSubject) return;

    setIsSubmittingTest(true);
    setTestSuccessMessage(null);

    const earned = parseFloat(testScoreEarned) || 0;
    const total = parseFloat(testScoreTotal) || 100;
    const pct = total > 0 ? Math.round((earned / total) * 100) : 0;
    const statusResult = pct >= 85 ? 'Mastered ⭐' : pct >= 60 ? 'Completed ✓' : 'Needs Targeted Revision ⚠️';

    await onAddTestResult({
      subjectName: testSubject,
      topicName: testTopicName.trim() || undefined,
      testName: testTopicName.trim() ? `Quick Check: ${testTopicName}` : `Coverage Boost Check: ${testSubject}`,
      score: `${earned}/${total}`,
      percentage: pct,
      date: new Date().toISOString().split('T')[0],
      notes: `Logged via Quick Coverage Manager to verify mastery.`
    });

    setIsSubmittingTest(false);
    setTestSuccessMessage(`Successfully logged test score (${pct}%)! Topic status synced to: ${statusResult}`);
    setTimeout(() => setTestSuccessMessage(null), 5000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div 
        id="quick-syllabus-coverage-modal"
        className="bg-card border border-theme w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-colors"
      >
        {/* Header with Live Progress Banner */}
        <div className="p-5 sm:p-6 border-b border-theme bg-surface/80 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center shadow-xs">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-primary font-serif">
                  Syllabus Coverage & Mastery Manager
                </h2>
                <p className="text-xs text-muted">
                  Instantly update topic mastery, log verified quiz scores, or take direct action to increase overall coverage.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-muted hover:text-primary hover:bg-theme-accent rounded-full transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Current Academic Coverage Gauge */}
          <div className="p-4 rounded-2xl bg-card border border-theme space-y-2.5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-primary text-sm sm:text-base font-mono">
                  {coveragePercent}% Syllabus Covered
                </span>
                <span className="text-[11px] font-semibold text-muted">
                  ({coveredCount} of {totalTopics} topics completed or mastered)
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono text-muted">
                <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{completedCount} Completed</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-teal-700 dark:text-teal-300 font-bold">
                  <Award className="w-3.5 h-3.5" />
                  <span>{masteredCount} Mastered</span>
                </span>
                <span>•</span>
                <span>{totalTopics - coveredCount} Remaining</span>
              </div>
            </div>

            {/* Natural Green Progress Bar */}
            <div className="w-full bg-theme-accent h-3 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${coveragePercent}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 h-full rounded-full"
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted font-sans">
              <span>Formula: (Completed + Mastered) ÷ Total Topics × 100</span>
              <span className="font-semibold text-primary">Target: 100% Comprehensive Coverage</span>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-2 border-b border-theme pt-1">
            <button
              onClick={() => setActivePathwayTab('topics')}
              className={`px-3 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                activePathwayTab === 'topics'
                  ? 'border-primary text-primary font-serif'
                  : 'border-transparent text-muted hover:text-primary'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Quick Topic Toggles ({flattenedTopics.length})</span>
            </button>

            <button
              onClick={() => setActivePathwayTab('quick_test')}
              className={`px-3 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                activePathwayTab === 'quick_test'
                  ? 'border-primary text-primary font-serif'
                  : 'border-transparent text-muted hover:text-primary'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Log Test Score (Auto-Mastery)</span>
            </button>

            <button
              onClick={() => setActivePathwayTab('pathways')}
              className={`px-3 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                activePathwayTab === 'pathways'
                  ? 'border-primary text-primary font-serif'
                  : 'border-transparent text-muted hover:text-primary'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>6 Ways to Boost Coverage</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          
          {/* TAB 1: QUICK TOPIC STATUS TOGGLES */}
          {activePathwayTab === 'topics' && (
            <div className="space-y-4">
              {/* Controls Bar: Subject selector, search query, filter toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-card border border-theme text-xs font-semibold text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="all">All Subjects ({subjects.length})</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-theme">
                    <button
                      onClick={() => setFilterMode('uncompleted')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                        filterMode === 'uncompleted'
                          ? 'bg-card text-primary shadow-2xs'
                          : 'text-muted hover:text-primary'
                      }`}
                    >
                      Uncompleted Only
                    </button>
                    <button
                      onClick={() => setFilterMode('all')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                        filterMode === 'all'
                          ? 'bg-card text-primary shadow-2xs'
                          : 'text-muted hover:text-primary'
                      }`}
                    >
                      All Topics
                    </button>
                  </div>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search topics or chapters..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-surface border border-theme text-xs text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Topics Table/List */}
              {flattenedTopics.length === 0 ? (
                <div className="text-center py-10 bg-surface rounded-2xl border border-dashed border-theme space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p className="text-sm font-bold text-primary font-serif">
                    {filterMode === 'uncompleted'
                      ? 'No uncompleted topics found in this selection!'
                      : 'No topics matched your search.'}
                  </p>
                  <p className="text-xs text-muted max-w-sm mx-auto">
                    {filterMode === 'uncompleted'
                      ? 'All matching topics are already completed or mastered. Toggle to "All Topics" to review or update past records.'
                      : 'Try broadening your search query or choosing another subject.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {flattenedTopics.map((item) => {
                    const isCompleted = item.status === 'Completed';
                    const isMastered = item.status === 'Mastered';
                    const isCovered = isCompleted || isMastered;

                    return (
                      <div
                        key={`${item.subjectName}-${item.chapterName}-${item.topicName}`}
                        className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isMastered 
                            ? 'bg-teal-50/40 dark:bg-teal-950/20 border-teal-200 dark:border-teal-800'
                            : isCompleted
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                            : 'bg-card border-theme hover:border-primary/40'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-theme-accent text-primary border border-theme">
                              {item.subjectName}
                            </span>
                            <span className="text-[11px] text-muted truncate">
                              {item.chapterName}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <h4 className={`text-xs sm:text-sm font-semibold truncate ${
                              isCovered ? 'text-primary font-bold' : 'text-primary'
                            }`}>
                              {item.topicNumber ? `${item.topicNumber} ` : ''}{item.topicName}
                            </h4>
                            
                            {/* Current Status Pill */}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                              isMastered
                                ? 'bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 border-teal-300 dark:border-teal-700'
                                : isCompleted
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700'
                                : item.status === 'In Progress'
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : item.status === 'Needs Revision'
                                ? 'bg-purple-100 text-purple-800 border-purple-300'
                                : item.status === 'Weak'
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : 'bg-theme-accent text-muted border-theme'
                            }`}>
                              {item.status}
                            </span>
                          </div>
                        </div>

                        {/* 1-Click Action Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center flex-wrap">
                          {/* Mark Completed */}
                          <button
                            onClick={() => handleStatusChange(item.subjectName, item.topicName, 'Completed')}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                              isCompleted
                                ? 'bg-emerald-700 text-white shadow-2xs'
                                : 'bg-surface hover:bg-emerald-100 text-emerald-800 dark:text-emerald-200 border border-theme hover:border-emerald-300'
                            }`}
                            title="Mark as standard completed (+1 topic coverage)"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Completed</span>
                          </button>

                          {/* Mark Mastered */}
                          <button
                            onClick={() => handleStatusChange(item.subjectName, item.topicName, 'Mastered')}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                              isMastered
                                ? 'bg-teal-700 text-white shadow-2xs'
                                : 'bg-surface hover:bg-teal-100 text-teal-800 dark:text-teal-200 border border-theme hover:border-teal-300'
                            }`}
                            title="Mark as highest mastery tier (+1 topic coverage)"
                          >
                            <Award className="w-3.5 h-3.5" />
                            <span>Mastered</span>
                          </button>

                          {/* Needs Revision */}
                          <button
                            onClick={() => handleStatusChange(item.subjectName, item.topicName, 'Needs Revision')}
                            className="px-2 py-1.5 rounded-xl text-xs font-semibold bg-surface hover:bg-purple-100 text-purple-800 dark:text-purple-300 border border-theme transition cursor-pointer"
                            title="Flag for spaced repetition review"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>

                          {/* Start Sprint Timer */}
                          <button
                            onClick={() => {
                              onClose();
                              onStartTimerForTopic(item.subjectName, item.chapterName, item.topicName);
                            }}
                            className="px-2 py-1.5 rounded-xl text-xs font-semibold bg-primary hover:opacity-90 text-white transition flex items-center gap-1 cursor-pointer shadow-2xs"
                            title="Start 25-min focus sprint on this topic"
                          >
                            <Clock className="w-3 h-3" />
                            <span className="hidden sm:inline">Sprint</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: QUICK TEST SCORE LOGGER */}
          {activePathwayTab === 'quick_test' && (
            <div className="bg-surface p-5 sm:p-6 rounded-2xl border border-theme space-y-4">
              <div>
                <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                  <Award className="w-4 h-4 text-primary" />
                  <span>Log a Test Score to Automatically Update Mastery</span>
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  When you record test or quiz performance, StudyFlow matches the score directly to your syllabus topics:
                  scores 85% or higher become <strong>Mastered</strong>, and scores 60%–84% become <strong>Completed</strong>.
                </p>
              </div>

              {testSuccessMessage && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 text-emerald-900 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{testSuccessMessage}</span>
                </div>
              )}

              <form onSubmit={handleQuickTestSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-primary uppercase mb-1">
                      Subject
                    </label>
                    <select
                      value={testSubject}
                      onChange={(e) => setTestSubject(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-card border border-theme text-xs font-semibold text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                      required
                    >
                      {subjects.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-primary uppercase mb-1">
                      Topic Name (Optional Match)
                    </label>
                    <input
                      type="text"
                      value={testTopicName}
                      onChange={(e) => setTestTopicName(e.target.value)}
                      placeholder="e.g. Chemical Bonding, Newton's Laws"
                      className="w-full px-3 py-2 rounded-xl bg-card border border-theme text-xs text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-primary uppercase mb-1">
                      Score Earned
                    </label>
                    <input
                      type="number"
                      value={testScoreEarned}
                      onChange={(e) => setTestScoreEarned(e.target.value)}
                      min="0"
                      className="w-full px-3 py-2 rounded-xl bg-card border border-theme text-xs font-mono font-bold text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-primary uppercase mb-1">
                      Out of (Total)
                    </label>
                    <input
                      type="number"
                      value={testScoreTotal}
                      onChange={(e) => setTestScoreTotal(e.target.value)}
                      min="1"
                      className="w-full px-3 py-2 rounded-xl bg-card border border-theme text-xs font-mono font-bold text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      required
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-card border border-theme flex items-center justify-between text-xs">
                  <span className="text-muted">Calculated Percentage:</span>
                  <span className="font-mono font-bold text-primary">
                    {Math.round(((parseFloat(testScoreEarned) || 0) / (parseFloat(testScoreTotal) || 100)) * 100)}% 
                    {' '}
                    {Math.round(((parseFloat(testScoreEarned) || 0) / (parseFloat(testScoreTotal) || 100)) * 100) >= 85 
                      ? '→ Automatic Mastered Tier ⭐' 
                      : Math.round(((parseFloat(testScoreEarned) || 0) / (parseFloat(testScoreTotal) || 100)) * 100) >= 60 
                      ? '→ Automatic Completed Tier ✓' 
                      : '→ Flagged as Weak for Revision ⚠️'}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmittingTest}
                    className="px-4 py-2 rounded-xl bg-primary hover:opacity-90 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>{isSubmittingTest ? 'Recording Score...' : 'Record Test & Boost Coverage'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: 6 WAYS TO BOOST COVERAGE GUIDE & ACTIONS */}
          {activePathwayTab === 'pathways' && (
            <div className="space-y-4">
              <div className="text-xs text-muted">
                Here are the 6 official methods built into StudyFlow to advance your academic syllabus progress:
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* 1 */}
                <div className="p-4 rounded-2xl bg-surface border border-theme space-y-2">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs">
                    <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-mono">1</span>
                    <span>Direct Topic Toggles</span>
                  </div>
                  <p className="text-xs text-muted">
                    Quickly switch topics between "Not Started", "Completed", and "Mastered" in the Quick Toggles tab or in the full Syllabus view.
                  </p>
                  <button
                    onClick={() => setActivePathwayTab('topics')}
                    className="text-xs text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer pt-1"
                  >
                    <span>Use Quick Toggles</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                {/* 2 */}
                <div className="p-4 rounded-2xl bg-surface border border-theme space-y-2">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs">
                    <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-mono">2</span>
                    <span>Today's Daily Plan Checklist</span>
                  </div>
                  <p className="text-xs text-muted">
                    Checking off scheduled topics in your Daily Focus Plan prompts an outcome dialog that updates your syllabus automatically.
                  </p>
                  <button
                    onClick={() => {
                      onClose();
                      setActiveTab('planner');
                    }}
                    className="text-xs text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer pt-1"
                  >
                    <span>Open Daily Planner</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                {/* 3 */}
                <div className="p-4 rounded-2xl bg-surface border border-theme space-y-2">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs">
                    <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-mono">3</span>
                    <span>Verified Test & Quiz Scores</span>
                  </div>
                  <p className="text-xs text-muted">
                    Scoring 85% or higher automatically promotes the topic to Mastered, while 60%–84% promotes it to Completed.
                  </p>
                  <button
                    onClick={() => setActivePathwayTab('quick_test')}
                    className="text-xs text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer pt-1"
                  >
                    <span>Log Test Score</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                {/* 4 */}
                <div className="p-4 rounded-2xl bg-surface border border-theme space-y-2">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs">
                    <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-mono">4</span>
                    <span>Focus Timer / Pomodoro Sprints</span>
                  </div>
                  <p className="text-xs text-muted">
                    Upon wrapping up a study timer session, choose "Topic Completed" in the retrospective prompt to update status.
                  </p>
                  <button
                    onClick={() => {
                      onClose();
                      setActiveTab('timer');
                    }}
                    className="text-xs text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer pt-1"
                  >
                    <span>Open Study Timer</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                {/* 5 */}
                <div className="p-4 rounded-2xl bg-surface border border-theme space-y-2">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs">
                    <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-mono">5</span>
                    <span>Spaced Repetition Queue</span>
                  </div>
                  <p className="text-xs text-muted">
                    Clearing topics from your revision backlog promotes "Needs Revision" and "Weak" topics back into Mastered or Completed.
                  </p>
                  <button
                    onClick={() => {
                      onClose();
                      setActiveTab('revision');
                    }}
                    className="text-xs text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer pt-1"
                  >
                    <span>Open Revision Queue</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                {/* 6 */}
                <div className="p-4 rounded-2xl bg-surface border border-theme space-y-2">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs">
                    <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-mono">6</span>
                    <span>Pruning or Adding Syllabus Topics</span>
                  </div>
                  <p className="text-xs text-muted">
                    Deleting optional or duplicate topics lowers total topic count, immediately increasing overall completion percentage.
                  </p>
                  <button
                    onClick={() => {
                      onClose();
                      setActiveTab('syllabus');
                    }}
                    className="text-xs text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer pt-1"
                  >
                    <span>Open Full Syllabus</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-theme bg-surface/50 flex items-center justify-between">
          <div className="text-xs text-muted">
            Changes save directly to your cloud & offline databases.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-primary hover:opacity-90 text-white text-xs font-bold transition cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
