import React, { useState, useMemo } from 'react';
import { 
  Play, 
  Flame, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  Sparkles, 
  ArrowRight,
  BookOpen,
  Calendar,
  Layers,
  Check,
  RotateCw,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  StudyPlan, 
  StudyPlanTopic, 
  Subject, 
  RevisionItem, 
  UserProfile, 
  ActiveTab,
  StudySession
} from '../types';

interface UrgentStudyPriorityCardProps {
  plans: StudyPlan[];
  subjects: Subject[];
  revisions: RevisionItem[];
  userProfile: UserProfile | null;
  sessions: StudySession[];
  setActiveTab: (tab: ActiveTab) => void;
  onStartTimerForTopic: (subjectName: string, chapterName: string, topicName: string) => void;
  onMarkTopicComplete?: (planId: string, topicId: string) => void;
}

export const UrgentStudyPriorityCard: React.FC<UrgentStudyPriorityCardProps> = ({
  plans = [],
  subjects = [],
  revisions = [],
  userProfile,
  sessions = [],
  setActiveTab,
  onStartTimerForTopic,
  onMarkTopicComplete
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [completedTopicIds, setCompletedTopicIds] = useState<Set<string>>(new Set());

  // Today's Date String (YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayFormatted = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  }, []);

  // 1. Find or evaluate today's urgent study items
  const urgentItems = useMemo(() => {
    const list: {
      id: string;
      planId?: string;
      source: 'today_plan' | 'upcoming_plan' | 'revision' | 'weak_topic' | 'exam_prep';
      subjectName: string;
      chapterName: string;
      topicName: string;
      estimatedMinutes: number;
      priority: 'High' | 'Medium' | 'Low';
      reason: string;
      completed: boolean;
      contextBadge?: string;
    }[] = [];

    // A. Check today's plan
    const todayPlan = plans.find(p => p.date === todayStr);
    if (todayPlan && todayPlan.topics && todayPlan.topics.length > 0) {
      todayPlan.topics.forEach((t) => {
        const isDone = Boolean(t.completed) || completedTopicIds.has(t.id);
        list.push({
          id: t.id,
          planId: todayPlan.id,
          source: 'today_plan',
          subjectName: t.subjectName,
          chapterName: t.chapterName,
          topicName: t.topicName,
          estimatedMinutes: t.estimatedMinutes || 45,
          priority: t.priority || 'High',
          reason: t.reason || "Scheduled in today's daily focus plan.",
          completed: isDone,
          contextBadge: "Today's Daily Plan"
        });
      });
    }

    // B. Check urgent spaced-repetition revisions due today or overdue
    const pendingRevs = revisions.filter(r => r.status === 'Pending');
    pendingRevs.slice(0, 3).forEach((rev) => {
      // Avoid duplicate topic if already in plan
      if (!list.some(item => (item.topicName || '').toLowerCase() === (rev.topicName || '').toLowerCase())) {
        list.push({
          id: `rev-${rev.id}`,
          source: 'revision',
          subjectName: rev.subjectName,
          chapterName: rev.chapterName || 'Revision',
          topicName: rev.topicName,
          estimatedMinutes: 30,
          priority: 'High',
          reason: `Spaced repetition interval due.`,
          completed: false,
          contextBadge: "Scheduled Revision"
        });
      }
    });

    // C. If list is still empty or user has upcoming plans, check recent uncompleted plans
    if (list.length === 0) {
      const otherPlans = plans.filter(p => p.date !== todayStr);
      otherPlans.forEach(p => {
        p.topics?.forEach(t => {
          if (!t.completed && !completedTopicIds.has(t.id)) {
            list.push({
              id: t.id,
              planId: p.id,
              source: 'upcoming_plan',
              subjectName: t.subjectName,
              chapterName: t.chapterName,
              topicName: t.topicName,
              estimatedMinutes: t.estimatedMinutes || 45,
              priority: t.priority || 'Medium',
              reason: `From study plan dated ${p.date}.`,
              completed: false,
              contextBadge: `Plan (${p.date})`
            });
          }
        });
      });
    }

    // D. Fallback to Weakest Syllabus topics if no plans exist yet
    if (list.length === 0) {
      subjects.forEach(sub => {
        sub.chapters?.forEach(ch => {
          ch.topics?.forEach(tp => {
            if (tp.status === 'Weak' || tp.status === 'Needs Revision') {
              list.push({
                id: `weak-${tp.id}`,
                source: 'weak_topic',
                subjectName: sub.name,
                chapterName: ch.name,
                topicName: tp.name,
                estimatedMinutes: tp.estimatedMinutes || 45,
                priority: 'High',
                reason: tp.weakNotes || 'Marked as struggling/weak in syllabus diagnostic.',
                completed: false,
                contextBadge: "Syllabus Weak Point"
              });
            }
          });
        });
      });
    }

    // E. Final Fallback: First uncompleted topic from syllabus
    if (list.length === 0 && subjects.length > 0) {
      const firstSub = subjects[0];
      const firstCh = firstSub.chapters?.[0];
      const firstTp = firstCh?.topics?.[0];
      if (firstTp) {
        list.push({
          id: `fallback-${firstTp.id}`,
          source: 'exam_prep',
          subjectName: firstSub.name,
          chapterName: firstCh?.name || 'Chapter 1',
          topicName: firstTp.name,
          estimatedMinutes: 45,
          priority: 'High',
          reason: 'Next progressive syllabus topic ready for focused study.',
          completed: false,
          contextBadge: 'Recommended Next'
        });
      }
    }

    // Sort: uncompleted first, then High priority, then longer estimated time
    return list.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const prioOrder = { High: 3, Medium: 2, Low: 1 };
      const pDiff = (prioOrder[b.priority] || 2) - (prioOrder[a.priority] || 2);
      if (pDiff !== 0) return pDiff;
      return b.estimatedMinutes - a.estimatedMinutes;
    });
  }, [plans, todayStr, revisions, subjects, completedTopicIds]);

  // Current active urgent topic
  const activeItem = urgentItems[currentIndex % (urgentItems.length || 1)] || null;

  // Find subject emoji & metadata
  const subjectObj = useMemo(() => {
    if (!activeItem || !activeItem.subjectName) return null;
    return subjects.find(s => (s.name || '').toLowerCase() === (activeItem.subjectName || '').toLowerCase());
  }, [activeItem, subjects]);

  const handleQuickStart = () => {
    if (!activeItem) return;
    onStartTimerForTopic(activeItem.subjectName, activeItem.chapterName, activeItem.topicName);
  };

  const handleToggleComplete = () => {
    if (!activeItem) return;
    const newSet = new Set(completedTopicIds);
    if (newSet.has(activeItem.id)) {
      newSet.delete(activeItem.id);
    } else {
      newSet.add(activeItem.id);
    }
    setCompletedTopicIds(newSet);

    if (activeItem.planId && onMarkTopicComplete) {
      onMarkTopicComplete(activeItem.planId, activeItem.id);
    }
  };

  const handleNextPriority = () => {
    if (urgentItems.length > 1) {
      setCurrentIndex(prev => (prev + 1) % urgentItems.length);
    }
  };

  const isTodayPlanEmpty = !plans.some(p => p.date === todayStr);

  return (
    <div className="bg-gradient-to-br from-[#F4F1EA] via-white to-[#EAE6DD] border-2 border-[#6B705C]/30 rounded-3xl p-6 shadow-xs relative overflow-hidden">
      {/* Decorative top-right badge */}
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-[#6B705C]/5 rounded-full blur-xl pointer-events-none" />

      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E0DBD0] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 flex items-center justify-center">
            <Flame className="w-5 h-5 fill-amber-500 text-amber-600 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-900 bg-amber-100/80 border border-amber-200 px-2 py-0.5 rounded-full">
                🚨 Most Urgent Study Item Today
              </span>
              <span className="text-xs font-mono text-[#A5A58D]">
                • {todayFormatted}
              </span>
            </div>
            <p className="text-xs text-[#4A4E4D] mt-0.5 font-medium">
              High-impact priority matched to your syllabus progress, daily goals, and exam deadlines.
            </p>
          </div>
        </div>

        {/* Priority Navigation Stepper */}
        {urgentItems.length > 1 && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-mono text-[#A5A58D]">
              Item {((currentIndex % urgentItems.length) + 1)} of {urgentItems.length}
            </span>
            <button
              onClick={handleNextPriority}
              className="p-1.5 rounded-xl bg-white border border-[#E0DBD0] hover:bg-[#F2EFE9] text-[#4A4E4D] text-xs font-semibold flex items-center gap-1 transition cursor-pointer shadow-2xs"
              title="View next priority item"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Next Topic</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Focus Highlight Box */}
      {activeItem ? (
        <div className="mt-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 bg-white border border-[#E0DBD0] rounded-2xl p-5 shadow-xs">
            {/* Topic Info */}
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#F2EFE9] border border-[#E0DBD0] flex items-center justify-center text-3xl shrink-0 shadow-2xs">
                {subjectObj?.icon || '📚'}
              </div>

              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#6B705C] bg-[#6B705C]/10 px-2.5 py-0.5 rounded-md border border-[#6B705C]/20">
                    {activeItem.subjectName}
                  </span>
                  <span className="text-xs text-[#A5A58D] font-mono">
                    {activeItem.chapterName}
                  </span>
                  {activeItem.contextBadge && (
                    <span className="text-[10px] font-mono uppercase bg-[#F2EFE9] text-[#4A4E4D] px-2 py-0.5 rounded-md border border-[#E0DBD0]">
                      {activeItem.contextBadge}
                    </span>
                  )}
                  {activeItem.completed && (
                    <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Done
                    </span>
                  )}
                </div>

                <h3 className="text-lg sm:text-xl font-serif italic font-bold text-[#4A4E4D] leading-tight">
                  {activeItem.topicName}
                </h3>

                <p className="text-xs text-[#6B705C] leading-relaxed max-w-2xl">
                  <span className="font-semibold text-[#4A4E4D]">Focus Rationale:</span> {activeItem.reason}
                </p>
              </div>
            </div>

            {/* Quick-Start Timer CTA & Actions */}
            <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-2.5 shrink-0">
              <div className="flex items-center gap-2 text-xs font-mono text-[#6B705C] bg-[#F9F7F2] border border-[#E0DBD0] px-3 py-1.5 rounded-xl self-start sm:self-auto">
                <Clock className="w-4 h-4 text-[#6B705C]" />
                <span>Estimated Target: <strong>{activeItem.estimatedMinutes} mins</strong></span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleQuickStart}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-sm font-bold shadow-sm transition cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white text-white" />
                  <span>Start Focus Timer</span>
                </motion.button>

                <button
                  onClick={handleToggleComplete}
                  className={`p-3 rounded-2xl border transition cursor-pointer ${
                    activeItem.completed
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : 'bg-white text-[#A5A58D] hover:text-[#4A4E4D] border-[#E0DBD0] hover:bg-[#F2EFE9]'
                  }`}
                  title={activeItem.completed ? 'Mark uncompleted' : 'Mark completed'}
                >
                  <CheckCircle2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Context & Helper Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#A5A58D] pt-1">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-[#4A4E4D]">
                <Sparkles className="w-3.5 h-3.5 text-[#6B705C]" />
                <span>Timer will automatically log duration to Firebase upon session completion.</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('planner')}
                className="text-xs text-[#6B705C] hover:underline font-semibold flex items-center gap-1"
              >
                <span>Full Daily Planner</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <span>•</span>
              <button
                onClick={() => setActiveTab('syllabus')}
                className="text-xs text-[#6B705C] hover:underline font-semibold flex items-center gap-1"
              >
                <span>View Syllabus</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 p-5 rounded-2xl bg-white border border-[#E0DBD0] text-center space-y-3">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
          <h4 className="text-sm font-bold text-[#4A4E4D]">All Urgent Study Goals Completed For Today!</h4>
          <p className="text-xs text-[#A5A58D] max-w-md mx-auto">
            You have checked off all scheduled plan items. Generate a new study plan or explore upcoming revision cards.
          </p>
          <button
            onClick={() => setActiveTab('planner')}
            className="px-4 py-2 rounded-2xl bg-[#6B705C] text-white text-xs font-semibold hover:bg-[#5a5f4e] transition"
          >
            Create Study Plan
          </button>
        </div>
      )}
    </div>
  );
};
