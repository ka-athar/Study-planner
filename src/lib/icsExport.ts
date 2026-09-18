import { StudyPlan, StudySession, RevisionItem, ExamDate, TestResult, Assignment } from '../types';

function escapeIcsText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function formatDateToIcsDate(dateStr: string): string {
  // dateStr is expected YYYY-MM-DD
  return dateStr.replace(/-/g, '');
}

function addDaysToIcsDate(dateStr: string, days: number = 1): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return formatDateToIcsDate(dateStr);
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function formatTimeToIcsDateTime(dateStr: string, timeStr?: string): string {
  const cleanDate = dateStr.replace(/-/g, '');
  if (!timeStr) return `${cleanDate}T090000`;
  
  // Clean timeStr like "09:00" or "14:30" or "9:00 AM"
  let hours = 9;
  let minutes = 0;

  if (timeStr.includes(':')) {
    const timeParts = timeStr.trim().split(' ');
    const [h, m] = timeParts[0].split(':');
    hours = parseInt(h, 10) || 9;
    minutes = parseInt(m, 10) || 0;

    if (timeParts[1]) {
      const ampm = timeParts[1].toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
    }
  }

  const hStr = String(hours).padStart(2, '0');
  const mStr = String(minutes).padStart(2, '0');
  return `${cleanDate}T${hStr}${mStr}00`;
}

function addMinutesToDateTime(dateStr: string, startTimeStr: string, minutesToAdd: number): string {
  const cleanDate = dateStr.replace(/-/g, '');
  let hours = 9;
  let minutes = 0;

  if (startTimeStr && startTimeStr.includes(':')) {
    const timeParts = startTimeStr.trim().split(' ');
    const [h, m] = timeParts[0].split(':');
    hours = parseInt(h, 10) || 9;
    minutes = parseInt(m, 10) || 0;

    if (timeParts[1]) {
      const ampm = timeParts[1].toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
    }
  }

  const parts = dateStr.split('-');
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), hours, minutes);
  d.setMinutes(d.getMinutes() + (minutesToAdd || 60));

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hStr = String(d.getHours()).padStart(2, '0');
  const minStr = String(d.getMinutes()).padStart(2, '0');

  return `${y}${m}${day}T${hStr}${minStr}00`;
}

export interface IcsExportOptions {
  plans?: StudyPlan[];
  sessions?: StudySession[];
  examDates?: ExamDate[];
  revisions?: RevisionItem[];
  testResults?: TestResult[];
  assignments?: Assignment[];
  includePlans?: boolean;
  includeSessions?: boolean;
  includeExams?: boolean;
  includeRevisions?: boolean;
  includeTests?: boolean;
  includeAssignments?: boolean;
  calendarName?: string;
  startDate?: string; // Filter YYYY-MM-DD optional
  endDate?: string;   // Filter YYYY-MM-DD optional
}

export function generateIcsCalendarContent(options: IcsExportOptions): string {
  const {
    plans = [],
    sessions = [],
    examDates = [],
    revisions = [],
    testResults = [],
    assignments = [],
    includePlans = true,
    includeSessions = true,
    includeExams = true,
    includeRevisions = true,
    includeTests = true,
    includeAssignments = true,
    calendarName = 'StudyFlow Academic Calendar',
    startDate,
    endDate
  } = options;

  const now = new Date();
  const dtstamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const events: string[] = [];

  // Filter helper
  const inRange = (dateStr: string) => {
    if (!dateStr) return false;
    if (startDate && dateStr < startDate) return false;
    if (endDate && dateStr > endDate) return false;
    return true;
  };

  // 1. Export Target Exam Dates as All-Day VEVENTs
  if (includeExams && examDates.length > 0) {
    examDates.forEach((exam) => {
      if (!inRange(exam.date)) return;
      const startDateIcs = formatDateToIcsDate(exam.date);
      const endDateIcs = addDaysToIcsDate(exam.date, 1);
      const uid = `exam-${exam.id || Math.random()}@studyflow.app`;

      events.push([
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${startDateIcs}`,
        `DTEND;VALUE=DATE:${endDateIcs}`,
        `SUMMARY:${escapeIcsText(`🎯 EXAM: ${exam.examName} (${exam.subjectName})`)}`,
        `DESCRIPTION:${escapeIcsText(`Upcoming Target Exam for ${exam.subjectName}. Priority study goal.`)}`,
        'STATUS:CONFIRMED',
        'CATEGORIES:EXAM,ACADEMIC',
        'END:VEVENT'
      ].join('\r\n'));
    });
  }

  // 2. Export Study Plans as Scheduled Tasks
  if (includePlans && plans.length > 0) {
    plans.forEach((plan) => {
      if (!inRange(plan.date)) return;

      let currentHour = 9; // Default starting hour 9:00 AM

      plan.topics.forEach((topic, idx) => {
        const startHourStr = `${String(currentHour).padStart(2, '0')}:00`;
        const dtstart = formatTimeToIcsDateTime(plan.date, startHourStr);
        const dtend = addMinutesToDateTime(plan.date, startHourStr, topic.estimatedMinutes || 60);

        // Advance currentHour for next topic
        const mins = topic.estimatedMinutes || 60;
        currentHour += Math.ceil(mins / 60);
        if (currentHour >= 22) currentHour = 9;

        const uid = `plan-topic-${topic.id || `${plan.id}-${idx}`}@studyflow.app`;
        const summary = `📖 Study: ${topic.subjectName} - ${topic.topicName}`;
        const description = `Subject: ${topic.subjectName}\\nChapter: ${topic.chapterName}\\nTopic: ${topic.topicName}\\nEstimated Duration: ${topic.estimatedMinutes} mins\\nPriority: ${topic.priority}\\nReasoning: ${topic.reason || plan.reasoning || 'AI Daily Study Schedule'}`;

        events.push([
          'BEGIN:VEVENT',
          `UID:${uid}`,
          `DTSTAMP:${dtstamp}`,
          `DTSTART:${dtstart}`,
          `DTEND:${dtend}`,
          `SUMMARY:${escapeIcsText(summary)}`,
          `DESCRIPTION:${escapeIcsText(description)}`,
          topic.completed ? 'STATUS:COMPLETED' : 'STATUS:CONFIRMED',
          'CATEGORIES:STUDY,PLAN',
          'END:VEVENT'
        ].join('\r\n'));
      });
    });
  }

  // 3. Export Recorded Accomplished Study Sessions
  if (includeSessions && sessions.length > 0) {
    sessions.forEach((session) => {
      if (!inRange(session.date)) return;

      const dtstart = formatTimeToIcsDateTime(session.date, session.startTime || '09:00');
      let dtend = formatTimeToIcsDateTime(session.date, session.endTime);
      if (!session.endTime) {
        dtend = addMinutesToDateTime(session.date, session.startTime || '09:00', session.durationMinutes || 45);
      }

      const uid = `session-${session.id}@studyflow.app`;
      const summary = `✓ Studied: ${session.subjectName} - ${session.topicName}`;
      const description = `Subject: ${session.subjectName}\\nChapter: ${session.chapterName}\\nTopic: ${session.topicName}\\nDuration: ${session.durationMinutes} mins\\nStatus: ${session.result}${session.notes ? `\\nNotes: ${session.notes}` : ''}`;

      events.push([
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${dtstart}`,
        `DTEND:${dtend}`,
        `SUMMARY:${escapeIcsText(summary)}`,
        `DESCRIPTION:${escapeIcsText(description)}`,
        'STATUS:CONFIRMED',
        'CATEGORIES:STUDY,ACCOMPLISHED',
        'END:VEVENT'
      ].join('\r\n'));
    });
  }

  // 4. Export Revisions
  if (includeRevisions && revisions.length > 0) {
    revisions.forEach((rev) => {
      if (!inRange(rev.dueDate)) return;
      const startDateIcs = formatDateToIcsDate(rev.dueDate);
      const endDateIcs = addDaysToIcsDate(rev.dueDate, 1);
      const uid = `revision-${rev.id}@studyflow.app`;

      events.push([
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${startDateIcs}`,
        `DTEND;VALUE=DATE:${endDateIcs}`,
        `SUMMARY:${escapeIcsText(`🔄 Revision Due: ${rev.subjectName} - ${rev.topicName}`)}`,
        `DESCRIPTION:${escapeIcsText(`Spaced Repetition Revision Due! Priority: ${rev.priority}. Subject: ${rev.subjectName}, Topic: ${rev.topicName}${rev.reason ? `\\nReason: ${rev.reason}` : ''}`)}`,
        rev.status === 'Completed' ? 'STATUS:COMPLETED' : 'STATUS:CONFIRMED',
        'CATEGORIES:REVISION,SPACED_REPETITION',
        'END:VEVENT'
      ].join('\r\n'));
    });
  }

  // 5. Export Tests & Mock Assessments
  if (includeTests && testResults.length > 0) {
    testResults.forEach((test) => {
      const rawDate = test.date ? (test.date.includes('T') ? test.date.split('T')[0] : test.date) : '';
      if (!inRange(rawDate)) return;
      const startDateIcs = formatDateToIcsDate(rawDate);
      const endDateIcs = addDaysToIcsDate(rawDate, 1);
      const uid = `test-${test.id}@studyflow.app`;

      events.push([
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${startDateIcs}`,
        `DTEND;VALUE=DATE:${endDateIcs}`,
        `SUMMARY:${escapeIcsText(`📝 Test: ${test.testName || test.subjectName + ' Assessment'}${test.score !== undefined ? ` (${test.score})` : ''}`)}`,
        `DESCRIPTION:${escapeIcsText(`Academic Test Assessment\\nSubject: ${test.subjectName || 'General'}\\nScore: ${test.score !== undefined ? `${test.score}` : 'Pending'}\\nQuestions/Marks: ${test.questionsCount || test.totalMarks || 'N/A'}\\nNotes: ${test.notes || 'Recorded in Tests Vault'}`)}`,
        'STATUS:CONFIRMED',
        'CATEGORIES:ASSESSMENT,TEST',
        'END:VEVENT'
      ].join('\r\n'));
    });
  }

  // 6. Export Assignments & Deadlines
  if (includeAssignments && assignments.length > 0) {
    assignments.forEach((asg) => {
      if (!inRange(asg.dueDate)) return;
      const startDateIcs = formatDateToIcsDate(asg.dueDate);
      const endDateIcs = addDaysToIcsDate(asg.dueDate, 1);
      const uid = `assignment-${asg.id}@studyflow.app`;

      events.push([
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${startDateIcs}`,
        `DTEND;VALUE=DATE:${endDateIcs}`,
        `SUMMARY:${escapeIcsText(`📌 Assignment: ${asg.title} (${asg.subjectName || 'Coursework'})`)}`,
        `DESCRIPTION:${escapeIcsText(`Coursework Assignment\\nSubject: ${asg.subjectName || 'Academic'}\\nPriority: ${asg.priority || 'Medium'}\\nStatus: ${asg.status || 'Pending'}\\nDue Date: ${asg.dueDate}`)}`,
        asg.status === 'Completed' ? 'STATUS:COMPLETED' : 'STATUS:CONFIRMED',
        'CATEGORIES:ASSIGNMENT,COURSEWORK',
        'END:VEVENT'
      ].join('\r\n'));
    });
  }

  const icsHeader = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StudyFlow Planner//Academic Calendar Exporter//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    'X-WR-TIMEZONE:UTC'
  ].join('\r\n');

  const icsFooter = 'END:VCALENDAR';

  if (events.length === 0) {
    // Add a placeholder dummy event if empty to avoid syntax error on Google Calendar import
    const startDateIcs = formatDateToIcsDate(new Date().toISOString().split('T')[0]);
    events.push([
      'BEGIN:VEVENT',
      `UID:placeholder-${Date.now()}@studyflow.app`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${startDateIcs}`,
      `DTEND;VALUE=DATE:${startDateIcs}`,
      'SUMMARY:StudyFlow Schedule Initialized',
      'DESCRIPTION:Your study plan calendar exported successfully.',
      'END:VEVENT'
    ].join('\r\n'));
  }

  return `${icsHeader}\r\n${events.join('\r\n')}\r\n${icsFooter}`;
}

export function downloadIcsFile(content: string, filename: string = 'study_schedule.ics') {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
