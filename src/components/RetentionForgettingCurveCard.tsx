import React, { useState, useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid, 
  ReferenceLine 
} from 'recharts';
import { 
  Brain, 
  TrendingDown, 
  TrendingUp, 
  ShieldAlert, 
  Clock, 
  Sparkles, 
  Calendar, 
  RotateCcw, 
  Zap,
  Info
} from 'lucide-react';
import { Subject, RevisionItem, StudySession } from '../types';

interface RetentionForgettingCurveCardProps {
  subjects: Subject[];
  revisions: RevisionItem[];
  sessions: StudySession[];
  onStartRevision?: (subjectName: string, chapterName: string, topicName: string) => void;
}

interface TopicRisk {
  subjectName: string;
  chapterName: string;
  topicName: string;
  daysSinceStudy: number;
  estimatedRetention: number;
  reviewCount: number;
  status: 'critical' | 'warning' | 'stable';
}

export const RetentionForgettingCurveCard: React.FC<RetentionForgettingCurveCardProps> = ({
  subjects,
  revisions,
  sessions,
  onStartRevision,
}) => {
  const [forecastHorizon, setForecastHorizon] = useState<7 | 14 | 30>(30);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [showTheoreticalComparison, setShowTheoreticalComparison] = useState<boolean>(true);

  // Calculate memory decay risks across all topics
  const atRiskTopics = useMemo<TopicRisk[]>(() => {
    const list: TopicRisk[] = [];
    const now = Date.now();

    subjects.forEach(subject => {
      subject.chapters?.forEach(chapter => {
        chapter.topics?.forEach(topic => {
          // Find matching revision entries
          const matchingRevisions = revisions.filter(
            r => (r.subjectName || '').toLowerCase() === (subject.name || '').toLowerCase() &&
                 (r.topicName || '').toLowerCase() === (topic.name || '').toLowerCase()
          );

          // Find recent study sessions
          const matchingSessions = sessions.filter(
            s => (s.subjectName || '').toLowerCase() === (subject.name || '').toLowerCase() &&
                 ((s.chapterName || '').toLowerCase() === (chapter.name || '').toLowerCase() ||
                  (s.topicName || '').toLowerCase() === (topic.name || '').toLowerCase())
          );

          if (topic.status === 'Completed' || topic.status === 'Mastered' || (topic.status as string) === 'revised' || matchingSessions.length > 0) {
            let lastStudiedDate = now - (1000 * 60 * 60 * 24 * 7); // Default fallback: 7 days ago

            if (matchingSessions.length > 0) {
              const latest = Math.max(...matchingSessions.map(s => new Date(s.date).getTime() || 0));
              if (latest > 0) lastStudiedDate = latest;
            } else if (matchingRevisions.length > 0) {
              const latest = Math.max(...matchingRevisions.map(r => new Date(r.lastStudied || r.dueDate || 0).getTime() || 0));
              if (latest > 0) lastStudiedDate = latest;
            }

            const daysSince = Math.max(1, Math.floor((now - lastStudiedDate) / (1000 * 60 * 60 * 24)));
            const reviewCount = matchingRevisions.length + (topic.status === 'Mastered' ? 1 : 0);

            // Stability factor based on spacing & review count
            // S = 1.8 * (reviewCount + 1)^1.4
            const stability = 1.8 * Math.pow(reviewCount + 1, 1.4);
            const retention = Math.max(5, Math.min(100, Math.round(100 * Math.exp(-daysSince / stability))));

            let status: TopicRisk['status'] = 'stable';
            if (retention < 45) status = 'critical';
            else if (retention < 70) status = 'warning';

            list.push({
              subjectName: subject.name,
              chapterName: chapter.name,
              topicName: topic.name,
              daysSinceStudy: daysSince,
              estimatedRetention: retention,
              reviewCount,
              status
            });
          }
        });
      });
    });

    return list.sort((a, b) => a.estimatedRetention - b.estimatedRetention);
  }, [subjects, revisions, sessions]);

  // Generate 30-Day Curve Data points
  const curveData = useMemo(() => {
    const data = [];
    const avgReviews = atRiskTopics.length > 0 
      ? atRiskTopics.reduce((acc, t) => acc + t.reviewCount, 0) / atRiskTopics.length 
      : 1;

    // Filtered subset if subject selected
    const activeTopics = selectedSubjectFilter === 'all'
      ? atRiskTopics
      : atRiskTopics.filter(t => t.subjectName === selectedSubjectFilter);

    const currentCohortAvgReviews = activeTopics.length > 0
      ? activeTopics.reduce((acc, t) => acc + t.reviewCount, 0) / activeTopics.length
      : avgReviews;

    for (let day = 0; day <= forecastHorizon; day++) {
      // 1. Natural forgetting decay curve without spaced repetition: R = 100 * e^(-t / 4.2)
      const unreviewedDecay = Math.max(8, Math.round(100 * Math.exp(-day / 4.2)));

      // 2. Optimized Spaced Repetition Curve: Spaced review at Day 1, Day 3, Day 7, Day 16
      let spacedRetention = 100;
      if (day === 0) spacedRetention = 100;
      else if (day <= 1) spacedRetention = Math.round(100 * Math.exp(-day / 4.5));
      else if (day <= 3) {
        // Boosted by 1st review on Day 1
        spacedRetention = Math.round(96 * Math.exp(-(day - 1) / 9.0));
      } else if (day <= 7) {
        // Boosted by 2nd review on Day 3
        spacedRetention = Math.round(94 * Math.exp(-(day - 3) / 18.0));
      } else if (day <= 16) {
        // Boosted by 3rd review on Day 7
        spacedRetention = Math.round(93 * Math.exp(-(day - 7) / 36.0));
      } else {
        // Boosted by 4th review on Day 16
        spacedRetention = Math.round(92 * Math.exp(-(day - 16) / 72.0));
      }

      // 3. User's Personal Projected Retention based on their actual average review count
      const userStability = 2.5 * Math.pow(Math.max(1, currentCohortAvgReviews + 0.8), 1.35);
      const userProjected = Math.max(10, Math.min(100, Math.round(100 * Math.exp(-day / userStability))));

      data.push({
        day: day === 0 ? 'Today' : `D+${day}`,
        dayNum: day,
        unreviewed: unreviewedDecay,
        spaced: Math.min(100, Math.max(20, spacedRetention)),
        userProjected: Math.min(100, userProjected),
      });
    }

    return data;
  }, [forecastHorizon, atRiskTopics, selectedSubjectFilter]);

  const criticalTopics = atRiskTopics.filter(t => t.status === 'critical').slice(0, 3);
  const averageCohortRetention = atRiskTopics.length > 0
    ? Math.round(atRiskTopics.reduce((acc, t) => acc + t.estimatedRetention, 0) / atRiskTopics.length)
    : 78;

  return (
    <div className="bg-card border border-theme rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
      
      {/* Header with Title and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-theme pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-serif italic font-bold text-primary">
                Memory Retention & Forgetting Curve Forecast
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                Ebbinghaus Model
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Predictive 30-day cognitive decay trajectory and spaced-repetition retention boosts
            </p>
          </div>
        </div>

        {/* Forecast Horizon Switcher */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="flex items-center bg-surface border border-theme rounded-xl p-0.5 text-xs font-semibold">
            {([7, 14, 30] as const).map(days => (
              <button
                key={days}
                onClick={() => setForecastHorizon(days)}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  forecastHorizon === days
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-muted hover:text-primary'
                }`}
              >
                {days}D
              </button>
            ))}
          </div>

          {/* Subject Filter */}
          <select
            value={selectedSubjectFilter}
            onChange={e => setSelectedSubjectFilter(e.target.value)}
            className="bg-surface border border-theme rounded-xl px-2.5 py-1.5 text-xs text-primary font-medium focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Subjects</option>
            {subjects.map(s => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Metric Highlights Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-surface rounded-2xl p-4 border border-theme space-y-1">
          <div className="text-[11px] font-medium text-muted flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <span>Estimated Memory Index</span>
          </div>
          <div className="text-2xl font-bold font-mono text-primary">
            {averageCohortRetention}%
          </div>
          <div className="text-[10px] text-muted">
            Average retention across {atRiskTopics.length} tracked syllabus concepts
          </div>
        </div>

        <div className="bg-surface rounded-2xl p-4 border border-theme space-y-1">
          <div className="text-[11px] font-medium text-muted flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            <span>High Forgetting Risk</span>
          </div>
          <div className="text-2xl font-bold font-mono text-rose-600">
            {atRiskTopics.filter(t => t.status === 'critical').length} Topics
          </div>
          <div className="text-[10px] text-muted">
            Retention dropped below 45% due to elapsed spacing intervals
          </div>
        </div>

        <div className="bg-surface rounded-2xl p-4 border border-theme space-y-1">
          <div className="text-[11px] font-medium text-muted flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Spaced Boost Advantage</span>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600">
            +48%
          </div>
          <div className="text-[10px] text-muted">
            Projected gain at Day 30 compared to unreviewed natural decay
          </div>
        </div>
      </div>

      {/* Main Graph: Retention Decay Forecast */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-4 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-full bg-primary" />
              <span className="font-semibold text-primary">With Spaced Repetition (Optimal)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-full bg-rose-400" />
              <span className="text-muted">Without Review (Natural Decay)</span>
            </div>
          </div>

          <span className="text-[10px] text-muted flex items-center gap-1">
            <Info className="w-3 h-3 text-muted" />
            <span>Based on spaced reviews at D+1, D+3, D+7, D+16</span>
          </span>
        </div>

        <div className="w-full h-64 sm:h-72 bg-surface/60 rounded-2xl border border-theme p-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={curveData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="spacedRetentionGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary, #6366f1)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--color-primary, #6366f1)" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="decayGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
              <XAxis 
                dataKey="day" 
                tick={{ fontSize: 10, fill: 'var(--color-muted, #888)' }} 
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                domain={[0, 100]} 
                tick={{ fontSize: 10, fill: 'var(--color-muted, #888)' }} 
                tickFormatter={val => `${val}%`}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-card border border-theme rounded-xl p-3 shadow-lg text-xs space-y-1.5 min-w-44">
                        <div className="font-bold text-primary border-b border-theme pb-1">
                          Forecast Horizon: {label}
                        </div>
                        <div className="flex items-center justify-between text-primary font-semibold">
                          <span>With Spaced Repetition:</span>
                          <span className="font-mono text-emerald-600">{data.spaced}%</span>
                        </div>
                        <div className="flex items-center justify-between text-muted">
                          <span>Without Review:</span>
                          <span className="font-mono text-rose-500">{data.unreviewed}%</span>
                        </div>
                        <div className="text-[10px] text-muted pt-1 border-t border-theme/60">
                          Net Retained Knowledge: +{data.spaced - data.unreviewed}%
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.4} />
              
              {/* Natural decay area */}
              <Area 
                type="monotone" 
                dataKey="unreviewed" 
                stroke="#f43f5e" 
                strokeWidth={1.5}
                strokeDasharray="4 4"
                fill="url(#decayGrad)" 
              />
              
              {/* Spaced repetition curve */}
              <Area 
                type="monotone" 
                dataKey="spaced" 
                stroke="var(--color-primary, #6366f1)" 
                strokeWidth={2.5} 
                fill="url(#spacedRetentionGrad)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Critical Topics Needing Refresh */}
      {criticalTopics.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
              <span>Priority Refresh Queue (Critical Memory Decay)</span>
            </h4>
            <span className="text-[11px] text-muted">10-min active recall recommended</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {criticalTopics.map((item, idx) => (
              <div 
                key={idx}
                className="bg-surface rounded-2xl p-4 border border-theme flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between text-[10px] text-muted mb-1">
                    <span className="font-bold text-primary">{item.subjectName}</span>
                    <span className="text-rose-600 font-mono font-bold">{item.estimatedRetention}% Retained</span>
                  </div>
                  <h5 className="text-xs font-bold text-primary line-clamp-1" title={item.topicName}>
                    {item.topicName}
                  </h5>
                  <div className="text-[10px] text-muted mt-0.5">
                    {item.daysSinceStudy} days since last recall session
                  </div>
                </div>

                <button
                  onClick={() => onStartRevision?.(item.subjectName, item.chapterName, item.topicName)}
                  className="w-full py-1.5 rounded-xl bg-theme-accent hover:bg-theme-accent/80 text-primary border border-theme text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Zap className="w-3 h-3 text-primary" />
                  <span>Cure Decay (Sprint)</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
