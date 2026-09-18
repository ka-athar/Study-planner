import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  AlertCircle, 
  Brain, 
  CheckCircle2, 
  ChevronRight, 
  Flame, 
  HelpCircle, 
  Plus, 
  RefreshCw, 
  Sparkles, 
  TrendingDown, 
  TrendingUp, 
  Zap,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  ShieldCheck,
  Calendar,
  FileText
} from 'lucide-react';
import { Subject, TestResult, StudySession, StudyPlan, ActiveTab, ExamDate } from '../types';
import { triggerStudyGoalConfetti } from '../lib/confetti';
import { DiagnosticReportModal } from './DiagnosticReportModal';

export interface TopicRetentionStat {
  subjectName: string;
  chapterName: string;
  topicName: string;
  retentionScore: number; // 0 - 100
  status: 'critical' | 'moderate' | 'mastered';
  lastStudiedDate?: string;
  daysSinceLastStudied: number;
  testScoreAverage?: number;
  mistakesCount: number;
  totalStudyMinutes: number;
  isWeakSpot: boolean;
}

interface ExamDiagnosticHeatmapProps {
  subjects: Subject[];
  testResults: TestResult[];
  sessions: StudySession[];
  plans: StudyPlan[];
  examDates?: ExamDate[];
  onAddTopicToPlan?: (topicName: string, subjectName: string, chapterName: string, date: string) => void;
  setActiveTab: (tab: ActiveTab) => void;
  onSendPromptToTutor?: (prompt: string) => void;
}

export const ExamDiagnosticHeatmap: React.FC<ExamDiagnosticHeatmapProps> = ({
  subjects,
  testResults,
  sessions,
  plans,
  examDates = [],
  onAddTopicToPlan,
  setActiveTab,
  onSendPromptToTutor
}) => {
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [activeViewMode, setActiveViewMode] = useState<'matrix' | 'list'>('matrix');
  const [selectedTopicDetail, setSelectedTopicDetail] = useState<TopicRetentionStat | null>(null);
  const [addedTopicKeys, setAddedTopicKeys] = useState<Set<string>>(new Set());
  const [isDiagnosticReportModalOpen, setIsDiagnosticReportModalOpen] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  // Compute Retention and Diagnostic Score for Every Topic across all subjects
  const topicStats: TopicRetentionStat[] = useMemo(() => {
    const stats: TopicRetentionStat[] = [];
    const now = new Date().getTime();

    subjects.forEach(subject => {
      subject.chapters?.forEach(chapter => {
        chapter.topics?.forEach(topic => {
          const subName = (subject.name || '').toLowerCase();
          const topName = (topic.name || '').toLowerCase();

          // Find matching study sessions
          const topicSessions = sessions.filter(
            s => (s.subjectName || '').toLowerCase() === subName &&
                 (((s.topicName || '').toLowerCase().includes(topName)) || 
                  (topName.includes((s.topicName || '').toLowerCase())))
          );

          const totalMins = topicSessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);

          // Find latest session date
          let latestDateStr: string | undefined = undefined;
          let daysSince = 14; // default unstudied penalty

          if (topicSessions.length > 0) {
            // Sort by date desc
            const sorted = [...topicSessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            latestDateStr = sorted[0].date;
            const diffTime = Math.abs(now - new Date(latestDateStr + 'T12:00:00').getTime());
            daysSince = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
          }

          // Find test results touching this subject/topic
          const matchingTests = testResults.filter(
            t => (t.subjectName || '').toLowerCase() === subName &&
                 (((t.testName || '').toLowerCase().includes(topName)) ||
                  (t.analysis?.strengthsAndWeaknesses?.weaknesses || []).some(w => (w || '').toLowerCase().includes(topName)) ||
                  (t.analysis?.keyTopicsToRevise || []).some(k => (k || '').toLowerCase().includes(topName)))
          );

          let avgScore: number | undefined = undefined;
          let mistakesCount = 0;

          if (matchingTests.length > 0) {
            const numericScores = matchingTests
              .map(t => parseFloat(t.score))
              .filter(s => !isNaN(s));
            if (numericScores.length > 0) {
              avgScore = Math.round(numericScores.reduce((a, b) => a + b, 0) / numericScores.length);
            }
            mistakesCount = matchingTests.reduce((acc, t) => acc + (t.mistakes ? 1 : 0), 0);
          }

          // Retention formula simulation (Ebbinghaus decay curve)
          // Base stability: 5 days + 2 days per 30 mins studied
          const stabilityDays = Math.max(3, 4 + (totalMins / 30) * 2.5);
          // Test score factor (0.5 to 1.3)
          const testFactor = avgScore !== undefined ? (avgScore / 100) * 0.8 + 0.4 : (topic.isCompleted ? 0.85 : 0.45);
          // Mistakes penalty
          const mistakePenalty = mistakesCount * 12;

          // Decay exponent
          const rawRetention = 100 * Math.exp(-daysSince / (stabilityDays * testFactor)) - mistakePenalty;
          const clampedRetention = Math.max(10, Math.min(100, Math.round(rawRetention)));

          let status: 'critical' | 'moderate' | 'mastered' = 'moderate';
          let isWeakSpot = false;

          if (clampedRetention < 50 || mistakesCount > 0 || (avgScore !== undefined && avgScore < 60)) {
            status = 'critical';
            isWeakSpot = true;
          } else if (clampedRetention >= 80 && (avgScore === undefined || avgScore >= 75)) {
            status = 'mastered';
          }

          stats.push({
            subjectName: subject.name,
            chapterName: chapter.name,
            topicName: topic.name,
            retentionScore: clampedRetention,
            status,
            lastStudiedDate: latestDateStr,
            daysSinceLastStudied: daysSince,
            testScoreAverage: avgScore,
            mistakesCount,
            totalStudyMinutes: totalMins,
            isWeakSpot
          });
        });
      });
    });

    return stats;
  }, [subjects, testResults, sessions]);

  // Filtered stats by subject
  const filteredStats = useMemo(() => {
    if (selectedSubjectFilter === 'all') return topicStats;
    const filterClean = (selectedSubjectFilter || '').toLowerCase();
    return topicStats.filter(s => (s.subjectName || '').toLowerCase() === filterClean);
  }, [topicStats, selectedSubjectFilter]);

  // Overall Exam Readiness & Summary Metrics
  const summaryMetrics = useMemo(() => {
    if (topicStats.length === 0) return { readinessScore: 0, criticalCount: 0, moderateCount: 0, masteredCount: 0 };
    const avgRetention = Math.round(topicStats.reduce((acc, s) => acc + s.retentionScore, 0) / topicStats.length);
    const critical = topicStats.filter(s => s.status === 'critical').length;
    const moderate = topicStats.filter(s => s.status === 'moderate').length;
    const mastered = topicStats.filter(s => s.status === 'mastered').length;

    return {
      readinessScore: avgRetention,
      criticalCount: critical,
      moderateCount: moderate,
      masteredCount: mastered
    };
  }, [topicStats]);

  // Top Critical Weak Spots (sorted by lowest retention score)
  const topCriticalWeakSpots = useMemo(() => {
    return [...topicStats]
      .filter(s => s.status === 'critical' || s.isWeakSpot)
      .sort((a, b) => a.retentionScore - b.retentionScore)
      .slice(0, 4);
  }, [topicStats]);

  // 1-Click Action: Add weak topic to tomorrow's study plan
  const handleAddToPlan = (stat: TopicRetentionStat) => {
    if (onAddTopicToPlan) {
      onAddTopicToPlan(stat.topicName, stat.subjectName, stat.chapterName, tomorrowStr);
      setAddedTopicKeys(prev => new Set(prev).add(`${stat.subjectName}-${stat.topicName}`));
      triggerStudyGoalConfetti();
    }
  };

  // 1-Click Action: Queue all top critical weak spots to plan
  const handleRescueAllWeakSpots = () => {
    topCriticalWeakSpots.forEach(stat => {
      if (onAddTopicToPlan && !addedTopicKeys.has(`${stat.subjectName}-${stat.topicName}`)) {
        onAddTopicToPlan(stat.topicName, stat.subjectName, stat.chapterName, tomorrowStr);
        setAddedTopicKeys(prev => new Set(prev).add(`${stat.subjectName}-${stat.topicName}`));
      }
    });
    triggerStudyGoalConfetti();
  };

  return (
    <div className="space-y-6">
      {/* Header & Overall Exam Readiness Banner */}
      <div className="bg-gradient-to-br from-[#2B2D42] to-[#1E202F] text-white rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden">
        {/* Subtle decorative background elements */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#6B705C]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#DDBEA9] text-xs font-bold uppercase tracking-wider">
              <Brain className="w-3.5 h-3.5" />
              <span>AI Exam Diagnostic & Retention Heatmap</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">
              Memory Decay & Exam Readiness Map
            </h2>
            <p className="text-sm text-[#E0DBD0] leading-relaxed">
              Powered by Ebbinghaus memory decay curves and test mistake analytics to pinpoint knowledge decay before test day.
            </p>
          </div>

          {/* Readiness Score Ring Card */}
          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-5 flex items-center gap-5 shrink-0 self-start md:self-auto">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth="8"
                />
                <motion.circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke={
                    summaryMetrics.readinessScore >= 75 ? '#10B981' :
                    summaryMetrics.readinessScore >= 50 ? '#F59E0B' : '#EF4444'
                  }
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 40}
                  initial={{ strokeDashoffset: 2 * Math.PI * 40 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 40 * (1 - summaryMetrics.readinessScore / 100) }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-bold font-serif">{summaryMetrics.readinessScore}%</span>
                <span className="text-[9px] uppercase tracking-wider text-[#DDBEA9] font-mono">Readiness</span>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-300 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>{summaryMetrics.masteredCount} Mastered</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>{summaryMetrics.moderateCount} Needs Review</span>
              </div>
              <div className="flex items-center gap-1.5 text-rose-300 font-semibold">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse"></span>
                <span>{summaryMetrics.criticalCount} Critical Weak Spots</span>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setIsDiagnosticReportModalOpen(true)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 text-[11px] font-bold transition cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Diagnostic Text Report</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Critical Weak Spots Alert & Smart Rescue Banner */}
      {topCriticalWeakSpots.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-50/80 border border-rose-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-rose-100 text-rose-700">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-rose-950 font-serif">
                  Urgent Weak Spots Detected ({topCriticalWeakSpots.length})
                </h3>
                <p className="text-xs text-rose-700">
                  These topics have low retention decay scores or recorded test mistakes. Rescue them before they fade!
                </p>
              </div>
            </div>

            <button
              onClick={handleRescueAllWeakSpots}
              className="px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition cursor-pointer self-start sm:self-auto shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              <span>Rescue All to Tomorrow's Plan</span>
            </button>
          </div>

          {/* Grid of Weak Spot Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {topCriticalWeakSpots.map((stat) => {
              const isAdded = addedTopicKeys.has(`${stat.subjectName}-${stat.topicName}`);
              return (
                <div
                  key={`${stat.subjectName}-${stat.topicName}`}
                  className="bg-white border border-rose-200/80 rounded-2xl p-3.5 space-y-2.5 shadow-2xs hover:border-rose-300 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-bold">
                      {stat.subjectName}
                    </span>
                    <span className="text-xs font-mono font-bold text-rose-600">
                      {stat.retentionScore}% Retention
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-[#4A4E4D] line-clamp-1" title={stat.topicName}>
                      {stat.topicName}
                    </h4>
                    <p className="text-[10px] text-[#A5A58D] line-clamp-1">
                      {stat.chapterName}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-[#A5A58D] border-t border-[#EAE7DF] pt-2">
                    <span>{stat.daysSinceLastStudied}d ago</span>
                    <span>{stat.mistakesCount > 0 ? `${stat.mistakesCount} mistakes` : 'Low practice'}</span>
                  </div>

                  <button
                    onClick={() => handleAddToPlan(stat)}
                    disabled={isAdded}
                    className={`w-full py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      isAdded
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                    }`}
                  >
                    {isAdded ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Queued for Tomorrow</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add to Tomorrow's Plan</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Filter Bar & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#E0DBD0] rounded-2xl p-4 shadow-xs">
        {/* Subject Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedSubjectFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              selectedSubjectFilter === 'all'
                ? 'bg-[#6B705C] text-white shadow-2xs'
                : 'bg-[#F2EFE9] text-[#4A4E4D] hover:bg-[#EAE7DF]'
            }`}
          >
            All Subjects ({topicStats.length})
          </button>
          {subjects.map(s => {
            const count = topicStats.filter(st => (st.subjectName || '').toLowerCase() === (s.name || '').toLowerCase()).length;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedSubjectFilter(s.name)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                  (selectedSubjectFilter || '').toLowerCase() === (s.name || '').toLowerCase()
                    ? 'bg-[#6B705C] text-white shadow-2xs'
                    : 'bg-[#F2EFE9] text-[#4A4E4D] hover:bg-[#EAE7DF]'
                }`}
              >
                {s.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs font-mono text-[#A5A58D] shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>Mastered (80%+)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
            <span>Review Due (50-79%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span>Weak Spot (&lt;50%)</span>
          </div>
        </div>
      </div>

      {/* Heatmap Grid Matrix */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {filteredStats.map((stat, idx) => {
          const isSelected = selectedTopicDetail?.topicName === stat.topicName && selectedTopicDetail?.subjectName === stat.subjectName;
          
          let bgColor = 'bg-emerald-50 border-emerald-200 text-emerald-950 hover:bg-emerald-100';
          let badgeColor = 'bg-emerald-100 text-emerald-800';
          let retentionTextColor = 'text-emerald-700';

          if (stat.status === 'critical') {
            bgColor = 'bg-rose-50 border-rose-300 text-rose-950 hover:bg-rose-100';
            badgeColor = 'bg-rose-100 text-rose-800';
            retentionTextColor = 'text-rose-600';
          } else if (stat.status === 'moderate') {
            bgColor = 'bg-amber-50 border-amber-300 text-amber-950 hover:bg-amber-100';
            badgeColor = 'bg-amber-100 text-amber-800';
            retentionTextColor = 'text-amber-700';
          }

          return (
            <motion.div
              key={`${stat.subjectName}-${stat.topicName}-${idx}`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedTopicDetail(stat)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 shadow-2xs ${bgColor} ${
                isSelected ? 'ring-2 ring-[#6B705C]' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${badgeColor}`}>
                  {stat.subjectName.slice(0, 8)}
                </span>
                <span className={`text-[11px] font-mono font-bold ${retentionTextColor}`}>
                  {stat.retentionScore}%
                </span>
              </div>

              <div className="space-y-0.5">
                <h4 className="text-xs font-bold line-clamp-2" title={stat.topicName}>
                  {stat.topicName}
                </h4>
                <p className="text-[10px] text-[#A5A58D] line-clamp-1">
                  {stat.chapterName}
                </p>
              </div>

              <div className="flex items-center justify-between text-[9px] font-mono text-[#A5A58D] border-t border-black/5 pt-1.5">
                <span>{stat.daysSinceLastStudied === 0 ? 'Today' : `${stat.daysSinceLastStudied}d ago`}</span>
                <span>{stat.totalStudyMinutes}m total</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Selected Topic Inspector Drawer / Modal */}
      <AnimatePresence>
        {selectedTopicDetail && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-lg space-y-5"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#E0DBD0] pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#F2EFE9] text-[#6B705C]">
                    {selectedTopicDetail.subjectName}
                  </span>
                  <span className="text-xs text-[#A5A58D] font-mono">
                    {selectedTopicDetail.chapterName}
                  </span>
                </div>
                <h3 className="text-lg font-bold font-serif text-[#2B2D42]">
                  {selectedTopicDetail.topicName}
                </h3>
              </div>

              <button
                onClick={() => setSelectedTopicDetail(null)}
                className="p-1.5 rounded-xl hover:bg-[#F2EFE9] text-[#A5A58D] hover:text-[#4A4E4D] transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-center space-y-1">
                <span className="text-xs uppercase font-bold text-[#A5A58D]">Retention Score</span>
                <div className="text-2xl font-bold font-serif text-[#4A4E4D]">
                  {selectedTopicDetail.retentionScore}%
                </div>
                <span className="text-[10px] text-[#A5A58D]">Decay index</span>
              </div>

              <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-center space-y-1">
                <span className="text-xs uppercase font-bold text-[#A5A58D]">Time Since Studied</span>
                <div className="text-2xl font-bold font-serif text-[#4A4E4D]">
                  {selectedTopicDetail.daysSinceLastStudied}d
                </div>
                <span className="text-[10px] text-[#A5A58D]">
                  {selectedTopicDetail.lastStudiedDate || 'Never logged'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-center space-y-1">
                <span className="text-xs uppercase font-bold text-[#A5A58D]">Test Mistakes</span>
                <div className="text-2xl font-bold font-serif text-[#4A4E4D]">
                  {selectedTopicDetail.mistakesCount}
                </div>
                <span className="text-[10px] text-[#A5A58D]">logged errors</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => handleAddToPlan(selectedTopicDetail)}
                disabled={addedTopicKeys.has(`${selectedTopicDetail.subjectName}-${selectedTopicDetail.topicName}`)}
                className="px-4 py-2 rounded-2xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-bold shadow-xs flex items-center gap-2 transition cursor-pointer disabled:bg-emerald-600"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {addedTopicKeys.has(`${selectedTopicDetail.subjectName}-${selectedTopicDetail.topicName}`)
                    ? 'Queued in Tomorrow’s Plan'
                    : 'Add to Tomorrow’s Study Plan'}
                </span>
              </button>

              <button
                onClick={() => {
                  if (onSendPromptToTutor) {
                    onSendPromptToTutor(`Can you explain the key concepts and common test mistakes for "${selectedTopicDetail.topicName}" in ${selectedTopicDetail.subjectName}?`);
                    setActiveTab('chat');
                  }
                }}
                className="px-4 py-2 rounded-2xl bg-[#F2EFE9] hover:bg-[#EAE7DF] text-[#4A4E4D] text-xs font-bold border border-[#E0DBD0] flex items-center gap-2 transition cursor-pointer"
              >
                <Brain className="w-4 h-4 text-[#6B705C]" />
                <span>Ask AI Tutor to Clarify</span>
              </button>

              <button
                onClick={() => setActiveTab('flashcards')}
                className="px-4 py-2 rounded-2xl bg-[#F2EFE9] hover:bg-[#EAE7DF] text-[#4A4E4D] text-xs font-bold border border-[#E0DBD0] flex items-center gap-2 transition cursor-pointer"
              >
                <Layers className="w-4 h-4 text-[#6B705C]" />
                <span>Practice with Flashcards</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comprehensive Diagnostic & Remedial Text Report Modal */}
      <DiagnosticReportModal
        isOpen={isDiagnosticReportModalOpen}
        onClose={() => setIsDiagnosticReportModalOpen(false)}
        subjects={subjects}
        testResults={testResults}
        sessions={sessions}
        onSendPromptToTutor={onSendPromptToTutor}
      />
    </div>
  );
};
