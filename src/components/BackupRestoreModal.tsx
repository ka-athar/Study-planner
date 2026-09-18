import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  X, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  FileJson,
  Layers,
  Database
} from 'lucide-react';
import { Subject, StudySession, StudyPlan, TestResult, RevisionItem, UserProfile } from '../types';
import { 
  generateWorkspaceBackup, 
  downloadBackupFile, 
  validateBackupPayload, 
  checkBackupRecommendation, 
  FullWorkspaceBackup 
} from '../lib/backupManager';
import { 
  getOfflineQueue, 
  flushOfflineSyncQueue, 
  OfflineMutation, 
  subscribeOfflineQueue,
  getLastSyncTimestamp
} from '../lib/offlineSyncQueue';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  sessions: StudySession[];
  plans: StudyPlan[];
  testResults: TestResult[];
  revisions: RevisionItem[];
  userProfile: UserProfile | null;
  onRestoreWorkspace: (backup: FullWorkspaceBackup, mode: 'replace' | 'merge') => void;
  onTriggerSync?: () => Promise<void>;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  subjects,
  sessions,
  plans,
  testResults,
  revisions,
  userProfile,
  onRestoreWorkspace,
  onTriggerSync
}) => {
  const [offlineQueue, setOfflineQueue] = useState<OfflineMutation[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isFlushing, setIsFlushing] = useState<boolean>(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(getLastSyncTimestamp());

  // Restore states
  const [uploadedBackup, setUploadedBackup] = useState<FullWorkspaceBackup | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = subscribeOfflineQueue(q => setOfflineQueue(q));
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsub();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOpen) return null;

  const recommendation = checkBackupRecommendation(subjects, testResults, sessions);

  const handleDownloadBackup = () => {
    const backup = generateWorkspaceBackup(
      subjects,
      sessions,
      plans,
      testResults,
      revisions,
      userProfile
    );
    downloadBackupFile(backup);
    setRestoreSuccess('Encrypted JSON backup file downloaded successfully.');
    setTimeout(() => setRestoreSuccess(null), 4000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadedBackup(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const json = JSON.parse(text);
        const validated = validateBackupPayload(json);

        if (!validated.valid || !validated.backup) {
          setUploadError(validated.error || 'Invalid backup structure.');
        } else {
          setUploadedBackup(validated.backup);
        }
      } catch (err) {
        setUploadError('Failed to parse JSON file. Ensure you selected a valid StudyFlow backup.');
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmRestore = (mode: 'replace' | 'merge') => {
    if (!uploadedBackup) return;
    onRestoreWorkspace(uploadedBackup, mode);
    setRestoreSuccess(`Workspace restored successfully in ${mode === 'replace' ? 'Overwrite' : 'Merge'} mode.`);
    setUploadedBackup(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setTimeout(() => {
      setRestoreSuccess(null);
      onClose();
    }, 1500);
  };

  const handleManualSync = async () => {
    if (!isOnline) {
      setSyncStatusMsg('Cannot sync while offline. Please connect to internet.');
      return;
    }

    setIsFlushing(true);
    setSyncStatusMsg('Flushing offline queue and syncing with storage...');

    try {
      if (onTriggerSync) {
        await onTriggerSync();
      }
      const res = await flushOfflineSyncQueue();
      setLastSyncTime(Date.now());
      setSyncStatusMsg(`Sync completed! ${res.flushedCount} pending items synced.`);
    } catch (e: any) {
      setSyncStatusMsg(`Sync warning: ${e?.message || 'Partial sync completed.'}`);
    } finally {
      setIsFlushing(false);
      setTimeout(() => setSyncStatusMsg(null), 4000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-theme rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-theme pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-serif italic font-bold text-primary">
                Data Integrity, Backup & Sync Hub
              </h2>
              <p className="text-xs text-muted">
                Offline synchronization, background queues, and automated JSON backups
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted hover:text-primary hover:bg-theme-accent transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notifications & Feedback */}
        {restoreSuccess && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{restoreSuccess}</span>
          </div>
        )}

        {/* Backup Health Recommendation Banner */}
        {recommendation.isRecommended && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>Recommended Action: Backup Your Workspace</span>
            </div>
            <p className="text-[11px] opacity-90 leading-relaxed">
              {recommendation.reason}
            </p>
          </div>
        )}

        {/* Offline Sync Status Card */}
        <div className="bg-surface rounded-2xl p-4 border border-theme space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <div>
                <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                  {isOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-600" /> : <WifiOff className="w-3.5 h-3.5 text-rose-600" />}
                  <span>{isOnline ? 'Connected Online' : 'Operating Offline'}</span>
                </div>
                <div className="text-[10px] text-muted">
                  {lastSyncTime ? `Last synced ${new Date(lastSyncTime).toLocaleTimeString()}` : 'No sync recorded yet'}
                </div>
              </div>
            </div>

            <button
              onClick={handleManualSync}
              disabled={isFlushing || !isOnline}
              className="px-3 py-1.5 rounded-xl bg-theme-accent hover:bg-theme-accent/80 disabled:opacity-40 text-primary border border-theme text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isFlushing ? 'animate-spin' : ''}`} />
              <span>Sync Now</span>
            </button>
          </div>

          {syncStatusMsg && (
            <p className="text-[11px] text-primary font-medium">{syncStatusMsg}</p>
          )}

          {/* Pending Mutations Details */}
          <div className="pt-2 border-t border-theme/60 flex items-center justify-between text-xs">
            <span className="text-muted text-[11px]">Offline Mutations in Sync Queue:</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              offlineQueue.length > 0 ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            }`}>
              {offlineQueue.length} pending action{offlineQueue.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {/* 2-Column Actions: Export & Import */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Export Action */}
          <div className="bg-surface rounded-2xl p-5 border border-theme flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Download className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-primary">Export JSON Snapshot</h4>
              <p className="text-[11px] text-muted leading-relaxed">
                Download your complete workspace including syllabus progress, mistakes, flashcards, test records, and RPG stats.
              </p>
            </div>

            <button
              onClick={handleDownloadBackup}
              className="w-full py-2.5 rounded-xl bg-primary hover:opacity-90 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <FileJson className="w-3.5 h-3.5" />
              <span>Download Backup (.json)</span>
            </button>
          </div>

          {/* Import / Restore Action */}
          <div className="bg-surface rounded-2xl p-5 border border-theme flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Upload className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-primary">Restore from Backup</h4>
              <p className="text-[11px] text-muted leading-relaxed">
                Select a previously exported StudyFlow JSON backup file to restore or merge into this device.
              </p>
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
                id="backup-file-upload-input"
              />
              <label
                htmlFor="backup-file-upload-input"
                className="w-full py-2.5 rounded-xl bg-theme-accent hover:bg-theme-accent/80 text-primary border border-theme text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Select Backup File</span>
              </label>
            </div>
          </div>
        </div>

        {/* Upload error banner */}
        {uploadError && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Upload Verification & Confirmation Dialog */}
        {uploadedBackup && (
          <div className="bg-surface rounded-2xl p-5 border border-primary/40 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-primary">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>Verified Backup File: {uploadedBackup.exportDate ? new Date(uploadedBackup.exportDate).toLocaleDateString() : 'Ready'}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[10px]">
              <div className="bg-card p-2 rounded-xl border border-theme">
                <div className="font-bold text-primary">{uploadedBackup.data.subjects?.length || 0}</div>
                <div className="text-muted">Subjects</div>
              </div>
              <div className="bg-card p-2 rounded-xl border border-theme">
                <div className="font-bold text-primary">{uploadedBackup.data.testResults?.length || 0}</div>
                <div className="text-muted">Test Results</div>
              </div>
              <div className="bg-card p-2 rounded-xl border border-theme">
                <div className="font-bold text-primary">{uploadedBackup.data.mistakeVault?.length || 0}</div>
                <div className="text-muted">Vault Mistakes</div>
              </div>
              <div className="bg-card p-2 rounded-xl border border-theme">
                <div className="font-bold text-primary">{uploadedBackup.data.sessions?.length || 0}</div>
                <div className="text-muted">Sessions</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setUploadedBackup(null)}
                className="px-3 py-1.5 text-xs text-muted hover:text-primary transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirmRestore('merge')}
                className="px-3.5 py-2 rounded-xl bg-theme-accent hover:bg-theme-accent/80 text-primary border border-theme text-xs font-bold transition cursor-pointer"
                title="Combines existing subjects with imported data"
              >
                Merge with Current
              </button>
              <button
                onClick={() => handleConfirmRestore('replace')}
                className="px-4 py-2 rounded-xl bg-primary hover:opacity-90 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                title="Overwrites current workspace with backup data"
              >
                Overwrite Workspace
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
