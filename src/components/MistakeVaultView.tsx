import React, { useState, useEffect } from 'react';
import { 
  BookmarkCheck, 
  Sparkles, 
  Search, 
  Filter, 
  Plus, 
  CheckCircle2, 
  RotateCcw, 
  Trash2, 
  AlertCircle, 
  TrendingUp, 
  BookOpen, 
  Play, 
  X, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Flame, 
  Trophy,
  Activity,
  Award,
  Zap,
  Tag,
  PenTool
} from 'lucide-react';
import { MistakeEntry, CognitiveErrorCategory, Subject } from '../types';
import { 
  loadMistakes, 
  saveMistakes, 
  addMistake, 
  recordMistakeAttempt, 
  deleteMistake, 
  subscribeMistakes, 
  calculateMistakeStats,
  ERROR_CATEGORY_METADATA 
} from '../lib/mistakeVaultStorage';

interface MistakeVaultViewProps {
  subjects: Subject[];
  onNavigateToRedPen?: () => void;
  onAwardXP?: (xp: number, reason: string) => void;
}

export const MistakeVaultView: React.FC<MistakeVaultViewProps> = ({
  subjects,
  onNavigateToRedPen,
  onAwardXP
}) => {
  const [mistakes, setMistakes] = useState<MistakeEntry[]>(() => loadMistakes());
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'curing' | 'cured'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCureWorkoutActive, setIsCureWorkoutActive] = useState(false);
  const [activeWorkoutIndex, setActiveWorkoutIndex] = useState(0);
  const [showWorkoutAnswer, setShowWorkoutAnswer] = useState(false);
  const [workoutFinished, setWorkoutFinished] = useState(false);
  const [expandedMistakeIds, setExpandedMistakeIds] = useState<Record<string, boolean>>({});

  // New Mistake Form State
  const [formSubject, setFormSubject] = useState(subjects[0]?.name || 'Physics');
  const [formTopic, setFormTopic] = useState('');
  const [formQuestion, setFormQuestion] = useState('');
  const [formAttempt, setFormAttempt] = useState('');
  const [formCorrectAnswer, setFormCorrectAnswer] = useState('');
  const [formCategory, setFormCategory] = useState<CognitiveErrorCategory>('careless_calc');
  const [formThoughtProcess, setFormThoughtProcess] = useState('');
  const [formNotes, setFormNotes] = useState('');

  useEffect(() => {
    const unsub = subscribeMistakes((updated) => {
      setMistakes(updated);
    });
    return () => unsub();
  }, []);

  const stats = calculateMistakeStats(mistakes);

  // Filtered List
  const filteredMistakes = mistakes.filter(m => {
    if (selectedSubject !== 'all' && m.subjectName !== selectedSubject) return false;
    if (selectedCategory !== 'all' && m.errorCategory !== selectedCategory) return false;
    if (selectedStatus !== 'all' && m.cureStatus !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchQuestion = m.question.toLowerCase().includes(q);
      const matchTopic = (m.topicName || '').toLowerCase().includes(q);
      const matchNotes = (m.notes || '').toLowerCase().includes(q);
      if (!matchQuestion && !matchTopic && !matchNotes) return false;
    }
    return true;
  });

  const activeCureCandidates = mistakes.filter(m => m.cureStatus !== 'cured');

  const handleCreateMistake = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formQuestion.trim() || !formCorrectAnswer.trim()) return;

    addMistake({
      subjectName: formSubject,
      topicName: formTopic.trim() || 'Core Topic',
      question: formQuestion.trim(),
      userAttempt: formAttempt.trim(),
      correctAnswer: formCorrectAnswer.trim(),
      errorCategory: formCategory,
      studentThoughtProcess: formThoughtProcess.trim() || undefined,
      notes: formNotes.trim(),
      source: 'manual'
    });

    // Reset Form
    setFormQuestion('');
    setFormAttempt('');
    setFormCorrectAnswer('');
    setFormThoughtProcess('');
    setFormNotes('');
    setIsAddModalOpen(false);

    if (onAwardXP) {
      onAwardXP(20, 'Logged new mistake to Exam Autopsy Vault');
    }
  };

  const handleStartWorkout = () => {
    if (activeCureCandidates.length === 0) return;
    setActiveWorkoutIndex(0);
    setShowWorkoutAnswer(false);
    setWorkoutFinished(false);
    setIsCureWorkoutActive(true);
  };

  const handleWorkoutAnswer = (wasCorrect: boolean) => {
    const currentMistake = activeCureCandidates[activeWorkoutIndex];
    if (!currentMistake) return;

    const { justCured } = recordMistakeAttempt(currentMistake.id, wasCorrect);

    if (wasCorrect && onAwardXP) {
      onAwardXP(justCured ? 50 : 20, justCured ? `Cured mistake in ${currentMistake.subjectName}!` : 'Successful mistake recall drill');
    }

    if (activeWorkoutIndex + 1 < activeCureCandidates.length) {
      setActiveWorkoutIndex(prev => prev + 1);
      setShowWorkoutAnswer(false);
    } else {
      setWorkoutFinished(true);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedMistakeIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-surface border border-theme shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <BookmarkCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-serif font-bold text-primary">The Exam Autopsy & Mistake Vault</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-400/40 text-[10px] font-bold uppercase tracking-wider">
                Anti-Careless Engine
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted mt-1 max-w-2xl leading-relaxed">
              Top rankers don't study more hours — they obsess over their mistakes. Log tricky past paper traps and careless slips here, and drill them until they have a 100% cure rate.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onNavigateToRedPen && (
            <button
              onClick={onNavigateToRedPen}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-theme-accent hover:opacity-85 text-primary border border-theme text-xs font-semibold transition shadow-2xs cursor-pointer"
            >
              <PenTool className="w-4 h-4 text-rose-500" />
              <span>Red Pen Grader</span>
            </button>
          )}

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:opacity-90 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Log Mistake</span>
          </button>
        </div>
      </div>

      {/* Autopsy Diagnostics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-surface border border-theme shadow-xs">
          <span className="text-[11px] font-semibold text-muted">Total Errors Tracked</span>
          <div className="text-2xl font-serif font-bold text-primary mt-1">{stats.total}</div>
          <span className="text-[10px] text-muted">{stats.active} active • {stats.curing} in progress</span>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-theme shadow-xs">
          <span className="text-[11px] font-semibold text-muted">Cured Errors (3/3 Streak)</span>
          <div className="text-2xl font-serif font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {stats.cured}
          </div>
          <div className="w-full bg-theme-accent rounded-full h-1.5 mt-1.5 overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${stats.cureRate}%` }}
            />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-theme shadow-xs">
          <span className="text-[11px] font-semibold text-muted">Vault Cure Rate</span>
          <div className="text-2xl font-serif font-bold text-primary mt-1">{stats.cureRate}%</div>
          <span className="text-[10px] text-muted">Goal: 90%+ before final exams</span>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-surface to-surface border border-amber-500/30 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Cure Workout</span>
            </span>
            <p className="text-[11px] text-muted mt-0.5">
              {activeCureCandidates.length} uncured traps waiting
            </p>
          </div>
          <button
            onClick={handleStartWorkout}
            disabled={activeCureCandidates.length === 0}
            className="mt-2 w-full py-1.5 px-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center justify-center gap-1 shadow-xs disabled:opacity-50 cursor-pointer active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Start Drill</span>
          </button>
        </div>
      </div>

      {/* Cognitive Error Breakdown Pills */}
      <div className="p-4 rounded-2xl bg-surface border border-theme shadow-xs">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-bold text-primary flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-rose-500" />
            <span>Root Cause Diagnostics (Why Marks Were Lost)</span>
          </span>
          <span className="text-[10px] text-muted">Select to filter</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          {(Object.keys(ERROR_CATEGORY_METADATA) as CognitiveErrorCategory[]).map((cat) => {
            const meta = ERROR_CATEGORY_METADATA[cat];
            const count = stats.categoryCounts[cat] || 0;
            const isSelected = selectedCategory === cat;

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(isSelected ? 'all' : cat)}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                  isSelected 
                    ? `${meta.bgColor} ${meta.borderColor} ring-2 ring-primary/20`
                    : 'bg-surface-raised hover:bg-theme-accent/50 border-theme/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base">{meta.iconText}</span>
                  <span className="font-mono font-bold text-xs px-1.5 py-0.5 rounded bg-surface text-primary border border-theme/40">
                    {count}
                  </span>
                </div>
                <p className="font-bold text-[11px] text-primary mt-1 line-clamp-1">{meta.label}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search & Filter Strip */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search questions, traps, or notes..."
            className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-surface border border-theme text-primary text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="px-3 py-2 rounded-xl bg-surface border border-theme text-primary text-xs font-medium focus:outline-none"
          >
            <option value="all">All Subjects</option>
            {subjects.map(s => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as any)}
            className="px-3 py-2 rounded-xl bg-surface border border-theme text-primary text-xs font-medium focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Traps</option>
            <option value="curing">In Progress (1-2 Streak)</option>
            <option value="cured">Cured (3/3 Streak)</option>
          </select>
        </div>
      </div>

      {/* Mistake Cards Ledger */}
      <div className="space-y-3">
        {filteredMistakes.map((m) => {
          const meta = ERROR_CATEGORY_METADATA[m.errorCategory] || ERROR_CATEGORY_METADATA.careless_calc;
          const isExpanded = expandedMistakeIds[m.id];

          return (
            <div
              key={m.id}
              className={`p-4 sm:p-5 rounded-2xl bg-surface border transition shadow-2xs ${
                m.cureStatus === 'cured'
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-theme'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-theme/60 pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-md bg-theme-accent text-primary font-bold text-[11px] border border-theme/40">
                    {m.subjectName}
                  </span>
                  {m.topicName && (
                    <span className="text-[11px] text-muted">
                      {m.topicName}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] border flex items-center gap-1 ${meta.bgColor} ${meta.color} ${meta.borderColor}`}>
                    <span>{meta.iconText}</span>
                    <span>{meta.label}</span>
                  </span>
                </div>

                {/* Consecutive Streak Badges */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted uppercase font-bold">Cure Streak:</span>
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map((idx) => {
                      const isFilled = idx < m.consecutiveCorrect;
                      return (
                        <div
                          key={idx}
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                            isFilled
                              ? 'bg-emerald-500 border-emerald-600 text-white'
                              : 'bg-theme-accent border-theme text-transparent'
                          }`}
                        >
                          {isFilled && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      );
                    })}
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    m.cureStatus === 'cured'
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                      : m.cureStatus === 'curing'
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                      : 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                  }`}>
                    {m.cureStatus}
                  </span>
                </div>
              </div>

              {/* Question Statement */}
              <div className="pt-3">
                <p className="text-xs sm:text-sm font-semibold text-primary leading-relaxed font-serif">
                  {m.question}
                </p>

                {/* What I Did Wrong Callout */}
                {m.userAttempt && (
                  <div className="mt-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-900 dark:text-rose-200">
                    <span className="font-bold block text-[10px] uppercase tracking-wider text-rose-600 dark:text-rose-400">
                      What I Did Wrong (Previous Trap):
                    </span>
                    <p className="mt-0.5 font-sans leading-relaxed">{m.userAttempt}</p>
                  </div>
                )}

                {/* What I Was Thinking At That Moment */}
                {m.studentThoughtProcess && (
                  <div className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
                    <span className="font-bold block text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-300">
                      💭 My Thought Process At That Moment:
                    </span>
                    <p className="mt-0.5 font-sans italic leading-relaxed">"{m.studentThoughtProcess}"</p>
                  </div>
                )}

                {/* Collapsible Correct Solution */}
                {isExpanded ? (
                  <div className="mt-2.5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-950 dark:text-emerald-200 space-y-1.5 animate-in fade-in duration-200">
                    <span className="font-bold block text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Official Correct Solution & Method:
                    </span>
                    <p className="font-sans leading-relaxed whitespace-pre-line">{m.correctAnswer}</p>
                    {m.notes && (
                      <p className="text-[11px] text-emerald-800 dark:text-emerald-300 italic pt-1 border-t border-emerald-500/20">
                        💡 <strong>Autopsy Takeaway:</strong> {m.notes}
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => toggleExpand(m.id)}
                    className="mt-2 text-xs font-bold text-primary/80 hover:text-primary flex items-center gap-1 cursor-pointer"
                  >
                    <span>Reveal Correct Solution & Takeaway</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="mt-3 pt-2 border-t border-theme/40 flex items-center justify-between text-xs text-muted">
                <span>Logged from: {m.source}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const { justCured } = recordMistakeAttempt(m.id, true);
                      if (onAwardXP) onAwardXP(justCured ? 50 : 20, 'Drill passed');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-theme-accent hover:bg-emerald-500/20 hover:text-emerald-600 font-semibold transition cursor-pointer text-[11px]"
                  >
                    +1 Streak (Correct)
                  </button>
                  <button
                    onClick={() => deleteMistake(m.id)}
                    className="p-1.5 rounded-lg text-muted hover:text-rose-600 transition cursor-pointer"
                    title="Delete mistake"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredMistakes.length === 0 && (
          <div className="p-12 rounded-3xl bg-surface border border-theme text-center space-y-3">
            <BookmarkCheck className="w-8 h-8 mx-auto text-muted" />
            <h3 className="text-sm font-bold text-primary">No mistakes found</h3>
            <p className="text-xs text-muted max-w-sm mx-auto">
              {searchQuery || selectedCategory !== 'all' 
                ? 'Try clearing your active filters.'
                : 'Your mistake vault is clean! Use the Examiner Red Pen or log offline errors to track cognitive traps.'}
            </p>
          </div>
        )}
      </div>

      {/* MODAL 1: ADD MISTAKE MANUALLY */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-lg rounded-3xl bg-surface border border-theme shadow-2xl overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-theme pb-3">
              <div className="flex items-center gap-2">
                <BookmarkCheck className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-primary">Log Mistake to Exam Autopsy</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-theme-accent text-muted hover:text-primary transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMistake} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-muted mb-1">Subject</label>
                  <select
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-raised border border-theme text-primary focus:outline-none"
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                    {subjects.length === 0 && <option value="Physics">Physics</option>}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-muted mb-1">Topic Name</label>
                  <input
                    type="text"
                    value={formTopic}
                    onChange={(e) => setFormTopic(e.target.value)}
                    placeholder="e.g. Thermodynamics, Calculus"
                    className="w-full px-3 py-2 rounded-xl bg-surface-raised border border-theme text-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">Cognitive Error Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as CognitiveErrorCategory)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-raised border border-theme text-primary focus:outline-none font-semibold"
                >
                  <option value="careless_calc">🔢 Careless Calculation (Arithmetic / Units)</option>
                  <option value="misread_question">👓 Misread Question (Skipped word / condition)</option>
                  <option value="formula_confusion">📐 Formula Confusion (Wrong equation / signs)</option>
                  <option value="concept_gap">🧠 Conceptual Hole (Didn't understand rule)</option>
                  <option value="time_pressure">⏱️ Time Pressure Rush (Sloppy final steps)</option>
                  <option value="english_comprehension">📖 English / Language Comprehension Trap</option>
                  <option value="missing_question">❓ Missing / Skipped Question</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">The Question</label>
                <textarea
                  value={formQuestion}
                  onChange={(e) => setFormQuestion(e.target.value)}
                  placeholder="Paste or write the question that tripped you up..."
                  rows={2}
                  required
                  className="w-full p-2.5 rounded-xl bg-surface-raised border border-theme text-primary focus:outline-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block font-semibold text-rose-700 dark:text-rose-400 mb-1">
                  💭 What Was I Thinking At That Moment? (Why did you take this step?)
                </label>
                <input
                  type="text"
                  value={formThoughtProcess}
                  onChange={(e) => setFormThoughtProcess(e.target.value)}
                  placeholder="e.g. I assumed pressure was constant and rushed into formula P1V1=P2V2..."
                  className="w-full p-2.5 rounded-xl bg-surface-raised border border-rose-300 dark:border-rose-900 text-primary focus:outline-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">What You Did Wrong (Your Mistake)</label>
                <textarea
                  value={formAttempt}
                  onChange={(e) => setFormAttempt(e.target.value)}
                  placeholder="What was your incorrect step or misconception? (e.g. Forgot to convert to Kelvin)"
                  rows={2}
                  className="w-full p-2.5 rounded-xl bg-surface-raised border border-theme text-primary focus:outline-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">Correct Answer & Method</label>
                <textarea
                  value={formCorrectAnswer}
                  onChange={(e) => setFormCorrectAnswer(e.target.value)}
                  placeholder="What is the flawless correct answer and formula?"
                  rows={2}
                  required
                  className="w-full p-2.5 rounded-xl bg-surface-raised border border-theme text-primary focus:outline-none leading-relaxed"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-muted hover:text-primary font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-primary hover:opacity-90 text-white font-bold transition shadow-xs cursor-pointer active:scale-95"
                >
                  Save to Mistake Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: INTERACTIVE CURE WORKOUT */}
      {isCureWorkoutActive && activeCureCandidates.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-xl rounded-3xl bg-surface border border-theme shadow-2xl overflow-hidden p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            {workoutFinished ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 mx-auto">
                  <Trophy className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-primary">Cure Workout Finished!</h3>
                <p className="text-xs text-muted max-w-sm mx-auto">
                  You drilled all your active traps. Consistent daily re-testing permanently rewires your cognitive recall so you never make these mistakes on exam day!
                </p>
                <button
                  onClick={() => setIsCureWorkoutActive(false)}
                  className="px-6 py-2.5 rounded-2xl bg-primary hover:opacity-90 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  Return to Mistake Vault
                </button>
              </div>
            ) : (
              <>
                {/* Workout Header */}
                <div className="flex items-center justify-between border-b border-theme pb-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span className="font-bold text-primary">
                      Cure Drill: {activeWorkoutIndex + 1} of {activeCureCandidates.length}
                    </span>
                  </div>
                  <button
                    onClick={() => setIsCureWorkoutActive(false)}
                    className="p-1 rounded-lg hover:bg-theme-accent text-muted transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Current Item */}
                {(() => {
                  const current = activeCureCandidates[activeWorkoutIndex];
                  const meta = ERROR_CATEGORY_METADATA[current.errorCategory];

                  return (
                    <div className="space-y-4 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md bg-theme-accent text-primary font-bold text-[11px]">
                          {current.subjectName}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] border ${meta.bgColor} ${meta.color} ${meta.borderColor}`}>
                          {meta.iconText} {meta.label}
                        </span>
                      </div>

                      <div className="p-4 rounded-2xl bg-surface-raised border border-theme">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
                          Solve this question mentally or on rough paper:
                        </span>
                        <p className="text-sm font-serif font-bold text-primary leading-relaxed">
                          {current.question}
                        </p>
                      </div>

                      {showWorkoutAnswer ? (
                        <div className="space-y-3 animate-in fade-in duration-200">
                          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-950 dark:text-emerald-200 space-y-1">
                            <span className="font-bold text-[10px] uppercase text-emerald-700 dark:text-emerald-400 block">
                              Correct Solution:
                            </span>
                            <p className="font-sans leading-relaxed whitespace-pre-line">{current.correctAnswer}</p>
                            {current.notes && (
                              <p className="text-[11px] text-emerald-800 dark:text-emerald-300 italic pt-1 border-t border-emerald-500/20">
                                💡 {current.notes}
                              </p>
                            )}
                          </div>

                          <div className="pt-2 text-center">
                            <span className="text-xs font-semibold text-muted block mb-2">
                              Did you successfully avoid the previous trap?
                            </span>
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                onClick={() => handleWorkoutAnswer(false)}
                                className="py-2.5 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-800 dark:text-rose-300 border border-rose-500/30 font-bold transition cursor-pointer active:scale-95"
                              >
                                Still Tripped Up (Reset Streak)
                              </button>
                              <button
                                onClick={() => handleWorkoutAnswer(true)}
                                className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-sm cursor-pointer active:scale-95"
                              >
                                Solved Perfectly! (+1 Streak)
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-2">
                          <button
                            onClick={() => setShowWorkoutAnswer(true)}
                            className="w-full py-3 rounded-2xl bg-primary hover:opacity-90 text-white font-bold transition shadow-xs cursor-pointer active:scale-95 text-center"
                          >
                            Check Correct Solution
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
