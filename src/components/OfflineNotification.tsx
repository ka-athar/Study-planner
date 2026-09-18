import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw, CheckCircle2, AlertTriangle, CloudOff } from 'lucide-react';

export const OfflineNotification: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [showRestoredBanner, setShowRestoredBanner] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowRestoredBanner(true);
        const timer = setTimeout(() => {
          setShowRestoredBanner(false);
          setWasOffline(false);
        }, 4500);
        return () => clearTimeout(timer);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setShowRestoredBanner(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  const handleManualCheck = async () => {
    setIsChecking(true);
    try {
      const res = await fetch('/api/health', { cache: 'no-store' }).catch(() => null);
      if (res && res.ok) {
        setIsOnline(true);
        if (wasOffline) {
          setShowRestoredBanner(true);
          setTimeout(() => {
            setShowRestoredBanner(false);
            setWasOffline(false);
          }, 4500);
        }
      } else {
        setIsOnline(false);
        setWasOffline(true);
      }
    } catch {
      setIsOnline(false);
      setWasOffline(true);
    } finally {
      setIsChecking(false);
    }
  };

  if (isOnline && !showRestoredBanner) {
    return null;
  }

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-2xl animate-slide-down">
      {!isOnline ? (
        <div className="bg-[#4A4E4D] text-[#F9F7F2] border border-[#6B705C]/30 rounded-2xl p-4 shadow-xl backdrop-blur-md flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 flex-1">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center shrink-0">
              <WifiOff className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block animate-ping"></span>
                  You are Offline
                </span>
                <span className="text-[10px] bg-amber-500/10 text-amber-200 border border-amber-500/20 px-2 py-0.5 rounded-full font-mono">
                  Local Mode Active
                </span>
              </div>
              <p className="text-xs text-[#E0DBD0] mt-0.5 leading-relaxed">
                Changes to study logs & notes will automatically sync to Firestore once connection is restored.
              </p>
            </div>
          </div>

          <button
            onClick={handleManualCheck}
            disabled={isChecking}
            className="px-3.5 py-2 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-medium text-xs transition flex items-center gap-1.5 shrink-0 border border-[#E0DBD0]/20 shadow-xs"
            title="Check connection"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isChecking ? 'Checking...' : 'Check Connection'}</span>
          </button>
        </div>
      ) : showRestoredBanner ? (
        <div className="bg-[#6B705C] text-white border border-[#E0DBD0] rounded-2xl p-4 shadow-xl backdrop-blur-md flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-200 flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-emerald-300" />
                Connection Restored
              </div>
              <p className="text-xs text-[#F9F7F2] mt-0.5">
                Reconnected to internet. Automatically syncing study updates to Firestore...
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowRestoredBanner(false)}
            className="text-xs text-emerald-100 hover:text-white px-2.5 py-1 rounded-lg bg-white/10"
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  );
};
