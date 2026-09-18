import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Sparkles, 
  BookOpen, 
  Brain, 
  Flame, 
  Clock, 
  Calendar, 
  Trophy, 
  Bot, 
  Settings, 
  ShieldAlert, 
  CheckSquare, 
  Layers, 
  Users, 
  Activity, 
  HardDrive, 
  Bell, 
  Swords, 
  Network, 
  ArrowRight, 
  CornerDownLeft,
  X,
  Languages,
  Zap,
  BookmarkCheck,
  FileCheck
} from 'lucide-react';
import { ActiveTab, Subject } from '../types';

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Navigation' | 'Academic Retrieval' | 'Exam Prep' | 'Workspace & Settings' | 'Urdu & Language';
  icon: React.ReactNode;
  badge?: string;
  keywords?: string[];
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: ActiveTab) => void;
  subjects: Subject[];
  onSelectSubject?: (subjectId: string) => void;
  onToggleTheme?: () => void;
  onTriggerAutonomousPushTest?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  setActiveTab,
  subjects,
  onSelectSubject,
  onToggleTheme,
  onTriggerAutonomousPushTest
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Global shortcut listener: Cmd+K / Ctrl+K & Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open
          (window as any).__openCommandPalette?.();
        }
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Build command items
  const commands: CommandItem[] = [
    // High-priority quick actions
    {
      id: 'knowledge_refurbish',
      title: 'Knowledge Refurbishment Mode',
      subtitle: 'Untimed closed-book recall audited against syllabus criteria',
      category: 'Academic Retrieval',
      icon: <Brain className="w-4 h-4 text-amber-500" />,
      badge: 'New Criteria Protocol',
      keywords: ['recall', 'audit', 'refurbish', 'master sheet', 'weakness', 'criteria'],
      action: () => {
        setActiveTab('knowledge_refurbish');
        onClose();
      }
    },
    {
      id: 'marks_recovery',
      title: 'Marks Recovery Engine',
      subtitle: 'Targeted recovery on exam weaknesses & historical pitfalls',
      category: 'Academic Retrieval',
      icon: <Flame className="w-4 h-4 text-rose-500" />,
      keywords: ['marks', 'recovery', 'weak topics', 'exam boost'],
      action: () => {
        setActiveTab('marks_recovery');
        onClose();
      }
    },
    {
      id: 'urdu_syllabus_parser',
      title: 'Urdu Syllabus & Subject Engine (اردو نصاب)',
      subtitle: 'Bilingual parser preserving native Urdu terminology and RTL layouts',
      category: 'Urdu & Language',
      icon: <Languages className="w-4 h-4 text-emerald-500" />,
      badge: 'Bilingual RTL',
      keywords: ['urdu', 'اردو', 'pakistan', 'islamiyat', 'bilingual', 'rtl'],
      action: () => {
        setActiveTab('syllabus');
        onClose();
      }
    },
    {
      id: 'autonomous_push_test',
      title: 'Trigger Autonomous Push Notification Test',
      subtitle: 'Verify 24/7 background VAPID push scheduler',
      category: 'Workspace & Settings',
      icon: <Bell className="w-4 h-4 text-indigo-500" />,
      badge: '24/7 VAPID',
      keywords: ['push', 'notification', 'background', 'cron', 'alerts', 'vapid'],
      action: () => {
        if (onTriggerAutonomousPushTest) {
          onTriggerAutonomousPushTest();
        }
        onClose();
      }
    },
    {
      id: 'dashboard',
      title: 'Flight Deck Dashboard',
      subtitle: 'Daily agenda, focus radar, and academic runway metrics',
      category: 'Navigation',
      icon: <Activity className="w-4 h-4 text-blue-500" />,
      keywords: ['home', 'dashboard', 'stats', 'runway'],
      action: () => {
        setActiveTab('dashboard');
        onClose();
      }
    },
    {
      id: 'syllabus',
      title: 'Syllabus Tracker & Board Sync',
      subtitle: 'Complete curriculum matrix, chapters, and topic completion',
      category: 'Navigation',
      icon: <BookOpen className="w-4 h-4 text-blue-500" />,
      keywords: ['curriculum', 'chapters', 'topics', 'status', 'syllabus'],
      action: () => {
        setActiveTab('syllabus');
        onClose();
      }
    },
    {
      id: 'gemini_notebook',
      title: 'Gemini AI Study Notebook',
      subtitle: 'Interactive AI tutor, deep summaries, and concept breakdown',
      category: 'Academic Retrieval',
      icon: <Bot className="w-4 h-4 text-purple-500" />,
      keywords: ['ai', 'gemini', 'notes', 'summaries', 'tutor'],
      action: () => {
        setActiveTab('gemini_notebook');
        onClose();
      }
    },
    {
      id: 'boss_battle',
      title: 'Examiner Boss Battle Arena',
      subtitle: 'Gamified high-stakes mock exam simulations with health bars',
      category: 'Exam Prep',
      icon: <Swords className="w-4 h-4 text-red-500" />,
      keywords: ['boss', 'exam', 'battle', 'game', 'quiz'],
      action: () => {
        setActiveTab('boss_battle');
        onClose();
      }
    },
    {
      id: 'knowledge_graph',
      title: 'Interactive Knowledge Graph',
      subtitle: 'Visual node relationships and inter-chapter prerequisites',
      category: 'Academic Retrieval',
      icon: <Network className="w-4 h-4 text-teal-500" />,
      keywords: ['graph', 'mind map', 'nodes', 'network', 'connections'],
      action: () => {
        setActiveTab('knowledge_graph');
        onClose();
      }
    },
    {
      id: 'examiner_red_pen',
      title: 'Examiner Red Pen Audit',
      subtitle: 'Rigorous critique marking scheme and deductions',
      category: 'Exam Prep',
      icon: <ShieldAlert className="w-4 h-4 text-rose-500" />,
      keywords: ['red pen', 'audit', 'critique', 'examiner', 'marking'],
      action: () => {
        setActiveTab('examiner_red_pen');
        onClose();
      }
    },
    {
      id: 'flashcards',
      title: 'Spaced Repetition Flashcards',
      subtitle: 'Leitner & SM-2 memory retention intervals',
      category: 'Academic Retrieval',
      icon: <Layers className="w-4 h-4 text-amber-500" />,
      keywords: ['flashcards', 'sm2', 'retention', 'leitner', 'cards'],
      action: () => {
        setActiveTab('flashcards');
        onClose();
      }
    },
    {
      id: 'timer',
      title: 'Zen Sprint & Focus Timer',
      subtitle: 'Pomodoro intervals with binaural beats & focus audio',
      category: 'Navigation',
      icon: <Clock className="w-4 h-4 text-emerald-500" />,
      keywords: ['timer', 'pomodoro', 'focus', 'zen', 'sprint'],
      action: () => {
        setActiveTab('timer');
        onClose();
      }
    },
    {
      id: 'planner',
      title: 'Study Planner & Timetable',
      subtitle: 'Automated revision schedule and daily targets',
      category: 'Navigation',
      icon: <Calendar className="w-4 h-4 text-sky-500" />,
      keywords: ['plan', 'schedule', 'timetable', 'calendar', 'targets'],
      action: () => {
        setActiveTab('planner');
        onClose();
      }
    },
    {
      id: 'toggle_theme',
      title: 'Toggle Color Theme / Dark Mode',
      subtitle: 'Switch between light paper and eye-comfort dark aesthetics',
      category: 'Workspace & Settings',
      icon: <Zap className="w-4 h-4 text-amber-400" />,
      keywords: ['theme', 'dark', 'light', 'mode', 'color'],
      action: () => {
        if (onToggleTheme) onToggleTheme();
        onClose();
      }
    },
    {
      id: 'settings',
      title: 'Workspace Settings & Notification Profiles',
      subtitle: 'Config 24/7 background email, WhatsApp & push dispatches',
      category: 'Workspace & Settings',
      icon: <Settings className="w-4 h-4 text-stone-500" />,
      keywords: ['settings', 'config', 'profile', 'notifications', 'email'],
      action: () => {
        setActiveTab('settings');
        onClose();
      }
    }
  ];

  // Append user's subjects as direct jump commands
  subjects.forEach(sub => {
    const isUrdu = sub.language === 'ur' || /[\u0600-\u06FF]/.test(sub.name);
    commands.push({
      id: `subject-${sub.id}`,
      title: `Jump to Subject: ${sub.name}`,
      subtitle: `${sub.chapters?.length || 0} chapters • ${isUrdu ? 'اردو نصاب' : 'English Curriculum'}`,
      category: isUrdu ? 'Urdu & Language' : 'Navigation',
      icon: <span className="text-sm">{sub.icon || (isUrdu ? '🇵🇰' : '📚')}</span>,
      badge: isUrdu ? 'اردو' : undefined,
      keywords: [sub.name.toLowerCase(), 'subject', isUrdu ? 'urdu' : 'english'],
      action: () => {
        setActiveTab('syllabus');
        if (onSelectSubject) {
          onSelectSubject(sub.id);
        }
        onClose();
      }
    });
  });

  // Filter commands by query
  const cleanQuery = query.trim().toLowerCase();
  const filtered = cleanQuery === '' 
    ? commands 
    : commands.filter(cmd => {
        const inTitle = cmd.title.toLowerCase().includes(cleanQuery);
        const inSubtitle = cmd.subtitle?.toLowerCase().includes(cleanQuery) || false;
        const inCategory = cmd.category.toLowerCase().includes(cleanQuery);
        const inKeywords = cmd.keywords?.some(k => k.includes(cleanQuery)) || false;
        return inTitle || inSubtitle || inCategory || inKeywords;
      });

  // Clamp selection
  useEffect(() => {
    setSelectedIndex(0);
  }, [cleanQuery]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      id="command-palette-backdrop"
      className="fixed inset-0 z-500 bg-stone-950/60 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        id="command-palette-modal"
        className="w-full max-w-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-stone-900 dark:text-stone-100 animate-scale-up"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50">
          <Search className="w-5 h-5 text-stone-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command, tool name, or subject... (e.g. Urdu, Refurbish, Boss, Timer)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-transparent border-none text-sm sm:text-base text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-0"
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <kbd className="hidden sm:inline-block px-2 py-1 text-[10px] font-mono font-semibold bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-md border border-stone-300 dark:border-stone-700">
              ESC
            </kbd>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Command List */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-stone-400 text-sm">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No tools, subjects, or actions found for "{query}"</p>
              <p className="text-xs text-stone-500 mt-1">Try searching for "Refurbish", "Urdu", "Boss", or "Timer"</p>
            </div>
          ) : (
            filtered.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={() => cmd.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition ${
                    isSelected
                      ? 'bg-amber-500/15 dark:bg-amber-500/20 text-stone-900 dark:text-stone-100'
                      : 'hover:bg-stone-100 dark:hover:bg-stone-800/60 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                      isSelected 
                        ? 'bg-amber-500 text-stone-950 border-amber-500' 
                        : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                    }`}>
                      {cmd.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs sm:text-sm truncate">
                          {cmd.title}
                        </span>
                        {cmd.badge && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 whitespace-nowrap">
                            {cmd.badge}
                          </span>
                        )}
                      </div>
                      {cmd.subtitle && (
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                          {cmd.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="hidden md:inline-block text-[10px] uppercase font-mono tracking-wider text-stone-400">
                      {cmd.category}
                    </span>
                    {isSelected && (
                      <CornerDownLeft className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-stone-100/70 dark:bg-stone-950/60 border-t border-stone-200 dark:border-stone-800 text-[11px] text-stone-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 text-[10px] font-mono">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 text-[10px] font-mono">↓</kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 text-[10px] font-mono">↵</kbd>
              <span>to open</span>
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-mono text-stone-400">
            <span>Global Palette</span>
            <span>•</span>
            <span>28+ Tools</span>
          </div>
        </div>
      </div>
    </div>
  );
};
