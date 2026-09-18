// Offline Data Integrity & Sync Queue
// Stores mutations locally when offline and automatically flushes them upon reconnection

export interface OfflineMutation {
  id: string;
  actionType: 
    | 'UPDATE_TOPIC_STATUS' 
    | 'ADD_TEST_RESULT' 
    | 'LOG_STUDY_SESSION' 
    | 'UPDATE_REVISION' 
    | 'LOG_MISTAKE' 
    | 'UPDATE_SUBJECTS';
  payload: any;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
  errorMessage?: string;
}

const STORAGE_KEY = 'studyflow_offline_sync_queue_v2';
const LAST_SYNC_KEY = 'studyflow_last_sync_timestamp';

// Retrieve all pending mutations
export function getOfflineQueue(): OfflineMutation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read offline sync queue:', e);
    return [];
  }
}

// Save queue to local storage
function saveOfflineQueue(queue: OfflineMutation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    notifyQueueChange();
  } catch (e) {
    console.error('Failed to save offline sync queue:', e);
  }
}

// Queue a new offline mutation
export function enqueueOfflineMutation(
  actionType: OfflineMutation['actionType'],
  payload: any
): OfflineMutation {
  const mutation: OfflineMutation = {
    id: `mut_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    actionType,
    payload,
    timestamp: Date.now(),
    retryCount: 0,
    status: 'pending'
  };

  const current = getOfflineQueue();
  current.push(mutation);
  saveOfflineQueue(current);

  // Attempt to register Service Worker background sync if supported
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready
      .then((reg: any) => {
        if (reg.sync) {
          return reg.sync.register('studyflow-sync');
        }
      })
      .catch((err) => {
        // Background sync registration failed; will rely on 'online' event
      });
  }

  return mutation;
}

// Event notification system for UI components
type QueueListener = (queue: OfflineMutation[]) => void;
const listeners: Set<QueueListener> = new Set();

export function subscribeOfflineQueue(listener: QueueListener): () => void {
  listeners.add(listener);
  listener(getOfflineQueue());
  return () => listeners.delete(listener);
}

function notifyQueueChange() {
  const queue = getOfflineQueue();
  listeners.forEach(l => {
    try {
      l(queue);
    } catch (e) {
      console.error('Error in queue listener:', e);
    }
  });

  window.dispatchEvent(new CustomEvent('studyflow:offline-queue-changed', {
    detail: { count: queue.length, queue }
  }));
}

// Flush all pending offline mutations
export async function flushOfflineSyncQueue(
  handlers?: {
    onUpdateTopicStatus?: (payload: any) => Promise<void>;
    onAddTestResult?: (payload: any) => Promise<void>;
    onLogMistake?: (payload: any) => Promise<void>;
    onSyncComplete?: (flushedCount: number) => void;
  }
): Promise<{ success: boolean; flushedCount: number; failedCount: number }> {
  if (!navigator.onLine) {
    return { success: false, flushedCount: 0, failedCount: 0 };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) {
    localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
    return { success: true, flushedCount: 0, failedCount: 0 };
  }

  let flushedCount = 0;
  let failedCount = 0;
  const remainingQueue: OfflineMutation[] = [];

  for (const mutation of queue) {
    try {
      mutation.status = 'syncing';

      if (handlers) {
        if (mutation.actionType === 'UPDATE_TOPIC_STATUS' && handlers.onUpdateTopicStatus) {
          await handlers.onUpdateTopicStatus(mutation.payload);
        } else if (mutation.actionType === 'ADD_TEST_RESULT' && handlers.onAddTestResult) {
          await handlers.onAddTestResult(mutation.payload);
        } else if (mutation.actionType === 'LOG_MISTAKE' && handlers.onLogMistake) {
          await handlers.onLogMistake(mutation.payload);
        }
      }

      flushedCount++;
    } catch (err: any) {
      console.warn(`Failed to sync mutation ${mutation.id}:`, err);
      mutation.retryCount += 1;
      mutation.status = 'failed';
      mutation.errorMessage = err?.message || 'Sync error';

      if (mutation.retryCount < 5) {
        remainingQueue.push(mutation);
      } else {
        // Abandon after 5 retries to prevent blocking queue
        failedCount++;
      }
    }
  }

  saveOfflineQueue(remainingQueue);
  localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());

  if (handlers?.onSyncComplete) {
    handlers.onSyncComplete(flushedCount);
  }

  return { success: true, flushedCount, failedCount };
}

// Get last successful sync timestamp
export function getLastSyncTimestamp(): number | null {
  const raw = localStorage.getItem(LAST_SYNC_KEY);
  return raw ? parseInt(raw, 10) : null;
}

// Set up window online event auto-flusher
export function initializeOfflineSyncWatcher(
  flushCallback: () => Promise<any>
): () => void {
  const handleOnline = () => {
    console.log('🌐 Device back online: Flushing queued study mutations...');
    flushCallback().catch(err => console.error('Auto flush error:', err));
  };

  window.addEventListener('online', handleOnline);
  return () => window.removeEventListener('online', handleOnline);
}
