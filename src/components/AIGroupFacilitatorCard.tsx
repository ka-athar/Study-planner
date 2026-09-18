import React, { useState } from 'react';
import { 
  Sparkles, 
  Users, 
  Play, 
  Bot, 
  Clock, 
  CheckCircle2, 
  Award, 
  ArrowRight, 
  RefreshCw, 
  Lightbulb, 
  BookOpen, 
  Target 
} from 'lucide-react';
import { StudyGroup, AIGroupStudySuggestion, ActiveTab } from '../types';
import { apiSuggestGroupStudy } from '../lib/aiApi';

interface AIGroupFacilitatorCardProps {
  group: StudyGroup;
  onUpdateGroupSuggestions: (suggestions: AIGroupStudySuggestion[]) => void;
  onStartTimerForTopic: (subjectName: string, chapterName: string, topicName: string) => void;
  onSendPromptToTutor: (prompt: string) => void;
  setActiveTab: (tab: ActiveTab) => void;
}

export const AIGroupFacilitatorCard: React.FC<AIGroupFacilitatorCardProps> = ({
  group,
  onUpdateGroupSuggestions,
  onStartTimerForTopic,
  onSendPromptToTutor,
  setActiveTab
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [synergyOverview, setSynergyOverview] = useState<string | null>(null);
  const [activeSessionTopic, setActiveSessionTopic] = useState<string | null>(null);

  const handleGenerateSuggestions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Prepare member progress data for the AI facilitator
      const membersData = group.members.map(m => ({
        displayName: m.displayName,
        role: m.role,
        shareProgress: m.shareProgress,
        completedTopicsCount: m.completedTopicsCount || 0,
        totalTopicsCount: m.totalTopicsCount || 20,
        studiedHoursThisWeek: m.studiedHoursThisWeek || 0,
        sharedMasteredTopics: m.sharedMasteredTopics || [],
        sharedWeakTopics: m.sharedWeakTopics || [],
        upcomingExams: m.upcomingExams || []
      }));

      const res = await apiSuggestGroupStudy({
        groupName: group.name,
        subjectFocus: group.subjectFocus,
        members: membersData,
        groupGoals: group.goals,
        targetExam: group.targetExam,
        targetExamDate: group.targetExamDate
      });

      if (res.suggestions && Array.isArray(res.suggestions)) {
        onUpdateGroupSuggestions(res.suggestions);
        if (res.groupSynergyOverview) {
          setSynergyOverview(res.groupSynergyOverview);
        }
      }
    } catch (err: any) {
      console.error('Failed to generate group study suggestions:', err);
      setError(err.message || 'Unable to generate suggestions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const suggestions = group.aiSuggestions || [];

  return (
    <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E0DBD0] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#6B705C]/15 text-[#6B705C] flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-serif italic font-bold text-[#6B705C]">
                AI Group Study Facilitator
              </h3>
              <p className="text-[11px] text-[#A5A58D]">
                Analyzes members' shared syllabus progress, weak spots & upcoming exams to formulate high-impact collaborative study sessions.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleGenerateSuggestions}
          disabled={isLoading}
          className={`px-4 py-2 rounded-full font-medium text-xs transition flex items-center gap-2 shadow-xs shrink-0 ${
            isLoading
              ? 'bg-[#EAE7DF] text-[#A5A58D] cursor-not-allowed'
              : 'bg-[#6B705C] hover:bg-[#5a5f4e] text-white active:scale-95'
          }`}
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Analyzing Synergy...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>{suggestions.length > 0 ? 'Refresh AI Topic Suggestions' : 'Generate Group Topics'}</span>
            </>
          )}
        </button>
      </div>

      {/* Error notification */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-600 font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {/* Synergy Overview Banner if generated */}
      {synergyOverview && (
        <div className="p-4 rounded-2xl bg-[#6B705C]/10 border border-[#6B705C]/20 text-xs text-[#4A4E4D] space-y-1 animate-fade-in">
          <div className="font-bold text-[#6B705C] flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
            <Lightbulb className="w-3.5 h-3.5" />
            <span>Group Synergy & Strategy Insights</span>
          </div>
          <p className="leading-relaxed">{synergyOverview}</p>
        </div>
      )}

      {/* Suggestion Cards */}
      {suggestions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {suggestions.map((sug, idx) => {
            const urgencyBg = 
              sug.urgency === 'High' 
                ? 'bg-rose-50 border-rose-200 text-rose-800' 
                : sug.urgency === 'Medium'
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800';

            return (
              <div 
                key={sug.id || `sug-${idx}`} 
                className="p-4.5 rounded-3xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-3.5 flex flex-col justify-between hover:border-[#6B705C]/50 transition shadow-2xs"
              >
                <div className="space-y-2.5">
                  {/* Top Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#EAE7DF] text-[#6B705C] border border-[#E0DBD0]">
                      {sug.subjectName} {sug.chapterName ? `• ${sug.chapterName}` : ''}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${urgencyBg}`}>
                        {sug.urgency} Priority
                      </span>
                      <span className="text-[10px] font-mono text-[#A5A58D] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {sug.estimatedMinutes}m
                      </span>
                    </div>
                  </div>

                  {/* Title & Activity */}
                  <div>
                    <h4 className="text-sm font-bold text-[#4A4E4D] leading-snug">
                      {sug.title}
                    </h4>
                    <div className="text-xs font-semibold text-[#6B705C] flex items-center gap-1.5 mt-0.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{sug.topicName}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#6B705C]/15 text-[#6B705C] font-normal">
                        {sug.recommendedActivity}
                      </span>
                    </div>
                  </div>

                  {/* Reason / Peer Synergy */}
                  <p className="text-xs text-[#4A4E4D]/90 bg-white p-3 rounded-2xl border border-[#E0DBD0] leading-relaxed">
                    💡 <strong className="text-[#6B705C]">Synergy:</strong> {sug.reason}
                  </p>

                  {/* Session Agenda Steps */}
                  {sug.sessionAgenda && sug.sessionAgenda.length > 0 && (
                    <div className="space-y-1.5 bg-white/70 p-3 rounded-2xl border border-[#E0DBD0]/70 text-[11px]">
                      <span className="font-bold text-[#6B705C] uppercase tracking-wider text-[10px] block">
                        Recommended Agenda:
                      </span>
                      <ul className="space-y-1 text-[#4A4E4D]">
                        {sug.sessionAgenda.map((step, sIdx) => (
                          <li key={sIdx} className="flex items-start gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#6B705C] mt-1.5 shrink-0"></span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Members Benefited */}
                  {sug.membersBenefited && sug.membersBenefited.length > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-[#A5A58D]">
                      <Users className="w-3 h-3 text-[#6B705C]" />
                      <span>Benefiting: {sug.membersBenefited.join(', ')}</span>
                    </div>
                  )}
                </div>

                {/* Direct Action Buttons */}
                <div className="pt-2 border-t border-[#E0DBD0] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onSendPromptToTutor(`Let's prepare a collaborative group study guide and practice drill on "${sug.topicName}" (${sug.subjectName}). Include key formulas, 3 conceptual traps, and 2 challenging discussion questions for group study.`);
                      setActiveTab('tutor');
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-[#F2EFE9] text-[#6B705C] border border-[#E0DBD0] rounded-xl text-[11px] font-bold transition flex items-center gap-1.5"
                    title="Generate practice materials in AI Tutor"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    <span>AI Tutor Drill</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onStartTimerForTopic(sug.subjectName, sug.chapterName || 'General', sug.topicName);
                      setActiveTab('timer');
                    }}
                    className="px-3.5 py-1.5 bg-[#6B705C] hover:bg-[#5a5f4e] text-white rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 shadow-2xs"
                    title="Launch study timer for this topic"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Start Study Timer</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 px-4 bg-[#F9F7F2] rounded-3xl border border-dashed border-[#E0DBD0] space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#6B705C]/15 text-[#6B705C] flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto">
            <h4 className="text-xs font-bold text-[#4A4E4D] uppercase tracking-wider">No AI Group Suggestions Yet</h4>
            <p className="text-xs text-[#A5A58D] mt-1">
              Click the <strong>"Generate Group Topics"</strong> button above. The AI will analyze all members' shared syllabus progress, mutual weak spots, and target exam dates to formulate high-yield joint study sessions!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
