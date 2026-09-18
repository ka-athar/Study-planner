import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar as CalendarIcon, 
  HardDrive, 
  BookOpen, 
  Check, 
  RefreshCw, 
  ExternalLink, 
  Plus, 
  Trash2, 
  Upload, 
  FileText, 
  Search, 
  Copy, 
  Sparkles, 
  AlertCircle,
  CheckSquare,
  ListTodo,
  Clock,
  ArrowRight,
  GraduationCap,
  Video,
  FileDown,
  CheckCircle2,
  FolderOpen,
  Send,
  Users,
  ChevronRight,
  Layers,
  HelpCircle,
  FileCheck,
  Eye,
  Download
} from 'lucide-react';
import { StudyPlan, StudySession, Subject, RevisionItem, ExamDate, FlashcardDeck, UserProfile, StudyPlanTopic, TestResult, Assignment } from '../types';
import { 
  listCalendarEvents, 
  createCalendarEvent, 
  syncStudyPlansToGoogleCalendar, 
  deleteCalendarEvent,
  GoogleCalendarEvent 
} from '../lib/googleCalendarService';
import { 
  listDriveFiles, 
  uploadStudyBackupToDrive, 
  createStudyNoteDocInDrive, 
  deleteDriveFile,
  downloadDriveFileContent,
  restoreFromDriveBackup,
  DriveFileItem 
} from '../lib/googleDriveService';
import { 
  formatPlanForGoogleKeep, 
  formatSyllabusForGoogleKeep, 
  formatFlashcardDeckForGoogleKeep, 
  formatRevisionsForGoogleKeep, 
  copyAndOpenGoogleKeep 
} from '../lib/googleKeepService';
import {
  listTaskLists,
  listTasks,
  createGoogleTask,
  toggleGoogleTaskStatus,
  deleteGoogleTask,
  syncPlansAndRevisionsToGoogleTasks,
  getOrCreateStudyTaskList,
  GoogleTaskList,
  GoogleTaskItem
} from '../lib/googleTasksService';
import {
  listClassroomCourses,
  listCourseWork,
  listCourseMaterials,
  listCourseAnnouncements,
  convertClassroomToStudyOS,
  ClassroomCourse,
  ClassroomCourseWork,
  ClassroomCourseMaterial,
  ClassroomAnnouncement
} from '../lib/googleClassroomService';
import {
  exportSyllabusToGoogleDoc,
  exportFlashcardDeckToGoogleDoc,
  exportStudyPlanToGoogleDoc,
  createGoogleDocWithContent,
  GoogleDocResult
} from '../lib/googleDocsService';
import {
  createInstantMeetRoom,
  scheduleMeetStudySession,
  GoogleMeetRoom
} from '../lib/googleMeetService';
import { getCachedWorkspaceToken } from '../lib/googleAuthService';

export type WorkspaceTab = 'classroom' | 'docs' | 'meet' | 'tasks' | 'calendar' | 'drive' | 'keep';

interface GoogleWorkspaceHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: WorkspaceTab;
  plans: StudyPlan[];
  sessions: StudySession[];
  subjects: Subject[];
  revisions: RevisionItem[];
  examDates: ExamDate[];
  flashcardDecks?: FlashcardDeck[];
  testResults?: TestResult[];
  assignments?: Assignment[];
  userProfile: UserProfile | null;
  onImportClassroomSubject?: (subject: Subject, tasks?: StudyPlanTopic[]) => void;
}

export const GoogleWorkspaceHubModal: React.FC<GoogleWorkspaceHubModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'classroom',
  plans,
  sessions,
  subjects,
  revisions,
  examDates,
  flashcardDecks = [],
  testResults = [],
  assignments = [],
  userProfile,
  onImportClassroomSubject
}) => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // --- Confirmation Modal State ---
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // --- Google Classroom State ---
  const [classroomCourses, setClassroomCourses] = useState<ClassroomCourse[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<ClassroomCourse | null>(null);
  const [courseWorkItems, setCourseWorkItems] = useState<ClassroomCourseWork[]>([]);
  const [courseMaterials, setCourseMaterials] = useState<ClassroomCourseMaterial[]>([]);
  const [courseAnnouncements, setCourseAnnouncements] = useState<ClassroomAnnouncement[]>([]);
  const [isLoadingClassroomDetails, setIsLoadingClassroomDetails] = useState<boolean>(false);
  const [isImportingCourse, setIsImportingCourse] = useState<boolean>(false);

  // --- Google Docs State ---
  const [selectedDocSubject, setSelectedDocSubject] = useState<string>(subjects[0]?.id || '');
  const [selectedDocDeck, setSelectedDocDeck] = useState<string>(flashcardDecks[0]?.id || '');
  const [selectedDocPlan, setSelectedDocPlan] = useState<string>(plans[0]?.id || '');
  const [customDocTitle, setCustomDocTitle] = useState<string>('');
  const [customDocContent, setCustomDocContent] = useState<string>('');
  const [isExportingDoc, setIsExportingDoc] = useState<boolean>(false);
  const [createdDocs, setCreatedDocs] = useState<GoogleDocResult[]>([]);

  // --- Google Meet State ---
  const [activeMeetRoom, setActiveMeetRoom] = useState<GoogleMeetRoom | null>(null);
  const [isCreatingMeet, setIsCreatingMeet] = useState<boolean>(false);
  const [meetRoomTitle, setMeetRoomTitle] = useState<string>('StudyOS Peer Focus Room');
  const [scheduledMeetTopic, setScheduledMeetTopic] = useState<string>(subjects[0]?.name || 'Exam Revision');
  const [scheduledMeetDate, setScheduledMeetDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [scheduledMeetTime, setScheduledMeetTime] = useState<string>('18:00');
  const [scheduledMeetDuration, setScheduledMeetDuration] = useState<number>(45);

  // --- Calendar State ---
  const [calendarEvents, setCalendarEvents] = useState<GoogleCalendarEvent[]>([]);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState<boolean>(false);
  const [calendarSyncProgress, setCalendarSyncProgress] = useState<string>('');
  const [showAddEventForm, setShowAddEventForm] = useState<boolean>(false);
  const [newEventTitle, setNewEventTitle] = useState<string>('');
  const [newEventDate, setNewEventDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newEventTime, setNewEventTime] = useState<string>('09:00');
  const [newEventDuration, setNewEventDuration] = useState<number>(60);
  const [newEventDesc, setNewEventDesc] = useState<string>('');

  // --- Drive State ---
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [driveFilter, setDriveFilter] = useState<'all' | 'documents' | 'pdfs' | 'spreadsheets'>('all');
  const [driveSearchQuery, setDriveSearchQuery] = useState<string>('');
  const [isUploadingToDrive, setIsUploadingToDrive] = useState<boolean>(false);
  const [showNewDocModal, setShowNewDocModal] = useState<boolean>(false);
  const [newDocTitle, setNewDocTitle] = useState<string>('');
  const [newDocSubject, setNewDocSubject] = useState<string>(subjects[0]?.name || '');
  const [newDocContent, setNewDocContent] = useState<string>('');
  const [previewDriveFile, setPreviewDriveFile] = useState<{
    id: string;
    name: string;
    content?: string;
    mimeType: string;
    loading: boolean;
    error?: string;
  } | null>(null);

  // --- Tasks State ---
  const [taskLists, setTaskLists] = useState<GoogleTaskList[]>([]);
  const [selectedTaskListId, setSelectedTaskListId] = useState<string>('@default');
  const [tasks, setTasks] = useState<GoogleTaskItem[]>([]);
  const [tasksFilter, setTasksFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [isSyncingTasks, setIsSyncingTasks] = useState<boolean>(false);
  const [tasksSyncProgress, setTasksSyncProgress] = useState<string>('');
  const [showAddTaskForm, setShowAddTaskForm] = useState<boolean>(false);
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [newTaskNotes, setNewTaskNotes] = useState<string>('');
  const [newTaskDueDate, setNewTaskDueDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // --- Keep State ---
  const [selectedKeepSubject, setSelectedKeepSubject] = useState<string>(subjects[0]?.id || '');
  const [selectedKeepDeck, setSelectedKeepDeck] = useState<string>(flashcardDecks[0]?.id || '');

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'classroom') loadClassroom();
      if (activeTab === 'calendar') loadCalendar();
      if (activeTab === 'drive') loadDrive();
      if (activeTab === 'tasks') loadTasks(selectedTaskListId);
    }
  }, [isOpen, activeTab]);

  const showFeedback = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  // ================= CLASSROOM HANDLERS =================
  const loadClassroom = async () => {
    setIsLoading(true);
    try {
      const courses = await listClassroomCourses();
      setClassroomCourses(courses);
      if (courses.length > 0 && !selectedCourse) {
        handleSelectCourse(courses[0]);
      }
    } catch (err: any) {
      console.warn('Classroom fetch note:', err.message);
      showFeedback(`Google Classroom: ${err.message}`, 'info');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectCourse = async (course: ClassroomCourse) => {
    setSelectedCourse(course);
    setIsLoadingClassroomDetails(true);
    try {
      const [cw, mat, ann] = await Promise.all([
        listCourseWork(course.id).catch(() => []),
        listCourseMaterials(course.id).catch(() => []),
        listCourseAnnouncements(course.id).catch(() => [])
      ]);
      setCourseWorkItems(cw);
      setCourseMaterials(mat);
      setCourseAnnouncements(ann);
    } catch (err: any) {
      showFeedback(`Could not load coursework for ${course.name}`, 'info');
    } finally {
      setIsLoadingClassroomDetails(false);
    }
  };

  const handleImportSelectedCourseToSyllabus = async () => {
    if (!selectedCourse) return;
    setIsImportingCourse(true);
    try {
      const { subject, tasks: courseTasks } = convertClassroomToStudyOS(
        selectedCourse,
        courseWorkItems,
        courseMaterials
      );

      if (onImportClassroomSubject) {
        onImportClassroomSubject(subject, courseTasks);
        showFeedback(`Successfully imported "${selectedCourse.name}" into your Syllabus & Tasks!`);
      } else {
        showFeedback(`Prepared syllabus structure for "${selectedCourse.name}"!`);
      }
    } catch (err: any) {
      showFeedback(`Import error: ${err.message}`, 'error');
    } finally {
      setIsImportingCourse(false);
    }
  };

  // ================= GOOGLE DOCS HANDLERS =================
  const handleExportSyllabusToDoc = async () => {
    const sub = subjects.find(s => s.id === selectedDocSubject) || subjects[0];
    if (!sub) {
      showFeedback('Please select a subject to export.', 'info');
      return;
    }
    setIsExportingDoc(true);
    try {
      const res = await exportSyllabusToGoogleDoc(sub);
      setCreatedDocs(prev => [res, ...prev]);
      showFeedback(`Created Google Doc: "${res.title}"`);
    } catch (err: any) {
      showFeedback(`Google Doc creation failed: ${err.message}`, 'error');
    } finally {
      setIsExportingDoc(false);
    }
  };

  const handleExportFlashcardsToDoc = async () => {
    const deck = flashcardDecks.find(d => d.id === selectedDocDeck) || flashcardDecks[0];
    if (!deck) {
      showFeedback('No flashcard deck available to export.', 'info');
      return;
    }
    setIsExportingDoc(true);
    try {
      const res = await exportFlashcardDeckToGoogleDoc(deck);
      setCreatedDocs(prev => [res, ...prev]);
      showFeedback(`Created Google Doc: "${res.title}"`);
    } catch (err: any) {
      showFeedback(`Google Doc creation failed: ${err.message}`, 'error');
    } finally {
      setIsExportingDoc(false);
    }
  };

  const handleExportPlanToDoc = async () => {
    const plan = plans.find(p => p.id === selectedDocPlan) || plans[0];
    if (!plan) {
      showFeedback('No study plan available to export.', 'info');
      return;
    }
    setIsExportingDoc(true);
    try {
      const res = await exportStudyPlanToGoogleDoc(plan);
      setCreatedDocs(prev => [res, ...prev]);
      showFeedback(`Created Google Doc: "${res.title}"`);
    } catch (err: any) {
      showFeedback(`Google Doc creation failed: ${err.message}`, 'error');
    } finally {
      setIsExportingDoc(false);
    }
  };

  const handleCreateCustomDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDocTitle.trim()) return;
    setIsExportingDoc(true);
    try {
      const res = await createGoogleDocWithContent(
        customDocTitle.trim(),
        customDocContent.trim() || `# ${customDocTitle}\n\nGenerated by StudyOS on ${new Date().toLocaleDateString()}\n\n---\n`
      );
      setCreatedDocs(prev => [res, ...prev]);
      showFeedback(`Created Google Doc: "${res.title}"`);
      setCustomDocTitle('');
      setCustomDocContent('');
    } catch (err: any) {
      showFeedback(`Google Doc creation failed: ${err.message}`, 'error');
    } finally {
      setIsExportingDoc(false);
    }
  };

  // ================= GOOGLE MEET HANDLERS =================
  const handleLaunchInstantMeet = async () => {
    setIsCreatingMeet(true);
    try {
      const room = await createInstantMeetRoom(meetRoomTitle || 'StudyOS Focus Room');
      setActiveMeetRoom(room);
      showFeedback(`Google Meet study room generated!`);
      // Open in a new tab for seamless joining
      window.open(room.meetingUri, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      showFeedback(`Meet creation failed: ${err.message}`, 'error');
    } finally {
      setIsCreatingMeet(false);
    }
  };

  const handleScheduleMeet = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingMeet(true);
    try {
      const startIso = `${scheduledMeetDate}T${scheduledMeetTime}:00`;
      const room = await scheduleMeetStudySession(
        scheduledMeetTopic,
        startIso,
        Number(scheduledMeetDuration),
        `Group study session on ${scheduledMeetTopic} organized via StudyOS.`
      );
      setActiveMeetRoom(room);
      showFeedback(`Scheduled Google Meet study session on your Calendar!`);
    } catch (err: any) {
      showFeedback(`Failed to schedule Meet session: ${err.message}`, 'error');
    } finally {
      setIsCreatingMeet(false);
    }
  };

  // ================= CALENDAR HANDLERS =================
  const loadCalendar = async () => {
    setIsLoading(true);
    try {
      const now = new Date();
      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const twoMonthsAhead = new Date(now.getFullYear(), now.getMonth() + 2, 1).toISOString();

      const events = await listCalendarEvents(oneMonthAgo, twoMonthsAhead);
      setCalendarEvents(events);
    } catch (err: any) {
      console.warn('Calendar fetch note:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncAllToGoogleCalendar = () => {
    const totalItems = plans.length + examDates.length + revisions.filter(r => r.status !== 'Completed').length + testResults.length + assignments.length;

    setConfirmationModal({
      isOpen: true,
      title: 'Sync Schedule, Tests & Exams to Google Calendar?',
      description: `This will create events in your Primary Google Calendar for your study plans (${plans.length}), exams (${examDates.length}), mock tests (${testResults.length}), assignments (${assignments.length}), and spaced revisions.`,
      confirmLabel: 'Sync to Calendar',
      onConfirm: async () => {
        setIsSyncingCalendar(true);
        setCalendarSyncProgress('Starting calendar synchronization...');
        try {
          const res = await syncStudyPlansToGoogleCalendar(
            { 
              plans, 
              examDates, 
              revisions: revisions.filter(r => r.status !== 'Completed'),
              testResults,
              assignments
            },
            (cur, total, item) => setCalendarSyncProgress(`Syncing event ${cur}/${total}: ${item}`)
          );

          if (res.success) {
            showFeedback(`Successfully synced ${res.createdCount} events to your Google Calendar!`);
          } else {
            showFeedback(`Synced ${res.createdCount} events with some notices: ${res.errors[0] || ''}`, 'info');
          }
          await loadCalendar();
        } catch (err: any) {
          showFeedback(`Sync failed: ${err.message}`, 'error');
        } finally {
          setIsSyncingCalendar(false);
          setCalendarSyncProgress('');
        }
      }
    });
  };

  const handleCreateCustomEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;

    setIsLoading(true);
    try {
      await createCalendarEvent({
        summary: newEventTitle.trim(),
        startDate: newEventDate,
        startTime: newEventTime,
        durationMinutes: Number(newEventDuration),
        description: newEventDesc.trim() || 'StudyFlow Study Session'
      });

      showFeedback(`Added "${newEventTitle}" to your Google Calendar!`);
      setNewEventTitle('');
      setNewEventDesc('');
      setShowAddEventForm(false);
      await loadCalendar();
    } catch (err: any) {
      showFeedback(`Could not create event: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCalendarEvent = (eventId: string, summary: string) => {
    setConfirmationModal({
      isOpen: true,
      title: 'Delete Calendar Event?',
      description: `Are you sure you want to delete "${summary}" from your Google Calendar? This action cannot be undone.`,
      confirmLabel: 'Delete Event',
      onConfirm: async () => {
        try {
          await deleteCalendarEvent(eventId);
          showFeedback(`Event "${summary}" deleted from Google Calendar.`);
          setCalendarEvents(prev => prev.filter(e => e.id !== eventId));
        } catch (err: any) {
          showFeedback(`Delete failed: ${err.message}`, 'error');
        }
      }
    });
  };

  // ================= DRIVE HANDLERS =================
  const loadDrive = async () => {
    setIsLoading(true);
    try {
      const files = await listDriveFiles({
        query: driveSearchQuery,
        mimeTypeFilter: driveFilter === 'all' ? undefined : driveFilter
      });
      setDriveFiles(files);
    } catch (err: any) {
      console.warn('Drive load note:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackupToDrive = () => {
    setConfirmationModal({
      isOpen: true,
      title: 'Save Complete Backup to Google Drive?',
      description: 'This will upload a comprehensive JSON archive containing your syllabus topics, study logs, test results, and revision history into your Google Drive.',
      confirmLabel: 'Upload to Drive',
      onConfirm: async () => {
        setIsUploadingToDrive(true);
        try {
          const backupPayload = {
            exportDate: new Date().toISOString(),
            profile: userProfile,
            subjects,
            sessions,
            plans,
            revisions,
            examDates,
            flashcardDecks
          };

          const res = await uploadStudyBackupToDrive(backupPayload);
          showFeedback(`Backup successfully uploaded to Google Drive! (File ID: ${res.fileId})`);
          await loadDrive();
        } catch (err: any) {
          showFeedback(`Drive upload failed: ${err.message}`, 'error');
        } finally {
          setIsUploadingToDrive(false);
        }
      }
    });
  };

  const handleCreateDocInDrive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim()) return;

    setIsLoading(true);
    try {
      await createStudyNoteDocInDrive(
        newDocTitle.trim(),
        newDocContent.trim() || `# ${newDocTitle}\n\nSubject: ${newDocSubject}\nDate: ${new Date().toLocaleDateString()}\n\n---\n\nStudy notes...`,
        newDocSubject
      );

      showFeedback(`Created study document "${newDocTitle}" in your Google Drive!`);
      setShowNewDocModal(false);
      setNewDocTitle('');
      setNewDocContent('');
      await loadDrive();
    } catch (err: any) {
      showFeedback(`Could not create document in Drive: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDriveFile = (fileId: string, fileName: string) => {
    setConfirmationModal({
      isOpen: true,
      title: 'Delete Google Drive File?',
      description: `Are you sure you want to delete "${fileName}" from your Google Drive? This action cannot be undone.`,
      confirmLabel: 'Delete File',
      onConfirm: async () => {
        try {
          await deleteDriveFile(fileId);
          showFeedback(`Deleted "${fileName}" from Google Drive.`);
          setDriveFiles(prev => prev.filter(f => f.id !== fileId));
        } catch (err: any) {
          showFeedback(`Delete failed: ${err.message}`, 'error');
        }
      }
    });
  };

  const handlePreviewDriveFile = async (file: DriveFileItem) => {
    setPreviewDriveFile({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      loading: true
    });
    try {
      const content = await downloadDriveFileContent(file.id, file.mimeType);
      setPreviewDriveFile({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        content,
        loading: false
      });
    } catch (err: any) {
      setPreviewDriveFile({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        error: `Could not load in-app text preview: ${err.message}. You can open this file directly in Google Drive with full rendering.`,
        loading: false
      });
    }
  };

  const handleRestoreFromDriveSnapshot = (fileId: string, fileName: string) => {
    setConfirmationModal({
      isOpen: true,
      title: 'Restore Study Snapshot from Google Drive?',
      description: `Are you sure you want to restore "${fileName}"? This will download the snapshot from your Drive Academic Vault and synchronize your active StudyOS subjects, plans, and revisions.`,
      confirmLabel: 'Restore Snapshot',
      onConfirm: async () => {
        setIsLoading(true);
        try {
          const snapshotData = await restoreFromDriveBackup(fileId);
          showFeedback(`Successfully loaded snapshot "${fileName}"! Refreshing workspace...`);
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } catch (err: any) {
          showFeedback(`Failed to restore snapshot: ${err.message}`, 'error');
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  // ================= TASKS HANDLERS =================
  const loadTasks = async (listId: string = '@default') => {
    setIsLoading(true);
    try {
      // First load task lists
      const lists = await listTaskLists();
      setTaskLists(lists);

      // Then load items in selected list
      const items = await listTasks(listId);
      setTasks(items);
    } catch (err: any) {
      console.warn('Google Tasks load note:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    const isCompleted = currentStatus === 'completed';
    const newStatus = !isCompleted;

    // Optimistic UI update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus ? 'completed' : 'needsAction' } : t));

    try {
      await toggleGoogleTaskStatus(selectedTaskListId, taskId, newStatus);
      showFeedback(newStatus ? 'Marked task completed in Google Tasks!' : 'Marked task active in Google Tasks!');
    } catch (err: any) {
      showFeedback(`Failed to update task: ${err.message}`, 'error');
      await loadTasks(selectedTaskListId);
    }
  };

  const handleCreateCustomTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    setIsLoading(true);
    try {
      await createGoogleTask({
        title: newTaskTitle.trim(),
        notes: newTaskNotes.trim() || undefined,
        dueDate: newTaskDueDate,
        taskListId: selectedTaskListId
      });

      showFeedback(`Task "${newTaskTitle}" created in Google Tasks!`);
      setNewTaskTitle('');
      setNewTaskNotes('');
      setShowAddTaskForm(false);
      await loadTasks(selectedTaskListId);
    } catch (err: any) {
      showFeedback(`Failed to create task: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTask = (taskId: string, title: string) => {
    setConfirmationModal({
      isOpen: true,
      title: 'Delete Google Task?',
      description: `Are you sure you want to delete "${title}" from your Google Tasks? This cannot be undone.`,
      confirmLabel: 'Delete Task',
      onConfirm: async () => {
        try {
          await deleteGoogleTask(selectedTaskListId, taskId);
          showFeedback(`Deleted task "${title}".`);
          setTasks(prev => prev.filter(t => t.id !== taskId));
        } catch (err: any) {
          showFeedback(`Delete failed: ${err.message}`, 'error');
        }
      }
    });
  };

  const handleSyncAllToGoogleTasks = () => {
    const totalPending = plans.reduce((acc, p) => acc + (p.topics?.filter(t => !t.completed).length || 0), 0) +
      revisions.filter(r => r.status !== 'Completed').length +
      examDates.length;

    setConfirmationModal({
      isOpen: true,
      title: 'Sync Study Schedule to Google Tasks?',
      description: `This will export ${totalPending} study topics, spaced revisions, and exam milestones to a dedicated "StudyFlow Academic Tasks" list in your Google Tasks account.`,
      confirmLabel: 'Sync to Google Tasks',
      onConfirm: async () => {
        setIsSyncingTasks(true);
        setTasksSyncProgress('Preparing Google Tasks sync...');
        try {
          const res = await syncPlansAndRevisionsToGoogleTasks(
            { plans, revisions: revisions.filter(r => r.status !== 'Completed'), examDates },
            (cur, total, item) => setTasksSyncProgress(`Syncing task ${cur}/${total}: ${item}`)
          );

          if (res.success) {
            showFeedback(`Successfully synced ${res.createdCount} tasks to Google Tasks!`);
          } else {
            showFeedback(`Synced ${res.createdCount} tasks with notices: ${res.errors[0] || ''}`, 'info');
          }
          await loadTasks(selectedTaskListId);
        } catch (err: any) {
          showFeedback(`Tasks sync failed: ${err.message}`, 'error');
        } finally {
          setIsSyncingTasks(false);
          setTasksSyncProgress('');
        }
      }
    });
  };

  // ================= KEEP HANDLERS =================
  const handleExportKeepPlan = async (plan: StudyPlan) => {
    const formatted = formatPlanForGoogleKeep(plan);
    const success = await copyAndOpenGoogleKeep(formatted);
    showFeedback(success ? 'Checklist copied! Opening Google Keep...' : 'Opening Google Keep...');
  };

  const handleExportKeepSyllabus = async () => {
    const sub = subjects.find(s => s.id === selectedKeepSubject) || subjects[0];
    if (!sub) return;
    const formatted = formatSyllabusForGoogleKeep(sub);
    const success = await copyAndOpenGoogleKeep(formatted);
    showFeedback(success ? `Syllabus for ${sub.name} copied! Opening Google Keep...` : 'Opening Google Keep...');
  };

  const handleExportKeepDeck = async () => {
    const deck = flashcardDecks.find(d => d.id === selectedKeepDeck) || flashcardDecks[0];
    if (!deck) return;
    const formatted = formatFlashcardDeckForGoogleKeep(deck);
    const success = await copyAndOpenGoogleKeep(formatted);
    showFeedback(success ? `Deck "${deck.title}" copied! Opening Google Keep...` : 'Opening Google Keep...');
  };

  const handleExportKeepRevisions = async () => {
    const formatted = formatRevisionsForGoogleKeep(revisions.filter(r => r.status !== 'Completed'));
    const success = await copyAndOpenGoogleKeep(formatted);
    showFeedback(success ? 'Spaced revision queue copied! Opening Google Keep...' : 'Opening Google Keep...');
  };

  if (!isOpen) return null;

  const filteredTasks = tasks.filter(t => {
    if (tasksFilter === 'pending') return t.status === 'needsAction';
    if (tasksFilter === 'completed') return t.status === 'completed';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-surface border border-theme w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-colors">
        
        {/* Header */}
        <div className="p-6 border-b border-theme bg-card flex items-center justify-between transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-primary">Google Workspace Integration Hub</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Active
                </span>
              </div>
              <p className="text-xs text-muted">
                Synchronize and manage Google Tasks, Calendar, Drive, and Keep in real-time.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted hover:text-primary hover:bg-theme-accent rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedbackMessage && (
          <div className={`px-6 py-2.5 text-xs font-medium flex items-center justify-between border-b ${
            feedbackMessage.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' :
            feedbackMessage.type === 'error' ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800' :
            'bg-sky-50 dark:bg-sky-950/30 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800'
          }`}>
            <span>{feedbackMessage.text}</span>
            <button onClick={() => setFeedbackMessage(null)} className="text-current opacity-70 hover:opacity-100 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-theme bg-theme-accent px-6 overflow-x-auto">
          {/* TAB: GOOGLE CLASSROOM */}
          <button
            onClick={() => setActiveTab('classroom')}
            className={`py-3.5 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === 'classroom'
                ? 'border-primary text-primary bg-card rounded-t-xl'
                : 'border-transparent text-muted hover:text-primary'
            }`}
          >
            <GraduationCap className="w-4 h-4 text-emerald-600" />
            <span>Classroom</span>
            {classroomCourses.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] bg-emerald-100 text-emerald-800 rounded-full font-mono">
                {classroomCourses.length}
              </span>
            )}
          </button>

          {/* TAB: GOOGLE DOCS */}
          <button
            onClick={() => setActiveTab('docs')}
            className={`py-3.5 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === 'docs'
                ? 'border-primary text-primary bg-card rounded-t-xl'
                : 'border-transparent text-muted hover:text-primary'
            }`}
          >
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Google Docs</span>
            {createdDocs.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] bg-blue-100 text-blue-800 rounded-full font-mono">
                {createdDocs.length}
              </span>
            )}
          </button>

          {/* TAB: GOOGLE MEET */}
          <button
            onClick={() => setActiveTab('meet')}
            className={`py-3.5 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === 'meet'
                ? 'border-primary text-primary bg-card rounded-t-xl'
                : 'border-transparent text-muted hover:text-primary'
            }`}
          >
            <Video className="w-4 h-4 text-purple-600" />
            <span>Google Meet</span>
            {activeMeetRoom && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>

          {/* TAB: GOOGLE TASKS */}
          <button
            onClick={() => setActiveTab('tasks')}
            className={`py-3.5 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === 'tasks'
                ? 'border-primary text-primary bg-card rounded-t-xl'
                : 'border-transparent text-muted hover:text-primary'
            }`}
          >
            <ListTodo className="w-4 h-4 text-indigo-600" />
            <span>Google Tasks</span>
            {tasks.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] bg-indigo-100 text-indigo-800 rounded-full font-mono">
                {tasks.filter(t => t.status === 'needsAction').length}
              </span>
            )}
          </button>

          {/* TAB: GOOGLE CALENDAR */}
          <button
            onClick={() => setActiveTab('calendar')}
            className={`py-3.5 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === 'calendar'
                ? 'border-primary text-primary bg-card rounded-t-xl'
                : 'border-transparent text-muted hover:text-primary'
            }`}
          >
            <CalendarIcon className="w-4 h-4 text-sky-600" />
            <span>Google Calendar</span>
            {calendarEvents.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] bg-sky-100 text-sky-800 rounded-full font-mono">
                {calendarEvents.length}
              </span>
            )}
          </button>

          {/* TAB: GOOGLE DRIVE */}
          <button
            onClick={() => setActiveTab('drive')}
            className={`py-3.5 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === 'drive'
                ? 'border-primary text-primary bg-card rounded-t-xl'
                : 'border-transparent text-muted hover:text-primary'
            }`}
          >
            <HardDrive className="w-4 h-4 text-emerald-600" />
            <span>Google Drive</span>
            {driveFiles.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] bg-emerald-100 text-emerald-800 rounded-full font-mono">
                {driveFiles.length}
              </span>
            )}
          </button>

          {/* TAB: GOOGLE KEEP */}
          <button
            onClick={() => setActiveTab('keep')}
            className={`py-3.5 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === 'keep'
                ? 'border-primary text-primary bg-card rounded-t-xl'
                : 'border-transparent text-muted hover:text-primary'
            }`}
          >
            <BookOpen className="w-4 h-4 text-amber-600" />
            <span>Google Keep</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ================= TAB: GOOGLE CLASSROOM ================= */}
          {activeTab === 'classroom' && (
            <div className="space-y-6">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E0DBD0]">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#6B705C] flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-emerald-600" />
                    <span>Google Classroom Course Sync</span>
                  </h3>
                  <p className="text-xs text-[#A5A58D]">
                    Import official courses, assignments, due dates, and learning materials into your StudyOS syllabus.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={loadClassroom}
                    disabled={isLoading}
                    className="p-2 text-[#6B705C] hover:bg-[#F0EAE1] rounded-xl border border-[#E0DBD0] transition cursor-pointer flex items-center gap-1.5 text-xs font-medium"
                    title="Refresh Courses"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                </div>
              </div>

              {/* Classroom Content Grid */}
              {isLoading ? (
                <div className="p-12 text-center text-xs text-[#A5A58D] flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#6B705C]" />
                  <span>Loading enrolled Google Classroom courses...</span>
                </div>
              ) : classroomCourses.length === 0 ? (
                <div className="p-8 rounded-2xl bg-white border border-[#E0DBD0] text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 mx-auto flex items-center justify-center">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-[#4A4E4D]">No Enrolled Courses Found</h4>
                  <p className="text-xs text-[#A5A58D] max-w-md mx-auto">
                    Ensure your Google account is enrolled in active Google Classroom courses, or verify that your educational institution allows third-party API read access.
                  </p>
                  <button
                    onClick={loadClassroom}
                    className="px-4 py-2 bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Retry Loading Courses
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: Course Selector */}
                  <div className="lg:col-span-5 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#A5A58D]">
                      Enrolled Courses ({classroomCourses.length})
                    </h4>
                    <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                      {classroomCourses.map((course) => {
                        const isSelected = selectedCourse?.id === course.id;
                        return (
                          <div
                            key={course.id}
                            onClick={() => handleSelectCourse(course)}
                            className={`p-3.5 rounded-2xl border transition cursor-pointer text-left ${
                              isSelected
                                ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-300 shadow-xs'
                                : 'bg-white border-[#E0DBD0] hover:border-[#6B705C]/50 hover:bg-[#FAF9F5]'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h5 className="text-xs font-bold text-[#4A4E4D] line-clamp-1">{course.name}</h5>
                                {course.section && (
                                  <p className="text-[11px] text-[#A5A58D] font-mono">{course.section}</p>
                                )}
                              </div>
                              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-white text-emerald-700 border border-emerald-200 shrink-0">
                                {course.courseState || 'ACTIVE'}
                              </span>
                            </div>
                            {course.descriptionHeading && (
                              <p className="text-[11px] text-[#4A4E4D]/70 mt-1 line-clamp-2">
                                {course.descriptionHeading}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Column: Selected Course Overview & Import Action */}
                  <div className="lg:col-span-7 space-y-4">
                    {selectedCourse ? (
                      <div className="p-5 rounded-2xl bg-white border border-[#E0DBD0] space-y-5 shadow-xs">
                        {/* Course Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E0DBD0]">
                          <div>
                            <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-700">Course Selected</span>
                            <h4 className="text-sm font-bold text-[#4A4E4D]">{selectedCourse.name}</h4>
                            {selectedCourse.section && (
                              <p className="text-xs text-[#A5A58D]">Section: {selectedCourse.section}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedCourse.alternateLink && (
                              <a
                                href={selectedCourse.alternateLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-[#A5A58D] hover:text-[#4A4E4D] hover:bg-[#F0EAE1] rounded-xl border border-[#E0DBD0] transition cursor-pointer"
                                title="Open in Google Classroom"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button
                              onClick={handleImportSelectedCourseToSyllabus}
                              disabled={isImportingCourse}
                              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                              <span>{isImportingCourse ? 'Importing...' : 'Import to StudyOS'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Course Work & Materials Detail */}
                        {isLoadingClassroomDetails ? (
                          <div className="py-8 text-center text-xs text-[#A5A58D] flex items-center justify-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                            <span>Loading course assignments and lecture materials...</span>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Stats Chips */}
                            <div className="grid grid-cols-3 gap-2">
                              <div className="p-3 bg-[#F9F7F2] rounded-xl border border-[#E0DBD0]/80 text-center">
                                <span className="text-base font-bold text-emerald-800 font-mono">
                                  {courseWorkItems.length}
                                </span>
                                <p className="text-[10px] uppercase font-medium text-[#A5A58D]">Assignments</p>
                              </div>
                              <div className="p-3 bg-[#F9F7F2] rounded-xl border border-[#E0DBD0]/80 text-center">
                                <span className="text-base font-bold text-sky-800 font-mono">
                                  {courseMaterials.length}
                                </span>
                                <p className="text-[10px] uppercase font-medium text-[#A5A58D]">Materials</p>
                              </div>
                              <div className="p-3 bg-[#F9F7F2] rounded-xl border border-[#E0DBD0]/80 text-center">
                                <span className="text-base font-bold text-purple-800 font-mono">
                                  {courseAnnouncements.length}
                                </span>
                                <p className="text-[10px] uppercase font-medium text-[#A5A58D]">Updates</p>
                              </div>
                            </div>

                            {/* Assignments List */}
                            <div className="space-y-2">
                              <h5 className="text-xs font-bold text-[#4A4E4D] flex items-center gap-1.5">
                                <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Published Assignments ({courseWorkItems.length})</span>
                              </h5>
                              {courseWorkItems.length === 0 ? (
                                <p className="text-xs text-[#A5A58D] italic py-2">No active assignments posted.</p>
                              ) : (
                                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                  {courseWorkItems.map((cw) => {
                                    let dueStr = 'No due date';
                                    if (cw.dueDate) {
                                      dueStr = `Due: ${cw.dueDate.year}-${String(cw.dueDate.month).padStart(2, '0')}-${String(cw.dueDate.day).padStart(2, '0')}`;
                                    }
                                    return (
                                      <div key={cw.id} className="p-2.5 rounded-xl bg-[#FAF9F5] border border-[#E0DBD0] flex items-start justify-between gap-2">
                                        <div className="space-y-0.5">
                                          <h6 className="text-xs font-semibold text-[#4A4E4D]">{cw.title}</h6>
                                          <p className="text-[11px] text-[#A5A58D]">{dueStr} {cw.maxPoints ? `• ${cw.maxPoints} pts` : ''}</p>
                                        </div>
                                        {cw.alternateLink && (
                                          <a
                                            href={cw.alternateLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[#6B705C] hover:text-[#4A4E4D] p-1"
                                            title="View in Classroom"
                                          >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                          </a>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Announcements List */}
                            {courseAnnouncements.length > 0 && (
                              <div className="space-y-2 pt-2 border-t border-[#E0DBD0]/60">
                                <h5 className="text-xs font-bold text-[#4A4E4D]">Recent Teacher Announcements</h5>
                                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                  {courseAnnouncements.slice(0, 3).map((ann) => (
                                    <div key={ann.id} className="p-2 rounded-xl bg-amber-50/50 border border-amber-200 text-xs text-[#4A4E4D] line-clamp-2">
                                      {ann.text}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-8 rounded-2xl bg-white border border-[#E0DBD0] text-center text-xs text-[#A5A58D]">
                        Select a course from the left panel to inspect assignments and import into your StudyOS syllabus.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB: GOOGLE DOCS ================= */}
          {activeTab === 'docs' && (
            <div className="space-y-6">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E0DBD0]">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#6B705C] flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Google Docs Academic Exporter</span>
                  </h3>
                  <p className="text-xs text-[#A5A58D]">
                    Convert your syllabus, active-recall flashcard decks, and daily schedules directly into formatted Google Docs.
                  </p>
                </div>
              </div>

              {/* Document Generation Options Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Export Syllabus */}
                <div className="p-4 rounded-2xl bg-white border border-[#E0DBD0] space-y-3 shadow-xs flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                        1
                      </div>
                      <h4 className="text-xs font-bold text-[#4A4E4D]">Subject Syllabus Doc</h4>
                    </div>
                    <p className="text-[11px] text-[#A5A58D]">
                      Generates a complete chapter-by-chapter curriculum tracking sheet with checklists.
                    </p>
                    <div className="space-y-1 pt-1">
                      <label className="text-[10px] uppercase font-bold text-[#A5A58D]">Select Subject</label>
                      <select
                        value={selectedDocSubject}
                        onChange={e => setSelectedDocSubject(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl focus:outline-none"
                      >
                        {subjects.map(s => (
                          <option key={s.id} value={s.id}>{s.emoji || '📖'} {s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={handleExportSyllabusToDoc}
                    disabled={isExportingDoc || subjects.length === 0}
                    className="w-full mt-3 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>{isExportingDoc ? 'Exporting...' : 'Export to Google Doc'}</span>
                  </button>
                </div>

                {/* 2. Export Flashcards */}
                <div className="p-4 rounded-2xl bg-white border border-[#E0DBD0] space-y-3 shadow-xs flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs">
                        2
                      </div>
                      <h4 className="text-xs font-bold text-[#4A4E4D]">Flashcard Deck Doc</h4>
                    </div>
                    <p className="text-[11px] text-[#A5A58D]">
                      Creates a clean self-testing flashcard review sheet with prompts, answers, and mnemonics.
                    </p>
                    <div className="space-y-1 pt-1">
                      <label className="text-[10px] uppercase font-bold text-[#A5A58D]">Select Deck</label>
                      <select
                        value={selectedDocDeck}
                        onChange={e => setSelectedDocDeck(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl focus:outline-none"
                      >
                        {flashcardDecks.map(d => (
                          <option key={d.id} value={d.id}>{d.title} ({d.cards.length} cards)</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={handleExportFlashcardsToDoc}
                    disabled={isExportingDoc || flashcardDecks.length === 0}
                    className="w-full mt-3 py-2 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>{isExportingDoc ? 'Exporting...' : 'Export Cards to Doc'}</span>
                  </button>
                </div>

                {/* 3. Export Study Plan */}
                <div className="p-4 rounded-2xl bg-white border border-[#E0DBD0] space-y-3 shadow-xs flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
                        3
                      </div>
                      <h4 className="text-xs font-bold text-[#4A4E4D]">Study Plan Schedule Doc</h4>
                    </div>
                    <p className="text-[11px] text-[#A5A58D]">
                      Exports your scheduled daily study timeline, targets, and milestones into a printable document.
                    </p>
                    <div className="space-y-1 pt-1">
                      <label className="text-[10px] uppercase font-bold text-[#A5A58D]">Select Plan</label>
                      <select
                        value={selectedDocPlan}
                        onChange={e => setSelectedDocPlan(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl focus:outline-none"
                      >
                        {plans.map(p => (
                          <option key={p.id} value={p.id}>{p.title} ({p.date})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={handleExportPlanToDoc}
                    disabled={isExportingDoc || plans.length === 0}
                    className="w-full mt-3 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>{isExportingDoc ? 'Exporting...' : 'Export Plan to Doc'}</span>
                  </button>
                </div>
              </div>

              {/* Custom Document Generator */}
              <div className="p-5 rounded-2xl bg-white border border-[#E0DBD0] space-y-3 shadow-xs">
                <h4 className="text-xs font-bold text-[#4A4E4D] flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-blue-600" />
                  <span>Create Custom Study Guide in Google Docs</span>
                </h4>
                <form onSubmit={handleCreateCustomDoc} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Document Title (e.g. Physics Quantum Mechanics Review Guide)"
                      value={customDocTitle}
                      onChange={e => setCustomDocTitle(e.target.value)}
                      className="px-3 py-2 text-xs bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl focus:outline-none"
                      required
                    />
                    <button
                      type="submit"
                      disabled={isExportingDoc || !customDocTitle.trim()}
                      className="py-2 px-4 bg-[#6B705C] hover:bg-[#5a5f4e] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{isExportingDoc ? 'Creating Doc...' : 'Create Google Doc'}</span>
                    </button>
                  </div>
                  <textarea
                    placeholder="Initial content or notes to insert into the Google Doc (optional)..."
                    value={customDocContent}
                    onChange={e => setCustomDocContent(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl focus:outline-none min-h-[80px]"
                  />
                </form>
              </div>

              {/* Recently Created Google Docs */}
              {createdDocs.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B705C]">
                    Created Documents in This Session ({createdDocs.length})
                  </h4>
                  <div className="space-y-2">
                    {createdDocs.map((doc, idx) => (
                      <div key={idx} className="p-3.5 rounded-2xl bg-white border border-blue-200 flex items-center justify-between gap-3 shadow-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <h5 className="text-xs font-bold text-[#4A4E4D]">{doc.title}</h5>
                            <p className="text-[10px] text-[#A5A58D] font-mono">ID: {doc.documentId}</p>
                          </div>
                        </div>
                        <a
                          href={doc.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                        >
                          <span>Open in Docs</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB: GOOGLE MEET ================= */}
          {activeTab === 'meet' && (
            <div className="space-y-6">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E0DBD0]">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#6B705C] flex items-center gap-1.5">
                    <Video className="w-4 h-4 text-purple-600" />
                    <span>Google Meet Study Spaces & Focus Rooms</span>
                  </h3>
                  <p className="text-xs text-[#A5A58D]">
                    Launch instant video study spaces or schedule group exam focus sessions with official Google Meet links.
                  </p>
                </div>
              </div>

              {/* Active Meet Room Banner */}
              {activeMeetRoom && (
                <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-900 to-indigo-900 text-white space-y-3 shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                      <h4 className="text-xs font-bold uppercase tracking-widest text-purple-200">Active Study Room</h4>
                    </div>
                    <span className="text-[11px] font-mono text-purple-300">
                      {activeMeetRoom.meetingCode ? `Code: ${activeMeetRoom.meetingCode}` : 'Live Link'}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold">{activeMeetRoom.title}</h3>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <a
                      href={activeMeetRoom.meetingUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-white text-purple-900 hover:bg-purple-50 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs"
                    >
                      <Video className="w-3.5 h-3.5 text-purple-700" />
                      <span>Join Google Meet</span>
                    </a>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(activeMeetRoom.meetingUri);
                        showFeedback('Google Meet link copied to clipboard!');
                      }}
                      className="px-3.5 py-2 bg-purple-800/80 hover:bg-purple-800 text-purple-100 text-xs font-medium rounded-xl border border-purple-700 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Link</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 2-Column Action Panels */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Instant Meet Launcher */}
                <div className="p-5 rounded-2xl bg-white border border-[#E0DBD0] space-y-4 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-xs">
                      <Video className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#4A4E4D]">Instant Focus Room</h4>
                      <p className="text-[11px] text-[#A5A58D]">Create an ad-hoc video room for solo focus or inviting peers.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-[#A5A58D]">Room Title</label>
                    <input
                      type="text"
                      value={meetRoomTitle}
                      onChange={e => setMeetRoomTitle(e.target.value)}
                      placeholder="e.g. Calculus Midterm Study Sprint"
                      className="w-full px-3 py-2 text-xs bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={handleLaunchInstantMeet}
                    disabled={isCreatingMeet}
                    className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Video className="w-4 h-4" />
                    <span>{isCreatingMeet ? 'Provisioning Room...' : 'Launch Google Meet Room'}</span>
                  </button>
                </div>

                {/* Scheduled Meet on Calendar */}
                <div className="p-5 rounded-2xl bg-white border border-[#E0DBD0] space-y-4 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold text-xs">
                      <CalendarIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#4A4E4D]">Schedule Meet Session</h4>
                      <p className="text-[11px] text-[#A5A58D]">Add a study block with Google Meet conference to your Calendar.</p>
                    </div>
                  </div>

                  <form onSubmit={handleScheduleMeet} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-[#A5A58D]">Topic / Subject</label>
                      <input
                        type="text"
                        value={scheduledMeetTopic}
                        onChange={e => setScheduledMeetTopic(e.target.value)}
                        placeholder="e.g. Organic Chemistry Mechanism Review"
                        className="w-full px-3 py-1.5 text-xs bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl focus:outline-none"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-[#A5A58D]">Date</label>
                        <input
                          type="date"
                          value={scheduledMeetDate}
                          onChange={e => setScheduledMeetDate(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl focus:outline-none"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-[#A5A58D]">Time</label>
                        <input
                          type="time"
                          value={scheduledMeetTime}
                          onChange={e => setScheduledMeetTime(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl focus:outline-none"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-[#A5A58D]">Duration</label>
                        <select
                          value={scheduledMeetDuration}
                          onChange={e => setScheduledMeetDuration(Number(e.target.value))}
                          className="w-full px-2 py-1.5 text-xs bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl focus:outline-none"
                        >
                          <option value={25}>25 min (Pomodoro)</option>
                          <option value={45}>45 min (Standard)</option>
                          <option value={60}>60 min (Deep Work)</option>
                          <option value={90}>90 min (Mastery)</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isCreatingMeet}
                      className="w-full py-2.5 bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <CalendarIcon className="w-4 h-4" />
                      <span>{isCreatingMeet ? 'Scheduling...' : 'Schedule on Google Calendar'}</span>
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB: GOOGLE TASKS ================= */}
          {activeTab === 'tasks' && (
            <div className="space-y-6">
              {/* Tasks Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E0DBD0]">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#6B705C] flex items-center gap-1.5">
                    <ListTodo className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Google Tasks Sync & Manager</span>
                  </h3>
                  <p className="text-xs text-[#A5A58D]">
                    Organize your daily study topics, homework, and revisions directly inside Google Tasks.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadTasks(selectedTaskListId)}
                    disabled={isLoading}
                    className="p-2 text-[#6B705C] hover:bg-[#F0EAE1] rounded-xl border border-[#E0DBD0] transition cursor-pointer"
                    title="Refresh Tasks"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => setShowAddTaskForm(!showAddTaskForm)}
                    className="px-3 py-2 bg-[#F0EAE1] hover:bg-[#E0DBD0] text-[#4A4E4D] text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Task</span>
                  </button>
                  <button
                    onClick={handleSyncAllToGoogleTasks}
                    disabled={isSyncingTasks}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingTasks ? 'animate-spin' : ''}`} />
                    <span>{isSyncingTasks ? 'Syncing...' : 'Sync Study Schedule'}</span>
                  </button>
                </div>
              </div>

              {/* Live Sync Progress */}
              {isSyncingTasks && tasksSyncProgress && (
                <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-mono flex items-center gap-2 animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
                  <span className="truncate">{tasksSyncProgress}</span>
                </div>
              )}

              {/* Add Custom Task Form */}
              {showAddTaskForm && (
                <form onSubmit={handleCreateCustomTask} className="p-5 bg-white border border-[#E0DBD0] rounded-2xl space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-[#E0DBD0] pb-2">
                    <h4 className="text-xs font-bold text-[#4A4E4D] uppercase tracking-wider">Create Google Task</h4>
                    <button type="button" onClick={() => setShowAddTaskForm(false)} className="text-[#A5A58D] hover:text-[#4A4E4D]">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-[#A5A58D] uppercase">Task Title / Topic</label>
                      <input
                        type="text"
                        required
                        value={newTaskTitle}
                        onChange={e => setNewTaskTitle(e.target.value)}
                        placeholder="e.g. Complete Organic Chemistry Practice Problems"
                        className="w-full mt-1 px-3 py-2 text-xs bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl focus:outline-none focus:border-[#6B705C]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#A5A58D] uppercase">Due Date</label>
                      <input
                        type="date"
                        value={newTaskDueDate}
                        onChange={e => setNewTaskDueDate(e.target.value)}
                        className="w-full mt-1 px-3 py-2 text-xs bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl focus:outline-none focus:border-[#6B705C]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#A5A58D] uppercase">Target List</label>
                      <select
                        value={selectedTaskListId}
                        onChange={e => {
                          setSelectedTaskListId(e.target.value);
                          loadTasks(e.target.value);
                        }}
                        className="w-full mt-1 px-3 py-2 text-xs bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl focus:outline-none focus:border-[#6B705C]"
                      >
                        <option value="@default">Default Task List</option>
                        {taskLists.filter(l => l.id !== '@default').map(l => (
                          <option key={l.id} value={l.id}>{l.title}</option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-[#A5A58D] uppercase">Notes / Details</label>
                      <textarea
                        rows={2}
                        value={newTaskNotes}
                        onChange={e => setNewTaskNotes(e.target.value)}
                        placeholder="Questions to solve, reference pages, priority..."
                        className="w-full mt-1 px-3 py-2 text-xs bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl focus:outline-none focus:border-[#6B705C]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddTaskForm(false)}
                      className="px-3 py-1.5 text-xs text-[#A5A58D] hover:text-[#4A4E4D]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Save Task
                    </button>
                  </div>
                </form>
              )}

              {/* Task List Filters & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#A5A58D] font-bold uppercase">List:</span>
                  <select
                    value={selectedTaskListId}
                    onChange={e => {
                      setSelectedTaskListId(e.target.value);
                      loadTasks(e.target.value);
                    }}
                    className="px-3 py-1.5 text-xs bg-white border border-[#E0DBD0] rounded-xl focus:outline-none font-medium"
                  >
                    <option value="@default">My Tasks (Default)</option>
                    {taskLists.filter(l => l.id !== '@default').map(l => (
                      <option key={l.id} value={l.id}>{l.title}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#E0DBD0]">
                  {(['all', 'pending', 'completed'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setTasksFilter(f)}
                      className={`px-3 py-1 text-[11px] font-bold rounded-lg capitalize transition cursor-pointer ${
                        tasksFilter === f
                          ? 'bg-indigo-600 text-white'
                          : 'text-[#A5A58D] hover:text-[#4A4E4D]'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Task Items List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-[#A5A58D]">
                    Google Tasks ({filteredTasks.length})
                  </h4>
                  <a
                    href="https://calendar.google.com/calendar/u/0/r/tasks"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-indigo-700 hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>Open in Google Tasks</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {isLoading && tasks.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-[#E0DBD0] text-[#A5A58D] text-xs space-y-2">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
                    <p>Loading tasks from Google Tasks...</p>
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-[#E0DBD0] text-[#A5A58D] text-xs space-y-3">
                    <ListTodo className="w-8 h-8 mx-auto text-[#A5A58D]/60" />
                    <p>No tasks found in this Google Tasks list.</p>
                    <button
                      onClick={handleSyncAllToGoogleTasks}
                      className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                    >
                      Sync Study Schedule to Tasks
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredTasks.map(task => {
                      const isCompleted = task.status === 'completed';
                      const dueDateStr = task.due
                        ? new Date(task.due).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                        : null;

                      return (
                        <div
                          key={task.id}
                          className={`p-3.5 rounded-2xl bg-white border transition flex items-start justify-between gap-3 shadow-2xs group ${
                            isCompleted ? 'border-[#E0DBD0]/60 opacity-65 bg-[#FBF9F5]' : 'border-[#E0DBD0] hover:border-indigo-500'
                          }`}
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <button
                              onClick={() => handleToggleTask(task.id, task.status)}
                              className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition cursor-pointer shrink-0 ${
                                isCompleted
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'border-[#A5A58D] hover:border-indigo-600 text-transparent'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </button>

                            <div className="flex-1 min-w-0">
                              <h5 className={`text-xs font-bold text-[#4A4E4D] ${isCompleted ? 'line-through text-[#A5A58D]' : ''}`}>
                                {task.title}
                              </h5>
                              {task.notes && (
                                <p className="text-[11px] text-[#A5A58D] mt-1 whitespace-pre-line leading-relaxed">
                                  {task.notes}
                                </p>
                              )}
                              {dueDateStr && (
                                <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-indigo-700 font-medium">
                                  <Clock className="w-3 h-3" />
                                  <span>Due: {dueDateStr}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => handleDeleteTask(task.id, task.title)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-[#A5A58D] hover:text-rose-600 rounded-lg transition cursor-pointer"
                            title="Delete task from Google Tasks"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB: GOOGLE CALENDAR ================= */}
          {activeTab === 'calendar' && (
            <div className="space-y-6">
              {/* Action Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E0DBD0]">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#6B705C] flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5" />
                    <span>Google Calendar Sync Engine</span>
                  </h3>
                  <p className="text-xs text-[#A5A58D]">
                    Sync scheduled study blocks, revision cycles, and exam dates to your primary Google Calendar.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={loadCalendar}
                    disabled={isLoading}
                    className="p-2 text-[#6B705C] hover:bg-[#F0EAE1] rounded-xl border border-[#E0DBD0] transition cursor-pointer"
                    title="Refresh Calendar Events"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => setShowAddEventForm(!showAddEventForm)}
                    className="px-3 py-2 bg-[#F0EAE1] hover:bg-[#E0DBD0] text-[#4A4E4D] text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Event</span>
                  </button>
                  <button
                    onClick={handleSyncAllToGoogleCalendar}
                    disabled={isSyncingCalendar}
                    className="px-4 py-2 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCalendar ? 'animate-spin' : ''}`} />
                    <span>{isSyncingCalendar ? 'Syncing...' : 'Sync Study Plans'}</span>
                  </button>
                </div>
              </div>

              {/* Live Sync Progress Bar */}
              {isSyncingCalendar && calendarSyncProgress && (
                <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 text-sky-900 text-xs font-mono flex items-center gap-2 animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin text-sky-600 shrink-0" />
                  <span className="truncate">{calendarSyncProgress}</span>
                </div>
              )}

              {/* Add Custom Calendar Event Form */}
              {showAddEventForm && (
                <form onSubmit={handleCreateCustomEvent} className="p-5 bg-white border border-[#E0DBD0] rounded-2xl space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-[#E0DBD0] pb-2">
                    <h4 className="text-xs font-bold text-[#4A4E4D] uppercase tracking-wider">Create Google Calendar Event</h4>
                    <button type="button" onClick={() => setShowAddEventForm(false)} className="text-[#A5A58D] hover:text-[#4A4E4D]">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-[#A5A58D] uppercase">Event Title / Subject</label>
                      <input
                        type="text"
                        required
                        value={newEventTitle}
                        onChange={e => setNewEventTitle(e.target.value)}
                        placeholder="e.g. Physics Quantum Mechanics Review"
                        className="w-full mt-1 px-3 py-2 text-xs bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl focus:outline-none focus:border-[#6B705C]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#A5A58D] uppercase">Date</label>
                      <input
                        type="date"
                        required
                        value={newEventDate}
                        onChange={e => setNewEventDate(e.target.value)}
                        className="w-full mt-1 px-3 py-2 text-xs bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl focus:outline-none focus:border-[#6B705C]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#A5A58D] uppercase">Time & Duration</label>
                      <div className="flex gap-2 mt-1">
                        <input
                          type="time"
                          value={newEventTime}
                          onChange={e => setNewEventTime(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl focus:outline-none focus:border-[#6B705C]"
                        />
                        <select
                          value={newEventDuration}
                          onChange={e => setNewEventDuration(Number(e.target.value))}
                          className="px-2 py-2 text-xs bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl focus:outline-none focus:border-[#6B705C]"
                        >
                          <option value={30}>30m</option>
                          <option value={60}>1 hr</option>
                          <option value={90}>1.5 hrs</option>
                          <option value={120}>2 hrs</option>
                        </select>
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-[#A5A58D] uppercase">Description / Notes</label>
                      <textarea
                        rows={2}
                        value={newEventDesc}
                        onChange={e => setNewEventDesc(e.target.value)}
                        placeholder="Topics to cover, textbook pages, goal..."
                        className="w-full mt-1 px-3 py-2 text-xs bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl focus:outline-none focus:border-[#6B705C]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddEventForm(false)}
                      className="px-3 py-1.5 text-xs text-[#A5A58D] hover:text-[#4A4E4D]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-4 py-1.5 bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Add Event
                    </button>
                  </div>
                </form>
              )}

              {/* Event List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-[#A5A58D]">
                    Primary Calendar Events ({calendarEvents.length})
                  </h4>
                  <a
                    href="https://calendar.google.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-sky-700 hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>Open Google Calendar</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {isLoading && calendarEvents.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-[#E0DBD0] text-[#A5A58D] text-xs space-y-2">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#6B705C]" />
                    <p>Loading events from Google Calendar...</p>
                  </div>
                ) : calendarEvents.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-[#E0DBD0] text-[#A5A58D] text-xs space-y-3">
                    <CalendarIcon className="w-8 h-8 mx-auto text-[#A5A58D]/60" />
                    <p>No upcoming events found on your Google Calendar.</p>
                    <button
                      onClick={handleSyncAllToGoogleCalendar}
                      className="px-4 py-2 bg-[#6B705C] text-white text-xs font-bold rounded-xl shadow-xs"
                    >
                      Sync Study Schedule Now
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {calendarEvents.map(event => {
                      const startDateStr = event.start.dateTime
                        ? new Date(event.start.dateTime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : event.start.date || 'All Day';

                      return (
                        <div
                          key={event.id}
                          className="p-3.5 rounded-2xl bg-white border border-[#E0DBD0] hover:border-[#6B705C] transition flex flex-col justify-between gap-2 shadow-xs group"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <h5 className="text-xs font-bold text-[#4A4E4D] line-clamp-1">
                                {event.summary}
                              </h5>
                              <button
                                onClick={() => handleDeleteCalendarEvent(event.id, event.summary)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-[#A5A58D] hover:text-rose-600 rounded-md transition cursor-pointer"
                                title="Delete from Google Calendar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="text-[11px] text-[#6B705C] font-mono mt-1 flex items-center gap-1.5">
                              <CalendarIcon className="w-3 h-3" />
                              <span>{startDateStr}</span>
                            </div>
                            {event.description && (
                              <p className="text-[11px] text-[#A5A58D] mt-1.5 line-clamp-2">
                                {event.description}
                              </p>
                            )}
                          </div>

                          {event.htmlLink && (
                            <div className="pt-2 border-t border-[#E0DBD0]/60 flex justify-end">
                              <a
                                href={event.htmlLink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-sky-700 hover:underline flex items-center gap-1 font-bold"
                              >
                                <span>View in Calendar</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB: GOOGLE DRIVE ================= */}
          {activeTab === 'drive' && (
            <div className="space-y-6">
              {/* Dedicated Academic Workspace Header */}
              <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-5 rounded-3xl shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                        Tier 3 Academic Vault
                      </span>
                      <span className="text-[10px] text-emerald-200/80 font-mono">Zero Lock-in</span>
                    </div>
                    <h3 className="text-base font-bold flex items-center gap-2">
                      <HardDrive className="w-5 h-5 text-emerald-400" />
                      <span>Google Drive: StudyOS Academic Workspace</span>
                    </h3>
                    <p className="text-xs text-emerald-100/80 max-w-2xl leading-relaxed">
                      Dedicated academic folder (<code className="text-[11px] font-mono text-emerald-300 bg-black/30 px-1.5 py-0.5 rounded">📁 StudyOS Academic Workspace</code>) inside your personal Google Drive. Autonomous snapshots mirror your syllabus, notes, flashcards, and test analytics so you own 100% of your data.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={loadDrive}
                      disabled={isLoading}
                      className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 transition cursor-pointer"
                      title="Refresh Drive Files"
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => setShowNewDocModal(!showNewDocModal)}
                      className="px-3.5 py-2.5 bg-white/15 hover:bg-white/25 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 border border-white/20"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Create Note Doc</span>
                    </button>
                    <button
                      onClick={handleBackupToDrive}
                      disabled={isUploadingToDrive}
                      className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingToDrive ? 'Creating Snapshot...' : 'Autonomous Vault Snapshot'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Create New Note Modal */}
              {showNewDocModal && (
                <form onSubmit={handleCreateDocInDrive} className="p-5 bg-white border border-[#E0DBD0] rounded-2xl space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-[#E0DBD0] pb-2">
                    <h4 className="text-xs font-bold text-[#4A4E4D] uppercase tracking-wider">Create Google Drive Study Note</h4>
                    <button type="button" onClick={() => setShowNewDocModal(false)} className="text-[#A5A58D] hover:text-[#4A4E4D]">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#A5A58D] uppercase">Document Title</label>
                      <input
                        type="text"
                        required
                        value={newDocTitle}
                        onChange={e => setNewDocTitle(e.target.value)}
                        placeholder="e.g. Chapter 4 Key Formulas & Derivations"
                        className="w-full mt-1 px-3 py-2 text-xs bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl focus:outline-none focus:border-[#6B705C]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#A5A58D] uppercase">Subject Tag</label>
                      <input
                        type="text"
                        value={newDocSubject}
                        onChange={e => setNewDocSubject(e.target.value)}
                        placeholder="e.g. Mathematics"
                        className="w-full mt-1 px-3 py-2 text-xs bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl focus:outline-none focus:border-[#6B705C]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-[#A5A58D] uppercase">Content / Markdown</label>
                      <textarea
                        rows={4}
                        value={newDocContent}
                        onChange={e => setNewDocContent(e.target.value)}
                        placeholder="Write study notes, summary, formulas, or questions here..."
                        className="w-full mt-1 px-3 py-2 text-xs bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl focus:outline-none focus:border-[#6B705C] font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowNewDocModal(false)}
                      className="px-3 py-1.5 text-xs text-[#A5A58D] hover:text-[#4A4E4D]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Save to Drive
                    </button>
                  </div>
                </form>
              )}

              {/* In-App File Reader / Preview Modal */}
              {previewDriveFile && (
                <div className="p-5 bg-white border-2 border-emerald-600/30 rounded-3xl space-y-3 shadow-md animate-fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E0DBD0]">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
                      <h4 className="text-xs font-bold text-[#4A4E4D] truncate">{previewDriveFile.name}</h4>
                      <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-mono">In-App Reader</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPreviewDriveFile(null)}
                        className="p-1 text-[#A5A58D] hover:text-[#4A4E4D] rounded-md"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {previewDriveFile.loading ? (
                    <div className="p-8 text-center text-xs text-[#A5A58D] space-y-2">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-700" />
                      <p>Loading document contents from Google Drive...</p>
                    </div>
                  ) : previewDriveFile.error ? (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                      {previewDriveFile.error}
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-xs font-mono whitespace-pre-wrap text-[#4A4E4D] leading-relaxed select-text">
                      {previewDriveFile.content || 'Document is empty.'}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setPreviewDriveFile(null)}
                      className="px-3 py-1.5 text-xs text-[#A5A58D] hover:text-[#4A4E4D] font-medium"
                    >
                      Close Reader
                    </button>
                  </div>
                </div>
              )}

              {/* Drive Filter & Search */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 text-[#A5A58D] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={driveSearchQuery}
                    onChange={e => setDriveSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && loadDrive()}
                    placeholder="Search Google Drive lecture PDFs, slides, documents, or snapshots..."
                    className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-[#E0DBD0] rounded-xl focus:outline-none focus:border-[#6B705C]"
                  />
                </div>
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#E0DBD0]">
                  {(['all', 'documents', 'pdfs', 'spreadsheets'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => { setDriveFilter(f); }}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg capitalize transition cursor-pointer ${
                        driveFilter === f
                          ? 'bg-[#6B705C] text-white'
                          : 'text-[#A5A58D] hover:text-[#4A4E4D]'
                      }`}
                    >
                      {f === 'pdfs' ? 'Lecture PDFs & Slides' : f === 'documents' ? 'Docs & Notes' : f}
                    </button>
                  ))}
                </div>
              </div>

              {/* File List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-[#A5A58D]">
                    Drive Academic Explorer ({driveFiles.length} files)
                  </h4>
                  <a
                    href="https://drive.google.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-emerald-700 hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>Open Drive Web</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {isLoading && driveFiles.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-[#E0DBD0] text-[#A5A58D] text-xs space-y-2">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-700" />
                    <p>Loading files from Google Drive...</p>
                  </div>
                ) : driveFiles.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-[#E0DBD0] text-[#A5A58D] text-xs space-y-3">
                    <HardDrive className="w-8 h-8 mx-auto text-[#A5A58D]/60" />
                    <p>No study documents or backup archives found in your Google Drive.</p>
                    <button
                      onClick={handleBackupToDrive}
                      className="px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                    >
                      Save First Autonomous Snapshot to Drive
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {driveFiles.map(file => {
                      const isSnapshot = file.name.toLowerCase().includes('backup') || file.name.toLowerCase().includes('snapshot');
                      return (
                        <div
                          key={file.id}
                          className="p-3.5 rounded-2xl bg-white border border-[#E0DBD0] hover:border-emerald-600 transition flex flex-col justify-between gap-2 shadow-xs group"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className={`w-4 h-4 shrink-0 ${isSnapshot ? 'text-indigo-600' : 'text-emerald-700'}`} />
                                <h5 className="text-xs font-bold text-[#4A4E4D] truncate" title={file.name}>
                                  {file.name}
                                </h5>
                              </div>
                              <button
                                onClick={() => handleDeleteDriveFile(file.id, file.name)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-[#A5A58D] hover:text-rose-600 rounded-md transition cursor-pointer shrink-0"
                                title="Delete from Drive"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="text-[10px] text-[#A5A58D] font-mono mt-1.5 flex items-center justify-between">
                              <span>{file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : 'Recent'}</span>
                              <span className={`capitalize px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                isSnapshot ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-[#F9F7F2] text-[#6B705C]'
                              }`}>
                                {isSnapshot ? 'Vault Snapshot' : (file.mimeType.split('.').pop() || 'file')}
                              </span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-[#E0DBD0]/60 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handlePreviewDriveFile(file)}
                                className="text-[10px] px-2 py-1 bg-[#F9F7F2] hover:bg-[#E0DBD0] text-[#4A4E4D] font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                                title="Read document without leaving StudyOS"
                              >
                                <Eye className="w-3 h-3 text-emerald-700" />
                                <span>Preview</span>
                              </button>

                              {isSnapshot && (
                                <button
                                  onClick={() => handleRestoreFromDriveSnapshot(file.id, file.name)}
                                  className="text-[10px] px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                                  title="Restore snapshot to active StudyOS session"
                                >
                                  <Download className="w-3 h-3 text-indigo-700" />
                                  <span>Restore</span>
                                </button>
                              )}
                            </div>

                            {file.webViewLink && (
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-emerald-700 hover:underline flex items-center gap-1 font-bold"
                              >
                                <span>Open in Drive</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB: GOOGLE KEEP ================= */}
          {activeTab === 'keep' && (
            <div className="space-y-6">
              {/* Keep Info Header */}
              <div className="bg-white p-5 rounded-2xl border border-[#E0DBD0] space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#6B705C] flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                    <span>Google Keep Companion & Checklist Generator</span>
                  </h3>
                  <a
                    href="https://keep.google.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-amber-700 hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>Open Keep Web</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-xs text-[#A5A58D]">
                  Generate rich interactive checklists, revision decks, and formula cheat sheets formatted specifically for Google Keep.
                </p>
              </div>

              {/* Keep Actions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. Daily Study Plan Checklist */}
                <div className="p-4 rounded-2xl bg-white border border-[#E0DBD0] space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                        1
                      </div>
                      <h4 className="text-xs font-bold text-[#4A4E4D]">Today's Study Plan Checklist</h4>
                    </div>
                    <span className="text-[10px] font-mono text-[#A5A58D]">
                      {plans[0]?.topics?.filter(t => !t.completed).length || 0} tasks
                    </span>
                  </div>
                  <p className="text-[11px] text-[#A5A58D]">
                    Exports today's pending topics with time allocations into a Google Keep interactive checklist.
                  </p>
                  <div className="pt-2 border-t border-[#E0DBD0]/60 flex justify-end">
                    {plans.length > 0 ? (
                      <button
                        onClick={() => handleExportKeepPlan(plans[0])}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy & Open in Keep</span>
                      </button>
                    ) : (
                      <span className="text-xs text-[#A5A58D]">No tasks scheduled for today</span>
                    )}
                  </div>
                </div>

                {/* 2. Syllabus Tracker */}
                <div className="p-4 rounded-2xl bg-white border border-[#E0DBD0] space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                        2
                      </div>
                      <h4 className="text-xs font-bold text-[#4A4E4D]">Subject Syllabus Tracker</h4>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-[#A5A58D]">Select Subject</label>
                    <select
                      value={selectedKeepSubject}
                      onChange={e => setSelectedKeepSubject(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl focus:outline-none"
                    >
                      {subjects.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.chapters.length} chapters)</option>
                      ))}
                    </select>
                  </div>
                  <div className="pt-2 border-t border-[#E0DBD0]/60 flex justify-end">
                    <button
                      onClick={handleExportKeepSyllabus}
                      className="px-3 py-1.5 bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Export Syllabus to Keep</span>
                    </button>
                  </div>
                </div>

                {/* 3. Spaced Revisions Review Queue */}
                <div className="p-4 rounded-2xl bg-white border border-[#E0DBD0] space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-xs">
                        3
                      </div>
                      <h4 className="text-xs font-bold text-[#4A4E4D]">Spaced Repetition Queue</h4>
                    </div>
                    <span className="text-[10px] font-mono text-[#A5A58D]">
                      {revisions.filter(r => r.status !== 'Completed').length} due
                    </span>
                  </div>
                  <p className="text-[11px] text-[#A5A58D]">
                    Transfers all scheduled active recall reviews for the day into a Keep checklist.
                  </p>
                  <div className="pt-2 border-t border-[#E0DBD0]/60 flex justify-end">
                    <button
                      onClick={handleExportKeepRevisions}
                      className="px-3 py-1.5 bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Export Revisions to Keep</span>
                    </button>
                  </div>
                </div>

                {/* 4. Active Recall Flashcards */}
                <div className="p-4 rounded-2xl bg-white border border-[#E0DBD0] space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs">
                        4
                      </div>
                      <h4 className="text-xs font-bold text-[#4A4E4D]">Flashcard Recall Deck</h4>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-[#A5A58D]">Select Deck</label>
                    <select
                      value={selectedKeepDeck}
                      onChange={e => setSelectedKeepDeck(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl focus:outline-none"
                    >
                      {flashcardDecks.map(d => (
                        <option key={d.id} value={d.id}>{d.title} ({d.cards.length} cards)</option>
                      ))}
                    </select>
                  </div>
                  <div className="pt-2 border-t border-[#E0DBD0]/60 flex justify-end">
                    <button
                      onClick={handleExportKeepDeck}
                      disabled={flashcardDecks.length === 0}
                      className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Export Cards to Keep</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E0DBD0] bg-white flex items-center justify-between">
          <div className="text-[11px] text-[#A5A58D] flex items-center gap-1.5">
            <span>Powered by official Google Workspace APIs (Tasks, Calendar, Drive)</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-bold rounded-full transition cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>

      {/* Confirmation Modal for Destructive / Mutating Actions */}
      {confirmationModal && confirmationModal.isOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 animate-fade-in">
          <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#4A4E4D]">{confirmationModal.title}</h3>
            </div>
            <p className="text-xs text-[#4A4E4D]/80 leading-relaxed">
              {confirmationModal.description}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmationModal(null)}
                className="px-4 py-2 text-xs font-medium text-[#A5A58D] hover:text-[#4A4E4D]"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const action = confirmationModal.onConfirm;
                  setConfirmationModal(null);
                  await action();
                }}
                className="px-4 py-2 bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                {confirmationModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
