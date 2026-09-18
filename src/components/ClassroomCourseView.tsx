import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, 
  BookOpen, 
  Layers, 
  FileCheck, 
  Share2, 
  ExternalLink, 
  Sparkles, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Mail, 
  Send, 
  RefreshCw, 
  Download, 
  FileText,
  Play,
  Bot,
  ArrowRight,
  School,
  Calendar,
  Archive,
  UploadCloud,
  File,
  Tag,
  Target,
  Smartphone,
  Eye,
  Link as LinkIcon,
  X,
  Copy,
  Check,
  Save,
  Database,
  Bell,
  Zap
} from 'lucide-react';
import { Subject, TestResult, StudyPlan, StudySession, RevisionItem, UserProfile, ActiveTab, UserNote, FlashcardDeck, StorageVault, ActivityLog } from '../types';
import { dumpSubjectToGoogleClassroom, getOrRequestClassroomToken, getCachedClassroomToken, fetchClassroomCoursesAndUploads } from '../lib/googleClassroomService';
import { sendTestImprovementEmail, getOrRequestGmailToken, getCachedGmailToken } from '../lib/gmailService';
import { getActiveUserEmail } from '../lib/db';
import { CourseDataExtractModal } from './CourseDataExtractModal';
import { GeminiNotebookLinksModal } from './GeminiNotebookLinksModal';
import { ClassroomSyncExtractorModal } from './ClassroomSyncExtractorModal';

interface ClassroomCourseViewProps {
  subjects: Subject[];
  testResults: TestResult[];
  plans?: StudyPlan[];
  sessions?: StudySession[];
  revisions?: RevisionItem[];
  notes?: UserNote[];
  vaults?: StorageVault[];
  activityLogs?: ActivityLog[];
  flashcardDecks?: FlashcardDeck[];
  userProfile?: UserProfile | null;
  user?: any;
  setActiveTab: (tab: ActiveTab) => void;
  onSendPromptToTutor: (promptText: string) => void;
  onStartTimerWithTopic?: (topic: { subject?: string; chapter?: string; topic?: string }) => void;
  onOpenMaterialImport?: () => void;
  onCreateVault?: (vault: Omit<StorageVault, 'id'>) => Promise<string>;
  onOpenDeviceSync?: () => void;
  onUpdateSubjects?: (subjects: Subject[]) => void;
  onUpdateProfile?: (profile: Partial<UserProfile>) => void;
}

export const ClassroomCourseView: React.FC<ClassroomCourseViewProps> = ({
  subjects,
  testResults,
  plans = [],
  sessions = [],
  revisions = [],
  notes = [],
  vaults = [],
  activityLogs = [],
  flashcardDecks = [],
  userProfile = null,
  user = null,
  setActiveTab,
  onSendPromptToTutor,
  onStartTimerWithTopic,
  onOpenMaterialImport,
  onCreateVault,
  onOpenDeviceSync,
  onUpdateSubjects,
  onUpdateProfile
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id || '');
  const [courseTab, setCourseTab] = useState<'classwork' | 'materials' | 'tests' | 'stream'>('classwork');
  const [materialsScope, setMaterialsScope] = useState<'subject' | 'all'>('subject');
  const [selectedVaultPreview, setSelectedVaultPreview] = useState<StorageVault | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ success: boolean; message: string; url?: string } | null>(null);
  const [isEmailing, setIsEmailing] = useState(false);
  const [emailResult, setEmailResult] = useState<{ success: boolean; message: string } | null>(null);
  const [geminiNotebookToast, setGeminiNotebookToast] = useState<string | null>(null);

  // Modals state
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false);
  const [isExtractModalOpen, setIsExtractModalOpen] = useState(false);
  const [isClassroomSyncModalOpen, setIsClassroomSyncModalOpen] = useState(false);
  const [detectedNewUploadsCount, setDetectedNewUploadsCount] = useState(0);
  const [unlinkedCoursesCount, setUnlinkedCoursesCount] = useState(0);
  const [classroomUploadToast, setClassroomUploadToast] = useState<string | null>(null);

  const activeUserEmail = userProfile?.email || user?.email || getActiveUserEmail() || '';

  const activeSubject = subjects.find(s => s.id === selectedSubjectId) || subjects[0];

  // Background check for newly uploaded Google Classroom files and coursework
  useEffect(() => {
    let isMounted = true;
    const checkClassroomUploads = async () => {
      try {
        const token = getCachedClassroomToken();
        if (!token) return;
        const res = await fetchClassroomCoursesAndUploads(subjects, token);
        if (isMounted) {
          setDetectedNewUploadsCount(res.newUploadCount);
          setUnlinkedCoursesCount(res.unlinkedCourses.length);
          if (res.newUploadCount > 0) {
            setClassroomUploadToast(`🔔 ${res.newUploadCount} newly uploaded file(s)/coursework detected in Google Classroom! Click Classroom Sync to extract into your syllabus.`);
          }
        }
      } catch (e) {
        // Silently catch background check
      }
    };
    checkClassroomUploads();
    return () => { isMounted = false; };
  }, [subjects.length, selectedSubjectId]);

  // Each subject maintains its OWN independent Gemini Notebook link
  const currentNotebookUrl = activeSubject?.geminiNotebookUrl || '';

  // Companion courses linked to this subject
  const linkedCompanionSubjects = (activeSubject?.linkedSubjectIds || [])
    .map(id => subjects.find(s => s.id === id))
    .filter(Boolean) as Subject[];

  const handleLaunchNotebookLM = () => {
    if (currentNotebookUrl) {
      window.open(currentNotebookUrl, '_blank');
    } else {
      setIsGeminiModalOpen(true);
    }
  };

  if (!activeSubject) {
    return (
      <div className="text-center py-16 bg-white rounded-3xl border border-[#E0DBD0] p-8 space-y-4">
        <GraduationCap className="w-12 h-12 text-[#A5A58D] mx-auto" />
        <h3 className="text-lg font-bold font-serif italic text-[#4A4E4D]">No Subjects Enrolled</h3>
        <p className="text-xs text-[#6B705C] max-w-md mx-auto">
          Upload course study materials or import a syllabus to initialize your Classroom Course Hub.
        </p>
        <div className="flex items-center justify-center gap-3">
          {onOpenMaterialImport && (
            <button
              onClick={onOpenMaterialImport}
              className="px-5 py-2.5 rounded-full bg-[#6B705C] text-white text-xs font-bold flex items-center gap-2 hover:bg-[#5A5E4E] transition shadow-xs cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Study Material</span>
            </button>
          )}
          <button
            onClick={() => setActiveTab('syllabus')}
            className="px-5 py-2.5 rounded-full bg-[#F2EFE9] text-[#6B705C] text-xs font-bold border border-[#E0DBD0] hover:bg-[#EAE7DF] transition cursor-pointer"
          >
            Go to Syllabus
          </button>
        </div>
      </div>
    );
  }

  // Calculate subject metrics
  const totalTopics = activeSubject.chapters.reduce((acc, ch) => acc + ch.topics.length, 0);
  const completedTopics = activeSubject.chapters.reduce(
    (acc, ch) => acc + ch.topics.filter(t => t.status === 'Completed' || t.status === 'Mastered').length,
    0
  );
  const completionPercentage = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

  // Filter test results for this subject
  const subjectTests = testResults.filter(
    t => t.subjectName.toLowerCase() === activeSubject.name.toLowerCase()
  );

  // Filter study sessions for this subject
  const subjectSessions = sessions.filter(
    s => s.subjectName?.toLowerCase() === activeSubject.name.toLowerCase()
  );
  const totalMinutesStudied = subjectSessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);

  // Filter notes for this subject
  const subjectNotes = notes.filter(
    n => n.subjectName?.toLowerCase() === activeSubject.name.toLowerCase()
  );

  // Filter flashcard decks for this subject
  const subjectDecks = flashcardDecks.filter(
    d => d.subjectName?.toLowerCase() === activeSubject.name.toLowerCase()
  );

  // Filter vaults (uploaded study materials, textbooks, question banks)
  const subjectVaults = vaults.filter(
    v => v.subjectName?.toLowerCase() === activeSubject.name.toLowerCase()
  );
  const displayedVaults = materialsScope === 'subject' ? subjectVaults : vaults;

  // Handle Export / Dump to Google Classroom
  const handleDumpToGoogleClassroom = async () => {
    setIsExporting(true);
    setExportResult(null);

    try {
      let token = getCachedClassroomToken();
      if (!token) {
        token = await getOrRequestClassroomToken();
      }

      const result = await dumpSubjectToGoogleClassroom(token, activeSubject, subjectTests, subjectNotes);
      setExportResult({
        success: true,
        message: `Successfully created "${result.course.name}" with ${result.courseworkCount} chapter assignments in Google Classroom!`,
        url: result.courseUrl
      });
    } catch (err: any) {
      if (err?.code === 'auth/popup-blocked' || err?.message?.includes('popup-blocked')) {
        console.warn("Classroom authorization popup was blocked by browser:", err);
        setExportResult({
          success: false,
          message: 'Pop-up window was blocked by your browser. Please allow pop-ups for this site or open in a new tab.'
        });
      } else {
        console.warn("Classroom dump error:", err);
        setExportResult({
          success: false,
          message: err?.message || 'Failed to export subject to Google Classroom. Check permissions.'
        });
      }
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Email Subject Package & Correction Prompts
  const handleEmailSubjectPackage = async () => {
    setIsEmailing(true);
    setEmailResult(null);

    try {
      let token = getCachedGmailToken();
      if (!token) {
        token = await getOrRequestGmailToken();
      }

      const recipientEmail = activeUserEmail || 'student@academic.edu';
      const recipientName = userProfile?.displayName || user?.displayName || 'Student';

      await sendTestImprovementEmail({
        recipientEmail,
        recipientName,
        testResults: subjectTests,
        subjects,
        userProfile: userProfile || null
      }, token);

      setEmailResult({
        success: true,
        message: `Subject test analysis & correction prompts emailed to ${recipientEmail}!`
      });
    } catch (err: any) {
      if (err?.code === 'auth/popup-blocked' || err?.message?.includes('popup-blocked')) {
        console.warn("Gmail authorization popup was blocked by browser:", err);
        setEmailResult({
          success: false,
          message: 'Pop-up window was blocked by your browser. Please allow pop-ups for this site or open in a new tab.'
        });
      } else {
        console.warn("Email dispatch note:", err);
        setEmailResult({
          success: false,
          message: err?.message || 'Failed to dispatch email via Gmail API.'
        });
      }
    } finally {
      setIsEmailing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-[#4A4E4D]">
      
      {/* Top Academic Context & Sync Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-[#E0DBD0] text-xs shadow-2xs">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <span className="font-mono text-[#A5A58D] uppercase text-[10px] font-bold tracking-wider shrink-0">Courses:</span>
          {subjects.map(s => {
            const isSelected = s.id === selectedSubjectId;
            const hasNotebook = !!s.geminiNotebookUrl;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedSubjectId(s.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs shrink-0 transition cursor-pointer ${
                  isSelected
                    ? 'bg-[#6B705C] text-white shadow-xs'
                    : 'bg-[#F2EFE9] text-[#4A4E4D] hover:bg-[#EAE7DF] border border-[#E0DBD0]'
                }`}
              >
                <span>{s.icon || '📚'}</span>
                <span>{s.name}</span>
                {hasNotebook && (
                  <span 
                    className={`w-2 h-2 rounded-full ${isSelected ? 'bg-amber-300 ring-2 ring-white/30' : 'bg-amber-500'}`} 
                    title="Gemini Notebook linked" 
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Sync / Active Email Status */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Classroom Live Sync & Uploads Button */}
          <button
            onClick={() => setIsClassroomSyncModalOpen(true)}
            className={`px-3 py-1 rounded-xl font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer border ${
              detectedNewUploadsCount > 0
                ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200 animate-pulse'
                : 'bg-[#F2EFE9] text-[#6B705C] hover:bg-[#EAE7DF] border-[#E0DBD0]'
            }`}
            title="Google Classroom live sync, check for newly uploaded files, and extract curriculum data"
          >
            <Zap className={`w-3.5 h-3.5 ${detectedNewUploadsCount > 0 ? 'text-amber-600' : 'text-[#6B705C]'}`} />
            <span>Classroom Sync</span>
            {detectedNewUploadsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-600 text-white font-mono text-[9px] font-bold">
                {detectedNewUploadsCount}
              </span>
            )}
            {unlinkedCoursesCount > 0 && detectedNewUploadsCount === 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white font-mono text-[9px] font-bold">
                +{unlinkedCoursesCount}
              </span>
            )}
          </button>

          {activeUserEmail && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="truncate max-w-[160px] sm:max-w-[200px]">{activeUserEmail}</span>
            </div>
          )}
          {onOpenDeviceSync && (
            <button
              onClick={onOpenDeviceSync}
              className="px-3 py-1 rounded-xl bg-[#F2EFE9] text-[#6B705C] hover:bg-[#EAE7DF] border border-[#E0DBD0] font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer"
              title="Search and manage all signed devices on this study email"
            >
              <Smartphone className="w-3.5 h-3.5 text-[#6B705C]" />
              <span>Devices</span>
            </button>
          )}
        </div>
      </div>

      {/* Course Header Banner: Warm Academic Sage Gradient */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#4D7C5D] via-[#5A876B] to-[#6B705C] text-white p-6 sm:p-8 shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-[11px] font-mono font-bold tracking-wider uppercase">
                Academic Course Hub
              </span>
              <span className="px-3 py-1 rounded-full bg-white/15 text-[11px] font-mono">
                {activeSubject.chapters.length} Chapters • {totalTopics} Topics • {subjectVaults.length} Vault Materials
              </span>
              {currentNotebookUrl && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-300 text-amber-950 font-bold text-[10px] font-mono flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Gemini Notebook Linked</span>
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-serif italic font-bold">
              {activeSubject.name}
            </h1>

            <p className="text-xs text-white/90 leading-relaxed">
              {activeSubject.description || `Mastery track, syllabus chapters, test vault benchmarks, and active recall notes for ${activeSubject.name}.`}
            </p>

            {/* Companion Courses Linked to this Subject */}
            {linkedCompanionSubjects.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/80 font-bold flex items-center gap-1">
                  <Share2 className="w-3 h-3" />
                  <span>Linked Companions:</span>
                </span>
                {linkedCompanionSubjects.map(cs => (
                  <button
                    key={cs.id}
                    onClick={() => setSelectedSubjectId(cs.id)}
                    className="px-2.5 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white font-bold text-[11px] flex items-center gap-1 transition cursor-pointer border border-white/20 shadow-2xs"
                    title={`Switch to companion course: ${cs.name}`}
                  >
                    <span>{cs.icon || '📚'}</span>
                    <span>{cs.name}</span>
                    {cs.geminiNotebookUrl && <Sparkles className="w-3 h-3 text-amber-200" title="Gemini Notebook linked" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons inside Banner */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Gemini NotebookLM launcher / configuration */}
            <div className="relative flex items-center">
              <button
                onClick={handleLaunchNotebookLM}
                className="px-4 py-2.5 rounded-full bg-amber-400/30 hover:bg-amber-400/40 backdrop-blur-xs text-white font-bold text-xs flex items-center gap-2 border border-amber-300/50 transition cursor-pointer shadow-xs"
                title={currentNotebookUrl ? "Open linked Google NotebookLM (Gemini Notebook)" : "Link or open Google NotebookLM"}
              >
                <Sparkles className="w-4 h-4 text-amber-200" />
                <span>Gemini Notebook</span>
                {currentNotebookUrl && <ExternalLink className="w-3 h-3 text-amber-200" />}
              </button>
              <button
                onClick={() => setIsGeminiModalOpen(true)}
                className="ml-1 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition cursor-pointer"
                title="Configure Gemini Notebook link & export sources"
              >
                <LinkIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Google Classroom Live Sync & Uploads */}
            <button
              onClick={() => setIsClassroomSyncModalOpen(true)}
              className="px-4 py-2.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-xs text-white font-bold text-xs flex items-center gap-2 border border-white/30 transition cursor-pointer shadow-xs"
              title="Detect new files and coursework in Google Classroom and extract into syllabus & materials"
            >
              <Zap className="w-4 h-4 text-amber-200" />
              <span>Classroom Sync</span>
              {detectedNewUploadsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 font-mono text-[10px] font-bold">
                  {detectedNewUploadsCount} New
                </span>
              )}
            </button>

            {/* Extract Course Data */}
            <button
              onClick={() => setIsExtractModalOpen(true)}
              className="px-4 py-2.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-xs text-white font-bold text-xs flex items-center gap-2 border border-white/30 transition cursor-pointer shadow-xs"
              title="Extract and export course curriculum, test mistake logs, notes, and study data as Markdown, JSON, or Text"
            >
              <Database className="w-4 h-4" />
              <span>Extract Data</span>
            </button>

            {onOpenMaterialImport && (
              <button
                onClick={onOpenMaterialImport}
                className="px-4 py-2.5 rounded-full bg-white text-[#4D7C5D] hover:bg-[#F9F7F2] font-bold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
                title="Upload textbooks, PDFs, and syllabus documents"
              >
                <UploadCloud className="w-4 h-4 text-[#4D7C5D]" />
                <span>Upload Material</span>
              </button>
            )}

            <button
              onClick={handleDumpToGoogleClassroom}
              disabled={isExporting}
              className="px-4 py-2.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-xs text-white font-bold text-xs flex items-center gap-2 border border-white/30 transition cursor-pointer disabled:opacity-50"
              title="Dump full subject syllabus, test scores, and chapters to your Google Classroom account"
            >
              <School className="w-4 h-4" />
              <span>{isExporting ? 'Exporting...' : 'Dump to Classroom'}</span>
            </button>

            <button
              onClick={handleEmailSubjectPackage}
              disabled={isEmailing}
              className="px-4 py-2.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-xs text-white font-bold text-xs flex items-center gap-2 border border-white/30 transition cursor-pointer disabled:opacity-50"
              title="Email subject test correction prompts and summary to your Gmail"
            >
              <Mail className="w-4 h-4" />
              <span>{isEmailing ? 'Dispatching...' : 'Email Study Package'}</span>
            </button>
          </div>
        </div>

        {/* Quick Subject Progress Metrics Bar */}
        <div className="mt-6 pt-4 border-t border-white/20 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-white/80 block text-[10px] uppercase tracking-wider font-mono">Syllabus Completion</span>
            <span className="text-lg font-mono font-bold">{completionPercentage}%</span>
            <div className="w-full bg-white/25 h-1.5 rounded-full mt-1 overflow-hidden">
              <div className="bg-white h-full rounded-full transition-all duration-500" style={{ width: `${completionPercentage}%` }} />
            </div>
          </div>

          <div>
            <span className="text-white/80 block text-[10px] uppercase tracking-wider font-mono">Completed Topics</span>
            <span className="text-lg font-mono font-bold">{completedTopics} / {totalTopics}</span>
          </div>

          <div>
            <span className="text-white/80 block text-[10px] uppercase tracking-wider font-mono">Uploaded Materials</span>
            <span className="text-lg font-mono font-bold">{subjectVaults.length} Documents</span>
          </div>

          <div>
            <span className="text-white/80 block text-[10px] uppercase tracking-wider font-mono">Time Studied</span>
            <span className="text-lg font-mono font-bold">{(totalMinutesStudied / 60).toFixed(1)} Hours</span>
          </div>
        </div>
      </div>

      {/* Google Classroom New Uploads Alert Banner */}
      {detectedNewUploadsCount > 0 && (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center shrink-0 border border-amber-400/30">
              <Bell className="w-5 h-5 text-amber-700 animate-bounce" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-amber-950 flex items-center gap-2">
                <span>Google Classroom: New Uploads Detected!</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 font-mono text-[10px]">
                  {detectedNewUploadsCount} new item{detectedNewUploadsCount > 1 ? 's' : ''}
                </span>
              </h4>
              <p className="text-xs text-amber-800 leading-relaxed mt-0.5">
                New files or coursework assignments have been uploaded to your Google Classroom courses. Extract them to automatically add topics to your syllabus and save attached files to your Materials Vault.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsClassroomSyncModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-200" />
              <span>Review & Extract</span>
            </button>
            <button
              onClick={() => setDetectedNewUploadsCount(0)}
              className="px-3 py-2 rounded-xl text-amber-800 hover:bg-amber-100 font-bold text-xs transition cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Classroom Upload Toast */}
      {classroomUploadToast && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-900 font-medium animate-in fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{classroomUploadToast}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setClassroomUploadToast(null);
                setIsClassroomSyncModalOpen(true);
              }}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-[11px] cursor-pointer transition"
            >
              Open Sync
            </button>
            <button
              onClick={() => setClassroomUploadToast(null)}
              className="text-emerald-700 hover:text-emerald-900 text-[11px] font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Status Notifications */}
      {exportResult && (
        <div className={`p-4 rounded-2xl text-xs flex items-center justify-between gap-3 ${
          exportResult.success ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-900 border border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {exportResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
            <span>{exportResult.message}</span>
          </div>
          {exportResult.url && (
            <a
              href={exportResult.url}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center gap-1 shrink-0 hover:bg-emerald-700"
            >
              <span>Open in Classroom</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {emailResult && (
        <div className={`p-3.5 rounded-2xl text-xs flex items-center gap-2 ${
          emailResult.success ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-900 border border-rose-200'
        }`}>
          {emailResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
          <span>{emailResult.message}</span>
        </div>
      )}

      {geminiNotebookToast && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-semibold text-amber-900 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{geminiNotebookToast}</span>
          </div>
          <button
            onClick={() => setGeminiNotebookToast(null)}
            className="text-amber-700 hover:text-amber-900 cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Classroom Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-[#F2EFE9] p-1.5 rounded-2xl border border-[#E0DBD0]">
          <button
            onClick={() => setCourseTab('classwork')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              courseTab === 'classwork'
                ? 'bg-white text-[#4A4E4D] shadow-xs border border-[#E0DBD0]'
                : 'text-[#6B705C] hover:text-[#4A4E4D]'
            }`}
          >
            <BookOpen className="w-4 h-4 text-[#6B705C]" />
            <span>Classwork & Chapters ({activeSubject.chapters.length})</span>
          </button>

          <button
            onClick={() => setCourseTab('materials')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              courseTab === 'materials'
                ? 'bg-white text-[#4A4E4D] shadow-xs border border-[#E0DBD0]'
                : 'text-[#6B705C] hover:text-[#4A4E4D]'
            }`}
          >
            <Archive className="w-4 h-4 text-[#6B705C]" />
            <span>Uploaded Materials & Vaults ({subjectVaults.length})</span>
          </button>

          <button
            onClick={() => setCourseTab('tests')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              courseTab === 'tests'
                ? 'bg-white text-[#4A4E4D] shadow-xs border border-[#E0DBD0]'
                : 'text-[#6B705C] hover:text-[#4A4E4D]'
            }`}
          >
            <FileCheck className="w-4 h-4 text-[#6B705C]" />
            <span>Test Papers ({subjectTests.length})</span>
          </button>

          <button
            onClick={() => setCourseTab('stream')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              courseTab === 'stream'
                ? 'bg-white text-[#4A4E4D] shadow-xs border border-[#E0DBD0]'
                : 'text-[#6B705C] hover:text-[#4A4E4D]'
            }`}
          >
            <Layers className="w-4 h-4 text-[#6B705C]" />
            <span>Activity Stream</span>
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsExtractModalOpen(true)}
            className="px-3.5 py-2 rounded-2xl bg-white hover:bg-[#F9F7F2] text-[#4A4E4D] border border-[#E0DBD0] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            title="Extract course curriculum, syllabus, and test data (Markdown / JSON / Text)"
          >
            <Database className="w-3.5 h-3.5 text-[#6B705C]" />
            <span>Extract Data</span>
          </button>

          <button
            onClick={() => setIsGeminiModalOpen(true)}
            className="px-3.5 py-2 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            title="Link Google NotebookLM (Gemini Notebook)"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>{currentNotebookUrl ? 'Gemini Notebook (Linked)' : 'Link Gemini Notebook'}</span>
          </button>

          {onOpenMaterialImport && (
            <button
              onClick={onOpenMaterialImport}
              className="px-4 py-2 rounded-2xl bg-white hover:bg-[#F9F7F2] text-[#6B705C] text-xs font-bold flex items-center gap-2 border border-[#E0DBD0] transition cursor-pointer shadow-2xs"
            >
              <UploadCloud className="w-4 h-4 text-[#6B705C]" />
              <span>Upload New Material</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: CLASSWORK & CHAPTERS WITH ATTACHED MATERIALS */}
      {courseTab === 'classwork' && (
        <div className="space-y-4">
          {activeSubject.chapters.map((chapter, cIdx) => {
            const chCompleted = chapter.topics.filter(t => t.status === 'Completed' || t.status === 'Mastered').length;
            const chTotal = chapter.topics.length;
            const chPercent = chTotal > 0 ? Math.round((chCompleted / chTotal) * 100) : 0;

            // Check if any uploaded vaults/materials are attached to this chapter
            const chapterVaults = subjectVaults.filter(v => 
              (v.chapterName && v.chapterName.toLowerCase() === chapter.name.toLowerCase()) ||
              (v.name && v.name.toLowerCase().includes(chapter.name.toLowerCase()))
            );

            return (
              <div
                key={chapter.id || cIdx}
                className="bg-white border border-[#E0DBD0] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4 hover:border-[#6B705C]/40 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E0DBD0] pb-3">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#A5A58D]">
                      Unit / Chapter {cIdx + 1}
                    </span>
                    <h3 className="text-base font-serif italic font-bold text-[#4A4E4D]">{chapter.name}</h3>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-[#F2EFE9] text-[#6B705C] border border-[#E0DBD0]">
                      {chCompleted}/{chTotal} Topics ({chPercent}%)
                    </span>
                  </div>
                </div>

                {/* Attached Chapter Uploaded Materials if any */}
                {chapterVaults.length > 0 && (
                  <div className="p-3 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-[#6B705C]">
                      <Archive className="w-3.5 h-3.5 text-[#6B705C]" />
                      <span>Attached Coursework & Uploaded Documents ({chapterVaults.length})</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {chapterVaults.map(v => (
                        <div key={v.id} className="p-2.5 rounded-xl bg-white border border-[#E0DBD0] flex items-center justify-between text-xs">
                          <div className="min-w-0 pr-2">
                            <div className="font-bold text-[#4A4E4D] truncate">{v.name}</div>
                            <div className="text-[10px] text-[#A5A58D] truncate">{v.description || 'Uploaded study document'}</div>
                          </div>
                          <button
                            onClick={() => {
                              onSendPromptToTutor(`Explain core concepts from uploaded study document "${v.name}" for chapter ${chapter.name}`);
                              setActiveTab('tutor');
                            }}
                            className="px-2 py-1 rounded-lg bg-[#F2EFE9] text-[#6B705C] border border-[#E0DBD0] text-[10px] font-bold shrink-0 hover:bg-[#6B705C] hover:text-white transition cursor-pointer"
                          >
                            Study with AI
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Topic List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {chapter.topics.map((topic) => {
                    const isDone = topic.status === 'Completed' || topic.status === 'Mastered';
                    return (
                      <div
                        key={topic.id}
                        className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs transition ${
                          isDone
                            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                            : 'bg-[#F9F7F2] border-[#E0DBD0] text-[#4A4E4D] hover:border-[#6B705C]/40'
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="font-bold truncate">{topic.name}</div>
                          <div className="text-[10px] text-[#A5A58D] flex items-center gap-2">
                            <span>{topic.estimatedMinutes || 45} mins</span>
                            {topic.status && (
                              <span className={`font-bold px-1.5 py-0.2 rounded text-[9px] ${
                                topic.status === 'Mastered' ? 'bg-indigo-100 text-indigo-800' :
                                topic.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                                topic.status === 'Needs Revision' ? 'bg-rose-100 text-rose-800' :
                                'bg-[#EAE7DF] text-[#6B705C]'
                              }`}>
                                {topic.status}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {onStartTimerWithTopic && (
                            <button
                              onClick={() => {
                                onStartTimerWithTopic({
                                  subject: activeSubject.name,
                                  chapter: chapter.name,
                                  topic: topic.name
                                });
                                setActiveTab('timer');
                              }}
                              className="p-1.5 rounded-xl bg-white border border-[#E0DBD0] hover:bg-[#F2EFE9] text-[#6B705C] transition cursor-pointer shadow-2xs"
                              title="Start timer for this topic"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              onSendPromptToTutor(`Explain core concepts and quiz me on ${activeSubject.name} - ${topic.name}`);
                              setActiveTab('tutor');
                            }}
                            className="p-1.5 rounded-xl bg-white border border-[#E0DBD0] hover:bg-[#F2EFE9] text-[#6B705C] transition cursor-pointer shadow-2xs"
                            title="Ask AI Tutor about this topic"
                          >
                            <Bot className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: UPLOADED MATERIALS & VAULTS */}
      {courseTab === 'materials' && (
        <div className="space-y-6">
          {/* Scope Selector & Upload Trigger */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#E0DBD0] rounded-2xl p-4 shadow-2xs">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#4A4E4D] flex items-center gap-2">
                <Archive className="w-4 h-4 text-[#6B705C]" />
                <span>Uploaded Coursework, Textbooks & Material Vaults ({displayedVaults.length})</span>
              </h3>
              <p className="text-xs text-[#A5A58D]">
                All study files, textbooks, PDFs, and question banks synced across your registered devices.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-[#F2EFE9] p-1 rounded-xl text-xs font-bold border border-[#E0DBD0]">
                <button
                  onClick={() => setMaterialsScope('subject')}
                  className={`px-3 py-1 rounded-lg transition ${
                    materialsScope === 'subject' ? 'bg-white text-[#4A4E4D] shadow-xs' : 'text-[#6B705C] hover:text-[#4A4E4D]'
                  }`}
                >
                  {activeSubject.name} ({subjectVaults.length})
                </button>
                <button
                  onClick={() => setMaterialsScope('all')}
                  className={`px-3 py-1 rounded-lg transition ${
                    materialsScope === 'all' ? 'bg-white text-[#4A4E4D] shadow-xs' : 'text-[#6B705C] hover:text-[#4A4E4D]'
                  }`}
                >
                  All Subjects ({vaults.length})
                </button>
              </div>

              {onOpenMaterialImport && (
                <button
                  onClick={onOpenMaterialImport}
                  className="px-3.5 py-1.5 rounded-xl bg-[#6B705C] text-white text-xs font-bold flex items-center gap-1.5 hover:bg-[#5A5E4E] transition shadow-xs cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Upload File</span>
                </button>
              )}
            </div>
          </div>

          {/* Uploaded Materials Grid */}
          {displayedVaults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedVaults.map((vault) => {
                return (
                  <div
                    key={vault.id}
                    className="bg-white border border-[#E0DBD0] rounded-3xl p-5 shadow-xs space-y-4 hover:border-[#6B705C]/40 transition flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-2xl bg-[#F2EFE9] text-[#6B705C] border border-[#E0DBD0] flex items-center justify-center shrink-0 font-bold">
                            {vault.icon || '📄'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-[#4A4E4D]">{vault.name}</span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#F2EFE9] text-[#6B705C] border border-[#E0DBD0]">
                                {vault.category || 'Uploaded Material'}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#A5A58D] flex items-center gap-2 mt-0.5">
                              <span>{vault.subjectName}</span>
                              {vault.chapterName && <span>• {vault.chapterName}</span>}
                              <span>• {new Date(vault.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {vault.description && (
                        <p className="text-xs text-[#6B705C] leading-relaxed line-clamp-3 bg-[#F9F7F2] p-3 rounded-2xl border border-[#E0DBD0]">
                          {vault.description}
                        </p>
                      )}

                      {vault.tags && vault.tags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {vault.tags.map((t, idx) => (
                            <span key={idx} className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#F2EFE9] text-[#6B705C]">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="pt-3 border-t border-[#E0DBD0] flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            onSendPromptToTutor(`Help me master the study material "${vault.name}" for ${vault.subjectName}. What are the primary core principles and questions to focus on?`);
                            setActiveTab('tutor');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[#6B705C] text-white text-xs font-bold flex items-center gap-1.5 hover:bg-[#5A5E4E] transition shadow-xs cursor-pointer"
                        >
                          <Bot className="w-3.5 h-3.5" />
                          <span>Ask AI Tutor</span>
                        </button>

                        {onStartTimerWithTopic && (
                          <button
                            onClick={() => {
                              onStartTimerWithTopic({
                                subject: vault.subjectName,
                                chapter: vault.chapterName || vault.name,
                                topic: vault.name
                              });
                              setActiveTab('timer');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#F2EFE9] text-[#6B705C] border border-[#E0DBD0] text-xs font-bold flex items-center gap-1 hover:bg-[#EAE7DF] transition cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Study (Timer)</span>
                          </button>
                        )}
                      </div>

                      <button
                        onClick={() => setActiveTab('vaults')}
                        className="text-xs font-bold text-[#6B705C] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>View Vault</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-[#E0DBD0] p-6 space-y-3">
              <Archive className="w-10 h-10 text-[#A5A58D] mx-auto" />
              <h4 className="text-sm font-bold text-[#4A4E4D]">No Uploaded Materials Found for {activeSubject.name}</h4>
              <p className="text-xs text-[#6B705C] max-w-md mx-auto">
                Upload your textbooks, PDF chapters, lecture notes, or syllabus files to populate this classroom section.
              </p>
              {onOpenMaterialImport && (
                <button
                  onClick={onOpenMaterialImport}
                  className="mt-2 px-4 py-2 rounded-full bg-[#6B705C] text-white text-xs font-bold inline-flex items-center gap-2 hover:bg-[#5A5E4E] transition shadow-xs cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload Study Material Now</span>
                </button>
              )}
            </div>
          )}

          {/* Flashcards & Notes for Subject */}
          <div className="pt-4 space-y-4">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#A5A58D]">
              Active Recall Flashcards & Notes ({subjectNotes.length + subjectDecks.length})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {subjectNotes.map(n => (
                <div key={n.id} className="bg-white border border-[#E0DBD0] rounded-3xl p-5 shadow-xs space-y-2">
                  <h4 className="font-bold text-xs text-[#4A4E4D]">{n.title}</h4>
                  <p className="text-xs text-[#6B705C] line-clamp-3 leading-relaxed">{n.content}</p>
                </div>
              ))}
              {subjectDecks.map(d => (
                <div key={d.id} className="bg-white border border-[#E0DBD0] rounded-3xl p-5 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-[#4A4E4D]">{d.title}</h4>
                    <span className="text-[10px] font-mono bg-[#F2EFE9] text-[#6B705C] px-2 py-0.5 rounded border border-[#E0DBD0]">
                      {d.cards.length} Cards
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveTab('flashcards')}
                    className="w-full mt-2 py-2 rounded-xl bg-[#F2EFE9] text-[#6B705C] border border-[#E0DBD0] text-xs font-bold hover:bg-[#EAE7DF] transition cursor-pointer"
                  >
                    Practice Flashcards
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SUBJECT TEST VAULT */}
      {courseTab === 'tests' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white border border-[#E0DBD0] rounded-2xl p-4 shadow-2xs">
            <div>
              <h3 className="text-sm font-bold text-[#4A4E4D]">
                {activeSubject.name} Test Papers & Benchmarks ({subjectTests.length})
              </h3>
              <p className="text-xs text-[#A5A58D]">
                All exam scores, mistake logs, and AI correction prompts for this subject.
              </p>
            </div>

            <button
              onClick={() => setActiveTab('tests')}
              className="px-3.5 py-1.5 rounded-full bg-[#6B705C] hover:bg-[#5A5E4E] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record New Test</span>
            </button>
          </div>

          {subjectTests.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {subjectTests.map((t) => {
                const prompts = t.correctionPrompts || t.analysis?.tutorPrompts || [];
                return (
                  <div
                    key={t.id}
                    className="bg-white border border-[#E0DBD0] rounded-3xl p-5 shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-[#E0DBD0] pb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#F2EFE9] text-[#6B705C] border border-[#E0DBD0]">
                            {t.testNumber || 'Test'}
                          </span>
                          <span className="text-xs font-mono text-[#A5A58D]">{t.date}</span>
                        </div>
                        <h4 className="text-sm font-bold text-[#4A4E4D] mt-0.5">{t.testName}</h4>
                      </div>

                      <div className="bg-[#F2EFE9] px-3.5 py-1.5 rounded-2xl border border-[#E0DBD0] text-center">
                        <span className="block text-[9px] text-[#A5A58D] font-mono uppercase">Score</span>
                        <span className="text-sm font-mono font-extrabold text-[#4A4E4D]">{t.score}</span>
                      </div>
                    </div>

                    {t.mistakes && (
                      <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900">
                        <span className="font-bold block text-rose-800">Missed Questions / Mistakes:</span>
                        <p className="mt-0.5">{t.mistakes}</p>
                      </div>
                    )}

                    {prompts.length > 0 && (
                      <div className="p-3.5 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-xs space-y-2">
                        <span className="font-bold text-[#4A4E4D] block">AI Correction Prompts:</span>
                        {prompts.map((p, pIdx) => (
                          <div
                            key={pIdx}
                            className="p-2.5 rounded-xl bg-white border border-[#E0DBD0] flex items-center justify-between gap-2"
                          >
                            <p className="italic text-[#4A4E4D]">"{p}"</p>
                            <button
                              onClick={() => {
                                onSendPromptToTutor(p);
                                setActiveTab('tutor');
                              }}
                              className="px-2.5 py-1 rounded-full bg-[#6B705C] text-white text-[10px] font-bold shrink-0 flex items-center gap-1 cursor-pointer hover:bg-[#5A5E4E]"
                            >
                              <span>Practice</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 bg-white rounded-3xl border border-dashed border-[#E0DBD0]">
              <FileCheck className="w-8 h-8 text-[#A5A58D] mx-auto mb-2" />
              <p className="text-xs text-[#6B705C]">No test papers recorded yet for {activeSubject.name}.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ACTIVITY STREAM */}
      {courseTab === 'stream' && (
        <div className="space-y-4">
          <div className="bg-white border border-[#E0DBD0] rounded-3xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-[#4A4E4D] mb-3">Recent Academic Activity & Milestones</h3>
            {subjectSessions.length > 0 ? (
              <div className="space-y-2.5">
                {subjectSessions.slice(0, 10).map((sess, sIdx) => (
                  <div
                    key={sess.id || sIdx}
                    className="p-3 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-[#4A4E4D]">{sess.topicName || 'Study Session'}</div>
                      <div className="text-[10px] text-[#A5A58D]">{sess.date} • {sess.chapterName || 'General'}</div>
                    </div>
                    <span className="font-mono font-bold text-[#6B705C] bg-white px-2.5 py-1 rounded-xl border border-[#E0DBD0]">
                      {sess.durationMinutes} mins
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-[#6B705C]">
                No study sessions logged yet for this subject.
              </div>
            )}
          </div>
        </div>
      )}

      {/* DATA EXTRACTION MODAL */}
      <CourseDataExtractModal
        isOpen={isExtractModalOpen}
        onClose={() => setIsExtractModalOpen(false)}
        activeSubject={activeSubject}
        allSubjects={subjects}
        testResults={testResults}
        sessions={sessions || []}
        notes={notes || []}
        vaults={vaults || []}
        flashcardDecks={flashcardDecks || []}
        userProfile={userProfile}
      />

      {/* GEMINI NOTEBOOK & SUBJECT LINKS MODAL */}
      <GeminiNotebookLinksModal
        isOpen={isGeminiModalOpen}
        onClose={() => setIsGeminiModalOpen(false)}
        activeSubject={activeSubject}
        allSubjects={subjects}
        testResults={testResults}
        onUpdateSubjects={onUpdateSubjects}
        onSelectSubject={(id) => setSelectedSubjectId(id)}
      />

      {/* GOOGLE CLASSROOM LIVE SYNC & FILE EXTRACTOR MODAL */}
      <ClassroomSyncExtractorModal
        isOpen={isClassroomSyncModalOpen}
        onClose={() => setIsClassroomSyncModalOpen(false)}
        subjects={subjects}
        activeSubject={activeSubject}
        vaults={vaults || []}
        userProfile={userProfile}
        effectiveUid={user?.uid || 'user-default'}
        onUpdateSubjects={(newSubs) => {
          if (onUpdateSubjects) onUpdateSubjects(newSubs);
        }}
        onCreateVault={onCreateVault ? (vData) => onCreateVault(vData) : undefined}
        onNotificationAlert={(msg) => setClassroomUploadToast(msg)}
      />

    </div>
  );
};
