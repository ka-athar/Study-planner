import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  QrCode, 
  X, 
  Smartphone, 
  KeyRound, 
  Upload, 
  HelpCircle, 
  ShieldCheck, 
  Sparkles, 
  ArrowRight,
  Camera,
  Layers,
  Archive,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import { InAppQRScanner, ParsedQRResult } from './InAppQRScanner';

interface InAppQRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onHandleParsedResult: (result: ParsedQRResult) => void;
  onOpenExamPresets?: () => void;
  title?: string;
  subtitle?: string;
}

export const InAppQRScannerModal: React.FC<InAppQRScannerModalProps> = ({
  isOpen,
  onClose,
  onHandleParsedResult,
  onOpenExamPresets,
  title = 'In-App QR Code & Device Scanner',
  subtitle = 'Scan QR codes directly inside StudyOS without switching apps or external browser tabs.'
}) => {
  const [manualCode, setManualCode] = useState('');
  const [showInstructions, setShowInstructions] = useState(true);
  const [pendingResult, setPendingResult] = useState<ParsedQRResult | null>(null);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;

    const trimmed = manualCode.trim();
    if (/^\d{6}$/.test(trimmed)) {
      onHandleParsedResult({
        raw: trimmed,
        type: 'transfer_pin',
        transferPin: trimmed,
        displayText: `Manual PIN: ${trimmed}`
      });
      onClose();
    } else if (trimmed.includes('transfer_code=')) {
      try {
        const url = new URL(trimmed.startsWith('http') ? trimmed : `https://studyos.local/${trimmed}`);
        const pin = url.searchParams.get('transfer_code');
        if (pin) {
          onHandleParsedResult({
            raw: trimmed,
            type: 'transfer_pin',
            transferPin: pin,
            displayText: `Transfer PIN: ${pin}`
          });
          onClose();
          return;
        }
      } catch (err) {}
    } else {
      onHandleParsedResult({
        raw: trimmed,
        type: 'text',
        displayText: trimmed
      });
      onClose();
    }
  };

  const handleScanSuccess = (result: ParsedQRResult) => {
    onHandleParsedResult(result);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-theme-card border border-theme rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-theme flex items-center justify-between bg-theme-surface/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-primary">{title}</h3>
              <p className="text-xs text-muted leading-tight">{subtitle}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-muted hover:text-primary rounded-xl hover:bg-theme-accent transition cursor-pointer"
            title="Close Scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 flex flex-col items-center">
          {/* Step-by-Step "What to do while viewing this scanner" Guide */}
          <div className="w-full bg-theme-surface border border-theme rounded-2xl p-3.5 text-xs text-primary space-y-2">
            <div 
              onClick={() => setShowInstructions(!showInstructions)} 
              className="flex items-center justify-between font-bold text-xs cursor-pointer text-muted hover:text-primary transition"
            >
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <Info className="w-3.5 h-3.5" />
                <span>What should I do with this QR Scanner?</span>
              </div>
              {showInstructions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </div>

            {showInstructions && (
              <div className="space-y-2 pt-1 text-[11px] text-muted border-t border-theme/60">
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[10px]">1</span>
                  <span><strong>On your other device (computer or phone):</strong> Open StudyOS, click <strong>"Transfer / Connect Devices"</strong>, and choose <strong>"QR Code"</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[10px]">2</span>
                  <span><strong>On this phone:</strong> Point this camera at that screen's QR code (or type the 6-digit PIN below).</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[10px]">3</span>
                  <span><strong>Instant Link:</strong> The workspace snapshot (subjects, plans, flashcards) will transfer immediately.</span>
                </div>
              </div>
            )}
          </div>

          {/* Live Scanner Component */}
          <InAppQRScanner
            onScanResult={handleScanSuccess}
            onClose={onClose}
          />

          {/* Quick Manual Code Fallback */}
          <div className="w-full pt-3 border-t border-theme/70">
            <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-muted">
              <KeyRound className="w-3.5 h-3.5 text-emerald-500" />
              <span>Or type a 6-digit Device Transfer PIN:</span>
            </div>

            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="e.g. 112034 or link"
                className="flex-1 px-3.5 py-2 bg-theme-surface border border-theme rounded-xl text-xs text-primary focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 font-mono"
              />
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <span>Connect</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          {/* Shortcut to Load Starter Presets */}
          {onOpenExamPresets && (
            <div className="w-full p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-medium text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Don't have a second device with syllabus?</span>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenExamPresets();
                }}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold transition cursor-pointer shrink-0"
              >
                Load Presets
              </button>
            </div>
          )}

          {/* Privacy & In-App Security Note */}
          <div className="flex items-center gap-2 text-[11px] text-muted text-center pt-0.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Encrypted in-app decoding. No video data or images leave your device.</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
