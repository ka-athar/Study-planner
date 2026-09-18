import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X, CheckCircle2, Share2 } from 'lucide-react';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'full' | 'subtle';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ 
  variant = 'compact',
  className = '' 
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as standalone native app, don't show prompt
  if (isInstalled) {
    return (
      <div className={`flex items-center gap-1.5 text-[11px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded-xl ${className}`}>
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        <span>Installed App</span>
      </div>
    );
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    if (variant === 'full') {
      return (
        <button
          onClick={install}
          className={`flex items-center justify-center gap-2 rounded-2xl bg-[#6B705C] hover:bg-[#5a5f4e] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition cursor-pointer ${className}`}
        >
          <Download className="w-4 h-4" />
          <span>Install App to Desktop / Phone</span>
        </button>
      );
    }

    return (
      <button
        onClick={install}
        className={`flex items-center gap-1.5 rounded-xl bg-[#6B705C]/10 hover:bg-[#6B705C]/20 border border-[#6B705C]/30 px-3 py-1.5 text-xs font-bold text-[#4A4E4D] transition cursor-pointer shadow-2xs ${className}`}
        title="Install as native offline app"
      >
        <Download className="w-3.5 h-3.5 text-[#6B705C]" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 rounded-xl bg-[#6B705C]/10 hover:bg-[#6B705C]/20 border border-[#6B705C]/30 px-3 py-1.5 text-xs font-bold text-[#4A4E4D] transition cursor-pointer ${className}`}
        >
          <Smartphone className="w-3.5 h-3.5 text-[#6B705C]" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in" onClick={() => setShowIOSGuide(false)}>
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-[#E0DBD0] space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#6B705C] text-white flex items-center justify-center">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-[#4A4E4D]">Install on iPhone / iPad</h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="w-7 h-7 rounded-full bg-[#F2EFE9] flex items-center justify-center text-[#4A4E4D] hover:bg-[#E0DBD0] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-[#6B705C] leading-relaxed">
                <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-[#FAF8F5] border border-[#E0DBD0]">
                  <span className="w-5 h-5 rounded-full bg-[#6B705C] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                  <span>Tap the <strong>Share</strong> button <Share2 className="w-3.5 h-3.5 inline mx-1 text-sky-600" /> in your Safari bottom toolbar.</span>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-[#FAF8F5] border border-[#E0DBD0]">
                  <span className="w-5 h-5 rounded-full bg-[#6B705C] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                  <span>Scroll down and tap <strong>Add to Home Screen</strong>.</span>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-[#FAF8F5] border border-[#E0DBD0]">
                  <span className="w-5 h-5 rounded-full bg-[#6B705C] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                  <span>Launch from your home screen for full-screen offline studying!</span>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-2xl bg-[#6B705C] hover:bg-[#5a5f4e] py-2.5 text-xs font-bold text-white transition cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback subtle guide for other browsers
  if (variant === 'full') {
    return (
      <div className={`flex items-center gap-2 p-3 rounded-2xl bg-[#FAF8F5] border border-[#E0DBD0] text-xs text-[#6B705C] ${className}`}>
        <Smartphone className="w-4 h-4 text-[#6B705C] shrink-0" />
        <span>Install via your browser's address bar icon or menu (<strong>Install App</strong>) for offline access.</span>
      </div>
    );
  }

  return null;
};
