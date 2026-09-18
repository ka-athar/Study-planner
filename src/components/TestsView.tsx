import React, { useState, useMemo } from 'react';
import { 
  FileCheck, 
  Plus, 
  Sparkles, 
  AlertTriangle, 
  X, 
  CheckCircle2, 
  HelpCircle, 
  Bot,
  ArrowRight,
  Mail,
  Calendar,
  Lightbulb,
  ShieldCheck,
  Brain,
  Layers,
  GraduationCap,
  Hash,
  BookOpen,
  Check,
  Send,
  ExternalLink,
  ChevronRight,
  Filter,
  Archive,
  FolderLock,
  Upload,
  Clock,
  Share2,
  RefreshCw
} from 'lucide-react';
import { TestResult, Subject, ActiveTab, UserProfile, StudyPlan, StudySession, ScheduledStudyTask, ExamDate, StorageVault } from '../types';
import { apiAnalyzeMistakes } from '../lib/aiApi';
import { TestScoreEmailModal } from './TestScoreEmailModal';
import { SmartScheduleAdjusterModal } from './SmartScheduleAdjusterModal';
import { ExamDiagnosticHeatmap } from './ExamDiagnosticHeatmap';
import { WeakTopicsLastWeek } from './WeakTopicsLastWeek';
import { UploadTestDataModal } from './UploadTestDataModal';
import { MockExamSimulator } from './MockExamSimulator';
import { MCQExamAutopsyModal } from './MCQExamAutopsyModal';
import { sendTestImprovementEmail, getOrRequestGmailToken, getCachedGmailToken } from '../lib/gmailService';
import { findMatchingTopic, parseMultiTopicQuery, calculateScorePercentage, applyTestScoreToSyllabus } from '../lib/topicLinker';
import { postTestToGoogleClassroom, getOrRequestClassroomToken, getCachedClassroomToken } from '../lib/googleClassroomService';

interface TestsViewProps {
  subjects: Subject[];
  testResults: TestResult[];
  vaults?: StorageVault[];
  userProfile?: UserProfile | null;
  user?: any;
  plans?: StudyPlan[];
  sessions?: StudySession[];
  examDates?: ExamDate[];
  onAddTestResult: (test: Omit<TestResult, 'id'>) => void;
  onUpdateTestResult?: (testId: string, updates: Partial<TestResult>) => void;
  onUpdateSubjects?: (updatedSubjects: Subject[]) => void;
  onSavePlan?: (plan: StudyPlan | Omit<StudyPlan, 'id'>) => Promise<void> | void;
  onAddScheduledTask?: (task: ScheduledStudyTask) => void;
  setActiveTab: (tab: ActiveTab) => void;
  onSendPromptToTutor: (promptText: string) => void;
  onSelectTopicInSyllabus?: (subjectId: string, topicId: string) => void;
}

export const TestsView: React.FC<TestsViewProps> = ({
  subjects,
  testResults,
  vaults = [],
  userProfile = null,
  user = null,
  plans = [],
  sessions = [],
  examDates = [],
  onAddTestResult,
  onUpdateTestResult,
  onUpdateSubjects,
  onSavePlan,
  onAddScheduledTask,
  setActiveTab,
  onSendPromptToTutor,
  onSelectTopicInSyllabus
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'vault' | 'mock_exam' | 'weak_topics' | 'heatmap' | 'tests'>('vault');
  const [vaultSubjectFilter, setVaultSubjectFilter] = useState<string>('all');
  const [vaultBucketFilter, setVaultBucketFilter] = useState<string>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isMCQAutopsyOpen, setIsMCQAutopsyOpen] = useState(false);

  // Form State
  const [testName, setTestName] = useState('');
  const [testNumber, setTestNumber] = useState('');
  const [topicNumberInput, setTopicNumberInput] = useState('');
  const [paperCode, setPaperCode] = useState('');
  const [selectedSubject, setSelectedSubject] = useState(subjects[0]?.name || '');
  const [selectedVaultId, setSelectedVaultId] = useState<string>('none');
  const [score, setScore] = useState('');
  const [mistakes, setMistakes] = useState('');
  const [struggledTopicsText, setStruggledTopicsText] = useState('');
  const [correctionNotes, setCorrectionNotes] = useState('');

  // Dual Action Recording Options
  const [recordingOption, setRecordingOption] = useState<'dual_save_email' | 'save_only'>('dual_save_email');
  const [syncClassroomOption, setSyncClassroomOption] = useState<boolean>(true);
  const [customEmailRecipient, setCustomEmailRecipient] = useState<string>(userProfile?.email || user?.email || '');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [syncingClassroomId, setSyncingClassroomId] = useState<string | null>(null);
  const [actionNotification, setActionNotification] = useState<{ text: string; success: boolean; url?: string } | null>(null);
  const [emailStatusMsg, setEmailStatusMsg] = useState<{ id: string; text: string; success: boolean } | null>(null);

  // Email Diagnostic Report Modal State
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [focusEmailTestId, setFocusEmailTestId] = useState<string | undefined>(undefined);

  // Smart Schedule Adjuster Modal State
  const [isScheduleAdjusterOpen, setIsScheduleAdjusterOpen] = useState(false);
  const [adjusterTopic, setAdjusterTopic] = useState('');
  const [adjusterSubject, setAdjusterSubject] = useState('');
  const [adjusterDuration, setAdjusterDuration] = useState(30);

  // Live multi-topic and range matching in form (e.g. "3.1 to 3.3" or "3.1, 3.2, and 3.3")
  const multiTopicParsed = useMemo(() => {
    if (!topicNumberInput.trim()) return null;
    return parseMultiTopicQuery(topicNumberInput, subjects, selectedSubject);
  }, [topicNumberInput, subjects, selectedSubject]);

  const handleOpenScheduleAdjuster = (topicName: string, subjectName: string, durationMinutes = 30) => {
    setAdjusterTopic(topicName);
    setAdjusterSubject(subjectName || subjects[0]?.name || 'General');
    setAdjusterDuration(durationMinutes);
    setIsScheduleAdjusterOpen(true);
  };

  const handleAddTopicToPlan = (topicName: string, subjectName: string, chapterName: string, date: string) => {
    if (onSavePlan) {
      const existingPlan = plans.find(p => p.date === date);
      const newTopic = {
        id: `topic-heat-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        subjectName,
        chapterName,
        topicName,
        estimatedMinutes: 45,
        priority: 'High' as const,
        completed: false
      };

      if (existingPlan) {
        onSavePlan({
          ...existingPlan,
          topics: [...existingPlan.topics, newTopic]
        });
      } else {
        onSavePlan({
          date,
          title: `Diagnostic Revision Plan`,
          topics: [newTopic]
        });
      }
    }
  };

  const handleBatchSaveTests = async (tests: Omit<TestResult, 'id'>[]) => {
    for (const t of tests) {
      await onAddTestResult(t);
    }
  };

  const handleJumpToSyllabusForTest = (test: TestResult) => {
    const subj = subjects.find(s => (s.name || '').toLowerCase() === (test.subjectName || '').toLowerCase());
    if (subj) {
      const matched = findMatchingTopic(test.topicNumber || test.topicName || test.testName, subjects, test.subjectName);
      if (matched && onSelectTopicInSyllabus) {
        onSelectTopicInSyllabus(subj.id, matched.topicId);
      }
    }
    setActiveTab('syllabus');
  };

  // Sync an existing test card to Google Classroom
  const handleSyncTestToClassroom = async (test: TestResult) => {
    setSyncingClassroomId(test.id);
    setActionNotification(null);
    try {
      const targetSubj = subjects.find(s => (s.name || '').toLowerCase() === (test.subjectName || '').toLowerCase()) || {
        id: `subj-${Date.now()}`,
        name: test.subjectName,
        icon: '📚',
        color: '#6B705C',
        chapters: []
      };

      let token = getCachedClassroomToken();
      if (!token) {
        token = await getOrRequestClassroomToken();
      }

      const syncRes = await postTestToGoogleClassroom(token, {
        test,
        subject: targetSubj,
        includePrompts: true
      });

      if (onUpdateTestResult) {
        onUpdateTestResult(test.id, {
          classroomCourseId: syncRes.course.id,
          classroomCourseName: syncRes.course.name,
          classroomPostId: syncRes.courseworkId || syncRes.announcementId,
          classroomUrl: syncRes.courseUrl
        });
      }

      setActionNotification({
        text: `Synced test "${test.testName}" to Google Classroom: "${syncRes.course.name}"`,
        success: true,
        url: syncRes.courseUrl
      });
    } catch (err: any) {
      console.error("Classroom sync failed:", err);
      setActionNotification({
        text: err?.message || 'Could not post to Google Classroom',
        success: false
      });
    } finally {
      setSyncingClassroomId(null);
    }
  };

  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!score) return;

    setActionNotification(null);
    const parsedTopics = multiTopicParsed?.matchedTopics || [];
    const primaryMatched = parsedTopics[0] || (topicNumberInput ? findMatchingTopic(topicNumberInput, subjects, selectedSubject) : null);
    
    // Auto-compose test title if blank
    let finalTestTitle = testName.trim();
    if (!finalTestTitle) {
      if (parsedTopics.length > 1) {
        finalTestTitle = `${selectedSubject} Quiz (Topics ${parsedTopics.map(t => t.topicNumber).join(', ')})`;
      } else if (primaryMatched) {
        finalTestTitle = `${primaryMatched.topicName} Quiz`;
      } else {
        finalTestTitle = `Test on ${selectedSubject}`;
      }
    }

    const struggledTopicsList = struggledTopicsText
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    parsedTopics.forEach(t => {
      if (!struggledTopicsList.includes(t.topicName)) {
        struggledTopicsList.push(t.topicName);
      }
    });

    setIsAnalyzing(true);
    let analysisData = undefined;
    let generatedPrompts: string[] = [];

    // 1. Dual Action / Email Prompts Option: Analyze mistakes & generate targeted prompts per topic
    const shouldGeneratePrompts = recordingOption === 'dual_save_email';

    if (shouldGeneratePrompts && (mistakes || score || parsedTopics.length > 0)) {
      try {
        const res = await apiAnalyzeMistakes({
          testName: finalTestTitle,
          subjectName: selectedSubject,
          score,
          mistakes,
          struggledTopics: struggledTopicsList,
          topicNumbers: parsedTopics.map(t => t.topicNumber),
          topicsList: parsedTopics.map(t => ({ topicNumber: t.topicNumber, topicName: t.topicName }))
        });

        if (res.success && res.analysis) {
          analysisData = res.analysis;
          if (Array.isArray(res.analysis.tutorPrompts)) {
            generatedPrompts = res.analysis.tutorPrompts;
          }
        }
      } catch (err) {
        console.warn("Analysis failed:", err);
      }
    }

    // Default fallback prompt if none generated
    if (shouldGeneratePrompts && generatedPrompts.length === 0 && mistakes) {
      generatedPrompts = [
        `I made mistakes on ${finalTestTitle} (${selectedSubject}) regarding: "${mistakes}". Please quiz me with 3 concept questions to fix this mistake.`,
        `Explain the correct solution and foundational rules for my missed problems in ${selectedSubject}: "${mistakes}".`
      ];
    }

    const calculatedTestNumber = testNumber.trim() || `Test #${testResults.filter(t => (t.subjectName || '').toLowerCase() === (selectedSubject || '').toLowerCase()).length + 1}`;
    const chosenVault = vaults.find(v => v.id === selectedVaultId);
    const scoreCalc = calculateScorePercentage(score);

    const topicNumbers = parsedTopics.length > 0
      ? parsedTopics.map(t => t.topicNumber)
      : (primaryMatched?.topicNumber ? [primaryMatched.topicNumber] : (topicNumberInput.trim() ? [topicNumberInput.trim()] : undefined));

    const topicIds = parsedTopics.length > 0
      ? parsedTopics.map(t => t.topicId)
      : (primaryMatched?.topicId ? [primaryMatched.topicId] : undefined);

    const topicNames = parsedTopics.length > 0
      ? parsedTopics.map(t => t.topicName)
      : (primaryMatched?.topicName ? [primaryMatched.topicName] : undefined);

    // Initial Test Object
    const newTest: Omit<TestResult, 'id'> = {
      userId: '',
      vaultId: selectedVaultId !== 'none' ? selectedVaultId : undefined,
      vaultName: chosenVault ? chosenVault.name : undefined,
      testName: finalTestTitle,
      testNumber: calculatedTestNumber,
      topicNumber: topicNumbers ? topicNumbers.join(', ') : undefined,
      topicNumbers,
      topicId: primaryMatched?.topicId,
      topicIds,
      topicName: topicNames ? topicNames.join(', ') : undefined,
      topicNames,
      chapterName: primaryMatched?.chapterName,
      paperCode: paperCode.trim() || undefined,
      subjectName: primaryMatched ? primaryMatched.subjectName : selectedSubject,
      score: scoreCalc.formattedScore,
      percentage: scoreCalc.percentage,
      scorePercentage: scoreCalc.percentage,
      totalMarks: scoreCalc.totalMarks,
      obtainedMarks: scoreCalc.obtainedMarks,
      date: new Date().toISOString().split('T')[0],
      mistakes,
      struggledTopics: struggledTopicsList,
      // For Option 1 (pure test data), correction prompts are not stored inside the test record if save_only is chosen
      correctionPrompts: recordingOption === 'save_only' ? undefined : (generatedPrompts.length > 0 ? generatedPrompts : undefined),
      correctionNotes: correctionNotes.trim() || undefined,
      isCorrected: false,
      analysis: analysisData,
      createdAt: new Date().toISOString()
    };

    // 2. Google Classroom Instant Sync (if enabled)
    let classroomSyncDetails: { courseName?: string; courseUrl?: string } = {};
    if (syncClassroomOption) {
      try {
        const targetSubjObj = subjects.find(s => (s.name || '').toLowerCase() === (selectedSubject || '').toLowerCase()) || {
          id: `subj-${Date.now()}`,
          name: selectedSubject,
          icon: '📚',
          color: '#6B705C',
          chapters: []
        };

        const classroomToken = getCachedClassroomToken();
        if (classroomToken) {
          const classRes = await postTestToGoogleClassroom(classroomToken, {
            test: { ...newTest, correctionPrompts: generatedPrompts },
            subject: targetSubjObj,
            matchedTopics: parsedTopics,
            includePrompts: shouldGeneratePrompts
          });

          if (classRes && classRes.success) {
            newTest.classroomCourseId = classRes.course.id;
            newTest.classroomCourseName = classRes.course.name;
            newTest.classroomPostId = classRes.courseworkId || classRes.announcementId;
            newTest.classroomUrl = classRes.courseUrl;
            classroomSyncDetails = { courseName: classRes.course.name, courseUrl: classRes.courseUrl };
          }
        }
      } catch (classErr) {
        console.warn("Classroom auto-sync notice:", classErr);
      }
    }

    // 3. Email Prompts to User (Option 2 requirement: email prompts directly)
    let emailDispatched = false;
    const recipientEmail = customEmailRecipient.trim() || userProfile?.email || user?.email || '';
    const recipientName = userProfile?.displayName || user?.displayName || 'Student';

    if (shouldGeneratePrompts && generatedPrompts.length > 0) {
      try {
        const gmailToken = getCachedGmailToken();
        if (gmailToken) {
          const testForEmail: TestResult = {
            ...newTest,
            id: `test-temp-${Date.now()}`,
            correctionPrompts: generatedPrompts
          };

          await sendTestImprovementEmail({
            recipientEmail,
            recipientName,
            testResults: [testForEmail],
            subjects,
            userProfile: userProfile || null,
            customNote: `Diagnostic practice prompts and test evaluation for ${finalTestTitle}.`
          }, gmailToken);

          newTest.promptsEmailedTo = recipientEmail;
          newTest.promptsEmailedAt = new Date().toISOString();
          emailDispatched = true;
        }
      } catch (mailErr) {
        console.warn("Email dispatch notice:", mailErr);
      }
    }

    // 4. Update syllabus status across all matched topics (e.g. 3.1, 3.2, 3.3)
    if (onUpdateSubjects && parsedTopics.length > 0) {
      const { updatedSubjects } = applyTestScoreToSyllabus(subjects, newTest);
      onUpdateSubjects(updatedSubjects);
    }

    // 5. Save test result into Vault
    onAddTestResult(newTest);
    setIsAnalyzing(false);
    setIsAddOpen(false);

    // Provide friendly confirmation banner
    let confirmMsg = `✅ Test recorded successfully in Vault.`;
    if (classroomSyncDetails.courseName) {
      confirmMsg += ` Updated Google Classroom ("${classroomSyncDetails.courseName}").`;
    }
    if (emailDispatched) {
      confirmMsg += ` 📧 Practice prompts emailed to ${recipientEmail}.`;
    }

    setActionNotification({
      text: confirmMsg,
      success: true,
      url: classroomSyncDetails.courseUrl
    });

    // Reset Form Fields
    setTestName('');
    setTestNumber('');
    setTopicNumberInput('');
    setPaperCode('');
    setSelectedVaultId('none');
    setScore('');
    setMistakes('');
    setStruggledTopicsText('');
    setCorrectionNotes('');
  };

  const handleQuickEmailCorrectionPrompts = async (test: TestResult) => {
    setSendingEmailId(test.id);
    setEmailStatusMsg(null);
    try {
      let token = getCachedGmailToken();
      if (!token) {
        token = await getOrRequestGmailToken();
      }

      const recipientEmail = userProfile?.email || user?.email || '';
      const recipientName = userProfile?.displayName || user?.displayName || 'Student';

      await sendTestImprovementEmail({
        recipientEmail,
        recipientName,
        testResults: [test],
        subjects,
        userProfile: userProfile || null
      }, token);

      if (onUpdateTestResult) {
        onUpdateTestResult(test.id, {
          promptsEmailedTo: recipientEmail,
          promptsEmailedAt: new Date().toISOString()
        });
      }

      setEmailStatusMsg({
        id: test.id,
        text: `Sent correction prompts & breakdown to ${recipientEmail}`,
        success: true
      });
    } catch (err: any) {
      console.error("Email send failed:", err);
      setEmailStatusMsg({
        id: test.id,
        text: err?.message || 'Failed to dispatch email via Gmail API',
        success: false
      });
    } finally {
      setSendingEmailId(null);
    }
  };

  const handleToggleCorrected = (test: TestResult) => {
    if (onUpdateTestResult) {
      onUpdateTestResult(test.id, {
        isCorrected: !test.isCorrected
      });
    }
  };

  const filteredTests = vaultSubjectFilter === 'all'
    ? testResults
    : testResults.filter(t => (t.subjectName || '').toLowerCase() === (vaultSubjectFilter || '').toLowerCase());

  // Subject statistics for vault
  const subjectsWithTests = subjects.map(s => {
    const sTests = testResults.filter(t => (t.subjectName || '').toLowerCase() === (s.name || '').toLowerCase());
    const correctedCount = sTests.filter(t => t.isCorrected).length;
    return {
      subject: s,
      tests: sTests,
      count: sTests.length,
      correctedCount,
      remediationRate: sTests.length > 0 ? Math.round((correctedCount / sTests.length) * 100) : 0
    };
  });

  return (
    <div className="space-y-6 animate-fade-in text-[#2B2D42]">
      {/* Action Notification Banner */}
      {actionNotification && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fade-in ${
          actionNotification.success
            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
            : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {actionNotification.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
            <span className="font-medium">{actionNotification.text}</span>
          </div>
          {actionNotification.url && (
            <a
              href={actionNotification.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-bold text-emerald-800 hover:underline shrink-0"
            >
              <span>Open Classroom</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-serif italic font-bold text-[#6B705C] flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-[#6B705C]" />
            <span>Subject Test Vault & Mistake Correction Hub</span>
          </h2>
          <p className="text-xs text-[#8A8F80] mt-1">
            Store test numbers, question paper scores, and mistake breakdowns linked to each subject. Generate correction prompts and email them directly to your inbox.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Launch Dedicated Assessment & Exam App */}
          <a
            id="btn-open-exam-portal-external"
            href="https://ai.studio/apps/22e73b44-206c-4c3f-8f31-363f8f2e6919"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs transition shadow-xs cursor-pointer"
            title="Open your dedicated Exam & Timed Assessment Portal (App 2) with AI grading & countdown timer"
          >
            <Clock className="w-4 h-4 text-emerald-200" />
            <span>Launch Exam Portal</span>
            <ExternalLink className="w-3.5 h-3.5 text-emerald-200" />
          </a>

          {/* Timed Mock Exam Simulator Button */}
          <button
            id="btn-open-mock-exam-mode"
            onClick={() => setActiveSubTab('mock_exam')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#2D312E] hover:bg-[#1A1C1B] text-white font-bold text-xs transition shadow-xs cursor-pointer"
            title="Launch interactive timed mock exam simulator with AI rubric grading"
          >
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Timed Mock Exam</span>
          </button>

          {/* MCQ / Google Forms Exam Autopsy & Auto-Grader */}
          <button
            id="btn-open-mcq-autopsy"
            onClick={() => setIsMCQAutopsyOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-200 border border-amber-500/40 font-bold text-xs transition shadow-2xs cursor-pointer"
            title="Auto-grade Google Forms receipts, past paper MCQs, or uploaded test sheets with instant Mistake Vault & Marks Recovery linking"
          >
            <Brain className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Auto-Grade MCQs / Google Forms</span>
          </button>

          {/* Upload Test Data (PDF / CSV / Marks Report) */}
          <button
            id="btn-upload-test-data"
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#6B705C]/15 hover:bg-[#6B705C]/25 text-[#6B705C] dark:text-[#A5A58D] border border-[#6B705C]/30 font-bold text-xs transition shadow-2xs cursor-pointer"
            title="Upload PDF test report, CSV marksheet, or paste score logs to auto-link with syllabus topics"
          >
            <Upload className="w-4 h-4 text-[#6B705C]" />
            <span>Upload Test Scores (PDF / CSV)</span>
          </button>

          {/* Storage Vaults Quick Access */}
          <button
            id="btn-open-storage-vaults"
            onClick={() => setActiveTab('vaults')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#F2EFE9] hover:bg-[#EAE7DF] text-[#4A4E4D] border border-[#E0DBD0] font-bold text-xs transition shadow-2xs cursor-pointer"
            title="Open isolated storage vaults for project and mock exam series"
          >
            <Archive className="w-4 h-4 text-[#6B705C]" />
            <span>Storage Vaults ({vaults.length})</span>
          </button>

          {/* Email / Export Diagnostic Report */}
          <button
            id="btn-open-test-email-modal"
            onClick={() => {
              setFocusEmailTestId(undefined);
              setIsEmailModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#F2EFE9] hover:bg-[#EAE7DF] text-[#4A4E4D] border border-[#E0DBD0] font-bold text-xs transition shadow-2xs cursor-pointer"
            title="Email test scores, mistake breakdown, and improvement combinations to your inbox"
          >
            <Mail className="w-4 h-4 text-[#6B705C]" />
            <span>Email Summary</span>
          </button>

          <button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-medium text-xs transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Record Test Score</span>
          </button>
        </div>
      </div>

      {/* Sub Tab Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 bg-[#F9F7F2] p-1.5 rounded-2xl border border-[#E0DBD0]">
          <button
            onClick={() => setActiveSubTab('vault')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'vault'
                ? 'bg-white text-[#2B2D42] shadow-xs border border-[#E0DBD0]'
                : 'text-[#6B705C] hover:text-[#2B2D42]'
            }`}
          >
            <Layers className="w-4 h-4 text-[#6B705C]" />
            <span>Test Results & Vault ({testResults.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('mock_exam')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'mock_exam'
                ? 'bg-[#2D312E] text-white shadow-xs'
                : 'text-[#4A4E4D] hover:text-[#2D312E]'
            }`}
          >
            <Clock className={`w-4 h-4 ${activeSubTab === 'mock_exam' ? 'text-amber-400' : 'text-[#6B705C]'}`} />
            <span>🎯 Timed Mock Exam Simulator</span>
          </button>

          <button
            onClick={() => setActiveSubTab('weak_topics')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'weak_topics'
                ? 'bg-white text-rose-800 shadow-xs border border-rose-200'
                : 'text-rose-700 hover:text-rose-900'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Weak Topics (Last 7 Days)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('heatmap')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'heatmap'
                ? 'bg-white text-[#2B2D42] shadow-xs border border-[#E0DBD0]'
                : 'text-[#6B705C] hover:text-[#2B2D42]'
            }`}
          >
            <Brain className="w-4 h-4 text-[#6B705C]" />
            <span>Diagnostic & Retention Heatmap</span>
          </button>

          <button
            onClick={() => setActiveSubTab('tests')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'tests'
                ? 'bg-white text-[#2B2D42] shadow-xs border border-[#E0DBD0]'
                : 'text-[#6B705C] hover:text-[#2B2D42]'
            }`}
          >
            <FileCheck className="w-4 h-4 text-[#6B705C]" />
            <span>Chronological Feed</span>
          </button>
        </div>

        {activeSubTab === 'vault' && (
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[#8A8F80]" />
            <select
              value={vaultSubjectFilter}
              onChange={(e) => setVaultSubjectFilter(e.target.value)}
              className="bg-white border border-[#E0DBD0] rounded-xl px-3 py-1.5 text-xs text-[#4A4E4D] font-medium focus:outline-none focus:border-[#6B705C]"
            >
              <option value="all">All Subjects ({testResults.length} Tests)</option>
              {subjects.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* SUB-VIEW 1: SUBJECT TEST VAULT */}
      {activeSubTab === 'vault' && (
        <div className="space-y-6">
          {/* Quick Subject Vault Summary Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {subjectsWithTests.map(({ subject, count, correctedCount, remediationRate }) => (
              <div
                key={subject.id}
                onClick={() => setVaultSubjectFilter(subject.name)}
                className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                  (vaultSubjectFilter || '').toLowerCase() === (subject.name || '').toLowerCase()
                    ? 'bg-[#F2EFE9] border-[#6B705C] shadow-2xs'
                    : 'bg-white border-[#E0DBD0] hover:border-[#6B705C]/40'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">{subject.icon || '📚'}</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#EAE7DF] text-[#6B705C]">
                    {count} {count === 1 ? 'Test' : 'Tests'}
                  </span>
                </div>
                <div className="font-bold text-xs text-[#2B2D42] truncate">{subject.name}</div>
                <div className="text-[10px] text-[#8A8F80] mt-1 flex items-center justify-between">
                  <span>Remediated:</span>
                  <span className="font-mono font-bold text-[#6B705C]">{correctedCount}/{count} ({remediationRate}%)</span>
                </div>
              </div>
            ))}
          </div>

          {/* Test Vault List */}
          {filteredTests.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {filteredTests.map((test) => {
                const prompts = test.correctionPrompts || test.analysis?.tutorPrompts || [];
                const isCorrected = !!test.isCorrected;

                return (
                  <div
                    key={test.id}
                    className={`bg-white border rounded-3xl p-5 sm:p-6 shadow-xs transition space-y-4 ${
                      isCorrected ? 'border-emerald-200 bg-emerald-50/10' : 'border-[#E0DBD0] hover:border-[#6B705C]/30'
                    }`}
                  >
                    {/* Header line with Subject, Test #, Score and Badges */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E0DBD0]/80 pb-3">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#EAE7DF] text-[#6B705C]">
                            {test.testNumber || 'Test'}
                          </span>

                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#F2EFE9] text-[#2B2D42]">
                            {test.subjectName}
                          </span>

                          {/* Multi-Topic or Single Topic Badges */}
                          {test.topicNumbers && test.topicNumbers.length > 0 ? (
                            test.topicNumbers.map((tNum, idx) => (
                              <span
                                key={idx}
                                className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1 border border-emerald-200"
                              >
                                <Hash className="w-3 h-3 text-emerald-700" />
                                <span>Topic #{tNum}</span>
                              </span>
                            ))
                          ) : test.topicNumber ? (
                            <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1 border border-emerald-200">
                              <Hash className="w-3 h-3 text-emerald-700" />
                              <span>Topic #{test.topicNumber}</span>
                            </span>
                          ) : null}

                          {test.chapterName && (
                            <span className="text-[10px] font-medium text-[#8A8F80] hidden sm:inline">
                              {test.chapterName}
                            </span>
                          )}

                          {test.paperCode && (
                            <span className="text-[10px] font-mono text-[#8A8F80]">
                              Code: {test.paperCode}
                            </span>
                          )}
                          <span className="text-xs font-mono text-[#A5A58D]">{test.date}</span>

                          {/* Google Classroom Sync Badge */}
                          {(test.classroomUrl || test.classroomCourseName) && (
                            <a
                              href={test.classroomUrl || `https://classroom.google.com`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 hover:bg-emerald-100 transition"
                              title={`Synced with ${test.classroomCourseName || 'Google Classroom'}`}
                            >
                              <ExternalLink className="w-3 h-3 text-emerald-600" />
                              <span>Classroom Synced</span>
                            </a>
                          )}

                          {/* Prompts Emailed Badge */}
                          {test.promptsEmailedTo && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-1">
                              <Mail className="w-3 h-3 text-purple-600" />
                              <span>Prompts Emailed</span>
                            </span>
                          )}

                          {isCorrected ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Remediated & Mastered</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>Pending Correction</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-[#2B2D42]">{test.testName}</h3>
                          {test.topicNames && test.topicNames.length > 0 ? (
                            <span className="text-xs text-[#6B705C] font-semibold">
                              ({test.topicNames.join(', ')})
                            </span>
                          ) : test.topicName ? (
                            <span className="text-xs text-[#6B705C] font-semibold">
                              ({test.topicName})
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Jump to Topic in Syllabus */}
                        <button
                          onClick={() => handleJumpToSyllabusForTest(test)}
                          className="px-3 py-1.5 rounded-xl bg-[#F2EFE9] hover:bg-[#EAE7DF] border border-[#E0DBD0] text-[#6B705C] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                          title="Open this topic in your Syllabus"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>View in Syllabus</span>
                        </button>

                        {/* Google Classroom Sync Button */}
                        <button
                          onClick={() => handleSyncTestToClassroom(test)}
                          disabled={syncingClassroomId === test.id}
                          className="px-3 py-1.5 rounded-xl bg-[#F2EFE9] hover:bg-[#EAE7DF] border border-[#E0DBD0] text-[#2B2D42] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                          title="Post or update this test in Google Classroom"
                        >
                          {syncingClassroomId === test.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#6B705C]" />
                          ) : (
                            <Share2 className="w-3.5 h-3.5 text-[#6B705C]" />
                          )}
                          <span>{syncingClassroomId === test.id ? 'Syncing...' : 'Sync Classroom'}</span>
                        </button>

                        {/* Mark Corrected Toggle */}
                        <button
                          onClick={() => handleToggleCorrected(test)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                            isCorrected
                              ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                              : 'bg-[#F9F7F2] text-[#4A4E4D] border-[#E0DBD0] hover:bg-[#EAE7DF]'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isCorrected ? 'Corrected' : 'Mark as Corrected'}</span>
                        </button>

                        {/* Quick Email Correction Prompts to Inbox */}
                        <button
                          onClick={() => handleQuickEmailCorrectionPrompts(test)}
                          disabled={sendingEmailId === test.id}
                          className="px-3 py-1.5 rounded-xl bg-[#F2EFE9] hover:bg-[#EAE7DF] border border-[#E0DBD0] text-[#6B705C] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                          title="Email test prompts and mistakes to yourself"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>{sendingEmailId === test.id ? 'Sending...' : 'Email Prompts'}</span>
                        </button>

                        {/* Score Tag */}
                        <div className="bg-[#F9F7F2] px-3.5 py-1.5 rounded-2xl border border-[#E0DBD0] text-center min-w-[70px]">
                          <span className="block text-[9px] text-[#8A8F80] font-mono font-bold uppercase">SCORE</span>
                          <span className="text-sm font-extrabold text-[#6B705C] font-mono">{test.score}</span>
                        </div>
                      </div>
                    </div>

                    {/* Email Status Message Banner if sent */}
                    {emailStatusMsg && emailStatusMsg.id === test.id && (
                      <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                        emailStatusMsg.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}>
                        {emailStatusMsg.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
                        <span>{emailStatusMsg.text}</span>
                      </div>
                    )}

                    {/* Mistakes Box */}
                    {test.mistakes && (
                      <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200 text-xs text-rose-950 space-y-1">
                        <span className="font-bold flex items-center gap-1.5 text-rose-800">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Identified Mistakes & Missed Questions:</span>
                        </span>
                        <p className="leading-relaxed whitespace-pre-line">{test.mistakes}</p>
                      </div>
                    )}

                    {/* Correction Prompts & AI Remediation Section */}
                    {prompts.length > 0 && (
                      <div className="p-4 rounded-2xl bg-[#FAF8F4] border border-[#EAE7DF] space-y-2.5 text-xs">
                        <div className="flex items-center justify-between text-[#6B705C] font-bold">
                          <span className="flex items-center gap-1.5">
                            <Bot className="w-4 h-4 text-[#6B705C]" />
                            <span>Ready-to-Use AI Tutor Correction Prompts ({prompts.length}):</span>
                          </span>
                          <span className="text-[11px] text-[#8A8F80] font-normal hidden sm:inline">
                            Click to send prompt directly into AI Tutor
                          </span>
                        </div>

                        <div className="space-y-2">
                          {prompts.map((promptText, pIdx) => (
                            <div
                              key={pIdx}
                              className="p-3 rounded-2xl bg-white border border-[#E0DBD0] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-[#6B705C]/40 transition"
                            >
                              <div className="flex items-start gap-2">
                                <span className="text-[#6B705C] font-bold text-xs mt-0.5">#{pIdx + 1}</span>
                                <p className="italic text-[#2B2D42] leading-relaxed">"{promptText}"</p>
                              </div>

                              <button
                                onClick={() => {
                                  onSendPromptToTutor(promptText);
                                  setActiveTab('tutor');
                                }}
                                className="shrink-0 self-end sm:self-center px-3 py-1.5 rounded-full bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-medium text-[11px] flex items-center gap-1.5 transition cursor-pointer"
                              >
                                <span>Practice in Tutor</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Student's Correction Notes */}
                    {test.correctionNotes && (
                      <div className="p-3 rounded-2xl bg-[#F2EFE9]/60 border border-[#E0DBD0] text-xs space-y-1">
                        <span className="font-bold text-[#6B705C] flex items-center gap-1.5">
                          <Lightbulb className="w-3.5 h-3.5 text-[#6B705C]" />
                          <span>Student Correction & Learning Notes:</span>
                        </span>
                        <p className="text-[#4A4E4D] leading-relaxed">{test.correctionNotes}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-[#E0DBD0]">
              <FileCheck className="w-8 h-8 text-[#A5A58D] mx-auto mb-2" />
              <p className="text-xs text-[#8A8F80] font-medium">No test results found for this subject filter.</p>
              <p className="text-[11px] text-[#A5A58D] mt-1">Record a test score to store it in your subject vault with AI correction prompts.</p>
              <div className="flex items-center justify-center gap-2 mt-3">
                <button
                  onClick={() => setIsAddOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-medium text-xs transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Record Test Score</span>
                </button>
                <button
                  onClick={() => setIsUploadOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#F2EFE9] hover:bg-[#EAE7DF] border border-[#E0DBD0] text-[#6B705C] font-bold text-xs transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Batch Upload Data</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-VIEW 2: TIMED MOCK EXAM SIMULATOR */}
      {activeSubTab === 'mock_exam' && (
        <div className="animate-fade-in">
          <MockExamSimulator
            subjects={subjects}
            testResults={testResults}
            userProfile={userProfile}
            plans={plans}
            onAddTestResult={onAddTestResult}
            onUpdateSubjects={onUpdateSubjects}
            onSavePlan={onSavePlan}
            onAddScheduledTask={onAddScheduledTask}
            setActiveTab={setActiveTab}
            onSendPromptToTutor={onSendPromptToTutor}
            onSelectTopicInSyllabus={onSelectTopicInSyllabus}
          />
        </div>
      )}

      {/* SUB-VIEW 3: WEAK TOPICS LAST WEEK */}
      {activeSubTab === 'weak_topics' && (
        <WeakTopicsLastWeek
          testResults={testResults}
          sessions={sessions}
          subjects={subjects}
          plans={plans}
          userProfile={userProfile}
          onSavePlan={onSavePlan}
          setActiveTab={setActiveTab}
          onSendPromptToTutor={onSendPromptToTutor}
          onSelectTopicInSyllabus={onSelectTopicInSyllabus}
        />
      )}

      {/* SUB-VIEW 3: HEATMAP */}
      {activeSubTab === 'heatmap' && (
        <ExamDiagnosticHeatmap
          subjects={subjects}
          testResults={testResults}
          sessions={sessions}
          plans={plans}
          examDates={examDates}
          onAddTopicToPlan={handleAddTopicToPlan}
          setActiveTab={setActiveTab}
          onSendPromptToTutor={onSendPromptToTutor}
        />
      )}

      {/* SUB-VIEW 4: CHRONOLOGICAL TEST FEED */}
      {activeSubTab === 'tests' && (
        <div className="space-y-4">
          {testResults.length > 0 ? (
            testResults.map((test) => (
              <div
                key={test.id}
                className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-4 hover:border-[#6B705C]/30 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E0DBD0] pb-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#EAE7DF] text-[#6B705C]">
                        {test.subjectName}
                      </span>
                      {test.topicNumber && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          #{test.topicNumber}
                        </span>
                      )}
                      {test.testNumber && (
                        <span className="text-[10px] font-mono font-bold text-[#8A8F80]">
                          {test.testNumber}
                        </span>
                      )}
                      <span className="text-xs font-mono text-[#A5A58D]">{test.date}</span>
                    </div>
                    <h3 className="text-base font-bold text-[#4A4E4D]">{test.testName}</h3>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => handleJumpToSyllabusForTest(test)}
                      className="p-2 rounded-xl bg-[#F9F7F2] hover:bg-[#EAE7DF] border border-[#E0DBD0] text-[#6B705C] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                      title="View in Syllabus"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Syllabus</span>
                    </button>

                    <button
                      onClick={() => {
                        setFocusEmailTestId(test.id);
                        setIsEmailModalOpen(true);
                      }}
                      className="p-2 rounded-xl bg-[#F9F7F2] hover:bg-[#EAE7DF] border border-[#E0DBD0] text-[#6B705C] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                      title="Email this test result & improvement plan"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Email Report</span>
                    </button>

                    <div className="bg-[#F9F7F2] px-3 py-1.5 rounded-2xl border border-[#E0DBD0] text-center">
                      <span className="block text-[10px] text-[#A5A58D] font-mono font-bold uppercase tracking-wider">SCORE</span>
                      <span className="text-sm font-extrabold text-[#6B705C] font-mono">{test.score}</span>
                    </div>
                  </div>
                </div>

                {/* Mistakes & Struggled Topics */}
                {test.mistakes && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1">
                    <span className="font-bold flex items-center gap-1.5 text-rose-800">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Recorded Mistakes & Struggled Questions:</span>
                    </span>
                    <p className="leading-relaxed">{test.mistakes}</p>
                  </div>
                )}

                {/* AI Analysis Accordion Box */}
                {test.analysis && (
                  <div className="p-4 rounded-2xl bg-[#F2EFE9] border border-[#E0DBD0] space-y-3 text-xs">
                    <div className="flex items-center justify-between text-[#6B705C] font-bold border-b border-[#E0DBD0] pb-2">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-[#6B705C]" />
                        <span>Gemini AI Diagnostic Analysis:</span>
                      </span>
                      <button
                        onClick={() => handleOpenScheduleAdjuster(
                          `Remediation: ${test.testName} (${test.analysis?.weakConcept || 'Mistakes'})`,
                          test.subjectName,
                          30
                        )}
                        className="text-[11px] font-bold text-[#6B705C] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Schedule Remediation Slot</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[#4A4E4D]">
                      <div>
                        <span className="font-bold text-rose-800 block">What Went Wrong:</span>
                        <p className="text-[#4A4E4D] mt-0.5">{test.analysis.whatWentWrong}</p>
                      </div>

                      <div>
                        <span className="font-bold text-amber-900 block">Root Concept Gap:</span>
                        <p className="text-[#4A4E4D] mt-0.5">{test.analysis.weakConcept}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-[#E0DBD0]">
              <FileCheck className="w-8 h-8 text-[#A5A58D] mx-auto mb-2" />
              <p className="text-xs text-[#A5A58D]">No test results recorded yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Add Test Result Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#4A4E4D]/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#E0DBD0] rounded-3xl max-w-xl w-full p-6 shadow-xl relative text-[#4A4E4D] space-y-4 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsAddOpen(false)}
              className="absolute top-4 right-4 text-[#A5A58D] hover:text-[#4A4E4D] p-1 rounded-xl cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EAE7DF] text-[#6B705C] uppercase tracking-wider">
                  DUAL ACTION FLOW
                </span>
                <span className="text-[10px] text-[#8A8F80]">Vault + Email + Classroom</span>
              </div>
              <h3 className="text-base font-serif italic font-bold text-[#6B705C] flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-[#6B705C]" />
                <span>Record Test Score, Difficulties & Prompts</span>
              </h3>
            </div>

            <form onSubmit={handleCreateTest} className="space-y-4">
              {/* Linked Subject & Storage Vault */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#A5A58D] mb-1">Subject</label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full p-3 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] focus:outline-none focus:border-[#6B705C] font-semibold"
                  >
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.name}>{sub.icon || '📚'} {sub.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#A5A58D] mb-1">Storage Vault (Bucket)</label>
                  <select
                    value={selectedVaultId}
                    onChange={(e) => setSelectedVaultId(e.target.value)}
                    className="w-full p-3 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
                  >
                    <option value="none">General Subject Vault</option>
                    {vaults.map((vault) => (
                      <option key={vault.id} value={vault.id}>
                        {vault.icon || '📦'} {vault.name} ({vault.subjectName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Multi-Topic & Range Detection Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#A5A58D]">
                    Syllabus Topic(s) or Range (e.g. 3.1 to 3.3, or 3.1, 3.2, 3.3)
                  </label>
                  <span className="text-[10px] text-[#6B705C] font-semibold">Supports ranges & lists</span>
                </div>
                <input
                  type="text"
                  value={topicNumberInput}
                  onChange={(e) => setTopicNumberInput(e.target.value)}
                  placeholder="e.g. 3.1 to 3.3, 3.1, 3.2, and 3.3, or Topic Name"
                  className="w-full p-3 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] focus:outline-none focus:border-[#6B705C] font-mono"
                />

                {/* Real-time Multi-topic Badge Chips */}
                {multiTopicParsed && multiTopicParsed.matchedTopics.length > 0 ? (
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-800 text-[11px]">
                      <Check className="w-3.5 h-3.5 text-emerald-700" />
                      <span>
                        {multiTopicParsed.isRange ? 'Range Detected: ' : 'Multiple Topics Detected: '}
                        {multiTopicParsed.matchedTopics.length} distinct syllabus topic{multiTopicParsed.matchedTopics.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {multiTopicParsed.matchedTopics.map((t, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono text-[11px] font-semibold flex items-center gap-1"
                        >
                          <Hash className="w-3 h-3 text-emerald-700" />
                          <span>Topic {t.topicNumber}: {t.topicName}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : topicNumberInput.trim() ? (
                  <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Topic "{topicNumberInput}" will be indexed as a custom syllabus topic.</span>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#A5A58D] mb-1">Test Title</label>
                  <input
                    type="text"
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    placeholder={
                      multiTopicParsed && multiTopicParsed.matchedTopics.length > 0
                        ? `${selectedSubject} Quiz (Topics ${multiTopicParsed.matchedTopics.map(t => t.topicNumber).join(', ')})`
                        : "e.g. Thermodynamics Chapter Quiz"
                    }
                    className="w-full p-3 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#A5A58D] mb-1">Marks / Score</label>
                  <input
                    type="text"
                    required
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    placeholder="e.g. 42/50 or 84%"
                    className="w-full p-3 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] focus:outline-none focus:border-[#6B705C] font-mono"
                  />
                </div>
              </div>

              {/* Student Difficulties & Mistakes Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#A5A58D]">
                    Difficulties, Mistakes & What Went Wrong
                  </label>
                  <span className="text-[10px] text-[#8A8F80]">Key to AI prompt generation</span>
                </div>
                <textarea
                  value={mistakes}
                  onChange={(e) => setMistakes(e.target.value)}
                  placeholder="Post what your difficulties and what all the things were (e.g. Got confused on half-reactions in 3.1, missed sign convention in 3.2, ran out of time on 3.3)..."
                  rows={3}
                  className="w-full p-3 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
                />
              </div>

              {/* TWO CORE OPTIONS SELECTOR */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-bold uppercase tracking-widest text-[#6B705C]">
                  Choose Recording & Action Mode:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div
                    onClick={() => setRecordingOption('dual_save_email')}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer space-y-1 ${
                      recordingOption === 'dual_save_email'
                        ? 'border-[#6B705C] bg-[#FAF8F4] ring-2 ring-[#6B705C]/20'
                        : 'border-[#E0DBD0] bg-white hover:border-[#6B705C]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="record_mode"
                          checked={recordingOption === 'dual_save_email'}
                          onChange={() => setRecordingOption('dual_save_email')}
                          className="accent-[#6B705C]"
                        />
                        <span className="font-bold text-xs text-[#2B2D42]">Option 1: Save + Email Prompts</span>
                      </div>
                      <Sparkles className="w-3.5 h-3.5 text-[#6B705C]" />
                    </div>
                    <p className="text-[10px] text-[#8A8F80] leading-normal pl-5">
                      Saves test data cleanly in vault and emails diagnostic AI prompts & per-topic breakdown directly to your inbox.
                    </p>
                  </div>

                  <div
                    onClick={() => setRecordingOption('save_only')}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer space-y-1 ${
                      recordingOption === 'save_only'
                        ? 'border-[#6B705C] bg-[#FAF8F4] ring-2 ring-[#6B705C]/20'
                        : 'border-[#E0DBD0] bg-white hover:border-[#6B705C]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="record_mode"
                          checked={recordingOption === 'save_only'}
                          onChange={() => setRecordingOption('save_only')}
                          className="accent-[#6B705C]"
                        />
                        <span className="font-bold text-xs text-[#2B2D42]">Option 2: Save Test Data Only</span>
                      </div>
                      <FolderLock className="w-3.5 h-3.5 text-[#6B705C]" />
                    </div>
                    <p className="text-[10px] text-[#8A8F80] leading-normal pl-5">
                      Saves test scores & updates syllabus mastery without generating or emailing practice prompts.
                    </p>
                  </div>
                </div>
              </div>

              {/* Email Recipient Input (when email flow is active) */}
              {recordingOption === 'dual_save_email' && (
                <div className="space-y-1 p-3 rounded-2xl bg-[#FAF8F4] border border-[#EAE7DF]">
                  <label className="block text-[11px] font-bold text-[#6B705C] flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#6B705C]" />
                    <span>Deliver AI Prompts To Email Address:</span>
                  </label>
                  <input
                    type="email"
                    value={customEmailRecipient}
                    onChange={(e) => setCustomEmailRecipient(e.target.value)}
                    placeholder="e.g. student@gmail.com"
                    className="w-full p-2.5 bg-white border border-[#E0DBD0] rounded-xl text-xs text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
                  />
                </div>
              )}

              {/* Google Classroom Sync Toggle */}
              <div className="p-3 rounded-2xl bg-blue-50/50 border border-blue-200 flex items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <div className="font-bold text-blue-950 flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5 text-blue-700" />
                    <span>Auto-update Google Classroom class for {selectedSubject}</span>
                  </div>
                  <p className="text-[10px] text-blue-800">
                    Immediately creates coursework & posts an announcement with incorporated topics ({multiTopicParsed?.matchedTopics.length || 1} topics).
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={syncClassroomOption}
                  onChange={(e) => setSyncClassroomOption(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 cursor-pointer shrink-0"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E0DBD0]">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#A5A58D] hover:text-[#4A4E4D] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAnalyzing}
                  className="px-6 py-2.5 bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-medium text-xs rounded-full shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {isAnalyzing ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-spin text-white" />
                      <span>Analyzing & Syncing...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>
                        {recordingOption === 'dual_save_email'
                          ? 'Save Test & Email Prompts'
                          : 'Save Test Data Only'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MCQ / Google Forms Exam Autopsy Modal */}
      <MCQExamAutopsyModal
        isOpen={isMCQAutopsyOpen}
        onClose={() => setIsMCQAutopsyOpen(false)}
        subjects={subjects}
        onAddTestResult={onAddTestResult}
        onNavigateToMistakes={() => setActiveTab('mistake_vault')}
        onNavigateToMarksRecovery={() => setActiveTab('marks_recovery')}
      />

      {/* Upload Test Data Modal */}
      <UploadTestDataModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        subjects={subjects}
        vaults={vaults}
        onSaveBatch={handleBatchSaveTests}
      />

      {/* Test Score & Improvement Email Modal */}
      <TestScoreEmailModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        testResults={testResults}
        subjects={subjects}
        userProfile={userProfile}
        user={user}
        focusTestId={focusEmailTestId}
        onOpenScheduleAdjuster={handleOpenScheduleAdjuster}
        setActiveTab={setActiveTab}
      />

      {/* Smart Schedule Adjuster Modal */}
      <SmartScheduleAdjusterModal
        isOpen={isScheduleAdjusterOpen}
        onClose={() => setIsScheduleAdjusterOpen(false)}
        initialTopicName={adjusterTopic}
        initialSubjectName={adjusterSubject}
        initialDurationMinutes={adjusterDuration}
        subjects={subjects}
        plans={plans}
        sessions={sessions}
        userProfile={userProfile}
        onSavePlan={onSavePlan}
        onAddScheduledTask={onAddScheduledTask}
      />
    </div>
  );
};
