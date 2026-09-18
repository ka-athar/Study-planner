import React from 'react';
import { Activity, Clock, Download } from 'lucide-react';
import { StudySession, ActivityLog } from '../types';

interface ActivityViewProps {
  sessions: StudySession[];
  activityLogs: ActivityLog[];
}

export const ActivityView: React.FC<ActivityViewProps> = ({ sessions, activityLogs }) => {
  const handleExportCSV = () => {
    if (sessions.length === 0) return;

    const headers = ['Date', 'Start Time', 'Subject', 'Chapter', 'Topic', 'Duration (Minutes)', 'Result', 'Notes'];
    const rows = sessions.map((s) => [
      s.date || '',
      s.startTime || '',
      s.subjectName || '',
      s.chapterName || '',
      s.topicName || '',
      s.durationMinutes?.toString() || '0',
      s.result || '',
      s.notes || ''
    ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `study_session_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-serif italic font-bold text-[#6B705C] flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#6B705C]" />
            <span>"What I Did" — Actual Study History Log</span>
          </h2>
          <p className="text-xs text-[#A5A58D] mt-1">
            A real timestamped log of your actual study sessions and accomplishments used by AI to adjust future plans.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={sessions.length === 0}
          className="px-4 py-2.5 bg-[#6B705C] hover:bg-[#5a5f4e] text-white rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
          title={sessions.length === 0 ? "No study sessions to export" : "Export Study Sessions as CSV"}
        >
          <Download className="w-4 h-4" />
          <span>Export History (CSV)</span>
        </button>
      </div>

      {/* Activity Timeline */}
      <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#6B705C] font-mono uppercase tracking-widest">
            Study Session Log Feed ({sessions.length}):
          </h3>
          {sessions.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="text-xs font-semibold text-[#6B705C] hover:text-[#5a5f4e] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV</span>
            </button>
          )}
        </div>

        {sessions.length > 0 ? (
          <div className="space-y-3 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E0DBD0]">
            {sessions.map((s) => (
              <div key={s.id} className="relative pl-9 space-y-1">
                {/* Timeline Dot */}
                <div className={`absolute left-2.5 top-2 w-3 h-3 rounded-full border-2 bg-white ${
                  s.result === 'Completed' 
                    ? 'border-[#6B705C]' 
                    : s.result === 'Partially completed' 
                    ? 'border-amber-700' 
                    : 'border-rose-700'
                }`}></div>

                <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] hover:border-[#6B705C]/30 transition space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#6B705C]">{s.subjectName}</span>
                      <span className="text-[#A5A58D] font-mono">•</span>
                      <span className="text-[#A5A58D] font-mono">{s.chapterName}</span>
                    </div>
                    <span className="text-[11px] font-mono text-[#A5A58D]">
                      {s.date} at {s.startTime}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-[#4A4E4D]">{s.topicName}</h4>

                  <div className="flex items-center justify-between pt-1 border-t border-[#E0DBD0] text-xs">
                    <span className="font-mono text-[#6B705C] font-bold">
                      Studied {s.durationMinutes} minutes
                    </span>

                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      s.result === 'Completed' 
                        ? 'bg-[#6B705C]/10 text-[#6B705C] border border-[#6B705C]/20' 
                        : s.result === 'Partially completed' 
                        ? 'bg-amber-50 text-amber-800 border border-amber-200' 
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}>
                      {s.result}
                    </span>
                  </div>

                  {s.notes && (
                    <p className="text-xs text-[#A5A58D] italic bg-white p-2.5 rounded-xl border border-[#E0DBD0]">
                      Note: "{s.notes}"
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-[#F9F7F2] rounded-2xl border border-dashed border-[#E0DBD0]">
            <Clock className="w-8 h-8 text-[#A5A58D] mx-auto mb-2" />
            <p className="text-xs text-[#A5A58D]">No actual study sessions logged yet.</p>
            <p className="text-[11px] text-[#A5A58D] mt-1">Use the Study Timer to track your study sessions.</p>
          </div>
        )}
        {/* Activity Logs & Blurt Recall Performance Feed */}
        {activityLogs && activityLogs.length > 0 && (
          <div className="pt-6 border-t border-[#E0DBD0] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#6B705C] font-mono uppercase tracking-widest flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-[#6B705C]" />
                <span>Performance & Activity Logs ({activityLogs.length}):</span>
              </h3>
              <span className="text-[11px] font-mono text-[#A5A58D]">Logged to activityLogs</span>
            </div>

            <div className="space-y-2.5">
              {activityLogs.slice(0, 15).map((log) => {
                const isBlurt = log.action === 'Blurt Recall';
                const score = log.scorePercentage ?? log.blurtRecall?.recallScore;

                return (
                  <div 
                    key={log.id} 
                    className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                      isBlurt 
                        ? 'bg-amber-50/50 border-amber-200 hover:border-amber-300' 
                        : 'bg-[#F9F7F2] border-[#E0DBD0]'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                          isBlurt 
                            ? 'bg-amber-500 text-white' 
                            : 'bg-[#6B705C] text-white'
                        }`}>
                          {log.action}
                        </span>
                        <span className="font-bold text-[#4A4E4D]">{log.topicName || log.subjectName}</span>
                        {log.subjectName && log.topicName && (
                          <span className="text-[#A5A58D] text-[11px]">({log.subjectName})</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {score !== undefined && (
                          <span className={`px-2 py-0.5 rounded-full font-mono font-bold text-[11px] ${
                            score >= 75 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                              : score >= 50 
                              ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                              : 'bg-rose-100 text-rose-900 border border-rose-300'
                          }`}>
                            {score}% Recall
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-[#A5A58D]">{log.date}</span>
                      </div>
                    </div>

                    <p className="text-[#6B705C] leading-relaxed text-[11px]">
                      {log.details}
                    </p>

                    {log.blurtRecall && log.blurtRecall.knowledgeGaps && log.blurtRecall.knowledgeGaps.length > 0 && (
                      <div className="pt-1 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-mono font-bold text-amber-900">Gaps to review:</span>
                        {log.blurtRecall.knowledgeGaps.slice(0, 4).map((gap, gIdx) => (
                          <span key={gIdx} className="px-1.5 py-0.5 rounded bg-amber-100/80 text-amber-900 text-[10px] border border-amber-200">
                            {gap.concept}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
