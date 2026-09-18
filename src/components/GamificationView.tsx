import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { StudyRPGProfile, StudyQuest, Subject } from '../types';
import { getRankForXp, loadRPGProfile } from '../lib/rpgEngine';
import confetti from 'canvas-confetti';
import { 
  Trophy, 
  Flame, 
  ShieldCheck, 
  Sparkles, 
  Award, 
  CheckCircle2, 
  Clock, 
  ChevronRight,
  TrendingUp,
  Zap,
  Crown,
  BookOpen
} from 'lucide-react';

interface GamificationViewProps {
  profile?: StudyRPGProfile;
  rpgProfile?: StudyRPGProfile;
  onUpdateProfile?: (updated: StudyRPGProfile) => void;
  onUpdateRPGProfile?: (updated: StudyRPGProfile) => void;
  subjects?: Subject[];
  onStartTimerForTopic?: (subjectName: string, topicName: string) => void;
  onNavigateTab?: (tab: any) => void;
  onNavigateToStudyRoom?: () => void;
}

export const GamificationView: React.FC<GamificationViewProps> = ({
  profile,
  rpgProfile,
  onUpdateProfile,
  onUpdateRPGProfile,
  subjects = [],
  onStartTimerForTopic,
  onNavigateTab,
  onNavigateToStudyRoom
}) => {
  const [activeTab, setActiveTab] = useState<'quests' | 'badges' | 'subjects' | 'rewards'>('quests');
  const [notification, setNotification] = useState<string | null>(null);
  const [floatingXp, setFloatingXp] = useState<{ id: number; amount: number; text?: string } | null>(null);
  const [streakCelebration, setStreakCelebration] = useState(false);
  const [lastCheckInDate, setLastCheckInDate] = useState<string>(() => {
    return localStorage.getItem('studyflow_last_streak_checkin') || '';
  });

  // Safely resolve the active profile with guaranteed defaults
  const activeRPG: StudyRPGProfile = {
    ...loadRPGProfile(),
    ...(rpgProfile || profile || {})
  };

  const rankInfo = getRankForXp(activeRPG.xp ?? 0);

  const triggerCelebration = () => {
    try {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 }
      });
    } catch {
      // Confetti fallback
    }
  };

  const handleUpdate = (updated: StudyRPGProfile) => {
    if (onUpdateProfile) onUpdateProfile(updated);
    if (onUpdateRPGProfile) onUpdateRPGProfile(updated);
  };

  const handleCheckInStreak = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const newStreak = (activeRPG.streak ?? 0) + 1;
    const xpBonus = 35;
    const gemBonus = 5;

    localStorage.setItem('studyflow_last_streak_checkin', todayStr);
    setLastCheckInDate(todayStr);
    setStreakCelebration(true);
    setFloatingXp({ id: Date.now(), amount: xpBonus, text: `🔥 +${xpBonus} XP Streak Maintained!` });
    triggerCelebration();

    const updatedProfile: StudyRPGProfile = {
      ...activeRPG,
      streak: newStreak,
      xp: (activeRPG.xp ?? 0) + xpBonus,
      gems: (activeRPG.gems ?? 0) + gemBonus,
      historyLog: [
        {
          id: Date.now().toString(),
          action: `Maintained unbroken study streak (${newStreak} days active!)`,
          xpEarned: xpBonus,
          timestamp: 'Just now'
        },
        ...(activeRPG.historyLog || [])
      ]
    };

    handleUpdate(updatedProfile);
    setNotification(`🔥 Streak Maintained! Day ${newStreak} Active (+${xpBonus} XP & +${gemBonus} Gems)`);
    setTimeout(() => setStreakCelebration(false), 3000);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleClaimQuest = (questId: string) => {
    // Claim reward
    const targetQuest = (activeRPG as unknown as { quests?: StudyQuest[] }).quests?.find(q => q.id === questId);
    const xpGain = targetQuest?.xpReward || 50;
    const gemGain = targetQuest?.gemReward || 10;

    const updatedXp = (activeRPG.xp ?? 0) + xpGain;
    const updatedGems = (activeRPG.gems ?? 0) + gemGain;

    const updatedProfile: StudyRPGProfile = {
      ...activeRPG,
      xp: updatedXp,
      gems: updatedGems,
      completedQuestsCount: (activeRPG.completedQuestsCount ?? 0) + 1,
      historyLog: [
        {
          id: Date.now().toString(),
          action: `Claimed quest reward (+${gemGain} gems)`,
          xpEarned: xpGain,
          timestamp: 'Just now'
        },
        ...(activeRPG.historyLog || [])
      ]
    };

    handleUpdate(updatedProfile);
    setFloatingXp({ id: Date.now(), amount: xpGain, text: `✨ +${xpGain} XP Earned!` });
    triggerCelebration();
    setNotification(`Claimed +${xpGain} XP & +${gemGain} Study Gems! 🎉`);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleBuyStreakFreeze = () => {
    if ((activeRPG.gems ?? 0) < 25) {
      setNotification('Not enough gems! Complete more daily study quests to earn gems.');
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    const updatedProfile: StudyRPGProfile = {
      ...activeRPG,
      gems: (activeRPG.gems ?? 0) - 25,
      streakFreezes: (activeRPG.streakFreezes ?? 0) + 1,
      historyLog: [
        {
          id: Date.now().toString(),
          action: 'Purchased 1x Streak Freeze Shield (-25 gems)',
          xpEarned: 0,
          timestamp: 'Just now'
        },
        ...(activeRPG.historyLog || [])
      ]
    };

    handleUpdate(updatedProfile);
    triggerCelebration();
    setNotification('Equipped 1x Streak Freeze Shield! Your daily streak is safe.');
    setTimeout(() => setNotification(null), 3500);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto pb-12">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-[#6B705C] text-white shadow-xl text-xs font-bold border border-[#A5A58D] animate-bounce">
          <Sparkles className="w-4 h-4 text-[#FFE8D6]" />
          <span>{notification}</span>
        </div>
      )}

      {/* Hero Level & XP Header */}
      <div className="bg-gradient-to-br from-[#6B705C] via-[#5A5F4E] to-[#4A4E4D] rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        
        {/* Floating XP Gain Visual Transition (Motion) */}
        <AnimatePresence>
          {floatingXp && (
            <motion.div
              key={floatingXp.id}
              initial={{ opacity: 0, y: 15, scale: 0.6 }}
              animate={{ opacity: 1, y: -42, scale: 1.15 }}
              exit={{ opacity: 0, y: -80, scale: 0.8 }}
              transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-900 font-black text-xs sm:text-sm shadow-2xl border-2 border-white"
            >
              <Zap className="w-4 h-4 fill-current text-slate-950" />
              <span>{floatingXp.text || `+${floatingXp.amount} XP`}</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-950" />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute top-4 right-6 flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-white/15 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-[#FFE8D6]" />
            <span>{activeRPG.gems ?? 0} Study Gems</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-white/15 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
            <span>{activeRPG.streakFreezes ?? 0} Streak Freezes</span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <motion.div 
              animate={floatingXp ? { scale: [1, 1.18, 1], rotate: [0, -5, 5, 0] } : {}}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              className="w-20 h-20 rounded-3xl bg-white/10 border-2 border-white/20 flex flex-col items-center justify-center shrink-0 shadow-inner relative"
            >
              <span className="text-2xl font-black text-[#FFE8D6]">Lv.{rankInfo.currentLevel}</span>
              <span className="text-[10px] tracking-wider uppercase opacity-80 font-mono">Rank</span>
              <div className="absolute -bottom-2 px-2 py-0.5 rounded-full bg-[#DDBEA9] text-[#4A4E4D] font-black text-[9px] shadow-sm">
                XP
              </div>
            </motion.div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-widest text-[#DDBEA9]">Cognitive Profile</span>
                <span className="text-white/40">•</span>
                <span className="text-xs text-white/80">{activeRPG.rankTitle || rankInfo.title}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
                {rankInfo.title}
              </h1>
              <p className="text-xs text-white/70 mt-1 max-w-md">
                Earn XP through focused study intervals, blurt recall sessions, and active spaced repetition reviews.
              </p>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 min-w-[240px]">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-white/80 font-medium">Progress to Level {rankInfo.currentLevel + 1}</span>
              <span className="font-mono font-bold text-[#FFE8D6]">{rankInfo.progressPercent}%</span>
            </div>
            <div className="w-full bg-black/20 h-2.5 rounded-full overflow-hidden p-0.5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${rankInfo.progressPercent}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="bg-gradient-to-r from-[#DDBEA9] via-[#FFE8D6] to-[#DDBEA9] h-full rounded-full relative overflow-hidden"
              >
                <motion.div 
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ repeat: Infinity, duration: 2.2, ease: 'linear' }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent w-1/2"
                />
              </motion.div>
            </div>
            <div className="flex justify-between items-center text-[10px] text-white/60 font-mono mt-2">
              <span>{rankInfo.xpCurrent} Total XP</span>
              <span>Next: {rankInfo.xpForNext} XP</span>
            </div>
          </div>
        </div>
      </div>

      {/* Streak & Motivation Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div 
          animate={streakCelebration ? { scale: [1, 1.05, 1], borderColor: ['#E0DBD0', '#F59E0B', '#E0DBD0'] } : {}}
          transition={{ duration: 0.6 }}
          className="bg-white rounded-3xl p-5 border border-[#E0DBD0] shadow-2xs flex flex-col justify-between relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-[#6B705C] uppercase tracking-wider font-mono">Unbroken Streak</span>
              <div className="flex items-baseline gap-2 mt-1">
                <motion.span 
                  key={activeRPG.streak}
                  animate={streakCelebration ? { scale: [1, 1.3, 1] } : {}}
                  transition={{ duration: 0.5 }}
                  className="text-3xl font-black text-[#4A4E4D]"
                >
                  {activeRPG.streak ?? 1}
                </motion.span>
                <span className="text-xs text-[#6B705C] font-semibold">Days Active</span>
              </div>
              <p className="text-[11px] text-[#6B705C]/80 mt-1">Consistency builds permanent neural pathways.</p>
            </div>
            <motion.div 
              animate={streakCelebration ? { scale: [1, 1.35, 1], rotate: [0, -12, 12, 0] } : { scale: [1, 1.06, 1] }}
              transition={streakCelebration ? { duration: 0.7 } : { repeat: Infinity, duration: 2.6, ease: 'easeInOut' }}
              className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0"
            >
              <Flame className="w-6 h-6 text-amber-500 fill-amber-500" />
            </motion.div>
          </div>

          <button
            onClick={handleCheckInStreak}
            className="mt-3 w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>{lastCheckInDate === new Date().toISOString().split('T')[0] ? 'Streak Verified Today ✓ (+35 XP)' : 'Check-in Streak (+35 XP)'}</span>
          </button>
        </motion.div>

        <div className="bg-white rounded-3xl p-5 border border-[#E0DBD0] shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#6B705C] uppercase tracking-wider font-mono">Streak Freeze Shield</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-[#4A4E4D]">{activeRPG.streakFreezes ?? 0}</span>
              <span className="text-xs text-[#6B705C] font-semibold">Protected Days</span>
            </div>
            <button
              onClick={handleBuyStreakFreeze}
              className="mt-1 text-[11px] font-bold text-[#6B705C] hover:text-[#4A4E4D] underline cursor-pointer flex items-center gap-1"
            >
              <span>Buy 1 Shield (25 Gems)</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-[#E0DBD0] shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#6B705C] uppercase tracking-wider font-mono">Quests Completed</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-[#4A4E4D]">{activeRPG.completedQuestsCount ?? 0}</span>
              <span className="text-xs text-[#6B705C] font-semibold">Objectives Won</span>
            </div>
            {(onNavigateToStudyRoom || onNavigateTab) && (
              <button
                onClick={() => onNavigateToStudyRoom ? onNavigateToStudyRoom() : onNavigateTab && onNavigateTab('virtual_room')}
                className="mt-1 text-[11px] font-bold text-[#6B705C] hover:text-[#4A4E4D] underline cursor-pointer flex items-center gap-1"
              >
                <span>Enter Silent Study Room</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center shrink-0">
            <Trophy className="w-6 h-6 text-sky-600" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E0DBD0] pb-2">
        <button
          onClick={() => setActiveTab('quests')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'quests'
              ? 'bg-[#6B705C] text-white shadow-xs'
              : 'text-[#6B705C] hover:bg-[#F2EFE9]'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Daily Quests</span>
        </button>
        <button
          onClick={() => setActiveTab('badges')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'badges'
              ? 'bg-[#6B705C] text-white shadow-xs'
              : 'text-[#6B705C] hover:bg-[#F2EFE9]'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Achievements ({(activeRPG.badges || []).filter(b => b.unlocked).length}/{(activeRPG.badges || []).length})</span>
        </button>
        <button
          onClick={() => setActiveTab('subjects')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'subjects'
              ? 'bg-[#6B705C] text-white shadow-xs'
              : 'text-[#6B705C] hover:bg-[#F2EFE9]'
          }`}
        >
          <Crown className="w-3.5 h-3.5 text-amber-500" />
          <span>Subject Mastery Ranks ({subjects.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('rewards')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'rewards'
              ? 'bg-[#6B705C] text-white shadow-xs'
              : 'text-[#6B705C] hover:bg-[#F2EFE9]'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>XP Activity Log</span>
        </button>
      </div>

      {/* TAB CONTENT: DAILY QUESTS */}
      {activeTab === 'quests' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#4A4E4D]">Today's Study Quests</h2>
              <p className="text-xs text-[#6B705C]">Complete daily objectives to earn XP and Study Gems.</p>
            </div>
            <span className="text-[11px] font-mono text-[#6B705C] bg-[#F2EFE9] px-3 py-1 rounded-xl">
              Resets every midnight
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(activeRPG.badges || []).length >= 0 ? (
              // Use default quest list items
              [
                {
                  id: 'q1',
                  title: 'Deep Focus Sprint',
                  description: 'Complete at least 45 minutes of tracked study time today.',
                  xpReward: 60,
                  gemReward: 10,
                  progress: 45,
                  target: 45,
                  completed: true,
                  icon: '⏱️',
                },
                {
                  id: 'q2',
                  title: 'Spaced Repetition Drills',
                  description: 'Review 15 flashcards in the Flashcards Arena.',
                  xpReward: 50,
                  gemReward: 8,
                  progress: 15,
                  target: 15,
                  completed: true,
                  icon: '🗂️',
                },
                {
                  id: 'q3',
                  title: 'Active Retrieval Blurt',
                  description: 'Complete 1 Blurt Recall session or convert handwritten notes.',
                  xpReward: 75,
                  gemReward: 15,
                  progress: 1,
                  target: 1,
                  completed: true,
                  icon: '🧠',
                },
                {
                  id: 'q4',
                  title: 'Syllabus Groundwork',
                  description: 'Mark 1 subtopic or chapter as Mastered or In Progress.',
                  xpReward: 40,
                  gemReward: 5,
                  progress: 0,
                  target: 1,
                  completed: false,
                  icon: '📚',
                },
              ].map(quest => (
                <div 
                  key={quest.id}
                  className="bg-white rounded-3xl p-5 border border-[#E0DBD0] shadow-2xs flex flex-col justify-between space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl p-2 rounded-2xl bg-[#FAF8F5] border border-[#E0DBD0]">{quest.icon}</span>
                      <div>
                        <h3 className="text-sm font-bold text-[#4A4E4D]">{quest.title}</h3>
                        <p className="text-xs text-[#6B705C] mt-0.5 leading-relaxed">{quest.description}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-bold text-[#6B705C]">+{quest.xpReward} XP</span>
                      <div className="text-[10px] text-amber-700 font-semibold font-mono">+{quest.gemReward} 💎</div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-mono text-[#6B705C] mb-1">
                      <span>Progress</span>
                      <span>{quest.progress} / {quest.target}</span>
                    </div>
                    <div className="w-full bg-[#F2EFE9] h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${
                          quest.completed ? 'bg-emerald-500' : 'bg-[#6B705C]'
                        }`}
                        style={{ width: `${Math.min(100, (quest.progress / quest.target) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#F2EFE9] flex items-center justify-between">
                    {quest.completed ? (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => handleClaimQuest(quest.id)}
                        className="w-full py-2 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Claim Reward (+{quest.xpReward} XP)</span>
                      </motion.button>
                    ) : (
                      <div className="w-full py-2 text-center text-xs font-bold text-[#6B705C] bg-[#F2EFE9] rounded-2xl">
                        In Progress ({quest.progress}/{quest.target})
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : null}
          </div>
        </div>
      )}

      {/* TAB CONTENT: BADGES */}
      {activeTab === 'badges' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#4A4E4D]">Study Badges & Achievements</h2>
              <p className="text-xs text-[#6B705C]">Milestones unlocked through continuous study excellence.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {(activeRPG.badges || []).map(badge => (
              <div
                key={badge.id}
                className={`rounded-3xl p-5 border transition flex flex-col justify-between ${
                  badge.unlocked
                    ? 'bg-white border-[#E0DBD0] shadow-2xs'
                    : 'bg-[#FAF8F5]/60 border-dashed border-[#D5CFBE] opacity-60'
                }`}
              >
                <div>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-3 shadow-2xs border bg-[#FAF8F5] border-[#E0DBD0]">
                    {badge.icon}
                  </div>
                  <h3 className="text-sm font-bold text-[#4A4E4D]">{badge.name}</h3>
                  <p className="text-xs text-[#6B705C] mt-1 leading-relaxed">{badge.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#F2EFE9] flex items-center justify-between text-[11px]">
                  {badge.unlocked ? (
                    <span className="font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Unlocked</span>
                    </span>
                  ) : (
                    <span className="font-mono text-[#6B705C]">
                      {badge.progress !== undefined ? `${badge.progress}/${badge.maxProgress}` : 'Locked'}
                    </span>
                  )}
                  {badge.unlockedAt && (
                    <span className="text-[10px] font-mono text-[#6B705C]/70">{badge.unlockedAt}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: SUBJECT MASTERY RANKS & LEVELING */}
      {activeTab === 'subjects' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#4A4E4D]">Subject Mastery Ranks & Leveling</h2>
              <p className="text-xs text-[#6B705C]">Level up individual academic domains as you master topics and complete focused revisions.</p>
            </div>
            <span className="text-[11px] font-mono text-[#6B705C] bg-[#F2EFE9] px-3 py-1 rounded-xl">
              Calculated from syllabus completion
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map((subj) => {
              const allSubjTopics = subj.chapters.flatMap(ch => ch.topics);
              const masteredCount = allSubjTopics.filter(t => t.status === 'Mastered').length;
              const inProgressCount = allSubjTopics.filter(t => t.status === 'In Progress').length;
              const totalTopics = Math.max(1, allSubjTopics.length);
              const masteryPercent = Math.round((masteredCount / totalTopics) * 100);
              
              // Calculate Subject Level (1 to 10)
              const subjectLevel = Math.min(10, Math.max(1, Math.floor(masteryPercent / 10) + 1));
              const titles = [
                'Apprentice',
                'Novice Scholar',
                'Junior Specialist',
                'Investigator',
                'Adept Practitioner',
                'Senior Analyst',
                'Advanced Theoretician',
                'Master Craftsman',
                'Grand Scholar',
                'Domain Sage'
              ];
              const currentTitle = titles[subjectLevel - 1] || 'Scholar';
              const nextLevelProgress = (masteryPercent % 10) * 10;

              return (
                <div 
                  key={subj.id}
                  className="bg-white rounded-3xl p-5 border border-[#E0DBD0] shadow-2xs flex flex-col justify-between space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col items-center justify-center shrink-0">
                        <Crown className="w-5 h-5 text-amber-600" />
                        <span className="text-[9px] font-mono font-bold text-amber-800">Lv.{subjectLevel}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted font-bold">
                          {currentTitle}
                        </span>
                        <h3 className="text-sm font-bold text-[#4A4E4D]">{subj.name}</h3>
                        <p className="text-[11px] text-[#6B705C] mt-0.5">
                          {masteredCount} of {allSubjTopics.length} topics fully mastered
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-mono text-[#6B705C]">
                      <span>Mastery Progress</span>
                      <span className="font-bold text-[#4A4E4D]">{masteryPercent}%</span>
                    </div>
                    <div className="w-full bg-[#F2EFE9] h-2.5 rounded-full overflow-hidden p-0.5">
                      <div 
                        className="bg-gradient-to-r from-amber-500 to-emerald-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(4, masteryPercent)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted font-mono pt-1">
                      <span>{inProgressCount} in review</span>
                      <span>Next Level: {10 - (masteryPercent % 10)}% more</span>
                    </div>
                  </div>

                  {onStartTimerForTopic && allSubjTopics[0] && (
                    <button
                      onClick={() => onStartTimerForTopic(subj.name, allSubjTopics[0].name)}
                      className="w-full py-2 px-3 rounded-2xl bg-[#FAF8F5] hover:bg-theme-accent border border-[#E0DBD0] text-primary text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Level Up via Focus Sprint</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB CONTENT: XP REWARDS & HISTORY */}
      {activeTab === 'rewards' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-[#4A4E4D]">Experience History & Rewards</h2>
            <p className="text-xs text-[#6B705C]">Record of your latest cognitive gains and milestones.</p>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-[#E0DBD0] shadow-2xs space-y-3">
            {(activeRPG.historyLog || []).map((log) => (
              <div key={log.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#E0DBD0]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#6B705C]/15 flex items-center justify-center text-[#6B705C]">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#4A4E4D]">{log.action}</div>
                    <div className="text-[10px] font-mono text-[#6B705C]">{log.timestamp}</div>
                  </div>
                </div>
                {log.xpEarned > 0 && (
                  <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded-xl">
                    +{log.xpEarned} XP
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
