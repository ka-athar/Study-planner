import React, { useState } from 'react';
import { 
  Calendar, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  ArrowRight, 
  Layers, 
  Trash2, 
  Plus, 
  BookOpen, 
  RefreshCw, 
  FileText, 
  Check, 
  Copy, 
  HelpCircle, 
  AlertCircle,
  Zap,
  CalendarDays
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Subject, StudyPlan, ActiveTab, UserProfile } from '../types';
import { apiParseCalendarSchedule } from '../lib/aiApi';

interface ParsedTaskItem {
  id: string;
  date: string; // YYYY-MM-DD
  dayLabel?: string;
  timeSlot?: string;
  subjectName: string;
  chapterName: string;
  topicName: string;
  estimatedMinutes: number;
  priority: 'High' | 'Medium' | 'Low';
  notes?: string;
}

interface AIScheduleImportCardProps {
  subjects: Subject[];
  userProfile?: UserProfile | null;
  onSavePlan: (plan: Omit<StudyPlan, 'id'>) => Promise<void> | void;
  setActiveTab?: (tab: ActiveTab) => void;
  onPlanImported?: () => void;
}

const PRESET_SCHEDULES = [
  {
    name: 'Weekly College Timetable',
    desc: '5-Day balanced morning & evening study rhythm',
    text: `Monday:
- 09:00 AM - 11:00 AM: Physics Mechanics (Newton's Laws & Friction)
- 03:00 PM - 05:00 PM: Chemistry Chemical Bonding (Hybridization & VSEPR)

Tuesday:
- 10:00 AM - 12:00 PM: Mathematics Calculus (Derivatives & Chain Rule)
- 04:00 PM - 05:30 PM: Biology Genetics (Mendelian Inheritance)

Wednesday:
- 09:00 AM - 11:30 AM: Physics Thermodynamics (First Law & Heat Engines)
- 02:00 PM - 04:00 PM: Chemistry Organic Reactions (Nucleophilic Substitution)

Thursday:
- 10:00 AM - 12:30 PM: Mathematics Linear Algebra (Matrices & Determinants)
- 04:00 PM - 06:00 PM: Biology Cell Biology (Mitosis and Meiosis)

Friday:
- 09:00 AM - 12:00 PM: Comprehensive Mock Test & Timed Practice
- 03:00 PM - 04:30 PM: Mistakes Analysis & Weak Topics Review`
  },
  {
    name: '7-Day Exam Revision Sprint',
    desc: 'Intensive high-yield coverage before upcoming exams',
    text: `Day 1 (Monday):
08:30 - 11:00 AM: Mathematics - Integral Calculus (Integration by Parts & Substitution)
02:00 - 04:30 PM: Physics - Electromagnetism (Coulomb's Law & Gauss's Law)

Day 2 (Tuesday):
09:00 - 11:30 AM: Chemistry - Physical Chemistry (Chemical Kinetics & Rate Laws)
03:00 - 05:00 PM: Biology - Human Physiology (Cardiovascular & Respiratory Systems)

Day 3 (Wednesday):
08:30 - 11:30 AM: Physics - Optics (Ray Optics, Lenses & Wave Interference)
02:00 - 04:00 PM: Chemistry - Organic Chemistry (Aldehydes, Ketones & Mechanisms)

Day 4 (Thursday):
09:00 - 12:00 PM: Mathematics - Differential Equations & Vector Calculus
03:00 - 05:30 PM: Biology - Ecology & Genetics Review

Day 5 (Friday):
09:00 AM - 12:30 PM: Full Length Timed Diagnostic Exam Mock #1
03:00 - 05:00 PM: Diagnostic Mistakes Breakdown & Concept Patching

Day 6 (Saturday):
10:00 AM - 01:00 PM: High-Yield Formula Memorization & Fast Problem Drills
03:00 - 05:00 PM: Biology & Chemistry Rapid Flashcard Review

Day 7 (Sunday):
09:00 AM - 11:30 AM: Final Light Review & Key Formulas Sheet
02:00 - 03:30 PM: Mental Prep & Exam Strategy Checklist`
  },
  {
    name: 'Evening Study Routine (3 Hours/Day)',
    desc: 'Structured evening slots for school or working students',
    text: `Monday Evening:
06:30 PM - 08:00 PM: Physics - Kinematics & Motion in 2D
08:30 PM - 09:30 PM: Mathematics - Trigonometric Identities practice

Tuesday Evening:
06:30 PM - 08:00 PM: Chemistry - Periodic Table & Periodic Trends
08:30 PM - 09:30 PM: Biology - Cell Structure & Organelles

Wednesday Evening:
06:30 PM - 08:00 PM: Mathematics - Quadratic Equations & Polynomials
08:30 PM - 09:30 PM: Physics - Work, Energy and Power

Thursday Evening:
06:30 PM - 08:00 PM: Chemistry - Thermodynamics & Hess's Law
08:30 PM - 09:30 PM: Biology - Biomolecules (Proteins & Enzymes)

Friday Evening:
06:30 PM - 08:30 PM: Weekly Problem Solving Sprint & Quizzes
08:45 PM - 09:30 PM: Weekend Prep & Schedule Planning`
  }
];

export const AIScheduleImportCard: React.FC<AIScheduleImportCardProps> = ({
  subjects,
  userProfile,
  onSavePlan,
  setActiveTab,
  onPlanImported
}) => {
  const [scheduleText, setScheduleText] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisSummary, setAnalysisSummary] = useState<string | null>(null);
  const [parsedTasks, setParsedTasks] = useState<ParsedTaskItem[]>([]);
  const [assignedCount, setAssignedCount] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Handle AI analysis
  const handleAnalyzeSchedule = async () => {
    if (!scheduleText.trim()) {
      setError('Please paste your calendar or schedule text first.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisSummary(null);
    setAssignedCount(null);

    try {
      const response = await apiParseCalendarSchedule({
        pastedScheduleText: scheduleText,
        syllabus: subjects,
        startDate: startDate,
        targetExam: userProfile?.examDates?.[0]?.examName || 'Academic Exam Prep'
      });

      if (response.success && response.data) {
        const rawTasks = response.data.tasks || [];
        const formatted: ParsedTaskItem[] = rawTasks.map((t: any, idx: number) => ({
          id: `task-parsed-${Date.now()}-${idx}`,
          date: t.date || startDate,
          dayLabel: t.dayLabel || t.date,
          timeSlot: t.timeSlot || '09:00 - 10:30',
          subjectName: t.subjectName || 'General',
          chapterName: t.chapterName || '',
          topicName: t.topicName || 'Scheduled Topic',
          estimatedMinutes: Number(t.estimatedMinutes) || 60,
          priority: t.priority || 'Medium',
          notes: t.notes || ''
        }));

        setParsedTasks(formatted);
        setAnalysisSummary(response.data.analysisSummary || `Successfully extracted ${formatted.length} study tasks.`);
      } else {
        setError('Could not extract schedule tasks. Please check your text format.');
      }
    } catch (err: any) {
      console.error('Failed to parse calendar schedule:', err);
      setError(err.message || 'Error parsing schedule text with AI. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Remove individual task
  const handleRemoveTask = (taskId: string) => {
    setParsedTasks(prev => prev.filter(t => t.id !== taskId));
  };

  // Update task field
  const handleUpdateTask = (taskId: string, field: keyof ParsedTaskItem, value: any) => {
    setParsedTasks(prev => prev.map(t => t.id === taskId ? { ...t, [field]: value } : t));
  };

  // Add new empty task row
  const handleAddManualTask = () => {
    const defaultSubject = subjects[0]?.name || 'Physics';
    const defaultChapter = subjects[0]?.chapters?.[0]?.name || 'Chapter 1';
    const defaultTopic = subjects[0]?.chapters?.[0]?.topics?.[0]?.name || 'Introduction';

    const newTask: ParsedTaskItem = {
      id: `task-manual-${Date.now()}`,
      date: startDate,
      dayLabel: 'Scheduled Day',
      timeSlot: '16:00 - 17:30',
      subjectName: defaultSubject,
      chapterName: defaultChapter,
      topicName: defaultTopic,
      estimatedMinutes: 90,
      priority: 'Medium',
      notes: 'Manually added slot'
    };

    setParsedTasks(prev => [...prev, newTask]);
  };

  // Group tasks by date and save them to the StudyPlan repository
  const handleAssignToCalendar = async () => {
    if (parsedTasks.length === 0) return;

    setIsSaving(true);
    setError(null);

    try {
      // Group tasks by date (YYYY-MM-DD)
      const tasksByDate: { [date: string]: ParsedTaskItem[] } = {};
      parsedTasks.forEach(t => {
        const d = t.date || startDate;
        if (!tasksByDate[d]) tasksByDate[d] = [];
        tasksByDate[d].push(t);
      });

      let totalAssigned = 0;

      for (const [dateStr, dateTasks] of Object.entries(tasksByDate)) {
        const totalMins = dateTasks.reduce((acc, t) => acc + t.estimatedMinutes, 0);
        const totalHours = Number((totalMins / 60).toFixed(1));

        const planTitle = `Imported Schedule (${dateTasks[0]?.dayLabel || dateStr})`;

        const planObj: Omit<StudyPlan, 'id'> = {
          userId: '',
          date: dateStr,
          title: planTitle,
          topics: dateTasks.map((t, idx) => ({
            id: `plan-tp-${Date.now()}-${idx}`,
            subjectName: t.subjectName,
            chapterName: t.chapterName,
            topicName: t.topicName,
            estimatedMinutes: t.estimatedMinutes,
            priority: t.priority,
            reason: t.notes || `Scheduled at ${t.timeSlot || 'allocated slot'}`,
            completed: false
          })),
          reasoning: `Imported from pasted schedule. Total allocated: ${totalHours}h across ${dateTasks.length} study session(s).`,
          availableHours: totalHours,
          createdAt: new Date().toISOString()
        };

        await onSavePlan(planObj);
        totalAssigned += dateTasks.length;
      }

      setAssignedCount(totalAssigned);
      if (onPlanImported) onPlanImported();
    } catch (err: any) {
      console.error('Failed to save imported study plan:', err);
      setError('Failed to assign study tasks to planner calendar. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-6 animate-fade-in text-[#4A4E4D]">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E0DBD0] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#6B705C]/15 text-[#6B705C] flex items-center justify-center font-bold shadow-xs">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-serif italic font-bold text-[#6B705C]">
                AI Schedule & Calendar Import
              </h3>
              <span className="text-[10px] font-sans font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#6B705C]/10 text-[#6B705C] border border-[#6B705C]/20">
                Gemini Powered
              </span>
            </div>
            <p className="text-xs text-[#A5A58D] mt-0.5">
              Paste your weekly class timetable, Google/Apple calendar events, or study agenda. AI will analyze dates and map topics directly to your planner calendar.
            </p>
          </div>
        </div>

        {/* Reference Start Date */}
        <div className="flex items-center gap-2 bg-[#F9F7F2] p-2 rounded-2xl border border-[#E0DBD0] shrink-0">
          <Calendar className="w-3.5 h-3.5 text-[#6B705C]" />
          <span className="text-[11px] font-bold text-[#6B705C] whitespace-nowrap">Start Date:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-xs font-mono font-bold bg-white border border-[#E0DBD0] rounded-xl px-2 py-1 text-[#4A4E4D] focus:outline-hidden focus:ring-1 focus:ring-[#6B705C]"
          />
        </div>
      </div>

      {/* Preset Quick Load Templates */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold text-[#A5A58D] uppercase tracking-wider block">
          Quick Preset Schedule Templates:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {PRESET_SCHEDULES.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setScheduleText(preset.text);
                setParsedTasks([]);
                setAnalysisSummary(null);
                setAssignedCount(null);
              }}
              className="p-3 rounded-2xl bg-[#F9F7F2] hover:bg-[#F2EFE9] border border-[#E0DBD0] text-left transition flex flex-col justify-between group active:scale-98"
            >
              <div>
                <div className="text-xs font-bold text-[#4A4E4D] group-hover:text-[#6B705C] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#6B705C]" />
                  <span>{preset.name}</span>
                </div>
                <p className="text-[10px] text-[#A5A58D] mt-0.5 line-clamp-1">{preset.desc}</p>
              </div>
              <span className="text-[9px] font-bold text-[#6B705C] mt-2 inline-flex items-center gap-1">
                Load Preset <ArrowRight className="w-2.5 h-2.5" />
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Text Area for Pasting Schedule */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-[#6B705C] uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Paste Calendar / Weekly Schedule Text:</span>
          </label>
          {scheduleText && (
            <button
              onClick={() => setScheduleText('')}
              className="text-[10px] text-[#A5A58D] hover:text-rose-600 font-semibold"
            >
              Clear Text
            </button>
          )}
        </div>

        <div className="relative">
          <textarea
            value={scheduleText}
            onChange={(e) => setScheduleText(e.target.value)}
            rows={7}
            placeholder={`Paste your timetable or calendar schedule here...\n\nExample:\nMonday:\n- 09:00 AM - 11:00 AM: Physics Mechanics (Newton's Laws & Friction)\n- 03:00 PM - 05:00 PM: Chemistry Chemical Bonding\n\nTuesday:\n- 10:00 AM - 12:30 PM: Math Calculus Integration`}
            className="w-full p-4 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] placeholder-[#A5A58D] font-mono leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-[#6B705C] transition"
          />
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 font-bold hover:underline ml-2">Dismiss</button>
        </div>
      )}

      {/* Success Notification */}
      {assignedCount !== null && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-2 animate-fade-in">
          <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Successfully Assigned {assignedCount} Study Tasks to Planner Calendar!</span>
          </div>
          <p className="text-xs text-emerald-800/90">
            All tasks have been scheduled across your target dates with estimated durations and mapped syllabus topics.
          </p>
          <div className="flex items-center gap-2 pt-1">
            {setActiveTab && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('calendar')}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition flex items-center gap-1.5 shadow-2xs"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>View in Calendar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('timer')}
                  className="px-3.5 py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl font-bold text-xs transition flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Start Study Timer</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="text-[11px] text-[#A5A58D]">
          {parsedTasks.length > 0 ? (
            <span><strong>{parsedTasks.length}</strong> tasks ready for review</span>
          ) : (
            <span>AI will automatically match extracted items to your registered syllabus</span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleAnalyzeSchedule}
            disabled={isAnalyzing || !scheduleText.trim()}
            className={`px-5 py-2.5 rounded-full font-medium text-xs transition flex items-center gap-2 shadow-xs ${
              isAnalyzing || !scheduleText.trim()
                ? 'bg-[#EAE7DF] text-[#A5A58D] cursor-not-allowed'
                : 'bg-[#6B705C] hover:bg-[#5a5f4e] text-white active:scale-95'
            }`}
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Analyzing & Mapping Schedule...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Analyze & Extract Study Tasks</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* EXTRACTED TASKS PREVIEW & EDITING GRID */}
      {parsedTasks.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-[#E0DBD0] animate-fade-in">
          {/* Summary Banner */}
          {analysisSummary && (
            <div className="p-3.5 rounded-2xl bg-[#6B705C]/10 border border-[#6B705C]/20 text-xs text-[#4A4E4D] flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-[#6B705C] shrink-0" />
              <span className="leading-relaxed font-medium">{analysisSummary}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-[#6B705C] uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4" />
              <span>Extracted Study Tasks ({parsedTasks.length})</span>
            </h4>

            <button
              type="button"
              onClick={handleAddManualTask}
              className="text-xs text-[#6B705C] hover:underline font-bold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Slot</span>
            </button>
          </div>

          {/* Table / Cards list */}
          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
            {parsedTasks.map((task) => (
              <div
                key={task.id}
                className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-3 hover:border-[#6B705C]/50 transition"
              >
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  {/* Date & Day */}
                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-[10px] font-bold text-[#A5A58D] uppercase tracking-wider block">Date</label>
                    <input
                      type="date"
                      value={task.date}
                      onChange={(e) => handleUpdateTask(task.id, 'date', e.target.value)}
                      className="w-full text-xs font-mono font-bold bg-white border border-[#E0DBD0] rounded-xl px-2.5 py-1.5 text-[#4A4E4D]"
                    />
                  </div>

                  {/* Time slot */}
                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-[10px] font-bold text-[#A5A58D] uppercase tracking-wider block">Time Slot / Duration</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={task.timeSlot || ''}
                        placeholder="e.g. 09:00 - 11:00"
                        onChange={(e) => handleUpdateTask(task.id, 'timeSlot', e.target.value)}
                        className="flex-1 text-xs bg-white border border-[#E0DBD0] rounded-xl px-2 py-1.5 text-[#4A4E4D]"
                      />
                      <input
                        type="number"
                        min="15"
                        step="15"
                        value={task.estimatedMinutes}
                        onChange={(e) => handleUpdateTask(task.id, 'estimatedMinutes', parseInt(e.target.value) || 45)}
                        className="w-16 text-xs font-mono bg-white border border-[#E0DBD0] rounded-xl px-2 py-1.5 text-[#6B705C] font-bold text-center"
                        title="Estimated Minutes"
                      />
                      <span className="text-[10px] text-[#A5A58D]">m</span>
                    </div>
                  </div>

                  {/* Subject & Topic */}
                  <div className="sm:col-span-5 space-y-1">
                    <label className="text-[10px] font-bold text-[#A5A58D] uppercase tracking-wider block">Subject & Topic</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={task.subjectName}
                        onChange={(e) => handleUpdateTask(task.id, 'subjectName', e.target.value)}
                        className="w-28 text-xs font-bold bg-white border border-[#E0DBD0] rounded-xl px-2 py-1.5 text-[#6B705C]"
                      />
                      <input
                        type="text"
                        value={task.topicName}
                        onChange={(e) => handleUpdateTask(task.id, 'topicName', e.target.value)}
                        className="flex-1 text-xs bg-white border border-[#E0DBD0] rounded-xl px-2 py-1.5 text-[#4A4E4D]"
                      />
                    </div>
                  </div>

                  {/* Priority & Delete */}
                  <div className="sm:col-span-1 flex items-center justify-end gap-1.5 pt-4 sm:pt-0">
                    <button
                      type="button"
                      onClick={() => handleRemoveTask(task.id)}
                      className="text-[#A5A58D] hover:text-rose-600 p-2 rounded-xl hover:bg-rose-50 transition"
                      title="Remove task from import"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Chapter & Notes */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1 text-[#A5A58D]">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#4A4E4D]">Chapter:</span>
                    <input
                      type="text"
                      value={task.chapterName}
                      placeholder="Chapter/Module (Optional)"
                      onChange={(e) => handleUpdateTask(task.id, 'chapterName', e.target.value)}
                      className="bg-white border border-[#E0DBD0] rounded-lg px-2 py-0.5 text-xs text-[#4A4E4D]"
                    />
                  </div>

                  {task.notes && (
                    <div className="text-[10px] text-[#A5A58D] italic truncate max-w-sm">
                      Note: {task.notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Final Commit Button */}
          <div className="pt-3 flex items-center justify-between border-t border-[#E0DBD0]">
            <div className="text-xs text-[#A5A58D]">
              Ready to schedule <strong>{parsedTasks.length}</strong> tasks across your planner calendar.
            </div>

            <button
              type="button"
              onClick={handleAssignToCalendar}
              disabled={isSaving || parsedTasks.length === 0}
              className={`px-6 py-2.5 rounded-full font-bold text-xs transition flex items-center gap-2 shadow-xs ${
                isSaving || parsedTasks.length === 0
                  ? 'bg-[#EAE7DF] text-[#A5A58D] cursor-not-allowed'
                  : 'bg-[#6B705C] hover:bg-[#5a5f4e] text-white active:scale-95'
              }`}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Assigning to Planner Calendar...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Assign All Tasks to Planner Calendar</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
