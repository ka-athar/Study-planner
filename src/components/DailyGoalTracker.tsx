import React, { useState, useEffect, useRef } from 'react';
import { 
  Target, 
  Clock, 
  Flame, 
  CheckCircle2, 
  Plus, 
  Minus, 
  Sparkles, 
  Play, 
  TrendingUp, 
  Edit3, 
  Check, 
  Award,
  Zap,
  Calendar,
  PartyPopper
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StudySession, UserProfile, ActiveTab } from '../types';
import { triggerStudyGoalConfetti } from '../lib/confetti';

interface DailyGoalTrackerProps {
  sessions: StudySession[];
  userProfile: UserProfile | null;
  onUpdateTargetHours: (hours: number) => void;
  setActiveTab: (tab: ActiveTab) => void;
  onStartTimer: () => void;
}

export const DailyGoalTracker: React.FC<DailyGoalTrackerProps> = ({
  sessions,
  userProfile,
  onUpdateTargetHours,
  setActiveTab,
  onStartTimer
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  // Calculate today's study minutes
  const todaySessions = sessions.filter(s => s.date === todayStr);
  const todayMinutes = todaySessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  const todayHours = Number((todayMinutes / 60).toFixed(1));

  // Current Target Hours (default to 3 if not set)
  const targetHours = userProfile?.targetHoursPerDay || 3;
  const targetMinutes = targetHours * 60;

  // Percentage
  const progressPercent = Math.min(100, Math.round((todayMinutes / targetMinutes) * 100));
  const rawProgressPercent = targetMinutes > 0 ? (todayMinutes / targetMinutes) * 100 : 0;
  const remainingMinutes = Math.max(0, targetMinutes - todayMinutes);
  const isGoalAchieved = todayMinutes >= targetMinutes && targetMinutes > 0;

  // Track if confetti has already fired during this component mount/session
  const hasFiredConfetti = useRef<boolean>(false);

  useEffect(() => {
    if (isGoalAchieved && !hasFiredConfetti.current) {
      hasFiredConfetti.current = true;
      // Delay slightly for smooth entry animation
      const timer = setTimeout(() => {
        triggerStudyGoalConfetti();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isGoalAchieved]);

  // Calculate Streak (days in past where target was met)
  const calculateStreak = () => {
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayMins = sessions
        .filter(s => s.date === dateStr)
        .reduce((acc, s) => acc + (s.durationMinutes || 0), 0);

      // If today and not achieved yet, don't break streak if yesterday was achieved
      if (i === 0) {
        if (dayMins >= targetMinutes) {
          streak++;
        }
      } else {
        if (dayMins >= targetMinutes * 0.8) {
          streak++;
        } else {
          break;
        }
      }
    }
    return Math.max(1, streak);
  };

  const streakDays = calculateStreak();

  // Preset quick goals
  const PRESET_GOALS = [1, 2, 3, 4, 5, 6, 8];

  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [customInput, setCustomInput] = useState(String(targetHours));

  const handleAdjustTarget = (delta: number) => {
    const newTarget = Math.max(0.5, Math.min(16, Number((targetHours + delta).toFixed(1))));
    onUpdateTargetHours(newTarget);
  };

  const handleSelectPreset = (hours: number) => {
    onUpdateTargetHours(hours);
    setIsEditingCustom(false);
  };

  const handleSaveCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(customInput);
    if (!isNaN(val) && val > 0 && val <= 16) {
      onUpdateTargetHours(Number(val.toFixed(1)));
      setIsEditingCustom(false);
    }
  };

  // Circular progress calculations
  const circleRadius = 42;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`bg-white border rounded-3xl p-6 shadow-xs relative overflow-hidden space-y-5 transition-colors duration-500 ${
        isGoalAchieved ? 'border-emerald-300 ring-2 ring-emerald-500/10' : 'border-[#E0DBD0]'
      }`}
    >
      {/* Celebration top accent glow banner if achieved */}
      {isGoalAchieved && (
        <motion.div 
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.6 }}
          className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 via-amber-400 to-emerald-500"
        />
      )}

      {/* Header & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E0DBD0] pb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl transition-colors ${
            isGoalAchieved ? 'bg-emerald-100 text-emerald-700' : 'bg-[#6B705C]/10 text-[#6B705C]'
          }`}>
            <Target className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#4A4E4D]">
                Daily Study Goal Tracker
              </h3>
              {isGoalAchieved ? (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => triggerStudyGoalConfetti()}
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-2xs hover:bg-emerald-200 transition cursor-pointer"
                  title="Click to trigger congratulatory confetti!"
                >
                  <PartyPopper className="w-3 h-3 text-emerald-700 animate-bounce" />
                  <span>Target Achieved! (Celebrate 🎊)</span>
                </motion.button>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F2EFE9] text-[#6B705C] border border-[#E0DBD0]">
                  {progressPercent}% Complete
                </span>
              )}
            </div>
            <p className="text-xs text-[#A5A58D] mt-0.5">
              Live comparison of your target focus hours vs logged study timer sessions for today.
            </p>
          </div>
        </div>

        {/* Streak & Sessions Tag */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {isGoalAchieved && (
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => triggerStudyGoalConfetti()}
              className="flex items-center gap-1 px-3 py-1.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold shadow-2xs hover:bg-emerald-100 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Confetti 🎊</span>
            </motion.button>
          )}

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold shadow-2xs">
            <Flame className="w-4 h-4 fill-amber-500 text-amber-500" />
            <span>{streakDays} Day Streak</span>
          </div>
          <button
            onClick={onStartTimer}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-semibold transition shadow-2xs cursor-pointer"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Study Now</span>
          </button>
        </div>
      </div>

      {/* Main Visual Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Left: Circular Gauge & Stats */}
        <div className="md:col-span-5 flex items-center gap-5 p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0]">
          <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Background Ring */}
              <circle
                cx="50"
                cy="50"
                r={circleRadius}
                fill="transparent"
                stroke="#EAE7DF"
                strokeWidth="8"
              />
              {/* Framer Motion Progress Ring */}
              <motion.circle
                cx="50"
                cy="50"
                r={circleRadius}
                fill="transparent"
                stroke={isGoalAchieved ? '#10B981' : '#6B705C'}
                strokeWidth="8"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                strokeLinecap="round"
              />
            </svg>

            {/* Inner Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <motion.span 
                key={todayHours}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className={`text-xl font-serif italic font-bold ${
                  isGoalAchieved ? 'text-emerald-700' : 'text-[#4A4E4D]'
                }`}
              >
                {todayHours}h
              </motion.span>
              <span className="text-[10px] font-mono text-[#A5A58D]">
                of {targetHours}h
              </span>
            </div>
          </div>

          <div className="space-y-1.5 flex-1">
            <div className="text-xs font-medium text-[#4A4E4D]">
              {isGoalAchieved ? (
                <motion.div 
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-emerald-700 font-bold flex items-center gap-1"
                >
                  <Award className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Target Achieved ({rawProgressPercent.toFixed(0)}%)!</span>
                </motion.div>
              ) : (
                <>
                  <span className="font-bold text-[#6B705C]">
                    {Math.floor(remainingMinutes / 60)}h {remainingMinutes % 60}m
                  </span>{' '}
                  left to reach target
                </>
              )}
            </div>

            {/* Linear Animated Progress Bar Under Gauge */}
            <div className="w-full bg-[#EAE7DF] h-2 rounded-full overflow-hidden mt-1.5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className={`h-full rounded-full ${
                  isGoalAchieved 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400' 
                    : 'bg-gradient-to-r from-[#6B705C] to-[#8A8F80]'
                }`}
              />
            </div>

            <div className="text-[11px] text-[#A5A58D] font-mono pt-1">
              Sessions Today: <strong className="text-[#4A4E4D]">{todaySessions.length} logged</strong>
            </div>
            <div className="text-[11px] text-[#A5A58D] font-mono">
              Total Time: <strong className="text-[#4A4E4D]">{todayMinutes} mins</strong>
            </div>
          </div>
        </div>

        {/* Right: Target Adjustment Controls & Presets */}
        <div className="md:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-[#A5A58D] flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5" /> Adjust Daily Target Goal:
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleAdjustTarget(-0.5)}
                className="w-7 h-7 rounded-xl bg-[#F2EFE9] hover:bg-[#EAE7DF] border border-[#E0DBD0] flex items-center justify-center text-[#4A4E4D] transition cursor-pointer"
                title="Decrease 0.5 hr"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono font-bold px-2 text-[#6B705C]">
                {targetHours} hrs / day
              </span>
              <button
                onClick={() => handleAdjustTarget(0.5)}
                className="w-7 h-7 rounded-xl bg-[#F2EFE9] hover:bg-[#EAE7DF] border border-[#E0DBD0] flex items-center justify-center text-[#4A4E4D] transition cursor-pointer"
                title="Increase 0.5 hr"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESET_GOALS.map((hrs) => (
              <button
                key={hrs}
                onClick={() => handleSelectPreset(hrs)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition cursor-pointer ${
                  targetHours === hrs
                    ? 'bg-[#6B705C] text-white shadow-2xs'
                    : 'bg-[#F9F7F2] text-[#4A4E4D] border border-[#E0DBD0] hover:border-[#6B705C] hover:bg-[#F2EFE9]'
                }`}
              >
                {hrs}h
              </button>
            ))}

            <button
              onClick={() => setIsEditingCustom(!isEditingCustom)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#F2EFE9] text-[#6B705C] border border-[#E0DBD0] hover:bg-[#EAE7DF] transition cursor-pointer"
            >
              Custom...
            </button>
          </div>

          {/* Custom Input Popover */}
          <AnimatePresence>
            {isEditingCustom && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleSaveCustom}
                className="flex items-center gap-2 pt-1"
              >
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="16"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="e.g. 4.5"
                  className="w-28 px-3 py-1.5 rounded-xl bg-[#F9F7F2] border border-[#E0DBD0] text-xs font-mono text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-[#6B705C] text-white text-xs font-semibold hover:bg-[#5a5f4e] transition cursor-pointer"
                >
                  Set Hours
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingCustom(false)}
                  className="text-xs text-[#A5A58D] hover:text-[#4A4E4D] cursor-pointer"
                >
                  Cancel
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Today's Active Sessions Mini Pill Row */}
          {todaySessions.length > 0 ? (
            <div className="pt-2 border-t border-[#E0DBD0]/60">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#A5A58D]">
                Today's Sessions Contributing:
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {todaySessions.map((s, idx) => (
                  <span
                    key={s.id || idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#F2EFE9] border border-[#E0DBD0] text-[11px] text-[#4A4E4D]"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6B705C]"></span>
                    <strong>{s.subjectName}</strong>: {s.topicName} ({s.durationMinutes}m)
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-[#A5A58D] italic pt-1">
              No study sessions completed today yet. Start a timer to make progress toward your {targetHours}h goal!
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

