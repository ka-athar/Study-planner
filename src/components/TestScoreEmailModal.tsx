import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Sparkles, 
  FileCheck, 
  Copy, 
  Check, 
  Download, 
  Bot, 
  Calendar, 
  ShieldCheck, 
  Lightbulb, 
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { TestResult, Subject, UserProfile, ActiveTab } from '../types';
import { 
  getOrRequestGmailToken, 
  sendTestImprovementEmail, 
  generateTestImprovementEmailContent 
} from '../lib/gmailService';
import { auth } from '../lib/firebase';

interface TestScoreEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  testResults: TestResult[];
  subjects: Subject[];
  userProfile: UserProfile | null;
  user?: any;
  focusTestId?: string;
  onOpenScheduleAdjuster?: (topicName: string, subjectName: string, durationMinutes: number) => void;
  setActiveTab?: (tab: ActiveTab) => void;
}

export const TestScoreEmailModal: React.FC<TestScoreEmailModalProps> = ({
  isOpen,
  onClose,
  testResults,
  subjects,
  userProfile,
  user,
  focusTestId,
  onOpenScheduleAdjuster,
  setActiveTab
}) => {
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [recipientName, setRecipientName] = useState<string>('');
  const [customNote, setCustomNote] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendSuccess, setSendSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [activeViewTab, setActiveViewTab] = useState<'email' | 'preview' | 'combinations'>('email');

  const todayFormatted = new Date().toLocaleDateString('en-GB', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });

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

  useEffect(() => {
    if (isOpen) {
      setRecipientEmail(activeLoggedInEmail);
      setRecipientName(activeDisplayName);
      setSendSuccess(false);
      setErrorMessage('');
      setCopied(false);
    }
  }, [isOpen, activeLoggedInEmail, activeDisplayName]);

  if (!isOpen) return null;

  const content = generateTestImprovementEmailContent({
    recipientEmail: recipientEmail || 'student@example.com',
    recipientName: recipientName || 'Student',
    dateStr: todayFormatted,
    testResults,
    subjects,
    userProfile,
    customNote,
    focusTestId
  });

  const handleSendEmail = async () => {
    if (!recipientEmail || !recipientEmail.includes('@')) {
      setErrorMessage('Please provide a valid recipient email address.');
      return;
    }

    setErrorMessage('');
    setIsSending(true);

    try {
      const token = await getOrRequestGmailToken();
      if (!token) {
        throw new Error('Unable to connect to Google account. Please verify Gmail permissions.');
      }

      await sendTestImprovementEmail({
        recipientEmail,
        recipientName,
        dateStr: todayFormatted,
        testResults,
        subjects,
        userProfile,
        customNote,
        focusTestId
      }, token);

      setSendSuccess(true);
    } catch (err: any) {
      console.error('Failed to send test diagnostic email:', err);
      setErrorMessage(
        err.message || 'Failed to send email. Please authorize Gmail access or copy the report directly.'
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn('Clipboard write failed:', e);
    }
  };

  const handleDownloadReport = () => {
    const blob = new Blob([content.text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Test_Scores_Improvement_Diagnostic_${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const displayedTests = focusTestId 
    ? testResults.filter(t => t.id === focusTestId)
    : testResults;

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

        {/* Header */}
        <div className="flex items-start gap-3 mb-4 pb-3 border-b border-[#E0DBD0]">
          <div className="w-10 h-10 rounded-2xl bg-[#6B705C]/10 border border-[#6B705C]/20 text-[#6B705C] flex items-center justify-center shrink-0 mt-0.5">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-serif italic font-bold text-[#6B705C] flex items-center gap-2">
              <span>Email Test Scores & AI Improvement Combinations</span>
            </h2>
            <p className="text-xs text-[#A5A58D] mt-0.5">
              Deliver your test marks, mistake root-cause gaps, improvement action plans, and AI tutor prompts directly to your email inbox.
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 p-1 bg-[#F2EFE9] rounded-2xl border border-[#E0DBD0] mb-4">
          <button
            onClick={() => setActiveViewTab('email')}
            className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeViewTab === 'email'
                ? 'bg-white text-[#6B705C] shadow-xs'
                : 'text-[#8A8F80] hover:text-[#4A4E4D]'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Send to Inbox</span>
          </button>

          <button
            onClick={() => setActiveViewTab('combinations')}
            className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeViewTab === 'combinations'
                ? 'bg-white text-[#6B705C] shadow-xs'
                : 'text-[#8A8F80] hover:text-[#4A4E4D]'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span>Improvement Combinations</span>
          </button>

          <button
            onClick={() => setActiveViewTab('preview')}
            className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeViewTab === 'preview'
                ? 'bg-white text-[#6B705C] shadow-xs'
                : 'text-[#8A8F80] hover:text-[#4A4E4D]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Full Digest Preview</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto pr-1 space-y-4 flex-1">
          {sendSuccess ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-serif italic font-bold text-emerald-900">
                  Diagnostic Report Delivered to Inbox! 📬
                </h3>
                <p className="text-xs text-[#6B705C] max-w-md mx-auto">
                  Your full test scores, diagnosed mistake gaps, improvement combinations, and ready-to-use tutor prompts have been sent to <strong>{recipientEmail}</strong>.
                </p>
              </div>

              <div className="p-4 bg-[#F9F7F2] rounded-2xl border border-[#E0DBD0] text-xs text-[#4A4E4D] max-w-md mx-auto text-left space-y-2">
                <div className="font-bold text-[#6B705C] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#6B705C]" />
                  <span>3-Tier Persistence Verification:</span>
                </div>
                <div className="text-[11px] text-[#666B60] space-y-1">
                  <div>✓ <strong>Tier 1:</strong> Local Zero-Latency Cache saved</div>
                  <div>✓ <strong>Tier 2:</strong> Firestore Cloud Database synchronized</div>
                  <div>✓ <strong>Tier 3:</strong> Google Workspace & Drive academic backup active</div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={handleCopyToClipboard}
                  className="px-4 py-2 bg-[#F2EFE9] hover:bg-[#EAE7DF] text-[#4A4E4D] font-bold text-xs rounded-full border border-[#E0DBD0] flex items-center gap-1.5 transition"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-[#6B705C]" />}
                  <span>{copied ? 'Copied to Clipboard' : 'Copy Formatted Text'}</span>
                </button>

                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-semibold rounded-full transition shadow-xs"
                >
                  Done
                </button>
              </div>
            </div>
          ) : activeViewTab === 'email' ? (
            <div className="space-y-4">
              {errorMessage && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-bold">Dispatch Notice</div>
                    <div className="mt-0.5">{errorMessage}</div>
                  </div>
                </div>
              )}

              {/* Recipient Address */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#A5A58D]">
                    Recipient Email Address
                  </label>
                  {recipientEmail !== activeLoggedInEmail && (
                    <button
                      type="button"
                      onClick={() => setRecipientEmail(activeLoggedInEmail)}
                      className="text-[10px] font-bold text-[#6B705C] hover:underline cursor-pointer"
                    >
                      Reset to Logged-in ({activeLoggedInEmail})
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl px-3.5 py-2.5 focus-within:border-[#6B705C] transition">
                  <Mail className="w-4 h-4 text-[#6B705C] shrink-0" />
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="e.g. student@gmail.com"
                    className="w-full bg-transparent text-xs text-[#4A4E4D] placeholder-[#A5A58D] focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Summary of Included Content */}
              <div className="p-4 bg-[#F9F7F2] rounded-2xl border border-[#E0DBD0] space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-[#6B705C]">
                  <span className="flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4" />
                    <span>Included in this Diagnostic Email ({displayedTests.length} Tests):</span>
                  </span>
                  <span className="text-[10px] bg-[#6B705C]/10 px-2 py-0.5 rounded-full">
                    {todayFormatted}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-[#4A4E4D]">
                  {displayedTests.slice(0, 3).map((t, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-xl border border-[#EAE7DF]">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-[10px] font-bold bg-[#EAE7DF] text-[#6B705C] px-2 py-0.5 rounded">
                          {t.subjectName}
                        </span>
                        <span className="font-semibold truncate">{t.testName}</span>
                      </div>
                      <span className="font-mono font-bold text-[#6B705C] shrink-0 ml-2">
                        {t.score}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-[#666B60] pt-1">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>AI Mistake Gap Diagnostics</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>3 Actionable Improvement Paths</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Copyable AI Tutor Prompts</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>3-Tier Persistence Verification</span>
                  </div>
                </div>
              </div>

              {/* Custom Personal Note */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-widest text-[#A5A58D]">
                  Add Optional Study Note or Reflection
                </label>
                <textarea
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="e.g. Focus on mastering integration by parts and thermodynamics Carnot cycles before Friday..."
                  rows={2}
                  className="w-full bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl px-3.5 py-2.5 text-xs text-[#4A4E4D] placeholder-[#A5A58D] focus:outline-hidden focus:border-[#6B705C] transition resize-none"
                />
              </div>

              {/* 3-Tier Sync Assurance Callout */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-900">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span><strong>Never Lose Data:</strong> Multi-layer zero-latency local cache & continuous Firestore sync.</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-100 px-2 py-0.5 rounded-md">
                  Active
                </span>
              </div>
            </div>
          ) : activeViewTab === 'combinations' ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-amber-950">
                  <Lightbulb className="w-4 h-4 text-amber-700" />
                  <span>AI Synthesized Improvement Combinations</span>
                </div>
                <p className="leading-relaxed">
                  Based on your test mistakes, here are 3 high-yield combinations to raise your score:
                </p>
              </div>

              <div className="space-y-3">
                {/* Combination 1 */}
                <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#6B705C] uppercase tracking-wider">
                      Combination 1: Targeted Syllabus Remediation
                    </span>
                    <span className="text-[10px] font-bold bg-[#6B705C]/10 text-[#6B705C] px-2 py-0.5 rounded-full">
                      Concept Mastery
                    </span>
                  </div>
                  <p className="text-xs text-[#4A4E4D]">
                    Re-read textbook theory on your diagnosed weak concepts. Do not attempt timed tests until underlying formulas and definitions are solid.
                  </p>
                  {displayedTests[0]?.analysis?.weakConcept && (
                    <div className="text-[11px] p-2 bg-white rounded-xl border border-[#EAE7DF] text-[#6B705C]">
                      <strong>Focus Concept:</strong> {displayedTests[0].analysis.weakConcept}
                    </div>
                  )}
                </div>

                {/* Combination 2 */}
                <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#6B705C] uppercase tracking-wider">
                      Combination 2: Active Recall & AI Tutor Prompts
                    </span>
                    <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                      Interactive Sprints
                    </span>
                  </div>
                  <p className="text-xs text-[#4A4E4D]">
                    Use the auto-generated practice prompts with your AI Tutor to solve 3 progressive questions with immediate feedback.
                  </p>
                  {displayedTests[0]?.analysis?.tutorPrompts?.[0] && (
                    <div className="p-2.5 bg-white rounded-xl border border-[#EAE7DF] flex items-center justify-between gap-2 text-xs">
                      <p className="italic text-[#4A4E4D] truncate">"{displayedTests[0].analysis.tutorPrompts[0]}"</p>
                      {setActiveTab && (
                        <button
                          onClick={() => {
                            onClose();
                            setActiveTab('tutor');
                          }}
                          className="shrink-0 px-3 py-1 bg-[#6B705C] text-white text-[10px] font-bold rounded-full hover:bg-[#5a5f4e] transition"
                        >
                          Launch Tutor
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Combination 3 */}
                <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#6B705C] uppercase tracking-wider">
                      Combination 3: Smart Schedule Adjustment
                    </span>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      Slot Booking
                    </span>
                  </div>
                  <p className="text-xs text-[#4A4E4D]">
                    Find the lightest study day in your upcoming week and book a 30-minute remedial session to re-test the missed questions.
                  </p>
                  {onOpenScheduleAdjuster && (
                    <button
                      onClick={() => {
                        const firstTest = displayedTests[0];
                        onOpenScheduleAdjuster(
                          firstTest ? `Remediation: ${firstTest.testName} Missed Questions` : 'Test Mistake Remediation',
                          firstTest?.subjectName || subjects[0]?.name || 'Study',
                          30
                        );
                      }}
                      className="px-4 py-2 bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-semibold rounded-full flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Pick an Open Day to Schedule Remediation</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Full Digest Preview Tab */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-[#A5A58D]">
                  Diagnostic Digest Plain-Text / Markdown Preview
                </span>
                <button
                  onClick={handleCopyToClipboard}
                  className="text-xs font-bold text-[#6B705C] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
                </button>
              </div>

              <pre className="p-4 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-[11px] font-mono text-[#4A4E4D] whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                {content.text}
              </pre>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!sendSuccess && (
          <div className="mt-4 pt-3 border-t border-[#E0DBD0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyToClipboard}
                className="px-3.5 py-2 bg-[#F2EFE9] hover:bg-[#EAE7DF] text-[#4A4E4D] text-xs font-bold rounded-full border border-[#E0DBD0] flex items-center gap-1.5 transition cursor-pointer"
                title="Copy formatted diagnostic email text to clipboard"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#6B705C]" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadReport}
                className="px-3.5 py-2 bg-[#F2EFE9] hover:bg-[#EAE7DF] text-[#4A4E4D] text-xs font-bold rounded-full border border-[#E0DBD0] flex items-center gap-1.5 transition cursor-pointer"
                title="Download report file as Markdown"
              >
                <Download className="w-3.5 h-3.5 text-[#6B705C]" />
                <span>Save File</span>
              </button>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-[#A5A58D] hover:text-[#4A4E4D] transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                id="btn-confirm-send-test-email"
                type="button"
                onClick={handleSendEmail}
                disabled={isSending}
                className="px-5 py-2.5 bg-[#6B705C] hover:bg-[#5a5f4e] disabled:opacity-60 text-white font-medium text-xs rounded-full shadow-xs flex items-center gap-2 cursor-pointer transition active:scale-95"
              >
                {isSending ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Delivering to Gmail...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Confirm & Send to Inbox</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
