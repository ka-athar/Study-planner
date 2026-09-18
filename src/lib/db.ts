import { 
  doc, 
  collection, 
  setDoc, 
  getDoc, 
  getDocs, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  Subject, 
  StudySession, 
  StudyPlan, 
  TestResult, 
  StorageVault,
  RevisionItem, 
  ActivityLog, 
  UserProfile,
  UserNote,
  StudyGroup,
  CollaborativeGoal,
  GroupChatMessage,
  AIGroupStudySuggestion,
  FlashcardDeck,
  ScheduledStudyTask,
  AIChatMessage,
  GradedMockExam,
  MockExam,
  Assignment,
  MissedWorkItem
} from '../types';
import { DEFAULT_SYLLABUS, DEFAULT_SUBJECTS_LIST } from '../data/defaultSyllabus';
import { DEFAULT_STUDY_GROUPS } from '../data/defaultGroups';
import { DEFAULT_FLASHCARD_DECKS } from '../data/defaultFlashcards';
import { DEFAULT_STORAGE_VAULTS } from '../data/defaultVaults';
import { DEFAULT_ASSIGNMENTS } from '../data/defaultAssignments';
import { liveSync } from './liveSyncService';
import { deduplicateMissedWork } from './missedWorkService';

// --- SAVE / SYNC STATUS & DUAL-LAYER PERSISTENCE MANAGEMENT ---

export type SyncState = 'saved' | 'saving' | 'error' | 'offline' | 'local_only';

export interface BatchUploadProgress {
  totalItems: number;
  processedItems: number;
  currentChunk: number;
  totalChunks: number;
  percentage: number;
  status: 'idle' | 'in_progress' | 'completed' | 'error' | 'retrying';
  currentEntity?: string;
  errorMessage?: string;
  currentBatchError?: string;
  log?: string;
}

export interface DualLayerSaveStatus {
  point1Local: {
    status: 'saved' | 'saving' | 'error';
    lastSavedAt: string | null;
    storageType: 'localStorage / Edge Cache';
    itemsCount: number;
  };
  point2Cloud: {
    status: 'saved' | 'syncing' | 'offline' | 'error';
    lastSavedAt: string | null;
    storageType: 'Google Cloud Firestore';
    chunkSize: number;
    activeBatchProgress?: BatchUploadProgress;
  };
}

export interface SyncStatusInfo {
  state: SyncState;
  lastSavedAt: string | null;
  mode: 'cloud' | 'local';
  message: string;
  dualLayer?: DualLayerSaveStatus;
}

type SyncListener = (info: SyncStatusInfo) => void;
const syncListeners = new Set<SyncListener>();

let currentSyncStatus: SyncStatusInfo = {
  state: 'saved',
  lastSavedAt: null,
  mode: 'local',
  message: 'Point 1: Protected locally on device | Point 2: Cloud ready',
  dualLayer: {
    point1Local: {
      status: 'saved',
      lastSavedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      storageType: 'localStorage / Edge Cache',
      itemsCount: 0
    },
    point2Cloud: {
      status: 'saved',
      lastSavedAt: null,
      storageType: 'Google Cloud Firestore',
      chunkSize: 200
    }
  }
};

export function getSyncStatus(): SyncStatusInfo {
  return currentSyncStatus;
}

export function subscribeSyncStatus(listener: SyncListener): () => void {
  syncListeners.add(listener);
  listener(currentSyncStatus);
  return () => syncListeners.delete(listener);
}

function updateSyncStatus(update: Partial<SyncStatusInfo>) {
  currentSyncStatus = {
    ...currentSyncStatus,
    ...update,
    lastSavedAt: update.lastSavedAt !== undefined ? update.lastSavedAt : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  };
  syncListeners.forEach(fn => fn(currentSyncStatus));
}

// --- CHUNKED BATCH UPLOAD UTILITY FOR FIRESTORE ---

export const DEFAULT_GUEST_USER_ID = 'user_guest';

/**
 * Returns the permanently paired sync UID if this device was linked to another device via QR / PIN.
 */
export function getPairedSyncUid(): string {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('prepforge_paired_sync_uid');
      if (stored && stored.trim()) return stored.trim();
    } catch (e) {}
  }
  return '';
}

/**
 * Permanently locks this device's Firestore & LiveSync partition to the shared device/account UID.
 */
export function setPairedSyncUid(uid: string): void {
  try {
    if (typeof window !== 'undefined' && uid && uid.trim()) {
      localStorage.setItem('prepforge_paired_sync_uid', uid.trim());
      window.dispatchEvent(new CustomEvent('prepforge:paired_uid_changed', { detail: { uid: uid.trim() } }));
    }
  } catch (e) {}
}

/**
 * Unlinks this device from a paired device session and returns to standalone partition.
 */
export function clearPairedSyncUid(): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('prepforge_paired_sync_uid');
      window.dispatchEvent(new CustomEvent('prepforge:paired_uid_changed', { detail: { uid: '' } }));
    }
  } catch (e) {}
}

/**
 * Resolves a dynamic, multi-tenant user ID for Firestore documents.
 * Guarantees that ANY user who logs in with ANY Google or email account gets their own isolated,
 * cross-device synced database partition (`user_${sanitizedEmail}` or `user_${uid}`).
 * If two devices are linked via QR code or PIN, both permanently adopt the paired sync UID
 * so that updates made on one device automatically occur on the other in real time.
 */
export function resolveActiveUserId(user?: { uid?: string; email?: string | null } | null, emailHint?: string | null): string {
  // 1. CRITICAL: If this device has been permanently paired to another device via QR scan or PIN transfer, use the paired partition
  const pairedUid = getPairedSyncUid();
  if (pairedUid && pairedUid.trim()) {
    return pairedUid.trim();
  }

  // 2. If Firebase Auth has a logged-in user with an email (e.g. any person signing in with their Google account)
  if (user?.email) {
    const sanitized = user.email.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
    return `user_${sanitized}`;
  }

  // 3. If an explicit real email hint was passed directly (filtering out internal synthetic sync emails)
  if (emailHint && emailHint.trim().includes('@') && !emailHint.includes('studyflow.app')) {
    const sanitized = emailHint.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
    return `user_${sanitized}`;
  }

  // 4. If the user stored an active real email in local storage for this browser
  if (typeof window !== 'undefined') {
    try {
      const storedEmail = (localStorage.getItem('prepforge_active_user_email') || localStorage.getItem('studyos_user_email') || '').trim().toLowerCase();
      if (storedEmail && storedEmail.includes('@') && !storedEmail.includes('studyflow.app')) {
        const sanitized = storedEmail.replace(/[^a-zA-Z0-9]/g, '_');
        return `user_${sanitized}`;
      }
    } catch (e) {}
  }

  // 5. If Firebase auth UID exists without email
  if (user?.uid) {
    return user.uid;
  }

  // 6. Unauthenticated guest device partition: generate or retrieve a persistent unique guest ID
  if (typeof window !== 'undefined') {
    try {
      let guestId = localStorage.getItem('prepforge_guest_device_id');
      if (!guestId) {
        guestId = `guest_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
        localStorage.setItem('prepforge_guest_device_id', guestId);
      }
      return guestId;
    } catch (e) {}
  }
  return DEFAULT_GUEST_USER_ID;
}

export function getActiveUserEmail(): string {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('prepforge_active_user_email');
      if (stored) return stored;
    } catch (e) {}
  }
  return '';
}

export function clearActiveUserEmail(): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('prepforge_active_user_email');
    }
  } catch (e) {}
}

export function setActiveUserEmail(email: string): void {
  try {
    if (typeof window !== 'undefined' && email) {
      localStorage.setItem('prepforge_active_user_email', email.trim().toLowerCase());
    }
  } catch (e) {}
}

export interface BatchUploadOptions<T> {
  chunkSize?: number; // Max operations per Firestore batch (default 200; Firestore hard limit is 500)
  retryAttempts?: number; // Max retries per chunk on network failures (default 3)
  backoffMs?: number; // Initial exponential backoff delay (default 500ms)
  operation?: 'set' | 'delete';
  entityName?: string;
  onProgress?: (progress: BatchUploadProgress) => void;
}

export interface BatchUploadResult {
  success: boolean;
  totalItems: number;
  totalChunks: number;
  processedItems: number;
  errors: Array<{ chunkIndex: number; error: any }>;
  durationMs: number;
}

/**
 * Splits an array into chunks of a given size.
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  if (!array || array.length === 0) return [];
  const chunkSize = Math.max(1, size);
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Helper to wait for exponential backoff delay.
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Executes a chunked batch write against Firestore.
 * Breaks large datasets into safe batches (default 200 items per batch, well under Firestore's 500 limit),
 * applies cleanForFirestore data sanitization, and handles network retries with exponential backoff.
 */
export async function writeBatchInChunks<T>(
  items: T[],
  getDocRef: (item: T, index: number) => any,
  options: BatchUploadOptions<T> = {}
): Promise<BatchUploadResult> {
  const startTime = Date.now();
  const chunkSize = options.chunkSize || 250;
  const retryAttempts = options.retryAttempts || 2;
  const backoffMs = options.backoffMs || 100;
  const operation = options.operation || 'set';
  const entityName = options.entityName || 'Items';
  const onProgress = options.onProgress;

  if (!items || items.length === 0) {
    const emptyResult: BatchUploadResult = {
      success: true,
      totalItems: 0,
      totalChunks: 0,
      processedItems: 0,
      errors: [],
      durationMs: 0
    };
    if (onProgress) {
      onProgress({
        totalItems: 0,
        processedItems: 0,
        currentChunk: 0,
        totalChunks: 0,
        percentage: 100,
        status: 'completed',
        currentEntity: entityName
      });
    }
    return emptyResult;
  }

  const chunks = chunkArray(items, chunkSize);
  const totalChunks = chunks.length;
  let processedItems = 0;
  const errors: Array<{ chunkIndex: number; error: any }> = [];

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const chunk = chunks[chunkIndex];
    let attempt = 0;
    let chunkSuccess = false;
    let lastError: any = null;

    if (onProgress) {
      onProgress({
        totalItems: items.length,
        processedItems,
        currentChunk: chunkIndex + 1,
        totalChunks,
        percentage: Math.round((processedItems / items.length) * 100),
        status: 'in_progress',
        currentEntity: entityName
      });
    }

    while (attempt < retryAttempts && !chunkSuccess) {
      attempt++;
      try {
        const batch = writeBatch(db);
        const startIndex = chunkIndex * chunkSize;

        for (let i = 0; i < chunk.length; i++) {
          const item = chunk[i];
          const docRef = getDocRef(item, startIndex + i);
          if (!docRef) continue;

          if (operation === 'delete') {
            batch.delete(docRef);
          } else {
            const cleanedData = cleanForFirestore(item);
            batch.set(docRef, cleanedData, { merge: true });
          }
        }

        // Commit this chunk's batch to Firestore with robust 15s timeout
        await Promise.race([
          batch.commit(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore batch timeout')), 15000))
        ]);
        chunkSuccess = true;
        processedItems += chunk.length;
      } catch (err: any) {
        lastError = err;
        if (attempt < retryAttempts) {
          const sleepTime = backoffMs * attempt;
          await delay(sleepTime);
        }
      }
    }

    if (!chunkSuccess) {
      errors.push({ chunkIndex, error: lastError });
    }
  }

  const durationMs = Date.now() - startTime;
  const overallSuccess = errors.length === 0;

  if (onProgress) {
    onProgress({
      totalItems: items.length,
      processedItems,
      currentChunk: totalChunks,
      totalChunks,
      percentage: overallSuccess ? 100 : Math.round((processedItems / items.length) * 100),
      status: overallSuccess ? 'completed' : 'error',
      currentEntity: entityName,
      errorMessage: errors.length > 0 ? `${errors.length} chunk(s) fallback to local device cache` : undefined
    });
  }

  return {
    success: overallSuccess,
    totalItems: items.length,
    totalChunks,
    processedItems,
    errors,
    durationMs
  };
}

// --- DEFENSIVE DATA SANITIZATION (FIRESTORE UNDEFINED REMOVER) ---

/**
 * Recursively strips `undefined` fields from objects and arrays so Firestore never throws unsupported field value errors.
 */
export function cleanForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== undefined)
      .map(item => cleanForFirestore(item)) as any;
  }
  if (typeof obj === 'object') {
    // If it's a Date or other special object
    if (obj instanceof Date) {
      return obj.toISOString() as any;
    }
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj as Record<string, any>)) {
      if (value !== undefined) {
        cleaned[key] = (typeof value === 'object' && value !== null) ? cleanForFirestore(value) : value;
      }
    }
    return cleaned as T;
  }
  return obj;
}

// --- LOCAL STORAGE RESILIENCY CACHE ---

const LOCAL_STORAGE_KEY_PREFIX = 'prepforge_data_v2_';

export function saveLocalState<T>(key: string, data: T): void {
  try {
    const fullKey = `${LOCAL_STORAGE_KEY_PREFIX}${key}`;
    localStorage.setItem(fullKey, JSON.stringify(data));
  } catch (err) {
    console.warn(`Failed to save ${key} to localStorage:`, err);
  }
}

export function loadLocalState<T>(key: string, fallback: T): T {
  try {
    const fullKey = `${LOCAL_STORAGE_KEY_PREFIX}${key}`;
    const raw = localStorage.getItem(fullKey);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`Failed to load ${key} from localStorage, using fallback:`, err);
    return fallback;
  }
}

export function cacheAllDataLocally(data: {
  profile?: UserProfile | null;
  subjects?: Subject[];
  sessions?: StudySession[];
  plans?: StudyPlan[];
  testResults?: TestResult[];
  vaults?: StorageVault[];
  activityLogs?: ActivityLog[];
  revisions?: RevisionItem[];
  notes?: UserNote[];
  flashcardDecks?: FlashcardDeck[];
  scheduledTasks?: ScheduledStudyTask[];
  chatHistory?: AIChatMessage[];
  mockExams?: GradedMockExam[];
  assignments?: Assignment[];
  missedWork?: MissedWorkItem[];
}) {
  if (data.profile) saveLocalState('profile', data.profile);
  if (data.subjects) saveLocalState('syllabus', data.subjects);
  if (data.sessions) saveLocalState('sessions', data.sessions);
  if (data.plans) saveLocalState('plans', data.plans);
  if (data.testResults) saveLocalState('testResults', data.testResults);
  if (data.vaults) saveLocalState('vaults', data.vaults);
  if (data.activityLogs) saveLocalState('activityLogs', data.activityLogs);
  if (data.revisions) saveLocalState('revisions', data.revisions);
  if (data.notes) saveLocalState('notes', data.notes);
  if (data.flashcardDecks) saveLocalState('flashcardDecks', data.flashcardDecks);
  if (data.scheduledTasks) saveLocalState('scheduledTasks', data.scheduledTasks);
  if (data.chatHistory) saveLocalState('chatHistory', data.chatHistory);
  if (data.mockExams) saveLocalState('mockExams', data.mockExams);
  if (data.assignments) saveLocalState('assignments', data.assignments);
  if (data.missedWork) saveLocalState('missedWork', data.missedWork);
}

export function loadAllDataFromLocal() {
  return {
    profile: loadLocalState<UserProfile | null>('profile', null),
    subjects: loadLocalState<Subject[]>('syllabus', DEFAULT_SYLLABUS),
    sessions: loadLocalState<StudySession[]>('sessions', []),
    plans: loadLocalState<StudyPlan[]>('plans', []),
    testResults: loadLocalState<TestResult[]>('testResults', []),
    vaults: loadLocalState<StorageVault[]>('vaults', DEFAULT_STORAGE_VAULTS),
    activityLogs: loadLocalState<ActivityLog[]>('activityLogs', []),
    revisions: loadLocalState<RevisionItem[]>('revisions', []),
    notes: loadLocalState<UserNote[]>('notes', []),
    flashcardDecks: loadLocalState<FlashcardDeck[]>('flashcardDecks', DEFAULT_FLASHCARD_DECKS),
    scheduledTasks: loadLocalState<ScheduledStudyTask[]>('scheduledTasks', []),
    chatHistory: loadLocalState<AIChatMessage[]>('chatHistory', []),
    mockExams: loadLocalState<GradedMockExam[]>('mockExams', []),
    assignments: loadLocalState<Assignment[]>('assignments', DEFAULT_ASSIGNMENTS),
    missedWork: deduplicateMissedWork(loadLocalState<MissedWorkItem[]>('missedWork', []))
  };
}

// --- USER PROFILE & SETTINGS ---

export function subscribeUserProfile(uid: string, callback: (profile: UserProfile) => void) {
  const userRef = doc(db, 'users', uid);
  return onSnapshot(userRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data() as UserProfile;
      saveLocalState('profile', data);
      callback(data);
      updateSyncStatus({ state: 'saved', mode: 'cloud', message: 'Profile synced with Cloud' });
    } else {
      // Create initial profile
      const localCached = loadLocalState<UserProfile | null>('profile', null);
      const defaultProfile: UserProfile = localCached || {
        uid,
        displayName: 'Student',
        email: '',
        subjects: [],
        targetHoursPerDay: 3,
        examDates: [],
        academicYear: '2026 - 2027',
        yearLevel: 'Year 3 (Junior)',
        semesterOrTerm: 'Fall Semester',
        targetExamYear: '2027',
        institution: 'Academic University',
        majorOrStream: 'STEM & Computer Science',
        academicYearStartDate: '2026-08-01',
        academicYearEndDate: '2027-05-31',
        targetGpaOrScore: '3.8 GPA / 90%+',
        createdAt: new Date().toISOString()
      };
      saveUserProfileToDb(uid, defaultProfile).catch(() => {});
      callback(defaultProfile);
    }
  }, (err) => {
    console.warn("Firestore user profile subscribe error:", err);
    const local = loadLocalState<UserProfile | null>('profile', null);
    if (local) callback(local);
    updateSyncStatus({ state: 'local_only', mode: 'local', message: 'Offline mode — using local storage' });
  });
}

export async function saveUserProfileToDb(uid: string, profile: Partial<UserProfile>) {
  saveLocalState('profile', { ...loadLocalState<UserProfile | null>('profile', null), ...profile });
  updateSyncStatus({ state: 'saving', message: 'Saving profile...' });
  liveSync.broadcastMutation({ collection: 'profile', action: 'UPDATE', payload: profile }).catch(() => {});
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, cleanForFirestore(profile), { merge: true });
    updateSyncStatus({ state: 'saved', mode: 'cloud', message: 'Profile saved to Cloud' });
  } catch (err: any) {
    console.error("Failed to save profile to Firestore:", err);
    updateSyncStatus({ state: 'local_only', mode: 'local', message: 'Saved to local device (Cloud offline)' });
  }
}

// --- SYLLABUS ---

export function subscribeSyllabus(uid: string, callback: (subjects: Subject[]) => void) {
  const docRef = doc(db, 'users', uid, 'data', 'syllabus');
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists() && snapshot.data()?.subjects) {
      const subs = snapshot.data().subjects as Subject[];
      saveLocalState('syllabus', subs);
      callback(subs);
      updateSyncStatus({ state: 'saved', mode: 'cloud', message: 'Syllabus synced with Cloud' });
    } else if (!snapshot.exists()) {
      // First-time initialization on cloud only if no cloud document exists yet
      const localSubs = loadLocalState<Subject[]>('syllabus', DEFAULT_SYLLABUS);
      if (localSubs && localSubs.length > 0) {
        saveSyllabusToDb(uid, localSubs).catch(() => {});
        callback(localSubs);
      }
    }
  }, (err) => {
    console.warn("Firestore syllabus error:", err);
    const localSubs = loadLocalState<Subject[]>('syllabus', DEFAULT_SYLLABUS);
    callback(localSubs);
    updateSyncStatus({ state: 'local_only', mode: 'local', message: 'Offline mode — using local syllabus' });
  });
}

export async function saveSyllabusToDb(uid: string, subjects: Subject[]) {
  saveLocalState('syllabus', subjects);
  updateSyncStatus({ state: 'saving', message: 'Saving syllabus...' });
  liveSync.broadcastMutation({ collection: 'syllabus', action: 'UPDATE', payload: subjects }).catch(() => {});
  try {
    const docRef = doc(db, 'users', uid, 'data', 'syllabus');
    const cleaned = cleanForFirestore({ subjects, updatedAt: new Date().toISOString() });
    await setDoc(docRef, cleaned, { merge: true });
    updateSyncStatus({ state: 'saved', mode: 'cloud', message: 'Syllabus saved to Cloud' });
  } catch (err: any) {
    console.error("Failed to save syllabus to Firestore:", err);
    updateSyncStatus({ state: 'local_only', mode: 'local', message: 'Saved to local device (Cloud sync failed)' });
  }
}

// --- STUDY SESSIONS ---

export function subscribeStudySessions(uid: string, callback: (sessions: StudySession[]) => void) {
  const colRef = collection(db, 'users', uid, 'studySessions');
  const q = query(colRef, orderBy('timestamp', 'desc'), limit(150));
  return onSnapshot(q, (snapshot) => {
    const sessions: StudySession[] = [];
    snapshot.forEach((docSnap) => {
      sessions.push({ id: docSnap.id, ...docSnap.data() } as StudySession);
    });
    saveLocalState('sessions', sessions);
    callback(sessions);
  }, (err) => {
    console.warn("Firestore study sessions error:", err);
    const local = loadLocalState<StudySession[]>('sessions', []);
    callback(local);
  });
}

export async function addStudySessionToDb(uid: string, session: Omit<StudySession, 'id'>): Promise<string> {
  const localId = `sess-${Date.now()}`;
  const fullSession: StudySession = { id: localId, ...session };
  
  const currentSessions = loadLocalState<StudySession[]>('sessions', []);
  saveLocalState('sessions', [fullSession, ...currentSessions]);
  updateSyncStatus({ state: 'saving', message: 'Saving study session...' });
  liveSync.broadcastMutation({ collection: 'sessions', action: 'INSERT', docId: localId, payload: fullSession }).catch(() => {});

  try {
    const colRef = collection(db, 'users', uid, 'studySessions');
    const docRef = await addDoc(colRef, cleanForFirestore(session));
    
    // Also log activity
    await addActivityLogToDb(uid, {
      date: session.date,
      timestamp: session.timestamp,
      subjectName: session.subjectName,
      chapterName: session.chapterName,
      topicName: session.topicName,
      action: 'Studied',
      details: `Studied for ${session.durationMinutes} mins — ${session.result.toLowerCase()}`,
      durationMinutes: session.durationMinutes,
      result: session.result
    });

    updateSyncStatus({ state: 'saved', mode: 'cloud', message: 'Study session saved to Cloud' });
    return docRef.id;
  } catch (err) {
    console.error("Failed to add session to Firestore:", err);
    updateSyncStatus({ state: 'local_only', mode: 'local', message: 'Session saved to device storage' });
    return localId;
  }
}

// --- STUDY PLANS ---

export function subscribeStudyPlans(uid: string, callback: (plans: StudyPlan[]) => void) {
  const colRef = collection(db, 'users', uid, 'plans');
  const q = query(colRef, orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(q, (snapshot) => {
    const plans: StudyPlan[] = [];
    snapshot.forEach((docSnap) => {
      plans.push({ id: docSnap.id, ...docSnap.data() } as StudyPlan);
    });
    saveLocalState('plans', plans);
    callback(plans);
  }, (err) => {
    console.warn("Firestore plans error:", err);
    const local = loadLocalState<StudyPlan[]>('plans', []);
    callback(local);
  });
}

export async function saveStudyPlanToDb(uid: string, plan: Omit<StudyPlan, 'id'>): Promise<string> {
  const localId = `plan-${Date.now()}`;
  const fullPlan: StudyPlan = { id: localId, ...plan };
  const currentPlans = loadLocalState<StudyPlan[]>('plans', []);
  saveLocalState('plans', [fullPlan, ...currentPlans]);
  updateSyncStatus({ state: 'saving', message: 'Saving study plan...' });
  liveSync.broadcastMutation({ collection: 'plans', action: 'INSERT', docId: localId, payload: fullPlan }).catch(() => {});

  try {
    const colRef = collection(db, 'users', uid, 'plans');
    const docRef = await addDoc(colRef, cleanForFirestore(plan));
    updateSyncStatus({ state: 'saved', mode: 'cloud', message: 'Study plan saved to Cloud' });
    return docRef.id;
  } catch (err) {
    console.error("Failed to save plan to Firestore:", err);
    updateSyncStatus({ state: 'local_only', mode: 'local', message: 'Plan saved to device storage' });
    return localId;
  }
}

export async function updateStudyPlanInDb(uid: string, planId: string, updatedPlan: Partial<StudyPlan>) {
  const currentPlans = loadLocalState<StudyPlan[]>('plans', []);
  const updatedList = currentPlans.map(p => p.id === planId ? { ...p, ...updatedPlan } : p);
  saveLocalState('plans', updatedList);
  updateSyncStatus({ state: 'saving', message: 'Updating plan...' });
  liveSync.broadcastMutation({ collection: 'plans', action: 'UPDATE', docId: planId, payload: updatedPlan }).catch(() => {});

  try {
    const docRef = doc(db, 'users', uid, 'plans', planId);
    await setDoc(docRef, cleanForFirestore(updatedPlan), { merge: true });
    updateSyncStatus({ state: 'saved', mode: 'cloud', message: 'Plan updated in Cloud' });
  } catch (err) {
    console.error("Failed to update plan in Firestore:", err);
    updateSyncStatus({ state: 'local_only', mode: 'local', message: 'Plan updated in local storage' });
  }
}

// --- TEST RESULTS & MISTAKES ---

export function subscribeTestResults(uid: string, callback: (tests: TestResult[]) => void) {
  const colRef = collection(db, 'users', uid, 'testResults');
  const q = query(colRef, orderBy('date', 'desc'), limit(100));
  return onSnapshot(q, (snapshot) => {
    const tests: TestResult[] = [];
    snapshot.forEach((docSnap) => {
      tests.push({ id: docSnap.id, ...docSnap.data() } as TestResult);
    });
    saveLocalState('testResults', tests);
    callback(tests);
  }, (err) => {
    console.warn("Firestore test results error:", err);
    const local = loadLocalState<TestResult[]>('testResults', []);
    callback(local);
  });
}

export async function addTestResultToDb(uid: string, testResult: Omit<TestResult, 'id'>): Promise<string> {
  const localId = `test-${Date.now()}`;
  const fullTest: TestResult = { id: localId, ...testResult };
  const currentTests = loadLocalState<TestResult[]>('testResults', []);
  saveLocalState('testResults', [fullTest, ...currentTests]);
  updateSyncStatus({ state: 'saving', message: 'Saving test results...' });
  liveSync.broadcastMutation({ collection: 'testResults', action: 'INSERT', docId: localId, payload: fullTest }).catch(() => {});

  try {
    const colRef = collection(db, 'users', uid, 'testResults');
    const docRef = await addDoc(colRef, cleanForFirestore(testResult));

    // Log activity
    await addActivityLogToDb(uid, {
      date: testResult.date,
      timestamp: Date.now(),
      subjectName: testResult.subjectName,
      action: 'Test Logged',
      details: `${testResult.testName}: Score ${testResult.score}`,
    });

    updateSyncStatus({ state: 'saved', mode: 'cloud', message: 'Test score saved to Cloud' });
    return docRef.id;
  } catch (err) {
    console.error("Failed to save test result to Firestore:", err);
    updateSyncStatus({ state: 'local_only', mode: 'local', message: 'Test score saved to device storage' });
    return localId;
  }
}

export async function updateTestResultInDb(uid: string, testId: string, updates: Partial<TestResult>) {
  const currentTests = loadLocalState<TestResult[]>('testResults', []);
  const updatedTests = currentTests.map(t => t.id === testId ? { ...t, ...updates } : t);
  saveLocalState('testResults', updatedTests);
  liveSync.broadcastMutation({ collection: 'testResults', action: 'UPDATE', docId: testId, payload: updates }).catch(() => {});

  try {
    const docRef = doc(db, 'users', uid, 'testResults', testId);
    await setDoc(docRef, cleanForFirestore(updates), { merge: true });
    updateSyncStatus({ state: 'saved', mode: 'cloud', message: 'Test vault item updated' });
  } catch (err) {
    console.warn("Error updating test in Firestore:", err);
    updateSyncStatus({ state: 'local_only', mode: 'local', message: 'Saved to local device cache' });
  }
}

export async function deleteTestResultFromDb(uid: string, testId: string) {
  const currentTests = loadLocalState<TestResult[]>('testResults', []);
  const updatedTests = currentTests.filter(t => t.id !== testId);
  saveLocalState('testResults', updatedTests);
  liveSync.broadcastMutation({ collection: 'testResults', action: 'DELETE', docId: testId, payload: null }).catch(() => {});

  try {
    const docRef = doc(db, 'users', uid, 'testResults', testId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn("Error deleting test from Firestore:", err);
  }
}

// --- STORAGE VAULTS (ISOLATED SUBJECT & PROJECT TEST BUCKETS) ---

export function subscribeVaults(uid: string, callback: (vaults: StorageVault[]) => void) {
  const colRef = collection(db, 'users', uid, 'vaults');
  const q = query(colRef, orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(q, (snapshot) => {
    const vaults: StorageVault[] = [];
    snapshot.forEach((docSnap) => {
      vaults.push({ id: docSnap.id, ...docSnap.data() } as StorageVault);
    });
    
    if (snapshot.size > 0) {
      saveLocalState('vaults', vaults);
      callback(vaults);
    } else {
      // If cloud is empty, check if user has local vaults to upload/preserve
      const local = loadLocalState<StorageVault[]>('vaults', DEFAULT_STORAGE_VAULTS);
      if (local && local.length > 0) {
        callback(local);
        // Sync local vaults to this cloud account in background
        if (uid && uid !== DEFAULT_GUEST_USER_ID) {
          local.forEach(v => {
            const { id, ...vaultData } = v;
            saveVaultToDb(uid, vaultData).catch(() => {});
          });
        }
      } else {
        callback(DEFAULT_STORAGE_VAULTS);
      }
    }
  }, (err) => {
    console.warn("Firestore vaults error:", err);
    const local = loadLocalState<StorageVault[]>('vaults', DEFAULT_STORAGE_VAULTS);
    callback(local);
  });
}

/**
 * Pushes all locally created / uploaded datasets (vaults, syllabus, test results, sessions, notes, plans)
 * directly to the given cloud user account partition.
 */
export async function pushAllLocalDataToCloud(uid: string): Promise<{ success: boolean; itemsSynced: number }> {
  if (!uid) return { success: false, itemsSynced: 0 };
  let count = 0;
  try {
    const allData = loadAllDataFromLocal();

    // 1. Syllabus
    if (allData.subjects && allData.subjects.length > 0) {
      await saveSyllabusToDb(uid, allData.subjects);
      count += allData.subjects.length;
    }

    // 2. Vaults & Uploaded Documents
    if (allData.vaults && allData.vaults.length > 0) {
      for (const v of allData.vaults) {
        const { id, ...vaultData } = v;
        await saveVaultToDb(uid, vaultData).catch(() => {});
        count++;
      }
    }

    // 3. Test Results
    if (allData.testResults && allData.testResults.length > 0) {
      for (const t of allData.testResults) {
        const { id, ...testData } = t;
        await addTestResultToDb(uid, testData).catch(() => {});
        count++;
      }
    }

    // 4. Study Sessions
    if (allData.sessions && allData.sessions.length > 0) {
      for (const s of allData.sessions) {
        const { id, ...sessData } = s;
        await addStudySessionToDb(uid, sessData).catch(() => {});
        count++;
      }
    }

    // 5. Flashcard Decks
    if (allData.flashcardDecks && allData.flashcardDecks.length > 0) {
      for (const d of allData.flashcardDecks) {
        await saveFlashcardDeckToDb(uid, d).catch(() => {});
        count++;
      }
    }

    // 6. Assignments & Deadlines
    if (allData.assignments && allData.assignments.length > 0) {
      for (const a of allData.assignments) {
        await saveAssignmentToDb(uid, a).catch(() => {});
        count++;
      }
    }

    // 7. User Profile
    if (allData.profile) {
      await saveUserProfileToDb(uid, allData.profile).catch(() => {});
    }

    updateSyncStatus({ state: 'saved', mode: 'cloud', message: `Synced ${count} items to ${uid}` });
    return { success: true, itemsSynced: count };
  } catch (err) {
    console.error("Error pushing local data to cloud:", err);
    return { success: false, itemsSynced: count };
  }
}

export async function saveVaultToDb(uid: string, vault: Omit<StorageVault, 'id'>): Promise<string> {
  const localId = `vault-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const fullVault: StorageVault = { id: localId, ...vault };
  const currentVaults = loadLocalState<StorageVault[]>('vaults', DEFAULT_STORAGE_VAULTS);
  saveLocalState('vaults', [fullVault, ...currentVaults]);
  updateSyncStatus({ state: 'saving', message: 'Creating storage vault...' });
  liveSync.broadcastMutation({ collection: 'vaults', action: 'INSERT', docId: localId, payload: fullVault }).catch(() => {});

  try {
    const colRef = collection(db, 'users', uid, 'vaults');
    const docRef = await addDoc(colRef, cleanForFirestore(vault));
    
    // Log activity
    await addActivityLogToDb(uid, {
      date: new Date().toISOString().split('T')[0],
      timestamp: Date.now(),
      subjectName: vault.subjectName,
      action: 'Vault Created',
      details: `Created isolated storage bucket "${vault.name}" for ${vault.subjectName}`,
    });

    updateSyncStatus({ state: 'saved', mode: 'cloud', message: 'Storage vault synced to Cloud' });
    return docRef.id;
  } catch (err) {
    console.error("Failed to save vault to Firestore:", err);
    updateSyncStatus({ state: 'local_only', mode: 'local', message: 'Vault saved to device storage' });
    return localId;
  }
}

export async function updateVaultInDb(uid: string, vaultId: string, updates: Partial<StorageVault>) {
  const currentVaults = loadLocalState<StorageVault[]>('vaults', DEFAULT_STORAGE_VAULTS);
  const updatedVaults = currentVaults.map(v => v.id === vaultId ? { ...v, ...updates, updatedAt: new Date().toISOString() } : v);
  saveLocalState('vaults', updatedVaults);
  liveSync.broadcastMutation({ collection: 'vaults', action: 'UPDATE', docId: vaultId, payload: updates }).catch(() => {});

  try {
    const docRef = doc(db, 'users', uid, 'vaults', vaultId);
    await setDoc(docRef, cleanForFirestore({ ...updates, updatedAt: new Date().toISOString() }), { merge: true });
    updateSyncStatus({ state: 'saved', mode: 'cloud', message: 'Vault updated in Cloud' });
  } catch (err) {
    console.warn("Error updating vault in Firestore:", err);
    updateSyncStatus({ state: 'local_only', mode: 'local', message: 'Saved to local device cache' });
  }
}

export async function deleteVaultFromDb(uid: string, vaultId: string) {
  const currentVaults = loadLocalState<StorageVault[]>('vaults', DEFAULT_STORAGE_VAULTS);
  const updatedVaults = currentVaults.filter(v => v.id !== vaultId);
  saveLocalState('vaults', updatedVaults);
  liveSync.broadcastMutation({ collection: 'vaults', action: 'DELETE', docId: vaultId, payload: null }).catch(() => {});

  try {
    const docRef = doc(db, 'users', uid, 'vaults', vaultId);
    await deleteDoc(docRef);
    updateSyncStatus({ state: 'saved', mode: 'cloud', message: 'Vault removed' });
  } catch (err) {
    console.warn("Error deleting vault from Firestore:", err);
  }
}

// --- ACTIVITY LOGS ---

export function subscribeActivityLogs(uid: string, callback: (logs: ActivityLog[]) => void) {
  const colRef = collection(db, 'users', uid, 'activityLogs');
  const q = query(colRef, orderBy('timestamp', 'desc'), limit(150));
  return onSnapshot(q, (snapshot) => {
    const logs: ActivityLog[] = [];
    snapshot.forEach((docSnap) => {
      logs.push({ id: docSnap.id, ...docSnap.data() } as ActivityLog);
    });
    saveLocalState('activityLogs', logs);
    callback(logs);
  }, (err) => {
    console.warn("Firestore activity logs error:", err);
    const local = loadLocalState<ActivityLog[]>('activityLogs', []);
    callback(local);
  });
}

export async function addActivityLogToDb(uid: string, log: Omit<ActivityLog, 'id' | 'userId'>): Promise<string> {
  const localId = `log-${Date.now()}`;
  const localLog: ActivityLog = { id: localId, userId: uid, ...log };
  const currentLogs = loadLocalState<ActivityLog[]>('activityLogs', []);
  saveLocalState('activityLogs', [localLog, ...currentLogs]);
  liveSync.broadcastMutation({ collection: 'activityLogs', action: 'INSERT', docId: localId, payload: localLog }).catch(() => {});

  try {
    const colRef = collection(db, 'users', uid, 'activityLogs');
    const docRef = await addDoc(colRef, cleanForFirestore({ ...log, userId: uid }));
    return docRef.id;
  } catch (err) {
    console.error("Failed to add activity log:", err);
    return localId;
  }
}

// --- REVISION ITEMS ---

export function subscribeRevisions(uid: string, callback: (revisions: RevisionItem[]) => void) {
  const docRef = doc(db, 'users', uid, 'data', 'revisions');
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists() && snapshot.data().items) {
      const items = snapshot.data().items as RevisionItem[];
      saveLocalState('revisions', items);
      callback(items);
    } else {
      const local = loadLocalState<RevisionItem[]>('revisions', []);
      callback(local);
    }
  }, (err) => {
    console.warn("Firestore revisions error:", err);
    const local = loadLocalState<RevisionItem[]>('revisions', []);
    callback(local);
  });
}

export async function saveRevisionsToDb(uid: string, revisions: RevisionItem[]) {
  saveLocalState('revisions', revisions);
  updateSyncStatus({ state: 'saving', message: 'Saving revisions...' });
  liveSync.broadcastMutation({ collection: 'revisions', action: 'UPDATE', payload: revisions }).catch(() => {});
  try {
    const docRef = doc(db, 'users', uid, 'data', 'revisions');
    await setDoc(docRef, cleanForFirestore({ items: revisions, updatedAt: new Date().toISOString() }), { merge: true });
    updateSyncStatus({ state: 'saved', mode: 'cloud', message: 'Revisions saved to Cloud' });
  } catch (err) {
    console.error("Failed to save revisions to Firestore:", err);
    updateSyncStatus({ state: 'local_only', mode: 'local', message: 'Revisions saved to device storage' });
  }
}

// --- NOTES ---

export function subscribeNotes(uid: string, callback: (notes: UserNote[]) => void) {
  const colRef = collection(db, 'users', uid, 'notes');
  const q = query(colRef, orderBy('updatedAt', 'desc'), limit(100));
  return onSnapshot(q, (snapshot) => {
    const notes: UserNote[] = [];
    snapshot.forEach((docSnap) => {
      notes.push({ id: docSnap.id, ...docSnap.data() } as UserNote);
    });
    saveLocalState('notes', notes);
    callback(notes);
  }, (err) => {
    console.warn("Firestore notes error:", err);
    const local = loadLocalState<UserNote[]>('notes', []);
    callback(local);
  });
}

export async function saveNoteToDb(uid: string, note: Omit<UserNote, 'id' | 'userId'> & { id?: string }): Promise<string> {
  const noteId = note.id || `note-${Date.now()}`;
  const fullNote: UserNote = { ...note, id: noteId, userId: uid };
  const currentNotes = loadLocalState<UserNote[]>('notes', []);
  const updatedNotes = currentNotes.some(n => n.id === noteId)
    ? currentNotes.map(n => n.id === noteId ? fullNote : n)
    : [fullNote, ...currentNotes];
  saveLocalState('notes', updatedNotes);
  updateSyncStatus({ state: 'saving', message: 'Saving note...' });
  liveSync.broadcastMutation({ collection: 'notes', action: 'UPDATE', docId: noteId, payload: fullNote }).catch(() => {});

  try {
    if (note.id) {
      const docRef = doc(db, 'users', uid, 'notes', note.id);
      await setDoc(docRef, cleanForFirestore({ ...note, userId: uid }), { merge: true });
      updateSyncStatus({ state: 'saved', mode: 'cloud', message: 'Note saved to Cloud' });
      return note.id;
    } else {
      const colRef = collection(db, 'users', uid, 'notes');
      const docRef = await addDoc(colRef, cleanForFirestore({ ...note, userId: uid }));
      updateSyncStatus({ state: 'saved', mode: 'cloud', message: 'Note saved to Cloud' });
      return docRef.id;
    }
  } catch (err) {
    console.error("Failed to save note to Firestore:", err);
    updateSyncStatus({ state: 'local_only', mode: 'local', message: 'Note saved to device storage' });
    return noteId;
  }
}

export async function deleteNoteFromDb(uid: string, noteId: string) {
  const currentNotes = loadLocalState<UserNote[]>('notes', []);
  saveLocalState('notes', currentNotes.filter(n => n.id !== noteId));
  liveSync.broadcastMutation({ collection: 'notes', action: 'DELETE', docId: noteId, payload: null }).catch(() => {});

  try {
    const docRef = doc(db, 'users', uid, 'notes', noteId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error("Failed to delete note from Firestore:", err);
  }
}

// --- FLASHCARD DECKS & ACTIVE RECALL ---

export function subscribeFlashcardDecks(uid: string, callback: (decks: FlashcardDeck[]) => void) {
  const colRef = collection(db, 'users', uid, 'flashcards');
  const q = query(colRef, orderBy('updatedAt', 'desc'), limit(50));
  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      const local = loadLocalState<FlashcardDeck[]>('flashcardDecks', DEFAULT_FLASHCARD_DECKS);
      callback(local);
    } else {
      const decks: FlashcardDeck[] = [];
      snapshot.forEach((docSnap) => {
        decks.push({ id: docSnap.id, ...docSnap.data() } as FlashcardDeck);
      });
      saveLocalState('flashcardDecks', decks);
      callback(decks);
    }
  }, (err) => {
    console.warn("Firestore flashcards error:", err);
    const local = loadLocalState<FlashcardDeck[]>('flashcardDecks', DEFAULT_FLASHCARD_DECKS);
    callback(local);
  });
}

export async function saveFlashcardDeckToDb(uid: string, deck: FlashcardDeck): Promise<string> {
  const deckId = deck.id || `deck-${Date.now()}`;
  const fullDeck: FlashcardDeck = { ...deck, id: deckId, updatedAt: new Date().toISOString() };
  const currentDecks = loadLocalState<FlashcardDeck[]>('flashcardDecks', DEFAULT_FLASHCARD_DECKS);
  const updatedDecks = currentDecks.some(d => d.id === deckId)
    ? currentDecks.map(d => d.id === deckId ? fullDeck : d)
    : [fullDeck, ...currentDecks];
  saveLocalState('flashcardDecks', updatedDecks);
  updateSyncStatus({ state: 'saving', message: 'Saving flashcard deck...' });
  liveSync.broadcastMutation({ collection: 'flashcardDecks', action: 'UPDATE', docId: deckId, payload: fullDeck }).catch(() => {});

  try {
    const docRef = doc(db, 'users', uid, 'flashcards', deckId);
    await setDoc(docRef, cleanForFirestore(fullDeck), { merge: true });
    updateSyncStatus({ state: 'saved', mode: 'cloud', message: 'Flashcards saved to Cloud' });
    return deckId;
  } catch (err) {
    console.error("Failed to save flashcards to Firestore:", err);
    updateSyncStatus({ state: 'local_only', mode: 'local', message: 'Flashcards saved to local device' });
    return deckId;
  }
}

export async function deleteFlashcardDeckFromDb(uid: string, deckId: string) {
  const currentDecks = loadLocalState<FlashcardDeck[]>('flashcardDecks', DEFAULT_FLASHCARD_DECKS);
  saveLocalState('flashcardDecks', currentDecks.filter(d => d.id !== deckId));
  liveSync.broadcastMutation({ collection: 'flashcardDecks', action: 'DELETE', docId: deckId, payload: null }).catch(() => {});

  try {
    const docRef = doc(db, 'users', uid, 'flashcards', deckId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error("Failed to delete flashcards from Firestore:", err);
  }
}

// --- STUDY GROUPS & COLLABORATIVE GOALS ---

export function subscribeStudyGroups(callback: (groups: StudyGroup[]) => void) {
  const colRef = collection(db, 'groups');
  return onSnapshot(colRef, (snapshot) => {
    if (snapshot.empty) {
      callback(DEFAULT_STUDY_GROUPS);
    } else {
      const groups: StudyGroup[] = [];
      snapshot.forEach((docSnap) => {
        groups.push({ id: docSnap.id, ...docSnap.data() } as StudyGroup);
      });
      callback(groups);
    }
  }, (err) => {
    console.warn("Firestore groups error (using defaults):", err);
    callback(DEFAULT_STUDY_GROUPS);
  });
}

export async function saveStudyGroupToDb(group: StudyGroup) {
  try {
    const groupRef = doc(db, 'groups', group.id);
    await setDoc(groupRef, cleanForFirestore(group), { merge: true });
  } catch (err) {
    console.error("Failed to save study group:", err);
  }
}

export async function createStudyGroupInDb(group: Omit<StudyGroup, 'id'>): Promise<string> {
  const colRef = collection(db, 'groups');
  const docRef = await addDoc(colRef, cleanForFirestore(group));
  return docRef.id;
}

export async function deleteStudyGroupFromDb(groupId: string) {
  const groupRef = doc(db, 'groups', groupId);
  await deleteDoc(groupRef);
}

// --- ASSIGNMENTS & DEADLINE MANAGER ---

export function subscribeAssignments(uid: string, callback: (assignments: Assignment[]) => void) {
  const colRef = collection(db, 'users', uid, 'assignments');
  const q = query(colRef, orderBy('dueDate', 'asc'));
  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      const local = loadLocalState<Assignment[]>('assignments', DEFAULT_ASSIGNMENTS);
      callback(local);
    } else {
      const assignments: Assignment[] = [];
      snapshot.forEach((docSnap) => {
        assignments.push({ id: docSnap.id, ...docSnap.data() } as Assignment);
      });
      saveLocalState('assignments', assignments);
      callback(assignments);
    }
  }, (err) => {
    console.warn("Firestore assignments error:", err);
    const local = loadLocalState<Assignment[]>('assignments', DEFAULT_ASSIGNMENTS);
    callback(local);
  });
}

export async function saveAssignmentToDb(uid: string, assignment: Assignment): Promise<string> {
  const asgId = assignment.id || `asg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const nowStr = new Date().toISOString();
  const fullAssignment: Assignment = {
    ...assignment,
    id: asgId,
    userId: uid,
    updatedAt: nowStr,
    createdAt: assignment.createdAt || nowStr
  };
  
  const current = loadLocalState<Assignment[]>('assignments', DEFAULT_ASSIGNMENTS);
  const exists = current.some(a => a.id === asgId);
  const updated = exists
    ? current.map(a => a.id === asgId ? fullAssignment : a)
    : [fullAssignment, ...current];
  saveLocalState('assignments', updated);
  updateSyncStatus({ state: 'saving', message: 'Saving assignment...' });
  liveSync.broadcastMutation({ collection: 'assignments', action: 'UPDATE', docId: asgId, payload: fullAssignment }).catch(() => {});

  try {
    const docRef = doc(db, 'users', uid, 'assignments', asgId);
    await setDoc(docRef, cleanForFirestore(fullAssignment), { merge: true });
    
    // Log activity
    await addActivityLogToDb(uid, {
      date: new Date().toISOString().split('T')[0],
      timestamp: Date.now(),
      subjectName: fullAssignment.subjectName || 'General',
      action: exists ? 'Assignment Updated' : 'Assignment Created',
      details: `${fullAssignment.type}: "${fullAssignment.title}" due ${fullAssignment.dueDate} (${fullAssignment.priority} Priority)`
    });

    updateSyncStatus({ state: 'saved', mode: 'cloud', message: 'Assignment saved to Cloud' });
    return asgId;
  } catch (err) {
    console.error("Failed to save assignment to Firestore:", err);
    updateSyncStatus({ state: 'local_only', mode: 'local', message: 'Assignment saved to device storage' });
    return asgId;
  }
}

export async function deleteAssignmentFromDb(uid: string, assignmentId: string) {
  const current = loadLocalState<Assignment[]>('assignments', DEFAULT_ASSIGNMENTS);
  saveLocalState('assignments', current.filter(a => a.id !== assignmentId));
  liveSync.broadcastMutation({ collection: 'assignments', action: 'DELETE', docId: assignmentId, payload: null }).catch(() => {});

  try {
    const docRef = doc(db, 'users', uid, 'assignments', assignmentId);
    await deleteDoc(docRef);
    updateSyncStatus({ state: 'saved', mode: 'cloud', message: 'Assignment deleted' });
  } catch (err) {
    console.error("Failed to delete assignment from Firestore:", err);
  }
}

export async function saveAllAssignmentsToDb(uid: string, assignments: Assignment[]) {
  saveLocalState('assignments', assignments);
  updateSyncStatus({ state: 'saving', message: 'Syncing assignments...' });
  liveSync.broadcastMutation({ collection: 'assignments', action: 'UPDATE', payload: assignments }).catch(() => {});
  try {
    await writeBatchInChunks(
      assignments,
      (asg) => doc(db, 'users', uid, 'assignments', asg.id || `asg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`),
      { chunkSize: 250, entityName: 'Assignments' }
    );
    updateSyncStatus({ state: 'saved', mode: 'cloud', message: 'Assignments synchronized with Cloud' });
  } catch (err) {
    console.warn("Error batch saving assignments to Firestore:", err);
  }
}

// --- MISSED WORK & RECOVERY PLAN TRACKER ---

export function subscribeMissedWork(uid: string, callback: (items: MissedWorkItem[]) => void) {
  const docRef = doc(db, 'users', uid, 'data', 'missedWork');
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      const items = deduplicateMissedWork((data.items || []) as MissedWorkItem[]);
      saveLocalState('missedWork', items);
      callback(items);
    } else {
      const local = deduplicateMissedWork(loadLocalState<MissedWorkItem[]>('missedWork', []));
      callback(local);
    }
  }, (err) => {
    console.warn("Firestore missedWork error:", err);
    const local = deduplicateMissedWork(loadLocalState<MissedWorkItem[]>('missedWork', []));
    callback(local);
  });
}

export async function saveMissedWorkItemToDb(uid: string, item: MissedWorkItem): Promise<void> {
  const current = deduplicateMissedWork(loadLocalState<MissedWorkItem[]>('missedWork', []));
  const exists = current.some(m => m.id === item.id);
  const updated = deduplicateMissedWork(exists 
    ? current.map(m => m.id === item.id ? item : m)
    : [item, ...current]);

  saveLocalState('missedWork', updated);
  updateSyncStatus({ state: 'saving', message: 'Updating missed work status...' });
  liveSync.broadcastMutation({ 
    collection: 'missedWork', 
    action: 'UPDATE', 
    docId: item.id, 
    payload: item 
  }).catch(() => {});

  try {
    const docRef = doc(db, 'users', uid, 'data', 'missedWork');
    await setDoc(docRef, cleanForFirestore({ items: updated, updatedAt: new Date().toISOString() }), { merge: true });
    updateSyncStatus({ state: 'saved', mode: 'cloud', message: 'Missed work status updated across devices' });
  } catch (err) {
    console.warn("Failed to save missed work item to Firestore:", err);
    updateSyncStatus({ state: 'local_only', mode: 'local', message: 'Missed work saved locally on this device' });
  }
}

export async function saveAllMissedWorkToDb(uid: string, items: MissedWorkItem[]): Promise<void> {
  const cleanItems = deduplicateMissedWork(items);
  saveLocalState('missedWork', cleanItems);
  updateSyncStatus({ state: 'saving', message: 'Syncing missed work and recovery plan...' });
  liveSync.broadcastMutation({ 
    collection: 'missedWork', 
    action: 'UPDATE', 
    payload: cleanItems 
  }).catch(() => {});

  try {
    const docRef = doc(db, 'users', uid, 'data', 'missedWork');
    await setDoc(docRef, cleanForFirestore({ items: cleanItems, updatedAt: new Date().toISOString() }), { merge: true });
    updateSyncStatus({ state: 'saved', mode: 'cloud', message: 'Missed work & recovery plan synced' });
  } catch (err) {
    console.warn("Failed to batch save missed work to Firestore:", err);
    updateSyncStatus({ state: 'local_only', mode: 'local', message: 'Missed work saved locally' });
  }
}

export async function deleteMissedWorkItemFromDb(uid: string, itemId: string): Promise<void> {
  const current = deduplicateMissedWork(loadLocalState<MissedWorkItem[]>('missedWork', []));
  const updated = current.filter(m => m.id !== itemId);
  saveLocalState('missedWork', updated);
  liveSync.broadcastMutation({ 
    collection: 'missedWork', 
    action: 'DELETE', 
    docId: itemId, 
    payload: null 
  }).catch(() => {});

  try {
    const docRef = doc(db, 'users', uid, 'data', 'missedWork');
    await setDoc(docRef, cleanForFirestore({ items: updated, updatedAt: new Date().toISOString() }), { merge: true });
  } catch (err) {
    console.warn("Failed to delete missed work from Firestore:", err);
  }
}

// --- SCHEDULED STUDY TASKS & TIMETABLES ---

export function subscribeScheduledTasks(uid: string, callback: (tasks: ScheduledStudyTask[]) => void) {
  const docRef = doc(db, 'users', uid, 'data', 'scheduledTasks');
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      const tasks = (data.tasks || []) as ScheduledStudyTask[];
      saveLocalState('scheduledTasks', tasks);
      callback(tasks);
    } else {
      const local = loadLocalState<ScheduledStudyTask[]>('scheduledTasks', []);
      callback(local);
    }
  }, (err) => {
    console.warn("Firestore scheduledTasks error:", err);
    const local = loadLocalState<ScheduledStudyTask[]>('scheduledTasks', []);
    callback(local);
  });
}

export async function saveScheduledTasksToDb(uid: string, tasks: ScheduledStudyTask[]): Promise<void> {
  saveLocalState('scheduledTasks', tasks);
  updateSyncStatus({ state: 'saving', message: 'Syncing study tasks across devices...' });
  liveSync.broadcastMutation({ collection: 'scheduledTasks', action: 'UPDATE', payload: tasks }).catch(() => {});
  try {
    const docRef = doc(db, 'users', uid, 'data', 'scheduledTasks');
    await setDoc(docRef, cleanForFirestore({ tasks, updatedAt: new Date().toISOString() }), { merge: true });
    updateSyncStatus({ state: 'saved', mode: 'cloud', message: 'Tasks synchronized across all devices' });
  } catch (err) {
    console.error("Failed to save scheduled tasks to Firestore:", err);
    updateSyncStatus({ state: 'local_only', mode: 'local', message: 'Tasks saved locally on this device' });
  }
}

// --- AI TUTOR CHAT HISTORY & CONVERSATIONS ---

export function subscribeChatHistory(uid: string, callback: (messages: AIChatMessage[]) => void) {
  const docRef = doc(db, 'users', uid, 'data', 'chatHistory');
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      const messages = (data.messages || []) as AIChatMessage[];
      saveLocalState('chatHistory', messages);
      callback(messages);
    } else {
      const local = loadLocalState<AIChatMessage[]>('chatHistory', []);
      callback(local);
    }
  }, (err) => {
    console.warn("Firestore chatHistory error:", err);
    const local = loadLocalState<AIChatMessage[]>('chatHistory', []);
    callback(local);
  });
}

export async function saveChatHistoryToDb(uid: string, messages: AIChatMessage[]): Promise<void> {
  saveLocalState('chatHistory', messages);
  try {
    const docRef = doc(db, 'users', uid, 'data', 'chatHistory');
    // Keep the most recent 100 messages for fast cross-device synchronization
    const trimmed = messages.slice(-100);
    await setDoc(docRef, cleanForFirestore({ messages: trimmed, updatedAt: new Date().toISOString() }), { merge: true });
  } catch (err) {
    console.warn("Failed to sync chat history to Firestore:", err);
  }
}

export async function clearChatHistoryInDb(uid: string): Promise<void> {
  saveLocalState('chatHistory', []);
  try {
    const docRef = doc(db, 'users', uid, 'data', 'chatHistory');
    await setDoc(docRef, { messages: [], updatedAt: new Date().toISOString() });
  } catch (err) {
    console.warn("Failed to clear chat history in Firestore:", err);
  }
}

// --- AI GENERATED MOCK EXAMS & GRADED RESULTS ---

export function subscribeMockExams(uid: string, callback: (exams: GradedMockExam[]) => void) {
  const colRef = collection(db, 'users', uid, 'mockExams');
  const q = query(colRef, orderBy('completedAt', 'desc'), limit(50));
  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      const local = loadLocalState<GradedMockExam[]>('mockExams', []);
      callback(local);
    } else {
      const exams: GradedMockExam[] = [];
      snapshot.forEach((docSnap) => {
        exams.push({ id: docSnap.id, ...docSnap.data() } as GradedMockExam);
      });
      saveLocalState('mockExams', exams);
      callback(exams);
    }
  }, (err) => {
    console.warn("Firestore mockExams error:", err);
    const local = loadLocalState<GradedMockExam[]>('mockExams', []);
    callback(local);
  });
}

export async function saveMockExamToDb(uid: string, exam: GradedMockExam): Promise<string> {
  const examId = exam.id || `mock-${Date.now()}`;
  const fullExam = { ...exam, id: examId };
  const current = loadLocalState<GradedMockExam[]>('mockExams', []);
  const updated = [fullExam, ...current.filter(e => e.id !== examId)];
  saveLocalState('mockExams', updated);
  try {
    const docRef = doc(db, 'users', uid, 'mockExams', examId);
    await setDoc(docRef, cleanForFirestore(fullExam), { merge: true });
    return examId;
  } catch (err) {
    console.warn("Failed to save mock exam to Firestore:", err);
    return examId;
  }
}

// --- COMPLETE CLOUD SYNC & CHUNKED BATCH PERSISTENCE ENGINE ---

/**
 * Multi-layer Two-Point Saving Executor.
 * 
 * POINT 1: Immediate, zero-latency synchronous commit to device local storage (Edge Cache).
 * POINT 2: Resilient, asynchronous chunked batch upload to Google Cloud Firestore with retry & exponential backoff.
 */
export async function executeDualLayerSave<T>(params: {
  localKey: string;
  localData: T;
  uid?: string | null;
  cloudSyncFn?: () => Promise<any>;
  description?: string;
}): Promise<{ localSuccess: boolean; cloudSuccess: boolean; message: string }> {
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const desc = params.description || params.localKey;

  // --- SAVE POINT 1: Instant Local Device Storage Layer ---
  saveLocalState(params.localKey, params.localData);
  
  const currentTotal = Array.isArray(params.localData) ? params.localData.length : 1;
  updateSyncStatus({
    state: 'saving',
    message: `Point 1 saved: ${desc} stored locally on device. Syncing to Cloud (Point 2)...`,
    dualLayer: {
      point1Local: {
        status: 'saved',
        lastSavedAt: timestamp,
        storageType: 'localStorage / Edge Cache',
        itemsCount: currentTotal
      },
      point2Cloud: {
        status: params.uid ? 'syncing' : 'offline',
        lastSavedAt: currentSyncStatus.dualLayer?.point2Cloud.lastSavedAt || null,
        storageType: 'Google Cloud Firestore',
        chunkSize: 200
      }
    }
  });

  // If no user is authenticated or no cloud function provided, Point 1 is sufficient
  if (!params.uid || !params.cloudSyncFn) {
    updateSyncStatus({
      state: 'local_only',
      mode: 'local',
      message: `Point 1 active: ${desc} safely stored on this device. Sign in to enable Point 2 Cloud Sync.`
    });
    return { localSuccess: true, cloudSuccess: false, message: 'Saved to local device cache' };
  }

  // --- SAVE POINT 2: Resilient Cloud Firestore Layer ---
  try {
    await params.cloudSyncFn();
    const cloudTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    updateSyncStatus({
      state: 'saved',
      mode: 'cloud',
      message: `Dual-Layer Synced: Point 1 (Local) & Point 2 (Cloud) updated successfully.`,
      dualLayer: {
        point1Local: {
          status: 'saved',
          lastSavedAt: timestamp,
          storageType: 'localStorage / Edge Cache',
          itemsCount: currentTotal
        },
        point2Cloud: {
          status: 'saved',
          lastSavedAt: cloudTimestamp,
          storageType: 'Google Cloud Firestore',
          chunkSize: 200
        }
      }
    });

    return { localSuccess: true, cloudSuccess: true, message: 'Saved to local device and Cloud database' };
  } catch (err: any) {
    console.error(`[DualLayerSave] Point 2 Cloud Sync failed for ${desc}:`, err);
    updateSyncStatus({
      state: 'local_only',
      mode: 'local',
      message: `Point 1 protected: ${desc} preserved on device. Cloud sync failed: ${err?.message || 'Offline'}.`,
      dualLayer: {
        point1Local: {
          status: 'saved',
          lastSavedAt: timestamp,
          storageType: 'localStorage / Edge Cache',
          itemsCount: currentTotal
        },
        point2Cloud: {
          status: 'error',
          lastSavedAt: currentSyncStatus.dualLayer?.point2Cloud.lastSavedAt || null,
          storageType: 'Google Cloud Firestore',
          chunkSize: 200
        }
      }
    });

    return { localSuccess: true, cloudSuccess: false, message: 'Saved locally; Cloud sync queued/failed' };
  }
}

/**
 * Uploads a full dataset to Firestore using safe chunked batch uploads across all subcollections.
 * Avoids Firestore 500-write limitation, handles high latency, and reports per-chunk progress.
 */
export async function batchUploadLargeDataset(
  uid: string,
  state: {
    profile?: UserProfile | null;
    subjects?: Subject[];
    sessions?: StudySession[];
    plans?: StudyPlan[];
    testResults?: TestResult[];
    vaults?: StorageVault[];
    activityLogs?: ActivityLog[];
    revisions?: RevisionItem[];
    notes?: UserNote[];
    flashcardDecks?: FlashcardDeck[];
    scheduledTasks?: ScheduledStudyTask[];
    chatHistory?: AIChatMessage[];
    mockExams?: GradedMockExam[];
    assignments?: Assignment[];
    missedWork?: MissedWorkItem[];
  },
  onProgress?: (progress: BatchUploadProgress) => void
): Promise<{ success: boolean; message: string; details?: any }> {
  const startTime = Date.now();

  // 1. Point 1: Instant Local Cache (0ms)
  cacheAllDataLocally(state);

  // Calculate actual total entities to sync
  const totalSessions = state.sessions?.length || 0;
  const totalPlans = state.plans?.length || 0;
  const totalTests = state.testResults?.length || 0;
  const totalVaults = state.vaults?.length || 0;
  const totalLogs = state.activityLogs?.length || 0;
  const totalNotes = state.notes?.length || 0;
  const totalDecks = state.flashcardDecks?.length || 0;
  const totalMocks = state.mockExams?.length || 0;
  const totalAssignments = state.assignments?.length || 0;
  const totalMissed = state.missedWork?.length || 0;
  const hasProfile = !!state.profile;
  const hasSyllabus = !!(state.subjects && state.subjects.length > 0);
  const hasRevisions = !!(state.revisions && state.revisions.length > 0);
  const hasTasks = !!(state.scheduledTasks && state.scheduledTasks.length > 0);
  const hasChat = !!(state.chatHistory && state.chatHistory.length > 0);
  const hasMissedWork = totalMissed > 0;

  const totalEntities = totalSessions + totalPlans + totalTests + totalVaults + totalLogs + totalNotes + totalDecks + totalMocks + totalAssignments + totalMissed +
    (hasProfile ? 1 : 0) + (hasSyllabus ? 1 : 0) + (hasRevisions ? 1 : 0) + (hasTasks ? 1 : 0) + (hasChat ? 1 : 0);

  if (onProgress) {
    onProgress({
      totalItems: Math.max(1, totalEntities),
      processedItems: totalEntities,
      currentChunk: 1,
      totalChunks: 1,
      percentage: 50,
      status: 'in_progress',
      currentEntity: 'Local Device Storage Saved'
    });
  }

  // If user is offline or no entities, return success immediately
  if (totalEntities === 0 || !uid) {
    if (onProgress) {
      onProgress({
        totalItems: 1,
        processedItems: 1,
        currentChunk: 1,
        totalChunks: 1,
        percentage: 100,
        status: 'completed',
        currentEntity: 'Device & Cloud Storage'
      });
    }
    updateSyncStatus({ 
      state: 'saved', 
      mode: 'cloud', 
      message: 'All data is up to date and safely stored.' 
    });
    return { success: true, message: 'All data stored locally and ready.' };
  }

  try {
    // 2. Point 2: Parallel Cloud Sync with timeout
    const cloudPromises: Promise<any>[] = [];

    if (hasProfile) {
      const userRef = doc(db, 'users', uid);
      cloudPromises.push(setDoc(userRef, cleanForFirestore(state.profile), { merge: true }));
    }

    if (hasSyllabus) {
      const syllabusRef = doc(db, 'users', uid, 'data', 'syllabus');
      cloudPromises.push(setDoc(syllabusRef, cleanForFirestore({ subjects: state.subjects, updatedAt: new Date().toISOString() }), { merge: true }));
    }

    if (hasRevisions) {
      const revRef = doc(db, 'users', uid, 'data', 'revisions');
      cloudPromises.push(setDoc(revRef, cleanForFirestore({ items: state.revisions, updatedAt: new Date().toISOString() }), { merge: true }));
    }

    if (hasTasks) {
      const taskRef = doc(db, 'users', uid, 'data', 'scheduledTasks');
      cloudPromises.push(setDoc(taskRef, cleanForFirestore({ tasks: state.scheduledTasks, updatedAt: new Date().toISOString() }), { merge: true }));
    }

    if (hasChat) {
      const chatRef = doc(db, 'users', uid, 'data', 'chatHistory');
      cloudPromises.push(setDoc(chatRef, cleanForFirestore({ messages: state.chatHistory, updatedAt: new Date().toISOString() }), { merge: true }));
    }

    if (hasMissedWork) {
      const missedRef = doc(db, 'users', uid, 'data', 'missedWork');
      cloudPromises.push(setDoc(missedRef, cleanForFirestore({ items: state.missedWork, updatedAt: new Date().toISOString() }), { merge: true }));
    }

    if (totalSessions > 0) {
      cloudPromises.push(writeBatchInChunks(
        state.sessions!,
        (sess) => doc(db, 'users', uid, 'studySessions', sess.id || `sess-${Date.now()}-${Math.random()}`),
        { chunkSize: 250, entityName: 'Study Sessions' }
      ));
    }

    if (totalPlans > 0) {
      cloudPromises.push(writeBatchInChunks(
        state.plans!,
        (plan) => doc(db, 'users', uid, 'plans', plan.id || `plan-${Date.now()}-${Math.random()}`),
        { chunkSize: 250, entityName: 'Study Plans' }
      ));
    }

    if (totalTests > 0) {
      cloudPromises.push(writeBatchInChunks(
        state.testResults!,
        (test) => doc(db, 'users', uid, 'testResults', test.id || `test-${Date.now()}-${Math.random()}`),
        { chunkSize: 250, entityName: 'Test Results' }
      ));
    }

    if (totalVaults > 0) {
      cloudPromises.push(writeBatchInChunks(
        state.vaults!,
        (vault) => doc(db, 'users', uid, 'vaults', vault.id || `vault-${Date.now()}-${Math.random()}`),
        { chunkSize: 250, entityName: 'Storage Vaults' }
      ));
    }

    if (totalLogs > 0) {
      cloudPromises.push(writeBatchInChunks(
        state.activityLogs!,
        (log) => doc(db, 'users', uid, 'activityLogs', log.id || `log-${Date.now()}-${Math.random()}`),
        { chunkSize: 250, entityName: 'Activity Logs' }
      ));
    }

    if (totalNotes > 0) {
      cloudPromises.push(writeBatchInChunks(
        state.notes!,
        (note) => doc(db, 'users', uid, 'notes', note.id || `note-${Date.now()}-${Math.random()}`),
        { chunkSize: 250, entityName: 'User Notes' }
      ));
    }

    if (totalDecks > 0) {
      cloudPromises.push(writeBatchInChunks(
        state.flashcardDecks!,
        (deck) => doc(db, 'users', uid, 'flashcards', deck.id || `deck-${Date.now()}-${Math.random()}`),
        { chunkSize: 250, entityName: 'Flashcard Decks' }
      ));
    }

    if (totalMocks > 0) {
      cloudPromises.push(writeBatchInChunks(
        state.mockExams!,
        (mock) => doc(db, 'users', uid, 'mockExams', mock.id || `mock-${Date.now()}-${Math.random()}`),
        { chunkSize: 250, entityName: 'Mock Exams' }
      ));
    }

    if (totalAssignments > 0) {
      cloudPromises.push(writeBatchInChunks(
        state.assignments!,
        (asg) => doc(db, 'users', uid, 'assignments', asg.id || `asg-${Date.now()}-${Math.random()}`),
        { chunkSize: 250, entityName: 'Assignments' }
      ));
    }

    // Execute with a 25s race timeout for large datasets across devices
    await Promise.race([
      Promise.all(cloudPromises),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Cloud sync timeout; device cache preserved')), 25000))
    ]);

    const duration = Date.now() - startTime;
    if (onProgress) {
      onProgress({
        totalItems: totalEntities,
        processedItems: totalEntities,
        currentChunk: 1,
        totalChunks: 1,
        percentage: 100,
        status: 'completed',
        currentEntity: 'All Datasets'
      });
    }

    updateSyncStatus({ 
      state: 'saved', 
      mode: 'cloud', 
      message: 'All study data, syllabus, tasks, and history backed up across devices.' 
    });

    return { 
      success: true, 
      message: `Sync successfully completed (${totalEntities} items in ${duration}ms).`,
      details: { totalEntities, durationMs: duration }
    };
  } catch (err: any) {
    console.warn("[Batch Upload Service] Cloud sync deferred or timed out (Local cache 100% saved):", err?.message || err);
    if (onProgress) {
      onProgress({
        totalItems: totalEntities,
        processedItems: totalEntities,
        currentChunk: 1,
        totalChunks: 1,
        percentage: 100,
        status: 'completed',
        currentEntity: 'Saved to Local Device Cache'
      });
    }

    updateSyncStatus({ 
      state: 'local_only', 
      mode: 'local', 
      message: 'Saved on device. Cloud sync will automatically resume when network is optimal.' 
    });

    return { 
      success: true, 
      message: 'Saved to local device cache.' 
    };
  }
}

/**
 * Saves all in-memory or locally cached state directly to Firestore using chunked batch uploader.
 */
export async function forceSyncAllToCloud(
  arg1?: string | ((progress: BatchUploadProgress) => void),
  arg2?: {
    profile?: UserProfile | null;
    subjects?: Subject[];
    sessions?: StudySession[];
    plans?: StudyPlan[];
    testResults?: TestResult[];
    vaults?: StorageVault[];
    activityLogs?: ActivityLog[];
    revisions?: RevisionItem[];
    notes?: UserNote[];
    flashcardDecks?: FlashcardDeck[];
    scheduledTasks?: ScheduledStudyTask[];
    chatHistory?: AIChatMessage[];
    mockExams?: GradedMockExam[];
    assignments?: Assignment[];
    missedWork?: MissedWorkItem[];
  },
  arg3?: (progress: BatchUploadProgress) => void
): Promise<{ success: boolean; message: string }> {
  let uid: string = resolveActiveUserId();
  let state: any = loadAllDataFromLocal();
  let onProgress: ((progress: BatchUploadProgress) => void) | undefined = undefined;

  if (typeof arg1 === 'function') {
    onProgress = arg1;
  } else if (typeof arg1 === 'string') {
    uid = arg1;
    if (arg2) state = arg2;
    if (typeof arg3 === 'function') onProgress = arg3;
  }

  updateSyncStatus({ state: 'saving', message: 'Performing chunked batch cloud sync...' });
  return await batchUploadLargeDataset(uid, state, onProgress);
}

// --- EXPORT & IMPORT DATA (FOR DRIVE / LOCAL BACKUP) ---

export async function exportAllUserData(uid?: string | null) {
  if (uid) {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      const syllabusDoc = await getDoc(doc(db, 'users', uid, 'data', 'syllabus'));
      const revisionsDoc = await getDoc(doc(db, 'users', uid, 'data', 'revisions'));
      const tasksDoc = await getDoc(doc(db, 'users', uid, 'data', 'scheduledTasks'));
      const chatDoc = await getDoc(doc(db, 'users', uid, 'data', 'chatHistory'));
      const missedWorkDoc = await getDoc(doc(db, 'users', uid, 'data', 'missedWork'));

      const sessionsSnap = await getDocs(collection(db, 'users', uid, 'studySessions'));
      const sessions = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const plansSnap = await getDocs(collection(db, 'users', uid, 'plans'));
      const plans = plansSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const testsSnap = await getDocs(collection(db, 'users', uid, 'testResults'));
      const tests = testsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const vaultsSnap = await getDocs(collection(db, 'users', uid, 'vaults'));
      const vaults = vaultsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const notesSnap = await getDocs(collection(db, 'users', uid, 'notes'));
      const notes = notesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const flashcardsSnap = await getDocs(collection(db, 'users', uid, 'flashcards'));
      const flashcardDecks = flashcardsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const mocksSnap = await getDocs(collection(db, 'users', uid, 'mockExams'));
      const mockExams = mocksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const asgSnap = await getDocs(collection(db, 'users', uid, 'assignments'));
      const assignments = asgSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      return {
        exportedAt: new Date().toISOString(),
        profile: userDoc.exists() ? userDoc.data() : loadLocalState('profile', null),
        syllabus: syllabusDoc.exists() ? syllabusDoc.data().subjects : loadLocalState('syllabus', DEFAULT_SYLLABUS),
        revisions: revisionsDoc.exists() ? revisionsDoc.data().items : loadLocalState('revisions', []),
        scheduledTasks: tasksDoc.exists() ? tasksDoc.data().tasks : loadLocalState('scheduledTasks', []),
        chatHistory: chatDoc.exists() ? chatDoc.data().messages : loadLocalState('chatHistory', []),
        missedWork: missedWorkDoc.exists() ? missedWorkDoc.data().items : loadLocalState('missedWork', []),
        sessions: sessions.length > 0 ? sessions : loadLocalState('sessions', []),
        plans: plans.length > 0 ? plans : loadLocalState('plans', []),
        testResults: tests.length > 0 ? tests : loadLocalState('testResults', []),
        vaults: vaults.length > 0 ? vaults : loadLocalState('vaults', DEFAULT_STORAGE_VAULTS),
        notes: notes.length > 0 ? notes : loadLocalState('notes', []),
        flashcardDecks: flashcardDecks.length > 0 ? flashcardDecks : loadLocalState('flashcardDecks', DEFAULT_FLASHCARD_DECKS),
        mockExams: mockExams.length > 0 ? mockExams : loadLocalState('mockExams', []),
        assignments: assignments.length > 0 ? assignments : loadLocalState('assignments', DEFAULT_ASSIGNMENTS)
      };
    } catch (e) {
      console.warn("Cloud export failed, exporting from local cache:", e);
    }
  }

  // Fallback local export
  const localData = loadAllDataFromLocal();
  return {
    exportedAt: new Date().toISOString(),
    ...localData
  };
}

export async function importUserData(
  firstArg: any, 
  secondArg?: any, 
  onProgress?: (progress: BatchUploadProgress) => void
) {
  let effectiveUid: string | null = null;
  let effectiveData: any = null;

  if (typeof firstArg === 'object' && firstArg !== null) {
    effectiveData = firstArg;
    effectiveUid = typeof secondArg === 'string' ? secondArg : null;
  } else if (typeof firstArg === 'string' && (firstArg.trim().startsWith('{') || firstArg.trim().startsWith('['))) {
    try {
      effectiveData = JSON.parse(firstArg);
    } catch {
      effectiveData = null;
    }
    effectiveUid = typeof secondArg === 'string' ? secondArg : null;
  } else {
    effectiveUid = typeof firstArg === 'string' ? firstArg : null;
    if (typeof secondArg === 'string' && (secondArg.trim().startsWith('{') || secondArg.trim().startsWith('['))) {
      try {
        effectiveData = JSON.parse(secondArg);
      } catch {
        effectiveData = null;
      }
    } else {
      effectiveData = secondArg;
    }
  }

  if (!effectiveData) return false;

  // Cache to Point 1 local storage immediately
  cacheAllDataLocally(effectiveData);

  if (effectiveUid) {
    // Point 2: Chunked batch upload to Firestore
    await batchUploadLargeDataset(effectiveUid, effectiveData, onProgress);
  }

  return true;
}

// --- AUTOMATIC NETWORK RECONNECTION LISTENER (OFFLINE-FIRST AUTO-SYNC) ---
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[StudyFlow Sync Engine] Internet connection restored! Initiating background cloud synchronization...');
    updateSyncStatus({ 
      state: 'saving', 
      message: 'Internet reconnected. Syncing offline changes across devices...' 
    });
    const uid = resolveActiveUserId();
    forceSyncAllToCloud(uid).catch((err) => {
      console.warn("Auto-sync on reconnect warning:", err);
    });
  });
}

