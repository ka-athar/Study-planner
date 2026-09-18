/**
 * Two-Way Google Calendar & Google Tasks Sync Service
 * Handles bidirectional synchronization, free study slot discovery, conflict detection,
 * and automatic status propagation between StudyOS and Google Workspace.
 */

import { StudyPlan, StudySession, RevisionItem, ExamDate, StudyPlanTopic } from '../types';
import { listCalendarEvents, createCalendarEvent, GoogleCalendarEvent } from './googleCalendarService';
import { 
  getOrCreateStudyTaskList, 
  listTasks, 
  createGoogleTask, 
  toggleGoogleTaskStatus, 
  GoogleTaskItem 
} from './googleTasksService';
import { getOrRequestWorkspaceToken } from './googleAuthService';

export interface FreeStudySlot {
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  durationMinutes: number;
  label: string;
}

export interface ScheduleConflict {
  studyTopic: string;
  planDate: string;
  planTime?: string;
  conflictingEventTitle: string;
  eventStart: string;
  eventEnd: string;
}

export interface TwoWaySyncResult {
  calendarEventsCreated: number;
  calendarEventsFetched: number;
  tasksCreated: number;
  tasksUpdated: number;
  studyOSTasksUpdated: number;
  freeSlotsFound: FreeStudySlot[];
  conflicts: ScheduleConflict[];
  errors: string[];
}

/**
 * Calculates available "Free Study Slots" for a given day based on external Google Calendar events.
 */
export function calculateFreeStudySlots(
  calendarEvents: GoogleCalendarEvent[],
  dayStartHour: number = 8, // 08:00
  dayEndHour: number = 22    // 22:00
): FreeStudySlot[] {
  // Filter events for the day that have specific start/end dateTime
  const busyRanges: Array<{ startMin: number; endMin: number; title: string }> = [];

  calendarEvents.forEach(evt => {
    if (evt.start?.dateTime && evt.end?.dateTime) {
      const s = new Date(evt.start.dateTime);
      const e = new Date(evt.end.dateTime);
      const startMin = s.getHours() * 60 + s.getMinutes();
      const endMin = e.getHours() * 60 + e.getMinutes();
      if (endMin > startMin) {
        busyRanges.push({ startMin, endMin, title: evt.summary });
      }
    }
  });

  // Sort busy ranges chronologically
  busyRanges.sort((a, b) => a.startMin - b.startMin);

  // Merge overlapping busy ranges
  const mergedBusy: Array<{ startMin: number; endMin: number }> = [];
  busyRanges.forEach(range => {
    if (mergedBusy.length === 0) {
      mergedBusy.push({ startMin: range.startMin, endMin: range.endMin });
    } else {
      const last = mergedBusy[mergedBusy.length - 1];
      if (range.startMin <= last.endMin) {
        last.endMin = Math.max(last.endMin, range.endMin);
      } else {
        mergedBusy.push({ startMin: range.startMin, endMin: range.endMin });
      }
    }
  });

  // Scan gaps between dayStartHour and dayEndHour
  const dayStartMin = dayStartHour * 60;
  const dayEndMin = dayEndHour * 60;
  const freeSlots: FreeStudySlot[] = [];

  let currentCursor = dayStartMin;

  mergedBusy.forEach(busy => {
    if (busy.startMin > currentCursor) {
      const gapMin = busy.startMin - currentCursor;
      if (gapMin >= 25) { // At least 25 minutes for a productive pomodoro slot
        const sH = Math.floor(currentCursor / 60).toString().padStart(2, '0');
        const sM = (currentCursor % 60).toString().padStart(2, '0');
        const eH = Math.floor(busy.startMin / 60).toString().padStart(2, '0');
        const eM = (busy.startMin % 60).toString().padStart(2, '0');
        freeSlots.push({
          startTime: `${sH}:${sM}`,
          endTime: `${eH}:${eM}`,
          durationMinutes: gapMin,
          label: `${gapMin >= 60 ? `${(gapMin / 60).toFixed(1)}h` : `${gapMin}m`} Focus Window`
        });
      }
    }
    currentCursor = Math.max(currentCursor, busy.endMin);
  });

  if (currentCursor < dayEndMin) {
    const gapMin = dayEndMin - currentCursor;
    if (gapMin >= 25) {
      const sH = Math.floor(currentCursor / 60).toString().padStart(2, '0');
      const sM = (currentCursor % 60).toString().padStart(2, '0');
      const eH = Math.floor(dayEndMin / 60).toString().padStart(2, '0');
      const eM = (dayEndMin % 60).toString().padStart(2, '0');
      freeSlots.push({
        startTime: `${sH}:${sM}`,
        endTime: `${eH}:${eM}`,
        durationMinutes: gapMin,
        label: `${gapMin >= 60 ? `${(gapMin / 60).toFixed(1)}h` : `${gapMin}m`} Focus Window`
      });
    }
  }

  return freeSlots;
}

/**
 * Executes a full Two-Way Synchronization with Google Calendar & Google Tasks.
 */
export async function executeTwoWaySync(params: {
  plans: StudyPlan[];
  todayStr: string;
  revisions: RevisionItem[];
  examDates?: ExamDate[];
  onTopicStatusChanged?: (topicName: string, subjectName: string, completed: boolean) => void;
}): Promise<TwoWaySyncResult> {
  const { plans, todayStr, revisions, examDates = [], onTopicStatusChanged } = params;
  const result: TwoWaySyncResult = {
    calendarEventsCreated: 0,
    calendarEventsFetched: 0,
    tasksCreated: 0,
    tasksUpdated: 0,
    studyOSTasksUpdated: 0,
    freeSlotsFound: [],
    conflicts: [],
    errors: []
  };

  const token = await getOrRequestWorkspaceToken();

  // 1. PULL GOOGLE CALENDAR EVENTS FOR TODAY & TOMORROW
  try {
    const todayStart = `${todayStr}T00:00:00Z`;
    const tomorrow = new Date(todayStr + 'T12:00:00');
    tomorrow.setDate(tomorrow.getDate() + 2);
    const tomorrowEnd = tomorrow.toISOString();

    const calEvents = await listCalendarEvents(todayStart, tomorrowEnd, token);
    result.calendarEventsFetched = calEvents.length;

    // Calculate free slots for today
    result.freeSlotsFound = calculateFreeStudySlots(calEvents);
  } catch (e: any) {
    result.errors.push(`Google Calendar sync error: ${e.message}`);
  }

  // 2. TWO-WAY GOOGLE TASKS SYNCHRONIZATION
  try {
    const taskList = await getOrCreateStudyTaskList();
    const existingGoogleTasks = await listTasks(taskList.id);

    const todayPlan = plans.find(p => p.date === todayStr);
    const topics = todayPlan?.topics || [];

    // Map existing Google Tasks by normalized title
    const gTaskMap = new Map<string, GoogleTaskItem>();
    existingGoogleTasks.forEach(gt => {
      gTaskMap.set(gt.title.trim().toLowerCase(), gt);
    });

    // A. Sync StudyOS topics -> Google Tasks
    for (const topic of topics) {
      const topicKey = `📖 [${topic.subjectName}] ${topic.topicName}`.toLowerCase();
      const existing = gTaskMap.get(topicKey);

      if (!existing) {
        // Create new task in Google Tasks
        try {
          await createGoogleTask({
            title: `📖 [${topic.subjectName}] ${topic.topicName}`,
            notes: `Chapter: ${topic.chapterName || 'General'}\nEst: ${topic.estimatedMinutes}m | Priority: ${topic.priority}\nSynced from StudyOS`,
            dueDate: todayStr,
            taskListId: taskList.id
          });
          result.tasksCreated++;
        } catch (err: any) {
          result.errors.push(`Failed to create task ${topic.topicName}: ${err.message}`);
        }
      } else {
        // Task exists in Google Tasks. Check if Google Tasks has been completed!
        const isGTaskCompleted = existing.status === 'completed';
        if (isGTaskCompleted && !topic.completed) {
          // Propagate Google Tasks completion into StudyOS!
          if (onTopicStatusChanged) {
            onTopicStatusChanged(topic.topicName, topic.subjectName, true);
            result.studyOSTasksUpdated++;
          }
        } else if (!isGTaskCompleted && topic.completed) {
          // StudyOS is completed but Google Tasks is not -> toggle Google Tasks!
          try {
            await toggleGoogleTaskStatus(taskList.id, existing.id, true);
            result.tasksUpdated++;
          } catch (err: any) {
            result.errors.push(`Failed to mark task completed: ${err.message}`);
          }
        }
      }
    }
  } catch (e: any) {
    result.errors.push(`Google Tasks 2-Way Sync error: ${e.message}`);
  }

  return result;
}
