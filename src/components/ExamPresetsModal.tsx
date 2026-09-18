import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  BookOpen, 
  GraduationCap, 
  Plus, 
  Check, 
  X, 
  Bot, 
  Layers, 
  ArrowRight, 
  HelpCircle, 
  Flame, 
  Target, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  FolderPlus,
  RefreshCw,
  Zap
} from 'lucide-react';
import { Subject, Chapter, Topic } from '../types';
import { EXAM_PRESET_TEMPLATES, ExamPresetTemplate } from '../data/examTemplates';
import { apiParseSyllabus } from '../lib/aiApi';

interface ExamPresetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyPreset: (subjects: Subject[], mode: 'append' | 'replace') => void;
}

export const ExamPresetsModal: React.FC<ExamPresetsModalProps> = ({
  isOpen,
  onClose,
  onApplyPreset
}) => {
  const [activeTab, setActiveTab] = useState<'curated' | 'ai_custom'>('curated');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedPresetId, setSelectedPresetId] = useState<string>(EXAM_PRESET_TEMPLATES[0].id);
  const [applyMode, setApplyMode] = useState<'append' | 'replace'>('append');

  // AI Custom Generator State
  const [customExamName, setCustomExamName] = useState<string>('');
  const [customTargetDuration, setCustomTargetDuration] = useState<string>('3 Months');
  const [customFocusAreas, setCustomFocusAreas] = useState<string>('');
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [aiGeneratedSubjects, setAiGeneratedSubjects] = useState<Subject[] | null>(null);
  const [aiError, setAiError] = useState<string>('');

  if (!isOpen) return null;

  const categories = ['All', 'Medical', 'Engineering & STEM', 'College Board & High School', 'Law & Bar', 'Finance & Business', 'Computer Science'];

  const filteredPresets = EXAM_PRESET_TEMPLATES.filter(p => 
    selectedCategory === 'All' ? true : p.category === selectedCategory
  );

  const activePreset = EXAM_PRESET_TEMPLATES.find(p => p.id === selectedPresetId) || EXAM_PRESET_TEMPLATES[0];

  const handleApplyCuratedPreset = () => {
    if (!activePreset) return;
    onApplyPreset(activePreset.subjects, applyMode);
    onClose();
  };

  const handleGenerateAICustomSyllabus = async () => {
    if (!customExamName.trim()) {
      setAiError('Please enter an exam or certification name.');
      return;
    }
    setAiError('');
    setIsGeneratingAI(true);
    setAiGeneratedSubjects(null);

    try {
      const promptText = `Generate a rigorous, high-yield academic syllabus curriculum for the exam/course: "${customExamName}".
Target Preparation Timeline: ${customTargetDuration}.
Key Focus / Subtopics: ${customFocusAreas || 'Comprehensive curriculum with official board weightage'}.

Format requirement: Please provide 2 to 4 core subjects with chapters, numbered topics (e.g. 1.1, 1.2), and specific high-yield subtopics.`;

      const res = await apiParseSyllabus({ text: promptText });
      if (res && res.success && res.subjects && res.subjects.length > 0) {
        setAiGeneratedSubjects(res.subjects);
      } else {
        setAiError('AI could not generate structured subjects. Please try rephrasing.');
      }
    } catch (err: any) {
      setAiError(`AI Generation failed: ${err.message || err}`);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleApplyAiCustom = () => {
    if (!aiGeneratedSubjects) return;
    onApplyPreset(aiGeneratedSubjects, applyMode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-theme-card border border-theme rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-theme flex items-center justify-between bg-theme-surface/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-primary">Exam Presets & Syllabus Templates</h2>
              <p className="text-xs text-muted">Load pre-configured curriculum frameworks or use AI to generate tailored exam blueprints</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted hover:text-primary rounded-lg hover:bg-theme-accent transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-theme bg-theme-surface/30">
          <button
            onClick={() => setActiveTab('curated')}
            className={`flex-1 py-3 text-xs font-bold border-b-2 transition flex items-center justify-center gap-2 ${
              activeTab === 'curated'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-theme-card'
                : 'border-transparent text-muted hover:text-primary'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Curated Academic Presets
          </button>
          <button
            onClick={() => setActiveTab('ai_custom')}
            className={`flex-1 py-3 text-xs font-bold border-b-2 transition flex items-center justify-center gap-2 ${
              activeTab === 'ai_custom'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-theme-card'
                : 'border-transparent text-muted hover:text-primary'
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-500" />
            AI Custom Exam Blueprint Builder
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'curated' ? (
            <>
              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                      selectedCategory === cat
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-theme-surface text-muted hover:text-primary border border-theme'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Presets Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredPresets.map(preset => {
                  const isSelected = preset.id === selectedPresetId;
                  const totalTopics = preset.subjects.reduce(
                    (acc, s) => acc + s.chapters.reduce((cAcc, c) => cAcc + c.topics.length, 0),
                    0
                  );

                  return (
                    <div
                      key={preset.id}
                      onClick={() => setSelectedPresetId(preset.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition relative flex flex-col justify-between ${
                        isSelected
                          ? 'border-purple-500/60 bg-purple-500/5 ring-2 ring-purple-500/20'
                          : 'border-theme bg-theme-surface/40 hover:bg-theme-surface'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xl">{preset.icon}</span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-theme-accent text-primary border border-theme">
                            {preset.badge}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-primary mb-1">{preset.name}</h4>
                        <p className="text-xs text-muted line-clamp-2">{preset.description}</p>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted pt-3 border-t border-theme/60 mt-3">
                        <span>{preset.subjects.length} Subjects</span>
                        <span>{totalTopics} Numbered Topics</span>
                        <span>⏳ ~{preset.targetExamDurationMonths}m timeline</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Preset Preview */}
              {activePreset && (
                <div className="p-4 rounded-xl border border-theme bg-theme-surface/50 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2">
                    <span>Subjects Included in "{activePreset.name}"</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {activePreset.subjects.map(s => (
                      <div key={s.id} className="p-2.5 rounded-lg bg-theme-card border border-theme flex items-center gap-2.5">
                        <span className="text-lg">{s.icon || '📚'}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-primary truncate">{s.name}</p>
                          <p className="text-[11px] text-muted truncate">{s.chapters.length} Chapters • {s.chapters.reduce((a, c) => a + c.topics.length, 0)} Topics</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-3 text-xs text-muted w-full sm:w-auto">
                  <span className="font-semibold">Action Mode:</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="curatedApplyMode"
                      checked={applyMode === 'append'}
                      onChange={() => setApplyMode('append')}
                      className="accent-purple-600"
                    />
                    <span>Append to existing</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="curatedApplyMode"
                      checked={applyMode === 'replace'}
                      onChange={() => setApplyMode('replace')}
                      className="accent-purple-600"
                    />
                    <span>Replace all subjects</span>
                  </label>
                </div>

                <button
                  onClick={handleApplyCuratedPreset}
                  className="w-full sm:w-auto px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Apply "{activePreset.name}"
                </button>
              </div>
            </>
          ) : (
            <>
              {/* AI Custom Builder Tab */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1.5">
                    Exam / Target Certification Title
                  </label>
                  <input
                    type="text"
                    value={customExamName}
                    onChange={(e) => setCustomExamName(e.target.value)}
                    placeholder="e.g. AWS Solutions Architect, MCAT Biology, GRE Quantitative, AICE Marine Science..."
                    className="w-full bg-theme-surface border border-theme rounded-xl px-3.5 py-2.5 text-sm text-primary focus:outline-hidden focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1.5">
                      Preparation Timeline
                    </label>
                    <select
                      value={customTargetDuration}
                      onChange={(e) => setCustomTargetDuration(e.target.value)}
                      className="w-full bg-theme-surface border border-theme rounded-xl px-3.5 py-2.5 text-sm text-primary focus:outline-hidden focus:ring-2 focus:ring-purple-500/30"
                    >
                      <option value="1 Month Sprint">1 Month Sprint</option>
                      <option value="3 Months Comprehensive">3 Months Comprehensive</option>
                      <option value="6 Months Mastery">6 Months Mastery</option>
                      <option value="1 Academic Year">1 Academic Year</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1.5">
                      Special Focus or Board (Optional)
                    </label>
                    <input
                      type="text"
                      value={customFocusAreas}
                      onChange={(e) => setCustomFocusAreas(e.target.value)}
                      placeholder="e.g. Include Case Law, Emphasize Organic Mechanisms, Past Paper style"
                      className="w-full bg-theme-surface border border-theme rounded-xl px-3.5 py-2.5 text-sm text-primary focus:outline-hidden focus:ring-2 focus:ring-purple-500/30"
                    />
                  </div>
                </div>

                <button
                  onClick={handleGenerateAICustomSyllabus}
                  disabled={isGeneratingAI}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-sm font-bold shadow-md transition flex items-center justify-center gap-2"
                >
                  {isGeneratingAI ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      AI Generating Exam Curriculum Blueprint...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Structured Exam Syllabus
                    </>
                  )}
                </button>

                {aiError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{aiError}</span>
                  </div>
                )}

                {/* AI Results Preview */}
                {aiGeneratedSubjects && (
                  <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                        Generated Blueprint ({aiGeneratedSubjects.length} Subjects)
                      </h4>
                      <span className="text-xs text-muted">
                        {aiGeneratedSubjects.reduce((acc, s) => acc + s.chapters.reduce((c, ch) => c + ch.topics.length, 0), 0)} Topics
                      </span>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {aiGeneratedSubjects.map(s => (
                        <div key={s.id} className="p-2.5 rounded-lg bg-theme-card border border-theme">
                          <p className="text-xs font-bold text-primary">{s.name}</p>
                          <p className="text-[11px] text-muted">{s.chapters.map(c => c.name).join(' • ')}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                      <div className="flex items-center gap-3 text-xs text-muted">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="aiApplyMode"
                            checked={applyMode === 'append'}
                            onChange={() => setApplyMode('append')}
                            className="accent-purple-600"
                          />
                          <span>Append</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="aiApplyMode"
                            checked={applyMode === 'replace'}
                            onChange={() => setApplyMode('replace')}
                            className="accent-purple-600"
                          />
                          <span>Replace</span>
                        </label>
                      </div>

                      <button
                        onClick={handleApplyAiCustom}
                        className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        Apply Generated Blueprint
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};
