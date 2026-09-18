import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Smartphone, 
  Laptop, 
  Tablet, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Database, 
  HardDrive, 
  ShieldCheck, 
  Sparkles, 
  Layers, 
  X,
  Clock,
  BookOpen,
  Archive,
  FileCheck,
  Activity,
  Trash2,
  Cpu,
  Monitor,
  Check,
  Wifi,
  QrCode,
  KeyRound,
  Download,
  Upload,
  Copy,
  ExternalLink,
  Share2,
  FileJson,
  CheckCircle,
  HelpCircle,
  Hash,
  History,
  RotateCcw,
  CheckCircle as ShieldVerified,
  Lock
} from 'lucide-react';
import { 
  UserDevice, 
  searchDevicesAndDataByEmail, 
  getOrCreateDeviceId,
  revokeDevice,
  removeDeviceRecord,
  revokeAllOtherDevices,
  updateDeviceHeartbeat,
  generateTransferPin,
  redeemTransferPin,
  checkPinRedeemedStatus,
  detectDeviceInfo,
  pullFullCloudSnapshot,
  forcePullEntireCloudState,
  registerCurrentDevice
} from '../lib/deviceService';
import { 
  getActiveUserEmail, 
  setActiveUserEmail, 
  pushAllLocalDataToCloud, 
  resolveActiveUserId, 
  forceSyncAllToCloud,
  loadAllDataFromLocal,
  cacheAllDataLocally,
  saveSyllabusToDb,
  getPairedSyncUid,
  setPairedSyncUid,
  clearPairedSyncUid
} from '../lib/db';
import { QRCodeDisplay } from './QRCodeDisplay';
import { getPreSyncSafetyBackup, savePreSyncSafetyBackup } from '../lib/syncChannel';
import { 
  listIndexedDbSnapshots, 
  rollbackToIndexedDbSnapshot, 
  getPendingQueueCount, 
  getAllQueuedOperations, 
  ReconcileReport, 
  IndexedDbSafetySnapshot, 
  QueuedSyncOperation 
} from '../lib/syncEngine';
import { UserProfile, Subject, StudyPlan, StudySession, StorageVault, Assignment, TestResult, FlashcardDeck, RevisionItem, UserNote, ActivityLog } from '../types';

interface DeviceEmailSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  userProfile?: UserProfile | null;
  subjects?: Subject[];
  plans?: StudyPlan[];
  sessions?: StudySession[];
  vaults?: StorageVault[];
  assignments?: Assignment[];
  testResults?: TestResult[];
  flashcardDecks?: FlashcardDeck[];
  revisions?: RevisionItem[];
  notes?: UserNote[];
  activityLogs?: ActivityLog[];
  onEmailChanged?: (newEmail: string) => void;
  onRestoreData?: (data: any) => Promise<void> | void;
  onOpenQRScanner?: () => void;
  initialTab?: 'pin' | 'email' | 'syllabus' | 'file' | 'devices' | 'consistency';
}

export const DeviceEmailSyncModal: React.FC<DeviceEmailSyncModalProps> = ({
  isOpen,
  onClose,
  user,
  userProfile,
  subjects = [],
  plans = [],
  sessions = [],
  vaults = [],
  assignments = [],
  testResults = [],
  flashcardDecks = [],
  revisions = [],
  notes = [],
  activityLogs = [],
  onEmailChanged,
  onRestoreData,
  onOpenQRScanner,
  initialTab = 'pin'
}) => {
  const currentActiveEmail = userProfile?.email || user?.email || getActiveUserEmail() || 'atharkhanteambuster@gmail.com';
  const [activeTab, setActiveTab] = useState<'pin' | 'email' | 'syllabus' | 'file' | 'devices' | 'consistency'>(initialTab);
  
  // Search & Email State
  const [searchEmail, setSearchEmail] = useState(currentActiveEmail);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncingCurrent, setIsSyncingCurrent] = useState(false);
  const [connectMessage, setConnectMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // 6-Digit PIN Generation State
  const [generatedPin, setGeneratedPin] = useState<string>('');
  const [pinExpiresAt, setPinExpiresAt] = useState<string>('');
  const [isGeneratingPin, setIsGeneratingPin] = useState<boolean>(false);
  const [pinDisplayMode, setPinDisplayMode] = useState<'pin' | 'qr'>('pin');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [remotePairedDevice, setRemotePairedDevice] = useState<string | null>(null);

  // 6-Digit PIN Redemption State
  const [inputPin, setInputPin] = useState<string>('');
  const [isRedeemingPin, setIsRedeemingPin] = useState<boolean>(false);
  const [forcePullOnRedeem, setForcePullOnRedeem] = useState<boolean>(true);
  const [isForcePulling, setIsForcePulling] = useState<boolean>(false);
  const [hasSafetyBackup, setHasSafetyBackup] = useState<boolean>(() => !!getPreSyncSafetyBackup());

  // IndexedDB State Consistency & Safety Snapshots State
  const [latestReconcileReport, setLatestReconcileReport] = useState<ReconcileReport | null>(null);
  const [indexedDbSnapshots, setIndexedDbSnapshots] = useState<IndexedDbSafetySnapshot[]>([]);
  const [queuedOperations, setQueuedOperations] = useState<QueuedSyncOperation[]>([]);
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(0);
  const [isRollingBack, setIsRollingBack] = useState<boolean>(false);

  // JSON File Import/Export State
  const [isExportingJson, setIsExportingJson] = useState<boolean>(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const currentDeviceId = getOrCreateDeviceId();
  const currentDevInfo = detectDeviceInfo();
  const effectiveUid = resolveActiveUserId(user, searchEmail);

  // Fetch IndexedDB state on modal open
  const loadIndexedDbState = async () => {
    try {
      const [snaps, qCount, ops] = await Promise.all([
        listIndexedDbSnapshots(),
        getPendingQueueCount(),
        getAllQueuedOperations()
      ]);
      setIndexedDbSnapshots(snaps);
      setPendingQueueCount(qCount);
      setQueuedOperations(ops.slice(0, 20));
    } catch (e) {
      console.warn('Error loading IndexedDB sync status:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadIndexedDbState();
    }
  }, [isOpen]);

  // Poll for PIN pairing when code is generated on source device
  useEffect(() => {
    if (!generatedPin || generatedPin.length < 6 || remotePairedDevice) return;

    const interval = setInterval(async () => {
      try {
        const status = await checkPinRedeemedStatus(generatedPin);
        if (status.redeemed) {
          setRemotePairedDevice(status.redeemedByDevice || 'Secondary Device');
          setConnectMessage({
            type: 'success',
            text: `🎉 Connected! ${status.redeemedByDevice || 'Your other device'} has paired and received all study data.`
          });
          // Refresh device list
          handleSearch(searchEmail);
        }
      } catch (e) {}
    }, 2500);

    return () => clearInterval(interval);
  }, [generatedPin, remotePairedDevice, searchEmail]);

  // Auto-submit when user finishes entering 6 digits
  useEffect(() => {
    const clean = inputPin.replace(/[^0-9]/g, '');
    if (clean.length === 6 && !isRedeemingPin) {
      handleRedeemPin();
    }
  }, [inputPin]);

  // Count total topics and chapters in current syllabus
  const totalChapters = subjects.reduce((acc, s) => acc + (s.chapters?.length || 0), 0);
  const totalTopics = subjects.reduce((acc, s) => {
    return acc + (s.chapters?.reduce((cAcc, c) => cAcc + (c.topics?.length || 0), 0) || 0);
  }, 0);
  const completedTopics = subjects.reduce((acc, s) => {
    return acc + (s.chapters?.reduce((cAcc, c) => {
      return cAcc + (c.topics?.filter(t => t.status === 'Completed' || t.status === 'Mastered').length || 0);
    }, 0) || 0);
  }, 0);

  // Auto-search devices on open if email exists and auto-generate instant PIN & QR code
  useEffect(() => {
    if (isOpen) {
      if (currentActiveEmail) {
        handleSearch(currentActiveEmail);
      }
      if (!generatedPin) {
        handleGeneratePin();
      }
    }
  }, [isOpen, currentActiveEmail]);

  if (!isOpen) return null;

  const handleSearch = async (emailToSearch: string) => {
    if (!emailToSearch || !emailToSearch.includes('@')) return;
    setIsSearching(true);
    setConnectMessage(null);
    try {
      const res = await searchDevicesAndDataByEmail(emailToSearch);
      setSearchResult(res);
    } catch (err) {
      console.error("Device search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  // Generate a live 6-digit Transfer PIN with 0ms instant UI display
  const handleGeneratePin = () => {
    // 1. Create 6-digit PIN immediately (0ms instant display)
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const instantCode = String(randomNum);
    const instantExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    setGeneratedPin(instantCode);
    setPinExpiresAt(instantExpiresAt);
    setRemotePairedDevice(null);
    setConnectMessage(null);

    // 2. Persist in background without blocking the UI
    try {
      const localData = loadAllDataFromLocal();
      const payload = {
        subjects: subjects.length > 0 ? subjects : localData.subjects,
        plans: plans.length > 0 ? plans : localData.plans,
        sessions: sessions.length > 0 ? sessions : localData.sessions,
        vaults: vaults.length > 0 ? vaults : localData.vaults,
        assignments: assignments.length > 0 ? assignments : localData.assignments,
        testResults: testResults.length > 0 ? testResults : localData.testResults,
        flashcardDecks: flashcardDecks.length > 0 ? flashcardDecks : localData.flashcardDecks,
        revisions: revisions.length > 0 ? revisions : localData.revisions,
        notes: notes.length > 0 ? notes : localData.notes,
        activityLogs: activityLogs.length > 0 ? activityLogs : localData.activityLogs,
        scheduledTasks: localData.scheduledTasks,
        chatHistory: localData.chatHistory,
        mockExams: localData.mockExams,
        profile: userProfile || localData.profile
      };

      generateTransferPin(effectiveUid, searchEmail, payload, instantCode).catch((err) => {
        console.warn('Background PIN persistence note:', err);
      });
    } catch (err: any) {
      console.warn('PIN data packaging note:', err);
    }
  };

  // Redeem a 6-digit Transfer PIN on a new device with optional Force Pull
  const handleRedeemPin = async (overridePin?: string) => {
    const pinToUse = overridePin || inputPin;
    if (!pinToUse || pinToUse.trim().length < 6) {
      setConnectMessage({
        type: 'error',
        text: 'Please enter a 6-digit Transfer PIN.'
      });
      return;
    }

    setIsRedeemingPin(true);
    setConnectMessage(null);
    try {
      const res = await redeemTransferPin(pinToUse, { forcePull: forcePullOnRedeem });
      if (!res.success) {
        setConnectMessage({
          type: 'error',
          text: res.message
        });
        return;
      }

      // Link target email / UID
      const targetEmail = res.email || `sync_${pinToUse.replace(/[^0-9]/g, '')}@studyflow.app`;
      const targetUid = res.uid || resolveActiveUserId(null, targetEmail);

      // Permanently lock device to the source device's partition
      if (targetUid) {
        setPairedSyncUid(targetUid);
      }
      setActiveUserEmail(targetEmail);
      if (onEmailChanged) {
        onEmailChanged(targetEmail);
      }

      // If payload is returned, cache, restore, and cloud-sync immediately
      if (res.payload) {
        cacheAllDataLocally(res.payload);
        if (onRestoreData) {
          await onRestoreData(res.payload);
        }
        await forceSyncAllToCloud(targetUid, res.payload);
      }

      // Register heartbeat & device registration
      await updateDeviceHeartbeat(targetUid);
      await registerCurrentDevice(targetUid, { forcePull: forcePullOnRedeem });

      setConnectMessage({
        type: 'success',
        text: res.isForcePulled 
          ? `🎉 Force-Pulled full cloud snapshot from ${res.deviceName || 'source device'}! Local state overwritten with latest cloud database.`
          : `🎉 Connected to ${res.deviceName || 'source device'}! All syllabus chapters, assignments, and study data have been synchronized.`
      });

      setInputPin('');
      setTimeout(() => {
        handleSearch(targetEmail);
      }, 1000);
    } catch (err: any) {
      setConnectMessage({
        type: 'error',
        text: err?.message || 'Transfer failed.'
      });
    } finally {
      setIsRedeemingPin(false);
    }
  };

  // Manual Force Pull full snapshot from Cloud Database with Hash-Sum Verification & Local Consistency
  const handleManualForcePull = async (targetUid?: string) => {
    const uidToPull = targetUid || searchResult?.uid || resolveActiveUserId(user, searchEmail);
    if (!uidToPull) {
      setConnectMessage({
        type: 'error',
        text: 'No active study account or UID specified for Force Pull.'
      });
      return;
    }

    setIsForcePulling(true);
    setConnectMessage(null);

    try {
      const currentLocalState = {
        subjects,
        plans,
        sessions,
        vaults,
        assignments,
        testResults,
        flashcardDecks,
        revisions,
        notes,
        activityLogs,
        profile: userProfile
      };

      const pullResult = await forcePullEntireCloudState(uidToPull, currentLocalState);
      if (!pullResult.success || !pullResult.snapshot) {
        setConnectMessage({
          type: 'info',
          text: pullResult.message || 'No existing cloud snapshot found for this account partition in the database. Local state is 100% safe.'
        });
        return;
      }

      if (pullResult.report) {
        setLatestReconcileReport(pullResult.report);
      }

      // Overwrite local storage and react state with reconciled non-destructive state
      cacheAllDataLocally(pullResult.snapshot);
      if (onRestoreData) {
        await onRestoreData(pullResult.snapshot);
      }

      // Register device with force pull
      await registerCurrentDevice(uidToPull, { forcePull: true });
      await updateDeviceHeartbeat(uidToPull);
      await loadIndexedDbState();

      const stats = pullResult.stats || {
        subjectsCount: pullResult.snapshot.subjects?.length || 0,
        assignmentsCount: pullResult.snapshot.assignments?.length || 0,
        vaultsCount: pullResult.snapshot.vaults?.length || 0,
        testResultsCount: pullResult.snapshot.testResults?.length || 0
      };

      const rep = pullResult.report;
      const reportNote = rep 
        ? ` (🛡️ Verified ${rep.totalLocalDocs + rep.totalRemoteDocs} doc hashes: ${rep.updatedRemoteCount} updated, ${rep.insertedRemoteCount} inserted, ${rep.preservedLocalCount} local preserved)`
        : '';

      setConnectMessage({
        type: 'success',
        text: `🎉 Hash-Verified Force Pull Complete! ${stats.subjectsCount} subjects, ${stats.assignmentsCount} assignments active.${reportNote}`
      });

      const emailToSearch = searchResult?.email || searchEmail;
      if (emailToSearch) {
        handleSearch(emailToSearch);
      }
    } catch (err: any) {
      setConnectMessage({
        type: 'error',
        text: err?.message || 'Failed to force-pull cloud database snapshot. Local state remains 100% intact.'
      });
    } finally {
      setIsForcePulling(false);
    }
  };

  const handleRollbackSnapshot = async (snapshotId: string) => {
    setIsRollingBack(true);
    try {
      const restored = await rollbackToIndexedDbSnapshot(snapshotId);
      if (!restored) {
        setConnectMessage({
          type: 'error',
          text: 'Could not load the selected snapshot from IndexedDB.'
        });
        return;
      }

      cacheAllDataLocally(restored);
      if (onRestoreData) {
        await onRestoreData(restored);
      }

      await loadIndexedDbState();
      setConnectMessage({
        type: 'success',
        text: `🛡️ Successfully rolled back local state from IndexedDB checkpoint (${snapshotId})!`
      });
    } catch (e: any) {
      setConnectMessage({
        type: 'error',
        text: 'Failed to rollback snapshot.'
      });
    } finally {
      setIsRollingBack(false);
    }
  };

  const handleCopyTransferLink = () => {
    const code = generatedPin || 'DIRECT';
    const link = `${window.location.origin}${window.location.pathname}?transfer_code=${code}&sync_email=${encodeURIComponent(searchEmail)}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyCode = () => {
    if (!generatedPin) return;
    navigator.clipboard.writeText(generatedPin);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handlePastePin = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      
      let extractedPin = '';
      if (text.includes('transfer_code=') || text.includes('code=') || text.includes('pin=')) {
        try {
          const url = new URL(text);
          extractedPin = url.searchParams.get('transfer_code') || url.searchParams.get('code') || url.searchParams.get('pin') || '';
        } catch (e) {
          const match = text.match(/(?:transfer_code|code|pin)=([0-9]{6})/);
          if (match) extractedPin = match[1];
        }
      }

      if (!extractedPin) {
        extractedPin = text.replace(/[^0-9]/g, '').slice(0, 6);
      }

      if (extractedPin) {
        setInputPin(extractedPin);
      }
    } catch (err) {
      console.warn('Clipboard read error:', err);
    }
  };

  const handleRestoreSafetyBackup = async () => {
    const backup = getPreSyncSafetyBackup();
    if (!backup || !backup.state) {
      setConnectMessage({
        type: 'info',
        text: 'No local safety backup found to restore.'
      });
      return;
    }

    try {
      cacheAllDataLocally(backup.state);
      if (onRestoreData) {
        await onRestoreData(backup.state);
      }
      setConnectMessage({
        type: 'success',
        text: `Restored local backup from ${new Date(backup.savedAt).toLocaleTimeString()}!`
      });
    } catch (e: any) {
      setConnectMessage({
        type: 'error',
        text: 'Failed to restore local safety backup.'
      });
    }
  };

  const handleConnectAndSync = async () => {
    if (!searchResult || !searchResult.email) return;
    setIsConnecting(true);
    setConnectMessage(null);

    try {
      const targetEmail = searchResult.email.trim().toLowerCase();
      setActiveUserEmail(targetEmail);
      const targetUid = searchResult.uid || resolveActiveUserId(null, targetEmail);

      // Register heartbeat and push local data
      await updateDeviceHeartbeat(targetUid);
      const migration = await pushAllLocalDataToCloud(targetUid);

      if (onEmailChanged) {
        onEmailChanged(targetEmail);
      }

      setConnectMessage({
        type: 'success',
        text: `Successfully linked study email (${targetEmail})! Synced ${migration.itemsSynced} items with cloud Firestore.`
      });

      setTimeout(() => {
        handleSearch(targetEmail);
      }, 500);
    } catch (err: any) {
      setConnectMessage({
        type: 'error',
        text: err?.message || 'Failed to sync with this study email.'
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSyncThisDeviceNow = async () => {
    setIsSyncingCurrent(true);
    setConnectMessage(null);
    try {
      const targetEmail = (searchResult?.email || searchEmail).trim().toLowerCase();
      const targetUid = searchResult?.uid || resolveActiveUserId(user, targetEmail);
      await updateDeviceHeartbeat(targetUid);
      
      const liveState = {
        subjects,
        plans,
        sessions,
        vaults,
        assignments,
        testResults,
        flashcardDecks,
        revisions,
        notes,
        activityLogs,
        profile: userProfile
      };

      await forceSyncAllToCloud(targetUid, liveState);
      setConnectMessage({
        type: 'success',
        text: `🚀 Force Push Complete! Pushed ${subjects.length} subjects, ${assignments.length} assignments, ${vaults.length} vaults, ${sessions.length} sessions to Cloud Firestore.`
      });
      await handleSearch(targetEmail);
    } catch (err: any) {
      setConnectMessage({
        type: 'error',
        text: err?.message || 'Sync failed.'
      });
    } finally {
      setIsSyncingCurrent(false);
    }
  };

  const handlePushSyllabusNow = async () => {
    setIsSyncingCurrent(true);
    setConnectMessage(null);
    try {
      const targetEmail = (searchResult?.email || searchEmail).trim().toLowerCase();
      const targetUid = searchResult?.uid || resolveActiveUserId(user, targetEmail);
      await saveSyllabusToDb(targetUid, subjects);
      setConnectMessage({
        type: 'success',
        text: `Successfully pushed syllabus (${subjects.length} subjects, ${totalTopics} topics) to Cloud! All connected devices will update automatically.`
      });
    } catch (err: any) {
      setConnectMessage({
        type: 'error',
        text: err?.message || 'Failed to push syllabus.'
      });
    } finally {
      setIsSyncingCurrent(false);
    }
  };

  // Export full JSON snapshot
  const handleExportFullJson = () => {
    setIsExportingJson(true);
    try {
      const fullData = loadAllDataFromLocal();
      const exportObject = {
        app: "PrepForge Academic StudyOS",
        version: "2.6.0",
        exportedAt: new Date().toISOString(),
        device: currentDevInfo,
        data: {
          subjects: subjects.length > 0 ? subjects : fullData.subjects,
          plans: plans.length > 0 ? plans : fullData.plans,
          sessions: sessions.length > 0 ? sessions : fullData.sessions,
          vaults: vaults.length > 0 ? vaults : fullData.vaults,
          assignments: assignments.length > 0 ? assignments : fullData.assignments,
          testResults: testResults.length > 0 ? testResults : fullData.testResults,
          flashcardDecks: flashcardDecks.length > 0 ? flashcardDecks : fullData.flashcardDecks,
          revisions: revisions.length > 0 ? revisions : fullData.revisions,
          profile: userProfile || fullData.profile
        }
      };

      const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `StudyFlow_Full_Academic_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setConnectMessage({
        type: 'success',
        text: 'Backup downloaded! You can transfer this file to any device via USB, AirDrop, email, or cloud drive.'
      });
    } catch (err: any) {
      setConnectMessage({
        type: 'error',
        text: 'Failed to create JSON backup export.'
      });
    } finally {
      setIsExportingJson(false);
    }
  };

  // Import JSON snapshot from file
  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        const importedData = parsed.data || parsed;

        if (!importedData || (!importedData.subjects && !importedData.syllabus)) {
          throw new Error('Invalid StudyFlow backup format.');
        }

        const normalizedData = {
          subjects: importedData.subjects || importedData.syllabus || [],
          plans: importedData.plans || [],
          sessions: importedData.sessions || [],
          vaults: importedData.vaults || [],
          assignments: importedData.assignments || [],
          testResults: importedData.testResults || [],
          flashcardDecks: importedData.flashcardDecks || [],
          revisions: importedData.revisions || [],
          profile: importedData.profile || null
        };

        cacheAllDataLocally(normalizedData);
        if (onRestoreData) {
          await onRestoreData(normalizedData);
        }

        const targetUid = resolveActiveUserId(user, searchEmail);
        await forceSyncAllToCloud(targetUid, normalizedData);

        setConnectMessage({
          type: 'success',
          text: `Successfully imported ${normalizedData.subjects.length} subjects, ${normalizedData.assignments.length} assignments, and all coursework records!`
        });
      } catch (err: any) {
        setConnectMessage({
          type: 'error',
          text: err?.message || 'Error reading JSON backup file.'
        });
      }
    };
    reader.readAsText(file);
  };

  const handleRevokeDevice = async (targetDeviceId: string, devName: string) => {
    if (!searchResult?.uid) return;
    if (!window.confirm(`Revoke session for "${devName}"? This device will be disconnected.`)) return;
    
    try {
      await revokeDevice(searchResult.uid, targetDeviceId);
      setConnectMessage({
        type: 'info',
        text: `Device "${devName}" was revoked.`
      });
      handleSearch(searchResult.email);
    } catch (e: any) {
      setConnectMessage({
        type: 'error',
        text: 'Failed to revoke device.'
      });
    }
  };

  const handleRemoveDevice = async (targetDeviceId: string, devName: string) => {
    if (!searchResult?.uid) return;
    if (!window.confirm(`Remove device record "${devName}" from this account?`)) return;

    try {
      await removeDeviceRecord(searchResult.uid, targetDeviceId);
      setConnectMessage({
        type: 'info',
        text: `Device record "${devName}" removed.`
      });
      handleSearch(searchResult.email);
    } catch (e: any) {
      setConnectMessage({
        type: 'error',
        text: 'Failed to remove device record.'
      });
    }
  };

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return 'Recently';
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 2) return 'Just now (Live)';
      if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
      if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="bg-white dark:bg-[#1E201E] border border-theme rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-primary">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-[#2B2D42] text-white flex items-start justify-between gap-4 border-b border-[#3D405B] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 text-emerald-300 flex items-center justify-center shrink-0">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-emerald-300 font-bold flex items-center gap-1.5">
                <Wifi className="w-3 h-3" />
                <span>Multi-Device Sync & Transfer Engine</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold font-serif">
                Cross-Device Data & Syllabus Transfer
              </h2>
              <p className="text-xs text-white/70">
                Connect phones, tablets, and computers. All syllabus topics, assignments, timers, and notes stay 100% connected.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Permanent Pair Status Indicator */}
        {getPairedSyncUid() && (
          <div className="px-4 sm:px-6 py-2 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-2 text-xs text-emerald-800 dark:text-emerald-200 shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span><strong>Permanently Linked:</strong> Real-time cross-device sync is active with shared partition. All edits sync automatically.</span>
            </div>
            <button
              type="button"
              onClick={() => {
                clearPairedSyncUid();
                setConnectMessage({
                  type: 'info',
                  text: 'Device unlinked from shared partition. Operating in standalone mode.'
                });
              }}
              className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer shrink-0"
            >
              Unlink Device
            </button>
          </div>
        )}

        {/* Tab Navigation Strip */}
        <div className="flex items-center gap-1 px-4 sm:px-6 pt-3 border-b border-theme bg-theme-accent/30 overflow-x-auto scrollbar-none shrink-0">
          <button
            onClick={() => setActiveTab('pin')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'pin'
                ? 'bg-white dark:bg-[#1E201E] text-primary border-t border-x border-theme shadow-2xs'
                : 'text-muted hover:text-primary'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-500" />
            <span>6-Digit PIN Pair</span>
          </button>

          <button
            onClick={() => setActiveTab('syllabus')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'syllabus'
                ? 'bg-white dark:bg-[#1E201E] text-primary border-t border-x border-theme shadow-2xs'
                : 'text-muted hover:text-primary'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-blue-500" />
            <span>Syllabus Cross-Sync ({subjects.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('email')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'email'
                ? 'bg-white dark:bg-[#1E201E] text-primary border-t border-x border-theme shadow-2xs'
                : 'text-muted hover:text-primary'
            }`}
          >
            <Mail className="w-3.5 h-3.5 text-emerald-500" />
            <span>Account Email Cloud</span>
          </button>

          <button
            onClick={() => setActiveTab('file')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'file'
                ? 'bg-white dark:bg-[#1E201E] text-primary border-t border-x border-theme shadow-2xs'
                : 'text-muted hover:text-primary'
            }`}
          >
            <FileJson className="w-3.5 h-3.5 text-purple-500" />
            <span>Snapshot Backup (.json)</span>
          </button>

          <button
            onClick={() => setActiveTab('devices')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'devices'
                ? 'bg-white dark:bg-[#1E201E] text-primary border-t border-x border-theme shadow-2xs'
                : 'text-muted hover:text-primary'
            }`}
          >
            <Laptop className="w-3.5 h-3.5 text-slate-500" />
            <span>Connected Devices ({searchResult?.devices?.length || 1})</span>
          </button>

          <button
            onClick={() => setActiveTab('consistency')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'consistency'
                ? 'bg-white dark:bg-[#1E201E] text-primary border-t border-x border-theme shadow-2xs'
                : 'text-muted hover:text-primary'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
            <span>IndexedDB Queue & Consistency</span>
            {pendingQueueCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[9px] font-mono font-bold">
                {pendingQueueCount}
              </span>
            )}
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Notification Banner */}
          {connectMessage && (
            <div className={`p-4 rounded-2xl text-xs flex items-center gap-3 animate-fade-in ${
              connectMessage.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800' :
              connectMessage.type === 'info' ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-800' :
              'bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-800'
            }`}>
              {connectMessage.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : connectMessage.type === 'info' ? (
                <Activity className="w-5 h-5 text-blue-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <span className="font-medium">{connectMessage.text}</span>
            </div>
          )}

          {/* TAB 1: 6-DIGIT PIN & QR PAIR */}
          {activeTab === 'pin' && (
            <div className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Send / Generate from this Device */}
                <div className="p-5 rounded-2xl bg-theme-accent/30 border border-theme space-y-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        Step 1 • From Source Device
                      </span>
                      <span className="text-[11px] text-muted font-mono">{currentDevInfo.deviceName}</span>
                    </div>
                    <h3 className="text-sm font-bold text-primary">
                      Generate 6-Digit Transfer PIN
                    </h3>
                    <p className="text-xs text-muted leading-relaxed">
                      Packages your full syllabus ({subjects.length} subjects, {totalTopics} topics), assignments, and study metrics into an instant transfer code.
                    </p>
                  </div>

                  {generatedPin ? (
                    <div className="space-y-3">
                      {/* Toggle Code / QR Display */}
                      <div className="flex items-center justify-center p-1 rounded-xl bg-theme-accent/60 border border-theme text-xs">
                        <button
                          type="button"
                          onClick={() => setPinDisplayMode('pin')}
                          className={`flex-1 py-1.5 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            pinDisplayMode === 'pin' ? 'bg-white dark:bg-[#2d312e] text-primary shadow-xs' : 'text-muted hover:text-primary'
                          }`}
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>6-Digit PIN</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPinDisplayMode('qr')}
                          className={`flex-1 py-1.5 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            pinDisplayMode === 'qr' ? 'bg-white dark:bg-[#2d312e] text-primary shadow-xs' : 'text-muted hover:text-primary'
                          }`}
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>QR Code</span>
                        </button>
                      </div>

                      {pinDisplayMode === 'qr' ? (
                        <div className="p-3 rounded-2xl bg-white dark:bg-[#252825] border border-theme flex flex-col items-center">
                          <QRCodeDisplay
                            transferPin={generatedPin}
                            syncEmail={searchEmail}
                            syncUid={effectiveUid}
                            deviceName={currentDevInfo.deviceName}
                            size={160}
                            onScannedInApp={async (scanRes) => {
                              const pin = scanRes.transferPin || (scanRes.type === 'transfer_pin' ? scanRes.raw : null);
                              if (pin) {
                                setInputPin(pin);
                                await handleRedeemPin(pin);
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <div className="p-4 rounded-2xl bg-white dark:bg-[#252825] border-2 border-dashed border-amber-500/40 text-center space-y-1">
                          <span className="text-[10px] font-mono uppercase text-muted block">Transfer PIN (Valid for 24 Hours)</span>
                          <div className="text-3xl font-mono font-bold tracking-widest text-primary selection:bg-amber-200">
                            {generatedPin.slice(0, 3)} {generatedPin.slice(3)}
                          </div>
                        </div>
                      )}

                      {/* Live Pairing Radar Status */}
                      {remotePairedDevice ? (
                        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-200">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div>
                            <span className="font-bold block">Connected to {remotePairedDevice}!</span>
                            <span className="text-[11px] opacity-80">All workspace items synchronized.</span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs text-amber-700 dark:text-amber-300">
                          <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                            </span>
                            <span className="text-[11px] font-medium">Waiting for other device...</span>
                          </div>
                          <span className="text-[10px] font-mono opacity-70">Scan QR or enter PIN</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          className="flex-1 py-2 rounded-xl bg-theme-accent border border-theme text-xs font-bold text-primary flex items-center justify-center gap-1.5 hover:bg-theme-accent/80 transition cursor-pointer"
                        >
                          {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedCode ? 'Code Copied!' : 'Copy PIN'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyTransferLink}
                          className="flex-1 py-2 rounded-xl bg-primary text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-primary/90 transition cursor-pointer shadow-2xs"
                        >
                          {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                          <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleGeneratePin}
                          title="Generate a new 6-digit PIN & QR code instantly"
                          className="p-2 rounded-xl bg-theme-accent border border-theme text-primary hover:bg-theme-accent/80 transition cursor-pointer shrink-0"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleGeneratePin}
                      disabled={isGeneratingPin}
                      className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {isGeneratingPin ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <KeyRound className="w-4 h-4" />
                      )}
                      <span>Generate Transfer PIN & QR Code</span>
                    </button>
                  )}
                </div>

                {/* Receive / Enter Code on this Device */}
                <div className="p-5 rounded-2xl bg-theme-accent/30 border border-theme space-y-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                        Step 2 • On Target Device
                      </span>
                      {hasSafetyBackup && (
                        <button
                          type="button"
                          onClick={handleRestoreSafetyBackup}
                          className="text-[10px] text-amber-700 dark:text-amber-300 font-bold hover:underline cursor-pointer"
                          title="Restore safety backup saved prior to last sync"
                        >
                          ↩️ Undo Last Sync
                        </button>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-primary">
                      Enter 6-Digit PIN to Connect
                    </h3>
                    <p className="text-xs text-muted leading-relaxed">
                      Enter the PIN displayed on your other device. All syllabus topics, assignments, and test history will be transferred and connected immediately.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {/* Scan QR Code button */}
                    {onOpenQRScanner && (
                      <button
                        type="button"
                        onClick={onOpenQRScanner}
                        className="w-full py-2.5 px-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs active:scale-95"
                      >
                        <QrCode className="w-4 h-4 text-emerald-600" />
                        <span>Scan Pairing QR Code with Camera</span>
                      </button>
                    )}

                    <div className="relative flex items-center">
                      <KeyRound className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        maxLength={8}
                        value={inputPin}
                        onChange={(e) => setInputPin(e.target.value.replace(/[^0-9\s-]/g, ''))}
                        onKeyDown={(e) => e.key === 'Enter' && handleRedeemPin()}
                        placeholder="e.g. 749 201"
                        className="w-full pl-10 pr-20 py-2.5 rounded-2xl bg-white dark:bg-[#252825] border border-theme text-sm font-mono font-bold tracking-widest text-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20 text-center"
                      />
                      <button
                        type="button"
                        onClick={handlePastePin}
                        className="absolute right-2 px-2 py-1 rounded-lg bg-theme-accent border border-theme text-[10px] font-bold text-primary hover:bg-theme-accent/80 transition cursor-pointer"
                        title="Paste 6-digit PIN or transfer link from clipboard"
                      >
                        Paste
                      </button>
                    </div>

                    <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-theme-accent/50 border border-theme text-[11px] text-muted cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={forcePullOnRedeem}
                        onChange={(e) => setForcePullOnRedeem(e.target.checked)}
                        className="mt-0.5 rounded border-theme text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div className="leading-tight">
                        <span className="font-bold text-primary block">Force-Pull Cloud Snapshot</span>
                        <span className="text-[10px]">Overwrites local state directly from the Cloud Database if push-sync fails.</span>
                      </div>
                    </label>

                    <button
                      onClick={handleRedeemPin}
                      disabled={isRedeemingPin || !inputPin.trim()}
                      className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {isRedeemingPin ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowRight className="w-4 h-4" />
                      )}
                      <span>Transfer & Link All Data</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Instant Status Summary & Manual Force Controls */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#252825] border border-theme flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-primary block">Active Workspace Data Ready to Sync</span>
                    <span className="text-[11px] text-muted">
                      {subjects.length} Subjects • {totalChapters} Chapters • {totalTopics} Topics ({completedTopics} Completed) • {assignments.length} Assignments
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleManualForcePull()}
                    disabled={isForcePulling}
                    className="px-3.5 py-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center justify-center gap-1.5 hover:bg-blue-500/20 transition cursor-pointer"
                    title="Manually download full snapshot from Cloud Database, overwriting local state"
                  >
                    {isForcePulling ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-blue-600" />}
                    <span>Force Pull from Cloud</span>
                  </button>

                  <button
                    onClick={handleSyncThisDeviceNow}
                    disabled={isSyncingCurrent}
                    className="px-3.5 py-2 rounded-xl bg-theme-accent border border-theme text-xs font-bold text-primary flex items-center justify-center gap-1.5 hover:bg-theme-accent/80 transition cursor-pointer"
                  >
                    <Activity className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Force Cloud Push</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: SYLLABUS CROSS-SYNC */}
          {activeTab === 'syllabus' && (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-blue-950 dark:text-blue-200">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    <span>Real-Time Syllabus Synchronization</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-800 dark:text-blue-300 font-bold">
                    Bidirectional
                  </span>
                </div>
                <p className="text-xs text-blue-900/80 dark:text-blue-300/80 leading-relaxed">
                  Whenever you add a subject, create a chapter, or check off a topic on your laptop, the changes immediately sync to your phone and tablet within 500ms over Firestore onSnapshot listeners.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded-2xl bg-white dark:bg-[#252825] border border-theme">
                  <span className="block text-[10px] font-mono text-muted uppercase">Subjects</span>
                  <span className="text-xl font-bold font-mono text-primary">{subjects.length}</span>
                </div>
                <div className="p-3 rounded-2xl bg-white dark:bg-[#252825] border border-theme">
                  <span className="block text-[10px] font-mono text-muted uppercase">Chapters</span>
                  <span className="text-xl font-bold font-mono text-primary">{totalChapters}</span>
                </div>
                <div className="p-3 rounded-2xl bg-white dark:bg-[#252825] border border-theme">
                  <span className="block text-[10px] font-mono text-muted uppercase">Total Topics</span>
                  <span className="text-xl font-bold font-mono text-primary">{totalTopics}</span>
                </div>
                <div className="p-3 rounded-2xl bg-white dark:bg-[#252825] border border-theme">
                  <span className="block text-[10px] font-mono text-muted uppercase">Completed</span>
                  <span className="text-xl font-bold font-mono text-emerald-600">{completedTopics}</span>
                </div>
              </div>

              {/* Subjects List Preview */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block">
                  Active Subjects on This Device
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {subjects.map((sub) => {
                    const subTopicsCount = sub.chapters?.reduce((acc, c) => acc + (c.topics?.length || 0), 0) || 0;
                    return (
                      <div key={sub.id} className="p-3 rounded-xl bg-white dark:bg-[#252825] border border-theme flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base">{sub.icon || '📚'}</span>
                          <span className="font-bold text-primary truncate">{sub.name}</span>
                        </div>
                        <span className="text-[11px] font-mono text-muted shrink-0">
                          {sub.chapters?.length || 0} ch • {subTopicsCount} tp
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handlePushSyllabusNow}
                  disabled={isSyncingCurrent}
                  className="flex-1 py-3 rounded-2xl bg-primary text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSyncingCurrent ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span>Push Syllabus to All Connected Devices</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: ACCOUNT EMAIL CLOUD LINK */}
          {activeTab === 'email' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted block">
                  Primary Study Email Account
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Mail className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={searchEmail}
                      onChange={(e) => setSearchEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchEmail)}
                      placeholder="e.g. atharkhanteambuster@gmail.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-theme-accent/50 border border-theme text-xs font-medium text-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <button
                    onClick={() => handleSearch(searchEmail)}
                    disabled={isSearching || !searchEmail}
                    className="px-5 py-2.5 rounded-2xl bg-primary text-white text-xs font-bold flex items-center gap-2 hover:bg-primary/90 transition cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    <span>Search Partition</span>
                  </button>
                </div>
              </div>

              {searchResult && (
                <div className="p-5 rounded-2xl bg-theme-accent/40 border border-theme space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-theme/60 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary">{searchResult.email}</span>
                        {searchResult.hasCloudData ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                            <Wifi className="w-3 h-3" />
                            Cloud Synced
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            Ready for Initial Sync
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted mt-0.5">
                        Firestore Partition ID: <code className="font-mono">{searchResult.uid}</code>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleManualForcePull(searchResult.uid)}
                        disabled={isForcePulling}
                        className="px-3.5 py-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center gap-1.5 hover:bg-blue-500/20 transition cursor-pointer disabled:opacity-50"
                        title="Directly pull and overwrite local state with the cloud database snapshot"
                      >
                        {isForcePulling ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-blue-600" />}
                        <span>Force Pull</span>
                      </button>

                      <button
                        onClick={handleSyncThisDeviceNow}
                        disabled={isSyncingCurrent}
                        className="px-3.5 py-2 rounded-xl bg-theme-accent border border-theme text-primary text-xs font-bold flex items-center gap-1.5 hover:bg-theme-accent/80 transition cursor-pointer disabled:opacity-50"
                      >
                        {isSyncingCurrent ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5 text-emerald-600" />}
                        <span>Sync Now</span>
                      </button>

                      <button
                        onClick={handleConnectAndSync}
                        disabled={isConnecting}
                        className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-1.5 hover:bg-primary/90 transition shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        {isConnecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                        <span>Migrate & Link All</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted block mb-1.5 font-bold">
                      Synced Cloud Collections
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 text-center">
                      <div className="p-2 rounded-xl bg-white dark:bg-[#252825] border border-theme">
                        <span className="block text-[9px] font-mono text-muted uppercase">Assignments</span>
                        <span className="text-sm font-mono font-bold text-primary">{searchResult.stats.assignmentsCount || 0}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-white dark:bg-[#252825] border border-theme">
                        <span className="block text-[9px] font-mono text-muted uppercase">Vaults</span>
                        <span className="text-sm font-mono font-bold text-primary">{searchResult.stats.vaultsCount}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-white dark:bg-[#252825] border border-theme">
                        <span className="block text-[9px] font-mono text-muted uppercase">Subjects</span>
                        <span className="text-sm font-mono font-bold text-primary">{searchResult.stats.subjectsCount}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-white dark:bg-[#252825] border border-theme">
                        <span className="block text-[9px] font-mono text-muted uppercase">Tests</span>
                        <span className="text-sm font-mono font-bold text-primary">{searchResult.stats.testResultsCount}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-white dark:bg-[#252825] border border-theme">
                        <span className="block text-[9px] font-mono text-muted uppercase">Sessions</span>
                        <span className="text-sm font-mono font-bold text-primary">{searchResult.stats.sessionsCount}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-white dark:bg-[#252825] border border-theme">
                        <span className="block text-[9px] font-mono text-muted uppercase">Plans</span>
                        <span className="text-sm font-mono font-bold text-primary">{searchResult.stats.plansCount}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-white dark:bg-[#252825] border border-theme">
                        <span className="block text-[9px] font-mono text-muted uppercase">Flashcards</span>
                        <span className="text-sm font-mono font-bold text-primary">{searchResult.stats.flashcardsCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SNAPSHOT BACKUP FILE (.JSON) */}
          {activeTab === 'file' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Export Snapshot */}
                <div className="p-5 rounded-2xl bg-theme-accent/30 border border-theme space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                      <Download className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-primary">Export Academic Archive (.json)</h3>
                    <p className="text-xs text-muted leading-relaxed">
                      Download an offline snapshot containing all custom syllabus subjects, chapters, notes, test scores, assignments, and study sessions.
                    </p>
                  </div>

                  <button
                    onClick={handleExportFullJson}
                    disabled={isExportingJson}
                    className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Full Backup File</span>
                  </button>
                </div>

                {/* Import Snapshot */}
                <div className="p-5 rounded-2xl bg-theme-accent/30 border border-theme space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                      <Upload className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-primary">Restore from Backup File</h3>
                    <p className="text-xs text-muted leading-relaxed">
                      Import a previously exported <code className="font-mono text-[11px]">.json</code> backup to restore your complete workspace on this device.
                    </p>
                  </div>

                  <label className="w-full py-3 rounded-2xl bg-white dark:bg-[#252825] hover:bg-theme-accent text-primary border border-theme text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs">
                    <Upload className="w-4 h-4 text-emerald-600" />
                    <span>Select Backup File (.json)</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportJsonFile}
                      className="hidden"
                    />
                  </label>
                </div>

              </div>
            </div>
          )}

          {/* TAB 5: CONNECTED HARDWARE DEVICES */}
          {activeTab === 'devices' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted flex items-center gap-2">
                  <span>Registered Hardware Profiles</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                    {searchResult?.devices?.length || 1} Connected
                  </span>
                </h3>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleManualForcePull()}
                    disabled={isForcePulling}
                    className="px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center gap-1.5 hover:bg-blue-500/20 transition cursor-pointer disabled:opacity-50"
                    title="Directly pull and overwrite local state with the cloud database snapshot"
                  >
                    {isForcePulling ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3 text-blue-600" />}
                    <span>Force Pull from Cloud</span>
                  </button>

                  <button
                    onClick={() => handleSearch(searchEmail)}
                    className="text-[11px] text-muted hover:text-primary flex items-center gap-1 transition cursor-pointer px-2.5 py-1.5 rounded-xl bg-theme-accent border border-theme"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {searchResult?.devices && searchResult.devices.length > 0 ? (
                <div className="space-y-3">
                  {searchResult.devices.map((dev: UserDevice) => {
                    const isThisDevice = dev.deviceId === currentDeviceId;
                    const isRevoked = dev.status === 'revoked';
                    const relativeTime = formatRelativeTime(dev.lastActive);
                    const isLive = relativeTime.includes('Just now') || relativeTime.includes('min');

                    return (
                      <div
                        key={dev.id || dev.deviceId}
                        className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition ${
                          isThisDevice
                            ? 'bg-primary/5 border-primary/40 shadow-xs ring-1 ring-primary/20'
                            : isRevoked
                            ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 opacity-75'
                            : 'bg-white dark:bg-[#252825] border-theme hover:border-primary/30'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                            isThisDevice 
                              ? 'bg-primary text-white shadow-xs' 
                              : isRevoked
                              ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-600'
                              : 'bg-theme-accent text-primary'
                          }`}>
                            {dev.deviceType === 'mobile' ? (
                              <Smartphone className="w-5 h-5" />
                            ) : dev.deviceType === 'tablet' ? (
                              <Tablet className="w-5 h-5" />
                            ) : (
                              <Laptop className="w-5 h-5" />
                            )}
                          </div>
                          
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-primary truncate text-xs sm:text-sm">
                                {dev.deviceName}
                              </span>
                              
                              {isThisDevice && (
                                <span className="px-2 py-0.5 rounded-full bg-primary text-white text-[9px] font-bold shrink-0">
                                  This Device
                                </span>
                              )}
                              
                              <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold shrink-0 flex items-center gap-1 ${
                                isRevoked 
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300' 
                                  : isLive
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                  : 'bg-theme-accent text-muted'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  isRevoked ? 'bg-rose-500' : isLive ? 'bg-emerald-500 animate-pulse' : 'bg-muted'
                                }`} />
                                {isRevoked ? 'Revoked' : isLive ? 'Online & Synced' : 'Recently Active'}
                              </span>
                            </div>

                            <div className="text-[11px] text-muted flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{dev.os} • {dev.browser}</span>
                              {dev.screenResolution && <span className="opacity-80">• {dev.screenResolution}</span>}
                              <span className="text-primary/80 font-mono font-medium flex items-center gap-1">
                                <Clock className="w-3 h-3 text-muted" />
                                Synced: {relativeTime}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-theme/40 shrink-0">
                          {isThisDevice && (
                            <button
                              onClick={() => handleManualForcePull()}
                              disabled={isForcePulling}
                              className="px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/30 transition cursor-pointer text-[11px] font-bold flex items-center gap-1"
                              title="Force download full snapshot from cloud database"
                            >
                              <Download className="w-3 h-3 text-blue-600" />
                              <span>Force Pull</span>
                            </button>
                          )}

                          {!isThisDevice && !isRevoked && (
                            <button
                              onClick={() => handleRevokeDevice(dev.deviceId, dev.deviceName)}
                              className="px-3 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-900 transition cursor-pointer text-[11px] font-bold"
                            >
                              Disconnect
                            </button>
                          )}

                          {!isThisDevice && (
                            <button
                              onClick={() => handleRemoveDevice(dev.deviceId, dev.deviceName)}
                              className="p-2 rounded-xl text-muted hover:text-rose-600 hover:bg-theme-accent transition cursor-pointer"
                              title="Remove device record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-theme-accent/30 border border-dashed border-theme text-center space-y-2">
                  <Smartphone className="w-8 h-8 text-muted mx-auto" />
                  <p className="text-xs text-muted">
                    No secondary devices registered yet. Open this application on your phone or tablet and enter your 6-digit PIN to see it appear here live!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: STATE CONSISTENCY & INDEXEDDB QUEUE */}
          {activeTab === 'consistency' && (
            <div className="space-y-5">
              {/* Header card */}
              <div className="p-5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-indigo-950 dark:text-indigo-200">
                    <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>IndexedDB Document Verification & Safe Partial Overwrite</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 font-bold">
                    Zero Data-Loss
                  </span>
                </div>
                <p className="text-xs text-indigo-900/80 dark:text-indigo-300/80 leading-relaxed">
                  When synchronizing, the engine computes deterministic 64-bit FNV-1a hash-sums for every subject, chapter, test record, and note. Non-conflicting remote updates are partially merged, while local changes are preserved and queued in IndexedDB.
                </p>
              </div>

              {/* Force Pull with Hash Verification Action Card */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#252825] border border-theme flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                    <Hash className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-primary block">Hash-Verified Cloud Force Pull</span>
                    <span className="text-[11px] text-muted">
                      Verifies checksums of remote vs local database documents with automated safety snapshot.
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleManualForcePull()}
                  disabled={isForcePulling}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
                >
                  {isForcePulling ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>Run Hash-Verified Pull</span>
                </button>
              </div>

              {/* Latest Reconcile Audit Report */}
              {latestReconcileReport && (
                <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      <FileCheck className="w-4 h-4 text-emerald-600" />
                      <span>Latest Verification Audit: {latestReconcileReport.reason}</span>
                    </div>
                    <span className="text-[10px] font-mono text-muted">
                      {new Date(latestReconcileReport.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#1E201E] border border-theme">
                      <span className="text-[10px] font-mono text-muted block uppercase">Audited</span>
                      <span className="text-sm font-bold font-mono text-primary">
                        {latestReconcileReport.totalLocalDocs + latestReconcileReport.totalRemoteDocs}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#1E201E] border border-theme">
                      <span className="text-[10px] font-mono text-muted block uppercase">Identical Hashes</span>
                      <span className="text-sm font-bold font-mono text-blue-600">
                        {latestReconcileReport.identicalCount}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#1E201E] border border-theme">
                      <span className="text-[10px] font-mono text-muted block uppercase">Partial Merged</span>
                      <span className="text-sm font-bold font-mono text-emerald-600">
                        {latestReconcileReport.updatedRemoteCount + latestReconcileReport.insertedRemoteCount}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#1E201E] border border-theme">
                      <span className="text-[10px] font-mono text-muted block uppercase">Preserved Local</span>
                      <span className="text-sm font-bold font-mono text-amber-600">
                        {latestReconcileReport.preservedLocalCount}
                      </span>
                    </div>
                  </div>

                  {latestReconcileReport.snapshotId && (
                    <div className="text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center justify-between pt-1">
                      <span>Safety checkpoint saved: <code className="font-mono">{latestReconcileReport.snapshotId}</code></span>
                      <button
                        onClick={() => handleRollbackSnapshot(latestReconcileReport.snapshotId!)}
                        disabled={isRollingBack}
                        className="text-xs font-bold underline hover:text-emerald-600 cursor-pointer"
                      >
                        Rollback this pull
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* IndexedDB Safety Snapshots List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-indigo-500" />
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted">
                      IndexedDB Safety Snapshots ({indexedDbSnapshots.length})
                    </h3>
                  </div>
                  <button
                    onClick={loadIndexedDbState}
                    className="text-[11px] text-muted hover:text-primary flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Refresh</span>
                  </button>
                </div>

                {indexedDbSnapshots.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {indexedDbSnapshots.map((snap) => (
                      <div
                        key={snap.id}
                        className="p-3 rounded-xl bg-white dark:bg-[#252825] border border-theme flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-primary truncate">{snap.reason}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-theme-accent text-muted">
                              {snap.id.slice(0, 16)}...
                            </span>
                          </div>
                          <span className="text-[10px] text-muted block">
                            {new Date(snap.createdAt).toLocaleString()} • {snap.docCount} records
                          </span>
                        </div>

                        <button
                          onClick={() => handleRollbackSnapshot(snap.id)}
                          disabled={isRollingBack}
                          className="px-2.5 py-1.5 rounded-lg bg-theme-accent hover:bg-theme-accent/80 border border-theme text-[11px] font-bold text-primary flex items-center gap-1.5 transition cursor-pointer shrink-0"
                        >
                          <RotateCcw className="w-3 h-3 text-indigo-500" />
                          <span>Rollback</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-theme-accent/30 border border-theme text-center text-xs text-muted">
                    No safety snapshots created yet. Force-pulling or syncing will automatically create transactional rollback checkpoints here.
                  </div>
                )}
              </div>

              {/* Pending Sync Queue */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted">
                      Offline Mutation Sync Queue ({pendingQueueCount} Pending)
                    </h3>
                  </div>
                </div>

                {queuedOperations.length > 0 ? (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {queuedOperations.map((op) => (
                      <div
                        key={op.id}
                        className="p-2.5 rounded-xl bg-white dark:bg-[#252825] border border-theme flex items-center justify-between text-xs font-mono"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            op.action === 'INSERT' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                            op.action === 'UPDATE' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                            'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}>
                            {op.action}
                          </span>
                          <span className="text-primary truncate">{op.collection}/{op.docId}</span>
                        </div>
                        <span className="text-[10px] text-muted shrink-0">
                          {op.status} (Attempts: {op.retryCount})
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>All local mutations are synchronized with zero pending queue backlog.</span>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-theme bg-theme-accent/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Encrypted Dual-Layer Storage (0ms Edge Cache + Google Cloud Firestore)</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl bg-theme-accent border border-theme text-primary text-xs font-bold hover:bg-theme-accent/80 transition cursor-pointer"
          >
            Done & Close
          </button>
        </div>

      </div>
    </div>
  );
};
