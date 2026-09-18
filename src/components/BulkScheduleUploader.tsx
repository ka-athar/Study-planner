import React, { useState, useMemo, useRef } from 'react';
import { 
  UploadCloud, 
  FileText, 
  Calendar, 
  Clock, 
  Check, 
  AlertCircle, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  Download, 
  Layers, 
  BookOpen, 
  CheckCircle2, 
  RefreshCw,
  Plus,
  ArrowRight,
  Filter,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Subject, 
  StudyPlan, 
  StudyPlanTopic, 
  UserProfile, 
  ActiveTab 
} from '../types';

interface ParsedScheduleItem {
  id: string;
  date: string; // YYYY-MM-DD
  dayLabel?: string;
  timeSlot?: string; // e.g. "09:00 - 11:00"
  subjectName: string;
  chapterName: string;
  topicName: string;
  estimatedMinutes: number;
  priority: 'High' | 'Medium' | 'Low';
  notes?: string;
}

interface BulkScheduleUploaderProps {
  subjects: Subject[];
  userProfile: UserProfile | null;
  existingPlans: StudyPlan[];
  onSavePlan: (plan: Omit<StudyPlan, 'id'>) => Promise<void> | void;
  setActiveTab?: (tab: ActiveTab) => void;
}

// Starter Sample Templates
const SAMPLE_4_WEEK_SPRINT_CSV = `Date,Time,Subject,Chapter,Topic,DurationMins,Priority,Notes
2026-08-17,09:00 - 11:00,Physics,Thermodynamics,First Law of Thermodynamics & Heat Engines,120,High,Focus on PV diagrams and adiabatic processes
2026-08-17,14:00 - 16:00,Chemistry,Physical Chemistry,Chemical Equilibrium & Le Chatelier,120,High,Practice numerical problems
2026-08-18,09:00 - 11:30,Biology,Genetics,Mendelian Genetics & Punnett Squares,150,High,Review dihybrid cross ratios
2026-08-18,15:00 - 17:00,Mathematics,Calculus,Definite Integrals & Area Under Curves,120,Medium,Solve 10 practice exam questions
2026-08-19,10:00 - 12:00,Physics,Thermodynamics,Entropy & Second Law,120,High,Derive Carnot cycle efficiency
2026-08-20,09:00 - 11:00,Chemistry,Organic Chemistry,Reaction Mechanisms & Nucleophiles,120,High,Memorize electrophilic aromatic substitution
2026-08-21,14:00 - 16:30,Biology,Cell Biology,Mitosis vs Meiosis Stages,150,Medium,Diagram chromosome alignments
2026-08-24,09:00 - 11:00,Mathematics,Calculus,Differential Equations & Growth Models,120,High,Separation of variables
2026-08-25,10:00 - 12:30,Physics,Electromagnetism,Coulomb's Law & Electric Fields,150,High,Calculate vector superpositions
2026-08-26,14:00 - 16:00,Chemistry,Inorganic,Coordination Compounds & Ligands,120,Medium,Crystal field splitting theory
2026-08-28,09:00 - 12:00,Mock Test,Comprehensive,Full Length Practice Exam Mock 1,180,High,Timed diagnostic assessment
2026-08-31,10:00 - 12:00,Biology,Ecology,Ecosystem Energetics & Food Webs,120,Low,Review trophic levels
2026-09-02,09:00 - 11:30,Physics,Electromagnetism,Gauss's Law Applications,150,High,Spherical and cylindrical symmetry
2026-09-04,14:00 - 16:00,Chemistry,Organic Chemistry,Carbonyl Compounds & Aldehydes,120,High,Grignard synthesis pathways
2026-09-07,09:00 - 12:00,Mathematics,Calculus,Comprehensive Integration Mock Test,180,High,Review timed mistakes
2026-09-10,10:00 - 12:00,Biology,Human Physiology,Nervous System & Action Potentials,120,High,Membrane potential threshold
2026-09-14,09:00 - 12:00,Mock Test,Final Sprint,Full Board Examination Mock 2,180,High,Final pre-exam sprint`;

const SAMPLE_JSON_TEMPLATE = JSON.stringify([
  {
    date: "2026-08-17",
    timeSlot: "09:00 - 11:30",
    subjectName: "Physics",
    chapterName: "Mechanics",
    topicName: "Rotational Dynamics & Torque",
    estimatedMinutes: 150,
    priority: "High",
    notes: "Review moment of inertia calculations"
  },
  {
    date: "2026-08-18",
    timeSlot: "14:00 - 16:00",
    subjectName: "Chemistry",
    chapterName: "Electrochemistry",
    topicName: "Galvanic Cells & Nernst Equation",
    estimatedMinutes: 120,
    priority: "High",
    notes: "Focus on standard electrode potentials"
  },
  {
    date: "2026-08-19",
    timeSlot: "09:00 - 11:00",
    subjectName: "Mathematics",
    chapterName: "Linear Algebra",
    topicName: "Eigenvalues and Eigenvectors",
    estimatedMinutes: 120,
    priority: "Medium",
    notes: "Solve characteristic polynomial exercises"
  }
], null, 2);

export const BulkScheduleUploader: React.FC<BulkScheduleUploaderProps> = ({
  subjects = [],
  userProfile,
  existingPlans = [],
  onSavePlan,
  setActiveTab
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeInputMode, setActiveInputMode] = useState<'paste' | 'upload' | 'templates'>('paste');
  const [rawText, setRawText] = useState<string>('');
  const [parsedItems, setParsedItems] = useState<ParsedScheduleItem[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to normalize and parse dates
  const parseDateString = (input: string): string | null => {
    const trimmed = input.trim();
    // 1. YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

    // 2. DD/MM/YYYY or DD-MM-YYYY
    const ddmmyyyy = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (ddmmyyyy) {
      const day = ddmmyyyy[1].padStart(2, '0');
      const month = ddmmyyyy[2].padStart(2, '0');
      const year = ddmmyyyy[3];
      return `${year}-${month}-${day}`;
    }

    // 3. Month Name Day (e.g. Aug 17, 2026 or August 17 2026)
    try {
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch {
      // ignore
    }

    return null;
  };

  // Main Parsing Logic (supports CSV, JSON, Markdown lists, Table text)
  const handleParseInput = (textToParse: string) => {
    setParseError(null);
    setImportSuccessMessage(null);
    const content = textToParse.trim();
    if (!content) {
      setParsedItems([]);
      return;
    }

    const items: ParsedScheduleItem[] = [];

    // 1. Try parsing JSON
    if (content.startsWith('[') || content.startsWith('{')) {
      try {
        const parsedJson = JSON.parse(content);
        const array = Array.isArray(parsedJson) ? parsedJson : (parsedJson.plans || parsedJson.schedule || parsedJson.items || [parsedJson]);

        array.forEach((obj: any, idx: number) => {
          const dateStr = parseDateString(obj.date || obj.Date || new Date().toISOString().split('T')[0]);
          if (dateStr) {
            items.push({
              id: `item-${Date.now()}-${idx}`,
              date: dateStr,
              timeSlot: obj.timeSlot || obj.time || obj.Time || '09:00 - 11:00',
              subjectName: obj.subjectName || obj.subject || obj.Subject || 'General',
              chapterName: obj.chapterName || obj.chapter || obj.Chapter || 'Study Chapter',
              topicName: obj.topicName || obj.topic || obj.Topic || obj.title || 'Scheduled Study Topic',
              estimatedMinutes: Number(obj.estimatedMinutes || obj.duration || obj.DurationMins || 120),
              priority: (obj.priority === 'Low' || obj.priority === 'Medium') ? obj.priority : 'High',
              notes: obj.notes || obj.Notes || obj.reason || ''
            });
          }
        });

        if (items.length > 0) {
          setParsedItems(items);
          return;
        }
      } catch (err) {
        // Fall back to line-by-line / CSV parsing
      }
    }

    // 2. Line-by-line / CSV / Markdown parsing
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    let headerPassed = false;
    let isCsvMode = false;

    lines.forEach((line, index) => {
      // Check for CSV header
      if (line.toLowerCase().includes('date') && (line.toLowerCase().includes('subject') || line.toLowerCase().includes('topic'))) {
        headerPassed = true;
        isCsvMode = true;
        return;
      }

      // Handle CSV line with commas or tabs
      if (line.includes(',') || line.includes('\t')) {
        const delimiter = line.includes('\t') ? '\t' : ',';
        const parts = line.split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ''));
        if (parts.length >= 3) {
          // Expected: Date, Time/Subject, Subject/Topic, Topic/Duration, etc.
          const datePart = parseDateString(parts[0]);
          if (datePart) {
            let timeSlot = '09:00 - 11:00';
            let subject = 'General';
            let chapter = 'Chapter';
            let topic = 'Topic';
            let duration = 120;
            let priority: 'High' | 'Medium' | 'Low' = 'High';
            let notes = '';

            // Check if 2nd part looks like a time (e.g. 09:00 - 11:00)
            if (parts[1]?.includes(':') || parts[1]?.toLowerCase().includes('am') || parts[1]?.toLowerCase().includes('pm')) {
              timeSlot = parts[1];
              subject = parts[2] || 'General';
              chapter = parts[3] || 'Chapter';
              topic = parts[4] || parts[3] || 'Study Focus';
              duration = parseInt(parts[5], 10) || 120;
              priority = (parts[6]?.toLowerCase() === 'low' || parts[6]?.toLowerCase() === 'medium') ? (parts[6] as any) : 'High';
              notes = parts[7] || '';
            } else {
              subject = parts[1] || 'General';
              chapter = parts[2] || 'Chapter';
              topic = parts[3] || 'Study Focus';
              duration = parseInt(parts[4], 10) || 120;
              priority = (parts[5]?.toLowerCase() === 'low' || parts[5]?.toLowerCase() === 'medium') ? (parts[5] as any) : 'High';
              notes = parts[6] || '';
            }

            items.push({
              id: `csv-${Date.now()}-${index}`,
              date: datePart,
              timeSlot,
              subjectName: subject,
              chapterName: chapter,
              topicName: topic,
              estimatedMinutes: isNaN(duration) ? 120 : duration,
              priority,
              notes
            });
            return;
          }
        }
      }

      // Handle Markdown / Natural Text pattern (e.g., "2026-08-17: Physics - Thermodynamics (120m)")
      const dateMatch = line.match(/(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}(?:, \d{4})?)/i);
      if (dateMatch) {
        const parsedD = parseDateString(dateMatch[1]);
        if (parsedD) {
          const restOfLine = line.replace(dateMatch[0], '').replace(/^[:\s\-|]+/, '').trim();
          const tokens = restOfLine.split(/[-:|–—]/).map(t => t.trim()).filter(Boolean);

          const subject = tokens[0] || 'General';
          const topic = tokens[1] || tokens[0] || 'Scheduled Topic';
          const chapter = tokens.length > 2 ? tokens[1] : 'Module';

          // Look for duration in text e.g. "120 mins" or "2h"
          let duration = 120;
          const minMatch = restOfLine.match(/(\d+)\s*(?:mins?|minutes?|m\b)/i);
          const hourMatch = restOfLine.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h\b)/i);
          if (minMatch) {
            duration = parseInt(minMatch[1], 10);
          } else if (hourMatch) {
            duration = Math.round(parseFloat(hourMatch[1]) * 60);
          }

          items.push({
            id: `txt-${Date.now()}-${index}`,
            date: parsedD,
            timeSlot: '09:00 - 11:00',
            subjectName: subject,
            chapterName: chapter,
            topicName: topic,
            estimatedMinutes: duration,
            priority: 'High',
            notes: restOfLine
          });
        }
      }
    });

    if (items.length === 0) {
      setParseError("Could not recognize dates or items in the input. Please use CSV, JSON, or format lines as 'YYYY-MM-DD: Subject - Topic (Duration)'.");
    } else {
      setParsedItems(items);
    }
  };

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
        handleParseInput(content);
      }
    };
    reader.readAsText(file);
  };

  // Summary Metrics of Parsed Multi-Period Data
  const summary = useMemo(() => {
    if (parsedItems.length === 0) return null;

    const uniqueDates = Array.from(new Set<string>(parsedItems.map(p => p.date))).sort();
    const totalMinutes = parsedItems.reduce((acc, i) => acc + (i.estimatedMinutes || 0), 0);
    const totalHours = Number((totalMinutes / 60).toFixed(1));
    const uniqueSubjects = Array.from(new Set<string>(parsedItems.map(p => p.subjectName)));

    const firstDate = uniqueDates[0];
    const lastDate = uniqueDates[uniqueDates.length - 1];

    // Compute span in weeks
    let weeksSpan = 1;
    if (firstDate && lastDate) {
      const d1 = new Date(firstDate);
      const d2 = new Date(lastDate);
      const diffDays = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24)));
      weeksSpan = Math.ceil(diffDays / 7);
    }

    return {
      totalItems: parsedItems.length,
      uniqueDaysCount: uniqueDates.length,
      totalHours,
      uniqueSubjectsCount: uniqueSubjects.length,
      firstDate,
      lastDate,
      weeksSpan
    };
  }, [parsedItems]);

  // Months available in parsed data for filter
  const monthsInParsedData = useMemo(() => {
    const monthSet = new Set<string>();
    parsedItems.forEach(item => {
      const m = item.date.substring(0, 7); // YYYY-MM
      if (m) monthSet.add(m);
    });
    return Array.from(monthSet).sort();
  }, [parsedItems]);

  const filteredParsedItems = useMemo(() => {
    if (filterMonth === 'all') return parsedItems;
    return parsedItems.filter(item => item.date.startsWith(filterMonth));
  }, [parsedItems, filterMonth]);

  // Remove single item from preview
  const handleRemoveItem = (id: string) => {
    setParsedItems(prev => prev.filter(item => item.id !== id));
  };

  // Commit and Import All Parsed Multi-Week/Month Plans
  const handleCommitImport = async () => {
    if (parsedItems.length === 0) return;
    setIsImporting(true);
    setImportSuccessMessage(null);

    try {
      // Group items by date
      const dateMap: { [date: string]: ParsedScheduleItem[] } = {};
      parsedItems.forEach(item => {
        if (!dateMap[item.date]) dateMap[item.date] = [];
        dateMap[item.date].push(item);
      });

      let plansCreatedCount = 0;

      // Create or merge StudyPlan for each date
      for (const [date, itemsForDate] of Object.entries(dateMap)) {
        const topics: StudyPlanTopic[] = itemsForDate.map((item, idx) => ({
          id: `topic-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          subjectName: item.subjectName,
          chapterName: item.chapterName,
          topicName: item.topicName,
          estimatedMinutes: item.estimatedMinutes,
          priority: item.priority,
          reason: item.notes || `Scheduled for ${item.timeSlot || 'study session'}.`,
          completed: false
        }));

        const totalHours = Number((itemsForDate.reduce((acc, i) => acc + i.estimatedMinutes, 0) / 60).toFixed(1));

        const planPayload: Omit<StudyPlan, 'id'> = {
          userId: userProfile?.uid || 'local-user',
          date,
          title: `Schedule for ${date} (${itemsForDate.map(i => i.subjectName).filter((v, i, a) => a.indexOf(v) === i).join(', ')})`,
          reasoning: `Imported multi-week study plan with ${itemsForDate.length} focus sessions.`,
          availableHours: totalHours,
          createdAt: new Date().toISOString(),
          topics
        };

        await onSavePlan(planPayload);
        plansCreatedCount++;
      }

      setImportSuccessMessage(`🎉 Successfully imported ${parsedItems.length} study sessions across ${plansCreatedCount} days into your Daily & Weekly Study Plans!`);
      setParsedItems([]);
      setRawText('');

      setTimeout(() => {
        if (setActiveTab) setActiveTab('planner');
      }, 2500);

    } catch (err: any) {
      setParseError(`Failed to save plans: ${err.message || 'Unknown error'}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Download CSV sample
  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_4_WEEK_SPRINT_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', '4_week_study_schedule_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-5">
      {/* Top Header Row with Expand Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E0DBD0] pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-[#6B705C]/10 border border-[#6B705C]/20 text-[#6B705C]">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-serif italic font-bold text-[#4A4E4D]">
                Multi-Week & Monthly Schedule Uploader
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#F2EFE9] text-[#6B705C] border border-[#E0DBD0]">
                Bulk Data Box
              </span>
            </div>
            <p className="text-xs text-[#A5A58D] mt-0.5">
              Upload or paste weeks to months of study timetables, syllabi dates, and focus slots in CSV, JSON, or text format.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#F9F7F2] hover:bg-[#F2EFE9] border border-[#E0DBD0] text-xs font-semibold text-[#4A4E4D] transition cursor-pointer"
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span>{isOpen ? 'Collapse Box' : 'Open Bulk Uploader'}</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      <AnimatePresence>
        {importSuccessMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between gap-3 shadow-xs"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{importSuccessMessage}</span>
            </div>
            <button
              onClick={() => setImportSuccessMessage(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsible Content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6 pt-2 overflow-hidden"
          >
            {/* Input Mode Selector Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F9F7F2] p-1.5 rounded-2xl border border-[#E0DBD0]">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveInputMode('paste')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    activeInputMode === 'paste'
                      ? 'bg-white text-[#4A4E4D] shadow-2xs'
                      : 'text-[#A5A58D] hover:text-[#4A4E4D]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Paste Text / Tables</span>
                </button>

                <button
                  onClick={() => setActiveInputMode('upload')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    activeInputMode === 'upload'
                      ? 'bg-white text-[#4A4E4D] shadow-2xs'
                      : 'text-[#A5A58D] hover:text-[#4A4E4D]'
                  }`}
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Upload File (.csv, .json, .txt)</span>
                </button>

                <button
                  onClick={() => setActiveInputMode('templates')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    activeInputMode === 'templates'
                      ? 'bg-white text-[#4A4E4D] shadow-2xs'
                      : 'text-[#A5A58D] hover:text-[#4A4E4D]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Ready Templates</span>
                </button>
              </div>

              <div className="flex items-center gap-2 px-2">
                <button
                  onClick={handleDownloadSample}
                  className="text-xs text-[#6B705C] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Sample CSV</span>
                </button>
              </div>
            </div>

            {/* Mode 1: Paste Text Data */}
            {activeInputMode === 'paste' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-[#A5A58D]">
                  <span>Paste multi-week schedule lines (CSV, JSON, or "YYYY-MM-DD: Subject - Topic (Time)")</span>
                  <button
                    onClick={() => {
                      setRawText(SAMPLE_4_WEEK_SPRINT_CSV);
                      handleParseInput(SAMPLE_4_WEEK_SPRINT_CSV);
                    }}
                    className="text-[#6B705C] hover:underline font-semibold cursor-pointer"
                  >
                    Insert 4-Week Sprint Sample
                  </button>
                </div>

                <textarea
                  value={rawText}
                  onChange={(e) => {
                    setRawText(e.target.value);
                    handleParseInput(e.target.value);
                  }}
                  rows={7}
                  placeholder="Paste your schedule here... Example:&#10;2026-08-17,09:00 - 11:00,Physics,Thermodynamics,Heat Engines,120,High&#10;2026-08-18,14:00 - 16:00,Chemistry,Organic,Reaction Mechanisms,120,High&#10;2026-08-19,09:00 - 11:30,Biology,Genetics,Punnett Squares,150,Medium"
                  className="w-full p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-xs font-mono text-[#4A4E4D] placeholder-[#A5A58D] focus:outline-none focus:border-[#6B705C] focus:bg-white transition"
                />
              </div>
            )}

            {/* Mode 2: File Upload */}
            {activeInputMode === 'upload' && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#E0DBD0] hover:border-[#6B705C] bg-[#F9F7F2] hover:bg-[#F2EFE9] rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3"
              >
                <div className="w-12 h-12 rounded-2xl bg-white border border-[#E0DBD0] flex items-center justify-center text-[#6B705C] shadow-2xs">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-bold text-[#4A4E4D]">
                    Click to browse or drag & drop schedule files
                  </div>
                  <div className="text-[11px] text-[#A5A58D]">
                    Supports .csv, .json, .tsv, .txt, or .md timetable exports
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.json,.txt,.tsv,.md"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            )}

            {/* Mode 3: Ready-Made Templates */}
            {activeInputMode === 'templates' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-[#6B705C]" />
                      <h4 className="text-xs font-bold text-[#4A4E4D]">4-Week Month Sprint Timetable (CSV)</h4>
                    </div>
                    <p className="text-[11px] text-[#A5A58D] mt-1">
                      17 structured study days across Physics, Chemistry, Biology, and Math with high-priority topics and 3 full mock exams.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setRawText(SAMPLE_4_WEEK_SPRINT_CSV);
                      handleParseInput(SAMPLE_4_WEEK_SPRINT_CSV);
                      setActiveInputMode('paste');
                    }}
                    className="w-full py-2 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-semibold transition cursor-pointer text-center"
                  >
                    Load 4-Week Sprint Plan
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#6B705C]" />
                      <h4 className="text-xs font-bold text-[#4A4E4D]">Structured Multi-Day JSON Format</h4>
                    </div>
                    <p className="text-[11px] text-[#A5A58D] mt-1">
                      Standardized array schema with date, subject, chapter, topic, time slots, and estimated minutes.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setRawText(SAMPLE_JSON_TEMPLATE);
                      handleParseInput(SAMPLE_JSON_TEMPLATE);
                      setActiveInputMode('paste');
                    }}
                    className="w-full py-2 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-semibold transition cursor-pointer text-center"
                  >
                    Load JSON Template
                  </button>
                </div>
              </div>
            )}

            {/* Error Message */}
            {parseError && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            {/* Parsed Summary & Visual Review Grid */}
            {summary && parsedItems.length > 0 && (
              <div className="space-y-4 pt-2 border-t border-[#E0DBD0]">
                {/* Summary Banner */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F2EFE9] p-4 rounded-2xl border border-[#E0DBD0]">
                  <div>
                    <div className="text-[10px] uppercase font-mono font-bold text-[#A5A58D]">Date Span</div>
                    <div className="text-xs font-bold text-[#4A4E4D] mt-0.5">
                      {summary.firstDate} → {summary.lastDate} ({summary.weeksSpan} wks)
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase font-mono font-bold text-[#A5A58D]">Scheduled Days</div>
                    <div className="text-xs font-bold text-[#6B705C] mt-0.5">
                      {summary.uniqueDaysCount} distinct study days
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase font-mono font-bold text-[#A5A58D]">Study Volume</div>
                    <div className="text-xs font-bold text-[#4A4E4D] mt-0.5">
                      {summary.totalHours} hrs ({summary.totalItems} sessions)
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase font-mono font-bold text-[#A5A58D]">Coverage</div>
                    <div className="text-xs font-bold text-[#6B705C] mt-0.5">
                      {summary.uniqueSubjectsCount} subjects planned
                    </div>
                  </div>
                </div>

                {/* Filter & Actions Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#4A4E4D] flex items-center gap-1">
                      <Filter className="w-3.5 h-3.5 text-[#6B705C]" /> Filter by Month:
                    </span>
                    <select
                      value={filterMonth}
                      onChange={(e) => setFilterMonth(e.target.value)}
                      className="px-3 py-1.5 rounded-xl bg-[#F9F7F2] border border-[#E0DBD0] text-xs font-medium text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
                    >
                      <option value="all">All Months ({parsedItems.length} items)</option>
                      {monthsInParsedData.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* Primary Commit Button */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setParsedItems([]);
                        setRawText('');
                      }}
                      className="px-3 py-2 rounded-xl bg-[#F2EFE9] text-[#A5A58D] hover:text-[#4A4E4D] text-xs font-semibold transition cursor-pointer"
                    >
                      Clear
                    </button>

                    <button
                      disabled={isImporting}
                      onClick={handleCommitImport}
                      className="flex items-center gap-2 px-5 py-2 rounded-2xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {isImporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>
                        {isImporting ? 'Saving Plans to Firestore...' : `Import ${summary.totalItems} Sessions Over ${summary.uniqueDaysCount} Days`}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Preview Table */}
                <div className="max-h-72 overflow-y-auto border border-[#E0DBD0] rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F2EFE9] text-[#A5A58D] font-mono text-[10px] uppercase sticky top-0 border-b border-[#E0DBD0]">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Time Slot</th>
                        <th className="p-3">Subject</th>
                        <th className="p-3">Topic / Chapter</th>
                        <th className="p-3">Duration</th>
                        <th className="p-3">Priority</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E0DBD0] bg-white">
                      {filteredParsedItems.map((item) => (
                        <tr key={item.id} className="hover:bg-[#F9F7F2] transition">
                          <td className="p-3 font-mono font-semibold text-[#4A4E4D] whitespace-nowrap">
                            {item.date}
                          </td>
                          <td className="p-3 font-mono text-[#A5A58D] whitespace-nowrap">
                            {item.timeSlot || '—'}
                          </td>
                          <td className="p-3 font-semibold text-[#6B705C] whitespace-nowrap">
                            {item.subjectName}
                          </td>
                          <td className="p-3 max-w-xs truncate text-[#4A4E4D]">
                            <div className="font-bold truncate">{item.topicName}</div>
                            {item.notes && <div className="text-[10px] text-[#A5A58D] truncate">{item.notes}</div>}
                          </td>
                          <td className="p-3 font-mono text-[#4A4E4D] whitespace-nowrap">
                            {item.estimatedMinutes} mins
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase ${
                              item.priority === 'High' 
                                ? 'bg-amber-100 text-amber-900 border border-amber-200' 
                                : 'bg-[#F2EFE9] text-[#4A4E4D] border border-[#E0DBD0]'
                            }`}>
                              {item.priority}
                            </span>
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1 rounded-lg text-[#A5A58D] hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
