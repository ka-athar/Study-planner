/**
 * Cross-Tab & Cross-Window Instant Synchronization Channel
 * Broadcasts sync events across multiple open tabs/windows in real time.
 */

export interface SyncBroadcastMessage {
  type: 'SYNC_RESTORE_PAYLOAD' | 'DEVICE_PAIRED' | 'FORCE_PULL_COMPLETED' | 'HEARTBEAT_PING';
  sourceDeviceId: string;
  sourceDeviceName: string;
  timestamp: string;
  payload?: any;
  email?: string;
  uid?: string;
  pin?: string;
}

type SyncListener = (message: SyncBroadcastMessage) => void;

const CHANNEL_NAME = 'prepforge_cross_tab_sync_bus';
const SAFETY_BACKUP_KEY = 'prepforge_pre_sync_safety_backup';

let channel: BroadcastChannel | null = null;
const listeners = new Set<SyncListener>();

if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      if (event.data && typeof event.data === 'object') {
        listeners.forEach(fn => {
          try {
            fn(event.data);
          } catch (err) {
            console.error('Error in sync broadcast listener:', err);
          }
        });
      }
    };
  } catch (e) {
    console.warn('BroadcastChannel initialization fallback:', e);
  }
}

// Fallback using storage event for browsers without BroadcastChannel
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'prepforge_sync_storage_event' && event.newValue) {
      try {
        const data = JSON.parse(event.newValue);
        listeners.forEach(fn => fn(data));
      } catch (e) {}
    }
  });
}

/**
 * Broadcasts a sync event to all other open tabs/windows.
 */
export function broadcastSyncMessage(message: Omit<SyncBroadcastMessage, 'timestamp'>): void {
  const fullMsg: SyncBroadcastMessage = {
    ...message,
    timestamp: new Date().toISOString()
  };

  if (channel) {
    try {
      channel.postMessage(fullMsg);
    } catch (e) {
      console.warn('BroadcastChannel postMessage error:', e);
    }
  }

  // Storage event fallback
  try {
    localStorage.setItem('prepforge_sync_storage_event', JSON.stringify({ ...fullMsg, _nonce: Date.now() }));
  } catch (e) {}
}

/**
 * Subscribes to cross-tab sync messages.
 */
export function subscribeToSyncBroadcast(callback: SyncListener): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Saves a pre-sync safety backup to localStorage before any overwrite or force-pull.
 */
export function savePreSyncSafetyBackup(currentState: any): void {
  if (typeof window === 'undefined' || !currentState) return;
  try {
    const backup = {
      savedAt: new Date().toISOString(),
      state: currentState
    };
    localStorage.setItem(SAFETY_BACKUP_KEY, JSON.stringify(backup));
  } catch (err) {
    console.warn('Failed to save safety pre-sync backup:', err);
  }
}

/**
 * Retrieves the safety backup if available.
 */
export function getPreSyncSafetyBackup(): { savedAt: string; state: any } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SAFETY_BACKUP_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/**
 * Clears safety backup.
 */
export function clearPreSyncSafetyBackup(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SAFETY_BACKUP_KEY);
  } catch (e) {}
}
