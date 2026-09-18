/**
 * Google Calendar Integration Service
 * Real-time synchronization with user's Google Calendar via Google Calendar API v3.
 */

import { getOrRequestWorkspaceToken, getCachedWorkspaceToken } from './googleAuthService';
import { StudyPlan, ExamDate, RevisionItem, TestResult, Assignment } from '../types';

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  htmlLink?: string;
  colorId?: string;
  location?: string;
}

/**
 * Lists events from the user's Primary Google Calendar for a date range.
 */
export async function listCalendarEvents(
  timeMin?: string,
  timeMax?: string,
  tokenOverride?: string
): Promise<GoogleCalendarEvent[]> {
  const token = tokenOverride || getCachedWorkspaceToken();
  if (!token) {
    return [];
  }

  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });

  if (timeMin) params.append('timeMin', new Date(timeMin).toISOString());
  if (timeMax) params.append('timeMax', new Date(timeMax).toISOString());

  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.warn(`Calendar fetch failed with status ${response.status}`, err);
      return [];
    }

    const data = await response.json();
    return (data.items || []).map((item: any) => ({
      id: item.id,
      summary: item.summary || '(Untitled Event)',
      description: item.description || '',
      start: item.start || {},
      end: item.end || {},
      htmlLink: item.htmlLink,
      colorId: item.colorId,
      location: item.location
    }));
  } catch (error) {
    console.warn('Network error fetching calendar events:', error);
    return [];
  }
}

/**
 * Creates a single event on the user's primary Google Calendar.
 */
export async function createCalendarEvent(
  event: {
    summary: string;
    description?: string;
    startDate: string; // YYYY-MM-DD
    startTime?: string; // HH:mm
    durationMinutes?: number;
    colorId?: string;
    createMeetLink?: boolean;
  },
  tokenOverride?: string
): Promise<GoogleCalendarEvent> {
  const token = tokenOverride || await getOrRequestWorkspaceToken();

  let startBody: any;
  let endBody: any;

  if (event.startTime) {
    const startDateTime = new Date(`${event.startDate}T${event.startTime}:00`);
    const duration = event.durationMinutes || 60;
    const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);

    startBody = { dateTime: startDateTime.toISOString() };
    endBody = { dateTime: endDateTime.toISOString() };
  } else {
    // All-day event
    const nextDay = new Date(event.startDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = nextDay.toISOString().split('T')[0];

    startBody = { date: event.startDate };
    endBody = { date: nextDayStr };
  }

  const payload: any = {
    summary: event.summary,
    description: event.description || 'Created by StudyFlow Study Planner [StudyFlow]',
    start: startBody,
    end: endBody,
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 15 },
        { method: 'email', minutes: 60 },
      ],
    },
  };

  if (event.colorId) {
    payload.colorId = event.colorId;
  }

  // Automatic Google Meet Study Room Links
  if (event.createMeetLink) {
    payload.conferenceData = {
      createRequest: {
        requestId: `study-meet-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        conferenceSolutionKey: {
          type: 'hangoutsMeet'
        }
      }
    };
  }

  const url = event.createMeetLink 
    ? 'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1'
    : 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

  const response = await fetch(
    url,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to create calendar event (${response.status})`);
  }

  return await response.json();
}

/**
 * Batch sync study plans, exams, revisions, tests, and assignments to Google Calendar.
 * Supports auto-generating Google Meet study room links and color-coded time blocking.
 */
export async function syncStudyPlansToGoogleCalendar(
  items: {
    plans?: StudyPlan[];
    examDates?: ExamDate[];
    revisions?: RevisionItem[];
    testResults?: TestResult[];
    assignments?: Assignment[];
    autoCreateMeetLinks?: boolean;
  },
  onProgress?: (current: number, total: number, itemName: string) => void
): Promise<{ success: boolean; createdCount: number; errors: string[] }> {
  const token = await getOrRequestWorkspaceToken();
  const errors: string[] = [];
  let createdCount = 0;
  const autoCreateMeet = items.autoCreateMeetLinks !== false;

  // Flatten items into event tasks
  const tasksToCreate: Array<{
    summary: string;
    description: string;
    startDate: string;
    startTime?: string;
    durationMinutes?: number;
    colorId?: string;
    createMeetLink?: boolean;
  }> = [];

  // 1. Study Plans (Color: '9' Blueberry / Blue or '11' if urgent)
  (items.plans || []).forEach(plan => {
    if (plan.date) {
      const topicSummaries = plan.topics?.map(t => `${t.subjectName}: ${t.topicName} (~${t.estimatedMinutes}m)`).join('\n• ') || '';
      const totalMinutes = plan.topics?.reduce((acc, t) => acc + (t.estimatedMinutes || 30), 0) || ((plan.availableHours || 2) * 60);

      tasksToCreate.push({
        summary: `📚 ${plan.title || 'Academic Study Session'} [StudyFlow]`,
        description: `Scheduled Topics:\n• ${topicSummaries}\n\nReasoning: ${plan.reasoning || 'Daily academic study goal.'}\n[StudyFlow-Plan-Id:${plan.id}]`,
        startDate: plan.date,
        durationMinutes: totalMinutes,
        colorId: '9', // Blueberry / Blue
        createMeetLink: autoCreateMeet // Attaches real Google Meet room
      });
    }
  });

  // 2. Exam Dates (Color: '11' Flamingo / Urgent Red)
  (items.examDates || []).forEach(exam => {
    if (exam.date) {
      tasksToCreate.push({
        summary: `🎯 EXAM: ${exam.examName} (${exam.subjectName}) [StudyFlow]`,
        description: `Subject: ${exam.subjectName}\nExam: ${exam.examName}\nTarget date locked in StudyPlanner.\n[StudyFlow-Exam-Id:${exam.id}]`,
        startDate: exam.date,
        colorId: '11' // Red / Urgent
      });
    }
  });

  // 3. Spaced Revisions (Color: '5' Banana / Warm Amber)
  (items.revisions || []).forEach(rev => {
    if (rev.dueDate && rev.status !== 'Completed') {
      const isWeak = rev.priority === 'High';
      tasksToCreate.push({
        summary: `🔄 Revision: ${rev.topicName} (${rev.subjectName}) [StudyFlow]`,
        description: `Subject: ${rev.subjectName}\nChapter: ${rev.chapterName}\nPriority: ${rev.priority}\nLast Studied: ${rev.lastStudied || 'N/A'}\nReason: ${rev.reason || 'Spaced Repetition Review'}\n[StudyFlow-Rev-Id:${rev.id}]`,
        startDate: rev.dueDate,
        durationMinutes: 45,
        colorId: isWeak ? '11' : '5', // Urgent Red if High priority, else Amber
        createMeetLink: autoCreateMeet
      });
    }
  });

  // 4. Test Results / Mock Tests (Color: '3' Grape / Purple)
  (items.testResults || []).forEach(test => {
    if (test.date) {
      const datePart = test.date.includes('T') ? test.date.split('T')[0] : test.date;
      tasksToCreate.push({
        summary: `📝 Test Assessment: ${test.testName || test.subjectName + ' Mock Test'} [StudyFlow]`,
        description: `Subject: ${test.subjectName || 'General Academic'}\nScore: ${test.score !== undefined ? `${test.score}` : 'Recorded'}\nTotal Questions/Marks: ${test.questionsCount || test.totalMarks || 'N/A'}\nNotes: ${test.notes || 'Saved in StudyPlanner Tests Vault'}\n[StudyFlow-Test-Id:${test.id}]`,
        startDate: datePart,
        durationMinutes: 60,
        colorId: '3' // Grape / Purple
      });
    }
  });

  // 5. Assignments & Deadlines (Color: '6' Tangerine / Orange)
  (items.assignments || []).forEach(asg => {
    if (asg.dueDate) {
      tasksToCreate.push({
        summary: `📌 Assignment: ${asg.title} (${asg.subjectName || 'Coursework'}) [StudyFlow]`,
        description: `Subject: ${asg.subjectName || 'Academic'}\nPriority: ${asg.priority || 'Medium'}\nStatus: ${asg.status || 'Pending'}\nDue Date: ${asg.dueDate}\n[StudyFlow-Asg-Id:${asg.id}]`,
        startDate: asg.dueDate,
        colorId: '6' // Tangerine / Orange
      });
    }
  });

  const total = tasksToCreate.length;
  for (let i = 0; i < total; i++) {
    const t = tasksToCreate[i];
    if (onProgress) onProgress(i + 1, total, t.summary);

    try {
      await createCalendarEvent(t, token);
      createdCount++;
      // Polite rate-limiting between API requests
      await new Promise(r => setTimeout(r, 150));
    } catch (e: any) {
      errors.push(`Failed to add "${t.summary}": ${e.message}`);
    }
  }

  return {
    success: errors.length === 0,
    createdCount,
    errors
  };
}

export interface CalendarRescheduleProposal {
  planId: string;
  planTitle: string;
  originalDate: string;
  calendarDate: string;
  calendarEventId: string;
  summary: string;
  topicName?: string;
  oldDate?: string;
  newDate?: string;
  oldTime?: string;
  newTime?: string;
}

export type CalendarRescheduleItem = CalendarRescheduleProposal;

/**
 * Two-Way Reschedule Sync:
 * Inspects Google Calendar events to detect if any StudyFlow study blocks were dragged or rescheduled
 * in Google Calendar on the student's phone or desktop.
 */
export async function detectCalendarReschedules(params: StudyPlan[] | {
  plans: StudyPlan[];
  timeMin?: string;
  timeMax?: string;
}): Promise<CalendarRescheduleProposal[]> {
  try {
    const plansList: StudyPlan[] = Array.isArray(params) ? params : (params.plans || []);
    const timeMinParam = Array.isArray(params) ? undefined : params.timeMin;
    const timeMaxParam = Array.isArray(params) ? undefined : params.timeMax;

    const now = new Date();
    const defaultMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const defaultMax = new Date(now.getFullYear(), now.getMonth() + 2, 28).toISOString();

    const events = await listCalendarEvents(
      timeMinParam || defaultMin,
      timeMaxParam || defaultMax
    );

    const proposals: CalendarRescheduleProposal[] = [];

    events.forEach(event => {
      const desc = event.description || '';
      const summary = event.summary || '';

      // Match event to plan ID either via tag in description or title
      const match = desc.match(/\[StudyFlow-Plan-Id:([^\]]+)\]/);
      let matchedPlan: StudyPlan | undefined;

      if (match && match[1]) {
        matchedPlan = plansList.find(p => p.id === match[1]);
      } else if (summary.includes('[StudyFlow]')) {
        const cleanTitle = summary.replace('[StudyFlow]', '').replace('📚', '').trim();
        matchedPlan = plansList.find(p => p.title.trim() === cleanTitle);
      }

      if (matchedPlan) {
        // Get event date
        let calDate = '';
        if (event.start?.date) {
          calDate = event.start.date;
        } else if (event.start?.dateTime) {
          calDate = event.start.dateTime.split('T')[0];
        }

        if (calDate && matchedPlan.date && calDate !== matchedPlan.date) {
          proposals.push({
            planId: matchedPlan.id,
            planTitle: matchedPlan.title,
            originalDate: matchedPlan.date,
            calendarDate: calDate,
            calendarEventId: event.id,
            summary: event.summary,
            topicName: matchedPlan.title,
            oldDate: matchedPlan.date,
            newDate: calDate
          });
        }
      }
    });

    return proposals;
  } catch (err) {
    console.warn('[GoogleCalendarService] detectCalendarReschedules failed:', err);
    return [];
  }
}

/**
 * Applies detected Google Calendar reschedules back to local StudyFlow study plans.
 * Supports both (proposals, plans) and (plans, proposals).
 */
export function applyCalendarReschedules(
  arg1: any,
  arg2: any
): StudyPlan[] {
  let plans: StudyPlan[] = [];
  let proposals: CalendarRescheduleProposal[] = [];

  if (Array.isArray(arg1) && arg1.length > 0 && ('planId' in arg1[0] || 'calendarEventId' in arg1[0])) {
    proposals = arg1 as CalendarRescheduleProposal[];
    plans = arg2 as StudyPlan[];
  } else if (Array.isArray(arg2) && arg2.length > 0 && ('planId' in arg2[0] || 'calendarEventId' in arg2[0])) {
    proposals = arg2 as CalendarRescheduleProposal[];
    plans = arg1 as StudyPlan[];
  } else {
    plans = (Array.isArray(arg1) ? arg1 : []) as StudyPlan[];
    proposals = (Array.isArray(arg2) ? arg2 : []) as CalendarRescheduleProposal[];
  }

  const map = new Map<string, string>();
  proposals.forEach(p => map.set(p.planId, p.calendarDate || p.newDate || ''));

  return plans.map(plan => {
    if (map.has(plan.id)) {
      return {
        ...plan,
        date: map.get(plan.id)!,
        updatedAt: new Date().toISOString()
      };
    }
    return plan;
  });
}

/**
 * Deletes an event from Google Calendar.
 */
export async function deleteCalendarEvent(eventId: string, tokenOverride?: string): Promise<boolean> {
  const token = tokenOverride || await getOrRequestWorkspaceToken();
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok && response.status !== 404) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to delete event (${response.status})`);
  }

  return true;
}
