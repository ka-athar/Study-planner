// Helper for WhatsApp Study Companion & Reminders
// Generates beautifully formatted WhatsApp messages and direct 1-click wa.me links

export interface WhatsAppBriefData {
  studentName?: string;
  dateStr?: string;
  streak: number;
  priorityTopics: { subject: string; title: string; duration: number }[];
  flashcardsDueCount: number;
  dailyGoalHours: number;
  xpEarnedToday?: number;
  hoursStudiedToday?: number;
}

export function generateMorningFlightPlanMessage(data: WhatsAppBriefData): string {
  const date = data.dateStr || new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  
  let msg = `🌅 *TODAY'S STUDY FLIGHT PLAN* 🎯\n`;
  msg += `📅 _${date}_\n\n`;
  msg += `🔥 *Current Streak:* ${data.streak} Days Unbroken!\n`;
  msg += `⏱️ *Target:* ${data.dailyGoalHours}h Deep Focus\n\n`;

  if (data.priorityTopics.length > 0) {
    msg += `📌 *Top Priority Topics:*\n`;
    data.priorityTopics.forEach((t, i) => {
      msg += `${i + 1}. *${t.subject}*: ${t.title} (${t.duration}m)\n`;
    });
    msg += `\n`;
  } else {
    msg += `📌 *Priority:* Review scheduled chapters & active flashcards\n\n`;
  }

  if (data.flashcardsDueCount > 0) {
    msg += `🗂️ *Spaced Repetition:* ${data.flashcardsDueCount} flashcards due for review today.\n\n`;
  }

  msg += `💡 _"Small disciplines repeated with consistency every day lead to great achievements gained slowly over time."_\n\n`;
  msg += `🚀 Open your study app to launch your first Pomodoro session!`;

  return msg;
}

export function generateDailyDigestMessage(data: WhatsAppBriefData): string {
  const date = data.dateStr || new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  
  let msg = `📊 *DAILY STUDY RECAP & PROGRESS* 🌟\n`;
  msg += `📅 _${date}_\n\n`;
  msg += `⏱️ *Focus Time Logged:* ${(data.hoursStudiedToday || 0).toFixed(1)} Hours\n`;
  msg += `⚡ *XP Earned Today:* +${data.xpEarnedToday || 0} XP\n`;
  msg += `🔥 *Streak Protected:* ${data.streak} Days Strong!\n\n`;

  if (data.priorityTopics.length > 0) {
    msg += `✅ *Sessions Completed:*\n`;
    data.priorityTopics.forEach(t => {
      msg += `• ${t.subject} - ${t.title}\n`;
    });
    msg += `\n`;
  }

  msg += `🌙 Great work today. Rest well for optimal memory consolidation!`;

  return msg;
}

export function generateRevisionReminderMessage(subject: string, topic: string, urgency: string): string {
  let msg = `⚡ *STUDY REVISION REMINDER* 📚\n\n`;
  msg += `Subject: *${subject}*\n`;
  msg += `Topic: *${topic}*\n`;
  msg += `Urgency: *${urgency}*\n\n`;
  msg += `According to the Ebbinghaus forgetting curve, reviewing this topic now will lock it into long-term memory!\n\n`;
  msg += `👉 Open your study planner to begin active retrieval:`;
  return msg;
}

export function buildWaMeUrl(phoneNumber: string, text: string): string {
  // Clean phone number: remove non-digits
  const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
  const encodedText = encodeURIComponent(text);
  
  if (cleanNumber) {
    return `https://wa.me/${cleanNumber}?text=${encodedText}`;
  }
  // If no phone number provided, wa.me allows opening WhatsApp with pre-filled text where user chooses recipient (e.g. self-chat or group)
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

export function generateCompletedWorkWhatsAppMessage(session: {
  subjectName: string;
  topicName: string;
  durationMinutes: number;
  notes?: string;
  date?: string;
}): string {
  const dateStr = session.date || new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  let msg = `✅ *STUDY SESSION COMPLETED* ⏱️\n\n`;
  msg += `📅 *Date:* ${dateStr}\n`;
  msg += `📚 *Subject:* ${session.subjectName}\n`;
  msg += `📖 *Topic:* ${session.topicName}\n`;
  msg += `⏱️ *Focus Time:* ${session.durationMinutes} minutes\n`;
  if (session.notes) {
    msg += `📝 *Takeaways:* ${session.notes}\n`;
  }
  msg += `\n🎯 Keep pushing forward with relentless consistency!`;
  return msg;
}

const STORAGE_KEY = 'study_whatsapp_config_v1';

export function loadWhatsAppConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn('Could not load WhatsApp config', e);
  }
  return {
    phoneNumber: '',
    countryCode: '+1',
    callMeBotApiKey: '',
    enabled: true,
    dailyDigestTime: '20:00',
    includeStreaks: true,
    includePriorityTopics: true,
    includeDueFlashcards: true,
  };
}

export function saveWhatsAppConfig(config: unknown) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Could not save WhatsApp config', e);
  }
}
