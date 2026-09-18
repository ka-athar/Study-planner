/**
 * Google Tasks Integration Service
 * Real-time task synchronization, task list management, and task item tracking via Google Tasks API v1.
 */

import { getOrRequestWorkspaceToken, getCachedWorkspaceToken } from './googleAuthService';
import { StudyPlan, RevisionItem, ExamDate } from '../types';

export interface GoogleTaskList {
  id: string;
  title: string;
  updated?: string;
  selfLink?: string;
}

export interface GoogleTaskItem {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
  completed?: string;
  updated?: string;
  parent?: string;
  position?: string;
  links?: Array<{ href: string; type: string; description?: string }>;
}

/**
 * Lists all task lists for the current user.
 */
export async function listTaskLists(tokenOverride?: string): Promise<GoogleTaskList[]> {
  const token = tokenOverride || getCachedWorkspaceToken();
  if (!token) {
    return [];
  }

  try {
    const response = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.warn(`Failed to fetch task lists (${response.status})`, err);
      return [];
    }

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.warn('Network error fetching task lists:', error);
    return [];
  }
}

/**
 * Finds or creates a dedicated "StudyFlow Academic Tasks" list.
 */
export async function getOrCreateStudyTaskList(): Promise<GoogleTaskList> {
  const lists = await listTaskLists();
  const existing = lists.find(l => l.title === 'StudyFlow Academic Tasks' || l.title === 'Study Tasks');
  if (existing) return existing;

  const token = await getOrRequestWorkspaceToken(true);
  const createRes = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: 'StudyFlow Academic Tasks'
    })
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to create task list (${createRes.status})`);
  }

  return await createRes.json();
}

/**
 * Lists tasks in a specific task list.
 */
export async function listTasks(taskListId: string = '@default', tokenOverride?: string): Promise<GoogleTaskItem[]> {
  const token = tokenOverride || getCachedWorkspaceToken();
  if (!token) {
    return [];
  }

  const params = new URLSearchParams({
    showCompleted: 'true',
    showHidden: 'true',
    maxResults: '100'
  });

  try {
    const response = await fetch(
      `https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.warn(`Tasks fetch returned status ${response.status}`, err);
      return [];
    }

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.warn('Network error fetching tasks:', error);
    return [];
  }
}

/**
 * Creates a new task in Google Tasks.
 */
export async function createGoogleTask(
  task: {
    title: string;
    notes?: string;
    dueDate?: string; // YYYY-MM-DD
    taskListId?: string;
  }
): Promise<GoogleTaskItem> {
  const token = await getOrRequestWorkspaceToken();
  const taskListId = task.taskListId || '@default';

  const body: any = {
    title: task.title,
    notes: task.notes || 'Created by StudyFlow Study Planner',
    status: 'needsAction'
  };

  if (task.dueDate) {
    // Google Tasks requires RFC 3339 timestamp with T00:00:00.000Z
    const cleanDate = task.dueDate.split('T')[0];
    body.due = `${cleanDate}T00:00:00.000Z`;
  }

  const response = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to create task in Google Tasks (${response.status})`);
  }

  return await response.json();
}

/**
 * Toggles a task's status between 'completed' and 'needsAction'.
 */
export async function toggleGoogleTaskStatus(
  taskListId: string = '@default',
  taskId: string,
  completed: boolean
): Promise<GoogleTaskItem> {
  const token = await getOrRequestWorkspaceToken();
  const payload: any = {
    status: completed ? 'completed' : 'needsAction'
  };

  if (!completed) {
    payload.completed = null;
  }

  const response = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to update task status (${response.status})`);
  }

  return await response.json();
}

/**
 * Deletes a task from Google Tasks.
 */
export async function deleteGoogleTask(taskListId: string = '@default', taskId: string): Promise<boolean> {
  const token = await getOrRequestWorkspaceToken();
  const response = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok && response.status !== 404) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to delete task (${response.status})`);
  }

  return true;
}

/**
 * Batch syncs study plan topics and spaced revisions into Google Tasks.
 */
export async function syncPlansAndRevisionsToGoogleTasks(
  items: {
    plans?: StudyPlan[];
    revisions?: RevisionItem[];
    examDates?: ExamDate[];
  },
  onProgress?: (current: number, total: number, taskName: string) => void
): Promise<{ success: boolean; createdCount: number; errors: string[] }> {
  const taskList = await getOrCreateStudyTaskList();
  const taskListId = taskList.id;
  const errors: string[] = [];
  let createdCount = 0;

  const tasksToQueue: Array<{ title: string; notes: string; dueDate?: string }> = [];

  // 1. Study Plan Topics
  (items.plans || []).forEach(plan => {
    (plan.topics || []).forEach(tp => {
      if (!tp.completed) {
        tasksToQueue.push({
          title: `📖 [${tp.subjectName}] ${tp.topicName}`,
          notes: `Chapter: ${tp.chapterName}\nEstimated: ${tp.estimatedMinutes}m | Priority: ${tp.priority}\nPlan: ${plan.title || 'Daily Target'}\nSynced from StudyFlow`,
          dueDate: plan.date
        });
      }
    });
  });

  // 2. Spaced Revisions Due
  (items.revisions || []).forEach(rev => {
    if (rev.status !== 'Completed') {
      tasksToQueue.push({
        title: `🔄 Revise: ${rev.topicName} (${rev.subjectName})`,
        notes: `Chapter: ${rev.chapterName}\nPriority: ${rev.priority}\nDue Date: ${rev.dueDate}\nReason: ${rev.reason || 'Spaced Repetition'}`,
        dueDate: rev.dueDate
      });
    }
  });

  // 3. Exam Targets
  (items.examDates || []).forEach(exam => {
    tasksToQueue.push({
      title: `🎯 EXAM: ${exam.examName} (${exam.subjectName})`,
      notes: `Target Exam Date: ${exam.date}\nCountdown active in StudyFlow.`,
      dueDate: exam.date
    });
  });

  const total = tasksToQueue.length;
  for (let i = 0; i < total; i++) {
    const item = tasksToQueue[i];
    if (onProgress) onProgress(i + 1, total, item.title);

    try {
      await createGoogleTask({
        title: item.title,
        notes: item.notes,
        dueDate: item.dueDate,
        taskListId
      });
      createdCount++;
      await new Promise(r => setTimeout(r, 120));
    } catch (e: any) {
      errors.push(`Failed to add task "${item.title}": ${e.message}`);
    }
  }

  return {
    success: errors.length === 0,
    createdCount,
    errors
  };
}
