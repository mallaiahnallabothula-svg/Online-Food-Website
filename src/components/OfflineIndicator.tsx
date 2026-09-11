import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div 
      id="offline-status-indicator"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-900/95 text-amber-100 px-3.5 py-2 text-xs font-medium shadow-xl border border-amber-700 backdrop-blur-md font-telugu animate-in slide-in-from-bottom"
    >
      <WifiOff className="w-4 h-4 text-amber-300 animate-pulse" />
      <span>ఆఫ్‌లైన్ మోడ్ — కాషింగ్ డేటా అందుబాటులో ఉంది</span>
    </div>
  );
};
