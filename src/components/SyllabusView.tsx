import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Upload, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  Circle, 
  Sparkles, 
  FileText, 
  X, 
  ChevronDown, 
  ChevronRight, 
  AlertCircle,
  Save,
  Smile,
  FolderOpen,
  RefreshCw,
  CheckCircle,
  FileCheck,
  Award,
  Hash,
  Smartphone,
  Wifi,
  Brain,
  ExternalLink,
  GraduationCap,
  Camera
} from 'lucide-react';
import { Subject, Chapter, Topic, TopicStatus, Subtopic, TestResult, StorageVault, EXAM_BOARD_PRESETS, ExamBoard } from '../types';
import { apiParseSyllabus } from '../lib/aiApi';
import { listDriveFiles, downloadDriveFileContent, downloadDriveFileBinary, DriveFileItem } from '../lib/googleDriveService';
import { getOrRequestWorkspaceToken } from '../lib/googleAuthService';
import { fileOrBlobToBase64 } from '../lib/base64Utils';
import { LogTopicTestModal } from './LogTopicTestModal';
import { TopicTargetedTestModal } from './TopicTargetedTestModal';
import { ExamPresetsModal } from './ExamPresetsModal';
import { SyncInspectorDetails } from './SyncInspectorModal';

const PRESET_EMOJIS = [
  '🧬', '🧪', '⚛️', '📖', '📝', '🇵🇰', '☪️', '📐', 
  '💻', '🎨', '📚', '📊', '🧠', '🩺', '⚡', '🌌', 
  '📜', '⚖️', '💡', '🏆', '🎯', '⚙️', '🔬', '🌐'
];

interface SyllabusViewProps {
  subjects: Subject[];
  onUpdateSubjects: (newSubjects: Subject[]) => void;
  onOpenMaterialImport?: () => void;
  onOpenDeviceSync?: () => void;
  onOpenQRScanner?: () => void;
  lastSyncDetails?: SyncInspectorDetails | null;
  onOpenSyncInspector?: () => void;
  testResults?: TestResult[];
  vaults?: StorageVault[];
  onAddTestResult?: (result: Omit<TestResult, 'id'>) => Promise<void> | void;
  setActiveTab?: (tab: string) => void;
  selectedSubjectId?: string;
}

export const SyllabusView: React.FC<SyllabusViewProps> = ({ 
  subjects, 
  onUpdateSubjects, 
  onOpenMaterialImport,
  onOpenDeviceSync,
  onOpenQRScanner,
  lastSyncDetails,
  onOpenSyncInspector,
  testResults = [],
  vaults = [],
  onAddTestResult,
  setActiveTab,
  selectedSubjectId
}) => {
  const [activeSubjectId, setActiveSubjectId] = useState<string>(selectedSubjectId || subjects[0]?.id || '');

  useEffect(() => {
    if (selectedSubjectId) {
      setActiveSubjectId(selectedSubjectId);
    }
  }, [selectedSubjectId]);
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});

  // Topic Test Modal
  const [isLogTestModalOpen, setIsLogTestModalOpen] = useState(false);
  const [selectedTopicForTest, setSelectedTopicForTest] = useState<{
    topicNumber?: string;
    topicId?: string;
    topicName?: string;
    chapterName?: string;
    subjectName?: string;
  } | undefined>(undefined);

  // Targeted MCQ Solver & AI Prompt Modal State
  const [isTargetedTestModalOpen, setIsTargetedTestModalOpen] = useState(false);
  const [targetedTestTopic, setTargetedTestTopic] = useState<{
    topicNumber?: string;
    topicId?: string;
    topicName?: string;
    chapterName?: string;
    subjectName?: string;
  } | undefined>(undefined);

  // Upload Syllabus Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'text' | 'gdrive'>('file');
  const [uploadText, setUploadText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');

  // Google Drive state in Syllabus View
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [selectedDriveFile, setSelectedDriveFile] = useState<DriveFileItem | null>(null);
  
  // Review Extracted Syllabus Modal State
  const [extractedData, setExtractedData] = useState<any | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isPresetsModalOpen, setIsPresetsModalOpen] = useState(false);

  // Apply Curated / AI Generated Exam Presets
  const handleApplyPreset = (presetSubjects: Subject[], mode: 'append' | 'replace') => {
    if (mode === 'replace') {
      onUpdateSubjects(presetSubjects);
      if (presetSubjects.length > 0) {
        setActiveSubjectId(presetSubjects[0].id);
      }
    } else {
      // Append mode - Ensure no ID collisions
      const existingIds = new Set(subjects.map(s => s.id));
      const adjusted = presetSubjects.map((s, idx) => {
        const uniqueId = existingIds.has(s.id) ? `sub_preset_${Date.now()}_${idx}` : s.id;
        return {
          ...s,
          id: uniqueId
        };
      });
      onUpdateSubjects([...subjects, ...adjusted]);
    }
  };

  // Manual Add Subject Modal
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectEmoji, setNewSubjectEmoji] = useState('📚');
  const [newSubjectLanguage, setNewSubjectLanguage] = useState<'en' | 'ur'>('en');
  const [newSubjectBoard, setNewSubjectBoard] = useState<ExamBoard>('general');

  // Edit Subject Emoji Modal State
  const [editingEmojiSubjectId, setEditingEmojiSubjectId] = useState<string | null>(null);

  // Add Chapter State
  const [isAddChapterOpen, setIsAddChapterOpen] = useState(false);
  const [newChapterName, setNewChapterName] = useState('');

  // Add Topic State
  const [addTopicChapterId, setAddTopicChapterId] = useState<string | null>(null);
  const [newTopicName, setNewTopicName] = useState('');

  // Edit Chapter Name State
  const [editingChapter, setEditingChapter] = useState<{ chapterId: string; name: string } | null>(null);

  // Edit Topic Name State
  const [editingTopic, setEditingTopic] = useState<{ chapterId: string; topicId: string; name: string } | null>(null);

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'topic' | 'chapter' | 'subject' | 'clear_chapters';
    title: string;
    message: string;
    subjectId: string;
    chapterId?: string;
    topicId?: string;
  } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const activeSubject = subjects.find(s => s.id === activeSubjectId) || subjects[0];
  const isUrduSubject = activeSubject ? (activeSubject.language === 'ur' || /[\u0600-\u06FF]/.test(activeSubject.name)) : false;

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters(prev => ({ ...prev, [chapterId]: !prev[chapterId] }));
  };

  // Status badge style helper
  const getStatusBadge = (status: TopicStatus) => {
    switch (status) {
      case 'Completed':
        return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'Mastered':
        return 'bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 border-teal-300 dark:border-teal-700 font-bold';
      case 'In Progress':
        return 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'Needs Revision':
        return 'bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'Weak':
        return 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      default:
        return 'bg-theme-accent text-muted border-theme';
    }
  };

  // Load Google Drive Files
  const handleLoadDriveFiles = async () => {
    setLoadingDrive(true);
    setDriveError(null);
    try {
      await getOrRequestWorkspaceToken();
      const files = await listDriveFiles({ pageSize: 40 });
      setDriveFiles(files);
    } catch (err: any) {
      setDriveError(err.message || 'Failed to connect to Google Drive.');
    } finally {
      setLoadingDrive(false);
    }
  };

  // Handle File Upload to AI Parser
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleParseSyllabus = async () => {
    setParseError('');
    if (uploadMode === 'file' && !selectedFile) {
      setParseError('Please select a syllabus document or image file.');
      return;
    }
    if (uploadMode === 'text' && !uploadText.trim()) {
      setParseError('Please paste your syllabus text.');
      return;
    }
    if (uploadMode === 'gdrive' && !selectedDriveFile) {
      setParseError('Please select a syllabus file from your Google Drive.');
      return;
    }

    setIsParsing(true);
    try {
      let fileDataBase64: string | undefined = undefined;
      let mimeType: string | undefined = undefined;
      let textToParse = uploadText;

      if (uploadMode === 'file' && selectedFile) {
        mimeType = selectedFile.type || 'application/pdf';
        fileDataBase64 = await fileOrBlobToBase64(selectedFile);
      } else if (uploadMode === 'gdrive' && selectedDriveFile) {
        const isDoc = selectedDriveFile.mimeType === 'application/vnd.google-apps.document' || 
                      selectedDriveFile.mimeType === 'text/plain' || 
                      selectedDriveFile.mimeType === 'application/vnd.google-apps.spreadsheet';
        
        if (isDoc) {
          textToParse = await downloadDriveFileContent(selectedDriveFile.id, selectedDriveFile.mimeType);
        } else {
          const binary = await downloadDriveFileBinary(selectedDriveFile.id);
          fileDataBase64 = binary.base64;
          mimeType = binary.mimeType;
        }
      }

      const res = await apiParseSyllabus({
        text: textToParse || undefined,
        fileData: fileDataBase64,
        mimeType: mimeType,
        currentSubjects: subjects.map(s => s.name)
      });

      if (res.success && res.data) {
        setExtractedData(res.data);
        setIsUploadOpen(false);
        setIsReviewOpen(true);
      } else {
        setParseError('Failed to parse syllabus file. Please try again.');
      }
    } catch (err: any) {
      console.error(err);
      setParseError(err.message || 'Error processing syllabus file');
    } finally {
      setIsParsing(false);
    }
  };

  // Save reviewed syllabus into subjects state & Firestore
  const handleSaveExtractedSyllabus = () => {
    if (!extractedData || !extractedData.subjects) return;

    let updatedSubjectsList = [...subjects];

    extractedData.subjects.forEach((parsedSub: any) => {
      let existingSubIndex = updatedSubjectsList.findIndex(
        s => s.name.toLowerCase() === (parsedSub.name || '').toLowerCase()
      );

      const newChapters: Chapter[] = (parsedSub.chapters || []).map((ch: any, cIdx: number) => ({
        id: `ch-ext-${Date.now()}-${cIdx}`,
        name: ch.name || `Chapter ${cIdx + 1}`,
        topics: (ch.topics || []).map((tp: any, tIdx: number) => ({
          id: `tp-ext-${Date.now()}-${tIdx}`,
          name: tp.name || `Topic ${tIdx + 1}`,
          status: 'Not Started' as TopicStatus,
          subtopics: (tp.subtopics || []).map((stItem: any, stIdx: number) => ({
            id: `st-ext-${Date.now()}-${stIdx}`,
            name: typeof stItem === 'string' ? stItem : (stItem?.name || `Subtopic ${stIdx + 1}`),
            completed: false
          }))
        }))
      }));

      const isUrdu = parsedSub.language === 'ur' || /[\u0600-\u06FF]/.test(parsedSub.name || '');

      if (existingSubIndex >= 0) {
        // Append chapters to existing subject
        if (isUrdu && !updatedSubjectsList[existingSubIndex].language) {
          updatedSubjectsList[existingSubIndex].language = 'ur';
        }
        updatedSubjectsList[existingSubIndex].chapters = [
          ...updatedSubjectsList[existingSubIndex].chapters,
          ...newChapters
        ];
      } else {
        // Create new subject
        updatedSubjectsList.push({
          id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: parsedSub.name || (isUrdu ? 'نیا مضمون' : 'New Subject'),
          language: isUrdu ? 'ur' : 'en',
          icon: isUrdu ? '🇵🇰' : '📚',
          color: isUrdu ? '#10B981' : '#3B82F6',
          chapters: newChapters
        });
      }
    });

    onUpdateSubjects(updatedSubjectsList);
    setIsReviewOpen(false);
    setExtractedData(null);
    setUploadText('');
    setSelectedFile(null);
  };

  // Update topic status
  const handleTopicStatusChange = (subjectId: string, chapterId: string, topicId: string, newStatus: TopicStatus) => {
    const updated = subjects.map(s => {
      if (s.id !== subjectId) return s;
      return {
        ...s,
        chapters: s.chapters.map(c => {
          if (c.id !== chapterId) return c;
          return {
            ...c,
            topics: c.topics.map(t => {
              if (t.id !== topicId) return t;
              return { 
                ...t, 
                status: newStatus, 
                lastStudiedAt: newStatus === 'Completed' || newStatus === 'Mastered' ? new Date().toISOString().split('T')[0] : t.lastStudiedAt 
              };
            })
          };
        })
      };
    });
    onUpdateSubjects(updated);
  };

  // Toggle Subtopic Completion
  const handleToggleSubtopic = (subjectId: string, chapterId: string, topicId: string, subtopicId: string) => {
    const updated = subjects.map(s => {
      if (s.id !== subjectId) return s;
      return {
        ...s,
        chapters: s.chapters.map(c => {
          if (c.id !== chapterId) return c;
          return {
            ...c,
            topics: c.topics.map(t => {
              if (t.id !== topicId) return t;
              const updatedSubtopics = t.subtopics.map(st => 
                st.id === subtopicId ? { ...st, completed: !st.completed } : st
              );
              const allDone = updatedSubtopics.every(st => st.completed);
              return {
                ...t,
                subtopics: updatedSubtopics,
                status: allDone ? 'Completed' : t.status === 'Not Started' ? 'In Progress' : t.status
              };
            })
          };
        })
      };
    });
    onUpdateSubjects(updated);
  };

  // Add Subject
  const handleAddSubject = () => {
    if (!newSubjectName.trim()) return;
    const isUrdu = newSubjectLanguage === 'ur' || /[\u0600-\u06FF]/.test(newSubjectName.trim());
    const newSubject: Subject = {
      id: `sub-${Date.now()}`,
      name: newSubjectName.trim(),
      icon: newSubjectEmoji || (isUrdu ? '🇵🇰' : '📚'),
      color: isUrdu ? '#10B981' : '#6366F1',
      language: isUrdu ? 'ur' : 'en',
      boardAffiliation: newSubjectBoard || (isUrdu ? 'fbise' : 'cie_olevel'),
      chapters: []
    };
    onUpdateSubjects([...subjects, newSubject]);
    setActiveSubjectId(newSubject.id);
    setNewSubjectName('');
    setNewSubjectEmoji('📚');
    setNewSubjectLanguage('en');
    setNewSubjectBoard('general');
    setIsAddSubjectOpen(false);
  };

  // Update Subject Board Affiliation
  const handleUpdateSubjectBoard = (subjectId: string, board: ExamBoard) => {
    const updated = subjects.map(s => {
      if (s.id !== subjectId) return s;
      return { ...s, boardAffiliation: board };
    });
    onUpdateSubjects(updated);
  };

  // Update Subject Emoji Icon
  const handleUpdateSubjectEmoji = (subjectId: string, emoji: string) => {
    const updated = subjects.map(s => {
      if (s.id !== subjectId) return s;
      return { ...s, icon: emoji };
    });
    onUpdateSubjects(updated);
    setEditingEmojiSubjectId(null);
  };

  // Delete Subject Trigger
  const handleDeleteSubject = (subjectId: string) => {
    const subj = subjects.find(s => s.id === subjectId);
    setDeleteError(null);
    setDeleteTarget({
      type: 'subject',
      title: 'Delete Subject',
      message: `Are you sure you want to delete the subject "${subj?.name || 'this subject'}" and all its chapters & topics?`,
      subjectId
    });
  };

  // Delete Topic Trigger
  const handleDeleteTopic = (subjectId: string, chapterId: string, topicId: string, topicName: string) => {
    setDeleteError(null);
    setDeleteTarget({
      type: 'topic',
      title: 'Delete Topic',
      message: `Are you sure you want to delete the topic "${topicName}"?`,
      subjectId,
      chapterId,
      topicId
    });
  };

  // Delete Chapter Trigger
  const handleDeleteChapter = (subjectId: string, chapterId: string, chapterName: string) => {
    setDeleteError(null);
    setDeleteTarget({
      type: 'chapter',
      title: 'Delete Chapter',
      message: `Are you sure you want to delete chapter "${chapterName}" and all its topics?`,
      subjectId,
      chapterId
    });
  };

  // Clear all chapters/topics from a subject Trigger
  const handleClearAllChapters = (subjectId: string, subjectName: string) => {
    setDeleteError(null);
    setDeleteTarget({
      type: 'clear_chapters',
      title: 'Clear All Chapters',
      message: `Are you sure you want to clear all chapters and topics from "${subjectName}"? This gives you a blank subject layout.`,
      subjectId
    });
  };

  // Execute Deletion
  const confirmExecuteDelete = () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === 'subject') {
      const updated = subjects.filter(s => s.id !== deleteTarget.subjectId);
      if (updated.length === 0) {
        const fallbackSub: Subject = {
          id: `sub-${Date.now()}`,
          name: 'My New Subject',
          icon: '📚',
          color: '#6B705C',
          chapters: []
        };
        onUpdateSubjects([fallbackSub]);
        setActiveSubjectId(fallbackSub.id);
      } else {
        onUpdateSubjects(updated);
        setActiveSubjectId(updated[0].id);
      }
      setDeleteTarget(null);
      setDeleteError(null);
    } else if (deleteTarget.type === 'topic' && deleteTarget.topicId) {
      const updated = subjects.map(s => {
        if (s.id !== deleteTarget.subjectId) return s;
        return {
          ...s,
          chapters: s.chapters.map(c => {
            if (deleteTarget.chapterId && c.id !== deleteTarget.chapterId) return c;
            return {
              ...c,
              topics: c.topics.filter(t => t.id !== deleteTarget.topicId)
            };
          })
        };
      });
      onUpdateSubjects(updated);
    } else if (deleteTarget.type === 'chapter' && deleteTarget.chapterId) {
      const updated = subjects.map(s => {
        if (s.id !== deleteTarget.subjectId) return s;
        return {
          ...s,
          chapters: s.chapters.filter(c => c.id !== deleteTarget.chapterId)
        };
      });
      onUpdateSubjects(updated);
    } else if (deleteTarget.type === 'clear_chapters') {
      const updated = subjects.map(s => {
        if (s.id !== deleteTarget.subjectId) return s;
        return {
          ...s,
          chapters: []
        };
      });
      onUpdateSubjects(updated);
    }

    setDeleteTarget(null);
    setDeleteError(null);
  };

  // Save Chapter Name
  const handleSaveChapterName = (chapterId: string) => {
    if (!editingChapter || !editingChapter.name.trim() || !activeSubject) return;
    const updated = subjects.map(s => {
      if (s.id !== activeSubject.id) return s;
      return {
        ...s,
        chapters: s.chapters.map(c => {
          if (c.id !== chapterId) return c;
          return { ...c, name: editingChapter.name.trim() };
        })
      };
    });
    onUpdateSubjects(updated);
    setEditingChapter(null);
  };

  // Save Topic Name
  const handleSaveTopicName = (chapterId: string, topicId: string) => {
    if (!editingTopic || !editingTopic.name.trim() || !activeSubject) return;
    const updated = subjects.map(s => {
      if (s.id !== activeSubject.id) return s;
      return {
        ...s,
        chapters: s.chapters.map(c => {
          if (c.id !== chapterId) return c;
          return {
            ...c,
            topics: c.topics.map(t => {
              if (t.id !== topicId) return t;
              return { ...t, name: editingTopic.name.trim() };
            })
          };
        })
      };
    });
    onUpdateSubjects(updated);
    setEditingTopic(null);
  };

  // Add Chapter to active subject
  const handleAddChapter = () => {
    if (!newChapterName.trim() || !activeSubject) return;
    const newChapterObj: Chapter = {
      id: `ch-${Date.now()}`,
      name: newChapterName.trim(),
      topics: []
    };
    const updated = subjects.map(s => {
      if (s.id !== activeSubject.id) return s;
      return {
        ...s,
        chapters: [...s.chapters, newChapterObj]
      };
    });
    onUpdateSubjects(updated);
    setNewChapterName('');
    setIsAddChapterOpen(false);
  };

  // Add Topic to chapter
  const handleAddTopic = (chapterId: string) => {
    if (!newTopicName.trim() || !activeSubject) return;
    const newTopicObj: Topic = {
      id: `tp-${Date.now()}`,
      name: newTopicName.trim(),
      status: 'Not Started',
      subtopics: []
    };
    const updated = subjects.map(s => {
      if (s.id !== activeSubject.id) return s;
      return {
        ...s,
        chapters: s.chapters.map(c => {
          if (c.id !== chapterId) return c;
          return {
            ...c,
            topics: [...c.topics, newTopicObj]
          };
        })
      };
    });
    onUpdateSubjects(updated);
    setNewTopicName('');
    setAddTopicChapterId(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Controls Header */}
      <div className="bg-card border border-theme rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
        <div>
          <h2 className="text-xl font-serif italic font-bold text-primary flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <span>Syllabus & Topic Tracker</span>
          </h2>
          <p className="text-xs text-muted mt-1">
            Organize your subjects, chapters, topics, and subtopic checklists. Permanently saved to Firestore.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Dedicated Exam Portal Direct Link */}
          <a
            id="btn-syllabus-open-exam-portal"
            href="https://ai.studio/apps/22e73b44-206c-4c3f-8f31-363f8f2e6919"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-semibold text-xs transition cursor-pointer active:scale-95 shadow-2xs"
            title="Open your dedicated Exam & Timed Assessment Portal with AI evaluation"
          >
            <Sparkles className="w-4 h-4 text-emerald-200" />
            <span>Launch Exam Portal</span>
            <ExternalLink className="w-3.5 h-3.5 text-emerald-200" />
          </a>

          <button
            onClick={() => {
              setTargetedTestTopic(undefined);
              setIsTargetedTestModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-semibold text-xs transition cursor-pointer active:scale-95 shadow-2xs"
            title="Practice targeted MCQs or generate copyable ChatGPT prompts for any topic"
          >
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Targeted MCQs & AI Prompt</span>
          </button>

          <button
            onClick={() => setIsPresetsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800 font-semibold text-xs transition cursor-pointer active:scale-95 shadow-2xs"
            title="Load curated academic exam presets or use AI to generate tailored exam blueprints"
          >
            <GraduationCap className="w-4 h-4 text-purple-600" />
            <span>Exam Presets & AI Templates</span>
          </button>

          {onOpenDeviceSync && (
            <button
              onClick={onOpenDeviceSync}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-semibold text-xs transition cursor-pointer active:scale-95 shadow-2xs"
              title="Transfer syllabus and study data across devices"
            >
              <Smartphone className="w-4 h-4 text-emerald-600" />
              <span>Transfer / Connect Devices</span>
            </button>
          )}

          {onOpenMaterialImport && (
            <button
              onClick={onOpenMaterialImport}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-medium text-xs transition shadow-sm shadow-indigo-500/20 active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Full Study Ingestion (AI)</span>
            </button>
          )}

          <button
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary hover:opacity-90 text-white font-medium text-xs transition shadow-xs cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Syllabus PDF / Image</span>
          </button>

          <button
            onClick={() => setIsAddSubjectOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-theme-accent hover:opacity-90 text-primary border border-theme font-semibold text-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4 text-primary" />
            <span>Add Subject</span>
          </button>
        </div>
      </div>

      {/* Subject Tabs */}
      {subjects.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-theme scrollbar-none">
          {subjects.map((sub) => {
            const isActive = sub.id === activeSubjectId;
            const isUrdu = sub.language === 'ur' || /[\u0600-\u06FF]/.test(sub.name);
            return (
              <button
                key={sub.id}
                onClick={() => setActiveSubjectId(sub.id)}
                className={`px-4 py-2.5 rounded-2xl font-semibold text-xs whitespace-nowrap transition flex items-center gap-2 border ${
                  isActive
                    ? 'bg-theme-accent text-primary border-theme shadow-2xs font-bold'
                    : 'bg-card text-muted border-theme hover:text-primary hover:bg-theme-accent'
                }`}
              >
                <span className="text-base leading-none">{sub.icon || (isUrdu ? '🇵🇰' : '📚')}</span>
                <span>{sub.name}</span>
                {isUrdu && (
                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold border border-emerald-500/30">
                    اردو
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Empty State when no subjects are in the workspace */}
      {subjects.length === 0 ? (
        <div className="bg-card border border-theme rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-xs animate-fade-in transition-colors">
          <div className="w-16 h-16 rounded-3xl bg-theme-accent text-primary flex items-center justify-center mx-auto">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-lg font-bold text-primary">No Syllabus Subjects Yet</h3>
            <p className="text-xs text-muted leading-relaxed">
              Your device was linked, but no subjects have been loaded or added yet. Choose how you would like to populate your syllabus:
            </p>
          </div>

          {/* Quick Setup Action Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto text-left">
            <button
              onClick={() => setIsPresetsModalOpen(true)}
              className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-300 transition flex items-start gap-3 group cursor-pointer shadow-2xs"
            >
              <div className="p-2.5 rounded-xl bg-purple-200/70 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 shrink-0">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <span>Load Exam Presets</span>
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                </div>
                <div className="text-[11px] text-purple-700/80 dark:text-purple-300/80 mt-0.5">
                  1-Click load Computer Science, STEM, SAT, Medical, or Bar exam syllabus
                </div>
              </div>
            </button>

            <button
              onClick={() => setIsUploadOpen(true)}
              className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300 transition flex items-start gap-3 group cursor-pointer shadow-2xs"
            >
              <div className="p-2.5 rounded-xl bg-emerald-200/70 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 shrink-0">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold">Upload PDF / Image</div>
                <div className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 mt-0.5">
                  AI extracts chapters & topics automatically from syllabus documents
                </div>
              </div>
            </button>

            <button
              onClick={() => setIsAddSubjectOpen(true)}
              className="p-4 rounded-2xl bg-theme-accent hover:opacity-90 border border-theme text-primary transition flex items-start gap-3 group cursor-pointer shadow-2xs"
            >
              <div className="p-2.5 rounded-xl bg-card border border-theme text-primary shrink-0">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold">Create Custom Subject</div>
                <div className="text-[11px] text-muted mt-0.5">
                  Add custom subject name, icon, and chapters manually
                </div>
              </div>
            </button>

            {onOpenQRScanner && (
              <button
                onClick={onOpenQRScanner}
                className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 hover:bg-emerald-100/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 transition flex items-start gap-3 group cursor-pointer shadow-2xs"
              >
                <div className="p-2.5 rounded-xl bg-emerald-200/70 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 shrink-0">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold">Scan In-App QR Code</div>
                  <div className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
                    Scan another device screen or an exported study vault bundle
                  </div>
                </div>
              </button>
            )}
          </div>

          {lastSyncDetails && (
            <div className="pt-2">
              <button
                onClick={onOpenSyncInspector}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-theme-accent border border-theme text-xs font-semibold text-primary hover:bg-card transition cursor-pointer shadow-2xs"
              >
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Device "{lastSyncDetails.deviceName}" linked with 0 subjects. Tap to inspect sync & troubleshoot.</span>
              </button>
            </div>
          )}
        </div>
      ) : activeSubject ? (
        <div className="space-y-4" dir={isUrduSubject ? 'rtl' : 'ltr'}>
          <div className="flex items-center justify-between bg-theme-accent px-4 py-3 rounded-2xl border border-theme transition-colors">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setEditingEmojiSubjectId(activeSubject.id)}
                className="w-10 h-10 rounded-2xl bg-card border border-theme hover:border-primary transition shadow-2xs flex items-center justify-center text-xl group relative cursor-pointer"
                title="Click to change subject emoji icon"
              >
                <span>{activeSubject.icon || (isUrduSubject ? '🇵🇰' : '📚')}</span>
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Smile className="w-2.5 h-2.5" />
                </span>
              </button>

              <div>
                <h3 className={`text-sm font-bold text-primary flex flex-wrap items-center gap-2 ${
                  isUrduSubject ? 'font-nastaliq-heading text-base' : ''
                }`}>
                  <span>{activeSubject.name}</span>
                  {isUrduSubject ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                      اردو نصاب
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 text-[10px] font-bold border border-blue-500/30">
                      English
                    </span>
                  )}
                  
                  {/* Board Affiliation Selector & Badge */}
                  <div className="inline-flex items-center gap-1.5 ml-1">
                    <span className="text-[10px] font-medium text-muted">Board:</span>
                    <select
                      value={activeSubject.boardAffiliation || (isUrduSubject ? 'fbise' : 'general')}
                      onChange={(e) => handleUpdateSubjectBoard(activeSubject.id, e.target.value as ExamBoard)}
                      className="text-[11px] font-semibold bg-card border border-theme rounded-lg px-2 py-0.5 text-primary focus:outline-none focus:border-primary cursor-pointer"
                      title="Select examination board affiliation and mark-to-time pacing standards"
                    >
                      {EXAM_BOARD_PRESETS.map((bp) => (
                        <option key={bp.id} value={bp.id}>
                          {bp.shortName} ({bp.defaultMinutesPerMark}m/mark)
                        </option>
                      ))}
                    </select>
                  </div>

                  <span className="text-xs font-normal text-muted font-mono">
                    ({activeSubject.chapters.length} {isUrduSubject ? 'ابواب' : 'Chapters'})
                  </span>
                </h3>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {/* Active Board Description */}
                  {(() => {
                    const currentBoard = EXAM_BOARD_PRESETS.find(b => b.id === (activeSubject.boardAffiliation || (isUrduSubject ? 'fbise' : 'general')));
                    return currentBoard ? (
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${currentBoard.badgeColor}`}>
                        🏛️ {currentBoard.region} • {currentBoard.defaultMinutesPerMark} min/mark
                      </span>
                    ) : null;
                  })()}
                  <button
                    onClick={() => setEditingEmojiSubjectId(activeSubject.id)}
                    className="text-[11px] text-primary hover:underline font-medium flex items-center gap-1"
                  >
                    <Smile className="w-3 h-3" />
                    <span>{isUrduSubject ? 'آئیکن تبدیل کریں' : 'Change icon'}</span>
                  </button>
                  <span className="text-muted text-[10px]">•</span>
                  <button
                    onClick={() => {
                      const newLang = isUrduSubject ? 'en' : 'ur';
                      const updated = subjects.map(s => s.id === activeSubject.id ? { ...s, language: newLang } : s);
                      onUpdateSubjects(updated);
                    }}
                    className="text-[11px] text-muted hover:text-primary transition font-medium cursor-pointer"
                  >
                    {isUrduSubject ? 'Switch to English LTR' : 'اردو (RTL) میں دکھائیں'}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAddChapterOpen(true)}
                className="text-primary hover:bg-card bg-card/70 border border-theme px-3 py-1.5 rounded-xl font-semibold transition text-xs flex items-center gap-1 shadow-2xs cursor-pointer"
                title="Add Blank Chapter to Subject"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isUrduSubject ? 'نیا باب' : 'Add Chapter'}</span>
              </button>
              {activeSubject.chapters.length > 0 && (
                <button
                  onClick={() => handleClearAllChapters(activeSubject.id, activeSubject.name)}
                  className="text-muted hover:text-amber-700 p-1.5 rounded transition text-xs flex items-center gap-1 hover:bg-amber-50 dark:hover:bg-amber-950/30 cursor-pointer"
                  title="Clear all chapters/topics from this subject"
                >
                  <X className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{isUrduSubject ? 'ابواب صاف کریں' : 'Clear Chapters'}</span>
                </button>
              )}
              <button
                onClick={() => handleDeleteSubject(activeSubject.id)}
                className="text-muted hover:text-rose-600 p-1.5 rounded transition text-xs flex items-center gap-1 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                title="Delete Subject"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isUrduSubject ? 'مضمون حذف کریں' : 'Delete Subject'}</span>
              </button>
            </div>
          </div>

          {activeSubject.chapters.length > 0 ? (
            <div className="space-y-3">
              {activeSubject.chapters.map((chapter, chIdx) => {
                const isExpanded = expandedChapters[chapter.id] !== false; // default open
                return (
                  <div key={chapter.id} className="bg-card border border-theme rounded-3xl overflow-hidden shadow-xs transition-colors">
                    {/* Chapter Header */}
                    <div
                      className="p-4 bg-theme-accent/60 hover:bg-theme-accent flex items-center justify-between transition border-b border-theme"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <button 
                          type="button"
                          onClick={() => toggleChapter(chapter.id)}
                          className="p-1 hover:opacity-80 rounded text-primary transition shrink-0 cursor-pointer"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>

                        {editingChapter?.chapterId === chapter.id ? (
                          <div className="flex items-center gap-2 flex-1 max-w-md">
                            <input
                              type="text"
                              value={editingChapter.name}
                              onChange={(e) => setEditingChapter({ ...editingChapter, name: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveChapterName(chapter.id);
                                if (e.key === 'Escape') setEditingChapter(null);
                              }}
                              className="px-2.5 py-1 bg-card border border-primary rounded-xl text-xs font-bold text-primary w-full focus:outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveChapterName(chapter.id)}
                              className="px-3 py-1 bg-primary text-white rounded-xl text-xs font-bold hover:opacity-90 transition shrink-0 cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingChapter(null)}
                              className="p-1 text-muted hover:text-primary shrink-0 cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <h4 
                              onClick={() => toggleChapter(chapter.id)}
                              className={`text-sm font-bold text-primary truncate cursor-pointer hover:underline transition ${
                                isUrduSubject || /[\u0600-\u06FF]/.test(chapter.name) ? 'font-nastaliq text-right text-base leading-[2.2]' : ''
                              }`}
                            >
                              {chapter.name}
                            </h4>
                            <button
                              type="button"
                              onClick={() => setEditingChapter({ chapterId: chapter.id, name: chapter.name })}
                              className="text-muted hover:text-primary p-1 rounded-lg hover:bg-card transition shrink-0 cursor-pointer"
                              title="Rename Chapter"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-xs font-mono text-muted shrink-0">
                              ({chapter.topics.length} topics)
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setAddTopicChapterId(addTopicChapterId === chapter.id ? null : chapter.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-primary bg-card border border-theme hover:bg-theme-accent rounded-xl flex items-center gap-1 transition cursor-pointer"
                          title="Add Topic to this chapter"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Topic</span>
                        </button>
                        <button
                          onClick={() => handleDeleteChapter(activeSubject.id, chapter.id, chapter.name)}
                          className="text-muted hover:text-rose-600 p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition cursor-pointer"
                          title="Delete Chapter"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Inline Add Topic Form */}
                    {addTopicChapterId === chapter.id && (
                      <div className="p-3 bg-theme-accent border-b border-theme flex items-center gap-2 animate-fade-in">
                        <input
                          type="text"
                          value={newTopicName}
                          onChange={(e) => setNewTopicName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddTopic(chapter.id)}
                          placeholder="Type new topic name and press Enter..."
                          className="flex-1 p-2 bg-card border border-theme rounded-xl text-xs text-primary focus:outline-none focus:border-primary"
                          autoFocus
                        />
                        <button
                          onClick={() => handleAddTopic(chapter.id)}
                          className="px-3 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:opacity-90 transition cursor-pointer"
                        >
                          Save Topic
                        </button>
                        <button
                          onClick={() => setAddTopicChapterId(null)}
                          className="p-2 text-muted hover:text-primary cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Chapter Topics */}
                    {isExpanded && (
                      <div className="p-4 space-y-3 bg-surface transition-colors">
                        {chapter.topics.length > 0 ? (
                          chapter.topics.map((topic, tIdx) => {
                            const topicNumber = topic.topicNumber || `${chIdx + 1}.${tIdx + 1}`;
                            
                            // Find relevant tests for this topic
                            const topName = (topic.name || '').toLowerCase();
                            const subName = (activeSubject.name || '').toLowerCase();
                            const topicTests = testResults.filter(t => 
                              t.topicId === topic.id || 
                              (t.topicNumber && t.topicNumber.toLowerCase() === topicNumber.toLowerCase()) ||
                              (t.topicName && t.topicName.toLowerCase() === topName) ||
                              ((t.subjectName || '').toLowerCase() === subName && (t.testName || '').toLowerCase().includes(topName))
                            );

                            const latestTest = topicTests[0];

                            return (
                              <div
                                key={topic.id}
                                className="p-4 rounded-2xl bg-card border border-theme hover:border-primary/40 transition space-y-2 shadow-2xs"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="space-y-0.5 flex-1 min-w-0">
                                    {editingTopic?.topicId === topic.id ? (
                                      <div className="flex items-center gap-2 my-1 max-w-md">
                                        <input
                                          type="text"
                                          value={editingTopic.name}
                                          onChange={(e) => setEditingTopic({ ...editingTopic, name: e.target.value })}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSaveTopicName(chapter.id, topic.id);
                                            if (e.key === 'Escape') setEditingTopic(null);
                                          }}
                                          className="px-2.5 py-1 bg-surface border border-primary rounded-xl text-xs font-bold text-primary w-full focus:outline-none"
                                          autoFocus
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleSaveTopicName(chapter.id, topic.id)}
                                          className="px-3 py-1 bg-primary text-white rounded-xl text-xs font-bold hover:opacity-90 transition shrink-0 cursor-pointer"
                                        >
                                          Save
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingTopic(null)}
                                          className="p-1 text-muted hover:text-primary shrink-0 cursor-pointer"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex flex-wrap items-center gap-2">
                                        {/* Topic Number Tag */}
                                        <span className="px-2 py-0.5 rounded-md bg-theme-accent text-primary font-mono text-[10px] font-bold border border-theme">
                                          #{topicNumber}
                                        </span>

                                        <h5 className={`text-xs font-bold text-primary ${
                                          isUrduSubject || /[\u0600-\u06FF]/.test(topic.name) ? 'font-nastaliq text-right text-sm leading-[2.2]' : ''
                                        }`}>{topic.name}</h5>

                                        {/* Latest Test Score Badge */}
                                        {latestTest && (
                                          <span 
                                            onClick={() => setActiveTab && setActiveTab('tests')}
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono cursor-pointer border flex items-center gap-1 ${
                                              (latestTest.percentage || 0) >= 80
                                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                : (latestTest.percentage || 0) >= 60
                                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                : 'bg-rose-50 text-rose-800 border-rose-200'
                                            }`}
                                            title={`Test: ${latestTest.testName} (${latestTest.date}) - Click to view in Tests tab`}
                                          >
                                            <Award className="w-3 h-3" />
                                            <span>Score: {latestTest.score}</span>
                                          </span>
                                        )}

                                        <button
                                          type="button"
                                          onClick={() => setEditingTopic({ chapterId: chapter.id, topicId: topic.id, name: topic.name })}
                                          className="text-muted hover:text-primary p-1 rounded-lg hover:bg-theme-accent transition shrink-0 cursor-pointer"
                                          title="Rename Topic"
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    )}
                                    {topic.weakNotes && (
                                      <p className="text-[11px] text-rose-700 dark:text-rose-400 italic">
                                        Note: {topic.weakNotes}
                                      </p>
                                    )}
                                  </div>

                                  {/* Action Buttons: Targeted MCQs, Log Test & Status Selector & Delete */}
                                  <div className="flex flex-wrap items-center gap-2">
                                    {/* Solve MCQs & AI Prompt Generator for this specific topic */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setTargetedTestTopic({
                                          topicNumber,
                                          topicId: topic.id,
                                          topicName: topic.name,
                                          chapterName: chapter.name,
                                          subjectName: activeSubject.name
                                        });
                                        setIsTargetedTestModalOpen(true);
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                                      title={`Solve MCQs or generate ChatGPT prompt for Topic #${topicNumber} (${topic.name})`}
                                    >
                                      <Brain className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      <span>MCQs & Prompt</span>
                                    </button>

                                    {/* Log Test Score for this Topic */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedTopicForTest({
                                          topicNumber,
                                          topicId: topic.id,
                                          topicName: topic.name,
                                          chapterName: chapter.name,
                                          subjectName: activeSubject.name
                                        });
                                        setIsLogTestModalOpen(true);
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-theme-accent hover:opacity-85 text-primary border border-theme text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                      title="Record test score specifically for this topic"
                                    >
                                      <FileCheck className="w-3.5 h-3.5" />
                                      <span>Log Test</span>
                                    </button>

                                    <select
                                      value={topic.status}
                                      onChange={(e) => handleTopicStatusChange(activeSubject.id, chapter.id, topic.id, e.target.value as TopicStatus)}
                                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border focus:outline-none cursor-pointer ${getStatusBadge(topic.status)}`}
                                    >
                                      <option value="Not Started" className="bg-card text-primary">Not Started</option>
                                      <option value="In Progress" className="bg-card text-amber-800">In Progress</option>
                                      <option value="Completed" className="bg-card text-emerald-800">Completed</option>
                                      <option value="Needs Revision" className="bg-card text-purple-800">Needs Revision</option>
                                      <option value="Weak" className="bg-card text-rose-800">Weak</option>
                                      <option value="Mastered" className="bg-card text-teal-800 dark:text-teal-300">Mastered ⭐</option>
                                    </select>

                                    <button
                                      onClick={() => handleDeleteTopic(activeSubject.id, chapter.id, topic.id, topic.name)}
                                      className="text-muted hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                                      title="Delete Topic"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                              {/* Subtopics Checklist */}
                              {topic.subtopics && topic.subtopics.length > 0 && (
                                <div className="pt-2 border-t border-theme grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {topic.subtopics.map((st) => (
                                    <div
                                      key={st.id}
                                      onClick={() => handleToggleSubtopic(activeSubject.id, chapter.id, topic.id, st.id)}
                                      className="flex items-center gap-2 cursor-pointer text-xs text-primary hover:opacity-80 transition py-0.5"
                                    >
                                      {st.completed ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      ) : (
                                        <Circle className="w-3.5 h-3.5 text-muted shrink-0" />
                                      )}
                                      <span className={st.completed ? 'line-through text-muted' : ''}>
                                        {st.name}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-4 text-xs text-muted italic">
                          No topics in this chapter. Click "+ Add Topic" above to add one.
                        </div>
                      )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 bg-white rounded-3xl border border-dashed border-[#E0DBD0]">
              <BookOpen className="w-8 h-8 text-[#A5A58D] mx-auto mb-2" />
              <p className="text-xs text-[#A5A58D]">No chapters added yet for {activeSubject.name}.</p>
              <button
                onClick={() => setIsUploadOpen(true)}
                className="mt-3 px-5 py-2.5 bg-[#6B705C] hover:bg-[#5a5f4e] text-white rounded-full text-xs font-semibold transition"
              >
                Upload Syllabus to Auto-Extract
              </button>
            </div>
          )}
        </div>
      ) : null}

      {/* Upload Syllabus Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#4A4E4D]/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#E0DBD0] rounded-3xl max-w-lg w-full p-6 shadow-xl relative text-[#4A4E4D] space-y-4">
            <button
              onClick={() => setIsUploadOpen(false)}
              className="absolute top-4 right-4 text-[#A5A58D] hover:text-[#4A4E4D] p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-[#6B705C] font-bold text-base">
              <Sparkles className="w-5 h-5" />
              <span>AI Syllabus Extractor</span>
            </div>
            <p className="text-xs text-[#A5A58D]">
              Upload your syllabus PDF, DOCX, TXT, or image file. Gemini AI will organize it strictly into Subject → Chapter → Topic → Subtopics without inventing fake info.
            </p>

            {parseError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl">
                {parseError}
              </div>
            )}

            {/* Mode Switcher */}
            <div className="flex bg-[#F9F7F2] p-1 rounded-2xl border border-[#E0DBD0] gap-1">
              <button
                type="button"
                onClick={() => setUploadMode('file')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  uploadMode === 'file'
                    ? 'bg-white text-[#4A4E4D] shadow-xs'
                    : 'text-[#A5A58D] hover:text-[#4A4E4D]'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                Upload File
              </button>
              <button
                type="button"
                onClick={() => {
                  setUploadMode('gdrive');
                  if (driveFiles.length === 0) {
                    handleLoadDriveFiles();
                  }
                }}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  uploadMode === 'gdrive'
                    ? 'bg-white text-[#4A4E4D] shadow-xs'
                    : 'text-[#A5A58D] hover:text-[#4A4E4D]'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Google Drive
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('text')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  uploadMode === 'text'
                    ? 'bg-white text-[#4A4E4D] shadow-xs'
                    : 'text-[#A5A58D] hover:text-[#4A4E4D]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Paste Text
              </button>
            </div>

            {/* Mode 1: File Upload */}
            {uploadMode === 'file' && (
              <div className="border-2 border-dashed border-[#E0DBD0] hover:border-[#6B705C] p-5 rounded-2xl text-center bg-[#F9F7F2] cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="syllabus-file-input"
                />
                <label htmlFor="syllabus-file-input" className="cursor-pointer block">
                  <Upload className="w-7 h-7 text-[#6B705C] mx-auto mb-1.5" />
                  <span className="text-xs font-semibold text-[#4A4E4D] block">
                    {selectedFile ? selectedFile.name : 'Click to select document or image'}
                  </span>
                  <span className="block text-[11px] text-[#A5A58D] mt-0.5">PDF, DOCX, TXT, or Image</span>
                </label>
              </div>
            )}

            {/* Mode 2: Google Drive */}
            {uploadMode === 'gdrive' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#4A4E4D]">Select Syllabus from Drive</span>
                  <button
                    type="button"
                    onClick={handleLoadDriveFiles}
                    disabled={loadingDrive}
                    className="text-xs text-[#6B705C] hover:underline flex items-center gap-1 font-medium"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingDrive ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>

                {loadingDrive ? (
                  <div className="py-8 text-center text-xs text-[#A5A58D] space-y-2">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#6B705C]" />
                    <p>Connecting to Google Drive...</p>
                  </div>
                ) : driveError ? (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                    <p className="font-semibold mb-1">Drive Access</p>
                    <p>{driveError}</p>
                    <button
                      type="button"
                      onClick={handleLoadDriveFiles}
                      className="mt-2 px-3 py-1 bg-amber-600 text-white rounded-lg text-[11px] font-medium"
                    >
                      Authenticate Google Drive
                    </button>
                  </div>
                ) : driveFiles.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[#A5A58D]">
                    <FolderOpen className="w-8 h-8 mx-auto text-[#A5A58D]/60 mb-2" />
                    <p>No documents found in Google Drive.</p>
                    <button
                      type="button"
                      onClick={handleLoadDriveFiles}
                      className="mt-2 text-xs text-[#6B705C] font-semibold hover:underline"
                    >
                      Click to scan Drive
                    </button>
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 border border-[#E0DBD0] rounded-2xl p-2 bg-[#F9F7F2]">
                    {driveFiles.map(f => (
                      <div
                        key={f.id}
                        onClick={() => setSelectedDriveFile(f)}
                        className={`p-2.5 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                          selectedDriveFile?.id === f.id
                            ? 'bg-[#6B705C]/10 border border-[#6B705C] text-[#4A4E4D]'
                            : 'hover:bg-white text-[#4A4E4D]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 text-[#6B705C] shrink-0" />
                          <span className="text-xs font-medium truncate">{f.name}</span>
                        </div>
                        {selectedDriveFile?.id === f.id && (
                          <CheckCircle className="w-4 h-4 text-[#6B705C] shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Mode 3: Paste Text */}
            {uploadMode === 'text' && (
              <textarea
                value={uploadText}
                onChange={(e) => setUploadText(e.target.value)}
                placeholder="Paste your syllabus, course outline, or module list here..."
                rows={5}
                className="w-full p-3 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
              />
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsUploadOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[#A5A58D] hover:text-[#4A4E4D]"
              >
                Cancel
              </button>
              <button
                onClick={handleParseSyllabus}
                disabled={isParsing}
                className="px-5 py-2.5 bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-medium text-xs rounded-full shadow-xs disabled:opacity-50 flex items-center gap-2"
              >
                {isParsing ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    <span>Analyzing with Gemini...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Extract & Organize</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Extracted Syllabus Modal */}
      {isReviewOpen && extractedData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#4A4E4D]/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#E0DBD0] rounded-3xl max-w-2xl w-full p-6 shadow-xl relative text-[#4A4E4D] space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#E0DBD0] pb-3">
              <h3 className="text-base font-bold text-[#4A4E4D] flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#6B705C]" />
                <span>Review Extracted Syllabus</span>
              </h3>
              <button
                onClick={() => setIsReviewOpen(false)}
                className="text-[#A5A58D] hover:text-[#4A4E4D] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#A5A58D]">
              Review the extracted structure below before saving it permanently to your Firestore database.
            </p>

            <div className="flex-1 overflow-y-auto space-y-3 p-4 bg-[#F9F7F2] rounded-2xl border border-[#E0DBD0] text-xs">
              {extractedData.subjects && extractedData.subjects.length > 0 ? (
                extractedData.subjects.map((sub: any, sIdx: number) => (
                  <div key={sIdx} className="space-y-2 border-b border-[#E0DBD0] pb-3 last:border-b-0">
                    <div className="font-bold text-[#6B705C] text-sm">{sub.name}</div>
                    {(sub.chapters || []).map((ch: any, cIdx: number) => (
                      <div key={cIdx} className="pl-3 space-y-1">
                        <div className="font-semibold text-[#4A4E4D]">{ch.name}</div>
                        {(ch.topics || []).map((tp: any, tIdx: number) => (
                          <div key={tIdx} className="pl-3 text-[#A5A58D]">
                            • {tp.name}
                            {tp.subtopics && tp.subtopics.length > 0 && (
                              <span className="text-[#A5A58D]/80 text-[11px] ml-2">
                                ({tp.subtopics.length} subtopics)
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <p className="text-[#A5A58D] italic">No subjects recognized in extracted output.</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsReviewOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[#A5A58D] hover:text-[#4A4E4D]"
              >
                Discard
              </button>
              <button
                onClick={handleSaveExtractedSyllabus}
                className="px-5 py-2.5 bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-medium text-xs rounded-full shadow-xs flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Save to Syllabus & Sync</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Subject Modal */}
      {isAddSubjectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#4A4E4D]/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#E0DBD0] rounded-3xl max-w-sm w-full p-6 shadow-xl relative text-[#4A4E4D] space-y-4">
            <button
              onClick={() => setIsAddSubjectOpen(false)}
              className="absolute top-4 right-4 text-[#A5A58D] hover:text-[#4A4E4D] p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-base font-bold text-[#4A4E4D]">Add Blank Subject</h3>
              <p className="text-[11px] text-[#A5A58D] mt-0.5">Creates a fresh subject with no pre-existing chapters or topics.</p>
            </div>

            {/* Emoji Selector */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[#A5A58D] uppercase tracking-wider block">Subject Emoji Icon</label>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-[#F2EFE9] border border-[#E0DBD0] flex items-center justify-center text-xl shrink-0">
                  {newSubjectEmoji || '📚'}
                </div>
                <input
                  type="text"
                  value={newSubjectEmoji}
                  onChange={(e) => setNewSubjectEmoji(e.target.value)}
                  placeholder="Paste or type emoji"
                  className="w-full p-2.5 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
                />
              </div>
              <div className="grid grid-cols-8 gap-1 pt-1 max-h-28 overflow-y-auto">
                {PRESET_EMOJIS.map((emoji) => (
                  <button
                    type="button"
                    key={emoji}
                    onClick={() => setNewSubjectEmoji(emoji)}
                    className={`p-1.5 text-base rounded-xl hover:bg-[#F2EFE9] transition flex items-center justify-center border ${
                      newSubjectEmoji === emoji ? 'border-[#6B705C] bg-[#EAE7DF]' : 'border-transparent'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Language Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#A5A58D] uppercase tracking-wider block">Language / زبان</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setNewSubjectLanguage('en');
                    if (newSubjectEmoji === '🇵🇰') setNewSubjectEmoji('📚');
                  }}
                  className={`py-2 px-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 border transition ${
                    newSubjectLanguage === 'en'
                      ? 'bg-[#EAE7DF] border-[#6B705C] text-[#4A4E4D]'
                      : 'bg-[#F9F7F2] border-[#E0DBD0] text-[#A5A58D] hover:text-[#4A4E4D]'
                  }`}
                >
                  <span>🌐 English</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewSubjectLanguage('ur');
                    if (newSubjectEmoji === '📚') setNewSubjectEmoji('🇵🇰');
                  }}
                  className={`py-2 px-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 border transition ${
                    newSubjectLanguage === 'ur'
                      ? 'bg-emerald-100 dark:bg-emerald-950/40 border-emerald-600 text-emerald-900 dark:text-emerald-200'
                      : 'bg-[#F9F7F2] border-[#E0DBD0] text-[#A5A58D] hover:text-[#4A4E4D]'
                  }`}
                >
                  <span>🇵🇰 اردو (Urdu)</span>
                </button>
              </div>
            </div>

            {/* Examination Board Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#A5A58D] uppercase tracking-wider block">
                Exam Board Standard / امتحانی بورڈ
              </label>
              <select
                value={newSubjectBoard}
                onChange={(e) => setNewSubjectBoard(e.target.value as ExamBoard)}
                className="w-full p-2.5 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] focus:outline-none focus:border-[#6B705C] cursor-pointer"
              >
                {EXAM_BOARD_PRESETS.map((bp) => (
                  <option key={bp.id} value={bp.id}>
                    {bp.name} ({bp.defaultMinutesPerMark}m/mark)
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-[#A5A58D]">
                Sets mark-to-time pacing ratios and question styling for timed mock assessments.
              </p>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#A5A58D] uppercase tracking-wider block mb-1">
                {newSubjectLanguage === 'ur' ? 'مضمون کا نام (اردو)' : 'Subject Name'}
              </label>
              <input
                type="text"
                dir={newSubjectLanguage === 'ur' ? 'rtl' : 'ltr'}
                value={newSubjectName}
                onChange={(e) => {
                  setNewSubjectName(e.target.value);
                  if (/[\u0600-\u06FF]/.test(e.target.value)) {
                    setNewSubjectLanguage('ur');
                    if (newSubjectEmoji === '📚') setNewSubjectEmoji('🇵🇰');
                  }
                }}
                placeholder={newSubjectLanguage === 'ur' ? 'مثلاً اردو لازمی، اسلامیات، مطالعہ پاکستان' : 'e.g. Computer Science, Economics'}
                className="w-full p-3 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsAddSubjectOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[#A5A58D] hover:text-[#4A4E4D]"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSubject}
                className="px-5 py-2.5 bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-medium text-xs rounded-full shadow-xs"
              >
                Add Subject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Subject Emoji Icon Modal */}
      {editingEmojiSubjectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#4A4E4D]/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#E0DBD0] rounded-3xl max-w-sm w-full p-6 shadow-xl relative text-[#4A4E4D] space-y-4">
            <button
              onClick={() => setEditingEmojiSubjectId(null)}
              className="absolute top-4 right-4 text-[#A5A58D] hover:text-[#4A4E4D] p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-base font-bold text-[#4A4E4D]">Choose Subject Emoji</h3>
              <p className="text-[11px] text-[#A5A58D] mt-0.5">
                Select an emoji icon for <span className="font-semibold text-[#4A4E4D]">{subjects.find(s => s.id === editingEmojiSubjectId)?.name}</span>.
              </p>
            </div>

            <div className="grid grid-cols-6 gap-2 p-3 bg-[#F9F7F2] rounded-2xl border border-[#E0DBD0] max-h-56 overflow-y-auto">
              {PRESET_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleUpdateSubjectEmoji(editingEmojiSubjectId, emoji)}
                  className="p-2.5 text-2xl rounded-xl hover:bg-white hover:border-[#6B705C] transition flex items-center justify-center border border-transparent shadow-2xs hover:scale-110 transform"
                >
                  {emoji}
                </button>
              ))}
            </div>

            <div className="pt-1">
              <label className="text-[11px] text-[#A5A58D] font-bold block mb-1 uppercase">Or custom emoji character:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Paste emoji here..."
                  className="flex-1 p-2 bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl text-xs text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      handleUpdateSubjectEmoji(editingEmojiSubjectId, e.currentTarget.value.trim());
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setEditingEmojiSubjectId(null)}
                className="px-4 py-2 text-xs font-semibold text-[#A5A58D] hover:text-[#4A4E4D]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Chapter Modal */}
      {isAddChapterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#4A4E4D]/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#E0DBD0] rounded-3xl max-w-sm w-full p-6 shadow-xl relative text-[#4A4E4D] space-y-4">
            <button
              onClick={() => setIsAddChapterOpen(false)}
              className="absolute top-4 right-4 text-[#A5A58D] hover:text-[#4A4E4D] p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-base font-bold text-[#4A4E4D]">Add Chapter to {activeSubject?.name}</h3>
              <p className="text-[11px] text-[#A5A58D] mt-0.5">Creates a blank chapter with no pre-existing topics.</p>
            </div>

            <input
              type="text"
              value={newChapterName}
              onChange={(e) => setNewChapterName(e.target.value)}
              placeholder="e.g. Chapter 1: Introduction & Fundamentals"
              className="w-full p-3 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
              autoFocus
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsAddChapterOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[#A5A58D] hover:text-[#4A4E4D]"
              >
                Cancel
              </button>
              <button
                onClick={handleAddChapter}
                className="px-5 py-2.5 bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-medium text-xs rounded-full shadow-xs"
              >
                Add Chapter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#4A4E4D]/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#E0DBD0] rounded-3xl max-w-sm w-full p-6 shadow-xl relative text-[#4A4E4D] space-y-4">
            <button
              onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
              className="absolute top-4 right-4 text-[#A5A58D] hover:text-[#4A4E4D] p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#4A4E4D]">{deleteTarget.title}</h3>
                <p className="text-xs text-[#A5A58D] mt-0.5">{deleteTarget.message}</p>
              </div>
            </div>

            {deleteError ? (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl">
                {deleteError}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
                className="px-4 py-2 text-xs font-semibold text-[#A5A58D] hover:text-[#4A4E4D]"
              >
                Cancel
              </button>
              {!deleteError && (
                <button
                  onClick={confirmExecuteDelete}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-full shadow-xs transition"
                >
                  Confirm Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Log Topic Test Modal */}
      {isLogTestModalOpen && onAddTestResult && (
        <LogTopicTestModal
          isOpen={isLogTestModalOpen}
          onClose={() => {
            setIsLogTestModalOpen(false);
            setSelectedTopicForTest(undefined);
          }}
          subjects={subjects}
          vaults={vaults}
          initialTopic={selectedTopicForTest}
          onSaveTest={async (test) => {
            await onAddTestResult(test);
            setIsLogTestModalOpen(false);
            setSelectedTopicForTest(undefined);
          }}
        />
      )}

      {/* Targeted Topic MCQ Quiz & AI Prompt Generator Modal */}
      {isTargetedTestModalOpen && (
        <TopicTargetedTestModal
          isOpen={isTargetedTestModalOpen}
          onClose={() => {
            setIsTargetedTestModalOpen(false);
            setTargetedTestTopic(undefined);
          }}
          subjects={subjects}
          initialSubjectName={targetedTestTopic?.subjectName || activeSubject?.name}
          initialChapterName={targetedTestTopic?.chapterName}
          initialTopicNumber={targetedTestTopic?.topicNumber}
          initialTopicName={targetedTestTopic?.topicName}
          initialTopicId={targetedTestTopic?.topicId}
          testResults={testResults}
          onSaveTestResult={async (result) => {
            if (onAddTestResult) {
              await onAddTestResult(result);
            }
          }}
          onUpdateTopicStatus={(subId, chId, tpId, newStatus) => {
            handleTopicStatusChange(subId, chId, tpId, newStatus);
          }}
        />
      )}

      {/* Curated Exam Presets & AI Blueprint Modal */}
      <ExamPresetsModal
        isOpen={isPresetsModalOpen}
        onClose={() => setIsPresetsModalOpen(false)}
        onApplyPreset={handleApplyPreset}
      />
    </div>
  );
};
