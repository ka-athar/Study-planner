import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  BookOpen, 
  Plus, 
  Trash2, 
  Clock, 
  Download, 
  Upload, 
  User, 
  LogOut, 
  Award, 
  Sparkles, 
  AlertCircle, 
  Save, 
  CheckCircle2,
  Mail,
  Cloud,
  RefreshCw,
  HardDrive,
  ShieldCheck,
  Database,
  Layers,
  Check,
  Server,
  FileDown,
  Sun,
  Moon,
  Laptop,
  Palette,
  Send,
  Bell,
  Eye,
  Zap,
  GraduationCap,
  Building2,
  Target,
  Calendar,
  Smartphone,
  Tablet,
  Monitor,
  Globe,
  Key,
  Edit3,
  Radio,
  Trash,
  Languages,
  ChevronLeft,
  ChevronRight,
  RotateCw
} from 'lucide-react';
import { getSavedLanguage, saveLanguagePreference, AppLanguage } from '../lib/translations';
import { 
  Subject, 
  UserProfile, 
  ExamDate,
  StudySession,
  StudyPlan,
  TestResult,
  ActivityLog,
  RevisionItem,
  FlashcardDeck,
  StudyGroup,
  ThemeConfig,
  ThemeMode,
  ThemePreset,
  UserDevice
} from '../types';
import { 
  exportAllUserData, 
  importUserData, 
  forceSyncAllToCloud, 
  subscribeSyncStatus, 
  SyncStatusInfo, 
  loadAllDataFromLocal,
  BatchUploadProgress,
  getActiveUserEmail,
  setActiveUserEmail,
  resolveActiveUserId
} from '../lib/db';
import {
  subscribeUserDevices,
  revokeDevice,
  revokeAllOtherDevices,
  updateDeviceName,
  getOrCreateDeviceId
} from '../lib/deviceService';
import {
  getMorningBriefingConfig,
  saveMorningBriefingConfig,
  dispatchMorningBriefingNow,
  MorningBriefingLogItem
} from '../lib/gmailService';

interface SettingsViewProps {
  user: any;
  userProfile: UserProfile | null;
  subjects: Subject[];
  sessions?: StudySession[];
  plans?: StudyPlan[];
  testResults?: TestResult[];
  activityLogs?: ActivityLog[];
  revisions?: RevisionItem[];
  flashcardDecks?: FlashcardDeck[];
  groups?: StudyGroup[];
  themeConfig?: ThemeConfig;
  onUpdateTheme?: (theme: Partial<ThemeConfig>) => void;
  onUpdateSubjects: (subjects: Subject[]) => void;
  onUpdateProfile: (profile: Partial<UserProfile>) => void;
  onOpenAuthModal: () => void;
  onOpenEmailAgendaModal?: () => void;
  onOpenDeviceSync?: () => void;
  onNavigateToDataBackup?: () => void;
  onSignOut: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  userProfile,
  subjects,
  sessions = [],
  plans = [],
  testResults = [],
  activityLogs = [],
  revisions = [],
  flashcardDecks = [],
  groups = [],
  themeConfig,
  onUpdateTheme,
  onUpdateSubjects,
  onUpdateProfile,
  onOpenAuthModal,
  onOpenEmailAgendaModal,
  onOpenDeviceSync,
  onNavigateToDataBackup,
  onSignOut
}) => {
  // Editable subjects state
  const [editingSubjects, setEditingSubjects] = useState<Subject[]>(subjects);
  const [newSubjectName, setNewSubjectName] = useState<string>('');

  // Daily target hours
  const [targetHours, setTargetHours] = useState<number>(userProfile?.targetHoursPerDay || 3);

  // Application language state
  const [currentLang, setCurrentLang] = useState<AppLanguage>(() => getSavedLanguage());

  const handleLanguageChange = (newLang: AppLanguage) => {
    setCurrentLang(newLang);
    saveLanguagePreference(newLang);
  };

  // Year Profile & Academic Credentials State
  const [editDisplayName, setEditDisplayName] = useState<string>(userProfile?.displayName || userProfile?.name || 'Student');
  const [editAcademicYear, setEditAcademicYear] = useState<string>(userProfile?.academicYear || '2026 - 2027');
  const [editYearLevel, setEditYearLevel] = useState<string>(userProfile?.yearLevel || 'Year 3 (Junior)');
  const [editSemesterOrTerm, setEditSemesterOrTerm] = useState<string>(userProfile?.semesterOrTerm || 'Fall Semester');
  const [editTargetExamYear, setEditTargetExamYear] = useState<string>(userProfile?.targetExamYear || '2027');
  const [editInstitution, setEditInstitution] = useState<string>(userProfile?.institution || 'Academic University');
  const [editMajorOrStream, setEditMajorOrStream] = useState<string>(userProfile?.majorOrStream || 'STEM & Computer Science');
  const [editStartDate, setEditStartDate] = useState<string>(userProfile?.academicYearStartDate || '2026-08-01');
  const [editEndDate, setEditEndDate] = useState<string>(userProfile?.academicYearEndDate || '2027-05-31');
  const [editTargetGpa, setEditTargetGpa] = useState<string>(userProfile?.targetGpaOrScore || '3.8 GPA / 90%+');

  // Sync state if userProfile changes
  useEffect(() => {
    if (userProfile) {
      if (userProfile.displayName) setEditDisplayName(userProfile.displayName);
      if (userProfile.academicYear) setEditAcademicYear(userProfile.academicYear);
      if (userProfile.yearLevel) setEditYearLevel(userProfile.yearLevel);
      if (userProfile.semesterOrTerm) setEditSemesterOrTerm(userProfile.semesterOrTerm);
      if (userProfile.targetExamYear) setEditTargetExamYear(userProfile.targetExamYear);
      if (userProfile.institution) setEditInstitution(userProfile.institution);
      if (userProfile.majorOrStream) setEditMajorOrStream(userProfile.majorOrStream);
      if (userProfile.academicYearStartDate) setEditStartDate(userProfile.academicYearStartDate);
      if (userProfile.academicYearEndDate) setEditEndDate(userProfile.academicYearEndDate);
      if (userProfile.targetGpaOrScore) setEditTargetGpa(userProfile.targetGpaOrScore);
      if (userProfile.targetHoursPerDay) setTargetHours(userProfile.targetHoursPerDay);
    }
  }, [userProfile]);

  // Exam dates
  const [examDates, setExamDates] = useState<ExamDate[]>(userProfile?.examDates || []);
  const [newExamSubject, setNewExamSubject] = useState<string>(subjects[0]?.name || '');
  const [newExamName, setNewExamName] = useState<string>('');
  const [newExamDateStr, setNewExamDateStr] = useState<string>('');

  // Backup & Restore status
  const [backupMessage, setBackupMessage] = useState<string>('');
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState<boolean>(false);
  const [importJsonText, setImportJsonText] = useState<string>('');
  const [isSyncingNow, setIsSyncingNow] = useState<boolean>(false);
  const [syncEmailInput, setSyncEmailInput] = useState<string>(getActiveUserEmail());
  const [emailSyncMessage, setEmailSyncMessage] = useState<string>('');

  // Batch upload live progress state
  const [batchProgress, setBatchProgress] = useState<BatchUploadProgress | null>(null);
  const [batchLogs, setBatchLogs] = useState<string[]>([]);

  // Sync state
  const [syncInfo, setSyncInfo] = useState<SyncStatusInfo>({
    state: 'saved',
    lastSavedAt: null,
    mode: 'local',
    message: 'Instant Cache Active'
  });

  // Device Management State
  const [userDevices, setUserDevices] = useState<UserDevice[]>([]);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [editDeviceNameVal, setEditDeviceNameVal] = useState<string>('');
  const [deviceActionMsg, setDeviceActionMsg] = useState<string>('');
  const [isRevokingId, setIsRevokingId] = useState<string | null>(null);
  const currentDeviceId = getOrCreateDeviceId();
  const effectiveUid = resolveActiveUserId(user, syncEmailInput || userProfile?.email || null);

  useEffect(() => {
    if (!effectiveUid) return;
    const unsub = subscribeUserDevices(effectiveUid, (devices) => {
      setUserDevices(devices);
    });
    return () => unsub();
  }, [effectiveUid]);

  const handleRevokeDevice = async (deviceId: string, name: string) => {
    if (!confirm(`Are you sure you want to securely sign out "${name}"? This device will be disconnected from your account.`)) {
      return;
    }
    setIsRevokingId(deviceId);
    try {
      await revokeDevice(effectiveUid, deviceId);
      setDeviceActionMsg(`Device "${name}" was remotely signed out successfully.`);
      setTimeout(() => setDeviceActionMsg(''), 4000);
    } catch (err: any) {
      setDeviceActionMsg(`Failed to sign out device: ${err.message || err}`);
    } finally {
      setIsRevokingId(null);
    }
  };

  const handleRevokeAllOtherDevices = async () => {
    if (!confirm('Are you sure you want to sign out ALL other devices? Only this current device will remain logged in.')) {
      return;
    }
    setIsRevokingId('all');
    try {
      const count = await revokeAllOtherDevices(effectiveUid);
      setDeviceActionMsg(`Successfully signed out ${count} other device(s).`);
      setTimeout(() => setDeviceActionMsg(''), 4000);
    } catch (err: any) {
      setDeviceActionMsg(`Failed: ${err.message || err}`);
    } finally {
      setIsRevokingId(null);
    }
  };

  const handleSaveDeviceName = async (deviceId: string) => {
    if (!editDeviceNameVal.trim()) {
      setEditingDeviceId(null);
      return;
    }
    try {
      await updateDeviceName(effectiveUid, deviceId, editDeviceNameVal.trim());
      setEditingDeviceId(null);
      setDeviceActionMsg('Device name updated.');
      setTimeout(() => setDeviceActionMsg(''), 3000);
    } catch (err: any) {
      setDeviceActionMsg(`Failed to update name: ${err.message || err}`);
    }
  };

  // Morning Briefing Automated Scheduler Settings
  const [briefingConfig, setBriefingConfig] = useState(() => 
    getMorningBriefingConfig(userProfile?.email || user?.email || syncEmailInput || '', userProfile?.displayName || user?.displayName)
  );
  const [isDispatchingBriefing, setIsDispatchingBriefing] = useState<boolean>(false);
  const [briefingStatusMsg, setBriefingStatusMsg] = useState<string>('');

  useEffect(() => {
    const unsub = subscribeSyncStatus(setSyncInfo);
    return () => unsub();
  }, []);

  // Update Briefing config when user profile changes
  useEffect(() => {
    const current = getMorningBriefingConfig(userProfile?.email || user?.email || syncEmailInput || '');
    setBriefingConfig(current);
  }, [userProfile, user, syncEmailInput]);

  const handleSaveBriefingConfig = (updates: Partial<typeof briefingConfig>) => {
    const next = { ...briefingConfig, ...updates };
    setBriefingConfig(next);
    saveMorningBriefingConfig(next);
    setBackupMessage("Automated briefing schedule updated!");
    setTimeout(() => setBackupMessage(''), 3000);
  };

  const handleTestDispatchBriefing = async () => {
    setIsDispatchingBriefing(true);
    setBriefingStatusMsg('Preparing and dispatching 7:30 AM morning briefing...');
    try {
      const todayDateStr = new Date().toISOString().split('T')[0];
      const todayPlan = plans.find(p => p.date === todayDateStr) || plans[0] || null;
      const todaySessions = sessions.filter(s => s.date === todayDateStr || (s.timestamp && Date.now() - s.timestamp <= 24 * 60 * 60 * 1000));

      const res = await dispatchMorningBriefingNow({
        todayPlan,
        todaySessions,
        subjects,
        revisions,
        userProfile,
        testResults,
        recipientEmailOverride: briefingConfig.recipientEmail || user?.email || syncEmailInput || '',
        forceTokenPrompt: true
      });

      setBriefingStatusMsg(`✅ Dispatched successfully! (Message ID: ${res.messageId || 'OK'})`);
      // Reload history
      setBriefingConfig(getMorningBriefingConfig(briefingConfig.recipientEmail));
    } catch (err: any) {
      setBriefingStatusMsg(`❌ Dispatch failed: ${err.message || 'Error occurred'}`);
    } finally {
      setIsDispatchingBriefing(false);
    }
  };

  // Save Subject List
  const handleSaveSubjects = () => {
    onUpdateSubjects(editingSubjects);
    setBackupMessage("Subjects updated successfully!");
    setTimeout(() => setBackupMessage(''), 3000);
  };

  const handleAddSubject = () => {
    if (!newSubjectName.trim()) return;
    const newSubObj: Subject = {
      id: `sub-${Date.now()}`,
      name: newSubjectName.trim(),
      color: '#3B82F6',
      chapters: []
    };
    setEditingSubjects([...editingSubjects, newSubObj]);
    setNewSubjectName('');
  };

  const handleDeleteSubject = (id: string) => {
    setEditingSubjects(editingSubjects.filter(s => s.id !== id));
  };

  // Exam Dates
  const handleAddExamDate = () => {
    if (!newExamName || !newExamDateStr) return;
    const newExam: ExamDate = {
      id: `exam-${Date.now()}`,
      subjectName: newExamSubject || subjects[0]?.name || 'General',
      examName: newExamName,
      date: newExamDateStr
    };
    const updated = [...examDates, newExam];
    setExamDates(updated);
    onUpdateProfile({ examDates: updated });
    setNewExamName('');
    setNewExamDateStr('');
  };

  const handleDeleteExamDate = (id: string) => {
    const updated = examDates.filter(e => e.id !== id);
    setExamDates(updated);
    onUpdateProfile({ examDates: updated });
  };

  // Target Study Hours
  const handleSaveTargetHours = () => {
    onUpdateProfile({ targetHoursPerDay: targetHours });
    setBackupMessage("Daily study target updated!");
    setTimeout(() => setBackupMessage(''), 3000);
  };

  // Save Academic Year Profile
  const handleSaveAcademicProfile = () => {
    onUpdateProfile({
      displayName: editDisplayName,
      name: editDisplayName,
      academicYear: editAcademicYear,
      yearLevel: editYearLevel,
      semesterOrTerm: editSemesterOrTerm,
      targetExamYear: editTargetExamYear,
      institution: editInstitution,
      majorOrStream: editMajorOrStream,
      academicYearStartDate: editStartDate,
      academicYearEndDate: editEndDate,
      targetGpaOrScore: editTargetGpa,
      targetHoursPerDay: targetHours,
      yearProfile: {
        academicYear: editAcademicYear,
        yearLevel: editYearLevel,
        semesterOrTerm: editSemesterOrTerm,
        targetExamYear: editTargetExamYear,
        institution: editInstitution,
        majorOrStream: editMajorOrStream,
        academicYearStartDate: editStartDate,
        academicYearEndDate: editEndDate,
        targetGpaOrScore: editTargetGpa,
        graduationYear: editTargetExamYear
      }
    });
    setBackupMessage("Academic Year & Student Profile updated successfully!");
    setTimeout(() => setBackupMessage(''), 3000);
  };

  // Immediate Cloud Sync
  const handleManualCloudSync = async () => {
    if (!user) {
      onOpenAuthModal();
      return;
    }
    setIsSyncingNow(true);
    setBatchLogs([]);
    try {
      await forceSyncAllToCloud((progress) => {
        setBatchProgress(progress);
        if (progress.log) {
          setBatchLogs(prev => [progress.log!, ...prev.slice(0, 7)]);
        }
      });
      setBackupMessage("All academic data successfully synced to Firestore across devices!");
      setTimeout(() => setBackupMessage(''), 4000);
    } catch (err: any) {
      alert("Sync failed: " + err.message);
    } finally {
      setIsSyncingNow(false);
      setBatchProgress(null);
    }
  };

  const handleDownloadCurrentStateJson = () => {
    const fullData = exportAllUserData();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `studyplanner_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setBackupMessage("Backup JSON generated and downloaded!");
    setTimeout(() => setBackupMessage(''), 3000);
  };

  const handleExportBackup = () => {
    handleDownloadCurrentStateJson();
  };

  const handleRestoreBackup = async () => {
    if (!importJsonText.trim()) return;
    try {
      setIsSyncingNow(true);
      const success = await importUserData(importJsonText, user?.uid, (progress) => {
        setBatchProgress(progress);
        if (progress.log) {
          setBatchLogs(prev => [progress.log!, ...prev.slice(0, 7)]);
        }
      });
      if (success) {
        setBackupMessage("All study data restored and synced successfully!");
        setIsRestoreModalOpen(false);
        setImportJsonText('');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        alert("Failed to restore data. Please check the JSON format.");
      }
    } catch (err: any) {
      alert("Invalid JSON format: " + err.message);
    } finally {
      setIsSyncingNow(false);
      setBatchProgress(null);
    }
  };

  const localCached = loadAllDataFromLocal();
  const totalCachedRecords = 
    (subjects.reduce((a, s) => a + s.chapters.reduce((ca, c) => ca + c.topics.length, 0), 0)) +
    localCached.sessions.length +
    localCached.plans.length +
    localCached.testResults.length +
    localCached.activityLogs.length +
    localCached.revisions.length +
    localCached.notes.length +
    localCached.flashcardDecks.length;

  const currentThemeMode = themeConfig?.mode || 'system';
  const currentPreset = themeConfig?.palette || themeConfig?.preset || 'natural_ethos';

  const themePresets: { id: ThemePreset; name: string; desc: string; bgPreview: string; accentPreview: string }[] = [
    { id: 'natural_ethos', name: 'Natural Ethos', desc: 'Calming sage & warm sandstone palette', bgPreview: '#FDFCF9', accentPreview: '#6B705C' },
    { id: 'nord_studio', name: 'Nord Studio', desc: 'Arctic slate, deep navy & icy highlights', bgPreview: '#F8FAFC', accentPreview: '#0284C7' },
    { id: 'obsidian_dark', name: 'Obsidian Pure', desc: 'True dark mode with emerald energy', bgPreview: '#0B0F10', accentPreview: '#10B981' },
    { id: 'sunset_amber', name: 'Sunset Terracotta', desc: 'Warm desert amber & sand tones', bgPreview: '#FFFBF5', accentPreview: '#D97706' },
    { id: 'royal_indigo', name: 'Royal Indigo', desc: 'Scholarly deep indigo & violet luster', bgPreview: '#FAF8FF', accentPreview: '#6366F1' },
  ];

  const THEME_PALETTE_DETAILS: Record<ThemePreset, {
    name: string;
    description: string;
    light: {
      primary: string;
      primaryHover: string;
      surface: string;
      card: string;
      appBg: string;
      accent: string;
      textPrimary: string;
      textMuted: string;
      border: string;
    };
    dark: {
      primary: string;
      primaryHover: string;
      surface: string;
      card: string;
      appBg: string;
      accent: string;
      textPrimary: string;
      textMuted: string;
      border: string;
    };
  }> = {
    natural_ethos: {
      name: 'Natural Ethos',
      description: 'Organic calming sage, warm sandstone and earthy balanced slate.',
      light: {
        primary: '#4D7C5D',
        primaryHover: '#3D634A',
        surface: '#F4F1EA',
        card: '#FFFFFF',
        appBg: '#FAF9F5',
        accent: '#EDE8DE',
        textPrimary: '#2D312E',
        textMuted: '#6B726A',
        border: '#E3DED4',
      },
      dark: {
        primary: '#6BA87E',
        primaryHover: '#82BB93',
        surface: '#222825',
        card: '#272E2A',
        appBg: '#1E2320',
        accent: '#323B36',
        textPrimary: '#F1F5F2',
        textMuted: '#9EABA2',
        border: '#38423D',
      }
    },
    nord_studio: {
      name: 'Nord Studio',
      description: 'Sub-zero arctic slate, crisp deep navy and icy cyan illumination.',
      light: {
        primary: '#0284C7',
        primaryHover: '#0369A1',
        surface: '#F1F5F9',
        card: '#FFFFFF',
        appBg: '#F8FAFC',
        accent: '#E2E8F0',
        textPrimary: '#0F172A',
        textMuted: '#64748B',
        border: '#E2E8F0',
      },
      dark: {
        primary: '#38BDF8',
        primaryHover: '#7DD3FC',
        surface: '#202C3F',
        card: '#283548',
        appBg: '#1E293B',
        accent: '#334155',
        textPrimary: '#F8FAFC',
        textMuted: '#94A3B8',
        border: '#3B4D66',
      }
    },
    obsidian_dark: {
      name: 'Obsidian Pure',
      description: 'Ultra high-contrast midnight slate with radiant emerald luminescence.',
      light: {
        primary: '#059669',
        primaryHover: '#047857',
        surface: '#F0F3EC',
        card: '#FFFFFF',
        appBg: '#F9FAF7',
        accent: '#E2E8DC',
        textPrimary: '#1B241E',
        textMuted: '#5D6E63',
        border: '#DCE3D6',
      },
      dark: {
        primary: '#10B981',
        primaryHover: '#34D399',
        surface: '#1C2B24',
        card: '#203028',
        appBg: '#18241E',
        accent: '#2A3D34',
        textPrimary: '#F2F7F4',
        textMuted: '#8DA396',
        border: '#2E473B',
      }
    },
    sunset_amber: {
      name: 'Sunset Terracotta',
      description: 'Warm desert dunes, golden amber study focus and rich cedar notes.',
      light: {
        primary: '#D97706',
        primaryHover: '#B45309',
        surface: '#FDF4EB',
        card: '#FFFFFF',
        appBg: '#FFFDF9',
        accent: '#FCE7D2',
        textPrimary: '#38200F',
        textMuted: '#855E42',
        border: '#F5DECB',
      },
      dark: {
        primary: '#F59E0B',
        primaryHover: '#FBBF24',
        surface: '#29211B',
        card: '#332922',
        appBg: '#211914',
        accent: '#42342B',
        textPrimary: '#FFF9F5',
        textMuted: '#B89E8C',
        border: '#4F3C31',
      }
    },
    royal_indigo: {
      name: 'Royal Indigo',
      description: 'Deep scholarly Oxford indigo, royal amethyst and lavender tint.',
      light: {
        primary: '#4F46E5',
        primaryHover: '#4338CA',
        surface: '#EEF2FF',
        card: '#FFFFFF',
        appBg: '#F8F9FE',
        accent: '#E0E7FF',
        textPrimary: '#0F172A',
        textMuted: '#58657B',
        border: '#E0E7FF',
      },
      dark: {
        primary: '#818CF8',
        primaryHover: '#A5B4FC',
        surface: '#23263B',
        card: '#2B2F4A',
        appBg: '#1A1C2E',
        accent: '#3B4063',
        textPrimary: '#FAF8FF',
        textMuted: '#9EA4C9',
        border: '#434970',
      }
    }
  };

  const [previewPaletteIndex, setPreviewPaletteIndex] = useState<number>(() => {
    const idx = themePresets.findIndex(p => p.id === currentPreset);
    return idx >= 0 ? idx : 0;
  });
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>(() => {
    return currentThemeMode === 'dark' ? 'dark' : 'light';
  });
  const [themeAppliedNotice, setThemeAppliedNotice] = useState<string | null>(null);

  // Synchronize when currentPreset updates from external changes
  useEffect(() => {
    const idx = themePresets.findIndex(p => p.id === currentPreset);
    if (idx >= 0) setPreviewPaletteIndex(idx);
  }, [currentPreset]);

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-card border border-theme rounded-3xl p-6 shadow-xs">
        <h2 className="text-xl font-serif italic font-bold text-primary flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          <span>Account, Theme & Data Management</span>
        </h2>
        <p className="text-xs text-muted mt-1">
          Customize system-wide theme preferences, manage automated 7:30 AM Gmail briefings, and control cross-device zero-latency data sync.
        </p>
      </div>

      {backupMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-2xl flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{backupMessage}</span>
        </div>
      )}

      {/* System Theme & Visual Customization */}
      <div className="bg-card border border-theme rounded-3xl p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
              <Palette className="w-4 h-4 text-primary" />
              <span>Appearance & System Theme</span>
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Toggle between Dark Mode, Light Mode, and tailored academic color schemes. Persists across all sessions.
            </p>
          </div>
          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-theme-accent text-primary border border-theme">
            Mode: {currentThemeMode.toUpperCase()}
          </span>
        </div>

        {/* Theme Mode Segmented Control */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-primary">Theme Mode</label>
          <div className="grid grid-cols-3 gap-2 p-1 bg-theme-accent/50 rounded-2xl border border-theme">
            <button
              onClick={() => onUpdateTheme && onUpdateTheme({ mode: 'light' })}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                currentThemeMode === 'light'
                  ? 'bg-card text-primary shadow-xs border border-theme'
                  : 'text-muted hover:text-primary'
              }`}
            >
              <Sun className="w-4 h-4 text-amber-500" />
              <span>Light Mode</span>
            </button>

            <button
              onClick={() => onUpdateTheme && onUpdateTheme({ mode: 'dark' })}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                currentThemeMode === 'dark'
                  ? 'bg-card text-primary shadow-xs border border-theme'
                  : 'text-muted hover:text-primary'
              }`}
            >
              <Moon className="w-4 h-4 text-indigo-400" />
              <span>Dark Mode</span>
            </button>

            <button
              onClick={() => onUpdateTheme && onUpdateTheme({ mode: 'system' })}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                currentThemeMode === 'system'
                  ? 'bg-card text-primary shadow-xs border border-theme'
                  : 'text-muted hover:text-primary'
              }`}
            >
              <Laptop className="w-4 h-4 text-primary" />
              <span>Auto (System)</span>
            </button>
          </div>
        </div>

        {/* Color Palette Presets */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-primary">Academic Palette Theme</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {themePresets.map((preset) => {
              const isSelected = currentPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => onUpdateTheme && onUpdateTheme({ palette: preset.id, preset: preset.id })}
                  className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between gap-2 cursor-pointer ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/20 bg-theme-accent/60'
                      : 'border-theme hover:border-primary/50 bg-card'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full border border-black/10 shadow-xs" 
                        style={{ backgroundColor: preset.accentPreview }}
                      />
                      <span className="text-xs font-bold text-primary">{preset.name}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                  </div>
                  <p className="text-[11px] text-muted">{preset.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* LIVE THEME PREVIEW & COMPONENT SANDBOX */}
        {(() => {
          const activePresetItem = themePresets[previewPaletteIndex] || themePresets[0];
          const activePaletteConfig = THEME_PALETTE_DETAILS[activePresetItem.id] || THEME_PALETTE_DETAILS.natural_ethos;
          const activeColors = previewMode === 'dark' ? activePaletteConfig.dark : activePaletteConfig.light;
          const isCurrentlyActiveInApp = currentPreset === activePresetItem.id && ((currentThemeMode === 'dark' && previewMode === 'dark') || (currentThemeMode === 'light' && previewMode === 'light'));

          const handlePrevPalette = () => {
            setPreviewPaletteIndex((prev) => (prev - 1 + themePresets.length) % themePresets.length);
          };

          const handleNextPalette = () => {
            setPreviewPaletteIndex((prev) => (prev + 1) % themePresets.length);
          };

          const handleApplyTheme = () => {
            if (onUpdateTheme) {
              onUpdateTheme({
                palette: activePresetItem.id,
                preset: activePresetItem.id,
                mode: previewMode
              });
              setThemeAppliedNotice(`Applied "${activePresetItem.name}" (${previewMode.toUpperCase()}) across the entire app!`);
              setTimeout(() => setThemeAppliedNotice(null), 3500);
            }
          };

          return (
            <div className="p-5 rounded-3xl bg-theme-accent/30 border border-theme space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-xl bg-card border border-theme text-primary shadow-2xs">
                      <Sparkles className="w-4 h-4 text-primary" />
                    </span>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-primary">Live Theme Preview</h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-card border border-theme text-muted">
                      {previewPaletteIndex + 1} of {themePresets.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted mt-1">
                    Cycle through color palettes to preview primary, surface, and typography tokens on this live interactive study component before applying.
                  </p>
                </div>

                {/* Cycler Controls & Mode Switch */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Prev / Next buttons */}
                  <div className="flex items-center rounded-xl bg-card border border-theme p-0.5 shadow-2xs">
                    <button
                      onClick={handlePrevPalette}
                      className="p-1.5 rounded-lg hover:bg-theme-accent text-primary transition cursor-pointer"
                      title="Previous Theme Palette"
                      aria-label="Previous Theme Palette"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleNextPalette}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-primary hover:bg-theme-accent rounded-lg transition cursor-pointer"
                      title="Cycle to Next Palette"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-primary" />
                      <span className="hidden sm:inline">Cycle</span>
                    </button>
                    <button
                      onClick={handleNextPalette}
                      className="p-1.5 rounded-lg hover:bg-theme-accent text-primary transition cursor-pointer"
                      title="Next Theme Palette"
                      aria-label="Next Theme Palette"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Preview Mode Toggle */}
                  <div className="flex items-center rounded-xl bg-card border border-theme p-0.5 shadow-2xs">
                    <button
                      onClick={() => setPreviewMode('light')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                        previewMode === 'light'
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold'
                          : 'text-muted hover:text-primary'
                      }`}
                    >
                      Light
                    </button>
                    <button
                      onClick={() => setPreviewMode('dark')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                        previewMode === 'dark'
                          ? 'bg-indigo-500/20 text-indigo-400 font-bold'
                          : 'text-muted hover:text-primary'
                      }`}
                    >
                      Dark
                    </button>
                  </div>

                  {/* Apply Theme Button */}
                  <button
                    onClick={handleApplyTheme}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:opacity-90 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-98"
                    title="Apply this previewed theme across the app"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Apply Theme</span>
                  </button>
                </div>
              </div>

              {themeAppliedNotice && (
                <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-xl flex items-center gap-2 animate-fade-in">
                  <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{themeAppliedNotice}</span>
                </div>
              )}

              {/* LIVE SAMPLE COMPONENT CONTAINER */}
              <div
                className="p-4 sm:p-5 rounded-2xl border transition-all duration-300 shadow-xs"
                style={{
                  backgroundColor: activeColors.appBg,
                  borderColor: activeColors.border
                }}
              >
                {/* Simulated Study Card Component */}
                <div
                  className="rounded-2xl border p-4 sm:p-5 transition-all duration-300 shadow-2xs space-y-4"
                  style={{
                    backgroundColor: activeColors.card,
                    borderColor: activeColors.border,
                    color: activeColors.textPrimary
                  }}
                >
                  {/* Card Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors"
                        style={{
                          backgroundColor: activeColors.surface,
                          borderColor: activeColors.border,
                          color: activeColors.primary
                        }}
                      >
                        Physics 9702 • A-Level
                      </span>
                      <span
                        className="text-[11px] font-medium transition-colors"
                        style={{ color: activeColors.textMuted }}
                      >
                        Chapter 14: Quantum Physics
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] font-bold">
                      <span
                        className="w-2 h-2 rounded-full animate-pulse"
                        style={{ backgroundColor: activeColors.primary }}
                      />
                      <span style={{ color: activeColors.primary }}>Spaced Review Due</span>
                    </div>
                  </div>

                  {/* Card Title & Description */}
                  <div className="space-y-1">
                    <h5
                      className="text-base sm:text-lg font-serif font-bold tracking-tight"
                      style={{ color: activeColors.textPrimary }}
                    >
                      Photoelectric Work Function & Electron Volts
                    </h5>
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: activeColors.textMuted }}
                    >
                      Calculate the threshold frequency (f₀ = Φ / h) and maximum kinetic energy of emitted photoelectrons under monochromatic UV radiation.
                    </p>
                  </div>

                  {/* Surface Box: Progress & Metrics */}
                  <div
                    className="p-3.5 rounded-xl border transition-colors space-y-2.5"
                    style={{
                      backgroundColor: activeColors.surface,
                      borderColor: activeColors.border
                    }}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span style={{ color: activeColors.textPrimary }}>Topic Retention Trajectory</span>
                      <span
                        className="font-mono font-bold"
                        style={{ color: activeColors.primary }}
                      >
                        88% Mastered
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div
                      className="w-full h-2 rounded-full overflow-hidden"
                      style={{ backgroundColor: activeColors.accent }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: '88%',
                          backgroundColor: activeColors.primary
                        }}
                      />
                    </div>

                    <div
                      className="flex flex-wrap items-center justify-between gap-2 text-[10px]"
                      style={{ color: activeColors.textMuted }}
                    >
                      <span>⏱️ 25-Min Active Recall Block</span>
                      <span>🎯 Cambridge CIE Past Paper Rubric (Paper 2)</span>
                    </div>
                  </div>

                  {/* Action Buttons in Sample Component */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition cursor-pointer hover:opacity-90 active:scale-98"
                        style={{ backgroundColor: activeColors.primary }}
                      >
                        Start Active Recall
                      </button>

                      <button
                        type="button"
                        className="px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer hover:opacity-90"
                        style={{
                          backgroundColor: activeColors.surface,
                          borderColor: activeColors.border,
                          color: activeColors.textPrimary
                        }}
                      >
                        Mark Scheme
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className="px-2 py-1 rounded-md text-[10px] font-mono border"
                        style={{
                          backgroundColor: activeColors.surface,
                          borderColor: activeColors.border,
                          color: activeColors.textMuted
                        }}
                      >
                        Formula Deck Cured
                      </span>
                    </div>
                  </div>
                </div>

                {/* Color Token Swatch Breakdown */}
                <div className="mt-3.5 pt-3 border-t flex flex-wrap items-center justify-between gap-2.5" style={{ borderColor: activeColors.border }}>
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="font-bold" style={{ color: activeColors.textPrimary }}>
                      Palette: {activePresetItem.name} ({previewMode.toUpperCase()})
                    </span>
                    {isCurrentlyActiveInApp && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                        Active in App
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-card border border-theme text-[10px]">
                      <span
                        className="w-3 h-3 rounded-full border border-black/10 shrink-0"
                        style={{ backgroundColor: activeColors.primary }}
                      />
                      <span className="font-mono text-muted">Primary: {activeColors.primary}</span>
                    </div>

                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-card border border-theme text-[10px]">
                      <span
                        className="w-3 h-3 rounded-full border border-black/10 shrink-0"
                        style={{ backgroundColor: activeColors.surface }}
                      />
                      <span className="font-mono text-muted">Surface: {activeColors.surface}</span>
                    </div>

                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-card border border-theme text-[10px]">
                      <span
                        className="w-3 h-3 rounded-full border border-black/10 shrink-0"
                        style={{ backgroundColor: activeColors.card }}
                      />
                      <span className="font-mono text-muted">Card: {activeColors.card}</span>
                    </div>

                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-card border border-theme text-[10px]">
                      <span
                        className="w-3 h-3 rounded-full border border-black/10 shrink-0"
                        style={{ backgroundColor: activeColors.border }}
                      />
                      <span className="font-mono text-muted">Border: {activeColors.border}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Accessibility & Visual Enhancements */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <label className="flex items-center justify-between p-3.5 rounded-2xl bg-theme-accent/40 border border-theme cursor-pointer hover:bg-theme-accent/70 transition">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-primary" />
                <span>High Contrast Mode</span>
              </span>
              <p className="text-[10px] text-muted">Sharpens borders and boosts typographic contrast.</p>
            </div>
            <input
              type="checkbox"
              checked={Boolean(themeConfig?.highContrast)}
              onChange={(e) => onUpdateTheme && onUpdateTheme({ highContrast: e.target.checked })}
              className="w-4 h-4 rounded accent-[#6B705C] cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3.5 rounded-2xl bg-theme-accent/40 border border-theme cursor-pointer hover:bg-theme-accent/70 transition">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-primary" />
                <span>Compact Spacing Mode</span>
              </span>
              <p className="text-[10px] text-muted">Reduces padding for dense syllabus and calendar views.</p>
            </div>
            <input
              type="checkbox"
              checked={Boolean(themeConfig?.compactMode)}
              onChange={(e) => onUpdateTheme && onUpdateTheme({ compactMode: e.target.checked })}
              className="w-4 h-4 rounded accent-[#6B705C] cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Language & Urdu Localization Configuration */}
      <div className="bg-card border border-theme rounded-3xl p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
              <Languages className="w-4 h-4 text-primary" />
              <span>Language & Personal Localization / زبان اور ترتیبات</span>
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Select your preferred personal language. Switching to Urdu enables native RTL support across diagnostics, marks recovery, and knowledge refurbishment.
            </p>
          </div>
          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-theme-accent text-primary border border-theme">
            {currentLang === 'ur' ? 'اردو (RTL Active)' : 'English (LTR Active)'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => handleLanguageChange('en')}
            className={`p-4 rounded-2xl border text-left transition flex items-center justify-between ${
              currentLang === 'en'
                ? 'bg-primary/10 border-primary text-primary shadow-xs'
                : 'bg-theme-accent/40 border-theme text-muted hover:text-primary'
            }`}
          >
            <div>
              <div className="font-bold text-xs">English (Standard)</div>
              <p className="text-[11px] text-muted mt-0.5">Left-to-Right layout, standard terminology & international schemas.</p>
            </div>
            {currentLang === 'en' && <Check className="w-4 h-4 text-primary shrink-0" />}
          </button>

          <button
            onClick={() => handleLanguageChange('ur')}
            className={`p-4 rounded-2xl border text-right transition flex items-center justify-between flex-row-reverse ${
              currentLang === 'ur'
                ? 'bg-primary/10 border-primary text-primary shadow-xs'
                : 'bg-theme-accent/40 border-theme text-muted hover:text-primary'
            }`}
            dir="rtl"
          >
            <div>
              <div className="font-bold text-xs">اردو (Urdu)</div>
              <p className="text-[11px] text-muted mt-0.5">دائیں سے بائیں (RTL)، ذاتی زبان کا تجربہ، اور جامع اصلاحاتی نظام۔</p>
            </div>
            {currentLang === 'ur' && <Check className="w-4 h-4 text-primary shrink-0" />}
          </button>
        </div>
      </div>

      {/* Automated 7:30 AM Morning Briefing Configuration */}
      <div className="bg-card border border-theme rounded-3xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
              <Mail className="w-4 h-4 text-primary" />
              <span>Automated 7:30 AM Morning Briefing Service</span>
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Dispatches your daily study agenda, revision goals, exams, and yesterday's progress directly to your Gmail inbox.
            </p>
          </div>
          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            Scheduler Active
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-primary flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-primary" />
              <span>Recipient Email Address</span>
            </label>
            <input
              type="email"
              value={briefingConfig.recipientEmail}
              onChange={(e) => handleSaveBriefingConfig({ recipientEmail: e.target.value })}
              placeholder="e.g. atharkhanteambuster@gmail.com"
              className="w-full p-3 bg-theme-accent/40 border border-theme rounded-2xl text-xs text-primary font-mono focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-primary flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>Scheduled Daily Dispatch Time</span>
            </label>
            <input
              type="time"
              value={briefingConfig.dispatchTime}
              onChange={(e) => handleSaveBriefingConfig({ dispatchTime: e.target.value })}
              className="w-full p-3 bg-theme-accent/40 border border-theme rounded-2xl text-xs text-primary font-mono focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Live Status and Test Button */}
        <div className="p-4 rounded-2xl bg-theme-accent/40 border border-theme flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs font-bold text-primary flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-primary" />
              <span>Automated Background Dispatch</span>
            </div>
            <p className="text-[11px] text-muted">
              Last dispatched date: <strong className="font-mono text-primary">{briefingConfig.lastDispatchedDate || 'Pending today'}</strong>. The 30s background ticker triggers when the target time is reached.
            </p>
            {briefingStatusMsg && (
              <p className="text-xs font-semibold text-primary pt-1 animate-fade-in">{briefingStatusMsg}</p>
            )}
          </div>

          <button
            onClick={handleTestDispatchBriefing}
            disabled={isDispatchingBriefing}
            className="px-4 py-2.5 bg-[#6B705C] hover:bg-[#5a5f4e] disabled:opacity-50 text-white font-medium text-xs rounded-full shadow-xs flex items-center gap-2 cursor-pointer transition shrink-0 active:scale-95"
          >
            <Send className={`w-3.5 h-3.5 ${isDispatchingBriefing ? 'animate-spin' : ''}`} />
            <span>{isDispatchingBriefing ? 'Dispatching...' : "Send 7:30 Briefing Now"}</span>
          </button>
        </div>

        {/* Recent Dispatch Logs */}
        {briefingConfig.history && briefingConfig.history.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="text-xs font-bold text-primary uppercase tracking-wider">Recent Dispatch Logs</div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {briefingConfig.history.slice(0, 5).map((log: MorningBriefingLogItem) => (
                <div key={log.id} className="p-2.5 rounded-xl bg-theme-accent/30 border border-theme flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${log.status === 'Delivered' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <span className="font-mono text-primary font-semibold">{log.date}</span>
                    <span className="text-muted truncate max-w-[180px]">({log.recipient})</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px] text-muted">
                    <span>{log.tasksCount} tasks</span>
                    <span className={`font-bold ${log.status === 'Delivered' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                      {log.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cloud & Local Data Resilience Center */}
      <div className="bg-card border border-theme rounded-3xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
              <Database className="w-4 h-4 text-primary" />
              <span>Multi-Layer Dual-Point Data Resilience Center</span>
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Two distinct save points ensure zero data loss on device offline events and high-volume batch sync to Firestore.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border ${
              syncInfo.state === 'saving'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                : syncInfo.mode === 'cloud'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-theme-accent text-primary border-theme'
            }`}>
              {syncInfo.state === 'saving' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
              ) : syncInfo.mode === 'cloud' ? (
                <Cloud className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <HardDrive className="w-3.5 h-3.5 text-primary" />
              )}
              <span>{syncInfo.mode === 'cloud' ? 'Dual-Point Cloud Synced' : 'Point 1: Device Protected'}</span>
            </div>
          </div>
        </div>

        {/* Three Tiers Architecture Visualizer */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Tier 1 Card */}
          <div className="p-4.5 rounded-2xl bg-theme-accent/30 border border-theme space-y-3 relative overflow-hidden flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#6B705C]/15 text-[#6B705C] flex items-center justify-center font-bold text-xs shrink-0">
                    <HardDrive className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-primary">Tier 1: Instant Local Cache</span>
                    </div>
                    <div className="text-[10px] text-muted">Zero-Latency Memory & Storage</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">0ms Lag</span>
              </div>
              
              <p className="text-[11px] text-primary/80 leading-relaxed">
                Every syllabus toggle, timer tick, note entry, and micro-goal updates instantaneously (0ms lag). Offline resilience guarantees zero lost keystrokes.
              </p>
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted pt-2 border-t border-theme/60">
              <span>Records: <strong className="text-primary">{totalCachedRecords}</strong></span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Offline Protected</span>
            </div>
          </div>

          {/* Tier 2 Card */}
          <div className="p-4.5 rounded-2xl bg-theme-accent/30 border border-theme space-y-3 relative overflow-hidden flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center font-bold text-xs shrink-0">
                    <Server className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-primary">Tier 2: Continuous Firestore</span>
                    </div>
                    <div className="text-[10px] text-muted">Automated Cloud Sync</div>
                  </div>
                </div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
                  user ? 'bg-sky-500/10 text-sky-600 border-sky-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                }`}>
                  {user ? 'Auto-Synced' : 'Unified ID Synced'}
                </span>
              </div>

              <p className="text-[11px] text-primary/80 leading-relaxed">
                Automatically saves data in the cloud in the background. No manual "Save" button required. Syllabus, streaks, and flashcards sync seamlessly across devices.
              </p>
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted pt-2 border-t border-theme/60">
              <span>Chunking: <strong className="text-primary">200 ops/batch</strong></span>
              <span className="text-sky-600 font-bold">Background Sync</span>
            </div>
          </div>

          {/* Tier 3 Card */}
          <div className="p-4.5 rounded-2xl bg-theme-accent/30 border border-theme space-y-3 relative overflow-hidden flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0">
                    <Cloud className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-primary">Tier 3: Academic Vault</span>
                    </div>
                    <div className="text-[10px] text-muted">Google Drive Mirroring</div>
                  </div>
                </div>
                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-md">
                  Zero Lock-in
                </span>
              </div>

              <p className="text-[11px] text-primary/80 leading-relaxed">
                Dedicated folder (<code className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded">📁 StudyOS Academic Workspace</code>) with autonomous snapshots, direct PDF/slide explorer, and 100% data ownership.
              </p>
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted pt-2 border-t border-theme/60">
              <span>Folder: <strong className="text-primary">Google Drive</strong></span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Autonomous Vault</span>
            </div>
          </div>
        </div>

        {/* Live Batch Progress Terminal */}
        {batchProgress && (
          <div className="p-4 rounded-2xl bg-[#2D312E] text-[#F9F7F2] space-y-3 animate-fade-in border border-[#4A4E4D]">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-mono">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>Chunked Batch Uploader: <strong className="text-amber-300">{batchProgress.currentEntity || 'Syncing...'}</strong></span>
              </div>
              <span className="font-mono text-amber-300 font-bold">{batchProgress.percentage}%</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full bg-white/20 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-300 rounded-full"
                style={{ width: `${batchProgress.percentage}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-white/70 font-mono">
              <span>Items Processed: {batchProgress.processedItems} / {batchProgress.totalItems}</span>
              <span>Chunk {batchProgress.currentChunk} of {batchProgress.totalChunks}</span>
            </div>

            {/* Recent Batch Logs */}
            {batchLogs.length > 0 && (
              <div className="p-2 rounded-xl bg-black/40 text-[10px] font-mono text-emerald-300 space-y-0.5 max-h-24 overflow-y-auto">
                {batchLogs.map((log, idx) => (
                  <div key={idx} className="truncate">{log}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Live Storage Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-2xl bg-theme-accent/30 border border-theme">
            <div className="text-[10px] uppercase font-bold text-muted">Syllabus Topics</div>
            <div className="text-lg font-bold text-primary mt-0.5">
              {subjects.reduce((a, s) => a + s.chapters.reduce((ca, c) => ca + c.topics.length, 0), 0)}
            </div>
            <div className="text-[10px] text-primary font-medium">Across {subjects.length} subjects</div>
          </div>
          <div className="p-3 rounded-2xl bg-theme-accent/30 border border-theme">
            <div className="text-[10px] uppercase font-bold text-muted">Study Sessions</div>
            <div className="text-lg font-bold text-primary mt-0.5">{localCached.sessions.length}</div>
            <div className="text-[10px] text-primary font-medium">Point 1 cached</div>
          </div>
          <div className="p-3 rounded-2xl bg-theme-accent/30 border border-theme">
            <div className="text-[10px] uppercase font-bold text-muted">Flashcard Decks</div>
            <div className="text-lg font-bold text-primary mt-0.5">{localCached.flashcardDecks.length}</div>
            <div className="text-[10px] text-primary font-medium">Active recall cards</div>
          </div>
          <div className="p-3 rounded-2xl bg-theme-accent/30 border border-theme">
            <div className="text-[10px] uppercase font-bold text-muted">Tests & Revisions</div>
            <div className="text-lg font-bold text-primary mt-0.5">{localCached.testResults.length + localCached.revisions.length}</div>
            <div className="text-[10px] text-primary font-medium">Spaced recall logs</div>
          </div>
        </div>

        {/* Cloud Sync Action Bar */}
        <div className="p-4 rounded-2xl bg-theme-accent/30 border border-theme flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-primary flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>Two-Point Chunked Batch Synchronization Active</span>
            </div>
            <p className="text-[11px] text-muted">
              Point 1 local cache is instant (0ms). Point 2 syncs to Firestore. Last sync: <span className="font-mono font-bold text-primary">{syncInfo.lastSavedAt || 'Just now'}</span>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleManualCloudSync}
              disabled={isSyncingNow}
              className="px-4 py-2.5 bg-[#6B705C] hover:bg-[#5a5f4e] disabled:opacity-50 text-white font-medium text-xs rounded-full shadow-xs flex items-center gap-2 cursor-pointer transition active:scale-95 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingNow ? 'animate-spin' : ''}`} />
              <span>{isSyncingNow ? 'Chunking & Syncing...' : user ? 'Execute Instant Cloud Sync Now' : 'Sign In & Force Cloud Sync'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Connected Devices & Cross-Device Management Card */}
      <div className="bg-card border border-theme rounded-3xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-600 flex items-center justify-center font-bold">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
                <span>Connected Devices & Live Sync</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {userDevices.filter(d => d.status !== 'revoked').length || 1} Active
                </span>
              </h3>
              <p className="text-xs text-muted mt-0.5">
                Manage all phones, tablets, and computers connected to this account with remote revocation.
              </p>
            </div>
          </div>

          {userDevices.filter(d => d.deviceId !== currentDeviceId && d.status !== 'revoked').length > 0 && (
            <button
              onClick={handleRevokeAllOtherDevices}
              disabled={isRevokingId === 'all'}
              className="px-3.5 py-1.5 rounded-full bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border border-rose-500/20 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{isRevokingId === 'all' ? 'Signing Out All...' : 'Sign Out All Other Devices'}</span>
            </button>
          )}
        </div>

        {/* Action feedback message */}
        {deviceActionMsg && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{deviceActionMsg}</span>
          </div>
        )}

        {/* Device List */}
        <div className="space-y-3">
          {/* Current Device Banner */}
          {(() => {
            const thisDevice = userDevices.find(d => d.deviceId === currentDeviceId);
            const devName = thisDevice?.deviceName || 'This Browser / Device';
            const os = thisDevice?.os || (typeof navigator !== 'undefined' ? (navigator.userAgent.includes('Mac') ? 'macOS' : navigator.userAgent.includes('Windows') ? 'Windows' : navigator.userAgent.includes('Android') ? 'Android' : navigator.userAgent.includes('iPhone') ? 'iOS' : 'Linux') : 'Web');
            const browser = thisDevice?.browser || 'Web Browser';
            const isMobile = thisDevice?.deviceType === 'mobile' || (typeof window !== 'undefined' && window.innerWidth < 768);

            return (
              <div className="p-4 rounded-2xl bg-primary/5 border-2 border-primary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center shrink-0 shadow-xs">
                    {isMobile ? <Smartphone className="w-5 h-5" /> : <Laptop className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-primary">{devName}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        This Device (Active)
                      </span>
                    </div>
                    <div className="text-[11px] text-muted flex items-center gap-2 mt-0.5 flex-wrap">
                      <span>{os} • {browser}</span>
                      {thisDevice?.screenResolution && <span>• {thisDevice.screenResolution}</span>}
                      <span>• Last active: Just now</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {editingDeviceId === currentDeviceId ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={editDeviceNameVal}
                        onChange={(e) => setEditDeviceNameVal(e.target.value)}
                        placeholder="Device Name..."
                        className="px-2.5 py-1 text-xs bg-surface border border-theme rounded-xl text-primary font-medium focus:outline-none focus:border-primary w-36"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveDeviceName(currentDeviceId)}
                        className="px-2.5 py-1 rounded-xl bg-primary text-white text-xs font-semibold cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingDeviceId(null)}
                        className="px-2 py-1 text-xs text-muted hover:text-primary cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingDeviceId(currentDeviceId);
                        setEditDeviceNameVal(devName);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-theme-accent hover:bg-theme-accent/70 border border-theme text-primary text-xs font-medium flex items-center gap-1 cursor-pointer transition"
                      title="Rename this device"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Rename</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Other Devices */}
          {userDevices.filter(d => d.deviceId !== currentDeviceId && d.status !== 'revoked').map((dev) => {
            const isEditing = editingDeviceId === dev.deviceId;
            return (
              <div 
                key={dev.deviceId}
                className="p-4 rounded-2xl bg-surface border border-theme flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-theme-accent transition"
              >
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-theme-accent text-primary flex items-center justify-center shrink-0">
                    {dev.deviceType === 'mobile' ? <Smartphone className="w-5 h-5" /> : dev.deviceType === 'tablet' ? <Tablet className="w-5 h-5" /> : <Laptop className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-primary">{dev.deviceName}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 border border-sky-500/20 font-medium">
                        Remote Device
                      </span>
                    </div>
                    <div className="text-[11px] text-muted flex items-center gap-2 mt-0.5 flex-wrap">
                      <span>{dev.os} • {dev.browser}</span>
                      {dev.screenResolution && <span>• {dev.screenResolution}</span>}
                      <span>• Last active: {dev.lastActive ? new Date(dev.lastActive).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Recently'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={editDeviceNameVal}
                        onChange={(e) => setEditDeviceNameVal(e.target.value)}
                        placeholder="Device Name..."
                        className="px-2.5 py-1 text-xs bg-surface border border-theme rounded-xl text-primary font-medium focus:outline-none focus:border-primary w-36"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveDeviceName(dev.deviceId)}
                        className="px-2.5 py-1 rounded-xl bg-primary text-white text-xs font-semibold cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingDeviceId(null)}
                        className="px-2 py-1 text-xs text-muted hover:text-primary cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditingDeviceId(dev.deviceId);
                          setEditDeviceNameVal(dev.deviceName);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-theme-accent hover:bg-theme-accent/70 border border-theme text-primary text-xs font-medium flex items-center gap-1 cursor-pointer transition"
                        title="Rename device"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Rename</span>
                      </button>
                      <button
                        onClick={() => handleRevokeDevice(dev.deviceId, dev.deviceName)}
                        disabled={isRevokingId === dev.deviceId}
                        className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/20 text-xs font-semibold flex items-center gap-1 cursor-pointer transition"
                        title="Sign out this device remotely"
                      >
                        <LogOut className="w-3 h-3" />
                        <span>{isRevokingId === dev.deviceId ? 'Signing Out...' : 'Sign Out'}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {userDevices.filter(d => d.deviceId !== currentDeviceId && d.status === 'active').length === 0 && (
            <div className="p-4 rounded-2xl bg-theme-accent/20 border border-dashed border-theme text-center">
              <p className="text-xs text-muted">
                No other devices currently active. Open <strong>StudyFlow</strong> on your phone, tablet, or another laptop using your account to view them here and sync seamlessly.
              </p>
            </div>
          )}
        </div>

        {/* Sync Capability Breakdown */}
        <div className="p-4 rounded-2xl bg-theme-accent/30 border border-theme space-y-2">
          <div className="text-xs font-bold text-primary flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Automatic Cross-Device Sync Matrix</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-muted">
            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Syllabus & Chapters</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Study Progress & Streaks</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> AI Study Plans & Timetables</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Scheduled Study Tasks</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> AI Tutor Chat History</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Mock Exams & Test Results</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Flashcards & Spaced Recall</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Storage Vaults & PDFs</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Academic Profile & Target Hours</div>
          </div>
        </div>
      </div>

      {/* Academic Year & Student Educational Profile Card */}
      <div className="bg-card border border-theme rounded-3xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-theme pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/15 text-primary flex items-center justify-center font-bold">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
                <span>Academic Year & Student Profile</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-theme-accent text-primary border border-theme">
                  {editAcademicYear}
                </span>
              </h3>
              <p className="text-xs text-muted mt-0.5">
                Set your academic year, grade/cohort level, semester timeline, and target graduation/exam horizon.
              </p>
            </div>
          </div>

          <button
            onClick={handleSaveAcademicProfile}
            className="px-4 py-2 rounded-full bg-primary hover:opacity-90 text-white font-medium text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 self-start sm:self-auto"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Year Profile</span>
          </button>
        </div>

        {/* Profile Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Display Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-primary flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-primary" />
              <span>Student Display Name</span>
            </label>
            <input
              type="text"
              value={editDisplayName}
              onChange={(e) => setEditDisplayName(e.target.value)}
              placeholder="e.g. Alex Mercer"
              className="w-full p-2.5 bg-surface border border-theme rounded-2xl text-xs text-primary font-medium focus:outline-none focus:border-primary"
            />
          </div>

          {/* Academic Year */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-primary flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>Academic Year</span>
            </label>
            <input
              type="text"
              value={editAcademicYear}
              onChange={(e) => setEditAcademicYear(e.target.value)}
              placeholder="e.g. 2026 - 2027"
              className="w-full p-2.5 bg-surface border border-theme rounded-2xl text-xs text-primary font-mono focus:outline-none focus:border-primary"
            />
            <div className="flex flex-wrap gap-1 pt-0.5">
              {['2026 - 2027', '2025 - 2026', '2027 - 2028', '2026'].map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setEditAcademicYear(yr)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition border cursor-pointer ${
                    editAcademicYear === yr
                      ? 'bg-primary text-white border-primary'
                      : 'bg-surface hover:bg-theme-accent border-theme text-muted'
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>
          </div>

          {/* Year Level / Class */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-primary flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-primary" />
              <span>Year Level / Cohort</span>
            </label>
            <input
              type="text"
              value={editYearLevel}
              onChange={(e) => setEditYearLevel(e.target.value)}
              placeholder="e.g. Year 3 (Junior)"
              className="w-full p-2.5 bg-surface border border-theme rounded-2xl text-xs text-primary font-medium focus:outline-none focus:border-primary"
            />
            <div className="flex flex-wrap gap-1 pt-0.5">
              {['Freshman', 'Sophomore', 'Junior', 'Senior', 'Class 12', 'Postgrad'].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setEditYearLevel(lvl.includes('(') ? lvl : `${lvl}`)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] transition border cursor-pointer ${
                    editYearLevel.includes(lvl)
                      ? 'bg-primary text-white border-primary'
                      : 'bg-surface hover:bg-theme-accent border-theme text-muted'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Semester / Term */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-primary flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-primary" />
              <span>Current Term / Semester</span>
            </label>
            <input
              type="text"
              value={editSemesterOrTerm}
              onChange={(e) => setEditSemesterOrTerm(e.target.value)}
              placeholder="e.g. Fall Semester"
              className="w-full p-2.5 bg-surface border border-theme rounded-2xl text-xs text-primary font-medium focus:outline-none focus:border-primary"
            />
          </div>

          {/* Target Exam Year */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-primary flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-primary" />
              <span>Target Exam / Milestone Year</span>
            </label>
            <input
              type="text"
              value={editTargetExamYear}
              onChange={(e) => setEditTargetExamYear(e.target.value)}
              placeholder="e.g. 2027"
              className="w-full p-2.5 bg-surface border border-theme rounded-2xl text-xs text-primary font-mono focus:outline-none focus:border-primary"
            />
          </div>

          {/* Institution */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-primary flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-primary" />
              <span>School / Institution</span>
            </label>
            <input
              type="text"
              value={editInstitution}
              onChange={(e) => setEditInstitution(e.target.value)}
              placeholder="e.g. Academic University"
              className="w-full p-2.5 bg-surface border border-theme rounded-2xl text-xs text-primary font-medium focus:outline-none focus:border-primary"
            />
          </div>

          {/* Major / Stream */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-primary flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-primary" />
              <span>Field / Major / Stream</span>
            </label>
            <input
              type="text"
              value={editMajorOrStream}
              onChange={(e) => setEditMajorOrStream(e.target.value)}
              placeholder="e.g. STEM & Computer Science"
              className="w-full p-2.5 bg-surface border border-theme rounded-2xl text-xs text-primary font-medium focus:outline-none focus:border-primary"
            />
          </div>

          {/* Start Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-primary flex items-center gap-1">
              <span>Academic Year Start</span>
            </label>
            <input
              type="date"
              value={editStartDate}
              onChange={(e) => setEditStartDate(e.target.value)}
              className="w-full p-2.5 bg-surface border border-theme rounded-2xl text-xs text-primary font-mono focus:outline-none focus:border-primary"
            />
          </div>

          {/* End Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-primary flex items-center gap-1">
              <span>Academic Year End</span>
            </label>
            <input
              type="date"
              value={editEndDate}
              onChange={(e) => setEditEndDate(e.target.value)}
              className="w-full p-2.5 bg-surface border border-theme rounded-2xl text-xs text-primary font-mono focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Year Progress Preview Banner */}
        <div className="p-3.5 rounded-2xl bg-theme-accent/30 border border-theme flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <div>
              <span className="font-bold text-primary">{editAcademicYear} • {editYearLevel}</span>
              <span className="text-muted text-[11px] ml-2">({editSemesterOrTerm} • {editInstitution})</span>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-muted">
            <span>Target: <strong className="text-primary">{editTargetGpa}</strong></span>
            <span>•</span>
            <span>Milestone: <strong className="text-primary">{editTargetExamYear}</strong></span>
          </div>
        </div>
      </div>

      {/* Firebase Account Status & Cross-Device Sync Card */}
      <div className="bg-card border border-theme rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
            <User className="w-4 h-4 text-primary" />
            <span>Cross-Device Data Integration & User Identity</span>
          </h3>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
            <Cloud className="w-3 h-3" />
            <span>Auto Realtime Sync</span>
          </div>
        </div>

        {user ? (
          <div className="flex items-center justify-between p-4 rounded-2xl bg-theme-accent/30 border border-theme">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#6B705C] flex items-center justify-center font-bold text-white overflow-hidden shrink-0">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  (user.displayName || user.email || 'S').charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <div className="text-sm font-bold text-primary">{user.displayName || 'Authenticated User'}</div>
                <div className="text-xs text-muted font-mono">{user.email || user.uid}</div>
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                  ✓ All devices logged in with this Google account sync in real-time
                </div>
              </div>
            </div>
            <button
              onClick={onSignOut}
              className="px-4 py-2 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-theme-accent/30 border border-theme flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs text-primary font-bold">Active Cross-Device Study Email: <span className="font-mono text-emerald-600 dark:text-emerald-400">{syncEmailInput}</span></p>
                <p className="text-[11px] text-muted">Any browser, laptop, iPad, or mobile phone using this email address connects to the exact same Firestore real-time database.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {onOpenDeviceSync && (
                  <button
                    onClick={onOpenDeviceSync}
                    className="px-4 py-2 rounded-full bg-theme-accent hover:bg-theme-accent/80 text-primary border border-theme font-bold text-xs transition shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-primary" />
                    <span>Search Devices</span>
                  </button>
                )}
                <button
                  onClick={onOpenAuthModal}
                  className="px-4 py-2 rounded-full bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-medium text-xs transition shadow-xs cursor-pointer whitespace-nowrap"
                >
                  Sign In with Google / Email
                </button>
              </div>
            </div>

            {/* Custom Cross-Device Email Switcher */}
            <div className="p-4 rounded-2xl bg-surface border border-theme space-y-3">
              <label className="block text-xs font-semibold text-primary">
                Link Another Device / Switch Synchronized Study Email:
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Mail className="w-4 h-4 absolute left-3 top-2.5 text-muted" />
                  <input
                    type="email"
                    value={syncEmailInput}
                    onChange={(e) => setSyncEmailInput(e.target.value)}
                    placeholder="student@example.com"
                    className="w-full pl-9 pr-3 py-2 bg-theme-accent/30 border border-theme rounded-xl text-xs text-primary focus:outline-none focus:border-primary font-mono"
                  />
                </div>
                <button
                  onClick={() => {
                    if (!syncEmailInput || !syncEmailInput.includes('@')) {
                      setEmailSyncMessage('Please enter a valid email address.');
                      return;
                    }
                    const clean = syncEmailInput.trim().toLowerCase();
                    setActiveUserEmail(clean);
                    onUpdateProfile({ email: clean });
                    setEmailSyncMessage(`Successfully connected across devices to ${clean}!`);
                    setTimeout(() => setEmailSyncMessage(''), 3000);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Connect Device to Email</span>
                </button>
              </div>

              {emailSyncMessage && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>{emailSyncMessage}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Editable Subjects List Section */}
      <div className="bg-card border border-theme rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
            <BookOpen className="w-4 h-4 text-primary" />
            <span>Main Subjects List (Editable)</span>
          </h3>
          <button
            onClick={handleSaveSubjects}
            className="px-4 py-2 rounded-full bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-medium text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Subjects</span>
          </button>
        </div>

        <div className="space-y-2">
          {editingSubjects.map((sub) => (
            <div key={sub.id} className="flex items-center justify-between p-3 rounded-2xl bg-theme-accent/30 border border-theme">
              <span className="text-xs font-bold text-primary">{sub.name}</span>
              <button
                onClick={() => handleDeleteSubject(sub.id)}
                className="text-muted hover:text-rose-500 p-1 cursor-pointer"
                title="Delete Subject"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input
            type="text"
            value={newSubjectName}
            onChange={(e) => setNewSubjectName(e.target.value)}
            placeholder="Add subject (e.g. Computer Science)..."
            className="flex-1 p-3 bg-theme-accent/30 border border-theme rounded-2xl text-xs text-primary focus:outline-none focus:border-primary"
          />
          <button
            onClick={handleAddSubject}
            className="px-4 py-3 bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-medium text-xs rounded-full shadow-xs cursor-pointer"
          >
            Add Subject
          </button>
        </div>
      </div>

      {/* Target Daily Study Hours */}
      <div className="bg-card border border-theme rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
            <Clock className="w-4 h-4 text-primary" />
            <span>Daily Study Target Hours</span>
          </h3>
          <button
            onClick={handleSaveTargetHours}
            className="px-4 py-2 rounded-full bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-medium text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Target</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={16}
            step={0.5}
            value={targetHours}
            onChange={(e) => setTargetHours(parseFloat(e.target.value) || 3)}
            className="w-32 p-3 bg-theme-accent/30 border border-theme rounded-2xl text-xs font-mono font-bold text-primary focus:outline-none focus:border-primary"
          />
          <span className="text-xs text-muted">hours per day across all subjects</span>
        </div>
      </div>

      {/* Exam Dates Manager */}
      <div className="bg-card border border-theme rounded-3xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
          <Award className="w-4 h-4 text-primary" />
          <span>Upcoming Exam Target Dates</span>
        </h3>

        <div className="space-y-2">
          {examDates.map((ex) => (
            <div key={ex.id} className="flex items-center justify-between p-3 rounded-2xl bg-theme-accent/30 border border-theme text-xs">
              <div>
                <span className="font-bold text-primary">{ex.examName}</span>
                <span className="text-muted ml-2">({ex.subjectName})</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-primary font-bold">{ex.date}</span>
                <button onClick={() => handleDeleteExamDate(ex.id)} className="text-muted hover:text-rose-500 cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
          <input
            type="text"
            value={newExamName}
            onChange={(e) => setNewExamName(e.target.value)}
            placeholder="Exam Name (e.g. Midterm)"
            className="p-3 bg-theme-accent/30 border border-theme rounded-2xl text-xs text-primary focus:outline-none focus:border-primary"
          />
          <select
            value={newExamSubject}
            onChange={(e) => setNewExamSubject(e.target.value)}
            className="p-3 bg-theme-accent/30 border border-theme rounded-2xl text-xs text-primary focus:outline-none focus:border-primary"
          >
            {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
          <div className="flex gap-2">
            <input
              type="date"
              value={newExamDateStr}
              onChange={(e) => setNewExamDateStr(e.target.value)}
              className="flex-1 p-3 bg-theme-accent/30 border border-theme rounded-2xl text-xs text-primary focus:outline-none focus:border-primary font-mono"
            />
            <button
              onClick={handleAddExamDate}
              className="px-4 py-3 bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-medium text-xs rounded-full shadow-xs cursor-pointer"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Backup & Restore Section */}
      <div className="bg-card border border-theme rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
              <Download className="w-4 h-4 text-primary" />
              <span>Complete Backup Export & Restore</span>
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Export your complete study memory (syllabus, timer history, plans, notes, test scores) as a JSON backup file to save on Google Drive or locally.
            </p>
          </div>
          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-theme-accent text-primary self-start sm:self-auto border border-theme">
            Local JSON Backup
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {onNavigateToDataBackup && (
            <button
              id="btn-open-data-portability-suite"
              onClick={onNavigateToDataBackup}
              className="px-5 py-2.5 bg-primary hover:opacity-90 text-white font-bold text-xs rounded-full shadow-xs flex items-center gap-2 cursor-pointer transition active:scale-95"
              title="Open full Data Portability, Snapshots, and Multi-Format Exporter"
            >
              <Database className="w-4 h-4" />
              <span>Data Portability & Snapshots Suite</span>
            </button>
          )}

          {/* Primary Current State JSON Download Button */}
          <button
            id="btn-download-state-backup"
            onClick={handleDownloadCurrentStateJson}
            className="px-5 py-2.5 bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-medium text-xs rounded-full shadow-xs flex items-center gap-2 cursor-pointer transition active:scale-95"
            title="Trigger a JSON download of all user data stored in the current state for local backup purposes"
          >
            <FileDown className="w-4 h-4" />
            <span>Download Current State (JSON)</span>
          </button>

          <button
            id="btn-export-full-backup"
            onClick={handleExportBackup}
            className="px-4 py-2.5 bg-theme-accent hover:opacity-85 text-primary font-bold text-xs rounded-full border border-theme shadow-2xs flex items-center gap-2 cursor-pointer transition"
            title="Export complete database backup file"
          >
            <Download className="w-4 h-4 text-primary" />
            <span>Export Cloud/Local File</span>
          </button>

          <button
            id="btn-restore-json-backup"
            onClick={() => setIsRestoreModalOpen(true)}
            className="px-4 py-2.5 bg-theme-accent hover:opacity-85 text-primary font-bold text-xs rounded-full border border-theme shadow-2xs flex items-center gap-2 cursor-pointer transition"
          >
            <Upload className="w-4 h-4 text-primary" />
            <span>Restore Backup JSON</span>
          </button>
        </div>
      </div>

      {/* Restore Modal */}
      {isRestoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-card border border-theme rounded-3xl max-w-lg w-full p-6 shadow-xl relative text-primary space-y-4">
            <h3 className="text-base font-serif italic font-bold text-primary">Restore Backup Data</h3>
            <p className="text-xs text-muted">
              Paste the contents of your backup JSON file below to restore your syllabus, history and notes.
            </p>

            <textarea
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="Paste JSON backup content here..."
              rows={8}
              className="w-full p-3 bg-theme-accent/30 border border-theme rounded-2xl text-xs font-mono text-primary focus:outline-none focus:border-primary"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setIsRestoreModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-muted hover:text-primary cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRestoreBackup}
                className="px-4 py-2 bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-medium text-xs rounded-full shadow-xs cursor-pointer"
              >
                Confirm Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
