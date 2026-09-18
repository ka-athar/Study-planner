import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Target, 
  Play, 
  Plus, 
  CheckCircle2, 
  ArrowRight, 
  RefreshCw, 
  BookOpen, 
  TrendingUp,
  Zap,
  Flame,
  Check
} from 'lucide-react';
import { Subject, StudyPlan, ActiveTab } from '../types';

export interface SuggestedGoal {
  id: string;
  title: string;
  description: string;
  subjectName: string;
  chapterName: string;
  topicName: string;
  estimatedMinutes: number;
  targetPercentBenefit: number;
  reason: string;
  badge: string;
  stageName: string;
}

interface SyllabusGoalSuggesterProps {
  subjects: Subject[];
  overallProgressPercent: number;
  totalTopics: number;
  completedTopicsCount: number;
  weakTopicsList: { subject: string; topic: string; notes?: string }[];
  todayPlan: StudyPlan | null;
  onAdoptGoal?: (goal: SuggestedGoal) => void;
  onStartTimerForTopic: (subjectName: string, chapterName: string, topicName: string) => void;
  setActiveTab: (tab: ActiveTab) => void;
}

export const SyllabusGoalSuggester: React.FC<SyllabusGoalSuggesterProps> = ({
  subjects,
  overallProgressPercent,
  totalTopics,
  completedTopicsCount,
  weakTopicsList,
  todayPlan,
  onAdoptGoal,
  onStartTimerForTopic,
  setActiveTab
}) => {
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [adoptedGoalId, setAdoptedGoalId] = useState<string | null>(null);

  // Generate candidate goals based on syllabus completion percentage and uncompleted topics
  const suggestedGoals: SuggestedGoal[] = useMemo(() => {
    const goals: SuggestedGoal[] = [];

    // Find uncompleted topics across subjects
    const uncompletedTopics: { subjectName: string; chapterName: string; topicName: string; isWeak: boolean }[] = [];
    
    subjects.forEach(sub => {
      sub.chapters.forEach(ch => {
        ch.topics.forEach(t => {
          if (t.status !== 'Completed' && t.status !== 'Mastered') {
            uncompletedTopics.push({
              subjectName: sub.name,
              chapterName: ch.name,
              topicName: t.name,
              isWeak: t.status === 'Weak' || t.status === 'Needs Revision'
            });
          }
        });
      });
    });

    const percent = overallProgressPercent;
    const remainingCount = totalTopics - completedTopicsCount;

    // Stage definition based on syllabus completion percentage
    let stageName = 'Foundation Kickstart';
    let stageBadge = '0-25% Milestone';
    let defaultTime = 25;

    if (percent >= 90) {
      stageName = 'Final Mastery Polish';
      stageBadge = '90%+ Peak Readiness';
      defaultTime = 20;
    } else if (percent >= 60) {
      stageName = 'High-Yield Acceleration';
      stageBadge = '60-90% Deep Sprint';
      defaultTime = 40;
    } else if (percent >= 25) {
      stageName = 'Core Momentum Builder';
      stageBadge = '25-60% Expansion';
      defaultTime = 30;
    }

    if (uncompletedTopics.length > 0) {
      // Prioritize weak topics first, then first few uncompleted
      const sortedCandidates = [...uncompletedTopics].sort((a, b) => (b.isWeak ? 1 : 0) - (a.isWeak ? 1 : 0));
      
      sortedCandidates.slice(0, 5).forEach((cand, idx) => {
        const estMins = defaultTime + (idx % 2 === 1 ? 15 : 0);
        const nextPct = Math.min(100, Math.round(((completedTopicsCount + 1) / Math.max(1, totalTopics)) * 100));
        
        let title = `Study "${cand.topicName}" (${estMins}m)`;
        let reason = `At ${percent}% syllabus completion, completing this topic pushes your overall progress to ${nextPct}%.`;
        
        if (cand.isWeak) {
          title = `Strengthen Weak Topic: "${cand.topicName}"`;
          reason = `You have flagged this as weak. Clearing it now eliminates gaps and boosts syllabus mastery from ${percent}%.`;
        }

        goals.push({
          id: `goal-sugg-${idx}-${cand.topicName.replace(/\s+/g, '-').toLowerCase()}`,
          title,
          description: `Focus on ${cand.subjectName} > ${cand.chapterName}. Target a focused single-session completion.`,
          subjectName: cand.subjectName,
          chapterName: cand.chapterName,
          topicName: cand.topicName,
          estimatedMinutes: estMins,
          targetPercentBenefit: nextPct,
          reason,
          badge: stageBadge,
          stageName
        });
      });
    }

    // Fallback if syllabus is 100% or empty
    if (goals.length === 0) {
      const fallbackSubject = subjects[0]?.name || 'General';
      const fallbackChapter = subjects[0]?.chapters[0]?.name || 'Overview';
      const fallbackTopic = subjects[0]?.chapters[0]?.topics[0]?.name || 'Rapid Concept Recall';

      goals.push({
        id: 'goal-sugg-fallback-1',
        title: percent >= 100 ? '20m Active Recall & Spaced Repetition Sprint' : 'Complete 1 Key Concept Sprint (25m)',
        description: percent >= 100 
          ? 'You have reached 100% syllabus coverage! Do a quick retention review to lock in long-term memory.'
          : 'Start building syllabus momentum with a single 25-minute Pomodoro study block.',
        subjectName: fallbackSubject,
        chapterName: fallbackChapter,
        topicName: fallbackTopic,
        estimatedMinutes: 25,
        targetPercentBenefit: percent >= 100 ? 100 : Math.min(100, percent + 5),
        reason: `Tailored for ${percent}% syllabus status. Keeps your daily study streak alive with minimal friction.`,
        badge: stageBadge,
        stageName
      });
    }

    return goals;
  }, [subjects, overallProgressPercent, totalTopics, completedTopicsCount]);

  const activeGoal = suggestedGoals[suggestionIndex % suggestedGoals.length];

  const handleNextSuggestion = () => {
    setSuggestionIndex(prev => (prev + 1) % suggestedGoals.length);
  };

  const handleAdopt = () => {
    if (!activeGoal) return;
    setAdoptedGoalId(activeGoal.id);
    if (onAdoptGoal) {
      onAdoptGoal(activeGoal);
    }
  };

  if (!activeGoal) return null;

  return (
    <motion.div
      id="mini-syllabus-goal-suggester"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="p-5 rounded-3xl bg-gradient-to-br from-[#FAF8F5] via-white to-[#F2EFE9] border border-[#E0DBD0] shadow-xs relative overflow-hidden space-y-4"
    >
      {/* Background ambient decoration */}
      <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-[#6B705C]/5 rounded-full blur-2xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#6B705C]/10 text-[#6B705C] flex items-center justify-center font-bold">
            <Sparkles className="w-4 h-4 text-[#6B705C]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#6B705C]/10 text-[#6B705C] uppercase tracking-wider font-mono">
                AI Micro-Goal Suggester
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                {activeGoal.badge}
              </span>
            </div>
            <h4 className="text-xs font-bold text-[#4A4E4D] uppercase tracking-widest mt-0.5">
              No Active Goals Set • Suggested Next Step
            </h4>
          </div>
        </div>

        {/* Syllabus Progress Context Badge */}
        <div className="flex items-center gap-2 text-xs self-start sm:self-auto">
          <div className="px-3 py-1.5 rounded-2xl bg-white border border-[#E0DBD0] flex items-center gap-1.5 shadow-2xs font-mono">
            <TrendingUp className="w-3.5 h-3.5 text-[#6B705C]" />
            <span className="text-[#A5A58D]">Syllabus:</span>
            <span className="font-bold text-[#6B705C]">{overallProgressPercent}%</span>
            <span className="text-[#A5A58D]">({completedTopicsCount}/{totalTopics})</span>
          </div>
          {suggestedGoals.length > 1 && (
            <button
              onClick={handleNextSuggestion}
              className="p-1.5 rounded-xl bg-white hover:bg-[#F2EFE9] border border-[#E0DBD0] text-[#A5A58D] hover:text-[#4A4E4D] transition cursor-pointer shadow-2xs"
              title="Cycle to another suggested small goal"
              aria-label="Cycle suggestion"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Suggested Goal Content Box */}
      <div className="p-4 rounded-2xl bg-white border border-[#E0DBD0] shadow-2xs space-y-2.5 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-serif font-bold text-[#6B705C] flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-[#6B705C]" />
                <span>{activeGoal.title}</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.2 rounded-md bg-[#F2EFE9] text-[#6B705C] font-semibold">
                ~{activeGoal.estimatedMinutes} mins
              </span>
            </div>
            <p className="text-xs text-[#4A4E4D] font-medium leading-relaxed">
              {activeGoal.description}
            </p>
            <p className="text-[11px] text-[#A5A58D] italic">
              💡 {activeGoal.reason}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-2 border-t border-[#F2EFE9] flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] font-mono text-[#A5A58D]">
            Subject: <span className="font-semibold text-[#4A4E4D]">{activeGoal.subjectName}</span>
          </div>

          <div className="flex items-center gap-2">
            {adoptedGoalId === activeGoal.id ? (
              <div className="px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5 animate-fade-in">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Goal Adopted into Today's Plan!</span>
              </div>
            ) : (
              <button
                id="btn-adopt-suggested-goal"
                onClick={handleAdopt}
                className="px-3.5 py-1.5 rounded-full bg-[#F2EFE9] hover:bg-[#EAE7DF] text-[#6B705C] border border-[#E0DBD0] text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Add this goal to today's focus agenda"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adopt as Today's Goal</span>
              </button>
            )}

            <button
              id="btn-start-timer-suggested-goal"
              onClick={() => onStartTimerForTopic(activeGoal.subjectName, activeGoal.chapterName, activeGoal.topicName)}
              className="px-4 py-1.5 rounded-full bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
              title="Start study timer directly on this topic"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Timer ({activeGoal.estimatedMinutes}m)</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
