// Automated & Manual Workspace Backup Protocol
// Exports and restores complete application state with validation & milestone prompts

import { Subject, StudySession, StudyPlan, TestResult, RevisionItem, UserProfile } from '../types';
import { loadMistakes } from './mistakeVaultStorage';

export interface FullWorkspaceBackup {
  version: '2.0';
  exportDate: string;
  timestamp: number;
  data: {
    subjects: Subject[];
    sessions: StudySession[];
    plans: StudyPlan[];
    testResults: TestResult[];
    revisions: RevisionItem[];
    userProfile: UserProfile | null;
    mistakeVault: any[];
    rpgStats?: {
      level: number;
      xp: number;
      skillPoints: number;
    };
  };
  checksum?: string;
}

const LAST_BACKUP_KEY = 'studyflow_last_backup_timestamp';

// Check if a backup is recommended (e.g. > 15 study items and > 7 days since last backup)
export function checkBackupRecommendation(
  subjects: Subject[],
  testResults: TestResult[],
  sessions: StudySession[]
): { isRecommended: boolean; reason: string; daysSinceLastBackup: number | null } {
  const lastBackup = localStorage.getItem(LAST_BACKUP_KEY);
  const totalItems = (subjects?.reduce((acc, s) => acc + s.chapters.reduce((cAcc, c) => cAcc + c.topics.length, 0), 0) || 0)
    + (testResults?.length || 0)
    + (sessions?.length || 0);

  if (!lastBackup) {
    if (totalItems >= 10) {
      return {
        isRecommended: true,
        reason: `You have ${totalItems} study items logged with no saved backup! We recommend saving an encrypted JSON copy to prevent data loss.`,
        daysSinceLastBackup: null
      };
    }
    return { isRecommended: false, reason: 'Workspace recently started', daysSinceLastBackup: null };
  }

  const lastBackupTime = parseInt(lastBackup, 10);
  const diffDays = Math.floor((Date.now() - lastBackupTime) / (1000 * 60 * 60 * 24));

  if (diffDays >= 7 && totalItems >= 15) {
    return {
      isRecommended: true,
      reason: `It's been ${diffDays} days since your last backup. Keep your academic progress and flashcards safe!`,
      daysSinceLastBackup: diffDays
    };
  }

  return {
    isRecommended: false,
    reason: `Backed up ${diffDays} day${diffDays === 1 ? '' : 's'} ago`,
    daysSinceLastBackup: diffDays
  };
}

// Generate complete workspace backup payload
export function generateWorkspaceBackup(
  subjects: Subject[],
  sessions: StudySession[],
  plans: StudyPlan[],
  testResults: TestResult[],
  revisions: RevisionItem[],
  userProfile: UserProfile | null
): FullWorkspaceBackup {
  const mistakes = loadMistakes();

  const backup: FullWorkspaceBackup = {
    version: '2.0',
    exportDate: new Date().toISOString(),
    timestamp: Date.now(),
    data: {
      subjects,
      sessions,
      plans,
      testResults,
      revisions,
      userProfile,
      mistakeVault: mistakes,
      rpgStats: {
        level: parseInt(localStorage.getItem('rpg_player_level') || '1', 10),
        xp: parseInt(localStorage.getItem('rpg_player_xp') || '0', 10),
        skillPoints: parseInt(localStorage.getItem('rpg_skill_points') || '2', 10)
      }
    }
  };

  localStorage.setItem(LAST_BACKUP_KEY, Date.now().toString());
  return backup;
}

// Download backup as JSON file
export function downloadBackupFile(backup: FullWorkspaceBackup) {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backup, null, 2));
  const dateStr = new Date().toISOString().split('T')[0];
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `studyflow-backup-${dateStr}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// Validate and parse an uploaded backup file
export function validateBackupPayload(parsed: any): { valid: boolean; error?: string; backup?: FullWorkspaceBackup } {
  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'Invalid file format: Expected JSON object.' };
  }

  if (!parsed.data || typeof parsed.data !== 'object') {
    return { valid: false, error: 'Malformed backup: Missing root data payload.' };
  }

  if (!Array.isArray(parsed.data.subjects)) {
    return { valid: false, error: 'Malformed backup: Subjects must be an array.' };
  }

  return { valid: true, backup: parsed as FullWorkspaceBackup };
}
