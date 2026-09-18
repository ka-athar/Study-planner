import React, { useState } from 'react';
import { 
  Sparkles, 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  Download, 
  ArrowRight, 
  Layers, 
  BookOpen, 
  Award, 
  FileText, 
  Sliders, 
  ChevronDown, 
  ChevronUp, 
  RotateCcw,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Subject, 
  StudyPlan, 
  StudyPlanTopic, 
  UserProfile, 
  ExamDate 
} from '../types';
import { apiParseCalendarSchedule } from '../lib/aiApi';
import { downloadIcsFile } from '../lib/icsExport';

export interface ParsedScheduleItem {
  id: string;
  date: string; // YYYY-MM-DD
  dayLabel: string;
  timeSlot?: string;
  subjectName: string;
  chapterName?: string;
  topicName: string;
  estimatedMinutes: number;
  priority: 'High' | 'Medium' | 'Low';
  itemType: 'study_session' | 'exam' | 'revision' | 'class_lecture' | 'deadline';
  notes?: string;
  monthKey: string; // YYYY-MM
  weekLabel?: string;
  selected?: boolean;
}

export interface ParsedScheduleResult {
  scheduleName: string;
  analysisSummary: string;
  totalEstimatedHours?: number;
  monthsCovered: string[];
  scheduledItems: ParsedScheduleItem[];
}

interface AICalendarScheduleImporterProps {
  subjects: Subject[];
  userProfile: UserProfile | null;
  onSavePlan: (plan: StudyPlan) => void;
  onUpdateProfile?: (profile: UserProfile) => void;
  onDatesImported?: (dates: string[]) => void;
  initialOpen?: boolean;
}

const PRESET_TEMPLATES = [
  {
    title: 'Weekly Timetable',
    desc: 'Mon-Sun study & class routine',
    text: `Monday: 
- 09:00 - 11:00 Chemistry: Chemical Kinetics & Rate Laws (High Priority)
- 14:00 - 16:00 Physics: Wave Optics Problem Practice
- 19:00 - 20:00 Math: Formulas revision

Tuesday:
- 08:30 - 10:30 Math: Integration by Substitution (High Priority)
- 15:00 - 17:00 Biology: Cellular Respiration Diagrams
- 20:00 - 21:00 Chemistry: Periodic Trends Quiz

Wednesday:
- 09:00 - 12:00 Physics: Thermodynamics First Law & Cycles
- 16:00 - 18:00 Full Midterm Review Session

Thursday:
- 10:00 - 12:00 Chemistry: Organic Reaction Mechanisms
- 14:00 - 16:00 Math: Differential Equations Practice

Friday:
- 09:00 - 11:30 Biology: Genetics & Inheritance
- 15:00 - 17:00 Physics: Past Exam Questions Drill

Saturday:
- 10:00 - 13:00 Mock Exam: Full Physics & Chemistry Paper
- 15:00 - 17:00 Test Mistake Analysis & Weak Topic Review

Sunday:
- 11:00 - 13:00 Weekly Flashcard Review & Next Week Planning`
  },
  {
    title: '1-Month Exam Sprint',
    desc: 'August-September multi-week targets',
    text: `Month 1 Study Sprint (August 17 to September 15):
Week 1 (Aug 17 - Aug 23):
- Aug 17: Physics - Thermodynamics & Heat Engines (120 mins)
- Aug 18: Chemistry - Equilibrium & Le Chatelier (90 mins)
- Aug 19: Math - Definite Integrals (120 mins)
- Aug 21: Biology - Human Physiology Nervous System (90 mins)
- Aug 23: Weekly Cumulative Mock Test 1 (180 mins)

Week 2 (Aug 24 - Aug 30):
- Aug 24: Chemistry - Organic Reaction Mechanisms (120 mins)
- Aug 25: Physics - Electromagnetism Gauss Law (90 mins)
- Aug 27: Math - Matrices & Determinants (120 mins)
- Aug 29: Biology - Plant Anatomy & Transport (90 mins)
- Aug 30: Practice Exam on Weeks 1 & 2 (180 mins)

Week 3 (Aug 31 - Sep 06):
- Aug 31: Physics - Current Electricity & Circuits (120 mins)
- Sep 02: Chemistry - Electrochemistry Nernst Equation (120 mins)
- Sep 04: Math - Probability & Combinatorics (90 mins)
- Sep 06: Biology - Cell Division & Mitosis (90 mins)

Week 4 (Sep 07 - Sep 14):
- Sep 08: Full Syllabus Revision All Subjects (180 mins)
- Sep 10: Final Mock Test Series (240 mins)
- Sep 14: FINAL SEMESTER EXAM (Physics & Chemistry)`
  },
  {
    title: 'Daily Class & Study Schedule',
    desc: 'Classes with allocated evening review',
    text: `College Timetable:
- Monday: 9am-12pm Chemistry Lecture, 2-4pm Math Class -> Study 6-8pm: Organic Synthesis Problems
- Tuesday: 10am-1pm Physics Lab -> Study 4-6pm: Lab Report & Error Analysis, 7-9pm: Mechanics Drills
- Wednesday: 8am-11am Biology Class -> Study 2-4pm: Genetics Problem Set
- Thursday: 9am-1pm Mathematics Seminar -> Study 5-7pm: Calculus Exercises
- Friday: 10am-12pm Physics Lecture -> Study 3-6pm: Chapter Summary & Flashcards
- Saturday: 9am-12pm Weekly Exam Review & Test Prep`
  }
];

export const AICalendarScheduleImporter: React.FC<AICalendarScheduleImporterProps> = ({
  subjects,
  userProfile,
  onSavePlan,
  onUpdateProfile,
  onDatesImported,
  initialOpen = false
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(initialOpen);
  const [inputText, setInputText] = useState<string>('');
  const [targetHorizon, setTargetHorizon] = useState<'auto' | 'week' | 'month' | 'multi_month'>('auto');
  
  // AI analysis status
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<ParsedScheduleResult | null>(null);
  
  // Active month filter in results
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all');
  
  // Save success state
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleAnalyze = async () => {
    if (!inputText.trim()) {
      setAnalysisError('Please paste or type your schedule text before analyzing.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setSuccessMessage(null);

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await apiParseCalendarSchedule({
        text: inputText,
        referenceDate: todayStr,
        knownSubjects: subjects.map(s => s.name),
        targetHorizon
      });

      if (!res.success || !res.schedule) {
        throw new Error(res.error || 'Failed to parse calendar schedule.');
      }

      const scheduleData: ParsedScheduleResult = res.schedule;
      // Attach IDs and default selected = true
      const itemsWithIds: ParsedScheduleItem[] = (scheduleData.scheduledItems || []).map((item, idx) => ({
        ...item,
        id: `item-${Date.now()}-${idx}`,
        selected: true,
        monthKey: item.monthKey || (item.date ? item.date.slice(0, 7) : todayStr.slice(0, 7))
      }));

      const finalResult: ParsedScheduleResult = {
        ...scheduleData,
        scheduledItems: itemsWithIds,
        monthsCovered: scheduleData.monthsCovered?.length 
          ? scheduleData.monthsCovered 
          : Array.from(new Set(itemsWithIds.map(i => i.monthKey))).filter(Boolean)
      };

      setAnalysisResult(finalResult);
      setSelectedMonthFilter('all');
    } catch (err: any) {
      console.error('Error analyzing calendar schedule:', err);
      setAnalysisError(err?.message || 'Could not analyze schedule. Please check your text or try a simpler format.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleToggleItem = (id: string) => {
    if (!analysisResult) return;
    setAnalysisResult({
      ...analysisResult,
      scheduledItems: analysisResult.scheduledItems.map(item => 
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    });
  };

  const handleToggleAll = (select: boolean) => {
    if (!analysisResult) return;
    setAnalysisResult({
      ...analysisResult,
      scheduledItems: analysisResult.scheduledItems.map(item => ({
        ...item,
        selected: select
      }))
    });
  };

  const handleDeleteItem = (id: string) => {
    if (!analysisResult) return;
    setAnalysisResult({
      ...analysisResult,
      scheduledItems: analysisResult.scheduledItems.filter(item => item.id !== id)
    });
  };

  const handleApplyToCalendar = async () => {
    if (!analysisResult) return;
    
    const selectedItems = analysisResult.scheduledItems.filter(i => i.selected);
    if (selectedItems.length === 0) {
      setAnalysisError('Please select at least one item to add to your calendar schedule.');
      return;
    }

    setIsSaving(true);
    setAnalysisError(null);

    try {
      // 1. Group items by date (YYYY-MM-DD)
      const dateMap: { [dateStr: string]: ParsedScheduleItem[] } = {};
      const newExams: ExamDate[] = [];

      selectedItems.forEach(item => {
        if (!item.date) return;
        if (!dateMap[item.date]) {
          dateMap[item.date] = [];
        }
        dateMap[item.date].push(item);

        // If it's an exam, also prepare an exam entry
        if (item.itemType === 'exam') {
          newExams.push({
            id: `exam-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            subjectName: item.subjectName,
            examName: item.topicName || `${item.subjectName} Exam`,
            date: item.date
          });
        }
      });

      // 2. Save each date as a StudyPlan
      const affectedDates: string[] = Object.keys(dateMap);

      affectedDates.forEach(dateStr => {
        const itemsForDate = dateMap[dateStr];
        const planTopics: StudyPlanTopic[] = itemsForDate.map((item, idx) => ({
          id: `plan-topic-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
          subjectName: item.subjectName || 'General Study',
          chapterName: item.chapterName || 'Scheduled Module',
          topicName: item.topicName || item.subjectName,
          estimatedMinutes: item.estimatedMinutes || 60,
          priority: item.priority || 'Medium',
          reason: item.notes || (item.timeSlot ? `Scheduled for ${item.timeSlot}` : 'AI Calendar Preset'),
          completed: false
        }));

        const totalMins = planTopics.reduce((acc, t) => acc + t.estimatedMinutes, 0);

        const newPlan: StudyPlan = {
          id: `plan-${dateStr}-${Date.now()}`,
          userId: userProfile?.uid || 'guest',
          date: dateStr,
          title: itemsForDate.length === 1 
            ? `${itemsForDate[0].subjectName}: ${itemsForDate[0].topicName}`
            : `${itemsForDate.length} Focus Sessions (${itemsForDate[0].subjectName})`,
          topics: planTopics,
          reasoning: `AI Scheduled on ${dateStr}. Total ~${Math.round(totalMins / 60 * 10) / 10} hours allocated.`,
          availableHours: Math.round(totalMins / 60 * 10) / 10,
          createdAt: new Date().toISOString()
        };

        onSavePlan(newPlan);
      });

      // 3. If exams detected and onUpdateProfile provided, update profile
      if (newExams.length > 0 && onUpdateProfile && userProfile) {
        const existingExams = userProfile.examDates || [];
        const mergedExams = [...existingExams];
        newExams.forEach(ne => {
          if (!mergedExams.some(e => e.date === ne.date && e.subjectName === ne.subjectName)) {
            mergedExams.push(ne);
          }
        });
        onUpdateProfile({
          ...userProfile,
          examDates: mergedExams
        });
      }

      if (onDatesImported) {
        onDatesImported(affectedDates);
      }

      setSuccessMessage(`Successfully preset ${selectedItems.length} study event(s) across ${affectedDates.length} day(s) into your calendar!`);
      setTimeout(() => {
        setSuccessMessage(null);
      }, 7000);
    } catch (err: any) {
      console.error('Error applying schedule to calendar:', err);
      setAnalysisError(err?.message || 'Failed to save preset schedule.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportIcs = () => {
    if (!analysisResult) return;
    const selectedItems = analysisResult.scheduledItems.filter(i => i.selected);
    if (selectedItems.length === 0) return;

    let icsEvents = '';
    const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    selectedItems.forEach((item, idx) => {
      const dtStart = item.date.replace(/-/g, '') + 'T090000';
      const durationHours = Math.floor(item.estimatedMinutes / 60);
      const durationMinutes = item.estimatedMinutes % 60;
      const endHour = String(9 + durationHours).padStart(2, '0');
      const endMin = String(durationMinutes).padStart(2, '0');
      const dtEnd = item.date.replace(/-/g, '') + `T${endHour}${endMin}00`;

      icsEvents += `BEGIN:VEVENT\r\n`;
      icsEvents += `UID:studyflow-ai-preset-${item.id}-${idx}@studyflow.app\r\n`;
      icsEvents += `DTSTAMP:${nowStamp}\r\n`;
      icsEvents += `DTSTART:${dtStart}\r\n`;
      icsEvents += `DTEND:${dtEnd}\r\n`;
      icsEvents += `SUMMARY:[StudyFlow] ${item.subjectName}: ${item.topicName}\r\n`;
      icsEvents += `DESCRIPTION:Subject: ${item.subjectName}\\nChapter: ${item.chapterName || 'N/A'}\\nPriority: ${item.priority}\\nTime: ${item.timeSlot || 'Allocated'}\\nNotes: ${item.notes || 'AI Generated Schedule'}\r\n`;
      icsEvents += `STATUS:CONFIRMED\r\n`;
      icsEvents += `END:VEVENT\r\n`;
    });

    const icsContent = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//StudyFlow AI Calendar//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:${analysisResult.scheduleName || 'AI Study Schedule'}\r\n${icsEvents}END:VCALENDAR\r\n`;
    downloadIcsFile(icsContent, `ai_study_schedule_${new Date().toISOString().split('T')[0]}.ics`);
  };

  // Filter items for display based on selected month
  const filteredItems = (analysisResult?.scheduledItems || []).filter(item => {
    if (selectedMonthFilter === 'all') return true;
    return item.monthKey === selectedMonthFilter;
  });

  return (
    <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-5 transition-all">
      {/* Box Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E0DBD0] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#6B705C]/15 text-[#6B705C] flex items-center justify-center font-bold shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-serif italic font-bold text-[#6B705C] flex items-center gap-2">
              <span>AI Calendar & Schedule Parser</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#6B705C]/15 text-[#6B705C] tracking-wide uppercase">
                Weekly & Monthly Preset
              </span>
            </h3>
            <p className="text-xs text-[#A5A58D]">
              Paste your timetable, syllabus date sheet, or natural language schedule to let AI analyze and preset it into your calendar.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="px-3.5 py-1.5 rounded-xl border border-[#E0DBD0] text-xs font-medium text-[#4A4E4D] hover:bg-[#F9F7F2] flex items-center gap-1.5 transition"
          >
            <span>{isOpen ? 'Collapse Box' : 'Open Paste Box'}</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Collapsible Content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-5 overflow-hidden"
          >
            {/* Template Presets Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#6B705C] uppercase tracking-wider flex items-center gap-1">
                  <Zap className="w-3 h-3 text-[#6B705C]" /> Quick Templates & Examples:
                </span>
                <span className="text-[10px] text-[#A5A58D]">Click any preset to fill the paste box</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {PRESET_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setInputText(tmpl.text);
                      setAnalysisResult(null);
                      setAnalysisError(null);
                    }}
                    className="p-2.5 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] hover:border-[#6B705C] hover:bg-[#F2EFE9] text-left transition space-y-0.5 group"
                  >
                    <div className="text-xs font-bold text-[#4A4E4D] group-hover:text-[#6B705C] flex items-center justify-between">
                      <span>{tmpl.title}</span>
                      <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition text-[#6B705C]" />
                    </div>
                    <div className="text-[10px] text-[#A5A58D] line-clamp-1">{tmpl.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Input Box and Horizon Controls */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-bold text-[#4A4E4D] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#6B705C]" />
                  <span>Paste Calendar Text / Timetable / Date Sheet for Week or Month:</span>
                </label>

                {/* Horizon Scope Toggle */}
                <div className="flex items-center gap-1 bg-[#F9F7F2] p-1 rounded-xl border border-[#E0DBD0] text-[11px]">
                  <span className="text-[#A5A58D] px-2 font-medium">Scope:</span>
                  {(['auto', 'week', 'month', 'multi_month'] as const).map(scope => (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => setTargetHorizon(scope)}
                      className={`px-2.5 py-1 rounded-lg font-medium transition ${
                        targetHorizon === scope
                          ? 'bg-[#6B705C] text-white shadow-2xs'
                          : 'text-[#4A4E4D] hover:bg-[#E0DBD0]/40'
                      }`}
                    >
                      {scope === 'auto' ? 'Auto' : scope === 'week' ? 'Week' : scope === 'month' ? 'Month' : 'Multi-Month'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Paste Box Textarea */}
              <div className="relative">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Paste your calendar schedule here...\n\nExample:\nMonday Aug 17: 09:00 - 11:00 Chemistry Organic Reaction Mechanisms (High Priority)\nTuesday Aug 18: 14:00 - 16:30 Physics Thermodynamics Heat Engines\nAug 25: Physics Final Mock Exam 10am...\n\nOr paste your college lecture schedule, syllabus timeline, or monthly targets.`}
                  rows={8}
                  className="w-full p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] focus:border-[#6B705C] focus:bg-white text-xs font-mono text-[#4A4E4D] placeholder-[#A5A58D] focus:outline-none transition leading-relaxed resize-y"
                />
                
                {inputText && (
                  <button
                    type="button"
                    onClick={() => {
                      setInputText('');
                      setAnalysisResult(null);
                      setAnalysisError(null);
                    }}
                    className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/80 hover:bg-white text-[#A5A58D] hover:text-rose-600 border border-[#E0DBD0] transition shadow-2xs text-[10px] flex items-center gap-1"
                    title="Clear text"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="text-[11px] text-[#A5A58D]">
                  {inputText ? `${inputText.length} characters entered` : 'Paste any date or text format — Gemini AI recognizes dates, times & subjects.'}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || !inputText.trim()}
                    className="px-5 py-2.5 rounded-full bg-[#6B705C] hover:bg-[#5a5f4e] disabled:opacity-50 text-white font-medium text-xs transition flex items-center gap-2 shadow-xs"
                  >
                    {isAnalyzing ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>AI Analyzing Schedule...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>⚡ AI Analyze & Structure Calendar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Error Banner */}
            {analysisError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{analysisError}</span>
              </div>
            )}

            {/* Success Banner */}
            {successMessage && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2 animate-fade-in shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* AI Analysis Result & Preset Staging Area */}
            {analysisResult && (
              <div className="space-y-4 pt-4 border-t border-[#E0DBD0] animate-fade-in">
                {/* Result Overview Header */}
                <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-serif italic font-bold text-[#6B705C]">
                        {analysisResult.scheduleName || 'Analyzed Academic Calendar'}
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {analysisResult.scheduledItems.length} Events Detected
                      </span>
                    </div>
                    <p className="text-xs text-[#4A4E4D]">
                      {analysisResult.analysisSummary}
                    </p>
                  </div>

                  {analysisResult.totalEstimatedHours && (
                    <div className="text-right shrink-0 bg-white px-3 py-2 rounded-xl border border-[#E0DBD0]">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-[#A5A58D]">Allocated Study Time</div>
                      <div className="text-sm font-mono font-bold text-[#6B705C]">
                        ~{analysisResult.totalEstimatedHours} Hours
                      </div>
                    </div>
                  )}
                </div>

                {/* Controls Bar: Month filter & Selection */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Month Tabs */}
                  {analysisResult.monthsCovered.length > 1 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      <span className="text-[11px] font-bold text-[#6B705C] uppercase tracking-wider">Filter Month:</span>
                      <button
                        type="button"
                        onClick={() => setSelectedMonthFilter('all')}
                        className={`px-3 py-1 rounded-xl text-xs font-medium transition ${
                          selectedMonthFilter === 'all'
                            ? 'bg-[#6B705C] text-white shadow-2xs'
                            : 'bg-[#F9F7F2] border border-[#E0DBD0] text-[#4A4E4D] hover:bg-[#F2EFE9]'
                        }`}
                      >
                        All ({analysisResult.scheduledItems.length})
                      </button>
                      {analysisResult.monthsCovered.map(mKey => {
                        const count = analysisResult.scheduledItems.filter(i => i.monthKey === mKey).length;
                        const [yr, mo] = mKey.split('-');
                        const monthLabel = new Date(parseInt(yr), parseInt(mo) - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
                        return (
                          <button
                            key={mKey}
                            type="button"
                            onClick={() => setSelectedMonthFilter(mKey)}
                            className={`px-3 py-1 rounded-xl text-xs font-medium transition ${
                              selectedMonthFilter === mKey
                                ? 'bg-[#6B705C] text-white shadow-2xs'
                                : 'bg-[#F9F7F2] border border-[#E0DBD0] text-[#4A4E4D] hover:bg-[#F2EFE9]'
                            }`}
                          >
                            {monthLabel} ({count})
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Selection toggles */}
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => handleToggleAll(true)}
                      className="text-[#6B705C] hover:underline font-medium"
                    >
                      Select All
                    </button>
                    <span className="text-[#E0DBD0]">|</span>
                    <button
                      type="button"
                      onClick={() => handleToggleAll(false)}
                      className="text-[#A5A58D] hover:text-[#4A4E4D] font-medium"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                {/* Staged Items List */}
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        item.selected
                          ? 'bg-[#F9F7F2] border-[#6B705C]/60 shadow-2xs'
                          : 'bg-white border-[#E0DBD0] opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={!!item.selected}
                          onChange={() => handleToggleItem(item.id)}
                          className="mt-1 w-4 h-4 text-[#6B705C] rounded-md border-[#E0DBD0] focus:ring-[#6B705C] cursor-pointer"
                        />
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold font-mono text-[#6B705C] bg-[#6B705C]/10 px-2 py-0.5 rounded-md">
                              {item.date} {item.dayLabel ? `(${item.dayLabel})` : ''}
                            </span>

                            {item.timeSlot && (
                              <span className="text-[11px] font-mono text-[#4A4E4D] bg-white border border-[#E0DBD0] px-2 py-0.5 rounded-md flex items-center gap-1">
                                <Clock className="w-3 h-3 text-[#A5A58D]" />
                                <span>{item.timeSlot}</span>
                              </span>
                            )}

                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              item.itemType === 'exam'
                                ? 'bg-rose-100 text-rose-800'
                                : item.itemType === 'revision'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-[#6B705C]/15 text-[#6B705C]'
                            }`}>
                              {item.itemType === 'exam' ? 'Target Exam' : item.itemType === 'revision' ? 'Revision' : 'Study Session'}
                            </span>

                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                              item.priority === 'High' 
                                ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                                : 'bg-stone-100 text-stone-600'
                            }`}>
                              {item.priority} Priority
                            </span>
                          </div>

                          <div className="text-xs font-bold text-[#4A4E4D]">
                            <span className="text-[#6B705C]">{item.subjectName}: </span>
                            <span>{item.topicName}</span>
                            {item.chapterName && (
                              <span className="text-[#A5A58D] font-normal"> ({item.chapterName})</span>
                            )}
                          </div>

                          {item.notes && (
                            <p className="text-[11px] text-[#A5A58D] italic">
                              Note: {item.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E0DBD0]/60">
                        <span className="text-xs font-mono font-bold text-[#6B705C]">
                          ~{item.estimatedMinutes} mins
                        </span>

                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1 text-[#A5A58D] hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#E0DBD0]">
                  <div className="text-xs text-[#4A4E4D]">
                    <strong>{analysisResult.scheduledItems.filter(i => i.selected).length}</strong> of {analysisResult.scheduledItems.length} events selected to be preset
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportIcs}
                      className="px-4 py-2 rounded-full bg-[#F9F7F2] hover:bg-[#F2EFE9] border border-[#E0DBD0] text-[#4A4E4D] font-medium text-xs transition flex items-center gap-1.5 shadow-xs"
                      title="Download as .ics file for Google Calendar"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export .ICS</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleApplyToCalendar}
                      disabled={isSaving || analysisResult.scheduledItems.filter(i => i.selected).length === 0}
                      className="px-5 py-2 rounded-full bg-[#6B705C] hover:bg-[#5a5f4e] disabled:opacity-50 text-white font-medium text-xs transition flex items-center gap-2 shadow-xs"
                    >
                      {isSaving ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>Presetting Schedule...</span>
                        </>
                      ) : (
                        <>
                          <CalendarIcon className="w-3.5 h-3.5" />
                          <span>📅 Add & Preset to Calendar Schedule</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
