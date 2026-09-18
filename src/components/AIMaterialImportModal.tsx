import React, { useState } from 'react';
import { 
  Upload, 
  FileText, 
  Sparkles, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight, 
  Layers, 
  BookOpen, 
  Zap, 
  Clock, 
  ListChecks, 
  Calendar, 
  Plus, 
  Trash2, 
  Edit3, 
  X, 
  HelpCircle, 
  Brain,
  HardDrive,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { Subject, FlashcardDeck, PracticeQuestion, StudyPlanTopic } from '../types';
import { apiExtractStudyMaterial } from '../lib/aiApi';
import { listDriveFiles, downloadDriveFileContent, downloadDriveFileBinary, DriveFileItem } from '../lib/googleDriveService';
import { getOrRequestWorkspaceToken } from '../lib/googleAuthService';
import { fileOrBlobToBase64 } from '../lib/base64Utils';

interface AIMaterialImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApproveAndSave: (extracted: {
    subjects: Subject[];
    flashcardDecks: FlashcardDeck[];
    practiceQuestions: PracticeQuestion[];
    studyTasks: StudyPlanTopic[];
    overview?: {
      title: string;
      executiveSummary: string;
      keyConceptsCovered: string[];
      recommendedWeeklyPace: string;
    };
  }) => void;
}

type InputMode = 'file' | 'text' | 'gdrive';
type WizardStep = 'input' | 'analyzing' | 'review';
type ReviewTab = 'overview' | 'syllabus' | 'flashcards' | 'questions' | 'tasks';

export function AIMaterialImportModal({
  isOpen,
  onClose,
  onApproveAndSave
}: AIMaterialImportModalProps) {
  const [step, setStep] = useState<WizardStep>('input');
  const [inputMode, setInputMode] = useState<InputMode>('file');

  // Generation Component Selectors (Flashcards is false by default so it's NOT generated from the get-go unless chosen!)
  const [generateSyllabus, setGenerateSyllabus] = useState(true);
  const [generateFlashcards, setGenerateFlashcards] = useState(false);
  const [generateQuestions, setGenerateQuestions] = useState(false);
  const [generateTasks, setGenerateTasks] = useState(true);

  // Input states
  const [pastedText, setPastedText] = useState('');
  const [sourceTitle, setSourceTitle] = useState('');
  const [targetExamDate, setTargetExamDate] = useState('');
  const [dailyHours, setDailyHours] = useState<number>(3);
  
  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileMimeType, setFileMimeType] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Google Drive browser state
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [selectedDriveFile, setSelectedDriveFile] = useState<DriveFileItem | null>(null);

  // Analysis result state
  const [analyzingStage, setAnalyzingStage] = useState('Initializing AI study extraction engine...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Review states (editable by user)
  const [reviewTab, setReviewTab] = useState<ReviewTab>('overview');
  const [extractedOverview, setExtractedOverview] = useState<{
    title: string;
    executiveSummary: string;
    keyConceptsCovered: string[];
    recommendedWeeklyPace: string;
  } | null>(null);
  const [extractedSubjects, setExtractedSubjects] = useState<Subject[]>([]);
  const [extractedDecks, setExtractedDecks] = useState<FlashcardDeck[]>([]);
  const [extractedQuestions, setExtractedQuestions] = useState<PracticeQuestion[]>([]);
  const [extractedTasks, setExtractedTasks] = useState<StudyPlanTopic[]>([]);

  if (!isOpen) return null;

  // File Handlers
  const handleFileChange = async (file: File) => {
    setSelectedFile(file);
    if (!sourceTitle) {
      setSourceTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
    setFileMimeType(file.type || 'application/octet-stream');
    try {
      if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md') || file.name.endsWith('.json')) {
        const text = await file.text();
        setPastedText(text);
        setFileBase64(null);
      } else {
        const base64 = await fileOrBlobToBase64(file);
        setFileBase64(base64);
      }
    } catch (e) {
      console.warn('Could not preload file data:', e);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Google Drive Browser
  const handleLoadDriveFiles = async () => {
    setLoadingDrive(true);
    setDriveError(null);
    try {
      await getOrRequestWorkspaceToken();
      const files = await listDriveFiles({
        pageSize: 40
      });
      setDriveFiles(files);
    } catch (err: any) {
      setDriveError(err.message || 'Failed to connect to Google Drive.');
    } finally {
      setLoadingDrive(false);
    }
  };

  const handleSelectDriveFile = async (file: DriveFileItem) => {
    setSelectedDriveFile(file);
    if (!sourceTitle) {
      setSourceTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  // Start Extraction
  const handleStartAnalysis = async () => {
    setErrorMsg(null);
    setStep('analyzing');
    setAnalyzingStage('Reading document structure and content...');

    try {
      let contentText = pastedText;
      let dataBase64 = fileBase64 || undefined;
      let mime = fileMimeType || undefined;

      if (inputMode === 'file' && selectedFile) {
        setAnalyzingStage(`Reading "${selectedFile.name}"...`);
        mime = selectedFile.type || 'application/pdf';
        if (selectedFile.type.startsWith('text/') || selectedFile.name.endsWith('.txt') || selectedFile.name.endsWith('.md') || selectedFile.name.endsWith('.json')) {
          contentText = await selectedFile.text();
        } else {
          dataBase64 = await fileOrBlobToBase64(selectedFile);
        }
      } else if (inputMode === 'gdrive' && selectedDriveFile) {
        setAnalyzingStage(`Fetching content from Google Drive file "${selectedDriveFile.name}"...`);
        const isDoc = selectedDriveFile.mimeType === 'application/vnd.google-apps.document' || 
                      selectedDriveFile.mimeType === 'text/plain' || 
                      selectedDriveFile.mimeType === 'application/vnd.google-apps.spreadsheet';
        
        if (isDoc) {
          contentText = await downloadDriveFileContent(selectedDriveFile.id, selectedDriveFile.mimeType);
        } else {
          const binary = await downloadDriveFileBinary(selectedDriveFile.id);
          dataBase64 = binary.base64;
          mime = binary.mimeType;
        }
      }

      if (!contentText?.trim() && !dataBase64) {
        throw new Error('Please upload a document, paste notes, or select a file from Google Drive first.');
      }

      if (generateSyllabus) {
        setAnalyzingStage('Extracting Subjects, Chapters, and Topics hierarchy...');
        await new Promise(r => setTimeout(r, 400));
      }

      if (generateFlashcards) {
        setAnalyzingStage('Generating high-yield active-recall flashcards & mnemonics...');
        await new Promise(r => setTimeout(r, 400));
      }
      
      const response = await apiExtractStudyMaterial({
        text: contentText || undefined,
        fileData: dataBase64,
        mimeType: mime,
        sourceTitle: sourceTitle || 'Uploaded Study Material',
        targetExamDate: targetExamDate || undefined,
        dailyHours: dailyHours || 3,
        generateSyllabus,
        generateFlashcards,
        generateQuestions,
        generateTasks
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to parse study material.');
      }

      const data = response.data;
      setExtractedOverview(data.overview || {
        title: sourceTitle || 'Study Curriculum',
        executiveSummary: 'AI structured study curriculum from your uploaded material.',
        keyConceptsCovered: [],
        recommendedWeeklyPace: `${dailyHours * 5} hours / week`
      });

      setExtractedSubjects(data.subjects || []);
      setExtractedDecks(data.flashcardDecks || []);
      setExtractedQuestions(data.practiceQuestions || []);
      setExtractedTasks(data.studyTasks || []);

      if (generateSyllabus && data.subjects && data.subjects.length > 0) {
        setReviewTab('syllabus');
      } else {
        setReviewTab('overview');
      }

      setStep('review');
    } catch (err: any) {
      console.error('Study material extraction error:', err);
      setErrorMsg(err.message || 'AI extraction failed. Please check the document and try again.');
      setStep('input');
    }
  };

  // User Actions during Review
  const handleDeleteSubject = (subjectId: string) => {
    setExtractedSubjects(prev => prev.filter(s => s.id !== subjectId));
  };

  const handleDeleteCard = (deckId: string, cardId: string) => {
    setExtractedDecks(prev => prev.map(d => {
      if (d.id === deckId) {
        return { ...d, cards: d.cards.filter(c => c.id !== cardId) };
      }
      return d;
    }));
  };

  const handleDeleteQuestion = (qId: string) => {
    setExtractedQuestions(prev => prev.filter(q => q.id !== qId));
  };

  const handleDeleteTask = (taskId: string) => {
    setExtractedTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const handleApprove = () => {
    onApproveAndSave({
      subjects: generateSyllabus ? extractedSubjects : [],
      flashcardDecks: generateFlashcards ? extractedDecks : [],
      practiceQuestions: generateQuestions ? extractedQuestions : [],
      studyTasks: generateTasks ? extractedTasks : [],
      overview: extractedOverview || undefined
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Autonomous Study Material Ingestion
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                  AI Pipeline
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload your notes, syllabus, or Google Docs to autonomously generate curriculum, flashcards, questions & study plan.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* STEP 1: INPUT */}
          {step === 'input' && (
            <div className="space-y-6">
              {errorMsg && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 text-sm flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="flex-1">{errorMsg}</div>
                </div>
              )}

              {/* Source Mode Selector */}
              <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setInputMode('file')}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    inputMode === 'file'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  Upload File (PDF / Word / Image)
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('text')}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    inputMode === 'text'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Paste Text / Notes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInputMode('gdrive');
                    if (driveFiles.length === 0) handleLoadDriveFiles();
                  }}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    inputMode === 'gdrive'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <FolderOpen className="w-4 h-4" />
                  Google Drive / Docs
                </button>
              </div>

              {/* Quick Sample Selector for 1-Click Verification */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 rounded-2xl">
                <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200 font-medium">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Try with instant academic sample notes:</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode('text');
                      setSourceTitle('Class 12 Physics: Electromagnetism & Modern Physics');
                      setPastedText(`Chapter 1: Electrostatics and Electric Fields
- Coulomb's Law: Force between two point charges is directly proportional to product of charges and inversely proportional to square of distance. F = k*(q1*q2)/r^2.
- Electric Field Intensity: Force per unit positive charge. E = F/q. Measured in N/C or V/m.
- Electric Flux and Gauss's Law: Total flux through a closed Gaussian surface is 1/epsilon_0 times the net enclosed charge.

Chapter 2: Current Electricity & Circuits
- Ohm's Law and Resistivity: V = IR. Resistance depends on length, cross-sectional area, and material temperature coefficient.
- Kirchhoff's Current Law (KCL): Sum of currents entering a junction equals sum of currents leaving (charge conservation).
- Kirchhoff's Voltage Law (KVL): Sum of potential differences around any closed circuit loop is zero (energy conservation).

Chapter 3: Electromagnetic Induction & Alternating Current
- Faraday's Law: Induced EMF equals the negative rate of change of magnetic flux. EMF = -d(Phi)/dt.
- Lenz's Law: The direction of induced current opposes the flux change that produced it.`);
                    }}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-700 rounded-lg hover:bg-amber-100/60 transition cursor-pointer"
                  >
                    ⚡ Physics Notes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode('text');
                      setSourceTitle('حیاتیات: خلیاتی نظام اور وراثیات (Cellular Biology)');
                      setPastedText(`باب 1: خلیہ کی ساخت اور بنیادی کام
- پلازما جھلی (Cell Membrane): نیم نفوذ پذیر جھلی جو مادوں کی نقل و حرکت کو کنٹرول کرتی ہے۔
- مائٹوکونڈریا (Mitochondria): خلیے کا پاور ہاؤس جہاں اے ٹی پی (ATP) کے ذریعے توانائی پیدا ہوتی ہے۔
- نیوکلیئس (Nucleus): خلیے کا کنٹرول سینٹر جس میں جینیاتی مواد (DNA) پایا جاتا ہے۔

باب 2: خلیاتی تقسیم (Cell Division)
- مائٹوسس (Mitosis): جسمانی خلیات کی تقسیم جس میں کروموسوم کی تعداد یکساں رہتی ہے۔
- میوسس (Meiosis): تولیدی خلیات کی تقسیم جس میں کروموسوم کی تعداد نصف ہو جاتی ہے۔`);
                    }}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-700 rounded-lg hover:bg-amber-100/60 transition cursor-pointer"
                  >
                    📖 اردو حیاتیات (Urdu Notes)
                  </button>
                </div>
              </div>

              {/* Input Panes */}
              {inputMode === 'file' && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
                      : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 bg-slate-50/50 dark:bg-slate-800/30'
                  }`}
                >
                  {selectedFile ? (
                    <div className="flex flex-col items-center">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                        <FileText className="w-7 h-7" />
                      </div>
                      <p className="font-semibold text-slate-900 dark:text-white text-base">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • {selectedFile.type || 'Document'}
                      </p>
                      <button
                        type="button"
                        onClick={() => { setSelectedFile(null); setFileBase64(null); }}
                        className="mt-3 text-xs text-red-500 hover:underline font-medium"
                      >
                        Remove and choose another file
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center mb-3">
                        <Upload className="w-7 h-7" />
                      </div>
                      <p className="font-semibold text-slate-900 dark:text-white text-base mb-1">
                        Drag & drop your study material here
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-sm">
                        Supports PDF syllabi, lecture slides, chapter outlines, images of handwritten notes, or Word documents.
                      </p>
                      <label className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-500/20 cursor-pointer transition-colors">
                        Browse Files on Device
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.docx,.doc,.txt,.md,image/*"
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              handleFileChange(e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}

              {inputMode === 'text' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Paste Lecture Notes, Syllabus Outline, or Textbook Content
                  </label>
                  <textarea
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    rows={8}
                    placeholder="Paste the text from your teacher's syllabus, chapter table of contents, lecture notes, or exam study guide..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-xs leading-relaxed"
                  />
                </div>
              )}

              {inputMode === 'gdrive' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Select a Google Doc or Study File from Drive
                    </span>
                    <button
                      type="button"
                      onClick={handleLoadDriveFiles}
                      disabled={loadingDrive}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingDrive ? 'animate-spin' : ''}`} />
                      Refresh Drive
                    </button>
                  </div>

                  {driveError && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between">
                      <span>{driveError}</span>
                      <button
                        onClick={handleLoadDriveFiles}
                        className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-[10px] font-semibold"
                      >
                        Authorize & Connect
                      </button>
                    </div>
                  )}

                  {loadingDrive ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      Connecting to Google Drive...
                    </div>
                  ) : driveFiles.length === 0 ? (
                    <div className="py-10 text-center border rounded-xl border-dashed border-slate-300 dark:border-slate-700 text-slate-400 text-xs">
                      No Google Docs found. Click Refresh to load from your authorized Google Account.
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                      {driveFiles.map((f) => (
                        <div
                          key={f.id}
                          onClick={() => handleSelectDriveFile(f)}
                          className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                            selectedDriveFile?.id === f.id
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                            <span className="text-xs font-medium truncate">{f.name}</span>
                          </div>
                          {selectedDriveFile?.id === f.id && (
                            <CheckCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Study Context Parameters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Document / Curriculum Name
                  </label>
                  <input
                    type="text"
                    value={sourceTitle}
                    onChange={(e) => setSourceTitle(e.target.value)}
                    placeholder="e.g. Organic Chem Midterm Syllabus"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Exam Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={targetExamDate}
                    onChange={(e) => setTargetExamDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Daily Study Target (Hours)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={dailyHours}
                    onChange={(e) => setDailyHours(Number(e.target.value) || 3)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Generation Scope Selectors */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Generation Options
                  </span>
                  <span className="text-[11px] text-slate-500">Choose what to create right now</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Syllabus */}
                  <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                    generateSyllabus ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                  }`}>
                    <input
                      type="checkbox"
                      checked={generateSyllabus}
                      onChange={(e) => setGenerateSyllabus(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Syllabus & Topics</span>
                      </div>
                      <div className="text-[10px] text-slate-500">Subject, chapter & topic structure</div>
                    </div>
                  </label>

                  {/* Study Schedule & Tasks */}
                  <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                    generateTasks ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                  }`}>
                    <input
                      type="checkbox"
                      checked={generateTasks}
                      onChange={(e) => setGenerateTasks(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Daily Study Plan & Schedule</span>
                      </div>
                      <div className="text-[10px] text-slate-500">Actionable prioritized daily study goals</div>
                    </div>
                  </label>

                  {/* Flashcards */}
                  <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                    generateFlashcards ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                  }`}>
                    <input
                      type="checkbox"
                      checked={generateFlashcards}
                      onChange={(e) => setGenerateFlashcards(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Active-Recall Flashcards</span>
                      </div>
                      <div className="text-[10px] text-slate-500">Generate flashcard decks (optional)</div>
                    </div>
                  </label>

                  {/* Practice Questions */}
                  <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                    generateQuestions ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                  }`}>
                    <input
                      type="checkbox"
                      checked={generateQuestions}
                      onChange={(e) => setGenerateQuestions(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Practice Question Bank</span>
                      </div>
                      <div className="text-[10px] text-slate-500">Self-test MCQs & explanations (optional)</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: ANALYZING */}
          {step === 'analyzing' && (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-indigo-100 dark:border-indigo-950 border-t-indigo-600 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Brain className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                </div>
              </div>
              <div className="space-y-2 max-w-md">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Autonomous Study Synthesis in Progress
                </h3>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                  {analyzingStage}
                </p>
                <p className="text-[11px] text-slate-400">
                  Synthesizing your academic material according to your configured preferences...
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW & APPROVE */}
          {step === 'review' && (
            <div className="space-y-5">
              {/* Review Tabs */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setReviewTab('overview')}
                  className={`pb-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                    reviewTab === 'overview'
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Overview
                </button>
                {generateSyllabus && (
                  <button
                    type="button"
                    onClick={() => setReviewTab('syllabus')}
                    className={`pb-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                      reviewTab === 'syllabus'
                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Syllabus ({extractedSubjects.length} Subjects)
                  </button>
                )}
                {generateFlashcards && (
                  <button
                    type="button"
                    onClick={() => setReviewTab('flashcards')}
                    className={`pb-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                      reviewTab === 'flashcards'
                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Flashcards ({extractedDecks.reduce((acc, d) => acc + d.cards.length, 0)} Cards)
                  </button>
                )}
                {generateQuestions && (
                  <button
                    type="button"
                    onClick={() => setReviewTab('questions')}
                    className={`pb-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                      reviewTab === 'questions'
                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    Practice Questions ({extractedQuestions.length})
                  </button>
                )}
                {generateTasks && (
                  <button
                    type="button"
                    onClick={() => setReviewTab('tasks')}
                    className={`pb-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                      reviewTab === 'tasks'
                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <ListChecks className="w-3.5 h-3.5" />
                    Study Plan ({extractedTasks.length} Tasks)
                  </button>
                )}
              </div>

              {/* TAB 1: OVERVIEW */}
              {reviewTab === 'overview' && extractedOverview && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-violet-950/40 border border-indigo-100 dark:border-indigo-900/60">
                    <h3 className="font-bold text-sm text-indigo-950 dark:text-indigo-200 mb-1">
                      {extractedOverview.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {extractedOverview.executiveSummary}
                    </p>
                    <div className="mt-3 flex items-center gap-3 text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Pace: {extractedOverview.recommendedWeeklyPace}
                      </span>
                    </div>
                  </div>

                  {extractedOverview.keyConceptsCovered && extractedOverview.keyConceptsCovered.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        Key Concepts Identified
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {extractedOverview.keyConceptsCovered.map((c, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Summary Metric Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
                      <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                        {extractedSubjects.length}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium uppercase">Subjects</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
                      <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {extractedSubjects.reduce((acc, s) => acc + s.chapters.reduce((cAcc, ch) => cAcc + ch.topics.length, 0), 0)}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium uppercase">Topics Extracted</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
                      <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
                        {extractedDecks.reduce((acc, d) => acc + d.cards.length, 0)}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium uppercase">Active Flashcards</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
                      <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                        {extractedQuestions.length}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium uppercase">Practice Qs</div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SYLLABUS */}
              {reviewTab === 'syllabus' && (
                <div className="space-y-4">
                  {extractedSubjects.map((sub) => (
                    <div
                      key={sub.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{sub.icon || '📖'}</span>
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {sub.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteSubject(sub.id)}
                          className="text-xs text-red-500 hover:text-red-700 p-1"
                          title="Remove subject"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-2 pl-2 border-l-2 border-slate-200 dark:border-slate-700">
                        {sub.chapters.map((ch) => (
                          <div key={ch.id} className="space-y-1.5">
                            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {ch.name}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {ch.topics.map((t) => (
                                <div
                                  key={t.id}
                                  className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between"
                                >
                                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                    {t.name}
                                  </span>
                                  <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                                    {t.estimatedMinutes || 45}m
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 3: FLASHCARDS */}
              {reviewTab === 'flashcards' && (
                <div className="space-y-4">
                  {extractedDecks.map((deck) => (
                    <div key={deck.id} className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-indigo-500" />
                        {deck.title} ({deck.cards.length} cards)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {deck.cards.map((card) => (
                          <div
                            key={card.id}
                            className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-2 relative group"
                          >
                            <button
                              type="button"
                              onClick={() => handleDeleteCard(deck.id, card.id)}
                              className="absolute top-2 right-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <div>
                              <span className="text-[10px] font-bold uppercase text-indigo-500">Prompt</span>
                              <p className="text-xs font-semibold text-slate-900 dark:text-white mt-0.5">
                                {card.front}
                              </p>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold uppercase text-emerald-500">Answer</span>
                              <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line mt-0.5">
                                {card.back}
                              </p>
                            </div>
                            {card.mnemonic && (
                              <div className="p-1.5 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300">
                                💡 <span className="font-semibold">Hook:</span> {card.mnemonic}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 4: PRACTICE QUESTIONS */}
              {reviewTab === 'questions' && (
                <div className="space-y-3">
                  {extractedQuestions.map((q, idx) => (
                    <div
                      key={q.id || idx}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-2 relative"
                    >
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="absolute top-3 right-3 text-slate-400 hover:text-red-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          Q{idx + 1}.
                        </span>
                        <span className="text-xs font-semibold text-slate-900 dark:text-white">
                          {q.question}
                        </span>
                      </div>
                      {q.options && q.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-4 pt-1">
                          {q.options.map((opt, optIdx) => (
                            <div
                              key={optIdx}
                              className={`p-2 rounded-lg text-xs font-medium border ${
                                optIdx === q.correctOptionIndex
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-800 dark:text-emerald-300'
                                  : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <span className="font-bold mr-1">{String.fromCharCode(65 + optIdx)}.</span>
                              {opt}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 pl-4">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Explanation:</span> {q.explanation}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 5: STUDY PLAN */}
              {reviewTab === 'tasks' && (
                <div className="space-y-2">
                  {extractedTasks.map((t, idx) => (
                    <div
                      key={t.id || idx}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">
                            {t.topicName}
                            <span className="text-[10px] font-normal text-slate-400 ml-2">
                              ({t.subjectName} • {t.chapterName})
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{t.reason}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {t.estimatedMinutes}m
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteTask(t.id)}
                          className="text-slate-400 hover:text-red-500 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          {step === 'input' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartAnalysis}
                disabled={(!selectedFile && !pastedText.trim() && !selectedDriveFile)}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs shadow-md shadow-indigo-500/20 flex items-center gap-2 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                Analyze & Build Autonomous Study System
              </button>
            </>
          )}

          {step === 'analyzing' && (
            <div className="text-xs text-slate-400 italic">Processing with Google Gemini AI...</div>
          )}

          {step === 'review' && (
            <>
              <button
                type="button"
                onClick={() => setStep('input')}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
              >
                Back to Upload
              </button>
              <button
                type="button"
                onClick={handleApprove}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all"
              >
                <CheckCircle className="w-4 h-4" />
                Approve & Initialize Study System
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
