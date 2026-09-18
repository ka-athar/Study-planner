import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Square, 
  Clock, 
  BookOpen, 
  CheckCircle2, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  X, 
  Headphones, 
  Eye, 
  EyeOff, 
  Mail, 
  Send, 
  Check, 
  Loader2, 
  Calendar,
  AlertCircle,
  Timer,
  Upload,
  Camera,
  FileText,
  Zap,
  ArrowRight,
  Maximize2,
  Minimize2,
  Trash2,
  Award,
  Layers,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  CheckCheck,
  Bell,
  Coffee,
  Mic,
  MicOff,
  Languages,
  Palette
} from 'lucide-react';
import { 
  Subject, 
  StudySession, 
  UserProfile, 
  UserNote, 
  ActivityLog, 
  RevisionItem, 
  TopicStatus, 
  BlurtRecallEvaluation,
  CognitiveErrorCategory
} from '../types';
import { apiGenerateBlurtPrompt, apiEvaluateBlurtRecall } from '../lib/aiApi';
import { compressImageFile } from '../lib/base64Utils';
import { addMistake } from '../lib/mistakeVaultStorage';
import { generateCompletedWorkWhatsAppMessage, buildWhatsAppDirectUrl } from '../lib/whatsappHelper';
import { 
  sendStudySessionEmail, 
  sendDailyCompletedWorkEmail, 
  getOrRequestGmailToken, 
  getCachedGmailToken 
} from '../lib/gmailService';
import { getActiveUserEmail } from '../lib/db';

interface StudyTimerViewProps {
  subjects: Subject[];
  initialSubject?: string;
  initialChapter?: string;
  initialTopic?: string;
  onSaveSession: (session: Omit<StudySession, 'id'>) => void;
  userProfile?: UserProfile | null;
  sessions?: StudySession[];
  user?: any;
  notes?: UserNote[];
  onLogActivity?: (log: Omit<ActivityLog, 'id' | 'userId'>) => Promise<void>;
  onSaveRevision?: (rev: Omit<RevisionItem, 'id' | 'userId'>) => Promise<void>;
  onUpdateTopicStatus?: (subjectName: string, topicName: string, status: TopicStatus) => Promise<void>;
  onNavigateTab?: (tab: any) => void;
  onOpenZenSprint?: (subjectName: string, topicName: string) => void;
  onOpenCheatSheet?: (subjectName: string, topicName: string) => void;
}

// Subtle entrance animation variants for immersive focus experience
const timerEntranceContainerVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.995 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.45,
      ease: [0.16, 1, 0.3, 1],
      staggerChildren: 0.07,
      delayChildren: 0.03
    }
  }
};

const timerEntranceItemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1]
    }
  }
};

export const StudyTimerView: React.FC<StudyTimerViewProps> = ({
  subjects,
  initialSubject,
  initialChapter,
  initialTopic,
  onSaveSession,
  userProfile = null,
  sessions = [],
  user = null,
  notes = [],
  onLogActivity,
  onSaveRevision,
  onUpdateTopicStatus,
  onNavigateTab,
  onOpenZenSprint,
  onOpenCheatSheet
}) => {
  // Mode toggle: Focus Timer vs Integrated AI Blurt & Notes Upload
  const [activeMode, setActiveMode] = useState<'timer' | 'blurt'>('timer');
  const [isFullscreenFocus, setIsFullscreenFocus] = useState<boolean>(false);

  // Topic selection state
  const [selectedSubjectName, setSelectedSubjectName] = useState<string>(
    initialSubject || subjects[0]?.name || ''
  );
  const selectedSubject = subjects.find(s => s.name === selectedSubjectName) || subjects[0];

  const [selectedChapterName, setSelectedChapterName] = useState<string>(
    initialChapter || selectedSubject?.chapters[0]?.name || ''
  );
  const selectedChapter = selectedSubject?.chapters.find(c => c.name === selectedChapterName) || selectedSubject?.chapters[0];

  const [selectedTopicName, setSelectedTopicName] = useState<string>(
    initialTopic || selectedChapter?.topics[0]?.name || ''
  );

  // Focus Mode & Ambient Audio state
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  const [isAmbientSoundOn, setIsAmbientSoundOn] = useState<boolean>(true);
  const [ambientSoundType, setAmbientSoundType] = useState<'white' | 'pink' | 'rain'>('white');
  const [ambientVolume, setAmbientVolume] = useState<number>(0.15); // 15% volume
  const [autoStartBreak, setAutoStartBreak] = useState<boolean>(() => {
    try {
      return localStorage.getItem('studyflow_auto_start_break') === 'true';
    } catch {
      return false;
    }
  });
  const ambientAudioRef = useRef<{
    audioCtx: AudioContext;
    gainNode: GainNode;
    sourceNode: AudioBufferSourceNode;
    filterNode: BiquadFilterNode;
  } | null>(null);

  // AI Blurt / Active Retrieval & Notes Upload state
  const [blurtPrompt, setBlurtPrompt] = useState<string>('');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState<boolean>(false);
  const [blurtRecallText, setBlurtRecallText] = useState<string>('');
  const [attachedImage, setAttachedImage] = useState<{
    base64: string;
    mimeType: string;
    dataUrl: string;
    fileName: string;
    fileSizeBytes: number;
  } | null>(null);
  const [attachedImages, setAttachedImages] = useState<Array<{
    id: string;
    base64: string;
    mimeType: string;
    dataUrl: string;
    fileName: string;
    fileSizeBytes: number;
  }>>([]);
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const [isEvaluatingBlurt, setIsEvaluatingBlurt] = useState<boolean>(false);
  const [blurtEvaluation, setBlurtEvaluation] = useState<BlurtRecallEvaluation | null>(null);
  const [blurtError, setBlurtError] = useState<string | null>(null);
  const [blurtSuccessMsg, setBlurtSuccessMsg] = useState<string | null>(null);
  const [isUpdatingSyllabus, setIsUpdatingSyllabus] = useState<boolean>(false);
  const [isAddingToRevision, setIsAddingToRevision] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Timer Color Theme (Restoring previous/original sage palette requested by user)
  const [timerColorTheme, setTimerColorTheme] = useState<'original_sage' | 'emerald' | 'amber' | 'classic'>(() => {
    try {
      return (localStorage.getItem('studyflow_timer_color_theme') as any) || 'original_sage';
    } catch {
      return 'original_sage';
    }
  });

  // Bilingual Voice-to-Text Dictation (English / اردو)
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechLang, setSpeechLang] = useState<'en-US' | 'ur-PK'>('en-US');
  const recognitionRef = useRef<any>(null);

  // Socratic Oral Exam & Mistake Vault integration
  const [activeBlurtTab, setActiveBlurtTab] = useState<'written' | 'socratic'>('written');
  const [socraticQuestion, setSocraticQuestion] = useState<string>('');
  const [socraticAnswer, setSocraticAnswer] = useState<string>('');
  const [isEvaluatingSocratic, setIsEvaluatingSocratic] = useState<boolean>(false);
  const [socraticFeedback, setSocraticFeedback] = useState<{
    score: number;
    praise: string;
    misconception?: string;
    correctUnderstanding?: string;
    errorCategory?: CognitiveErrorCategory;
  } | null>(null);
  const [socraticMistakeLogged, setSocraticMistakeLogged] = useState<boolean>(false);
  const [loggedMistakeGaps, setLoggedMistakeGaps] = useState<Record<number, boolean>>({});

  // Update chapter/topic dropdowns when subject/chapter/topic props change
  useEffect(() => {
    if (initialSubject && subjects.some(s => s.name === initialSubject)) {
      setSelectedSubjectName(initialSubject);
    }
    if (initialChapter) {
      setSelectedChapterName(initialChapter);
    }
    if (initialTopic) {
      setSelectedTopicName(initialTopic);
    }
  }, [initialSubject, initialChapter, initialTopic, subjects]);

  useEffect(() => {
    if (selectedSubject) {
      if (!selectedSubject.chapters.some(c => c.name === selectedChapterName)) {
        setSelectedChapterName(selectedSubject.chapters[0]?.name || '');
      }
    }
  }, [selectedSubjectName, selectedSubject, selectedChapterName]);

  useEffect(() => {
    if (selectedChapter) {
      if (!selectedChapter.topics.some(t => t.name === selectedTopicName)) {
        setSelectedTopicName(selectedChapter.topics[0]?.name || '');
      }
    }
  }, [selectedChapterName, selectedChapter, selectedTopicName]);

  // Compute accumulated saved study time for this specific topic
  const topicSavedStats = useMemo(() => {
    let minutes = 0;
    let count = 0;
    if (selectedSubject && selectedChapter) {
      const topicObj = selectedChapter.topics.find(t => t.name === selectedTopicName);
      if (topicObj) {
        minutes = topicObj.timeSpentMinutes || 0;
        count = topicObj.sessionsCount || 0;
      }
    }
    // Also cross-reference with study sessions
    const matchingSessions = (sessions || []).filter(
      s => s.subjectName.trim().toLowerCase() === selectedSubjectName.trim().toLowerCase() &&
           s.topicName.trim().toLowerCase() === selectedTopicName.trim().toLowerCase()
    );
    const sessionMins = matchingSessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
    minutes = Math.max(minutes, sessionMins);
    count = Math.max(count, matchingSessions.length);
    return { minutes, count };
  }, [selectedSubject, selectedChapter, selectedTopicName, selectedSubjectName, sessions]);

  // Timer mode & state
  const [targetMinutes, setTargetMinutes] = useState<number>(25);
  const [customMinutes, setCustomMinutes] = useState<number>(30);
  const [secondsLeft, setSecondsLeft] = useState<number>(25 * 60);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Dynamic Theme Colors for Timer (Sage/Classic/Emerald/Amber)
  const timerThemeClasses = useMemo(() => {
    switch (timerColorTheme) {
      case 'original_sage':
        return {
          text: 'text-[#6B705C] dark:text-[#B5C2A5]',
          bar: 'bg-[#6B705C] dark:bg-[#A5B396]',
          glow: 'bg-[#6B705C]/15 dark:bg-[#A5B396]/20',
          accent: 'border-[#6B705C]/40 text-[#6B705C] dark:text-[#B5C2A5]'
        };
      case 'emerald':
        return {
          text: 'text-emerald-700 dark:text-emerald-400',
          bar: 'bg-emerald-600 dark:bg-emerald-500',
          glow: 'bg-emerald-500/15',
          accent: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
        };
      case 'amber':
        return {
          text: 'text-amber-700 dark:text-amber-400',
          bar: 'bg-amber-600 dark:bg-amber-500',
          glow: 'bg-amber-500/15',
          accent: 'border-amber-500/40 text-amber-700 dark:text-amber-400'
        };
      case 'classic':
      default:
        return {
          text: 'text-primary',
          bar: 'bg-primary',
          glow: 'bg-primary/10',
          accent: 'border-primary/40 text-primary'
        };
    }
  }, [timerColorTheme]);

  // Session metadata timestamps
  const startTimeRef = useRef<string>('');
  const startTimestampRef = useRef<number>(0);

  // Completion modal state
  const [isFinishModalOpen, setIsFinishModalOpen] = useState<boolean>(false);
  const [sessionNotes, setSessionNotes] = useState<string>('');
  const [feynmanBlurt, setFeynmanBlurt] = useState<string>('');
  const [sessionLoggedMinutes, setSessionLoggedMinutes] = useState<number>(25);
  const [selectedResult, setSelectedResult] = useState<'Completed' | 'Partially completed' | 'Not completed'>('Completed');
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [emailNotification, setEmailNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [lastSavedSession, setLastSavedSession] = useState<{
    subjectName: string;
    chapterName: string;
    topicName: string;
    durationMinutes: number;
    startTime: string;
    endTime: string;
    result: string;
    notes?: string;
    date: string;
  } | null>(null);

  // Relevant subject notes to pass into AI evaluation
  const relevantNotes = useMemo(() => {
    if (!notes || notes.length === 0) return '';
    const matched = notes.filter(n =>
      n.subjectName.toLowerCase() === selectedSubjectName.toLowerCase() ||
      n.title.toLowerCase().includes(selectedTopicName.toLowerCase())
    );
    return matched.map(m => `${m.title}: ${m.content}`).join('\n\n');
  }, [notes, selectedSubjectName, selectedTopicName]);

  // Generate AI Prompt for the current topic
  const handleGenerateBlurtPrompt = async () => {
    if (!selectedTopicName) return;
    setIsGeneratingPrompt(true);
    setBlurtError(null);
    try {
      const activeTopicObj = selectedChapter?.topics.find(t => t.name === selectedTopicName);
      const res = await apiGenerateBlurtPrompt({
        topicName: selectedTopicName,
        subjectName: selectedSubjectName,
        chapterName: selectedChapterName,
        subtopics: activeTopicObj?.subtopics,
        weakNotes: activeTopicObj?.weakNotes
      });
      if (res && res.prompt) {
        setBlurtPrompt(res.prompt);
      } else {
        setBlurtPrompt(`Explain the core principles, key definitions, equations, and main examiner pitfalls for ${selectedTopicName}.`);
      }
    } catch (err: any) {
      console.warn('Could not generate AI prompt, using standard prompt:', err);
      setBlurtPrompt(`Explain the core principles, key definitions, equations, and main examiner pitfalls for ${selectedTopicName}.`);
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  // Process uploaded image files (supports multiple photos of handwritten notes or diagrams)
  const handleProcessImageFiles = async (files: FileList | File[] | (File | Blob)[]) => {
    const fileList = Array.from(files);
    const validFiles = fileList.filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      setBlurtError('Please select valid image files (PNG, JPG, JPEG, WEBP).');
      return;
    }
    setIsProcessingImage(true);
    setBlurtError(null);
    try {
      const processedList: Array<{
        id: string;
        base64: string;
        mimeType: string;
        dataUrl: string;
        fileName: string;
        fileSizeBytes: number;
      }> = [];

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        const processed = await compressImageFile(file, 1400, 0.85);
        processedList.push({
          id: `${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          base64: processed.base64,
          mimeType: processed.mimeType,
          dataUrl: processed.dataUrl,
          fileName: file instanceof File ? file.name : `page_${i + 1}.jpg`,
          fileSizeBytes: processed.fileSizeBytes
        });
      }

      setAttachedImages(prev => {
        const updated = [...prev, ...processedList];
        if (updated.length > 0) {
          setAttachedImage(updated[0]);
        }
        return updated;
      });
      setBlurtSuccessMsg(`${processedList.length} photo(s) added and optimized for AI analysis!`);
    } catch (err: any) {
      console.error('Error processing images:', err);
      setBlurtError('Could not process some images. Please try again.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleRemovePhoto = (id: string) => {
    setAttachedImages(prev => {
      const updated = prev.filter(p => p.id !== id);
      setAttachedImage(updated.length > 0 ? updated[0] : null);
      return updated;
    });
  };

  // Toggle Bilingual Voice-to-Text Speech Recognition (English / اردو)
  const handleToggleVoiceDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is supported natively in Chrome, Edge, and Safari. Please use a supported browser or type your recall.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = speechLang;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          if (activeBlurtTab === 'socratic') {
            setSocraticAnswer(prev => prev ? `${prev} ${finalTranscript}` : finalTranscript);
          } else {
            setBlurtRecallText(prev => prev ? `${prev} ${finalTranscript}` : finalTranscript);
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition status:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
    }
  };

  // Socratic Oral Exam Question Generator
  const handleGenerateSocraticQuestion = async () => {
    setIsEvaluatingSocratic(true);
    setSocraticFeedback(null);
    setSocraticMistakeLogged(false);
    try {
      const activeTopicObj = selectedChapter?.topics.find(t => t.name === selectedTopicName);
      const subtopicsText = activeTopicObj?.subtopics?.map(s => typeof s === 'string' ? s : s.name).join(', ') || '';

      const res = await fetch('/api/ai/ask-mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: selectedSubjectName,
          chapter: selectedChapterName,
          topic: selectedTopicName,
          userPrompt: `Generate ONE concise, probing Socratic oral exam question for a high-school / FBISE student testing their conceptual depth and common misconceptions in "${selectedTopicName}" (Subtopics: ${subtopicsText}). Ask a question that forces them to explain "why" or "what happens if", not just recite a definition.`
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.reply) {
          setSocraticQuestion(data.reply.trim());
          setSocraticAnswer('');
          return;
        }
      }
      setSocraticQuestion(`In ${selectedTopicName}: How would you explain the underlying mechanism to someone who doubts it? What is the most critical condition or formula, and what mistake do students commonly make when applying it?`);
      setSocraticAnswer('');
    } catch {
      setSocraticQuestion(`In ${selectedTopicName}: How would you explain the underlying mechanism to someone who doubts it? What is the most critical condition or formula, and what mistake do students commonly make when applying it?`);
    } finally {
      setIsEvaluatingSocratic(false);
    }
  };

  // Socratic Oral Exam Answer Evaluator
  const handleEvaluateSocraticAnswer = async () => {
    if (!socraticAnswer.trim()) {
      setBlurtError('Please speak or write your oral response first.');
      return;
    }
    setIsEvaluatingSocratic(true);
    setBlurtError(null);
    try {
      const res = await fetch('/api/ai/ask-mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: selectedSubjectName,
          chapter: selectedChapterName,
          topic: selectedTopicName,
          userPrompt: `Evaluate the student's oral exam answer to the question: "${socraticQuestion}"
Student Answer: "${socraticAnswer}"
Please evaluate strictly on FBISE / Mark Scheme conceptual rigor.
Return JSON formatted with:
{
  "score": 85,
  "praise": "Specific sentence on what was logically solid",
  "misconception": "Exact misconception or missing condition (empty string if flawless)",
  "correctUnderstanding": "Concise mark-scheme correct answer",
  "errorCategory": "conceptual_misconception"
}`
        })
      });

      if (res.ok) {
        const data = await res.json();
        let parsed: any = null;
        try {
          const clean = data.reply.replace(/```json/g, '').replace(/```/g, '').trim();
          parsed = JSON.parse(clean);
        } catch {
          parsed = {
            score: 75,
            praise: data.reply.slice(0, 160),
            misconception: "Review full mathematical or physical conditions for complete marks.",
            correctUnderstanding: data.reply,
            errorCategory: "conceptual_misconception"
          };
        }
        setSocraticFeedback(parsed);
      }
    } catch (err: any) {
      setSocraticFeedback({
        score: 70,
        praise: "Good core attempt covering the foundational points.",
        misconception: "Ensure variables and boundary conditions are stated explicitly.",
        correctUnderstanding: "Refer to textbook definitions and key formulas.",
        errorCategory: "conceptual_misconception"
      });
    } finally {
      setIsEvaluatingSocratic(false);
    }
  };

  // 1-Click Send Misconception to Mistake Vault
  const handleLogSocraticMistake = () => {
    if (!socraticFeedback?.misconception && !socraticFeedback?.correctUnderstanding) return;
    addMistake({
      subject: selectedSubjectName,
      chapter: selectedChapterName,
      topic: selectedTopicName,
      question: socraticQuestion,
      studentAnswer: socraticAnswer,
      correctAnswer: socraticFeedback.correctUnderstanding || 'Standard mark scheme formulation',
      category: socraticFeedback.errorCategory || 'conceptual_misconception',
      studentThoughtProcess: socraticFeedback.misconception || 'Identified as conceptual gap during Socratic oral exam',
      tags: ['SocraticOralExam', selectedSubjectName]
    });
    setSocraticMistakeLogged(true);
    setBlurtSuccessMsg('Misconception successfully recorded in Mistake Vault for spaced autopsy practice!');
  };

  // Evaluate Blurt with Gemini AI
  const handleEvaluateBlurt = async () => {
    const wordCount = blurtRecallText.trim().split(/\s+/).filter(Boolean).length;
    if (!blurtRecallText.trim() && !attachedImage) {
      setBlurtError('Please write your recall explanation or upload a photo of your handwritten work/diagram.');
      return;
    }
    if (!attachedImage && wordCount < 5) {
      setBlurtError('Please write at least a few sentences (5+ words) or upload an image of your work for accurate AI evaluation.');
      return;
    }

    setIsEvaluatingBlurt(true);
    setBlurtError(null);
    setBlurtSuccessMsg(null);

    try {
      const activeTopicObj = selectedChapter?.topics.find(t => t.name === selectedTopicName);
      const result = await apiEvaluateBlurtRecall({
        topicName: selectedTopicName,
        subjectName: selectedSubjectName,
        chapterName: selectedChapterName,
        subtopics: activeTopicObj?.subtopics,
        syllabusNotes: activeTopicObj?.weakNotes || '',
        userNotes: relevantNotes,
        blurtText: blurtRecallText.trim(),
        imageBase64: attachedImage ? attachedImage.base64 : undefined,
        imageMimeType: attachedImage ? attachedImage.mimeType : undefined,
        promptUsed: blurtPrompt || `Explain the core concepts of ${selectedTopicName}`,
        durationSeconds: targetMinutes * 60 - secondsLeft > 0 ? targetMinutes * 60 - secondsLeft : 300
      });

      if (result && result.evaluation) {
        const evalData: BlurtRecallEvaluation = {
          ...result.evaluation,
          imageUrl: attachedImage ? attachedImage.dataUrl : (result.evaluation.imageUrl || undefined),
          extractedText: result.extractedText || result.evaluation.extractedText || undefined,
          diagramNotes: result.diagramNotes || result.evaluation.diagramNotes || undefined
        };
        setBlurtEvaluation(evalData);

        // Automatically log activity to history
        if (onLogActivity) {
          const spentMins = Math.max(1, Math.round((evalData.durationSeconds || 180) / 60));
          await onLogActivity({
            date: evalData.date,
            timestamp: evalData.timestamp,
            subjectName: evalData.subjectName,
            chapterName: evalData.chapterName,
            topicName: evalData.topicName,
            action: 'Blurt Recall',
            details: `AI Blurt Recall on "${evalData.topicName}": ${evalData.recallScore}% recall score ${attachedImage ? '(Photo Work Analyzed)' : ''} — ${evalData.knowledgeGaps.length} gaps identified (${evalData.recalledConcepts.length} concepts recalled)`,
            result: `${evalData.recallScore}% • ${evalData.retentionLevel}`,
            durationMinutes: spentMins,
            scorePercentage: evalData.recallScore,
            blurtRecall: evalData
          });
        }
        setBlurtSuccessMsg(`Recall evaluation complete: ${evalData.recallScore}% score recorded!`);
      } else {
        throw new Error('Could not parse AI evaluation response.');
      }
    } catch (err: any) {
      console.error('Error evaluating blurt:', err);
      setBlurtError(err?.message || 'Failed to complete AI comparison. Please try again.');
    } finally {
      setIsEvaluatingBlurt(false);
    }
  };

  // Mark topic status in syllabus
  const handleUpdateSyllabusStatus = async (status: TopicStatus) => {
    if (!onUpdateTopicStatus || !selectedSubjectName || !selectedTopicName) return;
    setIsUpdatingSyllabus(true);
    try {
      await onUpdateTopicStatus(selectedSubjectName, selectedTopicName, status);
      setBlurtSuccessMsg(`Syllabus updated! "${selectedTopicName}" is now marked as ${status}.`);
    } catch (e: any) {
      setBlurtError('Failed to update syllabus status.');
    } finally {
      setIsUpdatingSyllabus(false);
    }
  };

  // Add gaps to revision queue
  const handleAddGapsToRevisionQueue = async () => {
    if (!blurtEvaluation || !onSaveRevision) return;
    setIsAddingToRevision(true);
    try {
      const gapBulletPoints = blurtEvaluation.knowledgeGaps
        .map(g => `• ${g.concept}: ${g.explanation}`)
        .join('\n');

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      await onSaveRevision({
        subjectName: blurtEvaluation.subjectName,
        chapterName: blurtEvaluation.chapterName || 'General',
        topicName: blurtEvaluation.topicName,
        lastStudied: new Date().toISOString().split('T')[0],
        dueDate: tomorrowStr,
        priority: blurtEvaluation.recallScore < 65 ? 'High' : 'Medium',
        status: 'Pending',
        reason: `AI Blurt gaps (${blurtEvaluation.recallScore}% score):\n${gapBulletPoints}`,
        timeSpentMinutes: Math.round(blurtEvaluation.durationSeconds / 60)
      });
      setBlurtSuccessMsg('Knowledge gaps queued into your Revision Manager for tomorrow!');
    } catch (e: any) {
      setBlurtError('Failed to add to revision queue.');
    } finally {
      setIsAddingToRevision(false);
    }
  };

  // Audio effect context for timer chime
  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3); // A5
      gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 1.2);
    } catch (e) {
      console.warn("Audio play error:", e);
    }
  };

  // Ambient Noise Web Audio Synthesizer
  const stopAmbientNoise = () => {
    if (ambientAudioRef.current) {
      try {
        const { audioCtx, gainNode, sourceNode } = ambientAudioRef.current;
        gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.2);
        setTimeout(() => {
          try {
            sourceNode.stop();
            audioCtx.close();
          } catch (e) {}
        }, 220);
      } catch (e) {}
      ambientAudioRef.current = null;
    }
  };

  const startAmbientNoise = (type: 'white' | 'pink' | 'rain', volume: number) => {
    stopAmbientNoise();
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();

      const bufferSize = audioCtx.sampleRate * 2;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);

      if (type === 'pink') {
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
        }
      } else if (type === 'rain') {
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          data[i] = (lastOut + (0.02 * white)) / 1.02;
          lastOut = data[i];
          data[i] *= 3.2;
        }
      } else {
        // Soft White noise
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
      }

      const noiseSource = audioCtx.createBufferSource();
      noiseSource.buffer = buffer;
      noiseSource.loop = true;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = type === 'rain' ? 450 : (type === 'pink' ? 650 : 800);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), audioCtx.currentTime + 0.3);

      noiseSource.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);

      noiseSource.start();
      ambientAudioRef.current = { audioCtx, gainNode: gain, sourceNode: noiseSource, filterNode: filter };
    } catch (e) {
      console.warn("Ambient noise error:", e);
    }
  };

  // Manage ambient sound playback when timer state or Focus Mode changes
  useEffect(() => {
    if (isActive && !isPaused && isFocusMode && isAmbientSoundOn) {
      startAmbientNoise(ambientSoundType, ambientVolume);
    } else {
      stopAmbientNoise();
    }
    return () => {
      stopAmbientNoise();
    };
  }, [isActive, isPaused, isFocusMode, isAmbientSoundOn, ambientSoundType]);

  // Adjust volume dynamically if changed while playing
  useEffect(() => {
    if (ambientAudioRef.current) {
      try {
        const { audioCtx, gainNode } = ambientAudioRef.current;
        gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(Math.max(0.001, ambientVolume), audioCtx.currentTime + 0.1);
      } catch (e) {}
    }
  }, [ambientVolume]);

  // Keyboard shortcuts (Space to toggle, F for Fullscreen Zen, Escape to exit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.tagName === 'SELECT')
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (isActive) {
          if (isPaused) {
            setIsPaused(false);
          } else {
            setIsPaused(true);
          }
        } else {
          if (selectedTopicName) {
            const now = new Date();
            startTimeRef.current = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            startTimestampRef.current = Date.now();
            setIsActive(true);
            setIsPaused(false);
          }
        }
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setIsFullscreenFocus(prev => !prev);
      } else if (e.key === 'Escape') {
        if (isFullscreenFocus) {
          setIsFullscreenFocus(false);
        }
        if (isFocusMode) {
          setIsFocusMode(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, isPaused, isFullscreenFocus, isFocusMode, selectedTopicName]);

  // Timer interval tick
  useEffect(() => {
    let interval: any = null;
    if (isActive && !isPaused) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setIsActive(false);
            setIsPaused(false);
            playChime();
            setSessionLoggedMinutes(targetMinutes);
            setSelectedResult('Completed');
            setIsFinishModalOpen(true);

            if (autoStartBreak) {
              setTimeout(() => {
                setSelectedTopicName('Rest Break (5 min)');
                setTargetMinutes(5);
                setSecondsLeft(5 * 60);
                setIsActive(true);
                setIsPaused(false);
              }, 1200);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, isPaused, targetMinutes, autoStartBreak]);

  const handleSetPreset = (mins: number) => {
    if (isActive) return;
    setTargetMinutes(mins);
    setSecondsLeft(mins * 60);
  };

  const handleStartTimer = () => {
    if (!selectedTopicName) {
      alert("Please select a subject, chapter, and topic before starting.");
      return;
    }
    const now = new Date();
    startTimeRef.current = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    startTimestampRef.current = Date.now();

    setIsActive(true);
    setIsPaused(false);
  };

  const handlePauseTimer = () => {
    setIsPaused(true);
  };

  const handleResumeTimer = () => {
    setIsPaused(false);
  };

  const handleStopTimer = () => {
    if (!isActive && secondsLeft === targetMinutes * 60) return;
    setIsActive(false);
    setIsPaused(false);
    const elapsedSeconds = targetMinutes * 60 - secondsLeft;
    const actualDurationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    setSessionLoggedMinutes(actualDurationMinutes);
    setSelectedResult('Completed');
    setIsFinishModalOpen(true);
  };

  const handleResetTimer = () => {
    setIsActive(false);
    setIsPaused(false);
    setSecondsLeft(targetMinutes * 60);
  };

  const handleEmailSession = async (sessionData: {
    subjectName: string;
    chapterName: string;
    topicName: string;
    durationMinutes: number;
    startTime?: string;
    endTime?: string;
    result: string;
    notes?: string;
  }) => {
    const targetEmail = userProfile?.email || user?.email || getActiveUserEmail() || '';
    if (!targetEmail) {
      setEmailNotification({
        type: 'error',
        text: 'No email found in your user profile. Please specify your email in Settings.'
      });
      return;
    }

    setIsSendingEmail(true);
    setEmailNotification(null);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const todayTotal = (sessions || [])
        .filter(s => s.date === todayStr)
        .reduce((sum, s) => sum + (s.durationMinutes || 0), 0) + sessionData.durationMinutes;

      await sendStudySessionEmail({
        recipientEmail: targetEmail,
        recipientName: userProfile?.name || user?.displayName || 'Student',
        subjectName: sessionData.subjectName,
        chapterName: sessionData.chapterName,
        topicName: sessionData.topicName,
        durationMinutes: sessionData.durationMinutes,
        startTime: sessionData.startTime,
        endTime: sessionData.endTime,
        result: sessionData.result,
        notes: sessionData.notes,
        todayTotalMinutes: todayTotal
      });

      setEmailNotification({
        type: 'success',
        text: `Study session record successfully emailed to ${targetEmail}!`
      });
    } catch (err: any) {
      console.error('Session email error:', err);
      setEmailNotification({
        type: 'error',
        text: err?.message?.includes('popup')
          ? 'Browser pop-up was blocked. Please allow pop-ups for this tab to authenticate Gmail.'
          : `Failed to email session: ${err?.message || 'Unknown error'}`
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleEmailTodayTotal = async () => {
    const targetEmail = userProfile?.email || user?.email || getActiveUserEmail() || '';
    if (!targetEmail) {
      setEmailNotification({
        type: 'error',
        text: 'No email address found in profile. Please update Settings.'
      });
      return;
    }

    setIsSendingEmail(true);
    setEmailNotification(null);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const todaySessions = (sessions || []).filter(s => s.date === todayStr);
      const totalMins = todaySessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

      const completedTopics = todaySessions
        .filter(s => s.result === 'Completed')
        .map(s => ({
          topicName: s.topicName,
          subjectName: s.subjectName,
          duration: s.durationMinutes
        }));

      await sendDailyCompletedWorkEmail({
        recipientEmail: targetEmail,
        recipientName: userProfile?.name || user?.displayName || 'Student',
        completedTopics,
        todaySessions,
        totalStudyMinutes: totalMins,
        userProfile
      });

      setEmailNotification({
        type: 'success',
        text: `Today's complete study summary (${totalMins}m across ${todaySessions.length} sessions) emailed to ${targetEmail}!`
      });
    } catch (err: any) {
      console.error('Today total email error:', err);
      setEmailNotification({
        type: 'error',
        text: err?.message?.includes('popup')
          ? 'Browser pop-up was blocked. Please allow pop-ups for this tab to authenticate Gmail.'
          : `Failed to email daily summary: ${err?.message || 'Unknown error'}`
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSaveResult = async (sendEmail: boolean = false) => {
    const endNow = new Date();
    const endTimeStr = endNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const todayStr = endNow.toISOString().split('T')[0];
    const startTimeStr = startTimeRef.current || endNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const finalDuration = Math.max(1, sessionLoggedMinutes);

    const combinedNotes = feynmanBlurt.trim()
      ? `Feynman Blurt: "${feynmanBlurt.trim()}". ${sessionNotes ? `Notes: ${sessionNotes}` : ''}`
      : sessionNotes;

    const sessionPayload: Omit<StudySession, 'id'> = {
      userId: '',
      date: todayStr,
      startTime: startTimeStr,
      endTime: endTimeStr,
      durationMinutes: finalDuration,
      subjectName: selectedSubjectName,
      chapterName: selectedChapterName,
      topicName: selectedTopicName,
      result: selectedResult,
      notes: combinedNotes,
      timestamp: startTimestampRef.current || Date.now()
    };

    onSaveSession(sessionPayload);
    setLastSavedSession({
      ...sessionPayload,
      date: todayStr
    });

    setIsFinishModalOpen(false);
    setSessionNotes('');
    setFeynmanBlurt('');
    setSecondsLeft(targetMinutes * 60);

    if (sendEmail) {
      await handleEmailSession(sessionPayload);
    } else {
      setEmailNotification({
        type: 'info',
        text: `Session saved! (${finalDuration}m on ${selectedTopicName}). You can email yourself the recap anytime.`
      });
    }
  };

  const handleSaveAndStartBlurt = async () => {
    const endNow = new Date();
    const endTimeStr = endNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const todayStr = endNow.toISOString().split('T')[0];
    const startTimeStr = startTimeRef.current || endNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const finalDuration = Math.max(1, sessionLoggedMinutes);

    const combinedNotes = feynmanBlurt.trim()
      ? `Feynman Blurt: "${feynmanBlurt.trim()}". ${sessionNotes ? `Notes: ${sessionNotes}` : ''}`
      : sessionNotes;

    const sessionPayload: Omit<StudySession, 'id'> = {
      userId: '',
      date: todayStr,
      startTime: startTimeStr,
      endTime: endTimeStr,
      durationMinutes: finalDuration,
      subjectName: selectedSubjectName,
      chapterName: selectedChapterName,
      topicName: selectedTopicName,
      result: selectedResult,
      notes: combinedNotes,
      timestamp: startTimestampRef.current || Date.now()
    };

    onSaveSession(sessionPayload);
    setLastSavedSession({
      ...sessionPayload,
      date: todayStr
    });

    setIsFinishModalOpen(false);
    if (feynmanBlurt.trim()) {
      setBlurtRecallText(feynmanBlurt.trim());
    }
    setSessionNotes('');
    setFeynmanBlurt('');
    setSecondsLeft(targetMinutes * 60);

    // Switch directly to AI Blurt & Notes Upload studio for this topic
    setActiveMode('blurt');
    handleGenerateBlurtPrompt();
  };

  // Format MM:SS
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formattedTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const progressPercent = Math.min(
    100,
    ((targetMinutes * 60 - secondsLeft) / (targetMinutes * 60)) * 100
  );

  return (
    <motion.div
      variants={timerEntranceContainerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-5 sm:space-y-6 max-w-4xl mx-auto relative px-1 sm:px-0"
    >
      {/* Header */}
      <motion.div
        variants={timerEntranceItemVariants}
        className="bg-card border border-theme rounded-3xl p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors"
      >
        <div>
          <h2 className="text-lg sm:text-xl font-serif italic font-bold text-primary flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <span>Interactive Study Timer</span>
          </h2>
          <p className="text-xs text-muted mt-1">
            Focus timer automatically logs sessions to Firestore and tracks completed vs partial topics.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
          {/* Email Today's Total Button */}
          <button
            onClick={handleEmailTodayTotal}
            disabled={isSendingEmail}
            className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs border bg-theme-accent text-primary border-theme hover:opacity-85 disabled:opacity-50 min-h-[44px]"
            title="Email today's total study session log to your Gmail"
          >
            {isSendingEmail ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Mail className="w-4 h-4 text-primary" />}
            <span className="whitespace-nowrap">Email Today's Log</span>
          </button>

          {/* Focus Mode Toggle */}
          <button
            onClick={() => setIsFocusMode(!isFocusMode)}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs border min-h-[44px] active:scale-95 ${
              isFocusMode
                ? 'bg-primary text-white border-primary'
                : 'bg-theme-accent text-primary border-theme hover:opacity-85'
            }`}
          >
            {isFocusMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span className="whitespace-nowrap">{isFocusMode ? 'Focus Active' : 'Focus Mode'}</span>
          </button>
        </div>
      </motion.div>

      {/* Email Notification Alert Banner */}
      <AnimatePresence>
        {emailNotification && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className={`p-3.5 sm:p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
              emailNotification.type === 'success' ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30' :
              emailNotification.type === 'error' ? 'bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/30' :
              'bg-theme-accent text-primary border-theme'
            }`}
          >
            <div className="flex items-center gap-2">
              {emailNotification.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <Mail className="w-4 h-4 text-primary shrink-0" />
              )}
              <span className="leading-snug">{emailNotification.text}</span>
            </div>
            <button onClick={() => setEmailNotification(null)} className="text-current opacity-70 hover:opacity-100 cursor-pointer p-1">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent Saved Session Banner with Instant 'Email Me' Action */}
      {lastSavedSession && (
        <motion.div
          variants={timerEntranceItemVariants}
          className="p-4 rounded-2xl bg-card border border-theme shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-primary truncate">
                Session Saved: {lastSavedSession.subjectName} — {lastSavedSession.topicName}
              </div>
              <div className="text-[11px] text-muted flex flex-wrap items-center gap-1.5 sm:gap-2 mt-0.5">
                <span>{lastSavedSession.durationMinutes} mins saved</span>
                <span>•</span>
                <span className="text-emerald-700 dark:text-emerald-300 font-semibold">Saved to Revision & Progress</span>
                <span>•</span>
                <span>Finished at {lastSavedSession.endTime}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {onNavigateTab && (
              <>
                <button
                  type="button"
                  onClick={() => onNavigateTab('revision')}
                  className="px-3 py-2 rounded-xl bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold hover:opacity-85 transition cursor-pointer shrink-0 flex items-center gap-1 min-h-[38px]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>View in Revision</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('progress')}
                  className="px-3 py-2 rounded-xl bg-theme-accent text-primary border border-theme text-xs font-bold hover:opacity-85 transition cursor-pointer shrink-0 min-h-[38px]"
                >
                  View in Progress
                </button>
              </>
            )}
            <button
              onClick={() => handleEmailSession(lastSavedSession)}
              disabled={isSendingEmail}
              className="px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-2 hover:opacity-90 transition cursor-pointer shrink-0 shadow-xs disabled:opacity-50 min-h-[38px]"
            >
              {isSendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
              <span>Email Session</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMode('blurt');
                if (!blurtRecallText && lastSavedSession.notes) {
                  setBlurtRecallText(lastSavedSession.notes.replace(/^Feynman Blurt: "/, '').replace(/"\.\s*Notes:.*$/, ''));
                }
                handleGenerateBlurtPrompt();
              }}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-xs min-h-[38px]"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>AI Blurt & Notes</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* Mode Switcher: Focus Timer vs Integrated AI Blurt & Notes Upload */}
      <motion.div variants={timerEntranceItemVariants} className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-surface border border-theme rounded-2xl w-full sm:w-auto shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveMode('timer')}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer min-h-[40px] ${
              activeMode === 'timer'
                ? 'bg-primary text-white shadow-xs'
                : 'text-muted hover:text-primary'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Focus Timer</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveMode('blurt');
              if (!blurtPrompt) {
                handleGenerateBlurtPrompt();
              }
            }}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer min-h-[40px] ${
              activeMode === 'blurt'
                ? 'bg-primary text-white shadow-xs'
                : 'text-muted hover:text-primary'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-300" />
            <span>AI Blurt & Notes Upload</span>
          </button>
        </div>

        {/* Quick Topic Indicator */}
        <div className="text-[11px] font-mono text-muted flex items-center gap-2">
          <span>Target Topic:</span>
          <span className="font-bold text-primary truncate max-w-[200px]">{selectedTopicName}</span>
        </div>
      </motion.div>

      {/* VIEW 1: TIMER MODE */}
      {activeMode === 'timer' && (
        <motion.div
          variants={timerEntranceItemVariants}
          className="bg-card border border-theme rounded-3xl p-5 sm:p-8 shadow-xs space-y-6 sm:space-y-8 relative overflow-hidden transition-colors"
        >
          {/* Subtle background glow when active */}
          {isActive && !isPaused && (
            <div className="absolute inset-0 bg-primary/5 pointer-events-none animate-pulse"></div>
          )}

          {/* If Focus Mode is activated, render the Distraction-Free Inline View */}
          {isFocusMode ? (
            <div className="space-y-6 text-center py-2 sm:py-4">
              {/* Focus Mode Header Bar */}
              <div className="flex items-center justify-between gap-3 border-b border-theme/40 pb-4">
                <div className="flex items-center gap-2 text-left min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-primary block truncate">Distraction-Free Focus Mode</span>
                    <span className="text-[11px] text-muted block truncate">{selectedSubjectName} &bull; {selectedTopicName}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsFullscreenFocus(true)}
                    className="p-2 rounded-xl bg-theme-accent border border-theme text-primary hover:opacity-85 text-xs font-semibold flex items-center gap-1.5 cursor-pointer min-h-[38px]"
                    title="Toggle Fullscreen"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-[11px]">Fullscreen</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsFocusMode(false)}
                    className="px-3 py-2 rounded-xl bg-theme-accent border border-theme text-primary hover:opacity-85 text-xs font-semibold flex items-center gap-1 cursor-pointer min-h-[38px]"
                    title="Exit Focus Mode"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Exit</span>
                  </button>
                </div>
              </div>

              {/* Monumental Clock with Subtle Ambient Aura */}
              <div className="relative inline-block my-2 sm:my-4">
                {isActive && !isPaused && (
                  <div className={`absolute -inset-6 sm:-inset-10 ${timerThemeClasses.glow} rounded-full blur-2xl pointer-events-none animate-pulse`}></div>
                )}
                <div className={`text-7xl sm:text-9xl md:text-[10rem] font-mono font-bold tracking-tight ${timerThemeClasses.text} tabular-nums relative select-none transition-colors`}>
                  {formattedTime}
                </div>
              </div>

              {/* Status Label */}
              <div className="space-y-1">
                <p className={`text-xs font-mono font-bold tracking-widest ${timerThemeClasses.text} uppercase`}>
                  {isActive ? (isPaused ? '⏸ SESSION PAUSED' : '⚡ DEEP FOCUS IN PROGRESS') : 'READY TO FOCUS'}
                </p>
                {isActive && !isPaused && isAmbientSoundOn && (
                  <p className="text-[11px] text-muted flex items-center justify-center gap-1.5 font-mono">
                    <Headphones className="w-3.5 h-3.5 text-primary animate-pulse" />
                    <span>Subtle ambient {ambientSoundType} soundscape</span>
                  </p>
                )}
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-lg mx-auto bg-theme-accent h-2.5 rounded-full overflow-hidden border border-theme shadow-2xs">
                <div
                  className={`${timerThemeClasses.bar} h-full rounded-full transition-all duration-300`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Audio Controls Pill & Chime Preview */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <div className="inline-flex items-center justify-center gap-2 bg-theme-accent/70 border border-theme rounded-full px-4 py-1.5 text-xs text-primary shadow-2xs">
                  <button
                    onClick={() => setIsAmbientSoundOn(!isAmbientSoundOn)}
                    className="flex items-center gap-1.5 font-semibold hover:opacity-80 transition cursor-pointer min-h-[32px]"
                  >
                    {isAmbientSoundOn ? <Volume2 className="w-3.5 h-3.5 text-primary" /> : <VolumeX className="w-3.5 h-3.5 text-muted" />}
                    <span className="text-[11px] font-mono">{isAmbientSoundOn ? 'Sound On' : 'Muted'}</span>
                  </button>
                  {isAmbientSoundOn && (
                    <>
                      <div className="h-3 w-px bg-theme"></div>
                      <select
                        value={ambientSoundType}
                        onChange={(e) => setAmbientSoundType(e.target.value as any)}
                        className="bg-transparent text-[11px] font-mono font-bold text-primary focus:outline-none cursor-pointer"
                      >
                        <option value="white" className="bg-card text-primary">White Noise</option>
                        <option value="pink" className="bg-card text-primary">Pink Noise</option>
                        <option value="rain" className="bg-card text-primary">Soft Rain</option>
                      </select>
                      <input
                        type="range"
                        min={0.02}
                        max={0.4}
                        step={0.02}
                        value={ambientVolume}
                        onChange={(e) => setAmbientVolume(parseFloat(e.target.value))}
                        className="w-12 sm:w-16 accent-current cursor-pointer"
                        title={`Volume: ${Math.round(ambientVolume * 100)}%`}
                      />
                    </>
                  )}
                </div>

                {/* Test Sound Chime Button */}
                <button
                  onClick={playChime}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-theme-accent/80 hover:bg-theme-accent text-primary border border-theme text-xs font-semibold transition cursor-pointer active:scale-95 shadow-2xs min-h-[36px]"
                  title="Play sample chime to test audio volume"
                >
                  <Bell className="w-3.5 h-3.5 text-primary" />
                  <span className="font-mono text-[11px]">Test Sound</span>
                </button>

                {/* Auto-Start 5m Break Toggle */}
                <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-theme-accent/80 hover:bg-theme-accent text-primary border border-theme text-xs font-semibold cursor-pointer select-none transition shadow-2xs min-h-[36px]">
                  <input
                    type="checkbox"
                    checked={autoStartBreak}
                    onChange={(e) => {
                      setAutoStartBreak(e.target.checked);
                      try {
                        localStorage.setItem('studyflow_auto_start_break', String(e.target.checked));
                      } catch {}
                    }}
                    className="w-3.5 h-3.5 accent-current rounded cursor-pointer"
                  />
                  <Coffee className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="font-mono text-[11px]">Auto-start 5m break</span>
                </label>
              </div>

              {/* Focus Controls */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                {!isActive && !isPaused && (
                  <button
                    onClick={handleStartTimer}
                    className="px-8 sm:px-12 py-3.5 sm:py-4 rounded-full bg-primary hover:opacity-90 text-white font-bold text-xs sm:text-sm tracking-wider uppercase transition shadow-md flex items-center justify-center gap-2.5 active:scale-95 cursor-pointer min-h-[46px]"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Begin Deep Focus</span>
                  </button>
                )}

                {isActive && !isPaused && (
                  <button
                    onClick={handlePauseTimer}
                    className="px-6 py-3 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider transition shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 min-h-[44px]"
                  >
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Pause</span>
                  </button>
                )}

                {isActive && isPaused && (
                  <button
                    onClick={handleResumeTimer}
                    className="px-6 py-3 rounded-full bg-primary hover:opacity-90 text-white font-bold text-xs uppercase tracking-wider transition shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 min-h-[44px]"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Resume</span>
                  </button>
                )}

                {(isActive || secondsLeft < targetMinutes * 60) && (
                  <button
                    onClick={handleStopTimer}
                    className="px-6 py-3 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider transition shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 min-h-[44px]"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    <span>Finish Session</span>
                  </button>
                )}

                <button
                  onClick={handleResetTimer}
                  className="p-3 rounded-full bg-theme-accent hover:opacity-85 text-muted hover:text-primary border border-theme transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95"
                  title="Reset Timer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Keyboard Hotkeys Hint */}
              <div className="w-full flex items-center justify-center gap-3 pt-2 text-[11px] font-mono text-muted select-none flex-wrap">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-surface border border-theme text-[10px] text-primary font-bold shadow-2xs">Space</kbd>
                  <span>{isActive ? (isPaused ? 'Resume' : 'Pause') : 'Start'}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-surface border border-theme text-[10px] text-primary font-bold shadow-2xs">F</kbd>
                  <span>Zen Fullscreen</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-surface border border-theme text-[10px] text-primary font-bold shadow-2xs">Esc</kbd>
                  <span>Exit Focus</span>
                </span>
              </div>
            </div>
          ) : (
            /* Standard Configurable Timer View */
            <>
              {/* Topic Selector Block */}
              <div className="bg-surface border border-theme rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="text-xs font-bold text-primary uppercase tracking-widest font-mono flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span>Target Subject & Topic</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Subject Dropdown */}
                  <div>
                    <label className="block text-[11px] font-bold text-muted uppercase tracking-widest mb-1">Subject</label>
                    <select
                      disabled={isActive}
                      value={selectedSubjectName}
                      onChange={(e) => setSelectedSubjectName(e.target.value)}
                      className="w-full p-2.5 bg-card border border-theme rounded-xl text-xs text-primary focus:outline-none focus:border-primary font-semibold min-h-[42px] cursor-pointer"
                    >
                      {subjects.map((sub) => (
                        <option key={sub.id} value={sub.name}>{sub.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Chapter Dropdown */}
                  <div>
                    <label className="block text-[11px] font-bold text-muted uppercase tracking-widest mb-1">Chapter</label>
                    <select
                      disabled={isActive}
                      value={selectedChapterName}
                      onChange={(e) => setSelectedChapterName(e.target.value)}
                      className="w-full p-2.5 bg-card border border-theme rounded-xl text-xs text-primary focus:outline-none focus:border-primary font-semibold min-h-[42px] cursor-pointer"
                    >
                      {selectedSubject?.chapters.map((ch) => (
                        <option key={ch.id} value={ch.name}>{ch.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Topic Dropdown */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-muted uppercase tracking-widest">Topic</label>
                      {(() => {
                        const topicObj = selectedChapter?.topics.find(t => t.name === selectedTopicName);
                        if (!topicObj) return null;
                        const isMastered = topicObj.status === 'Mastered';
                        const isCompleted = topicObj.status === 'Completed';
                        const isWeak = topicObj.status === 'Weak' || topicObj.status === 'Needs Revision';
                        return (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isMastered ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                            isCompleted ? 'bg-teal-50 text-teal-800 border-teal-300' :
                            isWeak ? 'bg-rose-50 text-rose-800 border-rose-300' :
                            'bg-amber-50 text-amber-800 border-amber-300'
                          }`}>
                            {topicObj.status}
                          </span>
                        );
                      })()}
                    </div>
                    <select
                      disabled={isActive}
                      value={selectedTopicName}
                      onChange={(e) => setSelectedTopicName(e.target.value)}
                      className="w-full p-2.5 bg-card border border-theme rounded-xl text-xs text-primary focus:outline-none focus:border-primary font-semibold min-h-[42px] cursor-pointer"
                    >
                      {selectedChapter?.topics.map((tp) => (
                        <option key={tp.id} value={tp.name}>
                          {tp.status === 'Mastered' ? '⭐ ' : tp.status === 'Completed' ? '✓ ' : ''}{tp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Quick Syllabus Launchers (Zen Sprint & Cheat Sheet) */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-theme/40 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-muted font-mono">Linked Tools:</span>
                    {onOpenZenSprint && (
                      <button
                        type="button"
                        onClick={() => onOpenZenSprint(selectedSubjectName, selectedTopicName)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Start Zen Sprint</span>
                      </button>
                    )}
                    {onOpenCheatSheet && (
                      <button
                        type="button"
                        onClick={() => onOpenCheatSheet(selectedSubjectName, selectedTopicName)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/20 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                      >
                        <BookOpen className="w-3 h-3" />
                        <span>AI Cheat Sheet</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMode('blurt');
                        handleGenerateBlurtPrompt();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span>AI Blurt & Notes</span>
                    </button>
                  </div>
                </div>

                {/* Time Saved on this topic display */}
                <div className="pt-2 border-t border-theme/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  {topicSavedStats.minutes > 0 ? (
                    <div className="flex items-center gap-2 text-primary font-medium">
                      <span className="p-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 inline-flex">
                        <Timer className="w-3.5 h-3.5" />
                      </span>
                      <span>
                        Saved on <strong>{selectedTopicName}</strong>: <strong className="text-primary">{topicSavedStats.minutes} mins</strong> across <strong>{topicSavedStats.count} session{topicSavedStats.count > 1 ? 's' : ''}</strong>
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-muted text-[11px]">
                      <Timer className="w-3.5 h-3.5 text-muted" />
                      <span>Timer duration automatically logs into <strong>Revision</strong> &amp; <strong>Progress</strong>.</span>
                    </div>
                  )}

                  {onNavigateTab && (
                    <button
                      type="button"
                      onClick={() => onNavigateTab('revision')}
                      className="text-[11px] font-bold text-primary hover:opacity-80 underline cursor-pointer self-start sm:self-auto"
                    >
                      Go to Revision Queue →
                    </button>
                  )}
                </div>
              </div>

              {/* Preset Selector */}
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {[25, 45, 60, 90].map((mins) => (
                  <button
                    key={mins}
                    disabled={isActive}
                    onClick={() => handleSetPreset(mins)}
                    className={`px-3.5 sm:px-4 py-2 rounded-full text-xs font-bold font-mono transition border min-h-[40px] active:scale-95 cursor-pointer ${
                      targetMinutes === mins
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'bg-surface text-muted border-theme hover:text-primary hover:border-primary/50'
                    }`}
                  >
                    {mins} min
                  </button>
                ))}

                <div className="flex items-center gap-1 bg-surface px-3 py-1.5 rounded-full border border-theme min-h-[40px]">
                  <input
                    type="number"
                    disabled={isActive}
                    min={1}
                    max={180}
                    value={customMinutes}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setCustomMinutes(val);
                      handleSetPreset(val);
                    }}
                    className="w-12 bg-transparent text-xs text-primary font-mono font-bold focus:outline-none text-center"
                  />
                  <span className="text-[11px] text-muted font-mono pr-1">custom min</span>
                </div>
              </div>

              {/* Original & Custom Timer Color Palette Selector */}
              <div className="flex items-center justify-center gap-1.5 flex-wrap pt-0.5">
                <div className="flex items-center gap-1.5 bg-surface border border-theme rounded-full px-3 py-1 text-[11px] font-mono text-muted shadow-2xs flex-wrap justify-center">
                  <Palette className="w-3.5 h-3.5 text-muted" />
                  <span className="font-semibold mr-1">Timer Color:</span>
                  {[
                    { id: 'original_sage', label: 'Classic Sage (Original)', hex: '#6B705C' },
                    { id: 'emerald', label: 'Emerald', hex: '#059669' },
                    { id: 'amber', label: 'Amber', hex: '#D97706' },
                    { id: 'classic', label: 'Obsidian', hex: '#374151' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setTimerColorTheme(t.id as any);
                        try { localStorage.setItem('studyflow_timer_color_theme', t.id); } catch {}
                      }}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition cursor-pointer flex items-center gap-1.5 min-h-[26px] ${
                        timerColorTheme === t.id
                          ? 'bg-primary text-white shadow-xs'
                          : 'text-muted hover:text-primary hover:bg-theme-accent'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.hex }} />
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Monumental Crisp Digital Clock */}
              <div className="text-center space-y-3 sm:space-y-4 py-2 sm:py-4">
                <div className={`text-6xl sm:text-8xl md:text-9xl font-mono font-bold tracking-tight ${timerThemeClasses.text} tabular-nums select-none transition-colors`}>
                  {formattedTime}
                </div>

                <p className={`text-xs font-mono font-bold ${timerThemeClasses.text} tracking-widest uppercase`}>
                  {isActive ? (isPaused ? '⏸ SESSION PAUSED' : '⚡ FOCUSING IN PROGRESS') : 'READY TO STUDY'}
                </p>

                {/* Progress Bar */}
                <div className="w-full max-w-md mx-auto bg-theme-accent h-2.5 rounded-full overflow-hidden border border-theme shadow-2xs">
                  <div
                    className={`${timerThemeClasses.bar} h-full rounded-full transition-all duration-300`}
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>

                {/* Ambient Sound Bar */}
                <div className="inline-flex items-center justify-center gap-2 bg-theme-accent/60 border border-theme rounded-full px-3.5 py-1.5 text-xs text-primary mt-2">
                  <button
                    onClick={() => setIsAmbientSoundOn(!isAmbientSoundOn)}
                    className="flex items-center gap-1.5 font-semibold hover:opacity-80 transition cursor-pointer"
                    title={isAmbientSoundOn ? "Mute Study Ambient Noise" : "Enable Study Ambient Noise"}
                  >
                    {isAmbientSoundOn ? <Volume2 className="w-3.5 h-3.5 text-primary" /> : <VolumeX className="w-3.5 h-3.5 text-muted" />}
                    <span className="text-[11px] font-mono">
                      {isAmbientSoundOn ? `${ambientSoundType.toUpperCase()}` : 'Ambient Sound'}
                    </span>
                  </button>

                  {isAmbientSoundOn && (
                    <>
                      <div className="h-3 w-px bg-theme"></div>
                      <select
                        value={ambientSoundType}
                        onChange={(e) => setAmbientSoundType(e.target.value as any)}
                        className="bg-transparent text-[11px] font-mono font-bold text-primary focus:outline-none cursor-pointer"
                      >
                        <option value="white" className="bg-card text-primary">White Noise</option>
                        <option value="pink" className="bg-card text-primary">Pink Noise</option>
                        <option value="rain" className="bg-card text-primary">Soft Rain</option>
                      </select>
                      <input
                        type="range"
                        min={0.02}
                        max={0.4}
                        step={0.02}
                        value={ambientVolume}
                        onChange={(e) => setAmbientVolume(parseFloat(e.target.value))}
                        className="w-12 sm:w-16 accent-current cursor-pointer"
                        title={`Volume: ${Math.round(ambientVolume * 100)}%`}
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Controls Bar */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 pt-2">
                {!isActive && !isPaused && (
                  <button
                    onClick={handleStartTimer}
                    className="px-7 sm:px-10 py-3.5 sm:py-4 rounded-full bg-primary hover:opacity-90 text-white font-medium text-xs sm:text-sm tracking-wider uppercase transition shadow-md flex items-center justify-center gap-2.5 active:scale-95 cursor-pointer min-h-[46px]"
                  >
                    <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                    <span>START STUDY SESSION</span>
                  </button>
                )}

                {isActive && !isPaused && (
                  <button
                    onClick={handlePauseTimer}
                    className="px-5 sm:px-6 py-3 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider transition shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 min-h-[44px]"
                  >
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Pause</span>
                  </button>
                )}

                {isActive && isPaused && (
                  <button
                    onClick={handleResumeTimer}
                    className="px-5 sm:px-6 py-3 rounded-full bg-primary hover:opacity-90 text-white font-bold text-xs uppercase tracking-wider transition shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 min-h-[44px]"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Resume</span>
                  </button>
                )}

                {(isActive || secondsLeft < targetMinutes * 60) && (
                  <button
                    onClick={handleStopTimer}
                    className="px-5 sm:px-6 py-3 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider transition shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 min-h-[44px]"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    <span>Finish & Record</span>
                  </button>
                )}

                <button
                  onClick={handleResetTimer}
                  className="p-3 rounded-full bg-surface hover:opacity-85 text-muted hover:text-primary border border-theme transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95"
                  title="Reset Timer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* VIEW 2: INTEGRATED AI BLURT RECALL & NOTES/DIAGRAM UPLOAD */}
      {activeMode === 'blurt' && (
        <motion.div
          variants={timerEntranceItemVariants}
          className="bg-card border border-theme rounded-3xl p-5 sm:p-8 shadow-xs space-y-6 transition-colors"
        >
          {/* Studio Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-theme/50 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <Zap className="w-4 h-4 text-amber-400" />
                </span>
                <h3 className="text-base sm:text-lg font-serif italic font-bold text-primary">
                  AI Active Retrieval, Oral Socratic Exam &amp; Notes Upload
                </h3>
              </div>
              <p className="text-xs text-muted mt-1">
                Active recall test for <strong>{selectedTopicName}</strong> ({selectedSubjectName}). Brain-dump recall, dictate in English/Urdu, snap multi-page handwritten work, or test your conceptual depth with Socratic oral examination.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              {/* Written vs Socratic Sub-tab Switcher */}
              <div className="flex items-center bg-surface border border-theme rounded-xl p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveBlurtTab('written')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeBlurtTab === 'written'
                      ? 'bg-primary text-white shadow-2xs'
                      : 'text-muted hover:text-primary'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Written / Photos</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveBlurtTab('socratic');
                    if (!socraticQuestion) {
                      handleGenerateSocraticQuestion();
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeBlurtTab === 'socratic'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-muted hover:text-primary'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5 text-amber-300" />
                  <span>Socratic Oral Exam</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setActiveMode('timer')}
                className="px-3.5 py-2 rounded-xl bg-theme-accent border border-theme text-primary hover:opacity-85 text-xs font-semibold flex items-center gap-1.5 cursor-pointer min-h-[36px]"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Timer</span>
              </button>
            </div>
          </div>

          {/* Feedback alerts */}
          {blurtSuccessMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{blurtSuccessMsg}</span>
              </div>
              <button onClick={() => setBlurtSuccessMsg(null)} className="p-1 text-current opacity-70 hover:opacity-100 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {blurtError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{blurtError}</span>
              </div>
              <button onClick={() => setBlurtError(null)} className="p-1 text-current opacity-70 hover:opacity-100 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* TAB 1: WRITTEN BLURT & MULTI-IMAGE UPLOAD */}
          {activeBlurtTab === 'written' ? (
            <>
              {/* Step 1: AI Prompt Guidance */}
              <div className="bg-surface border border-theme rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-primary font-mono flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>1. AI Topic Retrieval Guidance</span>
                  </span>

                  <button
                    type="button"
                    onClick={handleGenerateBlurtPrompt}
                    disabled={isGeneratingPrompt}
                    className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[34px]"
                  >
                    {isGeneratingPrompt ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Generating Prompt...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>{blurtPrompt ? 'Regenerate Retrieval Cue' : 'Generate AI Retrieval Cue'}</span>
                      </>
                    )}
                  </button>
                </div>

                {blurtPrompt ? (
                  <div className="p-3 bg-card border border-theme rounded-xl text-xs text-primary leading-relaxed">
                    <strong className="text-amber-600 dark:text-amber-400 font-mono text-[11px] block mb-1">PROMPT:</strong>
                    {blurtPrompt}
                  </div>
                ) : (
                  <p className="text-xs text-muted">
                    Click "Generate AI Retrieval Cue" for targeted exam questions on <em>{selectedTopicName}</em>, or begin typing/dictating your recall below.
                  </p>
                )}
              </div>

              {/* Step 2: Active Recall Brain Dump with Bilingual Voice-to-Text */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    <span>2. Active Recall (Feynman Brain-Dump)</span>
                  </label>

                  <div className="flex items-center gap-2">
                    {/* Bilingual Language Selector */}
                    <div className="flex items-center bg-surface border border-theme rounded-lg p-0.5 text-[11px]">
                      <Languages className="w-3 h-3 text-muted ml-1.5 mr-1" />
                      <button
                        type="button"
                        onClick={() => setSpeechLang('en-US')}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                          speechLang === 'en-US' ? 'bg-primary text-white' : 'text-muted'
                        }`}
                      >
                        EN
                      </button>
                      <button
                        type="button"
                        onClick={() => setSpeechLang('ur-PK')}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                          speechLang === 'ur-PK' ? 'bg-primary text-white' : 'text-muted'
                        }`}
                      >
                        اردو
                      </button>
                    </div>

                    {/* Voice Dictation Button */}
                    <button
                      type="button"
                      onClick={handleToggleVoiceDictation}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border min-h-[30px] ${
                        isListening
                          ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                          : 'bg-theme-accent border-theme text-primary hover:opacity-85'
                      }`}
                      title="Voice-to-Text Dictation (English / Urdu)"
                    >
                      {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-rose-500" />}
                      <span>{isListening ? `Listening (${speechLang === 'ur-PK' ? 'اردو' : 'EN'})...` : 'Dictate'}</span>
                    </button>

                    <span className="text-[11px] font-mono text-muted">
                      {blurtRecallText.trim().split(/\s+/).filter(Boolean).length} words
                    </span>
                  </div>
                </div>

                <textarea
                  rows={4}
                  value={blurtRecallText}
                  onChange={(e) => setBlurtRecallText(e.target.value)}
                  placeholder={`Write or dictate everything you remember about ${selectedTopicName}: key formulas, definitions, working steps, derivations, or common exam traps...`}
                  className="w-full p-3.5 bg-surface border border-theme rounded-2xl text-xs text-primary placeholder-muted focus:outline-none focus:border-primary resize-y leading-relaxed font-sans"
                />
              </div>

              {/* Step 3: Multi-Photo Upload for Handwritten Notes & Diagrams */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-indigo-500" />
                    <span>3. Multi-Photo Upload: Handwritten Work &amp; Diagrams ({attachedImages.length})</span>
                  </label>
                  <span className="text-[10px] font-mono text-muted">Select multiple pages or diagrams</span>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleProcessImageFiles(e.target.files);
                    }
                  }}
                />

                {attachedImages.length === 0 ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        handleProcessImageFiles(e.dataTransfer.files);
                      }
                    }}
                    className="border-2 border-dashed border-theme hover:border-primary rounded-2xl p-6 text-center cursor-pointer transition-colors bg-surface/50 hover:bg-surface flex flex-col items-center justify-center gap-2.5 min-h-[130px]"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                      {isProcessingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-primary">
                        {isProcessingImage ? 'Optimizing photos for AI...' : 'Tap to select single or multiple photos of handwritten work'}
                      </p>
                      <p className="text-[11px] text-muted mt-0.5">
                        Upload multi-page notes, diagrams, or step derivations &bull; OCR auto-reads equations
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {attachedImages.map((img) => (
                        <div key={img.id} className="relative p-2 rounded-2xl bg-surface border border-theme group">
                          <img
                            src={img.dataUrl}
                            alt={img.fileName}
                            className="w-full h-24 object-cover rounded-xl border border-theme"
                          />
                          <div className="mt-1.5 min-w-0">
                            <p className="text-[11px] font-bold text-primary truncate">{img.fileName}</p>
                            <p className="text-[10px] font-mono text-muted">{(img.fileSizeBytes / 1024).toFixed(1)} KB</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(img.id)}
                            className="absolute top-3 right-3 p-1.5 rounded-full bg-rose-600 text-white shadow-xs hover:bg-rose-700 transition cursor-pointer"
                            title="Remove photo"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}

                      {/* Add more button tile */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-full min-h-[110px] rounded-2xl border-2 border-dashed border-theme hover:border-primary flex flex-col items-center justify-center gap-1 text-muted hover:text-primary transition cursor-pointer bg-surface/40 hover:bg-surface"
                      >
                        <Camera className="w-5 h-5" />
                        <span className="text-xs font-bold">+ Add Page</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Evaluate Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleEvaluateBlurt}
                  disabled={isEvaluatingBlurt || (!blurtRecallText.trim() && attachedImages.length === 0)}
                  className="w-full py-3.5 px-5 rounded-2xl bg-primary hover:opacity-90 text-white text-xs sm:text-sm font-bold tracking-wide uppercase transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-40 min-h-[46px]"
                >
                  {isEvaluatingBlurt ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                      <span>Evaluating Recall &amp; {attachedImages.length} Handwritten Photo(s) with Gemini AI...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-amber-300 fill-current" />
                      <span>Evaluate Recall &amp; Verify Notes with AI ({attachedImages.length} photo{attachedImages.length === 1 ? '' : 's'})</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            /* TAB 2: SOCRATIC ORAL EXAM ARENA */
            <div className="space-y-4">
              <div className="bg-surface border border-theme rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
                    <span className="text-xs font-bold uppercase tracking-widest text-primary font-mono">
                      Socratic Oral Examiner
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateSocraticQuestion}
                    disabled={isEvaluatingSocratic}
                    className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[34px]"
                  >
                    {isEvaluatingSocratic && !socraticQuestion ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>New Oral Question</span>
                  </button>
                </div>

                {socraticQuestion ? (
                  <div className="p-4 rounded-xl bg-card border border-theme space-y-1">
                    <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                      Examiner Probing Question:
                    </span>
                    <p className="text-sm font-semibold text-primary leading-relaxed">
                      "{socraticQuestion}"
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-6 text-xs text-muted">
                    <p>Click "New Oral Question" to begin your interactive viva / Socratic interrogation on <strong>{selectedTopicName}</strong>.</p>
                  </div>
                )}
              </div>

              {socraticQuestion && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Your Spoken or Written Oral Defense</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-surface border border-theme rounded-lg p-0.5 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setSpeechLang('en-US')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                            speechLang === 'en-US' ? 'bg-primary text-white' : 'text-muted'
                          }`}
                        >
                          EN
                        </button>
                        <button
                          type="button"
                          onClick={() => setSpeechLang('ur-PK')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                            speechLang === 'ur-PK' ? 'bg-primary text-white' : 'text-muted'
                          }`}
                        >
                          اردو
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleToggleVoiceDictation}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                          isListening
                            ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                            : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                        <span>{isListening ? `Speaking (${speechLang === 'ur-PK' ? 'اردو' : 'EN'})...` : 'Speak Your Answer'}</span>
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={4}
                    value={socraticAnswer}
                    onChange={(e) => setSocraticAnswer(e.target.value)}
                    placeholder="Speak into microphone or type your defense here. Explain the core mechanism, why it holds, and which condition must never be forgotten..."
                    className="w-full p-3.5 bg-surface border border-theme rounded-2xl text-xs text-primary placeholder-muted focus:outline-none focus:border-primary resize-y leading-relaxed font-sans"
                  />

                  <button
                    type="button"
                    onClick={handleEvaluateSocraticAnswer}
                    disabled={isEvaluatingSocratic || !socraticAnswer.trim()}
                    className="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-40 min-h-[44px]"
                  >
                    {isEvaluatingSocratic ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                        <span>Socratic Examiner Analyzing Rigor &amp; Misconceptions...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 text-amber-300" />
                        <span>Submit Oral Defense to Examiner</span>
                      </>
                    )}
                  </button>

                  {/* Socratic Feedback Results */}
                  {socraticFeedback && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-5 rounded-2xl bg-surface border border-theme space-y-4"
                    >
                      <div className="flex items-center justify-between gap-3 border-b border-theme/50 pb-3">
                        <div>
                          <span className="text-[10px] font-mono uppercase tracking-widest text-muted block">
                            Oral Exam Evaluation
                          </span>
                          <span className="text-sm font-bold text-primary">Conceptual Depth Result</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-mono font-bold text-primary">{socraticFeedback.score}%</span>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                          <strong className="block mb-0.5">Strengths:</strong>
                          {socraticFeedback.praise}
                        </div>

                        {socraticFeedback.misconception ? (
                          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 space-y-2">
                            <div>
                              <strong className="block mb-0.5">Misconception / Omitted Condition:</strong>
                              {socraticFeedback.misconception}
                            </div>
                            {socraticFeedback.correctUnderstanding && (
                              <div className="text-[11px] opacity-90 border-t border-rose-500/20 pt-1.5">
                                <strong>FBISE Mark Scheme Reference:</strong> {socraticFeedback.correctUnderstanding}
                              </div>
                            )}
                            <div className="pt-1">
                              <button
                                type="button"
                                disabled={socraticMistakeLogged}
                                onClick={handleLogSocraticMistake}
                                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                              >
                                {socraticMistakeLogged ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                                <span>{socraticMistakeLogged ? 'Recorded in Mistake Vault ✓' : 'Send Misconception to Mistake Vault 📥'}</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                            Excellent conceptual mastery! No misconceptions detected.
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* AI DIAGNOSTIC EVALUATION RESULTS (for Written Blurt) */}
          {activeBlurtTab === 'written' && blurtEvaluation && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface border border-theme rounded-2xl p-5 sm:p-6 space-y-5"
            >
              {/* Score & Retention Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme/50 pb-4">
                <div>
                  <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-muted">
                    Recall Evaluation &bull; FBISE Mark Scheme Check
                  </div>
                  <h4 className="text-lg font-serif italic font-bold text-primary mt-0.5">
                    {blurtEvaluation.topicName}
                  </h4>
                </div>

                <div className="flex items-center gap-3">
                  {/* Score Meter */}
                  <div className="text-right">
                    <div className="text-2xl sm:text-3xl font-mono font-bold text-primary">
                      {blurtEvaluation.recallScore}%
                    </div>
                    <div className="text-[10px] font-mono text-muted uppercase">Recall Accuracy</div>
                  </div>

                  {/* Retention Badge */}
                  <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold font-mono ${
                    blurtEvaluation.recallScore >= 80 ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' :
                    blurtEvaluation.recallScore >= 60 ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30' :
                    'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30'
                  }`}>
                    {blurtEvaluation.retentionLevel}
                  </div>
                </div>
              </div>

              {/* Recalled Concepts vs Gaps Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Successfully Recalled */}
                <div className="p-4 rounded-2xl bg-card border border-theme space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Recalled Concepts ({blurtEvaluation.recalledConcepts.length})</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-primary">
                    {blurtEvaluation.recalledConcepts.map((c, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-600 mt-0.5">•</span>
                        <span>{c}</span>
                      </li>
                    ))}
                    {blurtEvaluation.recalledConcepts.length === 0 && (
                      <li className="text-xs text-muted italic">No key concepts identified in this attempt.</li>
                    )}
                  </ul>
                </div>

                {/* Knowledge Gaps & Pitfalls with 1-Click Vault Sync */}
                <div className="p-4 rounded-2xl bg-card border border-theme space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Knowledge Gaps &amp; Traps ({blurtEvaluation.knowledgeGaps.length})</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    {blurtEvaluation.knowledgeGaps.map((g, i) => (
                      <div key={i} className="p-2.5 rounded-xl bg-theme-accent border border-theme text-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-bold text-primary">{g.concept}</div>
                          <button
                            type="button"
                            disabled={loggedMistakeGaps[i]}
                            onClick={() => {
                              addMistake({
                                subject: selectedSubjectName,
                                chapter: selectedChapterName,
                                topic: selectedTopicName,
                                question: `Recall & Explain: ${g.concept}`,
                                studentAnswer: blurtRecallText.slice(0, 250) || 'Missing during active recall',
                                correctAnswer: g.explanation,
                                category: 'conceptual_misconception',
                                studentThoughtProcess: `Omitted or misremembered during active recall session: ${g.concept}`,
                                tags: ['ActiveRecallGap', selectedSubjectName]
                              });
                              setLoggedMistakeGaps(prev => ({ ...prev, [i]: true }));
                              setBlurtSuccessMsg(`"${g.concept}" logged in Mistake Vault for spaced review!`);
                            }}
                            className="px-2 py-0.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/20 text-[10px] font-bold transition flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
                          >
                            {loggedMistakeGaps[i] ? <Check className="w-3 h-3 text-emerald-600" /> : <AlertCircle className="w-3 h-3" />}
                            <span>{loggedMistakeGaps[i] ? 'Logged in Vault' : 'Add to Mistake Vault'}</span>
                          </button>
                        </div>
                        <div className="text-[11px] text-muted leading-relaxed">{g.explanation}</div>
                      </div>
                    ))}
                    {blurtEvaluation.knowledgeGaps.length === 0 && (
                      <div className="text-xs text-muted italic">Great work! No critical gaps found.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Diagram / OCR Handwritten Notes Feedback if present */}
              {blurtEvaluation.diagramNotes && (
                <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs space-y-1">
                  <div className="font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" />
                    <span>Handwritten Notes &amp; Diagram Feedback</span>
                  </div>
                  <p className="text-primary leading-relaxed">{blurtEvaluation.diagramNotes}</p>
                </div>
              )}

              {/* Actionable Next Steps: Syllabus & Revision Integration */}
              <div className="pt-2 border-t border-theme/50 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Mark as Mastered / Completed */}
                  <button
                    type="button"
                    onClick={() => handleUpdateSyllabusStatus(blurtEvaluation.recallScore >= 80 ? 'Mastered' : 'Completed')}
                    disabled={isUpdatingSyllabus}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50 min-h-[38px]"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>
                      {blurtEvaluation.recallScore >= 80 ? 'Mark Mastered in Syllabus' : 'Mark Completed in Syllabus'}
                    </span>
                  </button>

                  {/* Add Gaps to Revision Queue */}
                  {blurtEvaluation.knowledgeGaps.length > 0 && onSaveRevision && (
                    <button
                      type="button"
                      onClick={handleAddGapsToRevisionQueue}
                      disabled={isAddingToRevision}
                      className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50 min-h-[38px]"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Queue Gaps for Tomorrow's Revision</span>
                    </button>
                  )}
                </div>

                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('revision')}
                    className="text-xs font-bold text-primary hover:opacity-80 underline cursor-pointer"
                  >
                    View in Revision Manager →
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* ZEN FULLSCREEN FOCUS OVERLAY */}
      <AnimatePresence>
        {isFullscreenFocus && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ backgroundColor: 'var(--bg-app)' }}
            className="fixed inset-0 z-[100] flex flex-col justify-between p-6 sm:p-10 overflow-y-auto text-primary"
          >
            {/* Minimal Fullscreen Header */}
            <div className="flex items-center justify-between max-w-4xl w-full mx-auto">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary">Distraction-Free Zen Focus</span>
                <span className="text-xs text-muted">&bull; {selectedSubjectName} &gt; {selectedTopicName}</span>
              </div>
              <button
                onClick={() => setIsFullscreenFocus(false)}
                className="p-2.5 rounded-full bg-theme-accent border border-theme text-primary hover:opacity-85 transition cursor-pointer min-h-[40px] flex items-center gap-1.5 text-xs font-bold"
              >
                <Minimize2 className="w-4 h-4" />
                <span>Exit Fullscreen</span>
              </button>
            </div>

            {/* Monumental Center Clock */}
            <div className="max-w-2xl w-full mx-auto my-auto text-center space-y-6">
              <div className="text-8xl sm:text-[10rem] md:text-[12rem] font-mono font-bold tracking-tight text-primary tabular-nums">
                {formattedTime}
              </div>
              <p className="text-xs font-mono font-bold tracking-widest text-muted uppercase">
                {isActive ? (isPaused ? '⏸ SESSION PAUSED' : '⚡ DEEP FOCUS ACTIVE') : 'READY'}
              </p>
              <div className="flex items-center justify-center gap-3">
                {isActive && !isPaused ? (
                  <button onClick={handlePauseTimer} className="px-6 py-3 rounded-full bg-amber-600 text-white font-bold text-xs uppercase cursor-pointer">
                    Pause
                  </button>
                ) : (
                  <button onClick={isActive ? handleResumeTimer : handleStartTimer} className="px-8 py-3.5 rounded-full bg-primary text-white font-bold text-xs uppercase cursor-pointer">
                    {isActive ? 'Resume' : 'Start Focus'}
                  </button>
                )}
                <button onClick={handleStopTimer} className="px-6 py-3 rounded-full bg-rose-600 text-white font-bold text-xs uppercase cursor-pointer">
                  Finish
                </button>
              </div>
            </div>

            <div className="text-center text-xs text-muted font-mono max-w-xl w-full mx-auto">
              Press Exit Fullscreen or finish your session whenever you are ready.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Finish Session Result Modal */}
      <AnimatePresence>
        {isFinishModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="bg-card border border-theme rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-xl relative text-primary space-y-4 max-h-[92vh] overflow-y-auto"
            >
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-serif italic font-bold text-primary">Study Session Finished!</h3>
              <p className="text-xs text-muted">
                {selectedSubjectName} — <span className="text-primary font-bold">{selectedTopicName}</span>
              </p>
            </div>

            {/* Time Spent / Duration Editor */}
            <div className="p-3.5 rounded-2xl bg-surface border border-theme space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-widest text-primary">
                  Focused Time Spent
                </label>
                <span className="text-xs font-mono font-bold text-primary">
                  {sessionLoggedMinutes} mins
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={sessionLoggedMinutes}
                  onChange={(e) => setSessionLoggedMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 p-2 bg-card border border-theme rounded-xl text-xs font-mono font-bold text-primary focus:outline-none focus:border-primary min-h-[40px]"
                />
                <span className="text-xs text-muted">minutes focused ("I did this in this time")</span>
              </div>
            </div>

            {/* Status Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-muted">How did this topic go?</label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedResult('Completed')}
                  className={`p-3 rounded-2xl border text-xs font-bold text-left transition flex items-center justify-between cursor-pointer active:scale-98 ${
                    selectedResult === 'Completed'
                      ? 'bg-primary/15 border-primary text-primary'
                      : 'bg-surface border-theme text-muted hover:bg-theme-accent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">✅</span>
                    <span>Topic Completed Fully</span>
                  </div>
                  <span className="text-[10px] uppercase font-mono">Mastered / Done</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedResult('Partially completed')}
                  className={`p-3 rounded-2xl border text-xs font-bold text-left transition flex items-center justify-between cursor-pointer active:scale-98 ${
                    selectedResult === 'Partially completed'
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-900 dark:text-amber-200'
                      : 'bg-surface border-theme text-muted hover:bg-theme-accent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">⚠️</span>
                    <span>Partially Completed</span>
                  </div>
                  <span className="text-[10px] uppercase font-mono">In Progress</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedResult('Not completed')}
                  className={`p-3 rounded-2xl border text-xs font-bold text-left transition flex items-center justify-between cursor-pointer active:scale-98 ${
                    selectedResult === 'Not completed'
                      ? 'bg-rose-500/15 border-rose-500/40 text-rose-900 dark:text-rose-200'
                      : 'bg-surface border-theme text-muted hover:bg-theme-accent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">❌</span>
                    <span>Needs Review / More Practice</span>
                  </div>
                  <span className="text-[10px] uppercase font-mono">Needs Work</span>
                </button>
              </div>
            </div>

            {/* 60-Second Feynman Blurt (Option 4) */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-primary flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>60-Second Feynman Blurt (Option 4)</span>
                </span>
                <span className="text-[10px] font-mono text-amber-700 dark:text-amber-300">Locks in recall</span>
              </div>
              <p className="text-[11px] text-muted leading-tight">
                In 1-2 sentences, what was the core takeaway or formula? Blurting it out cements neural pathways.
              </p>
              <textarea
                value={feynmanBlurt}
                onChange={(e) => setFeynmanBlurt(e.target.value)}
                placeholder="e.g., Core takeaway: when temperature increases, reaction rate doubles because..."
                rows={2}
                className="w-full p-2.5 bg-card border border-theme rounded-xl text-xs text-primary placeholder-muted focus:outline-none focus:border-amber-500 resize-none leading-relaxed"
              />
            </div>

            {/* Optional Notes */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-1">Optional Session Notes</label>
              <input
                type="text"
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="Key formulas, concepts grasped, or difficulty notes..."
                className="w-full p-2.5 bg-surface border border-theme rounded-xl text-xs text-primary focus:outline-none focus:border-primary min-h-[40px]"
              />
            </div>

            {/* Target Email Hint */}
            {(userProfile?.email || user?.email || getActiveUserEmail()) && (
              <div className="text-[11px] text-muted flex items-center gap-1.5 px-1">
                <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">Recipient: <strong className="text-primary">{userProfile?.email || user?.email || getActiveUserEmail()}</strong></span>
              </div>
            )}

            {/* Revision & Progress Saving Notice */}
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Saving {sessionLoggedMinutes}m to Revision & Progress</span>
              </div>
              <p className="text-[11px] opacity-90 leading-relaxed">
                This study duration will be automatically recorded in your <strong>Revision Queue</strong> and <strong>Progress</strong> analytics for <em>"{selectedTopicName}"</em>.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleSaveAndStartBlurt}
                disabled={isSendingEmail}
                className="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs min-h-[44px]"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>Save & Evaluate with AI Blurt (Lock in Recall)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveResult(true)}
                disabled={isSendingEmail}
                className="w-full py-2.5 px-4 rounded-xl bg-primary hover:opacity-90 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 min-h-[42px]"
              >
                {isSendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>Save to Revision & Email Summary</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const msg = generateCompletedWorkWhatsAppMessage({
                    studentName: userProfile?.name || 'Student',
                    subjectName: selectedSubjectName,
                    topicName: selectedTopicName,
                    durationMinutes: sessionLoggedMinutes,
                    notes: sessionNotes || feynmanBlurt,
                    status: selectedResult,
                  });
                  const url = buildWhatsAppDirectUrl(userProfile?.whatsappNumber || '', msg);
                  window.open(url, '_blank', 'noopener,noreferrer');
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs min-h-[42px]"
              >
                <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Share Notice via WhatsApp 📲</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveResult(false)}
                  disabled={isSendingEmail}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center cursor-pointer shadow-xs min-h-[42px]"
                >
                  <Check className="w-4 h-4 mr-1.5" />
                  <span>Save to Revision & Progress</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsFinishModalOpen(false)}
                  disabled={isSendingEmail}
                  className="px-4 py-2.5 rounded-xl text-muted hover:text-primary text-xs font-bold transition cursor-pointer min-h-[42px]"
                >
                  Cancel
                </button>
              </div>
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

