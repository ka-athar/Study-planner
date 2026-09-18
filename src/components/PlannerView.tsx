import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Clock, 
  Calendar, 
  HelpCircle, 
  CheckCircle2, 
  Play, 
  ArrowRight, 
  Save, 
  AlertCircle,
  Lightbulb,
  CalendarDays,
  Wand2,
  Check,
  RotateCcw,
  ListChecks,
  Mail,
  FileText,
  Edit3,
  Printer,
  Zap
} from 'lucide-react';
import { Subject, StudySession, TestResult, StudyPlan, StudyPlanTopic, TopicCompletionStatus, ActiveTab, UserProfile, Assignment } from '../types';
import { apiGenerateStudyPlan } from '../lib/aiApi';
import { AIScheduleImportCard } from './AIScheduleImportCard';
import { TaskDetailModal } from './TaskDetailModal';

interface PlannerViewProps {
  subjects: Subject[];
  sessions: StudySession[];
  testResults: TestResult[];
  plans: StudyPlan[];
  assignments?: Assignment[];
  userProfile?: UserProfile | null;
  onSavePlan: (plan: Omit<StudyPlan, 'id'>) => Promise<void> | void;
  setActiveTab: (tab: ActiveTab) => void;
  onStartTimerForTopic: (subjectName: string, chapterName: string, topicName: string) => void;
  onTogglePlanTopic?: (planId: string, topicId: string, completed?: boolean, details?: any) => void;
  onAdjustPlanTopicDuration?: (planId: string, topicId: string, deltaMinutes: number) => void;
  onOpenEmailAgendaModal?: () => void;
  onOpenPrintKit?: () => void;
}

export const PlannerView: React.FC<PlannerViewProps> = ({
  subjects,
  sessions,
  testResults,
  plans,
  assignments = [],
  userProfile,
  onSavePlan,
  setActiveTab,
  onStartTimerForTopic,
  onTogglePlanTopic,
  onAdjustPlanTopicDuration,
  onOpenEmailAgendaModal,
  onOpenPrintKit
}) => {
  const [plannerMode, setPlannerMode] = useState<'prompt' | 'import'>('prompt');
  const [availableHours, setAvailableHours] = useState<number>(3);
  const [planType, setPlanType] = useState<'daily' | 'weekly'>('daily');
  const [userPrompt, setUserPrompt] = useState<string>('Make me a balanced study plan for today.');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Task detail modal state
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<{
    planId: string;
    topic: StudyPlanTopic;
  } | null>(null);

  const [selectedPlanId, setSelectedPlanId] = useState<string>(
    plans.length > 0 ? plans[0].id : ''
  );

  // Synchronize current plan with latest plans list
  const currentPlan = plans.find(p => p.id === selectedPlanId) || (plans.length > 0 ? plans[0] : null);

  const planDateStr = currentPlan ? currentPlan.date : new Date().toISOString().split('T')[0];
  const conflictingAssignments = useMemo(() => {
    return (assignments || []).filter(a => a.dueDate === planDateStr && !a.completed);
  }, [assignments, planDateStr]);

  const conflictingExams = useMemo(() => {
    return (userProfile?.examDates || []).filter(e => e.date === planDateStr);
  }, [userProfile?.examDates, planDateStr]);

  const assignedTopics = currentPlan ? currentPlan.topics.filter(t => !t.completed) : [];
  const completedTopics = currentPlan ? currentPlan.topics.filter(t => Boolean(t.completed)) : [];

  const presetQuestions = [
    "What should I study today?",
    "What should I do next?",
    "Make me a plan for tomorrow.",
    "I have 3 hours today. What should I study?",
    "What am I falling behind in?"
  ];

  const handleGeneratePlan = async (customPromptText?: string) => {
    const promptToUse = customPromptText || userPrompt;
    setError('');
    setIsGenerating(true);

    try {
      const res = await apiGenerateStudyPlan({
        syllabus: subjects,
        recentSessions: sessions.slice(0, 15),
        testResults: testResults.slice(0, 10),
        availableHours: availableHours,
        planType: planType,
        userPrompt: promptToUse,
        targetDate: new Date().toISOString().split('T')[0]
      });

      if (res.success && res.plan) {
        const newPlanObj: Omit<StudyPlan, 'id'> = {
          userId: '',
          date: new Date().toISOString().split('T')[0],
          title: res.plan.title || `${planType === 'daily' ? 'Daily' : 'Weekly'} Study Plan`,
          topics: (res.plan.topics || []).map((t: any, idx: number) => ({
            id: `plan-tp-${Date.now()}-${idx}`,
            subjectName: t.subjectName || 'General',
            chapterName: t.chapterName || '',
            topicName: t.topicName || '',
            estimatedMinutes: t.estimatedMinutes || 45,
            priority: t.priority || 'Medium',
            reason: t.reason || 'AI selected based on syllabus progress',
            completed: false
          })),
          reasoning: res.plan.reasoning || '',
          availableHours: availableHours,
          createdAt: new Date().toISOString()
        };

        const tempId = `temp-${Date.now()}`;
        await onSavePlan(newPlanObj);
        setSelectedPlanId(tempId);
      } else {
        setError('Failed to generate study plan. Please try again.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error generating AI study plan.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Mode Switcher */}
      <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-serif italic font-bold text-[#6B705C] flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#6B705C]" />
            <span>AI Study Planner & Schedule Hub</span>
          </h2>
          <p className="text-xs text-[#A5A58D] mt-1">
            Generate tailored study plans based on your syllabus progress, or paste your calendar schedule to auto-assign tasks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => setActiveTab('assignments')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white hover:bg-[#F2EFE9] text-[#6B705C] border border-[#E0DBD0] text-xs font-semibold transition shadow-2xs cursor-pointer"
            title="View Assignment & Deadline Manager"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Deadlines</span>
          </button>

          {onOpenEmailAgendaModal && (
            <button
              onClick={onOpenEmailAgendaModal}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-semibold transition shadow-2xs cursor-pointer"
              title="Email today's agenda and to-do schedule to your Gmail"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email Schedule</span>
            </button>
          )}

          {/* Mode Switcher */}
          <div className="flex rounded-2xl bg-[#F9F7F2] p-1 border border-[#E0DBD0] text-xs">
            <button
              onClick={() => setPlannerMode('prompt')}
              className={`flex items-center gap-1.5 px-3.5 py-2 font-bold rounded-xl transition ${
                plannerMode === 'prompt'
                  ? 'bg-[#6B705C] text-white shadow-xs'
                  : 'text-[#A5A58D] hover:text-[#4A4E4D]'
              }`}
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>AI Smart Planner</span>
            </button>

            <button
              onClick={() => setPlannerMode('import')}
              className={`flex items-center gap-1.5 px-3.5 py-2 font-bold rounded-xl transition ${
                plannerMode === 'import'
                  ? 'bg-[#6B705C] text-white shadow-xs'
                  : 'text-[#A5A58D] hover:text-[#4A4E4D]'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Paste Schedule / Import</span>
            </button>
          </div>
        </div>
      </div>

      {/* MODE 1: AI CALENDAR / WEEKLY SCHEDULE IMPORT */}
      {plannerMode === 'import' && (
        <AIScheduleImportCard
          subjects={subjects}
          userProfile={userProfile}
          onSavePlan={onSavePlan}
          setActiveTab={setActiveTab}
        />
      )}

      {/* MODE 2: PROMPT-BASED AI PLANNER */}
      {plannerMode === 'prompt' && (
        <div className="space-y-6">
          {/* 1-Tap Quick Plan Presets Strip */}
          <div className="bg-card border border-theme rounded-3xl p-4 sm:p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase font-mono tracking-wider">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>1-Tap AI Plan Presets</span>
              </span>
              <span className="text-[11px] text-muted hidden sm:inline">Instant structure based on syllabus & goals</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                onClick={() => {
                  setAvailableHours(2);
                  setPlanType('daily');
                  const p = "Generate a high-yield 2-hour daily study plan focusing on top priority uncompleted syllabus chapters.";
                  setUserPrompt(p);
                  handleGeneratePlan(p);
                }}
                disabled={isGenerating}
                className="p-3.5 rounded-2xl bg-surface hover:bg-theme-accent border border-theme hover:border-primary/40 text-left transition flex flex-col justify-between gap-1.5 cursor-pointer shadow-2xs group min-h-[44px]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary group-hover:text-primary flex items-center gap-1.5">
                    <span className="text-sm">⚡</span> 2-Hour High Yield
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">2h</span>
                </div>
                <p className="text-[11px] text-muted leading-tight">
                  Tackles core unmastered concepts in rapid 45m blocks
                </p>
              </button>

              <button
                onClick={() => {
                  setPlanType('daily');
                  const p = "Prioritize topics marked Needs Revision or where recent test scores were lowest. Include conceptual review and active recall.";
                  setUserPrompt(p);
                  handleGeneratePlan(p);
                }}
                disabled={isGenerating}
                className="p-3.5 rounded-2xl bg-surface hover:bg-theme-accent border border-theme hover:border-primary/40 text-left transition flex flex-col justify-between gap-1.5 cursor-pointer shadow-2xs group min-h-[44px]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary group-hover:text-primary flex items-center gap-1.5">
                    <span className="text-sm">🎯</span> Target Weak Topics
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300">Fix Gaps</span>
                </div>
                <p className="text-[11px] text-muted leading-tight">
                  Zero in on needs-revision tags and weak test chapters
                </p>
              </button>

              <button
                onClick={() => {
                  setPlanType('daily');
                  const p = "Create a balanced study session across all active subjects with scheduled spaced retrieval intervals.";
                  setUserPrompt(p);
                  handleGeneratePlan(p);
                }}
                disabled={isGenerating}
                className="p-3.5 rounded-2xl bg-surface hover:bg-theme-accent border border-theme hover:border-primary/40 text-left transition flex flex-col justify-between gap-1.5 cursor-pointer shadow-2xs group min-h-[44px]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary group-hover:text-primary flex items-center gap-1.5">
                    <span className="text-sm">⚖️</span> Balanced Exam Prep
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">Balanced</span>
                </div>
                <p className="text-[11px] text-muted leading-tight">
                  Even distribution of syllabus content and past exam review
                </p>
              </button>
            </div>
          </div>

          {/* Preset Questions Row */}
          <div className="bg-[#F2EFE9] border border-[#E0DBD0] rounded-3xl p-5 space-y-3">
            <span className="text-xs font-bold text-[#6B705C] flex items-center gap-1.5 uppercase tracking-widest">
              <HelpCircle className="w-4 h-4 text-[#6B705C]" />
              <span>Quick Ask Prompts (Click to generate instantly):</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {presetQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setUserPrompt(q);
                    handleGeneratePlan(q);
                  }}
                  className="px-3.5 py-1.5 rounded-full bg-white border border-[#E0DBD0] hover:border-[#6B705C] hover:bg-[#F9F7F2] text-xs font-medium text-[#4A4E4D] transition shadow-2xs"
                >
                  "{q}"
                </button>
              ))}
            </div>
          </div>

          {/* Generator Controls Card */}
          <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[#A5A58D] mb-1">Available Hours</label>
                <div className="relative">
                  <Clock className="w-4 h-4 absolute left-3 top-2.5 text-[#A5A58D]" />
                  <input
                    type="number"
                    min={0.5}
                    max={16}
                    step={0.5}
                    value={availableHours}
                    onChange={(e) => setAvailableHours(parseFloat(e.target.value) || 1)}
                    className="w-full pl-9 pr-3 py-2 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] focus:outline-none focus:border-[#6B705C] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[#A5A58D] mb-1">Plan Horizon</label>
                <div className="flex rounded-2xl bg-[#F9F7F2] p-1 border border-[#E0DBD0]">
                  <button
                    onClick={() => setPlanType('daily')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition ${
                      planType === 'daily' ? 'bg-[#6B705C] text-white shadow-xs' : 'text-[#A5A58D] hover:text-[#4A4E4D]'
                    }`}
                  >
                    Daily Plan
                  </button>
                  <button
                    onClick={() => setPlanType('weekly')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition ${
                      planType === 'weekly' ? 'bg-[#6B705C] text-white shadow-xs' : 'text-[#A5A58D] hover:text-[#4A4E4D]'
                    }`}
                  >
                    Weekly Plan
                  </button>
                </div>
              </div>

              <div className="sm:col-span-1 flex items-end">
                <button
                  onClick={() => handleGeneratePlan()}
                  disabled={isGenerating}
                  className="w-full py-2.5 px-4 bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-medium text-xs rounded-full shadow-xs disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-spin text-white" />
                      <span>Planning with Gemini...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Custom AI Plan</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#A5A58D] mb-1">Custom Goals or Specific Questions</label>
              <input
                type="text"
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder="e.g. Focus mainly on Chemistry and Biology weak topics..."
                className="w-full p-3 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
              />
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl">
                {error}
              </div>
            )}
          </div>

          {/* Generated Plan Display */}
          {currentPlan ? (
            <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E0DBD0] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#6B705C]/10 text-[#6B705C] border border-[#6B705C]/20 uppercase tracking-widest font-sans">
                      ACTIVE PLAN
                    </span>
                    <h3 className="text-lg font-serif italic font-bold text-[#6B705C]">{currentPlan.title}</h3>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#F2EFE9] text-[#6B705C] border border-[#E0DBD0]">
                      {completedTopics.length}/{currentPlan.topics.length} Done
                    </span>
                  </div>
                  <p className="text-xs text-[#A5A58D] mt-0.5">
                    Target Date: {currentPlan.date} • Available: {currentPlan.availableHours || availableHours} hrs
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {onOpenPrintKit && (
                    <button
                      onClick={onOpenPrintKit}
                      className="px-3.5 py-1.5 bg-theme-accent hover:opacity-85 text-primary border border-theme text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                      title="Print Weekly Wall Planner or Study Cheat Sheet"
                    >
                      <Printer className="w-3.5 h-3.5 text-primary" />
                      <span>Print Wall Planner</span>
                    </button>
                  )}

                  {/* Plan selector if user has multiple plans */}
                  {plans.length > 1 && (
                    <select
                      value={currentPlan.id}
                      onChange={(e) => setSelectedPlanId(e.target.value)}
                      className="p-2 bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl text-xs text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
                    >
                      {plans.map((p, idx) => (
                        <option key={p.id || idx} value={p.id}>
                          {p.title} ({p.date})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Visual Conflict Notice Banner if exams or assignments overlap */}
              {(conflictingAssignments.length > 0 || conflictingExams.length > 0) && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div>
                      <span className="font-bold">Schedule Conflict Notice ({planDateStr}): </span>
                      {conflictingAssignments.map(a => `Assignment Due: "${a.title}"`).concat(conflictingExams.map(e => `Exam: "${e.subject}"`)).join(' • ')}
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-amber-700 dark:text-amber-300 shrink-0 font-semibold">
                    Adjust topic times below as needed
                  </span>
                </div>
              )}

              {/* AI Reasoning Box */}
              {currentPlan.reasoning && (
                <div className="p-4 rounded-2xl bg-[#F2EFE9] border border-[#E0DBD0] text-xs text-[#4A4E4D] space-y-1">
                  <div className="font-bold flex items-center gap-2 text-[#6B705C]">
                    <Lightbulb className="w-4 h-4 text-amber-700" />
                    <span>Why Gemini AI Structured This Plan:</span>
                  </div>
                  <p className="leading-relaxed text-[#4A4E4D] font-normal">{currentPlan.reasoning}</p>
                </div>
              )}

              {/* 1. ASSIGNED WORK TO DO */}
              <div className="space-y-4">
                {assignedTopics.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-[#A5A58D] font-mono font-bold uppercase tracking-widest px-1">
                      <span className="flex items-center gap-1.5">
                        <ListChecks className="w-3.5 h-3.5 text-[#6B705C]" />
                        <span>Assigned Tasks To Do ({assignedTopics.length})</span>
                      </span>
                      <span className="text-[10px] font-normal lowercase italic text-[#A5A58D]">
                        Tick ✓ to complete without timer
                      </span>
                    </div>

                    {assignedTopics.map((t, idx) => (
                      <div
                        key={t.id || idx}
                        className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] hover:border-[#6B705C]/30 transition flex flex-col md:flex-row md:items-center justify-between gap-3 group"
                      >
                        <div className="flex items-start gap-3">
                          {/* Quick Tick / Checkmark Button */}
                          <button
                            onClick={() => onTogglePlanTopic && onTogglePlanTopic(currentPlan.id, t.id, true)}
                            title="Tick to mark assigned task as complete (without timer)"
                            className="mt-0.5 w-7 h-7 rounded-xl border-2 border-[#C2BEB5] group-hover:border-emerald-600 hover:bg-emerald-50 text-emerald-700 flex items-center justify-center transition shrink-0 shadow-2xs cursor-pointer"
                          >
                            <Check className="w-4 h-4 text-emerald-600 opacity-30 group-hover:opacity-100 transition-opacity" />
                          </button>

                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#EAE7DF] text-[#6B705C]">
                                {t.subjectName}
                              </span>
                              <span className="text-xs font-mono text-[#A5A58D]">{t.chapterName}</span>
                              {t.priority === 'High' && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                                  HIGH PRIORITY
                                </span>
                              )}
                              {conflictingAssignments.some(a => a.subjectName.toLowerCase() === t.subjectName.toLowerCase()) && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                                  ⚠️ Assignment Due
                                </span>
                              )}
                            </div>
                            <h5 className="text-sm font-bold text-[#4A4E4D]">{t.topicName}</h5>
                            <p className="text-xs text-[#A5A58D] italic">"{t.reason}"</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center pl-10 md:pl-0 flex-wrap sm:flex-nowrap">
                          {/* Duration Adjustment Controls */}
                          <div className="flex items-center gap-1 bg-white border border-[#E0DBD0] rounded-full px-2 py-0.5 shadow-2xs mr-1">
                            {onAdjustPlanTopicDuration && (
                              <button
                                onClick={() => onAdjustPlanTopicDuration(currentPlan.id, t.id, -15)}
                                disabled={(t.estimatedMinutes || 45) <= 15}
                                className="text-[10px] font-bold text-[#A5A58D] hover:text-[#4A4E4D] disabled:opacity-20 px-1 py-0.5 rounded hover:bg-[#F2EFE9] transition cursor-pointer min-h-[28px] min-w-[24px] flex items-center justify-center"
                                title="Subtract 15 minutes"
                              >
                                -15m
                              </button>
                            )}
                            <span className="text-xs font-mono font-bold text-[#4A4E4D] px-1">
                              ~{t.estimatedMinutes || 45}m
                            </span>
                            {onAdjustPlanTopicDuration && (
                              <button
                                onClick={() => onAdjustPlanTopicDuration(currentPlan.id, t.id, 15)}
                                disabled={(t.estimatedMinutes || 45) >= 240}
                                className="text-[10px] font-bold text-[#A5A58D] hover:text-[#4A4E4D] disabled:opacity-20 px-1 py-0.5 rounded hover:bg-[#F2EFE9] transition cursor-pointer min-h-[28px] min-w-[24px] flex items-center justify-center"
                                title="Add 15 minutes"
                              >
                                +15m
                              </button>
                            )}
                          </div>

                          {/* Log Work & Add Details button */}
                          <button
                            onClick={() => setSelectedTaskForDetail({ planId: currentPlan.id, topic: t })}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white hover:bg-[#F2EFE9] text-[#6B705C] border border-[#E0DBD0] font-medium text-xs transition shadow-2xs cursor-pointer"
                            title="Add details of what you did and set completion state (e.g. Needs Revision, Mastered)"
                          >
                            <FileText className="w-3 h-3 text-[#6B705C]" />
                            <span>+ Details</span>
                          </button>

                          {/* Quick Complete Button */}
                          <button
                            onClick={() => onTogglePlanTopic && onTogglePlanTopic(currentPlan.id, t.id, true)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 font-medium text-xs transition shadow-2xs cursor-pointer"
                            title="Mark as completed directly"
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Done</span>
                          </button>

                          {/* Start Studying Timer Button */}
                          <button
                            onClick={() => onStartTimerForTopic(t.subjectName, t.chapterName, t.topicName)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-medium text-xs transition shadow-xs cursor-pointer"
                            title="Start live timer"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>Timer</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-center space-y-1.5">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-1">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-bold text-emerald-900 font-serif">
                      All Tasks Completed in This Plan! 🎉
                    </h4>
                    <p className="text-xs text-emerald-700 max-w-md mx-auto">
                      You've ticked off all tasks in this plan. Completed items are neatly moved to the completed section below.
                    </p>
                  </div>
                )}

                {/* 2. COMPLETED WORK (Cut off from to-do & listed here) */}
                {completedTopics.length > 0 && (
                  <div className="pt-4 border-t border-[#E0DBD0] space-y-2.5">
                    <div className="flex items-center justify-between text-xs text-[#6B705C] font-mono font-bold uppercase tracking-widest px-1">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Completed Tasks ({completedTopics.length})</span>
                      </span>
                      <span className="text-[11px] font-normal text-[#A5A58D]">
                        {completedTopics.reduce((acc, t) => acc + (t.estimatedMinutes || 45), 0)} mins assigned work
                      </span>
                    </div>

                    <div className="space-y-2">
                      {completedTopics.map((t, idx) => {
                        const isNeedsRev = t.completionStatus === 'Needs Revision';
                        const isMastered = t.completionStatus === 'Mastered';
                        const isPartial = t.completionStatus === 'Partially completed';

                        return (
                          <div
                            key={t.id || `comp-${idx}`}
                            className="bg-[#F2EFE9]/70 border border-[#E0DBD0] rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                isNeedsRev 
                                  ? 'bg-amber-100 text-amber-800' 
                                  : isMastered 
                                  ? 'bg-emerald-100 text-emerald-800' 
                                  : isPartial
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                {isNeedsRev ? <RotateCcw className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                              </div>
                              <div className="min-w-0 space-y-0.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="line-through text-[#666B60] font-bold text-sm truncate">
                                    {t.topicName}
                                  </span>

                                  {isNeedsRev && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                                      <RotateCcw className="w-2.5 h-2.5" />
                                      <span>Scheduled for Revision</span>
                                    </span>
                                  )}
                                  {isMastered && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                                      <span>⭐ Mastered (100%)</span>
                                    </span>
                                  )}
                                  {isPartial && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-900 border border-orange-300 flex items-center gap-1">
                                      <span>⏳ Partial Progress</span>
                                    </span>
                                  )}
                                  {!isNeedsRev && !isMastered && !isPartial && (
                                    <span className="text-[10px] font-medium px-2 py-0.2 rounded bg-emerald-100/70 text-emerald-800 shrink-0">
                                      Completed
                                    </span>
                                  )}
                                </div>

                                <div className="text-[11px] text-[#A5A58D] flex items-center gap-1.5 truncate">
                                  <span>{t.subjectName}</span>
                                  <span>•</span>
                                  <span>{t.chapterName}</span>
                                </div>

                                {t.completionDetails && (
                                  <div className="mt-1 text-[11px] text-[#4A4E4D] bg-white/80 border-l-2 border-[#6B705C] pl-2.5 py-1 rounded-r-lg font-medium italic">
                                    "{t.completionDetails}"
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                              {/* Edit Details & Status button */}
                              <button
                                onClick={() => setSelectedTaskForDetail({ planId: currentPlan.id, topic: t })}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-[#F2EFE9] text-[#6B705C] border border-[#E0DBD0] text-[11px] font-medium transition cursor-pointer shadow-2xs"
                                title="Edit what you did or change status"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit Details</span>
                              </button>

                              <button
                                onClick={() => onTogglePlanTopic && onTogglePlanTopic(currentPlan.id, t.id, false)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white text-[#A5A58D] hover:text-[#4A4E4D] border border-[#E0DBD0] text-[11px] transition shrink-0 cursor-pointer shadow-2xs"
                                title="Restore to assigned tasks"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Undo</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-[#E0DBD0]">
              <Sparkles className="w-8 h-8 text-[#A5A58D] mx-auto mb-2" />
              <p className="text-xs text-[#A5A58D]">No active study plan generated yet.</p>
              <p className="text-[11px] text-[#A5A58D] mt-1">Select an option above or switch to Paste Schedule to let AI craft your customized schedule.</p>
            </div>
          )}
        </div>
      )}

      {/* Task Completion Detail & State Modal */}
      {selectedTaskForDetail && (
        <TaskDetailModal
          isOpen={Boolean(selectedTaskForDetail)}
          onClose={() => setSelectedTaskForDetail(null)}
          planId={selectedTaskForDetail.planId}
          topic={selectedTaskForDetail.topic}
          onSaveCompletionDetails={(planId, topicId, details) => {
            if (onTogglePlanTopic) {
              onTogglePlanTopic(planId, topicId, true, details);
            }
          }}
        />
      )}
    </div>
  );
};
