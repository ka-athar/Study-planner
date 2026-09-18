import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Sparkles, 
  Brain, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  BookOpen, 
  RotateCcw, 
  ArrowRight, 
  Play, 
  Pause, 
  FileText, 
  ListFilter, 
  TrendingUp, 
  Flame, 
  Lightbulb, 
  Award, 
  ChevronRight, 
  ChevronLeft,
  Search, 
  X,
  Target,
  PlusCircle,
  HelpCircle,
  Check,
  Calendar,
  Layers,
  BarChart2,
  Camera,
  Image as ImageIcon,
  Upload,
  Eye,
  Trash2,
  Maximize2,
  FileCheck,
  Copy,
  RefreshCw,
  FolderPlus,
  FileQuestion,
  BookMarked
} from 'lucide-react';
import { 
  Subject, 
  StudyPlan, 
  RevisionItem, 
  UserNote, 
  ActivityLog, 
  UserProfile, 
  ActiveTab, 
  TopicStatus,
  BlurtRecallEvaluation,
  BlurtKnowledgeGap,
  BlurtRecalledConcept,
  BlurtMisconception,
  Flashcard,
  FlashcardDeck,
  HandwrittenNotesQuizQuestion,
  HandwrittenNotesStudySet
} from '../types';
import { apiGenerateBlurtPrompt, apiEvaluateBlurtRecall, apiConvertHandwrittenNotesToStudySet } from '../lib/aiApi';
import { compressImageFile } from '../lib/base64Utils';
import { addMistake } from '../lib/mistakeVaultStorage';

interface BlurtRecallViewProps {
  subjects: Subject[];
  plans?: StudyPlan[];
  revisions?: RevisionItem[];
  notes?: UserNote[];
  activityLogs: ActivityLog[];
  userProfile?: UserProfile | null;
  initialTopic?: { subjectName: string; chapterName?: string; topicName: string } | null;
  onLogActivity: (log: Omit<ActivityLog, 'id' | 'userId'>) => Promise<void>;
  onSaveRevision?: (rev: Omit<RevisionItem, 'id' | 'userId'>) => Promise<void>;
  onSaveFlashcardDeck?: (deck: FlashcardDeck) => Promise<void>;
  onUpdateTopicStatus?: (subjectName: string, topicName: string, status: TopicStatus) => Promise<void>;
  onStartTimerForTopic?: (subjectName: string, chapterName: string, topicName: string) => void;
  setActiveTab: (tab: ActiveTab) => void;
}

export const BlurtRecallView: React.FC<BlurtRecallViewProps> = ({
  subjects,
  plans = [],
  revisions = [],
  notes = [],
  activityLogs = [],
  userProfile,
  initialTopic,
  onLogActivity,
  onSaveRevision,
  onSaveFlashcardDeck,
  onUpdateTopicStatus,
  onStartTimerForTopic,
  setActiveTab
}) => {
  // Navigation between Arena, Vision Notes Converter & Performance History
  const [viewMode, setViewMode] = useState<'arena' | 'vision_notes' | 'history'>('arena');

  // Vision Notes to Recall Quiz & Flashcards State
  const [studySetTargetMode, setStudySetTargetMode] = useState<'both' | 'quiz' | 'flashcards'>('both');
  const [isConvertingNotes, setIsConvertingNotes] = useState<boolean>(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [handwrittenStudySet, setHandwrittenStudySet] = useState<HandwrittenNotesStudySet | null>(null);
  const [activeStudySetTab, setActiveStudySetTab] = useState<'quiz' | 'flashcards' | 'transcription'>('quiz');

  // Interactive Quiz State
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [revealedHints, setRevealedHints] = useState<Record<string, boolean>>({});
  const [quizCompleted, setQuizCompleted] = useState<boolean>(false);
  const [isQuizLogged, setIsQuizLogged] = useState<boolean>(false);

  // Interactive Flashcards State
  const [activeFlashcardIdx, setActiveFlashcardIdx] = useState<number>(0);
  const [isFlashcardFlipped, setIsFlashcardFlipped] = useState<boolean>(false);
  const [isDeckSaved, setIsDeckSaved] = useState<boolean>(false);
  const [copiedTranscription, setCopiedTranscription] = useState<boolean>(false);

  // Selected topic details
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedChapter, setSelectedChapter] = useState<string>('');
  const [selectedTopicName, setSelectedTopicName] = useState<string>('');
  const [customTopicInput, setCustomTopicInput] = useState<string>('');
  const [isCustomTopicMode, setIsCustomTopicMode] = useState<boolean>(false);

  // Topic search & filter mode
  const [topicSearchQuery, setTopicSearchQuery] = useState<string>('');
  const [topicFilterMode, setTopicFilterMode] = useState<'recommended' | 'today' | 'all'>('recommended');

  // Prompt state
  const [promptText, setPromptText] = useState<string>('');
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState<boolean>(false);
  const [showPromptHints, setShowPromptHints] = useState<boolean>(false);

  // Blurt Input & Timer state
  const [blurtText, setBlurtText] = useState<string>('');
  const [timerDuration, setTimerDuration] = useState<number>(300); // 5 mins default in seconds
  const [timeRemaining, setTimeRemaining] = useState<number>(300);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [isUntimed, setIsUntimed] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Evaluation & Results state
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [currentEvaluation, setCurrentEvaluation] = useState<BlurtRecallEvaluation | null>(null);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [savedToActivityBadge, setSavedToActivityBadge] = useState<boolean>(false);
  const [revisionAddedSuccess, setRevisionAddedSuccess] = useState<boolean>(false);
  const [gapsSavedToVaultSuccess, setGapsSavedToVaultSuccess] = useState<boolean>(false);
  const [gapsConvertedToDeckSuccess, setGapsConvertedToDeckSuccess] = useState<boolean>(false);
  const [statusUpdatedSuccess, setStatusUpdatedSuccess] = useState<string | null>(null);

  // Attached Image state for handwritten notes / work / diagrams
  const [attachedImage, setAttachedImage] = useState<{
    base64: string;
    dataUrl: string;
    mimeType: string;
    fileName: string;
    sizeBytes: number;
  } | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [showTranscribedText, setShowTranscribedText] = useState<boolean>(true);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timerIntervalRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Handle image file selection / camera capture
  const handleProcessImageFile = async (file: File | Blob) => {
    if (!file.type.startsWith('image/')) {
      setEvaluationError('Please select a valid image file (PNG, JPG, JPEG, WEBP).');
      return;
    }
    setIsProcessingImage(true);
    setEvaluationError(null);
    setConvertError(null);
    try {
      const processed = await compressImageFile(file, 1400, 0.85);
      setAttachedImage(processed);
    } catch (err: any) {
      console.error('Error processing image:', err);
      setEvaluationError('Could not process this image. Please try another photo.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleDropImage = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveImage = () => {
    setAttachedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // Convert handwritten notes using vision AI
  const handleConvertHandwrittenNotes = async (overrideImage?: typeof attachedImage) => {
    const imageToUse = overrideImage || attachedImage;
    if (!imageToUse) {
      setConvertError('Please select or take a photo of your handwritten notes first.');
      return;
    }
    setIsConvertingNotes(true);
    setConvertError(null);
    try {
      const result = await apiConvertHandwrittenNotesToStudySet({
        imageBase64: imageToUse.base64,
        imageMimeType: imageToUse.mimeType,
        targetMode: studySetTargetMode,
        topicName: selectedTopicName || undefined,
        subjectName: selectedSubject || undefined,
        chapterName: selectedChapter || undefined
      });

      if (result && result.studySet) {
        setHandwrittenStudySet(result.studySet);
        setViewMode('vision_notes');
        const hasQuiz = Array.isArray(result.studySet.quiz) && result.studySet.quiz.length > 0;
        const hasFlashcards = Array.isArray(result.studySet.flashcards) && result.studySet.flashcards.length > 0;
        if (studySetTargetMode === 'flashcards' && hasFlashcards) {
          setActiveStudySetTab('flashcards');
        } else if (hasQuiz) {
          setActiveStudySetTab('quiz');
        } else {
          setActiveStudySetTab('flashcards');
        }
        setSelectedAnswers({});
        setRevealedHints({});
        setQuizCompleted(false);
        setIsQuizLogged(false);
        setIsDeckSaved(false);
        setActiveFlashcardIdx(0);
        setIsFlashcardFlipped(false);
        if (!selectedTopicName && result.studySet.topicName) {
          setSelectedTopicName(result.studySet.topicName);
        }
        if (!selectedSubject && result.studySet.subjectName) {
          setSelectedSubject(result.studySet.subjectName);
        }
      } else {
        throw new Error('No study set generated from notes');
      }
    } catch (err: any) {
      console.error('Error converting handwritten notes:', err);
      setConvertError(err.message || 'Failed to analyze handwritten notes with vision AI. Please ensure the photo is clear and try again.');
    } finally {
      setIsConvertingNotes(false);
    }
  };

  const handleSelectQuizOption = (questionId: string, option: string) => {
    if (selectedAnswers[questionId]) return;
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: option
    }));
  };

  const handleFinishQuiz = async () => {
    if (!handwrittenStudySet || !handwrittenStudySet.quiz.length) return;
    const questions = handwrittenStudySet.quiz;
    let correct = 0;
    questions.forEach(q => {
      if (selectedAnswers[q.id] === q.correctAnswer) correct++;
    });
    const percentage = Math.round((correct / questions.length) * 100);
    setQuizCompleted(true);

    if (!isQuizLogged) {
      await onLogActivity({
        timestamp: Date.now(),
        date: new Date().toISOString().split('T')[0],
        subjectName: handwrittenStudySet.subjectName,
        chapterName: handwrittenStudySet.chapterName || '',
        topicName: handwrittenStudySet.topicName,
        action: 'Handwritten Notes Quiz',
        details: `Completed ${questions.length}-question recall quiz from handwritten notes on "${handwrittenStudySet.topicName}": ${correct}/${questions.length} correct (${percentage}%)`,
        result: `${percentage}% (${correct}/${questions.length})`,
        scorePercentage: percentage,
        durationMinutes: 3
      });
      setIsQuizLogged(true);
    }
  };

  const handleRetakeQuiz = () => {
    setSelectedAnswers({});
    setRevealedHints({});
    setQuizCompleted(false);
  };

  const handleSaveDeck = async () => {
    if (!handwrittenStudySet || !handwrittenStudySet.flashcards.length || isDeckSaved) return;

    const newDeck: FlashcardDeck = {
      id: `deck-handwritten-${Date.now()}`,
      title: handwrittenStudySet.title || `${handwrittenStudySet.topicName} Handwritten Notes Deck`,
      subjectName: handwrittenStudySet.subjectName || 'General',
      chapterName: handwrittenStudySet.chapterName || undefined,
      topicName: handwrittenStudySet.topicName,
      description: `Active recall flashcard set generated from handwritten notes on ${new Date().toLocaleDateString()}`,
      cards: handwrittenStudySet.flashcards.map((fc, idx) => ({
        ...fc,
        id: fc.id || `card-${Date.now()}-${idx}`,
        easeFactor: 2.5,
        intervalDays: 1,
        repetitions: 0,
        nextReviewDate: new Date().toISOString().split('T')[0]
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (onSaveFlashcardDeck) {
      await onSaveFlashcardDeck(newDeck);
    }

    await onLogActivity({
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0],
      subjectName: handwrittenStudySet.subjectName,
      chapterName: handwrittenStudySet.chapterName || '',
      topicName: handwrittenStudySet.topicName,
      action: 'Flashcards Created',
      details: `Generated and saved ${handwrittenStudySet.flashcards.length}-card deck from handwritten notes via Gemini Vision AI`,
      result: `${handwrittenStudySet.flashcards.length} cards saved`,
      durationMinutes: 2
    });

    setIsDeckSaved(true);
  };

  const handleCopyTranscription = () => {
    if (!handwrittenStudySet) return;
    const textToCopy = `${handwrittenStudySet.title}\n\nSummary:\n${handwrittenStudySet.summary}\n\nExtracted Notes:\n${handwrittenStudySet.extractedText}${handwrittenStudySet.diagramNotes ? `\n\nDiagram Notes:\n${handwrittenStudySet.diagramNotes}` : ''}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedTranscription(true);
    setTimeout(() => setCopiedTranscription(false), 2500);
  };

  const handleStartBlurtFromStudySet = () => {
    if (!handwrittenStudySet) return;
    setSelectedSubject(handwrittenStudySet.subjectName);
    setSelectedChapter(handwrittenStudySet.chapterName || '');
    setSelectedTopicName(handwrittenStudySet.topicName);
    setPromptText(`Blurt everything you know about ${handwrittenStudySet.topicName}, including key formulas and concepts.`);
    setFocusAreas(handwrittenStudySet.keyConcepts || []);
    setViewMode('arena');
  };

  // Clipboard paste support for screenshots or images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if ((viewMode !== 'arena' && viewMode !== 'vision_notes') || currentEvaluation) return;
      if (e.clipboardData && e.clipboardData.items) {
        for (let i = 0; i < e.clipboardData.items.length; i++) {
          const item = e.clipboardData.items[i];
          if (item.type.indexOf('image') !== -1) {
            const blob = item.getAsFile();
            if (blob) {
              handleProcessImageFile(blob);
              break;
            }
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [viewMode, currentEvaluation]);

  // 1. Gather all syllabus topics
  const allSyllabusTopics = useMemo(() => {
    const list: {
      subjectName: string;
      subjectIcon?: string;
      chapterName: string;
      topicName: string;
      status: TopicStatus;
      subtopics: string[];
      weakNotes?: string;
      isWeak: boolean;
      isInTodayPlan: boolean;
    }[] = [];

    const todayStr = new Date().toISOString().split('T')[0];
    const todayPlan = plans.find(p => p.date === todayStr);
    const todayPlanTopicNames = new Set(todayPlan ? todayPlan.topics.map(t => t.topicName.toLowerCase()) : []);

    subjects.forEach(sub => {
      sub.chapters.forEach(ch => {
        ch.topics.forEach(t => {
          const isWeak = t.status === 'Weak' || t.status === 'Needs Revision';
          const isInTodayPlan = todayPlanTopicNames.has(t.name.toLowerCase());
          list.push({
            subjectName: sub.name,
            subjectIcon: sub.icon || '📚',
            chapterName: ch.name,
            topicName: t.name,
            status: t.status,
            subtopics: t.subtopics ? t.subtopics.map(st => st.name) : [],
            weakNotes: t.weakNotes,
            isWeak,
            isInTodayPlan
          });
        });
      });
    });

    return list;
  }, [subjects, plans]);

  // Weak/Recommended topics for high-yield recall
  const recommendedTopics = useMemo(() => {
    return allSyllabusTopics.filter(t => t.isWeak || t.isInTodayPlan);
  }, [allSyllabusTopics]);

  // Today's topics
  const todayPlanTopics = useMemo(() => {
    return allSyllabusTopics.filter(t => t.isInTodayPlan);
  }, [allSyllabusTopics]);

  // Filtered topics based on search & filter mode
  const filteredTopics = useMemo(() => {
    let source = allSyllabusTopics;
    if (topicFilterMode === 'recommended') {
      source = recommendedTopics.length > 0 ? recommendedTopics : allSyllabusTopics;
    } else if (topicFilterMode === 'today') {
      source = todayPlanTopics.length > 0 ? todayPlanTopics : allSyllabusTopics;
    }

    if (!topicSearchQuery.trim()) return source;
    const q = topicSearchQuery.toLowerCase();
    return source.filter(t => 
      t.topicName.toLowerCase().includes(q) ||
      t.subjectName.toLowerCase().includes(q) ||
      t.chapterName.toLowerCase().includes(q)
    );
  }, [allSyllabusTopics, recommendedTopics, todayPlanTopics, topicFilterMode, topicSearchQuery]);

  // Initialize from initialTopic prop or first available topic
  useEffect(() => {
    if (initialTopic) {
      setSelectedSubject(initialTopic.subjectName);
      setSelectedChapter(initialTopic.chapterName || '');
      setSelectedTopicName(initialTopic.topicName);
      setIsCustomTopicMode(false);
    } else if (!selectedTopicName && allSyllabusTopics.length > 0) {
      const topPick = recommendedTopics[0] || allSyllabusTopics[0];
      setSelectedSubject(topPick.subjectName);
      setSelectedChapter(topPick.chapterName);
      setSelectedTopicName(topPick.topicName);
    }
  }, [initialTopic, allSyllabusTopics, recommendedTopics]);

  // Selected topic object
  const activeTopicObj = useMemo(() => {
    if (isCustomTopicMode) {
      return {
        subjectName: selectedSubject || 'General Subject',
        chapterName: selectedChapter || 'General Chapter',
        topicName: customTopicInput || 'Custom Academic Topic',
        status: 'In Progress' as TopicStatus,
        subtopics: [],
        weakNotes: '',
        isWeak: false,
        isInTodayPlan: false
      };
    }
    return allSyllabusTopics.find(
      t => t.topicName.toLowerCase() === selectedTopicName.toLowerCase() &&
           t.subjectName.toLowerCase() === selectedSubject.toLowerCase()
    ) || {
      subjectName: selectedSubject || 'General',
      chapterName: selectedChapter || '',
      topicName: selectedTopicName || '',
      status: 'In Progress' as TopicStatus,
      subtopics: [],
      weakNotes: '',
      isWeak: false,
      isInTodayPlan: false
    };
  }, [allSyllabusTopics, selectedSubject, selectedChapter, selectedTopicName, isCustomTopicMode, customTopicInput]);

  // Generate or set prompt whenever active topic changes
  useEffect(() => {
    if (!activeTopicObj.topicName) return;

    // Reset blurt and evaluation when switching topics
    if (!currentEvaluation) {
      setBlurtText('');
      setElapsedSeconds(0);
      setTimeRemaining(timerDuration);
      setIsTimerRunning(false);
    }

    // Default canonical prompt
    const defaultPrompt = `Brain-dump everything you know about "${activeTopicObj.topicName}" (${activeTopicObj.subjectName}). Write down definitions, key principles, formulas, structural components, sequence of steps, and real-world relevance. Do not peek at your notes!`;
    setPromptText(defaultPrompt);

    // Initial focus areas based on subtopics
    if (activeTopicObj.subtopics && activeTopicObj.subtopics.length > 0) {
      setFocusAreas(activeTopicObj.subtopics.slice(0, 4));
    } else {
      setFocusAreas(['Core Definitions & Laws', 'Underlying Mechanisms / Steps', 'Formulas / Diagrams / Key Terms', 'Exceptions & Applications']);
    }
  }, [activeTopicObj.topicName, activeTopicObj.subjectName]);

  // Function to generate targeted AI prompt using Gemini
  const handleGenerateAiPrompt = async () => {
    if (!activeTopicObj.topicName) return;
    setIsGeneratingPrompt(true);
    try {
      const res = await apiGenerateBlurtPrompt({
        topicName: activeTopicObj.topicName,
        subjectName: activeTopicObj.subjectName,
        chapterName: activeTopicObj.chapterName,
        subtopics: activeTopicObj.subtopics,
        weakNotes: activeTopicObj.weakNotes
      });
      if (res && res.prompt) {
        setPromptText(res.prompt);
        if (res.focusAreas && Array.isArray(res.focusAreas)) {
          setFocusAreas(res.focusAreas);
        }
      }
    } catch (err: any) {
      console.warn('Could not generate AI prompt, using standard prompt:', err);
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  // Timer ticker
  useEffect(() => {
    if (isTimerRunning) {
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
        if (!isUntimed) {
          setTimeRemaining(prev => {
            if (prev <= 1) {
              clearInterval(timerIntervalRef.current);
              setIsTimerRunning(false);
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isTimerRunning, isUntimed]);

  // Format MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Select a duration preset
  const handleSelectPreset = (seconds: number) => {
    setIsUntimed(false);
    setTimerDuration(seconds);
    setTimeRemaining(seconds);
    setIsTimerRunning(false);
  };

  // Toggle timer
  const handleToggleTimer = () => {
    setIsTimerRunning(prev => !prev);
  };

  // Reset timer
  const handleResetTimer = () => {
    setIsTimerRunning(false);
    setTimeRemaining(timerDuration);
    setElapsedSeconds(0);
  };

  // Word & character stats
  const wordCount = useMemo(() => {
    return blurtText.trim() ? blurtText.trim().split(/\s+/).filter(Boolean).length : 0;
  }, [blurtText]);

  // Notes relevant to this subject
  const subjectNotesContent = useMemo(() => {
    const matched = notes.filter(n => 
      n.subjectName.toLowerCase() === activeTopicObj.subjectName.toLowerCase() ||
      n.title.toLowerCase().includes(activeTopicObj.topicName.toLowerCase())
    );
    return matched.map(m => `${m.title}: ${m.content}`).join('\n\n');
  }, [notes, activeTopicObj]);

  // Submit Blurt for AI Evaluation
  const handleSubmitBlurt = async () => {
    if (!blurtText.trim() && !attachedImage) {
      setEvaluationError('Please write down your recall or upload/take a photo of your handwritten work/diagram.');
      return;
    }
    if (!attachedImage && wordCount < 6) {
      setEvaluationError('Please write at least a few sentences (6+ words) or upload an image of your work so Gemini can perform an accurate syllabus comparison.');
      return;
    }

    setIsTimerRunning(false);
    setIsEvaluating(true);
    setEvaluationError(null);
    setSavedToActivityBadge(false);
    setRevisionAddedSuccess(false);
    setStatusUpdatedSuccess(null);

    try {
      const result = await apiEvaluateBlurtRecall({
        topicName: activeTopicObj.topicName,
        subjectName: activeTopicObj.subjectName,
        chapterName: activeTopicObj.chapterName,
        subtopics: activeTopicObj.subtopics,
        syllabusNotes: activeTopicObj.weakNotes || '',
        userNotes: subjectNotesContent,
        blurtText: blurtText.trim(),
        imageBase64: attachedImage ? attachedImage.base64 : undefined,
        imageMimeType: attachedImage ? attachedImage.mimeType : undefined,
        promptUsed: promptText,
        durationSeconds: elapsedSeconds || (timerDuration - timeRemaining) || 60
      });

      if (result && result.evaluation) {
        const evalData: BlurtRecallEvaluation = {
          ...result.evaluation,
          imageUrl: attachedImage ? attachedImage.dataUrl : (result.evaluation.imageUrl || undefined),
          extractedText: result.extractedText || result.evaluation.extractedText || undefined,
          diagramNotes: result.diagramNotes || result.evaluation.diagramNotes || undefined
        };
        setCurrentEvaluation(evalData);

        // Store result in activityLogs as performance metric
        const spentMins = Math.max(1, Math.round((evalData.durationSeconds || 60) / 60));
        await onLogActivity({
          date: evalData.date,
          timestamp: evalData.timestamp,
          subjectName: evalData.subjectName,
          chapterName: evalData.chapterName,
          topicName: evalData.topicName,
          action: 'Blurt Recall',
          details: `Blurt Recall on "${evalData.topicName}": ${evalData.recallScore}% recall score ${attachedImage ? '(Photo Work Analyzed)' : ''} — ${evalData.knowledgeGaps.length} gaps identified (${evalData.recalledConcepts.length} concepts recalled)`,
          result: `${evalData.recallScore}% • ${evalData.retentionLevel}`,
          durationMinutes: spentMins,
          scorePercentage: evalData.recallScore,
          blurtRecall: evalData
        });

        setSavedToActivityBadge(true);
      } else {
        throw new Error('Invalid evaluation response format.');
      }
    } catch (err: any) {
      console.error('Error evaluating blurt recall:', err);
      setEvaluationError(err?.message || 'Failed to complete AI comparison. Please try again.');
    } finally {
      setIsEvaluating(false);
    }
  };

  // Add identified gaps to Revision list
  const handleAddGapsToRevision = async () => {
    if (!currentEvaluation || !onSaveRevision) return;

    const gapBulletPoints = currentEvaluation.knowledgeGaps
      .map(g => `• ${g.concept}: ${g.explanation}`)
      .join('\n');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    await onSaveRevision({
      subjectName: currentEvaluation.subjectName,
      chapterName: currentEvaluation.chapterName || 'General',
      topicName: currentEvaluation.topicName,
      lastStudied: new Date().toISOString().split('T')[0],
      dueDate: tomorrowStr,
      priority: currentEvaluation.recallScore < 60 ? 'High' : 'Medium',
      status: 'Pending',
      reason: `Blurt Recall gaps (${currentEvaluation.recallScore}% score):\n${gapBulletPoints}`,
      timeSpentMinutes: Math.round(currentEvaluation.durationSeconds / 60)
    });

    setRevisionAddedSuccess(true);
  };

  // Update Topic Status in Syllabus
  const handleUpdateTopicStatusInSyllabus = async (newStatus: TopicStatus) => {
    if (!currentEvaluation || !onUpdateTopicStatus) return;
    await onUpdateTopicStatus(currentEvaluation.subjectName, currentEvaluation.topicName, newStatus);
    setStatusUpdatedSuccess(newStatus);
  };

  // Save identified gaps and misconceptions directly to Mistake Vault
  const handleSaveGapsToMistakeVault = () => {
    if (!currentEvaluation) return;
    const gaps = currentEvaluation.knowledgeGaps || [];
    const misc = currentEvaluation.misconceptions || [];

    misc.forEach(m => {
      addMistake({
        subjectName: currentEvaluation.subjectName,
        topicName: currentEvaluation.topicName,
        question: `Misconception in ${currentEvaluation.topicName}`,
        userAttempt: m.claimed,
        correctAnswer: m.correction,
        errorCategory: 'concept_gap',
        notes: `Identified during Blurt Recall (${currentEvaluation.recallScore}% score).`,
        source: 'quiz'
      });
    });

    gaps.forEach(g => {
      addMistake({
        subjectName: currentEvaluation.subjectName,
        topicName: currentEvaluation.topicName,
        question: `Knowledge Gap: ${g.concept}`,
        userAttempt: 'Omitted during unassisted blurt recall',
        correctAnswer: g.explanation,
        errorCategory: 'concept_gap',
        notes: `Severity: ${g.severity}. Identified in Blurt Recall Audit.`,
        source: 'quiz'
      });
    });

    setGapsSavedToVaultSuccess(true);
  };

  // Convert gaps into a dedicated Revision Flashcard Deck
  const handleConvertGapsToFlashcards = async () => {
    if (!currentEvaluation || !onSaveFlashcardDeck) return;
    const gaps = currentEvaluation.knowledgeGaps || [];
    const misc = currentEvaluation.misconceptions || [];

    const cards: Flashcard[] = [];

    misc.forEach((m, idx) => {
      cards.push({
        id: `card-misc-${Date.now()}-${idx}`,
        front: `Common Misconception: How should "${m.claimed}" be corrected?`,
        back: m.correction,
        tags: [currentEvaluation.subjectName, 'Misconception']
      });
    });

    gaps.forEach((g, idx) => {
      cards.push({
        id: `card-gap-${Date.now()}-${idx}`,
        front: `Explain the concept: ${g.concept} (${currentEvaluation.topicName})`,
        back: g.explanation,
        tags: [currentEvaluation.subjectName, 'RecallGap']
      });
    });

    if (cards.length === 0) {
      cards.push({
        id: `card-rev-${Date.now()}`,
        front: `Summarize key principles of ${currentEvaluation.topicName}`,
        back: currentEvaluation.summaryFeedback,
        tags: [currentEvaluation.subjectName, 'Summary']
      });
    }

    const newDeck: FlashcardDeck = {
      id: `deck-blurt-${Date.now()}`,
      title: `${currentEvaluation.topicName} (Blurt Recall Gaps)`,
      subjectName: currentEvaluation.subjectName,
      chapterName: currentEvaluation.chapterName,
      topicName: currentEvaluation.topicName,
      description: `Targeted revision cards generated from Blurt Recall knowledge audit (${currentEvaluation.recallScore}% score).`,
      cards,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isWeakTopicDeck: true
    };

    await onSaveFlashcardDeck(newDeck);
    setGapsConvertedToDeckSuccess(true);
  };

  // Reset Arena for a new topic
  const handleResetForNewTopic = () => {
    setCurrentEvaluation(null);
    setBlurtText('');
    setAttachedImage(null);
    setElapsedSeconds(0);
    setTimeRemaining(timerDuration);
    setIsTimerRunning(false);
    setEvaluationError(null);
    setSavedToActivityBadge(false);
    setRevisionAddedSuccess(false);
    setGapsSavedToVaultSuccess(false);
    setGapsConvertedToDeckSuccess(false);
    setStatusUpdatedSuccess(null);
  };

  // Retry same topic
  const handleRetrySameTopic = () => {
    setCurrentEvaluation(null);
    setBlurtText('');
    setAttachedImage(null);
    setElapsedSeconds(0);
    setTimeRemaining(timerDuration);
    setIsTimerRunning(false);
    setEvaluationError(null);
    setGapsSavedToVaultSuccess(false);
    setGapsConvertedToDeckSuccess(false);
  };

  // Filter blurt recall logs from activityLogs
  const blurtLogs = useMemo(() => {
    return activityLogs
      .filter(l => l.action === 'Blurt Recall' && (l.blurtRecall || l.scorePercentage !== undefined))
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [activityLogs]);

  // Calculate average recall score
  const avgRecallScore = useMemo(() => {
    if (blurtLogs.length === 0) return 0;
    const sum = blurtLogs.reduce((acc, log) => acc + (log.scorePercentage || log.blurtRecall?.recallScore || 0), 0);
    return Math.round(sum / blurtLogs.length);
  }, [blurtLogs]);

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Top Header Banner */}
      <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#6B705C]/10 text-[#6B705C] border border-[#6B705C]/20 text-[10px] font-mono font-bold uppercase tracking-widest">
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>Active Study • Retrieval Practice</span>
              </span>
              {blurtLogs.length > 0 && (
                <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#F2EFE9] text-[#6B705C] border border-[#E0DBD0]">
                  Avg Score: {avgRecallScore}% ({blurtLogs.length} blurts)
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-serif italic font-bold text-[#6B705C] tracking-tight flex items-center gap-2.5">
              <span>Blurt Recall Arena</span>
            </h2>

            <p className="text-xs sm:text-sm text-[#A5A58D] max-w-2xl leading-relaxed">
              Empty your mind onto the page without looking at notes. Gemini immediately compares your recall against your syllabus and personal notes, highlighting gaps and saving your performance metric to activity logs.
            </p>
          </div>

          {/* Mode Switcher: Arena vs Vision Notes vs Performance History */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto bg-[#F2EFE9] p-1 rounded-2xl border border-[#E0DBD0]">
            <button
              onClick={() => setViewMode('arena')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'arena'
                  ? 'bg-[#6B705C] text-white shadow-2xs'
                  : 'text-[#6B705C] hover:bg-white/60'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Active Arena</span>
            </button>

            <button
              onClick={() => setViewMode('vision_notes')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'vision_notes'
                  ? 'bg-[#6B705C] text-white shadow-2xs'
                  : 'text-[#6B705C] hover:bg-white/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Notes to Quiz & Flashcards</span>
              {handwrittenStudySet && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 ml-0.5 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setViewMode('history')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'history'
                  ? 'bg-[#6B705C] text-white shadow-2xs'
                  : 'text-[#6B705C] hover:bg-white/60'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Performance Logs ({blurtLogs.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* PERFORMANCE HISTORY VIEW */}
      {viewMode === 'history' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-[#E0DBD0] rounded-3xl p-5 shadow-xs">
              <div className="text-[10px] uppercase font-mono tracking-widest text-[#A5A58D] font-bold">Total Blurts Completed</div>
              <div className="text-3xl font-bold font-serif italic text-[#6B705C] mt-1">{blurtLogs.length}</div>
              <div className="text-xs text-[#A5A58D] mt-1">Active retrieval sessions logged</div>
            </div>

            <div className="bg-white border border-[#E0DBD0] rounded-3xl p-5 shadow-xs">
              <div className="text-[10px] uppercase font-mono tracking-widest text-[#A5A58D] font-bold">Average Recall Accuracy</div>
              <div className="text-3xl font-bold font-mono text-[#6B705C] mt-1">{avgRecallScore}%</div>
              <div className="text-xs text-[#A5A58D] mt-1">Across all evaluated topics</div>
            </div>

            <div className="bg-white border border-[#E0DBD0] rounded-3xl p-5 shadow-xs">
              <div className="text-[10px] uppercase font-mono tracking-widest text-[#A5A58D] font-bold">Storage Destination</div>
              <div className="text-base font-bold text-[#4A4E4D] mt-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>users/{'{uid}'}/activityLogs</span>
              </div>
              <div className="text-xs text-[#A5A58D] mt-1">Synced to cloud & local storage</div>
            </div>
          </div>

          <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E0DBD0] pb-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#6B705C] flex items-center gap-2">
                <ActivityLogIcon className="w-4 h-4 text-[#6B705C]" />
                <span>Blurt Recall Performance History</span>
              </h3>
              <button
                onClick={() => setViewMode('arena')}
                className="px-3 py-1.5 rounded-full bg-[#6B705C] text-white text-xs font-bold hover:bg-[#5a5f4e] transition"
              >
                + Start New Blurt
              </button>
            </div>

            {blurtLogs.length > 0 ? (
              <div className="space-y-3">
                {blurtLogs.map((log) => {
                  const score = log.scorePercentage ?? log.blurtRecall?.recallScore ?? 0;
                  const evalData = log.blurtRecall;
                  const isHigh = score >= 75;
                  const isMid = score >= 50 && score < 75;

                  return (
                    <div 
                      key={log.id} 
                      className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] hover:border-[#6B705C]/40 transition space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-bold text-[#6B705C]">{log.subjectName}</span>
                            {log.chapterName && (
                              <>
                                <span className="text-[#A5A58D]">•</span>
                                <span className="text-[#A5A58D]">{log.chapterName}</span>
                              </>
                            )}
                            <span className="text-[10px] font-mono text-[#A5A58D] ml-2">{log.date}</span>
                          </div>
                          <h4 className="text-base font-bold text-[#4A4E4D] mt-0.5">{log.topicName}</h4>
                        </div>

                        <div className="flex items-center gap-3">
                          {evalData?.imageUrl && (
                            <button
                              onClick={() => setLightboxImageUrl(evalData.imageUrl!)}
                              className="px-2.5 py-1 rounded-full text-xs font-mono font-medium flex items-center gap-1 bg-white border border-[#E0DBD0] text-[#6B705C] hover:bg-[#F2EFE9] transition cursor-pointer"
                              title="View uploaded photo of work"
                            >
                              <Camera className="w-3 h-3 text-[#6B705C]" />
                              <span>Photo</span>
                            </button>
                          )}
                          <div className={`px-3 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 ${
                            isHigh
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : isMid
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-rose-100 text-rose-900 border border-rose-300'
                          }`}>
                            <span>{score}% Score</span>
                            {evalData?.retentionLevel && <span>• {evalData.retentionLevel}</span>}
                          </div>

                          {evalData && (
                            <button
                              onClick={() => {
                                setCurrentEvaluation(evalData);
                                setSelectedSubject(evalData.subjectName);
                                setSelectedChapter(evalData.chapterName || '');
                                setSelectedTopicName(evalData.topicName);
                                setPromptText(evalData.promptUsed || '');
                                setBlurtText(evalData.blurtText || '');
                                setViewMode('arena');
                              }}
                              className="px-3 py-1 rounded-xl bg-white border border-[#E0DBD0] text-xs font-semibold text-[#6B705C] hover:bg-[#F2EFE9] transition"
                            >
                              Review Breakdown
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-[#6B705C] bg-white/70 p-2.5 rounded-xl border border-[#E0DBD0]">
                        {log.details}
                      </p>

                      {evalData && evalData.knowledgeGaps && evalData.knowledgeGaps.length > 0 && (
                        <div className="text-xs space-y-1">
                          <span className="text-[10px] font-mono uppercase font-bold text-amber-800">
                            Knowledge Gaps to Review ({evalData.knowledgeGaps.length}):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {evalData.knowledgeGaps.map((g, gIdx) => (
                              <span 
                                key={gIdx} 
                                className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px]"
                              >
                                {g.concept}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 bg-[#F9F7F2] rounded-2xl border border-dashed border-[#E0DBD0]">
                <Zap className="w-8 h-8 text-[#A5A58D] mx-auto mb-2 opacity-50" />
                <p className="text-sm font-semibold text-[#6B705C]">No Blurt Recall sessions logged yet.</p>
                <p className="text-xs text-[#A5A58D] mt-1">Switch to the Active Arena and complete your first blurt!</p>
                <button
                  onClick={() => setViewMode('arena')}
                  className="mt-4 px-5 py-2.5 rounded-full bg-[#6B705C] text-white text-xs font-bold hover:bg-[#5a5f4e] transition"
                >
                  Start Your First Blurt
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ACTIVE BLURT ARENA */}
      {viewMode === 'arena' && (
        <div className="space-y-6">
          {/* If an evaluation is active, show the Results & Gap Analysis dashboard */}
          {currentEvaluation ? (
            <div className="space-y-6 animate-fade-in">
              {/* Performance Score Card */}
              <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[#E0DBD0]">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#6B705C]">{currentEvaluation.subjectName}</span>
                      {currentEvaluation.chapterName && (
                        <>
                          <span className="text-[#A5A58D]">•</span>
                          <span className="text-xs text-[#A5A58D]">{currentEvaluation.chapterName}</span>
                        </>
                      )}
                    </div>

                    <h3 className="text-2xl sm:text-3xl font-bold text-[#4A4E4D] tracking-tight">
                      {currentEvaluation.topicName}
                    </h3>

                    <p className="text-xs text-[#A5A58D]">
                      Evaluated on {currentEvaluation.date} • {currentEvaluation.wordCount} words blurted in {Math.round(currentEvaluation.durationSeconds / 60)} min(s)
                    </p>
                  </div>

                  {/* Score Dial / Badge */}
                  <div className="flex items-center gap-4 bg-[#F9F7F2] border border-[#E0DBD0] p-4 rounded-2xl shrink-0">
                    <div className="text-center">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-[#A5A58D] font-bold">Recall Score</div>
                      <div className={`text-4xl font-bold font-mono tracking-tight ${
                        currentEvaluation.recallScore >= 75
                          ? 'text-emerald-700'
                          : currentEvaluation.recallScore >= 50
                          ? 'text-amber-700'
                          : 'text-rose-700'
                      }`}>
                        {currentEvaluation.recallScore}%
                      </div>
                    </div>

                    <div className="border-l border-[#E0DBD0] pl-4 space-y-1">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-block ${
                        currentEvaluation.retentionLevel === 'Mastered'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : currentEvaluation.retentionLevel === 'Strong'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : currentEvaluation.retentionLevel === 'Needs Revision'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-rose-100 text-rose-900 border border-rose-300'
                      }`}>
                        {currentEvaluation.retentionLevel}
                      </span>
                      <div className="text-[10px] text-[#A5A58D] font-mono">Retention Tier</div>
                    </div>
                  </div>
                </div>

                {/* Storage Confirmation Badge */}
                {savedToActivityBadge && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-900">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold">
                        Performance metric recorded in <span className="font-mono font-bold">activityLogs</span> and available in your Study Analytics.
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-emerald-700">Firebase Synced</span>
                  </div>
                )}

                {/* Gemini Summary Critique */}
                <div className="bg-[#F9F7F2] p-4 sm:p-5 rounded-2xl border border-[#E0DBD0] space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#6B705C] uppercase tracking-wider font-mono">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>Gemini Cognitive Evaluation</span>
                  </div>
                  <p className="text-sm text-[#4A4E4D] leading-relaxed italic">
                    "{currentEvaluation.summaryFeedback}"
                  </p>
                </div>

                {/* Multimodal Photo & Vision Synthesis Card (if image was submitted) */}
                {(currentEvaluation.imageUrl || currentEvaluation.extractedText || currentEvaluation.diagramNotes) && (
                  <div className="bg-[#FAF8F5] border border-[#E0DBD0] rounded-2xl p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E0DBD0] pb-3">
                      <div className="flex items-center gap-2">
                        <Camera className="w-4 h-4 text-[#6B705C]" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B705C] font-mono">
                          Handwritten Work & Visual Diagram Analysis
                        </h4>
                      </div>
                      {currentEvaluation.imageUrl && (
                        <button
                          onClick={() => setLightboxImageUrl(currentEvaluation.imageUrl!)}
                          className="text-xs text-[#6B705C] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Maximize2 className="w-3 h-3" />
                          <span>View Full Photo</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                      {currentEvaluation.imageUrl && (
                        <div 
                          onClick={() => setLightboxImageUrl(currentEvaluation.imageUrl!)}
                          className="relative rounded-xl overflow-hidden border border-[#E0DBD0] bg-white cursor-pointer group shadow-2xs"
                          title="Click to view full photo"
                        >
                          <img 
                            src={currentEvaluation.imageUrl} 
                            alt="Handwritten work evaluated by AI" 
                            className="w-full max-h-52 object-cover group-hover:scale-102 transition"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-xs font-bold gap-1.5">
                            <Eye className="w-4 h-4" />
                            <span>Click to zoom</span>
                          </div>
                        </div>
                      )}

                      <div className={`${currentEvaluation.imageUrl ? 'md:col-span-2' : 'md:col-span-3'} space-y-3`}>
                        {currentEvaluation.extractedText && (
                          <div className="bg-white p-3.5 rounded-xl border border-[#E0DBD0] space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono uppercase font-bold text-[#6B705C] flex items-center gap-1">
                                <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                                <span>AI Transcribed Handwriting & Formulas:</span>
                              </span>
                              <button 
                                onClick={() => setShowTranscribedText(!showTranscribedText)}
                                className="text-[10px] font-semibold text-[#A5A58D] hover:text-[#4A4E4D] cursor-pointer"
                              >
                                {showTranscribedText ? 'Collapse' : 'Expand'}
                              </button>
                            </div>
                            {showTranscribedText && (
                              <p className="text-xs text-[#4A4E4D] font-mono bg-[#F9F7F2] p-2.5 rounded-lg border border-[#E0DBD0] whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                                {currentEvaluation.extractedText}
                              </p>
                            )}
                          </div>
                        )}

                        {currentEvaluation.diagramNotes && (
                          <div className="bg-white p-3.5 rounded-xl border border-[#E0DBD0] space-y-1">
                            <span className="text-[10px] font-mono uppercase font-bold text-[#6B705C] flex items-center gap-1">
                              <Layers className="w-3.5 h-3.5 text-amber-600" />
                              <span>Diagrammatic & Mind-Map Observations:</span>
                            </span>
                            <p className="text-xs text-[#4A4E4D] leading-relaxed">
                              {currentEvaluation.diagramNotes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Recalled vs Gaps 2-Column Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Successfully Recalled */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-1 border-b border-[#E0DBD0]">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Concepts You Recalled ({currentEvaluation.recalledConcepts.length})</span>
                      </h4>
                      <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Strong Anchors
                      </span>
                    </div>

                    {currentEvaluation.recalledConcepts.length > 0 ? (
                      <div className="space-y-2.5">
                        {currentEvaluation.recalledConcepts.map((item, idx) => (
                          <div 
                            key={idx} 
                            className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 text-xs space-y-1"
                          >
                            <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{item.concept}</span>
                            </div>
                            <p className="text-emerald-800/90 pl-5 text-[11px] leading-relaxed">
                              {item.detail}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#A5A58D] italic py-4">No key concepts were fully recalled.</p>
                    )}
                  </div>

                  {/* Identified Knowledge Gaps */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-1 border-b border-[#E0DBD0]">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-amber-900 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>Identified Syllabus Gaps ({currentEvaluation.knowledgeGaps.length})</span>
                      </h4>
                      <span className="text-[10px] font-mono text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        Need Review
                      </span>
                    </div>

                    {currentEvaluation.knowledgeGaps.length > 0 ? (
                      <div className="space-y-2.5">
                        {currentEvaluation.knowledgeGaps.map((gap, idx) => {
                          const isCritical = gap.severity === 'critical';
                          const isMod = gap.severity === 'moderate';

                          return (
                            <div 
                              key={idx} 
                              className={`p-3.5 rounded-2xl border text-xs space-y-1 ${
                                isCritical
                                  ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                                  : isMod
                                  ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                                  : 'bg-[#F9F7F2] border-[#E0DBD0] text-[#4A4E4D]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-bold flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full ${
                                    isCritical ? 'bg-rose-600' : isMod ? 'bg-amber-600' : 'bg-slate-400'
                                  }`} />
                                  <span>{gap.concept}</span>
                                </div>
                                <span className={`text-[9px] uppercase font-mono font-bold px-1.5 py-0.2 rounded ${
                                  isCritical
                                    ? 'bg-rose-200 text-rose-900'
                                    : isMod
                                    ? 'bg-amber-200 text-amber-900'
                                    : 'bg-slate-200 text-slate-700'
                                }`}>
                                  {gap.severity} gap
                                </span>
                              </div>
                              <p className="pl-3.5 text-[11px] leading-relaxed opacity-90">
                                {gap.explanation}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center text-emerald-800 text-xs">
                        🎉 Incredible! No significant syllabus gaps identified in your recall.
                      </div>
                    )}
                  </div>
                </div>

                {/* Misconceptions & Corrections (if any) */}
                {currentEvaluation.misconceptions && currentEvaluation.misconceptions.length > 0 && (
                  <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-4 sm:p-5 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-rose-900 flex items-center gap-2 font-mono">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>Misconceptions Detected & Corrected ({currentEvaluation.misconceptions.length})</span>
                    </h4>
                    <div className="space-y-2">
                      {currentEvaluation.misconceptions.map((m, idx) => (
                        <div key={idx} className="p-3 bg-white/80 rounded-xl border border-rose-200 text-xs space-y-1">
                          <div className="text-rose-800 font-medium">
                            <span className="font-bold text-rose-900">What you wrote:</span> "{m.claimed}"
                          </div>
                          <div className="text-emerald-800 font-medium pt-1 border-t border-rose-100">
                            <span className="font-bold text-emerald-900">Canonical correction:</span> {m.correction}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actionable Advice */}
                {currentEvaluation.actionableAdvice && currentEvaluation.actionableAdvice.length > 0 && (
                  <div className="bg-[#F2EFE9] border border-[#E0DBD0] rounded-2xl p-4 sm:p-5 space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-[#6B705C] flex items-center gap-1.5 font-mono">
                      <Lightbulb className="w-4 h-4 text-amber-600" />
                      <span>Actionable Next Steps to Close Gaps</span>
                    </h4>
                    <ul className="space-y-1.5 text-xs text-[#4A4E4D]">
                      {currentEvaluation.actionableAdvice.map((tip, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-[#6B705C] font-bold">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Controls & Next Steps */}
                <div className="pt-4 border-t border-[#E0DBD0] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {onSaveRevision && (
                      <button
                        onClick={handleAddGapsToRevision}
                        disabled={revisionAddedSuccess}
                        className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                          revisionAddedSuccess
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-600 hover:bg-amber-700 text-white'
                        }`}
                      >
                        {revisionAddedSuccess ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Added to Revision Queue!</span>
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Queue Gaps for Revision</span>
                          </>
                        )}
                      </button>
                    )}

                    {onUpdateTopicStatus && (
                      <div className="flex items-center gap-1 bg-[#F2EFE9] p-1 rounded-2xl border border-[#E0DBD0]">
                        <span className="text-[10px] font-mono uppercase text-[#A5A58D] font-bold px-2">
                          Update Syllabus:
                        </span>
                        {currentEvaluation.recallScore >= 80 ? (
                          <button
                            onClick={() => handleUpdateTopicStatusInSyllabus('Mastered')}
                            className="px-2.5 py-1 rounded-xl bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition"
                          >
                            Mark Mastered ⭐
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateTopicStatusInSyllabus('Needs Revision')}
                            className="px-2.5 py-1 rounded-xl bg-amber-600 text-white text-[11px] font-bold hover:bg-amber-700 transition"
                          >
                            Mark Needs Revision
                          </button>
                        )}
                        {statusUpdatedSuccess && (
                          <span className="text-[10px] text-emerald-700 font-bold px-1.5">Updated!</span>
                        )}
                      </div>
                    )}

                    {/* Log to Mistake Vault */}
                    <button
                      onClick={handleSaveGapsToMistakeVault}
                      disabled={gapsSavedToVaultSuccess}
                      className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                        gapsSavedToVaultSuccess
                          ? 'bg-purple-100 text-purple-800 border border-purple-300'
                          : 'bg-purple-600 hover:bg-purple-700 text-white'
                      }`}
                    >
                      {gapsSavedToVaultSuccess ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-purple-700" />
                          <span>Logged to Mistake Vault!</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Log Gaps to Mistake Vault</span>
                        </>
                      )}
                    </button>

                    {/* Generate Gap Flashcards */}
                    {onSaveFlashcardDeck && (
                      <button
                        onClick={handleConvertGapsToFlashcards}
                        disabled={gapsConvertedToDeckSuccess}
                        className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                          gapsConvertedToDeckSuccess
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        {gapsConvertedToDeckSuccess ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Gap Flashcards Saved!</span>
                          </>
                        ) : (
                          <>
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Generate Gap Flashcards</span>
                          </>
                        )}
                      </button>
                    )}

                    {onStartTimerForTopic && (
                      <button
                        onClick={() => onStartTimerForTopic(currentEvaluation.subjectName, currentEvaluation.chapterName || '', currentEvaluation.topicName)}
                        className="px-3.5 py-2.5 rounded-2xl bg-white border border-[#E0DBD0] text-[#6B705C] hover:bg-[#F2EFE9] text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Start Timer for Topic</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRetrySameTopic}
                      className="px-4 py-2.5 rounded-2xl bg-white border border-[#E0DBD0] text-[#4A4E4D] hover:bg-[#F2EFE9] text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retry Topic</span>
                    </button>

                    <button
                      onClick={handleResetForNewTopic}
                      className="px-5 py-2.5 rounded-2xl bg-[#6B705C] text-white hover:bg-[#5a5f4e] text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <span>Choose Another Topic</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* TOPIC SELECTION & BLURT WORKBENCH */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Topic Selector & Syllabus Links */}
              <div className="space-y-4">
                <div className="bg-white border border-[#E0DBD0] rounded-3xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-[#E0DBD0] pb-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#6B705C] flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-[#6B705C]" />
                      <span>1. Select Retrieval Topic</span>
                    </h3>
                    <button
                      onClick={() => setIsCustomTopicMode(!isCustomTopicMode)}
                      className="text-xs text-[#6B705C] hover:underline font-semibold"
                    >
                      {isCustomTopicMode ? 'From Syllabus' : 'Custom Topic'}
                    </button>
                  </div>

                  {isCustomTopicMode ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-mono font-bold uppercase text-[#A5A58D]">Subject Name</label>
                        <input
                          type="text"
                          value={selectedSubject}
                          onChange={(e) => setSelectedSubject(e.target.value)}
                          placeholder="e.g. Biology, History, Computer Science"
                          className="w-full mt-1 p-2.5 text-xs rounded-xl border border-[#E0DBD0] bg-[#F9F7F2] focus:outline-[#6B705C]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono font-bold uppercase text-[#A5A58D]">Topic Title</label>
                        <input
                          type="text"
                          value={customTopicInput}
                          onChange={(e) => setCustomTopicInput(e.target.value)}
                          placeholder="e.g. Krebs Cycle, French Revolution, Binary Search Trees"
                          className="w-full mt-1 p-2.5 text-xs rounded-xl border border-[#E0DBD0] bg-[#F9F7F2] focus:outline-[#6B705C]"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Filter modes */}
                      <div className="flex items-center gap-1 bg-[#F2EFE9] p-1 rounded-xl border border-[#E0DBD0] text-[11px] font-semibold">
                        <button
                          onClick={() => setTopicFilterMode('recommended')}
                          className={`flex-1 py-1 px-1.5 rounded-lg transition text-center ${
                            topicFilterMode === 'recommended'
                              ? 'bg-[#6B705C] text-white shadow-2xs'
                              : 'text-[#6B705C] hover:bg-white/60'
                          }`}
                        >
                          Weak ({recommendedTopics.length})
                        </button>
                        <button
                          onClick={() => setTopicFilterMode('today')}
                          className={`flex-1 py-1 px-1.5 rounded-lg transition text-center ${
                            topicFilterMode === 'today'
                              ? 'bg-[#6B705C] text-white shadow-2xs'
                              : 'text-[#6B705C] hover:bg-white/60'
                          }`}
                        >
                          Today's Plan
                        </button>
                        <button
                          onClick={() => setTopicFilterMode('all')}
                          className={`flex-1 py-1 px-1.5 rounded-lg transition text-center ${
                            topicFilterMode === 'all'
                              ? 'bg-[#6B705C] text-white shadow-2xs'
                              : 'text-[#6B705C] hover:bg-white/60'
                          }`}
                        >
                          All ({allSyllabusTopics.length})
                        </button>
                      </div>

                      {/* Search Bar */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-[#A5A58D] absolute left-3 top-3" />
                        <input
                          type="text"
                          value={topicSearchQuery}
                          onChange={(e) => setTopicSearchQuery(e.target.value)}
                          placeholder="Filter topics by name..."
                          className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-[#E0DBD0] bg-[#F9F7F2] focus:outline-[#6B705C]"
                        />
                      </div>

                      {/* Topic Scroll List */}
                      <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                        {filteredTopics.map((t, idx) => {
                          const isSelected = selectedTopicName === t.topicName && selectedSubject === t.subjectName;

                          return (
                            <button
                              key={`${t.subjectName}-${t.topicName}-${idx}`}
                              onClick={() => {
                                setSelectedSubject(t.subjectName);
                                setSelectedChapter(t.chapterName);
                                setSelectedTopicName(t.topicName);
                                setIsCustomTopicMode(false);
                              }}
                              className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between gap-2 text-xs cursor-pointer ${
                                isSelected
                                  ? 'bg-[#6B705C] text-white border-[#6B705C] shadow-2xs'
                                  : 'bg-[#F9F7F2] border-[#E0DBD0] hover:border-[#6B705C]/40 text-[#4A4E4D]'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className={`font-semibold truncate ${isSelected ? 'text-white' : 'text-[#4A4E4D]'}`}>
                                  {t.topicName}
                                </div>
                                <div className={`text-[10px] truncate ${isSelected ? 'text-slate-200' : 'text-[#A5A58D]'}`}>
                                  {t.subjectName} • {t.chapterName}
                                </div>
                              </div>

                              <div className="shrink-0 flex items-center gap-1">
                                {t.isWeak && (
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                    isSelected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-900'
                                  }`}>
                                    Weak
                                  </span>
                                )}
                                {t.isInTodayPlan && (
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                    isSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-900'
                                  }`}>
                                    Today
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}

                        {filteredTopics.length === 0 && (
                          <div className="text-center py-6 text-xs text-[#A5A58D] italic">
                            No topics matching query.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Cognitive Psychology Info Card */}
                <div className="bg-[#F2EFE9] border border-[#E0DBD0] rounded-3xl p-5 shadow-xs space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-bold text-[#6B705C]">
                    <Brain className="w-4 h-4 text-[#6B705C]" />
                    <span>The "Blurt Method" Science</span>
                  </div>
                  <p className="text-[#4A4E4D] leading-relaxed text-[11px]">
                    Free retrieval forces your brain to reconstruct memory traces rather than recognizing familiar text. Comparing your blurt directly against syllabus benchmarks pinpoints your exact retrieval gaps so you can study with surgical precision.
                  </p>
                </div>
              </div>

              {/* Right 2 Columns: Prompt & Blurt Text Area */}
              <div className="lg:col-span-2 space-y-4">
                {/* Active Prompt Box */}
                <div className="bg-white border border-[#E0DBD0] rounded-3xl p-5 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E0DBD0] pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-white bg-[#6B705C] px-2 py-0.5 rounded">
                        PROMPT
                      </span>
                      <h3 className="text-sm font-bold text-[#4A4E4D] truncate">
                        {activeTopicObj.topicName || 'Select a topic'}
                      </h3>
                    </div>

                    <button
                      onClick={handleGenerateAiPrompt}
                      disabled={isGeneratingPrompt || !activeTopicObj.topicName}
                      className="px-3 py-1.5 rounded-full bg-[#F2EFE9] hover:bg-[#EAE7DF] text-[#6B705C] border border-[#E0DBD0] text-xs font-semibold transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer disabled:opacity-50"
                      title="Generate a targeted challenge prompt using Gemini"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>{isGeneratingPrompt ? 'Formulating...' : 'Targeted AI Prompt'}</span>
                    </button>
                  </div>

                  <p className="text-xs sm:text-sm text-[#4A4E4D] font-medium leading-relaxed bg-[#F9F7F2] p-3.5 rounded-2xl border border-[#E0DBD0]">
                    {promptText || 'Select a topic on the left to display your active retrieval prompt.'}
                  </p>

                  {/* Focus Area Mental Anchors */}
                  {focusAreas.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#A5A58D] font-bold">
                        <span>Mental Checkpoint Anchors (Try to recall these):</span>
                        <button
                          onClick={() => setShowPromptHints(!showPromptHints)}
                          className="text-[#6B705C] hover:underline"
                        >
                          {showPromptHints ? 'Hide' : 'Show Details'}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {focusAreas.map((area, aIdx) => (
                          <span
                            key={aIdx}
                            className="px-2.5 py-1 rounded-lg bg-[#F2EFE9] border border-[#E0DBD0] text-[#6B705C] text-[11px] font-medium"
                          >
                            {area}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Blurt Writing Arena */}
                <div className="bg-white border border-[#E0DBD0] rounded-3xl p-5 shadow-xs space-y-4">
                  {/* Timer & Controls Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E0DBD0] pb-3">
                    {/* Speed-Run Presets */}
                    <div className="flex flex-wrap items-center gap-1 text-xs">
                      <span className="text-[10px] font-mono text-[#A5A58D] uppercase font-bold mr-1">Sprint:</span>
                      {[
                        { secs: 60, label: '1m Blitz' },
                        { secs: 180, label: '3m Quick' },
                        { secs: 300, label: '5m Deep' },
                        { secs: 600, label: '10m Exam' }
                      ].map((preset) => (
                        <button
                          key={preset.secs}
                          onClick={() => handleSelectPreset(preset.secs)}
                          className={`px-2 py-1 rounded-lg font-mono text-xs transition cursor-pointer ${
                            !isUntimed && timerDuration === preset.secs
                              ? 'bg-[#6B705C] text-white font-bold'
                              : 'bg-[#F2EFE9] text-[#6B705C] hover:bg-[#E0DBD0]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          setIsUntimed(true);
                          setIsTimerRunning(false);
                        }}
                        className={`px-2 py-1 rounded-lg text-xs transition cursor-pointer ${
                          isUntimed
                            ? 'bg-[#6B705C] text-white font-bold'
                            : 'bg-[#F2EFE9] text-[#6B705C] hover:bg-[#E0DBD0]'
                        }`}
                      >
                        Freeflow
                      </button>
                    </div>

                    {/* Active Timer Display & Toggles */}
                    <div className="flex items-center gap-3 self-start sm:self-auto">
                      <div className="flex items-center gap-2 bg-[#F9F7F2] border border-[#E0DBD0] px-3 py-1.5 rounded-xl font-mono">
                        <Clock className="w-3.5 h-3.5 text-[#6B705C]" />
                        <span className={`text-sm font-bold ${
                          !isUntimed && timeRemaining < 60 ? 'text-rose-600 animate-pulse' : 'text-[#4A4E4D]'
                        }`}>
                          {isUntimed ? formatTime(elapsedSeconds) : formatTime(timeRemaining)}
                        </span>
                      </div>

                      <button
                        onClick={handleToggleTimer}
                        className="p-2 rounded-xl bg-[#6B705C] text-white hover:bg-[#5a5f4e] transition shadow-2xs cursor-pointer"
                        title={isTimerRunning ? 'Pause Timer' : 'Start Timer'}
                      >
                        {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-white" />}
                      </button>

                      <button
                        onClick={handleResetTimer}
                        className="p-2 rounded-xl bg-[#F2EFE9] text-[#6B705C] hover:bg-[#E0DBD0] transition"
                        title="Reset Timer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Hidden File & Camera Inputs */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleProcessImageFile(e.target.files[0]);
                      }
                    }}
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleProcessImageFile(e.target.files[0]);
                      }
                    }}
                  />

                  {/* Photo of Handwritten Work Upload / Camera Area */}
                  {!attachedImage ? (
                    <div 
                      onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                      onDragLeave={() => setIsDraggingOver(false)}
                      onDrop={handleDropImage}
                      className={`p-4 rounded-2xl border transition-all ${
                        isDraggingOver 
                          ? 'border-[#6B705C] bg-[#6B705C]/5 shadow-xs' 
                          : 'border-dashed border-[#E0DBD0] bg-[#FAF8F5] hover:bg-[#F2EFE9]/60'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white border border-[#E0DBD0] flex items-center justify-center shrink-0 text-[#6B705C] shadow-2xs">
                            {isProcessingImage ? (
                              <Sparkles className="w-5 h-5 animate-spin text-amber-600" />
                            ) : (
                              <Camera className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xs font-bold text-[#4A4E4D]">
                                Take a Photo or Upload Handwritten Work
                              </h4>
                              <span className="text-[10px] font-mono font-bold text-[#6B705C] bg-white px-2 py-0.5 rounded-full border border-[#E0DBD0]">
                                Gemini OCR & Vision
                              </span>
                            </div>
                            <p className="text-[11px] text-[#A5A58D] mt-0.5">
                              Snap paper notes, diagrams, whiteboards, or press <kbd className="px-1 py-0.5 rounded bg-white border border-[#E0DBD0] font-mono text-[10px] text-[#6B705C]">Ctrl+V</kbd> to paste.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                          <button
                            type="button"
                            onClick={() => cameraInputRef.current?.click()}
                            disabled={isProcessingImage}
                            className="px-3.5 py-2 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                            title="Snap a photo of your paper notes using camera"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Take Photo</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isProcessingImage}
                            className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#F9F7F2] text-[#6B705C] border border-[#E0DBD0] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            title="Upload image from computer or mobile storage"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Upload Image</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Attached Image Preview Card */
                    <div className="p-3.5 rounded-2xl bg-white border border-emerald-200 bg-emerald-50/20 shadow-2xs space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Thumbnail */}
                          <div 
                            onClick={() => setLightboxImageUrl(attachedImage.dataUrl)}
                            className="relative w-16 h-16 rounded-xl overflow-hidden border border-[#E0DBD0] bg-black/5 cursor-pointer group shrink-0"
                            title="Click to zoom photo"
                          >
                            <img 
                              src={attachedImage.dataUrl} 
                              alt="Uploaded handwritten work" 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                              <Eye className="w-4 h-4" />
                            </div>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-mono uppercase font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                <span>Photo Attached for AI Analysis</span>
                              </span>
                              <span className="text-[10px] font-mono text-[#A5A58D]">
                                {Math.round(attachedImage.sizeBytes / 1024)} KB
                              </span>
                            </div>
                            <h5 className="text-xs font-bold text-[#4A4E4D] truncate mt-1">
                              {attachedImage.fileName}
                            </h5>
                            <p className="text-[11px] text-[#6B705C] mt-0.5">
                              Gemini will transcribe your handwritten notes and inspect any diagrams during evaluation.
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => {
                              setViewMode('vision_notes');
                              if (!handwrittenStudySet) {
                                handleConvertHandwrittenNotes(attachedImage);
                              }
                            }}
                            className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 border border-amber-300 text-xs font-bold text-amber-900 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            title="Turn this photo into an active recall quiz and flashcard deck"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                            <span>Convert to Quiz & Flashcards</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setLightboxImageUrl(attachedImage.dataUrl)}
                            className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#F2EFE9] border border-[#E0DBD0] text-xs font-semibold text-[#6B705C] transition flex items-center gap-1 cursor-pointer"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                            <span>Preview</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#F2EFE9] border border-[#E0DBD0] text-xs font-semibold text-[#6B705C] transition flex items-center gap-1 cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Replace</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer"
                            title="Remove attached photo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Main Textarea */}
                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      value={blurtText}
                      onChange={(e) => {
                        setBlurtText(e.target.value);
                        if (!isTimerRunning && e.target.value.length === 1 && !isUntimed && timeRemaining > 0) {
                          setIsTimerRunning(true);
                        }
                      }}
                      placeholder={attachedImage 
                        ? "Additional typed recall notes, formulas, or clarifications (optional since photo of work is attached)..."
                        : "Start blurting here! Type out everything you can remember without peeking: formulas, definitions, key steps, mechanisms, rules, examples... Or take/upload a photo of your paper notes above."
                      }
                      rows={attachedImage ? 8 : 12}
                      className="w-full p-4 text-sm text-[#4A4E4D] bg-[#FAF8F5] border border-[#E0DBD0] rounded-2xl focus:outline-none focus:border-[#6B705C] focus:bg-white transition-all leading-relaxed resize-y font-sans"
                    />
                  </div>

                  {/* Metrics Bar & Evaluation Button */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-3 text-xs text-[#A5A58D] font-mono flex-wrap">
                      <span>{wordCount} words</span>
                      <span>•</span>
                      <span>{blurtText.length} chars</span>
                      <span>•</span>
                      <span>{Math.round(elapsedSeconds / 60)} min spent</span>
                      {attachedImage && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-700 font-bold flex items-center gap-1">
                            <Camera className="w-3 h-3" /> Photo Attached
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {blurtText.trim().length > 0 && (
                        <button
                          onClick={() => setBlurtText('')}
                          className="px-3 py-2 rounded-xl text-xs text-[#A5A58D] hover:text-[#4A4E4D] hover:bg-[#F2EFE9] transition cursor-pointer"
                        >
                          Clear Text
                        </button>
                      )}

                      <button
                        onClick={handleSubmitBlurt}
                        disabled={isEvaluating || (!attachedImage && wordCount < 5 && blurtText.trim().length === 0)}
                        className="px-6 py-3 rounded-2xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isEvaluating ? (
                          <>
                            <Sparkles className="w-4 h-4 animate-spin text-amber-300" />
                            <span>{attachedImage ? 'Gemini is analyzing handwriting & syllabus...' : 'Gemini is comparing against syllabus...'}</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4 fill-white" />
                            <span>
                              {attachedImage && blurtText.trim() 
                                ? 'Submit Photo & Text for AI Evaluation' 
                                : attachedImage 
                                ? 'Submit Photo of Work for AI Evaluation' 
                                : 'Submit Blurt for AI Evaluation'}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {evaluationError && (
                    <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{evaluationError}</span>
                      </div>
                      <button onClick={() => setEvaluationError(null)} className="text-current font-bold cursor-pointer">✕</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VISION NOTES TO RECALL QUIZ & FLASHCARDS STUDIO */}
      {viewMode === 'vision_notes' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header Banner */}
          <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-900 border border-amber-500/20 text-[10px] font-mono font-bold uppercase tracking-widest">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Multimodal Vision AI • Handwritten Notes Converter</span>
                  </span>
                  {handwrittenStudySet && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Study Set Active
                    </span>
                  )}
                </div>

                <h3 className="text-2xl font-serif italic font-bold text-[#4A4E4D] tracking-tight">
                  Handwritten Notes to Active Recall Studio
                </h3>

                <p className="text-xs sm:text-sm text-[#A5A58D] max-w-2xl leading-relaxed">
                  Snap a photo of your notebook pages, formula sheets, or hand-drawn diagrams. Gemini Vision AI transcribes your handwritten notes and structures them into an interactive recall quiz and spaced repetition flashcard deck.
                </p>
              </div>

              {handwrittenStudySet && (
                <div className="flex items-center gap-2 self-start md:self-auto">
                  <button
                    onClick={() => {
                      setHandwrittenStudySet(null);
                      setAttachedImage(null);
                    }}
                    className="px-3.5 py-2 rounded-2xl bg-white border border-[#E0DBD0] text-[#6B705C] hover:bg-[#F2EFE9] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Convert Another Page</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* IF NO STUDY SET YET: SHOW UPLOAD & CONFIG WORKBENCH */}
          {!handwrittenStudySet ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Context & Options */}
              <div className="space-y-4">
                <div className="bg-white border border-[#E0DBD0] rounded-3xl p-5 shadow-xs space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-[#6B705C] flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-[#6B705C]" />
                    <span>1. Topic Context (Optional)</span>
                  </h4>

                  <p className="text-xs text-[#A5A58D]">
                    Link this photo to a syllabus topic or let Gemini automatically detect the subject and concept from your notes.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-mono font-bold uppercase text-[#A5A58D]">Subject</label>
                      <select
                        value={selectedSubject}
                        onChange={(e) => {
                          setSelectedSubject(e.target.value);
                          setSelectedChapter('');
                          setSelectedTopicName('');
                        }}
                        className="w-full mt-1 p-2.5 bg-[#FAF8F5] border border-[#E0DBD0] rounded-xl text-xs text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
                      >
                        <option value="">Auto-Detect from Notes</option>
                        {subjects.map(s => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    {selectedSubject && (
                      <div>
                        <label className="text-[10px] font-mono font-bold uppercase text-[#A5A58D]">Topic Name</label>
                        <input
                          type="text"
                          value={selectedTopicName}
                          onChange={(e) => setSelectedTopicName(e.target.value)}
                          placeholder="e.g. Krebs Cycle, Maxwell's Equations"
                          className="w-full mt-1 p-2.5 bg-[#FAF8F5] border border-[#E0DBD0] rounded-xl text-xs text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-[#E0DBD0] rounded-3xl p-5 shadow-xs space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-[#6B705C] flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#6B705C]" />
                    <span>2. Generation Target</span>
                  </h4>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setStudySetTargetMode('both')}
                      className={`w-full p-3 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                        studySetTargetMode === 'both'
                          ? 'border-[#6B705C] bg-[#6B705C]/5 shadow-2xs'
                          : 'border-[#E0DBD0] bg-white hover:bg-[#FAF8F5]'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-[#4A4E4D] flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                          <span>Complete Recall Pack</span>
                        </div>
                        <div className="text-[11px] text-[#A5A58D] mt-0.5">Quiz + Flashcards + Transcribed formulas</div>
                      </div>
                      {studySetTargetMode === 'both' && <Check className="w-4 h-4 text-[#6B705C]" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setStudySetTargetMode('quiz')}
                      className={`w-full p-3 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                        studySetTargetMode === 'quiz'
                          ? 'border-[#6B705C] bg-[#6B705C]/5 shadow-2xs'
                          : 'border-[#E0DBD0] bg-white hover:bg-[#FAF8F5]'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-[#4A4E4D] flex items-center gap-1.5">
                          <FileQuestion className="w-3.5 h-3.5 text-[#6B705C]" />
                          <span>Recall-Based Quiz Only</span>
                        </div>
                        <div className="text-[11px] text-[#A5A58D] mt-0.5">Multiple choice active-recall retrieval test</div>
                      </div>
                      {studySetTargetMode === 'quiz' && <Check className="w-4 h-4 text-[#6B705C]" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setStudySetTargetMode('flashcards')}
                      className={`w-full p-3 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                        studySetTargetMode === 'flashcards'
                          ? 'border-[#6B705C] bg-[#6B705C]/5 shadow-2xs'
                          : 'border-[#E0DBD0] bg-white hover:bg-[#FAF8F5]'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-[#4A4E4D] flex items-center gap-1.5">
                          <BookMarked className="w-3.5 h-3.5 text-[#6B705C]" />
                          <span>Flashcard Deck Only</span>
                        </div>
                        <div className="text-[11px] text-[#A5A58D] mt-0.5">Atomic spaced cards with memory mnemonics</div>
                      </div>
                      {studySetTargetMode === 'flashcards' && <Check className="w-4 h-4 text-[#6B705C]" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Center & Right Column: Camera & Upload Dropzone */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-5">
                  <div className="flex items-center justify-between border-b border-[#E0DBD0] pb-3">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-[#6B705C] flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-[#6B705C]" />
                      <span>3. Capture or Upload Handwritten Notes</span>
                    </h4>
                    {attachedImage && (
                      <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                        Photo Loaded
                      </span>
                    )}
                  </div>

                  {/* Hidden inputs for camera and file */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/png,image/jpeg,image/webp,image/jpg"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleProcessImageFile(e.target.files[0]);
                      }
                    }}
                  />
                  <input
                    type="file"
                    ref={cameraInputRef}
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleProcessImageFile(e.target.files[0]);
                      }
                    }}
                  />

                  {/* Upload Container */}
                  {!attachedImage ? (
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                      onDragLeave={() => setIsDraggingOver(false)}
                      onDrop={handleDropImage}
                      className={`p-8 sm:p-10 rounded-3xl border-2 border-dashed transition-all text-center space-y-4 ${
                        isDraggingOver 
                          ? 'border-[#6B705C] bg-[#6B705C]/5' 
                          : 'border-[#E0DBD0] bg-[#FAF8F5] hover:bg-[#F2EFE9]/50'
                      }`}
                    >
                      <div className="w-16 h-16 rounded-2xl bg-white border border-[#E0DBD0] flex items-center justify-center mx-auto text-[#6B705C] shadow-2xs">
                        {isProcessingImage ? (
                          <Sparkles className="w-8 h-8 animate-spin text-amber-600" />
                        ) : (
                          <Camera className="w-8 h-8" />
                        )}
                      </div>

                      <div className="space-y-1">
                        <h5 className="text-sm font-bold text-[#4A4E4D]">
                          Snap a photo or drop your handwritten notes here
                        </h5>
                        <p className="text-xs text-[#A5A58D] max-w-md mx-auto">
                          Take a photo of physical notebook pages, textbook problem sketches, or blackboard notes. You can also paste an image with <kbd className="px-1.5 py-0.5 bg-white rounded border border-[#E0DBD0] font-mono text-[10px] text-[#6B705C]">Ctrl+V</kbd>.
                        </p>
                      </div>

                      {/* Primary Trigger Buttons */}
                      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          disabled={isProcessingImage}
                          className="px-5 py-3 rounded-2xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          <Camera className="w-4 h-4" />
                          <span>Snap with Camera</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isProcessingImage}
                          className="px-5 py-3 rounded-2xl bg-white hover:bg-[#FAF8F5] text-[#4A4E4D] border border-[#E0DBD0] text-xs font-bold transition flex items-center gap-2 shadow-2xs cursor-pointer disabled:opacity-50"
                        >
                          <Upload className="w-4 h-4 text-[#6B705C]" />
                          <span>Choose Image File</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Attached Image Card */
                    <div className="p-4 sm:p-5 rounded-3xl bg-[#FAF8F5] border border-emerald-300 bg-emerald-50/15 space-y-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div 
                            onClick={() => setLightboxImageUrl(attachedImage.dataUrl)}
                            className="relative w-20 h-20 rounded-2xl overflow-hidden border border-[#E0DBD0] bg-black/5 cursor-pointer group shrink-0"
                            title="Click to preview full image"
                          >
                            <img 
                              src={attachedImage.dataUrl} 
                              alt="Handwritten notes preview" 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                              <Eye className="w-5 h-5" />
                            </div>
                          </div>

                          <div className="min-w-0">
                            <span className="text-[10px] font-mono uppercase font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                              <span>Ready for Vision Analysis</span>
                            </span>
                            <h5 className="text-sm font-bold text-[#4A4E4D] truncate mt-1">
                              {attachedImage.fileName}
                            </h5>
                            <p className="text-xs text-[#A5A58D] mt-0.5">
                              {Math.round(attachedImage.sizeBytes / 1024)} KB • Image successfully compressed
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => setLightboxImageUrl(attachedImage.dataUrl)}
                            className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#FAF8F5] border border-[#E0DBD0] text-xs font-semibold text-[#6B705C] transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                            <span>Preview</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#FAF8F5] border border-[#E0DBD0] text-xs font-semibold text-[#6B705C] transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Replace</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer"
                            title="Remove photo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Primary Action Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={!attachedImage || isConvertingNotes}
                      onClick={() => handleConvertHandwrittenNotes()}
                      className={`w-full py-3.5 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer ${
                        !attachedImage
                          ? 'bg-[#E0DBD0] text-[#A5A58D] cursor-not-allowed'
                          : isConvertingNotes
                          ? 'bg-[#6B705C] text-white opacity-80 cursor-wait'
                          : 'bg-[#6B705C] hover:bg-[#5a5f4e] text-white'
                      }`}
                    >
                      {isConvertingNotes ? (
                        <>
                          <Sparkles className="w-4 h-4 animate-spin text-amber-400" />
                          <span>Analyzing Handwritten Notes with Gemini Vision AI...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-amber-400" />
                          <span>Convert Handwritten Notes with Vision AI</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>

                  {convertError && (
                    <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{convertError}</span>
                      </div>
                      <button onClick={() => setConvertError(null)} className="text-current font-bold cursor-pointer">✕</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* IF STUDY SET IS GENERATED: SHOW INTERACTIVE RETRIEVAL WORKSPACE */
            <div className="space-y-6">
              {/* Study Set Overview Card */}
              <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-5">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-5 border-b border-[#E0DBD0]">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#6B705C]/10 text-[#6B705C] font-mono text-[10px] font-bold uppercase">
                        {handwrittenStudySet.subjectName}
                      </span>
                      {handwrittenStudySet.chapterName && (
                        <span className="text-xs text-[#A5A58D]">
                          • {handwrittenStudySet.chapterName}
                        </span>
                      )}
                      <span className="text-xs text-[#A5A58D]">
                        • Generated {handwrittenStudySet.generatedAt}
                      </span>
                    </div>

                    <h3 className="text-2xl font-bold text-[#4A4E4D]">
                      {handwrittenStudySet.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-[#6B705C] leading-relaxed max-w-3xl">
                      {handwrittenStudySet.summary}
                    </p>

                    {/* Key Concepts Chips */}
                    {handwrittenStudySet.keyConcepts && handwrittenStudySet.keyConcepts.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="text-[10px] font-mono font-bold uppercase text-[#A5A58D] mr-1">
                          Key Concepts:
                        </span>
                        {handwrittenStudySet.keyConcepts.map((kc, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-0.5 rounded-lg bg-[#FAF8F5] text-[#4A4E4D] border border-[#E0DBD0] text-[11px] font-medium"
                          >
                            {kc}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 self-start">
                    {onSaveFlashcardDeck && handwrittenStudySet.flashcards && handwrittenStudySet.flashcards.length > 0 && (
                      <button
                        onClick={handleSaveDeck}
                        disabled={isDeckSaved}
                        className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                          isDeckSaved
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default'
                            : 'bg-[#6B705C] hover:bg-[#5a5f4e] text-white'
                        }`}
                      >
                        {isDeckSaved ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Deck Saved to Flashcards!</span>
                          </>
                        ) : (
                          <>
                            <FolderPlus className="w-3.5 h-3.5" />
                            <span>Save Deck to My Flashcards</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      onClick={handleStartBlurtFromStudySet}
                      className="px-3.5 py-2 rounded-2xl bg-white border border-[#E0DBD0] text-[#4A4E4D] hover:bg-[#FAF8F5] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Launch active retrieval blurt arena for this topic"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span>Start Blurt Arena</span>
                    </button>

                    <button
                      onClick={handleCopyTranscription}
                      className="px-3 py-2 rounded-2xl bg-white border border-[#E0DBD0] text-[#6B705C] hover:bg-[#FAF8F5] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      title="Copy notes summary and transcription"
                    >
                      {copiedTranscription ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Notes</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Subtab Navigation */}
                <div className="flex items-center gap-2 border-b border-[#E0DBD0] pb-2 overflow-x-auto">
                  {handwrittenStudySet.quiz && handwrittenStudySet.quiz.length > 0 && (
                    <button
                      onClick={() => setActiveStudySetTab('quiz')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        activeStudySetTab === 'quiz'
                          ? 'bg-[#6B705C] text-white shadow-2xs'
                          : 'text-[#6B705C] hover:bg-[#FAF8F5]'
                      }`}
                    >
                      <FileQuestion className="w-3.5 h-3.5" />
                      <span>Recall-Based Quiz ({handwrittenStudySet.quiz.length})</span>
                      {quizCompleted && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/20 ml-1">
                          Done
                        </span>
                      )}
                    </button>
                  )}

                  {handwrittenStudySet.flashcards && handwrittenStudySet.flashcards.length > 0 && (
                    <button
                      onClick={() => setActiveStudySetTab('flashcards')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        activeStudySetTab === 'flashcards'
                          ? 'bg-[#6B705C] text-white shadow-2xs'
                          : 'text-[#6B705C] hover:bg-[#FAF8F5]'
                      }`}
                    >
                      <BookMarked className="w-3.5 h-3.5" />
                      <span>Flashcard Deck ({handwrittenStudySet.flashcards.length})</span>
                      {isDeckSaved && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/20 ml-1">
                          Saved
                        </span>
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => setActiveStudySetTab('transcription')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      activeStudySetTab === 'transcription'
                        ? 'bg-[#6B705C] text-white shadow-2xs'
                        : 'text-[#6B705C] hover:bg-[#FAF8F5]'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Transcribed Notes & Formulas</span>
                  </button>
                </div>

                {/* TAB 1: RECALL-BASED QUIZ */}
                {activeStudySetTab === 'quiz' && handwrittenStudySet.quiz && (
                  <div className="space-y-6 pt-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-[#4A4E4D]">
                          Active Recall Retrieval Quiz
                        </h4>
                        <p className="text-xs text-[#A5A58D]">
                          Answer without peeking at the original notes to trigger synaptic strengthening.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleRetakeQuiz}
                          className="px-3 py-1.5 rounded-xl bg-white border border-[#E0DBD0] text-[#4A4E4D] hover:bg-[#FAF8F5] text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset Answers</span>
                        </button>
                      </div>
                    </div>

                    {/* Quiz Questions List */}
                    <div className="space-y-5">
                      {handwrittenStudySet.quiz.map((q, qIdx) => {
                        const selected = selectedAnswers[q.id];
                        const isAnswered = Boolean(selected);
                        const isCorrect = selected === q.correctAnswer;
                        const hintShown = revealedHints[q.id];

                        return (
                          <div
                            key={q.id || qIdx}
                            className={`p-5 rounded-3xl border transition-all space-y-4 ${
                              isAnswered
                                ? isCorrect
                                  ? 'bg-emerald-50/20 border-emerald-300'
                                  : 'bg-rose-50/20 border-rose-300'
                                : 'bg-[#FAF8F5] border-[#E0DBD0]'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] font-mono uppercase font-bold text-[#6B705C] bg-white px-2 py-0.5 rounded-full border border-[#E0DBD0]">
                                    Question {qIdx + 1} of {handwrittenStudySet.quiz.length}
                                  </span>
                                  {q.conceptTested && (
                                    <span className="text-[10px] font-mono text-[#A5A58D]">
                                      • Concept: {q.conceptTested}
                                    </span>
                                  )}
                                </div>
                                <h5 className="text-sm sm:text-base font-bold text-[#4A4E4D] leading-snug">
                                  {q.question}
                                </h5>
                              </div>

                              {q.hint && !isAnswered && (
                                <button
                                  type="button"
                                  onClick={() => setRevealedHints(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                                  className="text-[11px] font-semibold text-[#6B705C] hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
                                >
                                  <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                                  <span>{hintShown ? 'Hide Hint' : 'Hint'}</span>
                                </button>
                              )}
                            </div>

                            {/* Hint Callout */}
                            {hintShown && !isAnswered && (
                              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                                <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <span><strong>Hint:</strong> {q.hint}</span>
                              </div>
                            )}

                            {/* 4 Options */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {q.options.map((opt, optIdx) => {
                                const isThisSelected = selected === opt;
                                const isThisCorrect = opt === q.correctAnswer;

                                let optClasses = 'border-[#E0DBD0] bg-white text-[#4A4E4D] hover:bg-[#F2EFE9]';
                                if (isAnswered) {
                                  if (isThisCorrect) {
                                    optClasses = 'border-emerald-500 bg-emerald-100 text-emerald-900 font-bold shadow-2xs';
                                  } else if (isThisSelected) {
                                    optClasses = 'border-rose-500 bg-rose-100 text-rose-900 font-bold';
                                  } else {
                                    optClasses = 'border-[#E0DBD0] bg-white/60 text-[#A5A58D] opacity-60';
                                  }
                                }

                                return (
                                  <button
                                    key={optIdx}
                                    disabled={isAnswered}
                                    onClick={() => handleSelectQuizOption(q.id, opt)}
                                    className={`p-3.5 rounded-2xl border text-left text-xs transition flex items-center justify-between gap-2 cursor-pointer disabled:cursor-default ${optClasses}`}
                                  >
                                    <div className="flex items-start gap-2.5">
                                      <span className="w-5 h-5 rounded-full bg-black/5 flex items-center justify-center text-[10px] font-mono font-bold shrink-0 mt-0.5">
                                        {String.fromCharCode(65 + optIdx)}
                                      </span>
                                      <span>{opt}</span>
                                    </div>
                                    {isAnswered && isThisCorrect && (
                                      <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Explanation when answered */}
                            {isAnswered && (
                              <div className={`p-4 rounded-2xl border text-xs space-y-1.5 ${
                                isCorrect 
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                                  : 'bg-amber-50 border-amber-200 text-amber-900'
                              }`}>
                                <div className="font-bold flex items-center gap-1.5">
                                  {isCorrect ? (
                                    <>
                                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                                      <span>Correct! Great retrieval.</span>
                                    </>
                                  ) : (
                                    <>
                                      <AlertTriangle className="w-4 h-4 text-amber-700" />
                                      <span>Needs Review — Correct Answer: {q.correctAnswer}</span>
                                    </>
                                  )}
                                </div>
                                <p className="leading-relaxed">
                                  {q.explanation}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Finish / Score Banner */}
                    <div className="p-5 rounded-3xl bg-white border border-[#E0DBD0] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="space-y-1 text-center sm:text-left">
                        <div className="text-xs font-bold text-[#4A4E4D]">
                          Questions Answered: {Object.keys(selectedAnswers).length} / {handwrittenStudySet.quiz.length}
                        </div>
                        <div className="text-xs text-[#A5A58D]">
                          {Object.keys(selectedAnswers).length === handwrittenStudySet.quiz.length
                            ? 'All questions answered! Click below to calculate and log your score.'
                            : 'Answer all questions to finalize your retrieval practice score.'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {quizCompleted ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Score Logged to Study History ✓
                            </span>
                            <button
                              onClick={handleRetakeQuiz}
                              className="px-4 py-2 rounded-xl bg-white border border-[#E0DBD0] text-xs font-bold text-[#4A4E4D] hover:bg-[#FAF8F5]"
                            >
                              Retake Quiz
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={handleFinishQuiz}
                            disabled={Object.keys(selectedAnswers).length === 0}
                            className="px-5 py-2.5 rounded-2xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            <Check className="w-4 h-4" />
                            <span>Complete & Log Quiz Score</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: FLASHCARD DECK CAROUSEL */}
                {activeStudySetTab === 'flashcards' && handwrittenStudySet.flashcards && (
                  <div className="space-y-6 pt-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-[#4A4E4D]">
                          Spaced Repetition Flashcards ({handwrittenStudySet.flashcards.length} Cards)
                        </h4>
                        <p className="text-xs text-[#A5A58D]">
                          Card {activeFlashcardIdx + 1} of {handwrittenStudySet.flashcards.length} • Tap card or use buttons to flip.
                        </p>
                      </div>

                      {onSaveFlashcardDeck && (
                        <button
                          onClick={handleSaveDeck}
                          disabled={isDeckSaved}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            isDeckSaved
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default'
                              : 'bg-[#6B705C] hover:bg-[#5a5f4e] text-white'
                          }`}
                        >
                          {isDeckSaved ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Deck Saved to Library</span>
                            </>
                          ) : (
                            <>
                              <FolderPlus className="w-3.5 h-3.5" />
                              <span>Save to Flashcards</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Interactive Flashcard Card */}
                    {handwrittenStudySet.flashcards[activeFlashcardIdx] && (() => {
                      const currentCard = handwrittenStudySet.flashcards[activeFlashcardIdx];
                      return (
                        <div className="space-y-4">
                          <div
                            onClick={() => setIsFlashcardFlipped(!isFlashcardFlipped)}
                            className="min-h-[260px] sm:min-h-[300px] p-6 sm:p-8 rounded-3xl border border-[#E0DBD0] bg-white hover:border-[#6B705C]/50 transition-all shadow-xs cursor-pointer flex flex-col justify-between select-none relative group"
                          >
                            {/* Card Top Pill */}
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#A5A58D]">
                                {isFlashcardFlipped ? 'Answer & Explanation' : 'Retrieval Prompt'}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {currentCard.tags?.map((t, idx) => (
                                  <span key={idx} className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF8F5] text-[#6B705C] border border-[#E0DBD0]">
                                    {t}
                                  </span>
                                ))}
                                <span className="text-[11px] font-mono text-[#A5A58D] ml-2">
                                  {activeFlashcardIdx + 1}/{handwrittenStudySet.flashcards.length}
                                </span>
                              </div>
                            </div>

                            {/* Card Center Content */}
                            <div className="py-6 text-center space-y-3 my-auto">
                              {!isFlashcardFlipped ? (
                                <div className="space-y-2">
                                  <h4 className="text-xl sm:text-2xl font-serif italic font-bold text-[#4A4E4D] max-w-xl mx-auto">
                                    {currentCard.front}
                                  </h4>
                                  <p className="text-xs text-[#A5A58D]">
                                    (Tap card or press Flip to check your recall)
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-4 text-left max-w-xl mx-auto">
                                  <div className="text-base sm:text-lg font-bold text-[#4A4E4D] leading-relaxed">
                                    {currentCard.back}
                                  </div>

                                  {currentCard.mnemonic && (
                                    <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2 text-left">
                                      <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                      <div>
                                        <strong className="font-bold">Memory Mnemonic: </strong>
                                        <span>{currentCard.mnemonic}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Card Bottom Hint */}
                            <div className="flex items-center justify-center text-xs text-[#A5A58D] group-hover:text-[#6B705C] transition-colors font-medium">
                              <span>↻ Click card to flip</span>
                            </div>
                          </div>

                          {/* Navigation Controls */}
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() => {
                                setIsFlashcardFlipped(false);
                                setActiveFlashcardIdx(prev => Math.max(0, prev - 1));
                              }}
                              disabled={activeFlashcardIdx === 0}
                              className="px-4 py-2 rounded-2xl bg-white border border-[#E0DBD0] text-xs font-bold text-[#4A4E4D] hover:bg-[#FAF8F5] transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <ChevronLeft className="w-4 h-4" />
                              <span>Previous Card</span>
                            </button>

                            <button
                              onClick={() => setIsFlashcardFlipped(!isFlashcardFlipped)}
                              className="px-5 py-2 rounded-2xl bg-[#F2EFE9] hover:bg-[#E0DBD0] text-xs font-bold text-[#4A4E4D] transition flex items-center gap-1.5 cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Flip Card</span>
                            </button>

                            <button
                              onClick={() => {
                                setIsFlashcardFlipped(false);
                                setActiveFlashcardIdx(prev => Math.min(handwrittenStudySet.flashcards.length - 1, prev + 1));
                              }}
                              disabled={activeFlashcardIdx === handwrittenStudySet.flashcards.length - 1}
                              className="px-4 py-2 rounded-2xl bg-[#6B705C] hover:bg-[#5a5f4e] text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <span>Next Card</span>
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Quick Grid of All Cards */}
                          <div className="pt-6 border-t border-[#E0DBD0] space-y-3">
                            <h5 className="text-xs font-bold uppercase tracking-widest text-[#6B705C]">
                              All Cards in this Deck ({handwrittenStudySet.flashcards.length})
                            </h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {handwrittenStudySet.flashcards.map((card, idx) => (
                                <div
                                  key={idx}
                                  onClick={() => {
                                    setActiveFlashcardIdx(idx);
                                    setIsFlashcardFlipped(false);
                                  }}
                                  className={`p-3.5 rounded-2xl border text-left transition cursor-pointer space-y-1.5 ${
                                    idx === activeFlashcardIdx
                                      ? 'border-[#6B705C] bg-[#6B705C]/5 shadow-2xs'
                                      : 'border-[#E0DBD0] bg-white hover:bg-[#FAF8F5]'
                                  }`}
                                >
                                  <div className="flex items-center justify-between text-[10px] font-mono text-[#A5A58D]">
                                    <span>Card {idx + 1}</span>
                                    {card.tags?.[0] && <span>#{card.tags[0]}</span>}
                                  </div>
                                  <div className="text-xs font-bold text-[#4A4E4D] line-clamp-2">
                                    {card.front}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* TAB 3: TRANSCRIBED NOTES & DIAGRAMS */}
                {activeStudySetTab === 'transcription' && (
                  <div className="space-y-5 pt-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-[#4A4E4D]">
                          Gemini Vision OCR & Extracted Notes
                        </h4>
                        <p className="text-xs text-[#A5A58D]">
                          Transcribed text, formulas, and visual diagram interpretations from your photo.
                        </p>
                      </div>

                      <button
                        onClick={handleCopyTranscription}
                        className="px-3 py-1.5 rounded-xl bg-white border border-[#E0DBD0] text-xs font-bold text-[#6B705C] hover:bg-[#FAF8F5] transition flex items-center gap-1.5"
                      >
                        {copiedTranscription ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy All</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="p-5 rounded-3xl bg-[#FAF8F5] border border-[#E0DBD0] space-y-3 font-mono text-xs text-[#4A4E4D] leading-relaxed whitespace-pre-wrap">
                      {handwrittenStudySet.extractedText}
                    </div>

                    {handwrittenStudySet.diagramNotes && (
                      <div className="p-5 rounded-3xl bg-amber-50/40 border border-amber-200 space-y-2">
                        <h5 className="text-xs font-bold uppercase tracking-widest text-amber-900 flex items-center gap-1.5 font-mono">
                          <Eye className="w-4 h-4 text-amber-700" />
                          <span>Diagram & Visual Structure Notes</span>
                        </h5>
                        <p className="text-xs text-[#4A4E4D] leading-relaxed">
                          {handwrittenStudySet.diagramNotes}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Image Lightbox Modal */}
      {lightboxImageUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setLightboxImageUrl(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-3xl overflow-hidden shadow-2xl p-2 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-[#E0DBD0]">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#6B705C]" />
                <span className="text-xs font-bold text-[#4A4E4D]">Uploaded Handwritten Work / Notes</span>
              </div>
              <button
                onClick={() => setLightboxImageUrl(null)}
                className="w-8 h-8 rounded-full bg-[#F2EFE9] hover:bg-[#E0DBD0] flex items-center justify-center text-[#4A4E4D] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 overflow-auto max-h-[80vh] flex items-center justify-center bg-[#FAF8F5]">
              <img 
                src={lightboxImageUrl} 
                alt="Enlarged handwritten work" 
                className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-xs"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function ActivityLogIcon(props: any) {
  return (
    <svg 
      {...props} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  );
}
