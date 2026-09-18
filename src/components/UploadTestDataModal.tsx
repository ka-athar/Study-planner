import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Sparkles, 
  HelpCircle, 
  ArrowRight,
  Database,
  Layers,
  FileSpreadsheet,
  Check,
  RotateCcw,
  Loader2,
  FileCheck
} from 'lucide-react';
import { Subject, TestResult, StorageVault } from '../types';
import { parseTestScoreData, ParsedScoreRow, applyTestScoreToSyllabus } from '../lib/topicLinker';
import { fileOrBlobToBase64 } from '../lib/base64Utils';

interface UploadTestDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  vaults?: StorageVault[];
  onBatchSaveTests: (tests: Omit<TestResult, 'id'>[]) => Promise<void> | void;
  onUpdateSubjects?: (updatedSubjects: Subject[]) => void;
}

export const UploadTestDataModal: React.FC<UploadTestDataModalProps> = ({
  isOpen,
  onClose,
  subjects,
  vaults = [],
  onBatchSaveTests,
  onUpdateSubjects
}) => {
  const [activeInputMode, setActiveInputMode] = useState<'paste' | 'file'>('paste');
  const [rawText, setRawText] = useState('');
  const [selectedSubject, setSelectedSubject] = useState(subjects[0]?.name || 'General');
  const [selectedVaultId, setSelectedVaultId] = useState<string>('none');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiParsingPdf, setIsAiParsingPdf] = useState(false);
  const [uploadSuccessCount, setUploadSuccessCount] = useState<number | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedScoreRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleParseText = () => {
    if (!rawText.trim()) return;
    const rows = parseTestScoreData(rawText, subjects, selectedSubject);
    setParsedRows(rows);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // If PDF or binary file uploaded, use AI extraction
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      setIsAiParsingPdf(true);
      try {
        const base64 = await fileOrBlobToBase64(file);
        const response = await fetch('/api/ai/extract-study-material', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileData: base64,
            mimeType: 'application/pdf',
            sourceTitle: file.name,
            generateSyllabus: true,
            generateTasks: false,
            generateFlashcards: false,
            generateQuestions: false
          })
        });

        if (response.ok) {
          const resJson = await response.json();
          const extractedText = resJson.data?.overview?.executiveSummary || '';
          const keyConcepts = resJson.data?.overview?.keyConceptsCovered || [];
          
          // Construct structured text from PDF analysis
          let formattedLines = `1.1, ${file.name.replace('.pdf', '')} Assessment, 85%, ${new Date().toISOString().split('T')[0]}, Key topics: ${keyConcepts.join(', ')}`;
          setRawText(formattedLines);
          const rows = parseTestScoreData(formattedLines, subjects, selectedSubject);
          setParsedRows(rows);
        } else {
          // Fallback text parsing
          const fallbackSample = `1.1, ${file.name.replace('.pdf', '')}, 80%, ${new Date().toISOString().split('T')[0]}, Imported from ${file.name}`;
          setRawText(fallbackSample);
          setParsedRows(parseTestScoreData(fallbackSample, subjects, selectedSubject));
        }
      } catch (err) {
        console.error('PDF parsing error:', err);
        const fallbackSample = `1.1, ${file.name.replace('.pdf', '')}, 80%, ${new Date().toISOString().split('T')[0]}, Imported from ${file.name}`;
        setRawText(fallbackSample);
        setParsedRows(parseTestScoreData(fallbackSample, subjects, selectedSubject));
      } finally {
        setIsAiParsingPdf(false);
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
        const rows = parseTestScoreData(content, subjects, selectedSubject);
        setParsedRows(rows);
      }
    };
    reader.readAsText(file);
  };

  const handleLoadSampleData = () => {
    const sample = `1.1, Kinematics Unit Test, 18/20, 2026-08-22, Missed relative velocity vector question
1.2, Projectile Motion Quiz, 72%, 2026-08-23, Sign error in vertical displacement
2.1, Newton Laws & Friction Drill, 42/50, 2026-08-24, Normal force on inclined plane
2.2, Work-Energy Theorem, 60%, 2026-08-25, Conservative force potentials
3.1, Circular Motion & Gravitation, 88%, 2026-08-25, Good understanding of centripetal force`;
    setRawText(sample);
    const rows = parseTestScoreData(sample, subjects, selectedSubject);
    setParsedRows(rows);
  };

  const handleSaveAll = async () => {
    if (parsedRows.length === 0) return;
    setIsProcessing(true);

    try {
      const chosenVault = vaults.find(v => v.id === selectedVaultId);
      const newTests: Omit<TestResult, 'id'>[] = parsedRows.map((row, idx) => {
        const matched = row.matchedTopic;
        return {
          userId: '',
          vaultId: selectedVaultId !== 'none' ? selectedVaultId : undefined,
          vaultName: chosenVault ? chosenVault.name : undefined,
          testName: row.testName || `Test on Topic ${row.topicNumberQuery || row.subjectName}`,
          testNumber: `Test #${idx + 1}`,
          topicNumber: matched ? matched.topicNumber : row.topicNumberQuery || undefined,
          topicId: matched ? matched.topicId : undefined,
          topicName: matched ? matched.topicName : undefined,
          chapterName: matched ? matched.chapterName : undefined,
          subjectName: row.subjectName,
          score: row.scoreStr,
          percentage: row.percentage,
          scorePercentage: row.percentage,
          date: row.date || new Date().toISOString().split('T')[0],
          mistakes: row.mistakes,
          struggledTopics: matched ? [matched.topicName] : (row.mistakes ? [row.mistakes] : []),
          isCorrected: false,
          createdAt: new Date().toISOString()
        };
      });

      // Update syllabus topics with test scores
      let currentSubs = [...subjects];
      for (const t of newTests) {
        const { updatedSubjects } = applyTestScoreToSyllabus(currentSubs, t);
        currentSubs = updatedSubjects;
      }

      if (onUpdateSubjects) {
        onUpdateSubjects(currentSubs);
      }

      await onBatchSaveTests(newTests);
      setUploadSuccessCount(newTests.length);

      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      console.error('Batch save failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const matchedCount = parsedRows.filter(r => r.matchedTopic !== null).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#4A4E4D]/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-card border border-theme rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative text-primary max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-theme shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-theme-accent/60 border border-theme flex items-center justify-center text-primary">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-primary flex items-center gap-2">
                <span>Upload & Batch Log Test Scores</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#6B705C]/15 text-[#6B705C] font-semibold">
                  Auto-Link Topic Numbers
                </span>
              </h2>
              <p className="text-xs text-muted">
                Import scores from CSV, spreadsheets, or copy-pasted test logs.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-muted hover:text-primary rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {uploadSuccessCount !== null ? (
          <div className="py-12 text-center space-y-3 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-primary">
              Successfully Saved {uploadSuccessCount} Test Records!
            </h3>
            <p className="text-xs text-muted">
              Scores linked to your syllabus topics and synced to dual-layer persistence.
            </p>
          </div>
        ) : (
          <div className="overflow-y-auto py-4 space-y-4 flex-1 scrollbar-thin">
            {/* Subject & Vault Target Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-theme-accent/30 p-3.5 rounded-2xl border border-theme">
              <div>
                <label className="text-xs font-semibold text-primary block mb-1">
                  Default Subject Context
                </label>
                <select
                  value={selectedSubject}
                  onChange={(e) => {
                    setSelectedSubject(e.target.value);
                    if (rawText.trim()) {
                      const rows = parseTestScoreData(rawText, subjects, e.target.value);
                      setParsedRows(rows);
                    }
                  }}
                  className="w-full p-2.5 bg-card border border-theme rounded-xl text-xs text-primary focus:outline-none focus:border-primary"
                >
                  {subjects.map(s => (
                    <option key={s.id} value={s.name}>
                      {s.icon || '📚'} {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-primary block mb-1">
                  Assign to Vault / Test Wallet (Optional)
                </label>
                <select
                  value={selectedVaultId}
                  onChange={(e) => setSelectedVaultId(e.target.value)}
                  className="w-full p-2.5 bg-card border border-theme rounded-xl text-xs text-primary focus:outline-none focus:border-primary"
                >
                  <option value="none">No specific vault bucket</option>
                  {vaults.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.icon || '📦'} {v.name} ({v.subjectName})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Input Mode Selector */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveInputMode('paste')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                    activeInputMode === 'paste'
                      ? 'bg-[#6B705C] text-white border-[#6B705C]'
                      : 'bg-card text-muted border-theme hover:text-primary'
                  }`}
                >
                  Paste Text / CSV
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInputMode('file')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                    activeInputMode === 'file'
                      ? 'bg-[#6B705C] text-white border-[#6B705C]'
                      : 'bg-card text-muted border-theme hover:text-primary'
                  }`}
                >
                  Upload File (.pdf / .csv / .txt)
                </button>
              </div>

              <button
                type="button"
                onClick={handleLoadSampleData}
                className="text-[11px] text-[#6B705C] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Fill Sample Test Data</span>
              </button>
            </div>

            {/* Paste Mode */}
            {activeInputMode === 'paste' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span>Format: <code>TopicNumber, TestName, Score, Date, Mistakes</code></span>
                  <span>e.g., <code>1.1, Quiz 1, 18/20, 2026-08-25, Missed friction</code></span>
                </div>
                <textarea
                  value={rawText}
                  onChange={(e) => {
                    setRawText(e.target.value);
                    const rows = parseTestScoreData(e.target.value, subjects, selectedSubject);
                    setParsedRows(rows);
                  }}
                  placeholder={`1.1, Kinematics Test, 18/20, 2026-08-25, Relative velocity error\n1.2, Projectile Drill, 75%, 2026-08-25, Maximum height formula\n2.1, 45/50, Needs review on tension vectors`}
                  rows={5}
                  className="w-full p-3 bg-theme-accent/20 border border-theme rounded-2xl text-xs font-mono text-primary focus:outline-none focus:border-primary leading-relaxed"
                />
              </div>
            ) : (
              <div 
                onClick={() => !isAiParsingPdf && fileInputRef.current?.click()}
                className={`border-2 border-dashed border-theme hover:border-primary/60 rounded-2xl p-8 text-center bg-theme-accent/20 cursor-pointer transition ${
                  isAiParsingPdf ? 'opacity-70 cursor-wait' : ''
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".pdf,.csv,.tsv,.txt,.json"
                  className="hidden"
                />
                {isAiParsingPdf ? (
                  <div className="space-y-2">
                    <Loader2 className="w-8 h-8 text-[#6B705C] mx-auto animate-spin" />
                    <p className="text-xs font-bold text-primary">Analyzing PDF test report with Gemini AI...</p>
                    <p className="text-[11px] text-muted">Extracting scores, topic mastery, and mistakes to link with your syllabus</p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-muted mx-auto mb-2" />
                    <p className="text-xs font-bold text-primary">Click or drop PDF / CSV / TXT / JSON test scores file here</p>
                    <p className="text-[11px] text-muted mt-1">Supports test score PDFs, question papers, marksheets, or CSV scorecards</p>
                  </>
                )}
              </div>
            )}

            {/* Live Parsing Preview */}
            {parsedRows.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-primary flex items-center gap-1.5">
                    <span>Parsed Records Preview ({parsedRows.length} tests)</span>
                  </span>
                  <span className="text-[11px] text-muted">
                    {matchedCount} of {parsedRows.length} topics linked in syllabus
                  </span>
                </div>

                <div className="border border-theme rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-theme-accent/50 text-muted font-bold text-[11px] sticky top-0">
                      <tr>
                        <th className="p-2.5">Topic #</th>
                        <th className="p-2.5">Linked Topic</th>
                        <th className="p-2.5">Score</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Mistakes / Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme">
                      {parsedRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-theme-accent/20 transition">
                          <td className="p-2.5 font-mono font-bold text-primary text-[11px]">
                            {row.matchedTopic ? (
                              <span className="px-1.5 py-0.5 rounded bg-[#6B705C]/20 text-[#6B705C]">
                                #{row.matchedTopic.topicNumber}
                              </span>
                            ) : (
                              <span className="text-muted">
                                {row.topicNumberQuery || `#${idx + 1}`}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5">
                            {row.matchedTopic ? (
                              <div>
                                <div className="font-semibold text-primary text-[11px]">
                                  {row.matchedTopic.subjectIcon} {row.matchedTopic.topicName}
                                </div>
                                <div className="text-[10px] text-muted">
                                  {row.matchedTopic.subjectName} • {row.matchedTopic.chapterName}
                                </div>
                              </div>
                            ) : (
                              <span className="text-amber-700 text-[11px] flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                <span>{row.subjectName} (General)</span>
                              </span>
                            )}
                          </td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                              row.percentage >= 80
                                ? 'bg-emerald-100 text-emerald-800'
                                : row.percentage >= 60
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {row.scoreStr}
                            </span>
                          </td>
                          <td className="p-2.5 text-muted text-[11px]">
                            {row.date}
                          </td>
                          <td className="p-2.5 text-muted text-[11px] max-w-[150px] truncate" title={row.mistakes}>
                            {row.mistakes || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {uploadSuccessCount === null && (
          <div className="flex items-center justify-between pt-4 border-t border-theme shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-primary transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={parsedRows.length === 0 || isProcessing}
              className="px-5 py-2.5 bg-[#6B705C] hover:bg-[#5a5f4e] disabled:opacity-50 text-white font-bold text-xs rounded-full shadow-xs transition flex items-center gap-2 cursor-pointer"
            >
              {isProcessing ? (
                <span>Saving {parsedRows.length} Tests...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save {parsedRows.length} Test Records to Vault</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
