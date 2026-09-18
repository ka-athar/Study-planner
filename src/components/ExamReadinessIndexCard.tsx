import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Target, 
  TrendingUp, 
  Award, 
  Zap, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  BookOpen, 
  Clock, 
  ArrowRight,
  FileText,
  Flame,
  Brain
} from 'lucide-react';
import { Subject, TestResult, RevisionItem, StudySession, Topic } from '../types';

interface ExamReadinessIndexCardProps {
  subjects: Subject[];
  testResults: TestResult[];
  revisions: RevisionItem[];
  sessions: StudySession[];
  onStartSprintForTopic?: (subjectName: string, chapterName: string, topicName: string) => void;
  onOpenCheatSheetForTopic?: (subjectName: string, topicName: string) => void;
  onOpenBlurtForTopic?: (subjectName: string, chapterName: string, topicName: string) => void;
  onNavigateTab?: (tab: any) => void;
}

export const ExamReadinessIndexCard: React.FC<ExamReadinessIndexCardProps> = ({
  subjects,
  testResults,
  revisions,
  sessions,
  onStartSprintForTopic,
  onOpenCheatSheetForTopic,
  onOpenBlurtForTopic,
  onNavigateTab
}) => {
  // 1. Calculate Comprehensive 0–100% Exam Readiness Score
  const readinessAnalytics = useMemo(() => {
    // Metric 1: Syllabus Coverage (Weight: 35%)
    let totalTopics = 0;
    let completedTopics = 0;
    let masteredTopics = 0;
    const allTopicsList: Array<{
      subjectName: string;
      chapterName: string;
      topic: Topic;
      yieldScore: number;
    }> = [];

    subjects.forEach(sub => {
      sub.chapters.forEach(ch => {
        ch.topics.forEach(t => {
          totalTopics++;
          if (t.status === 'Completed' || t.status === 'Mastered') {
            completedTopics++;
          }
          if (t.status === 'Mastered') {
            masteredTopics++;
          }

          // Calculate Pareto Yield Score for prioritizing boosters:
          // Weak/Needs Revision topics have highest marginal return
          let priorityWeight = 1;
          if (t.status === 'Weak') priorityWeight = 3.5;
          else if (t.status === 'Needs Revision') priorityWeight = 3.0;
          else if (t.status === 'In Progress') priorityWeight = 2.0;
          else if (t.status === 'Not Started') priorityWeight = 1.5;
          else priorityWeight = 0.5;

          // Time spent / test accuracy inverse
          const timeSpent = t.timeSpentMinutes || 0;
          const yieldScore = priorityWeight * (100 / Math.max(15, timeSpent + 10));

          allTopicsList.push({
            subjectName: sub.name,
            chapterName: ch.name,
            topic: t,
            yieldScore
          });
        });
      });
    });

    const syllabusScore = totalTopics > 0 ? (completedTopics / totalTopics) * 100 : 0;
    const masteryBonus = totalTopics > 0 ? (masteredTopics / totalTopics) * 10 : 0;

    // Metric 2: Test & Quiz Accuracy (Weight: 25%)
    let testScore = 70; // Benchmark baseline
    if (testResults.length > 0) {
      const recentTests = testResults.slice(-10);
      const percentages = recentTests.map(t => {
        if (typeof t.percentage === 'number') return t.percentage;
        if (typeof t.scorePercentage === 'number') return t.scorePercentage;
        // Parse fraction e.g. "18 / 20"
        if (typeof t.score === 'string' && t.score.includes('/')) {
          const [num, den] = t.score.split('/').map(s => parseFloat(s.trim()));
          if (den > 0) return (num / den) * 100;
        }
        return 75;
      });
      testScore = Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length);
    }

    // Metric 3: Spaced Repetition Retention Rate (Weight: 25%)
    let sm2Score = 80;
    if (revisions.length > 0) {
      const pendingCount = revisions.filter(r => r.status === 'Pending').length;
      const totalRevs = revisions.length;
      const completedRatio = (totalRevs - pendingCount) / totalRevs;
      sm2Score = Math.round(completedRatio * 100);
    }

    // Metric 4: Study Habit Consistency / Streak (Weight: 15%)
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const past7DaysSessions = sessions.filter(s => {
      const sessionDate = s.timestamp ? s.timestamp : new Date(s.date).getTime();
      return now - sessionDate <= 7 * oneDayMs;
    });
    const uniqueActiveDays = new Set(past7DaysSessions.map(s => s.date)).size;
    const streakScore = Math.min(100, Math.round((uniqueActiveDays / 7) * 100));

    // Weighted Overall Index (0–100%)
    const rawIndex = (syllabusScore * 0.35) + (testScore * 0.25) + (sm2Score * 0.25) + (streakScore * 0.15) + masteryBonus;
    const finalScore = Math.min(100, Math.max(5, Math.round(rawIndex)));

    // Pareto 80/20 High-Yield Boosters (Top 3 topics needing the least time for maximum score lift)
    const boosters = allTopicsList
      .filter(item => item.topic.status !== 'Mastered')
      .sort((a, b) => b.yieldScore - a.yieldScore)
      .slice(0, 3);

    return {
      finalScore,
      syllabusScore: Math.round(syllabusScore),
      testScore: Math.round(testScore),
      sm2Score: Math.round(sm2Score),
      streakScore: Math.round(streakScore),
      boosters
    };
  }, [subjects, testResults, revisions, sessions]);

  const { finalScore, syllabusScore, testScore, sm2Score, streakScore, boosters } = readinessAnalytics;

  // Grade Tier Label
  let tierLabel = 'Developing Competence';
  let tierColor = 'text-amber-700 bg-amber-50 border-amber-200';
  if (finalScore >= 85) {
    tierLabel = 'Board Distinction Ready (Top Tier)';
    tierColor = 'text-emerald-800 bg-emerald-50 border-emerald-300';
  } else if (finalScore >= 70) {
    tierLabel = 'Solid Academic Standing';
    tierColor = 'text-teal-800 bg-teal-50 border-teal-200';
  } else if (finalScore < 50) {
    tierLabel = 'Foundation Stage (Requires Sprints)';
    tierColor = 'text-rose-800 bg-rose-50 border-rose-200';
  }

  return (
    <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-6">
      
      {/* HEADER ROW */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E0DBD0] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#6B705C]/20 to-[#8F947E]/20 text-[#6B705C] flex items-center justify-center font-bold shrink-0 shadow-2xs">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#4A4E4D]">
                Exam Readiness Index (0–100%)
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#6B705C]/15 text-[#6B705C]">
                Option 3 • Pareto 80/20
              </span>
            </div>
            <p className="text-xs text-[#A5A58D] mt-0.5">
              Multi-factor algorithm evaluating syllabus completion, test accuracy, retention stability, and study consistency.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-3 py-1 rounded-full border ${tierColor}`}>
            {tierLabel}
          </span>
        </div>
      </div>

      {/* CORE GAUGES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        
        {/* Main 0–100% Score Gauge (4 Cols) */}
        <div className="md:col-span-4 p-5 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-center space-y-3">
          <div className="text-[11px] font-bold text-[#A5A58D] uppercase tracking-wider">
            Composite Exam Readiness
          </div>

          <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="50%"
                cy="50%"
                r="44%"
                stroke="#E0DBD0"
                strokeWidth="8"
                fill="transparent"
              />
              <motion.circle
                cx="50%"
                cy="50%"
                r="44%"
                stroke={finalScore >= 80 ? '#10B981' : finalScore >= 60 ? '#6B705C' : '#F59E0B'}
                strokeWidth="8"
                strokeDasharray="276%"
                strokeDashoffset={`${276 - (finalScore / 100) * 276}%`}
                strokeLinecap="round"
                fill="transparent"
                initial={{ strokeDashoffset: '276%' }}
                animate={{ strokeDashoffset: `${276 - (finalScore / 100) * 276}%` }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold font-serif italic text-[#2D312E]">
                {finalScore}%
              </span>
              <span className="text-[10px] text-[#A5A58D] font-mono">Predicted Range</span>
            </div>
          </div>

          <div className="text-[11px] text-[#6B705C] leading-snug">
            {finalScore >= 80 
              ? 'Excellent mastery balance! Keep spaced repetition active.' 
              : 'Target the high-yield topics below to reach 85%+ distinction.'}
          </div>
        </div>

        {/* 4 Factor Sub-meters (8 Cols) */}
        <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
          
          {/* Factor 1: Syllabus Coverage */}
          <div className="p-3.5 rounded-2xl bg-white border border-[#E0DBD0] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#4A4E4D] flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[#6B705C]" />
                <span>Syllabus Covered</span>
              </span>
              <span className="font-mono font-bold text-[#2D312E]">{syllabusScore}%</span>
            </div>
            <div className="w-full bg-[#F2EFE9] h-2 rounded-full overflow-hidden">
              <div 
                className="bg-[#6B705C] h-full rounded-full transition-all duration-1000"
                style={{ width: `${syllabusScore}%` }}
              />
            </div>
            <div className="text-[10px] text-[#A5A58D]">35% algorithm weight</div>
          </div>

          {/* Factor 2: Spaced Repetition Retention */}
          <div className="p-3.5 rounded-2xl bg-white border border-[#E0DBD0] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#4A4E4D] flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-amber-600" />
                <span>SM-2 Memory Stability</span>
              </span>
              <span className="font-mono font-bold text-[#2D312E]">{sm2Score}%</span>
            </div>
            <div className="w-full bg-[#F2EFE9] h-2 rounded-full overflow-hidden">
              <div 
                className="bg-amber-500 h-full rounded-full transition-all duration-1000"
                style={{ width: `${sm2Score}%` }}
              />
            </div>
            <div className="text-[10px] text-[#A5A58D]">25% algorithm weight</div>
          </div>

          {/* Factor 3: Test & Mock Accuracy */}
          <div className="p-3.5 rounded-2xl bg-white border border-[#E0DBD0] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#4A4E4D] flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-indigo-600" />
                <span>Test & Mock Accuracy</span>
              </span>
              <span className="font-mono font-bold text-[#2D312E]">{testScore}%</span>
            </div>
            <div className="w-full bg-[#F2EFE9] h-2 rounded-full overflow-hidden">
              <div 
                className="bg-indigo-500 h-full rounded-full transition-all duration-1000"
                style={{ width: `${testScore}%` }}
              />
            </div>
            <div className="text-[10px] text-[#A5A58D]">25% algorithm weight</div>
          </div>

          {/* Factor 4: Study Habit Consistency */}
          <div className="p-3.5 rounded-2xl bg-white border border-[#E0DBD0] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#4A4E4D] flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-rose-500" />
                <span>7-Day Habit Consistency</span>
              </span>
              <span className="font-mono font-bold text-[#2D312E]">{streakScore}%</span>
            </div>
            <div className="w-full bg-[#F2EFE9] h-2 rounded-full overflow-hidden">
              <div 
                className="bg-rose-500 h-full rounded-full transition-all duration-1000"
                style={{ width: `${streakScore}%` }}
              />
            </div>
            <div className="text-[10px] text-[#A5A58D]">15% algorithm weight</div>
          </div>

        </div>
      </div>

      {/* PARETO 80/20 HIGH-YIELD BOOSTERS */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600 fill-amber-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#4A4E4D]">
              Top 3 High-Yield Boosters (Pareto 80/20 Leverage)
            </h4>
          </div>
          <span className="text-[11px] text-[#A5A58D]">
            Prioritize these 3 topics for maximum readiness gain per 30-min session
          </span>
        </div>

        {boosters.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {boosters.map((item, idx) => {
              const status = item.topic.status;
              const isWeak = status === 'Weak' || status === 'Needs Revision';

              return (
                <div 
                  key={idx}
                  className="p-4 rounded-2xl bg-gradient-to-b from-[#F9F7F2] to-white border border-[#E0DBD0] flex flex-col justify-between gap-3 shadow-2xs hover:border-[#6B705C] transition"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-[#6B705C] font-semibold">{item.subjectName}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isWeak ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {status}
                      </span>
                    </div>

                    <div className="font-bold text-xs text-[#2D312E] leading-snug line-clamp-2">
                      {item.topic.name}
                    </div>

                    <div className="text-[10px] text-[#A5A58D]">
                      Chapter: {item.chapterName}
                    </div>
                  </div>

                  {/* 1-Click Action Buttons for this Booster */}
                  <div className="pt-2 border-t border-[#E0DBD0] flex items-center justify-between gap-1.5">
                    {onStartSprintForTopic && (
                      <button
                        onClick={() => onStartSprintForTopic(item.subjectName, item.chapterName, item.topic.name)}
                        className="px-2.5 py-1.5 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-[11px] font-bold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                        title="Start 45-min Zen Sprint"
                      >
                        <Zap className="w-3 h-3 fill-white" />
                        <span>Sprint</span>
                      </button>
                    )}

                    {onOpenCheatSheetForTopic && (
                      <button
                        onClick={() => onOpenCheatSheetForTopic(item.subjectName, item.topic.name)}
                        className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-medium flex items-center gap-1 transition cursor-pointer"
                        title="Open 1-Page AI Cheat Sheet"
                      >
                        <FileText className="w-3 h-3 text-amber-700" />
                        <span>Sheet</span>
                      </button>
                    )}

                    {onOpenBlurtForTopic && (
                      <button
                        onClick={() => onOpenBlurtForTopic(item.subjectName, item.chapterName, item.topic.name)}
                        className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#F2EFE9] text-[#4A4E4D] border border-[#E0DBD0] text-[11px] font-medium flex items-center gap-1 transition cursor-pointer"
                        title="Test with Blurt Recall"
                      >
                        <Brain className="w-3 h-3 text-[#6B705C]" />
                        <span>Blurt</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-center text-xs text-[#A5A58D] italic">
            All enrolled syllabus topics are at solid mastery! Keep maintaining spaced repetition.
          </div>
        )}
      </div>

    </div>
  );
};
