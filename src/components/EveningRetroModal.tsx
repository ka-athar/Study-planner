import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Moon, 
  Sparkles, 
  Send, 
  CheckCircle2, 
  Clock, 
  Star, 
  X, 
  Calendar, 
  ArrowRight, 
  Mail, 
  Settings, 
  Flame, 
  History, 
  RefreshCw,
  Award,
  Layers,
  BookOpen,
  Check
} from 'lucide-react';
import { Subject, StudySession, StudyPlan, RevisionItem, UserProfile, TestResult, ActiveTab } from '../types';
import { 
  getEveningWrapUpConfig, 
  saveEveningWrapUpConfig, 
  sendEveningWrapUpEmail, 
  generateEveningWrapUpEmailBody,
  EveningWrapUpConfig 
} from '../lib/eveningWrapUpService';
import { triggerStudyGoalConfetti } from '../lib/confetti';

interface EveningRetroModalProps {
  isOpen: boolean;
  onClose: () => void;
  todaySessions: StudySession[];
  todayPlan: StudyPlan | null;
  subjects: Subject[];
  revisions: RevisionItem[];
  userProfile: UserProfile | null;
  testResults: TestResult[];
  onSavePlan?: (plan: StudyPlan | Omit<StudyPlan, 'id'>) => Promise<void> | void;
  setActiveTab?: (tab: ActiveTab) => void;
}

export const EveningRetroModal: React.FC<EveningRetroModalProps> = ({
  isOpen,
  onClose,
  todaySessions,
  todayPlan,
  subjects,
  revisions,
  userProfile,
  testResults,
  onSavePlan,
  setActiveTab
}) => {
  const [activeTab, setActiveModalTab] = useState<'retro' | 'preview' | 'settings'>('retro');
  const [focusRating, setFocusRating] = useState<number>(5);
  const [reflectionNotes, setReflectionNotes] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendSuccess, setSendSuccess] = useState<boolean>(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isDraftingTomorrow, setIsDraftingTomorrow] = useState<boolean>(false);
  const [tomorrowDrafted, setTomorrowDrafted] = useState<boolean>(false);

  const [config, setConfig] = useState<EveningWrapUpConfig>(() => 
    getEveningWrapUpConfig(userProfile?.email || 'atharkhanteambuster@gmail.com', userProfile?.name || 'Student')
  );

  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  })();

  const targetHours = userProfile?.targetHoursPerDay || 3;
  const targetMinutes = targetHours * 60;
  const totalMinutesStudied = todaySessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  const hoursStudied = (totalMinutesStudied / 60).toFixed(1);
  const isGoalAchieved = totalMinutesStudied >= targetMinutes && targetMinutes > 0;
  const progressPercent = Math.min(100, Math.round((totalMinutesStudied / (targetMinutes || 1)) * 100));

  const topics = todayPlan?.topics || [];
  const completedTopics = topics.filter(t => t.completed);
  const incompleteTopics = topics.filter(t => !t.completed);

  // Sync config email when userProfile loads
  useEffect(() => {
    if (userProfile?.email && config.recipientEmail !== userProfile.email) {
      const updated = { ...config, recipientEmail: userProfile.email };
      setConfig(updated);
      saveEveningWrapUpConfig(updated);
    }
  }, [userProfile]);

  if (!isOpen) return null;

  const handleSendEmail = async () => {
    setIsSending(true);
    setSendError(null);
    setSendSuccess(false);

    try {
      const res = await sendEveningWrapUpEmail({
        recipientEmail: config.recipientEmail,
        recipientName: config.recipientName,
        dateStr: todayStr,
        todayPlan,
        todaySessions,
        subjects,
        revisions,
        userProfile,
        testResults,
        focusRating,
        reflectionNotes
      });

      if (res.success) {
        setSendSuccess(true);
        triggerStudyGoalConfetti();
        setConfig(getEveningWrapUpConfig(config.recipientEmail, config.recipientName));
      } else {
        setSendError(res.error || 'Failed to dispatch email.');
      }
    } catch (e: any) {
      setSendError(e.message || 'An unexpected error occurred.');
    } finally {
      setIsSending(false);
    }
  };

  const handleDraftTomorrowPlan = async () => {
    setIsDraftingTomorrow(true);
    try {
      // Collect rolled-over incomplete topics
      const rolledTopics = incompleteTopics.map(t => ({
        id: `topic-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        subjectName: t.subjectName,
        chapterName: t.chapterName,
        topicName: t.topicName,
        estimatedMinutes: t.estimatedMinutes || 45,
        priority: 'High' as const,
        completed: false
      }));

      // Add 1-2 due revisions if needed
      const dueRevisions = revisions.filter(r => r.status !== 'Completed').slice(0, 2);
      const revisionTopics = dueRevisions.map(r => ({
        id: `topic-rev-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        subjectName: r.subjectName,
        chapterName: r.chapterName,
        topicName: `[Revise] ${r.topicName}`,
        estimatedMinutes: 30,
        priority: 'Medium' as const,
        completed: false
      }));

      const newPlanTopics = [...rolledTopics, ...revisionTopics];

      if (onSavePlan && newPlanTopics.length > 0) {
        await onSavePlan({
          date: tomorrowStr,
          title: `Evening Planned Agenda (${new Date(tomorrowStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })})`,
          topics: newPlanTopics
        });
      }

      setTomorrowDrafted(true);
      triggerStudyGoalConfetti();
    } catch (e) {
      console.error('Failed to draft plan for tomorrow:', e);
    } finally {
      setIsDraftingTomorrow(false);
    }
  };

  const emailPreview = generateEveningWrapUpEmailBody({
    recipientEmail: config.recipientEmail,
    recipientName: config.recipientName,
    dateStr: todayStr,
    todayPlan,
    todaySessions,
    subjects,
    revisions,
    userProfile,
    testResults,
    focusRating,
    reflectionNotes
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white border border-[#E0DBD0] rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="bg-[#2B2D42] text-white p-6 border-b border-[#3D405B] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 text-[#DDBEA9]">
              <Moon className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-[#DDBEA9] font-bold">
                End-of-Day Retrospective
              </div>
              <h2 className="text-xl font-bold font-serif">
                Evening Study Wrap-Up & Retro
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-[#E0DBD0] bg-[#F9F7F2]">
          <button
            onClick={() => setActiveModalTab('retro')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition cursor-pointer ${
              activeTab === 'retro'
                ? 'bg-white text-[#2B2D42] border-t border-x border-[#E0DBD0] shadow-2xs'
                : 'text-[#6B705C] hover:text-[#2B2D42]'
            }`}
          >
            Daily Retrospective
          </button>
          <button
            onClick={() => setActiveModalTab('preview')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition cursor-pointer ${
              activeTab === 'preview'
                ? 'bg-white text-[#2B2D42] border-t border-x border-[#E0DBD0] shadow-2xs'
                : 'text-[#6B705C] hover:text-[#2B2D42]'
            }`}
          >
            Email Briefing Preview
          </button>
          <button
            onClick={() => setActiveModalTab('settings')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-white text-[#2B2D42] border-t border-x border-[#E0DBD0] shadow-2xs'
                : 'text-[#6B705C] hover:text-[#2B2D42]'
            }`}
          >
            Schedule Settings
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'retro' && (
            <div className="space-y-6">
              {/* Daily Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-center space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#A5A58D]">Studied Today</span>
                  <div className="text-2xl font-bold font-serif text-[#2B2D42]">{hoursStudied}h</div>
                  <span className="text-[10px] text-[#6B705C]">Target: {targetHours}h ({progressPercent}%)</span>
                </div>

                <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-center space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#A5A58D]">Tasks Completed</span>
                  <div className="text-2xl font-bold font-serif text-emerald-700">
                    {completedTopics.length}/{topics.length || todaySessions.length}
                  </div>
                  <span className="text-[10px] text-emerald-600 font-medium">
                    {incompleteTopics.length === 0 ? 'All finished! 🎉' : `${incompleteTopics.length} remaining`}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-center space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#A5A58D]">Sessions Logged</span>
                  <div className="text-2xl font-bold font-serif text-[#6B705C]">{todaySessions.length}</div>
                  <span className="text-[10px] text-[#A5A58D]">deep work blocks</span>
                </div>
              </div>

              {/* Focus Rating Selector */}
              <div className="p-4 rounded-2xl bg-white border border-[#E0DBD0] space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[#6B705C] block">
                  Rate Today's Overall Focus & Clarity:
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setFocusRating(star)}
                      className={`p-2 rounded-xl transition cursor-pointer ${
                        focusRating >= star
                          ? 'text-amber-500 bg-amber-50 border border-amber-200'
                          : 'text-[#E0DBD0] hover:text-amber-300'
                      }`}
                    >
                      <Star className={`w-6 h-6 ${focusRating >= star ? 'fill-amber-500' : ''}`} />
                    </button>
                  ))}
                  <span className="text-xs font-semibold text-[#4A4E4D] ml-2">
                    {focusRating === 5 ? 'Exceptional Flow 🔥' :
                     focusRating === 4 ? 'Great Focus ⚡' :
                     focusRating === 3 ? 'Moderate / Steady 👍' :
                     focusRating === 2 ? 'Distracted / Low Energy 😴' : 'Struggled to Focus 🌧️'}
                  </span>
                </div>
              </div>

              {/* Reflection Notes */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[#6B705C] block">
                  Daily Reflection / Breakthrough Note:
                </label>
                <textarea
                  value={reflectionNotes}
                  onChange={(e) => setReflectionNotes(e.target.value)}
                  placeholder="What was your main insight or concept breakthrough today? What would you do differently tomorrow?"
                  rows={3}
                  className="w-full p-3 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-xs font-sans text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
                />
              </div>

              {/* Incomplete Tasks & Draft Tomorrow's Plan Action */}
              {incompleteTopics.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-amber-900">
                        {incompleteTopics.length} Unfinished Topics to Roll Over
                      </h4>
                      <p className="text-[11px] text-amber-700">
                        Automatically transfer these to tomorrow's daily agenda with 1 click.
                      </p>
                    </div>

                    <button
                      onClick={handleDraftTomorrowPlan}
                      disabled={isDraftingTomorrow || tomorrowDrafted}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-2xs flex items-center gap-1.5 transition cursor-pointer disabled:bg-emerald-600"
                    >
                      {tomorrowDrafted ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Drafted for Tomorrow!</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Draft Tomorrow's Plan</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {incompleteTopics.map((t, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-xl bg-white border border-amber-200 text-[11px] font-medium text-amber-900"
                      >
                        📖 {t.topicName} ({t.estimatedMinutes}m)
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Send Status feedback */}
              {sendSuccess && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Evening Study Wrap-Up successfully sent to <strong>{config.recipientEmail}</strong> via Gmail!</span>
                </div>
              )}

              {sendError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-medium">
                  Failed to send email: {sendError}
                </div>
              )}
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="p-3 bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl text-xs space-y-1">
                <div><strong>Subject:</strong> {emailPreview.subjectLine}</div>
                <div><strong>To:</strong> {config.recipientEmail}</div>
              </div>

              {/* Render HTML Preview in Safe Frame */}
              <div 
                className="border border-[#E0DBD0] rounded-2xl p-4 bg-white max-h-[360px] overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: emailPreview.htmlBody }}
              />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="space-y-3 bg-[#F9F7F2] border border-[#E0DBD0] p-4 rounded-2xl">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B705C]">
                  Automated Evening Dispatch
                </h4>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-[#4A4E4D]">Enable Evening Recap</span>
                    <p className="text-[11px] text-[#A5A58D]">Sends daily retrospective at your set time</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => {
                      const updated = { ...config, enabled: e.target.checked };
                      setConfig(updated);
                      saveEveningWrapUpConfig(updated);
                    }}
                    className="w-4 h-4 accent-[#6B705C]"
                  />
                </div>

                <div className="space-y-1 pt-2">
                  <label className="text-xs font-medium text-[#4A4E4D]">Dispatch Time (Evening):</label>
                  <input
                    type="time"
                    value={config.dispatchTime}
                    onChange={(e) => {
                      const updated = { ...config, dispatchTime: e.target.value };
                      setConfig(updated);
                      saveEveningWrapUpConfig(updated);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white border border-[#E0DBD0] text-xs font-mono"
                  />
                </div>

                <div className="space-y-1 pt-2">
                  <label className="text-xs font-medium text-[#4A4E4D]">Recipient Email:</label>
                  <input
                    type="email"
                    value={config.recipientEmail}
                    onChange={(e) => {
                      const updated = { ...config, recipientEmail: e.target.value };
                      setConfig(updated);
                      saveEveningWrapUpConfig(updated);
                    }}
                    className="w-full px-3 py-1.5 rounded-xl bg-white border border-[#E0DBD0] text-xs"
                  />
                </div>
              </div>

              {/* Delivery History */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B705C] flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" /> Recent Dispatch Logs
                </h4>
                {config.history.length === 0 ? (
                  <p className="text-xs text-[#A5A58D] italic">No evening emails dispatched yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {config.history.map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 rounded-xl bg-[#F9F7F2] border border-[#E0DBD0] flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${log.status === 'Delivered' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          <span>{log.date} ({Math.round(log.totalStudyMinutes / 60)}h studied)</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#A5A58D]">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#F9F7F2] border-t border-[#E0DBD0] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#6B705C] hover:text-[#2B2D42] transition cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSendEmail}
              disabled={isSending}
              className="px-5 py-2 rounded-2xl bg-[#2B2D42] hover:bg-[#1E202F] text-white text-xs font-bold shadow-xs flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              {isSending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Sending to Gmail...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Dispatch Evening Recap Email</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
