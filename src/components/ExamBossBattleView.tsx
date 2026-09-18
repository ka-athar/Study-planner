import React, { useState, useEffect } from 'react';
import { 
  Swords, 
  Shield, 
  Zap, 
  Trophy, 
  Heart, 
  RotateCcw, 
  Sparkles, 
  HelpCircle, 
  Award, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  BookOpen, 
  ChevronRight,
  Flame,
  BookmarkCheck,
  Clock,
  Timer
} from 'lucide-react';
import { Subject, EXAM_BOARD_PRESETS, ExamBoard, ExamBoardPreset } from '../types';

export interface BossMistakePayload {
  subjectName: string;
  topicName: string;
  question: string;
  userMistake: string;
  correctApproach: string;
  category: string;
  frequency: number;
}

interface ExamBossBattleViewProps {
  subjects: Subject[];
  activeSubject?: Subject | null;
  onLogMistake?: (mistake: BossMistakePayload) => void;
  onStartFocusSprint?: (topicName: string) => void;
}

interface BattleQuestion {
  id: string;
  damage: number;
  questionText: string;
  options: string[];
  correctIndex: number;
  critHint: string;
  commonTrap: string;
  marks?: number;
}

interface BossProfile {
  bossName: string;
  bossTitle: string;
  bossConcept: string;
  bossMaxHp: number;
  bossWeakness: string;
  bossLore: string;
  questions: BattleQuestion[];
}

export const ExamBossBattleView: React.FC<ExamBossBattleViewProps> = ({
  subjects,
  activeSubject,
  onLogMistake,
  onStartFocusSprint,
}) => {
  const currentSubj = activeSubject || subjects[0] || null;
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(currentSubj?.id || '');
  const [selectedTopic, setSelectedTopic] = useState<string>('');

  // Player RPG Stats (Persisted in localStorage)
  const [playerLevel, setPlayerLevel] = useState<number>(() => {
    const saved = localStorage.getItem('rpg_player_level');
    return saved ? parseInt(saved, 10) : 1;
  });
  const [playerXp, setPlayerXp] = useState<number>(() => {
    const saved = localStorage.getItem('rpg_player_xp');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [skillPoints, setSkillPoints] = useState<number>(() => {
    const saved = localStorage.getItem('rpg_skill_points');
    return saved ? parseInt(saved, 10) : 2;
  });

  // Upgrades
  const [attackUpgrade, setAttackUpgrade] = useState<number>(() => {
    return parseInt(localStorage.getItem('rpg_atk_up') || '0', 10);
  });
  const [shieldUpgrade, setShieldUpgrade] = useState<number>(() => {
    return parseInt(localStorage.getItem('rpg_def_up') || '0', 10);
  });
  const [hintSpellCount, setHintSpellCount] = useState<number>(() => {
    return parseInt(localStorage.getItem('rpg_hints') || '2', 10);
  });

  // Battle State
  const [isInBattle, setIsInBattle] = useState(false);
  const [isGeneratingBoss, setIsGeneratingBoss] = useState(false);
  const [boss, setBoss] = useState<BossProfile | null>(null);
  const [bossCurrentHp, setBossCurrentHp] = useState<number>(100);
  const [playerHp, setPlayerHp] = useState<number>(100);
  const [playerShield, setPlayerShield] = useState<number>(50);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [combatLog, setCombatLog] = useState<string[]>([]);
  const [battleResult, setBattleResult] = useState<'victory' | 'defeat' | null>(null);
  const [eliminatedOptions, setEliminatedOptions] = useState<number[]>([]);
  const [difficulty, setDifficulty] = useState<'casual' | 'standard' | 'hardcore'>('standard');
  const [turnSecondsLeft, setTurnSecondsLeft] = useState<number>(30);
  const [selectedBoard, setSelectedBoard] = useState<ExamBoard>(() => {
    return (currentSubj?.boardAffiliation as ExamBoard) || 'general';
  });
  const [turnAllocatedSeconds, setTurnAllocatedSeconds] = useState<number>(30);
  const [turnTimeTaken, setTurnTimeTaken] = useState<number>(0);

  const activeSubjObj = subjects.find(s => s.id === selectedSubjectId) || currentSubj;

  useEffect(() => {
    if (activeSubjObj?.boardAffiliation) {
      setSelectedBoard(activeSubjObj.boardAffiliation as ExamBoard);
    }
  }, [activeSubjObj?.boardAffiliation]);

  const currentBoardPreset = EXAM_BOARD_PRESETS.find(b => b.id === selectedBoard) || EXAM_BOARD_PRESETS[0];

  const computeTurnSeconds = (question?: BattleQuestion) => {
    const qMarks = question?.marks || Math.max(1, Math.round((question?.damage || 30) / 15)) || 2;
    const standardSecs = Math.max(15, Math.round(qMarks * currentBoardPreset.defaultMinutesPerMark * 60));
    if (difficulty === 'casual') return 999;
    if (difficulty === 'hardcore') return Math.max(10, Math.round(standardSecs * 0.55));
    return standardSecs;
  };

  // Turn timer effect for active questions under time pressure
  useEffect(() => {
    if (!isInBattle || isAnswerRevealed || battleResult || !boss) return;
    if (difficulty === 'casual') return;

    const interval = setInterval(() => {
      setTurnSecondsLeft(prev => {
        if (prev <= 1) {
          // Time expired! Automatic timeout strike by boss
          clearInterval(interval);
          handleTimeExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isInBattle, isAnswerRevealed, battleResult, boss, currentQuestionIndex, difficulty]);

  const handleTimeExpired = () => {
    if (isAnswerRevealed || !boss) return;
    setIsAnswerRevealed(true);
    const question = boss.questions[currentQuestionIndex];
    addCombatLog(`⏳ Time Expired! You hesitated and the Boss struck without resistance.`);

    const rawDmg = 30;
    const reducedDmg = Math.max(12, rawDmg - (shieldUpgrade * 3));
    let currentS = playerShield;
    let currentH = playerHp;

    if (currentS > 0) {
      const absorb = Math.min(currentS, reducedDmg);
      currentS -= absorb;
      const remainder = reducedDmg - absorb;
      currentH = Math.max(0, currentH - remainder);
    } else {
      currentH = Math.max(0, currentH - reducedDmg);
    }

    setPlayerShield(currentS);
    setPlayerHp(currentH);

    if (onLogMistake) {
      onLogMistake({
        subjectName: activeSubjObj?.name || 'General',
        topicName: boss.bossConcept,
        question: question.questionText,
        userMistake: 'Time expired under retrieval pressure',
        correctApproach: question.critHint,
        category: 'conceptual',
        frequency: 1,
      });
      addCombatLog(`📌 Timeout logged to your Mistake Vault.`);
    }

    if (currentH === 0) {
      setBattleResult('defeat');
      addCombatLog(`💀 Defeat! Review the concept in your Mistake Vault and try again.`);
    }
  };

  // Save RPG stats
  useEffect(() => {
    localStorage.setItem('rpg_player_level', playerLevel.toString());
    localStorage.setItem('rpg_player_xp', playerXp.toString());
    localStorage.setItem('rpg_skill_points', skillPoints.toString());
    localStorage.setItem('rpg_atk_up', attackUpgrade.toString());
    localStorage.setItem('rpg_def_up', shieldUpgrade.toString());
    localStorage.setItem('rpg_hints', hintSpellCount.toString());
  }, [playerLevel, playerXp, skillPoints, attackUpgrade, shieldUpgrade, hintSpellCount]);

  const allTopics = activeSubjObj ? activeSubjObj.chapters.flatMap(ch => ch.topics.map(t => ({
    chapterName: ch.name,
    topicName: t.name
  }))) : [];

  const addCombatLog = (msg: string) => {
    setCombatLog(prev => [msg, ...prev.slice(0, 5)]);
  };

  const startBossBattle = async () => {
    setIsGeneratingBoss(true);
    setBattleResult(null);
    setCombatLog([]);
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setIsAnswerRevealed(false);
    setEliminatedOptions([]);

    const chosenTopic = selectedTopic || (allTopics[0]?.topicName || 'Academic Concept');

    try {
      const res = await fetch('/api/ai/boss-battle-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectName: activeSubjObj?.name || 'Science & Math',
          chapterName: allTopics.find(t => t.topicName === chosenTopic)?.chapterName || 'Advanced Studies',
          topicName: chosenTopic,
          board: selectedBoard,
        })
      });
      const data = await res.json();
      if (data.success && data.boss) {
        setBoss(data.boss);
        setBossCurrentHp(data.boss.bossMaxHp || 100);
        setPlayerHp(100);
        setPlayerShield(50 + (shieldUpgrade * 15));
        setIsInBattle(true);

        const initialQuestion = data.boss.questions[0];
        const initialSeconds = computeTurnSeconds(initialQuestion);
        setTurnAllocatedSeconds(initialSeconds);
        setTurnSecondsLeft(initialSeconds);
        setTurnTimeTaken(0);

        addCombatLog(`⚔️ The Boss "${data.boss.bossName}" has entered the exam arena!`);
        addCombatLog(`⏱️ Pacing Standard: ${currentBoardPreset.name} (${currentBoardPreset.defaultMinutesPerMark}m/mark).`);
      }
    } catch (err) {
      console.error(err);
      addCombatLog('⚠️ Failed to load Boss. Please try again.');
    } finally {
      setIsGeneratingBoss(false);
    }
  };

  const handleSelectOption = (idx: number) => {
    if (isAnswerRevealed || !boss) return;
    setSelectedOption(idx);
    setIsAnswerRevealed(true);

    const question = boss.questions[currentQuestionIndex];
    const isCorrect = idx === question.correctIndex;

    const timeSpent = Math.max(1, turnAllocatedSeconds - turnSecondsLeft);
    setTurnTimeTaken(timeSpent);
    const pacingDelta = turnAllocatedSeconds - timeSpent;

    if (difficulty !== 'casual') {
      if (pacingDelta >= 5) {
        addCombatLog(`⚡ Pacing: +${pacingDelta}s ahead of ${currentBoardPreset.shortName} standard pace!`);
      } else if (pacingDelta < -5) {
        addCombatLog(`🐢 Pacing Alert: Lagging behind ${currentBoardPreset.shortName} time budget by ${Math.abs(pacingDelta)}s.`);
      }
    }

    if (isCorrect) {
      const bonusAtk = attackUpgrade * 5;
      const dealtDamage = question.damage + bonusAtk;
      const nextHp = Math.max(0, bossCurrentHp - dealtDamage);
      setBossCurrentHp(nextHp);
      addCombatLog(`💥 CRITICAL STRIKE! You answered correctly and dealt ${dealtDamage} damage to ${boss.bossName}!`);

      if (nextHp === 0) {
        // Victory!
        setBattleResult('victory');
        const xpEarned = 120;
        const nextXp = playerXp + xpEarned;
        if (nextXp >= playerLevel * 100) {
          setPlayerLevel(prev => prev + 1);
          setPlayerXp(nextXp - (playerLevel * 100));
          setSkillPoints(prev => prev + 1);
          addCombatLog(`🎉 LEVEL UP! You reached Level ${playerLevel + 1}! Earned 1 Skill Point.`);
        } else {
          setPlayerXp(nextXp);
        }
        return;
      }
    } else {
      // Boss counterattack
      const rawDmg = 25;
      const reducedDmg = Math.max(10, rawDmg - (shieldUpgrade * 3));
      let currentS = playerShield;
      let currentH = playerHp;

      if (currentS > 0) {
        const absorb = Math.min(currentS, reducedDmg);
        currentS -= absorb;
        const remainder = reducedDmg - absorb;
        currentH = Math.max(0, currentH - remainder);
      } else {
        currentH = Math.max(0, currentH - reducedDmg);
      }

      setPlayerShield(currentS);
      setPlayerHp(currentH);
      addCombatLog(`🛡️ Boss Counterattack! You lost ${reducedDmg} points (${question.commonTrap})`);

      // Automatically file into Mistake Vault!
      if (onLogMistake) {
        onLogMistake({
          subjectName: activeSubjObj?.name || 'General',
          topicName: boss.bossConcept,
          question: question.questionText,
          userMistake: question.options[idx],
          correctApproach: question.critHint,
          category: 'conceptual',
          frequency: 1,
        });
        addCombatLog(`📌 Error logged automatically to your Mistake Vault for cure drilling.`);
      }

      if (currentH === 0) {
        setBattleResult('defeat');
        addCombatLog(`💀 Defeat! Review the concept in your Mistake Vault and try again.`);
        return;
      }
    }
  };

  const handleNextQuestion = () => {
    if (!boss) return;
    if (currentQuestionIndex + 1 < boss.questions.length) {
      const nextIdx = currentQuestionIndex + 1;
      const nextQ = boss.questions[nextIdx];
      const nextSecs = computeTurnSeconds(nextQ);

      setCurrentQuestionIndex(nextIdx);
      setSelectedOption(null);
      setIsAnswerRevealed(false);
      setEliminatedOptions([]);
      setTurnAllocatedSeconds(nextSecs);
      setTurnSecondsLeft(nextSecs);
      setTurnTimeTaken(0);
    } else {
      if (bossCurrentHp > 0) {
        // Battle ended without defeat
        setBattleResult(bossCurrentHp < 40 ? 'victory' : 'defeat');
      }
    }
  };

  const useGeminiHintSpell = () => {
    if (hintSpellCount <= 0 || isAnswerRevealed || !boss) return;
    const question = boss.questions[currentQuestionIndex];
    // Eliminate 1 wrong answer
    const wrongIndices = question.options
      .map((_, i) => i)
      .filter(i => i !== question.correctIndex && !eliminatedOptions.includes(i));
    
    if (wrongIndices.length > 0) {
      const toEliminate = wrongIndices[0];
      setEliminatedOptions(prev => [...prev, toEliminate]);
      setHintSpellCount(prev => prev - 1);
      addCombatLog(`✨ Gemini Spell Cast! Eliminated option: "${question.options[toEliminate]}"`);
    }
  };

  const upgradeSkill = (type: 'atk' | 'def') => {
    if (skillPoints <= 0) return;
    if (type === 'atk') {
      setAttackUpgrade(prev => prev + 1);
    } else {
      setShieldUpgrade(prev => prev + 1);
    }
    setSkillPoints(prev => prev - 1);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner - Strict Green/Theme Palette */}
      <div className="bg-[#FAF9F5] dark:bg-card border border-theme rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
              <Swords className="w-3.5 h-3.5 text-primary" />
              <span>Interactive RPG Exam Battle Mode</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif italic font-bold text-primary">
              Syllabus Boss Battles & Skill Trees
            </h2>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              Transform challenging syllabus chapters into epic academic Boss Fights. Strike critical damage with conceptual reasoning; incorrect answers trigger counterattacks and are automatically filed into your Mistake Vault.
            </p>
          </div>

          {/* Player Stats HUD */}
          <div className="bg-surface rounded-2xl p-4 border border-theme flex items-center gap-4 shrink-0">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center border border-primary/30">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-primary">Level {playerLevel} Scholar</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-white">
                  {skillPoints} SP
                </span>
              </div>
              <div className="w-32 bg-theme-accent h-2 rounded-full mt-1.5 overflow-hidden border border-theme">
                <div 
                  className="bg-primary h-full rounded-full transition-all duration-500" 
                  style={{ width: `${(playerXp / (playerLevel * 100)) * 100}%` }}
                />
              </div>
              <div className="text-[10px] text-muted mt-1 font-mono">
                {playerXp} / {playerLevel * 100} XP
              </div>
            </div>
          </div>
        </div>
      </div>

      {!isInBattle ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Boss Arena Selector */}
          <div className="lg:col-span-2 bg-card border border-theme rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="border-b border-theme pb-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                <Swords className="w-4 h-4 text-primary" />
                <span>Configure Your Exam Boss Battle</span>
              </h3>
              <p className="text-xs text-muted mt-1">
                Select the subject and topic you wish to test your cognitive defenses against.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1.5">
                  Subject Domain
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={e => {
                    setSelectedSubjectId(e.target.value);
                    setSelectedTopic('');
                  }}
                  className="w-full bg-surface border border-theme rounded-xl px-3 py-2 text-xs font-medium text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1.5">
                  Boss Concept / Topic
                </label>
                <select
                  value={selectedTopic}
                  onChange={e => setSelectedTopic(e.target.value)}
                  className="w-full bg-surface border border-theme rounded-xl px-3 py-2 text-xs font-medium text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- Choose Syllabus Chapter / Topic --</option>
                  {allTopics.map((t, idx) => (
                    <option key={idx} value={t.topicName}>
                      {t.chapterName} › {t.topicName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Exam Board Standard Pacing Selector */}
            <div className="space-y-1.5 bg-surface/50 border border-theme rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-muted uppercase tracking-wider block">
                  Examination Board & Pacing Ratio Standard
                </label>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${currentBoardPreset.badgeColor}`}>
                  {currentBoardPreset.defaultMinutesPerMark} min/mark
                </span>
              </div>
              <select
                value={selectedBoard}
                onChange={e => setSelectedBoard(e.target.value as ExamBoard)}
                className="w-full bg-surface border border-theme rounded-xl px-3 py-2 text-xs font-medium text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                {EXAM_BOARD_PRESETS.map(bp => (
                  <option key={bp.id} value={bp.id}>
                    {bp.name} ({bp.region}) — {bp.defaultMinutesPerMark} min/mark
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted">
                {currentBoardPreset.description}
              </p>
            </div>

            {/* Turn Speed & Difficulty Selector */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-muted uppercase tracking-wider block">
                Combat Intensity & Turn Clock
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setDifficulty('casual')}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    difficulty === 'casual'
                      ? 'bg-primary text-white border-primary shadow-xs'
                      : 'bg-surface border-theme text-primary hover:bg-theme-accent'
                  }`}
                >
                  <div className="text-xs font-bold">Casual</div>
                  <div className="text-[10px] opacity-80 mt-0.5">Untimed • 90 XP</div>
                </button>
                <button
                  type="button"
                  onClick={() => setDifficulty('standard')}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    difficulty === 'standard'
                      ? 'bg-primary text-white border-primary shadow-xs'
                      : 'bg-surface border-theme text-primary hover:bg-theme-accent'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center gap-1">
                    <span>Standard</span>
                    <Timer className="w-3 h-3" />
                  </div>
                  <div className="text-[10px] opacity-80 mt-0.5">30s Clock • 130 XP + 5 💎</div>
                </button>
                <button
                  type="button"
                  onClick={() => setDifficulty('hardcore')}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    difficulty === 'hardcore'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-surface border-theme text-primary hover:bg-theme-accent'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center gap-1">
                    <span>Hardcore</span>
                    <Flame className="w-3 h-3 text-amber-300 fill-amber-300" />
                  </div>
                  <div className="text-[10px] opacity-80 mt-0.5">15s Clock • 260 XP (2x) + 15 💎</div>
                </button>
              </div>
            </div>

            {/* Battle Preview Card */}
            <div className="bg-surface rounded-2xl p-5 border border-theme space-y-3">
              <div className="flex items-center gap-2 text-primary font-bold text-xs">
                <Flame className="w-4 h-4 text-primary" />
                <span>Boss Encounter Rules</span>
              </div>
              <ul className="text-xs text-muted space-y-1.5 list-disc list-inside">
                <li>Boss questions scale from conceptual first principles to complex exam derivations.</li>
                <li>Answering correctly strikes the Boss with conceptual critical hits (+{20 + attackUpgrade * 5} HP damage).</li>
                <li>Answering incorrectly triggers a counterattack; your mistakes are automatically routed into the <strong>Mistake Vault</strong>.</li>
                <li>Victory awards 120 XP, level progression, and skill points for character stats.</li>
              </ul>
            </div>

            <button
              onClick={startBossBattle}
              disabled={isGeneratingBoss}
              className="w-full py-3.5 rounded-2xl bg-primary hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95"
            >
              {isGeneratingBoss ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Summoning Exam Boss from Syllabus...</span>
                </>
              ) : (
                <>
                  <Swords className="w-4 h-4" />
                  <span>Enter Boss Arena</span>
                </>
              )}
            </button>
          </div>

          {/* Skill Tree & Attributes Panel */}
          <div className="bg-card border border-theme rounded-3xl p-6 shadow-xs space-y-5">
            <div className="border-b border-theme pb-3 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <span>Skill Tree</span>
              </h3>
              <span className="text-xs font-bold text-primary font-mono">{skillPoints} SP Available</span>
            </div>

            {/* Attack Upgrade */}
            <div className="bg-surface rounded-2xl p-4 border border-theme space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-primary">Mastery Strike</div>
                  <div className="text-[11px] text-muted">+{attackUpgrade * 5} Base Damage per Question</div>
                </div>
                <button
                  onClick={() => upgradeSkill('atk')}
                  disabled={skillPoints <= 0}
                  className="px-3 py-1.5 rounded-xl bg-primary hover:opacity-90 disabled:opacity-30 text-white text-xs font-bold cursor-pointer transition"
                >
                  Upgrade
                </button>
              </div>
            </div>

            {/* Defense Upgrade */}
            <div className="bg-surface rounded-2xl p-4 border border-theme space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-primary">Cognitive Shielding</div>
                  <div className="text-[11px] text-muted">+{shieldUpgrade * 15} Max Shield Capacity</div>
                </div>
                <button
                  onClick={() => upgradeSkill('def')}
                  disabled={skillPoints <= 0}
                  className="px-3 py-1.5 rounded-xl bg-primary hover:opacity-90 disabled:opacity-30 text-white text-xs font-bold cursor-pointer transition"
                >
                  Upgrade
                </button>
              </div>
            </div>

            {/* Gemini Hint Spell */}
            <div className="bg-surface rounded-2xl p-4 border border-theme space-y-1">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-primary">Gemini 50/50 Spell</div>
                <span className="text-xs font-mono font-bold text-primary">{hintSpellCount} charges</span>
              </div>
              <p className="text-[11px] text-muted">
                Eliminates 1 incorrect distractor during active boss battles.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* ACTIVE COMBAT ARENA */
        <div className="space-y-6">
          {/* Boss & Player Duel HUD */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Player Card */}
            <div className="bg-card border border-theme rounded-3xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-primary">Student Defender</h4>
                    <span className="text-[10px] text-muted">Level {playerLevel}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs font-mono font-bold text-primary">
                  <Heart className="w-3.5 h-3.5 text-primary" />
                  <span>{playerHp}/100 HP</span>
                </div>
              </div>

              {/* Health & Shield Bars */}
              <div className="space-y-1.5">
                <div className="w-full bg-theme-accent h-2.5 rounded-full overflow-hidden border border-theme">
                  <div 
                    className="bg-primary h-full rounded-full transition-all duration-300"
                    style={{ width: `${playerHp}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted">
                  <span>Shield: {playerShield}</span>
                  <span>Damage: +{20 + attackUpgrade * 5}</span>
                </div>
              </div>
            </div>

            {/* Boss Card */}
            {boss && (
              <div className="bg-card border border-theme rounded-3xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <Swords className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-primary">{boss.bossName}</h4>
                      <span className="text-[10px] text-muted">{boss.bossTitle}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-mono font-bold text-primary">
                    <span>{bossCurrentHp}/{boss.bossMaxHp} HP</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="w-full bg-theme-accent h-2.5 rounded-full overflow-hidden border border-theme">
                    <div 
                      className="bg-primary h-full rounded-full transition-all duration-300"
                      style={{ width: `${(bossCurrentHp / boss.bossMaxHp) * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted">
                    <span>Weakness: {boss.bossWeakness}</span>
                    <span>Phase: {bossCurrentHp < 40 ? 'Enraged' : 'Normal'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Question / Battle Encounter Card */}
          {boss && boss.questions[currentQuestionIndex] && (
            <div className="bg-card border border-theme rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-theme pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 uppercase tracking-widest">
                      QUESTION {currentQuestionIndex + 1} OF {boss.questions.length}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${currentBoardPreset.badgeColor}`}>
                      🏛️ {currentBoardPreset.shortName} ({currentBoardPreset.defaultMinutesPerMark}m/mark)
                    </span>
                    {difficulty !== 'casual' && (
                      <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-md border flex items-center gap-1 ${
                        turnSecondsLeft <= 5 
                          ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse' 
                          : 'bg-amber-50 text-amber-900 border-amber-300'
                      }`}>
                        <Timer className="w-3 h-3" />
                        <span>{turnSecondsLeft}s / {turnAllocatedSeconds}s</span>
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm sm:text-base font-serif italic font-bold text-primary mt-1">
                    {boss.questions[currentQuestionIndex].questionText}
                  </h3>
                </div>

                <button
                  onClick={useGeminiHintSpell}
                  disabled={hintSpellCount <= 0 || isAnswerRevealed}
                  className="px-3 py-2 rounded-xl bg-theme-accent hover:bg-theme-accent/80 disabled:opacity-40 text-primary border border-theme text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                  title="Eliminate 1 wrong option"
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>50/50 Spell ({hintSpellCount})</span>
                </button>
              </div>

              {/* Options Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {boss.questions[currentQuestionIndex].options.map((opt, idx) => {
                  const isEliminated = eliminatedOptions.includes(idx);
                  const isChosen = selectedOption === idx;
                  const isCorrect = idx === boss.questions[currentQuestionIndex].correctIndex;
                  let style = 'bg-surface border-theme text-primary hover:bg-theme-accent';

                  if (isEliminated) {
                    style = 'bg-surface/30 border-theme/40 text-muted/40 line-through cursor-not-allowed';
                  } else if (isAnswerRevealed) {
                    if (isCorrect) style = 'bg-primary text-white border-primary';
                    else if (isChosen) style = 'bg-rose-100 text-rose-800 border-rose-300';
                  }

                  return (
                    <button
                      key={idx}
                      disabled={isAnswerRevealed || isEliminated}
                      onClick={() => handleSelectOption(idx)}
                      className={`p-4 rounded-2xl border text-left text-xs font-medium transition cursor-pointer ${style}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              {/* Answer Explanation Feedback */}
              {isAnswerRevealed && (
                <div className="bg-surface rounded-2xl p-4 border border-theme space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-theme/60 pb-2">
                    <div className="text-xs font-bold text-primary flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span>Conceptual Key:</span>
                    </div>

                    {/* Live Board Pacing Diagnostic */}
                    {difficulty !== 'casual' && (
                      <div className="flex items-center gap-2">
                        {turnAllocatedSeconds - turnTimeTaken >= 0 ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>+{turnAllocatedSeconds - turnTimeTaken}s Ahead of {currentBoardPreset.shortName} Pace</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{Math.abs(turnAllocatedSeconds - turnTimeTaken)}s Slower than {currentBoardPreset.shortName} Pace</span>
                          </span>
                        )}
                        <span className="text-[10px] text-muted font-mono">({turnTimeTaken}s used)</span>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-muted leading-relaxed">
                    {boss.questions[currentQuestionIndex].critHint}
                  </p>

                  <div className="p-2.5 rounded-xl bg-theme-accent/50 border border-theme text-[11px] text-muted flex items-start gap-2">
                    <span className="shrink-0 font-bold text-primary">🏛️ {currentBoardPreset.shortName} Exam Tip:</span>
                    <span>{currentBoardPreset.description}</span>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={handleNextQuestion}
                      className="px-4 py-2 rounded-xl bg-primary hover:opacity-90 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Continue Combat</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Victory / Defeat Modal Overlay */}
          {battleResult && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-card border border-theme rounded-3xl p-8 max-w-md w-full text-center space-y-5 shadow-xl">
                <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto text-primary">
                  {battleResult === 'victory' ? <Trophy className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl font-serif italic font-bold text-primary">
                    {battleResult === 'victory' ? 'Boss Vanquished!' : 'Cognitive Defeat!'}
                  </h3>
                  <p className="text-xs text-muted">
                    {battleResult === 'victory' 
                      ? `You conquered ${boss?.bossName}! Earned +120 XP and master prestige.`
                      : `The Boss overwhelmed your defenses. Errors were logged into your Mistake Vault for cure drilling.`}
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={() => setIsInBattle(false)}
                    className="w-full py-3 rounded-2xl bg-primary hover:opacity-90 text-white text-xs font-bold transition cursor-pointer"
                  >
                    Return to Boss Headquarters
                  </button>

                  {battleResult === 'victory' && onStartFocusSprint && (
                    <button
                      onClick={() => {
                        setIsInBattle(false);
                        onStartFocusSprint(boss?.bossConcept || 'Concept');
                      }}
                      className="w-full py-3 rounded-2xl bg-theme-accent hover:bg-theme-accent/80 text-primary border border-theme text-xs font-bold transition cursor-pointer"
                    >
                      Start Focus Sprint on this Topic
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Combat Log */}
          {combatLog.length > 0 && (
            <div className="bg-card border border-theme rounded-2xl p-4 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Battle Dispatch Log</div>
              {combatLog.map((log, idx) => (
                <div key={idx} className="text-xs text-primary/80 font-mono">
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
