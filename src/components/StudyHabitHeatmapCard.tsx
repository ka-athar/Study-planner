import React, { useMemo, useState } from 'react';
import { 
  Calendar, 
  Flame, 
  Sun, 
  Moon, 
  Sunset, 
  Sunrise, 
  Clock, 
  TrendingUp, 
  Sparkles, 
  Zap, 
  Info,
  ChevronRight,
  BookOpen
} from 'lucide-react';
import { StudySession, TestResult } from '../types';

interface StudyHabitHeatmapCardProps {
  sessions: StudySession[];
  testResults?: TestResult[];
}

export const StudyHabitHeatmapCard: React.FC<StudyHabitHeatmapCardProps> = ({
  sessions = [],
  testResults = []
}) => {
  const [hoveredDay, setHoveredDay] = useState<{ date: string; minutes: number; count: number } | null>(null);

  // 1. Build GitHub-Style 12-Week (84 Days) Heatmap Data
  const heatmapData = useMemo(() => {
    const today = new Date();
    const days: Array<{
      date: string; // YYYY-MM-DD
      dayOfWeek: number; // 0 = Sun, 1 = Mon...
      minutes: number;
      count: number;
      intensity: 0 | 1 | 2 | 3 | 4;
    }> = [];

    // Map sessions to date -> minutes
    const dateMap = new Map<string, { minutes: number; count: number }>();
    sessions.forEach(s => {
      const d = s.date;
      if (!d) return;
      const cur = dateMap.get(d) || { minutes: 0, count: 0 };
      dateMap.set(d, {
        minutes: cur.minutes + (s.durationMinutes || 0),
        count: cur.count + 1
      });
    });

    // Generate past 84 days (12 weeks)
    const totalDays = 84;
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const entry = dateMap.get(dateStr) || { minutes: 0, count: 0 };

      let intensity: 0 | 1 | 2 | 3 | 4 = 0;
      if (entry.minutes >= 120) intensity = 4;
      else if (entry.minutes >= 60) intensity = 3;
      else if (entry.minutes >= 30) intensity = 2;
      else if (entry.minutes > 0) intensity = 1;

      days.push({
        date: dateStr,
        dayOfWeek: d.getDay(),
        minutes: entry.minutes,
        count: entry.count,
        intensity
      });
    }

    // Split into 12 columns (weeks) of 7 days each
    const weeks: typeof days[] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    const totalMinutes = days.reduce((acc, d) => acc + d.minutes, 0);
    const activeDaysCount = days.filter(d => d.minutes > 0).length;

    return { weeks, days, totalMinutes, activeDaysCount };
  }, [sessions]);

  // 2. Peak Cognitive Hour Finder Algorithm
  const cognitiveWindows = useMemo(() => {
    const windows = {
      morning: { label: 'Morning', time: '06:00 – 12:00', minutes: 0, sessions: 0, testScores: [] as number[], icon: Sunrise },
      afternoon: { label: 'Afternoon', time: '12:00 – 17:00', minutes: 0, sessions: 0, testScores: [] as number[], icon: Sun },
      evening: { label: 'Evening', time: '17:00 – 21:00', minutes: 0, sessions: 0, testScores: [] as number[], icon: Sunset },
      night: { label: 'Night', time: '21:00 – 02:00', minutes: 0, sessions: 0, testScores: [] as number[], icon: Moon }
    };

    sessions.forEach(s => {
      let hour = 14; // default afternoon
      if (s.startTime && s.startTime.includes(':')) {
        hour = parseInt(s.startTime.split(':')[0], 10) || 14;
      } else if (s.timestamp) {
        hour = new Date(s.timestamp).getHours();
      }

      if (hour >= 6 && hour < 12) {
        windows.morning.minutes += s.durationMinutes || 0;
        windows.morning.sessions += 1;
      } else if (hour >= 12 && hour < 17) {
        windows.afternoon.minutes += s.durationMinutes || 0;
        windows.afternoon.sessions += 1;
      } else if (hour >= 17 && hour < 21) {
        windows.evening.minutes += s.durationMinutes || 0;
        windows.evening.sessions += 1;
      } else {
        windows.night.minutes += s.durationMinutes || 0;
        windows.night.sessions += 1;
      }
    });

    // Evaluate which window has highest focus & density
    const windowList = [
      { key: 'morning', ...windows.morning },
      { key: 'afternoon', ...windows.afternoon },
      { key: 'evening', ...windows.evening },
      { key: 'night', ...windows.night }
    ];

    const sortedByVolume = [...windowList].sort((a, b) => b.minutes - a.minutes);
    const peakWindow = sortedByVolume[0].minutes > 0 ? sortedByVolume[0] : windowList[0];

    return { windowList, peakWindow };
  }, [sessions, testResults]);

  const { weeks, totalMinutes, activeDaysCount } = heatmapData;
  const { windowList, peakWindow } = cognitiveWindows;

  const getIntensityColor = (intensity: number) => {
    switch (intensity) {
      case 4: return 'bg-[#3A4032] border-[#2A3022]'; // > 2h
      case 3: return 'bg-[#6B705C] border-[#5A5F4E]'; // 1-2h
      case 2: return 'bg-[#A5A58D] border-[#8F8F75]'; // 30-59m
      case 1: return 'bg-[#DDBEA9] border-[#C8A78F]'; // 1-29m
      default: return 'bg-[#F2EFE9] border-[#E0DBD0]'; // 0m
    }
  };

  return (
    <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-6">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E0DBD0] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-800 flex items-center justify-center font-bold">
            <Calendar className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#4A4E4D]">
                Study Habit Heatmap & Peak Cognitive Hours
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                Option 11 • Chronobiology
              </span>
            </div>
            <p className="text-xs text-[#A5A58D] mt-0.5">
              12-week consistency tracking and circadian analysis to optimize deep-work scheduling.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div>
            <span className="text-[#A5A58D]">Active Days: </span>
            <strong className="text-[#2D312E]">{activeDaysCount} / 84</strong>
          </div>
          <div>
            <span className="text-[#A5A58D]">Logged: </span>
            <strong className="text-[#6B705C]">{Math.round(totalMinutes / 60)} hrs</strong>
          </div>
        </div>
      </div>

      {/* 1. GITHUB-STYLE 12-WEEK HEATMAP */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-[#A5A58D]">
          <span className="font-bold uppercase tracking-wider text-[10px] text-[#6B705C]">
            Daily Focus Frequency (Past 12 Weeks)
          </span>
          {hoveredDay ? (
            <span className="font-mono text-xs font-bold text-[#2D312E] bg-[#F9F7F2] px-2 py-0.5 rounded-lg border border-[#E0DBD0]">
              {hoveredDay.date}: {hoveredDay.minutes} mins ({hoveredDay.count} sessions)
            </span>
          ) : (
            <span className="text-[11px] italic">Hover over any day square for details</span>
          )}
        </div>

        {/* Heatmap Grid */}
        <div className="overflow-x-auto pb-2">
          <div className="inline-flex gap-1.5 min-w-full sm:min-w-0 p-2 bg-[#F9F7F2] rounded-2xl border border-[#E0DBD0]">
            {/* Days of week labels */}
            <div className="flex flex-col justify-between text-[9px] font-mono text-[#A5A58D] pr-1 py-0.5 select-none">
              <span>Mon</span>
              <span>Wed</span>
              <span>Fri</span>
              <span>Sun</span>
            </div>

            {/* Weeks */}
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1.5">
                {week.map((day, dIdx) => (
                  <div
                    key={dIdx}
                    onMouseEnter={() => setHoveredDay(day)}
                    onMouseLeave={() => setHoveredDay(null)}
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-md border transition-transform hover:scale-125 cursor-pointer ${getIntensityColor(day.intensity)}`}
                    title={`${day.date}: ${day.minutes} mins`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Heatmap Legend */}
        <div className="flex items-center justify-end gap-2 text-[10px] text-[#A5A58D] font-mono pt-1">
          <span>Less</span>
          <span className="w-3 h-3 rounded bg-[#F2EFE9] border border-[#E0DBD0]" />
          <span className="w-3 h-3 rounded bg-[#DDBEA9] border border-[#C8A78F]" />
          <span className="w-3 h-3 rounded bg-[#A5A58D] border border-[#8F8F75]" />
          <span className="w-3 h-3 rounded bg-[#6B705C] border-[#5A5F4E]" />
          <span className="w-3 h-3 rounded bg-[#3A4032] border-[#2A3022]" />
          <span>More</span>
        </div>
      </div>

      {/* 2. PEAK COGNITIVE HOUR FINDER */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-[#F9F7F2] to-white border border-[#E0DBD0] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#4A4E4D]">
              Circadian Focus Distribution & Optimal Brain Window
            </h4>
          </div>

          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
            Peak Focus: {peakWindow.label} ({peakWindow.time})
          </span>
        </div>

        {/* 4 Time Slots Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {windowList.map(w => {
            const IconComp = w.icon;
            const isPeak = w.key === peakWindow.key;
            const hoursLogged = (w.minutes / 60).toFixed(1);

            return (
              <div 
                key={w.key}
                className={`p-3.5 rounded-xl border transition flex flex-col justify-between gap-2 ${
                  isPeak 
                    ? 'bg-emerald-50/60 border-emerald-300 shadow-2xs' 
                    : 'bg-white border-[#E0DBD0]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#2D312E] flex items-center gap-1.5">
                    <IconComp className={`w-3.5 h-3.5 ${isPeak ? 'text-emerald-700' : 'text-[#6B705C]'}`} />
                    <span>{w.label}</span>
                  </span>
                  {isPeak && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-900 font-mono">
                      PEAK
                    </span>
                  )}
                </div>

                <div className="text-[10px] font-mono text-[#A5A58D]">
                  {w.time}
                </div>

                <div className="pt-1 border-t border-current/10 flex items-baseline justify-between text-xs">
                  <span className="font-bold text-[#4A4E4D] font-mono">{hoursLogged} hrs</span>
                  <span className="text-[10px] text-[#A5A58D]">{w.sessions} sessions</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Actionable Cognitive Advice */}
        <div className="p-3.5 rounded-xl bg-white border border-[#E0DBD0] text-xs text-[#4A4E4D] space-y-1">
          <div className="font-bold text-[#2D312E] flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-600" />
            <span>Smart Cognitive Recommendation:</span>
          </div>
          <p className="text-[#6B705C] leading-relaxed text-[11px]">
            Your neural focus peaks during <strong>{peakWindow.label} ({peakWindow.time})</strong>. Schedule your heaviest mathematical proofs, physics derivations, and chemistry mechanisms during this window. Reserve later lower-energy windows for active recall flashcards, MCQs, or light summaries.
          </p>
        </div>
      </div>

    </div>
  );
};
