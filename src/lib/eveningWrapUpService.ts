/**
 * Evening Study Wrap-Up & Retro Briefing Service
 * Generates automated daily recap reports, reflective analytics, and 1-click action links.
 */

import { Subject, StudySession, StudyPlan, RevisionItem, UserProfile, TestResult } from '../types';
import { getOrRequestGmailToken, DEFAULT_APP_BASE_URL } from './gmailService';
import { base64UrlEncode } from './base64Utils';

export interface EveningWrapUpLogItem {
  id: string;
  date: string;
  timestamp: number;
  status: 'Delivered' | 'Failed';
  recipient: string;
  totalStudyMinutes: number;
  targetMinutes: number;
  completedTasksCount: number;
  incompleteTasksCount: number;
  messageId?: string;
  error?: string;
}

export interface EveningWrapUpConfig {
  enabled: boolean;
  dispatchTime: string; // e.g. "20:00"
  recipientEmail: string;
  recipientName: string;
  reflectionPrompt?: string;
  autoSendOnEveningOpen: boolean;
  lastDispatchedDate?: string;
  lastDispatchedTimestamp?: number;
  history: EveningWrapUpLogItem[];
}

const EVENING_CONFIG_KEY = 'studyos_evening_wrapup_config';

export function getEveningWrapUpConfig(defaultEmail?: string, defaultName?: string): EveningWrapUpConfig {
  try {
    const stored = localStorage.getItem(EVENING_CONFIG_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        enabled: parsed.enabled ?? true,
        dispatchTime: parsed.dispatchTime || '20:00',
        recipientEmail: parsed.recipientEmail || defaultEmail || '',
        recipientName: parsed.recipientName || defaultName || 'Student',
        reflectionPrompt: parsed.reflectionPrompt || 'What was your biggest breakthrough today?',
        autoSendOnEveningOpen: parsed.autoSendOnEveningOpen ?? true,
        lastDispatchedDate: parsed.lastDispatchedDate,
        lastDispatchedTimestamp: parsed.lastDispatchedTimestamp,
        history: Array.isArray(parsed.history) ? parsed.history : []
      };
    }
  } catch (e) {
    console.warn('Failed to parse evening wrap-up config:', e);
  }

  return {
    enabled: true,
    dispatchTime: '20:00',
    recipientEmail: defaultEmail || '',
    recipientName: defaultName || 'Student',
    reflectionPrompt: 'What was your biggest breakthrough today?',
    autoSendOnEveningOpen: true,
    history: []
  };
}

export function saveEveningWrapUpConfig(config: EveningWrapUpConfig) {
  try {
    localStorage.setItem(EVENING_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to save evening wrap-up config:', e);
  }
}

export interface EveningWrapUpData {
  recipientEmail: string;
  recipientName?: string;
  dateStr: string;
  todayPlan: StudyPlan | null;
  todaySessions: StudySession[];
  subjects: Subject[];
  revisions: RevisionItem[];
  userProfile: UserProfile | null;
  testResults?: TestResult[];
  focusRating?: number;
  reflectionNotes?: string;
  baseUrl?: string;
}

export function generateEveningWrapUpEmailBody(data: EveningWrapUpData): { htmlBody: string; textBody: string; subjectLine: string } {
  const {
    recipientEmail = '',
    recipientName = 'Scholar',
    dateStr,
    todayPlan,
    todaySessions,
    subjects,
    revisions,
    userProfile,
    testResults = [],
    focusRating = 5,
    reflectionNotes = '',
    baseUrl = DEFAULT_APP_BASE_URL
  } = data;

  const targetHours = userProfile?.targetHoursPerDay || 3;
  const targetMinutes = targetHours * 60;
  const totalMinutesStudied = todaySessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  const hoursStudied = (totalMinutesStudied / 60).toFixed(1);
  const progressPercent = Math.min(100, Math.round((totalMinutesStudied / (targetMinutes || 1)) * 100));
  const isGoalAchieved = totalMinutesStudied >= targetMinutes && targetMinutes > 0;

  const topics = todayPlan?.topics || [];
  const completedTopics = topics.filter(t => t.completed);
  const incompleteTopics = topics.filter(t => !t.completed);

  // Subject breakdown for today's sessions
  const subjectTimeMap: { [key: string]: number } = {};
  todaySessions.forEach(s => {
    subjectTimeMap[s.subjectName] = (subjectTimeMap[s.subjectName] || 0) + (s.durationMinutes || 0);
  });

  const formattedDate = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const subjectLine = `🌙 Evening Study Wrap-Up: ${hoursStudied}h Logged (${progressPercent}% Goal Met) - ${formattedDate}`;

  // Build HTML Email
  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StudyOS Evening Wrap-Up</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F9F7F2; margin: 0; padding: 24px 12px; color: #2C302E; }
    .container { max-width: 620px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E0DBD0; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.04); }
    .header { background: #2B2D42; padding: 28px 24px; color: #FFFFFF; text-align: left; border-bottom: 3px solid #6B705C; }
    .header-badge { display: inline-block; padding: 4px 12px; background: rgba(255,255,255,0.15); border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #DDBEA9; margin-bottom: 8px; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { margin: 6px 0 0 0; font-size: 13px; color: #E0DBD0; opacity: 0.9; }
    .content { padding: 24px; }
    .stat-card-row { display: table; width: 100%; margin-bottom: 20px; }
    .stat-card { display: table-cell; width: 33.33%; padding: 12px; background: #F9F7F2; border: 1px solid #EAE7DF; border-radius: 12px; text-align: center; }
    .stat-card:not(:last-child) { border-right-width: 0; }
    .stat-value { font-size: 20px; font-weight: 800; color: #2B2D42; }
    .stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #6B705C; font-weight: 700; margin-top: 2px; }
    .banner { padding: 14px 18px; border-radius: 12px; margin-bottom: 20px; font-size: 13px; }
    .banner-success { background: #ECFDF5; border: 1px solid #A7F3D0; color: #065F46; }
    .banner-info { background: #FEF3C7; border: 1px solid #FDE68A; color: #92400E; }
    .section-title { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #6B705C; margin: 20px 0 10px 0; border-bottom: 1px solid #E0DBD0; padding-bottom: 6px; }
    .task-item { padding: 12px 14px; background: #FAF9F5; border: 1px solid #EAE7DF; border-radius: 12px; margin-bottom: 8px; font-size: 13px; }
    .task-done { border-left: 4px solid #10B981; }
    .task-missed { border-left: 4px solid #F59E0B; }
    .btn-action { display: inline-block; padding: 10px 18px; background: #6B705C; color: #FFFFFF !important; text-decoration: none; border-radius: 10px; font-size: 12px; font-weight: 700; margin-right: 8px; margin-top: 6px; }
    .btn-secondary { display: inline-block; padding: 10px 18px; background: #F2EFE9; color: #4A4E4D !important; text-decoration: none; border: 1px solid #E0DBD0; border-radius: 10px; font-size: 12px; font-weight: 700; margin-right: 8px; margin-top: 6px; }
    .footer { background: #F9F7F2; padding: 20px 24px; text-align: center; font-size: 11px; color: #A5A58D; border-top: 1px solid #E0DBD0; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="header-badge">StudyOS Evening Wrap-Up</div>
      <h1>Daily Academic Retro</h1>
      <p>Hello ${recipientName}, here is your end-of-day study retrospective for <strong>${formattedDate}</strong>.</p>
    </div>

    <!-- Content -->
    <div class="content">
      <!-- Status Banner -->
      <div class="banner ${isGoalAchieved ? 'banner-success' : 'banner-info'}">
        <strong>${isGoalAchieved ? '🎉 Daily Goal Conquered!' : '⚡ Progress Made Today'}</strong>
        <p style="margin: 4px 0 0 0;">
          ${isGoalAchieved
            ? `You completed ${hoursStudied}h of deep study, surpassing your ${targetHours}h daily objective!`
            : `You logged ${hoursStudied}h (${progressPercent}% of your ${targetHours}h target). Great dedication today.`}
        </p>
      </div>

      <!-- Quick Metrics -->
      <div class="stat-card-row">
        <div class="stat-card">
          <div class="stat-value">${hoursStudied}h</div>
          <div class="stat-label">Hours Logged</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${completedTopics.length}/${topics.length || todaySessions.length}</div>
          <div class="stat-label">Tasks Done</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${focusRating}/5 ⭐</div>
          <div class="stat-label">Focus Rating</div>
        </div>
      </div>

      <!-- Subject Time Distribution -->
      <div class="section-title">Today's Subject Distribution</div>
      ${Object.keys(subjectTimeMap).length > 0 ? `
        <div style="margin-bottom: 16px;">
          ${Object.entries(subjectTimeMap).map(([subj, mins]) => `
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
              <span><strong>${subj}</strong></span>
              <span style="color: #6B705C;">${(mins / 60).toFixed(1)}h (${mins} mins)</span>
            </div>
          `).join('')}
        </div>
      ` : '<p style="font-size: 12px; color: #A5A58D; font-style: italic;">No sessions logged for today.</p>'}

      <!-- Tasks Completed -->
      ${completedTopics.length > 0 ? `
        <div class="section-title">✅ Completed Today (${completedTopics.length})</div>
        ${completedTopics.map(t => `
          <div class="task-item task-done">
            <strong>${t.topicName}</strong> <span style="color: #6B705C;">(${t.subjectName})</span>
            <div style="font-size: 11px; color: #10B981; margin-top: 2px;">✔ Finished & Logged</div>
          </div>
        `).join('')}
      ` : ''}

      <!-- Incomplete / Carried Over Tasks -->
      ${incompleteTopics.length > 0 ? `
        <div class="section-title">⏳ Unfinished Topics to Roll Over (${incompleteTopics.length})</div>
        ${incompleteTopics.map(t => `
          <div class="task-item task-missed">
            <strong>${t.topicName}</strong> <span style="color: #6B705C;">(${t.subjectName})</span>
            <div style="font-size: 11px; color: #F59E0B; margin-top: 2px;">Estimated: ${t.estimatedMinutes}m • Priority: ${t.priority}</div>
          </div>
        `).join('')}
      ` : ''}

      <!-- Reflection Prompt -->
      ${reflectionNotes ? `
        <div class="section-title">💭 Today's Reflection Note</div>
        <div style="padding: 12px; background: #F2EFE9; border-radius: 10px; font-size: 12px; font-style: italic; color: #4A4E4D;">
          "${reflectionNotes}"
        </div>
      ` : ''}

      <!-- Action Buttons -->
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #E0DBD0;">
        <div style="font-size: 13px; font-weight: 700; color: #2B2D42; margin-bottom: 8px;">
          Ready for tomorrow? Take 1-click action:
        </div>
        <a href="${baseUrl}?action=draft_tomorrow" class="btn-action">
          🚀 Draft Tomorrow's Plan
        </a>
        <a href="${baseUrl}?action=evening_retro" class="btn-secondary">
          📝 Open In-App Retro
        </a>
        <a href="${baseUrl}?tab=flashcards" class="btn-secondary">
          🗂️ Quick 5-Min Flashcards
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>StudyOS Academic Workspace • Powered by Gemini AI & Google Workspace APIs</p>
      <p style="margin-top: 4px;">Delivered to ${recipientEmail} • Rest well and recharge for tomorrow!</p>
    </div>
  </div>
</body>
</html>`;

  const textBody = `STUDYOS EVENING STUDY WRAP-UP (${formattedDate})
Recipient: ${recipientName} (${recipientEmail})
--------------------------------------------------
Hours Studied: ${hoursStudied}h / ${targetHours}h target (${progressPercent}%)
Daily Goal: ${isGoalAchieved ? 'ACHIEVED!' : 'In Progress'}
Focus Rating: ${focusRating}/5 stars

COMPLETED TASKS (${completedTopics.length}):
${completedTopics.map(t => `- ${t.topicName} (${t.subjectName})`).join('\n') || '(None)'}

UNFINISHED TASKS (${incompleteTopics.length}):
${incompleteTopics.map(t => `- ${t.topicName} (${t.subjectName}) [${t.estimatedMinutes}m]`).join('\n') || '(None)'}

ACTIONS:
- Draft Tomorrow's Plan: ${baseUrl}?action=draft_tomorrow
- Open Evening Retro: ${baseUrl}?action=evening_retro
- Review Flashcards: ${baseUrl}?tab=flashcards
`;

  return { htmlBody, textBody, subjectLine };
}

/**
 * Dispatches the Evening Wrap-Up email via Gmail API v1.
 */
export async function sendEveningWrapUpEmail(
  data: EveningWrapUpData,
  tokenOverride?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const token = tokenOverride || await getOrRequestGmailToken();
    const { htmlBody, textBody, subjectLine } = generateEveningWrapUpEmailBody(data);

    const boundary = `====_StudyOS_Boundary_${Date.now()}_====`;
    const messageParts = [
      `To: ${data.recipientEmail}`,
      `Subject: ${subjectLine}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      textBody,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      htmlBody,
      ``,
      `--${boundary}--`
    ];

    const rawMessage = messageParts.join('\r\n');
    const base64Encoded = base64UrlEncode(rawMessage);

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: base64Encoded })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gmail send failed with status ${response.status}`);
    }

    const resData = await response.json();

    // Log to history
    const config = getEveningWrapUpConfig(data.recipientEmail, data.recipientName);
    const logItem: EveningWrapUpLogItem = {
      id: `log-eve-${Date.now()}`,
      date: data.dateStr,
      timestamp: Date.now(),
      status: 'Delivered',
      recipient: data.recipientEmail,
      totalStudyMinutes: data.todaySessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0),
      targetMinutes: (data.userProfile?.targetHoursPerDay || 3) * 60,
      completedTasksCount: (data.todayPlan?.topics || []).filter(t => t.completed).length,
      incompleteTasksCount: (data.todayPlan?.topics || []).filter(t => !t.completed).length,
      messageId: resData.id
    };

    config.lastDispatchedDate = data.dateStr;
    config.lastDispatchedTimestamp = Date.now();
    config.history = [logItem, ...(config.history || []).slice(0, 49)];
    saveEveningWrapUpConfig(config);

    return { success: true, messageId: resData.id };
  } catch (error: any) {
    console.error('Failed to send evening wrap-up email:', error);

    const config = getEveningWrapUpConfig(data.recipientEmail, data.recipientName);
    const logItem: EveningWrapUpLogItem = {
      id: `log-eve-${Date.now()}`,
      date: data.dateStr,
      timestamp: Date.now(),
      status: 'Failed',
      recipient: data.recipientEmail,
      totalStudyMinutes: data.todaySessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0),
      targetMinutes: (data.userProfile?.targetHoursPerDay || 3) * 60,
      completedTasksCount: (data.todayPlan?.topics || []).filter(t => t.completed).length,
      incompleteTasksCount: (data.todayPlan?.topics || []).filter(t => !t.completed).length,
      error: error.message
    };
    config.history = [logItem, ...(config.history || []).slice(0, 49)];
    saveEveningWrapUpConfig(config);

    return { success: false, error: error.message };
  }
}
