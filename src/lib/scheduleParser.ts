import { ScheduledStudyTask, DayTimeslotSchedule, TimeslotPeriod } from '../types';

export interface ParsedTimeslotResult {
  dayName: string;
  dateStr?: string;
  period: TimeslotPeriod;
  reason: string;
}

const DAY_NAME_MAP: { [key: string]: number } = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

/**
 * Given a base date (usually current week's Monday or today),
 * resolves day of week offset to YYYY-MM-DD.
 */
export function getWeekDates(baseDate: Date = new Date()): { dateStr: string; dayLabel: string; dayIndex: number }[] {
  const current = new Date(baseDate);
  const day = current.getDay();
  // Monday as start of study week (if day === 0 (Sunday), diff is -6)
  const diffToMonday = current.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(current.setDate(diffToMonday));

  const week: { dateStr: string; dayLabel: string; dayIndex: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    week.push({ dateStr, dayLabel, dayIndex: d.getDay() });
  }
  return week;
}

/**
 * Natural language parser that detects busy/unavailable slots from pasted text.
 * Handles inputs like:
 * "Mon 9am-1pm Class, Tue 2-5pm Lab, Wed morning unavailable, Friday evening work"
 */
export function parseBusyScheduleText(
  inputText: string,
  weekDates: { dateStr: string; dayLabel: string; dayIndex: number }[]
): {
  matchedSlots: { dateStr: string; period: TimeslotPeriod; reason: string }[];
  summary: string;
} {
  if (!inputText || !inputText.trim()) {
    return { matchedSlots: [], summary: 'No text provided.' };
  }

  const results: { dateStr: string; period: TimeslotPeriod; reason: string }[] = [];
  const lines = inputText.split(/[\n,;]+/);

  lines.forEach((rawSegment) => {
    const segment = rawSegment.trim().toLowerCase();
    if (!segment) return;

    // Detect Day of week
    let matchedDateStr: string | null = null;
    let detectedDayName = '';

    for (const [name, dayIdx] of Object.entries(DAY_NAME_MAP)) {
      const regex = new RegExp(`\\b${name}\\b`, 'i');
      if (regex.test(segment)) {
        const found = weekDates.find((w) => w.dayIndex === dayIdx);
        if (found) {
          matchedDateStr = found.dateStr;
          detectedDayName = name;
          break;
        }
      }
    }

    // Check "today" or "tomorrow"
    if (!matchedDateStr) {
      if (segment.includes('today')) {
        matchedDateStr = new Date().toISOString().split('T')[0];
      } else if (segment.includes('tomorrow')) {
        const tmr = new Date();
        tmr.setDate(tmr.getDate() + 1);
        matchedDateStr = tmr.toISOString().split('T')[0];
      }
    }

    // If day was detected or defaults to today
    const targetDate = matchedDateStr || weekDates[0]?.dateStr;
    if (!targetDate) return;

    // Extract reason (e.g. class, work, lab, meeting, gym, commute, busy)
    let reason = 'Unavailable / Busy';
    const reasonMatches = segment.match(/(?:for|with|due to|:)?\s*(class|lecture|lab|work|job|shift|meeting|gym|travel|commute|doctor|exam|family|busy|not free|not available|appointment)/i);
    if (reasonMatches && reasonMatches[1]) {
      reason = reasonMatches[1].charAt(0).toUpperCase() + reasonMatches[1].slice(1);
    }

    // Detect periods
    const periodsToMark: TimeslotPeriod[] = [];

    if (segment.includes('morning') || segment.includes('am') || segment.includes('8:') || segment.includes('9:') || segment.includes('10:') || segment.includes('11:')) {
      periodsToMark.push('morning');
    }
    if (segment.includes('afternoon') || segment.includes('noon') || segment.includes('12:') || segment.includes('13:') || segment.includes('14:') || segment.includes('15:') || segment.includes('16:') || segment.includes('1pm') || segment.includes('2pm') || segment.includes('3pm') || segment.includes('4pm')) {
      periodsToMark.push('afternoon');
    }
    if (segment.includes('evening') || segment.includes('17:') || segment.includes('18:') || segment.includes('19:') || segment.includes('20:') || segment.includes('5pm') || segment.includes('6pm') || segment.includes('7pm') || segment.includes('8pm')) {
      periodsToMark.push('evening');
    }
    if (segment.includes('night') || segment.includes('late') || segment.includes('21:') || segment.includes('22:') || segment.includes('23:') || segment.includes('9pm') || segment.includes('10pm') || segment.includes('11pm')) {
      periodsToMark.push('night');
    }
    if (segment.includes('all day') || segment.includes('whole day') || segment.includes('full day')) {
      periodsToMark.push('morning', 'afternoon', 'evening', 'night');
    }

    // Default to afternoon/morning if none explicitly matched but time keywords exist
    if (periodsToMark.length === 0 && (segment.includes('busy') || segment.includes('unavailable') || segment.includes('class') || segment.includes('work'))) {
      periodsToMark.push('afternoon');
    }

    periodsToMark.forEach((p) => {
      if (!results.some((r) => r.dateStr === targetDate && r.period === p)) {
        results.push({
          dateStr: targetDate,
          period: p,
          reason,
        });
      }
    });
  });

  const summary = results.length > 0
    ? `Successfully recognized ${results.length} busy slot(s) across your schedule!`
    : 'No clear timeslot matches found. Try typing e.g. "Mon 9am-1pm Class, Tue 2-5pm Lab".';

  return { matchedSlots: results, summary };
}

/**
 * Creates an instant Google Calendar event template URL
 */
export function createGoogleCalendarUrl(task: {
  title: string;
  date: string; // YYYY-MM-DD
  subjectName: string;
  chapterName?: string;
  topicName?: string;
  durationMinutes: number;
  timeslot?: TimeslotPeriod;
}): string {
  const cleanDate = task.date.replace(/-/g, '');

  let startHour = 9;
  if (task.timeslot === 'morning') startHour = 9;
  else if (task.timeslot === 'afternoon') startHour = 14;
  else if (task.timeslot === 'evening') startHour = 18;
  else if (task.timeslot === 'night') startHour = 21;

  const durationHrs = Math.max(1, Math.round(task.durationMinutes / 60));
  const endHour = Math.min(23, startHour + durationHrs);

  const startIso = `${cleanDate}T${String(startHour).padStart(2, '0')}0000`;
  const endIso = `${cleanDate}T${String(endHour).padStart(2, '0')}0000`;

  const eventTitle = `📖 Study: ${task.subjectName} - ${task.topicName || task.title}`;
  const details = `Subject: ${task.subjectName}\nChapter: ${task.chapterName || 'N/A'}\nTopic: ${task.topicName || task.title}\nPlanned Duration: ${task.durationMinutes} minutes\n\nTracked in StudyFlow Academic Planner.`;

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}&dates=${startIso}/${endIso}&details=${encodeURIComponent(details)}`;
}

/**
 * Generates formatted text/markdown for a Daily Study Action Sheet
 */
export function generateDailyActionDocument(
  dateStr: string,
  targetHours: number,
  actualHours: number,
  tasks: ScheduledStudyTask[],
  dayTimeslots?: DayTimeslotSchedule
): string {
  const d = new Date(dateStr + 'T00:00:00');
  const formattedDate = d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  let doc = `# 📅 DAILY STUDY ACTION SHEET\n`;
  doc += `**Date:** ${formattedDate}\n`;
  doc += `**Daily Target Goal:** ${targetHours} Hours | **Actual Studied:** ${actualHours.toFixed(1)} Hours\n`;
  doc += `**Status:** ${completedCount}/${totalCount} Tasks Completed (${completionRate}%)\n\n`;

  doc += `## 🕒 TIME SLOTS & AVAILABILITY\n`;
  if (dayTimeslots) {
    doc += `- [${dayTimeslots.morning.available ? 'AVAILABLE' : 'BUSY'}] Morning (08:00 - 12:00)${dayTimeslots.morning.note ? ` — *${dayTimeslots.morning.note}*` : ''}\n`;
    doc += `- [${dayTimeslots.afternoon.available ? 'AVAILABLE' : 'BUSY'}] Afternoon (12:00 - 17:00)${dayTimeslots.afternoon.note ? ` — *${dayTimeslots.afternoon.note}*` : ''}\n`;
    doc += `- [${dayTimeslots.evening.available ? 'AVAILABLE' : 'BUSY'}] Evening (17:00 - 21:00)${dayTimeslots.evening.note ? ` — *${dayTimeslots.evening.note}*` : ''}\n`;
    doc += `- [${dayTimeslots.night.available ? 'AVAILABLE' : 'BUSY'}] Night (21:00 - 24:00)${dayTimeslots.night.note ? ` — *${dayTimeslots.night.note}*` : ''}\n\n`;
  } else {
    doc += `- Morning: Available\n- Afternoon: Available\n- Evening: Available\n\n`;
  }

  doc += `## 🎯 PRIORITY STUDY TASKS (CROSS OFF AS YOU COMPLETE)\n`;
  if (tasks.length === 0) {
    doc += `*(No specific tasks scheduled for this day yet)*\n`;
  } else {
    tasks.forEach((t) => {
      const check = t.completed ? '[x]' : '[ ]';
      const slotTag = t.timeslot ? `[${t.timeslot.toUpperCase()}] ` : '';
      doc += `- ${check} ${slotTag}**${t.subjectName}**: ${t.topicName || t.title} (~${t.durationMinutes} mins) ${t.priority === 'High' ? '🔥 HIGH PRIORITY' : ''}\n`;
      if (t.chapterName) {
        doc += `   *Chapter: ${t.chapterName}*\n`;
      }
    });
  }

  doc += `\n## 📝 REFLECTION & NOTES\n`;
  doc += `- Key takeaways from today:\n`;
  doc += `- Questions to review with AI Tutor:\n`;
  doc += `- Plan for tomorrow:\n\n`;
  doc += `---\n*Generated by StudyFlow Academic Assistant*\n`;

  return doc;
}
