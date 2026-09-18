import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Link as LinkIcon, 
  ExternalLink, 
  Copy, 
  Check, 
  Save, 
  Layers, 
  Trash2, 
  BookOpen, 
  ArrowRight, 
  Share2,
  AlertCircle
} from 'lucide-react';
import { Subject, TestResult } from '../types';

interface GeminiNotebookLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSubject: Subject;
  allSubjects: Subject[];
  testResults: TestResult[];
  onUpdateSubjects?: (subjects: Subject[]) => void;
  onSelectSubject?: (subjectId: string) => void;
}

export const GeminiNotebookLinksModal: React.FC<GeminiNotebookLinksModalProps> = ({
  isOpen,
  onClose,
  activeSubject,
  allSubjects,
  testResults,
  onUpdateSubjects,
  onSelectSubject
}) => {
  const [modalTab, setModalTab] = useState<'current' | 'all-courses' | 'companion-links'>('current');
  const [currentUrlInput, setCurrentUrlInput] = useState<string>(activeSubject.geminiNotebookUrl || '');
  const [bulkUrls, setBulkUrls] = useState<Record<string, string>>({});
  const [isCopiedGuide, setIsCopiedGuide] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Sync inputs with active subject and all subjects
  useEffect(() => {
    setCurrentUrlInput(activeSubject.geminiNotebookUrl || '');
    const map: Record<string, string> = {};
    allSubjects.forEach(s => {
      map[s.id] = s.geminiNotebookUrl || '';
    });
    setBulkUrls(map);
  }, [activeSubject.id, activeSubject.geminiNotebookUrl, allSubjects]);

  if (!isOpen) return null;

  // Generate markdown syllabus & test mistakes for this subject for NotebookLM
  const generateNotebookLMGuide = (subject: Subject) => {
    const subTests = testResults.filter(t => t.subjectName.toLowerCase() === subject.name.toLowerCase());
    return `# ${subject.name} — Study Guide & Syllabus Source
Description: ${subject.description || 'Comprehensive course syllabus and reference guide.'}

## Units & Chapters
${subject.chapters.map((ch, idx) => `### Unit ${idx + 1}: ${ch.name}
${ch.topics.map(t => `- ${t.name} (Estimated time: ${t.estimatedMinutes || 45} mins, Status: ${t.status || 'Planned'})`).join('\n')}`).join('\n\n')}

${subTests.length > 0 ? `## Mistake Logs & Exam Correction Areas
${subTests.map(t => `### ${t.testName} (Score: ${t.score})
- Date: ${t.date}
- Mistakes: ${t.mistakes || 'None noted'}
- Focus Correction Prompts: ${(t.correctionPrompts || []).join('; ')}`).join('\n\n')}` : ''}
`;
  };

  const handleCopyGuide = (subject: Subject) => {
    const guide = generateNotebookLMGuide(subject);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(guide);
      setIsCopiedGuide(true);
      setTimeout(() => setIsCopiedGuide(false), 2500);
    }
  };

  // Save URL for the current active subject
  const handleSaveCurrentSubjectUrl = () => {
    const trimmed = currentUrlInput.trim();
    if (onUpdateSubjects) {
      const updated = allSubjects.map(s => s.id === activeSubject.id ? { ...s, geminiNotebookUrl: trimmed } : s);
      onUpdateSubjects(updated);
    }
    setFeedbackToast(trimmed ? `Gemini Notebook linked for ${activeSubject.name}!` : `Notebook link removed for ${activeSubject.name}.`);
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  // Save single subject from all courses list
  const handleSaveSingleSubjectUrl = (subjectId: string) => {
    const url = (bulkUrls[subjectId] || '').trim();
    if (onUpdateSubjects) {
      const updated = allSubjects.map(s => s.id === subjectId ? { ...s, geminiNotebookUrl: url } : s);
      onUpdateSubjects(updated);
    }
    const subjName = allSubjects.find(s => s.id === subjectId)?.name || 'Subject';
    setFeedbackToast(url ? `Saved Notebook link for ${subjName}!` : `Removed Notebook link for ${subjName}.`);
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  // Copy link from an existing subject that has a notebook
  const handleCopyLinkFromSubject = (sourceSubject: Subject) => {
    if (!sourceSubject.geminiNotebookUrl) return;
    setCurrentUrlInput(sourceSubject.geminiNotebookUrl);
    setFeedbackToast(`Copied notebook link from ${sourceSubject.name}! Click Save Link below to apply.`);
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  // Toggle companion linking between activeSubject and another subject
  const handleToggleCompanion = (targetId: string) => {
    if (!onUpdateSubjects) return;
    const currentLinked = activeSubject.linkedSubjectIds || [];
    const isLinked = currentLinked.includes(targetId);
    const nextLinked = isLinked ? currentLinked.filter(id => id !== targetId) : [...currentLinked, targetId];

    const updated = allSubjects.map(s => {
      if (s.id === activeSubject.id) {
        return { ...s, linkedSubjectIds: nextLinked };
      }
      // Bidirectional linking so both reference each other
      if (s.id === targetId) {
        const targetLinked = s.linkedSubjectIds || [];
        const nextTargetLinked = isLinked
          ? targetLinked.filter(id => id !== activeSubject.id)
          : targetLinked.includes(activeSubject.id) ? targetLinked : [...targetLinked, activeSubject.id];
        return { ...s, linkedSubjectIds: nextTargetLinked };
      }
      return s;
    });

    onUpdateSubjects(updated);
    const targetName = allSubjects.find(s => s.id === targetId)?.name || 'Course';
    setFeedbackToast(!isLinked ? `Linked ${targetName} as companion to ${activeSubject.name}!` : `Unlinked ${targetName} from ${activeSubject.name}.`);
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  // Find other subjects that already have a notebook URL
  const subjectsWithNotebooks = allSubjects.filter(s => s.id !== activeSubject.id && !!s.geminiNotebookUrl);

  // Active subject's companion subjects
  const linkedCompanionSubjects = (activeSubject.linkedSubjectIds || [])
    .map(id => allSubjects.find(s => s.id === id))
    .filter(Boolean) as Subject[];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in text-[#4A4E4D]">
      <div className="bg-white border border-[#E0DBD0] rounded-3xl p-5 sm:p-6 shadow-2xl max-w-2xl w-full space-y-4 my-8">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#E0DBD0] pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 border border-amber-200 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-serif italic font-bold text-[#4A4E4D]">
                Gemini Notebooks & Subject Links
              </h3>
              <p className="text-xs text-[#6B705C]">
                Manage independent Google NotebookLM notebooks and cross-course companion links
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-[#F2EFE9] text-[#A5A58D] hover:text-[#4A4E4D] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Toast */}
        {feedbackToast && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-900 flex items-center justify-between gap-2 animate-fade-in">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{feedbackToast}</span>
            </div>
            <button
              onClick={() => setFeedbackToast(null)}
              className="text-emerald-700 hover:text-emerald-900 cursor-pointer font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Modal Sub-Tabs */}
        <div className="flex items-center gap-1.5 bg-[#F2EFE9] p-1.5 rounded-2xl border border-[#E0DBD0] text-xs font-bold">
          <button
            onClick={() => setModalTab('current')}
            className={`flex-1 py-1.5 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              modalTab === 'current'
                ? 'bg-white text-[#4A4E4D] shadow-xs border border-[#E0DBD0]'
                : 'text-[#6B705C] hover:text-[#4A4E4D]'
            }`}
          >
            <span>{activeSubject.icon || '📚'}</span>
            <span>{activeSubject.name} Notebook</span>
          </button>

          <button
            onClick={() => setModalTab('all-courses')}
            className={`flex-1 py-1.5 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              modalTab === 'all-courses'
                ? 'bg-white text-[#4A4E4D] shadow-xs border border-[#E0DBD0]'
                : 'text-[#6B705C] hover:text-[#4A4E4D]'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-[#6B705C]" />
            <span>All Courses ({allSubjects.length})</span>
          </button>

          <button
            onClick={() => setModalTab('companion-links')}
            className={`flex-1 py-1.5 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              modalTab === 'companion-links'
                ? 'bg-white text-[#4A4E4D] shadow-xs border border-[#E0DBD0]'
                : 'text-[#6B705C] hover:text-[#4A4E4D]'
            }`}
          >
            <Share2 className="w-3.5 h-3.5 text-[#6B705C]" />
            <span>Link Companion Subjects</span>
          </button>
        </div>

        {/* TAB 1: CURRENT SUBJECT NOTEBOOK */}
        {modalTab === 'current' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-[#4A4E4D] flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-[#6B705C]" />
                  <span>NotebookLM URL for {activeSubject.name}:</span>
                </span>
                {activeSubject.geminiNotebookUrl && (
                  <a
                    href={activeSubject.geminiNotebookUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-bold text-amber-700 hover:underline flex items-center gap-1"
                  >
                    <span>Launch Notebook</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <input
                type="url"
                value={currentUrlInput}
                onChange={(e) => setCurrentUrlInput(e.target.value)}
                placeholder="https://notebooklm.google.com/notebook/your-notebook-id"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E0DBD0] text-xs font-mono text-[#4A4E4D] focus:outline-none focus:ring-2 focus:ring-[#6B705C]/30"
              />

              <p className="text-[11px] text-[#A5A58D] leading-relaxed">
                Each subject has its own independent Gemini Notebook link. If two subjects share a notebook, you can paste the same URL or pick it from the list below.
              </p>

              {/* Quick Helper: Copy link from another subject that already has one */}
              {subjectsWithNotebooks.length > 0 && (
                <div className="pt-2 border-t border-[#E0DBD0] space-y-1.5">
                  <span className="text-[11px] font-bold text-[#6B705C] block">
                    Or link to the same notebook as another course:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {subjectsWithNotebooks.map(sub => (
                      <button
                        key={sub.id}
                        onClick={() => handleCopyLinkFromSubject(sub)}
                        className="px-2.5 py-1 rounded-xl bg-white hover:bg-[#EAE7DF] border border-[#E0DBD0] text-[11px] font-medium text-[#4A4E4D] flex items-center gap-1 transition cursor-pointer"
                        title={`Copy URL from ${sub.name}`}
                      >
                        <span>{sub.icon || '📚'}</span>
                        <span>Use {sub.name}'s Notebook</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between">
                {currentUrlInput ? (
                  <button
                    onClick={() => {
                      setCurrentUrlInput('');
                      handleSaveSingleSubjectUrl(activeSubject.id);
                    }}
                    className="text-xs text-rose-600 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Link</span>
                  </button>
                ) : <span />}

                <button
                  onClick={handleSaveCurrentSubjectUrl}
                  className="px-5 py-2 rounded-xl bg-[#6B705C] hover:bg-[#5A5E4E] text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Link for {activeSubject.name}</span>
                </button>
              </div>
            </div>

            {/* Step: Prepare & Copy Sources for NotebookLM */}
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs text-amber-950">Ground Gemini in {activeSubject.name}</span>
                <button
                  onClick={() => handleCopyGuide(activeSubject)}
                  className="px-3 py-1.5 rounded-xl bg-amber-200/80 hover:bg-amber-300 text-amber-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  {isCopiedGuide ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopiedGuide ? 'Copied Syllabus & Mistakes!' : 'Copy Syllabus & Test Mistakes'}</span>
                </button>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Copies all units, chapters, estimated times, and mistake analysis for {activeSubject.name}. Paste it into NotebookLM as a new source to create study guides, practice quizzes, and audio deep dives.
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: ALL SUBJECTS NOTEBOOK OVERVIEW */}
        {modalTab === 'all-courses' && (
          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            <p className="text-xs text-[#6B705C]">
              Configure independent Gemini Notebook links for each subject in one place. Multiple subjects can share the same notebook link if desired.
            </p>

            {allSubjects.map(sub => {
              const val = bulkUrls[sub.id] !== undefined ? bulkUrls[sub.id] : (sub.geminiNotebookUrl || '');
              const isLinked = !!sub.geminiNotebookUrl;

              return (
                <div
                  key={sub.id}
                  className={`p-3.5 rounded-2xl border transition space-y-2 ${
                    sub.id === activeSubject.id
                      ? 'bg-amber-50/40 border-amber-200'
                      : 'bg-white border-[#E0DBD0]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base">{sub.icon || '📚'}</span>
                      <span className="font-bold text-xs text-[#4A4E4D] truncate">{sub.name}</span>
                      {isLinked ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Linked</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-[#F2EFE9] text-[#A5A58D] text-[10px] font-mono">
                          No Link
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isLinked && (
                        <a
                          href={sub.geminiNotebookUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg bg-[#F2EFE9] hover:bg-[#EAE7DF] text-[#6B705C] transition cursor-pointer"
                          title={`Open ${sub.name} in NotebookLM`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => handleCopyGuide(sub)}
                        className="px-2 py-1 rounded-lg bg-[#F2EFE9] hover:bg-[#EAE7DF] text-[#6B705C] text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                        title={`Copy ${sub.name} syllabus source`}
                      >
                        <Copy className="w-3 h-3" />
                        <span>Source</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={val}
                      onChange={(e) => setBulkUrls(prev => ({ ...prev, [sub.id]: e.target.value }))}
                      placeholder="https://notebooklm.google.com/notebook/..."
                      className="flex-1 px-3 py-1.5 rounded-xl bg-[#F9F7F2] border border-[#E0DBD0] text-xs font-mono text-[#4A4E4D] focus:outline-none focus:ring-1 focus:ring-[#6B705C]"
                    />
                    <button
                      onClick={() => handleSaveSingleSubjectUrl(sub.id)}
                      className="px-3 py-1.5 rounded-xl bg-[#6B705C] hover:bg-[#5A5E4E] text-white text-xs font-bold transition cursor-pointer shrink-0"
                    >
                      Save
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: LINK COMPANION SUBJECTS */}
        {modalTab === 'companion-links' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-2">
              <h4 className="font-bold text-xs text-[#4A4E4D] flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-[#6B705C]" />
                <span>Companion Courses for {activeSubject.name}</span>
              </h4>
              <p className="text-xs text-[#6B705C] leading-relaxed">
                Connect related or prerequisite courses (such as Physics ↔ Mathematics or Organic Chemistry ↔ General Chemistry). Companion courses appear as quick shortcuts in your course header and can share reference materials.
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold text-[#A5A58D] uppercase tracking-wider font-mono">
                Select courses to link with {activeSubject.name}:
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {allSubjects.filter(s => s.id !== activeSubject.id).map(sub => {
                  const isLinked = (activeSubject.linkedSubjectIds || []).includes(sub.id);

                  return (
                    <div
                      key={sub.id}
                      onClick={() => handleToggleCompanion(sub.id)}
                      className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-2 ${
                        isLinked
                          ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 shadow-2xs'
                          : 'bg-white border-[#E0DBD0] text-[#4A4E4D] hover:bg-[#F9F7F2]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base shrink-0">{sub.icon || '📚'}</span>
                        <div className="min-w-0">
                          <div className="font-bold text-xs truncate">{sub.name}</div>
                          <div className="text-[10px] text-[#A5A58D] truncate">
                            {sub.chapters.length} units • {sub.geminiNotebookUrl ? 'Notebook linked' : 'No notebook'}
                          </div>
                        </div>
                      </div>

                      <span className={`w-5 h-5 rounded-lg flex items-center justify-center border text-xs font-bold shrink-0 ${
                        isLinked
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white border-[#E0DBD0] text-transparent'
                      }`}>
                        ✓
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {linkedCompanionSubjects.length > 0 && (
              <div className="p-3 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-xs">
                <span className="font-bold text-[#4A4E4D] block mb-1">Currently Linked Companions:</span>
                <div className="flex flex-wrap gap-1.5">
                  {linkedCompanionSubjects.map(cs => (
                    <span key={cs.id} className="px-2.5 py-1 rounded-xl bg-white border border-[#E0DBD0] font-medium text-[11px] text-[#4A4E4D] flex items-center gap-1">
                      <span>{cs.icon || '📚'}</span>
                      <span>{cs.name}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal Action Footer */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2.5 border-t border-[#E0DBD0]">
          <a
            href="https://notebooklm.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-4 py-2 rounded-full bg-[#F2EFE9] hover:bg-[#EAE7DF] text-[#6B705C] border border-[#E0DBD0] text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <span>Open Google NotebookLM</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-full bg-[#6B705C] hover:bg-[#5A5E4E] text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
