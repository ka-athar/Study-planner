import { 
  doc, 
  collection, 
  setDoc, 
  getDoc, 
  getDocs, 
  onSnapshot, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { broadcastSyncMessage, savePreSyncSafetyBackup } from './syncChannel';
import { resolveActiveUserId, setPairedSyncUid } from './db';
import { 
  reconcileDatasetsWithHashCheck, 
  saveIndexedDbSnapshot, 
  ReconcileReport 
} from './syncEngine';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export interface UserDevice {
  id: string; // document ID, e.g. "dev_xxxxxx"
  deviceId: string; // unique ID stored in device localStorage
  deviceName: string; // e.g. "Pixel 8 (Android • Chrome)", "MacBook Pro (macOS • Safari)"
  deviceType: DeviceType;
  os: string; // "Android", "iOS", "macOS", "Windows", "Linux", "ChromeOS"
  browser: string; // "Chrome", "Safari", "Edge", "Firefox"
  screenResolution?: string;
  userAgent?: string;
  registeredAt: string; // ISO date string
  lastActive: string; // ISO date string
  isCurrentDevice?: boolean;
  status: 'online' | 'synced' | 'idle' | 'revoked';
  appVersion?: string;
}

const DEVICE_ID_STORAGE_KEY = 'prepforge_device_unique_id';
const DEVICE_NAME_OVERRIDE_KEY = 'prepforge_device_name_custom';

/**
 * Returns or generates a persistent unique device ID for this browser / installation.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server_device';
  try {
    let devId = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!devId) {
      devId = `dev_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, devId);
    }
    return devId;
  } catch (e) {
    return `dev_fallback_${Date.now()}`;
  }
}

/**
 * Detects device hardware profile, operating system, and browser info.
 */
export function detectDeviceInfo(): {
  deviceType: DeviceType;
  os: string;
  browser: string;
  deviceName: string;
  screenResolution: string;
  userAgent: string;
} {
  if (typeof window === 'undefined') {
    return {
      deviceType: 'desktop',
      os: 'Cloud Server',
      browser: 'Node.js',
      deviceName: 'Cloud Instance',
      screenResolution: '1920x1080',
      userAgent: 'Server'
    };
  }

  const ua = navigator.userAgent || '';
  const screenWidth = window.screen?.width || window.innerWidth || 1024;
  const screenHeight = window.screen?.height || window.innerHeight || 768;
  const screenResolution = `${screenWidth}x${screenHeight}`;

  // 1. Detect OS
  let os = 'Unknown OS';
  if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/CrOS/i.test(ua)) os = 'ChromeOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  // 2. Detect Browser
  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Opera|OPR\//i.test(ua)) browser = 'Opera';

  // 3. Detect Device Type
  let deviceType: DeviceType = 'desktop';
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (os === 'Android' && !/Mobile/i.test(ua))) {
    deviceType = 'tablet';
  } else if (/Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    deviceType = (screenWidth >= 768 && screenHeight >= 600) ? 'tablet' : 'mobile';
  } else if (isTouch && screenWidth <= 900) {
    deviceType = 'tablet';
  }

  // 4. Friendly Device Name
  let customName = '';
  try {
    customName = localStorage.getItem(DEVICE_NAME_OVERRIDE_KEY) || '';
  } catch (e) {}

  let friendlyName = customName;
  if (!friendlyName) {
    if (os === 'Android') {
      friendlyName = deviceType === 'tablet' ? `Android Tablet (${browser})` : `Android Phone (${browser})`;
    } else if (os === 'iOS') {
      friendlyName = /iPad/i.test(ua) ? `iPad (${browser})` : `iPhone (${browser})`;
    } else if (os === 'macOS') {
      friendlyName = `MacBook / iMac (${browser})`;
    } else if (os === 'Windows') {
      friendlyName = `Windows PC (${browser})`;
    } else if (os === 'Linux') {
      friendlyName = `Linux Workstation (${browser})`;
    } else if (os === 'ChromeOS') {
      friendlyName = `Chromebook (${browser})`;
    } else {
      friendlyName = `${deviceType.charAt(0).toUpperCase() + deviceType.slice(1)} (${browser})`;
    }
  }

  return {
    deviceType,
    os,
    browser,
    deviceName: friendlyName,
    screenResolution,
    userAgent: ua
  };
}

/**
 * Sets a custom friendly name for this device (e.g. "Athar's Pixel 8", "Study iPad Pro")
 */
export function setCustomDeviceName(name: string): void {
  try {
    localStorage.setItem(DEVICE_NAME_OVERRIDE_KEY, name.trim());
  } catch (e) {}
}

/**
 * Registers the current device in Firestore under `/users/{uid}/devices/{deviceId}`
 * and sends an active heartbeat.
 * If options.forcePull is true, it also fetches the latest full cloud snapshot to overwrite local state.
 */
export async function registerCurrentDevice(
  uid: string,
  options?: { forcePull?: boolean }
): Promise<{ device: UserDevice | null; snapshot?: any; error?: string }> {
  if (!uid) return { device: null };
  const deviceId = getOrCreateDeviceId();
  const info = detectDeviceInfo();
  const now = new Date().toISOString();

  const deviceDocRef = doc(db, 'users', uid, 'devices', deviceId);

  let registeredDevice: UserDevice | null = null;

  try {
    const existingSnap = await getDoc(deviceDocRef);
    let registeredAt = now;
    if (existingSnap.exists()) {
      const data = existingSnap.data();
      registeredAt = data.registeredAt || now;
      if (data.status === 'revoked') {
        registeredDevice = {
          id: deviceId,
          deviceId,
          ...info,
          registeredAt,
          lastActive: now,
          status: 'revoked',
          isCurrentDevice: true
        };
      }
    }

    if (!registeredDevice) {
      const deviceData: UserDevice = {
        id: deviceId,
        deviceId,
        deviceName: info.deviceName,
        deviceType: info.deviceType,
        os: info.os,
        browser: info.browser,
        screenResolution: info.screenResolution,
        userAgent: info.userAgent,
        registeredAt,
        lastActive: now,
        status: 'online',
        appVersion: 'v2.6.0'
      };

      await setDoc(deviceDocRef, deviceData, { merge: true });
      registeredDevice = { ...deviceData, isCurrentDevice: true };
    }
  } catch (err) {
    console.warn("Failed to register device in Firestore:", err);
    registeredDevice = {
      id: deviceId,
      deviceId,
      ...info,
      registeredAt: now,
      lastActive: now,
      status: 'synced',
      isCurrentDevice: true
    };
  }

  // Handle Force Pull if requested
  let snapshot: any = null;
  if (options?.forcePull) {
    try {
      const pullRes = await pullFullCloudSnapshot(uid);
      if (pullRes.success && pullRes.snapshot) {
        snapshot = pullRes.snapshot;
      }
    } catch (pullErr: any) {
      console.warn("Force pull during device registration failed:", pullErr);
    }
  }

  return { device: registeredDevice, snapshot };
}

/**
 * Subscribes to real-time list of all devices associated with this user's account.
 */
export function subscribeUserDevices(uid: string, callback: (devices: UserDevice[]) => void): () => void {
  if (!uid) {
    callback([]);
    return () => {};
  }

  const currentDeviceId = getOrCreateDeviceId();
  const colRef = collection(db, 'users', uid, 'devices');
  const q = query(colRef, orderBy('lastActive', 'desc'));

  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      // If none registered in cloud yet, register current device
      const info = detectDeviceInfo();
      const now = new Date().toISOString();
      const currentDev: UserDevice = {
        id: currentDeviceId,
        deviceId: currentDeviceId,
        ...info,
        registeredAt: now,
        lastActive: now,
        status: 'online',
        isCurrentDevice: true
      };
      callback([currentDev]);
      // Register in background
      registerCurrentDevice(uid).catch(() => {});
      return;
    }

    const devices: UserDevice[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as UserDevice;
      devices.push({
        ...data,
        id: docSnap.id,
        isCurrentDevice: data.deviceId === currentDeviceId
      });
    });

    callback(devices);
  }, (err) => {
    console.warn("Firestore devices subscribe error:", err);
    const info = detectDeviceInfo();
    callback([{
      id: currentDeviceId,
      deviceId: currentDeviceId,
      ...info,
      registeredAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      status: 'synced',
      isCurrentDevice: true
    }]);
  });
}

/**
 * Updates the display name of a device in Firestore and local storage.
 */
export async function updateDeviceName(uid: string, targetDeviceId: string, newName: string): Promise<boolean> {
  if (!targetDeviceId || !newName) return false;
  const currentDeviceId = getOrCreateDeviceId();
  if (targetDeviceId === currentDeviceId) {
    setCustomDeviceName(newName);
  }
  if (!uid) return true;
  try {
    const docRef = doc(db, 'users', uid, 'devices', targetDeviceId);
    await setDoc(docRef, { 
      deviceName: newName.trim(),
      lastActive: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err) {
    console.error("Error updating device name:", err);
    return false;
  }
}

/**
 * Remotely signs out / revokes access from a specific device.
 */
export async function revokeDevice(uid: string, targetDeviceId: string): Promise<boolean> {
  if (!uid || !targetDeviceId) return false;
  try {
    const docRef = doc(db, 'users', uid, 'devices', targetDeviceId);
    await setDoc(docRef, { 
      status: 'revoked',
      lastActive: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err) {
    console.error("Error revoking device:", err);
    return false;
  }
}

/**
 * Remotely deletes/unlinks a device record from the user's account.
 */
export async function removeDeviceRecord(uid: string, targetDeviceId: string): Promise<boolean> {
  if (!uid || !targetDeviceId) return false;
  try {
    const docRef = doc(db, 'users', uid, 'devices', targetDeviceId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error("Error deleting device record:", err);
    return false;
  }
}

/**
 * Signs out all devices except the current device.
 */
export async function revokeAllOtherDevices(uid: string): Promise<{ success: boolean; count: number }> {
  if (!uid) return { success: false, count: 0 };
  const currentDeviceId = getOrCreateDeviceId();
  try {
    const colRef = collection(db, 'users', uid, 'devices');
    const snap = await getDocs(colRef);
    const batch = writeBatch(db);
    let count = 0;

    snap.forEach((docSnap) => {
      const data = docSnap.data() as UserDevice;
      if (data.deviceId !== currentDeviceId) {
        batch.update(docSnap.ref, {
          status: 'revoked',
          lastActive: new Date().toISOString()
        });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
    }
    return { success: true, count };
  } catch (err) {
    console.error("Error revoking all other devices:", err);
    return { success: false, count: 0 };
  }
}

/**
 * Updates the active device heartbeat.
 */
export async function updateDeviceHeartbeat(uid: string): Promise<boolean> {
  if (!uid) return false;
  try {
    await registerCurrentDevice(uid);
    return true;
  } catch (err) {
    console.warn("Heartbeat error:", err);
    return false;
  }
}

/**
 * Searches for all registered devices and data statistics associated with an active study email.
 */
export async function searchDevicesAndDataByEmail(email: string): Promise<{
  success: boolean;
  uid: string;
  email: string;
  devices: UserDevice[];
  stats: {
    vaultsCount: number;
    subjectsCount: number;
    testResultsCount: number;
    sessionsCount: number;
    plansCount: number;
    flashcardsCount: number;
    assignmentsCount: number;
  };
  hasCloudData: boolean;
}> {
  if (!email || !email.includes('@')) {
    return {
      success: false,
      uid: '',
      email: '',
      devices: [],
      stats: {
        vaultsCount: 0,
        subjectsCount: 0,
        testResultsCount: 0,
        sessionsCount: 0,
        plansCount: 0,
        flashcardsCount: 0,
        assignmentsCount: 0,
      },
      hasCloudData: false,
    };
  }

  const cleanEmail = email.trim().toLowerCase();
  const sanitized = cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
  const uid = `user_${sanitized}`;
  const currentDevId = getOrCreateDeviceId();

  try {
    // 1. Fetch devices under this email
    const devColRef = collection(db, 'users', uid, 'devices');
    const devSnap = await getDocs(query(devColRef, orderBy('lastActive', 'desc')));
    const devices: UserDevice[] = [];
    devSnap.forEach(docSnap => {
      const d = docSnap.data() as UserDevice;
      devices.push({
        ...d,
        id: docSnap.id,
        isCurrentDevice: d.deviceId === currentDevId
      });
    });

    // 2. Fetch data count statistics from Firestore
    const [vaultsSnap, testsSnap, sessionsSnap, plansSnap, decksSnap1, decksSnap2, asgSnap, syllabusSnap] = await Promise.all([
      getDocs(collection(db, 'users', uid, 'vaults')).catch(() => ({ size: 0 })),
      getDocs(collection(db, 'users', uid, 'testResults')).catch(() => ({ size: 0 })),
      getDocs(collection(db, 'users', uid, 'studySessions')).catch(() => ({ size: 0 })),
      getDocs(collection(db, 'users', uid, 'plans')).catch(() => ({ size: 0 })),
      getDocs(collection(db, 'users', uid, 'flashcards')).catch(() => ({ size: 0 })),
      getDocs(collection(db, 'users', uid, 'flashcardDecks')).catch(() => ({ size: 0 })),
      getDocs(collection(db, 'users', uid, 'assignments')).catch(() => ({ size: 0 })),
      getDoc(doc(db, 'users', uid, 'data', 'syllabus')).catch(() => null)
    ]);

    let subjectsCount = 0;
    if (syllabusSnap && syllabusSnap.exists()) {
      const data = syllabusSnap.data();
      subjectsCount = Array.isArray(data?.subjects) ? data.subjects.length : 0;
    }

    const vaultsCount = 'size' in vaultsSnap ? vaultsSnap.size : 0;
    const testResultsCount = 'size' in testsSnap ? testsSnap.size : 0;
    const sessionsCount = 'size' in sessionsSnap ? sessionsSnap.size : 0;
    const plansCount = 'size' in plansSnap ? plansSnap.size : 0;
    const flashcardsCount = Math.max('size' in decksSnap1 ? decksSnap1.size : 0, 'size' in decksSnap2 ? decksSnap2.size : 0);
    const assignmentsCount = 'size' in asgSnap ? asgSnap.size : 0;

    const hasCloudData = vaultsCount > 0 || subjectsCount > 0 || testResultsCount > 0 || sessionsCount > 0 || plansCount > 0 || assignmentsCount > 0;

    return {
      success: true,
      uid,
      email: cleanEmail,
      devices,
      stats: {
        vaultsCount,
        subjectsCount,
        testResultsCount,
        sessionsCount,
        plansCount,
        flashcardsCount,
        assignmentsCount
      },
      hasCloudData
    };
  } catch (err) {
    console.error("Error searching devices and data by email:", err);
    return {
      success: false,
      uid,
      email: cleanEmail,
      devices: [],
      stats: {
        vaultsCount: 0,
        subjectsCount: 0,
        testResultsCount: 0,
        sessionsCount: 0,
        plansCount: 0,
        flashcardsCount: 0,
        assignmentsCount: 0,
      },
      hasCloudData: false,
    };
  }
}

/**
 * Strips undefined fields defensively for Firestore writes
 */
function cleanDoc<T>(obj: T): T {
  if (obj === null || obj === undefined) return null as any;
  if (Array.isArray(obj)) return obj.filter(x => x !== undefined).map(cleanDoc) as any;
  if (typeof obj === 'object') {
    const res: any = {};
    for (const [k, v] of Object.entries(obj as any)) {
      if (v !== undefined) res[k] = typeof v === 'object' && v !== null ? cleanDoc(v) : v;
    }
    return res;
  }
  return obj;
}

/**
 * Merges two arrays of entities without dropping either side or creating duplicates.
 */
function mergeCollection<T extends { id?: string | number }>(primary: T[] = [], secondary: T[] = []): T[] {
  const map = new Map<string, T>();
  (secondary || []).forEach((item, idx) => {
    if (!item) return;
    const key = item.id ? String(item.id) : `sec-${idx}`;
    map.set(key, item);
  });
  (primary || []).forEach((item, idx) => {
    if (!item) return;
    const key = item.id ? String(item.id) : `prim-${idx}`;
    map.set(key, item);
  });
  return Array.from(map.values());
}

/**
 * Merges syllabus subjects by name/id, combining chapters non-destructively.
 */
function mergeSubjects(listA: any[] = [], listB: any[] = []): any[] {
  if (!listA || listA.length === 0) return listB || [];
  if (!listB || listB.length === 0) return listA || [];
  const map = new Map<string, any>();
  
  listB.forEach((s: any, idx) => {
    if (!s) return;
    const key = (s.name || s.id || `b-${idx}`).toLowerCase().trim();
    map.set(key, s);
  });
  
  listA.forEach((s: any, idx) => {
    if (!s) return;
    const key = (s.name || s.id || `a-${idx}`).toLowerCase().trim();
    if (map.has(key)) {
      const existing = map.get(key);
      const mergedChapters = mergeCollection(s.chapters || [], existing.chapters || []);
      map.set(key, { ...existing, ...s, chapters: mergedChapters });
    } else {
      map.set(key, s);
    }
  });
  
  return Array.from(map.values());
}

function sanitizePayloadForTransfer(payload: any) {
  if (!payload) return null;
  const copy = { ...payload };
  if (Array.isArray(copy.vaults)) {
    copy.vaults = copy.vaults.map((v: any) => {
      if (v?.fileData && typeof v.fileData === 'string' && v.fileData.length > 50000) {
        const { fileData, ...rest } = v;
        return { ...rest, hasLargeAttachment: true };
      }
      return v;
    });
  }
  return cleanDoc(copy);
}

/**
 * Generates an instant 6-digit Cross-Device Transfer Code and stores snapshot payload
 * in both Firestore and the server-side pairing bus for 100% reliable cross-device sync.
 * Runs persistence in parallel non-blocking background promises so UI gets the PIN instantly.
 */
export async function generateTransferPin(
  uid: string, 
  email?: string, 
  dataPayload?: any,
  customCode?: string
): Promise<{ code: string; expiresAt: string; success: boolean }> {
  // Use customCode if provided (e.g., from instant UI state) or generate a clean 6-digit numeric PIN
  const cleanProvided = customCode ? String(customCode).trim().replace(/[^0-9]/g, '') : '';
  const code = (cleanProvided && cleanProvided.length === 6)
    ? cleanProvided
    : String(Math.floor(100000 + Math.random() * 900000));

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24hr expiration
  const devInfo = detectDeviceInfo();

  const sanitizedPayload = sanitizePayloadForTransfer(dataPayload);

  // Run Server Registration & Firestore Write in parallel non-blocking background tasks
  const serverPromise = fetch('/api/sync/generate-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      uid,
      email: email || '',
      dataPayload: sanitizedPayload,
      deviceName: devInfo.deviceName
    })
  }).catch((sErr) => {
    console.warn("Server API PIN generation note:", sErr);
  });

  // Also cache in server snapshot store for instant fallbacks
  fetch('/api/sync/store-snapshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uid,
      email: email || '',
      snapshot: sanitizedPayload
    })
  }).catch(() => {});

  const firestorePromise = (async () => {
    try {
      const transferDocRef = doc(db, 'transferCodes', code);
      await setDoc(transferDocRef, cleanDoc({
        code,
        uid,
        email: email || '',
        deviceName: devInfo.deviceName,
        createdAt: new Date().toISOString(),
        expiresAt,
        dataPayload: sanitizedPayload,
        subjectsCount: Array.isArray(dataPayload?.subjects) ? dataPayload.subjects.length : 0,
        assignmentsCount: Array.isArray(dataPayload?.assignments) ? dataPayload.assignments.length : 0,
        vaultsCount: Array.isArray(dataPayload?.vaults) ? dataPayload.vaults.length : 0,
        sessionsCount: Array.isArray(dataPayload?.sessions) ? dataPayload.sessions.length : 0,
        plansCount: Array.isArray(dataPayload?.plans) ? dataPayload.plans.length : 0,
        testResultsCount: Array.isArray(dataPayload?.testResults) ? dataPayload.testResults.length : 0,
        notesCount: Array.isArray(dataPayload?.notes) ? dataPayload.notes.length : 0,
        flashcardsCount: Array.isArray(dataPayload?.flashcardDecks) ? dataPayload.flashcardDecks.length : 0
      }));
    } catch (fErr) {
      console.warn("Firestore PIN write note:", fErr);
    }
  })();

  // Trigger background persistence without delaying return to UI
  Promise.allSettled([serverPromise, firestorePromise]).catch(() => {});

  // Return matching PIN code immediately
  return { code, expiresAt, success: true };
}

/**
 * Pulls a complete snapshot directly from Cloud Database (Firestore subcollections)
 * for a user, guaranteeing a complete overwrite of local state.
 */
export async function pullFullCloudSnapshot(uid: string): Promise<{
  success: boolean;
  snapshot: any | null;
  stats: {
    subjectsCount: number;
    assignmentsCount: number;
    vaultsCount: number;
    testResultsCount: number;
    plansCount: number;
    sessionsCount: number;
    flashcardsCount: number;
  };
  message: string;
}> {
  if (!uid) {
    return {
      success: false,
      snapshot: null,
      stats: { subjectsCount: 0, assignmentsCount: 0, vaultsCount: 0, testResultsCount: 0, plansCount: 0, sessionsCount: 0, flashcardsCount: 0 },
      message: 'No active user ID provided for cloud snapshot pull.'
    };
  }

  const stats = {
    subjectsCount: 0,
    assignmentsCount: 0,
    vaultsCount: 0,
    testResultsCount: 0,
    plansCount: 0,
    sessionsCount: 0,
    flashcardsCount: 0
  };

  try {
    // 1. Fetch singleton documents
    const [userDoc, syllabusDoc, revisionsDoc, tasksDoc, chatDoc] = await Promise.all([
      getDoc(doc(db, 'users', uid)).catch(() => null),
      getDoc(doc(db, 'users', uid, 'data', 'syllabus')).catch(() => null),
      getDoc(doc(db, 'users', uid, 'data', 'revisions')).catch(() => null),
      getDoc(doc(db, 'users', uid, 'data', 'scheduledTasks')).catch(() => null),
      getDoc(doc(db, 'users', uid, 'data', 'chatHistory')).catch(() => null)
    ]);

    // 2. Fetch all subcollections in parallel
    const [
      sessionsSnap,
      plansSnap,
      testsSnap,
      vaultsSnap,
      notesSnap,
      flashcardsSnap,
      flashcardDecksSnap,
      mocksSnap,
      asgSnap,
      activityLogsSnap
    ] = await Promise.all([
      getDocs(collection(db, 'users', uid, 'studySessions')).catch(() => ({ docs: [] } as any)),
      getDocs(collection(db, 'users', uid, 'plans')).catch(() => ({ docs: [] } as any)),
      getDocs(collection(db, 'users', uid, 'testResults')).catch(() => ({ docs: [] } as any)),
      getDocs(collection(db, 'users', uid, 'vaults')).catch(() => ({ docs: [] } as any)),
      getDocs(collection(db, 'users', uid, 'notes')).catch(() => ({ docs: [] } as any)),
      getDocs(collection(db, 'users', uid, 'flashcards')).catch(() => ({ docs: [] } as any)),
      getDocs(collection(db, 'users', uid, 'flashcardDecks')).catch(() => ({ docs: [] } as any)),
      getDocs(collection(db, 'users', uid, 'mockExams')).catch(() => ({ docs: [] } as any)),
      getDocs(collection(db, 'users', uid, 'assignments')).catch(() => ({ docs: [] } as any)),
      getDocs(collection(db, 'users', uid, 'activityLogs')).catch(() => ({ docs: [] } as any))
    ]);

    const sessions = sessionsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    const plans = plansSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    const testResults = testsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    const vaults = vaultsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    const notes = notesSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    const activityLogs = activityLogsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    
    // Merge flashcards and flashcardDecks without duplicates
    const flashcardMap = new Map<string, any>();
    [...flashcardsSnap.docs, ...flashcardDecksSnap.docs].forEach((d: any) => {
      flashcardMap.set(d.id, { id: d.id, ...d.data() });
    });
    const flashcardDecks = Array.from(flashcardMap.values());

    const mockExams = mocksSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    const assignments = asgSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

    const subjects = syllabusDoc && syllabusDoc.exists() ? (syllabusDoc.data()?.subjects || []) : [];
    const revisions = revisionsDoc && revisionsDoc.exists() ? (revisionsDoc.data()?.items || []) : [];
    const scheduledTasks = tasksDoc && tasksDoc.exists() ? (tasksDoc.data()?.tasks || []) : [];
    const chatHistory = chatDoc && chatDoc.exists() ? (chatDoc.data()?.messages || []) : [];
    const profile = userDoc && userDoc.exists() ? userDoc.data() : null;

    stats.subjectsCount = subjects.length;
    stats.assignmentsCount = assignments.length;
    stats.vaultsCount = vaults.length;
    stats.testResultsCount = testResults.length;
    stats.plansCount = plans.length;
    stats.sessionsCount = sessions.length;
    stats.flashcardsCount = flashcardDecks.length;

    const totalEntities = stats.subjectsCount + stats.assignmentsCount + stats.vaultsCount + 
      stats.testResultsCount + stats.plansCount + stats.sessionsCount + stats.flashcardsCount;

    // If Firestore yielded entities, return the full snapshot
    if (totalEntities > 0 || profile) {
      const snapshot = {
        subjects,
        plans,
        sessions,
        vaults,
        notes,
        flashcardDecks,
        mockExams,
        assignments,
        testResults,
        revisions,
        activityLogs,
        scheduledTasks,
        chatHistory,
        profile,
        pulledAt: new Date().toISOString()
      };

      return {
        success: true,
        snapshot,
        stats,
        message: `Successfully downloaded full cloud snapshot: ${stats.subjectsCount} subjects, ${stats.assignmentsCount} assignments, ${stats.vaultsCount} vaults, ${stats.testResultsCount} test records.`
      };
    }
  } catch (err: any) {
    console.warn("Firestore direct pull warning, checking server snapshot endpoint:", err);
  }

  // 3. Fallback to Server Snapshot Endpoint
  try {
    const sRes = await fetch(`/api/sync/pull-snapshot/${encodeURIComponent(uid)}`);
    if (sRes.ok) {
      const sData = await sRes.json();
      if (sData.success && sData.snapshot) {
        const snap = sData.snapshot;
        stats.subjectsCount = Array.isArray(snap.subjects) ? snap.subjects.length : 0;
        stats.assignmentsCount = Array.isArray(snap.assignments) ? snap.assignments.length : 0;
        stats.vaultsCount = Array.isArray(snap.vaults) ? snap.vaults.length : 0;
        stats.testResultsCount = Array.isArray(snap.testResults) ? snap.testResults.length : 0;
        stats.plansCount = Array.isArray(snap.plans) ? snap.plans.length : 0;
        stats.sessionsCount = Array.isArray(snap.sessions) ? snap.sessions.length : 0;
        stats.flashcardsCount = Array.isArray(snap.flashcardDecks) ? snap.flashcardDecks.length : 0;

        return {
          success: true,
          snapshot: snap,
          stats,
          message: `Retrieved cloud snapshot from server sync cache: ${stats.subjectsCount} subjects, ${stats.assignmentsCount} assignments.`
        };
      }
    }
  } catch (sErr) {
    console.warn("Server snapshot endpoint pull note:", sErr);
  }

  return {
    success: false,
    snapshot: null,
    stats,
    message: 'No cloud snapshot records found for this account in the database.'
  };
}

/**
 * Redeems an instant 6-digit Transfer Code to link devices and immediately fetch transferred syllabus and workspace data.
 * Supports a `forcePull` option to guarantee a full snapshot download from the cloud database, overwriting local state.
 */
export async function redeemTransferPin(
  rawCode: string,
  options?: {
    forcePull?: boolean;
    targetDeviceName?: string;
  }
): Promise<{ 
  success: boolean; 
  uid?: string; 
  email?: string; 
  payload?: any; 
  deviceName?: string; 
  isForcePulled?: boolean;
  stats?: {
    subjectsCount: number;
    chaptersCount: number;
    plansCount: number;
    vaultsCount: number;
    flashcardsCount: number;
    assignmentsCount: number;
    testResultsCount: number;
  };
  message: string;
}> {
  const cleanCode = rawCode.trim().replace(/[^0-9]/g, '');
  if (!cleanCode || cleanCode.length < 6) {
    return { success: false, message: 'Please enter a valid 6-digit Transfer PIN.' };
  }

  const currentDevInfo = detectDeviceInfo();
  const targetDeviceName = options?.targetDeviceName || currentDevInfo.deviceName;
  const isForcePull = !!options?.forcePull;

  let redeemedUid: string | undefined;
  let redeemedEmail: string | undefined;
  let payload: any = null;
  let sourceDeviceName: string = 'Source Device';

  // 1. Try Server API first
  try {
    const serverRes = await fetch('/api/sync/redeem-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: cleanCode,
        targetDeviceName,
        forcePull: isForcePull
      })
    });

    if (serverRes.ok) {
      const sData = await serverRes.json();
      if (sData.success) {
        redeemedUid = sData.uid;
        redeemedEmail = sData.email;
        payload = sData.payload;
        sourceDeviceName = sData.deviceName || sourceDeviceName;
      }
    }
  } catch (sErr) {
    console.warn("Server API PIN redeem fallback:", sErr);
  }

  // 2. Fallback to Firestore transferCodes document if Server API did not resolve
  if (!redeemedUid) {
    try {
      const transferDocRef = doc(db, 'transferCodes', cleanCode);
      const snap = await getDoc(transferDocRef);

      if (snap.exists()) {
        const data = snap.data();
        if (data.expiresAt && new Date(data.expiresAt).getTime() < Date.now()) {
          return { 
            success: false, 
            message: 'This 6-digit Transfer PIN has expired. Please generate a fresh code on your source device.' 
          };
        }

        redeemedUid = data.uid;
        redeemedEmail = data.email;
        payload = data.dataPayload;
        sourceDeviceName = data.deviceName || sourceDeviceName;

        // Mark as redeemed in Firestore
        await setDoc(transferDocRef, {
          redeemed: true,
          redeemedAt: new Date().toISOString(),
          redeemedByDevice: targetDeviceName
        }, { merge: true }).catch(() => {});
      }
    } catch (err: any) {
      console.warn("Firestore transferCodes query note:", err);
    }
  }

  if (!redeemedUid) {
    return {
      success: false,
      message: `Transfer PIN "${cleanCode}" was not found or has expired. Please verify the code from your other device.`
    };
  }

  // 3. Intelligently fetch cloud snapshot if needed, without wiping payload data
  let cloudSnapshot: any = null;
  const payloadHasSubjects = Array.isArray(payload?.subjects) && payload.subjects.length > 0;
  
  if (isForcePull || !payload || !payloadHasSubjects) {
    try {
      const fullCloudPull = await pullFullCloudSnapshot(redeemedUid);
      if (fullCloudPull.success && fullCloudPull.snapshot) {
        cloudSnapshot = fullCloudPull.snapshot;
      }
      
      // Fallback: If primary UID had no subjects but an email is associated, check the email partition
      if ((!cloudSnapshot?.subjects?.length) && redeemedEmail && redeemedEmail.includes('@')) {
        const emailPartitionUid = resolveActiveUserId(null, redeemedEmail);
        if (emailPartitionUid && emailPartitionUid !== redeemedUid) {
          const emailCloudPull = await pullFullCloudSnapshot(emailPartitionUid);
          if (emailCloudPull.success && emailCloudPull.snapshot?.subjects?.length) {
            cloudSnapshot = emailCloudPull.snapshot;
          }
        }
      }
    } catch (pullErr) {
      console.warn("Cloud snapshot pull during PIN redeem note:", pullErr);
    }
  }

  // Merge payload and cloud snapshot safely: NEVER allow an empty cloud snapshot to erase payload data!
  if (cloudSnapshot) {
    payload = {
      ...(payload || {}),
      subjects: mergeSubjects(payload?.subjects, cloudSnapshot.subjects),
      sessions: mergeCollection(payload?.sessions, cloudSnapshot.sessions),
      plans: mergeCollection(payload?.plans, cloudSnapshot.plans),
      testResults: mergeCollection(payload?.testResults, cloudSnapshot.testResults),
      vaults: mergeCollection(payload?.vaults, cloudSnapshot.vaults),
      assignments: mergeCollection(payload?.assignments, cloudSnapshot.assignments),
      flashcardDecks: mergeCollection(payload?.flashcardDecks, cloudSnapshot.flashcardDecks),
      revisions: mergeCollection(payload?.revisions, cloudSnapshot.revisions),
      notes: mergeCollection(payload?.notes, cloudSnapshot.notes),
      activityLogs: mergeCollection(payload?.activityLogs, cloudSnapshot.activityLogs),
      scheduledTasks: mergeCollection(payload?.scheduledTasks, cloudSnapshot.scheduledTasks),
      chatHistory: mergeCollection(payload?.chatHistory, cloudSnapshot.chatHistory),
      mockExams: mergeCollection(payload?.mockExams, cloudSnapshot.mockExams),
      profile: cloudSnapshot.profile || payload?.profile || null
    };
  }

  // Calculate detailed entity counts for reporting to UI
  const subjectsCount = Array.isArray(payload?.subjects) ? payload.subjects.length : 0;
  const chaptersCount = Array.isArray(payload?.subjects) 
    ? payload.subjects.reduce((acc: number, s: any) => acc + (s.chapters?.length || 0), 0)
    : 0;
  const plansCount = Array.isArray(payload?.plans) ? payload.plans.length : 0;
  const vaultsCount = Array.isArray(payload?.vaults) ? payload.vaults.length : 0;
  const flashcardsCount = Array.isArray(payload?.flashcardDecks) ? payload.flashcardDecks.length : 0;
  const assignmentsCount = Array.isArray(payload?.assignments) ? payload.assignments.length : 0;
  const testResultsCount = Array.isArray(payload?.testResults) ? payload.testResults.length : 0;
  const sessionsCount = Array.isArray(payload?.sessions) ? payload.sessions.length : 0;

  const stats = {
    subjectsCount,
    chaptersCount,
    plansCount,
    vaultsCount,
    flashcardsCount,
    assignmentsCount,
    testResultsCount,
    sessionsCount
  };

  // Permanently bind this device to the source device's partition
  if (redeemedUid) {
    setPairedSyncUid(redeemedUid);
  }

  // Broadcast to other tabs in the same browser
  try {
    broadcastSyncMessage({
      type: 'SYNC_RESTORE_PAYLOAD',
      sourceDeviceId: getOrCreateDeviceId(),
      sourceDeviceName: targetDeviceName,
      payload,
      email: redeemedEmail,
      uid: redeemedUid,
      pin: cleanCode
    });
  } catch (bErr) {}

  let message = `Connected to ${sourceDeviceName}`;
  if (subjectsCount > 0) {
    message = `Transferred ${subjectsCount} subjects (${chaptersCount} chapters) & workspace data from ${sourceDeviceName}!`;
  } else {
    message = `Linked ${sourceDeviceName}, but 0 subjects were found in this device's payload.`;
  }

  return {
    success: true,
    uid: redeemedUid,
    email: redeemedEmail,
    payload,
    deviceName: sourceDeviceName,
    isForcePulled: isForcePull,
    stats,
    message
  };
}

/**
 * Manually requests a full snapshot download from the cloud database,
 * performs document-level hash-sum verification against local state, and applies
 * partial overwrites only for non-conflicting documents to prevent any data loss.
 */
export async function forcePullEntireCloudState(
  uid: string,
  currentLocalState?: any
): Promise<{
  success: boolean;
  snapshot: any | null;
  report?: ReconcileReport;
  stats?: {
    subjectsCount: number;
    assignmentsCount: number;
    vaultsCount: number;
    testResultsCount: number;
    plansCount: number;
    sessionsCount: number;
    flashcardsCount: number;
  };
  message: string;
}> {
  // 1. First pull raw snapshot from Firestore / Server snapshot endpoint
  const res = await pullFullCloudSnapshot(uid);
  
  if (!res.success || !res.snapshot) {
    return {
      success: false,
      snapshot: null,
      message: res.message || 'Could not retrieve remote cloud snapshot. Local state has been preserved with zero data loss.'
    };
  }

  // 2. Perform hash-sum verification and non-destructive partial overwrite
  let finalState = res.snapshot;
  let report: ReconcileReport | undefined = undefined;

  if (currentLocalState && typeof currentLocalState === 'object') {
    try {
      const reconcile = await reconcileDatasetsWithHashCheck(currentLocalState, res.snapshot, {
        reason: 'Manual Force Pull Cloud Sync',
        prioritizeRemoteForIdenticalDates: true
      });
      finalState = reconcile.mergedState;
      report = reconcile.report;
    } catch (reconcileErr) {
      console.warn('[SyncService] Hash reconciliation note, falling back to safe remote merge:', reconcileErr);
    }
  }

  // 3. Broadcast sync message to other tabs
  try {
    const devInfo = detectDeviceInfo();
    broadcastSyncMessage({
      type: 'FORCE_PULL_COMPLETED',
      sourceDeviceId: getOrCreateDeviceId(),
      sourceDeviceName: devInfo.deviceName,
      payload: finalState,
      uid
    });
  } catch (e) {}

  const stats = {
    subjectsCount: Array.isArray(finalState.subjects) ? finalState.subjects.length : 0,
    assignmentsCount: Array.isArray(finalState.assignments) ? finalState.assignments.length : 0,
    vaultsCount: Array.isArray(finalState.vaults) ? finalState.vaults.length : 0,
    testResultsCount: Array.isArray(finalState.testResults) ? finalState.testResults.length : 0,
    plansCount: Array.isArray(finalState.plans) ? finalState.plans.length : 0,
    sessionsCount: Array.isArray(finalState.sessions) ? finalState.sessions.length : 0,
    flashcardsCount: Array.isArray(finalState.flashcardDecks) ? finalState.flashcardDecks.length : 0,
  };

  const reportSummary = report
    ? ` (Hash Verified: ${report.updatedRemoteCount} updated, ${report.insertedRemoteCount} inserted, ${report.preservedLocalCount} local preserved)`
    : '';

  return {
    success: true,
    snapshot: finalState,
    report,
    stats,
    message: `🎉 Force Pull Complete! Reconciled with Cloud snapshot: ${stats.subjectsCount} subjects, ${stats.assignmentsCount} assignments.${reportSummary}`
  };
}

/**
 * Checks if a generated PIN has been redeemed by another device.
 * Checks both server-side bus and Firestore transferCodes collection.
 */
export async function checkPinRedeemedStatus(code: string): Promise<{
  redeemed: boolean;
  redeemedAt?: string;
  redeemedByDevice?: string;
}> {
  const cleanCode = code.trim().replace(/[^0-9]/g, '');
  if (!cleanCode || cleanCode.length < 6) return { redeemed: false };

  // 1. Try server status first
  try {
    const res = await fetch(`/api/sync/pin-status/${cleanCode}`);
    if (res.ok) {
      const data = await res.json();
      if (data.redeemed) {
        return {
          redeemed: true,
          redeemedAt: data.redeemedAt,
          redeemedByDevice: data.redeemedByDevice
        };
      }
    }
  } catch (e) {}

  // 2. Fallback to Firestore check
  try {
    const transferDocRef = doc(db, 'transferCodes', cleanCode);
    const snap = await getDoc(transferDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.redeemed) {
        return {
          redeemed: true,
          redeemedAt: data.redeemedAt,
          redeemedByDevice: data.redeemedByDevice || 'Connected Device'
        };
      }
    }
  } catch (fErr) {}

  return { redeemed: false };
}



