import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  Sparkles, 
  ArrowRight, 
  BookOpen, 
  Calendar, 
  Bot, 
  Clock, 
  Brain, 
  CheckCircle2, 
  Mail, 
  RotateCcw, 
  Filter,
  Flame,
  ChevronRight,
  TrendingDown,
  Layers
} from 'lucide-react';
import { Subject, TestResult, StudySession, StudyPlan, ActiveTab, UserProfile } from '../types';
import { getWeakTopicsLastWeek, WeakTopicItem } from '../lib/topicLinker';
import { sendTestImprovementEmail, getCachedGmailToken, getOrRequestGmailToken } from '../lib/gmailService';

interface WeakTopicsLastWeekProps {
  testResults: TestResult[];
  sessions?: StudySession[];
  subjects: Subject[];
  plans?: StudyPlan[];
  userProfile?: UserProfile | null;
  onSavePlan?: (plan: StudyPlan | Omit<StudyPlan, 'id'>) => Promise<void> | void;
  setActiveTab: (tab: ActiveTab) => void;
  onSendPromptToTutor: (promptText: string) => void;
  onSelectTopicInSyllabus?: (subjectId: string, topicId: string) => void;
  onStartTimerWithTopic?: (topicName: string, subjectName: string) => void;
  onOpenFlashcardsWithTopic?: (topicName: string, subjectName: string) => void;
}

export const WeakTopicsLastWeek: React.FC<WeakTopicsLastWeekProps> = ({
  testResults,
  sessions = [],
  subjects,
  plans = [],
  userProfile,
  onSavePlan,
  setActiveTab,
  onSendPromptToTutor,
  onSelectTopicInSyllabus,
  onStartTimerWithTopic,
  onOpenFlashcardsWithTopic
}) => {
  const [lookbackDays, setLookbackDays] = useState<number>(7);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [addedPlanTopics, setAddedPlanTopics] = useState<Record<string, boolean>>({});
  const [isSendingDigest, setIsSendingDigest] = useState(false);
  const [digestStatus, setDigestStatus] = useState<{ text: string; success: boolean } | null>(null);

  // Compute weak topics from test scores & activity in the last 7 days
  const weakTopics = useMemo(() => {
    const raw = getWeakTopicsLastWeek(testResults, sessions, subjects, lookbackDays);
    if (selectedSubjectFilter === 'all') return raw;
    const cleanFilter = (selectedSubjectFilter || '').toLowerCase();
    return raw.filter(t => (t.subjectName || '').toLowerCase() === cleanFilter);
  }, [testResults, sessions, subjects, lookbackDays, selectedSubjectFilter]);

  const handleAddToPlan = async (item: WeakTopicItem) => {
    if (!onSavePlan) return;
    const today = new Date().toISOString().split('T')[0];
    const existingPlan = plans.find(p => p.date === today);

    const newTopic = {
      id: `weak-drill-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      subjectName: item.subjectName,
      chapterName: item.chapterName,
      topicName: item.topicName,
      estimatedMinutes: 35,
      priority: 'High' as const,
      completed: false,
      reason: `Weak Topic Recovery (${item.latestScore} score; ${item.recentMistakes[0] || 'Target practice'})`
    };

    if (existingPlan) {
      await onSavePlan({
        ...existingPlan,
        topics: [...existingPlan.topics, newTopic]
      });
    } else {
      await onSavePlan({
        date: today,
        title: `Weak Topics Remediation Plan`,
        topics: [newTopic]
      });
    }

    setAddedPlanTopics(prev => ({ ...prev, [item.topicId]: true }));
    setTimeout(() => {
      setAddedPlanTopics(prev => ({ ...prev, [item.topicId]: false }));
    }, 4000);
  };

  const handleJumpToSyllabus = (item: WeakTopicItem) => {
    const subj = subjects.find(s => (s.name || '').toLowerCase() === (item.subjectName || '').toLowerCase());
    if (subj && onSelectTopicInSyllabus) {
      onSelectTopicInSyllabus(subj.id, item.topicId);
    }
    setActiveTab('syllabus');
  };

  const handleDrillInTutor = (item: WeakTopicItem) => {
    onSendPromptToTutor(item.tutorPrompt);
    setActiveTab('tutor');
  };

  const handleStartTimer = (item: WeakTopicItem) => {
    if (onStartTimerWithTopic) {
      onStartTimerWithTopic(item.topicName, item.subjectName);
    }
    setActiveTab('timer');
  };

  const handleGenerateFlashcards = (item: WeakTopicItem) => {
    if (onOpenFlashcardsWithTopic) {
      onOpenFlashcardsWithTopic(item.topicName, item.subjectName);
    }
    setActiveTab('flashcards');
  };

  const handleSendWeeklyWeakTopicsDigest = async () => {
    if (weakTopics.length === 0) return;
    setIsSendingDigest(true);
    setDigestStatus(null);

    try {
      let token = getCachedGmailToken();
      if (!token) {
        token = await getOrRequestGmailToken();
      }

      if (!token) {
        setDigestStatus({ text: 'Please connect Gmail in Settings to send digests.', success: false });
        setIsSendingDigest(false);
        return;
      }

      const recipientEmail = userProfile?.email || 'atharkhanteambuster@gmail.com';
      const syntheticTest: TestResult = {
        id: `weak-digest-${Date.now()}`,
        userId: '',
        testName: `Last ${lookbackDays} Days Weak Topics Diagnostic`,
        subjectName: selectedSubjectFilter === 'all' ? 'All Subjects' : selectedSubjectFilter,
        score: `${weakTopics.length} Weak Topics Identified`,
        date: new Date().toISOString().split('T')[0],
        mistakes: weakTopics.map(w => `${w.subjectName} > ${w.topicName}: ${w.recentMistakes.join(', ') || 'Low score'}`).join('\n'),
        struggledTopics: weakTopics.map(w => w.topicName),
        correctionPrompts: weakTopics.map(w => w.tutorPrompt)
      };

      const res = await sendTestImprovementEmail({
        recipientEmail,
        recipientName: userProfile?.displayName || 'Student',
        testResults: [syntheticTest],
        subjects,
        userProfile: userProfile || null,
        customNote: `Automated Weak Topics Diagnostic for the last ${lookbackDays} days.`
      }, token);

      if (res.success) {
        setDigestStatus({ text: `Weak topics recovery guide sent to ${recipientEmail}!`, success: true });
      } else {
        setDigestStatus({ text: 'Failed to dispatch email.', success: false });
      }
    } catch (e: any) {
      setDigestStatus({ text: e?.message || 'Error dispatching digest email.', success: false });
    } finally {
      setIsSendingDigest(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-card border border-theme rounded-3xl p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-primary flex items-center gap-2">
                  <span>Weak Topics Tracker</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                    {weakTopics.length} Focus Areas
                  </span>
                </h2>
                <p className="text-xs text-muted">
                  Automatically aggregated from test results, logged mistakes, and study sessions in the last {lookbackDays} days.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Days Range */}
            <div className="flex items-center bg-theme-accent/30 rounded-xl p-1 border border-theme text-xs font-semibold">
              <button
                onClick={() => setLookbackDays(7)}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  lookbackDays === 7 ? 'bg-[#6B705C] text-white shadow-2xs' : 'text-muted hover:text-primary'
                }`}
              >
                Last 7 Days
              </button>
              <button
                onClick={() => setLookbackDays(14)}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  lookbackDays === 14 ? 'bg-[#6B705C] text-white shadow-2xs' : 'text-muted hover:text-primary'
                }`}
              >
                14 Days
              </button>
              <button
                onClick={() => setLookbackDays(30)}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  lookbackDays === 30 ? 'bg-[#6B705C] text-white shadow-2xs' : 'text-muted hover:text-primary'
                }`}
              >
                30 Days
              </button>
            </div>

            {/* Subject Filter */}
            <select
              value={selectedSubjectFilter}
              onChange={(e) => setSelectedSubjectFilter(e.target.value)}
              className="p-2 bg-theme-accent/30 border border-theme rounded-xl text-xs text-primary font-semibold focus:outline-none focus:border-primary"
            >
              <option value="all">All Subjects</option>
              {subjects.map(s => (
                <option key={s.id} value={s.name}>
                  {s.icon || '📚'} {s.name}
                </option>
              ))}
            </select>

            {/* Email Digest Button */}
            <button
              onClick={handleSendWeeklyWeakTopicsDigest}
              disabled={isSendingDigest || weakTopics.length === 0}
              className="px-3 py-2 bg-theme-accent/50 hover:bg-theme-accent border border-theme text-primary rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Email diagnostic recovery report to your Gmail"
            >
              <Mail className="w-3.5 h-3.5 text-[#6B705C]" />
              <span>{isSendingDigest ? 'Sending...' : 'Email Digest'}</span>
            </button>
          </div>
        </div>

        {digestStatus && (
          <div className={`mt-3 p-2.5 rounded-xl text-xs flex items-center gap-2 border ${
            digestStatus.success
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            {digestStatus.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{digestStatus.text}</span>
          </div>
        )}
      </div>

      {/* Weak Topics List */}
      {weakTopics.length === 0 ? (
        <div className="text-center py-12 bg-card border border-theme rounded-3xl space-y-3">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-primary">
            No Critical Weak Spots in the Last {lookbackDays} Days!
          </h3>
          <p className="text-xs text-muted max-w-md mx-auto">
            All logged test scores and topic sessions scored above 70%. Keep up the momentum or log new test results to test your retention.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {weakTopics.map((item) => {
            const isAdded = !!addedPlanTopics[item.topicId];
            return (
              <div 
                key={item.topicId}
                className="bg-card border border-theme rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-primary/40 transition"
              >
                {/* Top Section */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg leading-none">{item.subjectIcon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-primary">{item.topicName}</h4>
                          {item.topicNumber && (
                            <span className="px-1.5 py-0.5 rounded bg-theme-accent text-primary font-mono text-[10px] font-bold">
                              #{item.topicNumber}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted font-medium">
                          {item.subjectName} • {item.chapterName}
                        </p>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase shrink-0 ${
                      item.severity === 'Critical'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : item.severity === 'Moderate'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-purple-100 text-purple-800 border border-purple-200'
                    }`}>
                      {item.severity} ({item.latestScore})
                    </span>
                  </div>

                  {/* Mistakes Logged */}
                  {item.recentMistakes.length > 0 && (
                    <div className="bg-rose-50/70 border border-rose-200/60 p-2.5 rounded-2xl text-xs text-rose-900 space-y-1">
                      <span className="font-bold text-[10px] uppercase tracking-wider text-rose-700 block">
                        Logged Mistakes & Struggle Points:
                      </span>
                      <p className="text-[11px] leading-relaxed italic">
                        "{item.recentMistakes[0]}"
                      </p>
                    </div>
                  )}

                  {/* Recommended Action */}
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <Sparkles className="w-3.5 h-3.5 text-[#6B705C] shrink-0" />
                    <span><strong className="text-primary">Recommended:</strong> {item.recommendedAction}</span>
                  </div>
                </div>

                {/* Direct Action Buttons */}
                <div className="pt-3 border-t border-theme grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    onClick={() => handleJumpToSyllabus(item)}
                    className="p-2 rounded-xl bg-theme-accent/40 hover:bg-theme-accent text-primary text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                    title="View topic in Syllabus"
                  >
                    <BookOpen className="w-3 h-3 text-[#6B705C]" />
                    <span>Syllabus</span>
                  </button>

                  <button
                    onClick={() => handleAddToPlan(item)}
                    disabled={isAdded}
                    className={`p-2 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                      isAdded 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-theme-accent/40 hover:bg-theme-accent text-primary'
                    }`}
                    title="Schedule 30-min drill in today's AI Plan"
                  >
                    <Calendar className="w-3 h-3 text-[#6B705C]" />
                    <span>{isAdded ? 'Added!' : 'Add to Plan'}</span>
                  </button>

                  <button
                    onClick={() => handleDrillInTutor(item)}
                    className="p-2 rounded-xl bg-theme-accent/40 hover:bg-theme-accent text-primary text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                    title="Ask AI Tutor to diagnose and drill this concept"
                  >
                    <Bot className="w-3 h-3 text-[#6B705C]" />
                    <span>AI Tutor</span>
                  </button>

                  <button
                    onClick={() => handleStartTimer(item)}
                    className="p-2 rounded-xl bg-theme-accent/40 hover:bg-theme-accent text-primary text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                    title="Start 25-min Pomodoro timer on this topic"
                  >
                    <Clock className="w-3 h-3 text-[#6B705C]" />
                    <span>Timer</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
