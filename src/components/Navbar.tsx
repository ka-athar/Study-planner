import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Clock, 
  Calendar, 
  Sparkles, 
  TrendingUp, 
  RotateCcw, 
  FileCheck, 
  Bot, 
  Settings, 
  Play, 
  User, 
  LogOut, 
  Activity,
  Layers,
  Users,
  Mail,
  Cloud,
  Check,
  RefreshCw,
  HardDrive,
  Brain,
  Sun,
  Moon,
  GraduationCap,
  Archive,
  Printer,
  Headphones,
  CheckSquare,
  QrCode,
  AlertCircle,
  Zap,
  Trophy,
  MessageSquare,
  Smartphone,
  Mic,
  PenTool,
  BookmarkCheck,
  Grid,
  X,
  Compass,
  Bell,
  Swords,
  Network,
  Database,
  Menu,
  ChevronDown,
  Languages,
  Search
} from 'lucide-react';
import { ActiveTab, UserProfile, ThemeConfig } from '../types';
import { subscribeSyncStatus, SyncStatusInfo } from '../lib/db';
import { THEME_PALETTES } from '../lib/themeService';
import { PWAInstallButton } from './PWAInstallButton';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  user: any; // Firebase user
  userProfile: UserProfile | null;
  themeConfig?: ThemeConfig;
  onUpdateTheme?: (updated: Partial<ThemeConfig>) => void;
  userLanguage?: 'en' | 'ur';
  onToggleLanguage?: (lang: 'en' | 'ur') => void;
  livePeerCount?: number;
  liveSyncState?: string;
  onOpenCommandPalette?: () => void;
  onOpenAuthModal: () => void;
  onOpenProfileModal?: () => void;
  onOpenQuickTimer: () => void;
  onOpenExamAutomationModal?: () => void;
  onOpenEmailAgendaModal?: () => void;
  onOpenWhatsAppModal?: () => void;
  onOpenVoiceFeynman?: () => void;
  onOpenKnowledgeTree?: () => void;
  onOpenPredictiveGrades?: () => void;
  onOpenWorkspaceHub?: (tab?: 'classroom' | 'docs' | 'meet' | 'tasks' | 'calendar' | 'drive' | 'keep') => void;
  onOpenMaterialImport?: () => void;
  onOpenDeviceSync?: () => void;
  onOpenQRScanner?: () => void;
  onOpenPrintKit?: () => void;
  onOpenAudioStudy?: () => void;
  onOpenBackupRestore?: () => void;
  onForceSaveCloud?: () => void;
  onSignOut: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  user,
  userProfile,
  themeConfig,
  onUpdateTheme,
  userLanguage = 'en',
  onToggleLanguage,
  livePeerCount = 0,
  liveSyncState = 'disconnected',
  onOpenCommandPalette,
  onOpenAuthModal,
  onOpenProfileModal,
  onOpenQuickTimer,
  onOpenExamAutomationModal,
  onOpenEmailAgendaModal,
  onOpenWhatsAppModal,
  onOpenVoiceFeynman,
  onOpenKnowledgeTree,
  onOpenPredictiveGrades,
  onOpenWorkspaceHub,
  onOpenMaterialImport,
  onOpenDeviceSync,
  onOpenQRScanner,
  onOpenPrintKit,
  onOpenAudioStudy,
  onOpenBackupRestore,
  onForceSaveCloud,
  onSignOut,
}) => {
  const [syncInfo, setSyncInfo] = useState<SyncStatusInfo>({
    state: 'saved',
    lastSavedAt: null,
    mode: 'local',
    message: 'Saved locally'
  });
  const [isToolsModalOpen, setIsToolsModalOpen] = useState(false);
  const [navCategory, setNavCategory] = useState<'all' | 'core' | 'mastery' | 'tasks' | 'growth'>('all');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    core: false,
    mastery: false,
    tasks: true,
    growth: true,
  });

  const toggleSection = (sectionKey: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const sectionDefinitions: {
    key: 'core' | 'mastery' | 'tasks' | 'growth';
    title: string;
    icon: React.ReactNode;
  }[] = [
    { key: 'core', title: 'Core Study', icon: <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> },
    { key: 'mastery', title: 'Exam & Mastery', icon: <PenTool className="w-4 h-4 text-rose-500" /> },
    { key: 'tasks', title: 'Work & Classes', icon: <CheckSquare className="w-4 h-4 text-blue-500" /> },
    { key: 'growth', title: 'Growth & Tools', icon: <TrendingUp className="w-4 h-4 text-amber-500" /> },
  ];

  useEffect(() => {
    const unsub = subscribeSyncStatus((info) => {
      setSyncInfo(info);
    });
    return () => unsub();
  }, []);

  const handleQuickThemeToggle = () => {
    if (!onUpdateTheme) return;
    const currentMode = themeConfig?.mode || 'system';
    const nextMode = currentMode === 'dark' ? 'light' : 'dark';
    onUpdateTheme({ mode: nextMode });
  };

  const navItems: { 
    id: ActiveTab; 
    label: string; 
    icon: React.ReactNode; 
    category: 'core' | 'mastery' | 'tasks' | 'growth';
    badge?: string;
  }[] = [
    // Core
    { id: 'dashboard', label: 'Dashboard', icon: <Layers className="w-4 h-4" />, category: 'core' },
    { id: 'syllabus', label: 'Syllabus', icon: <BookOpen className="w-4 h-4" />, category: 'core' },
    { id: 'planner', label: 'AI Planner', icon: <Sparkles className="w-4 h-4" />, category: 'core' },
    { id: 'timer', label: 'Timer', icon: <Clock className="w-4 h-4" />, category: 'core' },
    { id: 'calendar', label: 'Calendar', icon: <Calendar className="w-4 h-4" />, category: 'core' },

    // Exam & Mastery Suite
    { id: 'gemini_notebook', label: 'Gemini Notebook', icon: <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />, category: 'mastery', badge: 'GEMINI' },
    { id: 'boss_battle', label: 'Boss Battle RPG', icon: <Swords className="w-4 h-4 text-amber-600 dark:text-amber-400" />, category: 'mastery', badge: 'RPG' },
    { id: 'knowledge_graph', label: 'Knowledge Web', icon: <Network className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />, category: 'mastery' },
    { id: 'examiner_red_pen', label: "Examiner’s Red Pen", icon: <PenTool className="w-4 h-4 text-rose-500" />, category: 'mastery', badge: 'AI' },
    { id: 'mistake_vault', label: 'Mistake Vault', icon: <BookmarkCheck className="w-4 h-4 text-amber-500" />, category: 'mastery', badge: 'NEW' },
    { id: 'tests', label: 'Tests & Mocks', icon: <FileCheck className="w-4 h-4" />, category: 'mastery' },
    { id: 'flashcards', label: 'Flashcards', icon: <Brain className="w-4 h-4" />, category: 'mastery' },
    { id: 'blurt_recall', label: 'Blurt Recall', icon: <Zap className="w-4 h-4 text-amber-500" />, category: 'mastery' },
    { id: 'knowledge_refurbish', label: 'Refurbish Mode', icon: <Sparkles className="w-4 h-4 text-amber-500" />, category: 'mastery', badge: 'AUDIT' },
    { id: 'marks_recovery', label: 'Marks Recovery', icon: <TrendingUp className="w-4 h-4 text-emerald-500" />, category: 'mastery', badge: 'TRIAGE' },
    { id: 'paper_auto_forcing', label: 'Exam Auto-Forcing', icon: <Compass className="w-4 h-4 text-rose-500" />, category: 'mastery', badge: 'FORCED' },
    { id: 'revision', label: 'Revision', icon: <RotateCcw className="w-4 h-4" />, category: 'mastery' },

    // Tasks & School
    { id: 'assignments', label: 'Assignments', icon: <CheckSquare className="w-4 h-4" />, category: 'tasks' },
    { id: 'missed_work', label: 'Missed Work', icon: <AlertCircle className="w-4 h-4" />, category: 'tasks' },
    { id: 'classroom', label: 'Classroom Hub', icon: <GraduationCap className="w-4 h-4" />, category: 'tasks' },
    { id: 'groups', label: 'Study Groups', icon: <Users className="w-4 h-4" />, category: 'tasks' },
    { id: 'vaults', label: 'Vaults', icon: <Archive className="w-4 h-4" />, category: 'tasks' },

    // Growth & Stats
    { id: 'gamification', label: 'Quests & XP', icon: <Trophy className="w-4 h-4 text-amber-500" />, category: 'growth' },
    { id: 'virtual_room', label: 'Study Room', icon: <Headphones className="w-4 h-4 text-indigo-500" />, category: 'growth' },
    { id: 'progress', label: 'Progress', icon: <TrendingUp className="w-4 h-4" />, category: 'growth' },
    { id: 'tutor', label: 'AI Tutor', icon: <Bot className="w-4 h-4" />, category: 'growth' },
    { id: 'activity', label: 'Activity', icon: <Activity className="w-4 h-4" />, category: 'growth' },
    { id: 'data_backup', label: 'Data & Backup', icon: <Database className="w-4 h-4 text-emerald-600" />, category: 'growth' },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" />, category: 'growth' },
  ];

  const visibleNavItems = navCategory === 'all' 
    ? navItems 
    : navItems.filter(item => item.category === navCategory);

  const isDarkMode = themeConfig?.mode === 'dark' || (themeConfig?.mode === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <header className="bg-header border-b border-theme text-primary sticky top-0 z-40 shadow-xs transition-colors duration-200">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        {/* Brand */}
        <div className="flex items-center gap-2.5 sm:gap-3 cursor-pointer shrink-0" onClick={() => setActiveTab('dashboard')}>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary p-0.5 flex items-center justify-center shadow-xs">
            <div className="w-full h-full bg-primary rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-serif italic font-bold tracking-tight text-primary flex items-center gap-1.5 sm:gap-2">
              StudyPlanner <span className="text-[9px] sm:text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-theme-accent text-primary border border-theme font-sans font-semibold hidden xs:inline">{THEME_PALETTES[themeConfig?.palette || themeConfig?.preset || 'natural_ethos']?.name || 'Natural Ethos'}</span>
            </h1>
            <p className="text-[10px] sm:text-[11px] text-muted hidden lg:block">Personalized Academic Organizer & AI Tutor</p>
          </div>
        </div>

        {/* Right Actions - Horizontally Scrollable on Mobile with Smooth Momentum */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink min-w-0 overflow-x-auto no-scrollbar scroll-smooth py-1">
          {/* Global Command Palette Quick Trigger (Cmd + K) */}
          {onOpenCommandPalette && (
            <button
              onClick={onOpenCommandPalette}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-theme-accent hover:opacity-85 text-primary border border-theme transition shadow-2xs cursor-pointer text-xs font-medium shrink-0"
              title="Open Command Palette (Cmd + K / Ctrl + K)"
              aria-label="Command Palette"
            >
              <Search className="w-3.5 h-3.5 text-stone-400" />
              <span className="hidden xl:inline text-[11px] text-stone-500 dark:text-stone-400">Search tools...</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-stone-200/80 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-300 dark:border-stone-700">
                ⌘K
              </kbd>
            </button>
          )}

          {/* Cloud / Dual-Layer Save Status Indicator */}
          <button
            onClick={() => {
              if (onOpenDeviceSync) {
                onOpenDeviceSync();
              } else if (onForceSaveCloud) {
                onForceSaveCloud();
              }
            }}
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer shrink-0 ${
              syncInfo.state === 'saving'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                : livePeerCount > 1
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 shadow-xs'
                : syncInfo.mode === 'cloud' && syncInfo.state === 'saved'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-theme-accent text-primary border-theme hover:opacity-90'
            }`}
            title={`Real-Time Sync Status: ${livePeerCount > 1 ? `${livePeerCount} devices connected & synced in real-time` : syncInfo.message} (Click to open Multi-Device & Cloud Sync)`}
          >
            {syncInfo.state === 'saving' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
                <span className="text-[11px]">Syncing</span>
              </>
            ) : livePeerCount > 1 ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] font-bold">{livePeerCount} Devices Live</span>
              </>
            ) : syncInfo.mode === 'cloud' ? (
              <>
                <Cloud className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[11px]">Synced</span>
              </>
            ) : (
              <>
                <HardDrive className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px]">Saved</span>
              </>
            )}
          </button>

          {/* Encrypted Offline Backup & Restore Modal */}
          {onOpenBackupRestore && (
            <button
              onClick={onOpenBackupRestore}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-theme-accent hover:opacity-85 text-primary border border-theme text-xs font-semibold transition shadow-2xs cursor-pointer shrink-0"
              title="Encrypted JSON Backup & Restore: Download encrypted study vault snapshot or restore full historical data"
            >
              <HardDrive className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px]">Backup</span>
            </button>
          )}

          {/* Quick Theme Toggle Button (Light/Dark/System) */}
          {onUpdateTheme && (
            <button
              onClick={handleQuickThemeToggle}
              className="p-2 rounded-full bg-theme-accent hover:opacity-80 text-primary border border-theme transition shadow-2xs cursor-pointer flex items-center justify-center shrink-0"
              title={`Switch to ${isDarkMode ? 'Light' : 'Dark'} Mode (Currently: ${themeConfig?.mode || 'system'})`}
              aria-label="Toggle Theme Mode"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-primary" />
              )}
            </button>
          )}

          {/* 24/7 Automated Exam Countdown & Syllabus Alerts Button */}
          {onOpenExamAutomationModal && (
            <button
              onClick={onOpenExamAutomationModal}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-bold text-xs transition shadow-2xs cursor-pointer active:scale-95 shrink-0"
              title="24/7 Automated Exam Countdown & Syllabus Digest: Set up automated background email, push & WhatsApp alerts"
            >
              <Bell className="w-3.5 h-3.5 text-primary" />
              <span className="font-semibold text-[11px] sm:text-xs">Exam Alerts</span>
            </button>
          )}

          {/* WhatsApp Study Alerts & Coach Button */}
          {onOpenWhatsAppModal && (
            <button
              onClick={onOpenWhatsAppModal}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#075E54] dark:text-emerald-300 border border-[#25D366]/40 font-bold text-xs transition shadow-2xs cursor-pointer active:scale-95 shrink-0"
              title="WhatsApp Study Companion: Automated flight plans, streak digests & two-way study coach bot"
            >
              <Smartphone className="w-3.5 h-3.5 text-[#25D366]" />
              <span className="font-semibold text-[11px] sm:text-xs">WhatsApp</span>
            </button>
          )}

          {/* Urdu / English Language Switcher */}
          {onToggleLanguage && (
            <button
              onClick={() => onToggleLanguage(userLanguage === 'en' ? 'ur' : 'en')}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-theme-accent hover:opacity-85 text-primary border border-theme text-xs font-semibold transition shadow-2xs cursor-pointer active:scale-95 shrink-0"
              title="Switch Language (English / اردو)"
            >
              <Languages className="w-3.5 h-3.5 text-primary" />
              <span className="font-semibold text-[11px] sm:text-xs">
                {userLanguage === 'ur' ? 'اردو' : 'English'}
              </span>
            </button>
          )}

          {/* Unified Study Tools & AI Suite Launcher Button */}
          <button
            onClick={() => setIsToolsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-theme-accent hover:opacity-85 text-primary border border-theme text-xs font-semibold transition shadow-2xs cursor-pointer active:scale-95 shrink-0"
            title="Open Study Tools & AI Exam Suite (Feynman, Red Pen, Mistake Vault, Knowledge Tree, Audio, Print Kits)"
          >
            <Compass className="w-3.5 h-3.5 text-primary" />
            <span className="font-semibold text-[11px] sm:text-xs">Study Tools</span>
            <span className="px-1.5 py-0.2 rounded-full bg-primary text-white text-[9px] font-bold">Suite</span>
          </button>

          {/* PWA App Install Button (Desktop & Mobile) */}
          <PWAInstallButton variant="compact" />

          {/* Quick Start Studying Button */}
          <button
            onClick={onOpenQuickTimer}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-primary hover:opacity-90 text-white font-medium text-xs transition shadow-sm active:scale-95 cursor-pointer shrink-0"
            title="Immediately start a study session timer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Start Study</span>
          </button>

          {/* Academic Year Profile Chip */}
          <button
            onClick={() => onOpenProfileModal ? onOpenProfileModal() : setActiveTab('settings')}
            className="hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-theme-accent hover:opacity-85 text-primary border border-theme text-xs font-medium transition cursor-pointer shadow-2xs group shrink-0"
            title="Current Academic Year & Cohort Profile (Click to view & edit)"
          >
            <GraduationCap className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
            <span className="font-mono font-bold">{userProfile?.academicYear || '2026-2027'}</span>
            <span className="hidden xl:inline text-[11px] text-muted">• {userProfile?.yearLevel || 'Year 3 (Junior)'}</span>
          </button>

          {/* User Account / ID Profile */}
          {user ? (
            <div className="flex items-center gap-1 bg-theme-accent px-2 sm:px-2.5 py-1.5 rounded-xl border border-theme transition shrink-0">
              <button
                onClick={() => onOpenProfileModal ? onOpenProfileModal() : setActiveTab('settings')}
                className="flex items-center gap-1.5 sm:gap-2 hover:opacity-80 transition cursor-pointer text-left"
                title="View & Edit Student Profile"
              >
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold overflow-hidden shrink-0">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    (userProfile?.displayName || user.displayName || user.email || 'S').charAt(0).toUpperCase()
                  )}
                </div>
                <span className="text-xs font-medium text-primary max-w-[90px] sm:max-w-[120px] truncate hidden sm:inline">
                  {userProfile?.displayName || user.displayName || user.email?.split('@')[0] || 'User'}
                </span>
              </button>
              <button
                onClick={onSignOut}
                className="text-muted hover:text-rose-500 p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer ml-0.5"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Local / Guest Student Profile Badge */}
              <button
                onClick={() => onOpenProfileModal ? onOpenProfileModal() : setActiveTab('settings')}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-theme-accent hover:opacity-85 text-primary border border-theme text-xs font-medium transition shadow-2xs cursor-pointer"
                title="Student Profile (Click to view & edit)"
              >
                <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">
                  {(userProfile?.displayName || userProfile?.name || 'S').charAt(0).toUpperCase()}
                </div>
                <span className="hidden xs:inline max-w-[100px] truncate font-medium">
                  {userProfile?.displayName || userProfile?.name || 'Student Profile'}
                </span>
              </button>

              <button
                onClick={onOpenAuthModal}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-primary hover:opacity-90 text-white text-xs font-medium transition shadow-xs cursor-pointer min-h-[38px]"
                title="Sign in to sync with Cloud"
              >
                <User className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            </div>
          )}

          {/* Dedicated Mobile Menu Hamburger Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden flex items-center justify-center p-2 rounded-xl bg-theme-accent hover:opacity-85 text-primary border border-theme transition cursor-pointer min-h-[44px] min-w-[44px] shadow-2xs shrink-0"
            aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            title="Navigation Menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* MOBILE COLLAPSIBLE ACCORDION NAVIGATION MENU */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-theme bg-surface shadow-2xl px-4 py-4 space-y-4 max-h-[82vh] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-theme/60">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-primary" />
              <span>Study Sections & Tools</span>
            </div>
            <span className="text-[11px] font-mono text-muted">
              Tap section to expand
            </span>
          </div>

          <div className="space-y-2.5">
            {sectionDefinitions.map(sec => {
              const isCollapsed = collapsedSections[sec.key];
              const secItems = navItems.filter(item => item.category === sec.key);
              const hasActiveItem = secItems.some(i => i.id === activeTab);

              return (
                <div key={sec.key} className="rounded-2xl border border-theme bg-header/60 overflow-hidden shadow-2xs">
                  {/* Accordion Header - 44px+ touch target */}
                  <button
                    onClick={() => toggleSection(sec.key)}
                    className="w-full flex items-center justify-between px-3.5 py-3 min-h-[48px] hover:bg-theme-accent/50 transition cursor-pointer text-left"
                    aria-expanded={!isCollapsed}
                  >
                    <div className="flex items-center gap-2.5">
                      {sec.icon}
                      <span className={`text-xs font-bold ${hasActiveItem ? 'text-primary' : 'text-foreground'}`}>
                        {sec.title}
                      </span>
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-theme-accent text-muted border border-theme/40">
                        {secItems.length}
                      </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-muted transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`} />
                  </button>

                  {/* Accordion Items - 44px touch targets */}
                  {!isCollapsed && (
                    <div className="p-2 pt-0 grid grid-cols-1 gap-1 border-t border-theme/40 bg-surface/50">
                      {secItems.map(item => {
                        const isActive = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setActiveTab(item.id);
                              setIsMobileMenuOpen(false);
                            }}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-xl min-h-[44px] transition-colors cursor-pointer text-left text-xs ${
                              isActive
                                ? 'bg-primary text-white font-bold shadow-xs'
                                : 'text-foreground hover:bg-theme-accent/60'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className={isActive ? 'text-white' : 'text-muted'}>{item.icon}</span>
                              <span className="font-medium">{item.label}</span>
                            </div>
                            {item.badge && (
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                isActive 
                                  ? 'bg-white/20 text-white' 
                                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                              }`}>
                                {item.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Quick Hub Launchers inside Mobile Menu with 44px touch targets */}
          <div className="pt-2 border-t border-theme/60 flex flex-col gap-2">
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsToolsModalOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl min-h-[44px] bg-primary text-white font-bold text-xs shadow-xs cursor-pointer active:scale-98 transition"
            >
              <Compass className="w-4 h-4" />
              <span>Open AI Tools & Exam Suite (12)</span>
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleQuickThemeToggle}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl min-h-[44px] bg-theme-accent hover:opacity-85 text-primary border border-theme text-xs font-semibold cursor-pointer active:scale-98 transition"
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-500" />}
                <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
              {onOpenDeviceSync && (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenDeviceSync();
                  }}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl min-h-[44px] bg-theme-accent hover:opacity-85 text-primary border border-theme text-xs font-semibold cursor-pointer active:scale-98 transition"
                >
                  <RefreshCw className="w-4 h-4 text-emerald-600" />
                  <span>Cloud / Sync</span>
                </button>
              )}
              {onOpenBackupRestore && (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenBackupRestore();
                  }}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl min-h-[44px] bg-theme-accent hover:opacity-85 text-primary border border-theme text-xs font-semibold cursor-pointer active:scale-98 transition"
                >
                  <HardDrive className="w-4 h-4 text-primary" />
                  <span>Backup & Restore</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED MOBILE QUICK ACCESS SCROLLBAR - 44px Touch Targets */}
      <div className="md:hidden border-t border-theme/60 bg-theme-accent/30 px-3 py-2.5 overflow-x-auto no-scrollbar scroll-smooth flex items-center gap-2 text-xs">
        {onOpenExamAutomationModal && (
          <button
            onClick={onOpenExamAutomationModal}
            className="flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-2xl bg-primary/20 text-primary border border-primary/40 font-bold whitespace-nowrap shrink-0 shadow-2xs active:scale-95 cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5 text-primary" />
            <span>Exam Countdown Alerts</span>
          </button>
        )}

        <button
          onClick={() => setIsToolsModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-2xl bg-primary text-white font-bold whitespace-nowrap shrink-0 shadow-2xs active:scale-95 cursor-pointer"
        >
          <Compass className="w-3.5 h-3.5" />
          <span>All AI Tools (12)</span>
        </button>

        {onOpenWhatsAppModal && (
          <button
            onClick={onOpenWhatsAppModal}
            className="flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-2xl bg-[#25D366]/20 text-[#075E54] dark:text-emerald-300 border border-[#25D366]/40 font-bold whitespace-nowrap shrink-0 shadow-2xs active:scale-95 cursor-pointer"
          >
            <Smartphone className="w-3.5 h-3.5 text-[#25D366]" />
            <span>WhatsApp Coach</span>
          </button>
        )}

        {onOpenVoiceFeynman && (
          <button
            onClick={onOpenVoiceFeynman}
            className="flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-bold whitespace-nowrap shrink-0 shadow-2xs active:scale-95 cursor-pointer"
          >
            <Mic className="w-3.5 h-3.5 text-amber-600" />
            <span>Feynman Exam</span>
          </button>
        )}

        {onOpenKnowledgeTree && (
          <button
            onClick={onOpenKnowledgeTree}
            className="flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 font-bold whitespace-nowrap shrink-0 shadow-2xs active:scale-95 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>Knowledge Tree</span>
          </button>
        )}

        {onOpenPredictiveGrades && (
          <button
            onClick={onOpenPredictiveGrades}
            className="flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-bold whitespace-nowrap shrink-0 shadow-2xs active:scale-95 cursor-pointer"
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span>Predictive Grade</span>
          </button>
        )}
      </div>

      {/* Main Navigation with Category Quick Filter Strip */}
      <div className="border-t border-theme bg-surface/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Category Filter Pills - 40px+ Touch Target */}
          <div className="flex items-center gap-1.5 pt-2.5 pb-1.5 overflow-x-auto no-scrollbar text-[11px] font-semibold border-b border-theme/40">
            <button
              onClick={() => setNavCategory('all')}
              className={`px-3.5 py-2 min-h-[40px] rounded-xl transition cursor-pointer shrink-0 flex items-center justify-center ${
                navCategory === 'all'
                  ? 'bg-primary text-white font-bold'
                  : 'text-muted hover:text-primary hover:bg-theme-accent/50'
              }`}
            >
              All Sections ({navItems.length})
            </button>
            <button
              onClick={() => setNavCategory('core')}
              className={`px-3.5 py-2 min-h-[40px] rounded-xl transition cursor-pointer shrink-0 flex items-center justify-center ${
                navCategory === 'core'
                  ? 'bg-primary text-white font-bold'
                  : 'text-muted hover:text-primary hover:bg-theme-accent/50'
              }`}
            >
              Core Study
            </button>
            <button
              onClick={() => setNavCategory('mastery')}
              className={`px-3.5 py-2 min-h-[40px] rounded-xl transition cursor-pointer shrink-0 flex items-center gap-1 justify-center ${
                navCategory === 'mastery'
                  ? 'bg-primary text-white font-bold'
                  : 'text-muted hover:text-primary hover:bg-theme-accent/50'
              }`}
            >
              <span>Exam & Mastery</span>
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-bold">AI</span>
            </button>
            <button
              onClick={() => setNavCategory('tasks')}
              className={`px-3.5 py-2 min-h-[40px] rounded-xl transition cursor-pointer shrink-0 flex items-center justify-center ${
                navCategory === 'tasks'
                  ? 'bg-primary text-white font-bold'
                  : 'text-muted hover:text-primary hover:bg-theme-accent/50'
              }`}
            >
              Work & Classes
            </button>
            <button
              onClick={() => setNavCategory('growth')}
              className={`px-3.5 py-2 min-h-[40px] rounded-xl transition cursor-pointer shrink-0 flex items-center justify-center ${
                navCategory === 'growth'
                  ? 'bg-primary text-white font-bold'
                  : 'text-muted hover:text-primary hover:bg-theme-accent/50'
              }`}
            >
              Growth & Stats
            </button>
          </div>

          {/* Nav Items Bar - 44px Touch Targets */}
          <nav className="flex space-x-1.5 sm:space-x-2 overflow-x-auto py-2.5 scrollbar-none text-xs">
            {visibleNavItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 min-h-[44px] rounded-xl font-medium whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-theme-accent text-primary font-bold border border-theme shadow-2xs'
                      : 'text-muted hover:text-primary hover:bg-theme-accent/50'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="px-1.5 py-0.2 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[9px] font-bold">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* UNIFIED STUDY TOOLS & AI EXAM SUITE MODAL */}
      {isToolsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-4xl max-h-[90vh] rounded-3xl bg-surface border border-theme shadow-2xl overflow-y-auto p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-theme pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-serif font-bold text-primary">
                    AI Study & Exam Mastery Suite
                  </h2>
                  <p className="text-xs text-muted">
                    Quick-launch intelligent study instruments, oral defense exams, and executive organizers.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsToolsModalOpen(false)}
                className="p-2 rounded-xl hover:bg-theme-accent text-muted hover:text-primary transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Grid of Tools */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {/* Tool 0: 24/7 Automated Exam Countdown & Digest */}
              {onOpenExamAutomationModal && (
                <div
                  onClick={() => {
                    onOpenExamAutomationModal();
                    setIsToolsModalOpen(false);
                  }}
                  className="p-4 rounded-2xl bg-surface-raised hover:bg-primary/10 border border-primary/30 transition cursor-pointer group space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center text-primary">
                      <Bell className="w-4 h-4" />
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">
                      24/7 Server Dispatch
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-primary group-hover:text-primary transition-colors">
                    Automated Exam Countdown & Syllabus
                  </h3>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Automated background email, WhatsApp & push dispatches with real-time days left, % syllabus remaining, and due revision sets.
                  </p>
                </div>
              )}

              {/* Tool 1: Examiner's Red Pen */}
              <div
                onClick={() => {
                  setActiveTab('examiner_red_pen');
                  setIsToolsModalOpen(false);
                }}
                className="p-4 rounded-2xl bg-surface-raised hover:bg-rose-500/10 border border-rose-500/30 transition cursor-pointer group space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/15 flex items-center justify-center text-rose-600">
                    <PenTool className="w-4 h-4" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                    Rubric Grader
                  </span>
                </div>
                <h3 className="text-xs font-bold text-primary group-hover:text-rose-600 transition-colors">
                  The Examiner’s Red Pen
                </h3>
                <p className="text-[11px] text-muted leading-relaxed">
                  Submit past paper answers to a strict board examiner. Line-by-line mark breakdown & 10/10 model answers.
                </p>
              </div>

              {/* Tool 2: Exam Autopsy & Mistake Vault */}
              <div
                onClick={() => {
                  setActiveTab('mistake_vault');
                  setIsToolsModalOpen(false);
                }}
                className="p-4 rounded-2xl bg-surface-raised hover:bg-amber-500/10 border border-amber-500/30 transition cursor-pointer group space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-600">
                    <BookmarkCheck className="w-4 h-4" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-bold">
                    Anti-Careless
                  </span>
                </div>
                <h3 className="text-xs font-bold text-primary group-hover:text-amber-600 transition-colors">
                  Exam Autopsy & Mistake Vault
                </h3>
                <p className="text-[11px] text-muted leading-relaxed">
                  Diagnose root cognitive causes for lost marks and drill uncured errors until you achieve a 100% cure rate.
                </p>
              </div>

              {/* Tool 3: Voice Socratic Oral Exam (Feynman) */}
              {onOpenVoiceFeynman && (
                <div
                  onClick={() => {
                    setIsToolsModalOpen(false);
                    onOpenVoiceFeynman();
                  }}
                  className="p-4 rounded-2xl bg-surface-raised hover:bg-amber-500/10 border border-amber-500/30 transition cursor-pointer group space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-600">
                      <Mic className="w-4 h-4" />
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                      Voice Oral
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-primary group-hover:text-amber-600 transition-colors">
                    Socratic Feynman Exam
                  </h3>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Defend topics verbally using Richard Feynman's technique. AI challenges overcomplicated jargon.
                  </p>
                </div>
              )}

              {/* Tool 4: Visual Knowledge Tree */}
              {onOpenKnowledgeTree && (
                <div
                  onClick={() => {
                    setIsToolsModalOpen(false);
                    onOpenKnowledgeTree();
                  }}
                  className="p-4 rounded-2xl bg-surface-raised hover:bg-indigo-500/10 border border-indigo-500/30 transition cursor-pointer group space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-600">
                      <Layers className="w-4 h-4" />
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 text-[10px] font-bold">
                      Interactive Mind Map
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-primary group-hover:text-indigo-600 transition-colors">
                    Visual Knowledge Tree
                  </h3>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Interactive radial syllabus mind map with node mastery percentages and blind spot highlighting.
                  </p>
                </div>
              )}

              {/* Tool 5: Predictive Grade Simulator */}
              {onOpenPredictiveGrades && (
                <div
                  onClick={() => {
                    setIsToolsModalOpen(false);
                    onOpenPredictiveGrades();
                  }}
                  className="p-4 rounded-2xl bg-surface-raised hover:bg-emerald-500/10 border border-emerald-500/30 transition cursor-pointer group space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-600">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                      Forecast
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-primary group-hover:text-emerald-600 transition-colors">
                    Predictive Grade Simulator
                  </h3>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Simulate your target grade outcomes and determine the minimum effective study hours needed.
                  </p>
                </div>
              )}

              {/* Tool 6: WhatsApp Study Alerts & Coach */}
              {onOpenWhatsAppModal && (
                <div
                  onClick={() => {
                    setIsToolsModalOpen(false);
                    onOpenWhatsAppModal();
                  }}
                  className="p-4 rounded-2xl bg-surface-raised hover:bg-emerald-500/10 border border-emerald-500/30 transition cursor-pointer group space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-[#25D366]/20 flex items-center justify-center text-[#25D366]">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-[#25D366]/20 text-[#075E54] dark:text-emerald-300 text-[10px] font-bold">
                      Daily Push
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-primary group-hover:text-emerald-600 transition-colors">
                    WhatsApp Study Companion
                  </h3>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Automated daily flight plans, streak digests, and 2-way AI study coach bot on WhatsApp.
                  </p>
                </div>
              )}

              {/* Tool 7: Daily Email Agenda */}
              {onOpenEmailAgendaModal && (
                <div
                  onClick={() => {
                    setIsToolsModalOpen(false);
                    onOpenEmailAgendaModal();
                  }}
                  className="p-4 rounded-2xl bg-surface-raised hover:bg-sky-500/10 border border-sky-500/30 transition cursor-pointer group space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-sky-500/15 flex items-center justify-center text-sky-600">
                      <Mail className="w-4 h-4" />
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-800 dark:text-sky-300 text-[10px] font-bold">
                      7:30 AM Briefing
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-primary group-hover:text-sky-600 transition-colors">
                    Email Flight Plan
                  </h3>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Daily scheduled agenda and homework alerts sent straight to your email inbox every morning.
                  </p>
                </div>
              )}

              {/* Tool 8: Audio Flashcards & Podcast */}
              {onOpenAudioStudy && (
                <div
                  onClick={() => {
                    setIsToolsModalOpen(false);
                    onOpenAudioStudy();
                  }}
                  className="p-4 rounded-2xl bg-surface-raised hover:bg-violet-500/10 border border-violet-500/30 transition cursor-pointer group space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-violet-500/15 flex items-center justify-center text-violet-600">
                      <Headphones className="w-4 h-4" />
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-800 dark:text-violet-300 text-[10px] font-bold">
                      Hands-Free
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-primary group-hover:text-violet-600 transition-colors">
                    Focus Audio Studio
                  </h3>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Audio flashcards, binaural focus tones, and audio chapter summaries for commute revision.
                  </p>
                </div>
              )}

              {/* Tool 9: Printable Revision Kit */}
              {onOpenPrintKit && (
                <div
                  onClick={() => {
                    setIsToolsModalOpen(false);
                    onOpenPrintKit();
                  }}
                  className="p-4 rounded-2xl bg-surface-raised hover:bg-theme-accent border border-theme transition cursor-pointer group space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-theme-accent flex items-center justify-center text-primary">
                      <Printer className="w-4 h-4" />
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-theme-accent text-primary text-[10px] font-bold">
                      Offline A4
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-primary group-hover:text-primary transition-colors">
                    Print Revision Kits
                  </h3>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Printable physical cheat sheets, A4 wall planners, and paper flashcard templates.
                  </p>
                </div>
              )}

              {/* Tool 10: In-App Optical QR Scanner */}
              {onOpenQRScanner && (
                <div
                  onClick={() => {
                    setIsToolsModalOpen(false);
                    onOpenQRScanner();
                  }}
                  className="p-4 rounded-2xl bg-surface-raised hover:bg-theme-accent border border-theme transition cursor-pointer group space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-theme-accent flex items-center justify-center text-primary">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-theme-accent text-primary text-[10px] font-bold">
                      Camera
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-primary group-hover:text-primary transition-colors">
                    Optical QR Scanner
                  </h3>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Instant in-app camera scanner for cross-device sync tokens, physical worksheets, and vaults.
                  </p>
                </div>
              )}

              {/* Tool 11: AI Autonomous Ingestion */}
              {onOpenMaterialImport && (
                <div
                  onClick={() => {
                    setIsToolsModalOpen(false);
                    onOpenMaterialImport();
                  }}
                  className="p-4 rounded-2xl bg-surface-raised hover:bg-indigo-500/10 border border-indigo-500/30 transition cursor-pointer group space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-600">
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 text-[10px] font-bold">
                      Auto-Build
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-primary group-hover:text-indigo-600 transition-colors">
                    AI Material Ingestion
                  </h3>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Drop your PDF syllabus or lecture notes to auto-generate full chapter trees, tests, and flashcards.
                  </p>
                </div>
              )}

              {/* Tool 12: Google Workspace Hub */}
              {onOpenWorkspaceHub && (
                <div
                  onClick={() => {
                    setIsToolsModalOpen(false);
                    onOpenWorkspaceHub('calendar');
                  }}
                  className="p-4 rounded-2xl bg-surface-raised hover:bg-sky-500/10 border border-sky-500/30 transition cursor-pointer group space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-sky-500/15 flex items-center justify-center text-sky-600">
                      <Sparkles className="w-4 h-4 text-sky-500" />
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-800 dark:text-sky-300 text-[10px] font-bold">
                      G-Suite
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-primary group-hover:text-sky-600 transition-colors">
                    Google Workspace Hub
                  </h3>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Real-time synchronization with Google Classroom, Drive, Calendar, Keep, Docs, and Meet.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};


