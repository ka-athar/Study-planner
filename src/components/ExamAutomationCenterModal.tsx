import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Mail, 
  Smartphone, 
  Send, 
  CheckCircle, 
  AlertTriangle, 
  Bell, 
  Plus, 
  Trash2, 
  RefreshCw, 
  X, 
  Sparkles,
  Layers,
  Eye,
  Check,
  Zap,
  Volume2,
  MessageSquare,
  ExternalLink,
  ShieldCheck,
  CalendarDays,
  Bot,
  Radio,
  Brain,
  CheckSquare,
  Flame,
  Play,
  ArrowRight,
  Share2,
  Video
} from 'lucide-react';
import { 
  ExamDate, 
  Subject, 
  RevisionItem, 
  ExamNotificationSettings, 
  UserProfile, 
  StudyPlan, 
  TestResult, 
  Assignment 
} from '../types';
import {
  loadLocalNotificationSettings,
  syncNotificationConfigToServer,
  triggerImmediateDispatch,
  fetchServerNotificationStatus,
  calculateClientExamSyllabusStats,
  DEFAULT_NOTIFICATION_SETTINGS,
  DispatchLog,
  sendInstantCallMeBotWhatsApp,
  sendInstantTelegramMessage,
  sendConnectedGmailNotification,
  fetchDailyMicroQuiz,
  simulateBotCommand,
  registerTelegramWebhook,
  testFreeEmailGateway,
  testFreeCallMeBot
} from '../lib/notificationService';
import { 
  sendNativePushNotification, 
  requestPushPermission, 
  playNotificationChime,
  registerAutonomousPushSubscription,
  triggerServerAutonomousPushTest
} from '../lib/pushNotificationManager';
import { 
  syncStudyPlansToGoogleCalendar, 
  detectCalendarReschedules, 
  applyCalendarReschedules, 
  CalendarRescheduleItem 
} from '../lib/googleCalendarService';

interface ExamAutomationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  revisionItems: RevisionItem[];
  userProfile: UserProfile | null;
  examDates: ExamDate[];
  plans?: StudyPlan[];
  testResults?: TestResult[];
  assignments?: Assignment[];
  onUpdateExamDates: (updated: ExamDate[]) => void;
  onUpdateProfile?: (updated: Partial<UserProfile>) => void;
  onApplyCalendarReschedules?: (updatedPlans: StudyPlan[]) => void;
}

export const ExamAutomationCenterModal: React.FC<ExamAutomationCenterModalProps> = ({
  isOpen,
  onClose,
  subjects,
  revisionItems,
  userProfile,
  examDates,
  plans = [],
  testResults = [],
  assignments = [],
  onUpdateExamDates,
  onUpdateProfile,
  onApplyCalendarReschedules
}) => {
  const [settings, setSettings] = useState<ExamNotificationSettings>(() => {
    const local = loadLocalNotificationSettings();
    if (userProfile?.email && !local.email) {
      local.email = userProfile.email;
    }
    return local;
  });

  const [activeTab, setActiveTab] = useState<'exams' | 'email_scheduler' | 'mobile_whatsapp' | 'history'>('exams');
  const [serverOnline, setServerOnline] = useState(false);
  const [recentLogs, setRecentLogs] = useState<DispatchLog[]>([]);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResultMsg, setTestResultMsg] = useState<{ type: 'success' | 'error'; text: string; previewHtml?: string } | null>(null);
  const [pushStatus, setPushStatus] = useState<NotificationPermission | 'unsupported'>('default');
  const [previewModalHtml, setPreviewModalHtml] = useState<string | null>(null);

  // New Exam Form State
  const [newExamSubject, setNewExamSubject] = useState(subjects[0]?.name || 'All Subjects');
  const [newExamName, setNewExamName] = useState('');
  const [newExamDate, setNewExamDate] = useState('');
  const [isAddingExam, setIsAddingExam] = useState(false);

  // Google Calendar direct sync state
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [calendarSyncMsg, setCalendarSyncMsg] = useState<string | null>(null);

  // Micro-Quiz state
  const [microQuiz, setMicroQuiz] = useState<any | null>(null);
  const [quizSelectedOption, setQuizSelectedOption] = useState<number | null>(null);
  const [quizShowAnswer, setQuizShowAnswer] = useState<boolean>(false);

  // Telegram & Bot Simulator state
  const [botSimInput, setBotSimInput] = useState('/today');
  const [botSimOutput, setBotSimOutput] = useState<string | null>(null);
  const [isSimulatingBot, setIsSimulatingBot] = useState(false);
  const [webhookUrlInput, setWebhookUrlInput] = useState('');
  const [isSettingWebhook, setIsSettingWebhook] = useState(false);
  const [webhookStatusMsg, setWebhookStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Two-way Google Calendar reschedules
  const [detectedReschedules, setDetectedReschedules] = useState<CalendarRescheduleItem[]>([]);
  const [isDetectingReschedules, setIsDetectingReschedules] = useState(false);
  const [calendarRescheduleMsg, setCalendarRescheduleMsg] = useState<string | null>(null);

  // Load server status & push state on open
  useEffect(() => {
    if (!isOpen) return;

    if ('Notification' in window) {
      setPushStatus(Notification.permission);
    } else {
      setPushStatus('unsupported');
    }

    fetchServerNotificationStatus(settings.email).then(status => {
      if (status && status.success) {
        setServerOnline(true);
        if (status.recentDispatches) {
          setRecentLogs(status.recentDispatches);
        }
      } else {
        setServerOnline(false);
      }
    });

    fetchDailyMicroQuiz(settings.email).then(q => {
      if (q) setMicroQuiz(q);
    });
  }, [isOpen, settings.email]);

  const handleRunBotSimulation = async (cmd?: string) => {
    const commandToRun = cmd || botSimInput;
    setIsSimulatingBot(true);
    setBotSimOutput(null);
    try {
      const res = await simulateBotCommand(commandToRun, settings.email);
      setBotSimOutput(res.replyText);
    } catch (e: any) {
      setBotSimOutput(`⚠️ Error: ${e.message}`);
    } finally {
      setIsSimulatingBot(false);
    }
  };

  const handleRegisterTelegramWebhook = async () => {
    if (!settings.telegramBotToken) {
      setWebhookStatusMsg({ type: 'error', text: 'Please enter your Telegram Bot Token first.' });
      return;
    }
    if (!webhookUrlInput.trim()) {
      setWebhookStatusMsg({ type: 'error', text: 'Please enter your public HTTPS webhook URL (e.g. from ngrok or reverse proxy).' });
      return;
    }
    setIsSettingWebhook(true);
    setWebhookStatusMsg(null);
    try {
      const res = await registerTelegramWebhook(settings.telegramBotToken, webhookUrlInput.trim());
      if (res.success) {
        setWebhookStatusMsg({ type: 'success', text: 'Telegram Webhook registered successfully! Two-way interactive bot is now active.' });
      } else {
        setWebhookStatusMsg({ type: 'error', text: `Failed to set webhook: ${res.error || res.result?.description || 'Unknown error'}` });
      }
    } catch (err: any) {
      setWebhookStatusMsg({ type: 'error', text: err.message });
    } finally {
      setIsSettingWebhook(false);
    }
  };

  const handleDetectReschedules = async () => {
    setIsDetectingReschedules(true);
    setCalendarRescheduleMsg(null);
    try {
      const detected = await detectCalendarReschedules(plans);
      setDetectedReschedules(detected);
      if (detected.length > 0) {
        setCalendarRescheduleMsg(`Detected ${detected.length} rescheduled session(s) on Google Calendar!`);
      } else {
        setCalendarRescheduleMsg('Your StudyFlow plans and Google Calendar are completely in sync.');
      }
    } catch (err: any) {
      setCalendarRescheduleMsg(`Detection error: ${err.message}`);
    } finally {
      setIsDetectingReschedules(false);
    }
  };

  const handleApplyReschedules = () => {
    if (detectedReschedules.length === 0) return;
    const updated = applyCalendarReschedules(plans, detectedReschedules);
    if (onApplyCalendarReschedules) {
      onApplyCalendarReschedules(updated);
    }
    setCalendarRescheduleMsg(`Applied ${detectedReschedules.length} rescheduled study block(s) to StudyFlow!`);
    setDetectedReschedules([]);
  };

  const handleTestInteractivePush = () => {
    const firstExam = examDates[0];
    const daysLeft = firstExam ? Math.ceil((new Date(firstExam.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 14;
    const firstTopic = revisionItems.find(r => r.status !== 'Completed')?.topicName || subjects[0]?.chapters[0]?.topics[0]?.name || 'Active Recall Focus';

    sendNativePushNotification({
      title: `⚡ Study Sprint: ${firstTopic}`,
      body: `${firstExam ? `Target: ${firstExam.examName} (${daysLeft}d left).` : ''} Tap an action below to begin:`,
      playSound: settings.pushSoundEnabled !== false,
      actions: [
        { action: 'start-timer', title: '🚀 Start 25m Timer' },
        { action: 'mark-done', title: '✅ Mark Done' }
      ],
      data: { subject: subjects[0]?.name, topic: firstTopic }
    });
    setTestResultMsg({
      type: 'success',
      text: 'Interactive push notification dispatched! Check your notification tray for the [Start 25m Timer] and [Mark Done] action buttons.'
    });
  };

  if (!isOpen) return null;

  const handleSaveSettings = async (newSettings: ExamNotificationSettings) => {
    setSettings(newSettings);
    await syncNotificationConfigToServer(newSettings, examDates, subjects, revisionItems);
    if (onUpdateProfile && newSettings.email !== userProfile?.email) {
      onUpdateProfile({ email: newSettings.email });
    }
  };

  const handleAddExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExamName.trim() || !newExamDate) return;

    const newExam: ExamDate = {
      id: `exam-${Date.now()}`,
      subjectName: newExamSubject || 'All Subjects',
      examName: newExamName.trim(),
      date: newExamDate
    };

    const updated = [...examDates, newExam];
    onUpdateExamDates(updated);
    setIsAddingExam(false);
    setNewExamName('');
    setNewExamDate('');

    await syncNotificationConfigToServer(settings, updated, subjects, revisionItems);
  };

  const handleDeleteExam = async (id: string) => {
    const updated = examDates.filter(e => e.id !== id);
    onUpdateExamDates(updated);
    await syncNotificationConfigToServer(settings, updated, subjects, revisionItems);
  };

  // 1. Google Calendar 1-Click Sync Handler
  const handleSyncGoogleCalendar = async () => {
    setIsSyncingCalendar(true);
    setCalendarSyncMsg(null);
    try {
      const res = await syncStudyPlansToGoogleCalendar({
        plans,
        examDates,
        revisions: revisionItems.filter(r => r.status !== 'Completed'),
        testResults,
        assignments
      });

      if (res.success) {
        setCalendarSyncMsg(`Synced ${res.createdCount} events (Exams, Mock Tests, Revisions & Plans) to your Google Calendar!`);
      } else {
        setCalendarSyncMsg(`Sync finished (${res.createdCount} events). Note: ${res.errors[0] || 'Check calendar for updates.'}`);
      }
    } catch (err: any) {
      setCalendarSyncMsg(`Calendar sync error: ${err.message}`);
    } finally {
      setIsSyncingCalendar(false);
      setTimeout(() => setCalendarSyncMsg(null), 8000);
    }
  };

  // 2. Email Option A: Direct Connected Gmail
  const handleSendConnectedGmailTest = async () => {
    setIsSendingTest(true);
    setTestResultMsg(null);
    try {
      const res = await sendConnectedGmailNotification({
        toEmail: settings.email || 'atharkhanteambuster@gmail.com',
        studentName: userProfile?.displayName || 'Student',
        examDates,
        subjects,
        revisionItems
      });

      setIsSendingTest(false);
      if (res.success) {
        setTestResultMsg({ type: 'success', text: res.message });
      } else {
        setTestResultMsg({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setIsSendingTest(false);
      setTestResultMsg({ type: 'error', text: err.message || 'Gmail dispatch error' });
    }
  };

  // 3. Email Option B: 24/7 Automated Server Scheduler
  const handleSendServerSchedulerTest = async () => {
    setIsSendingTest(true);
    setTestResultMsg(null);

    const res = await triggerImmediateDispatch(
      settings.email || DEFAULT_NOTIFICATION_SETTINGS.email,
      examDates,
      subjects,
      revisionItems
    );

    setIsSendingTest(false);
    if (res.success) {
      setTestResultMsg({
        type: 'success',
        text: res.message || 'Exam countdown & syllabus digest sent via 24/7 server worker!',
        previewHtml: res.logEntry?.previewHtml
      });
      if (res.logEntry) {
        setRecentLogs(prev => [res.logEntry!, ...prev.slice(0, 9)]);
      }
    } else {
      setTestResultMsg({
        type: 'error',
        text: res.message || 'Failed to dispatch test digest.'
      });
    }
  };

  // 4. Native Push Permission & Test
  const handleEnablePush = async () => {
    const perm = await requestPushPermission();
    setPushStatus(perm);
    if (perm === 'granted') {
      const updated = { ...settings, pushEnabled: true };
      handleSaveSettings(updated);
      sendNativePushNotification({
        title: '🔔 StudyFlow Push Alerts Active',
        body: 'Native notifications and exam countdown chimes are now enabled on your device.',
        playSound: settings.pushSoundEnabled !== false
      });
      // Register with 24/7 background VAPID push scheduler
      registerAutonomousPushSubscription(userProfile?.email).then(res => {
        if (res.success) {
          setTestResultMsg({ type: 'success', text: '✅ 24/7 Background VAPID Push registered with server!' });
        }
      }).catch(console.warn);
    }
  };

  const handleTestAutonomousServerPush = async () => {
    // Ensure registered first
    await registerAutonomousPushSubscription(userProfile?.email);
    const res = await triggerServerAutonomousPushTest();
    if (res.success) {
      setTestResultMsg({ type: 'success', text: '🚀 Autonomous Server Push Dispatched! Look for system notification.' });
    } else {
      setTestResultMsg({ type: 'error', text: res.message || 'Server push failed' });
    }
  };

  const handleTestPushWithChime = () => {
    const firstExam = examDates[0];
    const daysLeft = firstExam ? Math.ceil((new Date(firstExam.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 14;
    const bodyText = firstExam 
      ? `Upcoming: ${firstExam.examName} in ${daysLeft} days! You have ${revisionItems.length} revision sets queued.`
      : 'Native app push notification with academic audio chime is operating flawlessly!';

    const sent = sendNativePushNotification({
      title: '🎯 Academic Flight Alert',
      body: bodyText,
      playSound: settings.pushSoundEnabled !== false
    });

    if (!sent && pushStatus !== 'granted') {
      handleEnablePush();
    }
  };

  // 5. Free CallMeBot WhatsApp Instant Test (No Twilio)
  const handleTestCallMeBotWhatsApp = async () => {
    if (!settings.whatsappNumber) {
      setTestResultMsg({ type: 'error', text: 'Please enter your WhatsApp mobile number with country code.' });
      return;
    }
    if (!settings.whatsappCallMeBotApiKey) {
      setTestResultMsg({
        type: 'error',
        text: 'Please enter your free CallMeBot API key. Send "I allow callmebot to send me messages" to +34 644 10 55 84 on WhatsApp to get your instant free key!'
      });
      return;
    }

    setIsSendingTest(true);
    setTestResultMsg(null);

    const firstExam = examDates[0];
    const daysLeft = firstExam ? Math.ceil((new Date(firstExam.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 14;
    const msg = `🔔 StudyFlow Alert: ${firstExam ? `${firstExam.examName} is in ${daysLeft} days!` : 'Your automated study reminder is active.'} Keep going!`;

    const res = await sendInstantCallMeBotWhatsApp({
      phone: settings.whatsappNumber,
      apiKey: settings.whatsappCallMeBotApiKey,
      message: msg
    });

    setIsSendingTest(false);
    if (res.success) {
      setTestResultMsg({ type: 'success', text: res.message });
    } else {
      setTestResultMsg({ type: 'error', text: res.message });
    }
  };

  // 6. Free Telegram Bot Instant Test
  const handleTestTelegram = async () => {
    if (!settings.telegramChatId || !settings.telegramBotToken) {
      setTestResultMsg({ type: 'error', text: 'Please enter your Telegram Chat ID and Bot Token.' });
      return;
    }

    setIsSendingTest(true);
    setTestResultMsg(null);

    const firstExam = examDates[0];
    const daysLeft = firstExam ? Math.ceil((new Date(firstExam.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 14;
    const msg = `🔔 <b>StudyFlow Exam Alert</b>\n\n${firstExam ? `🎯 <b>${firstExam.examName}</b>: ${daysLeft} days remaining.` : 'Your automated academic notification is working!'}\n\nSpaced revisions queued: ${revisionItems.length}`;

    const res = await sendInstantTelegramMessage({
      chatId: settings.telegramChatId,
      botToken: settings.telegramBotToken,
      message: msg
    });

    setIsSendingTest(false);
    if (res.success) {
      setTestResultMsg({ type: 'success', text: res.message });
    } else {
      setTestResultMsg({ type: 'error', text: res.message });
    }
  };

  // 7. Free Personal Gmail SMTP Test (100% Free, Up to 500 emails/day, Zero Paid Services)
  const handleTestFreeGmailSmtp = async () => {
    const gmailUser = settings.gmailUser || settings.email;
    if (!gmailUser || !settings.gmailAppPassword) {
      setTestResultMsg({
        type: 'error',
        text: 'Please enter your Gmail address and 16-character Google App Password.'
      });
      return;
    }

    setIsSendingTest(true);
    setTestResultMsg(null);

    const res = await testFreeEmailGateway(
      gmailUser,
      settings.gmailAppPassword,
      settings.email || gmailUser
    );

    setIsSendingTest(false);
    if (res.success) {
      setTestResultMsg({
        type: 'success',
        text: res.message || 'Free Gmail SMTP connection verified! Test email delivered to your inbox.'
      });
    } else {
      setTestResultMsg({
        type: 'error',
        text: res.message || 'Failed to authenticate with Gmail SMTP. Check your 16-character App Password.'
      });
    }
  };

  // 8. 1-Click WhatsApp Direct Flight Plan (Zero Setup Required, 100% Free)
  const handleOpenWhatsAppFlightPlan = () => {
    const firstExam = examDates[0];
    const daysLeft = firstExam ? Math.ceil((new Date(firstExam.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 14;
    const dueRevisions = revisionItems.filter(r => r.status !== 'Completed').slice(0, 3);
    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    let msg = `🌅 *STUDYFLOW MORNING FLIGHT PLAN* (${dateStr})\n\n`;
    if (firstExam) {
      msg += `🎯 *Target Exam:* ${firstExam.examName} (${firstExam.subjectName})\n⏳ *Countdown:* ${daysLeft} Days Remaining\n`;
    }
    msg += `🔥 *Study Streak:* Active & Protected\n\n`;
    msg += `⚡ *High-Yield Active Recall Queue:*\n`;
    if (dueRevisions.length > 0) {
      dueRevisions.forEach((rev, i) => {
        msg += `${i + 1}. *${rev.topicName}* (${rev.subjectName}) - Priority: ${rev.priority || 'High'}\n`;
      });
    } else {
      msg += `• All scheduled revisions up-to-date! Stellar progress.\n`;
    }
    msg += `\n🚀 Generated by StudyFlow Autonomous Academic Planner (100% Free)`;

    const rawPhone = settings.whatsappNumber || '';
    const phone = rawPhone.replace(/[^0-9]/g, '');
    const url = phone 
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` 
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        id="exam-automation-center-modal"
        className="bg-card border border-theme rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-primary"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-theme flex items-center justify-between bg-surface">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Automated Exam Countdown & Syllabus Digest</h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  Zero Paid Subscriptions
                </span>
              </div>
              <p className="text-xs text-muted">
                Free Autonomous WhatsApp (CallMeBot), Telegram, Native App Push, Email & Google Calendar Sync.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-muted hover:text-primary rounded-lg hover:bg-theme-accent transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 border-b border-theme bg-surface/50 text-xs font-semibold overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('exams')}
            className={`py-3 px-3 border-b-2 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'exams'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted hover:text-primary'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Target Exams & Calendar Sync ({examDates.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('mobile_whatsapp')}
            className={`py-3 px-3 border-b-2 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'mobile_whatsapp'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted hover:text-primary'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Native App Push & Free WhatsApp</span>
          </button>

          <button
            onClick={() => setActiveTab('email_scheduler')}
            className={`py-3 px-3 border-b-2 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'email_scheduler'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted hover:text-primary'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Free Email Dispatcher (Gmail & SMTP)</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 px-3 border-b-2 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted hover:text-primary'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>Delivery Logs ({recentLogs.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* TAB 1: TARGET EXAMS & SYLLABUS BREAKDOWN + 1-CLICK CALENDAR SYNC */}
          {activeTab === 'exams' && (
            <div className="space-y-5">
              {/* Google Calendar Sync & 2-Way Reschedule Card */}
              <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 font-bold text-sm text-primary">
                      <CalendarDays className="w-4 h-4" />
                      <span>Google Calendar Transfer & 2-Way Reschedule Sync</span>
                    </div>
                    <p className="text-xs text-muted">
                      Transfer all exams ({examDates.length}), mock tests ({testResults.length}), study plans ({plans.length}), and spaced revisions ({revisionItems.length}) directly to your Google Calendar.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handleDetectReschedules}
                      disabled={isDetectingReschedules}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-primary/30 bg-surface text-primary text-xs font-bold hover:bg-primary/10 transition disabled:opacity-50 cursor-pointer shadow-xs"
                    >
                      {isDetectingReschedules ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>Detect Calendar Changes</span>
                    </button>
                    <button
                      onClick={handleSyncGoogleCalendar}
                      disabled={isSyncingCalendar}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition disabled:opacity-50 cursor-pointer shrink-0 shadow-xs"
                    >
                      {isSyncingCalendar ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Syncing Calendar...</span>
                        </>
                      ) : (
                        <>
                          <CalendarDays className="w-3.5 h-3.5" />
                          <span>Sync All to Google Calendar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Auto-Generate Google Meet Links Toggle */}
                <div className="pt-2 border-t border-primary/10 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-primary">
                    <Video className="w-4 h-4 text-primary" />
                    <span>Auto-generate Google Meet video links for synced study blocks</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.autoGenerateMeetLinks ?? true}
                      onChange={e => handleSaveSettings({ ...settings, autoGenerateMeetLinks: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-theme-accent peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* Detected Reschedules Alert Banner */}
                {detectedReschedules.length > 0 && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>{detectedReschedules.length} Session(s) Rescheduled in Google Calendar</span>
                      </div>
                      <button
                        onClick={handleApplyReschedules}
                        className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                      >
                        Accept & Apply to StudyFlow
                      </button>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                      {detectedReschedules.map(r => (
                        <div key={r.planId} className="flex items-center justify-between text-[11px] text-muted bg-surface/60 p-1.5 rounded-lg border border-theme">
                          <span className="font-semibold text-primary">{r.topicName}</span>
                          <span className="font-mono text-[10px]">
                            {r.oldDate} ({r.oldTime}) → <strong className="text-amber-600 dark:text-amber-400">{r.newDate} ({r.newTime})</strong>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {calendarSyncMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{calendarSyncMsg}</span>
                </div>
              )}

              {/* Target Exams Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-xl border border-theme">
                <div>
                  <h3 className="text-sm font-bold">Exam Target List</h3>
                  <p className="text-xs text-muted">
                    Days remaining and syllabus completion are calculated automatically for your alerts.
                  </p>
                </div>
                <button
                  onClick={() => setIsAddingExam(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition cursor-pointer self-start sm:self-auto shrink-0 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Target Exam</span>
                </button>
              </div>

              {/* Add Exam Form */}
              {isAddingExam && (
                <form onSubmit={handleAddExam} className="p-4 rounded-xl border border-theme bg-surface space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-theme">
                    <h4 className="text-xs font-bold">Add Scheduled Exam Target</h4>
                    <button 
                      type="button" 
                      onClick={() => setIsAddingExam(false)}
                      className="text-muted hover:text-primary text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-muted block mb-1">Subject</label>
                      <select
                        value={newExamSubject}
                        onChange={e => setNewExamSubject(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-card border border-theme text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="All Subjects">All Subjects (Comprehensive)</option>
                        {subjects.map(s => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-muted block mb-1">Exam Name / Title</label>
                      <input
                        type="text"
                        placeholder="e.g. Final Board Exam 2026"
                        value={newExamName}
                        onChange={e => setNewExamName(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-lg bg-card border border-theme text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-muted block mb-1">Exam Date</label>
                      <input
                        type="date"
                        value={newExamDate}
                        onChange={e => setNewExamDate(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-lg bg-card border border-theme text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90 transition cursor-pointer"
                    >
                      Save Exam Target
                    </button>
                  </div>
                </form>
              )}

              {/* Exam Cards */}
              <div className="space-y-3">
                {examDates.length === 0 ? (
                  <div className="text-center py-10 bg-surface rounded-xl border border-dashed border-theme">
                    <Calendar className="w-8 h-8 mx-auto text-muted mb-2 opacity-50" />
                    <p className="text-sm font-semibold">No Target Exams Added Yet</p>
                    <p className="text-xs text-muted mt-1 max-w-md mx-auto">
                      Add your upcoming exam date above to automatically track days left and syllabus completion in daily notifications.
                    </p>
                  </div>
                ) : (
                  examDates.map(exam => {
                    const stats = calculateClientExamSyllabusStats(exam, subjects, revisionItems);
                    const isUrgent = stats.daysLeft <= 14 && stats.daysLeft >= 0;

                    return (
                      <div 
                        key={exam.id}
                        className="p-4 rounded-xl bg-card border border-theme shadow-2xs hover:border-primary/40 transition space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted px-2 py-0.5 rounded bg-theme-accent">
                              {exam.subjectName}
                            </span>
                            <h4 className="text-base font-bold text-primary mt-1">{exam.examName}</h4>
                            <div className="text-xs text-muted flex items-center gap-2 mt-0.5">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>Target Date: {exam.date}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 ${
                              stats.daysLeft < 0
                                ? 'bg-muted/20 text-muted'
                                : stats.daysLeft === 0
                                ? 'bg-rose-500 text-white font-extrabold animate-pulse'
                                : isUrgent
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                : 'bg-primary/10 text-primary border border-primary/20'
                            }`}>
                              <Zap className="w-3.5 h-3.5" />
                              <span>
                                {stats.daysLeft > 0 
                                  ? `${stats.daysLeft} Days Left` 
                                  : stats.daysLeft === 0 
                                  ? 'EXAM TODAY!' 
                                  : 'Exam Passed'}
                              </span>
                            </div>

                            <button
                              onClick={() => handleDeleteExam(exam.id)}
                              className="p-1.5 text-muted hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                              title="Delete Exam"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Progress Bar and Status */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-primary">Syllabus Covered: <strong>{stats.completionPct}%</strong></span>
                            <span className="text-rose-600 dark:text-rose-400">Remaining to Study: <strong>{stats.remainingPct}%</strong></span>
                          </div>
                          <div className="w-full h-2.5 rounded-full bg-theme-accent overflow-hidden flex">
                            <div 
                              style={{ width: `${stats.completionPct}%` }} 
                              className="bg-emerald-500 h-full rounded-l-full transition-all duration-500" 
                              title={`${stats.completionPct}% Completed`}
                            />
                            <div 
                              style={{ width: `${Math.min(100 - stats.completionPct, Math.round((stats.inProgressTopics / Math.max(stats.totalTopics, 1)) * 100))}%` }} 
                              className="bg-amber-500 h-full transition-all duration-500" 
                              title="In Progress"
                            />
                          </div>
                          <div className="flex justify-between text-[11px] text-muted pt-0.5">
                            <span>{stats.completedTopics} Completed</span>
                            <span>{stats.inProgressTopics} In Progress</span>
                            <span>{stats.untouchedTopics} Untouched ({stats.totalTopics} Total)</span>
                          </div>
                        </div>

                        {/* Revision Queue Info */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-theme/60 text-xs">
                          <div className="flex items-center gap-1.5 text-muted">
                            <Layers className="w-3.5 h-3.5 text-primary" />
                            <span>
                              Active Revision: <strong>{stats.revisionStats.completed}</strong> Completed • <strong className="text-amber-600 dark:text-amber-400">{stats.revisionStats.dueTodayOrOverdue} Due Today</strong>
                            </span>
                          </div>
                          {stats.weakTopics.length > 0 && (
                            <span className="text-[11px] text-muted">
                              Priority: {stats.weakTopics[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: NATIVE APP PUSH & FREE INSTANT MESSAGING (NO TWILIO) */}
          {activeTab === 'mobile_whatsapp' && (
            <div className="space-y-6">

              {/* 1. NATIVE APP PUSH NOTIFICATIONS */}
              <div className="bg-surface p-5 rounded-xl border border-theme space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold">Native App & Browser Push Notifications</h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          100% Free • No API Keys
                        </span>
                      </div>
                      <p className="text-xs text-muted">
                        Direct phone and browser push alerts with synthesized study chime audio. Runs natively in the background.
                      </p>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full self-start sm:self-auto ${
                    pushStatus === 'granted'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                      : pushStatus === 'denied'
                      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                  }`}>
                    {pushStatus === 'granted' ? 'Device Enabled' : pushStatus === 'denied' ? 'Permission Blocked' : 'Action Required'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3 bg-card rounded-xl border border-theme flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold block">Audio Chime on Alert</span>
                      <span className="text-[11px] text-muted">Play gentle academic synthesized chime</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.pushSoundEnabled !== false}
                        onChange={e => {
                          const updated = { ...settings, pushSoundEnabled: e.target.checked };
                          handleSaveSettings(updated);
                          if (e.target.checked) playNotificationChime();
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-theme-accent peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  <div className="p-3 bg-card rounded-xl border border-theme flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold block">Background Monitoring</span>
                      <span className="text-[11px] text-muted">Auto-check countdown & due revisions</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.pushEnabled !== false}
                        onChange={e => handleSaveSettings({ ...settings, pushEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-theme-accent peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {pushStatus !== 'granted' ? (
                    <button
                      onClick={handleEnablePush}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition cursor-pointer shadow-xs"
                    >
                      <Bell className="w-4 h-4" />
                      <span>Request Device Notification Permission</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleTestPushWithChime}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition cursor-pointer shadow-xs"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>Trigger Instant Native App Notification & Chime</span>
                    </button>
                  )}
                  <button
                    onClick={handleTestInteractivePush}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-primary/40 bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Test Action Buttons ([Start Timer] & [Mark Done])</span>
                  </button>
                  <button
                    onClick={handleTestAutonomousServerPush}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-300 text-xs font-bold hover:bg-amber-500/25 transition cursor-pointer"
                    title="Triggers server-side VAPID background dispatch to test autonomous notification even when window is closed"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Test Autonomous Server Push (VAPID 24/7)</span>
                  </button>
                  <button
                    onClick={() => playNotificationChime()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-theme text-xs font-semibold hover:bg-card transition cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-muted" />
                    <span>Test Audio Sound Only</span>
                  </button>
                </div>
              </div>

              {/* 2. FREE AUTOMATED WHATSAPP (CALLMEBOT - NO PAID TWILIO) */}
              <div className="bg-surface p-5 rounded-xl border border-theme space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#25D366]/20 text-[#25D366] flex items-center justify-center font-bold text-lg">
                      W
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold">Instant Autonomous WhatsApp (CallMeBot)</h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          100% Free • No Twilio
                        </span>
                      </div>
                      <p className="text-xs text-muted">
                        Delivers messages directly to your WhatsApp autonomously without requiring you to open click-to-chat links.
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.whatsappEnabled}
                      onChange={e => handleSaveSettings({ ...settings, whatsappEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-theme-accent peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#25D366]"></div>
                  </label>
                </div>

                {/* Easy 1-Step Setup Guide Banner */}
                <div className="p-3.5 bg-[#25D366]/10 border border-[#25D366]/30 rounded-xl text-xs space-y-2">
                  <div className="font-bold text-[#1E7E34] dark:text-[#25D366] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>How to get your Free WhatsApp API Key in 10 seconds (100% Free, No Credit Card):</span>
                  </div>
                  <p className="text-[#2B3A2C] dark:text-[#A7D7A9] text-[11px] leading-relaxed">
                    1. Click either of the free CallMeBot links below to open WhatsApp.<br />
                    2. Send the pre-filled message: <strong className="font-mono bg-white/70 dark:bg-black/40 px-1 py-0.5 rounded">I allow callmebot to send me messages</strong><br />
                    3. CallMeBot will instantly reply with your free personal API key (e.g. 1234567). Paste it below and click test!
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <a 
                      href="https://wa.me/34644766643?text=I%20allow%20callmebot%20to%20send%20me%20messages" 
                      target="_blank" 
                      rel="noreferrer" 
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[11px] font-bold text-[#1E7E34] dark:text-[#25D366] transition"
                    >
                      <span>1. Connect via Server A (+34 644 76 66 43)</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a 
                      href="https://wa.me/34644442619?text=I%20allow%20callmebot%20to%20send%20me%20messages" 
                      target="_blank" 
                      rel="noreferrer" 
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[11px] font-bold text-[#1E7E34] dark:text-[#25D366] transition"
                    >
                      <span>2. Connect via Server B (+34 644 44 26 19)</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-xs font-semibold text-primary block mb-1">
                      Your WhatsApp Mobile Number (with Country Code)
                    </label>
                    <input
                      type="tel"
                      value={settings.whatsappNumber || ''}
                      onChange={e => setSettings({ ...settings, whatsappNumber: e.target.value })}
                      onBlur={() => handleSaveSettings(settings)}
                      placeholder="+1234567890 or +919876543210"
                      className="w-full px-3 py-2 rounded-xl bg-card border border-theme text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-primary block mb-1">
                      Free CallMeBot API Key
                    </label>
                    <input
                      type="text"
                      value={settings.whatsappCallMeBotApiKey || ''}
                      onChange={e => setSettings({ ...settings, whatsappCallMeBotApiKey: e.target.value })}
                      onBlur={() => handleSaveSettings(settings)}
                      placeholder="e.g. 8472910"
                      className="w-full px-3 py-2 rounded-xl bg-card border border-theme text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <button
                    onClick={handleTestCallMeBotWhatsApp}
                    disabled={isSendingTest}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] text-white text-xs font-bold hover:opacity-90 transition disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSendingTest ? 'Dispatching...' : 'Send Autonomous WhatsApp Alert (Test)'}</span>
                  </button>

                  <button
                    onClick={handleOpenWhatsAppFlightPlan}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#25D366]/40 bg-[#25D366]/10 text-[#1E7E34] dark:text-[#25D366] text-xs font-bold hover:bg-[#25D366]/20 transition cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Open Today's Flight Plan in WhatsApp (Zero Setup Required)</span>
                  </button>
                </div>
              </div>

              {/* 3. FREE TELEGRAM BOT (100% FREE ALTERNATIVE) */}
              <div className="bg-surface p-5 rounded-xl border border-theme space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#0088cc]/20 text-[#0088cc] flex items-center justify-center font-bold">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold">Instant Telegram Bot Notifications</h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-600 border border-sky-500/20">
                          100% Free Official API
                        </span>
                      </div>
                      <p className="text-xs text-muted">
                        Receive instant alerts on your phone or desktop via your private Telegram Bot.
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.telegramEnabled}
                      onChange={e => handleSaveSettings({ ...settings, telegramEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-theme-accent peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0088cc]"></div>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-xs font-semibold text-primary block mb-1">
                      Telegram Chat ID
                    </label>
                    <input
                      type="text"
                      value={settings.telegramChatId || ''}
                      onChange={e => setSettings({ ...settings, telegramChatId: e.target.value })}
                      onBlur={() => handleSaveSettings(settings)}
                      placeholder="e.g. 123456789 (get from @userinfobot)"
                      className="w-full px-3 py-2 rounded-xl bg-card border border-theme text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-primary block mb-1">
                      Telegram Bot Token
                    </label>
                    <input
                      type="password"
                      value={settings.telegramBotToken || ''}
                      onChange={e => setSettings({ ...settings, telegramBotToken: e.target.value })}
                      onBlur={() => handleSaveSettings(settings)}
                      placeholder="e.g. 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                      className="w-full px-3 py-2 rounded-xl bg-card border border-theme text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleTestTelegram}
                    disabled={isSendingTest}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0088cc] text-white text-xs font-bold hover:opacity-90 transition disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Instant Telegram Alert</span>
                  </button>
                </div>

                {/* 2-Way Telegram Webhook Setup Section */}
                <div className="p-3.5 bg-sky-500/5 border border-sky-500/20 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-sky-700 dark:text-sky-300">
                      <Radio className="w-4 h-4 text-sky-500" />
                      <span>Telegram Webhook Setup (Autonomous Two-Way Replies)</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted">
                    Point your Telegram Bot to your live server endpoint: <code>/api/notifications/telegram-webhook</code>. If developing locally, enter your ngrok or reverse proxy URL.
                  </p>
                  <div className="flex items-center gap-2 flex-col sm:flex-row">
                    <input
                      type="url"
                      placeholder="https://your-domain.com/api/notifications/telegram-webhook"
                      value={webhookUrlInput}
                      onChange={e => setWebhookUrlInput(e.target.value)}
                      className="flex-1 w-full px-3 py-2 rounded-lg bg-card border border-theme text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      onClick={handleRegisterTelegramWebhook}
                      disabled={isSettingWebhook}
                      className="w-full sm:w-auto px-4 py-2 rounded-lg bg-[#0088cc] text-white text-xs font-bold hover:opacity-90 transition disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {isSettingWebhook ? 'Registering...' : 'Register Webhook'}
                    </button>
                  </div>
                  {webhookStatusMsg && (
                    <div className={`p-2 rounded-lg text-xs font-semibold ${
                      webhookStatusMsg.type === 'success'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                    }`}>
                      {webhookStatusMsg.text}
                    </div>
                  )}
                </div>

                {/* Interactive Two-Way Bot Simulator (Zero external setup needed!) */}
                <div className="p-3.5 bg-card border border-theme rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-primary">
                      <Bot className="w-4 h-4 text-sky-500" />
                      <span>Interactive Bot Command Simulator (Test Instantly)</span>
                    </div>
                    <span className="text-[10px] text-muted font-mono">Simulates Telegram /today, /done, /streak, /quiz</span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {['/today', '/done Study Session', '/streak', '/quiz'].map(cmd => (
                      <button
                        key={cmd}
                        onClick={() => {
                          setBotSimInput(cmd);
                          handleRunBotSimulation(cmd);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-surface hover:bg-theme-accent border border-theme text-xs font-mono font-semibold transition cursor-pointer text-primary"
                      >
                        {cmd}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={botSimInput}
                      onChange={e => setBotSimInput(e.target.value)}
                      placeholder="Type command like /today or /done [topic]..."
                      className="flex-1 px-3 py-1.5 rounded-lg bg-surface border border-theme text-xs font-mono text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      onClick={() => handleRunBotSimulation()}
                      disabled={isSimulatingBot}
                      className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90 transition disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {isSimulatingBot ? 'Simulating...' : 'Execute'}
                    </button>
                  </div>

                  {botSimOutput && (
                    <div className="p-3 bg-neutral-900 text-neutral-100 rounded-lg text-xs font-mono leading-relaxed space-y-1 border border-neutral-800">
                      <div className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider flex items-center gap-1">
                        <Bot className="w-3 h-3 text-sky-400" />
                        <span>StudyFlow Bot Response</span>
                      </div>
                      <div 
                        dangerouslySetInnerHTML={{ __html: botSimOutput.replace(/\n/g, '<br />') }}
                        className="pt-1 text-[11px]"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 4. DAILY ACTIVE RECALL MICRO-QUIZ (SM-2 SPACED REPETITION) */}
              {microQuiz && (
                <div className="bg-surface p-5 rounded-xl border border-primary/30 space-y-3.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                        <Brain className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold">Daily Active Recall Micro-Quiz</h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 border border-purple-500/20">
                            SM-2 Retention
                          </span>
                        </div>
                        <p className="text-xs text-muted">
                          <strong>{microQuiz.subject}</strong>: {microQuiz.topic}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] text-muted font-mono">{microQuiz.date}</span>
                  </div>

                  <p className="text-xs font-semibold text-primary leading-relaxed bg-card p-3 rounded-lg border border-theme">
                    {microQuiz.question}
                  </p>

                  <div className="space-y-1.5">
                    {microQuiz.options.map((opt: string, idx: number) => {
                      const isSelected = quizSelectedOption === idx;
                      const isCorrect = opt === microQuiz.correctAnswer;
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            setQuizSelectedOption(idx);
                            setQuizShowAnswer(true);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs transition border cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? isCorrect
                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-bold'
                                : 'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300 font-bold'
                              : 'bg-card border-theme text-primary hover:bg-theme-accent'
                          }`}
                        >
                          <span>{String.fromCharCode(65 + idx)}. {opt}</span>
                          {quizShowAnswer && isCorrect && (
                            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {quizShowAnswer && (
                    <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg text-xs space-y-1 animate-in fade-in duration-150">
                      <div className="font-bold text-purple-700 dark:text-purple-300">
                        Answer: {microQuiz.correctAnswer}
                      </div>
                      <p className="text-[11px] text-muted leading-relaxed">
                        {microQuiz.explanation}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Status Message */}
              {testResultMsg && (
                <div className={`p-4 rounded-xl border text-xs flex items-start gap-2.5 animate-in fade-in duration-150 ${
                  testResultMsg.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
                }`}>
                  {testResultMsg.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  )}
                  <div className="flex-1 font-bold">{testResultMsg.text}</div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FREE EMAIL DISPATCHER (GMAIL & 24/7 SCHEDULER) */}
          {activeTab === 'email_scheduler' && (
            <div className="space-y-5">
              <div className="bg-surface p-4 rounded-xl border border-theme space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold">Email Digest Configuration</h3>
                    <p className="text-xs text-muted">
                      Configure your morning flight plan and exam countdown notifications.
                    </p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.emailEnabled}
                      onChange={e => handleSaveSettings({ ...settings, emailEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-theme-accent peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="text-xs font-semibold text-primary block mb-1">
                      Recipient Student Email Address
                    </label>
                    <input
                      type="email"
                      value={settings.email}
                      onChange={e => setSettings({ ...settings, email: e.target.value })}
                      onBlur={() => handleSaveSettings(settings)}
                      className="w-full px-3 py-2 rounded-xl bg-card border border-theme text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-primary block mb-1">
                      Preferred Daily Delivery Time
                    </label>
                    <input
                      type="time"
                      value={settings.dailyDigestTime}
                      onChange={e => {
                        const updated = { ...settings, dailyDigestTime: e.target.value };
                        handleSaveSettings(updated);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-card border border-theme text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Content Options */}
                <div className="space-y-2 pt-2 border-t border-theme">
                  <span className="text-xs font-semibold text-primary block">Digest Content Breakdown</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className="flex items-center gap-2 text-xs text-primary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.includeSyllabusCoverage}
                        onChange={e => handleSaveSettings({ ...settings, includeSyllabusCoverage: e.target.checked })}
                        className="rounded border-theme text-primary focus:ring-primary"
                      />
                      <span>Syllabus Coverage %</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-primary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.includeRevisionSets}
                        onChange={e => handleSaveSettings({ ...settings, includeRevisionSets: e.target.checked })}
                        className="rounded border-theme text-primary focus:ring-primary"
                      />
                      <span>Revision Sets Due</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-primary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.includeWeakSpots}
                        onChange={e => handleSaveSettings({ ...settings, includeWeakSpots: e.target.checked })}
                        className="rounded border-theme text-primary focus:ring-primary"
                      />
                      <span>High-Yield Weak Spots</span>
                    </label>
                  </div>
                </div>

                {/* Smart Cognitive Delivery Controls */}
                <div className="pt-3 border-t border-theme space-y-3">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-xs font-bold text-primary">Smart Cognitive Notification Engines</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Streak Saver Toggle */}
                    <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                          <Flame className="w-4 h-4 text-amber-500" />
                          <span>Evening Streak-Saver Nudge (8:30 PM)</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.streakSaverEnabled ?? true}
                            onChange={e => handleSaveSettings({ ...settings, streakSaverEnabled: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-theme-accent peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                      </div>
                      <p className="text-[11px] text-muted">
                        Automatically sends an emergency reminder at 20:30 if 0 study hours have been logged today, preserving your streak before midnight.
                      </p>
                    </div>

                    {/* SM-2 Alerts Toggle */}
                    <div className="p-3 bg-purple-500/5 border border-purple-500/20 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-300">
                          <Brain className="w-4 h-4 text-purple-500" />
                          <span>SM-2 Retention Hazard Alerts</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.sm2AlertsEnabled ?? true}
                            onChange={e => handleSaveSettings({ ...settings, sm2AlertsEnabled: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-theme-accent peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                      </div>
                      <p className="text-[11px] text-muted">
                        Dispatches proactive active recall alerts at 17:00 whenever topics drop below 70% recall on the Ebbinghaus forgetting curve.
                      </p>
                    </div>
                  </div>

                  {/* 48h Flight Check Badge */}
                  <div className="p-2.5 bg-blue-500/5 border border-blue-500/20 rounded-lg flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                      <Sparkles className="w-4 h-4 text-blue-500 shrink-0" />
                      <span><strong>T-Minus 48h Exam Flight Check:</strong> Automatically synthesizes high-yield traps & micro-quizzes 48h before any target exam.</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20 shrink-0">
                      Active
                    </span>
                  </div>
                </div>
              </div>

              {/* 100% Free Email Gateway Options */}
              <div className="bg-surface p-4 rounded-xl border border-theme space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold">100% Free Email Gateway (Personal Gmail SMTP)</h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          500 Emails/Day Free • No Paid Services
                        </span>
                      </div>
                      <p className="text-xs text-muted">
                        Connect your standard personal Google account with a 16-character Google App Password to enable 24/7 background automated email delivery without paying for SendGrid or Mailgun.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3-Step Setup Guide Banner */}
                <div className="p-3.5 bg-card border border-theme rounded-xl text-xs space-y-2">
                  <div className="font-bold text-primary flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>How to set up Free Gmail SMTP in 30 seconds (100% Free Forever):</span>
                  </div>
                  <ol className="text-muted text-[11px] space-y-1.5 list-decimal pl-4 leading-relaxed">
                    <li>
                      Ensure 2-Step Verification is turned ON in your Google Account.
                    </li>
                    <li>
                      Go to <strong className="text-primary">Google App Passwords</strong> and generate a 16-character code (name it <em>"StudyFlow"</em>).
                    </li>
                    <li>
                      Paste your Gmail address and the 16-character code below, then click <strong>"Verify & Send Test Email"</strong>.
                    </li>
                  </ol>
                  <div className="pt-1">
                    <a
                      href="https://myaccount.google.com/apppasswords"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition"
                    >
                      <span>Open Google App Passwords Portal</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-xs font-semibold text-primary block mb-1">
                      Your Gmail Address (Sender)
                    </label>
                    <input
                      type="email"
                      value={settings.gmailUser || settings.email || ''}
                      onChange={e => setSettings({ ...settings, gmailUser: e.target.value })}
                      onBlur={() => handleSaveSettings(settings)}
                      placeholder="e.g. atharkhanteambuster@gmail.com"
                      className="w-full px-3 py-2 rounded-xl bg-card border border-theme text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-primary block mb-1">
                      16-Character Google App Password
                    </label>
                    <input
                      type="password"
                      value={settings.gmailAppPassword || ''}
                      onChange={e => setSettings({ ...settings, gmailAppPassword: e.target.value })}
                      onBlur={() => handleSaveSettings(settings)}
                      placeholder="xxxx xxxx xxxx xxxx"
                      className="w-full px-3 py-2 rounded-xl bg-card border border-theme text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={handleTestFreeGmailSmtp}
                    disabled={isSendingTest}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:opacity-90 transition disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSendingTest ? 'Verifying...' : 'Verify & Send Test Email (Free SMTP)'}</span>
                  </button>
                  <span className="text-[11px] text-muted">
                    Sends a test digest directly to {settings.email || settings.gmailUser || 'your email'}
                  </span>
                </div>
              </div>

              {/* Delivery Methods: Option A & Option B */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Option A: Connected Gmail */}
                <div className="p-4 rounded-xl border border-theme bg-card space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center font-bold">
                      G
                    </div>
                    <div>
                      <h4 className="text-sm font-bold">Option A: Connected Gmail (OAuth)</h4>
                      <p className="text-[11px] text-muted">Direct browser token dispatch</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted">
                    Sends directly from your browser session using Google Workspace OAuth. Zero server configuration required.
                  </p>
                  <button
                    onClick={handleSendConnectedGmailTest}
                    disabled={isSendingTest}
                    className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:opacity-90 transition disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send via Connected Gmail</span>
                  </button>
                </div>

                {/* Option B: 24/7 Automated Server Scheduler */}
                <div className="p-4 rounded-xl border border-theme bg-card space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                      <Radio className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold">Option B: 24/7 Server Scheduler</h4>
                      <p className="text-[11px] text-muted">Automated background worker checking every minute</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted">
                    Automated background process checks current time each minute and delivers morning digests at your selected time ({settings.dailyDigestTime}).
                  </p>
                  <button
                    onClick={handleSendServerSchedulerTest}
                    disabled={isSendingTest}
                    className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Trigger 24/7 Worker Test</span>
                  </button>
                </div>
              </div>

              {testResultMsg && (
                <div className={`p-4 rounded-xl border text-xs flex items-start gap-2.5 animate-in fade-in duration-150 ${
                  testResultMsg.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
                }`}>
                  {testResultMsg.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="font-bold">{testResultMsg.text}</div>
                    {testResultMsg.previewHtml && (
                      <button
                        onClick={() => setPreviewModalHtml(testResultMsg.previewHtml!)}
                        className="mt-2 inline-flex items-center gap-1 font-bold underline hover:opacity-80 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview HTML Email Design</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: DELIVERY AUDIT LOGS */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold">Recent Scheduled & Instant Dispatches</h3>
                  <p className="text-xs text-muted">
                    Audit log of messages dispatched via CallMeBot WhatsApp, Telegram, Push, and Email.
                  </p>
                </div>
                <button
                  onClick={() => {
                    fetchServerNotificationStatus(settings.email).then(status => {
                      if (status?.recentDispatches) setRecentLogs(status.recentDispatches);
                    });
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-theme hover:bg-surface text-xs font-semibold cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>

              {recentLogs.length === 0 ? (
                <div className="text-center py-10 bg-surface rounded-xl border border-dashed border-theme">
                  <Mail className="w-8 h-8 mx-auto text-muted mb-2 opacity-50" />
                  <p className="text-sm font-semibold">No Dispatches Recorded Yet</p>
                  <p className="text-xs text-muted mt-1">
                    Trigger an instant alert above to see the live delivery audit log!
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentLogs.map(log => (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-xl border border-theme bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            log.status === 'sent'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                              : log.status === 'error'
                              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                              : 'bg-primary/10 text-primary border border-primary/20'
                          }`}>
                            {log.status}
                          </span>
                          <span className="font-bold text-primary">{log.subject}</span>
                        </div>
                        <div className="text-[11px] text-muted flex items-center gap-2">
                          <span>{new Date(log.timestamp).toLocaleString()}</span>
                          <span>•</span>
                          <span>Channels: {log.channels?.join(', ') || 'Email'}</span>
                        </div>
                      </div>

                      {log.previewHtml && (
                        <button
                          onClick={() => setPreviewModalHtml(log.previewHtml!)}
                          className="px-2.5 py-1 rounded border border-theme hover:bg-card text-[11px] font-semibold text-primary cursor-pointer self-start sm:self-auto"
                        >
                          View Email
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-theme bg-surface/80 flex items-center justify-between text-xs text-muted">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${serverOnline ? 'bg-emerald-500 animate-ping' : 'bg-primary'}`} />
            <span>{serverOnline ? '24/7 Scheduler Active' : 'Client Direct Mode Ready'}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-theme-accent hover:bg-theme-accent/80 text-primary font-bold transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>

      {/* HTML Email Preview Sub-Modal */}
      {previewModalHtml && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 animate-in fade-in duration-150">
          <div className="bg-white text-gray-900 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between bg-gray-50">
              <span className="font-bold text-xs">Email Digest Template Preview</span>
              <button 
                onClick={() => setPreviewModalHtml(null)}
                className="p-1 rounded hover:bg-gray-200 text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 bg-white">
              <div dangerouslySetInnerHTML={{ __html: previewModalHtml }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
