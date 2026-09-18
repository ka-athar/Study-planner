import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Brain, 
  AlertTriangle, 
  CheckCircle2, 
  Download, 
  Copy, 
  Check, 
  X, 
  Mail, 
  Sparkles, 
  Printer, 
  Layers, 
  Flame, 
  Target, 
  TrendingUp, 
  FileText 
} from 'lucide-react';
import { Subject, TestResult, StudySession, UserProfile } from '../types';

interface DiagnosticReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  testResults: TestResult[];
  sessions: StudySession[];
  userProfile?: UserProfile | null;
  onSendPromptToTutor?: (prompt: string) => void;
}

export const DiagnosticReportModal: React.FC<DiagnosticReportModalProps> = ({
  isOpen,
  onClose,
  subjects,
  testResults,
  sessions,
  userProfile,
  onSendPromptToTutor
}) => {
  const [copiedText, setCopiedText] = useState(false);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');

  if (!isOpen) return null;

  const filteredTests = selectedSubjectFilter === 'all'
    ? testResults
    : testResults.filter(t => t.subjectName.toLowerCase() === selectedSubjectFilter.toLowerCase());

  // Aggregate diagnostic statistics
  const totalTests = filteredTests.length;
  const avgScore = totalTests > 0
    ? Math.round(filteredTests.reduce((acc, t) => acc + (t.percentage || t.scorePercentage || (t.obtainedMarks && t.totalMarks ? (t.obtainedMarks / t.totalMarks) * 100 : 75)), 0) / totalTests)
    : 0;

  // Extract struggled topics & mistakes
  const allStruggledTopics: { topic: string; subject: string; count: number }[] = [];
  const topicCountMap: Record<string, { subject: string; count: number }> = {};

  filteredTests.forEach(t => {
    if (Array.isArray(t.struggledTopics)) {
      t.struggledTopics.forEach(st => {
        const key = st.trim();
        if (!key) return;
        if (!topicCountMap[key]) {
          topicCountMap[key] = { subject: t.subjectName, count: 0 };
        }
        topicCountMap[key].count += 1;
      });
    }
  });

  Object.entries(topicCountMap).forEach(([topic, data]) => {
    allStruggledTopics.push({ topic, subject: data.subject, count: data.count });
  });

  allStruggledTopics.sort((a, b) => b.count - a.count);

  // Generate complete diagnostic markdown report text
  const generateMarkdownReport = (): string => {
    const studentName = userProfile?.displayName || userProfile?.name || 'Student';
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    let md = `# 📊 Comprehensive Exam Diagnostic & Remedial Action Report\n`;
    md += `**Student:** ${studentName} | **Date:** ${dateStr} | **Total Tests Evaluated:** ${totalTests} | **Average Mastery:** ${avgScore}%\n\n`;
    md += `---\n\n`;

    md += `## 1. Executive Diagnostic Summary\n`;
    if (avgScore >= 85) {
      md += `Overall academic trajectory is in the **Advanced / Honors** band. Primary focus should remain on speed drills, multi-step synthesis, and zeroing out rare edge-case oversights.\n\n`;
    } else if (avgScore >= 70) {
      md += `Overall academic trajectory is in the **Proficient** band. Solid core fundamentals, but recurring bottlenecks exist in specific technical subsections.\n\n`;
    } else {
      md += `Overall diagnostic indicates **High Vulnerability** across key chapters. Immediate active recall and spaced repetition drills are recommended.\n\n`;
    }

    md += `## 2. High-Yield Weak Spots & Recurrent Bottlenecks\n`;
    if (allStruggledTopics.length > 0) {
      allStruggledTopics.slice(0, 8).forEach((st, idx) => {
        md += `${idx + 1}. **${st.topic}** (${st.subject}) — Flagged in ${st.count} diagnostic evaluation(s)\n`;
      });
      md += `\n`;
    } else {
      md += `No critical recurring topic bottlenecks identified in current log.\n\n`;
    }

    md += `## 3. Sectional Test Audit Log\n`;
    filteredTests.slice(0, 10).forEach(t => {
      const scoreStr = t.percentage ? `${t.percentage}%` : t.score;
      md += `### • ${t.testName} (${t.subjectName})\n`;
      md += `- **Score:** ${scoreStr} | **Date:** ${t.date || 'Recent'}\n`;
      if (t.mistakes) md += `- **Identified Mistake Log:** ${t.mistakes}\n`;
      if (t.correctionNotes) md += `- **Correction Strategy:** ${t.correctionNotes}\n`;
      md += `\n`;
    });

    md += `## 4. Prescribed Remedial Action Plan\n`;
    md += `1. **Spaced Retrieval Sessions:** Dedicate 45 minutes daily to the top 3 weak topics listed above.\n`;
    md += `2. **Targeted Flashcards:** Review high-yield formula sheets and flashcard decks associated with these chapters.\n`;
    md += `3. **Timed Re-Test:** Retake an isolated 30-minute vault diagnostic drill within 72 hours.\n`;

    return md;
  };

  const reportText = generateMarkdownReport();

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Diagnostic Report - StudyOS</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #1e293b; padding: 40px; max-width: 800px; margin: 0 auto; }
            h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; font-size: 22px; }
            h2 { color: #334155; margin-top: 24px; font-size: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
            h3 { color: #059669; margin-top: 16px; font-size: 14px; }
            p, li { font-size: 13px; }
            .badge { display: inline-block; padding: 3px 8px; border-radius: 6px; background: #f1f5f9; font-weight: bold; font-size: 12px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <pre style="white-space: pre-wrap; font-family: inherit;">${reportText.replace(/#/g, '')}</pre>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
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
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-primary">Diagnostic Analysis & Remedial Action Report</h2>
              <p className="text-xs text-muted">Comprehensive analytical breakdown of error categories, weak spots, and improvement prescriptions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted hover:text-primary rounded-lg hover:bg-theme-accent transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="px-6 py-3 border-b border-theme bg-theme-surface/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted">Filter Subject:</span>
            <select
              value={selectedSubjectFilter}
              onChange={(e) => setSelectedSubjectFilter(e.target.value)}
              className="bg-theme-surface border border-theme rounded-lg px-2.5 py-1 text-xs text-primary focus:outline-hidden"
            >
              <option value="all">All Subjects ({testResults.length} Tests)</option>
              {subjects.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg border border-theme bg-theme-surface hover:bg-theme-accent text-primary text-xs font-semibold transition flex items-center gap-1.5"
            >
              {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedText ? 'Copied' : 'Copy Report'}
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / PDF
            </button>
          </div>
        </div>

        {/* Body Report Preview */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm font-sans">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl border border-theme bg-theme-surface/50">
              <span className="text-xs text-muted font-medium">Tests Evaluated</span>
              <p className="text-xl font-bold text-primary mt-0.5">{totalTests} Tests</p>
            </div>
            <div className="p-3.5 rounded-xl border border-theme bg-theme-surface/50">
              <span className="text-xs text-muted font-medium">Average Performance</span>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{avgScore}%</p>
            </div>
            <div className="p-3.5 rounded-xl border border-theme bg-theme-surface/50">
              <span className="text-xs text-muted font-medium">Critical Weak Spots</span>
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{allStruggledTopics.length} Topics</p>
            </div>
          </div>

          {/* Formatted Text Box */}
          <div className="p-4 rounded-xl border border-theme bg-theme-surface/30 font-mono text-xs text-primary leading-relaxed whitespace-pre-wrap select-all">
            {reportText}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
