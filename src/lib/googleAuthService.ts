/**
 * Google Workspace OAuth & Token Manager
 * Manages in-memory OAuth tokens for Google Calendar, Google Drive, Gmail, and Google Keep.
 * Complies with Google Workspace integration security rules (in-memory token caching).
 */

import { signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { auth, googleProvider } from './firebase';

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/tasks.readonly',
  'https://www.googleapis.com/auth/classroom.courses',
  'https://www.googleapis.com/auth/classroom.coursework.me',
  'https://www.googleapis.com/auth/classroom.coursework.students',
  'https://www.googleapis.com/auth/classroom.courseworkmaterials',
  'https://www.googleapis.com/auth/classroom.announcements',
  'https://www.googleapis.com/auth/classroom.topics',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/meetings.space.created',
  'https://www.googleapis.com/auth/meetings.space.readonly'
];

// In-memory token cache (Do NOT store in localStorage per security guidelines)
let cachedWorkspaceToken: string | null = null;

// Automatically clear cached token on sign-out
auth.onAuthStateChanged((user: User | null) => {
  if (!user) {
    cachedWorkspaceToken = null;
  }
});

/**
 * Returns the cached OAuth access token or prompts user sign-in to obtain it.
 */
export async function getOrRequestWorkspaceToken(forcePrompt: boolean = false): Promise<string> {
  if (cachedWorkspaceToken && !forcePrompt) {
    return cachedWorkspaceToken;
  }

  try {
    if (forcePrompt) {
      googleProvider.setCustomParameters({ prompt: 'consent select_account' });
    }
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to acquire Google Workspace OAuth token.');
    }
    cachedWorkspaceToken = credential.accessToken;
    return cachedWorkspaceToken;
  } catch (error: any) {
    if (error?.code === 'auth/popup-blocked' || error?.message?.includes('popup-blocked')) {
      console.warn('Google Workspace OAuth popup blocked: Browser blocked the sign-in pop-up window.', error?.message || error);
      const friendlyErr = new Error('Google Sign-in pop-up was blocked by your browser. Please allow pop-ups for this site or open the app in a new tab to authenticate.');
      friendlyErr.name = 'PopupBlockedError';
      (friendlyErr as any).code = 'auth/popup-blocked';
      throw friendlyErr;
    }
    console.warn('Unable to obtain Google Workspace OAuth token:', error?.message || error);
    throw error;
  }
}

export function getCachedWorkspaceToken(): string | null {
  return cachedWorkspaceToken;
}

export function setCachedWorkspaceToken(token: string | null) {
  cachedWorkspaceToken = token;
}
