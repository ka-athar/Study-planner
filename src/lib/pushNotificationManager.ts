/**
 * Native App Push Notification & Audio Chime Manager
 * Handles browser Web Push notifications, audio synthesis chimes, and automatic background reminders.
 */

import { ExamNotificationSettings, ExamDate, Assignment, MissedWorkItem, StudyPlan } from '../types';

let audioContext: AudioContext | null = null;

/**
 * Plays a pleasant, harmonious two-tone notification chime using the Web Audio API.
 * Requires zero external audio files.
 */
export function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    if (!audioContext || audioContext.state === 'suspended') {
      audioContext = new AudioCtx();
    }

    const now = audioContext.currentTime;

    // First Tone: High C (523.25 Hz)
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.18, now + 0.04);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Second Tone: Higher E (659.25 Hz) or G (783.99 Hz)
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.12);
    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.22, now + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.48);
  } catch (err) {
    console.warn('[PushNotificationManager] Web Audio chime could not play:', err);
  }
}

/**
 * Check if the browser supports native Push Notifications
 */
export function isPushNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Request notification permission from the user
 */
export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!isPushNotificationSupported()) return 'denied';
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (e) {
    console.warn('[PushNotificationManager] requestPermission error:', e);
    return 'denied';
  }
}

export interface PushNotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  tag?: string;
  playSound?: boolean;
  onClickUrl?: string;
  actions?: PushNotificationAction[];
  data?: any;
}

/**
 * Display a native operating system / browser push notification with optional sound and interactive lock-screen action buttons
 */
export function sendNativePushNotification(payload: PushNotificationPayload): boolean {
  if (!isPushNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  if (payload.playSound !== false) {
    playNotificationChime();
  }

  // Try Service Worker registration first for interactive action buttons
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((registration) => {
      const options: any = {
        body: payload.body,
        icon: '/icon.svg',
        badge: '/icon.svg',
        tag: payload.tag || `study-notification-${Date.now()}`,
        actions: payload.actions || [
          { action: 'start-timer', title: '⏱️ Start 25m Timer' },
          { action: 'mark-done', title: '✅ Mark Done' }
        ],
        data: {
          onClickUrl: payload.onClickUrl || '/',
          ...(payload.data || {})
        }
      };
      (registration as any).showNotification(payload.title, options);
    }).catch(() => {
      // Fallback to standard Notification
      fallbackNotification(payload);
    });
    return true;
  }

  return fallbackNotification(payload);
}

function fallbackNotification(payload: PushNotificationPayload): boolean {
  try {
    const notification = new Notification(payload.title, {
      body: payload.body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: payload.tag || `study-notification-${Date.now()}`
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      if (payload.onClickUrl) {
        window.location.hash = payload.onClickUrl;
      }
    };

    return true;
  } catch (err) {
    console.warn('[PushNotificationManager] Notification constructor failed:', err);
    return false;
  }
}

/**
 * Listen for action clicks dispatched from Service Worker (e.g. from lock-screen notification buttons)
 */
export function setupPushActionListener(handlers: 
  | ((action: string, data?: any) => void)
  | {
      onStartTimer?: () => void;
      onMarkDone?: (data?: any) => void;
    }
) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return () => {};

  const handleMessage = (event: MessageEvent) => {
    if (event.data && event.data.type === 'NOTIFICATION_ACTION_CLICK') {
      const { action, data } = event.data;
      if (typeof handlers === 'function') {
        handlers(action, data);
      } else {
        if (action === 'start-timer' && handlers.onStartTimer) {
          handlers.onStartTimer();
        } else if (action === 'mark-done' && handlers.onMarkDone) {
          handlers.onMarkDone(data);
        }
      }
    }
  };

  navigator.serviceWorker.addEventListener('message', handleMessage);
  return () => {
    navigator.serviceWorker.removeEventListener('message', handleMessage);
  };
}

// Memory tracking for dispatched daily alerts in the current session
const DISPATCHED_TAGS_KEY = 'studyflow_push_dispatched_tags_v1';

function getDispatchedTags(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DISPATCHED_TAGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function recordDispatchedTag(tag: string) {
  try {
    const map = getDispatchedTags();
    map[tag] = new Date().toISOString();
    localStorage.setItem(DISPATCHED_TAGS_KEY, JSON.stringify(map));
  } catch {}
}

/**
 * Checks scheduled reminders, exams, and missed work against the current time
 * and triggers a native push notification if conditions match.
 */
export function checkAndTriggerPushNotifications(params: {
  settings: ExamNotificationSettings;
  examDates: ExamDate[];
  assignments?: Assignment[];
  missedWork?: MissedWorkItem[];
  plans?: StudyPlan[];
}) {
  const { settings, examDates, assignments = [], missedWork = [] } = params;

  if (!settings.pushEnabled || !isPushNotificationSupported() || Notification.permission !== 'granted') {
    return;
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${currentHours}:${currentMinutes}`;
  const dispatched = getDispatchedTags();

  // 1. Check Morning / Daily Digest Push
  if (settings.dailyDigestTime) {
    const digestTag = `daily_digest_${todayStr}`;
    if (!dispatched[digestTag]) {
      // Check if current time is at or past digest time within a 5-minute window
      const [targetH, targetM] = settings.dailyDigestTime.split(':').map(Number);
      const diffMinutes = (now.getHours() * 60 + now.getMinutes()) - (targetH * 60 + targetM);

      if (diffMinutes >= 0 && diffMinutes <= 15) {
        const upcomingExams = examDates.filter(e => e.date >= todayStr).length;
        const pendingWork = missedWork.filter(m => m.status !== 'Completed').length;

        sendNativePushNotification({
          title: '☀️ Daily Study Briefing Ready',
          body: `Good morning! You have ${upcomingExams} active exam countdown${upcomingExams !== 1 ? 's' : ''} and ${pendingWork} pending task${pendingWork !== 1 ? 's' : ''} today.`,
          tag: digestTag,
          playSound: settings.pushSoundEnabled !== false
        });
        recordDispatchedTag(digestTag);
      }
    }
  }

  // 2. Check Exam Milestone Days (e.g. 7, 3, 1, 0 days away)
  const milestoneDays = settings.milestoneDays || [60, 30, 14, 7, 3, 1, 0];
  examDates.forEach(exam => {
    if (!exam.date) return;
    const examDate = new Date(exam.date);
    examDate.setHours(0, 0, 0, 0);
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((examDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

    if (milestoneDays.includes(diffDays)) {
      const milestoneTag = `exam_milestone_${exam.id}_${diffDays}d_${todayStr}`;
      if (!dispatched[milestoneTag]) {
        const label = diffDays === 0 ? 'TODAY' : diffDays === 1 ? 'TOMORROW' : `in ${diffDays} days`;
        sendNativePushNotification({
          title: `🎯 Exam Countdown Alert: ${exam.subjectName}`,
          body: `Your ${exam.examName} is ${label}! Review your targeted flashcards and syllabus checklist now.`,
          tag: milestoneTag,
          playSound: settings.pushSoundEnabled !== false
        });
        recordDispatchedTag(milestoneTag);
      }
    }
  });

  // 3. Urgent Overdue Assignment / Missed Work Alert
  const overdueItems = missedWork.filter(m => m.status === 'Missed');
  if (overdueItems.length > 0) {
    const overdueTag = `missed_work_alert_${todayStr}`;
    if (!dispatched[overdueTag]) {
      const first = overdueItems[0];
      sendNativePushNotification({
        title: '⚠️ Missed Work Recovery Reminder',
        body: `You have ${overdueItems.length} overdue item${overdueItems.length > 1 ? 's' : ''} including "${first.title}". Adaptive recovery slots are available.`,
        tag: overdueTag,
        playSound: settings.pushSoundEnabled !== false
      });
      recordDispatchedTag(overdueTag);
    }
  }
}

/**
 * Convert base64 VAPID public key to Uint8Array for PushManager
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Register device for 24/7 Autonomous Background Web Push via Server VAPID
 */
export async function registerAutonomousPushSubscription(email?: string): Promise<{ success: boolean; message: string }> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { success: false, message: 'Web Push is not supported by your current browser.' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, message: 'Notification permission was denied.' };
    }

    // 1. Fetch server VAPID public key
    const vapidRes = await fetch('/api/notifications/vapid-key');
    if (!vapidRes.ok) throw new Error('Failed to retrieve VAPID key');
    const { publicKey } = await vapidRes.json();

    if (!publicKey) throw new Error('No public key returned by server');

    // 2. Ensure Service Worker is registered and ready
    const registration = await navigator.serviceWorker.ready;

    // 3. Subscribe to PushManager
    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
    }

    // 4. Send subscription to server
    const saveRes = await fetch('/api/notifications/subscribe-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        email: email || 'atharkhanteambuster@gmail.com'
      })
    });

    if (!saveRes.ok) throw new Error('Failed to register subscription with server');

    return {
      success: true,
      message: 'Autonomous push registered! Alerts will fire autonomously even when the browser is closed.'
    };
  } catch (err: any) {
    console.error('[PushNotificationManager] Autonomous push error:', err);
    return {
      success: false,
      message: err?.message || 'Failed to setup autonomous push.'
    };
  }
}

/**
 * Trigger an autonomous server push test
 */
export async function triggerServerAutonomousPushTest(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/notifications/test-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '🎯 Autonomous StudyFlow Alert Verified',
        body: 'Server-side 24/7 scheduler is active! Exam countdowns and retention warnings are armed.'
      })
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: err?.message || 'Test push network error' };
  }
}

