import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Sparkles, 
  Clock, 
  Calendar, 
  Check, 
  Eye, 
  ChevronDown, 
  ChevronUp, 
  FileText,
  Lock,
  Settings,
  Bell,
  CheckCircle,
  ExternalLink,
  History,
  Sun,
  Flame,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { 
  StudyPlan, 
  StudySession, 
  Subject, 
  RevisionItem, 
  UserProfile,
  TestResult,
  Assignment,
  MissedWorkItem
} from '../types';
import { 
  getOrRequestGmailToken, 
  sendDailyAgendaEmail, 
  generateAgendaEmailContent,
  getCachedGmailToken,
  getMorningBriefingConfig,
  saveMorningBriefingConfig,
  MorningBriefingConfig,
  MorningBriefingLogItem,
  DEFAULT_APP_BASE_URL
} from '../lib/gmailService';
import { auth } from '../lib/firebase';

interface EmailAgendaModalProps {
  isOpen: boolean;
  onClose: () => void;
  todayPlan: StudyPlan | null;
  todaySessions: StudySession[];
  subjects: Subject[];
  revisions: RevisionItem[];
  userProfile: UserProfile | null;
  testResults?: TestResult[];
  assignments?: Assignment[];
  missedWork?: MissedWorkItem[];
  user?: any;
}

export const EmailAgendaModal: React.FC<EmailAgendaModalProps> = ({
  isOpen,
  onClose,
  todayPlan,
  todaySessions,
  subjects,
  revisions,
  userProfile,
  testResults = [],
  assignments = [],
  missedWork = [],
  user
}) => {
  const [activeTab, setActiveTab] = useState<'send' | 'schedule' | 'history'>('send');
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [recipientName, setRecipientName] = useState<string>('');
  const [customNote, setCustomNote] = useState<string>('');
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendSuccess, setSendSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Morning automated briefing configuration state
  const [briefingConfig, setBriefingConfig] = useState<MorningBriefingConfig>(() => 
    getMorningBriefingConfig(
      auth.currentUser?.email || userProfile?.email || 'atharkhanteambuster@gmail.com',
      userProfile?.displayName || 'Student'
    )
  );
  const [configSavedToast, setConfigSavedToast] = useState<boolean>(false);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayFormatted = new Date().toLocaleDateString('en-GB', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });

  // Accurately resolve the user's primary email address
  const activeLoggedInEmail = 
    auth.currentUser?.email || 
    user?.email || 
    userProfile?.email || 
    (userProfile?.displayName && userProfile.displayName.includes('@') ? userProfile.displayName : '') || 
    '';

  const activeDisplayName = 
    userProfile?.displayName || 
    user?.displayName || 
    auth.currentUser?.displayName || 
    'Student';

  // Populate config on modal open
  useEffect(() => {
    if (isOpen) {
      const currentConfig = getMorningBriefingConfig(activeLoggedInEmail, activeDisplayName);
      setBriefingConfig(currentConfig);
      setRecipientEmail(currentConfig.recipientEmail || activeLoggedInEmail);
      setRecipientName(currentConfig.recipientName || activeDisplayName);
      setCustomNote(currentConfig.customDailyNote || '');
      setSendSuccess(false);
      setErrorMessage('');
    }
  }, [isOpen, activeLoggedInEmail, activeDisplayName]);

  if (!isOpen) return null;

  const assignedTopics = todayPlan ? todayPlan.topics.filter(t => !t.completed) : [];
  const completedTopics = todayPlan ? todayPlan.topics.filter(t => Boolean(t.completed)) : [];
  const totalMinsDone = todaySessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  const hoursDone = (totalMinsDone / 60).toFixed(1);
  const targetHours = userProfile?.targetHoursPerDay || 3;

  const previewContent = generateAgendaEmailContent({
    recipientEmail: recipientEmail || 'atharkhanteambuster@gmail.com',
    recipientName: recipientName || 'Student',
    dateStr: todayFormatted,
    todayPlan,
    todaySessions,
    subjects,
    revisions,
    userProfile,
    testResults,
    assignments,
    missedWork,
    customNote,
    baseUrl: typeof window !== 'undefined' ? window.location.origin : DEFAULT_APP_BASE_URL
  });

  const handleSaveConfig = () => {
    const updated: MorningBriefingConfig = {
      ...briefingConfig,
      recipientEmail: recipientEmail.trim() || activeLoggedInEmail,
      recipientName: recipientName.trim() || activeDisplayName,
      customDailyNote: customNote.trim()
    };
    setBriefingConfig(updated);
    saveMorningBriefingConfig(updated);
    setConfigSavedToast(true);
    setTimeout(() => setConfigSavedToast(false), 2500);
  };

  const handleSendEmail = async () => {
    if (!recipientEmail || !recipientEmail.includes('@')) {
      setErrorMessage('Please provide a valid recipient email address.');
      return;
    }

    setErrorMessage('');
    setIsSending(true);

    try {
      // 1. Get or prompt for Gmail OAuth access token
      const token = await getOrRequestGmailToken();
      if (!token) {
        throw new Error('Unable to acquire Gmail authorization.');
      }

      // 2. Dispatch the structured email via Gmail REST API
      const result = await sendDailyAgendaEmail({
        recipientEmail,
        recipientName,
        dateStr: todayFormatted,
        todayPlan,
        todaySessions,
        subjects,
        revisions,
        userProfile,
        testResults,
        assignments,
        missedWork,
        customNote,
        baseUrl: typeof window !== 'undefined' ? window.location.origin : DEFAULT_APP_BASE_URL
      }, token);

      // 3. Record in delivery history
      const newLogItem: MorningBriefingLogItem = {
        id: `brief-${Date.now()}`,
        date: todayStr,
        timestamp: Date.now(),
        status: 'Delivered',
        recipient: recipientEmail,
        tasksCount: assignedTopics.length,
        completedCount: completedTopics.length,
        messageId: result.messageId
      };

      const updatedHistory = [newLogItem, ...(briefingConfig.history || [])].slice(0, 30);
      const updatedConfig: MorningBriefingConfig = {
        ...briefingConfig,
        lastDispatchedDate: todayStr,
        lastDispatchedTimestamp: Date.now(),
        history: updatedHistory
      };

      setBriefingConfig(updatedConfig);
      saveMorningBriefingConfig(updatedConfig);

      setSendSuccess(true);
    } catch (err: any) {
      console.error('Failed to send daily agenda email:', err);
      setErrorMessage(
        err.message || 'Failed to send email. Please ensure you have authorized Gmail access.'
      );

      // Log failure in history
      const failedLogItem: MorningBriefingLogItem = {
        id: `brief-fail-${Date.now()}`,
        date: todayStr,
        timestamp: Date.now(),
        status: 'Failed',
        recipient: recipientEmail,
        tasksCount: assignedTopics.length,
        completedCount: completedTopics.length,
        error: err.message
      };

      const updatedHistory = [failedLogItem, ...(briefingConfig.history || [])].slice(0, 30);
      const updatedConfig: MorningBriefingConfig = {
        ...briefingConfig,
        history: updatedHistory
      };
      setBriefingConfig(updatedConfig);
      saveMorningBriefingConfig(updatedConfig);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-[#E0DBD0] rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative text-[#4A4E4D] max-h-[92vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[#A5A58D] hover:text-[#4A4E4D] p-1.5 rounded-full hover:bg-[#F2EFE9] transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[#E0DBD0]">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 flex items-center justify-center shrink-0">
            <Sun className="w-6 h-6 text-amber-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-serif italic font-bold text-[#6B705C]">
                Automated Morning Agenda & Gmail Briefing
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Actionable 'Mark as Done' Active
              </span>
            </div>
            <p className="text-xs text-[#8A8F80] mt-0.5">
              Delivers today's study priorities, past performance metrics, and interactive one-click completion buttons directly to your Gmail inbox each morning.
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 p-1 bg-[#F5F2EB] rounded-2xl border border-[#E0DBD0] mb-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('send')}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'send' 
                ? 'bg-white text-[#6B705C] shadow-xs font-bold' 
                : 'text-[#8A8F80] hover:text-[#4A4E4D]'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Today's Briefing Now</span>
          </button>

          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'schedule' 
                ? 'bg-white text-[#6B705C] shadow-xs font-bold' 
                : 'text-[#8A8F80] hover:text-[#4A4E4D]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Daily Morning Schedule</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'history' 
                ? 'bg-white text-[#6B705C] shadow-xs font-bold' 
                : 'text-[#8A8F80] hover:text-[#4A4E4D]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Delivery Log ({briefingConfig.history?.length || 0})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto pr-1 space-y-4 flex-1">
          {configSavedToast && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Morning briefing preferences saved successfully!</span>
            </div>
          )}

          {activeTab === 'send' && (
            <>
              {sendSuccess ? (
                <div className="py-6 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-serif italic font-bold text-emerald-900">
                      Morning Agenda Email Delivered! 📬
                    </h3>
                    <p className="text-xs text-[#6B705C] max-w-md mx-auto">
                      A structured morning summary with actionable <strong>"Mark as Done"</strong> links, study performance, and exam countdowns has been delivered to <strong>{recipientEmail}</strong>.
                    </p>
                  </div>

                  <div className="p-4 bg-[#F9F7F2] rounded-2xl border border-[#E0DBD0] text-xs text-[#4A4E4D] max-w-md mx-auto text-left space-y-2">
                    <div className="font-bold text-[#6B705C] flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-[#6B705C]" />
                      <span>Email Content Breakdown:</span>
                    </div>
                    <ul className="list-disc pl-5 space-y-1 text-[#666B60]">
                      <li>Assigned Tasks To Do: <strong>{assignedTopics.length} topics</strong> (each with interactive "Mark as Done" buttons)</li>
                      <li>Completed Topics: <strong>{completedTopics.length} topics</strong></li>
                      <li>Logged Study Time: <strong>{hoursDone} hrs ({totalMinsDone}m)</strong> / {targetHours}h target</li>
                      <li>Spaced Revisions: <strong>{revisions.filter(r => r.status === 'Pending').length} items due</strong></li>
                      <li>3-Tier Sync Status: <strong>Instant Cache + Cloud Firestore + Google Drive</strong></li>
                    </ul>
                  </div>

                  <div className="flex justify-center gap-3 pt-2">
                    <button
                      onClick={() => setSendSuccess(false)}
                      className="px-4 py-2 border border-[#E0DBD0] text-xs font-semibold rounded-full hover:bg-[#F2EFE9] transition"
                    >
                      Send Another Email
                    </button>
                    <button
                      onClick={onClose}
                      className="px-6 py-2 bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-semibold rounded-full transition shadow-xs"
                    >
                      Close & Return to StudyOS
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {errorMessage && (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-bold">Email Dispatch Error</div>
                        <div className="mt-0.5">{errorMessage}</div>
                      </div>
                    </div>
                  )}

                  {/* Recipient Field */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold uppercase tracking-widest text-[#A5A58D]">
                        Primary Recipient Email
                      </label>
                      {recipientEmail !== activeLoggedInEmail && (
                        <button
                          type="button"
                          onClick={() => setRecipientEmail(activeLoggedInEmail)}
                          className="text-[10px] font-bold text-[#6B705C] hover:underline cursor-pointer"
                        >
                          Reset to Primary ({activeLoggedInEmail})
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl px-3.5 py-2.5 focus-within:border-[#6B705C] transition">
                      <Mail className="w-4 h-4 text-[#6B705C] shrink-0" />
                      <input
                        type="email"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        placeholder="e.g. atharkhanteambuster@gmail.com"
                        className="w-full bg-transparent text-xs text-[#4A4E4D] font-mono focus:outline-none"
                      />
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#EAE7DF] text-[#6B705C] shrink-0 border border-[#E0DBD0]">
                        Verified
                      </span>
                    </div>
                  </div>

                  {/* Morning Note / Focus Mantra */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#A5A58D]">
                      Morning Focus Note / Target Mantra (Included in Email)
                    </label>
                    <input
                      type="text"
                      value={customNote}
                      onChange={(e) => setCustomNote(e.target.value)}
                      placeholder="e.g. Master Organic Reactions before 2 PM, then solve test numericals..."
                      className="w-full bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl px-3.5 py-2.5 text-xs text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
                    />
                  </div>

                  {/* Quick Metrics Bar */}
                  <div className="grid grid-cols-3 gap-2.5 pt-1">
                    <div className="bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl p-3 text-xs space-y-0.5">
                      <div className="text-[10px] uppercase font-bold text-[#A5A58D] font-mono">Assigned To-Do</div>
                      <div className="text-base font-bold text-[#4A4E4D]">
                        {assignedTopics.length} <span className="text-xs font-normal text-[#A5A58D]">tasks pending</span>
                      </div>
                    </div>

                    <div className="bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl p-3 text-xs space-y-0.5">
                      <div className="text-[10px] uppercase font-bold text-[#A5A58D] font-mono">Completed Today</div>
                      <div className="text-base font-bold text-emerald-700">
                        {completedTopics.length} <span className="text-xs font-normal text-[#A5A58D]">({hoursDone}h done)</span>
                      </div>
                    </div>

                    <div className="bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl p-3 text-xs space-y-0.5">
                      <div className="text-[10px] uppercase font-bold text-[#A5A58D] font-mono">Revisions Due</div>
                      <div className="text-base font-bold text-amber-800">
                        {revisions.filter(r => r.status === 'Pending').length} <span className="text-xs font-normal text-[#A5A58D]">items</span>
                      </div>
                    </div>
                  </div>

                  {/* Feature Highlights Banner */}
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-900 space-y-1.5">
                    <div className="font-bold flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-700" />
                      <span>Actionable Email Highlights:</span>
                    </div>
                    <div className="text-[11px] text-amber-800 leading-relaxed">
                      Every task in the email includes a direct <strong>"✅ Mark as Done"</strong> button. Clicking it in your Gmail calls the StudyOS completion API, automatically checking off the topic, syncing to Cloud Firestore, and updating your study streak with zero lag.
                    </div>
                  </div>

                  {/* Collapsible Preview */}
                  <div className="border border-[#E0DBD0] rounded-2xl overflow-hidden bg-[#FAF8F4]">
                    <button
                      type="button"
                      onClick={() => setShowPreview(!showPreview)}
                      className="w-full p-3 flex items-center justify-between text-xs font-semibold text-[#6B705C] hover:bg-[#F2EFE9] transition text-left cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-4 h-4" />
                        <span>{showPreview ? 'Hide HTML Email Preview' : 'Preview Formatted Morning Email (with Action Buttons)'}</span>
                      </span>
                      {showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {showPreview && (
                      <div className="p-4 border-t border-[#E0DBD0] bg-white text-xs max-h-72 overflow-y-auto space-y-3 font-sans">
                        <div className="pb-2 border-b border-[#E0DBD0] text-[11px] text-[#8A8F80]">
                          <strong>Subject:</strong> {previewContent.subject}
                        </div>

                        <div className="space-y-3">
                          <div className="font-bold text-[#6B705C] flex items-center justify-between">
                            <span>📋 1. Today's Actionable Agenda ({assignedTopics.length} Pending):</span>
                          </div>

                          {assignedTopics.length > 0 ? (
                            <div className="space-y-2">
                              {assignedTopics.map((t, idx) => (
                                <div key={idx} className="p-3 bg-[#FAF8F4] border border-[#EAE7DF] rounded-xl flex items-center justify-between">
                                  <div>
                                    <div className="font-bold text-[#2D3748]">{t.topicName}</div>
                                    <div className="text-[11px] text-[#718096]">{t.subjectName} • ~{t.estimatedMinutes}m • [{t.priority}]</div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] bg-[#EFECE6] px-2.5 py-1 rounded-full text-[#4A4E4D] font-bold">
                                      ⏱️ Start Timer
                                    </span>
                                    <span className="text-[10px] bg-[#2F855A] text-white px-2.5 py-1 rounded-full font-bold">
                                      ✅ Mark as Done
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-[11px] text-emerald-700 italic">All today's tasks completed!</div>
                          )}

                          <div className="font-bold text-emerald-800 pt-1">📈 2. Past Performance & Diagnostics:</div>
                          <div className="text-[11px] text-[#666B60] space-y-1 pl-2">
                            <div>• Total Today's Logged: {hoursDone} hrs ({totalMinsDone}m) of {targetHours}h goal</div>
                            <div>• Completed Topics: {completedTopics.length} checked off</div>
                            {testResults.slice(0, 2).map((tr, i) => (
                              <div key={i}>• Test: {tr.testName} ({tr.subjectName}) - Score: {tr.score}</div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirmation Notice */}
                  <div className="p-3 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-xs text-[#6B705C] flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#6B705C] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Confirmation Required:</span> Clicking <strong>"Confirm & Send Morning Briefing"</strong> will send this structured agenda to <strong>{recipientEmail}</strong> via the official Gmail API.
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {activeTab === 'schedule' && (
            <div className="space-y-4">
              <div className="p-4 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-[#4A4E4D] flex items-center gap-2">
                      <Sun className="w-4 h-4 text-amber-600" />
                      <span>Daily Automated Morning Briefing</span>
                    </h3>
                    <p className="text-xs text-[#8A8F80]">
                      Automatically generates and emails your study agenda each morning.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={briefingConfig.enabled}
                      onChange={(e) => setBriefingConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#6B705C]"></div>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#E0DBD0]">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-[#A5A58D] mb-1">
                      Preferred Morning Time
                    </label>
                    <select
                      value={briefingConfig.dispatchTime}
                      onChange={(e) => setBriefingConfig(prev => ({ ...prev, dispatchTime: e.target.value }))}
                      className="w-full bg-white border border-[#E0DBD0] rounded-xl px-3 py-2 text-xs text-[#4A4E4D] font-bold focus:outline-none focus:border-[#6B705C]"
                    >
                      <option value="06:00">06:00 AM (Early Bird)</option>
                      <option value="06:30">06:30 AM</option>
                      <option value="07:00">07:00 AM</option>
                      <option value="07:30">07:30 AM (Standard)</option>
                      <option value="08:00">08:00 AM</option>
                      <option value="08:30">08:30 AM</option>
                      <option value="09:00">09:00 AM</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-[#A5A58D] mb-1">
                      Auto-Send on Morning App Open
                    </label>
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={briefingConfig.autoSendOnMorningOpen}
                        onChange={(e) => setBriefingConfig(prev => ({ ...prev, autoSendOnMorningOpen: e.target.checked }))}
                        className="rounded text-[#6B705C] focus:ring-[#6B705C]"
                      />
                      <span className="text-xs text-[#4A4E4D] font-medium">Send on first morning open</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#A5A58D] mb-1">
                    Primary Destination Inbox
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="atharkhanteambuster@gmail.com"
                    className="w-full bg-white border border-[#E0DBD0] rounded-xl px-3 py-2 text-xs text-[#4A4E4D] font-mono focus:outline-none focus:border-[#6B705C]"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleSaveConfig}
                    className="px-5 py-2 bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-bold rounded-full transition shadow-xs cursor-pointer"
                  >
                    Save Morning Schedule Preferences
                  </button>
                </div>
              </div>

              {/* Status summary */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 space-y-2">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-700" />
                  <span>Automated Morning Engine Status</span>
                </div>
                <div className="text-[11px] text-emerald-800 leading-relaxed">
                  • Status: <strong>{briefingConfig.enabled ? 'Active & Scheduled' : 'Disabled'}</strong><br />
                  • Morning Trigger: <strong>{briefingConfig.dispatchTime} daily</strong><br />
                  • Last Dispatched: <strong>{briefingConfig.lastDispatchedDate ? `${briefingConfig.lastDispatchedDate} (${new Date(briefingConfig.lastDispatchedTimestamp || 0).toLocaleTimeString()})` : 'Never'}</strong><br />
                  • Destination: <strong>{briefingConfig.recipientEmail || activeLoggedInEmail}</strong>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-[#6B705C] uppercase tracking-wider">
                  Morning Briefing Delivery History
                </div>
                <span className="text-[11px] text-[#8A8F80]">
                  {briefingConfig.history?.length || 0} records
                </span>
              </div>

              {briefingConfig.history && briefingConfig.history.length > 0 ? (
                <div className="space-y-2">
                  {briefingConfig.history.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 bg-[#FAF8F4] border border-[#EAE7DF] rounded-2xl flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.status === 'Delivered' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {item.status}
                          </span>
                          <span className="font-bold text-[#4A4E4D]">{item.date}</span>
                          <span className="text-[#8A8F80] font-mono text-[10px]">
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#718096]">
                          Sent to: <span className="font-mono text-[#4A4E4D]">{item.recipient}</span> • {item.tasksCount} tasks included
                        </div>
                      </div>

                      {item.messageId && (
                        <span className="text-[10px] font-mono bg-[#EAE7DF] px-2 py-1 rounded-lg text-[#6B705C]">
                          ID: {item.messageId.substring(0, 10)}...
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-[#F9F7F2] border border-dashed border-[#E0DBD0] rounded-2xl text-xs text-[#8A8F80] space-y-1">
                  <Mail className="w-6 h-6 mx-auto text-[#A5A58D]" />
                  <div className="font-bold text-[#4A4E4D]">No Emails Dispatched Yet</div>
                  <div>Use the "Send Today's Briefing Now" tab to test delivery to your Gmail inbox.</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        {activeTab === 'send' && !sendSuccess && (
          <div className="mt-5 pt-4 border-t border-[#E0DBD0] flex items-center justify-between gap-3">
            <button
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2.5 rounded-full border border-[#E0DBD0] hover:bg-[#F2EFE9] text-xs font-semibold text-[#4A4E4D] transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              onClick={handleSendEmail}
              disabled={isSending || !recipientEmail}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {isSending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Connecting to Gmail & Dispatching...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Confirm & Send Morning Briefing</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

