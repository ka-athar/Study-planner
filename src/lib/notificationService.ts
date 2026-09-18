import { ExamDate, Subject, RevisionItem, ExamNotificationSettings } from '../types';
import { playNotificationChime, sendNativePushNotification, requestPushPermission } from './pushNotificationManager';
import { getCachedGmailToken, getOrRequestGmailToken, sendDailyAgendaEmail } from './gmailService';

export interface DispatchLog {
  id: string;
  timestamp: string;
  type: string;
  recipientEmail: string;
  whatsappNumber?: string;
  subject: string;
  status: 'sent' | 'simulated' | 'error';
  channels: string[];
  summary: {
    examsCount: number;
    nearestExamDays: number | null;
    avgSyllabusRemainingPct: number;
    pendingRevisionSets: number;
  };
  details: string;
  error?: string;
  previewHtml?: string;
}

export interface NotificationServerStatus {
  success: boolean;
  profile: ExamNotificationSettings & {
    examDates: ExamDate[];
    subjects: any[];
    revisionItems: any[];
  };
  smtpConfigured: boolean;
  schedulerActive: boolean;
  totalHistoryCount: number;
  recentDispatches: DispatchLog[];
}

const LOCAL_STORAGE_KEY = 'study_exam_notification_settings_v1';

export const DEFAULT_NOTIFICATION_SETTINGS: ExamNotificationSettings = {
  email: 'atharkhanteambuster@gmail.com',
  emailEnabled: true,
  emailProvider: 'auto',
  dailyDigestTime: '07:00',
  frequency: 'daily_and_milestones',
  milestoneDays: [60, 45, 30, 21, 14, 7, 3, 2, 1, 0],
  includeSyllabusCoverage: true,
  includeRevisionSets: true,
  includeWeakSpots: true,
  instantMessengerChannel: 'whatsapp_callmebot',
  whatsappEnabled: false,
  whatsappNumber: '',
  whatsappCallMeBotApiKey: '',
  telegramEnabled: false,
  telegramChatId: '',
  telegramBotToken: '',
  discordWebhookUrl: '',
  customWebhookUrl: '',
  pushEnabled: true,
  pushSoundEnabled: true,
  streakSaverEnabled: true,
  sm2AlertsEnabled: true,
  autoGenerateMeetLinks: true
};

export async function fetchDailyMicroQuiz(email?: string): Promise<any | null> {
  try {
    const res = await fetch(`/api/notifications/micro-quiz?email=${encodeURIComponent(email || '')}`);
    if (res.ok) {
      const data = await res.json();
      return data.quiz;
    }
  } catch (e) {
    console.warn('Failed to fetch micro quiz:', e);
  }
  return null;
}

export function loadLocalNotificationSettings(): ExamNotificationSettings {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('Failed to read notification settings from localStorage', e);
  }
  return DEFAULT_NOTIFICATION_SETTINGS;
}

export function saveLocalNotificationSettings(settings: ExamNotificationSettings) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to persist notification settings to localStorage', e);
  }
}

/**
 * Fetch status and profile from the 24/7 server scheduler.
 */
export async function fetchServerNotificationStatus(email: string = DEFAULT_NOTIFICATION_SETTINGS.email): Promise<NotificationServerStatus | null> {
  try {
    const res = await fetch(`/api/notifications/config/${encodeURIComponent(email)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Could not fetch server notification status:', err);
    return null;
  }
}

/**
 * Sync notification settings, exams, subjects, and revision queue with the 24/7 server.
 */
export async function syncNotificationConfigToServer(
  settings: ExamNotificationSettings,
  examDates: ExamDate[],
  subjects: Subject[],
  revisionItems: RevisionItem[]
): Promise<boolean> {
  saveLocalNotificationSettings(settings);
  try {
    const res = await fetch('/api/notifications/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...settings,
        examDates,
        subjects,
        revisionItems
      })
    });
    return res.ok;
  } catch (err) {
    console.warn('Could not sync notification settings with server:', err);
    return false;
  }
}

/**
 * Trigger an immediate test dispatch to the user's email, push, and WhatsApp.
 */
export async function triggerImmediateDispatch(
  email: string,
  examDates: ExamDate[],
  subjects: Subject[],
  revisionItems: RevisionItem[]
): Promise<{ success: boolean; message: string; logEntry?: DispatchLog }> {
  try {
    const res = await fetch('/api/notifications/dispatch-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        appUrl: window.location.origin,
        examDates,
        subjects,
        revisionItems
      })
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Network error triggering dispatch'
    };
  }
}

/**
 * Request native browser/phone Web Push Notification permission.
 */
export async function requestPhonePushPermission(): Promise<boolean> {
  const perm = await requestPushPermission();
  return perm === 'granted';
}

/**
 * Show a native instant test notification on mobile/browser with audio chime.
 */
export function showInstantPhoneNotification(title: string, body: string, playSound: boolean = true): boolean {
  return sendNativePushNotification({
    title,
    body,
    playSound
  });
}

/**
 * Send an instant WhatsApp notification directly via CallMeBot API (100% Free, Zero Twilio Required).
 */
export async function sendInstantCallMeBotWhatsApp(params: {
  phone: string;
  apiKey: string;
  message: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const cleanPhone = params.phone.replace(/[^0-9+]/g, '');
    if (!cleanPhone || !params.apiKey) {
      return { success: false, message: 'Please provide both phone number with country code and CallMeBot API Key.' };
    }
    const encoded = encodeURIComponent(params.message);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encoded}&apikey=${params.apiKey}`;
    
    // Attempt request with CORS mode or fallback image ping
    const res = await fetch(url, { mode: 'no-cors' });
    return {
      success: true,
      message: `Direct WhatsApp dispatch triggered to ${cleanPhone} via CallMeBot gateway!`
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'CallMeBot request failed' };
  }
}

/**
 * Send an instant Telegram notification via official Bot API (100% Free, Zero Twilio/Payment Required).
 */
export async function sendInstantTelegramMessage(params: {
  chatId: string;
  botToken: string;
  message: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    if (!params.chatId || !params.botToken) {
      return { success: false, message: 'Please provide your Telegram Chat ID and Bot Token.' };
    }
    const res = await fetch(`https://api.telegram.org/bot${params.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: params.chatId,
        text: params.message,
        parse_mode: 'HTML'
      })
    });
    const data = await res.json();
    if (data.ok) {
      return { success: true, message: `Instant Telegram message delivered to chat ${params.chatId}!` };
    } else {
      return { success: false, message: data.description || 'Telegram Bot API error' };
    }
  } catch (err: any) {
    return { success: false, message: err.message || 'Telegram network error' };
  }
}

/**
 * Direct email dispatch via user's connected Google account (Gmail API, Free Option A).
 */
export async function sendConnectedGmailNotification(params: {
  toEmail: string;
  studentName?: string;
  examDates: ExamDate[];
  subjects: Subject[];
  revisionItems: RevisionItem[];
}): Promise<{ success: boolean; message: string }> {
  try {
    const token = await getOrRequestGmailToken();
    if (!token) {
      return { success: false, message: 'Please sign in with Google to enable free Gmail notifications.' };
    }

    const firstExam = params.examDates[0];
    const stats = firstExam ? calculateClientExamSyllabusStats(firstExam, params.subjects, params.revisionItems) : null;

    const res = await sendDailyAgendaEmail({
      recipientEmail: params.toEmail,
      recipientName: params.studentName || 'Student',
      dateStr: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }),
      todayPlan: null,
      todaySessions: [],
      subjects: params.subjects,
      revisions: params.revisionItems,
      userProfile: {
        id: 'current-user',
        email: params.toEmail,
        displayName: params.studentName || 'Student',
        role: 'student',
        examDates: params.examDates,
        theme: 'natural_ethos'
      } as any
    }, token);

    if (res.success) {
      return { success: true, message: `Free email alert dispatched via your connected Gmail to ${params.toEmail}!` };
    } else {
      return { success: false, message: 'Gmail API failed to send message.' };
    }
  } catch (err: any) {
    return { success: false, message: err.message || 'Gmail dispatch error' };
  }
}

/**
 * Client-side calculation of exam days remaining and syllabus completion stats.
 */
export function calculateClientExamSyllabusStats(
  exam: ExamDate,
  subjects: Subject[],
  revisionItems: RevisionItem[]
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const examDate = new Date(exam.date);
  examDate.setHours(0, 0, 0, 0);

  const diffMs = examDate.getTime() - today.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  // Match subject or take all subjects
  const matched = subjects.filter(
    s => s.name.toLowerCase().trim() === exam.subjectName.toLowerCase().trim() || exam.subjectName === 'All Subjects' || exam.subjectName === 'General Academic Board'
  );
  const targetSubjects = matched.length > 0 ? matched : subjects;

  let totalTopics = 0;
  let completedTopics = 0;
  let inProgressTopics = 0;
  let untouchedTopics = 0;
  const weakTopics: string[] = [];

  targetSubjects.forEach(sub => {
    (sub.chapters || []).forEach(ch => {
      (ch.topics || []).forEach(t => {
        totalTopics++;
        const st = (t.status || 'Not Started').toLowerCase();
        if (st === 'completed' || st === 'mastered') {
          completedTopics++;
        } else if (st === 'in progress' || st === 'needs revision') {
          inProgressTopics++;
          if (st === 'needs revision' || t.weakNotes) {
            weakTopics.push(`${sub.name}: ${t.name}`);
          }
        } else {
          untouchedTopics++;
        }
      });
    });
  });

  const completionPct = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
  const remainingPct = 100 - completionPct;

  const todayIso = today.toISOString().split('T')[0];
  const matchingRevs = revisionItems.filter(r => {
    if (exam.subjectName === 'All Subjects' || exam.subjectName === 'General Academic Board') return true;
    return r.subjectName.toLowerCase().trim() === exam.subjectName.toLowerCase().trim();
  });

  const pendingRevs = matchingRevs.filter(r => r.status !== 'Completed');
  const dueTodayRevs = pendingRevs.filter(r => r.dueDate && r.dueDate <= todayIso);
  const completedRevs = matchingRevs.filter(r => r.status === 'Completed');

  return {
    daysLeft,
    isToday: daysLeft === 0,
    isPast: daysLeft < 0,
    totalTopics,
    completedTopics,
    inProgressTopics,
    untouchedTopics,
    completionPct,
    remainingPct,
    weakTopics: weakTopics.slice(0, 3),
    revisionStats: {
      total: matchingRevs.length,
      pending: pendingRevs.length,
      dueTodayOrOverdue: dueTodayRevs.length,
      completed: completedRevs.length,
      dueItems: dueTodayRevs.slice(0, 5)
    }
  };
}

export async function simulateBotCommand(command: string, email?: string): Promise<{
  success: boolean;
  command: string;
  replyText: string;
  profileStreak?: number;
}> {
  try {
    const res = await fetch('/api/notifications/simulate-bot-command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, email })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Bot command simulation error:', e);
  }
  return {
    success: false,
    command,
    replyText: 'Error simulating bot command. Please try again.'
  };
}

export async function registerTelegramWebhook(botToken: string, webhookUrl: string): Promise<{
  success: boolean;
  result?: any;
  error?: string;
}> {
  try {
    const res = await fetch('/api/notifications/telegram-set-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botToken, webhookUrl })
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to set webhook' };
  }
}

/**
 * Test 100% Free CallMeBot WhatsApp Gateway
 */
export async function testFreeCallMeBot(
  phoneNumber: string, 
  apiKey: string, 
  message?: string
): Promise<{ success: boolean; message: string; rawResponse?: string }> {
  try {
    const res = await fetch('/api/notifications/test-callmebot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber, apiKey, message })
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: err.message || 'CallMeBot network dispatch error' };
  }
}

/**
 * Test 100% Free Gmail SMTP Gateway (Using Google Personal App Password)
 */
export async function testFreeEmailGateway(
  gmailUser: string,
  gmailAppPassword: string,
  toEmail?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/notifications/test-free-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gmailUser, gmailAppPassword, toEmail })
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: err.message || 'Email SMTP test error' };
  }
}
