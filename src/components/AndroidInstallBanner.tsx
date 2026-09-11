import React, { useState } from 'react';
import { Smartphone, Download, X, Sparkles } from 'lucide-react';
import brandLogo from '../assets/images/mallikarjuna_rottelu_logo_1789103187340.jpg';

interface AndroidInstallBannerProps {
  isInstalled: boolean;
  onOpenModal: () => void;
}

export const AndroidInstallBanner: React.FC<AndroidInstallBannerProps> = ({
  isInstalled,
  onOpenModal,
}) => {
  const [dismissed, setDismissed] = useState<boolean>(false);

  // If already installed in standalone mode or user dismissed during session
  if (isInstalled || dismissed) {
    return null;
  }

  return (
    <div 
      id="android-install-banner"
      className="sticky top-0 z-40 bg-gradient-to-r from-[#451A03] via-[#78350F] to-[#8C4A26] text-white px-3 sm:px-6 py-2.5 shadow-md border-b border-amber-600/30 font-telugu"
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg overflow-hidden border border-amber-300/40 flex-shrink-0 bg-white shadow-xs">
            <img 
              src={brandLogo} 
              alt="యాప్ లోగో" 
              className="w-full h-full object-cover" 
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-xs sm:text-sm text-white truncate">
                Android యాప్ అందుబాటులో ఉంది!
              </span>
              <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.2 rounded-full bg-emerald-500/25 border border-emerald-300/40 text-[10px] font-bold text-emerald-200">
                <Sparkles className="w-2.5 h-2.5" />
                <span>100% ఉచిత డౌన్‌లోడ్</span>
              </span>
            </div>
            <p className="text-[11px] text-amber-200/90 truncate hidden sm:block">
              మీ ఫోన్ హోమ్ స్క్రీన్‌పై డౌన్‌లోడ్ చేసుకొని సులభంగా జొన్న రొట్టెలు ఆర్డర్ చేయండి
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onOpenModal}
            id="banner-install-btn"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-100 hover:bg-white text-[#78350F] font-bold text-xs shadow-sm transition-all cursor-pointer active:scale-95"
          >
            <Download className="w-3.5 h-3.5 text-[#78350F]" />
            <span className="font-bold">యాప్ డౌన్‌లోడ్ / ఇన్‌స్టాల్</span>
          </button>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            id="dismiss-install-banner-btn"
            className="p-1 rounded-md text-amber-300/80 hover:text-white hover:bg-black/20 transition-colors"
            title="మూసివేయండి"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
