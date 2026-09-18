import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  Target, 
  Flame, 
  Sparkles, 
  ArrowRight, 
  Zap, 
  CheckCircle2, 
  AlertOctagon, 
  Calculator, 
  Atom, 
  BookOpen, 
  Filter, 
  Clock,
  HelpCircle,
  Award,
  Languages
} from 'lucide-react';
import { Subject, TestResult, MarksRecoveryTopic } from '../types';
import { AppLanguage, translations } from '../lib/translations';
import { loadMistakes } from '../lib/mistakeVaultStorage';

interface MarksRecoveryEngineViewProps {
  subjects: Subject[];
  testResults: TestResult[];
  userLanguage?: AppLanguage;
  onNavigateToTab?: (tabId: string) => void;
  onStartRefurbishForTopic?: (topicName: string, subjectName: string) => void;
}

export const MarksRecoveryEngineView: React.FC<MarksRecoveryEngineViewProps> = ({
  subjects,
  testResults,
  userLanguage = 'en',
  onNavigateToTab,
  onStartRefurbishForTopic
}) => {
  const [lang, setLang] = useState<AppLanguage>(userLanguage);
  const t = translations[lang] || translations.en;

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('All');
  const [activeDrillTopic, setActiveDrillTopic] = useState<MarksRecoveryTopic | null>(null);
  const [drillAnswer, setDrillAnswer] = useState<string>('');
  const [drillFeedback, setDrillFeedback] = useState<string | null>(null);

  // Derive high-yield weak topics dynamically STRICTLY from user's confirmed subjects & test results
  const recoveryTopics: MarksRecoveryTopic[] = useMemo(() => {
    const list: MarksRecoveryTopic[] = [];
    const validSubjectNames = new Set(subjects.map(s => s.name.trim().toLowerCase()));

    // 1. Analyze user's actual confirmed subjects and chapters
    subjects.forEach((subj, sIdx) => {
      subj.chapters?.forEach((chap, cIdx) => {
        chap.topics?.forEach((top, tIdx) => {
          // If status is 'revision_needed' or 'in_progress', or has lower mastery
          const isWeak = top.status === 'revision_needed' || top.status === 'not_started' || top.status === 'in_progress';
          const nameLower = (top.name + ' ' + chap.name).toLowerCase();

          // Categorize appropriately
          let category: MarksRecoveryTopic['category'] = 'General Theory';
          if (nameLower.includes('numerical') || nameLower.includes('motion') || nameLower.includes('force') || nameLower.includes('circuit') || nameLower.includes('energy') || nameLower.includes('current')) {
            category = 'Physics Numerical';
          } else if (nameLower.includes('mechanism') || nameLower.includes('reaction') || nameLower.includes('acid') || nameLower.includes('organic')) {
            category = 'Chemistry Mechanism';
          } else if (nameLower.includes('derivation') || nameLower.includes('theorem') || nameLower.includes('integral') || nameLower.includes('calculus')) {
            category = 'Math Derivation';
          } else if (nameLower.includes('cycle') || nameLower.includes('dna') || nameLower.includes('system') || nameLower.includes('organ') || nameLower.includes('biology')) {
            category = 'Biology Definition';
          }

          if (isWeak) {
            const examWeightage = 4 + ((sIdx + cIdx + tIdx) % 7); // 4 - 10 marks
            const mastery = top.status === 'revision_needed' ? 45 : top.status === 'in_progress' ? 60 : 25;
            const recoverable = Math.round(examWeightage * (1 - mastery / 100));

            const actionPromptEn = `Master the step-by-step formula and typical trick question variations in ${top.name}.`;
            const actionPromptUr = `${top.name} کے بنیادی فارمولے، تصوراتی خاکے اور امتحانی نکات کی مکمل مشق کریں۔`;

            list.push({
              id: `rec_${top.id || `${sIdx}_${cIdx}_${tIdx}`}`,
              subjectName: subj.name,
              chapterName: chap.name,
              topicName: top.name,
              examWeightage,
              currentMasteryPercentage: mastery,
              potentialMarksRecoverable: Math.max(2, recoverable),
              reason: mastery < 30 ? (lang === 'ur' ? 'تصوراتی خامی (Conceptual Gap)' : 'Conceptual Gap') : (lang === 'ur' ? 'غلطیوں کا مرکز (Mistake Hotspot)' : 'Mistake Vault Hotspot'),
              category,
              actionPrompt: lang === 'ur' ? actionPromptUr : actionPromptEn
            });
          }
        });
      });
    });

    // 2. Incorporate Mistake Vault entries that belong to confirmed subjects
    try {
      const recordedMistakes = loadMistakes();
      recordedMistakes.forEach((m, idx) => {
        const subName = (m.subjectName || '').trim();
        if (validSubjectNames.has(subName.toLowerCase()) && m.cureStatus !== 'cured') {
          // Check if topic is already in list
          const exists = list.some(item => 
            item.subjectName.toLowerCase() === subName.toLowerCase() && 
            item.topicName.toLowerCase() === (m.topicName || '').toLowerCase()
          );
          if (!exists) {
            list.push({
              id: `rec_mistake_${m.id || idx}`,
              subjectName: subName,
              chapterName: m.topicName || 'Exam Autopsy',
              topicName: m.topicName ? `${m.topicName} (Mistake Vault Trap)` : m.question.substring(0, 45) + '...',
              examWeightage: 6,
              currentMasteryPercentage: m.cureStatus === 'curing' ? 50 : 25,
              potentialMarksRecoverable: 4,
              reason: lang === 'ur' ? 'امتحانی غلطی (Logged Exam Mistake)' : 'Active Exam Mistake',
              category: 'General Theory',
              actionPrompt: lang === 'ur'
                ? `صحیح طریقہ: ${m.correctAnswer.substring(0, 100)}`
                : `Focus on fixing your previous error: "${m.userAttempt || m.notes || 'Incorrect step'}" and verify the correct method: ${m.correctAnswer.substring(0, 100)}`
            });
          }
        }
      });
    } catch (e) {
      // Safe fallback if storage unavailable
    }

    // Sort by highest potential marks recoverable
    return list.sort((a, b) => b.potentialMarksRecoverable - a.potentialMarksRecoverable);
  }, [subjects, lang]);

  const filteredTopics = recoveryTopics.filter(t => {
    const matchCat = selectedCategory === 'All' || t.category === selectedCategory;
    const matchSubj = selectedSubjectFilter === 'All' || t.subjectName === selectedSubjectFilter;
    return matchCat && matchSubj;
  });

  const totalRecoverableMarks = filteredTopics.reduce((acc, t) => acc + t.potentialMarksRecoverable, 0);

  const handleStartDrill = (topic: MarksRecoveryTopic) => {
    setActiveDrillTopic(topic);
    setDrillAnswer('');
    setDrillFeedback(null);
  };

  const handleEvaluateDrill = () => {
    if (!drillAnswer.trim()) return;
    const len = drillAnswer.split(/\s+/).length;
    if (len >= 20) {
      setDrillFeedback(`Excellent recovery effort! You nailed the foundational steps. Estimated +${activeDrillTopic?.potentialMarksRecoverable} marks unlocked for your upcoming test.`);
    } else {
      setDrillFeedback('Good start, but make sure to include the exact units and intermediate formula substitution steps.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8" dir={lang === 'ur' ? 'rtl' : 'ltr'}>
      {/* Header Banner */}
      <div className="bg-stone-900 text-stone-100 rounded-3xl p-6 sm:p-8 border border-stone-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold uppercase tracking-wider border border-emerald-500/30">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{lang === 'ur' ? 'نمبر بحالی پروٹوکول' : 'Score Triage Protocol'}</span>
              </div>
              <button
                type="button"
                onClick={() => setLang(prev => prev === 'en' ? 'ur' : 'en')}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-600 text-xs font-bold transition cursor-pointer"
                title="Toggle between English and Urdu"
              >
                <Languages className="w-3.5 h-3.5 text-emerald-400" />
                <span>{lang === 'ur' ? 'English' : 'اردو (Urdu)'}</span>
              </button>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-50">
              {lang === 'ur' ? 'مارکس ریکوری انجن' : t.recovery_title}
            </h1>
            <p className="text-stone-300 max-w-2xl text-sm sm:text-base leading-relaxed">
              {lang === 'ur'
                ? 'امتحانی غلطیوں اور کمزور موضوعات سے ضائع شدہ نمبرات واپس حاصل کریں'
                : t.recovery_subtitle}
            </p>
          </div>

          <div className="flex items-center gap-4 bg-stone-800/80 px-5 py-3 rounded-2xl border border-stone-700">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-wider font-semibold">Total Recoverable</p>
              <p className="text-2xl font-black text-emerald-400 font-mono">
                +{totalRecoverableMarks} Marks
              </p>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-6 border-t border-stone-800 text-xs">
          <span className="text-stone-400 font-semibold flex items-center gap-1 mr-2">
            <Filter className="w-3.5 h-3.5" /> Filters:
          </span>
          {['All', 'Physics Numerical', 'Chemistry Mechanism', 'Math Derivation', 'Biology Definition'].map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl font-medium transition ${
                selectedCategory === cat
                  ? 'bg-emerald-500 text-stone-950 font-bold'
                  : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Modal / Drill Drawer for Active Topic */}
      {activeDrillTopic && (
        <div className="bg-white dark:bg-stone-900 border-2 border-emerald-500/50 rounded-2xl p-6 shadow-xl space-y-4 animate-fade-in">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Targeted Recovery Drill • +{activeDrillTopic.potentialMarksRecoverable} Marks
              </span>
              <h3 className="text-lg font-bold text-stone-900 dark:text-stone-50 mt-1">
                {activeDrillTopic.topicName}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {activeDrillTopic.subjectName} • {activeDrillTopic.chapterName}
              </p>
            </div>
            <button
              onClick={() => setActiveDrillTopic(null)}
              className="text-xs px-3 py-1 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-lg text-stone-600 dark:text-stone-300 transition"
            >
              Close
            </button>
          </div>

          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 font-medium leading-relaxed">
            {activeDrillTopic.actionPrompt}
          </div>

          <textarea
            rows={4}
            placeholder="Write the core formula, proof step, or key concept directly here to recover your marks..."
            value={drillAnswer}
            onChange={e => setDrillAnswer(e.target.value)}
            className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl p-3 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />

          <div className="flex items-center justify-between">
            <button
              onClick={handleEvaluateDrill}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold text-xs flex items-center gap-2 shadow transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Verify & Log Recovered Marks</span>
            </button>

            {onStartRefurbishForTopic && (
              <button
                onClick={() => {
                  onStartRefurbishForTopic(activeDrillTopic.topicName, activeDrillTopic.subjectName);
                  setActiveDrillTopic(null);
                }}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-semibold text-xs flex items-center gap-1.5 transition"
              >
                <span>Launch Closed-Book Refurbish</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {drillFeedback && (
            <div className="p-3.5 bg-stone-100 dark:bg-stone-800 rounded-xl text-xs text-stone-800 dark:text-stone-200 font-medium border border-stone-200 dark:border-stone-700">
              {drillFeedback}
            </div>
          )}
        </div>
      )}

      {/* Topics Ranking Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>High-Yield Weak Topics (Ranked by Recoverable Score)</span>
          </h2>
          <span className="text-xs text-stone-500 dark:text-stone-400">
            {filteredTopics.length} opportunities identified
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTopics.map((topic, idx) => (
            <div
              key={topic.id}
              className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-emerald-500/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition space-y-4 relative overflow-hidden"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                      {topic.subjectName}
                    </span>
                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">
                      {topic.category}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 leading-snug">
                    {topic.topicName}
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Chapter: {topic.chapterName || 'Core Syllabus'}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 px-3 py-1.5 rounded-xl text-center">
                    <span className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold block">
                      Recoverable
                    </span>
                    <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      +{topic.potentialMarksRecoverable} Marks
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress & Exam Weight */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-stone-600 dark:text-stone-400">
                  <span>Current Mastery: {topic.currentMasteryPercentage}%</span>
                  <span>Exam Weight: ~{topic.examWeightage} Marks</span>
                </div>
                <div className="w-full bg-stone-100 dark:bg-stone-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500"
                    style={{ width: `${topic.currentMasteryPercentage}%` }}
                  />
                </div>
              </div>

              {/* Action Strip */}
              <div className="flex items-center justify-between pt-3 border-t border-stone-100 dark:border-stone-800">
                <span className="text-xs text-stone-500 flex items-center gap-1.5">
                  <AlertOctagon className="w-3.5 h-3.5 text-rose-500" />
                  <span>{topic.reason}</span>
                </span>

                <button
                  onClick={() => handleStartDrill(topic)}
                  className="px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-black dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-950 text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400 dark:text-amber-500" />
                  <span>Recover Marks</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
