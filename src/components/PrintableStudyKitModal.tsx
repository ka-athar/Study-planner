import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Printer, 
  FileText, 
  Sparkles, 
  Calendar, 
  CheckSquare, 
  X, 
  Download, 
  Layers, 
  Columns, 
  BookOpen, 
  Zap,
  CheckCircle2
} from 'lucide-react';
import { Subject, FlashcardDeck, StudyPlan, UserProfile, RevisionItem } from '../types';
import { 
  StudyKitFormat, 
  StudyKitExportOptions, 
  openStudyKitPrintWindow, 
  generatePrintableStudyKitHtml 
} from '../lib/studyKitExportService';

interface PrintableStudyKitModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  flashcardDecks: FlashcardDeck[];
  plans: StudyPlan[];
  userProfile: UserProfile | null;
  revisions: RevisionItem[];
}

export const PrintableStudyKitModal: React.FC<PrintableStudyKitModalProps> = ({
  isOpen,
  onClose,
  subjects,
  flashcardDecks,
  plans,
  userProfile,
  revisions
}) => {
  const [selectedFormat, setSelectedFormat] = useState<StudyKitFormat>('cram_sheet');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(subjects.map(s => s.name));
  const [includeFormulas, setIncludeFormulas] = useState<boolean>(true);
  const [includeMnemonics, setIncludeMnemonics] = useState<boolean>(true);
  const [includeFlashcards, setIncludeFlashcards] = useState<boolean>(true);
  const [includeExams, setIncludeExams] = useState<boolean>(true);
  const [columns, setColumns] = useState<1 | 2 | 3>(2);
  const [fontSize, setFontSize] = useState<'compact' | 'standard' | 'large'>('standard');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [customNotes, setCustomNotes] = useState<string>('Review high-yield concepts and complete practice question sprints.');

  if (!isOpen) return null;

  const toggleSubject = (name: string) => {
    setSelectedSubjects(prev => 
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  };

  const selectAllSubjects = () => {
    setSelectedSubjects(subjects.map(s => s.name));
  };

  const deselectAllSubjects = () => {
    setSelectedSubjects([]);
  };

  const handlePrint = () => {
    const options: StudyKitExportOptions = {
      format: selectedFormat,
      selectedSubjectNames: selectedSubjects,
      includeFormulas,
      includeMnemonics,
      includeFlashcards,
      includeExams,
      columns,
      fontSize,
      title: customTitle.trim() || undefined,
      notes: customNotes.trim() || undefined
    };

    openStudyKitPrintWindow(options, {
      subjects,
      flashcardDecks,
      plans,
      userProfile,
      revisions
    });
  };

  const formatCards: { id: StudyKitFormat; title: string; desc: string; icon: any; tag: string }[] = [
    {
      id: 'cram_sheet',
      title: 'High-Yield Exam Cram Sheet',
      desc: '1-2 page master syllabus digest with checkboxes, core topics, and flashcard recall items.',
      icon: Zap,
      tag: 'Most Popular'
    },
    {
      id: 'wall_planner',
      title: 'Weekly Wall Planner (A4/Letter)',
      desc: 'Clean 7-day grid with morning & evening focus blocks, daily study targets, and habit checks.',
      icon: Calendar,
      tag: 'Print & Pin'
    },
    {
      id: 'formula_sheet',
      title: 'Formulas & Definitions Cheat Sheet',
      desc: 'Multi-subject quick reference matrix covering essential formulas, theorems, and definitions.',
      icon: FileText,
      tag: 'Math & Science'
    },
    {
      id: 'flashcard_cutouts',
      title: 'Printable Pocket Flashcard Cutouts',
      desc: 'Double-sided or dashed-line cutouts ready for tactile physical revision on the go.',
      icon: Layers,
      tag: 'Tactile Review'
    }
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-card text-primary w-full max-w-3xl rounded-3xl border border-theme shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="bg-header p-5 sm:p-6 border-b border-theme flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Printable Study Kits & PDF Exporter</h3>
                <p className="text-xs text-muted">Generate high-yield printable cheat sheets, wall planners, and exam kits</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-theme-accent text-muted hover:text-primary transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Body */}
          <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
            {/* Format Selection */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted mb-3 block">
                1. Select Kit Format
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {formatCards.map(fc => {
                  const Icon = fc.icon;
                  const isSelected = selectedFormat === fc.id;
                  return (
                    <button
                      key={fc.id}
                      onClick={() => setSelectedFormat(fc.id)}
                      className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? 'border-primary ring-2 ring-primary/20 bg-theme-accent/60'
                          : 'border-theme hover:border-primary/40 bg-surface'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="p-2 rounded-xl bg-card border border-theme text-primary">
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          {fc.tag}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-bold">{fc.title}</div>
                        <div className="text-xs text-muted mt-1 line-clamp-2">{fc.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subject Filters */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted block">
                  2. Target Subjects ({selectedSubjects.length}/{subjects.length})
                </label>
                <div className="flex items-center gap-2 text-xs">
                  <button onClick={selectAllSubjects} className="text-primary hover:underline cursor-pointer">Select All</button>
                  <span>•</span>
                  <button onClick={deselectAllSubjects} className="text-muted hover:underline cursor-pointer">Clear</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {subjects.map(s => {
                  const isSelected = selectedSubjects.includes(s.name);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleSubject(s.name)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-primary text-white border-primary shadow-xs'
                          : 'bg-surface border-theme text-muted hover:text-primary'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-3 h-3" />}
                      <span>{s.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Options & Layout Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3 bg-surface p-4 rounded-2xl border border-theme">
                <label className="text-xs font-bold uppercase tracking-wider text-muted block">
                  3. Content Elements
                </label>
                <label className="flex items-center gap-2.5 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeFlashcards}
                    onChange={e => setIncludeFlashcards(e.target.checked)}
                    className="rounded border-theme text-primary focus:ring-primary"
                  />
                  <span>Include Quick Flashcards Matrix</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeExams}
                    onChange={e => setIncludeExams(e.target.checked)}
                    className="rounded border-theme text-primary focus:ring-primary"
                  />
                  <span>Include Upcoming Exam Dates & Milestones</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeMnemonics}
                    onChange={e => setIncludeMnemonics(e.target.checked)}
                    className="rounded border-theme text-primary focus:ring-primary"
                  />
                  <span>Include Memory Mnemonics & Tricks</span>
                </label>
              </div>

              <div className="space-y-3 bg-surface p-4 rounded-2xl border border-theme">
                <label className="text-xs font-bold uppercase tracking-wider text-muted block">
                  4. Layout & Print Scaling
                </label>
                <div className="flex items-center justify-between text-xs">
                  <span>Columns:</span>
                  <div className="flex gap-1">
                    {[1, 2, 3].map(col => (
                      <button
                        key={col}
                        onClick={() => setColumns(col as any)}
                        className={`px-2.5 py-1 rounded-lg border text-xs cursor-pointer ${
                          columns === col ? 'bg-primary text-white border-primary' : 'bg-card border-theme text-muted'
                        }`}
                      >
                        {col} Col
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span>Font Density:</span>
                  <div className="flex gap-1">
                    {(['compact', 'standard', 'large'] as const).map(fs => (
                      <button
                        key={fs}
                        onClick={() => setFontSize(fs)}
                        className={`px-2.5 py-1 rounded-lg border text-xs capitalize cursor-pointer ${
                          fontSize === fs ? 'bg-primary text-white border-primary' : 'bg-card border-theme text-muted'
                        }`}
                      >
                        {fs}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Notes / Directive */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted mb-1.5 block">
                5. Custom Directive / Focus Note (Optional)
              </label>
              <input
                type="text"
                value={customNotes}
                onChange={e => setCustomNotes(e.target.value)}
                placeholder="e.g., Prioritize Mechanics & Electrochemistry for Friday Mock Test"
                className="w-full px-3.5 py-2 rounded-xl bg-surface border border-theme text-xs text-primary focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="bg-header p-5 sm:p-6 border-t border-theme flex items-center justify-between gap-4">
            <div className="text-xs text-muted hidden sm:block">
              🖨️ Formatted for clean A4/Letter physical printing & browser PDF export
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-theme text-xs font-semibold hover:bg-theme-accent transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handlePrint}
                className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print / Export PDF</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
