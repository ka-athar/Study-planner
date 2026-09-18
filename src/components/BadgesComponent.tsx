import React, { useState, useMemo } from 'react';
import { 
  Award, 
  Flame, 
  Trophy, 
  Star, 
  Clock, 
  Sparkles, 
  CheckCircle2, 
  Lock, 
  Share2, 
  Brain, 
  Zap, 
  BookOpen, 
  Sunrise, 
  Moon, 
  Target, 
  Check,
  ChevronRight,
  ShieldCheck,
  TrendingUp,
  Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  StudySession, 
  Subject, 
  TestResult, 
  RevisionItem, 
  ActivityLog, 
  UserProfile, 
  StudyBadge,
  ActiveTab
} from '../types';

interface BadgesComponentProps {
  sessions: StudySession[];
  subjects: Subject[];
  testResults: TestResult[];
  revisions: RevisionItem[];
  activityLogs?: ActivityLog[];
  userProfile: UserProfile | null;
  setActiveTab?: (tab: ActiveTab) => void;
}

export const BadgesComponent: React.FC<BadgesComponentProps> = ({
  sessions = [],
  subjects = [],
  testResults = [],
  revisions = [],
  activityLogs = [],
  userProfile,
  setActiveTab
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterUnlockedOnly, setFilterUnlockedOnly] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [selectedBadge, setSelectedBadge] = useState<StudyBadge | null>(null);
  const [copiedShare, setCopiedShare] = useState<boolean>(false);

  // 1. Calculate overall study statistics for badge evaluation
  const stats = useMemo(() => {
    // Total Minutes & Hours
    const totalMinutes = sessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
    const totalHours = Number((totalMinutes / 60).toFixed(1));

    // Unique days with study sessions
    const datesWithStudy = new Set(sessions.map(s => s.date).filter(Boolean));

    // Calculate Current & Max Consecutive Day Streak
    const sortedDates = Array.from(datesWithStudy).sort();
    let currentStreak = 0;
    let maxStreak = 0;

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Check if user studied today or yesterday to maintain active streak
    let checkDate = datesWithStudy.has(todayStr) ? new Date() : (datesWithStudy.has(yesterdayStr) ? yesterday : null);

    if (checkDate) {
      let tempStreak = 0;
      let d = new Date(checkDate);
      while (true) {
        const dateStr = d.toISOString().split('T')[0];
        if (datesWithStudy.has(dateStr)) {
          tempStreak++;
          d.setDate(d.getDate() - 1);
        } else {
          break;
        }
      }
      currentStreak = tempStreak;
    }

    // Calculate all-time max streak
    let tempMax = 0;
    if (sortedDates.length > 0) {
      let prevDate = new Date(sortedDates[0] + 'T00:00:00');
      let runningStreak = 1;
      tempMax = 1;

      for (let i = 1; i < sortedDates.length; i++) {
        const curDate = new Date(sortedDates[i] + 'T00:00:00');
        const diffDays = Math.round((curDate.getTime() - prevDate.getTime()) / (1000 * 3600 * 24));
        if (diffDays === 1) {
          runningStreak++;
          if (runningStreak > tempMax) tempMax = runningStreak;
        } else if (diffDays > 1) {
          runningStreak = 1;
        }
        prevDate = curDate;
      }
    }
    maxStreak = Math.max(currentStreak, tempMax);

    // Max Single Focus Session
    const longestSessionMinutes = sessions.reduce((max, s) => Math.max(max, s.durationMinutes || 0), 0);

    // Distinct subjects studied
    const studiedSubjectNames = new Set(sessions.map(s => s.subjectName).filter(Boolean));

    // Completed syllabus topics
    let completedTopicsCount = 0;
    subjects.forEach(sub => {
      sub.chapters?.forEach(ch => {
        ch.topics?.forEach(tp => {
          if (tp.completed) completedTopicsCount++;
        });
      });
    });

    // High scoring test results (>= 80%)
    const highScoringTests = testResults.filter(t => (t.score / (t.maxScore || 100)) >= 0.8).length;

    // Completed revisions
    const completedRevisionsCount = revisions.filter(r => r.status === 'completed').length;

    // Early Bird & Night Owl Sessions
    let earlyBirdSessions = 0;
    let nightOwlSessions = 0;
    sessions.forEach(s => {
      if (s.timestamp) {
        const hour = new Date(s.timestamp).getHours();
        if (hour >= 4 && hour < 9) earlyBirdSessions++;
        if (hour >= 21 || hour < 3) nightOwlSessions++;
      }
    });

    // Days target reached
    const targetHours = userProfile?.targetHoursPerDay || 3;
    let daysTargetMet = 0;
    const dailyMinsMap: { [d: string]: number } = {};
    sessions.forEach(s => {
      if (s.date) {
        dailyMinsMap[s.date] = (dailyMinsMap[s.date] || 0) + (s.durationMinutes || 0);
      }
    });
    Object.values(dailyMinsMap).forEach(mins => {
      if (mins >= targetHours * 60) daysTargetMet++;
    });

    return {
      totalHours,
      totalMinutes,
      currentStreak: Math.max(1, currentStreak),
      maxStreak: Math.max(1, maxStreak),
      longestSessionMinutes,
      distinctSubjects: studiedSubjectNames.size,
      completedTopicsCount,
      highScoringTests,
      completedRevisionsCount,
      earlyBirdSessions,
      nightOwlSessions,
      daysTargetMet
    };
  }, [sessions, subjects, testResults, revisions, userProfile]);

  // 2. Define Badge Definitions & Milestone Evaluations
  const badges: StudyBadge[] = useMemo(() => {
    const list: StudyBadge[] = [
      // HOURS MILESTONES
      {
        id: 'hours_first_step',
        title: 'First Step',
        description: 'Complete your first 1 hour of focused study.',
        category: 'hours',
        tier: 'bronze',
        icon: '🌱',
        requirement: 1,
        currentValue: stats.totalHours,
        unlocked: stats.totalHours >= 1,
        unit: 'hours'
      },
      {
        id: 'hours_10_logged',
        title: '10 Hours Logged',
        description: 'Accumulate 10 total hours of deep study time.',
        category: 'hours',
        tier: 'bronze',
        icon: '⏳',
        requirement: 10,
        currentValue: stats.totalHours,
        unlocked: stats.totalHours >= 10,
        unit: 'hours'
      },
      {
        id: 'hours_25_scholar',
        title: 'Dedicated Scholar',
        description: 'Log 25 total hours in the academic timer.',
        category: 'hours',
        tier: 'silver',
        icon: '📚',
        requirement: 25,
        currentValue: stats.totalHours,
        unlocked: stats.totalHours >= 25,
        unit: 'hours'
      },
      {
        id: 'hours_50_master',
        title: 'Focus Virtuoso',
        description: 'Surpass 50 hours of verified study sessions.',
        category: 'hours',
        tier: 'gold',
        icon: '⚡',
        requirement: 50,
        currentValue: stats.totalHours,
        unlocked: stats.totalHours >= 50,
        unit: 'hours'
      },
      {
        id: 'hours_100_century',
        title: 'Century Mind',
        description: 'Reach the pinnacle milestone of 100 hours logged.',
        category: 'hours',
        tier: 'diamond',
        icon: '👑',
        requirement: 100,
        currentValue: stats.totalHours,
        unlocked: stats.totalHours >= 100,
        unit: 'hours'
      },

      // STREAK & CONSISTENCY MILESTONES
      {
        id: 'streak_3_habit',
        title: 'Habit Builder',
        description: 'Maintain study consistency for 3 consecutive days.',
        category: 'streak',
        tier: 'bronze',
        icon: '🔥',
        requirement: 3,
        currentValue: stats.maxStreak,
        unlocked: stats.maxStreak >= 3,
        unit: 'days'
      },
      {
        id: 'streak_5_consistency_king',
        title: 'Consistency King',
        description: 'Study for 5 days in a row without breaking the chain.',
        category: 'streak',
        tier: 'silver',
        icon: '🛡️',
        requirement: 5,
        currentValue: stats.maxStreak,
        unlocked: stats.maxStreak >= 5,
        unit: 'days'
      },
      {
        id: 'streak_7_weekly_titan',
        title: 'Weekly Titan',
        description: 'Complete a full 7-day study streak with zero missed days.',
        category: 'streak',
        tier: 'gold',
        icon: '⚡',
        requirement: 7,
        currentValue: stats.maxStreak,
        unlocked: stats.maxStreak >= 7,
        unit: 'days'
      },
      {
        id: 'streak_14_iron_will',
        title: 'Iron Will',
        description: 'Achieve a legendary 14-day consecutive study streak.',
        category: 'streak',
        tier: 'diamond',
        icon: '💎',
        requirement: 14,
        currentValue: stats.maxStreak,
        unlocked: stats.maxStreak >= 14,
        unit: 'days'
      },

      // DISCIPLINE & FOCUS SESSIONS
      {
        id: 'session_marathon',
        title: 'Deep Diver',
        description: 'Complete an uninterrupted focus session of 60+ minutes.',
        category: 'discipline',
        tier: 'silver',
        icon: '🎯',
        requirement: 60,
        currentValue: stats.longestSessionMinutes,
        unlocked: stats.longestSessionMinutes >= 60,
        unit: 'mins'
      },
      {
        id: 'daily_goal_champion',
        title: 'Target Crusher',
        description: 'Hit your daily target hours goal on 3 distinct days.',
        category: 'discipline',
        tier: 'silver',
        icon: '🏆',
        requirement: 3,
        currentValue: stats.daysTargetMet,
        unlocked: stats.daysTargetMet >= 3,
        unit: 'days'
      },
      {
        id: 'early_bird',
        title: 'Sunrise Scholar',
        description: 'Complete at least 1 study session before 9:00 AM.',
        category: 'discipline',
        tier: 'bronze',
        icon: '🌅',
        requirement: 1,
        currentValue: stats.earlyBirdSessions,
        unlocked: stats.earlyBirdSessions >= 1,
        unit: 'sessions'
      },
      {
        id: 'night_owl',
        title: 'Night Owl Focus',
        description: 'Complete a late-night study session after 9:00 PM.',
        category: 'discipline',
        tier: 'bronze',
        icon: '🌙',
        requirement: 1,
        currentValue: stats.nightOwlSessions,
        unlocked: stats.nightOwlSessions >= 1,
        unit: 'sessions'
      },

      // MASTERY & ACADEMIC ACHIEVEMENTS
      {
        id: 'mastery_polymath',
        title: 'Academic Polymath',
        description: 'Diversify learning by logging study time across 3+ subjects.',
        category: 'mastery',
        tier: 'silver',
        icon: '🌐',
        requirement: 3,
        currentValue: stats.distinctSubjects,
        unlocked: stats.distinctSubjects >= 3,
        unit: 'subjects'
      },
      {
        id: 'mastery_quiz_ace',
        title: 'Assessment Ace',
        description: 'Score 80% or higher on at least 2 practice test exams.',
        category: 'mastery',
        tier: 'gold',
        icon: '📝',
        requirement: 2,
        currentValue: stats.highScoringTests,
        unlocked: stats.highScoringTests >= 2,
        unit: 'tests'
      },
      {
        id: 'mastery_retention_guru',
        title: 'Memory Master',
        description: 'Complete 5 spaced repetition revision cards.',
        category: 'mastery',
        tier: 'gold',
        icon: '🧠',
        requirement: 5,
        currentValue: stats.completedRevisionsCount,
        unlocked: stats.completedRevisionsCount >= 5,
        unit: 'revisions'
      }
    ];

    return list;
  }, [stats]);

  // Filtered badges
  const filteredBadges = useMemo(() => {
    return badges.filter(b => {
      // Category match
      if (selectedCategory !== 'all' && b.category !== selectedCategory) {
        return false;
      }
      // Status match
      if (filterUnlockedOnly === 'unlocked' && !b.unlocked) return false;
      if (filterUnlockedOnly === 'locked' && b.unlocked) return false;
      return true;
    });
  }, [badges, selectedCategory, filterUnlockedOnly]);

  const unlockedCount = badges.filter(b => b.unlocked).length;
  const totalBadgesCount = badges.length;
  const overallUnlockedPct = Math.round((unlockedCount / totalBadgesCount) * 100);

  // Find next closest badge to unlock
  const nextBadgeToUnlock = useMemo(() => {
    const locked = badges.filter(b => !b.unlocked);
    if (locked.length === 0) return null;
    return locked.sort((a, b) => {
      const pctA = Math.min(1, a.currentValue / a.requirement);
      const pctB = Math.min(1, b.currentValue / b.requirement);
      return pctB - pctA;
    })[0];
  }, [badges]);

  // Tier color styling helper
  const getTierBadgeStyle = (tier: StudyBadge['tier'], unlocked: boolean) => {
    if (!unlocked) {
      return {
        cardBg: 'bg-[#F9F7F2]/70 border-[#E0DBD0]/80 text-[#A5A58D]',
        emblemBg: 'bg-[#EAE7DF] text-[#A5A58D] border-[#E0DBD0]',
        tagBg: 'bg-[#EAE7DF] text-[#A5A58D]'
      };
    }
    switch (tier) {
      case 'diamond':
        return {
          cardBg: 'bg-gradient-to-br from-cyan-50/70 to-blue-50/40 border-cyan-200 text-[#4A4E4D]',
          emblemBg: 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-xs',
          tagBg: 'bg-cyan-100 text-cyan-800 border-cyan-200'
        };
      case 'gold':
        return {
          cardBg: 'bg-gradient-to-br from-amber-50/70 to-yellow-50/40 border-amber-200 text-[#4A4E4D]',
          emblemBg: 'bg-gradient-to-tr from-amber-500 to-yellow-600 text-white shadow-xs',
          tagBg: 'bg-amber-100 text-amber-900 border-amber-200'
        };
      case 'silver':
        return {
          cardBg: 'bg-gradient-to-br from-slate-50 to-stone-50 border-slate-300 text-[#4A4E4D]',
          emblemBg: 'bg-gradient-to-tr from-slate-500 to-stone-600 text-white shadow-xs',
          tagBg: 'bg-slate-100 text-slate-800 border-slate-200'
        };
      case 'bronze':
      default:
        return {
          cardBg: 'bg-gradient-to-br from-[#6B705C]/5 to-[#B7B7A4]/10 border-[#B7B7A4]/50 text-[#4A4E4D]',
          emblemBg: 'bg-[#6B705C] text-white shadow-xs',
          tagBg: 'bg-[#6B705C]/10 text-[#6B705C] border-[#6B705C]/20'
        };
    }
  };

  const handleShareBadge = (badge: StudyBadge) => {
    const text = `🏆 I just earned the "${badge.title}" badge on StudyFlow Academic Assistant! (${badge.description})`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    });
  };

  return (
    <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-6">
      {/* Top Header & Milestone Stats Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E0DBD0] pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-serif italic font-bold text-[#4A4E4D]">
                Academic Milestones & Digital Badges
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#F2EFE9] text-[#6B705C] border border-[#E0DBD0]">
                {unlockedCount}/{totalBadgesCount} Unlocked
              </span>
            </div>
            <p className="text-xs text-[#A5A58D] mt-0.5">
              Earn permanent digital emblems as you accumulate focus hours, build study streaks, and master subjects.
            </p>
          </div>
        </div>

        {/* Quick Highlights: Streak & Total Hours */}
        <div className="flex items-center gap-3 self-start lg:self-auto">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
            <Flame className="w-4 h-4 fill-amber-500 text-amber-500" />
            <span>{stats.maxStreak} Day Best Streak</span>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-[#4A4E4D] text-xs font-semibold">
            <Clock className="w-4 h-4 text-[#6B705C]" />
            <span>{stats.totalHours}h Total Logged</span>
          </div>
        </div>
      </div>

      {/* Overview Progress & Next Target Banner */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left: Overall Completion Bar */}
        <div className="md:col-span-6 p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-[#4A4E4D] flex items-center gap-1.5">
              <Award className="w-4 h-4 text-[#6B705C]" /> Milestone Completion
            </span>
            <span className="text-xs font-mono font-bold text-[#6B705C]">
              {overallUnlockedPct}% Completed
            </span>
          </div>

          <div className="w-full bg-[#EAE7DF] h-2.5 rounded-full overflow-hidden border border-[#E0DBD0]">
            <div
              className="bg-[#6B705C] h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${overallUnlockedPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-[#A5A58D]">
            <span>{unlockedCount} Badges Earned</span>
            <span>{totalBadgesCount - unlockedCount} Badges Locked</span>
          </div>
        </div>

        {/* Right: Next Closest Badge to Unlock */}
        <div className="md:col-span-6 p-4 rounded-2xl bg-[#F2EFE9] border border-[#E0DBD0] flex flex-col justify-between gap-2.5">
          {nextBadgeToUnlock ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#6B705C] flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Next Recommended Milestone
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-white border border-[#E0DBD0] text-[#4A4E4D]">
                  {nextBadgeToUnlock.tier}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white border border-[#E0DBD0] flex items-center justify-center text-lg shadow-2xs shrink-0">
                  {nextBadgeToUnlock.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-[#4A4E4D] truncate">
                    {nextBadgeToUnlock.title}
                  </div>
                  <div className="text-[11px] text-[#A5A58D] truncate">
                    {nextBadgeToUnlock.description}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-bold text-[#6B705C]">
                    {nextBadgeToUnlock.currentValue}/{nextBadgeToUnlock.requirement} {nextBadgeToUnlock.unit}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-emerald-800 text-xs font-semibold py-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Incredible achievement! You have unlocked all available milestones!</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter Tabs & Category Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all', label: 'All Badges' },
            { id: 'hours', label: 'Study Hours' },
            { id: 'streak', label: 'Streaks & Consistency' },
            { id: 'discipline', label: 'Discipline' },
            { id: 'mastery', label: 'Academic Mastery' }
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-[#6B705C] text-white shadow-2xs'
                  : 'bg-[#F9F7F2] text-[#4A4E4D] border border-[#E0DBD0] hover:bg-[#F2EFE9]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Lock / Unlock Toggle Filter */}
        <div className="flex items-center gap-1 bg-[#F9F7F2] p-1 rounded-xl border border-[#E0DBD0] self-start sm:self-auto">
          <button
            onClick={() => setFilterUnlockedOnly('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
              filterUnlockedOnly === 'all' ? 'bg-white text-[#4A4E4D] shadow-2xs' : 'text-[#A5A58D]'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterUnlockedOnly('unlocked')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
              filterUnlockedOnly === 'unlocked' ? 'bg-white text-emerald-700 shadow-2xs font-semibold' : 'text-[#A5A58D]'
            }`}
          >
            Earned ({unlockedCount})
          </button>
          <button
            onClick={() => setFilterUnlockedOnly('locked')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
              filterUnlockedOnly === 'locked' ? 'bg-white text-[#4A4E4D] shadow-2xs' : 'text-[#A5A58D]'
            }`}
          >
            Locked
          </button>
        </div>
      </div>

      {/* Badges Grid Display */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredBadges.map((badge) => {
          const styles = getTierBadgeStyle(badge.tier, badge.unlocked);
          const progressPct = Math.min(100, Math.round((badge.currentValue / badge.requirement) * 100));

          return (
            <motion.div
              key={badge.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSelectedBadge(badge)}
              className={`p-4 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between gap-3 cursor-pointer hover:shadow-xs hover:border-[#6B705C]/60 ${styles.cardBg}`}
            >
              {/* Top Row: Icon & Status Lock */}
              <div className="flex items-start justify-between">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border ${styles.emblemBg}`}>
                  {badge.icon}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${styles.tagBg}`}>
                    {badge.tier}
                  </span>
                  {badge.unlocked ? (
                    <div className="p-1 rounded-full bg-emerald-100 text-emerald-700" title="Unlocked!">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div className="p-1 rounded-full bg-[#EAE7DF] text-[#A5A58D]" title="In Progress">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-1">
                <h4 className="text-sm font-bold leading-tight text-[#4A4E4D]">
                  {badge.title}
                </h4>
                <p className="text-xs text-[#A5A58D] leading-snug line-clamp-2">
                  {badge.description}
                </p>
              </div>

              {/* Progress Indicator */}
              <div className="space-y-1.5 pt-1 border-t border-[#E0DBD0]/60">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className={badge.unlocked ? 'text-emerald-700 font-bold' : 'text-[#A5A58D]'}>
                    {badge.unlocked ? 'Earned' : `${badge.currentValue} / ${badge.requirement} ${badge.unit}`}
                  </span>
                  <span className="text-[#6B705C] font-semibold">
                    {progressPct}%
                  </span>
                </div>

                <div className="w-full bg-[#EAE7DF] h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      badge.unlocked ? 'bg-emerald-600' : 'bg-[#6B705C]'
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Badge Detail / Showcase Modal */}
      <AnimatePresence>
        {selectedBadge && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[#E0DBD0] rounded-3xl p-6 max-w-md w-full shadow-lg space-y-5"
            >
              {/* Modal Top */}
              <div className="flex items-center justify-between border-b border-[#E0DBD0] pb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#6B705C]" />
                  <span className="text-xs font-bold uppercase tracking-widest text-[#6B705C]">
                    Badge Showcase
                  </span>
                </div>
                <button
                  onClick={() => setSelectedBadge(null)}
                  className="text-xs text-[#A5A58D] hover:text-[#4A4E4D] cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Center Emblem */}
              <div className="text-center space-y-3 py-2">
                <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center text-4xl shadow-md border ${
                  selectedBadge.unlocked 
                    ? 'bg-gradient-to-tr from-[#6B705C] to-[#A5A58D] text-white border-transparent' 
                    : 'bg-[#F2EFE9] text-[#A5A58D] border-[#E0DBD0]'
                }`}>
                  {selectedBadge.icon}
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg font-serif italic font-bold text-[#4A4E4D]">
                    {selectedBadge.title}
                  </h3>
                  <div className="flex items-center justify-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-[#F2EFE9] text-[#6B705C] border border-[#E0DBD0]">
                      {selectedBadge.tier} Tier
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-[#F2EFE9] text-[#A5A58D] border border-[#E0DBD0]">
                      {selectedBadge.category}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-[#4A4E4D] px-4 leading-relaxed">
                  {selectedBadge.description}
                </p>
              </div>

              {/* Progress Box */}
              <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#4A4E4D]">
                    Milestone Requirement:
                  </span>
                  <span className="font-mono text-[#6B705C] font-semibold">
                    {selectedBadge.requirement} {selectedBadge.unit}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#A5A58D]">
                    Current Progress:
                  </span>
                  <span className="font-mono font-bold text-[#4A4E4D]">
                    {selectedBadge.currentValue} {selectedBadge.unit} ({Math.min(100, Math.round((selectedBadge.currentValue / selectedBadge.requirement) * 100))}%)
                  </span>
                </div>

                <div className="w-full bg-[#EAE7DF] h-2 rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full rounded-full ${selectedBadge.unlocked ? 'bg-emerald-600' : 'bg-[#6B705C]'}`}
                    style={{ width: `${Math.min(100, Math.round((selectedBadge.currentValue / selectedBadge.requirement) * 100))}%` }}
                  />
                </div>

                {selectedBadge.unlocked ? (
                  <div className="pt-2 text-center text-xs font-semibold text-emerald-800 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Unlocked & Added to Academic Profile</span>
                  </div>
                ) : (
                  <div className="pt-2 text-center text-xs text-[#A5A58D] flex items-center justify-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    <span>
                      Need {Math.max(0, Number((selectedBadge.requirement - selectedBadge.currentValue).toFixed(1)))} more {selectedBadge.unit} to unlock
                    </span>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E0DBD0]">
                {selectedBadge.unlocked ? (
                  <button
                    onClick={() => handleShareBadge(selectedBadge)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-semibold transition cursor-pointer shadow-2xs"
                  >
                    {copiedShare ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                    <span>{copiedShare ? 'Copied to Clipboard!' : 'Share Achievement'}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setSelectedBadge(null);
                      if (setActiveTab) setActiveTab('timer');
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-semibold transition cursor-pointer shadow-2xs"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Start Study Session</span>
                  </button>
                )}

                <button
                  onClick={() => setSelectedBadge(null)}
                  className="px-4 py-2.5 rounded-2xl bg-[#F2EFE9] text-[#4A4E4D] hover:bg-[#EAE7DF] text-xs font-semibold transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
