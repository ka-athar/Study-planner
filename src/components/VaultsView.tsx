import React, { useState, useMemo } from 'react';
import {
  Archive,
  Plus,
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  ChevronRight,
  ArrowLeft,
  Calendar,
  Layers,
  GraduationCap,
  TrendingUp,
  Tag,
  Share2,
  Trash2,
  Edit3,
  Bot,
  Mail,
  Download,
  Upload,
  Clock,
  Target,
  BookOpen,
  Hash,
  ExternalLink,
  RefreshCw,
  FolderLock,
  ArrowUpDown,
  MoveRight,
  Check,
  AlertCircle,
  X
} from 'lucide-react';
import { 
  StorageVault, 
  TestResult, 
  Subject, 
  ActiveTab, 
  UserProfile, 
  StudyPlan, 
  StudySession, 
  VaultCategory,
  FlashcardDeck,
  RevisionItem 
} from '../types';
import { apiAnalyzeMistakes } from '../lib/aiApi';
import { sendTestImprovementEmail, getOrRequestGmailToken, getCachedGmailToken } from '../lib/gmailService';
import { VaultTransferModal } from './VaultTransferModal';
import { PrintableStudyKitModal } from './PrintableStudyKitModal';

interface VaultsViewProps {
  vaults: StorageVault[];
  testResults: TestResult[];
  subjects: Subject[];
  userProfile?: UserProfile | null;
  user?: any;
  plans?: StudyPlan[];
  sessions?: StudySession[];
  flashcardDecks?: FlashcardDeck[];
  revisions?: RevisionItem[];
  onSaveVault?: (vault: Omit<StorageVault, 'id'>) => Promise<string> | void;
  onCreateVault?: (vault: Omit<StorageVault, 'id'>) => Promise<string> | void;
  onUpdateVault?: (vaultId: string, updates: Partial<StorageVault>) => void;
  onDeleteVault?: (vaultId: string) => void;
  onAddTestResult?: (test: Omit<TestResult, 'id'>) => Promise<void> | void;
  onUpdateTestResult?: (testId: string, updates: Partial<TestResult>) => void;
  onDeleteTestResult?: (testId: string) => void;
  setActiveTab?: (tab: ActiveTab) => void;
  onNavigateTab?: (tab: ActiveTab) => void;
  onSendPromptToTutor?: (promptText: string) => void;
}

const CATEGORY_LABELS: Record<VaultCategory, { label: string; bg: string; text: string; border: string }> = {
  mock_series: { label: 'Mock Series', bg: 'bg-indigo-50 dark:bg-indigo-950/40', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800' },
  exam_prep: { label: 'Exam Prep', bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
  project: { label: 'Project Batch', bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
  assignment_batch: { label: 'Assignment Batch', bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
  diagnostic: { label: 'Diagnostic Drill', bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
  lab_practicum: { label: 'Lab Practicum', bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800' },
  textbook: { label: 'Textbook & Material', bg: 'bg-teal-50 dark:bg-teal-950/40', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-200 dark:border-teal-800' },
  coursework: { label: 'Coursework & Notes', bg: 'bg-cyan-50 dark:bg-cyan-950/40', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-200 dark:border-cyan-800' },
  'Textbook & Coursework': { label: 'Textbook & Coursework', bg: 'bg-teal-50 dark:bg-teal-950/40', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-200 dark:border-teal-800' },
  custom: { label: 'Custom Bucket', bg: 'bg-stone-100 dark:bg-stone-800', text: 'text-stone-700 dark:text-stone-300', border: 'border-stone-300 dark:border-stone-700' }
};

const COLOR_OPTIONS = [
  '#059669', // Emerald
  '#2563EB', // Blue
  '#D97706', // Amber
  '#7C3AED', // Violet
  '#DC2626', // Red
  '#0891B2', // Cyan
  '#4F46E5', // Indigo
  '#6B705C', // Earth Sage
  '#BE185D', // Pink
  '#475569'  // Slate
];

const ICON_OPTIONS = ['🧬', '⚛️', '🧪', '📐', '📚', '🎯', '💡', '🏆', '📝', '⚡', '🔬', '🌐'];

export const VaultsView: React.FC<VaultsViewProps> = ({
  vaults,
  testResults,
  subjects,
  userProfile = null,
  user = null,
  plans = [],
  sessions = [],
  flashcardDecks = [],
  revisions = [],
  onSaveVault,
  onCreateVault,
  onUpdateVault = (_vaultId: string, _updates: Partial<StorageVault>) => {},
  onDeleteVault = (_vaultId: string) => {},
  onAddTestResult = async (_test: Omit<TestResult, 'id'>) => {},
  onUpdateTestResult = (_testId: string, _updates: Partial<TestResult>) => {},
  onDeleteTestResult,
  setActiveTab,
  onNavigateTab,
  onSendPromptToTutor = (_promptText: string) => {}
}) => {
  const saveVaultFn = onSaveVault || onCreateVault;
  const navigateTabFn = setActiveTab || onNavigateTab || (() => {});
  // Navigation & Active View State
  const [selectedVaultId, setSelectedVaultId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'updated' | 'name' | 'tests' | 'score'>('updated');

  // Modal States
  const [isCreateVaultOpen, setIsCreateVaultOpen] = useState(false);
  const [editingVault, setEditingVault] = useState<StorageVault | null>(null);
  const [isAddTestOpen, setIsAddTestOpen] = useState(false);
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);
  const [movingTest, setMovingTest] = useState<TestResult | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferVaultTarget, setTransferVaultTarget] = useState<StorageVault | null>(null);
  const [isStudyKitModalOpen, setIsStudyKitModalOpen] = useState(false);

  // In-App Deletion & Toast Notification States
  const [vaultPendingDelete, setVaultPendingDelete] = useState<StorageVault | null>(null);
  const [testPendingDelete, setTestPendingDelete] = useState<TestResult | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setNotificationMsg({ text, type });
    setTimeout(() => {
      setNotificationMsg(null);
    }, 4000);
  };

  const handleImportVault = async (importedVault: Omit<StorageVault, 'id'>, importedTests?: Omit<TestResult, 'id'>[]) => {
    if (saveVaultFn) {
      const createdId = await saveVaultFn(importedVault);
      if (importedTests && importedTests.length > 0 && onAddTestResult) {
        for (const t of importedTests) {
          await onAddTestResult({
            ...t,
            vaultId: createdId || undefined,
            vaultName: importedVault.name
          });
        }
      }
      showNotification(`Vault "${importedVault.name}" imported with ${importedTests?.length || 0} linked tests!`);
    }
  };

  const handleConfirmDeleteVault = () => {
    if (!vaultPendingDelete) return;
    const vId = vaultPendingDelete.id;
    const vName = vaultPendingDelete.name;
    setVaultPendingDelete(null);
    if (selectedVaultId === vId) {
      setSelectedVaultId(null);
    }
    if (isCreateVaultOpen && editingVault?.id === vId) {
      setIsCreateVaultOpen(false);
      setEditingVault(null);
    }
    onDeleteVault(vId);
    showNotification(`Storage vault "${vName}" deleted successfully.`);
  };

  const handleConfirmDeleteTest = () => {
    if (!testPendingDelete || !onDeleteTestResult) return;
    const tId = testPendingDelete.id;
    const tName = testPendingDelete.testName;
    setTestPendingDelete(null);
    onDeleteTestResult(tId);
    showNotification(`Test record "${tName}" removed.`);
  };

  // New/Edit Vault Form
  const [vaultName, setVaultName] = useState('');
  const [vaultSubject, setVaultSubject] = useState(subjects[0]?.name || 'General');
  const [vaultCategory, setVaultCategory] = useState<VaultCategory>('mock_series');
  const [vaultDescription, setVaultDescription] = useState('');
  const [vaultTargetScore, setVaultTargetScore] = useState(85);
  const [vaultTargetDate, setVaultTargetDate] = useState('');
  const [vaultColor, setVaultColor] = useState(COLOR_OPTIONS[0]);
  const [vaultIcon, setVaultIcon] = useState(ICON_OPTIONS[0]);
  const [vaultCourseCode, setVaultCourseCode] = useState('');
  const [vaultSemester, setVaultSemester] = useState('');
  const [vaultNotes, setVaultNotes] = useState('');

  // Add Test Form in Vault
  const [testName, setTestName] = useState('');
  const [testNumber, setTestNumber] = useState('');
  const [paperCode, setPaperCode] = useState('');
  const [testScore, setTestScore] = useState('');
  const [testMistakes, setTestMistakes] = useState('');
  const [struggledTopicsText, setStruggledTopicsText] = useState('');
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [isAnalyzingTest, setIsAnalyzingTest] = useState(false);

  // Batch Test Import Text
  const [batchRawText, setBatchRawText] = useState('');
  const [batchImportStatus, setBatchImportStatus] = useState<string | null>(null);

  // AI Synthesis for Selected Vault
  const [isSynthesizingVault, setIsSynthesizingVault] = useState(false);
  const [vaultSynthesisReport, setVaultSynthesisReport] = useState<string | null>(null);

  // Email Status
  const [emailStatusMsg, setEmailStatusMsg] = useState<{ text: string; success: boolean } | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Selected Vault Object
  const activeVault = useMemo(() => {
    return vaults.find(v => v.id === selectedVaultId) || null;
  }, [vaults, selectedVaultId]);

  // Tests grouped or filtered
  const testsInActiveVault = useMemo(() => {
    if (!activeVault) return [];
    return testResults.filter(t => {
      // Direct link by vaultId
      if (t.vaultId && t.vaultId === activeVault.id) return true;
      // Or if unassigned to any vault but matches vault subject and vault name match
      if (!t.vaultId && t.vaultName && t.vaultName.toLowerCase() === activeVault.name.toLowerCase()) return true;
      return false;
    });
  }, [testResults, activeVault]);

  // Overall Vaults Analytics
  const vaultStats = useMemo(() => {
    const totalVaultsCount = vaults.length;
    const totalTestsCount = testResults.length;
    const testsWithVault = testResults.filter(t => !!t.vaultId || !!t.vaultName).length;

    // Average score across all tests
    let totalScoreSum = 0;
    let validScoreCount = 0;
    testResults.forEach(t => {
      const parsed = parseFloat(t.score);
      if (!isNaN(parsed)) {
        totalScoreSum += parsed;
        validScoreCount++;
      }
    });
    const avgScore = validScoreCount > 0 ? Math.round(totalScoreSum / validScoreCount) : 0;

    // Remediation rate
    const correctedCount = testResults.filter(t => t.isCorrected).length;
    const remediationRate = totalTestsCount > 0 ? Math.round((correctedCount / totalTestsCount) * 100) : 0;

    return {
      totalVaultsCount,
      totalTestsCount,
      testsWithVault,
      avgScore,
      remediationRate
    };
  }, [vaults, testResults]);

  // Filtered Vaults List
  const filteredVaults = useMemo(() => {
    return vaults.filter(v => {
      const matchesSearch = !searchQuery.trim() || 
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.subjectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.description && v.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (v.tags && v.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));

      const matchesSubject = selectedSubjectFilter === 'all' || v.subjectName.toLowerCase() === selectedSubjectFilter.toLowerCase();
      const matchesCategory = selectedCategoryFilter === 'all' || v.category === selectedCategoryFilter;

      return matchesSearch && matchesSubject && matchesCategory;
    }).sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'tests') {
        const countA = testResults.filter(t => t.vaultId === a.id).length;
        const countB = testResults.filter(t => t.vaultId === b.id).length;
        return countB - countA;
      }
      if (sortBy === 'score') return (b.targetScore || 0) - (a.targetScore || 0);
      return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
    });
  }, [vaults, searchQuery, selectedSubjectFilter, selectedCategoryFilter, sortBy, testResults]);

  // Open Create/Edit Modal
  const handleOpenCreateVault = (vaultToEdit?: StorageVault) => {
    if (vaultToEdit) {
      setEditingVault(vaultToEdit);
      setVaultName(vaultToEdit.name);
      setVaultSubject(vaultToEdit.subjectName);
      setVaultCategory(vaultToEdit.category);
      setVaultDescription(vaultToEdit.description || '');
      setVaultTargetScore(vaultToEdit.targetScore || 85);
      setVaultTargetDate(vaultToEdit.targetDate || '');
      setVaultColor(vaultToEdit.color || COLOR_OPTIONS[0]);
      setVaultIcon(vaultToEdit.icon || ICON_OPTIONS[0]);
      setVaultCourseCode(vaultToEdit.metadata?.courseCode || '');
      setVaultSemester(vaultToEdit.metadata?.cohortOrSemester || '');
      setVaultNotes(vaultToEdit.metadata?.benchmarkNotes || '');
    } else {
      setEditingVault(null);
      setVaultName('');
      setVaultSubject(subjects[0]?.name || 'General');
      setVaultCategory('mock_series');
      setVaultDescription('');
      setVaultTargetScore(85);
      setVaultTargetDate('');
      setVaultColor(COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)]);
      setVaultIcon(ICON_OPTIONS[Math.floor(Math.random() * ICON_OPTIONS.length)]);
      setVaultCourseCode('');
      setVaultSemester('');
      setVaultNotes('');
    }
    setIsCreateVaultOpen(true);
  };

  const handleSaveVaultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaultName.trim()) return;

    const vaultPayload: Omit<StorageVault, 'id'> = {
      userId: user?.uid || '',
      name: vaultName.trim(),
      subjectName: vaultSubject,
      category: vaultCategory,
      description: vaultDescription.trim() || undefined,
      targetScore: Number(vaultTargetScore) || 85,
      targetDate: vaultTargetDate || undefined,
      color: vaultColor,
      icon: vaultIcon,
      createdAt: editingVault ? editingVault.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        courseCode: vaultCourseCode.trim() || undefined,
        cohortOrSemester: vaultSemester.trim() || undefined,
        benchmarkNotes: vaultNotes.trim() || undefined
      }
    };

    if (editingVault) {
      onUpdateVault(editingVault.id, vaultPayload);
    } else if (saveVaultFn) {
      const createdId = await saveVaultFn(vaultPayload);
      if (createdId && typeof createdId === 'string') {
        setSelectedVaultId(createdId);
      }
    }

    setIsCreateVaultOpen(false);
  };

  // Add Test into Active Vault
  const handleAddTestToActiveVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testName.trim() || !activeVault) return;

    const struggledTopicsList = struggledTopicsText
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    setIsAnalyzingTest(true);
    let analysisData = undefined;
    let generatedPrompts: string[] = [];

    try {
      if (testMistakes || testScore) {
        const res = await apiAnalyzeMistakes({
          testName,
          subjectName: activeVault.subjectName,
          score: testScore,
          mistakes: testMistakes,
          struggledTopics: struggledTopicsList
        });

        if (res.success && res.analysis) {
          analysisData = res.analysis;
          if (Array.isArray(res.analysis.tutorPrompts)) {
            generatedPrompts = res.analysis.tutorPrompts;
          }
        }
      }
    } catch (err) {
      console.warn("Analysis failed:", err);
    } finally {
      setIsAnalyzingTest(false);
    }

    if (generatedPrompts.length === 0 && testMistakes) {
      generatedPrompts = [
        `I missed questions in ${activeVault.name} (${activeVault.subjectName}) regarding: "${testMistakes}". Please explain the key concepts and quiz me with 2 targeted problems.`,
        `How do I systematically avoid this recurring mistake in ${activeVault.subjectName}: "${testMistakes}"?`
      ];
    }

    const calculatedTestNumber = testNumber.trim() || `Test #${testsInActiveVault.length + 1}`;

    const newTest: Omit<TestResult, 'id'> = {
      userId: user?.uid || '',
      vaultId: activeVault.id,
      vaultName: activeVault.name,
      testName: testName.trim(),
      testNumber: calculatedTestNumber,
      paperCode: paperCode.trim() || undefined,
      subjectName: activeVault.subjectName,
      score: testScore || 'N/A',
      date: new Date().toISOString().split('T')[0],
      mistakes: testMistakes,
      struggledTopics: struggledTopicsList,
      correctionPrompts: generatedPrompts,
      correctionNotes: correctionNotes.trim() || undefined,
      isCorrected: false,
      analysis: analysisData,
      createdAt: new Date().toISOString()
    };

    onAddTestResult(newTest);
    setIsAddTestOpen(false);

    // Reset Form
    setTestName('');
    setTestNumber('');
    setPaperCode('');
    setTestScore('');
    setTestMistakes('');
    setStruggledTopicsText('');
    setCorrectionNotes('');
  };

  // Reassign Test to Another Vault
  const handleMoveTestToVault = (test: TestResult, targetVaultId: string) => {
    const targetVault = vaults.find(v => v.id === targetVaultId);
    if (!targetVault && targetVaultId !== 'unassigned') return;

    onUpdateTestResult(test.id, {
      vaultId: targetVaultId === 'unassigned' ? undefined : targetVaultId,
      vaultName: targetVault ? targetVault.name : undefined,
      subjectName: targetVault ? targetVault.subjectName : test.subjectName
    });

    setMovingTest(null);
  };

  // Batch Import Tests
  const handleBatchImportSubmit = () => {
    if (!batchRawText.trim() || !activeVault) return;

    try {
      const lines = batchRawText.split('\n').map(l => l.trim()).filter(Boolean);
      let count = 0;

      for (const line of lines) {
        // Formats: "Test 1 | 88% | Chapter 3 kinetics mistakes" or "Quiz A, 92%, Missed friction calculation"
        const parts = line.includes('|') ? line.split('|') : line.split(',');
        const tTitle = parts[0]?.trim() || `Imported Test ${count + 1}`;
        const tScore = parts[1]?.trim() || '80%';
        const tMistakes = parts[2]?.trim() || '';
        const tTopics = parts[3] ? parts[3].split(';').map(x => x.trim()) : [];

        onAddTestResult({
          userId: user?.uid || '',
          vaultId: activeVault.id,
          vaultName: activeVault.name,
          testName: tTitle,
          testNumber: `Batch #${count + 1}`,
          subjectName: activeVault.subjectName,
          score: tScore,
          date: new Date().toISOString().split('T')[0],
          mistakes: tMistakes,
          struggledTopics: tTopics,
          correctionPrompts: tMistakes ? [`Explain problem: ${tMistakes}`] : [],
          isCorrected: false,
          createdAt: new Date().toISOString()
        });
        count++;
      }

      setBatchImportStatus(`Successfully created ${count} test entries in "${activeVault.name}"!`);
      setTimeout(() => {
        setIsBatchImportOpen(false);
        setBatchRawText('');
        setBatchImportStatus(null);
      }, 1200);
    } catch (err: any) {
      setBatchImportStatus(`Batch format error: ${err.message}`);
    }
  };

  // AI Synthesis for the Active Vault
  const handleSynthesizeActiveVault = async () => {
    if (!activeVault || testsInActiveVault.length === 0) return;
    setIsSynthesizingVault(true);
    setVaultSynthesisReport(null);

    try {
      const testSummaries = testsInActiveVault.map(t => 
        `- ${t.testName} (${t.score}): Mistakes: ${t.mistakes || 'None noted'} | Struggles: ${t.struggledTopics.join(', ') || 'N/A'}`
      ).join('\n');

      const synthesisPrompt = `
You are an expert academic diagnostic AI analyzing an isolated test vault bucket:
Vault Name: ${activeVault.name}
Subject: ${activeVault.subjectName}
Category: ${activeVault.category}
Target Score: ${activeVault.targetScore}%
Contained Tests (${testsInActiveVault.length}):
${testSummaries}

Provide a crisp, actionable 3-part diagnostic:
1. Recurring Vulnerabilities & Misconceptions: Core gaps identified across this specific test batch.
2. High-Yield Remediation Action Plan: 3 targeted steps the student must take to cross the ${activeVault.targetScore}% threshold.
3. Mastered Strengths: What concepts this batch demonstrates solid control over.
`;

      const res = await apiAnalyzeMistakes({
        testName: `Vault Diagnostic: ${activeVault.name}`,
        subjectName: activeVault.subjectName,
        score: `${testsInActiveVault.length} Tests Analyzed`,
        mistakes: testSummaries,
        struggledTopics: Array.from(new Set(testsInActiveVault.flatMap(t => t.struggledTopics)))
      });

      if (res.success && res.analysis) {
        const bullets = res.analysis.conceptBreakdown?.map(c => `• **${c.concept}**: ${c.remedialAction}`).join('\n') || '';
        const prompts = res.analysis.tutorPrompts?.map(p => `• "${p}"`).join('\n') || '';
        
        setVaultSynthesisReport(`
### 🎯 Diagnostic Synthesis for ${activeVault.name}

**Root Vulnerabilities Identified:**
${bullets || 'No severe conceptual bottlenecks found across test batch.'}

**Immediate AI Tutor Action Prompts:**
${prompts}

**Recommended Focus:**
${res.analysis.studyPlanAdjustment || 'Schedule 2 focused practice drills on your weakest tested chapters.'}
        `.trim());
      } else {
        setVaultSynthesisReport(`✅ Analyzed ${testsInActiveVault.length} test records. All tests within this bucket have been cataloged with isolated performance tracking.`);
      }
    } catch (err: any) {
      setVaultSynthesisReport(`Analysis preview ready: All ${testsInActiveVault.length} test results in "${activeVault.name}" are isolated within their ${activeVault.subjectName} context.`);
    } finally {
      setIsSynthesizingVault(false);
    }
  };

  // Send Email Diagnostic for Active Vault
  const handleEmailVaultSummary = async () => {
    if (!activeVault || testsInActiveVault.length === 0) return;
    setIsSendingEmail(true);
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
        testResults: testsInActiveVault,
        subjects,
        userProfile: userProfile || null
      }, token);

      setEmailStatusMsg({
        text: `Sent comprehensive vault diagnostic report to ${recipientEmail}`,
        success: true
      });
    } catch (err: any) {
      console.error("Vault email dispatch failed:", err);
      setEmailStatusMsg({
        text: err?.message || 'Failed to dispatch email via Gmail API',
        success: false
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Export Active Vault as JSON
  const handleExportVaultJSON = () => {
    if (!activeVault) return;
    const exportData = {
      vault: activeVault,
      tests: testsInActiveVault,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeVault.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_vault.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Available subjects for selection
  const subjectList = useMemo(() => {
    const fromProps = subjects.map(s => s.name);
    const fromVaults = vaults.map(v => v.subjectName);
    return Array.from(new Set([...fromProps, ...fromVaults])).filter(Boolean);
  }, [subjects, vaults]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast Notification Banner */}
      {notificationMsg && (
        <div className={`p-3.5 rounded-xl text-xs flex items-center justify-between border shadow-sm animate-fade-in ${
          notificationMsg.type === 'error'
            ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'
            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
        }`}>
          <div className="flex items-center gap-2 font-medium">
            {notificationMsg.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            )}
            <span>{notificationMsg.text}</span>
          </div>
          <button
            onClick={() => setNotificationMsg(null)}
            className="p-1 hover:opacity-75 cursor-pointer text-muted"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. Header & Overview KPIs */}
      {!selectedVaultId && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-theme shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-theme-accent border border-theme flex items-center justify-center text-primary shadow-2xs">
                  <Archive className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary font-serif tracking-tight flex items-center gap-2">
                    Storage Vaults
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#6B705C]/15 text-[#6B705C] dark:text-[#A5A58D] font-sans font-semibold">
                      Isolated Buckets
                    </span>
                  </h2>
                  <p className="text-xs text-muted">
                    Create isolated storage buckets for specific projects, mock batches, and term exams — keeping test data structured by subject context.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={() => { setTransferVaultTarget(null); setIsTransferModalOpen(true); }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-semibold text-xs transition cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Transfer & Exchange</span>
              </button>

              <button
                onClick={() => setIsStudyKitModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30 font-semibold text-xs transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Study Kit</span>
              </button>

              <button
                onClick={() => navigateTabFn('tests')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-theme-accent hover:opacity-85 text-primary border border-theme font-medium text-xs transition cursor-pointer"
              >
                <FileCheck className="w-4 h-4 text-muted" />
                <span>All Tests List</span>
              </button>

              <button
                onClick={() => handleOpenCreateVault()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-semibold text-xs transition shadow-sm active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Vault</span>
              </button>
            </div>
          </div>

          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="bg-surface p-4 rounded-xl border border-theme shadow-2xs">
              <div className="flex items-center justify-between text-muted text-xs mb-1">
                <span>Active Vaults</span>
                <FolderLock className="w-4 h-4 text-primary" />
              </div>
              <div className="text-2xl font-bold text-primary font-mono">{vaultStats.totalVaultsCount}</div>
              <div className="text-[11px] text-muted mt-0.5">Isolated storage buckets</div>
            </div>

            <div className="bg-surface p-4 rounded-xl border border-theme shadow-2xs">
              <div className="flex items-center justify-between text-muted text-xs mb-1">
                <span>Tests Cataloged</span>
                <FileCheck className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-bold text-primary font-mono">{vaultStats.totalTestsCount}</div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                {vaultStats.testsWithVault} mapped to buckets
              </div>
            </div>

            <div className="bg-surface p-4 rounded-xl border border-theme shadow-2xs">
              <div className="flex items-center justify-between text-muted text-xs mb-1">
                <span>Average Mastery</span>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-primary font-mono">{vaultStats.avgScore}%</div>
              <div className="text-[11px] text-muted mt-0.5">Across all subject tests</div>
            </div>

            <div className="bg-surface p-4 rounded-xl border border-theme shadow-2xs">
              <div className="flex items-center justify-between text-muted text-xs mb-1">
                <span>Remediation Rate</span>
                <CheckCircle2 className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-primary font-mono">{vaultStats.remediationRate}%</div>
              <div className="text-[11px] text-muted mt-0.5">Mistakes analyzed & corrected</div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-surface p-4 rounded-2xl border border-theme flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xs">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search storage vaults by name, subject, or tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9.5 pr-4 py-2 bg-theme-accent/50 text-primary rounded-xl border border-theme text-xs focus:outline-none focus:ring-1 focus:ring-[#6B705C]"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
              {/* Subject Filter */}
              <div className="flex items-center gap-1.5 bg-theme-accent/60 px-2.5 py-1 rounded-xl border border-theme text-xs">
                <BookOpen className="w-3.5 h-3.5 text-muted" />
                <select
                  value={selectedSubjectFilter}
                  onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                  className="bg-transparent text-primary text-xs font-medium focus:outline-none cursor-pointer"
                >
                  <option value="all">All Subjects</option>
                  {subjectList.map(subj => (
                    <option key={subj} value={subj}>{subj}</option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-1.5 bg-theme-accent/60 px-2.5 py-1 rounded-xl border border-theme text-xs">
                <Tag className="w-3.5 h-3.5 text-muted" />
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="bg-transparent text-primary text-xs font-medium focus:outline-none cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  {Object.entries(CATEGORY_LABELS).map(([catKey, catVal]) => (
                    <option key={catKey} value={catKey}>{catVal.label}</option>
                  ))}
                </select>
              </div>

              {/* Sort By */}
              <div className="flex items-center gap-1.5 bg-theme-accent/60 px-2.5 py-1 rounded-xl border border-theme text-xs">
                <ArrowUpDown className="w-3.5 h-3.5 text-muted" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent text-primary text-xs font-medium focus:outline-none cursor-pointer"
                >
                  <option value="updated">Recently Updated</option>
                  <option value="name">Vault Name (A-Z)</option>
                  <option value="tests">Most Tests</option>
                  <option value="score">Highest Target Score</option>
                </select>
              </div>
            </div>
          </div>

          {/* Storage Vaults Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVaults.map(vault => {
              const testsInThisVault = testResults.filter(t => t.vaultId === vault.id || (!t.vaultId && t.vaultName === vault.name));
              const catConfig = CATEGORY_LABELS[vault.category] || CATEGORY_LABELS.custom;

              // Calculate vault average
              let scoreSum = 0;
              let scoreCount = 0;
              testsInThisVault.forEach(t => {
                const parsed = parseFloat(t.score);
                if (!isNaN(parsed)) {
                  scoreSum += parsed;
                  scoreCount++;
                }
              });
              const vaultAvg = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : null;
              const correctedCount = testsInThisVault.filter(t => t.isCorrected).length;

              return (
                <div
                  key={vault.id}
                  className="group bg-surface rounded-2xl border border-theme hover:border-primary/40 transition-all duration-200 shadow-2xs hover:shadow-md flex flex-col justify-between overflow-hidden"
                >
                  {/* Color Banner & Header */}
                  <div>
                    <div 
                      className="h-2 w-full transition-opacity group-hover:opacity-100 opacity-80"
                      style={{ backgroundColor: vault.color || '#059669' }}
                    />
                    
                    <div className="p-5 space-y-3.5">
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-base">{vault.icon || '📦'}</span>
                          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-theme-accent text-primary border border-theme">
                            {vault.subjectName}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${catConfig.bg} ${catConfig.text} ${catConfig.border}`}>
                            {catConfig.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setTransferVaultTarget(vault);
                              setIsTransferModalOpen(true);
                            }}
                            className="p-1 rounded-lg text-muted hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition cursor-pointer"
                            title="Export, Transfer or Share Vault"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenCreateVault(vault);
                            }}
                            className="p-1 rounded-lg text-muted hover:text-primary hover:bg-theme-accent transition cursor-pointer"
                            title="Edit Vault Settings"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setVaultPendingDelete(vault);
                            }}
                            className="p-1 rounded-lg text-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                            title="Delete Vault"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Vault Title & Description */}
                      <div 
                        onClick={() => setSelectedVaultId(vault.id)}
                        className="cursor-pointer"
                      >
                        <h3 className="text-base font-bold text-primary hover:text-[#6B705C] transition line-clamp-1">
                          {vault.name}
                        </h3>
                        <p className="text-xs text-muted line-clamp-2 mt-1 min-h-[32px]">
                          {vault.description || 'Dedicated isolated storage bucket for test records and diagnostic breakdowns.'}
                        </p>
                      </div>

                      {/* Metrics Box */}
                      <div className="grid grid-cols-3 gap-2 bg-theme-accent/50 p-2.5 rounded-xl border border-theme text-center text-xs">
                        <div>
                          <div className="text-muted text-[10px]">Tests</div>
                          <div className="font-bold text-primary font-mono">{testsInThisVault.length}</div>
                        </div>
                        <div>
                          <div className="text-muted text-[10px]">Avg Score</div>
                          <div className="font-bold font-mono text-primary">
                            {vaultAvg !== null ? `${vaultAvg}%` : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted text-[10px]">Target</div>
                          <div className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                            {vault.targetScore ? `${vault.targetScore}%` : '85%'}
                          </div>
                        </div>
                      </div>

                      {/* Tags & Metadata */}
                      {vault.tags && vault.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {vault.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-theme-accent text-muted border border-theme">
                              #{tag}
                            </span>
                          ))}
                          {vault.tags.length > 3 && (
                            <span className="text-[10px] text-muted self-center">+{vault.tags.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer Action */}
                  <div className="px-5 py-3 bg-surface border-t border-theme flex items-center justify-between text-xs">
                    <span className="text-[11px] text-muted">
                      {vault.targetDate ? `Due: ${vault.targetDate}` : 'Open Bucket'}
                    </span>

                    <button
                      onClick={() => setSelectedVaultId(vault.id)}
                      className="flex items-center gap-1 text-[#6B705C] dark:text-[#A5A58D] font-bold hover:underline cursor-pointer group-hover:translate-x-0.5 transition-transform"
                    >
                      <span>Open Vault</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Create New Vault Placeholder Card */}
            <div
              onClick={() => handleOpenCreateVault()}
              className="border-2 border-dashed border-theme hover:border-[#6B705C] bg-theme-accent/20 hover:bg-theme-accent/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition min-h-[260px] group"
            >
              <div className="w-12 h-12 rounded-2xl bg-surface border border-theme group-hover:scale-110 flex items-center justify-center text-primary mb-3 shadow-2xs transition">
                <Plus className="w-6 h-6 text-[#6B705C]" />
              </div>
              <h4 className="text-sm font-bold text-primary">Create New Storage Vault</h4>
              <p className="text-xs text-muted max-w-[220px] mt-1">
                Isolate test results for a specific semester, course code, or mock series.
              </p>
            </div>
          </div>
        </>
      )}

      {/* 2. Isolated Vault Deep Workspace (When a Vault is selected) */}
      {selectedVaultId && activeVault && (
        <div className="space-y-6 animate-fade-in">
          {/* Breadcrumb & Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => setSelectedVaultId(null)}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-primary transition cursor-pointer px-3 py-1.5 rounded-lg bg-theme-accent border border-theme"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to All Vaults</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenCreateVault(activeVault)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-theme-accent hover:opacity-85 text-primary border border-theme text-xs font-medium transition cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-muted" />
                <span>Edit Vault Metadata</span>
              </button>

              <button
                onClick={handleExportVaultJSON}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-theme-accent hover:opacity-85 text-primary border border-theme text-xs font-medium transition cursor-pointer"
                title="Export this vault and all its tests as JSON"
              >
                <Download className="w-3.5 h-3.5 text-muted" />
                <span>Export JSON</span>
              </button>

              <button
                onClick={() => setVaultPendingDelete(activeVault)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-theme-accent hover:bg-rose-50 dark:hover:bg-rose-950/30 text-muted hover:text-rose-600 border border-theme text-xs font-medium transition cursor-pointer"
                title="Delete this storage vault"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Delete Vault</span>
              </button>
            </div>
          </div>

          {/* Vault Banner Header */}
          <div className="bg-surface rounded-2xl border border-theme p-6 relative overflow-hidden shadow-xs">
            <div 
              className="absolute top-0 left-0 right-0 h-2"
              style={{ backgroundColor: activeVault.color || '#059669' }}
            />

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pt-2">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-2xl">{activeVault.icon || '📦'}</span>
                  <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-theme-accent text-primary border border-theme">
                    {activeVault.subjectName} Context
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${CATEGORY_LABELS[activeVault.category]?.bg} ${CATEGORY_LABELS[activeVault.category]?.text} ${CATEGORY_LABELS[activeVault.category]?.border}`}>
                    {CATEGORY_LABELS[activeVault.category]?.label}
                  </span>
                  {activeVault.metadata?.courseCode && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-theme-accent text-muted border border-theme">
                      {activeVault.metadata.courseCode}
                    </span>
                  )}
                </div>

                <h1 className="text-2xl font-bold text-primary font-serif tracking-tight">
                  {activeVault.name}
                </h1>

                <p className="text-xs text-muted leading-relaxed">
                  {activeVault.description || 'Isolated storage bucket. All recorded test results in this container are kept separate from other subject batches.'}
                </p>

                {activeVault.metadata?.benchmarkNotes && (
                  <div className="text-xs bg-theme-accent/60 p-2.5 rounded-xl border border-theme text-primary">
                    <span className="font-semibold">🎯 Target Benchmark:</span> {activeVault.metadata.benchmarkNotes}
                  </div>
                )}
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap lg:flex-col gap-2.5 justify-end">
                <button
                  onClick={() => setIsAddTestOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-semibold text-xs transition shadow-sm active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Record Test in this Vault</span>
                </button>

                <button
                  onClick={() => setIsBatchImportOpen(true)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-theme-accent hover:opacity-85 text-primary border border-theme font-medium text-xs transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-muted" />
                  <span>Batch Import Tests</span>
                </button>

                <button
                  onClick={handleSynthesizeActiveVault}
                  disabled={isSynthesizingVault || testsInActiveVault.length === 0}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-medium text-xs transition hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {isSynthesizingVault ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  )}
                  <span>AI Batch Diagnostic</span>
                </button>

                <button
                  onClick={handleEmailVaultSummary}
                  disabled={isSendingEmail || testsInActiveVault.length === 0}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-theme-accent hover:opacity-85 text-primary border border-theme font-medium text-xs transition cursor-pointer disabled:opacity-50"
                  title="Send all test analysis and correction prompts in this vault to Gmail"
                >
                  <Mail className="w-3.5 h-3.5 text-sky-500" />
                  <span>Email Vault Report</span>
                </button>
              </div>
            </div>

            {/* Email feedback notification */}
            {emailStatusMsg && (
              <div className={`mt-4 p-3 rounded-xl text-xs font-semibold flex items-center justify-between ${
                emailStatusMsg.success ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-900 border border-rose-200'
              }`}>
                <span>{emailStatusMsg.text}</span>
                <button onClick={() => setEmailStatusMsg(null)} className="text-xs font-bold underline cursor-pointer">Dismiss</button>
              </div>
            )}
          </div>

          {/* AI Synthesis Box if generated */}
          {vaultSynthesisReport && (
            <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/80 rounded-2xl p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>AI Isolated Batch Diagnostic Synthesis</span>
                </div>
                <button
                  onClick={() => setVaultSynthesisReport(null)}
                  className="text-xs text-indigo-700 dark:text-indigo-300 hover:underline cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
              <div className="text-xs text-indigo-950 dark:text-indigo-100 whitespace-pre-line leading-relaxed">
                {vaultSynthesisReport}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => {
                    const prompt = `Let's drill and remediate my weak concepts in ${activeVault.name} (${activeVault.subjectName}):\n${vaultSynthesisReport}`;
                    if (onSendPromptToTutor) onSendPromptToTutor(prompt);
                    navigateTabFn('tutor');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Practice with AI Tutor</span>
                </button>
              </div>
            </div>
          )}

          {/* Isolated Tests List in Vault */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-primary flex items-center gap-2">
                  <span>Tests in this Vault</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-theme-accent text-primary border border-theme">
                    {testsInActiveVault.length} Entries
                  </span>
                </h3>
                <p className="text-xs text-muted">
                  Tests stored strictly within the {activeVault.name} bucket.
                </p>
              </div>

              {testsInActiveVault.length > 0 && (
                <button
                  onClick={() => setIsAddTestOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-theme-accent hover:opacity-85 text-primary border border-theme text-xs font-semibold transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Test Result</span>
                </button>
              )}
            </div>

            {testsInActiveVault.length === 0 ? (
              <div className="bg-surface rounded-2xl border-2 border-dashed border-theme p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-theme-accent border border-theme mx-auto flex items-center justify-center text-primary">
                  <FileCheck className="w-6 h-6 text-muted" />
                </div>
                <h4 className="text-sm font-bold text-primary">No Tests in this Storage Vault Yet</h4>
                <p className="text-xs text-muted max-w-sm mx-auto">
                  Start recording test results, problem set scores, or past paper runs into this isolated bucket.
                </p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => setIsAddTestOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-semibold transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Record First Test</span>
                  </button>
                  <button
                    onClick={() => setIsBatchImportOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-theme-accent hover:opacity-85 text-primary border border-theme text-xs font-semibold transition cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Batch Paste Data</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {testsInActiveVault.map(test => {
                  return (
                    <div
                      key={test.id}
                      className="bg-surface rounded-2xl border border-theme p-5 space-y-3 shadow-2xs hover:border-primary/40 transition"
                    >
                      {/* Top Test Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-primary">{test.testName}</span>
                            {test.testNumber && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-theme-accent text-primary border border-theme">
                                {test.testNumber}
                              </span>
                            )}
                            {test.paperCode && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-theme-accent text-muted border border-theme">
                                {test.paperCode}
                              </span>
                            )}
                            <span className="text-xs text-muted flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {test.date}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="px-3 py-1 rounded-xl bg-[#6B705C]/15 border border-[#6B705C]/30 text-[#6B705C] dark:text-[#A5A58D] font-mono font-bold text-xs">
                            Score: {test.score}
                          </div>

                          <button
                            onClick={() => onUpdateTestResult(test.id, { isCorrected: !test.isCorrected })}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center gap-1 ${
                              test.isCorrected
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                : 'bg-theme-accent text-muted border-theme hover:text-primary'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{test.isCorrected ? 'Corrected' : 'Needs Review'}</span>
                          </button>

                          <button
                            onClick={() => setMovingTest(test)}
                            className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-theme-accent border border-transparent hover:border-theme transition cursor-pointer"
                            title="Reassign / Move to Another Vault"
                          >
                            <MoveRight className="w-3.5 h-3.5" />
                          </button>

                          {onDeleteTestResult && (
                            <button
                              onClick={() => setTestPendingDelete(test)}
                              className="p-1.5 rounded-lg text-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                              title="Delete Test Result"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Mistakes / Questions Missed */}
                      {test.mistakes && (
                        <div className="bg-rose-500/5 border border-rose-500/20 p-3 rounded-xl space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-400">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Mistakes & Missed Questions:</span>
                          </div>
                          <p className="text-xs text-primary leading-relaxed pl-5">
                            {test.mistakes}
                          </p>
                        </div>
                      )}

                      {/* Struggled Topics Badges */}
                      {test.struggledTopics && test.struggledTopics.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] text-muted font-medium">Struggled Concepts:</span>
                          {test.struggledTopics.map((topic, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* AI Correction Prompts */}
                      {test.correctionPrompts && test.correctionPrompts.length > 0 && (
                        <div className="bg-theme-accent/40 border border-theme p-3 rounded-xl space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-primary">
                            <div className="flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                              <span>Targeted Remediation Prompts:</span>
                            </div>
                            <button
                              onClick={() => {
                                const prompt = test.correctionPrompts![0];
                                if (onSendPromptToTutor) onSendPromptToTutor(prompt);
                                navigateTabFn('tutor');
                              }}
                              className="text-[11px] text-[#6B705C] dark:text-[#A5A58D] font-bold hover:underline cursor-pointer"
                            >
                              Send to AI Tutor →
                            </button>
                          </div>
                          <ul className="text-xs text-muted space-y-1 pl-4 list-disc">
                            {test.correctionPrompts.map((prompt, idx) => (
                              <li key={idx} className="leading-relaxed">
                                {prompt}
                              </li>
                            ))}
                          </ul>
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

      {/* 3. Create / Edit Storage Vault Modal */}
      {isCreateVaultOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-theme max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Archive className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-primary">
                  {editingVault ? 'Edit Storage Vault' : 'Create New Storage Vault'}
                </h3>
              </div>
              <button
                onClick={() => setIsCreateVaultOpen(false)}
                className="text-muted hover:text-primary text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveVaultSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-primary mb-1">
                  Vault Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AP Physics Mechanics Mock Series, Fall Semester Finals"
                  value={vaultName}
                  onChange={(e) => setVaultName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-theme-accent/50 text-primary border border-theme text-xs focus:outline-none focus:ring-1 focus:ring-[#6B705C]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-primary mb-1">
                    Assigned Subject Context <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={vaultSubject}
                    onChange={(e) => setVaultSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-theme-accent/50 text-primary border border-theme text-xs focus:outline-none"
                  >
                    {subjectList.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-primary mb-1">
                    Bucket Category
                  </label>
                  <select
                    value={vaultCategory}
                    onChange={(e) => setVaultCategory(e.target.value as VaultCategory)}
                    className="w-full px-3 py-2 rounded-xl bg-theme-accent/50 text-primary border border-theme text-xs focus:outline-none"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-primary mb-1">
                  Description / Study Objective
                </label>
                <textarea
                  rows={2}
                  placeholder="What specific exams or problem batches will be stored here?"
                  value={vaultDescription}
                  onChange={(e) => setVaultDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-theme-accent/50 text-primary border border-theme text-xs focus:outline-none focus:ring-1 focus:ring-[#6B705C]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-primary mb-1">
                    Target Score (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={vaultTargetScore}
                    onChange={(e) => setVaultTargetScore(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl bg-theme-accent/50 text-primary border border-theme text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-primary mb-1">
                    Target Exam / Deadline Date
                  </label>
                  <input
                    type="date"
                    value={vaultTargetDate}
                    onChange={(e) => setVaultTargetDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-theme-accent/50 text-primary border border-theme text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Icon & Color Selector */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-primary mb-1">
                    Vault Icon
                  </label>
                  <div className="flex flex-wrap gap-1.5 p-2 bg-theme-accent/30 rounded-xl border border-theme">
                    {ICON_OPTIONS.map(icon => (
                      <button
                        type="button"
                        key={icon}
                        onClick={() => setVaultIcon(icon)}
                        className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition ${
                          vaultIcon === icon ? 'bg-theme-accent border border-primary scale-110' : 'hover:bg-theme-accent/60'
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-primary mb-1">
                    Theme Color
                  </label>
                  <div className="flex flex-wrap gap-1.5 p-2 bg-theme-accent/30 rounded-xl border border-theme">
                    {COLOR_OPTIONS.map(c => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setVaultColor(c)}
                        className={`w-6 h-6 rounded-full transition ${
                          vaultColor === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Extra Metadata Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-primary mb-1">
                    Course Code (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PHYS-201, BIO-101"
                    value={vaultCourseCode}
                    onChange={(e) => setVaultCourseCode(e.target.value)}
                    className="w-full px-3.5 py-1.5 rounded-xl bg-theme-accent/50 text-primary border border-theme text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-primary mb-1">
                    Cohort / Semester (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Fall 2026, Term 1"
                    value={vaultSemester}
                    onChange={(e) => setVaultSemester(e.target.value)}
                    className="w-full px-3.5 py-1.5 rounded-xl bg-theme-accent/50 text-primary border border-theme text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-theme">
                {editingVault ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateVaultOpen(false);
                      setVaultPendingDelete(editingVault);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Vault</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateVaultOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-primary transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-semibold transition shadow-sm cursor-pointer"
                  >
                    {editingVault ? 'Save Changes' : 'Create Storage Vault'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Add Test to Vault Modal */}
      {isAddTestOpen && activeVault && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-theme max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-[#6B705C]" />
                <div>
                  <h3 className="text-base font-bold text-primary">Record Test in Vault</h3>
                  <p className="text-[11px] text-muted">Bucket: {activeVault.name} ({activeVault.subjectName})</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddTestOpen(false)}
                className="text-muted hover:text-primary text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddTestToActiveVault} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-primary mb-1">
                  Test / Assignment Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Unit 3 Kinetics Mock, Practice Paper 2"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-theme-accent/50 text-primary border border-theme text-xs focus:outline-none focus:ring-1 focus:ring-[#6B705C]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-primary mb-1">
                    Score / Marks <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 88% or 44/50"
                    value={testScore}
                    onChange={(e) => setTestScore(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-theme-accent/50 text-primary border border-theme text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-primary mb-1">
                    Test Number
                  </label>
                  <input
                    type="text"
                    placeholder={`#${testsInActiveVault.length + 1}`}
                    value={testNumber}
                    onChange={(e) => setTestNumber(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-theme-accent/50 text-primary border border-theme text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-primary mb-1">
                    Paper Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 9702/22/M/J"
                    value={paperCode}
                    onChange={(e) => setPaperCode(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-theme-accent/50 text-primary border border-theme text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-primary mb-1">
                  Mistakes & Questions Missed
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Q4 missed friction integral; Q9 forgot negative sign on potential energy..."
                  value={testMistakes}
                  onChange={(e) => setTestMistakes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-theme-accent/50 text-primary border border-theme text-xs focus:outline-none focus:ring-1 focus:ring-[#6B705C]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-primary mb-1">
                  Struggled Topics (Comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Work-Energy Theorem, Rotational Inertia, Friction"
                  value={struggledTopicsText}
                  onChange={(e) => setStruggledTopicsText(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-theme-accent/50 text-primary border border-theme text-xs focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddTestOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-primary transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAnalyzingTest}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-semibold transition shadow-sm disabled:opacity-50"
                >
                  {isAnalyzingTest && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Test in Vault</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Batch Import Tests Modal */}
      {isBatchImportOpen && activeVault && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-theme max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-500" />
                <h3 className="text-base font-bold text-primary">Batch Test Ingestion</h3>
              </div>
              <button
                onClick={() => setIsBatchImportOpen(false)}
                className="text-muted hover:text-primary text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted">
              Paste multiple test entries line-by-line. Format: <br />
              <code className="text-[11px] bg-theme-accent px-1.5 py-0.5 rounded font-mono text-primary">
                Test Title | Score | Mistakes | Topic1;Topic2
              </code>
            </p>

            <textarea
              rows={6}
              placeholder={`Midterm 1 | 82% | Missed enzyme kinetics question | Enzymes;Proteins\nMidterm 2 | 90% | Calculation error on Gibbs Free Energy | Thermodynamics`}
              value={batchRawText}
              onChange={(e) => setBatchRawText(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-theme-accent/50 text-primary border border-theme text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#6B705C]"
            />

            {batchImportStatus && (
              <div className="p-3 rounded-xl bg-theme-accent border border-theme text-xs font-semibold text-primary">
                {batchImportStatus}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setIsBatchImportOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchImportSubmit}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs"
              >
                Ingest Tests into Vault
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Move Test to Another Vault Modal */}
      {movingTest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-theme max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MoveRight className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-primary">Reassign Storage Vault</h3>
              </div>
              <button
                onClick={() => setMovingTest(null)}
                className="text-muted hover:text-primary text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted">
              Select the isolated storage vault bucket for test <strong>"{movingTest.testName}"</strong>:
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {vaults.map(vault => (
                <button
                  key={vault.id}
                  onClick={() => handleMoveTestToVault(movingTest, vault.id)}
                  className={`w-full p-3 rounded-xl border text-left flex items-center justify-between text-xs transition cursor-pointer ${
                    movingTest.vaultId === vault.id
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-primary font-bold'
                      : 'bg-theme-accent/50 border-theme hover:bg-theme-accent text-primary'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{vault.icon || '📦'}</span>
                    <div>
                      <div className="font-semibold">{vault.name}</div>
                      <div className="text-[10px] text-muted">{vault.subjectName} • {CATEGORY_LABELS[vault.category]?.label}</div>
                    </div>
                  </div>
                  {movingTest.vaultId === vault.id && (
                    <Check className="w-4 h-4 text-emerald-600" />
                  )}
                </button>
              ))}

              <button
                onClick={() => handleMoveTestToVault(movingTest, 'unassigned')}
                className="w-full p-3 rounded-xl border border-dashed border-theme hover:bg-theme-accent/50 text-left text-xs text-muted cursor-pointer"
              >
                Unassign from Vault (Keep in Global Tests Only)
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setMovingTest(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-primary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Delete Vault In-App Confirmation Modal */}
      {vaultPendingDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface rounded-2xl border border-theme max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-primary">Delete Storage Vault?</h3>
                <p className="text-xs text-muted leading-relaxed">
                  Are you sure you want to delete <span className="font-semibold text-primary">"{vaultPendingDelete.name}"</span> ({vaultPendingDelete.subjectName})?
                </p>
              </div>
            </div>

            <div className="p-3 bg-theme-accent/50 rounded-xl border border-theme text-xs text-muted space-y-1">
              <div className="font-medium text-primary flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Your test scores remain safe</span>
              </div>
              <p className="text-[11px] leading-normal">
                Tests recorded in this vault will not be deleted; they will simply be unassigned and remain in your global test list.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setVaultPendingDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-primary transition cursor-pointer bg-theme-accent border border-theme"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteVault}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Vault</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Delete Test In-App Confirmation Modal */}
      {testPendingDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface rounded-2xl border border-theme max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-primary">Delete Test Record?</h3>
                <p className="text-xs text-muted leading-relaxed">
                  Are you sure you want to remove <span className="font-semibold text-primary">"{testPendingDelete.testName}"</span>?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setTestPendingDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-primary transition cursor-pointer bg-theme-accent border border-theme"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTest}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Test</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Vault Transfer, Bundling & Marketplace Modal */}
      <VaultTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => {
          setIsTransferModalOpen(false);
          setTransferVaultTarget(null);
        }}
        allVaults={vaults}
        allTests={testResults}
        userProfile={userProfile}
        selectedVault={transferVaultTarget || activeVault}
        onImportVault={handleImportVault}
      />

      {/* 8. Printable Study Kit & Reference Packet Modal */}
      <PrintableStudyKitModal
        isOpen={isStudyKitModalOpen}
        onClose={() => setIsStudyKitModalOpen(false)}
        subjects={subjects}
        plans={plans}
        sessions={sessions}
        testResults={testResults}
        flashcardDecks={flashcardDecks}
        revisions={revisions}
        userProfile={userProfile}
      />
    </div>
  );
};
