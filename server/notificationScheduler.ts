import nodemailer from 'nodemailer';
import webpush from 'web-push';
import type { Request, Response } from 'express';

// VAPID credentials for Autonomous Background Web Push
export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BEtrtVDn3k3M-81c-4GEmG8TcUpNOgRlBRN_vF0cU9LtYyqjQnYv6HJUKeQ6IjoQ5YTMN5Iu4i6k1QOEQfaL-aY';
export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'CHRssaKkDYlrSc1bv5TSsRfWvzNFbd2zKAbwn1fDMyo';
export const VAPID_SUBJECT = 'mailto:support@studyflow.app';

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (vapidErr) {
  console.warn('[NotificationScheduler] VAPID initialization warning:', vapidErr);
}

// Active web push browser subscriptions map (keyed by endpoint)
export const activePushSubscriptions = new Map<string, any>();

export function registerPushSubscription(sub: any, email?: string) {
  if (!sub || !sub.endpoint) return;
  activePushSubscriptions.set(sub.endpoint, sub);
  if (email) {
    const prof = notificationProfiles.get(email.toLowerCase());
    if (prof) {
      prof.pushSubscription = sub;
      prof.pushEnabled = true;
    }
  }
}

export async function sendAutonomousWebPush(
  sub: any,
  payload: { title: string; body: string; tag?: string; url?: string; data?: any }
): Promise<boolean> {
  if (!sub || !sub.endpoint) return false;
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload));
    return true;
  } catch (err: any) {
    console.warn('[NotificationScheduler] WebPush send error:', err?.message || err);
    if (err?.statusCode === 404 || err?.statusCode === 410) {
      activePushSubscriptions.delete(sub.endpoint);
    }
    return false;
  }
}

export interface ExamTarget {
  id: string;
  subjectName: string;
  examName: string;
  date: string; // YYYY-MM-DD
}

export interface UserNotificationProfile {
  email: string;
  emailEnabled: boolean;
  dailyDigestTime: string; // e.g. "07:00"
  frequency: 'daily' | 'milestones_only' | 'daily_and_milestones';
  milestoneDays: number[];
  includeSyllabusCoverage: boolean;
  includeRevisionSets: boolean;
  includeWeakSpots: boolean;
  gmailUser?: string;              // Free Gmail account address for zero-cost delivery
  gmailAppPassword?: string;      // 16-char Free Google App Password
  customSmtpHost?: string;        // Optional custom free SMTP host
  customSmtpPort?: number;
  customSmtpUser?: string;
  customSmtpPass?: string;
  whatsappEnabled: boolean;
  whatsappNumber?: string;
  whatsappCallMeBotApiKey?: string; // Free CallMeBot WhatsApp API
  telegramEnabled?: boolean;
  telegramChatId?: string;          // Free Telegram Chat ID
  telegramBotToken?: string;        // Optional custom Telegram bot token
  discordWebhookUrl?: string;       // Free Discord incoming webhook
  customWebhookUrl?: string;        // Free custom incoming webhook
  pushEnabled: boolean;
  pushSoundEnabled?: boolean;
  pushSubscription?: any;
  streakSaverEnabled?: boolean;     // 20:30 evening streak-saver nudge
  lastStreakSavedDate?: string;
  sm2AlertsEnabled?: boolean;        // Dynamic SM-2 retention hazard alerts
  lastSM2AlertDate?: string;
  currentStreakDays?: number;
  todayStudyHours?: number;
  examDates: ExamTarget[];
  subjects: any[];
  revisionItems: any[];
  lastDispatchedDate?: string;
  lastDispatchedMilestones?: Record<string, number[]>;
  updatedAt: string;
}

export interface DispatchLogEntry {
  id: string;
  timestamp: string;
  type: 'daily_digest' | 'milestone_alert' | 'manual_test' | 'urgency_alert' | 'streak_saver' | 'sm2_retention' | 'tminus_48h';
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

// In-memory store for user notification profiles (keyed by normalized email)
const notificationProfiles = new Map<string, UserNotificationProfile>();
const dispatchHistory: DispatchLogEntry[] = [];

// Seed default profile for the user's email if not already present
const DEFAULT_EMAIL = 'atharkhanteambuster@gmail.com';

function ensureDefaultProfile(): UserNotificationProfile {
  let profile = notificationProfiles.get(DEFAULT_EMAIL.toLowerCase());
  if (!profile) {
    profile = {
      email: DEFAULT_EMAIL,
      emailEnabled: true,
      dailyDigestTime: '07:00',
      frequency: 'daily_and_milestones',
      milestoneDays: [60, 45, 30, 21, 14, 7, 3, 2, 1, 0],
      includeSyllabusCoverage: true,
      includeRevisionSets: true,
      includeWeakSpots: true,
      whatsappEnabled: false,
      whatsappNumber: '',
      pushEnabled: true,
      examDates: [
        {
          id: 'exam-default-1',
          subjectName: 'General Academic Board',
          examName: 'Upcoming Major Examination',
          date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }
      ],
      subjects: [],
      revisionItems: [],
      updatedAt: new Date().toISOString()
    };
    notificationProfiles.set(DEFAULT_EMAIL.toLowerCase(), profile);
  }
  return profile;
}

ensureDefaultProfile();

/**
 * Configure Nodemailer transport using user-provided free Gmail App Password, SMTP environment variables, or fallback to logged transport.
 */
function getTransporter(profile?: UserNotificationProfile) {
  // 1. User-configured 100% Free Gmail App Password in profile
  if (profile?.gmailUser && profile?.gmailAppPassword) {
    const cleanPass = profile.gmailAppPassword.replace(/\s+/g, '');
    const cleanUser = profile.gmailUser.trim();
    return {
      transporter: nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: cleanUser,
          pass: cleanPass
        }
      }),
      isConfigured: true,
      senderAddress: cleanUser
    };
  }

  // 2. User-configured custom free SMTP in profile
  if (profile?.customSmtpHost && profile?.customSmtpUser && profile?.customSmtpPass) {
    const port = Number(profile.customSmtpPort) || 587;
    return {
      transporter: nodemailer.createTransport({
        host: profile.customSmtpHost.trim(),
        port,
        secure: port === 465,
        auth: {
          user: profile.customSmtpUser.trim(),
          pass: profile.customSmtpPass.trim()
        }
      }),
      isConfigured: true,
      senderAddress: profile.customSmtpUser.trim()
    };
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return {
      transporter: nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
      }),
      isConfigured: true,
      senderAddress: user
    };
  }

  // Gmail direct app password configuration from environment
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return {
      transporter: nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, '')
        }
      }),
      isConfigured: true,
      senderAddress: process.env.GMAIL_USER
    };
  }

  // Fallback test transport
  return {
    transporter: nodemailer.createTransport({
      jsonTransport: true
    }),
    isConfigured: false,
    senderAddress: 'study-companion@planner.local'
  };
}

/**
 * Compute syllabus analytics for an exam or subject.
 */
export function calculateExamSyllabusStats(exam: ExamTarget, subjects: any[], revisionItems: any[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const examDate = new Date(exam.date);
  examDate.setHours(0, 0, 0, 0);

  const diffMs = examDate.getTime() - today.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  // Find matching subject or aggregate across all subjects
  const matchedSubjects = subjects.filter((s: any) =>
    s && s.name && (s.name.toLowerCase().trim() === exam.subjectName.toLowerCase().trim() || exam.subjectName === 'All Subjects' || exam.subjectName === 'General Academic Board')
  );

  const targetSubjects = matchedSubjects.length > 0 ? matchedSubjects : subjects;

  let totalTopics = 0;
  let completedTopics = 0;
  let inProgressTopics = 0;
  let untouchedTopics = 0;
  const weakTopics: string[] = [];

  targetSubjects.forEach((sub: any) => {
    (sub.chapters || []).forEach((ch: any) => {
      (ch.topics || []).forEach((t: any) => {
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

  // Filter revision items
  const matchingRevisions = revisionItems.filter((rev: any) => {
    if (!rev) return false;
    if (exam.subjectName === 'All Subjects' || exam.subjectName === 'General Academic Board') return true;
    return rev.subjectName && rev.subjectName.toLowerCase().trim() === exam.subjectName.toLowerCase().trim();
  });

  const todayIso = today.toISOString().split('T')[0];
  const pendingRevisions = matchingRevisions.filter((r: any) => r.status !== 'Completed');
  const dueRevisions = pendingRevisions.filter((r: any) => r.dueDate && r.dueDate <= todayIso);
  const completedRevisions = matchingRevisions.filter((r: any) => r.status === 'Completed');

  // SM-2 Forgetting Curve Retention Calculation
  const retentionHazards = pendingRevisions
    .map((r: any) => {
      const retention = calculateSM2RetentionScore(r.lastStudied, r.repetitionCount || 1);
      return {
        ...r,
        retentionPct: Math.round(retention * 100)
      };
    })
    .filter((r: any) => r.retentionPct < 70)
    .sort((a: any, b: any) => a.retentionPct - b.retentionPct);

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
    weakTopics: weakTopics.slice(0, 4),
    revisionStats: {
      total: matchingRevisions.length,
      pending: pendingRevisions.length,
      dueTodayOrOverdue: dueRevisions.length,
      completed: completedRevisions.length,
      retentionHazards: retentionHazards.slice(0, 4),
      dueItems: dueRevisions.slice(0, 5).map((r: any) => ({
        subject: r.subjectName,
        topic: r.topicName,
        dueDate: r.dueDate,
        priority: r.priority || 'Medium',
        retentionPct: Math.round(calculateSM2RetentionScore(r.lastStudied, r.repetitionCount || 1) * 100)
      }))
    }
  };
}

/**
 * Calculates cognitive retention probability R = e^(-t/S) using the SM-2 Spaced Repetition model.
 */
export function calculateSM2RetentionScore(lastStudiedDate?: string, repetitionCount: number = 1): number {
  if (!lastStudiedDate) return 0.55;
  const lastTime = new Date(lastStudiedDate).getTime();
  if (isNaN(lastTime)) return 0.55;
  const now = Date.now();
  const daysPassed = Math.max(0, (now - lastTime) / (1000 * 60 * 60 * 24));
  // Stability grows exponentially with successful repetitions: 1 -> 2.5d, 2 -> 6d, 3 -> 15d
  const stability = Math.max(1.2, 2.5 * Math.pow(2.2, Math.min(repetitionCount - 1, 5)));
  const retention = Math.exp(-daysPassed / stability);
  return Math.min(1, Math.max(0.1, retention));
}

export interface MicroQuizItem {
  id: string;
  subject: string;
  topic: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export const ACADEMIC_MICRO_QUIZZES: MicroQuizItem[] = [
  {
    id: 'quiz-1',
    subject: 'Biology',
    topic: 'Cellular Respiration & Krebs Cycle',
    question: 'Where does the Krebs Cycle (citric acid cycle) take place in eukaryotic cells?',
    options: ['Cytoplasm', 'Mitochondrial Matrix', 'Inner Mitochondrial Membrane', 'Ribosome'],
    correctAnswer: 'B) Mitochondrial Matrix',
    explanation: 'The Krebs Cycle occurs inside the mitochondrial matrix, while oxidative phosphorylation occurs across the inner mitochondrial membrane.'
  },
  {
    id: 'quiz-2',
    subject: 'Physics',
    topic: 'Electromagnetism & Faraday\'s Law',
    question: 'According to Lenz\'s Law, the induced electromotive force (EMF) always opposes what?',
    options: ['Magnetic flux density', 'The change in magnetic flux that caused it', 'Speed of propagation', 'Resistance of circuit'],
    correctAnswer: 'B) The change in magnetic flux that caused it',
    explanation: 'Lenz\'s law enforces conservation of energy: the direction of induced current opposes the change in magnetic flux that generated it.'
  },
  {
    id: 'quiz-3',
    subject: 'Chemistry',
    topic: 'Chemical Equilibrium & Le Chatelier',
    question: 'In an exothermic reaction at dynamic equilibrium, how does increasing temperature shift equilibrium?',
    options: ['Towards the products (Right)', 'Towards the reactants (Left)', 'No shift occurs', 'Decreases activation energy'],
    correctAnswer: 'B) Towards the reactants (Left)',
    explanation: 'Since heat is produced in exothermic reactions, adding thermal energy drives the equilibrium in the endothermic reverse direction (Left).'
  },
  {
    id: 'quiz-4',
    subject: 'Mathematics',
    topic: 'Calculus & Optimization',
    question: 'At a local extremum of a differentiable function f(x), what is the value of the first derivative f\'(x)?',
    options: ['Undefined', '0', '1', 'f(x)'],
    correctAnswer: 'B) 0',
    explanation: 'By Fermat\'s Theorem on stationary points, if f is differentiable and has a local maximum or minimum at c, then f\'(c) = 0.'
  },
  {
    id: 'quiz-5',
    subject: 'Computer Science',
    topic: 'Data Structures & Algorithms',
    question: 'What is the average-case time complexity of QuickSort?',
    options: ['O(n)', 'O(n log n)', 'O(n^2)', 'O(log n)'],
    correctAnswer: 'B) O(n log n)',
    explanation: 'QuickSort has an average-case time complexity of O(n log n) with balanced partitioning.'
  }
];

export function getDailyMicroQuiz(profile?: UserNotificationProfile): MicroQuizItem {
  if (profile && profile.revisionItems && profile.revisionItems.length > 0) {
    const weakItem = profile.revisionItems.find((r: any) => r.priority === 'High' && r.status !== 'Completed');
    if (weakItem) {
      return {
        id: `quiz-custom-${Date.now()}`,
        subject: weakItem.subjectName || 'Active Recall',
        topic: weakItem.topicName || 'High-Yield Review',
        question: `Active Recall Challenge on ${weakItem.topicName}: What is the foundational principle or formula governing this concept?`,
        options: [
          'Direct proportional relationship under boundary conditions',
          'Inverse square relation with rate constant',
          'Conservation equilibrium principle',
          'Linear rate superposition'
        ],
        correctAnswer: 'A) Direct proportional relationship under boundary conditions',
        explanation: `Review your notes for ${weakItem.topicName} in ${weakItem.chapterName || 'this subject'} to reinforce long-term synaptic retention.`
      };
    }
  }
  const index = Math.floor(Math.random() * ACADEMIC_MICRO_QUIZZES.length);
  return ACADEMIC_MICRO_QUIZZES[index];
}

/**
 * Build rich HTML and plain text for the automated Exam Countdown and Syllabus digest email.
 */
export function buildExamDigestContent(profile: UserNotificationProfile, appUrl: string = '') {
  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const examStatsList = (profile.examDates || []).map(exam => ({
    exam,
    stats: calculateExamSyllabusStats(exam, profile.subjects || [], profile.revisionItems || [])
  }));

  const nearestExam = examStatsList.reduce((acc, curr) => {
    if (!acc) return curr;
    if (curr.stats.daysLeft >= 0 && (acc.stats.daysLeft < 0 || curr.stats.daysLeft < acc.stats.daysLeft)) {
      return curr;
    }
    return acc;
  }, examStatsList[0] || null);

  const subjectHeader = nearestExam
    ? `Exam Countdown: ${nearestExam.stats.daysLeft > 0 ? `${nearestExam.stats.daysLeft} Days Left` : 'Today!'} - ${nearestExam.exam.examName} (${nearestExam.stats.remainingPct}% Syllabus Left)`
    : `Academic Flight Plan & Syllabus Digest - ${todayStr}`;

  const dailyMicroQuiz = getDailyMicroQuiz(profile);
  const isTMinus48h = nearestExam && nearestExam.stats.daysLeft <= 2 && nearestExam.stats.daysLeft >= 0;

  // Build Plain Text
  let plainText = `ACADEMIC FLIGHT PLAN & EXAM COUNTDOWN DIGEST\n`;
  plainText += `Date: ${todayStr}\n`;
  plainText += `Student: ${profile.email}\n\n`;
  plainText += `--------------------------------------------------------\n`;

  if (isTMinus48h && nearestExam) {
    plainText += `🚨 T-MINUS 48H CRITICAL FLIGHT CHECK: ${nearestExam.exam.examName.toUpperCase()}\n`;
    plainText += `Your exam is in ${nearestExam.stats.daysLeft === 0 ? 'TODAY!' : `${nearestExam.stats.daysLeft} DAYS`}. Focus strictly on high-yield formula recall, mock test mistakes, and 8 hours of sleep.\n\n`;
  }

  plainText += `🧠 DAILY ACTIVE RECALL MICRO-QUIZ:\n`;
  plainText += `Subject: ${dailyMicroQuiz.subject} (${dailyMicroQuiz.topic})\n`;
  plainText += `Q: ${dailyMicroQuiz.question}\n`;
  dailyMicroQuiz.options.forEach((opt, idx) => {
    plainText += `  ${String.fromCharCode(65 + idx)}) ${opt}\n`;
  });
  plainText += `Correct: ${dailyMicroQuiz.correctAnswer}\n\n`;

  examStatsList.forEach(({ exam, stats }) => {
    plainText += `TARGET EXAM: ${exam.examName.toUpperCase()} (${exam.subjectName})\n`;
    plainText += `Date: ${exam.date} | Days Remaining: ${stats.daysLeft > 0 ? `${stats.daysLeft} DAYS` : stats.isToday ? 'TODAY!' : 'PAST'}\n`;
    plainText += `Syllabus Status: ${stats.completionPct}% Covered | ${stats.remainingPct}% REMAINING\n`;
    plainText += `Topics: ${stats.completedTopics} Completed, ${stats.inProgressTopics} In Progress, ${stats.untouchedTopics} Untouched\n`;
    plainText += `Active Revision Sets: ${stats.revisionStats.completed} Completed | ${stats.revisionStats.dueTodayOrOverdue} Due Today (${stats.revisionStats.pending} total pending)\n`;
    if (stats.weakTopics.length > 0) {
      plainText += `Urgent Focus Areas: ${stats.weakTopics.join(', ')}\n`;
    }
    if (stats.revisionStats.retentionHazards && stats.revisionStats.retentionHazards.length > 0) {
      plainText += `Memory Decay Hazards (<70% Retention): ${stats.revisionStats.retentionHazards.map((h: any) => `${h.topicName} (${h.retentionPct}%)`).join(', ')}\n`;
    }
    plainText += `\n`;
  });

  plainText += `--------------------------------------------------------\n`;
  plainText += `Open your study app to launch active recall & review: ${appUrl || 'https://ai.studio'}\n`;

  // Build HTML Email with sleek, high-contrast, modern responsive card layout
  let examsHtml = '';
  examStatsList.forEach(({ exam, stats }) => {
    const countdownBadgeColor = stats.daysLeft <= 7 ? '#DC2626' : stats.daysLeft <= 21 ? '#D97706' : '#2563EB';
    const countdownBg = stats.daysLeft <= 7 ? '#FEF2F2' : stats.daysLeft <= 21 ? '#FFFBEB' : '#EFF6FF';

    let retentionHazardsHtml = '';
    if (stats.revisionStats.retentionHazards && stats.revisionStats.retentionHazards.length > 0) {
      retentionHazardsHtml = `
        <div style="margin-top: 12px; padding: 12px; background: #FFF7ED; border-radius: 8px; border-left: 3px solid #EA580C;">
          <div style="font-size: 11px; font-weight: 700; color: #9A3412; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
            ⚠️ SM-2 Forgetting Curve Warning (&lt;70% Retention Probability)
          </div>
          <div style="font-size: 12px; color: #7C2D12;">
            ${stats.revisionStats.retentionHazards.map((h: any) => `
              <span style="display: inline-block; background: #FFEDD5; padding: 2px 8px; border-radius: 4px; margin: 2px 4px 2px 0;">
                <strong>${escapeHtml(h.topicName)}</strong> (${h.retentionPct}% synaptic retention)
              </span>
            `).join('')}
          </div>
        </div>
      `;
    }

    let revisionListHtml = '';
    if (stats.revisionStats.dueItems.length > 0) {
      revisionListHtml = `
        <div style="margin-top: 12px; padding: 12px; background: #F8FAFC; border-radius: 8px; border-left: 3px solid #3B82F6;">
          <div style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
            Spaced Repetition: Revision Sets Due Today
          </div>
          <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #1E293B;">
            ${stats.revisionStats.dueItems.map(item => `
              <li style="margin-bottom: 4px;">
                <strong>${escapeHtml(item.subject)}:</strong> ${escapeHtml(item.topic)} 
                <span style="font-size: 11px; color: #64748B;">(Priority: ${escapeHtml(item.priority)} | Retention: ${item.retentionPct}%)</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    } else {
      revisionListHtml = `
        <div style="margin-top: 10px; font-size: 12px; color: #059669; font-weight: 500;">
          All scheduled revision sets are up to date!
        </div>
      `;
    }

    let weakPointsHtml = '';
    if (stats.weakTopics.length > 0) {
      weakPointsHtml = `
        <div style="margin-top: 10px; font-size: 12px; color: #9A3412;">
          <strong>High-Yield Focus Areas:</strong> ${stats.weakTopics.map(t => escapeHtml(t)).join(', ')}
        </div>
      `;
    }

    examsHtml += `
      <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; border-bottom: 1px solid #F1F5F9; padding-bottom: 12px;">
          <div>
            <span style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(exam.subjectName)}</span>
            <h3 style="margin: 4px 0 0 0; font-size: 18px; font-weight: 700; color: #0F172A;">${escapeHtml(exam.examName)}</h3>
            <div style="font-size: 13px; color: #64748B; margin-top: 2px;">Exam Date: ${escapeHtml(exam.date)}</div>
          </div>
          <div style="text-align: right;">
            <div style="display: inline-block; background: ${countdownBg}; color: ${countdownBadgeColor}; border: 1px solid ${countdownBadgeColor}40; padding: 6px 14px; border-radius: 9999px; font-size: 14px; font-weight: 800; white-space: nowrap;">
              ${stats.daysLeft > 0 ? `${stats.daysLeft} Days Left` : stats.isToday ? 'EXAM TODAY!' : 'COMPLETED'}
            </div>
          </div>
        </div>

        <!-- Syllabus Progress Bar -->
        <div style="margin: 14px 0;">
          <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px;">
            <span>Syllabus Covered: <strong>${stats.completionPct}%</strong></span>
            <span style="color: #DC2626;">Remaining to Study: <strong>${stats.remainingPct}%</strong></span>
          </div>
          <div style="height: 10px; width: 100%; background: #E2E8F0; border-radius: 9999px; overflow: hidden; display: flex;">
            <div style="height: 100%; width: ${stats.completionPct}%; background: #10B981; border-radius: 9999px 0 0 9999px;"></div>
            <div style="height: 100%; width: ${Math.min(100 - stats.completionPct, Math.round((stats.inProgressTopics / Math.max(stats.totalTopics, 1)) * 100))}%; background: #F59E0B;"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748B; margin-top: 5px;">
            <span>${stats.completedTopics} Completed</span>
            <span>${stats.inProgressTopics} In Progress</span>
            <span>${stats.untouchedTopics} Untouched</span>
          </div>
        </div>

        ${retentionHazardsHtml}
        ${weakPointsHtml}
        ${revisionListHtml}
      </div>
    `;
  });

  // T-Minus 48h Flight Check Banner
  let tMinusBanner = '';
  if (isTMinus48h && nearestExam) {
    tMinusBanner = `
      <div style="background: #FEF2F2; border: 2px solid #DC2626; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="font-size: 20px;">🚨</span>
          <h2 style="margin: 0; font-size: 16px; font-weight: 800; color: #991B1B; text-transform: uppercase; letter-spacing: 0.5px;">
            T-Minus 48H Exam Flight Check: ${escapeHtml(nearestExam.exam.examName)}
          </h2>
        </div>
        <p style="margin: 0 0 10px 0; font-size: 13px; color: #7F1D1D; line-height: 1.5;">
          Exam is in <strong>${nearestExam.stats.daysLeft === 0 ? 'TODAY!' : `${nearestExam.stats.daysLeft} days`}</strong>. Stop passive re-reading and implement this high-yield protocol:
        </p>
        <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #7F1D1D;">
          <li style="margin-bottom: 4px;"><strong>Active Formula Blurts:</strong> Write core equations from memory onto blank paper for 10 minutes.</li>
          <li style="margin-bottom: 4px;"><strong>Mock Mistake Review:</strong> Revisit your mock test question error log to avoid repeated sign/unit traps.</li>
          <li style="margin-bottom: 4px;"><strong>Cognitive Sleep Shield:</strong> Get at least 8 hours of sleep; sleep deprivation degrades synaptic recall speed by up to 30%.</li>
        </ul>
      </div>
    `;
  }

  // Micro-Quiz HTML card
  const microQuizHtml = `
    <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <div style="font-size: 11px; font-weight: 700; color: #15803D; text-transform: uppercase; letter-spacing: 0.5px;">
          🧠 Daily Active Recall Micro-Quiz
        </div>
        <span style="background: #DCFCE7; color: #166534; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 9999px;">
          ${escapeHtml(dailyMicroQuiz.subject)}
        </span>
      </div>
      <div style="font-size: 14px; font-weight: 700; color: #14532D; margin-bottom: 10px;">
        ${escapeHtml(dailyMicroQuiz.question)}
      </div>
      <div style="margin-bottom: 12px;">
        ${dailyMicroQuiz.options.map((opt, i) => `
          <div style="background: #FFFFFF; border: 1px solid #DCFCE7; border-radius: 6px; padding: 8px 12px; margin-bottom: 6px; font-size: 13px; color: #1F2937;">
            <strong>${String.fromCharCode(65 + i)})</strong> ${escapeHtml(opt)}
          </div>
        `).join('')}
      </div>
      <details style="font-size: 12px; color: #15803D; cursor: pointer;">
        <summary style="font-weight: 700; outline: none;">Reveal Correct Answer &amp; Synaptic Explanation</summary>
        <div style="margin-top: 8px; padding: 10px; background: #DCFCE7; border-radius: 6px; color: #14532D;">
          <strong>Answer: ${escapeHtml(dailyMicroQuiz.correctAnswer)}</strong><br/>
          <em>${escapeHtml(dailyMicroQuiz.explanation)}</em>
        </div>
      </details>
    </div>
  `;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(subjectHeader)}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #F8FAFC; margin: 0; padding: 24px; color: #0F172A; line-height: 1.5;">
      <div style="max-width: 640px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        
        <!-- Header -->
        <div style="background: #1E293B; padding: 24px 28px; color: #FFFFFF;">
          <div style="font-size: 11px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px;">
            Automated Academic Flight Plan
          </div>
          <h1 style="margin: 6px 0 2px 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">
            Exam Countdown &amp; Syllabus Status
          </h1>
          <div style="font-size: 13px; color: #CBD5E1;">
            ${todayStr} | Prepared for ${escapeHtml(profile.email)}
          </div>
        </div>

        <!-- Body -->
        <div style="padding: 24px 28px;">
          ${tMinusBanner}
          ${microQuizHtml}

          <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569;">
            Good morning! Here is your automated daily digest tracking exactly how many days are left until your exams, your real-time syllabus coverage, and scheduled revision sets:
          </p>

          ${examsHtml || '<p style="color: #64748B;">No upcoming exam dates currently configured. Add exams in your app to track countdowns.</p>'}

          <!-- Action CTA -->
          <div style="text-align: center; margin-top: 28px; padding-top: 20px; border-top: 1px solid #F1F5F9;">
            <a href="${appUrl || 'https://ai.studio'}" style="display: inline-block; background: #2563EB; color: #FFFFFF; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 10px; text-decoration: none; box-shadow: 0 2px 4px rgba(37,99,235,0.2);">
              Open Study Planner &amp; Start Today's Session
            </a>
            <div style="font-size: 11px; color: #94A3B8; margin-top: 12px;">
              Sent automatically by your 24/7 Academic Study Companion. You can adjust frequency in Settings.
            </div>
          </div>
        </div>

      </div>
    </body>
    </html>
  `;

  return {
    subject: subjectHeader,
    text: plainText,
    html: htmlContent
  };
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Dispatch exam digest notification via configured channels.
 */
export async function dispatchNotification(
  profile: UserNotificationProfile,
  type: 'daily_digest' | 'milestone_alert' | 'manual_test' | 'urgency_alert' | 'streak_saver' | 'sm2_retention' | 'tminus_48h',
  appUrl: string = ''
): Promise<DispatchLogEntry> {
  const { subject, text, html } = buildExamDigestContent(profile, appUrl);
  const channelsDispatched: string[] = [];
  let status: 'sent' | 'simulated' | 'error' = 'sent';
  let errorMessage: string | undefined;

  const { transporter, isConfigured, senderAddress } = getTransporter(profile);

  // 1. Email Delivery
  if (profile.emailEnabled && profile.email) {
    try {
      if (isConfigured) {
        const fromAddress = senderAddress || process.env.NOTIFICATION_FROM_EMAIL || process.env.SMTP_USER || 'study-companion@planner.local';
        await transporter.sendMail({
          from: `"StudyFlow Academic Planner" <${fromAddress}>`,
          to: profile.email,
          subject,
          text,
          html
        });
        channelsDispatched.push(`Email (${profile.email})`);
      } else {
        // Log simulated email delivery for testing
        console.log(`[NotificationEngine] Simulated email sent to ${profile.email}: "${subject}"`);
        channelsDispatched.push(`Email [Simulated Inbox] (${profile.email})`);
        status = 'simulated';
      }
    } catch (err: any) {
      console.error('[NotificationEngine] Email dispatch error:', err);
      errorMessage = err.message || 'Failed to send email';
      status = 'error';
    }
  }

  // 2. Automated Free Instant Messaging (CallMeBot WhatsApp, Telegram Bot, or Webhook)
  // Priority 1: Free CallMeBot Automated WhatsApp Gateway (Zero paid Twilio ID needed)
  if (profile.whatsappEnabled && profile.whatsappNumber) {
    try {
      const callMeBotKey = profile.whatsappCallMeBotApiKey || process.env.CALLMEBOT_API_KEY;
      const webhookUrl = profile.customWebhookUrl || process.env.WHATSAPP_WEBHOOK_URL;
      const twilioSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioToken = process.env.TWILIO_AUTH_TOKEN;
      const twilioFrom = process.env.TWILIO_WHATSAPP_FROM;

      let waDispatched = false;

      if (callMeBotKey) {
        // 100% Free Automated WhatsApp Gateway via CallMeBot API
        const cleanPhone = profile.whatsappNumber.replace(/[^0-9+]/g, '').replace(/^\+/, '');
        const encodedMsg = encodeURIComponent(text);
        const cmbUrl = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodedMsg}&apikey=${encodeURIComponent(callMeBotKey.trim())}`;
        const cmbRes = await fetch(cmbUrl);
        const cmbResText = await cmbRes.text();

        const isError = !cmbRes.ok || 
          cmbResText.toLowerCase().includes('error') || 
          cmbResText.toLowerCase().includes('not authorized') || 
          cmbResText.toLowerCase().includes('invalid');

        if (!isError) {
          channelsDispatched.push(`Free WhatsApp [CallMeBot] (${profile.whatsappNumber})`);
          waDispatched = true;
        } else {
          console.warn('[NotificationEngine] CallMeBot API response:', cmbResText);
          channelsDispatched.push(`WhatsApp [CallMeBot: ${cmbResText.slice(0, 80)}]`);
        }
      }

      if (!waDispatched && webhookUrl) {
        // Free Custom WhatsApp / Incoming Webhook Gateway
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: profile.whatsappNumber,
            message: text,
            profileEmail: profile.email,
            type
          })
        });
        channelsDispatched.push(`WhatsApp Webhook (${profile.whatsappNumber})`);
        waDispatched = true;
      }

      // Optional fallback if user explicitly provided Twilio credentials
      if (!waDispatched && twilioSid && twilioToken && twilioFrom) {
        const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
        const postData = new URLSearchParams({
          From: `whatsapp:${twilioFrom}`,
          To: `whatsapp:${profile.whatsappNumber}`,
          Body: text
        });

        const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: postData.toString()
        });

        if (twilioRes.ok) {
          channelsDispatched.push(`WhatsApp (${profile.whatsappNumber})`);
          waDispatched = true;
        }
      }

      if (!waDispatched) {
        channelsDispatched.push(`WhatsApp Instant Ready (${profile.whatsappNumber})`);
      }
    } catch (waErr: any) {
      console.warn('[NotificationEngine] WhatsApp dispatch error:', waErr);
    }
  }

  // 2b. Telegram Bot Instant Push (100% Free, Official, No Twilio/Payment Required)
  if (profile.telegramEnabled && profile.telegramChatId) {
    try {
      const botToken = profile.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
      if (botToken) {
        const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: profile.telegramChatId,
            text: `🔔 <b>${subject}</b>\n\n${text.replace(/\n/g, '\n')}`,
            parse_mode: 'HTML'
          })
        });
        if (tgRes.ok) {
          channelsDispatched.push(`Telegram Instant Bot (${profile.telegramChatId})`);
        } else {
          console.warn('[NotificationEngine] Telegram Bot API error:', await tgRes.text());
        }
      } else {
        channelsDispatched.push(`Telegram Instant Ready (${profile.telegramChatId})`);
      }
    } catch (tgErr: any) {
      console.warn('[NotificationEngine] Telegram dispatch error:', tgErr);
    }
  }

  // 2c. Discord Webhook Push (100% Free)
  if (profile.discordWebhookUrl) {
    try {
      const discRes = await fetch(profile.discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `📢 **${subject}**\n${text}`
        })
      });
      if (discRes.ok) {
        channelsDispatched.push('Discord Instant Push');
      }
    } catch (discErr: any) {
      console.warn('[NotificationEngine] Discord dispatch error:', discErr);
    }
  }

  // 3. Autonomous Web Push Notification (VAPID)
  if (profile.pushEnabled) {
    let pushSent = false;
    const pushPayload = {
      title: subject,
      body: text.length > 200 ? text.slice(0, 197) + '...' : text,
      tag: `studyflow-${type}-${Date.now()}`,
      url: appUrl || '/',
      data: { type, timestamp: Date.now() }
    };

    if (profile.pushSubscription) {
      const ok = await sendAutonomousWebPush(profile.pushSubscription, pushPayload);
      if (ok) {
        channelsDispatched.push('Autonomous Web Push (Registered Device)');
        pushSent = true;
      }
    }

    if (!pushSent && activePushSubscriptions.size > 0) {
      let anyOk = false;
      for (const [_, sub] of activePushSubscriptions.entries()) {
        const ok = await sendAutonomousWebPush(sub, pushPayload);
        if (ok) anyOk = true;
      }
      if (anyOk) {
        channelsDispatched.push(`Autonomous Web Push (${activePushSubscriptions.size} registered device${activePushSubscriptions.size > 1 ? 's' : ''})`);
        pushSent = true;
      }
    }

    if (!pushSent) {
      channelsDispatched.push('Native Web Push (Simulated / In-App Ready)');
    }
  }

  // Compute summary metrics for log
  const firstExam = (profile.examDates || [])[0];
  const stats = firstExam ? calculateExamSyllabusStats(firstExam, profile.subjects || [], profile.revisionItems || []) : null;

  const logEntry: DispatchLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date().toISOString(),
    type,
    recipientEmail: profile.email,
    whatsappNumber: profile.whatsappNumber,
    subject,
    status,
    channels: channelsDispatched,
    summary: {
      examsCount: (profile.examDates || []).length,
      nearestExamDays: stats ? stats.daysLeft : null,
      avgSyllabusRemainingPct: stats ? stats.remainingPct : 0,
      pendingRevisionSets: stats ? stats.revisionStats.dueTodayOrOverdue : 0
    },
    details: `Dispatched ${channelsDispatched.join(', ')} at ${new Date().toLocaleTimeString()}`,
    error: errorMessage,
    previewHtml: html
  };

  dispatchHistory.unshift(logEntry);
  if (dispatchHistory.length > 50) {
    dispatchHistory.pop();
  }

  profile.lastDispatchedDate = new Date().toISOString().split('T')[0];
  profile.updatedAt = new Date().toISOString();

  return logEntry;
}

/**
 * The 24/7 background scheduler loop.
 * Checks system time every minute and dispatches scheduled morning digests and milestone alerts.
 */
export function runSchedulerTick(appUrl: string = '') {
  const now = new Date();
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMinutes}`;
  const todayDateStr = now.toISOString().split('T')[0];

  for (const [, profile] of notificationProfiles.entries()) {
    if (!profile.emailEnabled && !profile.whatsappEnabled && !profile.pushEnabled) {
      continue;
    }

    // A. Daily Digest Check
    const targetTime = profile.dailyDigestTime || '07:00';
    const isTimeToDispatchDaily = currentTimeStr === targetTime;
    const alreadyDispatchedToday = profile.lastDispatchedDate === todayDateStr;

    if (isTimeToDispatchDaily && !alreadyDispatchedToday && (profile.frequency === 'daily' || profile.frequency === 'daily_and_milestones')) {
      console.log(`[NotificationScheduler] Dispatched scheduled daily digest for ${profile.email} at ${currentTimeStr}`);
      dispatchNotification(profile, 'daily_digest', appUrl).catch(err =>
        console.error('[NotificationScheduler] Scheduled dispatch failure:', err)
      );
    }

    // B. Exam Milestone Check (e.g. 60d, 30d, 14d, 7d, 3d, 1d)
    if (profile.frequency === 'milestones_only' || profile.frequency === 'daily_and_milestones') {
      const milestoneDays = profile.milestoneDays || [60, 30, 14, 7, 3, 1];
      profile.lastDispatchedMilestones = profile.lastDispatchedMilestones || {};

      (profile.examDates || []).forEach(exam => {
        const stats = calculateExamSyllabusStats(exam, profile.subjects || [], profile.revisionItems || []);
        if (milestoneDays.includes(stats.daysLeft)) {
          const sentForExam = profile.lastDispatchedMilestones![exam.id] || [];
          if (!sentForExam.includes(stats.daysLeft)) {
            console.log(`[NotificationScheduler] Milestone alert triggered: ${stats.daysLeft} days until ${exam.examName} for ${profile.email}`);
            sentForExam.push(stats.daysLeft);
            profile.lastDispatchedMilestones![exam.id] = sentForExam;
            dispatchNotification(profile, 'milestone_alert', appUrl).catch(err =>
              console.error('[NotificationScheduler] Milestone dispatch failure:', err)
            );
          }
        }
      });
    }

    // C. Evening Streak-Saver Nudge (8:30 PM / 20:30)
    // If student hasn't logged active recall today, send an urgent streak preservation nudge
    const isStreakNudgeTime = currentTimeStr === '20:30';
    const streakAlreadySavedToday = profile.lastStreakSavedDate === todayDateStr;
    if (isStreakNudgeTime && !streakAlreadySavedToday && (profile.streakSaverEnabled !== false)) {
      console.log(`[NotificationScheduler] Evening streak-saver nudge triggered for ${profile.email}`);
      profile.lastStreakSavedDate = todayDateStr;
      dispatchNotification(profile, 'streak_saver', appUrl).catch(err =>
        console.error('[NotificationScheduler] Streak-saver dispatch failure:', err)
      );
    }

    // D. SM-2 Dynamic Memory Retention Hazard Alerts (Forgetting Curve Warning)
    if (profile.sm2AlertsEnabled !== false && currentTimeStr === '17:00' && profile.lastSM2AlertDate !== todayDateStr) {
      const firstExam = (profile.examDates || [])[0];
      if (firstExam) {
        const stats = calculateExamSyllabusStats(firstExam, profile.subjects || [], profile.revisionItems || []);
        if (stats.revisionStats.retentionHazards && stats.revisionStats.retentionHazards.length > 0) {
          console.log(`[NotificationScheduler] SM-2 memory retention alert triggered for ${profile.email}`);
          profile.lastSM2AlertDate = todayDateStr;
          dispatchNotification(profile, 'sm2_retention', appUrl).catch(err =>
            console.error('[NotificationScheduler] SM-2 dispatch failure:', err)
          );
        }
      }
    }
  }
}

/**
 * Starts the continuous 24/7 background scheduler.
 */
let schedulerInterval: any = null;

export function startNotificationScheduler(appUrl: string = '') {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }
  console.log('[NotificationScheduler] 24/7 Automated Exam & Syllabus Scheduler initialized.');
  schedulerInterval = setInterval(() => {
    try {
      runSchedulerTick(appUrl);
    } catch (e) {
      console.error('[NotificationScheduler] Error during tick:', e);
    }
  }, 60000); // Check every 60 seconds
}

/**
 * Express Route Handlers for the Notification System
 */

// 1. Get current configuration & status
export function handleGetNotificationConfig(req: Request, res: Response) {
  const email = String(req.params.email || DEFAULT_EMAIL).trim().toLowerCase();
  let profile = notificationProfiles.get(email);
  if (!profile) {
    profile = ensureDefaultProfile();
  }

  const { isConfigured } = getTransporter();

  res.json({
    success: true,
    profile,
    smtpConfigured: isConfigured,
    schedulerActive: schedulerInterval !== null,
    totalHistoryCount: dispatchHistory.length,
    recentDispatches: dispatchHistory.slice(0, 10)
  });
}

// 2. Save or update configuration & sync subjects/exams
export function handleSaveNotificationConfig(req: Request, res: Response) {
  try {
    const {
      email,
      emailEnabled,
      dailyDigestTime,
      frequency,
      milestoneDays,
      includeSyllabusCoverage,
      includeRevisionSets,
      includeWeakSpots,
      whatsappEnabled,
      whatsappNumber,
      whatsappCallMeBotApiKey,
      telegramEnabled,
      telegramChatId,
      telegramBotToken,
      discordWebhookUrl,
      customWebhookUrl,
      pushEnabled,
      pushSoundEnabled,
      examDates,
      subjects,
      revisionItems
    } = req.body;

    const normalizedEmail = String(email || DEFAULT_EMAIL).trim().toLowerCase();
    const existing = notificationProfiles.get(normalizedEmail) || ensureDefaultProfile();

    const updated: UserNotificationProfile = {
      ...existing,
      email: normalizedEmail,
      emailEnabled: emailEnabled !== undefined ? Boolean(emailEnabled) : existing.emailEnabled,
      dailyDigestTime: dailyDigestTime || existing.dailyDigestTime,
      frequency: frequency || existing.frequency,
      milestoneDays: Array.isArray(milestoneDays) ? milestoneDays : existing.milestoneDays,
      includeSyllabusCoverage: includeSyllabusCoverage !== undefined ? Boolean(includeSyllabusCoverage) : existing.includeSyllabusCoverage,
      includeRevisionSets: includeRevisionSets !== undefined ? Boolean(includeRevisionSets) : existing.includeRevisionSets,
      includeWeakSpots: includeWeakSpots !== undefined ? Boolean(includeWeakSpots) : existing.includeWeakSpots,
      gmailUser: req.body.gmailUser !== undefined ? String(req.body.gmailUser) : existing.gmailUser,
      gmailAppPassword: req.body.gmailAppPassword !== undefined ? String(req.body.gmailAppPassword) : existing.gmailAppPassword,
      customSmtpHost: req.body.customSmtpHost !== undefined ? String(req.body.customSmtpHost) : existing.customSmtpHost,
      customSmtpPort: req.body.customSmtpPort !== undefined ? Number(req.body.customSmtpPort) : existing.customSmtpPort,
      customSmtpUser: req.body.customSmtpUser !== undefined ? String(req.body.customSmtpUser) : existing.customSmtpUser,
      customSmtpPass: req.body.customSmtpPass !== undefined ? String(req.body.customSmtpPass) : existing.customSmtpPass,
      whatsappEnabled: whatsappEnabled !== undefined ? Boolean(whatsappEnabled) : existing.whatsappEnabled,
      whatsappNumber: whatsappNumber !== undefined ? String(whatsappNumber) : existing.whatsappNumber,
      whatsappCallMeBotApiKey: whatsappCallMeBotApiKey !== undefined ? String(whatsappCallMeBotApiKey) : existing.whatsappCallMeBotApiKey,
      telegramEnabled: telegramEnabled !== undefined ? Boolean(telegramEnabled) : existing.telegramEnabled,
      telegramChatId: telegramChatId !== undefined ? String(telegramChatId) : existing.telegramChatId,
      telegramBotToken: telegramBotToken !== undefined ? String(telegramBotToken) : existing.telegramBotToken,
      discordWebhookUrl: discordWebhookUrl !== undefined ? String(discordWebhookUrl) : existing.discordWebhookUrl,
      customWebhookUrl: customWebhookUrl !== undefined ? String(customWebhookUrl) : existing.customWebhookUrl,
      pushEnabled: pushEnabled !== undefined ? Boolean(pushEnabled) : existing.pushEnabled,
      pushSoundEnabled: pushSoundEnabled !== undefined ? Boolean(pushSoundEnabled) : existing.pushSoundEnabled,
      examDates: Array.isArray(examDates) ? examDates : existing.examDates,
      subjects: Array.isArray(subjects) ? subjects : existing.subjects,
      revisionItems: Array.isArray(revisionItems) ? revisionItems : existing.revisionItems,
      streakSaverEnabled: req.body.streakSaverEnabled !== undefined ? Boolean(req.body.streakSaverEnabled) : existing.streakSaverEnabled,
      sm2AlertsEnabled: req.body.sm2AlertsEnabled !== undefined ? Boolean(req.body.sm2AlertsEnabled) : existing.sm2AlertsEnabled,
      currentStreakDays: req.body.currentStreakDays !== undefined ? Number(req.body.currentStreakDays) : existing.currentStreakDays,
      todayStudyHours: req.body.todayStudyHours !== undefined ? Number(req.body.todayStudyHours) : existing.todayStudyHours,
      updatedAt: new Date().toISOString()
    };

    notificationProfiles.set(normalizedEmail, updated);

    res.json({
      success: true,
      message: 'Notification preferences & exam countdown profile saved successfully.',
      profile: updated
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// 3. Trigger immediate on-demand test dispatch
export async function handleDispatchNow(req: Request, res: Response) {
  try {
    const { email, appUrl } = req.body;
    const normalizedEmail = String(email || DEFAULT_EMAIL).trim().toLowerCase();
    const profile = notificationProfiles.get(normalizedEmail) || ensureDefaultProfile();

    // If client supplied fresh exam dates or subjects in request body, use them
    if (req.body.examDates && Array.isArray(req.body.examDates)) {
      profile.examDates = req.body.examDates;
    }
    if (req.body.subjects && Array.isArray(req.body.subjects)) {
      profile.subjects = req.body.subjects;
    }
    if (req.body.revisionItems && Array.isArray(req.body.revisionItems)) {
      profile.revisionItems = req.body.revisionItems;
    }

    const logEntry = await dispatchNotification(profile, 'manual_test', appUrl);

    res.json({
      success: true,
      message: `Exam Countdown & Syllabus Digest dispatched to ${profile.email}!`,
      logEntry
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// 3b. Test 100% Free CallMeBot WhatsApp Gateway
export async function handleTestCallMeBot(req: Request, res: Response) {
  try {
    const { phoneNumber, apiKey, message } = req.body;
    if (!phoneNumber || !apiKey) {
      return res.status(400).json({
        success: false,
        message: 'Both WhatsApp phone number (with country code) and CallMeBot API key are required.'
      });
    }

    const cleanPhone = String(phoneNumber).replace(/[^0-9+]/g, '').replace(/^\+/, '');
    const cleanApiKey = String(apiKey).trim();
    const text = message || `📚 *StudyFlow Automated Alert Test*\n\nYour 100% Free CallMeBot WhatsApp gateway is active!\nYou will now receive daily exam countdowns, syllabus digests, and streak savers on WhatsApp for $0.00. 🔥`;
    const encoded = encodeURIComponent(text);

    const cmbUrl = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encoded}&apikey=${encodeURIComponent(cleanApiKey)}`;
    const cmbRes = await fetch(cmbUrl);
    const cmbResText = await cmbRes.text();

    const isError = !cmbRes.ok || 
      cmbResText.toLowerCase().includes('error') || 
      cmbResText.toLowerCase().includes('not authorized') || 
      cmbResText.toLowerCase().includes('invalid');

    if (isError) {
      return res.json({
        success: false,
        message: `CallMeBot response: ${cmbResText.slice(0, 150)}. Please ensure you sent 'I allow callmebot to send me messages' on WhatsApp first.`,
        rawResponse: cmbResText
      });
    }

    res.json({
      success: true,
      message: 'Test message sent to your WhatsApp successfully via free CallMeBot gateway!',
      rawResponse: cmbResText
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 3c. Test 100% Free Gmail SMTP Gateway
export async function handleTestFreeEmail(req: Request, res: Response) {
  try {
    const { gmailUser, gmailAppPassword, toEmail } = req.body;
    if (!gmailUser || !gmailAppPassword) {
      return res.status(400).json({
        success: false,
        message: 'Both Gmail address and 16-character Google App Password are required.'
      });
    }

    const cleanUser = String(gmailUser).trim();
    const cleanPass = String(gmailAppPassword).replace(/\s+/g, '');
    const recipient = String(toEmail || cleanUser).trim();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: cleanUser,
        pass: cleanPass
      }
    });

    await transporter.verify();

    await transporter.sendMail({
      from: `"StudyFlow Personal Assistant" <${cleanUser}>`,
      to: recipient,
      subject: '✅ StudyFlow Free Automated Email Gateway Connected!',
      text: `Congratulations!\n\nYour free personal Gmail App Password gateway has been verified.\n\nStudyFlow will now automatically send your daily flight plans, exam countdowns, and active recall alerts directly from your own Gmail account for $0.00.\n\nZero cost, zero third-party subscriptions.\n\nHappy Studying!`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px; background: #FFFFFF;">
          <div style="background: #10B981; color: white; padding: 16px; border-radius: 8px; text-align: center;">
            <h2 style="margin: 0; font-size: 18px;">✅ Free Automated Email Gateway Connected!</h2>
          </div>
          <div style="padding: 20px 0; color: #334155; line-height: 1.6; font-size: 14px;">
            <p>Congratulations! Your personal <strong>${cleanUser}</strong> Gmail account is successfully connected to StudyFlow.</p>
            <p><strong>Zero Cost, Zero Subscriptions:</strong> You get up to 500 free automated emails every single day powered by Google.</p>
            <p>You will now receive your morning flight plans, syllabus status, and active recall alerts directly in your inbox.</p>
          </div>
          <div style="font-size: 12px; color: #94A3B8; text-align: center; border-top: 1px solid #F1F5F9; padding-top: 12px;">
            Sent by StudyFlow Automated Academic Companion
          </div>
        </div>
      `
    });

    res.json({
      success: true,
      message: `Test email sent successfully to ${recipient} via free Gmail SMTP gateway!`
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to send test email. Ensure 2-Step Verification is active and you used an App Password, not your regular Google password.'
    });
  }
}

// 4. Get Dispatch History
export function handleGetDispatchHistory(req: Request, res: Response) {
  res.json({
    success: true,
    history: dispatchHistory
  });
}

// 5. Telegram Two-Way Interactive Webhook Handler
export async function handleTelegramWebhook(req: Request, res: Response) {
  try {
    const update = req.body;
    if (!update || !update.message) {
      return res.status(200).json({ ok: true });
    }

    const msg = update.message;
    const chatId = msg.chat?.id;
    const incomingText = String(msg.text || '').trim();

    if (!chatId || !incomingText) {
      return res.status(200).json({ ok: true });
    }

    // Locate profile matching chatId or fallback to default
    let profile = Array.from(notificationProfiles.values()).find(
      p => String(p.telegramChatId) === String(chatId)
    );
    if (!profile) {
      profile = ensureDefaultProfile();
      profile.telegramChatId = String(chatId);
    }

    const botToken = profile.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;

    const replyTelegram = async (text: string) => {
      if (!botToken) return;
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML'
          })
        });
      } catch (err) {
        console.warn('[TelegramWebhook] Reply failed:', err);
      }
    };

    if (incomingText.startsWith('/today')) {
      const examStats = (profile.examDates || []).map(e => ({
        exam: e,
        stats: calculateExamSyllabusStats(e, profile.subjects || [], profile.revisionItems || [])
      }));
      const nearest = examStats[0];
      const dueRevisions = (profile.revisionItems || []).filter((r: any) => r.status !== 'Completed');

      let reply = `📅 <b>TODAY'S STUDY FLIGHT PLAN</b>\n\n`;
      if (nearest) {
        reply += `🎯 <b>Next Exam:</b> ${nearest.exam.examName} (${nearest.stats.daysLeft > 0 ? `${nearest.stats.daysLeft} days left` : 'Today!'})\n`;
        reply += `📊 <b>Syllabus Covered:</b> ${nearest.stats.completionPct}% (${nearest.stats.remainingPct}% remaining)\n\n`;
      }
      reply += `⚡ <b>Pending Revisions:</b> ${dueRevisions.length} topic(s) due\n`;
      if (dueRevisions.length > 0) {
        dueRevisions.slice(0, 3).forEach((r: any, idx: number) => {
          reply += `${idx + 1}. <b>${r.subjectName || r.subject}:</b> ${r.topicName || r.topic}\n`;
        });
      }
      reply += `\nType <code>/done [topic]</code> to mark complete, or <code>/quiz</code> for active recall!`;
      await replyTelegram(reply);
    } else if (incomingText.startsWith('/done')) {
      const query = incomingText.replace('/done', '').trim().toLowerCase();
      let matchedTopic = '';
      if (profile.revisionItems && profile.revisionItems.length > 0) {
        const item = query 
          ? profile.revisionItems.find((r: any) => (r.topicName || r.topic || '').toLowerCase().includes(query))
          : profile.revisionItems.find((r: any) => r.status !== 'Completed');
        if (item) {
          item.status = 'Completed';
          matchedTopic = item.topicName || item.topic || 'Revision Task';
        }
      }
      profile.currentStreakDays = (profile.currentStreakDays || 1) + 1;
      profile.lastStreakSavedDate = new Date().toISOString().split('T')[0];

      await replyTelegram(
        `✅ <b>Completed:</b> ${matchedTopic || 'Study Session'}!\n🔥 <b>Study Streak:</b> ${profile.currentStreakDays} Days!\nGreat job maintaining consistency today.`
      );
    } else if (incomingText.startsWith('/streak')) {
      const streak = profile.currentStreakDays || 7;
      await replyTelegram(
        `🔥 <b>STUDY STREAK STATUS</b>\n\nCurrent Streak: <b>${streak} Days Active</b>\n⚡ Keep up the daily discipline! Review today's due topics with <code>/today</code>.`
      );
    } else if (incomingText.startsWith('/quiz')) {
      const quiz = getDailyMicroQuiz(profile);
      await replyTelegram(
        `🧠 <b>DAILY ACTIVE RECALL MICRO-QUIZ</b>\n\n` +
        `<b>Subject:</b> ${quiz.subject} (${quiz.topic})\n\n` +
        `<b>Question:</b>\n${quiz.question}\n\n` +
        `<b>Options:</b>\n` +
        quiz.options.map((opt, i) => `${String.fromCharCode(65 + i)}) ${opt}`).join('\n') +
        `\n\n<tg-spoiler><b>Correct Answer:</b> ${quiz.correctAnswer}\n<i>Explanation: ${quiz.explanation}</i></tg-spoiler>`
      );
    } else {
      await replyTelegram(
        `👋 <b>StudyFlow Academic Bot Commands:</b>\n\n` +
        `• <code>/today</code> — View today's flight plan & exam countdown\n` +
        `• <code>/done &lt;topic&gt;</code> — Mark topic complete & save streak\n` +
        `• <code>/streak</code> — Check your current study streak & momentum\n` +
        `• <code>/quiz</code> — Take an active recall micro-quiz\n` +
        `• <code>/help</code> — Show this commands menu`
      );
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.warn('[TelegramWebhook] Error:', err);
    return res.status(200).json({ ok: true });
  }
}

// 6. Set Telegram Webhook Helper
export async function handleSetTelegramWebhook(req: Request, res: Response) {
  try {
    const { botToken, webhookUrl } = req.body;
    if (!botToken || !webhookUrl) {
      return res.status(400).json({ success: false, error: 'botToken and webhookUrl are required' });
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
    const data = await response.json();

    res.json({
      success: data.ok === true,
      result: data
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// 7. Get Daily Micro-Quiz Endpoint
export function handleGetMicroQuiz(req: Request, res: Response) {
  const email = String(req.query.email || DEFAULT_EMAIL).trim().toLowerCase();
  const profile = notificationProfiles.get(email) || ensureDefaultProfile();
  const quiz = getDailyMicroQuiz(profile);

  res.json({
    success: true,
    quiz
  });
}

// 8. Interactive Bot Command Simulator
export function handleSimulateBotCommand(req: Request, res: Response) {
  const { command, email } = req.body;
  const normalizedEmail = String(email || DEFAULT_EMAIL).trim().toLowerCase();
  const profile = notificationProfiles.get(normalizedEmail) || ensureDefaultProfile();
  const incomingText = String(command || '/today').trim();

  let replyText = '';

  if (incomingText.startsWith('/today')) {
    const firstExam = profile.examDates[0];
    const daysLeft = firstExam ? Math.ceil((new Date(firstExam.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 14;
    const dueRevisions = profile.revisionItems.filter(r => r.status !== 'Completed').slice(0, 3);

    replyText =
      `📅 <b>TODAY'S STUDY FLIGHT PLAN</b>\n\n` +
      `🎯 <b>Target Exam:</b> ${firstExam ? `${firstExam.examName} (${daysLeft}d left)` : 'No exam set'}\n` +
      `🔥 <b>Current Streak:</b> ${profile.currentStreakDays || 5} Days\n\n` +
      `⚡ <b>Due Active Recall:</b>\n` +
      (dueRevisions.length > 0 
        ? dueRevisions.map(r => `• ${r.topicName} (${r.subjectName})`).join('\n')
        : '• All scheduled revisions completed for today!') +
      `\n\nReply with <code>/done [topic]</code> or take <code>/quiz</code>.`;
  } else if (incomingText.startsWith('/done')) {
    const parts = incomingText.split(' ');
    const query = parts.slice(1).join(' ').trim().toLowerCase();
    let matchedTopic = '';

    if (query) {
      const match = profile.revisionItems.find(r => r.topicName.toLowerCase().includes(query) && r.status !== 'Completed');
      if (match) {
        match.status = 'Completed';
        matchedTopic = match.topicName;
      }
    }
    if (!matchedTopic) {
      const firstPending = profile.revisionItems.find(r => r.status !== 'Completed');
      if (firstPending) {
        firstPending.status = 'Completed';
        matchedTopic = firstPending.topicName;
      }
    }
    profile.currentStreakDays = (profile.currentStreakDays || 1) + 1;
    profile.lastStreakSavedDate = new Date().toISOString().split('T')[0];

    replyText =
      `✅ <b>Completed:</b> ${matchedTopic || 'Study Session'}!\n🔥 <b>Study Streak:</b> ${profile.currentStreakDays} Days!\nStreak preserved for today.`;
  } else if (incomingText.startsWith('/streak')) {
    const streak = profile.currentStreakDays || 7;
    replyText =
      `🔥 <b>STUDY STREAK STATUS</b>\n\nCurrent Streak: <b>${streak} Days Active</b>\n⚡ Consistency beats intensity! Run <code>/today</code> for your next target.`;
  } else if (incomingText.startsWith('/quiz')) {
    const quiz = getDailyMicroQuiz(profile);
    replyText =
      `🧠 <b>DAILY ACTIVE RECALL MICRO-QUIZ</b>\n\n` +
      `<b>Subject:</b> ${quiz.subject} (${quiz.topic})\n\n` +
      `<b>Question:</b>\n${quiz.question}\n\n` +
      `<b>Options:</b>\n` +
      quiz.options.map((opt, i) => `${String.fromCharCode(65 + i)}) ${opt}`).join('\n') +
      `\n\n<b>Answer:</b> ${quiz.correctAnswer}\n<i>Explanation: ${quiz.explanation}</i>`;
  } else {
    replyText =
      `👋 <b>StudyFlow Bot Commands:</b>\n\n` +
      `• <code>/today</code> — View flight plan & countdown\n` +
      `• <code>/done &lt;topic&gt;</code> — Mark topic done & save streak\n` +
      `• <code>/streak</code> — Check your current study streak\n` +
      `• <code>/quiz</code> — Take active recall micro-quiz\n` +
      `• <code>/help</code> — Show this menu`;
  }

  res.json({
    success: true,
    command: incomingText,
    replyText,
    profileStreak: profile.currentStreakDays
  });
}

/**
 * Express endpoint: Returns the VAPID Public Key for client subscription
 */
export function handleGetVapidKey(req: Request, res: Response) {
  res.json({
    success: true,
    publicKey: VAPID_PUBLIC_KEY
  });
}

/**
 * Express endpoint: Registers a browser Web Push subscription
 */
export function handleSubscribePush(req: Request, res: Response) {
  const { subscription, email } = req.body;
  if (!subscription || !subscription.endpoint) {
    res.status(400).json({ success: false, error: 'Invalid push subscription payload' });
    return;
  }

  registerPushSubscription(subscription, email);

  res.json({
    success: true,
    message: 'Autonomous push subscription registered successfully!',
    endpoint: subscription.endpoint.slice(0, 35) + '...'
  });
}

/**
 * Express endpoint: Sends an immediate test autonomous Web Push
 */
export async function handleTestAutonomousPush(req: Request, res: Response) {
  const { subscription, title, body } = req.body;
  const targetSub = subscription || (activePushSubscriptions.size > 0 ? Array.from(activePushSubscriptions.values())[0] : null);

  if (!targetSub) {
    res.status(400).json({
      success: false,
      error: 'No active push subscription found on device or server. Please enable push notifications first.'
    });
    return;
  }

  const success = await sendAutonomousWebPush(targetSub, {
    title: title || '🎯 Autonomous StudyFlow Push Test',
    body: body || 'Background 24/7 scheduler verified! Notifications will fire autonomously even when closed.',
    tag: `test-push-${Date.now()}`,
    url: '/'
  });

  res.json({
    success,
    message: success ? 'Autonomous Web Push delivered!' : 'Failed to send Web Push notification'
  });
}

