import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Download, 
  Upload, 
  Database, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Archive, 
  RefreshCw, 
  Trash2, 
  FileCode, 
  Table, 
  RotateCcw, 
  Copy, 
  Check, 
  Sparkles, 
  FolderArchive,
  Layers,
  HardDrive,
  Cloud,
  FileCheck,
  History
} from 'lucide-react';
import { 
  Subject, 
  UserProfile, 
  StudySession, 
  StudyPlan, 
  TestResult, 
  ActivityLog, 
  RevisionItem, 
  FlashcardDeck, 
  UserNote, 
  StudyGroup 
} from '../types';
import { 
  loadAllDataFromLocal, 
  cacheAllDataLocally, 
  importUserData, 
  BatchUploadProgress 
} from '../lib/db';
import { loadMistakes, saveMistakes } from '../lib/mistakeVaultStorage';

export interface BackupSnapshot {
  id: string;
  timestamp: string;
  label: string;
  metrics: {
    subjectsCount: number;
    topicsCount: number;
    sessionsCount: number;
    flashcardsCount: number;
    mistakesCount: number;
    plansCount: number;
  };
  payload: any;
}

const SNAPSHOTS_KEY = 'study_backup_snapshots_v2';

interface DataPortabilityViewProps {
  user?: any;
  userProfile?: UserProfile | null;
  subjects: Subject[];
  sessions?: StudySession[];
  plans?: StudyPlan[];
  testResults?: TestResult[];
  activityLogs?: ActivityLog[];
  revisions?: RevisionItem[];
  flashcardDecks?: FlashcardDeck[];
  notes?: UserNote[];
  groups?: StudyGroup[];
  onUpdateSubjects?: (subjects: Subject[]) => void;
  onUpdateProfile?: (updates: Partial<UserProfile>) => void;
  onClose?: () => void;
}

export const DataPortabilityView: React.FC<DataPortabilityViewProps> = ({
  user,
  userProfile,
  subjects,
  sessions = [],
  plans = [],
  testResults = [],
  activityLogs = [],
  revisions = [],
  flashcardDecks = [],
  notes = [],
  groups = [],
  onUpdateSubjects,
  onUpdateProfile,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'snapshots' | 'import' | 'reset'>('export');
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Snapshot management
  const [snapshots, setSnapshots] = useState<BackupSnapshot[]>([]);
  const [newSnapshotLabel, setNewSnapshotLabel] = useState<string>('');
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState<boolean>(false);

  // Import management
  const [importSource, setImportSource] = useState<'file' | 'text'>('file');
  const [importJsonText, setImportJsonText] = useState<string>('');
  const [importConflictMode, setImportConflictMode] = useState<'merge' | 'overwrite'>('merge');
  const [parsedImportData, setParsedImportData] = useState<any | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [restoreProgress, setRestoreProgress] = useState<BatchUploadProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset confirmation
  const [resetConfirmText, setResetConfirmText] = useState<string>('');
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // Load existing snapshots on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SNAPSHOTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSnapshots(parsed);
        }
      }
    } catch (e) {
      console.error('Error loading backup snapshots:', e);
    }
  }, []);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Compile full master state JSON
  const getFullMasterData = () => {
    const mistakes = loadMistakes();
    const local = loadAllDataFromLocal();

    return {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      user: {
        uid: user?.uid || 'guest_user',
        email: user?.email || userProfile?.email || 'local@device',
        displayName: userProfile?.displayName || userProfile?.name || 'Student',
        academicYear: userProfile?.academicYear || '2026-2027',
        targetGpa: userProfile?.targetGpaOrScore || '',
        xp: userProfile?.xp || 0,
        level: userProfile?.level || 1,
        studyStreak: userProfile?.studyStreak || 0
      },
      subjects: subjects || local.subjects || [],
      sessions: sessions || local.sessions || [],
      plans: plans || local.plans || [],
      testResults: testResults || local.testResults || [],
      activityLogs: activityLogs || local.activityLogs || [],
      revisions: revisions || local.revisions || [],
      flashcardDecks: flashcardDecks || local.flashcardDecks || [],
      notes: notes || (local as any).notes || [],
      groups: groups || (local as any).groups || [],
      mistakes: mistakes || [],
      summaryMetrics: {
        totalSubjects: subjects.length,
        totalTopics: subjects.reduce((acc, s) => acc + s.chapters.reduce((cAcc, c) => cAcc + c.topics.length, 0), 0),
        totalSessions: sessions.length,
        totalFlashcards: flashcardDecks.reduce((acc, d) => acc + d.cards.length, 0),
        totalMistakes: mistakes.length
      }
    };
  };

  // 1. Export as Master JSON
  const handleExportJson = () => {
    try {
      const data = getFullMasterData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `studyflow_master_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Master JSON backup downloaded successfully!');
    } catch (err: any) {
      showToast(`Export failed: ${err.message}`, 'error');
    }
  };

  // 2. Export as Markdown Study Binder
  const handleExportMarkdown = () => {
    try {
      const mistakes = loadMistakes();
      const dateStr = new Date().toLocaleDateString(undefined, { dateStyle: 'full' });

      let md = `# Comprehensive Study Binder & Academic Notes\n`;
      md += `*Exported on ${dateStr} • Student: ${userProfile?.displayName || 'Scholar'}*\n\n`;
      md += `---\n\n`;

      md += `## 📚 Academic Syllabus & Topic Coverage\n\n`;
      subjects.forEach((sub, sIdx) => {
        md += `### ${sIdx + 1}. ${sub.name} (Exam: ${sub.targetExam || 'General'} - Goal: ${sub.targetGrade || 'A*'})\n\n`;
        sub.chapters.forEach((ch, cIdx) => {
          md += `#### Chapter ${sIdx + 1}.${cIdx + 1}: ${ch.name}\n`;
          ch.topics.forEach((t) => {
            const statusIcon = t.status === 'Mastered' ? '✅' : t.status === 'Needs Revision' ? '⚠️' : '📖';
            md += `- ${statusIcon} **${t.name}** [${t.status || 'Planned'}] - Est: ${t.estimatedMinutes || 45} mins\n`;
            if (t.keyFormulas && t.keyFormulas.length > 0) {
              md += `  - *Formulas / Keywords:* ${t.keyFormulas.join(', ')}\n`;
            }
          });
          md += `\n`;
        });
      });

      md += `\n---\n\n## 🗂️ Active Flashcard Decks Summary\n\n`;
      flashcardDecks.forEach((deck) => {
        md += `### Deck: ${deck.title} (${deck.subjectName})\n`;
        md += `*Total cards: ${deck.cards.length}*\n\n`;
        deck.cards.forEach((card, cIdx) => {
          md += `**Q${cIdx + 1}:** ${card.front}\n`;
          md += `**A:** ${card.back}\n\n`;
        });
      });

      if (mistakes.length > 0) {
        md += `\n---\n\n## 🛑 Mistake Vault & Cognitive Audits\n\n`;
        mistakes.forEach((m, mIdx) => {
          md += `### Mistake #${mIdx + 1}: ${m.subjectName} - ${m.topicName || 'General'}\n`;
          md += `- **Question / Context:** ${m.question}\n`;
          if (m.userAttempt) md += `- **Student Attempt:** ${m.userAttempt}\n`;
          md += `- **Correct Solution:** ${m.correctAnswer}\n`;
          md += `- **Error Category:** ${m.errorCategory}\n`;
          if (m.notes) md += `- **Insight / Takeaway:** ${m.notes}\n\n`;
        });
      }

      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `studyflow_binder_${new Date().toISOString().split('T')[0]}.md`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Markdown Study Binder downloaded successfully!');
    } catch (err: any) {
      showToast(`Markdown export failed: ${err.message}`, 'error');
    }
  };

  // 3. Export Study History as CSV
  const handleExportCsv = () => {
    try {
      const rows: string[][] = [
        ['Session ID', 'Date', 'Subject', 'Chapter', 'Topic', 'Duration (Mins)', 'Performance Score', 'Notes']
      ];

      sessions.forEach(s => {
        rows.push([
          `"${s.id}"`,
          `"${s.date}"`,
          `"${s.subjectName || ''}"`,
          `"${s.chapterName || ''}"`,
          `"${s.topicName || ''}"`,
          `"${s.durationMinutes || Math.round((s.durationSeconds || 0) / 60)}"`,
          `"${s.score !== undefined ? s.score : ''}"`,
          `"${(s.notes || '').replace(/"/g, '""')}"`
        ]);
      });

      const csvContent = rows.map(r => r.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `studyflow_sessions_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Study sessions CSV downloaded successfully!');
    } catch (err: any) {
      showToast(`CSV export failed: ${err.message}`, 'error');
    }
  };

  // 4. Export Flashcards as Anki TSV
  const handleExportAnkiTsv = () => {
    try {
      const rows: string[] = [];
      flashcardDecks.forEach(deck => {
        deck.cards.forEach(c => {
          const front = (c.front || '').replace(/\t/g, ' ').replace(/\n/g, '<br>');
          const back = (c.back || '').replace(/\t/g, ' ').replace(/\n/g, '<br>');
          const tags = (c.tags || [deck.subjectName, deck.title]).join(' ').replace(/[^a-zA-Z0-9_]/g, '_');
          rows.push(`${front}\t${back}\t${tags}`);
        });
      });

      if (rows.length === 0) {
        showToast('No flashcards found to export.', 'error');
        return;
      }

      const tsvContent = rows.join('\n');
      const blob = new Blob([tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `studyflow_anki_flashcards_${new Date().toISOString().split('T')[0]}.tsv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Anki TSV flashcards exported successfully!');
    } catch (err: any) {
      showToast(`Flashcard TSV export failed: ${err.message}`, 'error');
    }
  };

  // --- SNAPSHOTS TIME MACHINE ---
  const handleCreateSnapshot = () => {
    setIsCreatingSnapshot(true);
    try {
      const data = getFullMasterData();
      const mistakes = loadMistakes();

      const newSnapshot: BackupSnapshot = {
        id: `snapshot-${Date.now()}`,
        timestamp: new Date().toISOString(),
        label: newSnapshotLabel.trim() || `Snapshot #${snapshots.length + 1} (${new Date().toLocaleDateString()})`,
        metrics: {
          subjectsCount: subjects.length,
          topicsCount: subjects.reduce((acc, s) => acc + s.chapters.reduce((cAcc, c) => cAcc + c.topics.length, 0), 0),
          sessionsCount: sessions.length,
          flashcardsCount: flashcardDecks.reduce((acc, d) => acc + d.cards.length, 0),
          mistakesCount: mistakes.length,
          plansCount: plans.length
        },
        payload: data
      };

      const updated = [newSnapshot, ...snapshots.slice(0, 9)]; // Keep latest 10
      setSnapshots(updated);
      localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(updated));
      setNewSnapshotLabel('');
      showToast('Instant snapshot created and secured on local device!');
    } catch (err: any) {
      showToast(`Snapshot creation failed: ${err.message}`, 'error');
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  const handleRestoreSnapshot = async (snapshot: BackupSnapshot) => {
    if (!window.confirm(`Are you sure you want to restore snapshot "${snapshot.label}" created on ${new Date(snapshot.timestamp).toLocaleString()}? Current data will be restored to this checkpoint.`)) {
      return;
    }

    try {
      setIsRestoring(true);
      await importUserData(user?.uid || null, snapshot.payload, (prog) => setRestoreProgress(prog));
      if (snapshot.payload.mistakes) {
        saveMistakes(snapshot.payload.mistakes);
      }
      showToast(`Snapshot "${snapshot.label}" restored! Reloading page to apply...`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      showToast(`Failed to restore snapshot: ${err.message}`, 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDeleteSnapshot = (id: string) => {
    const updated = snapshots.filter(s => s.id !== id);
    setSnapshots(updated);
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(updated));
    showToast('Snapshot removed.');
  };

  const handleDownloadSnapshotJson = (snapshot: BackupSnapshot) => {
    const blob = new Blob([JSON.stringify(snapshot.payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snapshot_${snapshot.label.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- IMPORT & RESTORE ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        validateAndSetImport(parsed);
      } catch (err: any) {
        setImportError('Invalid JSON format: ' + err.message);
        setParsedImportData(null);
      }
    };
    reader.readAsText(file);
  };

  const handleTextParse = () => {
    if (!importJsonText.trim()) return;
    try {
      const parsed = JSON.parse(importJsonText);
      validateAndSetImport(parsed);
    } catch (err: any) {
      setImportError('Invalid JSON format: ' + err.message);
      setParsedImportData(null);
    }
  };

  const validateAndSetImport = (data: any) => {
    setImportError(null);
    if (!data || typeof data !== 'object') {
      setImportError('The provided file does not contain a valid StudyFlow data object.');
      setParsedImportData(null);
      return;
    }

    // Basic structure checking
    const hasSubjects = Array.isArray(data.subjects);
    const hasDecks = Array.isArray(data.flashcardDecks);
    const hasSessions = Array.isArray(data.sessions);
    const hasPlans = Array.isArray(data.plans);

    if (!hasSubjects && !hasDecks && !hasSessions && !hasPlans) {
      setImportError('No recognized study collections (subjects, flashcards, sessions, plans) found in this JSON.');
      setParsedImportData(null);
      return;
    }

    setParsedImportData(data);
  };

  const handleExecuteRestore = async () => {
    if (!parsedImportData) return;

    try {
      setIsRestoring(true);
      setImportError(null);

      let dataToRestore = parsedImportData;

      if (importConflictMode === 'merge') {
        const local = loadAllDataFromLocal();
        const currentMistakes = loadMistakes();

        // Merge subjects
        const mergedSubjects = [...(local.subjects || subjects)];
        if (Array.isArray(parsedImportData.subjects)) {
          parsedImportData.subjects.forEach((sub: Subject) => {
            const idx = mergedSubjects.findIndex(s => s.name.toLowerCase() === sub.name.toLowerCase());
            if (idx >= 0) {
              // Merge chapters
              const existingSub = mergedSubjects[idx];
              const mergedChapters = [...existingSub.chapters];
              sub.chapters.forEach(ch => {
                const cIdx = mergedChapters.findIndex(c => c.name.toLowerCase() === ch.name.toLowerCase());
                if (cIdx >= 0) {
                  // Merge topics
                  const existingCh = mergedChapters[cIdx];
                  const mergedTopics = [...existingCh.topics];
                  ch.topics.forEach(t => {
                    if (!mergedTopics.some(ex => ex.name.toLowerCase() === t.name.toLowerCase())) {
                      mergedTopics.push(t);
                    }
                  });
                  mergedChapters[cIdx] = { ...existingCh, topics: mergedTopics };
                } else {
                  mergedChapters.push(ch);
                }
              });
              mergedSubjects[idx] = { ...existingSub, chapters: mergedChapters };
            } else {
              mergedSubjects.push(sub);
            }
          });
        }

        // Merge flashcard decks
        const mergedDecks = [...(local.flashcardDecks || flashcardDecks)];
        if (Array.isArray(parsedImportData.flashcardDecks)) {
          parsedImportData.flashcardDecks.forEach((deck: FlashcardDeck) => {
            const idx = mergedDecks.findIndex(d => d.id === deck.id || d.title.toLowerCase() === deck.title.toLowerCase());
            if (idx >= 0) {
              const existingDeck = mergedDecks[idx];
              const mergedCards = [...existingDeck.cards];
              deck.cards.forEach(c => {
                if (!mergedCards.some(ec => ec.front.toLowerCase() === c.front.toLowerCase())) {
                  mergedCards.push(c);
                }
              });
              mergedDecks[idx] = { ...existingDeck, cards: mergedCards };
            } else {
              mergedDecks.push(deck);
            }
          });
        }

        // Merge sessions
        const existingSessionIds = new Set((local.sessions || sessions).map(s => s.id));
        const mergedSessions = [...(local.sessions || sessions)];
        if (Array.isArray(parsedImportData.sessions)) {
          parsedImportData.sessions.forEach((s: StudySession) => {
            if (!existingSessionIds.has(s.id)) {
              mergedSessions.push(s);
            }
          });
        }

        // Merge mistakes
        let mergedMistakes = [...currentMistakes];
        if (Array.isArray(parsedImportData.mistakes)) {
          const existingMistakeKeys = new Set(currentMistakes.map(m => `${m.question}_${m.correctAnswer}`));
          parsedImportData.mistakes.forEach((m: any) => {
            if (!existingMistakeKeys.has(`${m.question}_${m.correctAnswer}`)) {
              mergedMistakes.push(m);
            }
          });
        }

        dataToRestore = {
          ...parsedImportData,
          subjects: mergedSubjects,
          flashcardDecks: mergedDecks,
          sessions: mergedSessions,
          mistakes: mergedMistakes
        };
      }

      // Execute import
      await importUserData(user?.uid || null, dataToRestore, (prog) => setRestoreProgress(prog));

      if (dataToRestore.mistakes && Array.isArray(dataToRestore.mistakes)) {
        saveMistakes(dataToRestore.mistakes);
      }

      showToast('Data imported and synced successfully! Reloading...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      setImportError('Import failed: ' + err.message);
    } finally {
      setIsRestoring(false);
    }
  };

  // --- FACTORY RESET ---
  const handleFactoryReset = () => {
    if (resetConfirmText.trim().toUpperCase() !== 'RESET') {
      showToast('Please type RESET in capital letters to confirm.', 'error');
      return;
    }

    try {
      setIsResetting(true);
      // Clear main study local storage keys
      localStorage.removeItem('studyflow_cached_data');
      localStorage.removeItem('study_mistake_vault_v1');
      localStorage.removeItem('study_active_quests_v1');
      localStorage.removeItem('studyflow_active_theme');
      
      showToast('All local application cache cleared. Restoring fresh defaults...');
      setTimeout(() => window.location.reload(), 1200);
    } catch (err: any) {
      showToast('Reset failed: ' + err.message, 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const totalTopicsCount = useMemo(() => {
    return subjects.reduce((acc, s) => acc + s.chapters.reduce((cAcc, c) => cAcc + c.topics.length, 0), 0);
  }, [subjects]);

  const totalFlashcardsCount = useMemo(() => {
    return flashcardDecks.reduce((acc, d) => acc + d.cards.length, 0);
  }, [flashcardDecks]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-12">
      {/* Toast Banner */}
      {notification && (
        <div className={`p-4 rounded-2xl text-xs flex items-center justify-between border shadow-sm ${
          notification.type === 'error'
            ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'
            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
        }`}>
          <div className="flex items-center gap-2 font-medium">
            {notification.type === 'error' ? <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
            <span>{notification.text}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-xs font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-surface border border-theme rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <FolderArchive className="w-5 h-5" />
            </span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted font-bold">Data Liberation & Resiliency</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight font-serif italic">
            Data Portability & Backup Suite
          </h2>
          <p className="text-xs text-muted max-w-2xl leading-relaxed">
            You own 100% of your study knowledge. Export your syllabus, sessions, notes, and flashcards in universal open formats (JSON, Markdown, CSV, Anki), create local restore snapshots, or import previous backups.
          </p>
        </div>

        {/* Live Storage Metrics Card */}
        <div className="bg-card border border-theme p-4 rounded-2xl shrink-0 space-y-2 min-w-[240px]">
          <div className="text-[11px] font-mono text-muted uppercase font-bold flex items-center justify-between">
            <span>Knowledge Assets</span>
            <span className="text-emerald-600 font-bold">Online & Cached</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-surface rounded-xl border border-theme">
              <div className="text-[10px] text-muted">Subjects / Topics</div>
              <div className="font-mono font-bold text-primary">{subjects.length} / {totalTopicsCount}</div>
            </div>
            <div className="p-2 bg-surface rounded-xl border border-theme">
              <div className="text-[10px] text-muted">Flashcards</div>
              <div className="font-mono font-bold text-primary">{totalFlashcardsCount}</div>
            </div>
            <div className="p-2 bg-surface rounded-xl border border-theme">
              <div className="text-[10px] text-muted">Study Sessions</div>
              <div className="font-mono font-bold text-primary">{sessions.length}</div>
            </div>
            <div className="p-2 bg-surface rounded-xl border border-theme">
              <div className="text-[10px] text-muted">Snapshots</div>
              <div className="font-mono font-bold text-primary">{snapshots.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-surface border border-theme rounded-2xl overflow-x-auto">
        <button
          onClick={() => setActiveTab('export')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'export'
              ? 'bg-primary text-white shadow-xs'
              : 'text-muted hover:text-primary hover:bg-theme-accent'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Formats (JSON / MD / CSV)</span>
        </button>

        <button
          onClick={() => setActiveTab('snapshots')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'snapshots'
              ? 'bg-primary text-white shadow-xs'
              : 'text-muted hover:text-primary hover:bg-theme-accent'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Snapshot Time-Machine ({snapshots.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('import')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'import'
              ? 'bg-primary text-white shadow-xs'
              : 'text-muted hover:text-primary hover:bg-theme-accent'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Import & Restore</span>
        </button>

        <button
          onClick={() => setActiveTab('reset')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ml-auto ${
            activeTab === 'reset'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-rose-600 hover:bg-rose-500/10'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Safety Reset</span>
        </button>
      </div>

      {/* TAB 1: EXPORT FORMATS */}
      {activeTab === 'export' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Full Master JSON */}
          <div className="bg-surface border border-theme rounded-3xl p-6 shadow-xs space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="p-2.5 rounded-2xl bg-primary/10 text-primary">
                  <Database className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-theme-accent text-primary font-bold border border-theme">
                  Universal JSON
                </span>
              </div>
              <h3 className="text-base font-bold text-primary">Full Master JSON Archive</h3>
              <p className="text-xs text-muted leading-relaxed">
                Complete structured dump of your entire application database: all subjects, chapters, topics, study sessions, flashcards, test results, revision schedules, and mistake vaults.
              </p>
            </div>
            <div className="pt-3 border-t border-theme">
              <button
                onClick={handleExportJson}
                className="w-full py-2.5 rounded-2xl bg-primary hover:opacity-90 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Export Master Archive (.json)</span>
              </button>
            </div>
          </div>

          {/* Card 2: Markdown Study Binder */}
          <div className="bg-surface border border-theme rounded-3xl p-6 shadow-xs space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600">
                  <FileText className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 font-bold border border-amber-500/20">
                  Obsidian & Notion
                </span>
              </div>
              <h3 className="text-base font-bold text-primary">Markdown Study Binder</h3>
              <p className="text-xs text-muted leading-relaxed">
                Human-readable, beautifully structured Markdown file containing your entire syllabus hierarchy, formulas, topic notes, flashcard Q&As, and cognitive mistake insights.
              </p>
            </div>
            <div className="pt-3 border-t border-theme">
              <button
                onClick={handleExportMarkdown}
                className="w-full py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
              >
                <FileCode className="w-4 h-4" />
                <span>Export Study Binder (.md)</span>
              </button>
            </div>
          </div>

          {/* Card 3: CSV Activity & Session Timesheet */}
          <div className="bg-surface border border-theme rounded-3xl p-6 shadow-xs space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <Table className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 font-bold border border-emerald-500/20">
                  Excel & Sheets
                </span>
              </div>
              <h3 className="text-base font-bold text-primary">Study Sessions & Hours Audit</h3>
              <p className="text-xs text-muted leading-relaxed">
                Tabular CSV log of all recorded focus timers, pomodoros, and study sessions with exact minutes, subjects, and dates. Perfect for academic time audits or tutor reporting.
              </p>
            </div>
            <div className="pt-3 border-t border-theme">
              <button
                onClick={handleExportCsv}
                className="w-full py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
              >
                <Table className="w-4 h-4" />
                <span>Export Sessions Log (.csv)</span>
              </button>
            </div>
          </div>

          {/* Card 4: Anki / Quizlet TSV */}
          <div className="bg-surface border border-theme rounded-3xl p-6 shadow-xs space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600">
                  <Layers className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-700 font-bold border border-purple-500/20">
                  Anki Compatible
                </span>
              </div>
              <h3 className="text-base font-bold text-primary">Flashcards TSV (Anki / Quizlet)</h3>
              <p className="text-xs text-muted leading-relaxed">
                Tab-separated values file compatible with Anki import. Includes front prompts, back solutions, and subject tags for all active flashcard decks.
              </p>
            </div>
            <div className="pt-3 border-t border-theme">
              <button
                onClick={handleExportAnkiTsv}
                className="w-full py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
              >
                <Layers className="w-4 h-4" />
                <span>Export Anki Cards (.tsv)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SNAPSHOTS TIME MACHINE */}
      {activeTab === 'snapshots' && (
        <div className="space-y-6">
          {/* Create New Snapshot Card */}
          <div className="bg-surface border border-theme rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-wider font-mono">
                  <History className="w-4 h-4 text-primary" />
                  <span>Create Checkpoint Snapshot</span>
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Save an immutable local checkpoint before major syllabus modifications, mock exams, or device migrations.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <input
                type="text"
                value={newSnapshotLabel}
                onChange={(e) => setNewSnapshotLabel(e.target.value)}
                placeholder="Optional label (e.g. Before Midterm Finals, Chapter 4 Complete)..."
                className="flex-1 w-full p-3 bg-card border border-theme rounded-2xl text-xs text-primary focus:outline-none focus:border-primary"
              />
              <button
                onClick={handleCreateSnapshot}
                disabled={isCreatingSnapshot}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-primary hover:opacity-90 text-white font-bold text-xs transition flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-xs"
              >
                <Sparkles className="w-4 h-4" />
                <span>Capture Snapshot Now</span>
              </button>
            </div>
          </div>

          {/* Snapshots List */}
          <div className="bg-surface border border-theme rounded-3xl p-6 shadow-xs space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted">
              Saved Snapshots ({snapshots.length})
            </h3>

            {snapshots.length === 0 ? (
              <div className="text-center py-10 text-xs text-muted italic">
                No local snapshots created yet. Capture a checkpoint above to preserve your exact state.
              </div>
            ) : (
              <div className="space-y-3">
                {snapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="p-4 bg-card border border-theme rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-primary/40 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-primary">{snap.label}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-theme-accent text-primary">
                          {new Date(snap.timestamp).toLocaleDateString()} at {new Date(snap.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted font-mono">
                        <span>{snap.metrics.subjectsCount} Subjects</span>
                        <span>•</span>
                        <span>{snap.metrics.topicsCount} Topics</span>
                        <span>•</span>
                        <span>{snap.metrics.sessionsCount} Sessions</span>
                        <span>•</span>
                        <span>{snap.metrics.flashcardsCount} Cards</span>
                        <span>•</span>
                        <span>{snap.metrics.mistakesCount} Mistakes</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                      <button
                        onClick={() => handleDownloadSnapshotJson(snap)}
                        className="px-3 py-1.5 rounded-xl bg-theme-accent hover:opacity-80 text-primary text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-theme"
                        title="Download as JSON"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>JSON</span>
                      </button>

                      <button
                        onClick={() => handleRestoreSnapshot(snap)}
                        disabled={isRestoring}
                        className="px-3.5 py-1.5 rounded-xl bg-primary hover:opacity-90 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        title="Restore this state"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </button>

                      <button
                        onClick={() => handleDeleteSnapshot(snap.id)}
                        className="p-1.5 rounded-xl text-muted hover:text-rose-600 hover:bg-rose-500/10 transition cursor-pointer"
                        title="Delete snapshot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: IMPORT & RESTORE */}
      {activeTab === 'import' && (
        <div className="bg-surface border border-theme rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-wider font-mono">
              <Upload className="w-4 h-4 text-primary" />
              <span>Restore Study Memory from File or JSON</span>
            </h3>
            <p className="text-xs text-muted">
              Select a JSON backup file exported previously to reconstitute your syllabus, flashcard decks, study timers, and error logs.
            </p>
          </div>

          {/* Import Source Selector */}
          <div className="flex items-center gap-2 border-b border-theme pb-4">
            <button
              onClick={() => setImportSource('file')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                importSource === 'file' ? 'bg-primary text-white' : 'bg-card text-muted hover:text-primary'
              }`}
            >
              Upload .json File
            </button>
            <button
              onClick={() => setImportSource('text')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                importSource === 'text' ? 'bg-primary text-white' : 'bg-card text-muted hover:text-primary'
              }`}
            >
              Paste Raw JSON
            </button>
          </div>

          {importSource === 'file' ? (
            <div className="space-y-4">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="p-8 border-2 border-dashed border-theme rounded-3xl text-center hover:border-primary/50 transition cursor-pointer bg-card/50 space-y-3"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-xs font-bold text-primary">
                  Click to select backup file (.json)
                </div>
                <div className="text-[11px] text-muted">
                  Supports full StudyFlow master archives and partial collections.
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                placeholder="Paste backup JSON string here..."
                rows={7}
                className="w-full p-4 bg-card border border-theme rounded-2xl text-xs font-mono text-primary focus:outline-none focus:border-primary"
              />
              <button
                onClick={handleTextParse}
                className="px-4 py-2 bg-theme-accent hover:opacity-85 text-primary text-xs font-bold rounded-xl border border-theme cursor-pointer"
              >
                Inspect & Validate JSON
              </button>
            </div>
          )}

          {/* Import Inspection Box */}
          {parsedImportData && (
            <div className="bg-card border border-emerald-500/30 rounded-2xl p-5 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    Valid Backup Verified
                  </span>
                </div>
                {parsedImportData.exportedAt && (
                  <span className="text-[10px] font-mono text-muted">
                    Created: {new Date(parsedImportData.exportedAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-3 bg-surface rounded-xl border border-theme">
                  <div className="text-[10px] text-muted">Subjects Found</div>
                  <div className="font-mono font-bold text-primary">
                    {Array.isArray(parsedImportData.subjects) ? parsedImportData.subjects.length : 0}
                  </div>
                </div>
                <div className="p-3 bg-surface rounded-xl border border-theme">
                  <div className="text-[10px] text-muted">Flashcard Decks</div>
                  <div className="font-mono font-bold text-primary">
                    {Array.isArray(parsedImportData.flashcardDecks) ? parsedImportData.flashcardDecks.length : 0}
                  </div>
                </div>
                <div className="p-3 bg-surface rounded-xl border border-theme">
                  <div className="text-[10px] text-muted">Study Sessions</div>
                  <div className="font-mono font-bold text-primary">
                    {Array.isArray(parsedImportData.sessions) ? parsedImportData.sessions.length : 0}
                  </div>
                </div>
                <div className="p-3 bg-surface rounded-xl border border-theme">
                  <div className="text-[10px] text-muted">Mistakes / Gaps</div>
                  <div className="font-mono font-bold text-primary">
                    {Array.isArray(parsedImportData.mistakes) ? parsedImportData.mistakes.length : 0}
                  </div>
                </div>
              </div>

              {/* Conflict Mode Selection */}
              <div className="space-y-2 pt-2 border-t border-theme">
                <div className="text-[11px] font-bold text-muted uppercase font-mono">
                  Restore Strategy
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-start gap-3 ${
                    importConflictMode === 'merge' ? 'bg-primary/5 border-primary text-primary' : 'bg-surface border-theme text-muted'
                  }`}>
                    <input
                      type="radio"
                      name="conflictMode"
                      checked={importConflictMode === 'merge'}
                      onChange={() => setImportConflictMode('merge')}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold">Merge & Deduplicate (Recommended)</div>
                      <div className="text-[11px] opacity-80 leading-relaxed">
                        Retains current progress and adds any new subjects, chapters, flashcards, or logs without overwriting your current work.
                      </div>
                    </div>
                  </label>

                  <label className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-start gap-3 ${
                    importConflictMode === 'overwrite' ? 'bg-rose-500/5 border-rose-500 text-rose-800 dark:text-rose-300' : 'bg-surface border-theme text-muted'
                  }`}>
                    <input
                      type="radio"
                      name="conflictMode"
                      checked={importConflictMode === 'overwrite'}
                      onChange={() => setImportConflictMode('overwrite')}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold">Clean Overwrite</div>
                      <div className="text-[11px] opacity-80 leading-relaxed">
                        Replaces local state entirely with the exact snapshot contents of the imported file.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setParsedImportData(null)}
                  className="px-4 py-2 text-xs font-semibold text-muted hover:text-primary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteRestore}
                  disabled={isRestoring}
                  className="px-6 py-2.5 rounded-2xl bg-primary hover:opacity-90 text-white font-bold text-xs transition flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  {isRestoring ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Restoring Database...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Confirm & Apply Restore</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {importError && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{importError}</span>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SAFETY RESET */}
      {activeTab === 'reset' && (
        <div className="bg-surface border border-rose-500/30 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-bold uppercase tracking-wider font-mono">
                Factory Cache Reset
              </h3>
            </div>
            <p className="text-xs text-muted">
              Clear your browser's local cache and restore original starting sample data. This is useful if you wish to start an entirely new academic term or wipe testing data.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-xs space-y-2 text-rose-900 dark:text-rose-300">
            <div className="font-bold">⚠️ Irreversible Action Warning</div>
            <p className="leading-relaxed">
              Ensure you have downloaded a **Master JSON Archive** or created a **Local Checkpoint Snapshot** first. Once cleared, local cache cannot be recovered without a backup file.
            </p>
          </div>

          <div className="space-y-2 max-w-md">
            <label className="text-[11px] font-mono font-bold text-muted uppercase">
              Type "RESET" to confirm:
            </label>
            <input
              type="text"
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder="RESET"
              className="w-full p-3 bg-card border border-rose-500/30 rounded-2xl text-xs font-mono text-primary focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="pt-2">
            <button
              onClick={handleFactoryReset}
              disabled={resetConfirmText.trim().toUpperCase() !== 'RESET' || isResetting}
              className={`px-6 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs ${
                resetConfirmText.trim().toUpperCase() === 'RESET' && !isResetting
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-muted/20 text-muted cursor-not-allowed'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Wipe Local Cache & Reset</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
