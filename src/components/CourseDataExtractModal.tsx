import React, { useState, useMemo } from 'react';
import { 
  X, 
  Download, 
  Copy, 
  Check, 
  FileText, 
  Code, 
  Sparkles, 
  Database, 
  ExternalLink,
  Layers,
  BookOpen,
  FileCheck,
  Archive,
  Clock
} from 'lucide-react';
import { Subject, TestResult, StudySession, UserNote, StorageVault, FlashcardDeck, UserProfile } from '../types';

interface CourseDataExtractModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSubject: Subject;
  allSubjects: Subject[];
  testResults: TestResult[];
  sessions: StudySession[];
  notes: UserNote[];
  vaults: StorageVault[];
  flashcardDecks: FlashcardDeck[];
  userProfile?: UserProfile | null;
}

export const CourseDataExtractModal: React.FC<CourseDataExtractModalProps> = ({
  isOpen,
  onClose,
  activeSubject,
  allSubjects,
  testResults,
  sessions,
  notes,
  vaults,
  flashcardDecks,
  userProfile
}) => {
  const [scope, setScope] = useState<'active' | 'all'>('active');
  const [format, setFormat] = useState<'markdown' | 'json' | 'text'>('markdown');
  const [includeSyllabus, setIncludeSyllabus] = useState(true);
  const [includeTests, setIncludeTests] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeVaults, setIncludeVaults] = useState(true);
  const [includeSessions, setIncludeSessions] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  // Determine subjects in scope
  const targetSubjects = useMemo(() => {
    return scope === 'active' ? [activeSubject] : allSubjects;
  }, [scope, activeSubject, allSubjects]);

  // Generate Extracted Content based on current options
  const extractedContent = useMemo(() => {
    if (format === 'json') {
      const payload = {
        metadata: {
          exportedAt: new Date().toISOString(),
          scope: scope === 'active' ? `Subject: ${activeSubject.name}` : 'All Enrolled Subjects',
          student: userProfile?.displayName || 'Student',
          academicYear: userProfile?.academicYear || 'Current Year'
        },
        subjects: targetSubjects.map(sub => {
          const subTests = testResults.filter(t => t.subjectName.toLowerCase() === sub.name.toLowerCase());
          const subSessions = sessions.filter(s => s.subjectName?.toLowerCase() === sub.name.toLowerCase());
          const subNotes = notes.filter(n => n.subjectName?.toLowerCase() === sub.name.toLowerCase());
          const subDecks = flashcardDecks.filter(d => d.subjectName?.toLowerCase() === sub.name.toLowerCase());
          const subVaults = vaults.filter(v => v.subjectName?.toLowerCase() === sub.name.toLowerCase());
          
          const companionSubjects = (sub.linkedSubjectIds || []).map(id => {
            const found = allSubjects.find(s => s.id === id);
            return found ? { id: found.id, name: found.name } : null;
          }).filter(Boolean);

          return {
            id: sub.id,
            name: sub.name,
            icon: sub.icon,
            description: sub.description,
            geminiNotebookUrl: sub.geminiNotebookUrl || null,
            linkedCompanions: companionSubjects,
            ...(includeSyllabus ? {
              syllabus: {
                totalUnits: sub.chapters.length,
                totalTopics: sub.chapters.reduce((acc, c) => acc + c.topics.length, 0),
                chapters: sub.chapters.map((ch, idx) => ({
                  unitNumber: idx + 1,
                  name: ch.name,
                  topics: ch.topics.map(t => ({
                    name: t.name,
                    status: t.status || 'Not Started',
                    estimatedMinutes: t.estimatedMinutes || 45,
                    subtopics: (t.subtopics || []).map(st => st.name)
                  }))
                }))
              }
            } : {}),
            ...(includeTests ? {
              testRecords: subTests.map(t => ({
                id: t.id,
                testName: t.testName,
                testNumber: t.testNumber,
                score: t.score,
                date: t.date,
                mistakes: t.mistakes || null,
                correctionPrompts: t.correctionPrompts || t.analysis?.tutorPrompts || []
              }))
            } : {}),
            ...(includeNotes ? {
              notes: subNotes.map(n => ({ id: n.id, title: n.title, content: n.content, updatedAt: n.updatedAt })),
              flashcardDecks: subDecks.map(d => ({ id: d.id, title: d.title, totalCards: d.cards.length, cards: d.cards }))
            } : {}),
            ...(includeVaults ? {
              vaultDocuments: subVaults.map(v => ({ id: v.id, name: v.name, category: v.category, description: v.description, tags: v.tags }))
            } : {}),
            ...(includeSessions ? {
              studySessionsCount: subSessions.length,
              totalMinutesStudied: subSessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0),
              recentSessions: subSessions.slice(0, 15).map(s => ({
                topicName: s.topicName,
                chapterName: s.chapterName,
                durationMinutes: s.durationMinutes,
                date: s.date,
                result: s.result
              }))
            } : {})
          };
        })
      };
      return JSON.stringify(payload, null, 2);
    }

    if (format === 'markdown') {
      let md = `# Academic Curriculum & Study Package Extraction\n`;
      md += `*Generated:* ${new Date().toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}\n`;
      md += `*Scope:* ${scope === 'active' ? `Subject: **${activeSubject.name}**` : `**All Subjects (${allSubjects.length})**`}\n`;
      if (userProfile?.displayName) md += `*Student:* ${userProfile.displayName}\n`;
      if (userProfile?.academicYear) md += `*Academic Year:* ${userProfile.academicYear}\n`;
      md += `\n---\n\n`;

      targetSubjects.forEach((sub, sIdx) => {
        const subTests = testResults.filter(t => t.subjectName.toLowerCase() === sub.name.toLowerCase());
        const subSessions = sessions.filter(s => s.subjectName?.toLowerCase() === sub.name.toLowerCase());
        const subNotes = notes.filter(n => n.subjectName?.toLowerCase() === sub.name.toLowerCase());
        const subDecks = flashcardDecks.filter(d => d.subjectName?.toLowerCase() === sub.name.toLowerCase());
        const subVaults = vaults.filter(v => v.subjectName?.toLowerCase() === sub.name.toLowerCase());

        const companionNames = (sub.linkedSubjectIds || [])
          .map(id => allSubjects.find(s => s.id === id)?.name)
          .filter(Boolean);

        const totalTopics = sub.chapters.reduce((acc, c) => acc + c.topics.length, 0);
        const completedTopics = sub.chapters.reduce((acc, c) => acc + c.topics.filter(t => t.status === 'Completed' || t.status === 'Mastered').length, 0);

        md += `## Course ${sIdx + 1}: ${sub.icon || '📚'} ${sub.name}\n\n`;
        if (sub.description) md += `> ${sub.description}\n\n`;
        md += `- **Gemini Notebook (NotebookLM):** ${sub.geminiNotebookUrl ? sub.geminiNotebookUrl : '*Not linked yet*'}\n`;
        if (companionNames.length > 0) {
          md += `- **Linked Companion Subjects:** ${companionNames.join(', ')}\n`;
        }
        md += `- **Progress:** ${completedTopics}/${totalTopics} topics completed (${totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0}%)\n\n`;

        if (includeSyllabus) {
          md += `### Syllabus & Topic Breakdown\n\n`;
          sub.chapters.forEach((ch, cIdx) => {
            md += `#### Unit ${cIdx + 1}: ${ch.name}\n`;
            ch.topics.forEach(t => {
              const statusTag = t.status ? `[${t.status}]` : '[Planned]';
              md += `- ${statusTag} **${t.name}** (${t.estimatedMinutes || 45} mins)`;
              if (t.subtopics && t.subtopics.length > 0) {
                md += `\n  - Subtopics: ${t.subtopics.map(st => st.name).join(', ')}`;
              }
              md += `\n`;
            });
            md += `\n`;
          });
        }

        if (includeTests && subTests.length > 0) {
          md += `### Test Papers, Mistake Logs & Correction Areas\n\n`;
          subTests.forEach(t => {
            md += `#### ${t.testName} (Score: ${t.score})\n`;
            md += `- **Date:** ${t.date} ${t.testNumber ? `• ${t.testNumber}` : ''}\n`;
            if (t.mistakes) {
              md += `- **Mistakes & Gaps:** ${t.mistakes}\n`;
            }
            const prompts = t.correctionPrompts || t.analysis?.tutorPrompts || [];
            if (prompts.length > 0) {
              md += `- **AI Correction Prompts:**\n`;
              prompts.forEach(p => md += `  - "${p}"\n`);
            }
            md += `\n`;
          });
        }

        if (includeNotes && (subNotes.length > 0 || subDecks.length > 0)) {
          md += `### Active Recall Notes & Flashcards\n\n`;
          if (subNotes.length > 0) {
            md += `**Study Notes:**\n`;
            subNotes.forEach(n => {
              md += `- **${n.title}:** ${n.content}\n`;
            });
            md += `\n`;
          }
          if (subDecks.length > 0) {
            md += `**Flashcard Decks:**\n`;
            subDecks.forEach(d => {
              md += `- **${d.title}** (${d.cards.length} cards)\n`;
              d.cards.slice(0, 5).forEach(c => {
                md += `  - Q: ${c.front} | A: ${c.back}\n`;
              });
            });
            md += `\n`;
          }
        }

        if (includeVaults && subVaults.length > 0) {
          md += `### Course Documents & Vault Materials\n\n`;
          subVaults.forEach(v => {
            md += `- **${v.name}** [${v.category || 'Material'}] ${v.chapterName ? `(${v.chapterName})` : ''}\n`;
            if (v.description) md += `  - *Description:* ${v.description}\n`;
            if (v.tags && v.tags.length > 0) md += `  - *Tags:* #${v.tags.join(' #')}\n`;
          });
          md += `\n`;
        }

        if (includeSessions && subSessions.length > 0) {
          const totalMins = subSessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
          md += `### Study Sessions & Focus History\n\n`;
          md += `Total Studied: ${(totalMins / 60).toFixed(1)} hours across ${subSessions.length} sessions.\n\n`;
          subSessions.slice(0, 10).forEach(s => {
            md += `- **${s.date}:** ${s.topicName || 'Session'} (${s.durationMinutes} mins) — *${s.result}*\n`;
          });
          md += `\n`;
        }

        md += `---\n\n`;
      });

      return md;
    }

    // Plain text format
    let txt = `ACADEMIC CURRICULUM & STUDY PACKAGE EXTRACTION\n`;
    txt += `Date: ${new Date().toLocaleString()}\n`;
    txt += `Scope: ${scope === 'active' ? activeSubject.name : 'All Subjects'}\n`;
    txt += `==========================================================\n\n`;

    targetSubjects.forEach(sub => {
      txt += `COURSE: ${sub.name}\n`;
      if (sub.description) txt += `Description: ${sub.description}\n`;
      txt += `Gemini Notebook: ${sub.geminiNotebookUrl || 'Not linked'}\n`;
      txt += `----------------------------------------------------------\n`;

      if (includeSyllabus) {
        txt += `\n[SYLLABUS]\n`;
        sub.chapters.forEach((ch, idx) => {
          txt += `Unit ${idx + 1}: ${ch.name}\n`;
          ch.topics.forEach(t => {
            txt += `  - [${t.status || 'Planned'}] ${t.name} (${t.estimatedMinutes || 45}m)\n`;
          });
        });
      }

      const subTests = testResults.filter(t => t.subjectName.toLowerCase() === sub.name.toLowerCase());
      if (includeTests && subTests.length > 0) {
        txt += `\n[TEST PAPERS & MISTAKES]\n`;
        subTests.forEach(t => {
          txt += `* ${t.testName} - Score: ${t.score} (${t.date})\n`;
          if (t.mistakes) txt += `  Mistakes: ${t.mistakes}\n`;
        });
      }

      txt += `\n==========================================================\n\n`;
    });

    return txt;
  }, [
    format,
    scope,
    targetSubjects,
    activeSubject,
    allSubjects,
    testResults,
    sessions,
    notes,
    vaults,
    flashcardDecks,
    userProfile,
    includeSyllabus,
    includeTests,
    includeNotes,
    includeVaults,
    includeSessions
  ]);

  const wordCount = useMemo(() => {
    return extractedContent.trim().split(/\s+/).length;
  }, [extractedContent]);

  const charCount = extractedContent.length;

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(extractedContent);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  const handleDownload = () => {
    const extension = format === 'json' ? 'json' : format === 'markdown' ? 'md' : 'txt';
    const mimeType = format === 'json' ? 'application/json' : 'text/plain';
    const cleanSubjName = scope === 'active' 
      ? activeSubject.name.toLowerCase().replace(/[^a-z0-9]/gi, '_')
      : 'all_subjects_curriculum';
    const fileName = `${cleanSubjName}_export.${extension}`;

    const blob = new Blob([extractedContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white border border-[#E0DBD0] rounded-3xl p-5 sm:p-6 shadow-2xl max-w-3xl w-full space-y-4 my-8">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#E0DBD0] pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F2EFE9] text-[#6B705C] border border-[#E0DBD0] flex items-center justify-center font-bold">
              <Database className="w-5 h-5 text-[#6B705C]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-serif italic font-bold text-[#4A4E4D]">
                Extract Course & Curriculum Data
              </h3>
              <p className="text-xs text-[#6B705C]">
                Export complete syllabus, test benchmarks, mistake logs, and study materials for Gemini NotebookLM or backup
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

        {/* Extraction Settings: Scope & Format Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-[#F9F7F2] p-3.5 rounded-2xl border border-[#E0DBD0] text-xs">
          {/* Scope selection */}
          <div className="space-y-1.5">
            <label className="font-bold text-[#4A4E4D] flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[#6B705C]" />
              <span>Extraction Scope:</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setScope('active')}
                className={`flex-1 py-1.5 px-3 rounded-xl font-bold transition cursor-pointer border ${
                  scope === 'active'
                    ? 'bg-[#6B705C] text-white border-[#6B705C] shadow-xs'
                    : 'bg-white text-[#4A4E4D] border-[#E0DBD0] hover:bg-[#F2EFE9]'
                }`}
              >
                {activeSubject.name} Only
              </button>
              <button
                onClick={() => setScope('all')}
                className={`flex-1 py-1.5 px-3 rounded-xl font-bold transition cursor-pointer border ${
                  scope === 'all'
                    ? 'bg-[#6B705C] text-white border-[#6B705C] shadow-xs'
                    : 'bg-white text-[#4A4E4D] border-[#E0DBD0] hover:bg-[#F2EFE9]'
                }`}
              >
                All Subjects ({allSubjects.length})
              </button>
            </div>
          </div>

          {/* Format selection */}
          <div className="space-y-1.5">
            <label className="font-bold text-[#4A4E4D] flex items-center gap-1.5">
              <Code className="w-3.5 h-3.5 text-[#6B705C]" />
              <span>Export Format:</span>
            </label>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setFormat('markdown')}
                className={`flex-1 py-1.5 px-2.5 rounded-xl font-bold transition cursor-pointer border ${
                  format === 'markdown'
                    ? 'bg-[#6B705C] text-white border-[#6B705C] shadow-xs'
                    : 'bg-white text-[#4A4E4D] border-[#E0DBD0] hover:bg-[#F2EFE9]'
                }`}
                title="Best for Google NotebookLM source text upload or reading"
              >
                Markdown (.md)
              </button>
              <button
                onClick={() => setFormat('json')}
                className={`flex-1 py-1.5 px-2.5 rounded-xl font-bold transition cursor-pointer border ${
                  format === 'json'
                    ? 'bg-[#6B705C] text-white border-[#6B705C] shadow-xs'
                    : 'bg-white text-[#4A4E4D] border-[#E0DBD0] hover:bg-[#F2EFE9]'
                }`}
                title="Structured data for APIs, developer scripts or backup"
              >
                JSON (.json)
              </button>
              <button
                onClick={() => setFormat('text')}
                className={`flex-1 py-1.5 px-2.5 rounded-xl font-bold transition cursor-pointer border ${
                  format === 'text'
                    ? 'bg-[#6B705C] text-white border-[#6B705C] shadow-xs'
                    : 'bg-white text-[#4A4E4D] border-[#E0DBD0] hover:bg-[#F2EFE9]'
                }`}
              >
                Plain Text
              </button>
            </div>
          </div>
        </div>

        {/* Data Sections Toggle Checkboxes */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-[#A5A58D] uppercase tracking-wider font-mono">
            Data Elements to Include:
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F9F7F2] border border-[#E0DBD0] cursor-pointer hover:bg-[#F2EFE9]">
              <input
                type="checkbox"
                checked={includeSyllabus}
                onChange={(e) => setIncludeSyllabus(e.target.checked)}
                className="rounded accent-[#6B705C]"
              />
              <span className="font-medium text-[#4A4E4D]">Syllabus & Units</span>
            </label>

            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F9F7F2] border border-[#E0DBD0] cursor-pointer hover:bg-[#F2EFE9]">
              <input
                type="checkbox"
                checked={includeTests}
                onChange={(e) => setIncludeTests(e.target.checked)}
                className="rounded accent-[#6B705C]"
              />
              <span className="font-medium text-[#4A4E4D]">Test Papers & Mistakes</span>
            </label>

            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F9F7F2] border border-[#E0DBD0] cursor-pointer hover:bg-[#F2EFE9]">
              <input
                type="checkbox"
                checked={includeNotes}
                onChange={(e) => setIncludeNotes(e.target.checked)}
                className="rounded accent-[#6B705C]"
              />
              <span className="font-medium text-[#4A4E4D]">Notes & Flashcards</span>
            </label>

            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F9F7F2] border border-[#E0DBD0] cursor-pointer hover:bg-[#F2EFE9]">
              <input
                type="checkbox"
                checked={includeVaults}
                onChange={(e) => setIncludeVaults(e.target.checked)}
                className="rounded accent-[#6B705C]"
              />
              <span className="font-medium text-[#4A4E4D]">Vault Materials</span>
            </label>

            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F9F7F2] border border-[#E0DBD0] cursor-pointer hover:bg-[#F2EFE9]">
              <input
                type="checkbox"
                checked={includeSessions}
                onChange={(e) => setIncludeSessions(e.target.checked)}
                className="rounded accent-[#6B705C]"
              />
              <span className="font-medium text-[#4A4E4D]">Study Focus Logs</span>
            </label>
          </div>
        </div>

        {/* Live Preview Window */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-[#A5A58D]">
            <span className="font-mono uppercase tracking-wider font-bold">Extraction Live Preview</span>
            <span className="font-mono">{wordCount.toLocaleString()} words • {charCount.toLocaleString()} characters</span>
          </div>
          <div className="relative">
            <textarea
              readOnly
              value={extractedContent}
              rows={9}
              className="w-full p-3.5 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] font-mono text-xs text-[#4A4E4D] leading-relaxed resize-none focus:outline-none"
            />
          </div>
        </div>

        {/* Quick Grounding Hint for NotebookLM */}
        {format === 'markdown' && (
          <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200/90 flex items-center justify-between gap-3 text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Ready for Google NotebookLM:</strong> Copy this Markdown data, open NotebookLM, and paste as a text source to train Gemini on your entire curriculum and test history.
              </span>
            </div>
            <a
              href="https://notebooklm.google.com/"
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded-xl bg-amber-200/80 hover:bg-amber-300 text-amber-950 font-bold text-[11px] flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <span>Open NotebookLM</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Action Footer */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-full text-xs font-bold text-[#A5A58D] hover:text-[#4A4E4D] transition cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={handleCopy}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-full bg-[#F2EFE9] hover:bg-[#EAE7DF] text-[#4A4E4D] border border-[#E0DBD0] text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#6B705C]" />}
              <span>{isCopied ? 'Copied to Clipboard!' : 'Copy Extracted Data'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-full bg-[#6B705C] hover:bg-[#5A5E4E] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download File (.{format === 'json' ? 'json' : format === 'markdown' ? 'md' : 'txt'})</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
