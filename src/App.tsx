/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './lib/firebase';
import { 
  subscribeUserProfile, 
  subscribeSyllabus, 
  subscribeStudySessions, 
  subscribeStudyPlans, 
  subscribeTestResults, 
  subscribeActivityLogs, 
  subscribeRevisions,
  subscribeStudyGroups,
  subscribeFlashcardDecks,
  subscribeVaults,
  subscribeScheduledTasks,
  subscribeChatHistory,
  subscribeMockExams,
  subscribeAssignments,
  saveAssignmentToDb,
  deleteAssignmentFromDb,
  subscribeMissedWork,
  saveMissedWorkItemToDb,
  saveAllMissedWorkToDb,
  deleteMissedWorkItemFromDb,
  saveVaultToDb,
  updateVaultInDb,
  deleteVaultFromDb,
  saveSyllabusToDb,
  addStudySessionToDb,
  addActivityLogToDb,
  saveStudyPlanToDb,
  updateStudyPlanInDb,
  addTestResultToDb,
  updateTestResultInDb,
  deleteTestResultFromDb,
  saveUserProfileToDb,
  saveStudyGroupToDb,
  createStudyGroupInDb,
  deleteStudyGroupFromDb,
  saveRevisionsToDb,
  saveFlashcardDeckToDb,
  deleteFlashcardDeckFromDb,
  loadAllDataFromLocal,
  saveLocalState,
  cacheAllDataLocally,
  forceSyncAllToCloud,
  resolveActiveUserId,
  setActiveUserEmail,
  getActiveUserEmail,
  clearActiveUserEmail,
  getPairedSyncUid,
  setPairedSyncUid,
  clearPairedSyncUid
} from './lib/db';
import { 
  registerCurrentDevice, 
  subscribeUserDevices, 
  getOrCreateDeviceId,
  redeemTransferPin,
  updateDeviceHeartbeat 
} from './lib/deviceService';
import { 
  subscribeToSyncBroadcast, 
  savePreSyncSafetyBackup, 
  getPreSyncSafetyBackup 
} from './lib/syncChannel';
import { 
  liveSync, 
  LiveConnectionState 
} from './lib/liveSyncService';

import { 
  Subject, 
  StudySession, 
  StudyPlan, 
  TestResult, 
  StorageVault,
  UserNote,
  ActivityLog, 
  RevisionItem, 
  UserProfile, 
  ActiveTab,
  StudyGroup,
  TopicStatus,
  TopicCompletionStatus,
  FlashcardDeck,
  ThemeConfig,
  ThemeMode,
  Assignment,
  MissedWorkItem,
  StudyRPGProfile
} from './types';
import { evaluateAndSyncMissedWork, deduplicateMissedWork } from './lib/missedWorkService';

import { DEFAULT_SYLLABUS } from './data/defaultSyllabus';
import { DEFAULT_STUDY_GROUPS } from './data/defaultGroups';
import { DEFAULT_FLASHCARD_DECKS } from './data/defaultFlashcards';
import { DEFAULT_STORAGE_VAULTS } from './data/defaultVaults';
import { DEFAULT_ASSIGNMENTS } from './data/defaultAssignments';

import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { OfflineNotification } from './components/OfflineNotification';
import { DashboardView } from './components/DashboardView';
import { MissedWorkView } from './components/MissedWorkView';
import { AssignmentsView } from './components/AssignmentsView';
import { ClassroomCourseView } from './components/ClassroomCourseView';
import { SyllabusView } from './components/SyllabusView';
import { PlannerView } from './components/PlannerView';
import { StudyGroupsView } from './components/StudyGroupsView';
import { FlashcardsView } from './components/FlashcardsView';
import { BlurtRecallView } from './components/BlurtRecallView';
import { StudyTimerView } from './components/StudyTimerView';
import { CalendarView } from './components/CalendarView';
import { ProgressView } from './components/ProgressView';
import { RevisionView } from './components/RevisionView';
import { TestsView } from './components/TestsView';
import { VaultsView } from './components/VaultsView';
import { ActivityView } from './components/ActivityView';
import { AITutorView } from './components/AITutorView';
import { SettingsView } from './components/SettingsView';
import { GamificationView } from './components/GamificationView';
import { VirtualStudyRoomView } from './components/VirtualStudyRoomView';
import { WhatsAppAssistantModal } from './components/WhatsAppAssistantModal';
import { VoiceFeynmanOralExamModal } from './components/VoiceFeynmanOralExamModal';
import { KnowledgeTreeModal } from './components/KnowledgeTreeModal';
import { PredictiveGradeSimulatorModal } from './components/PredictiveGradeSimulatorModal';
import { ExamAutomationCenterModal } from './components/ExamAutomationCenterModal';
import { loadLocalNotificationSettings, syncNotificationConfigToServer } from './lib/notificationService';
import { checkAndTriggerPushNotifications, setupPushActionListener } from './lib/pushNotificationManager';
import { detectCalendarReschedules, applyCalendarReschedules, CalendarRescheduleItem } from './lib/googleCalendarService';
import { OfflineIndicator } from './components/OfflineIndicator';
import { EmailAgendaModal } from './components/EmailAgendaModal';
import { GoogleWorkspaceHubModal } from './components/GoogleWorkspaceHubModal';
import { AIMaterialImportModal } from './components/AIMaterialImportModal';
import { PrintableStudyKitModal } from './components/PrintableStudyKitModal';
import { AudioStudyModal } from './components/AudioStudyModal';
import { ZenStudySprintModal } from './components/ZenStudySprintModal';
import { AICheatSheetGeneratorModal } from './components/AICheatSheetGeneratorModal';
import { CommandPalette } from './components/CommandPalette';
import { EditYearProfileModal } from './components/EditYearProfileModal';
import { DeviceEmailSyncModal } from './components/DeviceEmailSyncModal';
import { ExaminersRedPenView } from './components/ExaminersRedPenView';
import { MistakeVaultView } from './components/MistakeVaultView';
import { GeminiNotebookHub } from './components/GeminiNotebookHub';
import { ExamBossBattleView } from './components/ExamBossBattleView';
import { KnowledgeGraphExplorerView } from './components/KnowledgeGraphExplorerView';
import { DataPortabilityView } from './components/DataPortabilityView';
import { KnowledgeRefurbishmentView } from './components/KnowledgeRefurbishmentView';
import { MarksRecoveryEngineView } from './components/MarksRecoveryEngineView';
import { PaperAutoForcingView } from './components/PaperAutoForcingView';
import { getSavedLanguage, saveLanguagePreference, AppLanguage } from './lib/translations';
import { addMistake } from './lib/mistakeVaultStorage';
import { triggerServerAutonomousPushTest } from './lib/pushNotificationManager';
import { InAppQRScannerModal } from './components/InAppQRScannerModal';
import { ParsedQRResult } from './components/InAppQRScanner';
import { SyncInspectorModal, SyncInspectorDetails } from './components/SyncInspectorModal';
import { BackupRestoreModal } from './components/BackupRestoreModal';
import { 
  loadRPGProfile, 
  saveRPGProfile, 
  awardQuestProgress, 
  awardXPAndGems 
} from './lib/rpgEngine';
import { 
  getMorningBriefingConfig, 
  saveMorningBriefingConfig, 
  sendDailyAgendaEmail, 
  getCachedGmailToken,
  MorningBriefingLogItem,
  checkAndTriggerAutomatedBriefing,
  dispatchMorningBriefingNow,
  subscribeBriefingWorkerStatus,
  BriefingWorkerState
} from './lib/gmailService';
import { 
  initializeTheme, 
  saveThemeConfig, 
  getStoredThemeConfig, 
  applyThemeToDOM 
} from './lib/themeService';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isEmailAgendaModalOpen, setIsEmailAgendaModalOpen] = useState(false);
  const [isExamAutomationModalOpen, setIsExamAutomationModalOpen] = useState(false);
  const [isWorkspaceHubOpen, setIsWorkspaceHubOpen] = useState(false);
  const [isMaterialImportModalOpen, setIsMaterialImportModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | undefined>(undefined);
  const [isDeviceSyncModalOpen, setIsDeviceSyncModalOpen] = useState(false);
  const [isQRScannerModalOpen, setIsQRScannerModalOpen] = useState(false);
  const [isPrintKitModalOpen, setIsPrintKitModalOpen] = useState(false);
  const [isAudioStudyModalOpen, setIsAudioStudyModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isVoiceFeynmanModalOpen, setIsVoiceFeynmanModalOpen] = useState(false);
  const [isKnowledgeTreeModalOpen, setIsKnowledgeTreeModalOpen] = useState(false);
  const [isPredictiveGradeModalOpen, setIsPredictiveGradeModalOpen] = useState(false);
  const [feynmanInitialSubject, setFeynmanInitialSubject] = useState<string | undefined>(undefined);
  const [feynmanInitialConcept, setFeynmanInitialConcept] = useState<string | undefined>(undefined);
  const [rpgProfile, setRpgProfile] = useState<StudyRPGProfile>(() => loadRPGProfile());
  const [audioStudyInitialDeckId, setAudioStudyInitialDeckId] = useState<string | undefined>(undefined);
  const [audioStudyInitialMode, setAudioStudyInitialMode] = useState<'voice_flashcards' | 'audio_podcast'>('voice_flashcards');
  const [workspaceHubTab, setWorkspaceHubTab] = useState<'classroom' | 'docs' | 'meet' | 'tasks' | 'calendar' | 'drive' | 'keep'>('classroom');
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [actionBanner, setActionBanner] = useState<{ 
    message: string; 
    type: 'success' | 'info' | 'error';
    showInspectorBtn?: boolean;
  } | null>(null);
  const [isSyncInspectorOpen, setIsSyncInspectorOpen] = useState(false);
  const [isBackupRestoreModalOpen, setIsBackupRestoreModalOpen] = useState(false);
  const [lastSyncDetails, setLastSyncDetails] = useState<SyncInspectorDetails | null>(() => {
    try {
      const saved = localStorage.getItem('prepforge_last_sync_details');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [briefingWorkerState, setBriefingWorkerState] = useState<BriefingWorkerState | null>(null);

  // System Theme & Appearance State
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(() => getStoredThemeConfig());

  // Firestore & local state
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>(DEFAULT_SYLLABUS);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [vaults, setVaults] = useState<StorageVault[]>(DEFAULT_STORAGE_VAULTS);
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [revisions, setRevisions] = useState<RevisionItem[]>([]);
  const [groups, setGroups] = useState<StudyGroup[]>(DEFAULT_STUDY_GROUPS);
  const [flashcardDecks, setFlashcardDecks] = useState<FlashcardDeck[]>(DEFAULT_FLASHCARD_DECKS);
  const [assignments, setAssignments] = useState<Assignment[]>(DEFAULT_ASSIGNMENTS);
  const [missedWork, setMissedWork] = useState<MissedWorkItem[]>([]);

  // Timer pre-selection state
  const [timerTopic, setTimerTopic] = useState<{ subject?: string; chapter?: string; topic?: string }>({});

  // Blurt Recall pre-selection state
  const [blurtInitialTopic, setBlurtInitialTopic] = useState<{ subjectName: string; chapterName?: string; topicName: string } | null>(null);

  const handleStartBlurtForTopic = (subjectName: string, chapterName: string, topicName: string) => {
    setBlurtInitialTopic({ subjectName, chapterName, topicName });
    setActiveTab('blurt_recall');
  };

  // Tutor prompt pre-fill
  const [tutorPrompt, setTutorPrompt] = useState<string>('');

  // Zen Sprint & AI Cheat Sheet modal states (Options 1 & 6)
  const [isZenSprintModalOpen, setIsZenSprintModalOpen] = useState(false);
  const [zenSprintTopic, setZenSprintTopic] = useState<{ subject?: string; topic?: string }>({});

  const [isCheatSheetModalOpen, setIsCheatSheetModalOpen] = useState(false);
  const [cheatSheetTopic, setCheatSheetTopic] = useState<{ subject?: string; topic?: string }>({});

  // Active cross-device email key
  const [activeEmail, setActiveEmail] = useState<string>(() => getActiveUserEmail());

  // Language state (en / ur)
  const [userLanguage, setUserLanguage] = useState<AppLanguage>(() => getSavedLanguage());

  const handleToggleLanguage = (newLang: AppLanguage) => {
    setUserLanguage(newLang);
    saveLanguagePreference(newLang);
  };

  useEffect(() => {
    const saved = getSavedLanguage();
    saveLanguagePreference(saved);
  }, []);

  // Real-time live sync state & peer count
  const [livePeerCount, setLivePeerCount] = useState<number>(0);
  const [liveSyncState, setLiveSyncState] = useState<LiveConnectionState>('disconnected');

  // Paired device UID override (from PIN / QR scan)
  const [pairedSyncUid, setPairedSyncUidState] = useState<string>(() => getPairedSyncUid());

  // Calculate dynamic effective user ID for the current authenticated user or isolated guest
  const effectiveUid = pairedSyncUid || resolveActiveUserId(user, activeEmail || userProfile?.email || null);

  // Listen for paired UID changes across window/tabs
  useEffect(() => {
    const handlePairedUidChanged = (e: any) => {
      const newUid = e?.detail?.uid || getPairedSyncUid();
      setPairedSyncUidState(newUid || '');
    };
    window.addEventListener('prepforge:paired_uid_changed', handlePairedUidChanged);
    return () => {
      window.removeEventListener('prepforge:paired_uid_changed', handlePairedUidChanged);
    };
  }, []);

  // Initialize theme system on initial mount
  useEffect(() => {
    const activeTheme = initializeTheme();
    setThemeConfig(activeTheme);
  }, []);

  // 24/7 Automated Exam Countdown & Syllabus Scheduler Sync
  useEffect(() => {
    const email = userProfile?.email || 'atharkhanteambuster@gmail.com';
    const settings = loadLocalNotificationSettings();
    if (email && !settings.email) {
      settings.email = email;
    }
    syncNotificationConfigToServer(
      settings,
      userProfile?.examDates || [],
      subjects,
      revisions
    );
  }, [userProfile?.email, userProfile?.examDates, subjects, revisions]);

  // Active Client-Side Native Web Push & Milestone Chime Scheduler
  useEffect(() => {
    const checkPush = () => {
      const settings = loadLocalNotificationSettings();
      if (settings.pushEnabled) {
        checkAndTriggerPushNotifications({
          settings,
          examDates: userProfile?.examDates || [],
          assignments,
          missedWork,
          plans
        });
      }
    };

    // Check after 2 seconds on app boot, then periodically every 60 seconds
    const bootTimer = setTimeout(checkPush, 2000);
    const interval = setInterval(checkPush, 60000);
    return () => {
      clearTimeout(bootTimer);
      clearInterval(interval);
    };
  }, [userProfile?.examDates, assignments, missedWork, plans]);

  // Listen for Service Worker background push action clicks ([Start 25m Timer], [Mark Done])
  useEffect(() => {
    const unsubscribe = setupPushActionListener((action, data) => {
      console.log('[App] Received push notification action:', action, data);
      if (action === 'start-timer') {
        setActiveTab('timer');
        if (data?.subject || data?.topic) {
          setTimerTopic({ subject: data.subject, topic: data.topic });
        }
        setActionBanner({
          message: '⏱️ Started 25-minute Pomodoro focus session from push notification!',
          type: 'info'
        });
      } else if (action === 'mark-done') {
        const uid = resolveActiveUserId(user);
        setRevisions(prev => {
          const pendingIdx = prev.findIndex(r => r.status !== 'Completed');
          if (pendingIdx !== -1) {
            const copy = [...prev];
            const item = copy[pendingIdx];
            copy[pendingIdx] = { ...item, status: 'Completed' };
            saveRevisionsToDb(uid, copy).catch(console.error);
            setActionBanner({
              message: `✅ "${item.topicName || item.subjectName}" marked completed from notification! Streak preserved.`,
              type: 'success'
            });
            return copy;
          }
          return prev;
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  // Detected external Google Calendar reschedules
  const [calendarReschedules, setCalendarReschedules] = useState<CalendarRescheduleItem[]>([]);

  const handleDetectCalendarReschedules = async () => {
    try {
      const detected = await detectCalendarReschedules(plans);
      setCalendarReschedules(detected);
      if (detected.length > 0) {
        setActionBanner({
          message: `📅 Detected ${detected.length} rescheduled study block(s) in your Google Calendar!`,
          type: 'info'
        });
      } else {
        setActionBanner({
          message: '📅 All StudyFlow plans are perfectly synchronized with your Google Calendar.',
          type: 'success'
        });
      }
    } catch (e: any) {
      console.warn('Calendar reschedule detection failed:', e);
    }
  };

  const handleApplyCalendarReschedules = async () => {
    if (calendarReschedules.length === 0) return;
    const uid = resolveActiveUserId(user);
    const updatedPlans = applyCalendarReschedules(plans, calendarReschedules);
    setPlans(updatedPlans);
    for (const p of updatedPlans) {
      await updateStudyPlanInDb(uid, p.id, p);
    }
    setActionBanner({
      message: `✅ Applied ${calendarReschedules.length} rescheduled time(s) from Google Calendar to your StudyFlow plans!`,
      type: 'success'
    });
    setCalendarReschedules([]);
  };

  const handleUpdateTheme = (updated: Partial<ThemeConfig>) => {
    const resolvedPalette = updated.palette || updated.preset || themeConfig.palette || themeConfig.preset || 'natural_ethos';
    const newConfig: ThemeConfig = {
      ...themeConfig,
      ...updated,
      palette: resolvedPalette,
      preset: resolvedPalette as any
    };
    setThemeConfig(newConfig);
    saveThemeConfig(newConfig);
    applyThemeToDOM(newConfig);
    // Persist to userProfile in Firestore if profile is available
    if (userProfile && (updated.mode || updated.palette || updated.preset)) {
      handleUpdateProfile({
        themePreference: newConfig.mode,
        themePalette: newConfig.palette
      });
    }
  };

  // Initial load from fast offline cache to prevent blank screens or lost local work
  useEffect(() => {
    try {
      const local = loadAllDataFromLocal();
      if (local.profile) {
        setUserProfile(local.profile);
        if (local.profile.themePreference) {
          handleUpdateTheme({
            mode: local.profile.themePreference,
            palette: local.profile.themePalette || 'natural-ethos'
          });
        }
      }
      if (local.subjects && local.subjects.length > 0) setSubjects(local.subjects);
      if (local.sessions && local.sessions.length > 0) setSessions(local.sessions);
      if (local.plans && local.plans.length > 0) setPlans(local.plans);
      if (local.testResults && local.testResults.length > 0) setTestResults(local.testResults);
      if (local.activityLogs && local.activityLogs.length > 0) setActivityLogs(local.activityLogs);
      if (local.revisions && local.revisions.length > 0) setRevisions(local.revisions);
      if (local.vaults && local.vaults.length > 0) setVaults(local.vaults);
      if (local.flashcardDecks && local.flashcardDecks.length > 0) setFlashcardDecks(local.flashcardDecks);
      if (local.assignments && local.assignments.length > 0) setAssignments(local.assignments);
      if (local.missedWork && local.missedWork.length > 0) setMissedWork(deduplicateMissedWork(local.missedWork));
    } catch (err) {
      console.warn('Error reading initial local storage cache:', err);
    }
  }, []);

  // Handle URL action parameters from actionable Gmail links (Mark as done, Start timer, Open Briefing)
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const action = urlParams.get('action');
      const completedTask = urlParams.get('completed_task');
      const topicParam = urlParams.get('topic') || urlParams.get('topicName');
      const subjectParam = urlParams.get('subject') || urlParams.get('subjectName');
      const chapterParam = urlParams.get('chapter') || urlParams.get('chapterName');

      if (action === 'complete_task' || completedTask === 'true') {
        const topicName = topicParam || 'Study Task';
        const subjectName = subjectParam || 'General';
        const chapterName = chapterParam || 'Curriculum';
        
        // Complete the matching task in today's plan
        const todayStr = new Date().toISOString().split('T')[0];
        setPlans(prevPlans => {
          const updated = prevPlans.map(p => {
            if (p.date === todayStr || !p.date) {
              const updatedTopics = p.topics.map(t => {
                const matchTopic = (t.topicName || '').toLowerCase() === (topicName || '').toLowerCase();
                const matchSub = subjectParam ? (t.subjectName || '').toLowerCase() === (subjectName || '').toLowerCase() : false;
                if (matchTopic || matchSub) {
                  return {
                    ...t,
                    completed: true,
                    completedAt: new Date().toISOString(),
                    completionStatus: 'Completed' as TopicCompletionStatus,
                    completionDetails: 'Completed via Morning Agenda Gmail 1-Click Action'
                  };
                }
                return t;
              });
              return { ...p, topics: updatedTopics };
            }
            return p;
          });
          saveLocalState('plans', updated);
          return updated;
        });

        // Add to completed sessions
        const now = new Date();
        const startTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const newSession: StudySession = {
          id: `sess-email-${Date.now()}`,
          userId: effectiveUid,
          date: todayStr,
          startTime: startTimeStr,
          endTime: startTimeStr,
          subjectName: subjectName,
          chapterName: chapterName,
          topicName: topicName,
          durationMinutes: 45,
          result: 'Completed',
          notes: 'Marked as done directly from Gmail Morning Agenda Briefing link.',
          timestamp: Date.now()
        };

        setSessions(prev => {
          const updated = [newSession, ...prev];
          saveLocalState('sessions', updated);
          return updated;
        });

        setActionBanner({
          message: `🎉 Task "${topicName}" (${subjectName}) has been marked as completed from your Morning Agenda Email!`,
          type: 'success'
        });

        // Clean query parameters from URL without reloading
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (action === 'start_timer') {
        if (topicParam || subjectParam) {
          setTimerTopic({
            subject: subjectParam || '',
            chapter: chapterParam || '',
            topic: topicParam || ''
          });
          setActiveTab('timer');
          setActionBanner({
            message: `⏱️ Timer initiated for "${topicParam || 'Study Topic'}" (${subjectParam || ''}) from your Morning Briefing.`,
            type: 'info'
          });
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } else if (action === 'open_morning_briefing' || action === 'briefing') {
        setIsEmailAgendaModalOpen(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (action === 'open_missed_work' || action === 'missed_work') {
        setActiveTab('missed_work');
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      // Check for Cross-Device Transfer Code or Sync Email link parameters (search and hash)
      let hashParams: URLSearchParams | null = null;
      try {
        const hashStr = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : window.location.hash.replace(/^#\/?/, '');
        if (hashStr && hashStr.includes('=')) {
          hashParams = new URLSearchParams(hashStr);
        }
      } catch (hErr) {}

      const getParam = (key: string) => urlParams.get(key) || (hashParams ? hashParams.get(key) : null);

      const transferCodeParam = getParam('transfer_code') || getParam('connect_code') || getParam('pin') || getParam('code') || getParam('link_pin');
      const syncEmailParam = getParam('sync_email') || getParam('email');
      const forcePullParam = getParam('force_pull');

      if (syncEmailParam && syncEmailParam.includes('@')) {
        const cleanEmail = syncEmailParam.trim().toLowerCase();
        setActiveUserEmail(cleanEmail);
        setActiveEmail(cleanEmail);
        handleUpdateProfile({ email: cleanEmail });
        setActionBanner({
          message: `Linked study email "${cleanEmail}". All devices are now synchronized!`,
          type: 'success'
        });
      }

      if (transferCodeParam) {
        const cleanPin = transferCodeParam.trim().replace(/[^0-9]/g, '');
        if (cleanPin.length === 6) {
          const isForcePull = forcePullParam === 'true' || forcePullParam === '1';
          redeemTransferPin(cleanPin, { forcePull: isForcePull }).then(async (res) => {
            if (res.success) {
              const targetUid = res.uid || getParam('sync_uid');
              const targetEmail = res.email || syncEmailParam;

              if (targetUid) {
                setPairedSyncUid(targetUid);
                setPairedSyncUidState(targetUid);
                liveSync.updateIdentity(targetUid, targetEmail || activeEmail);
              }

              if (targetEmail) {
                setActiveUserEmail(targetEmail);
                setActiveEmail(targetEmail);
                handleUpdateProfile({ email: targetEmail });
              }

              if (res.payload) {
                await handleRestoreFullSnapshot(res.payload, targetUid || effectiveUid);
              }

              setActionBanner({
                message: res.isForcePulled
                  ? `🎉 Force-Pulled full cloud snapshot from ${res.deviceName || 'source device'}! Overwrote local state with latest cloud database.`
                  : `🎉 Connected to ${res.deviceName || 'source device'}! Transferred all calendar, revisions, timers, blurts, and coursework data.`,
                type: 'success'
              });
              window.history.replaceState({}, document.title, window.location.pathname);
            } else {
              setActionBanner({
                message: res.message || `Could not link device using PIN ${cleanPin}. Please check the PIN.`,
                type: 'error'
              });
            }
          }).catch((err) => {
            console.warn('Transfer PIN redemption error:', err);
          });
        }
      }
    } catch (e) {
      console.error('Error parsing URL action params:', e);
    }
  }, [effectiveUid]);

  // Full snapshot restoration handler across devices (Force Pull / PIN Sync / Backup Import)
  const handleRestoreFullSnapshot = async (data: any, targetUid?: string) => {
    if (!data) return;
    const destUid = targetUid || effectiveUid;

    // Save pre-sync safety backup to enable instant undo
    savePreSyncSafetyBackup({
      subjects,
      sessions,
      plans,
      vaults,
      assignments,
      testResults,
      flashcardDecks,
      revisions,
      notes,
      activityLogs,
      profile: userProfile
    });

    if (Array.isArray(data.subjects) && data.subjects.length > 0) setSubjects(data.subjects);
    if (Array.isArray(data.sessions)) setSessions(data.sessions);
    if (Array.isArray(data.plans)) setPlans(data.plans);
    if (Array.isArray(data.vaults)) setVaults(data.vaults);
    if (Array.isArray(data.assignments)) setAssignments(data.assignments);
    if (Array.isArray(data.missedWork)) setMissedWork(deduplicateMissedWork(data.missedWork));
    if (Array.isArray(data.testResults)) setTestResults(data.testResults);
    if (Array.isArray(data.flashcardDecks)) setFlashcardDecks(data.flashcardDecks);
    if (Array.isArray(data.revisions)) setRevisions(data.revisions);
    if (Array.isArray(data.notes)) setNotes(data.notes);
    if (Array.isArray(data.activityLogs)) setActivityLogs(data.activityLogs);
    if (data.profile) {
      setUserProfile(data.profile);
      if (data.profile.email) {
        setActiveEmail(data.profile.email);
        setActiveUserEmail(data.profile.email);
      }
    }
    cacheAllDataLocally(data);
    await forceSyncAllToCloud(destUid, data);
  };

  // Rollback to Pre-Sync Safety Backup if user wants to undo
  const handleRollbackPreSyncBackup = async () => {
    const backup = getPreSyncSafetyBackup();
    if (!backup || !backup.state) {
      setActionBanner({
        message: 'No previous safety backup found to restore.',
        type: 'info'
      });
      return;
    }

    const state = backup.state;
    if (Array.isArray(state.subjects)) setSubjects(state.subjects);
    if (Array.isArray(state.sessions)) setSessions(state.sessions);
    if (Array.isArray(state.plans)) setPlans(state.plans);
    if (Array.isArray(state.vaults)) setVaults(state.vaults);
    if (Array.isArray(state.assignments)) setAssignments(state.assignments);
    if (Array.isArray(state.testResults)) setTestResults(state.testResults);
    if (Array.isArray(state.flashcardDecks)) setFlashcardDecks(state.flashcardDecks);
    if (Array.isArray(state.revisions)) setRevisions(state.revisions);
    if (Array.isArray(state.notes)) setNotes(state.notes);
    if (Array.isArray(state.activityLogs)) setActivityLogs(state.activityLogs);
    if (state.profile) {
      setUserProfile(state.profile);
      if (state.profile.email) {
        setActiveEmail(state.profile.email);
        setActiveUserEmail(state.profile.email);
      }
    }
    cacheAllDataLocally(state);
    await forceSyncAllToCloud(effectiveUid, state);

    setActionBanner({
      message: `Restored previous local state from ${new Date(backup.savedAt).toLocaleTimeString()}!`,
      type: 'success'
    });
  };

  // Handle Parsed Result from In-App Optical QR Scanner (Without redirecting to another browser)
  const handleQRScanResult = async (result: ParsedQRResult) => {
    if (!result) return;

    // 1. Device Pairing / Transfer PIN
    if (result.type === 'transfer_pin' || result.transferPin) {
      const pin = result.transferPin || result.raw.replace(/[^0-9]/g, '').slice(0, 6);
      if (pin && pin.length === 6) {
        try {
          const res = await redeemTransferPin(pin, { forcePull: true });
          if (res.success) {
            const targetUid = res.uid || result.syncUid || effectiveUid;
            const targetEmail = res.email || result.syncEmail;

            // Permanently bind this device to the source device's partition
            if (targetUid) {
              setPairedSyncUid(targetUid);
              setPairedSyncUidState(targetUid);
            }

            if (targetEmail) {
              setActiveUserEmail(targetEmail);
              setActiveEmail(targetEmail);
              handleUpdateProfile({ email: targetEmail });
            }

            // Immediately switch LiveSync identity to the shared partition channel
            if (targetUid) {
              liveSync.updateIdentity(targetUid, targetEmail || activeEmail);
            }

            if (res.payload) {
              await handleRestoreFullSnapshot(res.payload, targetUid);
            }

            const stats = res.stats || {
              subjectsCount: res.payload?.subjects?.length || 0,
              chaptersCount: res.payload?.subjects?.reduce((a: number, s: any) => a + (s.chapters?.length || 0), 0) || 0,
              plansCount: res.payload?.plans?.length || 0,
              vaultsCount: res.payload?.vaults?.length || 0,
              flashcardsCount: res.payload?.flashcardDecks?.length || 0,
              assignmentsCount: res.payload?.assignments?.length || 0,
              testResultsCount: res.payload?.testResults?.length || 0,
              sessionsCount: res.payload?.sessions?.length || 0,
            };

            const details: SyncInspectorDetails = {
              deviceName: res.deviceName || 'Remote Device',
              pin,
              timestamp: new Date().toISOString(),
              email: res.email,
              stats,
              hasPreSyncBackup: true
            };
            setLastSyncDetails(details);
            try {
              localStorage.setItem('prepforge_last_sync_details', JSON.stringify(details));
            } catch (e) {}

            if (stats.subjectsCount > 0 || (stats.testResultsCount && stats.testResultsCount > 0)) {
              setActionBanner({
                message: `🎉 In-App QR Scanned: Linked device "${res.deviceName || 'Remote Device'}" (PIN ${pin})! Transferred ${stats.subjectsCount} subjects (${stats.chaptersCount} chapters), ${stats.plansCount} plans, ${stats.testResultsCount || 0} tests & ${stats.vaultsCount} vaults. Permanent sync active!`,
                type: 'success',
                showInspectorBtn: true
              });
            } else {
              setActionBanner({
                message: `⚠️ Linked device "${res.deviceName || 'Remote Device'}" (PIN ${pin}), but 0 subjects were found on that device. Tap "Inspect Details" to view solutions.`,
                type: 'info',
                showInspectorBtn: true
              });
              // Automatically open the inspector modal so the user immediately sees what happened and has instant solutions!
              setIsSyncInspectorOpen(true);
            }
          } else {
            setActionBanner({
              message: res.message || `Could not link device using PIN ${pin}. Please verify the code on your other device.`,
              type: 'info'
            });
          }
        } catch (err: any) {
          setActionBanner({
            message: `Pairing error: ${err.message || 'Failed to redeem PIN.'}`,
            type: 'info'
          });
        }
        return;
      }
    }

    // 2. Storage Vault Bundle
    if (result.type === 'vault_bundle' && result.data) {
      const bundle = result.data.vaultTransferBundle || result.data;
      if (bundle.vault) {
        try {
          await handleCreateVault(bundle.vault);
          if (Array.isArray(bundle.tests) && bundle.tests.length > 0) {
            for (const t of bundle.tests) {
              await handleAddTestResult(t);
            }
          }
          setActiveTab('vaults');
          setActionBanner({
            message: `📦 In-App QR Scanned: Successfully imported Storage Vault "${bundle.vault.name}"!`,
            type: 'success'
          });
        } catch (err: any) {
          setActionBanner({
            message: `Failed to import vault bundle: ${err.message}`,
            type: 'info'
          });
        }
        return;
      }
    }

    // 3. Syllabus or Flashcards collection
    if (result.type === 'vault_bundle' && Array.isArray(result.data)) {
      setSubjects(result.data);
      saveLocalState('syllabus', result.data);
      await saveSyllabusToDb(effectiveUid, result.data);
      setActiveTab('syllabus');
      setActionBanner({
        message: `📚 In-App QR Scanned: Imported ${result.data.length} subjects!`,
        type: 'success'
      });
      return;
    }

    // 4. Study OS URL with action or transfer_code
    if (result.type === 'study_url' || result.type === 'generic_url') {
      try {
        const url = new URL(result.raw.startsWith('http') ? result.raw : `https://studyflow.app/${result.raw}`);
        const pin = url.searchParams.get('transfer_code') || url.searchParams.get('pin') || url.searchParams.get('code');
        if (pin && pin.length === 6) {
          return handleQRScanResult({
            raw: result.raw,
            type: 'transfer_pin',
            transferPin: pin,
            displayText: `Transfer PIN: ${pin}`
          });
        }

        const tab = url.searchParams.get('tab');
        if (tab) {
          setActiveTab(tab as ActiveTab);
          setActionBanner({
            message: `Switched to "${tab}" from scanned in-app QR code!`,
            type: 'info'
          });
          return;
        }
      } catch (err) {}
    }

    // Default notice
    setActionBanner({
      message: `Scanned QR Code: ${result.displayText || result.raw.slice(0, 80)}`,
      type: 'info'
    });
  };

  // Cross-Tab Instant Sync Bus Listener
  useEffect(() => {
    const unsubSyncBus = subscribeToSyncBroadcast((msg) => {
      if (msg.type === 'SYNC_RESTORE_PAYLOAD' || msg.type === 'FORCE_PULL_COMPLETED') {
        if (msg.payload && msg.sourceDeviceId !== getOrCreateDeviceId()) {
          console.log('[SyncBus] Applying remote payload from', msg.sourceDeviceName);
          const data = msg.payload;
          if (Array.isArray(data.subjects)) setSubjects(data.subjects);
          if (Array.isArray(data.sessions)) setSessions(data.sessions);
          if (Array.isArray(data.plans)) setPlans(data.plans);
          if (Array.isArray(data.vaults)) setVaults(data.vaults);
          if (Array.isArray(data.assignments)) setAssignments(data.assignments);
          if (Array.isArray(data.testResults)) setTestResults(data.testResults);
          if (Array.isArray(data.flashcardDecks)) setFlashcardDecks(data.flashcardDecks);
          if (Array.isArray(data.revisions)) setRevisions(data.revisions);
          if (data.profile) setUserProfile(data.profile);
          cacheAllDataLocally(data);

          if (msg.email) {
            setActiveUserEmail(msg.email);
            setActiveEmail(msg.email);
          }
        }
      }
    });

    return () => unsubSyncBus();
  }, [effectiveUid]);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser?.email) {
        setActiveUserEmail(currentUser.email);
        setActiveEmail(currentUser.email);
      } else {
        const stored = getActiveUserEmail();
        setActiveEmail(stored || '');
      }
    });
    return () => unsubAuth();
  }, []);

  // Subscribe to Study Groups globally
  useEffect(() => {
    const unsubGroups = subscribeStudyGroups((loadedGroups) => {
      if (loadedGroups && loadedGroups.length > 0) {
        setGroups(loadedGroups);
      }
    });
    return () => unsubGroups();
  }, []);

  // Subscribe to Firestore & Real-Time Live Sync for unified effectiveUid across devices (instant sub-second sync)
  useEffect(() => {
    if (!effectiveUid) return;

    // 1. Initialize Real-Time SSE Live Sync for instant cross-device updates
    const syncEmail = user?.email || userProfile?.email || activeEmail || getActiveUserEmail() || '';
    liveSync.init(effectiveUid, syncEmail);

    const unsubLiveMutations = liveSync.onMutation((event) => {
      const { collection, action, docId, payload, sourceDeviceName } = event;
      if (!payload && action !== 'DELETE') return;

      if (collection === 'syllabus' && Array.isArray(payload)) {
        setSubjects(payload);
        saveLocalState('syllabus', payload);
      } else if (collection === 'sessions') {
        if (action === 'INSERT' && payload) {
          setSessions(prev => [payload, ...prev.filter(s => s.id !== payload.id)]);
        } else if (Array.isArray(payload)) {
          setSessions(payload);
        }
      } else if (collection === 'plans') {
        if (action === 'INSERT' && payload) {
          setPlans(prev => [payload, ...prev.filter(p => p.id !== payload.id)]);
        } else if (action === 'UPDATE' && docId && payload) {
          setPlans(prev => prev.map(p => p.id === docId ? { ...p, ...payload } : p));
        } else if (action === 'DELETE' && docId) {
          setPlans(prev => prev.filter(p => p.id !== docId));
        } else if (Array.isArray(payload)) {
          setPlans(payload);
        }
      } else if (collection === 'activityLogs') {
        if (action === 'INSERT' && payload) {
          setActivityLogs(prev => [payload, ...prev.filter(l => l.id !== payload.id)]);
        } else if (action === 'DELETE' && docId) {
          setActivityLogs(prev => prev.filter(l => l.id !== docId));
        } else if (Array.isArray(payload)) {
          setActivityLogs(payload);
        }
      } else if (collection === 'testResults') {
        if (action === 'INSERT' && payload) {
          setTestResults(prev => [payload, ...prev.filter(t => t.id !== payload.id)]);
        } else if (action === 'DELETE' && docId) {
          setTestResults(prev => prev.filter(t => t.id !== docId));
        } else if (Array.isArray(payload)) {
          setTestResults(payload);
        }
      } else if (collection === 'vaults') {
        if (action === 'INSERT' && payload) {
          setVaults(prev => [payload, ...prev.filter(v => v.id !== payload.id)]);
        } else if (action === 'UPDATE' && docId && payload) {
          setVaults(prev => prev.map(v => v.id === docId ? { ...v, ...payload } : v));
        } else if (action === 'DELETE' && docId) {
          setVaults(prev => prev.filter(v => v.id !== docId));
        } else if (Array.isArray(payload)) {
          setVaults(payload);
        }
      } else if (collection === 'revisions' && Array.isArray(payload)) {
        setRevisions(payload);
        saveLocalState('revisions', payload);
      } else if (collection === 'flashcardDecks') {
        if (action === 'UPDATE' && docId && payload) {
          setFlashcardDecks(prev => {
            const idx = prev.findIndex(d => d.id === docId);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = payload;
              return next;
            }
            return [payload, ...prev];
          });
        } else if (action === 'DELETE' && docId) {
          setFlashcardDecks(prev => prev.filter(d => d.id !== docId));
        } else if (Array.isArray(payload)) {
          setFlashcardDecks(payload);
        }
      } else if (collection === 'assignments') {
        if (action === 'UPDATE' && docId && payload) {
          setAssignments(prev => {
            const idx = prev.findIndex(a => a.id === docId);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = payload;
              return next;
            }
            return [payload, ...prev];
          });
        } else if (action === 'DELETE' && docId) {
          setAssignments(prev => prev.filter(a => a.id !== docId));
        } else if (Array.isArray(payload)) {
          setAssignments(payload);
        }
      } else if (collection === 'missedWork') {
        if (action === 'UPDATE' && docId && payload) {
          setMissedWork(prev => {
            const idx = prev.findIndex(m => m.id === docId);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = payload;
              return deduplicateMissedWork(next);
            }
            return deduplicateMissedWork([payload, ...prev]);
          });
        } else if (action === 'DELETE' && docId) {
          setMissedWork(prev => prev.filter(m => m.id !== docId));
        } else if (Array.isArray(payload)) {
          setMissedWork(deduplicateMissedWork(payload));
        }
      } else if (collection === 'profile' && payload) {
        setUserProfile(prev => prev ? { ...prev, ...payload } : payload);
      } else if (collection === 'ALL' || action === 'FULL_SNAPSHOT') {
        if (payload.subjects) setSubjects(payload.subjects);
        if (payload.sessions) setSessions(payload.sessions);
        if (payload.plans) setPlans(payload.plans);
        if (payload.testResults) setTestResults(payload.testResults);
        if (payload.vaults) setVaults(payload.vaults);
        if (payload.flashcardDecks) setFlashcardDecks(payload.flashcardDecks);
        if (payload.assignments) setAssignments(payload.assignments);
        if (payload.missedWork) setMissedWork(deduplicateMissedWork(payload.missedWork));
        if (payload.revisions) setRevisions(payload.revisions);
        if (payload.activityLogs) setActivityLogs(payload.activityLogs);
        if (payload.profile) setUserProfile(payload.profile);
      }

      setActionBanner({
        message: `⚡ Instant update synced from ${sourceDeviceName || 'connected device'} (${collection})`,
        type: 'success'
      });
    });

    const unsubPeers = liveSync.onPeers((peers, count) => {
      setLivePeerCount(count);
    });

    const unsubState = liveSync.onConnectionState((state) => {
      setLiveSyncState(state);
    });

    // 2. Register current device profile & start live heartbeat
    registerCurrentDevice(effectiveUid).catch((err) => {
      console.warn("Device registration notice:", err);
    });

    const heartbeatInterval = setInterval(() => {
      registerCurrentDevice(effectiveUid).catch(() => {});
    }, 120000); // 2-min heartbeat

    // Watch devices list for remote revocation of THIS device
    const unsubDevices = subscribeUserDevices(effectiveUid, (devices) => {
      const myDeviceId = getOrCreateDeviceId();
      const thisDev = devices.find(d => d.deviceId === myDeviceId);
      if (thisDev && thisDev.status === 'revoked') {
        setActionBanner({
          message: '⚠️ This device was remotely signed out from your account on another device.',
          type: 'info'
        });
        handleSignOut();
      }
    });

    const unsubProfile = subscribeUserProfile(effectiveUid, (profile) => {
      if (profile) {
        setUserProfile(profile);
        if (profile.themePreference && profile.themePreference !== themeConfig.mode) {
          handleUpdateTheme({
            mode: profile.themePreference,
            palette: profile.themePalette || themeConfig.palette
          });
        }
      }
    });
    const unsubSyllabus = subscribeSyllabus(effectiveUid, (subs) => {
      if (subs && subs.length > 0) setSubjects(subs);
    });
    const unsubSessions = subscribeStudySessions(effectiveUid, (sess) => {
      if (sess) setSessions(sess);
    });
    const unsubPlans = subscribeStudyPlans(effectiveUid, (p) => {
      if (p) setPlans(p);
    });
    const unsubTests = subscribeTestResults(effectiveUid, (t) => {
      if (t) setTestResults(t);
    });
    const unsubLogs = subscribeActivityLogs(effectiveUid, (l) => {
      if (l) setActivityLogs(l);
    });
    const unsubRevisions = subscribeRevisions(effectiveUid, (r) => {
      if (r) setRevisions(r);
    });
    const unsubVaults = subscribeVaults(effectiveUid, (v) => {
      if (v) setVaults(v);
    });
    const unsubFlashcards = subscribeFlashcardDecks(effectiveUid, (f) => {
      if (f) setFlashcardDecks(f);
    });
    const unsubAssignments = subscribeAssignments(effectiveUid, (asgs) => {
      if (asgs) setAssignments(asgs);
    });
    const unsubMissedWork = subscribeMissedWork(effectiveUid, (mw) => {
      if (mw) setMissedWork(deduplicateMissedWork(mw));
    });

    return () => {
      clearInterval(heartbeatInterval);
      unsubLiveMutations();
      unsubPeers();
      unsubState();
      unsubDevices();
      unsubProfile();
      unsubSyllabus();
      unsubSessions();
      unsubPlans();
      unsubTests();
      unsubLogs();
      unsubRevisions();
      unsubVaults();
      unsubFlashcards();
      unsubAssignments();
      unsubMissedWork();
    };
  }, [effectiveUid, user, activeEmail]);

  // Periodic Automated Briefing background scheduler & status listener
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayPlan = plans.find(p => p.date === todayStr) || plans[0] || null;
    const todaySessions = sessions.filter(s => s.date === todayStr || (s.timestamp && Date.now() - s.timestamp <= 24 * 60 * 60 * 1000));

    const checkBriefing = async () => {
      try {
        await checkAndTriggerAutomatedBriefing({
          todayPlan,
          todaySessions,
          subjects,
          revisions,
          userProfile,
          testResults,
          assignments,
          missedWork
        });
      } catch (err) {
        console.warn('Briefing background check error:', err);
      }
    };

    // Run check immediately on mount/update
    checkBriefing();

    // Set interval to check every 30 seconds for 07:30 AM dispatch
    const interval = setInterval(checkBriefing, 30000);

    // Subscribe to live worker status events
    const unsubWorker = subscribeBriefingWorkerStatus((state) => {
      setBriefingWorkerState(state);
      if (state.status === 'dispatched_today' && state.lastDispatchedDate === todayStr) {
        setActionBanner({
          message: state.lastMessage || `7:30 AM Morning Briefing dispatched to ${userProfile?.email || 'your email'}! Check your inbox.`,
          type: 'success'
        });
      }
    });

    return () => {
      clearInterval(interval);
      unsubWorker();
    };
  }, [plans, sessions, subjects, revisions, userProfile, testResults, assignments, missedWork]);

  // Unified Handlers
  const handleUpdateSubjects = async (newSubjects: Subject[]) => {
    setSubjects(newSubjects);
    saveLocalState('syllabus', newSubjects);
    await saveSyllabusToDb(effectiveUid, newSubjects);
  };

  const handleSaveFlashcardDeck = async (deck: FlashcardDeck) => {
    setFlashcardDecks(prev => {
      const existingIdx = prev.findIndex(d => d.id === deck.id);
      let updated: FlashcardDeck[];
      if (existingIdx >= 0) {
        updated = [...prev];
        updated[existingIdx] = deck;
      } else {
        updated = [deck, ...prev];
      }
      saveLocalState('flashcardDecks', updated);
      return updated;
    });
    await saveFlashcardDeckToDb(effectiveUid, deck);
  };

  const handleDeleteFlashcardDeck = async (deckId: string) => {
    setFlashcardDecks(prev => {
      const updated = prev.filter(d => d.id !== deckId);
      saveLocalState('flashcardDecks', updated);
      return updated;
    });
    await deleteFlashcardDeckFromDb(effectiveUid, deckId);
  };

  const handleSaveSession = async (session: Omit<StudySession, 'id'>) => {
    const newSessionId = await addStudySessionToDb(effectiveUid, session);
    const fullSession: StudySession = {
      id: newSessionId || `sess-${Date.now()}`,
      ...session
    };

    // 1. Update React state for sessions
    setSessions(prev => {
      const updated = [fullSession, ...prev.filter(s => s.id !== fullSession.id)];
      saveLocalState('sessions', updated);
      return updated;
    });

    // 2. CRITICAL: Save time directly to Revision (revisions)
    const todayStr = session.date || new Date().toISOString().split('T')[0];
    const dueDateStr = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];

    setRevisions(prevRevs => {
      const sessSub = (session.subjectName || '').trim().toLowerCase();
      const sessTop = (session.topicName || '').trim().toLowerCase();
      const existingRev = prevRevs.find(r => 
        (r.subjectName || '').trim().toLowerCase() === sessSub &&
        (r.topicName || '').trim().toLowerCase() === sessTop
      );

      let updatedRevs: RevisionItem[];
      if (existingRev) {
        const prevTotal = existingRev.totalTimeSpentMinutes ?? existingRev.timeSpentMinutes ?? 0;
        const newTotal = prevTotal + session.durationMinutes;
        const count = (existingRev.sessionsCount || 1) + 1;

        const updatedRev: RevisionItem = {
          ...existingRev,
          lastStudied: todayStr,
          dueDate: dueDateStr,
          timeSpentMinutes: newTotal,
          totalTimeSpentMinutes: newTotal,
          lastSessionDurationMinutes: session.durationMinutes,
          sessionsCount: count,
          priority: session.result === 'Not completed' ? 'High' : existingRev.priority,
          status: session.result === 'Not completed' ? 'Pending' : existingRev.status,
          reason: session.notes 
            ? `Timed session (${session.durationMinutes}m): ${session.notes}` 
            : `Timed revision session (${session.durationMinutes}m, ${session.result}). Total time: ${newTotal}m.`
        };

        updatedRevs = prevRevs.map(r => r.id === existingRev.id ? updatedRev : r);
      } else {
        const newRevItem: RevisionItem = {
          id: `rev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          userId: effectiveUid,
          subjectName: session.subjectName,
          chapterName: session.chapterName || '',
          topicName: session.topicName,
          lastStudied: todayStr,
          dueDate: dueDateStr,
          priority: session.result === 'Not completed' ? 'High' : 'Medium',
          status: 'Pending',
          reason: session.notes 
            ? `Timer session (${session.durationMinutes}m): ${session.notes}` 
            : `Timed study session: ${session.durationMinutes} mins logged (${session.result}).`,
          timeSpentMinutes: session.durationMinutes,
          totalTimeSpentMinutes: session.durationMinutes,
          sessionsCount: 1,
          lastSessionDurationMinutes: session.durationMinutes
        };

        updatedRevs = [newRevItem, ...prevRevs];
      }

      saveLocalState('revisions', updatedRevs);
      saveRevisionsToDb(effectiveUid, updatedRevs).catch(err => {
        console.warn("Failed to persist revision to DB:", err);
      });
      return updatedRevs;
    });

    // 3. Update Syllabus Topic (Progress tracking): save time spent & status
    setSubjects(prevSubjects => {
      let matched = false;
      const sessSub = (session.subjectName || '').trim().toLowerCase();
      const sessTop = (session.topicName || '').trim().toLowerCase();
      const updated = prevSubjects.map(sub => {
        if ((sub.name || '').trim().toLowerCase() !== sessSub) return sub;
        return {
          ...sub,
          chapters: sub.chapters.map(ch => {
            return {
              ...ch,
              topics: ch.topics.map(t => {
                if ((t.name || '').trim().toLowerCase() !== sessTop) return t;
                matched = true;
                const prevTime = t.timeSpentMinutes || 0;
                const newTime = prevTime + session.durationMinutes;
                const prevCount = t.sessionsCount || 0;
                
                let newStatus = t.status;
                if (session.result === 'Completed') {
                  newStatus = t.status === 'Completed' ? 'Mastered' : 'Completed';
                } else if (session.result === 'Partially completed') {
                  if (t.status === 'Not Started') newStatus = 'In Progress';
                } else if (session.result === 'Not completed') {
                  newStatus = 'Needs Revision';
                }

                return {
                  ...t,
                  timeSpentMinutes: newTime,
                  sessionsCount: prevCount + 1,
                  lastStudiedAt: todayStr,
                  status: newStatus
                };
              })
            };
          })
        };
      });

      if (matched) {
        saveLocalState('subjects', updated);
        saveSyllabusToDb(effectiveUid, updated).catch(err => {
          console.warn("Failed to persist updated topic time to DB:", err);
        });
      }
      return updated;
    });

    // 4. Gamification: Award XP and Quest progress for completing a study session
    try {
      awardQuestProgress('focus', Math.max(1, Math.round(session.durationMinutes / 25)));
      const earnedXp = Math.max(25, Math.round(session.durationMinutes * 2));
      const updatedProfile = awardXPAndGems(earnedXp, 5, `Completed ${session.durationMinutes}m session on ${session.topicName}`);
      setRpgProfile(updatedProfile);
      saveRPGProfile(updatedProfile);
    } catch (e) {
      console.warn('RPG progress update error:', e);
    }
  };

  const handleUpdateRPGProfile = (updated: StudyRPGProfile) => {
    setRpgProfile(updated);
    saveRPGProfile(updated);
  };

  const handleVirtualRoomSessionComplete = async (sessionData: {
    subjectName: string;
    topicName: string;
    durationMinutes: number;
    notes?: string;
  }) => {
    const now = new Date();
    const endTime = now.toTimeString().slice(0, 5);
    const startDate = new Date(now.getTime() - sessionData.durationMinutes * 60000);
    const startTime = startDate.toTimeString().slice(0, 5);

    const newSession: Omit<StudySession, 'id'> = {
      userId: effectiveUid,
      subjectName: sessionData.subjectName,
      chapterName: 'Deep Focus Studio',
      topicName: sessionData.topicName,
      date: now.toISOString().split('T')[0],
      startTime,
      endTime,
      durationMinutes: sessionData.durationMinutes,
      result: 'Completed',
      notes: sessionData.notes || 'Completed in Virtual Silent Study Room with ambient audio.',
      timestamp: Date.now()
    };
    await handleSaveSession(newSession);
    setActionBanner({
      message: `🎉 Focus Master! Completed ${sessionData.durationMinutes}m session in the Virtual Study Room. XP and streak updated!`,
      type: 'success'
    });
  };

  const handleMarkRevisionDone = async (revisionId: string) => {
    setRevisions(prevRevs => {
      const updated = prevRevs.map(r => {
        if (r.id !== revisionId) return r;
        const newStatus: 'Completed' | 'Pending' = r.status === 'Completed' ? 'Pending' : 'Completed';
        return {
          ...r,
          status: newStatus,
          completedAt: newStatus === 'Completed' ? new Date().toISOString() : undefined
        };
      });
      saveLocalState('revisions', updated);
      saveRevisionsToDb(effectiveUid, updated).catch(() => {});
      return updated;
    });
  };

  const handleDeleteRevision = async (revisionId: string) => {
    setRevisions(prevRevs => {
      const updated = prevRevs.filter(r => r.id !== revisionId);
      saveLocalState('revisions', updated);
      saveRevisionsToDb(effectiveUid, updated).catch(() => {});
      return updated;
    });
  };

  const handleAddRevisionTopic = async (item: Omit<RevisionItem, 'id' | 'userId'>) => {
    const newRevItem: RevisionItem = {
      id: `rev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId: effectiveUid,
      ...item
    };
    setRevisions(prevRevs => {
      const updated = [newRevItem, ...prevRevs.filter(r => !(r.subjectName === item.subjectName && r.topicName === item.topicName))];
      saveLocalState('revisions', updated);
      saveRevisionsToDb(effectiveUid, updated).catch(() => {});
      return updated;
    });
  };

  const handleSavePlan = async (plan: StudyPlan | Omit<StudyPlan, 'id'>) => {
    if ('id' in plan && plan.id && plans.some(p => p.id === plan.id)) {
      await updateStudyPlanInDb(effectiveUid, plan.id, plan);
      setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, ...plan } : p));
    } else {
      const planId = await saveStudyPlanToDb(effectiveUid, plan);
      const newPlan: StudyPlan = { id: planId || `plan-${Date.now()}`, ...plan };
      setPlans(prev => [newPlan, ...prev.filter(p => p.id !== newPlan.id)]);
    }
  };

  const handleForceSaveCloud = async () => {
    const local = loadAllDataFromLocal();
    await forceSyncAllToCloud(effectiveUid, {
      profile: userProfile || local.profile,
      subjects: subjects || local.subjects,
      sessions: sessions || local.sessions,
      plans: plans || local.plans,
      testResults: testResults || local.testResults,
      vaults: vaults || local.vaults,
      activityLogs: activityLogs || local.activityLogs,
      revisions: revisions || local.revisions,
      flashcardDecks: flashcardDecks || local.flashcardDecks,
      assignments: assignments || local.assignments,
      missedWork: missedWork || local.missedWork,
    });
  };

  const handleCreateVault = async (vault: Omit<StorageVault, 'id'>) => {
    const newId = await saveVaultToDb(effectiveUid, vault);
    const createdVault: StorageVault = { ...vault, id: newId };
    setVaults(prev => [createdVault, ...prev.filter(v => v.id !== newId)]);
    return newId;
  };

  const handleAddActivityLog = async (log: Omit<ActivityLog, 'id' | 'userId'>) => {
    const newId = await addActivityLogToDb(effectiveUid, log);
    const newEntry: ActivityLog = {
      id: newId || `log-${Date.now()}`,
      userId: effectiveUid,
      ...log
    };
    setActivityLogs(prev => {
      const updated = [newEntry, ...prev.filter(l => l.id !== newEntry.id)];
      saveLocalState('activityLogs', updated);
      return updated;
    });
  };

  const handleUpdateVault = async (vaultId: string, updates: Partial<StorageVault>) => {
    setVaults(prev => prev.map(v => v.id === vaultId ? { ...v, ...updates } : v));
    await updateVaultInDb(effectiveUid, vaultId, updates);
  };

  const handleDeleteVault = async (vaultId: string) => {
    setVaults(prev => prev.filter(v => v.id !== vaultId));
    setTestResults(prev => prev.map(t => t.vaultId === vaultId ? { ...t, vaultId: undefined } : t));
    await deleteVaultFromDb(effectiveUid, vaultId);
  };

  const handleSaveAssignment = async (assignment: Assignment) => {
    const newId = await saveAssignmentToDb(effectiveUid, assignment);
    const saved = { ...assignment, id: newId };
    setAssignments(prev => [saved, ...prev.filter(a => a.id !== newId)]);
    saveLocalState('assignments', [saved, ...assignments.filter(a => a.id !== newId)]);
    return newId;
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    setAssignments(prev => prev.filter(a => a.id !== assignmentId));
    saveLocalState('assignments', assignments.filter(a => a.id !== assignmentId));
    await deleteAssignmentFromDb(effectiveUid, assignmentId);
  };

  const handleStartTimerForAssignment = (assignment: Assignment) => {
    setTimerTopic({
      subject: assignment.subjectName || 'General',
      chapter: assignment.chapterName || 'Coursework',
      topic: assignment.title
    });
    setActiveTab('timer');
  };

  // Missed Work & Recovery Plan Handlers
  const handleSaveMissedWorkItem = async (item: MissedWorkItem) => {
    const newId = await saveMissedWorkItemToDb(effectiveUid, item);
    const saved = { ...item, id: newId };
    setMissedWork(prev => deduplicateMissedWork([saved, ...prev.filter(m => m.id !== newId)]));
    saveLocalState('missedWork', deduplicateMissedWork([saved, ...missedWork.filter(m => m.id !== newId)]));
    return newId;
  };

  const handleSaveAllMissedWork = async (items: MissedWorkItem[]) => {
    const cleaned = deduplicateMissedWork(items);
    setMissedWork(cleaned);
    saveLocalState('missedWork', cleaned);
    await saveAllMissedWorkToDb(effectiveUid, cleaned);
  };

  const handleDeleteMissedWorkItem = async (id: string) => {
    setMissedWork(prev => prev.filter(m => m.id !== id));
    saveLocalState('missedWork', missedWork.filter(m => m.id !== id));
    await deleteMissedWorkItemFromDb(effectiveUid, id);
  };

  const handleAutoDetectOverdue = async () => {
    const evaluated = deduplicateMissedWork(evaluateAndSyncMissedWork({
      existingMissedWork: missedWork,
      assignments,
      plans,
      userProfile,
      testResults
    }));
    const diff = evaluated.length - missedWork.length;
    if (diff > 0) {
      setActionBanner({
        message: `📋 Detected ${diff} overdue item${diff > 1 ? 's' : ''} moved to Missed Work. Recovery plans generated!`,
        type: 'info'
      });
    }
    setMissedWork(evaluated);
    saveLocalState('missedWork', evaluated);
    await saveAllMissedWorkToDb(effectiveUid, evaluated);
  };

  // Automatically evaluate overdue assignments, plans, and tests into Missed Work
  useEffect(() => {
    if (assignments.length > 0 || plans.length > 0 || (userProfile?.examDates && userProfile.examDates.length > 0)) {
      const evaluated = deduplicateMissedWork(evaluateAndSyncMissedWork({
        existingMissedWork: missedWork,
        assignments,
        plans,
        userProfile,
        testResults
      }));
      if (evaluated.length > missedWork.length) {
        setMissedWork(evaluated);
        saveLocalState('missedWork', evaluated);
        saveAllMissedWorkToDb(effectiveUid, evaluated);
      }
    }
  }, [assignments, plans, userProfile, testResults]);

  const handleApproveExtractedMaterial = async (extracted: {
    subjects: Subject[];
    flashcardDecks: FlashcardDeck[];
    practiceQuestions: any[];
    studyTasks: any[];
    overview?: {
      title: string;
      executiveSummary: string;
      keyConceptsCovered: string[];
      recommendedWeeklyPace: string;
    };
  }) => {
    // 1. Merge or set subjects
    let mergedSubjects: Subject[] = [...subjects];
    extracted.subjects.forEach(newSub => {
      const existingIdx = mergedSubjects.findIndex(s => (s.name || '').toLowerCase() === (newSub.name || '').toLowerCase());
      if (existingIdx >= 0) {
        mergedSubjects[existingIdx] = newSub;
      } else {
        mergedSubjects.push(newSub);
      }
    });
    setSubjects(mergedSubjects);
    saveLocalState('syllabus', mergedSubjects);
    await saveSyllabusToDb(effectiveUid, mergedSubjects);

    // 2. Add Flashcard Decks
    if (extracted.flashcardDecks && extracted.flashcardDecks.length > 0) {
      const updatedDecks = [...extracted.flashcardDecks, ...flashcardDecks];
      setFlashcardDecks(updatedDecks);
      saveLocalState('flashcardDecks', updatedDecks);
      for (const deck of extracted.flashcardDecks) {
        await saveFlashcardDeckToDb(effectiveUid, deck);
      }
    }

    // 3. Create Storage Vaults for uploaded textbook / document
    if (extracted.overview && extracted.overview.title) {
      const primarySubject = extracted.subjects[0]?.name || 'General';
      const newVault: Omit<StorageVault, 'id'> = {
        userId: effectiveUid,
        name: extracted.overview.title,
        subjectName: primarySubject,
        chapterName: extracted.subjects[0]?.chapters[0]?.name,
        category: 'Textbook & Coursework',
        description: extracted.overview.executiveSummary || 'Uploaded and structured syllabus document.',
        icon: '📚',
        tags: [...(extracted.overview.keyConceptsCovered || []).slice(0, 5), 'Uploaded Material', primarySubject],
        createdAt: new Date().toISOString()
      };
      await handleCreateVault(newVault);
    }

    // 4. Create Daily Study Plan from tasks
    if (extracted.studyTasks && extracted.studyTasks.length > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const newPlan: Omit<StudyPlan, 'id'> = {
        userId: effectiveUid,
        createdAt: new Date().toISOString(),
        date: todayStr,
        title: `${extracted.overview?.title || 'Study'} Plan`,
        reasoning: extracted.overview?.executiveSummary || 'Autonomous plan extracted from uploaded study material.',
        topics: extracted.studyTasks.map((t: any, idx: number) => ({
          id: `tp-${Date.now()}-${idx}`,
          subjectName: t.subjectName,
          chapterName: t.chapterName,
          topicName: t.topicName,
          estimatedMinutes: t.estimatedMinutes || 45,
          priority: t.priority || 'Medium',
          reason: t.reason || 'Curriculum core'
        }))
      };
      await handleSavePlan(newPlan);
    }

    setActiveTab('classroom');
  };

  const handleImportClassroomSubject = async (importedSubject: Subject, tasks?: any[]) => {
    let mergedSubjects: Subject[] = [...subjects];
    const existingIdx = mergedSubjects.findIndex(s => (s.name || '').toLowerCase() === (importedSubject.name || '').toLowerCase());
    if (existingIdx >= 0) {
      mergedSubjects[existingIdx] = importedSubject;
    } else {
      mergedSubjects.push(importedSubject);
    }
    setSubjects(mergedSubjects);
    saveLocalState('syllabus', mergedSubjects);
    await saveSyllabusToDb(effectiveUid, mergedSubjects);

    if (tasks && tasks.length > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const newPlan: Omit<StudyPlan, 'id'> = {
        userId: effectiveUid,
        createdAt: new Date().toISOString(),
        date: todayStr,
        title: `${importedSubject.name} Tasks & Schedule`,
        reasoning: `Imported from Google Classroom coursework and lecture milestones.`,
        topics: tasks.map((t, idx) => ({
          id: `tp-cw-${Date.now()}-${idx}`,
          subjectName: importedSubject.name,
          chapterName: 'Coursework & Assignments',
          topicName: t.name || t.topicName || 'Assignment Task',
          estimatedMinutes: Math.round((t.allocatedHours || 1.5) * 60),
          priority: 'High',
          reason: t.notes || 'Google Classroom coursework'
        }))
      };
      await handleSavePlan(newPlan);
    }
  };

  const handleTogglePlanTopicComplete = async (
    planId: string,
    topicId: string,
    completedOverride?: boolean,
    completionData?: {
      completionDetails?: string;
      completionStatus?: TopicCompletionStatus;
      actualMinutes?: number;
      scheduleRevision?: boolean;
      revisionDays?: number;
    }
  ) => {
    let targetTopic: any = null;
    let nextCompletedState = false;

    setPlans(prevPlans => {
      return prevPlans.map(plan => {
        if (plan.id === planId) {
          const updatedTopics = plan.topics.map(t => {
            if (t.id === topicId) {
              targetTopic = t;
              nextCompletedState = completedOverride !== undefined ? completedOverride : !t.completed;
              const status = completionData?.completionStatus || (nextCompletedState ? (t.completionStatus || 'Completed') : undefined);
              const details = completionData?.completionDetails !== undefined ? completionData.completionDetails : (nextCompletedState ? t.completionDetails : undefined);
              return { 
                ...t, 
                completed: nextCompletedState,
                completionStatus: nextCompletedState ? status : undefined,
                completionDetails: nextCompletedState ? details : undefined,
                completedAt: nextCompletedState ? (t.completedAt || new Date().toISOString()) : undefined
              };
            }
            return t;
          });

          updateStudyPlanInDb(effectiveUid, planId, { topics: updatedTopics }).catch(err => {
            console.warn('Error updating plan topic completion in DB:', err);
          });

          return { ...plan, topics: updatedTopics };
        }
        return plan;
      });
    });

    // If marked as completed, update syllabus topic status, add revisions if needed, & log study session/activity
    if (targetTopic && nextCompletedState) {
      const chosenStatus = completionData?.completionStatus || targetTopic.completionStatus || 'Completed';
      const userNotes = completionData?.completionDetails !== undefined ? completionData.completionDetails : (targetTopic.completionDetails || '');
      const dur = completionData?.actualMinutes || targetTopic.estimatedMinutes || 45;

      // 1. Update syllabus topic status
      let syllabusChanged = false;
      const targetSyllabusStatus = chosenStatus === 'Mastered' ? 'Mastered' : chosenStatus === 'Needs Revision' ? 'Needs Revision' : 'Completed';

      const targetSubName = (targetTopic.subjectName || '').toLowerCase();
      const targetTopName = (targetTopic.topicName || '').toLowerCase();

      const updatedSubjects = subjects.map(s => {
        if ((s.name || '').toLowerCase() === targetSubName) {
          const updatedChapters = s.chapters.map(c => {
            const updatedTopics = c.topics.map(tp => {
              if ((tp.name || '').toLowerCase() === targetTopName) {
                syllabusChanged = true;
                return { 
                  ...tp, 
                  status: targetSyllabusStatus, 
                  lastStudiedAt: new Date().toISOString(),
                  weakNotes: chosenStatus === 'Needs Revision' ? (userNotes || tp.weakNotes) : tp.weakNotes 
                };
              }
              return tp;
            });
            return { ...c, topics: updatedTopics };
          });
          return { ...s, chapters: updatedChapters };
        }
        return s;
      });

      if (syllabusChanged) {
        handleUpdateSubjects(updatedSubjects);
      }

      // 2. Schedule Spaced Repetition Revision if requested or if status is 'Needs Revision'
      if (completionData?.scheduleRevision || chosenStatus === 'Needs Revision') {
        const days = completionData?.revisionDays || 3;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + days);
        const dueDateStr = dueDate.toISOString().split('T')[0];

        const newRevisionItem: RevisionItem = {
          id: `rev-${Date.now()}`,
          userId: effectiveUid,
          subjectName: targetTopic.subjectName,
          chapterName: targetTopic.chapterName || '',
          topicName: targetTopic.topicName,
          lastStudied: new Date().toISOString().split('T')[0],
          dueDate: dueDateStr,
          priority: chosenStatus === 'Needs Revision' ? 'High' : 'Medium',
          status: 'Pending',
          reason: userNotes ? `Completed (${chosenStatus}): "${userNotes}"` : `Review scheduled upon task completion (${chosenStatus}).`
        };

        const updatedRevs = [newRevisionItem, ...revisions.filter(r => !(r.subjectName === targetTopic.subjectName && r.topicName === targetTopic.topicName))];
        setRevisions(updatedRevs);
        saveRevisionsToDb(effectiveUid, updatedRevs).catch(err => {
          console.warn('Error saving revisions to DB:', err);
        });
      }

      // 3. Add completed study session & activity log
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const sessionResult = chosenStatus === 'Partially completed' ? 'Partially completed' : 'Completed';

      await handleSaveSession({
        userId: effectiveUid,
        date: now.toISOString().split('T')[0],
        startTime: timeStr,
        endTime: timeStr,
        durationMinutes: dur,
        subjectName: targetTopic.subjectName,
        chapterName: targetTopic.chapterName || '',
        topicName: targetTopic.topicName,
        result: sessionResult,
        notes: userNotes 
          ? `[Outcome: ${chosenStatus}] ${userNotes}` 
          : `Topic completed and ticked off directly from study plan (${dur} mins, marked ${chosenStatus}).`,
        timestamp: Date.now()
      });
    }
  };

  const handleAdjustPlanTopicDuration = (planId: string, topicId: string, deltaMinutes: number) => {
    setPlans(prevPlans => {
      return prevPlans.map(plan => {
        if (plan.id === planId) {
          const updatedTopics = plan.topics.map(t => {
            if (t.id === topicId) {
              const current = t.estimatedMinutes || 45;
              const newMinutes = Math.max(10, Math.min(240, current + deltaMinutes));
              return { ...t, estimatedMinutes: newMinutes };
            }
            return t;
          });
          updateStudyPlanInDb(effectiveUid, planId, { topics: updatedTopics }).catch(err => {
            console.warn('Error updating plan topic duration:', err);
          });
          return { ...plan, topics: updatedTopics };
        }
        return plan;
      });
    });
  };

  const handleAddTestResult = async (test: Omit<TestResult, 'id'>) => {
    await addTestResultToDb(effectiveUid, test);

    // If test score links to a topic, sync syllabus topic status
    const percentage = test.percentage !== undefined ? test.percentage : (() => {
      const match = test.score.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
      if (match) {
        const sc = parseFloat(match[1]);
        const tot = parseFloat(match[2]);
        return tot > 0 ? Math.round((sc / tot) * 100) : 0;
      }
      const num = parseFloat(test.score.replace(/[^0-9.]/g, ''));
      return isNaN(num) ? 0 : Math.min(100, Math.round(num));
    })();

    let syllabusUpdated = false;
    const testSubName = (test.subjectName || '').toLowerCase();
    const testTopName = (test.topicName || '').toLowerCase();
    const testNum = (test.topicNumber || '').toLowerCase();
    const testTitle = (test.testName || '').toLowerCase();

    const updatedSubjects = subjects.map(s => {
      if ((s.name || '').toLowerCase() !== testSubName) return s;
      const updatedChapters = s.chapters.map(c => {
        const updatedTopics = c.topics.map(tp => {
          const tpName = (tp.name || '').toLowerCase();
          const matchId = test.topicId && tp.id === test.topicId;
          const matchNum = testNum && tp.topicNumber && tp.topicNumber.toLowerCase() === testNum;
          const matchName = testTopName && tpName === testTopName;
          const matchTitle = testTitle ? testTitle.includes(tpName) : false;

          if (matchId || matchNum || matchName || matchTitle) {
            syllabusUpdated = true;
            const newStatus: TopicStatus = percentage < 60 ? 'Weak' : percentage >= 85 ? 'Mastered' : 'Completed';
            return {
              ...tp,
              status: newStatus,
              weakNotes: percentage < 60 ? (test.notes || `Test score: ${test.score} (${percentage}%) on ${test.date}`) : tp.weakNotes,
              lastStudiedAt: new Date().toISOString()
            };
          }
          return tp;
        });
        return { ...c, topics: updatedTopics };
      });
      return { ...s, chapters: updatedChapters };
    });

    if (syllabusUpdated) {
      handleUpdateSubjects(updatedSubjects);
    }
  };

  const handleUpdateTestResult = async (testId: string, updates: Partial<TestResult>) => {
    setTestResults(prev => prev.map(t => t.id === testId ? { ...t, ...updates } : t));
    await updateTestResultInDb(effectiveUid, testId, updates);
  };

  const handleDeleteTestResult = async (testId: string) => {
    setTestResults(prev => prev.filter(t => t.id !== testId));
    await deleteTestResultFromDb(effectiveUid, testId);
  };

  const handleUpdateProfile = async (profileUpdates: Partial<UserProfile>) => {
    if (userProfile) {
      const updated = { ...userProfile, ...profileUpdates };
      setUserProfile(updated);
      await saveUserProfileToDb(effectiveUid, profileUpdates);
    } else {
      const newProfile: UserProfile = {
        displayName: user?.displayName || 'Student',
        name: user?.displayName || 'Student',
        email: user?.email || activeEmail || '',
        targetHoursPerDay: 3,
        examDates: [],
        ...profileUpdates
      };
      setUserProfile(newProfile);
      await saveUserProfileToDb(effectiveUid, newProfile);
    }
  };

  const handleUpdateGroup = async (updatedGroup: StudyGroup) => {
    setGroups(prev => prev.map(g => g.id === updatedGroup.id ? updatedGroup : g));
    try {
      await saveStudyGroupToDb(updatedGroup);
    } catch (err) {
      console.warn('Failed to save group to Firestore:', err);
    }
  };

  const handleCreateGroup = async (groupData: {
    name: string;
    description: string;
    groupCode: string;
    subjectFocus: string[];
    isPublic: boolean;
    targetExam?: string;
    targetExamDate?: string;
  }) => {
    const newGroup: StudyGroup = {
      id: `grp-${Date.now()}`,
      ...groupData,
      createdBy: user?.uid || 'current-user',
      createdByName: userProfile?.displayName || user?.displayName || 'Student',
      createdAt: new Date().toISOString(),
      members: [
        {
          uid: user?.uid || 'current-user',
          displayName: userProfile?.displayName || user?.displayName || 'Student',
          email: userProfile?.email || user?.email || 'student@study.edu',
          photoURL: user?.photoURL,
          role: 'admin',
          joinedAt: new Date().toISOString(),
          shareProgress: true,
          completedTopicsCount: subjects.reduce((acc, s) => acc + s.chapters.reduce((cAcc, c) => cAcc + c.topics.filter(t => t.status === 'Completed' || t.status === 'Mastered').length, 0), 0),
          totalTopicsCount: subjects.reduce((acc, s) => acc + s.chapters.reduce((cAcc, c) => cAcc + c.topics.length, 0), 0) || 24,
          studiedHoursThisWeek: Number((sessions.reduce((acc, s) => acc + s.durationMinutes, 0) / 60).toFixed(1)),
          sharedMasteredTopics: [],
          sharedWeakTopics: [],
          upcomingExams: userProfile?.examDates || []
        }
      ],
      goals: [
        {
          id: `goal-${Date.now()}`,
          title: 'Complete 30 Combined Study Hours',
          description: 'Initial weekly collaborative study sprint.',
          type: 'weekly_hours',
          targetValue: 30,
          currentValue: 0,
          unit: 'hours',
          completed: false,
          createdBy: user?.uid || 'current-user',
          createdByName: userProfile?.displayName || 'Student',
          createdAt: new Date().toISOString()
        }
      ],
      aiSuggestions: [],
      messages: [
        {
          id: `msg-${Date.now()}`,
          senderId: user?.uid || 'current-user',
          senderName: userProfile?.displayName || 'Student',
          text: `🎉 Created study group "${groupData.name}". Welcome!`,
          timestamp: Date.now(),
          type: 'chat'
        }
      ]
    };

    setGroups(prev => [newGroup, ...prev]);

    if (user) {
      try {
        const docId = await createStudyGroupInDb(newGroup);
        newGroup.id = docId;
      } catch (err) {
        console.warn('Failed to create group in Firestore:', err);
      }
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    setGroups(prev => prev.filter(g => g.id !== groupId));
    if (user) {
      try {
        await deleteStudyGroupFromDb(groupId);
      } catch (err) {
        console.warn('Failed to delete group from Firestore:', err);
      }
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    clearActiveUserEmail();
    setActiveEmail('');
    setUser(null);
    setUserProfile(null);
    setSessions([]);
    setPlans([]);
    setTestResults([]);
    setSubjects(DEFAULT_SYLLABUS);
    setVaults(DEFAULT_STORAGE_VAULTS);
    setFlashcardDecks(DEFAULT_FLASHCARD_DECKS);
    setRevisions([]);
  };

  const handleStartTimerForTopic = (subjectName: string, chapterName: string, topicName: string) => {
    setTimerTopic({ subject: subjectName, chapter: chapterName, topic: topicName });
    setActiveTab('timer');
  };

  const handleSendPromptToTutor = (promptText: string) => {
    setTutorPrompt(promptText);
    setActiveTab('tutor');
  };

  const handleAwardXP = (xp: number, reason?: string) => {
    try {
      const updatedProfile = awardXPAndGems(xp, Math.max(1, Math.floor(xp / 20)), reason || 'Study Activity');
      setRpgProfile(updatedProfile);
      saveRPGProfile(updatedProfile);
    } catch (e) {
      console.warn('RPG award error:', e);
    }
  };

  const todayDateStr = new Date().toISOString().split('T')[0];
  const todayPlan = plans.find(p => p.date === todayDateStr) || plans[0] || null;
  const todaySessions = sessions.filter(s => s.date === todayDateStr || (s.timestamp && Date.now() - s.timestamp <= 24 * 60 * 60 * 1000));

  return (
    <div className="min-h-screen bg-[#FDFCF9] text-[#4A4E4D] flex flex-col font-sans selection:bg-[#DDBEA9] selection:text-[#4A4E4D]">
      {/* Offline Alert Banner */}
      <OfflineNotification />
      <OfflineIndicator />

      {/* Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        userProfile={userProfile}
        themeConfig={themeConfig}
        onUpdateTheme={handleUpdateTheme}
        userLanguage={userLanguage}
        onToggleLanguage={handleToggleLanguage}
        livePeerCount={livePeerCount}
        liveSyncState={liveSyncState}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
        onOpenQuickTimer={() => setActiveTab('timer')}
        onOpenExamAutomationModal={() => setIsExamAutomationModalOpen(true)}
        onOpenEmailAgendaModal={() => setIsEmailAgendaModalOpen(true)}
        onOpenWhatsAppModal={() => setIsWhatsAppModalOpen(true)}
        onOpenVoiceFeynman={() => {
          setFeynmanInitialSubject(undefined);
          setFeynmanInitialConcept(undefined);
          setIsVoiceFeynmanModalOpen(true);
        }}
        onOpenKnowledgeTree={() => setIsKnowledgeTreeModalOpen(true)}
        onOpenPredictiveGrades={() => setIsPredictiveGradeModalOpen(true)}
        onOpenWorkspaceHub={(tab) => {
          if (tab) setWorkspaceHubTab(tab);
          setIsWorkspaceHubOpen(true);
        }}
        onOpenMaterialImport={() => setIsMaterialImportModalOpen(true)}
        onOpenDeviceSync={() => setIsDeviceSyncModalOpen(true)}
        onOpenQRScanner={() => setIsQRScannerModalOpen(true)}
        onOpenPrintKit={() => setIsPrintKitModalOpen(true)}
        onOpenAudioStudy={() => {
          setAudioStudyInitialMode('voice_flashcards');
          setIsAudioStudyModalOpen(true);
        }}
        onOpenBackupRestore={() => setIsBackupRestoreModalOpen(true)}
        onForceSaveCloud={handleForceSaveCloud}
        onSignOut={handleSignOut}
      />

      {/* Main View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Actionable Email Result Banner */}
        {actionBanner && (
          <div className={`mb-6 p-4 rounded-2xl border text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-fade-in ${
            actionBanner.type === 'error' 
              ? 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200' 
              : actionBanner.type === 'info'
              ? 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-200'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
          }`}>
            <div className="flex items-center gap-2.5">
              <span className="text-base">{actionBanner.type === 'error' ? '⚠️' : actionBanner.type === 'info' ? 'ℹ️' : '📬'}</span>
              <span>{actionBanner.message}</span>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              {(actionBanner.showInspectorBtn || lastSyncDetails) && (
                <button
                  onClick={() => setIsSyncInspectorOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-white/90 dark:bg-black/50 border border-current font-bold text-[11px] hover:opacity-80 transition cursor-pointer flex items-center gap-1"
                  title="Inspect detailed data breakdown and troubleshooting options"
                >
                  <span>🔍 Inspect Details</span>
                </button>
              )}
              {getPreSyncSafetyBackup() && (
                <button
                  onClick={handleRollbackPreSyncBackup}
                  className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-black/40 border border-current font-bold text-[11px] hover:opacity-80 transition cursor-pointer"
                  title="Undo last sync overwrite and restore previous local data"
                >
                  ↩️ Undo / Restore Previous State
                </button>
              )}
              <button
                onClick={() => setActionBanner(null)}
                className="font-bold px-2.5 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Google Calendar Two-Way Reschedule Sync Notification Banner */}
        {calendarReschedules.length > 0 && (
          <div className="mb-6 p-4 rounded-2xl border border-indigo-200 bg-indigo-50/90 dark:border-indigo-800 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-fade-in">
            <div className="flex items-center gap-2.5">
              <span className="text-base">📅</span>
              <div>
                <div className="font-bold">Google Calendar Two-Way Reschedules Detected ({calendarReschedules.length})</div>
                <div className="text-[11px] opacity-80 mt-0.5">
                  {calendarReschedules.map(r => `${r.subjectName}: ${r.newDate}${r.newTimeslot ? ` (${r.newTimeslot})` : ''}`).join(', ')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleApplyCalendarReschedules}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition cursor-pointer shadow-xs"
              >
                Sync Changes into StudyFlow
              </button>
              <button
                onClick={() => setCalendarReschedules([])}
                className="px-2.5 py-1.5 rounded-lg border border-indigo-300 dark:border-indigo-700 text-xs font-semibold hover:bg-black/5 transition cursor-pointer"
              >
                Ignore
              </button>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <DashboardView
            subjects={subjects}
            sessions={sessions}
            plans={plans}
            testResults={testResults}
            revisions={revisions}
            activityLogs={activityLogs}
            assignments={assignments}
            missedWork={missedWork}
            userProfile={userProfile}
            setActiveTab={setActiveTab}
            onStartTimerForTopic={handleStartTimerForTopic}
            onStartBlurtForTopic={handleStartBlurtForTopic}
            onStartTimerForAssignment={handleStartTimerForAssignment}
            onSaveAssignment={handleSaveAssignment}
            onUpdateProfile={handleUpdateProfile}
            onSavePlan={handleSavePlan}
            onTogglePlanTopic={handleTogglePlanTopicComplete}
            onOpenExamAutomationModal={() => setIsExamAutomationModalOpen(true)}
            onOpenEmailAgendaModal={() => setIsEmailAgendaModalOpen(true)}
            onOpenWhatsAppModal={() => setIsWhatsAppModalOpen(true)}
            onOpenVoiceFeynman={() => {
              setFeynmanInitialSubject(undefined);
              setFeynmanInitialConcept(undefined);
              setIsVoiceFeynmanModalOpen(true);
            }}
            onOpenKnowledgeTree={() => setIsKnowledgeTreeModalOpen(true)}
            onOpenPredictiveGrades={() => setIsPredictiveGradeModalOpen(true)}
            onOpenWorkspaceHub={(tab) => {
              if (tab) setWorkspaceHubTab(tab);
              setIsWorkspaceHubOpen(true);
            }}
            onOpenMaterialImport={() => setIsMaterialImportModalOpen(true)}
            onOpenZenSprint={(subj, top) => {
              setZenSprintTopic({ subject: subj, topic: top });
              setIsZenSprintModalOpen(true);
            }}
            onOpenCheatSheet={(subj, top) => {
              setCheatSheetTopic({ subject: subj, topic: top });
              setIsCheatSheetModalOpen(true);
            }}
            onUpdateTopicStatus={async (subjectName, topicName, status) => {
              const subClean = (subjectName || '').toLowerCase();
              const topClean = (topicName || '').toLowerCase();
              const updatedSubjects = subjects.map(s => {
                if ((s.name || '').toLowerCase() !== subClean) return s;
                return {
                  ...s,
                  chapters: s.chapters.map(ch => ({
                    ...ch,
                    topics: ch.topics.map(t => {
                      if ((t.name || '').toLowerCase() === topClean) {
                        return { ...t, status };
                      }
                      return t;
                    })
                  }))
                };
              });
              await handleUpdateSubjects(updatedSubjects);
            }}
            onAddTestResult={handleAddTestResult}
            onAdjustPlanTopicDuration={handleAdjustPlanTopicDuration}
          />
        )}

        {activeTab === 'gamification' && (
          <GamificationView
            profile={rpgProfile}
            rpgProfile={rpgProfile}
            onUpdateProfile={handleUpdateRPGProfile}
            onUpdateRPGProfile={handleUpdateRPGProfile}
            subjects={subjects}
            onStartTimerForTopic={handleStartTimerForTopic}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'virtual_room' && (
          <VirtualStudyRoomView
            subjects={subjects}
            plans={plans}
            userProfile={userProfile}
            onSessionComplete={handleVirtualRoomSessionComplete}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'missed_work' && (
          <MissedWorkView
            missedWork={missedWork}
            subjects={subjects}
            userProfile={userProfile}
            plans={plans}
            onSaveMissedWorkItem={handleSaveMissedWorkItem}
            onSaveAllMissedWork={handleSaveAllMissedWork}
            onDeleteMissedWorkItem={handleDeleteMissedWorkItem}
            onStartTimerForTopic={handleStartTimerForTopic}
            onAutoDetectOverdue={handleAutoDetectOverdue}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'assignments' && (
          <AssignmentsView
            assignments={assignments}
            subjects={subjects}
            vaults={vaults}
            onSaveAssignment={handleSaveAssignment}
            onDeleteAssignment={handleDeleteAssignment}
            onStartTimerForAssignment={handleStartTimerForAssignment}
            onAskTutor={(prompt, sub, top) => {
              setTutorPrompt(prompt);
              setActiveTab('tutor');
            }}
            onCreateFlashcards={(title, sub, notes) => {
              setActiveTab('flashcards');
            }}
            onLogTestResult={(asg) => {
              setActiveTab('tests');
            }}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'classroom' && (
          <ClassroomCourseView
            subjects={subjects}
            testResults={testResults}
            plans={plans}
            sessions={sessions}
            revisions={revisions}
            notes={notes}
            vaults={vaults}
            activityLogs={activityLogs}
            flashcardDecks={flashcardDecks}
            userProfile={userProfile}
            user={user}
            setActiveTab={setActiveTab}
            onSendPromptToTutor={handleSendPromptToTutor}
            onStartTimerWithTopic={handleStartTimerForTopic}
            onOpenMaterialImport={() => setIsMaterialImportModalOpen(true)}
            onCreateVault={handleCreateVault}
            onOpenDeviceSync={() => setIsDeviceSyncModalOpen(true)}
            onUpdateSubjects={handleUpdateSubjects}
            onUpdateProfile={handleUpdateProfile}
          />
        )}

        {activeTab === 'groups' && (
          <StudyGroupsView
            groups={groups}
            user={user}
            userProfile={userProfile}
            subjects={subjects}
            sessions={sessions}
            onUpdateGroup={handleUpdateGroup}
            onCreateGroup={handleCreateGroup}
            onDeleteGroup={handleDeleteGroup}
            onStartTimerForTopic={handleStartTimerForTopic}
            onSendPromptToTutor={handleSendPromptToTutor}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'flashcards' && (
          <FlashcardsView
            subjects={subjects}
            decks={flashcardDecks}
            onSaveDeck={handleSaveFlashcardDeck}
            onDeleteDeck={handleDeleteFlashcardDeck}
            onStartTimerForTopic={handleStartTimerForTopic}
            onOpenAudioStudy={(deckId) => {
              setAudioStudyInitialDeckId(deckId);
              setAudioStudyInitialMode('voice_flashcards');
              setIsAudioStudyModalOpen(true);
            }}
            onOpenPrintKit={() => setIsPrintKitModalOpen(true)}
          />
        )}

        {activeTab === 'blurt_recall' && (
          <BlurtRecallView
            subjects={subjects}
            plans={plans}
            revisions={revisions}
            notes={notes}
            activityLogs={activityLogs}
            userProfile={userProfile}
            initialTopic={blurtInitialTopic}
            onLogActivity={handleAddActivityLog}
            onSaveRevision={handleAddRevisionTopic}
            onSaveFlashcardDeck={handleSaveFlashcardDeck}
            onUpdateTopicStatus={async (subjectName, topicName, status) => {
              const subClean = (subjectName || '').toLowerCase();
              const topClean = (topicName || '').toLowerCase();
              const updatedSubjects = subjects.map(s => {
                if ((s.name || '').toLowerCase() !== subClean) return s;
                return {
                  ...s,
                  chapters: s.chapters.map(ch => ({
                    ...ch,
                    topics: ch.topics.map(t => {
                      if ((t.name || '').toLowerCase() === topClean) {
                        return { ...t, status };
                      }
                      return t;
                    })
                  }))
                };
              });
              await handleUpdateSubjects(updatedSubjects);
            }}
            onStartTimerForTopic={handleStartTimerForTopic}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'syllabus' && (
          <SyllabusView
            subjects={subjects}
            onUpdateSubjects={handleUpdateSubjects}
            onOpenMaterialImport={() => setIsMaterialImportModalOpen(true)}
            onOpenDeviceSync={() => setIsDeviceSyncModalOpen(true)}
            onOpenQRScanner={() => setIsQRScannerModalOpen(true)}
            lastSyncDetails={lastSyncDetails}
            onOpenSyncInspector={() => setIsSyncInspectorOpen(true)}
            testResults={testResults}
            vaults={vaults}
            onAddTestResult={handleAddTestResult}
            setActiveTab={setActiveTab}
            selectedSubjectId={selectedSubjectId}
          />
        )}

        {activeTab === 'planner' && (
          <PlannerView
            subjects={subjects}
            sessions={sessions}
            testResults={testResults}
            plans={plans}
            assignments={assignments}
            userProfile={userProfile}
            onSavePlan={handleSavePlan}
            setActiveTab={setActiveTab}
            onStartTimerForTopic={handleStartTimerForTopic}
            onTogglePlanTopic={handleTogglePlanTopicComplete}
            onAdjustPlanTopicDuration={handleAdjustPlanTopicDuration}
            onOpenEmailAgendaModal={() => setIsEmailAgendaModalOpen(true)}
            onOpenPrintKit={() => setIsPrintKitModalOpen(true)}
          />
        )}

        {activeTab === 'timer' && (
          <StudyTimerView
            subjects={subjects}
            initialSubject={timerTopic.subject}
            initialChapter={timerTopic.chapter}
            initialTopic={timerTopic.topic}
            onSaveSession={handleSaveSession}
            userProfile={userProfile}
            sessions={sessions}
            user={user}
            notes={notes}
            onLogActivity={handleAddActivityLog}
            onSaveRevision={handleAddRevisionTopic}
            onUpdateTopicStatus={async (subjectName, topicName, status) => {
              const subClean = (subjectName || '').toLowerCase();
              const topClean = (topicName || '').toLowerCase();
              const updatedSubjects = subjects.map(s => {
                if ((s.name || '').toLowerCase() !== subClean) return s;
                return {
                  ...s,
                  chapters: s.chapters.map(ch => ({
                    ...ch,
                    topics: ch.topics.map(t => {
                      if ((t.name || '').toLowerCase() === topClean) {
                        return { ...t, status };
                      }
                      return t;
                    })
                  }))
                };
              });
              await handleUpdateSubjects(updatedSubjects);
            }}
            onNavigateTab={setActiveTab}
            onOpenZenSprint={(subj, top) => {
              setZenSprintTopic({ subject: subj, topic: top });
              setIsZenSprintModalOpen(true);
            }}
            onOpenCheatSheet={(subj, top) => {
              setCheatSheetTopic({ subject: subj, topic: top });
              setIsCheatSheetModalOpen(true);
            }}
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarView
            sessions={sessions}
            plans={plans}
            testResults={testResults}
            revisions={revisions}
            assignments={assignments}
            userProfile={userProfile}
            subjects={subjects}
            onSavePlan={handleSavePlan}
            onUpdateProfile={handleUpdateProfile}
            onStartTimerForTopic={handleStartTimerForTopic}
            setActiveTab={setActiveTab}
            onOpenWorkspaceHub={(tab) => {
              if (tab) setWorkspaceHubTab(tab);
              setIsWorkspaceHubOpen(true);
            }}
          />
        )}

        {activeTab === 'progress' && (
          <ProgressView 
            subjects={subjects} 
            userProfile={userProfile}
            testResults={testResults}
            flashcardDecks={flashcardDecks}
            sessions={sessions}
            revisions={revisions}
            onStartTimerForTopic={handleStartTimerForTopic}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'revision' && (
          <RevisionView
            subjects={subjects}
            revisions={revisions}
            sessions={sessions}
            onStartTimerForTopic={handleStartTimerForTopic}
            onMarkRevisionDone={handleMarkRevisionDone}
            onDeleteRevision={handleDeleteRevision}
            onAddRevisionTopic={handleAddRevisionTopic}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'tests' && (
          <TestsView
            subjects={subjects}
            testResults={testResults}
            vaults={vaults}
            userProfile={userProfile}
            user={user}
            plans={plans}
            sessions={sessions}
            onAddTestResult={handleAddTestResult}
            onUpdateTestResult={handleUpdateTestResult}
            onSavePlan={handleSavePlan}
            setActiveTab={setActiveTab}
            onSendPromptToTutor={handleSendPromptToTutor}
            onSelectTopicInSyllabus={() => setActiveTab('syllabus')}
          />
        )}

        {activeTab === 'gemini_notebook' && (
          <GeminiNotebookHub
            subjects={subjects}
            activeSubject={subjects[0] || null}
            testResults={testResults}
            onUpdateSubjects={handleUpdateSubjects}
            onOpenTopicSprint={(_topicName) => {
              setActiveTab('timer');
            }}
          />
        )}

        {activeTab === 'boss_battle' && (
          <ExamBossBattleView
            subjects={subjects}
            activeSubject={subjects[0] || null}
            onLogMistake={(mistake) => {
              addMistake({
                subjectName: mistake.subjectName,
                topicName: mistake.topicName,
                question: mistake.question,
                userAttempt: mistake.userMistake,
                correctAnswer: mistake.correctApproach,
                errorCategory: 'concept_gap',
                notes: 'Logged during RPG Boss Battle counterattack',
                source: 'quiz'
              });
            }}
            onStartFocusSprint={(_topicName) => {
              setActiveTab('timer');
            }}
          />
        )}

        {activeTab === 'knowledge_graph' && (
          <KnowledgeGraphExplorerView
            subjects={subjects}
            activeSubject={subjects[0] || null}
            onStartFocusSprint={(_topicName) => {
              setActiveTab('timer');
            }}
            onLaunchBossBattle={(_topicName, _subjectName) => {
              setActiveTab('boss_battle');
            }}
            onOpenGeminiResearch={(_topicName, _subjectName) => {
              setActiveTab('gemini_notebook');
            }}
            onLaunchBlurtRecall={(topicName, subjectName) => {
              handleStartBlurtForTopic(subjectName, '', topicName);
            }}
            onReviewFlashcards={(_topicName, _subjectName) => {
              setActiveTab('flashcards');
            }}
          />
        )}

        {activeTab === 'examiner_red_pen' && (
          <ExaminersRedPenView
            subjects={subjects}
            onNavigateToMistakeVault={() => setActiveTab('mistake_vault')}
            onAwardXP={handleAwardXP}
          />
        )}

        {activeTab === 'mistake_vault' && (
          <MistakeVaultView
            subjects={subjects}
            onNavigateToRedPen={() => setActiveTab('examiner_red_pen')}
            onAwardXP={handleAwardXP}
          />
        )}

        {activeTab === 'vaults' && (
          <VaultsView
            vaults={vaults}
            subjects={subjects}
            testResults={testResults}
            userProfile={userProfile}
            user={user}
            plans={plans}
            sessions={sessions}
            flashcardDecks={flashcardDecks}
            revisions={revisions}
            onSaveVault={handleCreateVault}
            onCreateVault={handleCreateVault}
            onUpdateVault={handleUpdateVault}
            onDeleteVault={handleDeleteVault}
            onAddTestResult={handleAddTestResult}
            onUpdateTestResult={handleUpdateTestResult}
            onDeleteTestResult={handleDeleteTestResult}
            setActiveTab={setActiveTab}
            onNavigateTab={setActiveTab}
            onSendPromptToTutor={handleSendPromptToTutor}
          />
        )}

        {activeTab === 'activity' && (
          <ActivityView
            sessions={sessions}
            activityLogs={activityLogs}
          />
        )}

        {activeTab === 'tutor' && (
          <AITutorView
            subjects={subjects}
            sessions={sessions}
            testResults={testResults}
            plans={plans}
            userProfile={userProfile}
            initialPrompt={tutorPrompt}
          />
        )}

        {activeTab === 'knowledge_refurbish' && (
          <KnowledgeRefurbishmentView
            subjects={subjects}
            userLanguage={userLanguage}
            onNavigateToTab={(t) => setActiveTab(t as any)}
          />
        )}

        {activeTab === 'marks_recovery' && (
          <MarksRecoveryEngineView
            subjects={subjects}
            testResults={testResults}
            userLanguage={userLanguage}
            onNavigateToTab={(t) => setActiveTab(t as any)}
            onStartRefurbishForTopic={() => {
              setActiveTab('knowledge_refurbish');
            }}
          />
        )}

        {activeTab === 'paper_auto_forcing' && (
          <PaperAutoForcingView
            testResults={testResults}
            userLanguage={userLanguage}
            onNavigateToTab={(t) => setActiveTab(t as any)}
          />
        )}

        {activeTab === 'data_backup' && (
          <DataPortabilityView
            user={user}
            userProfile={userProfile}
            subjects={subjects}
            sessions={sessions}
            plans={plans}
            testResults={testResults}
            activityLogs={activityLogs}
            revisions={revisions}
            flashcardDecks={flashcardDecks}
            groups={groups}
            onUpdateSubjects={handleUpdateSubjects}
            onUpdateProfile={handleUpdateProfile}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            user={user}
            userProfile={userProfile}
            subjects={subjects}
            sessions={sessions}
            plans={plans}
            testResults={testResults}
            activityLogs={activityLogs}
            revisions={revisions}
            flashcardDecks={flashcardDecks}
            groups={groups}
            themeConfig={themeConfig}
            onUpdateTheme={handleUpdateTheme}
            onUpdateSubjects={handleUpdateSubjects}
            onUpdateProfile={handleUpdateProfile}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            onOpenEmailAgendaModal={() => setIsEmailAgendaModalOpen(true)}
            onOpenDeviceSync={() => setIsDeviceSyncModalOpen(true)}
            onNavigateToDataBackup={() => setActiveTab('data_backup')}
            onSignOut={handleSignOut}
          />
        )}
      </main>

      {/* Email Agenda Modal */}
      <EmailAgendaModal
        isOpen={isEmailAgendaModalOpen}
        onClose={() => setIsEmailAgendaModalOpen(false)}
        todayPlan={todayPlan}
        todaySessions={todaySessions}
        subjects={subjects}
        revisions={revisions}
        userProfile={userProfile}
        testResults={testResults}
        assignments={assignments}
        missedWork={missedWork}
        user={user}
      />

      {/* Google Workspace Hub Modal (Classroom, Docs, Meet, Tasks, Calendar, Drive, Keep) */}
      <GoogleWorkspaceHubModal
        isOpen={isWorkspaceHubOpen}
        onClose={() => setIsWorkspaceHubOpen(false)}
        initialTab={workspaceHubTab}
        plans={plans}
        sessions={sessions}
        subjects={subjects}
        revisions={revisions}
        examDates={userProfile?.examDates || []}
        flashcardDecks={flashcardDecks}
        testResults={testResults}
        assignments={assignments}
        userProfile={userProfile}
        onImportClassroomSubject={handleImportClassroomSubject}
      />

      {/* Autonomous AI Material Ingestion Modal */}
      <AIMaterialImportModal
        isOpen={isMaterialImportModalOpen}
        onClose={() => setIsMaterialImportModalOpen(false)}
        onApproveAndSave={handleApproveExtractedMaterial}
      />

      {/* Printable Study Kit & Wall Planner Exporter Modal */}
      <PrintableStudyKitModal
        isOpen={isPrintKitModalOpen}
        onClose={() => setIsPrintKitModalOpen(false)}
        subjects={subjects}
        flashcardDecks={flashcardDecks}
        plans={plans}
        userProfile={userProfile}
        revisions={revisions}
      />

      {/* Audio Study & Voice Flashcard Mode Modal */}
      <AudioStudyModal
        isOpen={isAudioStudyModalOpen}
        onClose={() => setIsAudioStudyModalOpen(false)}
        subjects={subjects}
        flashcardDecks={flashcardDecks}
        initialDeckId={audioStudyInitialDeckId}
        initialMode={audioStudyInitialMode}
      />

      {/* Edit User & Academic Year Profile Modal */}
      <EditYearProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        userProfile={userProfile}
        onUpdateProfile={handleUpdateProfile}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onEmailChanged={(newEmail) => {
          setActiveEmail(newEmail);
          handleUpdateProfile({ email: newEmail });
        }}
      />

      {/* Device & Active Study Email Sync Modal */}
      <DeviceEmailSyncModal
        isOpen={isDeviceSyncModalOpen}
        onClose={() => setIsDeviceSyncModalOpen(false)}
        user={user}
        userProfile={userProfile}
        subjects={subjects}
        plans={plans}
        sessions={sessions}
        vaults={vaults}
        assignments={assignments}
        testResults={testResults}
        flashcardDecks={flashcardDecks}
        revisions={revisions}
        notes={notes}
        activityLogs={activityLogs}
        onEmailChanged={(newEmail) => {
          setActiveEmail(newEmail);
          handleUpdateProfile({ email: newEmail });
        }}
        onRestoreData={handleRestoreFullSnapshot}
        onOpenQRScanner={() => setIsQRScannerModalOpen(true)}
      />

      {/* In-App Optical QR Scanner Modal */}
      <InAppQRScannerModal
        isOpen={isQRScannerModalOpen}
        onClose={() => setIsQRScannerModalOpen(false)}
        onHandleParsedResult={handleQRScanResult}
        onOpenExamPresets={() => {
          setActiveTab('syllabus');
        }}
      />

      {/* Sync Details & Data Troubleshooter Modal */}
      <SyncInspectorModal
        isOpen={isSyncInspectorOpen}
        onClose={() => setIsSyncInspectorOpen(false)}
        details={lastSyncDetails}
        onLoadExamPresets={() => {
          setActiveTab('syllabus');
        }}
        onOpenEmailSync={() => setIsDeviceSyncModalOpen(true)}
        onOpenQRScanner={() => setIsQRScannerModalOpen(true)}
        onOpenUploadSyllabus={() => {
          setActiveTab('syllabus');
        }}
        onRollbackPreSyncBackup={handleRollbackPreSyncBackup}
      />

      {/* Offline Data Integrity & Encrypted Backup / Restore Modal */}
      <BackupRestoreModal
        isOpen={isBackupRestoreModalOpen}
        onClose={() => setIsBackupRestoreModalOpen(false)}
        subjects={subjects}
        sessions={sessions}
        plans={plans}
        vaults={vaults}
        assignments={assignments}
        testResults={testResults}
        flashcardDecks={flashcardDecks}
        revisions={revisions}
        notes={notes}
        activityLogs={activityLogs}
        userProfile={userProfile}
        onRestoreSnapshot={async (data) => {
          await handleRestoreFullSnapshot(data);
          setActionBanner({
            message: '🎉 Encrypted study snapshot restored successfully! All subjects, plans, and vaults have been updated.',
            type: 'success'
          });
        }}
      />

      {/* WhatsApp Assistant & Study Flight Plan Modal */}
      <WhatsAppAssistantModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        streak={rpgProfile.streak}
        priorityTopics={subjects.flatMap(s => 
          s.chapters.flatMap(c => 
            c.topics.filter(t => t.status === 'Needs Revision' || t.status === 'In Progress').map(t => ({
              subject: s.name,
              title: t.name,
              duration: t.timeSpentMinutes ? Math.max(25, t.timeSpentMinutes) : 45
            }))
          )
        ).slice(0, 3)}
        flashcardsDueCount={flashcardDecks.reduce((acc, d) => acc + d.cards.length, 0)}
        dailyGoalHours={userProfile?.targetHoursPerDay || 3}
        hoursStudiedToday={Number((todaySessions.reduce((acc, s) => acc + s.durationMinutes, 0) / 60).toFixed(1))}
        xpEarnedToday={120}
      />

      {/* Voice Socratic Feynman Oral Exam Modal */}
      <VoiceFeynmanOralExamModal
        isOpen={isVoiceFeynmanModalOpen}
        onClose={() => setIsVoiceFeynmanModalOpen(false)}
        subjects={subjects}
        initialSubject={feynmanInitialSubject}
        initialConcept={feynmanInitialConcept}
        userProfile={userProfile}
        onLogActivity={handleAddActivityLog}
        onAwardXP={(xp, reason) => {
          const updated = awardXPAndGems(xp, 0, reason);
          setRpgProfile(updated);
          saveRPGProfile(updated);
        }}
      />

      {/* Interactive Visual Knowledge Tree Modal */}
      <KnowledgeTreeModal
        isOpen={isKnowledgeTreeModalOpen}
        onClose={() => setIsKnowledgeTreeModalOpen(false)}
        subjects={subjects}
        onStartTimerForTopic={handleStartTimerForTopic}
        onStartBlurtForTopic={handleStartBlurtForTopic}
        onStartFeynmanForTopic={(sub, top) => {
          setFeynmanInitialSubject(sub);
          setFeynmanInitialConcept(top);
          setIsKnowledgeTreeModalOpen(false);
          setIsVoiceFeynmanModalOpen(true);
        }}
      />

      {/* Predictive Grade & Low-Stress Exam Readiness Simulator */}
      <PredictiveGradeSimulatorModal
        isOpen={isPredictiveGradeModalOpen}
        onClose={() => setIsPredictiveGradeModalOpen(false)}
        subjects={subjects}
        testResults={testResults}
        userProfile={userProfile}
        onNavigateToTests={() => {
          setIsPredictiveGradeModalOpen(false);
          setActiveTab('tests');
        }}
        onStartComfortTest={() => {
          setIsPredictiveGradeModalOpen(false);
          setActiveTab('tests');
        }}
      />

      {/* 24/7 Automated Exam Countdown & Syllabus Digest Dispatch Center */}
      <ExamAutomationCenterModal
        isOpen={isExamAutomationModalOpen}
        onClose={() => setIsExamAutomationModalOpen(false)}
        subjects={subjects}
        revisionItems={revisions}
        userProfile={userProfile}
        examDates={userProfile?.examDates || []}
        plans={plans}
        testResults={testResults}
        assignments={assignments}
        onUpdateExamDates={(updated) => {
          handleUpdateProfile({ examDates: updated });
        }}
        onUpdateProfile={handleUpdateProfile}
      />

      {/* Zen Study Mode Sprint Modal (Option 1) */}
      <ZenStudySprintModal
        isOpen={isZenSprintModalOpen}
        onClose={() => setIsZenSprintModalOpen(false)}
        subjects={subjects}
        initialSubject={zenSprintTopic.subject}
        initialTopic={zenSprintTopic.topic}
        onSaveSession={handleSaveSession}
        onOpenCheatSheet={(subj, top) => {
          setCheatSheetTopic({ subject: subj, topic: top });
          setIsCheatSheetModalOpen(true);
        }}
        onSelectTopicInSyllabus={() => {
          setIsZenSprintModalOpen(false);
          setActiveTab('syllabus');
        }}
      />

      {/* AI High-Yield Cheat Sheet Generator Modal (Option 6) */}
      <AICheatSheetGeneratorModal
        isOpen={isCheatSheetModalOpen}
        onClose={() => setIsCheatSheetModalOpen(false)}
        subjects={subjects}
        initialSubject={cheatSheetTopic.subject}
        initialTopic={cheatSheetTopic.topic}
        onStartSprintForTopic={(subj, _ch, top) => {
          setZenSprintTopic({ subject: subj, topic: top });
          setIsCheatSheetModalOpen(false);
          setIsZenSprintModalOpen(true);
        }}
        onSaveToVault={async (title, content, subjectName) => {
          await handleCreateVault({
            userId: effectiveUid,
            name: title,
            subjectName: subjectName,
            category: 'exam_prep',
            description: content.slice(0, 200) + '...',
            icon: '📄',
            tags: ['Cheat Sheet', subjectName, 'AI Generated'],
            createdAt: new Date().toISOString()
          });
          setActionBanner({
            message: `📑 Cheat Sheet "${title}" successfully saved to your Study Vault!`,
            type: 'success'
          });
        }}
      />

      {/* Global Command Palette (Cmd + K / Ctrl + K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        setActiveTab={setActiveTab}
        subjects={subjects}
        onSelectSubject={(subjectId) => {
          setSelectedSubjectId(subjectId);
        }}
        onToggleTheme={() => {
          const nextMode = themeConfig.mode === 'dark' ? 'light' : 'dark';
          handleUpdateTheme({ mode: nextMode });
        }}
        onTriggerAutonomousPushTest={async () => {
          const res = await triggerServerAutonomousPushTest();
          setActionBanner({
            message: res.success 
              ? '🎯 Autonomous Server Push Notification Dispatched!' 
              : `Push notification error: ${res.message}`,
            type: res.success ? 'success' : 'error'
          });
        }}
      />
    </div>
  );
}
