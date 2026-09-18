import React, { useState, useEffect } from 'react';
import { 
  X, 
  RefreshCw, 
  Sparkles, 
  BookOpen, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Upload, 
  Plus, 
  FolderPlus, 
  HardDrive, 
  Layers, 
  Clock, 
  Bell,
  ArrowRight,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { Subject, StorageVault, UserProfile } from '../types';
import { 
  fetchClassroomCoursesAndUploads, 
  extractAndApplyClassroomUpload, 
  importUnlinkedClassroomCourse, 
  DetectedClassroomUpload, 
  ClassroomCourse, 
  ClassroomSyncResult 
} from '../lib/googleClassroomService';
import { getOrRequestWorkspaceToken, getCachedWorkspaceToken } from '../lib/googleAuthService';
import { apiExtractStudyMaterial } from '../lib/aiApi';
import { fileOrBlobToBase64 } from '../lib/base64Utils';

interface ClassroomSyncExtractorModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  activeSubject: Subject;
  vaults: StorageVault[];
  userProfile?: UserProfile | null;
  effectiveUid: string;
  onUpdateSubjects: (updatedSubjects: Subject[]) => void;
  onCreateVault?: (vaultData: Omit<StorageVault, 'id' | 'userId' | 'createdAt'>) => void;
  onNotificationAlert?: (message: string) => void;
}

export function ClassroomSyncExtractorModal({
  isOpen,
  onClose,
  subjects,
  activeSubject,
  vaults,
  effectiveUid,
  onUpdateSubjects,
  onCreateVault,
  onNotificationAlert
}: ClassroomSyncExtractorModalProps) {
  const [activeTab, setActiveTab] = useState<'classroom_sync' | 'direct_upload'>('classroom_sync');
  
  // Classroom Sync State
  const [loading, setLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<ClassroomSyncResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [extractingUploadId, setExtractingUploadId] = useState<string | null>(null);
  const [importingCourseId, setImportingCourseId] = useState<string | null>(null);

  // Direct File Upload State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [targetChapterName, setTargetChapterName] = useState('');
  const [isExtractingFile, setIsExtractingFile] = useState(false);
  const [extractStage, setExtractStage] = useState('');

  // Auto-fetch when modal opens if token is available
  useEffect(() => {
    if (isOpen) {
      handleCheckForUploads(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCheckForUploads = async (forcePrompt: boolean = false) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = await getOrRequestWorkspaceToken(forcePrompt);
      const res = await fetchClassroomCoursesAndUploads(subjects, token);
      setSyncResult(res);

      if (res.newUploadCount > 0) {
        const msg = `Found ${res.newUploadCount} newly uploaded item${res.newUploadCount > 1 ? 's' : ''} in Google Classroom!`;
        setSyncNotice(msg);
        onNotificationAlert?.(msg);
      } else if (res.unlinkedCourses.length > 0) {
        setSyncNotice(`Discovered ${res.unlinkedCourses.length} course${res.unlinkedCourses.length > 1 ? 's' : ''} in Google Classroom not yet in your syllabus.`);
      } else {
        setSyncNotice(`Synced with Google Classroom: All courses and uploads are up to date.`);
      }
    } catch (err: any) {
      console.error('Google Classroom sync failed:', err);
      setErrorMsg(err.message || 'Could not connect to Google Classroom. Please check permissions.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportUnlinkedCourse = async (course: ClassroomCourse) => {
    setImportingCourseId(course.id);
    setErrorMsg(null);
    try {
      const token = await getOrRequestWorkspaceToken();
      const { newSubject, newVaults, notification } = await importUnlinkedClassroomCourse({
        course,
        accessToken: token,
        effectiveUid
      });

      // Update Subjects in app
      const merged = [...subjects, newSubject];
      onUpdateSubjects(merged);

      // Create Vaults in app
      if (onCreateVault) {
        for (const v of newVaults) {
          onCreateVault(v);
        }
      }

      setSyncNotice(notification);
      onNotificationAlert?.(notification);

      // Refresh sync list
      if (syncResult) {
        setSyncResult({
          ...syncResult,
          unlinkedCourses: syncResult.unlinkedCourses.filter(c => c.id !== course.id),
          linkedCourses: [...syncResult.linkedCourses, { course, subject: newSubject }]
        });
      }
    } catch (err: any) {
      console.error('Failed to import course:', err);
      setErrorMsg(`Failed to import course: ${err.message}`);
    } finally {
      setImportingCourseId(null);
    }
  };

  const handleExtractUpload = async (upload: DetectedClassroomUpload) => {
    setExtractingUploadId(upload.id);
    setErrorMsg(null);
    try {
      // Find matching subject
      const targetSub = subjects.find(s => 
        s.id === upload.matchedSubjectId || 
        s.name.toLowerCase() === upload.courseName.toLowerCase() ||
        s.name.toLowerCase().includes(upload.courseName.toLowerCase()) ||
        upload.courseName.toLowerCase().includes(s.name.toLowerCase())
      ) || activeSubject;

      const { updatedSubject, newVaults, notification } = extractAndApplyClassroomUpload({
        upload,
        subject: targetSub,
        effectiveUid
      });

      // Update Subjects
      const updatedAll = subjects.map(s => s.id === updatedSubject.id ? updatedSubject : s);
      onUpdateSubjects(updatedAll);

      // Create vaults for attachments
      if (onCreateVault) {
        for (const v of newVaults) {
          onCreateVault(v);
        }
      }

      setSyncNotice(notification);
      onNotificationAlert?.(notification);

      // Update local detection state
      if (syncResult) {
        setSyncResult({
          ...syncResult,
          detectedUploads: syncResult.detectedUploads.map(u => 
            u.id === upload.id ? { ...u, isNew: false } : u
          ),
          newUploadCount: Math.max(0, syncResult.newUploadCount - 1)
        });
      }
    } catch (err: any) {
      console.error('Failed to extract upload:', err);
      setErrorMsg(`Failed to extract upload: ${err.message}`);
    } finally {
      setExtractingUploadId(null);
    }
  };

  // Direct File Upload & Extraction Handler
  const handleDirectFileExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setIsExtractingFile(true);
    setExtractStage('Reading and parsing file contents...');
    setErrorMsg(null);

    try {
      let fileText = '';
      let base64Data = '';
      const mime = uploadFile.type || 'text/plain';

      if (uploadFile.type === 'text/plain' || uploadFile.name.endsWith('.txt') || uploadFile.name.endsWith('.md')) {
        fileText = await uploadFile.text();
      } else {
        base64Data = await fileOrBlobToBase64(uploadFile);
      }

      setExtractStage('Extracting curriculum chapters, topics, and key concepts...');

      const aiResult = await apiExtractStudyMaterial({
        text: fileText || undefined,
        fileData: base64Data || undefined,
        mimeType: mime,
        sourceTitle: uploadTitle || uploadFile.name,
        generateSyllabus: true,
        generateTasks: true
      });

      const extractedSubjects = aiResult?.subjects || [];
      const primaryExtracted = extractedSubjects[0];

      let updatedChapters = [...activeSubject.chapters];
      let newTopicsCount = 0;

      if (primaryExtracted && primaryExtracted.chapters && primaryExtracted.chapters.length > 0) {
        primaryExtracted.chapters.forEach((ch: any) => {
          newTopicsCount += (ch.topics?.length || 0);
          const existingIdx = updatedChapters.findIndex(ec => ec.name.toLowerCase() === ch.name.toLowerCase());
          if (existingIdx >= 0) {
            updatedChapters[existingIdx] = {
              ...updatedChapters[existingIdx],
              topics: [...updatedChapters[existingIdx].topics, ...(ch.topics || [])]
            };
          } else {
            updatedChapters.push({
              id: `chap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: ch.name,
              topics: ch.topics || []
            });
          }
        });
      } else {
        // Fallback: create a chapter with the file title
        const chName = targetChapterName.trim() || `Material: ${uploadTitle || uploadFile.name}`;
        newTopicsCount = 1;
        updatedChapters.push({
          id: `chap-${Date.now()}`,
          name: chName,
          topics: [
            {
              id: `top-${Date.now()}`,
              name: uploadTitle || uploadFile.name.replace(/\.[^/.]+$/, ''),
              status: 'Not Started',
              estimatedMinutes: 60,
              subtopics: [
                { id: `sub-${Date.now()}-1`, name: 'Read and review core notes', completed: false },
                { id: `sub-${Date.now()}-2`, name: 'Extract key formulas and definitions', completed: false }
              ]
            }
          ]
        });
      }

      const updatedSub: Subject = {
        ...activeSubject,
        chapters: updatedChapters
      };

      const updatedAll = subjects.map(s => s.id === updatedSub.id ? updatedSub : s);
      onUpdateSubjects(updatedAll);

      // Create Vault item for the uploaded file
      if (onCreateVault) {
        onCreateVault({
          name: uploadTitle || uploadFile.name,
          subjectName: activeSubject.name,
          chapterName: targetChapterName.trim() || 'Uploaded Lecture Materials',
          category: 'Textbook & Coursework',
          color: activeSubject.color || '#4D7C5D',
          icon: '📄',
          description: `Directly uploaded and parsed into syllabus. ${newTopicsCount} topic(s) extracted.`,
          metadata: {
            instructor: 'Direct Upload',
            cohortOrSemester: activeSubject.name,
            benchmarkNotes: `Extracted on ${new Date().toLocaleDateString()}`
          }
        });
      }

      const successMsg = `Successfully extracted ${newTopicsCount} topic(s) from "${uploadFile.name}" into ${activeSubject.name}!`;
      setSyncNotice(successMsg);
      onNotificationAlert?.(successMsg);

      // Reset form
      setUploadFile(null);
      setUploadTitle('');
      setTargetChapterName('');
    } catch (err: any) {
      console.error('File extraction failed:', err);
      setErrorMsg(err.message || 'Failed to extract data from uploaded file.');
    } finally {
      setIsExtractingFile(false);
      setExtractStage('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-[#FAF8F5] border border-[#E0DBD0] rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-[#4D7C5D] via-[#5A876B] to-[#6B705C] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center border border-white/20">
              <Zap className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-serif font-bold italic">Classroom & File Sync Engine</h2>
                <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-mono tracking-wider uppercase font-bold">
                  Live Watcher
                </span>
              </div>
              <p className="text-xs text-white/85">
                Automatically detect newly uploaded files in Google Classroom and extract into your StudyOS syllabus.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition cursor-pointer text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#E0DBD0] bg-white px-6 shrink-0">
          <button
            onClick={() => setActiveTab('classroom_sync')}
            className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'classroom_sync'
                ? 'border-[#4D7C5D] text-[#4D7C5D]'
                : 'border-transparent text-[#6B705C] hover:text-[#4A4E4D]'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Google Classroom Live Sync</span>
            {syncResult && syncResult.newUploadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-mono text-[10px] font-bold">
                {syncResult.newUploadCount} New
              </span>
            )}
            {syncResult && syncResult.unlinkedCourses.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
                {syncResult.unlinkedCourses.length} Available
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('direct_upload')}
            className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'direct_upload'
                ? 'border-[#4D7C5D] text-[#4D7C5D]'
                : 'border-transparent text-[#6B705C] hover:text-[#4A4E4D]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Direct File Upload & Extraction</span>
          </button>
        </div>

        {/* Notices and Alerts */}
        {syncNotice && (
          <div className="px-6 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between text-xs text-emerald-900 font-medium">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{syncNotice}</span>
            </div>
            <button 
              onClick={() => setSyncNotice(null)} 
              className="text-emerald-700 hover:text-emerald-900 text-[11px] font-bold underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="px-6 py-3 bg-rose-50 border-b border-rose-200 flex items-center justify-between text-xs text-rose-900 font-medium">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button 
              onClick={() => setErrorMsg(null)} 
              className="text-rose-700 hover:text-rose-900 text-[11px] font-bold underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {activeTab === 'classroom_sync' && (
            <div className="space-y-6">
              {/* Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-[#E0DBD0]">
                <div>
                  <h3 className="font-bold text-sm text-[#333]">Google Classroom Automatic Watcher</h3>
                  <p className="text-xs text-[#6B705C]">
                    Inspects your linked courses for new coursework, assignments, and attached Drive files.
                  </p>
                </div>
                <button
                  onClick={() => handleCheckForUploads(true)}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-[#4D7C5D] text-white hover:bg-[#3D6349] font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 shrink-0 shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>{loading ? 'Checking for Uploads...' : 'Check Classroom for New Uploads'}</span>
                </button>
              </div>

              {/* 1. Unlinked Classroom Courses (Not initially in Syllabus) */}
              {syncResult && syncResult.unlinkedCourses.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderPlus className="w-4 h-4 text-emerald-700" />
                      <h4 className="font-bold text-xs uppercase tracking-wider text-[#4A4E4D]">
                        Google Classroom Courses (Not Initially In Syllabus)
                      </h4>
                    </div>
                    <span className="text-[11px] font-mono text-[#6B705C]">
                      {syncResult.unlinkedCourses.length} available to import
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {syncResult.unlinkedCourses.map(course => (
                      <div
                        key={course.id}
                        className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-xs flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
                              Classroom Course
                            </span>
                            {course.section && (
                              <span className="text-[10px] font-mono text-[#777]">
                                Sec: {course.section}
                              </span>
                            )}
                          </div>
                          <h5 className="font-bold text-sm text-[#222] line-clamp-1">{course.name}</h5>
                          {course.description && (
                            <p className="text-[11px] text-[#6B705C] line-clamp-2">{course.description}</p>
                          )}
                        </div>

                        <button
                          onClick={() => handleImportUnlinkedCourse(course)}
                          disabled={importingCourseId === course.id}
                          className="w-full py-2 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                        >
                          {importingCourseId === course.id ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Extracting Syllabus & Materials...</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Course & Extract Syllabus</span>
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Detected Uploads & Coursework */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#4D7C5D]" />
                    <h4 className="font-bold text-xs uppercase tracking-wider text-[#4A4E4D]">
                      Uploaded Coursework, Assignments & Reading Materials
                    </h4>
                  </div>
                  {syncResult && (
                    <span className="text-[11px] font-mono text-[#6B705C]">
                      {syncResult.detectedUploads.length} total found
                    </span>
                  )}
                </div>

                {!syncResult && !loading && (
                  <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-[#D5CFC4] text-xs text-[#6B705C] space-y-2">
                    <Bell className="w-8 h-8 mx-auto text-[#A5A58D] opacity-60" />
                    <p className="font-medium text-[#4A4E4D]">Click "Check Classroom for New Uploads" to inspect Google Classroom.</p>
                    <p className="text-[11px]">The engine will list any recently uploaded documents, problem sets, and lecture handouts.</p>
                  </div>
                )}

                {loading && (
                  <div className="p-8 text-center bg-white rounded-2xl border border-[#E0DBD0] text-xs text-[#6B705C] space-y-3">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#4D7C5D]" />
                    <p className="font-bold text-[#333]">Scanning Google Classroom courses and coursework attachments...</p>
                  </div>
                )}

                {syncResult && syncResult.detectedUploads.length === 0 && !loading && (
                  <div className="p-6 text-center bg-white rounded-2xl border border-[#E0DBD0] text-xs text-[#6B705C]">
                    No coursework or file uploads found in linked Google Classroom courses.
                  </div>
                )}

                {syncResult && syncResult.detectedUploads.length > 0 && (
                  <div className="space-y-3">
                    {syncResult.detectedUploads.map(upload => (
                      <div
                        key={upload.id}
                        className={`p-4 rounded-2xl bg-white border transition ${
                          upload.isNew 
                            ? 'border-amber-300 bg-amber-50/30 ring-1 ring-amber-200' 
                            : 'border-[#E0DBD0]'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              {upload.isNew && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-mono font-bold text-[9px] uppercase tracking-wider flex items-center gap-1">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  <span>New Upload</span>
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded-full bg-[#EAE7DF] text-[#4A4E4D] font-mono text-[10px]">
                                {upload.itemType === 'coursework' ? 'Assignment' : 'Course Material'}
                              </span>
                              <span className="font-mono text-[10px] text-[#6B705C]">
                                {upload.courseName}
                              </span>
                              {upload.dueDate && (
                                <span className="font-mono text-[10px] text-rose-700 font-bold">
                                  Due: {upload.dueDate}
                                </span>
                              )}
                            </div>

                            <h5 className="font-bold text-sm text-[#222] truncate">{upload.title}</h5>
                            
                            {upload.description && (
                              <p className="text-xs text-[#6B705C] line-clamp-2 leading-relaxed">
                                {upload.description}
                              </p>
                            )}

                            {/* Attached Files List */}
                            {upload.fileAttachments.length > 0 && (
                              <div className="flex items-center gap-2 flex-wrap pt-1">
                                <span className="text-[10px] font-mono text-[#777] uppercase font-bold">
                                  Files ({upload.fileAttachments.length}):
                                </span>
                                {upload.fileAttachments.map(f => (
                                  <a
                                    key={f.id}
                                    href={f.alternateLink || '#'}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2 py-1 rounded-lg bg-[#F2EFE9] hover:bg-[#EAE7DF] text-[#4A4E4D] font-mono text-[10px] flex items-center gap-1 transition"
                                  >
                                    <FileText className="w-3 h-3 text-[#4D7C5D]" />
                                    <span className="truncate max-w-[140px]">{f.title}</span>
                                    <ExternalLink className="w-2.5 h-2.5 text-[#888]" />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            <button
                              onClick={() => handleExtractUpload(upload)}
                              disabled={extractingUploadId === upload.id}
                              className={`py-2 px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 ${
                                upload.isNew
                                  ? 'bg-[#4D7C5D] hover:bg-[#3D6349] text-white shadow-xs'
                                  : 'bg-[#F2EFE9] hover:bg-[#EAE7DF] text-[#4A4E4D] border border-[#E0DBD0]'
                              }`}
                            >
                              {extractingUploadId === upload.id ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>Extracting...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                  <span>{upload.isNew ? 'Extract & Update App' : 'Re-extract Topics'}</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'direct_upload' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-white border border-[#E0DBD0]">
                <h3 className="font-bold text-sm text-[#333]">Upload & Extract Study Material File</h3>
                <p className="text-xs text-[#6B705C]">
                  Upload lecture notes, assignment sheets, or syllabi directly into <strong>{activeSubject.name}</strong>.
                  Our AI engine will parse the file into syllabus chapters, topics, and save the document to your Course Materials Vault.
                </p>
              </div>

              <form onSubmit={handleDirectFileExtract} className="space-y-4">
                {/* File Drop Area */}
                <div className="border-2 border-dashed border-[#D5CFC4] hover:border-[#4D7C5D] rounded-2xl p-6 text-center bg-white transition cursor-pointer relative">
                  <input
                    type="file"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setUploadFile(e.target.files[0]);
                        if (!uploadTitle) {
                          setUploadTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ''));
                        }
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    accept=".pdf,.docx,.txt,.md,.json"
                  />
                  <Upload className="w-8 h-8 mx-auto text-[#4D7C5D] mb-2" />
                  {uploadFile ? (
                    <div className="space-y-1">
                      <p className="font-bold text-sm text-[#222]">{uploadFile.name}</p>
                      <p className="text-xs text-[#6B705C]">
                        {(uploadFile.size / 1024).toFixed(1)} KB • Click to change file
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="font-bold text-xs text-[#333]">Drag & drop or click to browse files</p>
                      <p className="text-[11px] text-[#888]">PDF, TXT, Markdown, Word Doc</p>
                    </div>
                  )}
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#4A4E4D] mb-1">
                      Material Title
                    </label>
                    <input
                      type="text"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      placeholder="e.g. Unit 3 Molecular Genetics Handout"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#E0DBD0] text-xs focus:outline-hidden focus:border-[#4D7C5D]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#4A4E4D] mb-1">
                      Target Chapter / Unit (Optional)
                    </label>
                    <input
                      type="text"
                      value={targetChapterName}
                      onChange={(e) => setTargetChapterName(e.target.value)}
                      placeholder="Leave blank for auto-detected unit"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#E0DBD0] text-xs focus:outline-hidden focus:border-[#4D7C5D]"
                    />
                  </div>
                </div>

                {/* Active Subject Indicator */}
                <div className="p-3 rounded-xl bg-[#F2EFE9] border border-[#E0DBD0] flex items-center justify-between text-xs text-[#555]">
                  <span>Target Course:</span>
                  <span className="font-bold font-serif italic text-[#333]">{activeSubject.name}</span>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={!uploadFile || isExtractingFile}
                  className="w-full py-3 rounded-2xl bg-[#4D7C5D] hover:bg-[#3D6349] text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  {isExtractingFile ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{extractStage || 'Extracting data and updating app...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-200" />
                      <span>Upload & Extract Into {activeSubject.name}</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-[#E0DBD0] flex items-center justify-between text-xs text-[#6B705C] shrink-0">
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Google Classroom OAuth Bearer Token Active</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#F2EFE9] hover:bg-[#EAE7DF] text-[#4A4E4D] font-bold text-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
