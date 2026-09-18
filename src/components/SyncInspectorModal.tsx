import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Smartphone, 
  BookOpen, 
  Layers, 
  Calendar, 
  RotateCcw, 
  Sparkles, 
  Mail, 
  Camera, 
  Upload, 
  ArrowRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { Subject } from '../types';

export interface SyncInspectorDetails {
  deviceName: string;
  pin?: string;
  timestamp: string;
  email?: string;
  stats?: {
    subjectsCount: number;
    chaptersCount: number;
    plansCount: number;
    vaultsCount: number;
    flashcardsCount: number;
    assignmentsCount: number;
    testResultsCount: number;
  };
  hasPreSyncBackup?: boolean;
}

interface SyncInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  details: SyncInspectorDetails | null;
  onLoadExamPresets: () => void;
  onOpenEmailSync: () => void;
  onOpenQRScanner: () => void;
  onOpenUploadSyllabus: () => void;
  onRollbackPreSyncBackup: () => void;
}

export const SyncInspectorModal: React.FC<SyncInspectorModalProps> = ({
  isOpen,
  onClose,
  details,
  onLoadExamPresets,
  onOpenEmailSync,
  onOpenQRScanner,
  onOpenUploadSyllabus,
  onRollbackPreSyncBackup,
}) => {
  const [emailInput, setEmailInput] = useState(details?.email || '');

  if (!isOpen || !details) return null;

  const stats = details.stats || {
    subjectsCount: 0,
    chaptersCount: 0,
    plansCount: 0,
    vaultsCount: 0,
    flashcardsCount: 0,
    assignmentsCount: 0,
    testResultsCount: 0,
  };

  const hasZeroSubjects = stats.subjectsCount === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-theme-card border border-theme rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-theme flex items-center justify-between bg-theme-surface/70">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl border ${
              hasZeroSubjects 
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' 
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
            }`}>
              {hasZeroSubjects ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-primary">Device Link & Sync Inspector</h3>
              <p className="text-xs text-muted">Detailed inspection of what was transferred</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-muted hover:text-primary rounded-xl hover:bg-theme-accent transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-primary">
          {/* Device & Connection Overview */}
          <div className="p-4 rounded-2xl bg-theme-surface border border-theme flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-theme-card border border-theme text-muted">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-primary flex items-center gap-2">
                  <span>{details.deviceName || 'Remote Device'}</span>
                  {details.pin && (
                    <span className="px-2 py-0.5 rounded-md bg-theme-accent font-mono text-[11px] text-muted">
                      PIN: {details.pin}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted">
                  Handshake recorded at {new Date(details.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Pairing Confirmed</span>
            </div>
          </div>

          {/* Transfer Breakdown Metrics */}
          <div>
            <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-2.5">
              Received Data Bundle Summary
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className={`p-3 rounded-2xl border ${
                stats.subjectsCount > 0 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300' 
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300'
              }`}>
                <div className="text-lg font-extrabold">{stats.subjectsCount}</div>
                <div className="text-[11px] font-medium flex items-center justify-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  <span>Subjects</span>
                </div>
                <div className="text-[10px] opacity-75 mt-0.5">({stats.chaptersCount} chapters)</div>
              </div>

              <div className="p-3 rounded-2xl bg-theme-surface border border-theme">
                <div className="text-lg font-extrabold text-primary">{stats.plansCount}</div>
                <div className="text-[11px] font-medium text-muted flex items-center justify-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>Study Plans</span>
                </div>
                <div className="text-[10px] text-muted mt-0.5">tasks & agendas</div>
              </div>

              <div className="p-3 rounded-2xl bg-theme-surface border border-theme">
                <div className="text-lg font-extrabold text-primary">{stats.vaultsCount}</div>
                <div className="text-[11px] font-medium text-muted flex items-center justify-center gap-1">
                  <Layers className="w-3 h-3" />
                  <span>Vaults</span>
                </div>
                <div className="text-[10px] text-muted mt-0.5">files & materials</div>
              </div>
            </div>
          </div>

          {/* Diagnosis if 0 subjects received */}
          {hasZeroSubjects ? (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Why is the syllabus empty after linking?</span>
              </div>
              <p className="leading-relaxed text-amber-800 dark:text-amber-300">
                The device linking handshake was successful, but the device <strong className="font-bold">"{details.deviceName}"</strong> had <strong>0 subjects</strong> saved in its transfer snapshot.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-[11px] opacity-90">
                <li>The source device may not have added or uploaded subjects yet.</li>
                <li>Or its syllabus is saved under your student Google/Email account in Cloud Firestore.</li>
              </ul>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>All {stats.subjectsCount} subjects and {stats.chaptersCount} chapters are successfully synchronized in your workspace!</span>
            </div>
          )}

          {/* Recommended Quick Actions */}
          <div className="space-y-2 pt-1">
            <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">
              Instant Solution Actions
            </h4>

            {/* Action 1: Load Starter Presets */}
            <button
              onClick={() => {
                onClose();
                onLoadExamPresets();
              }}
              className="w-full p-3 rounded-2xl bg-primary text-white text-xs font-bold flex items-center justify-between hover:bg-primary/90 transition cursor-pointer shadow-xs"
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <div className="text-left">
                  <div>Load Starter Syllabus / Exam Presets</div>
                  <div className="text-[10px] font-normal text-white/80">
                    Instantly populates Computer Science, STEM, SAT, or Medical subjects
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-white/70" />
            </button>

            {/* Action 2: Cloud Email Pull */}
            <button
              onClick={() => {
                onClose();
                onOpenEmailSync();
              }}
              className="w-full p-3 rounded-2xl bg-theme-surface border border-theme text-primary text-xs font-bold flex items-center justify-between hover:bg-theme-accent transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-blue-500" />
                <div className="text-left">
                  <div>Pull Cloud Data by Email Account</div>
                  <div className="text-[10px] font-normal text-muted">
                    Sync syllabus linked to your registered student email
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted" />
            </button>

            {/* Action 3: Scan Another QR Code */}
            <button
              onClick={() => {
                onClose();
                onOpenQRScanner();
              }}
              className="w-full p-3 rounded-2xl bg-theme-surface border border-theme text-primary text-xs font-bold flex items-center justify-between hover:bg-theme-accent transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Camera className="w-4 h-4 text-emerald-500" />
                <div className="text-left">
                  <div>Scan Another Device's QR Code</div>
                  <div className="text-[10px] font-normal text-muted">
                    Point camera at your computer screen or another phone
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted" />
            </button>

            {/* Action 4: Upload PDF / Image */}
            <button
              onClick={() => {
                onClose();
                onOpenUploadSyllabus();
              }}
              className="w-full p-3 rounded-2xl bg-theme-surface border border-theme text-primary text-xs font-bold flex items-center justify-between hover:bg-theme-accent transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Upload className="w-4 h-4 text-purple-500" />
                <div className="text-left">
                  <div>Upload Syllabus PDF or Image (AI Extractor)</div>
                  <div className="text-[10px] font-normal text-muted">
                    Auto-structures chapters and topics from your document
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted" />
            </button>

            {/* Action 5: Rollback if pre-sync backup exists */}
            {details.hasPreSyncBackup && (
              <button
                onClick={() => {
                  onClose();
                  onRollbackPreSyncBackup();
                }}
                className="w-full p-2.5 rounded-xl border border-dashed border-theme text-muted hover:text-primary text-xs font-semibold flex items-center justify-center gap-2 hover:bg-theme-accent transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                <span>Undo Sync & Restore Previous State</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-theme bg-theme-surface/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-theme-accent hover:bg-theme-accent/80 text-primary rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </motion.div>
    </div>
  );
};
