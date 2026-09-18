/**
 * Gmail Integration Service & Automated Morning Briefing Background Worker
 * Manages Google OAuth access tokens, formatted daily agenda generation, and
 * background 7:30 AM dispatch worker with persistent local state tracking and UI reporting.
 */

import { signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { Subject, StudySession, StudyPlan, RevisionItem, UserProfile, TestResult, StudyPlanTopic, Assignment, MissedWorkItem } from '../types';
import { utf8ToBase64, base64UrlEncode } from './base64Utils';
import { getCachedWorkspaceToken, setCachedWorkspaceToken } from './googleAuthService';
import { generateRecoveryPlan } from './missedWorkService';

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose'
];

// Fallback base URL if window is not available
export const DEFAULT_APP_BASE_URL = typeof window !== 'undefined' && window.location.origin
  ? window.location.origin
  : 'https://ais-dev-af73hcwbkbncwkbutixe6a-304783015553.asia-southeast1.run.app';

// In-memory token caching (Strictly per Workspace Integration guidelines)
let cachedGmailToken: string | null = null;

// Clear cached token on sign-out
auth.onAuthStateChanged((user: User | null) => {
  if (!user) {
    cachedGmailToken = null;
  }
});

/**
 * Returns the currently cached Gmail access token or initiates Google sign-in to obtain it.
 */
export async function getOrRequestGmailToken(forcePrompt: boolean = false): Promise<string> {
  const existing = getCachedGmailToken();
  if (existing && !forcePrompt) {
    return existing;
  }

  try {
    if (forcePrompt) {
      googleProvider.setCustomParameters({ prompt: 'consent select_account' });
    }
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to acquire Gmail OAuth access token from Google.');
    }
    cachedGmailToken = credential.accessToken;
    setCachedWorkspaceToken(credential.accessToken);
    return cachedGmailToken;
  } catch (error: any) {
    if (error?.code === 'auth/popup-blocked' || error?.message?.includes('popup-blocked')) {
      console.warn('Gmail OAuth popup blocked: Browser blocked the sign-in pop-up window.', error?.message || error);
      const friendlyErr = new Error('Google Sign-in pop-up was blocked by your browser. Please allow pop-ups for this site or open the app in a new tab to authenticate.');
      friendlyErr.name = 'PopupBlockedError';
      (friendlyErr as any).code = 'auth/popup-blocked';
      throw friendlyErr;
    }
    console.warn('Unable to obtain Gmail OAuth token:', error?.message || error);
    throw error;
  }
}

export function getCachedGmailToken(): string | null {
  return cachedGmailToken || getCachedWorkspaceToken();
}

export function setCachedGmailToken(token: string | null) {
  cachedGmailToken = token;
  if (token) {
    setCachedWorkspaceToken(token);
  }
}

export interface MorningBriefingLogItem {
  id: string;
  date: string;
  timestamp: number;
  status: 'Delivered' | 'Failed';
  recipient: string;
  tasksCount: number;
  completedCount: number;
  messageId?: string;
  error?: string;
}

export interface MorningBriefingConfig {
  enabled: boolean;
  dispatchTime: string; // e.g. "07:30"
  recipientEmail: string;
  recipientName: string;
  customDailyNote?: string;
  autoSendOnMorningOpen: boolean;
  lastDispatchedDate?: string; // YYYY-MM-DD
  lastDispatchedTimestamp?: number;
  history: MorningBriefingLogItem[];
}

export interface BriefingWorkerState {
  status: 'idle' | 'checking' | 'dispatching' | 'dispatched_today' | 'failed' | 'needs_auth';
  lastCheckedTimestamp: number;
  lastDispatchedDate?: string;
  lastDispatchedTimestamp?: number;
  lastSuccessMessageId?: string;
  lastMessage?: string;
  nextScheduledCheckText?: string;
  isLocked: boolean;
}

const MORNING_CONFIG_KEY = 'studyos_morning_briefing_config';
const WORKER_STATE_KEY = 'studyos_briefing_worker_state';

// In-memory worker lock & subscribers
let workerSubscribers: ((state: BriefingWorkerState) => void)[] = [];
let activeWorkerTimer: any = null;
let currentWorkerParams: {
  todayPlan: StudyPlan | null;
  todaySessions: StudySession[];
  subjects: Subject[];
  revisions: RevisionItem[];
  userProfile: UserProfile | null;
  testResults?: TestResult[];
  assignments?: Assignment[];
  missedWork?: MissedWorkItem[];
} | null = null;

export function getMorningBriefingConfig(defaultEmail?: string, defaultName?: string): MorningBriefingConfig {
  try {
    const stored = localStorage.getItem(MORNING_CONFIG_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        enabled: parsed.enabled ?? true,
        dispatchTime: parsed.dispatchTime || '07:30',
        recipientEmail: parsed.recipientEmail || defaultEmail || '',
        recipientName: parsed.recipientName || defaultName || 'Student',
        customDailyNote: parsed.customDailyNote || '',
        autoSendOnMorningOpen: parsed.autoSendOnMorningOpen ?? true,
        lastDispatchedDate: parsed.lastDispatchedDate,
        lastDispatchedTimestamp: parsed.lastDispatchedTimestamp,
        history: Array.isArray(parsed.history) ? parsed.history : []
      };
    }
  } catch (e) {
    console.warn('Failed to parse morning briefing config:', e);
  }

  return {
    enabled: true,
    dispatchTime: '07:30',
    recipientEmail: defaultEmail || '',
    recipientName: defaultName || 'Student',
    customDailyNote: '',
    autoSendOnMorningOpen: true,
    history: []
  };
}

export function saveMorningBriefingConfig(config: MorningBriefingConfig) {
  try {
    localStorage.setItem(MORNING_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to save morning briefing config:', e);
  }
}

/**
 * Returns the current local date formatted as YYYY-MM-DD
 */
export function getLocalTodayStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Retrieves the persisted state of the Briefing Background Worker
 */
export function getBriefingWorkerState(): BriefingWorkerState {
  const localToday = getLocalTodayStr();
  const config = getMorningBriefingConfig();

  try {
    const stored = localStorage.getItem(WORKER_STATE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const isToday = parsed.lastDispatchedDate === localToday || config.lastDispatchedDate === localToday;
      return {
        status: isToday ? 'dispatched_today' : (parsed.status || 'idle'),
        lastCheckedTimestamp: parsed.lastCheckedTimestamp || Date.now(),
        lastDispatchedDate: parsed.lastDispatchedDate || config.lastDispatchedDate,
        lastDispatchedTimestamp: parsed.lastDispatchedTimestamp || config.lastDispatchedTimestamp,
        lastSuccessMessageId: parsed.lastSuccessMessageId,
        lastMessage: parsed.lastMessage,
        nextScheduledCheckText: parsed.nextScheduledCheckText || `Daily check at ${config.dispatchTime || '07:30'} AM`,
        isLocked: Boolean(parsed.isLocked)
      };
    }
  } catch (e) {
    console.warn('Failed to read briefing worker state:', e);
  }

  const isAlreadyDispatched = config.lastDispatchedDate === localToday;
  return {
    status: isAlreadyDispatched ? 'dispatched_today' : 'idle',
    lastCheckedTimestamp: Date.now(),
    lastDispatchedDate: config.lastDispatchedDate,
    lastDispatchedTimestamp: config.lastDispatchedTimestamp,
    nextScheduledCheckText: `Daily check at ${config.dispatchTime || '07:30'} AM`,
    isLocked: false
  };
}

/**
 * Updates and broadcasts the Briefing Background Worker state
 */
export function setBriefingWorkerState(partial: Partial<BriefingWorkerState>): BriefingWorkerState {
  const current = getBriefingWorkerState();
  const updated: BriefingWorkerState = {
    ...current,
    ...partial,
    lastCheckedTimestamp: Date.now()
  };

  try {
    localStorage.setItem(WORKER_STATE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to persist briefing worker state:', e);
  }

  // Notify active listeners
  workerSubscribers.forEach(cb => {
    try { cb(updated); } catch (err) { console.error('Worker subscriber error:', err); }
  });

  // Dispatch global DOM event for components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('studyos:briefing-status', { detail: updated }));
  }

  return updated;
}

/**
 * Subscribe to real-time Briefing Background Worker updates
 */
export function subscribeBriefingWorkerStatus(callback: (state: BriefingWorkerState) => void): () => void {
  workerSubscribers.push(callback);
  callback(getBriefingWorkerState());

  return () => {
    workerSubscribers = workerSubscribers.filter(cb => cb !== callback);
  };
}

export interface AgendaEmailData {
  recipientEmail: string;
  recipientName?: string;
  dateStr: string;
  todayPlan: StudyPlan | null;
  todaySessions: StudySession[];
  subjects: Subject[];
  revisions: RevisionItem[];
  userProfile: UserProfile | null;
  testResults?: TestResult[];
  assignments?: Assignment[];
  missedWork?: MissedWorkItem[];
  customNote?: string;
  baseUrl?: string;
}

/**
 * Generates both beautiful HTML and plain text email bodies for the Daily Study Agenda.
 * Includes actionable 'Mark as Done' and 'Start Timer' completion links.
 */
export function generateAgendaEmailContent(data: AgendaEmailData): { subject: string; html: string; text: string } {
  const {
    recipientName = 'Student',
    dateStr,
    todayPlan,
    todaySessions,
    subjects,
    revisions,
    userProfile,
    testResults = [],
    assignments = [],
    missedWork = [],
    customNote,
    baseUrl = DEFAULT_APP_BASE_URL
  } = data;

  const targetHours = userProfile?.targetHoursPerDay || 3;
  const totalMinsDone = todaySessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  const hoursDone = (totalMinsDone / 60).toFixed(1);

  const assignedTopics = todayPlan ? todayPlan.topics.filter(t => !t.completed) : [];
  const completedTopics = todayPlan ? todayPlan.topics.filter(t => Boolean(t.completed)) : [];
  const pendingRevisions = revisions.filter(r => r.status === 'Pending').slice(0, 5);
  const upcomingExams = userProfile?.examDates || [];
  const recentTests = testResults.slice(0, 3);

  // Active missed work & recovery suggestions
  const activeMissed = missedWork.filter(m => m.status === 'Missed' || m.status === 'Pending');
  const recoveryPlan = activeMissed.length > 0 ? generateRecoveryPlan(activeMissed, userProfile) : null;
  const nextRecoveryItem = recoveryPlan?.nextActionItem;

  // Upcoming assignments / tests in next 7 days
  const todayIsoDate = getLocalTodayStr();
  const upcomingDeadlines = assignments
    .filter(a => a.dueDate && a.dueDate >= todayIsoDate && a.status !== 'Completed' && a.status !== 'Submitted')
    .slice(0, 5);

  const subject = activeMissed.length > 0 
    ? `⚠️ Morning Briefing & Recovery Plan — ${activeMissed.length} Overdue Task${activeMissed.length > 1 ? 's' : ''} (${dateStr})`
    : `🌅 Morning Study Briefing & Agenda — ${dateStr}`;

  // Helper for generating actionable Mark as Done link
  const getMarkAsDoneUrl = (topic: StudyPlanTopic) => {
    return `${baseUrl}/api/tasks/complete?topicName=${encodeURIComponent(topic.topicName)}&subjectName=${encodeURIComponent(topic.subjectName)}&chapterName=${encodeURIComponent(topic.chapterName || '')}&planDate=${encodeURIComponent(todayPlan?.date || todayIsoDate)}&taskId=${encodeURIComponent(topic.id || '')}&source=morning_agenda_email`;
  };

  const getStartTimerUrl = (topic: StudyPlanTopic) => {
    return `${baseUrl}/?action=start_timer&subject=${encodeURIComponent(topic.subjectName)}&topic=${encodeURIComponent(topic.topicName)}&chapter=${encodeURIComponent(topic.chapterName || '')}`;
  };

  const getAppDashboardUrl = () => {
    return `${baseUrl}/?action=open_dashboard`;
  };

  const getMissedWorkUrl = () => {
    return `${baseUrl}/?action=open_missed_work`;
  };

  // Plain Text Version
  let text = `=================================================================\n`;
  text += `STUDYOS MORNING AGENDA & ACCOUNTABILITY BRIEFING (${dateStr})\n`;
  text += `Prepared for: ${recipientName}\n`;
  text += `=================================================================\n\n`;
  text += `Good morning, ${recipientName}!\n`;
  text += `Daily Target: ${targetHours} hrs | Today's Logged: ${hoursDone} hrs (${totalMinsDone} mins)\n\n`;

  if (activeMissed.length > 0) {
    text += `🚨 OVERDUE & MISSED WORK NOTICE (${activeMissed.length} item${activeMissed.length > 1 ? 's' : ''}):\n`;
    if (nextRecoveryItem) {
      text += `👉 RECOMMENDED NEXT ATTEMPT: ${nextRecoveryItem.title} (${nextRecoveryItem.subjectName})\n`;
      text += `   Est. Time: ${nextRecoveryItem.estimatedMinutes} mins | Priority: ${nextRecoveryItem.priority}\n`;
    }
    activeMissed.forEach((m, idx) => {
      text += `   ${idx + 1}. [${m.type.toUpperCase()}] ${m.title} (${m.subjectName}) - Due was: ${m.originalDeadline}\n`;
    });
    text += `   View Recovery Plan: ${getMissedWorkUrl()}\n\n`;
  }

  if (customNote) {
    text += `Morning Note: "${customNote}"\n\n`;
  }

  text += `--- 1. TODAY'S PRIORITIZED STUDY AGENDA (Actionable Tasks) ---\n`;
  if (assignedTopics.length > 0) {
    assignedTopics.forEach((t, i) => {
      text += `${i + 1}. [${t.priority}] ${t.topicName} (${t.subjectName} - ${t.chapterName})\n`;
      text += `   Duration: ~${t.estimatedMinutes} mins | Reason: ${t.reason}\n`;
      text += `   👉 [Mark as Done]: ${getMarkAsDoneUrl(t)}\n`;
      text += `   ⏱️ [Start Timer]: ${getStartTimerUrl(t)}\n\n`;
    });
  } else {
    text += `🎉 All assigned tasks for today have been completed or none pending!\n\n`;
  }

  if (upcomingDeadlines.length > 0) {
    text += `--- 2. UPCOMING TESTS & ASSIGNMENT DEADLINES ---\n`;
    upcomingDeadlines.forEach((a) => {
      text += `📅 [${a.type}] ${a.title} (${a.subjectName}) - Due: ${a.dueDate} (Priority: ${a.priority})\n`;
    });
    text += `\n`;
  }

  text += `--- 2. PAST PERFORMANCE & ACCOMPLISHMENTS ---\n`;
  if (completedTopics.length > 0) {
    text += `Ticked Off Topics Today:\n`;
    completedTopics.forEach((t) => {
      text += `✓ ${t.topicName} (${t.subjectName}) [${t.completionStatus || 'Completed'}]\n`;
    });
  }
  if (todaySessions.length > 0) {
    text += `Recent Study Sessions:\n`;
    todaySessions.forEach((s) => {
      text += `• ${s.topicName} (${s.subjectName}) - ${s.durationMinutes} mins [${s.result}]\n`;
    });
  }
  if (recentTests.length > 0) {
    text += `Recent Test Diagnostics:\n`;
    recentTests.forEach(t => {
      text += `• ${t.testName} (${t.subjectName}) - Score: ${t.score} | Date: ${t.date}\n`;
    });
  }

  if (pendingRevisions.length > 0) {
    text += `\n--- 3. SPACED REPETITION REVISIONS DUE ---\n`;
    pendingRevisions.forEach((r) => {
      text += `• ${r.topicName} (${r.subjectName}) - Due: ${r.dueDate || 'Today'}\n`;
    });
  }

  if (upcomingExams.length > 0) {
    text += `\n--- 4. UPCOMING EXAM COUNTDOWN ---\n`;
    upcomingExams.forEach((ex) => {
      text += `🏆 ${ex.examName} (${ex.subjectName}): ${ex.date}\n`;
    });
  }

  text += `\nOpen Full StudyOS Platform: ${getAppDashboardUrl()}\n`;
  text += `\nSent autonomously by your AI Personal Study Planner & Organizer.\n`;

  // Rich HTML Email Version with Clickable Buttons
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F7F5F0; color: #333830; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F7F5F0; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="620" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #ffffff; border: 1px solid #E0DBD0; border-radius: 24px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.06);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #6B705C 0%, #585D4B 100%); padding: 32px 28px; text-align: left;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 11px; font-weight: 800; letter-spacing: 2.5px; color: #DDBEA9; text-transform: uppercase; margin-bottom: 8px;">
                      STUDYOS AUTOMATED MORNING BRIEFING
                    </div>
                    <h1 style="margin: 0; font-size: 24px; color: #FFFFFF; font-weight: 800; line-height: 1.25; letter-spacing: -0.5px;">
                      Daily Agenda & Action Summary
                    </h1>
                    <div style="font-size: 13px; color: #EAE7DF; margin-top: 8px; font-weight: 500;">
                      📅 ${dateStr} • Personalized for <strong>${recipientName}</strong>
                    </div>
                  </td>
                  <td align="right" valign="top" style="padding-left: 12px;">
                    <a href="${getAppDashboardUrl()}" target="_blank" style="display: inline-block; background-color: #DDBEA9; color: #4A4E4D; font-size: 11px; font-weight: 700; text-decoration: none; padding: 8px 14px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">
                      Open App →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Summary Goal & Metrics Bar -->
          <tr>
            <td style="padding: 20px 24px 8px 24px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F9F7F2; border: 1px solid #EAE7DF; border-radius: 16px; padding: 16px;">
                <tr>
                  <td width="33%" style="border-right: 1px solid #E0DBD0; padding-right: 12px; text-align: center;">
                    <div style="font-size: 10px; color: #8A8F80; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">Daily Goal</div>
                    <div style="font-size: 20px; font-weight: 800; color: #4A4E4D; margin-top: 2px;">
                      ${targetHours} <span style="font-size: 11px; font-weight: 600; color: #8A8F80;">hrs</span>
                    </div>
                  </td>
                  <td width="33%" style="border-right: 1px solid #E0DBD0; padding: 0 12px; text-align: center;">
                    <div style="font-size: 10px; color: #8A8F80; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">Logged Today</div>
                    <div style="font-size: 20px; font-weight: 800; color: #6B705C; margin-top: 2px;">
                      ${hoursDone} <span style="font-size: 11px; font-weight: 600; color: #8A8F80;">hrs</span>
                    </div>
                  </td>
                  <td width="34%" style="padding-left: 12px; text-align: center;">
                    <div style="font-size: 10px; color: #8A8F80; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">Pending Tasks</div>
                    <div style="font-size: 20px; font-weight: 800; color: ${assignedTopics.length > 0 ? '#C53030' : '#2F855A'}; margin-top: 2px;">
                      ${assignedTopics.length} <span style="font-size: 11px; font-weight: 600; color: #8A8F80;">topics</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${customNote ? `
          <!-- Custom Morning Focus Note -->
          <tr>
            <td style="padding: 10px 24px 10px 24px;">
              <div style="background-color: #FFFDF8; border-left: 4px solid #6B705C; padding: 12px 16px; border-radius: 8px; font-size: 13px; color: #4A4E4D; font-style: italic; border-top: 1px solid #F0ECE1; border-right: 1px solid #F0ECE1; border-bottom: 1px solid #F0ECE1;">
                💡 <strong>Morning Focus Note:</strong> "${customNote}"
              </div>
            </td>
          </tr>
          ` : ''}

          ${activeMissed.length > 0 ? `
          <!-- MISSED WORK & RECOVERY PLAN NOTICE -->
          <tr>
            <td style="padding: 10px 24px 12px 24px;">
              <div style="background-color: #FFF5F5; border: 1px solid #FEB2B2; border-radius: 16px; padding: 16px 20px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                  <span style="font-size: 13px; font-weight: 800; color: #9B2C2C; text-transform: uppercase; letter-spacing: 1px;">
                    ⚠️ Overdue & Missed Work (${activeMissed.length})
                  </span>
                  <a href="${getMissedWorkUrl()}" target="_blank" style="font-size: 11px; font-weight: 700; color: #C53030; text-decoration: underline;">
                    View Recovery Plan →
                  </a>
                </div>
                ${nextRecoveryItem ? `
                  <div style="background-color: #ffffff; border: 1px solid #FED7D7; border-radius: 12px; padding: 12px 14px; margin-top: 8px;">
                    <div style="font-size: 10px; font-weight: 800; color: #DD6B20; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">
                      👉 Recommended Next Catch-up Attempt:
                    </div>
                    <div style="font-size: 14px; font-weight: 800; color: #2D3748;">
                      ${nextRecoveryItem.title} <span style="font-size: 11px; font-weight: 600; color: #718096;">(${nextRecoveryItem.subjectName})</span>
                    </div>
                    <div style="font-size: 11px; color: #718096; margin-top: 4px;">
                      Est. Time: <strong>${nextRecoveryItem.estimatedMinutes} mins</strong> • Priority: <strong>${nextRecoveryItem.priority}</strong> • Was due: ${nextRecoveryItem.originalDeadline}
                    </div>
                  </div>
                ` : ''}
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- SECTION 1: TODAY'S TASKS WITH ACTIONABLE 'MARK AS DONE' LINKS -->
          <tr>
            <td style="padding: 16px 24px 12px 24px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; border-bottom: 2px solid #F2EFE9; padding-bottom: 8px;">
                <span style="font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #6B705C;">
                  📋 1. Today's Actionable Agenda (${assignedTopics.length} Pending)
                </span>
              </div>

              ${assignedTopics.length > 0 ? assignedTopics.map((t) => `
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF8F4; border: 1px solid #EAE7DF; border-radius: 16px; margin-bottom: 14px; padding: 18px; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
                  <tr>
                    <td>
                      <div style="margin-bottom: 6px;">
                        <span style="display: inline-block; font-size: 10px; font-weight: 800; text-transform: uppercase; background-color: #EAE7DF; color: #6B705C; padding: 4px 9px; border-radius: 8px; margin-right: 6px;">
                          ${t.subjectName}
                        </span>
                        <span style="font-size: 11px; color: #8A8F80; font-family: monospace; font-weight: 600;">
                          ${t.chapterName || 'Core Chapter'}
                        </span>
                        ${t.priority === 'High' ? `
                          <span style="display: inline-block; font-size: 9px; font-weight: 800; text-transform: uppercase; background-color: #FFEBEB; color: #C53030; padding: 3px 8px; border-radius: 6px; margin-left: 6px;">
                            HIGH PRIORITY
                          </span>
                        ` : ''}
                      </div>

                      <div style="font-size: 16px; font-weight: 800; color: #2D3748; margin: 6px 0 4px 0;">
                        ${t.topicName}
                      </div>

                      <div style="font-size: 12px; color: #718096; line-height: 1.45; margin-bottom: 12px;">
                        ${t.reason || 'Curriculum core priority for today.'}
                      </div>

                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-top: 1px solid #EFECE6; padding-top: 12px; margin-top: 4px;">
                        <tr>
                          <td valign="middle" style="font-size: 12px; color: #6B705C; font-weight: 700;">
                            ⏱️ ~${t.estimatedMinutes} mins
                          </td>
                          <td align="right" valign="middle">
                            <a href="${getStartTimerUrl(t)}" target="_blank" style="display: inline-block; background-color: #EFECE6; color: #4A4E4D; font-size: 11px; font-weight: 700; text-decoration: none; padding: 7px 12px; border-radius: 20px; margin-right: 6px;">
                              ⏱️ Start Timer
                            </a>
                            <a href="${getMarkAsDoneUrl(t)}" target="_blank" style="display: inline-block; background-color: #2F855A; color: #ffffff; font-size: 11px; font-weight: 800; text-decoration: none; padding: 7px 14px; border-radius: 20px; box-shadow: 0 2px 4px rgba(47,133,90,0.2);">
                              ✅ Mark as Done
                            </a>
                          </td>
                        </tr>
                      </table>

                    </td>
                  </tr>
                </table>
              `).join('') : `
                <div style="background-color: #F0FFF4; border: 1px solid #C6F6D5; border-radius: 16px; padding: 20px; text-align: center; color: #22543D; font-size: 14px;">
                  🎉 <strong>All assigned focus tasks for today have been completed!</strong>
                </div>
              `}
            </td>
          </tr>

          ${upcomingDeadlines.length > 0 ? `
          <!-- SECTION: UPCOMING TESTS & ASSIGNMENT DEADLINES -->
          <tr>
            <td style="padding: 8px 24px 12px 24px;">
              <div style="font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #B7791F; margin-bottom: 12px; border-bottom: 2px solid #F2EFE9; padding-bottom: 8px;">
                📅 Upcoming Deadlines & Tests (${upcomingDeadlines.length})
              </div>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FFFAF0; border: 1px solid #FEEBC8; border-radius: 14px; padding: 12px 16px;">
                ${upcomingDeadlines.map(a => `
                  <tr>
                    <td style="padding: 8px 0; font-size: 12px; color: #744210; border-bottom: 1px solid #FBD38D;">
                      <span style="display: inline-block; font-size: 9px; font-weight: 800; background-color: #DD6B20; color: #ffffff; padding: 2px 6px; border-radius: 4px; margin-right: 6px; text-transform: uppercase;">
                        ${a.type}
                      </span>
                      <strong>${a.title}</strong> (${a.subjectName})
                      <div style="font-size: 11px; color: #975A16; margin-top: 3px;">
                        ⏰ Due Date: <strong>${a.dueDate}</strong> • Priority: <strong>${a.priority}</strong>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- SECTION 2: PAST PERFORMANCE & RECENT LOGS -->
          <tr>
            <td style="padding: 8px 24px 12px 24px;">
              <div style="font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #2E7D32; margin-bottom: 12px; border-bottom: 2px solid #F2EFE9; padding-bottom: 8px;">
                📈 2. Past Performance & Accomplishments
              </div>

              ${completedTopics.length > 0 || todaySessions.length > 0 || recentTests.length > 0 ? `
                ${completedTopics.length > 0 ? `
                  <div style="margin-bottom: 10px;">
                    <div style="font-size: 11px; font-weight: 700; color: #8A8F80; text-transform: uppercase; margin-bottom: 6px;">Completed Today:</div>
                    ${completedTopics.map(t => `
                      <div style="background-color: #F4FAF5; border: 1px solid #D4EDDA; border-radius: 10px; padding: 10px 14px; margin-bottom: 6px; font-size: 12px; display: flex; align-items: center; justify-content: space-between;">
                        <div>
                          <span style="color: #28A745; font-weight: bold; margin-right: 6px;">✓</span>
                          <span style="text-decoration: line-through; color: #495057; font-weight: 700;">${t.topicName}</span>
                          <span style="font-size: 11px; color: #6C757D; margin-left: 6px;">(${t.subjectName})</span>
                        </div>
                        <span style="font-size: 10px; font-weight: 700; background-color: #D4EDDA; color: #155724; padding: 2px 8px; border-radius: 10px;">
                          ${t.completionStatus || 'Completed'}
                        </span>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}

                ${recentTests.length > 0 ? `
                  <div style="margin-bottom: 10px;">
                    <div style="font-size: 11px; font-weight: 700; color: #8A8F80; text-transform: uppercase; margin-bottom: 6px;">Recent Test Diagnostics:</div>
                    ${recentTests.map(t => `
                      <div style="background-color: #FAF8F4; border: 1px solid #EAE7DF; border-radius: 10px; padding: 10px 14px; margin-bottom: 6px; font-size: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                          <span style="font-weight: 700; color: #2D3748;">📝 ${t.testName} (${t.subjectName})</span>
                          <span style="font-weight: 800; color: #6B705C; background: #EAE7DF; padding: 2px 8px; border-radius: 6px;">${t.score}</span>
                        </div>
                        ${t.analysis ? `
                          <div style="font-size: 11px; color: #718096; margin-top: 4px;">
                            ↳ Weak area: <strong>${t.analysis.weakConcept}</strong> • Revise: ${t.analysis.whatToRevise}
                          </div>
                        ` : ''}
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              ` : `
                <div style="background-color: #F9F7F2; border: 1px dashed #E0DBD0; border-radius: 12px; padding: 14px; text-align: center; color: #8A8F80; font-size: 12px;">
                  No past sessions logged yet. Completing today's tasks will build your streak!
                </div>
              `}
            </td>
          </tr>

          ${pendingRevisions.length > 0 ? `
          <!-- SECTION 3: REVISIONS DUE -->
          <tr>
            <td style="padding: 8px 24px 12px 24px;">
              <div style="font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #975A16; margin-bottom: 12px; border-bottom: 2px solid #F2EFE9; padding-bottom: 8px;">
                🔄 3. Spaced-Repetition Revisions Due (${pendingRevisions.length})
              </div>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FFFDF5; border: 1px solid #F6E05E; border-radius: 14px; padding: 14px;">
                ${pendingRevisions.map(r => `
                  <tr>
                    <td style="padding: 6px 0; font-size: 12px; color: #744210; border-bottom: 1px solid #FAF089;">
                      • <strong>${r.topicName}</strong> (${r.subjectName}) <span style="font-size: 10px; color: #975A16; margin-left: 4px;">[Due: ${r.dueDate || 'Today'}]</span>
                    </td>
                  </tr>
                `).join('')}
              </table>
            </td>
          </tr>
          ` : ''}

          ${upcomingExams.length > 0 ? `
          <!-- SECTION 4: EXAM TARGETS & COUNTDOWN -->
          <tr>
            <td style="padding: 8px 24px 16px 24px;">
              <div style="font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #4A4E4D; margin-bottom: 12px; border-bottom: 2px solid #F2EFE9; padding-bottom: 8px;">
                🎯 4. Upcoming Exam Countdown
              </div>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F9F7F2; border: 1px solid #E0DBD0; border-radius: 14px; padding: 14px;">
                ${upcomingExams.slice(0, 3).map(ex => {
                  const daysUntil = Math.ceil((new Date(ex.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                  const daysLabel = isNaN(daysUntil) ? '' : daysUntil <= 0 ? '(Today!)' : `(${daysUntil} days left)`;
                  return `
                  <tr>
                    <td style="padding: 8px 0; font-size: 12px; color: #4A4E4D; border-bottom: 1px solid #EAE7DF;">
                      🏆 <strong>${ex.examName}</strong> (${ex.subjectName}) — <span style="color: #6B705C; font-weight: 800;">${ex.date}</span> <span style="font-size: 11px; color: #C53030; font-weight: 700;">${daysLabel}</span>
                    </td>
                  </tr>
                  `;
                }).join('')}
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Quick Navigation Banner -->
          <tr>
            <td style="padding: 12px 24px 24px 24px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #6B705C; border-radius: 16px; padding: 16px 20px; text-align: center;">
                <tr>
                  <td>
                    <div style="font-size: 14px; font-weight: 800; color: #ffffff; margin-bottom: 4px;">
                      Ready to Start Today's Study Session?
                    </div>
                    <div style="font-size: 12px; color: #EAE7DF; margin-bottom: 12px;">
                      Launch your interactive AI Tutor, Flashcard Arena, or Focus Timer in one click.
                    </div>
                    <a href="${getAppDashboardUrl()}" target="_blank" style="display: inline-block; background-color: #FFFFFF; color: #4A4E4D; font-size: 12px; font-weight: 800; text-decoration: none; padding: 9px 20px; border-radius: 24px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                      Open StudyOS Workspace →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer Note & Storage Status -->
          <tr>
            <td style="background-color: #F2EFE9; padding: 24px; text-align: center; border-top: 1px solid #E0DBD0;">
              <div style="font-size: 12px; color: #6B705C; font-weight: 700; margin-bottom: 4px;">
                Consistency is the key to mastery. Have a high-yield study day! ✨
              </div>
              <div style="font-size: 11px; color: #8A8F80; margin-bottom: 8px;">
                🛡️ 3-Tier Multi-Layer Auto-Sync: Local Instant Cache • Continuous Cloud Firestore • Google Drive Academic Vault
              </div>
              <div style="font-size: 10px; color: #A5A58D;">
                Automated Gmail Morning Briefing Service • AI Personal Study Planner & Organizer
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return { subject, html, text };
}

/**
 * Formats and Base64URL-encodes an RFC 2822 compliant email message.
 * Ensures UTF-8 subject and body (with emojis) are base64-encoded to prevent corruption across SMTP mail agents.
 */
function createRawEmail(to: string, from: string, subject: string, htmlContent: string, textContent: string): string {
  const boundary = `STUDY_PLANNER_BOUND_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const utf8Subject = `=?UTF-8?B?${utf8ToBase64(subject)}?=`;
  const textBase64 = utf8ToBase64(textContent);
  const htmlBase64 = utf8ToBase64(htmlContent);

  const headerLines = [
    `To: ${to.trim()}`,
    from ? `From: ${from.trim()}` : `To: ${to.trim()}`,
    `Subject: ${utf8Subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`
  ];

  const emailLines = [
    headerLines.join('\r\n'),
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    textBase64,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    htmlBase64,
    '',
    `--${boundary}--`
  ];

  const fullEmail = emailLines.join('\r\n');
  return base64UrlEncode(fullEmail);
}

/**
 * Sends an email via the Gmail REST API (users.messages.send).
 */
export async function sendDailyAgendaEmail(data: AgendaEmailData, accessToken: string): Promise<{ success: boolean; messageId?: string }> {
  const { recipientEmail } = data;
  const { subject, html, text } = generateAgendaEmailContent(data);

  const currentUser = auth.currentUser;
  const senderEmail = currentUser?.email || recipientEmail;

  console.log(`[GmailService] Dispatching Daily Agenda email to: ${recipientEmail} from: ${senderEmail}`);

  const rawMessage = createRawEmail(recipientEmail, senderEmail, subject, html, text);

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      raw: rawMessage
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Gmail API send error:', errorData);
    const detailMsg = errorData.error?.message || `Gmail API request returned HTTP ${response.status}`;
    throw new Error(detailMsg);
  }

  const result = await response.json();
  console.log(`[GmailService] Email successfully delivered. Message ID: ${result.id}`);
  return {
    success: true,
    messageId: result.id
  };
}

export interface StudySessionEmailData {
  recipientEmail: string;
  recipientName?: string;
  subjectName: string;
  chapterName: string;
  topicName: string;
  durationMinutes: number;
  startTime?: string;
  endTime?: string;
  result: string;
  notes?: string;
  todayTotalMinutes?: number;
  dateStr?: string;
}

/**
 * Generates email content for a completed study timer session.
 */
export function generateStudySessionEmailContent(data: StudySessionEmailData): { subject: string; html: string; text: string } {
  const {
    recipientName = 'Student',
    subjectName,
    chapterName,
    topicName,
    durationMinutes,
    startTime = '',
    endTime = '',
    result,
    notes = '',
    todayTotalMinutes = durationMinutes,
    dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
  } = data;

  const subject = `⏱️ Study Session Logged: ${subjectName} — ${topicName} (${durationMinutes}m)`;
  const baseUrl = DEFAULT_APP_BASE_URL;

  const resultBadge = result === 'Completed'
    ? '<span style="background-color: #d1fae5; color: #065f46; padding: 4px 10px; border-radius: 9999px; font-weight: bold; font-size: 11px;">✅ Topic Fully Completed</span>'
    : result === 'Partially completed'
    ? '<span style="background-color: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 9999px; font-weight: bold; font-size: 11px;">⚠️ Partially Completed</span>'
    : '<span style="background-color: #ffe4e6; color: #9f1239; padding: 4px 10px; border-radius: 9999px; font-weight: bold; font-size: 11px;">❌ Needs Review</span>';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FAF9F5; margin: 0; padding: 24px; color: #2D312E;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #E3DED4; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
    <tr>
      <td style="background-color: #6B705C; padding: 24px 30px; text-align: left;">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #DDBEA9; font-weight: 700; margin-bottom: 4px;">StudyOS Focus Timer Log</div>
        <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">Study Session Completed</h1>
        <div style="color: #EAE7DF; font-size: 13px; margin-top: 4px;">${dateStr}</div>
      </td>
    </tr>
    <tr>
      <td style="padding: 28px 30px;">
        <p style="font-size: 15px; line-height: 1.5; color: #4A4E4D; margin-top: 0;">
          Hi <strong>${recipientName}</strong>, great focus! Here is the summary of your completed study session:
        </p>

        <!-- Metric Highlight Card -->
        <div style="background-color: #F4F1EA; border: 1px solid #E3DED4; border-radius: 16px; padding: 20px; margin: 20px 0; text-align: center;">
          <div style="font-size: 36px; font-weight: 800; color: #6B705C; line-height: 1;">${durationMinutes} <span style="font-size: 18px; font-weight: 600;">mins</span></div>
          <div style="font-size: 12px; color: #858575; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-top: 6px;">Focused Time Logged</div>
          <div style="margin-top: 12px;">${resultBadge}</div>
        </div>

        <!-- Session Details Table -->
        <table width="100%" border="0" cellspacing="0" cellpadding="8" style="font-size: 14px; color: #4A4E4D; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="border-bottom: 1px solid #EAE7DF;">
            <td style="font-weight: 600; color: #858575; width: 35%;">Subject</td>
            <td style="font-weight: 700; color: #2D312E;">${subjectName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #EAE7DF;">
            <td style="font-weight: 600; color: #858575;">Chapter / Unit</td>
            <td style="color: #2D312E;">${chapterName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #EAE7DF;">
            <td style="font-weight: 600; color: #858575;">Topic Focused</td>
            <td style="font-weight: 600; color: #6B705C;">${topicName}</td>
          </tr>
          ${startTime || endTime ? `
          <tr style="border-bottom: 1px solid #EAE7DF;">
            <td style="font-weight: 600; color: #858575;">Time Window</td>
            <td style="color: #2D312E;">${startTime || '—'} &rarr; ${endTime || '—'}</td>
          </tr>
          ` : ''}
          <tr style="border-bottom: 1px solid #EAE7DF;">
            <td style="font-weight: 600; color: #858575;">Today's Total Study</td>
            <td style="font-weight: 700; color: #2D312E;">${Math.floor(todayTotalMinutes / 60)}h ${todayTotalMinutes % 60}m</td>
          </tr>
        </table>

        ${notes ? `
        <!-- Session Notes -->
        <div style="background-color: #FAF8F5; border-left: 4px solid #6B705C; padding: 14px 18px; border-radius: 4px 12px 12px 4px; margin: 20px 0;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #858575; margin-bottom: 4px;">Session Notes / Takeaways</div>
          <div style="font-size: 14px; color: #2D312E; line-height: 1.5;">${notes}</div>
        </div>
        ` : ''}

        <!-- CTA Buttons -->
        <div style="text-align: center; margin-top: 30px; margin-bottom: 10px;">
          <a href="${baseUrl}?tab=timer" style="display: inline-block; background-color: #6B705C; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 9999px; font-weight: 700; font-size: 13px; margin: 4px;">Resume Focus Timer</a>
          <a href="${baseUrl}?tab=dashboard" style="display: inline-block; background-color: #F4F1EA; color: #4A4E4D; text-decoration: none; padding: 12px 24px; border-radius: 9999px; font-weight: 700; font-size: 13px; border: 1px solid #E3DED4; margin: 4px;">Open Dashboard</a>
        </div>
      </td>
    </tr>
    <tr>
      <td style="background-color: #FAF8F5; padding: 18px 30px; border-top: 1px solid #E3DED4; text-align: center; font-size: 11px; color: #A5A58D;">
        Sent automatically from your StudyOS Academic Workspace. Keep up the consistent momentum!
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
STUDYOS STUDY SESSION COMPLETED
===============================
Date: ${dateStr}
Student: ${recipientName}

FOCUS METRICS:
- Subject: ${subjectName}
- Chapter: ${chapterName}
- Topic: ${topicName}
- Duration: ${durationMinutes} minutes (${startTime} - ${endTime})
- Status: ${result}
- Cumulative Study Today: ${Math.floor(todayTotalMinutes / 60)}h ${todayTotalMinutes % 60}m

${notes ? `NOTES / TAKEAWAYS:\n${notes}\n\n` : ''}
OPEN STUDYOS:
- Focus Timer: ${baseUrl}?tab=timer
- Dashboard: ${baseUrl}?tab=dashboard
`.trim();

  return { subject, html, text };
}

/**
 * Sends a single study session record directly via Gmail.
 */
export async function sendStudySessionEmail(
  data: StudySessionEmailData,
  tokenOverride?: string
): Promise<{ success: boolean; messageId?: string }> {
  const token = tokenOverride || await getOrRequestGmailToken();
  const { recipientEmail } = data;
  const { subject, html, text } = generateStudySessionEmailContent(data);

  const currentUser = auth.currentUser;
  const senderEmail = currentUser?.email || recipientEmail;

  const rawMessage = createRawEmail(recipientEmail, senderEmail, subject, html, text);

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw: rawMessage })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gmail send failed with status ${response.status}`);
  }

  const result = await response.json();
  return { success: true, messageId: result.id };
}

export interface DailyCompletedWorkData {
  recipientEmail: string;
  recipientName?: string;
  dateStr?: string;
  completedTopics: { topicName: string; subjectName: string; duration?: number }[];
  todaySessions: StudySession[];
  totalStudyMinutes: number;
  completedAssignments?: { title: string; subjectName: string }[];
  testResults?: TestResult[];
  userProfile?: UserProfile | null;
  reflectionNotes?: string;
}

/**
 * Generates email content for all completed work of the day.
 */
export function generateDailyCompletedWorkContent(data: DailyCompletedWorkData): { subject: string; html: string; text: string } {
  const {
    recipientName = 'Student',
    dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }),
    completedTopics = [],
    todaySessions = [],
    totalStudyMinutes = 0,
    completedAssignments = [],
    testResults = [],
    userProfile = null,
    reflectionNotes = ''
  } = data;

  const hours = Math.floor(totalStudyMinutes / 60);
  const mins = totalStudyMinutes % 60;
  const timeDisplay = `${hours}h ${mins}m`;

  const subject = `✨ Daily Work Completed Report: ${timeDisplay} Focused (${completedTopics.length} topics done) — ${dateStr}`;
  const baseUrl = DEFAULT_APP_BASE_URL;

  const targetHours = userProfile?.targetHoursPerDay || 3;
  const targetMinutes = targetHours * 60;
  const targetPercent = targetMinutes > 0 ? Math.min(100, Math.round((totalStudyMinutes / targetMinutes) * 100)) : 100;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FAF9F5; margin: 0; padding: 24px; color: #2D312E;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #E3DED4; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
    <tr>
      <td style="background-color: #4A4E4D; padding: 26px 32px; text-align: left;">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #DDBEA9; font-weight: 700; margin-bottom: 4px;">StudyOS Daily Accomplishment Report</div>
        <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">Completed Work For Today</h1>
        <div style="color: #EAE7DF; font-size: 13px; margin-top: 4px;">${dateStr}</div>
      </td>
    </tr>
    <tr>
      <td style="padding: 28px 32px;">
        <p style="font-size: 15px; line-height: 1.5; color: #4A4E4D; margin-top: 0;">
          Hi <strong>${recipientName}</strong>, congratulations on completing your academic work for today! Here is your official summary:
        </p>

        <!-- Stats Bar -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 20px 0; border: 1px solid #E3DED4; border-radius: 16px; background-color: #F4F1EA; overflow: hidden;">
          <tr>
            <td style="width: 33.33%; padding: 18px; text-align: center; border-right: 1px solid #E3DED4;">
              <div style="font-size: 26px; font-weight: 800; color: #6B705C;">${timeDisplay}</div>
              <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #858575; margin-top: 4px;">Time Focused</div>
            </td>
            <td style="width: 33.33%; padding: 18px; text-align: center; border-right: 1px solid #E3DED4;">
              <div style="font-size: 26px; font-weight: 800; color: #2D312E;">${completedTopics.length}</div>
              <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #858575; margin-top: 4px;">Topics Done</div>
            </td>
            <td style="width: 33.33%; padding: 18px; text-align: center;">
              <div style="font-size: 26px; font-weight: 800; color: ${targetPercent >= 100 ? '#059669' : '#D97706'};">${targetPercent}%</div>
              <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #858575; margin-top: 4px;">Daily Target (${targetHours}h)</div>
            </td>
          </tr>
        </table>

        <!-- Completed Topics -->
        <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #6B705C; margin: 24px 0 10px 0;">
          Topics Completed Today (${completedTopics.length})
        </h3>
        ${completedTopics.length > 0 ? `
        <table width="100%" border="0" cellspacing="0" cellpadding="10" style="border-collapse: collapse; font-size: 13px; border: 1px solid #E3DED4; border-radius: 12px; overflow: hidden;">
          ${completedTopics.map(t => `
          <tr style="border-bottom: 1px solid #EAE7DF; background-color: #FAF8F5;">
            <td style="width: 30px; text-align: center; color: #059669; font-weight: bold;">&#10003;</td>
            <td style="font-weight: 700; color: #2D312E;">${t.topicName}</td>
            <td style="text-align: right; color: #858575; font-size: 12px;">${t.subjectName}</td>
          </tr>
          `).join('')}
        </table>
        ` : `
        <div style="padding: 14px; background-color: #FAF8F5; border-radius: 10px; font-size: 13px; color: #858575; text-align: center; border: 1px dashed #E3DED4;">
          No specific plan topics checked today. Great job on your focused sessions!
        </div>
        `}

        <!-- Study Sessions Logged -->
        <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #6B705C; margin: 24px 0 10px 0;">
          Study Timer Sessions Logged (${todaySessions.length})
        </h3>
        ${todaySessions.length > 0 ? `
        <table width="100%" border="0" cellspacing="0" cellpadding="10" style="border-collapse: collapse; font-size: 13px; border: 1px solid #E3DED4; border-radius: 12px; overflow: hidden;">
          ${todaySessions.map(s => `
          <tr style="border-bottom: 1px solid #EAE7DF; background-color: #ffffff;">
            <td style="font-weight: 700; color: #2D312E;">${s.topicName} <span style="font-weight: normal; color: #858575; font-size: 11px;">(${s.subjectName})</span></td>
            <td style="text-align: center; font-size: 11px; color: #858575;">${s.startTime || ''} - ${s.endTime || ''}</td>
            <td style="text-align: right; font-weight: 700; color: #6B705C;">${s.durationMinutes}m</td>
          </tr>
          `).join('')}
        </table>
        ` : `
        <div style="padding: 14px; background-color: #FAF8F5; border-radius: 10px; font-size: 13px; color: #858575; text-align: center; border: 1px dashed #E3DED4;">
          No timer sessions recorded today.
        </div>
        `}

        ${completedAssignments.length > 0 ? `
        <!-- Completed Assignments -->
        <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #6B705C; margin: 24px 0 10px 0;">
          Assignments Completed (${completedAssignments.length})
        </h3>
        <ul style="font-size: 13px; color: #4A4E4D; padding-left: 20px; line-height: 1.6;">
          ${completedAssignments.map(a => `<li><strong>${a.title}</strong> (${a.subjectName})</li>`).join('')}
        </ul>
        ` : ''}

        ${reflectionNotes ? `
        <div style="background-color: #FAF8F5; border-left: 4px solid #6B705C; padding: 14px 18px; border-radius: 4px 12px 12px 4px; margin: 22px 0;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #858575; margin-bottom: 4px;">Day Reflection / Achievements</div>
          <div style="font-size: 14px; color: #2D312E; line-height: 1.5;">${reflectionNotes}</div>
        </div>
        ` : ''}

        <!-- CTA Buttons -->
        <div style="text-align: center; margin-top: 30px;">
          <a href="${baseUrl}?tab=dashboard" style="display: inline-block; background-color: #6B705C; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 9999px; font-weight: 700; font-size: 13px; margin: 4px;">View Full Dashboard</a>
          <a href="${baseUrl}?tab=planner" style="display: inline-block; background-color: #F4F1EA; color: #4A4E4D; text-decoration: none; padding: 12px 24px; border-radius: 9999px; font-weight: 700; font-size: 13px; border: 1px solid #E3DED4; margin: 4px;">Plan Tomorrow's Schedule</a>
        </div>
      </td>
    </tr>
    <tr>
      <td style="background-color: #FAF8F5; padding: 18px 32px; border-top: 1px solid #E3DED4; text-align: center; font-size: 11px; color: #A5A58D;">
        Sent directly from StudyOS Academic Workspace. Excellent consistency today!
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
STUDYOS COMPLETED WORK REPORT
=============================
Date: ${dateStr}
Student: ${recipientName}
Total Focused Time: ${timeDisplay} (${targetPercent}% of daily ${targetHours}h goal)

COMPLETED TOPICS (${completedTopics.length}):
${completedTopics.map(t => `- ${t.topicName} (${t.subjectName})`).join('\n') || '(None)'}

STUDY SESSIONS LOGGED (${todaySessions.length}):
${todaySessions.map(s => `- ${s.topicName} (${s.subjectName}): ${s.durationMinutes}m [${s.startTime || ''} - ${s.endTime || ''}]`).join('\n') || '(None)'}

${completedAssignments.length > 0 ? `COMPLETED ASSIGNMENTS:\n${completedAssignments.map(a => `- ${a.title} (${a.subjectName})`).join('\n')}\n` : ''}
${reflectionNotes ? `DAY REFLECTION:\n${reflectionNotes}\n` : ''}

DASHBOARD: ${baseUrl}?tab=dashboard
`.trim();

  return { subject, html, text };
}

/**
 * Sends a daily completed work summary report via Gmail API.
 */
export async function sendDailyCompletedWorkEmail(
  data: DailyCompletedWorkData,
  tokenOverride?: string
): Promise<{ success: boolean; messageId?: string }> {
  const token = tokenOverride || await getOrRequestGmailToken();
  const { recipientEmail } = data;
  const { subject, html, text } = generateDailyCompletedWorkContent(data);

  const currentUser = auth.currentUser;
  const senderEmail = currentUser?.email || recipientEmail;

  const rawMessage = createRawEmail(recipientEmail, senderEmail, subject, html, text);

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw: rawMessage })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gmail send failed with status ${response.status}`);
  }

  const result = await response.json();
  return { success: true, messageId: result.id };
}

export interface TestImprovementEmailData {
  recipientEmail: string;
  recipientName?: string;
  dateStr?: string;
  testResults: TestResult[];
  subjects: Subject[];
  userProfile: UserProfile | null;
  customNote?: string;
  focusTestId?: string;
}

/**
 * Generates rich HTML and plain-text email for Test Scores & Improvement Combinations.
 */
export function generateTestImprovementEmailContent(data: TestImprovementEmailData): { subject: string; html: string; text: string } {
  const {
    recipientName = 'Student',
    dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }),
    testResults,
    customNote,
    focusTestId
  } = data;

  const targetTests = focusTestId 
    ? testResults.filter(t => t.id === focusTestId)
    : testResults;

  const displayTests = targetTests.length > 0 ? targetTests : testResults;
  
  const subject = focusTestId && displayTests[0]
    ? `🎯 Test Diagnostic & Improvement Plan: ${displayTests[0].testName} (${displayTests[0].score})`
    : `📊 Comprehensive Test Scores & AI Improvement Diagnostic Report (${dateStr})`;

  const allPrompts: { testName: string; subjectName: string; prompt: string }[] = [];
  displayTests.forEach(t => {
    if (t.analysis?.tutorPrompts) {
      t.analysis.tutorPrompts.forEach(p => {
        allPrompts.push({ testName: t.testName, subjectName: t.subjectName, prompt: p });
      });
    }
  });

  let text = `=================================================================\n`;
  text += `TEST SCORES & AI IMPROVEMENT DIAGNOSTIC REPORT\n`;
  text += `Date: ${dateStr} | Prepared for: ${recipientName}\n`;
  text += `=================================================================\n\n`;

  if (customNote) {
    text += `Personal Note: "${customNote}"\n\n`;
  }

  text += `--- 1. RECORDED TEST MARKS & MISTAKES BREAKDOWN ---\n`;
  if (displayTests.length === 0) {
    text += `No test scores recorded yet.\n`;
  } else {
    displayTests.forEach((t, idx) => {
      text += `\n[Test ${idx + 1}] ${t.testName} (${t.subjectName})\n`;
      text += `• Score/Marks: ${t.score}\n`;
      text += `• Date: ${t.date}\n`;
      if (t.mistakes) {
        text += `• Mistakes & Struggles: ${t.mistakes}\n`;
      }
      if (t.analysis) {
        text += `• AI Diagnostic: What went wrong -> ${t.analysis.whatWentWrong}\n`;
        text += `• Root Concept Gap: ${t.analysis.weakConcept}\n`;
        text += `• What to Revise: ${t.analysis.whatToRevise}\n`;
      }
    });
  }

  text += `\n--- 2. ACTIONABLE COMBINATIONS TO IMPROVE SCORE ---\n`;
  text += `Combination A (Targeted Remediation): Revisit foundational textbook notes & chapter fundamentals for the weak topics identified above.\n`;
  text += `Combination B (Active Recall Practice): Use spaced 20-30 minute active question sprints on similar test-level problem sets.\n`;
  text += `Combination C (Smart Schedule Adjustment): Reserve a light study day in your weekly planner to re-attempt the missed questions.\n`;

  if (allPrompts.length > 0) {
    text += `\n--- 3. READY-TO-USE AI TUTOR PRACTICE PROMPTS ---\n`;
    text += `You can copy and use any of these prompts with your AI Tutor:\n\n`;
    allPrompts.forEach((p, idx) => {
      text += `${idx + 1}. [${p.subjectName}] "${p.prompt}"\n`;
    });
  }

  text += `\n--- 4. DATA PERSISTENCE & AUTO-SYNC ARCHITECTURE ---\n`;
  text += `✓ Tier 1: Instant Zero-Latency Cache (Safe from tab crashes / network drops)\n`;
  text += `✓ Tier 2: Google Cloud Firestore Database (Continuous auto-sync)\n`;
  text += `✓ Tier 3: Google Drive Academic Workspace & Mirror\n`;
  text += `\n---\nSent from your AI Personal Study Planner & Diagnostic Engine.\n`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F7F5F0; color: #333830;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F7F5F0; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="620" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #ffffff; border: 1px solid #E0DBD0; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          
          <tr>
            <td style="background-color: #6B705C; padding: 28px 24px; text-align: left;">
              <div style="font-size: 11px; font-weight: bold; letter-spacing: 2px; color: #DDBEA9; text-transform: uppercase; margin-bottom: 6px;">
                ACADEMIC PERFORMANCE & DIAGNOSTIC REPORT
              </div>
              <h1 style="margin: 0; font-size: 22px; color: #FFFFFF; font-weight: 700; line-height: 1.3;">
                Test Scores & Improvement Combinations
              </h1>
              <div style="font-size: 13px; color: #EAE7DF; margin-top: 6px;">
                📅 ${dateStr} • Prepared for ${recipientName}
              </div>
            </td>
          </tr>

          ${customNote ? `
          <tr>
            <td style="padding: 16px 24px 0 24px;">
              <div style="background-color: #FFFDF8; border-left: 3px solid #6B705C; padding: 12px 16px; border-radius: 6px; font-size: 13px; color: #4A4E4D; font-style: italic;">
                "${customNote}"
              </div>
            </td>
          </tr>
          ` : ''}

          <tr>
            <td style="padding: 20px 24px 12px 24px;">
              <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; color: #6B705C; margin-bottom: 12px; border-bottom: 2px solid #F2EFE9; padding-bottom: 6px;">
                📝 1. Recorded Test Results & Mistakes Analysis (${displayTests.length} Tests)
              </div>

              ${displayTests.length > 0 ? displayTests.map(t => `
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF8F4; border: 1px solid #EAE7DF; border-radius: 14px; margin-bottom: 14px; padding: 16px;">
                  <tr>
                    <td>
                      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                        <div>
                          <span style="display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase; background-color: #EAE7DF; color: #6B705C; padding: 3px 8px; border-radius: 6px;">
                            ${t.subjectName}
                          </span>
                          <span style="font-size: 11px; color: #8A8F80; margin-left: 6px; font-family: monospace;">
                            ${t.date}
                          </span>
                        </div>
                        <div style="background-color: #6B705C; color: #ffffff; font-weight: 800; font-size: 13px; padding: 3px 10px; border-radius: 12px; font-family: monospace;">
                          Score: ${t.score}
                        </div>
                      </div>

                      <div style="font-size: 16px; font-weight: 700; color: #2D3748; margin-bottom: 6px;">
                        ${t.testName}
                      </div>

                      ${(t.topicNumbers && t.topicNumbers.length > 0) || (t.struggledTopics && t.struggledTopics.length > 0) ? `
                        <div style="margin-bottom: 8px;">
                          <div style="font-size: 11px; font-weight: 700; color: #4A4E4D; margin-bottom: 4px;">📚 Evaluated Topics:</div>
                          <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                            ${(t.topicNumbers || []).map((num, i) => `
                              <span style="display: inline-block; font-size: 10px; font-weight: 700; background-color: #E2E8F0; color: #2D3748; padding: 2px 7px; border-radius: 4px; font-family: monospace;">
                                Topic ${num}${(t.topicNames && t.topicNames[i]) ? `: ${t.topicNames[i]}` : ''}
                              </span>
                            `).join('')}
                            ${(t.struggledTopics || []).filter(st => !(t.topicNumbers || []).includes(st)).map(st => `
                              <span style="display: inline-block; font-size: 10px; background-color: #FED7D7; color: #742A2A; padding: 2px 7px; border-radius: 4px;">
                                ${st}
                              </span>
                            `).join('')}
                          </div>
                        </div>
                      ` : ''}

                      ${t.mistakes ? `
                        <div style="background-color: #FFF5F5; border-left: 3px solid #E53E3E; padding: 10px 12px; border-radius: 6px; margin: 8px 0; font-size: 12px; color: #742A2A;">
                          <strong>Recorded Difficulties & Mistakes:</strong> ${t.mistakes}
                        </div>
                      ` : ''}

                      ${t.analysis ? `
                        <div style="background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; margin-top: 8px; font-size: 12px; color: #4A5568;">
                          <div style="font-weight: 700; color: #6B705C; margin-bottom: 4px;">🔍 AI Diagnostic Gap:</div>
                          <div style="margin-bottom: 4px;">• <strong>What Went Wrong:</strong> ${t.analysis.whatWentWrong}</div>
                          <div style="margin-bottom: 4px;">• <strong>Root Concept Gap:</strong> ${t.analysis.weakConcept}</div>
                          <div>• <strong>Recommended Focus:</strong> ${t.analysis.whatToRevise}</div>

                          ${t.analysis.topicBreakdown && t.analysis.topicBreakdown.length > 0 ? `
                            <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #CBD5E0;">
                              <div style="font-weight: 700; color: #2D3748; font-size: 11px; margin-bottom: 4px;">🎯 Topic-by-Topic Remediation:</div>
                              ${t.analysis.topicBreakdown.map(tb => `
                                <div style="margin-bottom: 4px; font-size: 11px; background-color: #F8FAFC; padding: 4px 8px; border-radius: 4px;">
                                  <strong>[Topic ${tb.topicNumber} - ${tb.topicName}]:</strong> ${tb.specificDifficulty || tb.conceptualGap || 'Targeted drill recommended'}
                                </div>
                              `).join('')}
                            </div>
                          ` : ''}
                        </div>
                      ` : ''}
                    </td>
                  </tr>
                </table>
              `).join('') : `
                <div style="background-color: #F9F7F2; border: 1px dashed #E0DBD0; border-radius: 12px; padding: 16px; text-align: center; color: #8A8F80; font-size: 13px;">
                  No test results found to summarize.
                </div>
              `}
            </td>
          </tr>

          <tr>
            <td style="padding: 12px 24px;">
              <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; color: #2E7D32; margin-bottom: 12px; border-bottom: 2px solid #F2EFE9; padding-bottom: 6px;">
                💡 2. Recommended Improvement Combinations
              </div>

              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F4FAF5; border: 1px solid #C6F6D5; border-radius: 14px; padding: 14px; margin-bottom: 10px;">
                <tr>
                  <td style="padding-bottom: 8px;">
                    <div style="font-weight: 700; font-size: 13px; color: #22543D;">Combination 1: Targeted Syllabus Remediation</div>
                    <div style="font-size: 12px; color: #276749; margin-top: 2px;">
                      Revisit the foundational concepts for missed questions before moving forward to advanced subtopics.
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-top: 1px solid #E2E8F0;">
                    <div style="font-weight: 700; font-size: 13px; color: #22543D;">Combination 2: Active Recall & AI Tutor Prompts</div>
                    <div style="font-size: 12px; color: #276749; margin-top: 2px;">
                      Use the structured practice prompts below to quiz yourself interactively and fill concept gaps.
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 8px; border-top: 1px solid #E2E8F0;">
                    <div style="font-weight: 700; font-size: 13px; color: #22543D;">Combination 3: Smart Schedule Adjustment</div>
                    <div style="font-size: 12px; color: #276749; margin-top: 2px;">
                      Allocate a 30-45 minute slot on a light study day this week specifically dedicated to re-attempting missed problems.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${allPrompts.length > 0 ? `
          <tr>
            <td style="padding: 12px 24px;">
              <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; color: #6B705C; margin-bottom: 12px; border-bottom: 2px solid #F2EFE9; padding-bottom: 6px;">
                🤖 3. Ready-To-Use AI Tutor Practice Prompts (${allPrompts.length})
              </div>

              ${allPrompts.slice(0, 5).map((p, idx) => `
                <div style="background-color: #FAF8F4; border: 1px solid #EAE7DF; border-radius: 10px; padding: 12px; margin-bottom: 8px; font-size: 12px;">
                  <div style="font-weight: 700; color: #6B705C; margin-bottom: 4px;">Prompt ${idx + 1} (${p.subjectName}):</div>
                  <div style="font-style: italic; color: #2D3748; background-color: #ffffff; padding: 8px 10px; border-radius: 6px; border: 1px solid #E2E8F0;">
                    "${p.prompt}"
                  </div>
                </div>
              `).join('')}
            </td>
          </tr>
          ` : ''}

          <tr>
            <td style="background-color: #F2EFE9; padding: 20px 24px; text-align: center; border-top: 1px solid #E0DBD0;">
              <div style="font-size: 12px; color: #6B705C; font-weight: 600; margin-bottom: 4px;">
                Learn from every mistake and turn it into mastery! ✨
              </div>
              <div style="font-size: 10px; color: #A5A58D;">
                Generated by your AI Personal Study Planner & Test Diagnostic Suite
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return { subject, html, text };
}

export async function sendTestImprovementEmail(data: TestImprovementEmailData, accessToken: string): Promise<{ success: boolean; messageId?: string }> {
  const { recipientEmail } = data;
  const { subject, html, text } = generateTestImprovementEmailContent(data);

  const currentUser = auth.currentUser;
  const senderEmail = currentUser?.email || recipientEmail;

  console.log(`[GmailService] Dispatching Test Diagnostic email to: ${recipientEmail} from: ${senderEmail}`);

  const rawMessage = createRawEmail(recipientEmail, senderEmail, subject, html, text);

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      raw: rawMessage
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Gmail API send error:', errorData);
    const detailMsg = errorData.error?.message || `Gmail API request returned HTTP ${response.status}`;
    throw new Error(detailMsg);
  }

  const result = await response.json();
  console.log(`[GmailService] Test diagnostic email successfully delivered. Message ID: ${result.id}`);
  return {
    success: true,
    messageId: result.id
  };
}

/**
 * Records a delivery attempt in the Morning Briefing history log
 */
export function recordBriefingLog(item: Omit<MorningBriefingLogItem, 'id' | 'timestamp'>) {
  try {
    const config = getMorningBriefingConfig();
    const logItem: MorningBriefingLogItem = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      ...item
    };
    const updatedHistory = [logItem, ...(config.history || [])].slice(0, 50);
    const updatedConfig: MorningBriefingConfig = {
      ...config,
      history: updatedHistory,
      lastDispatchedDate: item.status === 'Delivered' ? item.date : config.lastDispatchedDate,
      lastDispatchedTimestamp: item.status === 'Delivered' ? Date.now() : config.lastDispatchedTimestamp
    };
    saveMorningBriefingConfig(updatedConfig);
    return updatedConfig;
  } catch (e) {
    console.warn('Failed to record briefing log:', e);
    return null;
  }
}

/**
 * Dispatches today's Morning Briefing immediately to the user's primary email.
 */
export async function dispatchMorningBriefingNow(params: {
  todayPlan: StudyPlan | null;
  todaySessions: StudySession[];
  subjects: Subject[];
  revisions: RevisionItem[];
  userProfile: UserProfile | null;
  testResults?: TestResult[];
  assignments?: Assignment[];
  missedWork?: MissedWorkItem[];
  recipientEmailOverride?: string;
  forceTokenPrompt?: boolean;
}): Promise<{ success: boolean; messageId?: string; message: string }> {
  const {
    todayPlan,
    todaySessions,
    subjects,
    revisions,
    userProfile,
    testResults = [],
    assignments = [],
    missedWork = [],
    recipientEmailOverride,
    forceTokenPrompt = false
  } = params;

  const config = getMorningBriefingConfig();
  const recipientEmail = (recipientEmailOverride || config.recipientEmail || auth.currentUser?.email || userProfile?.email || '').trim();
  const recipientName = config.recipientName || userProfile?.displayName || auth.currentUser?.displayName || 'Student';

  const todayStr = getLocalTodayStr();
  const todayFormatted = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const tasksCount = todayPlan ? todayPlan.topics.length : 0;
  const completedCount = todayPlan ? todayPlan.topics.filter(t => t.completed).length : 0;

  setBriefingWorkerState({
    status: 'dispatching',
    lastMessage: `Dispatching Morning Agenda to ${recipientEmail}...`,
    isLocked: true
  });

  try {
    let token = getCachedGmailToken();
    if (!token) {
      if (forceTokenPrompt) {
        token = await getOrRequestGmailToken();
      } else {
        setBriefingWorkerState({
          status: 'needs_auth',
          lastMessage: 'Google authorization required for automated briefing dispatch.',
          isLocked: false
        });
        throw new Error('Gmail authorization required. Please click "Authorize & Send Briefing" once to connect your Google account.');
      }
    }

    const agendaData: AgendaEmailData = {
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
      customNote: config.customDailyNote,
      baseUrl: DEFAULT_APP_BASE_URL
    };

    const res = await sendDailyAgendaEmail(agendaData, token);

    recordBriefingLog({
      date: todayStr,
      status: 'Delivered',
      recipient: recipientEmail,
      tasksCount,
      completedCount,
      messageId: res.messageId
    });

    const successMessage = `Morning Briefing sent to ${recipientEmail} (ID: ${res.messageId})`;

    setBriefingWorkerState({
      status: 'dispatched_today',
      lastDispatchedDate: todayStr,
      lastDispatchedTimestamp: Date.now(),
      lastSuccessMessageId: res.messageId,
      lastMessage: successMessage,
      isLocked: false
    });

    return {
      success: true,
      messageId: res.messageId,
      message: successMessage
    };
  } catch (error: any) {
    const errorMsg = error?.message || 'Failed to dispatch email';
    recordBriefingLog({
      date: todayStr,
      status: 'Failed',
      recipient: recipientEmail,
      tasksCount,
      completedCount,
      error: errorMsg
    });

    setBriefingWorkerState({
      status: errorMsg.includes('authorization') || errorMsg.includes('OAuth') ? 'needs_auth' : 'failed',
      lastMessage: errorMsg,
      isLocked: false
    });

    throw new Error(errorMsg);
  }
}

/**
 * Checks whether current system time meets the target threshold (default 7:30 AM)
 */
export function isThresholdTimeMet(targetTimeString: string = '07:30'): boolean {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const [targetHourStr, targetMinuteStr] = targetTimeString.split(':');
  const targetHour = parseInt(targetHourStr || '7', 10);
  const targetMinute = parseInt(targetMinuteStr || '30', 10);

  return (currentHour > targetHour) || (currentHour === targetHour && currentMinute >= targetMinute);
}

/**
 * Evaluates whether automated briefing should fire right now.
 * Strictly guarantees once-per-day dispatch using the local date tracker.
 */
export async function checkAndTriggerAutomatedBriefing(params: {
  todayPlan: StudyPlan | null;
  todaySessions: StudySession[];
  subjects: Subject[];
  revisions: RevisionItem[];
  userProfile: UserProfile | null;
  testResults?: TestResult[];
  assignments?: Assignment[];
  missedWork?: MissedWorkItem[];
}): Promise<{ triggered: boolean; message?: string }> {
  currentWorkerParams = params;
  const config = getMorningBriefingConfig();
  const localToday = getLocalTodayStr();
  const currentState = getBriefingWorkerState();

  if (!config.enabled) {
    setBriefingWorkerState({
      status: 'idle',
      lastMessage: 'Morning Briefing is currently disabled in Settings.'
    });
    return { triggered: false, message: 'Automated briefing is disabled in settings.' };
  }

  // 1. Idempotency Check: Already successfully dispatched for today
  if (currentState.lastDispatchedDate === localToday || config.lastDispatchedDate === localToday) {
    if (currentState.status !== 'dispatched_today') {
      setBriefingWorkerState({
        status: 'dispatched_today',
        lastDispatchedDate: localToday,
        lastMessage: `Today's Morning Briefing has already been delivered.`
      });
    }
    return { triggered: false, message: 'Already dispatched for today.' };
  }

  // 2. Concurrency Lock: Check if another dispatch is currently in-flight
  if (currentState.isLocked || currentState.status === 'dispatching') {
    return { triggered: false, message: 'Briefing dispatch currently in progress.' };
  }

  // 3. Time Threshold Check (e.g. 7:30 AM local system time)
  const thresholdMet = isThresholdTimeMet(config.dispatchTime || '07:30');

  if (!thresholdMet) {
    const nextCheckMsg = `Scheduled for ${config.dispatchTime || '07:30'} AM today`;
    setBriefingWorkerState({
      status: 'idle',
      nextScheduledCheckText: nextCheckMsg,
      lastMessage: `Waiting for 7:30 AM threshold (Current time: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
    });
    return { triggered: false, message: nextCheckMsg };
  }

  // 4. Token Check & Automated Dispatch Execution
  const token = getCachedGmailToken();
  if (!token) {
    setBriefingWorkerState({
      status: 'needs_auth',
      lastMessage: '7:30 AM threshold reached. Authorize Google account to complete automated morning delivery.'
    });
    return {
      triggered: false,
      message: 'OAuth token needed for background dispatch. Sign in with Google to enable automatic morning delivery.'
    };
  }

  console.log(`[BriefingWorker] 7:30 AM threshold met for ${localToday}. Dispatching once-daily agenda...`);

  try {
    const result = await dispatchMorningBriefingNow({
      ...params,
      forceTokenPrompt: false
    });
    return { triggered: true, message: result.message };
  } catch (err: any) {
    console.warn('[BriefingWorker] Automated dispatch error:', err);
    return { triggered: false, message: err?.message || 'Dispatch error' };
  }
}

/**
 * Starts the continuous Background Worker loop that checks system time every 30s.
 */
export function startBriefingWorker(paramsProvider: () => {
  todayPlan: StudyPlan | null;
  todaySessions: StudySession[];
  subjects: Subject[];
  revisions: RevisionItem[];
  userProfile: UserProfile | null;
  testResults?: TestResult[];
  assignments?: Assignment[];
  missedWork?: MissedWorkItem[];
}) {
  if (activeWorkerTimer) {
    clearInterval(activeWorkerTimer);
  }

  const runTick = async () => {
    try {
      const params = paramsProvider();
      await checkAndTriggerAutomatedBriefing(params);
    } catch (err) {
      console.warn('[BriefingWorker] Tick failure:', err);
    }
  };

  // Run initial check immediately
  runTick();

  // Tick interval every 30 seconds
  activeWorkerTimer = setInterval(runTick, 30000);

  return () => {
    if (activeWorkerTimer) {
      clearInterval(activeWorkerTimer);
      activeWorkerTimer = null;
    }
  };
}
