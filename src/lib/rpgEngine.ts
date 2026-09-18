import { StudyRPGProfile, StudyQuest, RPGStudyBadge } from '../types';

export const LEVEL_RANKS = [
  { level: 1, title: 'Novice Scholar', minXp: 0 },
  { level: 2, title: 'Apprentice Reader', minXp: 100 },
  { level: 3, title: 'Pomodoro Initiate', minXp: 250 },
  { level: 4, title: 'Knowledge Seeker', minXp: 450 },
  { level: 5, title: 'Recall Tactician', minXp: 700 },
  { level: 6, title: 'Spaced Repetition Scout', minXp: 1000 },
  { level: 7, title: 'Deep Focus Alchemist', minXp: 1400 },
  { level: 8, title: 'Master of Mnemonics', minXp: 1900 },
  { level: 9, title: 'Exam Vanguard', minXp: 2500 },
  { level: 10, title: 'Grand Polymath', minXp: 3200 },
  { level: 12, title: 'Arch-Scholar of Retention', minXp: 4800 },
  { level: 15, title: 'High Council Examiner', minXp: 7000 },
  { level: 20, title: 'Legendary Mind', minXp: 12000 },
];

export const DEFAULT_BADGES: RPGStudyBadge[] = [
  {
    id: 'first_blurt',
    name: 'Active Recall Pioneer',
    description: 'Complete your very first free-form blurt recall session.',
    icon: '⚡',
    category: 'recall',
    unlocked: true,
    unlockedAt: '2026-09-01',
    progress: 1,
    maxProgress: 1,
  },
  {
    id: 'streak_3',
    name: 'Momentum Builder',
    description: 'Maintain a 3-day unbroken study streak.',
    icon: '🔥',
    category: 'streak',
    unlocked: true,
    unlockedAt: '2026-09-03',
    progress: 3,
    maxProgress: 3,
  },
  {
    id: 'streak_7',
    name: 'Unstoppable Engine',
    description: 'Reach a 7-day study streak across any device.',
    icon: '🏆',
    category: 'streak',
    unlocked: false,
    progress: 4,
    maxProgress: 7,
  },
  {
    id: 'pomodoro_10',
    name: 'Deep Work Disciple',
    description: 'Complete 10 focused Pomodoro intervals without interruption.',
    icon: '⏱️',
    category: 'pomodoro',
    unlocked: true,
    unlockedAt: '2026-09-04',
    progress: 10,
    maxProgress: 10,
  },
  {
    id: 'cards_50',
    name: 'Memory Vault Master',
    description: 'Review 50 flashcards using the SM-2 spaced repetition scheduler.',
    icon: '🗂️',
    category: 'recall',
    unlocked: false,
    progress: 28,
    maxProgress: 50,
  },
  {
    id: 'handwritten_ocr',
    name: 'Visionary Scribe',
    description: 'Convert handwritten notebook pages into an AI quiz with Gemini Vision.',
    icon: '📸',
    category: 'mastery',
    unlocked: true,
    unlockedAt: '2026-09-07',
    progress: 1,
    maxProgress: 1,
  },
  {
    id: 'night_owl',
    name: 'Late-Night Alchemist',
    description: 'Log a deep work session past 10:00 PM.',
    icon: '🌙',
    category: 'pomodoro',
    unlocked: true,
    unlockedAt: '2026-09-05',
    progress: 1,
    maxProgress: 1,
  },
  {
    id: 'freeze_savior',
    name: 'Guardian of the Flame',
    description: 'Successfully protect your streak with a Streak Freeze token.',
    icon: '🛡️',
    category: 'streak',
    unlocked: false,
    progress: 0,
    maxProgress: 1,
  },
];

export const DEFAULT_DAILY_QUESTS: StudyQuest[] = [
  {
    id: 'q1',
    title: 'Deep Focus Sprint',
    description: 'Complete at least 45 minutes of tracked study time today.',
    xpReward: 60,
    gemReward: 10,
    progress: 30,
    target: 45,
    completed: false,
    icon: '⏱️',
    category: 'focus',
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
    category: 'flashcards',
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
    category: 'blurt',
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
    category: 'syllabus',
  },
];

export function getRankForXp(xp: number = 0) {
  const safeXp = Number.isFinite(xp) ? Math.max(0, xp) : 0;
  let currentRank = LEVEL_RANKS[0];
  let nextRank = LEVEL_RANKS[1];

  for (let i = 0; i < LEVEL_RANKS.length; i++) {
    if (safeXp >= LEVEL_RANKS[i].minXp) {
      currentRank = LEVEL_RANKS[i];
      nextRank = LEVEL_RANKS[i + 1] || { level: currentRank.level + 1, title: 'Transcendent Polymath', minXp: currentRank.minXp + 2000 };
    }
  }

  const xpInLevel = safeXp - currentRank.minXp;
  const xpSpan = Math.max(1, nextRank.minXp - currentRank.minXp);
  const progressPercent = Math.min(100, Math.max(0, Math.round((xpInLevel / xpSpan) * 100)));

  return {
    currentLevel: currentRank.level,
    title: currentRank.title,
    xpCurrent: safeXp,
    xpForNext: nextRank.minXp,
    progressPercent,
  };
}

const STORAGE_KEY = 'study_rpg_profile_v1';

export const DEFAULT_RPG_PROFILE: StudyRPGProfile = {
  level: 4,
  xp: 520,
  xpForNextLevel: 700,
  title: 'Knowledge Seeker',
  rankTitle: 'Rank IV Knowledge Seeker',
  streak: 4,
  streakFreezes: 2,
  gems: 45,
  completedQuestsCount: 8,
  badges: DEFAULT_BADGES,
  historyLog: [
    { id: '1', action: 'Completed 25m Focus Block on Physics', xpEarned: 35, timestamp: '1 hour ago' },
    { id: '2', action: 'Reviewed 15 Spaced Flashcards', xpEarned: 50, timestamp: 'Today' },
    { id: '3', action: 'Converted Handwritten Notes with Vision AI', xpEarned: 75, timestamp: 'Today' },
  ],
};

export function loadRPGProfile(): StudyRPGProfile {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        return {
          ...DEFAULT_RPG_PROFILE,
          ...parsed,
          xp: typeof parsed.xp === 'number' ? parsed.xp : DEFAULT_RPG_PROFILE.xp,
          gems: typeof parsed.gems === 'number' ? parsed.gems : DEFAULT_RPG_PROFILE.gems,
          level: typeof parsed.level === 'number' ? parsed.level : DEFAULT_RPG_PROFILE.level,
          streak: typeof parsed.streak === 'number' ? parsed.streak : DEFAULT_RPG_PROFILE.streak,
          streakFreezes: typeof parsed.streakFreezes === 'number' ? parsed.streakFreezes : DEFAULT_RPG_PROFILE.streakFreezes,
          completedQuestsCount: typeof parsed.completedQuestsCount === 'number' ? parsed.completedQuestsCount : DEFAULT_RPG_PROFILE.completedQuestsCount,
          badges: Array.isArray(parsed.badges) ? parsed.badges : DEFAULT_BADGES,
          historyLog: Array.isArray(parsed.historyLog) ? parsed.historyLog : DEFAULT_RPG_PROFILE.historyLog,
        };
      }
    }
  } catch (e) {
    console.warn('Could not load RPG profile from localStorage', e);
  }

  return DEFAULT_RPG_PROFILE;
}

export function saveRPGProfile(profile: StudyRPGProfile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.warn('Could not save RPG profile to localStorage', e);
  }
}

export function awardQuestProgress(
  category: 'focus' | 'flashcards' | 'blurt' | 'syllabus' | 'streak', 
  amount: number = 1
): StudyRPGProfile {
  const profile = loadRPGProfile();
  return profile;
}

export function awardXPAndGems(
  xpAmount: number, 
  gemAmount: number = 0, 
  description: string = 'Completed study task'
): StudyRPGProfile {
  const profile = loadRPGProfile();
  const newXp = profile.xp + xpAmount;
  const newGems = (profile.gems || 0) + gemAmount;
  const rank = getRankForXp(newXp);

  const updated: StudyRPGProfile = {
    ...profile,
    xp: newXp,
    gems: newGems,
    level: rank.currentLevel,
    title: rank.title,
    xpForNextLevel: rank.xpForNext,
    historyLog: [
      {
        id: `rpg-${Date.now()}`,
        action: description,
        xpEarned: xpAmount,
        timestamp: 'Just now'
      },
      ...(profile.historyLog || []).slice(0, 19)
    ]
  };
  saveRPGProfile(updated);
  return updated;
}

