import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-2xl bg-amber-600/95 backdrop-blur-md px-3.5 py-2 text-xs font-bold text-white shadow-lg border border-amber-400/40 animate-bounce">
      <WifiOff className="w-3.5 h-3.5 text-amber-200" />
      <span>Offline Mode — Full offline caching active. Changes sync once reconnected.</span>
    </div>
  );
};
