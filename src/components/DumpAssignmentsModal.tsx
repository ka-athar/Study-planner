import React, { useState, useRef, useMemo } from 'react';
import { 
  Sparkles, 
  UploadCloud, 
  FileText, 
  Check, 
  AlertCircle, 
  Trash2, 
  Plus, 
  Layers, 
  Calendar as CalendarIcon, 
  Clock, 
  Tag, 
  BookOpen, 
  ArrowRight,
  Loader2,
  X,
  FileCheck,
  Zap,
  HelpCircle,
  FolderOpen,
  Filter
} from 'lucide-react';
import { 
  Assignment, 
  AssignmentPriority, 
  AssignmentStatus, 
  AssignmentType, 
  Subject, 
  StorageVault, 
  AssignmentSubtask 
} from '../types';
import { fileOrBlobToBase64 } from '../lib/base64Utils';

interface BulkAssignmentItem {
  id: string;
  title: string;
  description?: string;
  type: AssignmentType;
  priority: AssignmentPriority;
  status: AssignmentStatus;
  dueDate: string; // YYYY-MM-DD
  dueTime: string; // HH:mm
  estimatedMinutes: number;
  subjectName?: string;
  chapterName?: string;
  topicName?: string;
  notes?: string;
  subtasks?: AssignmentSubtask[];
}

interface DumpAssignmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  vaults?: StorageVault[];
  onSaveBatch: (assignments: Assignment[]) => Promise<void> | void;
}

const SAMPLE_ASSIGNMENT_DUMP = `1. Physics Lab Report on Thermodynamics & PV Engines, due Friday, 2 hours, High priority, Chapter 3
2. Organic Chemistry Problem Set (Reaction Mechanisms 4.1 to 4.5), due next Monday 11:59 PM, 90 mins, Homework
3. Calculus Assignment #5: Integration by Parts & Definite Integrals, due 2026-09-08, 120 mins, Math
4. Biology Cell Biology Essay & Research Review, due 2026-09-12, 3 hours, Project, Urgent
5. History Term Paper Draft: World War II Diplomatic Alliances, due in 2 weeks, 180 mins`;

export const DumpAssignmentsModal: React.FC<DumpAssignmentsModalProps> = ({
  isOpen,
  onClose,
  subjects,
  vaults = [],
  onSaveBatch
}) => {
  if (!isOpen) return null;

  const [rawText, setRawText] = useState('');
  const [defaultSubject, setDefaultSubject] = useState<string>(subjects[0]?.name || 'General');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parsedAssignments, setParsedAssignments] = useState<BulkAssignmentItem[]>([]);
  const [activeTab, setActiveTab] = useState<'paste' | 'file' | 'preview'>('paste');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tomorrowStr = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];

  // Client-side heuristic parser for instant fallback / offline parsing
  const parseLocalDump = (text: string): BulkAssignmentItem[] => {
    const lines = text
      .split(/\r?\n|;/)
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('//') && !l.startsWith('#---'));

    const items: BulkAssignmentItem[] = [];
    const today = new Date();

    const knownSubjectNames = subjects.map(s => s.name);

    lines.forEach((line, idx) => {
      // Remove leading bullet/numbers: "1. ", "- ", "* "
      const clean = line.replace(/^[-*•\d.)\]\s]+/, '').trim();
      if (!clean || clean.length < 3) return;

      let title = clean;
      let detectedSubject = defaultSubject !== 'all' ? defaultSubject : 'General';
      let priority: AssignmentPriority = 'Medium';
      let type: AssignmentType = 'Homework';
      let estimatedMinutes = 90;
      let dueDate = tomorrowStr;
      let dueTime = '23:59';
      let chapterName = '';

      // Priority match
      const lower = clean.toLowerCase();
      if (lower.includes('urgent') || lower.includes('critical') || lower.includes('highest')) {
        priority = 'Urgent';
      } else if (lower.includes('high') || lower.includes('priority: high') || lower.includes('hard')) {
        priority = 'High';
      } else if (lower.includes('low') || lower.includes('easy')) {
        priority = 'Low';
      }

      // Type match
      if (lower.includes('lab') || lower.includes('practicum') || lower.includes('experiment')) {
        type = 'Lab work';
      } else if (lower.includes('project') || lower.includes('essay') || lower.includes('paper') || lower.includes('report')) {
        type = 'Project';
      } else if (lower.includes('test') || lower.includes('mock') || lower.includes('exam')) {
        type = 'Test';
      } else if (lower.includes('quiz') || lower.includes('diagnostic')) {
        type = 'Quiz';
      } else if (lower.includes('presentation') || lower.includes('slides') || lower.includes('speech')) {
        type = 'Presentation';
      }

      // Duration match
      const durMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:hr|hrs|hour|hours|mins|min|m)\b/i);
      if (durMatch) {
        const val = parseFloat(durMatch[1]);
        if (clean.toLowerCase().includes('min')) {
          estimatedMinutes = Math.round(val);
        } else {
          estimatedMinutes = Math.round(val * 60);
        }
      }

      // Subject detection
      for (const s of knownSubjectNames) {
        const r = new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (r.test(clean)) {
          detectedSubject = s;
          break;
        }
      }

      // Date match ISO: 2026-09-15
      const isoMatch = clean.match(/\b(202\d)[-/.](\d{1,2})[-/.](\d{1,2})\b/);
      if (isoMatch) {
        const y = isoMatch[1];
        const m = String(parseInt(isoMatch[2], 10)).padStart(2, '0');
        const d = String(parseInt(isoMatch[3], 10)).padStart(2, '0');
        dueDate = `${y}-${m}-${d}`;
      } else if (lower.includes('tomorrow')) {
        const d = new Date(today);
        d.setDate(d.getDate() + 1);
        dueDate = d.toISOString().split('T')[0];
      } else if (lower.includes('friday')) {
        const d = new Date(today);
        const day = d.getDay();
        const diff = (5 - day + 7) % 7 || 7;
        d.setDate(d.getDate() + diff);
        dueDate = d.toISOString().split('T')[0];
      } else if (lower.includes('monday')) {
        const d = new Date(today);
        const day = d.getDay();
        const diff = (1 - day + 7) % 7 || 7;
        d.setDate(d.getDate() + diff);
        dueDate = d.toISOString().split('T')[0];
      } else {
        // Stagger by day offset if multiple
        const d = new Date(today);
        d.setDate(d.getDate() + (idx % 7) + 2);
        dueDate = d.toISOString().split('T')[0];
      }

      // Chapter match
      const chMatch = clean.match(/(?:Chapter|Ch\.?|Unit|Module)\s*(\d+|[A-Za-z0-9\s]+)/i);
      if (chMatch) {
        chapterName = chMatch[0].trim();
      }

      // Auto subtasks
      const subtasks: AssignmentSubtask[] = [
        {
          id: `sub_${Date.now()}_${idx}_1`,
          title: `Step 1: Read syllabus materials & outline approach`,
          phase: 'research',
          estimatedMinutes: Math.round(estimatedMinutes * 0.3),
          completed: false,
          scheduledDate: dueDate,
          timeslot: 'morning'
        },
        {
          id: `sub_${Date.now()}_${idx}_2`,
          title: `Step 2: Solve & execute main coursework`,
          phase: 'drafting',
          estimatedMinutes: Math.round(estimatedMinutes * 0.5),
          completed: false,
          scheduledDate: dueDate,
          timeslot: 'afternoon'
        },
        {
          id: `sub_${Date.now()}_${idx}_3`,
          title: `Step 3: Verification, final check & submission`,
          phase: 'submission',
          estimatedMinutes: Math.round(estimatedMinutes * 0.2),
          completed: false,
          scheduledDate: dueDate,
          timeslot: 'evening'
        }
      ];

      items.push({
        id: `bulk_asg_${Date.now()}_${idx}`,
        title,
        description: `Imported via Fast Assignment Dump on ${new Date().toLocaleDateString()}`,
        type,
        priority,
        status: 'Not Started',
        dueDate,
        dueTime,
        estimatedMinutes,
        subjectName: detectedSubject,
        chapterName: chapterName || undefined,
        subtasks
      });
    });

    return items;
  };

  const handleProcessDump = async () => {
    if (!rawText.trim()) {
      setErrorMessage('Please enter or paste your assignment list text.');
      return;
    }

    setErrorMessage(null);
    setIsAiProcessing(true);

    try {
      // Send to AI endpoint for extraction
      const response = await fetch('/api/ai/parse-assignment-dump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText,
          knownSubjects: subjects.map(s => s.name),
          defaultSubject: defaultSubject !== 'all' ? defaultSubject : undefined,
          referenceDate: new Date().toISOString().split('T')[0]
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.assignments && Array.isArray(data.assignments) && data.assignments.length > 0) {
          setParsedAssignments(data.assignments);
          setActiveTab('preview');
          setIsAiProcessing(false);
          return;
        }
      }
    } catch (err) {
      console.warn('AI assignment parsing endpoint had an issue, falling back to local extractor:', err);
    }

    // Fallback parsing
    const localParsed = parseLocalDump(rawText);
    setParsedAssignments(localParsed);
    setActiveTab('preview');
    setIsAiProcessing(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAiProcessing(true);
    setErrorMessage(null);

    try {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const base64 = await fileOrBlobToBase64(file);
        const response = await fetch('/api/ai/extract-study-material', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileData: base64,
            mimeType: 'application/pdf',
            sourceTitle: file.name,
            generateTasks: true,
            generateSyllabus: false
          })
        });

        if (response.ok) {
          const resJson = await response.json();
          const tasks = resJson.data?.suggestedTasks || [];
          if (tasks.length > 0) {
            const converted: BulkAssignmentItem[] = tasks.map((t: any, idx: number) => ({
              id: `pdf_asg_${Date.now()}_${idx}`,
              title: t.title || `Assignment from ${file.name}`,
              description: t.description || `Extracted from PDF ${file.name}`,
              type: 'Assignment',
              priority: (t.priority as AssignmentPriority) || 'Medium',
              status: 'Not Started',
              dueDate: t.date || tomorrowStr,
              dueTime: '23:59',
              estimatedMinutes: t.durationMinutes || 90,
              subjectName: t.subjectName || defaultSubject || 'General',
              chapterName: t.chapterName || '',
              topicName: t.topicName || '',
              subtasks: [
                {
                  id: `pdf_sub_${Date.now()}_${idx}_1`,
                  title: `Review PDF context & problem statement`,
                  phase: 'research',
                  estimatedMinutes: Math.round((t.durationMinutes || 90) * 0.3),
                  completed: false,
                  scheduledDate: t.date || tomorrowStr,
                  timeslot: 'morning'
                },
                {
                  id: `pdf_sub_${Date.now()}_${idx}_2`,
                  title: `Complete assignment exercises`,
                  phase: 'drafting',
                  estimatedMinutes: Math.round((t.durationMinutes || 90) * 0.5),
                  completed: false,
                  scheduledDate: t.date || tomorrowStr,
                  timeslot: 'afternoon'
                },
                {
                  id: `pdf_sub_${Date.now()}_${idx}_3`,
                  title: `Final proofread & submit`,
                  phase: 'submission',
                  estimatedMinutes: Math.round((t.durationMinutes || 90) * 0.2),
                  completed: false,
                  scheduledDate: t.date || tomorrowStr,
                  timeslot: 'evening'
                }
              ]
            }));
            setParsedAssignments(converted);
            setActiveTab('preview');
            setIsAiProcessing(false);
            return;
          }
        }
      }

      // Read as text
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setRawText(content);
        const parsed = parseLocalDump(content);
        setParsedAssignments(parsed);
        setActiveTab('preview');
        setIsAiProcessing(false);
      };
      reader.onerror = () => {
        setErrorMessage('Failed to read file.');
        setIsAiProcessing(false);
      };
      reader.readAsText(file);
    } catch (err: any) {
      console.error('File parsing error:', err);
      setErrorMessage(err.message || 'Failed to process file.');
      setIsAiProcessing(false);
    }
  };

  const handleUpdateItem = (index: number, field: keyof BulkAssignmentItem, value: any) => {
    setParsedAssignments(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    setParsedAssignments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveAll = async () => {
    if (parsedAssignments.length === 0) return;

    setIsSubmitting(true);
    try {
      const finalAssignments: Assignment[] = parsedAssignments.map((p, idx) => {
        const matchedSubject = subjects.find(s => s.name.toLowerCase() === (p.subjectName || '').toLowerCase());
        const matchedChapter = matchedSubject?.chapters.find(c => c.name.toLowerCase() === (p.chapterName || '').toLowerCase());
        const matchedTopic = matchedChapter?.topics.find(t => t.name.toLowerCase() === (p.topicName || '').toLowerCase());

        return {
          id: `asg_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
          userId: '',
          title: p.title.trim(),
          description: p.description?.trim() || undefined,
          type: p.type || 'Homework',
          priority: p.priority || 'Medium',
          status: p.status || 'Not Started',
          dueDate: p.dueDate || tomorrowStr,
          dueTime: p.dueTime || '23:59',
          estimatedMinutes: Number(p.estimatedMinutes) || 90,
          timeSpentMinutes: 0,
          subjectId: matchedSubject?.id,
          subjectName: p.subjectName || matchedSubject?.name || undefined,
          chapterId: matchedChapter?.id,
          chapterName: p.chapterName || matchedChapter?.name || undefined,
          topicId: matchedTopic?.id,
          topicName: p.topicName || matchedTopic?.name || undefined,
          notes: p.notes?.trim() || undefined,
          subtasks: p.subtasks || [],
          hasPrepPlan: (p.subtasks && p.subtasks.length > 0) || false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      });

      await onSaveBatch(finalAssignments);
      setSuccessMessage(`Successfully imported ${finalAssignments.length} assignments!`);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Error saving batch assignments:', err);
      setErrorMessage(err.message || 'Failed to save assignments.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalEstimatedHours = useMemo(() => {
    return Math.round(parsedAssignments.reduce((acc, a) => acc + (a.estimatedMinutes || 60), 0) / 60 * 10) / 10;
  }, [parsedAssignments]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-primary">
      <div className="bg-card border border-theme rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-theme flex items-center justify-between bg-theme-accent/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-serif italic text-primary flex items-center gap-2">
                <span>Fast Assignment Dump & Bulk Import</span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary not-italic">
                  AI Multi-Task Parser
                </span>
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Dump all your homework, project deadlines, and coursework at once. AI extracts due dates, subjects, priorities & study steps.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted hover:text-primary hover:bg-theme-accent/50 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 py-3 border-b border-theme flex items-center justify-between bg-card/60 gap-4 flex-wrap">
          <div className="flex items-center gap-2 p-1 rounded-2xl bg-theme-accent/40 border border-theme">
            <button
              onClick={() => setActiveTab('paste')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'paste' ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-primary'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Paste Assignment List</span>
            </button>
            <button
              onClick={() => setActiveTab('file')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'file' ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-primary'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Upload PDF / Syllabus / CSV</span>
            </button>
            {parsedAssignments.length > 0 && (
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'preview' ? 'bg-emerald-600 text-white shadow-xs' : 'text-muted hover:text-primary'
                }`}
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>Review & Save ({parsedAssignments.length})</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted font-medium">Default Subject:</span>
            <select
              value={defaultSubject}
              onChange={(e) => setDefaultSubject(e.target.value)}
              className="px-2.5 py-1 rounded-xl bg-card border border-theme text-xs font-medium text-primary focus:outline-hidden"
            >
              <option value="all">Auto-detect from text</option>
              {subjects.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* TAB 1: PASTE LIST */}
          {activeTab === 'paste' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <span>Paste Your Coursework / Assignment Dump Below</span>
                  <span className="text-[11px] text-muted font-normal">(one per line or bulleted list)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setRawText(SAMPLE_ASSIGNMENT_DUMP)}
                  className="text-xs text-[#6B705C] dark:text-[#A5A58D] hover:underline font-medium cursor-pointer"
                >
                  Load Sample Coursework Dump
                </button>
              </div>

              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Example:
1. Physics Thermodynamics Lab Report due Friday 5 PM, High priority, 2 hours
2. Chemistry Chapter 4 Problem Set due next Monday, Homework, 90 mins
3. Calculus Assignment #3 Integrals due 2026-09-10, Math, 2h
4. History Essay Draft on WWII due in 1 week, Project, Urgent"
                rows={10}
                className="w-full p-4 rounded-2xl bg-card border border-theme text-xs font-mono text-primary placeholder:text-muted/60 focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition resize-none"
              />

              <div className="p-4 rounded-2xl bg-theme-accent/20 border border-theme flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Intelligent AI Parsing Engine</span>
                  </p>
                  <p className="text-[11px] text-muted">
                    Automatically extracts task names, due dates, subjects, priorities, durations & creates multi-step study prep plans.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleProcessDump}
                  disabled={isAiProcessing || !rawText.trim()}
                  className="px-5 py-2.5 rounded-2xl bg-primary text-white text-xs font-bold flex items-center gap-2 hover:bg-primary/90 transition shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {isAiProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Analyzing Assignments...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Parse & Structure Assignments</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: UPLOAD FILE */}
          {activeTab === 'file' && (
            <div className="space-y-4">
              <div
                onClick={() => !isAiProcessing && fileInputRef.current?.click()}
                className={`border-2 border-dashed border-theme hover:border-primary/60 rounded-3xl p-10 text-center bg-theme-accent/20 cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                  isAiProcessing ? 'opacity-60 cursor-wait' : ''
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".pdf,.txt,.csv,.json,.docx"
                  className="hidden"
                />

                {isAiProcessing ? (
                  <div className="space-y-2">
                    <Loader2 className="w-10 h-10 text-[#6B705C] mx-auto animate-spin" />
                    <p className="text-sm font-bold text-primary">Analyzing Document with Gemini AI...</p>
                    <p className="text-xs text-muted">Extracting deadlines, syllabus chapters, and homework requirements</p>
                  </div>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-3xl bg-primary/10 text-primary flex items-center justify-center">
                      <UploadCloud className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-primary">Click or drag Course Syllabus, PDF, or Assignment Sheet here</p>
                      <p className="text-xs text-muted mt-1">Supports PDF syllabi, semester schedules, assignment prompts, or exported CSV spreadsheets</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PREVIEW & EDIT BEFORE SAVING */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-theme-accent/20 border border-theme">
                <div>
                  <span className="text-xs font-bold text-primary">
                    Parsed {parsedAssignments.length} Assignments & Deadlines
                  </span>
                  <span className="text-xs text-muted ml-2">
                    (~{totalEstimatedHours} hours total workload)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('paste')}
                  className="text-xs text-muted hover:text-primary flex items-center gap-1 font-medium cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add More</span>
                </button>
              </div>

              <div className="space-y-3">
                {parsedAssignments.map((item, idx) => (
                  <div 
                    key={item.id || idx}
                    className="p-4 rounded-2xl bg-card border border-theme space-y-3 shadow-2xs hover:border-primary/40 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => handleUpdateItem(idx, 'title', e.target.value)}
                          className="w-full font-bold text-xs sm:text-sm text-primary bg-transparent border-b border-transparent hover:border-theme focus:border-primary focus:outline-hidden py-0.5"
                          placeholder="Assignment Title"
                        />

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          {/* Subject Selector */}
                          <div>
                            <label className="text-[10px] text-muted uppercase font-bold block">Subject</label>
                            <select
                              value={item.subjectName || defaultSubject}
                              onChange={(e) => handleUpdateItem(idx, 'subjectName', e.target.value)}
                              className="w-full px-2 py-1 rounded-lg bg-theme-accent/40 border border-theme text-xs font-medium text-primary mt-0.5"
                            >
                              <option value="General">General</option>
                              {subjects.map(s => (
                                <option key={s.id} value={s.name}>{s.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Type Selector */}
                          <div>
                            <label className="text-[10px] text-muted uppercase font-bold block">Type</label>
                            <select
                              value={item.type}
                              onChange={(e) => handleUpdateItem(idx, 'type', e.target.value as AssignmentType)}
                              className="w-full px-2 py-1 rounded-lg bg-theme-accent/40 border border-theme text-xs font-medium text-primary mt-0.5"
                            >
                              <option value="Homework">Homework</option>
                              <option value="Assignment">Assignment</option>
                              <option value="Project">Project</option>
                              <option value="Test">Test</option>
                              <option value="Quiz">Quiz</option>
                              <option value="Presentation">Presentation</option>
                              <option value="Lab work">Lab work</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>

                          {/* Priority Selector */}
                          <div>
                            <label className="text-[10px] text-muted uppercase font-bold block">Priority</label>
                            <select
                              value={item.priority}
                              onChange={(e) => handleUpdateItem(idx, 'priority', e.target.value as AssignmentPriority)}
                              className={`w-full px-2 py-1 rounded-lg border text-xs font-bold mt-0.5 ${
                                item.priority === 'Urgent' ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-700 dark:text-rose-300' :
                                item.priority === 'High' ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-700 dark:text-amber-300' :
                                'bg-theme-accent/40 border-theme text-primary'
                              }`}
                            >
                              <option value="Urgent">Urgent</option>
                              <option value="High">High</option>
                              <option value="Medium">Medium</option>
                              <option value="Low">Low</option>
                            </select>
                          </div>

                          {/* Due Date */}
                          <div>
                            <label className="text-[10px] text-muted uppercase font-bold block">Due Date</label>
                            <input
                              type="date"
                              value={item.dueDate}
                              onChange={(e) => handleUpdateItem(idx, 'dueDate', e.target.value)}
                              className="w-full px-2 py-1 rounded-lg bg-theme-accent/40 border border-theme text-xs font-mono font-medium text-primary mt-0.5"
                            />
                          </div>
                        </div>

                        {/* Prep subtasks preview */}
                        {item.subtasks && item.subtasks.length > 0 && (
                          <div className="pt-2 border-t border-theme/60 space-y-1">
                            <span className="text-[10px] font-mono text-muted uppercase font-bold">
                              AI Prep Plan ({item.subtasks.length} Phases):
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {item.subtasks.map((st, sIdx) => (
                                <span 
                                  key={sIdx}
                                  className="text-[10px] px-2 py-0.5 rounded-md bg-theme-accent/50 text-muted font-medium"
                                >
                                  {st.title} ({st.estimatedMinutes}m)
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1.5 rounded-lg text-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer shrink-0"
                        title="Delete Assignment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-theme flex items-center justify-between bg-theme-accent/20 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-muted hover:text-primary transition cursor-pointer"
          >
            Cancel
          </button>

          {activeTab === 'preview' ? (
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSubmitting || parsedAssignments.length === 0}
              className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Importing {parsedAssignments.length} Assignments...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Import All {parsedAssignments.length} Assignments to Planner</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleProcessDump}
              disabled={isAiProcessing || !rawText.trim()}
              className="px-6 py-2.5 rounded-2xl bg-primary hover:bg-primary/90 text-white text-xs font-bold flex items-center gap-2 transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isAiProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Parse Coursework Dump</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
