import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  BookOpen, 
  CheckCircle2, 
  AlertTriangle, 
  Award, 
  Circle, 
  Sparkles, 
  Target, 
  Flame, 
  Sliders, 
  Clock, 
  Play, 
  Brain, 
  ArrowRight,
  ShieldCheck,
  Zap,
  GraduationCap,
  Timer,
  RotateCcw,
  Calendar
} from 'lucide-react';
import { Subject, TopicStatus, UserProfile, TestResult, FlashcardDeck, StudySession, RevisionItem } from '../types';

interface ProgressViewProps {
  subjects: Subject[];
  userProfile?: UserProfile | null;
  testResults?: TestResult[];
  flashcardDecks?: FlashcardDeck[];
  sessions?: StudySession[];
  revisions?: RevisionItem[];
  onStartTimerForTopic?: (subjectName: string, chapterName: string, topicName: string) => void;
  onNavigateTab?: (tab: any) => void;
}

export const ProgressView: React.FC<ProgressViewProps> = ({
  subjects,
  userProfile,
  testResults = [],
  flashcardDecks = [],
  sessions = [],
  revisions = [],
  onStartTimerForTopic,
  onNavigateTab
}) => {
  // Score Boost Simulator State
  const [extraStudyHours, setExtraStudyHours] = useState<number>(10);
  const [selectedSimSubject, setSelectedSimSubject] = useState<string>('ALL');
  const [topicTimerFilter, setTopicTimerFilter] = useState<'all' | string>('all');

  // Compute Total Timer Minutes & Topic Breakdown
  const totalTimerMinutes = useMemo(() => {
    return sessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  }, [sessions]);

  const totalTimerSessions = sessions.length;
  const avgSessionMins = totalTimerSessions > 0 ? Math.round(totalTimerMinutes / totalTimerSessions) : 0;

  // Topic Level Timer Stats
  const topicTimerStats = useMemo(() => {
    interface TopicStat {
      subject: string;
      chapter: string;
      topic: string;
      totalMinutes: number;
      sessionsCount: number;
      lastStudied: string;
      status: TopicStatus;
      result?: string;
    }
    const map = new Map<string, TopicStat>();

    // From syllabus topics
    subjects.forEach(sub => {
      sub.chapters.forEach(ch => {
        ch.topics.forEach(t => {
          const key = `${sub.name.trim().toLowerCase()}::${t.name.trim().toLowerCase()}`;
          const minutes = t.timeSpentMinutes || 0;
          const count = t.sessionsCount || 0;
          if (minutes > 0 || count > 0) {
            map.set(key, {
              subject: sub.name,
              chapter: ch.name,
              topic: t.name,
              totalMinutes: minutes,
              sessionsCount: count,
              lastStudied: t.lastStudiedAt || 'Recently',
              status: t.status
            });
          }
        });
      });
    });

    // From sessions array
    sessions.forEach(s => {
      const key = `${s.subjectName.trim().toLowerCase()}::${s.topicName.trim().toLowerCase()}`;
      const existing = map.get(key);
      if (existing) {
        // If syllabus wasn't updated yet or sessions sum is higher
        const sessionsForTopic = sessions.filter(
          item => item.subjectName.trim().toLowerCase() === s.subjectName.trim().toLowerCase() &&
                  item.topicName.trim().toLowerCase() === s.topicName.trim().toLowerCase()
        );
        const sumMins = sessionsForTopic.reduce((sum, it) => sum + (it.durationMinutes || 0), 0);
        existing.totalMinutes = Math.max(existing.totalMinutes, sumMins);
        existing.sessionsCount = Math.max(existing.sessionsCount, sessionsForTopic.length);
        if (s.date && (!existing.lastStudied || s.date > existing.lastStudied)) {
          existing.lastStudied = s.date;
        }
        if (s.result) existing.result = s.result;
      } else {
        const sessionsForTopic = sessions.filter(
          item => item.subjectName.trim().toLowerCase() === s.subjectName.trim().toLowerCase() &&
                  item.topicName.trim().toLowerCase() === s.topicName.trim().toLowerCase()
        );
        const sumMins = sessionsForTopic.reduce((sum, it) => sum + (it.durationMinutes || 0), 0);
        map.set(key, {
          subject: s.subjectName,
          chapter: s.chapterName || '',
          topic: s.topicName,
          totalMinutes: sumMins,
          sessionsCount: sessionsForTopic.length,
          lastStudied: s.date || 'Recently',
          status: s.result === 'Mastered' ? 'Mastered' : 'Completed',
          result: s.result
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [subjects, sessions]);

  // Subject timer study time map
  const subjectTimerTimeMap = useMemo(() => {
    const map: Record<string, number> = {};
    topicTimerStats.forEach(t => {
      map[t.subject] = (map[t.subject] || 0) + t.totalMinutes;
    });
    return map;
  }, [topicTimerStats]);

  const formatMins = (mins: number) => {
    if (!mins || mins <= 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  };

  // Compute Global Analytics
  let globalTotalTopics = 0;
  let globalMastered = 0;
  let globalCompleted = 0;
  let globalInProgress = 0;
  let globalWeak = 0;
  let globalNeedsRevision = 0;
  let globalNotStarted = 0;

  const weakTopicsList: { subject: string; chapter: string; topic: string; notes?: string }[] = [];

  subjects.forEach(sub => {
    sub.chapters.forEach(ch => {
      ch.topics.forEach(t => {
        globalTotalTopics++;
        if (t.status === 'Mastered') globalMastered++;
        else if (t.status === 'Completed') globalCompleted++;
        else if (t.status === 'In Progress') globalInProgress++;
        else if (t.status === 'Weak') {
          globalWeak++;
          weakTopicsList.push({ subject: sub.name, chapter: ch.name, topic: t.name, notes: t.weakNotes });
        } else if (t.status === 'Needs Revision') {
          globalNeedsRevision++;
          weakTopicsList.push({ subject: sub.name, chapter: ch.name, topic: t.name, notes: t.weakNotes });
        } else {
          globalNotStarted++;
        }
      });
    });
  });

  // Calculate Base Readiness Score (0-100)
  // Mastered = 100%, Completed = 85%, In Progress = 35%, Weak = 10%
  const effectiveScore = globalTotalTopics > 0
    ? (globalMastered * 1.0 + globalCompleted * 0.85 + globalInProgress * 0.35 + globalWeak * 0.10) / globalTotalTopics
    : 0;
  const baseReadinessScore = Math.min(100, Math.round(effectiveScore * 100));

  // Simulated Score Boost based on extra hours
  // Each hour yields approx +0.65% readiness boost up to 100%
  const boostGain = Math.round(Math.min(100 - baseReadinessScore, extraStudyHours * 0.75));
  const simulatedReadinessScore = Math.min(100, baseReadinessScore + boostGain);

  // Flashcards retention metric
  const totalCards = flashcardDecks.reduce((acc, d) => acc + d.cards.length, 0);
  const masteredCards = flashcardDecks.reduce((acc, d) => acc + d.cards.filter(c => c.mastered).length, 0);
  const cardRetentionRate = totalCards > 0 ? Math.round((masteredCards / totalCards) * 100) : 0;

  // Next Upcoming Exam
  const upcomingExam = userProfile?.examDates && userProfile.examDates.length > 0
    ? userProfile.examDates[0]
    : null;

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-2xl bg-[#6B705C]/10 text-[#6B705C]">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-serif italic font-bold text-[#6B705C]">
              Syllabus Analytics & Exam Readiness Simulator
            </h2>
          </div>
          <p className="text-xs text-[#A5A58D]">
            Comprehensive mastery breakdown, cognitive retention index, and predictive score boost modeling.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Year Profile Badge */}
          <div className="p-2.5 px-3.5 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl flex items-center gap-2.5">
            <GraduationCap className="w-4 h-4 text-[#6B705C]" />
            <div className="text-xs">
              <span className="text-[10px] uppercase font-mono font-bold text-[#A5A58D] block">Academic Year</span>
              <span className="font-semibold text-[#4A4E4D]">{userProfile?.academicYear || '2026 - 2027'} ({userProfile?.yearLevel || 'Year 3'})</span>
            </div>
          </div>

          {upcomingExam && (
            <div className="p-2.5 px-3.5 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl flex items-center gap-2.5">
              <Target className="w-4 h-4 text-[#6B705C]" />
              <div className="text-xs">
                <span className="text-[10px] uppercase font-mono font-bold text-[#A5A58D] block">Target Exam</span>
                <span className="font-semibold text-[#4A4E4D]">{upcomingExam.examName} ({upcomingExam.date})</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI EXAM READINESS & SCORE BOOST SIMULATOR CARD */}
      <div className="bg-gradient-to-br from-[#FFFFFF] via-[#FAF8F5] to-[#F2EFE9] border border-[#6B705C]/30 rounded-3xl p-6 sm:p-7 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E0DBD0] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#6B705C]" />
              <h3 className="text-base font-serif italic font-bold text-[#4A4E4D]">
                Predictive Exam Readiness & Score Simulator
              </h3>
            </div>
            <p className="text-xs text-[#A5A58D]">
              Calculated using syllabus depth, conceptual mastery weights, flashcard retention, and weak spot deconstruction.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-white px-5 py-2.5 rounded-2xl border border-[#E0DBD0] shadow-xs">
            <div>
              <span className="text-[10px] uppercase font-mono font-bold text-[#A5A58D] block">Current Readiness</span>
              <div className="text-2xl font-bold font-serif text-[#6B705C]">{baseReadinessScore}%</div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#A5A58D]" />
            <div>
              <span className="text-[10px] uppercase font-mono font-bold text-emerald-800 block">Simulated Score</span>
              <div className="text-2xl font-bold font-serif text-emerald-800">
                {simulatedReadinessScore}% <span className="text-xs font-mono text-emerald-800">(+{boostGain}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Simulator Slider */}
        <div className="space-y-3 bg-white/70 p-4 rounded-2xl border border-[#E0DBD0]">
          <div className="flex items-center justify-between text-xs">
            <label className="font-bold text-[#6B705C] flex items-center gap-2 uppercase tracking-wider text-[11px]">
              <Sliders className="w-3.5 h-3.5" />
              <span>Simulate Focused Study Investment: <span className="font-mono text-[#4A4E4D] font-bold">{extraStudyHours} hours</span></span>
            </label>
            <span className="font-mono text-[#6B705C] text-[11px] font-bold">
              Projected Boost: +{boostGain}% Readiness
            </span>
          </div>

          <input
            type="range"
            min="2"
            max="40"
            step="2"
            value={extraStudyHours}
            onChange={(e) => setExtraStudyHours(Number(e.target.value))}
            className="w-full accent-[#6B705C] cursor-pointer"
          />

          <div className="flex items-center justify-between text-[10px] font-mono text-[#A5A58D]">
            <span>2 hours (Quick refresh)</span>
            <span>20 hours (Full Chapter Mastery)</span>
            <span>40 hours (Peak Exam Preparedness)</span>
          </div>
        </div>

        {/* Global Metric Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-white border border-[#E0DBD0]">
            <span className="block text-[10px] text-[#A5A58D] font-mono font-bold uppercase">Total Topics</span>
            <span className="text-lg font-bold text-[#4A4E4D]">{globalTotalTopics}</span>
            <span className="block text-[10px] text-[#6B705C] mt-0.5">{globalMastered} Mastered ({Math.round(globalTotalTopics > 0 ? (globalMastered / globalTotalTopics) * 100 : 0)}%)</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-[#E0DBD0]">
            <span className="block text-[10px] text-[#A5A58D] font-mono font-bold uppercase">In Progress / Review</span>
            <span className="text-lg font-bold text-amber-800">{globalInProgress + globalNeedsRevision}</span>
            <span className="block text-[10px] text-amber-800 mt-0.5">Active recall required</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-[#E0DBD0]">
            <span className="block text-[10px] text-[#A5A58D] font-mono font-bold uppercase">Weak Gaps</span>
            <span className="text-lg font-bold text-rose-800">{globalWeak}</span>
            <span className="block text-[10px] text-rose-800 mt-0.5">High-priority targets</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-[#E0DBD0]">
            <span className="block text-[10px] text-[#A5A58D] font-mono font-bold uppercase">Flashcard Retention</span>
            <span className="text-lg font-bold text-[#6B705C]">{cardRetentionRate}%</span>
            <span className="block text-[10px] text-[#6B705C] mt-0.5">{totalCards} cards active</span>
          </div>
        </div>
      </div>

      {/* TOP HIGH-YIELD GAPS TO ACCELERATE SCORE */}
      {weakTopicsList.length > 0 && (
        <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-800" />
              <h3 className="text-sm font-bold text-[#6B705C] uppercase tracking-widest">
                Highest Yield Gap Topics ({weakTopicsList.length} remaining)
              </h3>
            </div>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('flashcards')}
                className="text-xs font-semibold text-[#6B705C] hover:text-[#5a5f4e] flex items-center gap-1 cursor-pointer"
              >
                <Brain className="w-3.5 h-3.5" />
                <span>Drill Flashcards</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {weakTopicsList.slice(0, 6).map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] hover:border-[#6B705C]/40 transition space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EAE7DF] text-[#6B705C]">
                      {item.subject}
                    </span>
                    <span className="text-xs font-mono text-[#A5A58D] truncate">{item.chapter}</span>
                  </div>
                  <h4 className="text-xs font-bold text-[#4A4E4D] line-clamp-1">{item.topic}</h4>
                  {item.notes && <p className="text-[11px] text-rose-800 italic line-clamp-1">{item.notes}</p>}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-[#E0DBD0]/60">
                  {onStartTimerForTopic && (
                    <button
                      onClick={() => onStartTimerForTopic(item.subject, item.chapter, item.topic)}
                      className="w-full px-3 py-1.5 bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-medium rounded-full shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-95"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Revise 25m</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SAVED STUDY TIME & TIMER TOPIC INVESTMENT SECTION */}
      <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E0DBD0]/80 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800">
                <Timer className="w-5 h-5" />
              </div>
              <h3 className="text-base font-serif italic font-bold text-[#6B705C]">
                Saved Study Time & Topic Investment
              </h3>
            </div>
            <p className="text-xs text-[#A5A58D]">
              Accumulated focus minutes saved from the Study Timer across all syllabus topics.
            </p>
          </div>

          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('revision')}
              className="px-4 py-2 bg-[#F2EFE9] hover:bg-[#EAE7DF] border border-[#E0DBD0] text-[#6B705C] text-xs font-semibold rounded-full transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Open Revision Queue</span>
            </button>
          )}
        </div>

        {/* 4 Summary Metric Boxes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0]">
            <span className="block text-[10px] text-[#A5A58D] font-mono font-bold uppercase">Total Time Saved</span>
            <span className="text-lg font-bold font-mono text-emerald-800">{formatMins(totalTimerMinutes)}</span>
            <span className="block text-[10px] text-[#A5A58D] mt-0.5">Across {totalTimerSessions} sessions</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0]">
            <span className="block text-[10px] text-[#A5A58D] font-mono font-bold uppercase">Timer Sessions</span>
            <span className="text-lg font-bold font-mono text-[#4A4E4D]">{totalTimerSessions}</span>
            <span className="block text-[10px] text-[#6B705C] mt-0.5">Focus blocks logged</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0]">
            <span className="block text-[10px] text-[#A5A58D] font-mono font-bold uppercase">Topics Covered</span>
            <span className="text-lg font-bold font-mono text-[#4A4E4D]">{topicTimerStats.length}</span>
            <span className="block text-[10px] text-[#A5A58D] mt-0.5">Topics with timer data</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0]">
            <span className="block text-[10px] text-[#A5A58D] font-mono font-bold uppercase">Avg Session Length</span>
            <span className="text-lg font-bold font-mono text-[#6B705C]">{avgSessionMins}m</span>
            <span className="block text-[10px] text-[#A5A58D] mt-0.5">Minutes per session</span>
          </div>
        </div>

        {/* Topic Breakdown List */}
        {topicTimerStats.length > 0 ? (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#6B705C] uppercase tracking-wider">
                Topics Studied with Timer ({topicTimerStats.length})
              </span>
              {subjects.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <button
                    onClick={() => setTopicTimerFilter('all')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                      topicTimerFilter === 'all'
                        ? 'bg-[#6B705C] text-white'
                        : 'bg-[#F2EFE9] text-[#6B705C] hover:bg-[#EAE7DF]'
                    }`}
                  >
                    All
                  </button>
                  {subjects.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setTopicTimerFilter(s.name)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                        topicTimerFilter === s.name
                          ? 'bg-[#6B705C] text-white'
                          : 'bg-[#F2EFE9] text-[#6B705C] hover:bg-[#EAE7DF]'
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {topicTimerStats
                .filter(t => topicTimerFilter === 'all' || t.subject === topicTimerFilter)
                .map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] hover:border-[#6B705C]/40 transition space-y-2.5 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EAE7DF] text-[#6B705C]">
                          {item.subject}
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          <span>{formatMins(item.totalMinutes)}</span>
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-[#4A4E4D] line-clamp-1">{item.topic}</h4>
                      {item.chapter && (
                        <span className="text-[11px] font-mono text-[#A5A58D] block truncate">{item.chapter}</span>
                      )}
                    </div>

                    <div className="pt-2 border-t border-[#E0DBD0]/60 flex items-center justify-between text-[11px] text-[#A5A58D]">
                      <span>{item.sessionsCount} session{item.sessionsCount > 1 ? 's' : ''}</span>
                      {onStartTimerForTopic && (
                        <button
                          onClick={() => onStartTimerForTopic(item.subject, item.chapter, item.topic)}
                          className="px-2.5 py-1 rounded-full bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-[11px] font-medium transition flex items-center gap-1 cursor-pointer"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          <span>Timer</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 bg-[#F9F7F2] rounded-2xl border border-dashed border-[#E0DBD0] text-xs text-[#A5A58D] space-y-1">
            <Timer className="w-6 h-6 text-[#A5A58D] mx-auto" />
            <p className="font-semibold text-[#4A4E4D]">No timer sessions recorded yet.</p>
            <p>Use the Study Timer to track focus time for any topic and see it saved here.</p>
          </div>
        )}
      </div>

      {/* Subject Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {subjects.map((sub) => {
          let totalTopics = 0;
          let completed = 0;
          let mastered = 0;
          let weak = 0;
          let inProgress = 0;
          let notStarted = 0;
          let needsRevision = 0;

          sub.chapters.forEach(ch => {
            ch.topics.forEach(t => {
              totalTopics++;
              if (t.status === 'Completed') completed++;
              else if (t.status === 'Mastered') mastered++;
              else if (t.status === 'Weak') weak++;
              else if (t.status === 'In Progress') inProgress++;
              else if (t.status === 'Needs Revision') needsRevision++;
              else notStarted++;
            });
          });

          const percent = totalTopics > 0 ? Math.round(((completed + mastered) / totalTopics) * 100) : 0;
          const subTimerMinutes = subjectTimerTimeMap[sub.name] || 0;

          return (
            <div key={sub.id} className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#E0DBD0] pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: sub.color || '#6B705C' }}></span>
                    <h3 className="text-base font-serif italic font-bold text-[#6B705C]">{sub.name}</h3>
                  </div>
                  {subTimerMinutes > 0 && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                      <Timer className="w-3 h-3" />
                      <span>{formatMins(subTimerMinutes)} timer study time saved</span>
                    </span>
                  )}
                </div>
                <span className="text-lg font-bold font-mono text-[#6B705C]">{percent}%</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[#F2EFE9] h-2.5 rounded-full overflow-hidden border border-[#E0DBD0]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${percent}%`, backgroundColor: sub.color || '#6B705C' }}
                ></div>
              </div>

              {/* Status Breakdown Chips */}
              <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                <div className="p-2.5 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-center">
                  <span className="block text-[10px] text-[#A5A58D] font-mono font-bold uppercase tracking-wider">MASTERED</span>
                  <span className="text-sm font-bold text-[#6B705C]">{mastered}</span>
                </div>
                <div className="p-2.5 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-center">
                  <span className="block text-[10px] text-[#A5A58D] font-mono font-bold uppercase tracking-wider">COMPLETED</span>
                  <span className="text-sm font-bold text-[#6B705C]">{completed}</span>
                </div>
                <div className="p-2.5 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-center">
                  <span className="block text-[10px] text-[#A5A58D] font-mono font-bold uppercase tracking-wider">IN PROGRESS</span>
                  <span className="text-sm font-bold text-amber-800">{inProgress}</span>
                </div>
                <div className="p-2.5 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-center">
                  <span className="block text-[10px] text-[#A5A58D] font-mono font-bold uppercase tracking-wider">REVISION QUEUED</span>
                  <span className="text-sm font-bold text-purple-900">{needsRevision}</span>
                </div>
                <div className="p-2.5 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-center">
                  <span className="block text-[10px] text-[#A5A58D] font-mono font-bold uppercase tracking-wider">WEAK</span>
                  <span className="text-sm font-bold text-rose-800">{weak}</span>
                </div>
                <div className="p-2.5 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-center">
                  <span className="block text-[10px] text-[#A5A58D] font-mono font-bold uppercase tracking-wider">NOT STARTED</span>
                  <span className="text-sm font-bold text-[#A5A58D]">{notStarted}</span>
                </div>
              </div>

              {/* Chapters Progress list */}
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-bold text-[#A5A58D] font-mono uppercase tracking-widest">Chapter Progress:</span>
                {sub.chapters.map((ch) => {
                  const chTotal = ch.topics.length;
                  const chDone = ch.topics.filter(t => t.status === 'Completed' || t.status === 'Mastered').length;
                  const chPct = chTotal > 0 ? Math.round((chDone / chTotal) * 100) : 0;

                  return (
                    <div key={ch.id} className="p-3 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-xs space-y-1">
                      <div className="flex items-center justify-between text-[#4A4E4D]">
                        <span className="font-semibold truncate">{ch.name}</span>
                        <span className="font-mono text-[#6B705C] font-bold">{chPct}%</span>
                      </div>
                      <div className="w-full bg-[#EAE7DF] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-[#6B705C] h-full rounded-full"
                          style={{ width: `${chPct}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
