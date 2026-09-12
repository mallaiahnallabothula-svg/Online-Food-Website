import React, { useState } from 'react';
import { Smartphone, Download, X, Sparkles } from 'lucide-react';
import { BrandEmblem } from './BrandEmblem';
import { useLanguage } from '../context/LanguageContext';

interface AndroidInstallBannerProps {
  isInstalled: boolean;
  onOpenModal: () => void;
}

export const AndroidInstallBanner: React.FC<AndroidInstallBannerProps> = ({
  isInstalled,
  onOpenModal,
}) => {
  const [dismissed, setDismissed] = useState<boolean>(false);
  const { language } = useLanguage();

  // If already installed in standalone mode or user dismissed during session
  if (isInstalled || dismissed) {
    return null;
  }

  return (
    <div 
      id="android-install-banner"
      className="sticky top-0 z-40 bg-gradient-to-r from-[#451A03] via-[#78350F] to-[#8C4A26] text-white px-3 sm:px-6 py-2 shadow-md border-b border-amber-600/30 font-telugu"
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <BrandEmblem size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-xs sm:text-sm text-white truncate">
                {language === 'te' ? 'మన ఇంటి వంట - Android యాప్ అందుబాటులో ఉంది!' : 'Mana Enti Vanta - Android App Available!'}
              </span>
              <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.2 rounded-full bg-emerald-500/25 border border-emerald-300/40 text-[10px] font-bold text-emerald-200">
                <Sparkles className="w-2.5 h-2.5" />
                <span>{language === 'te' ? '100% ఉచిత డౌన్‌లోడ్' : '100% Free Download'}</span>
              </span>
            </div>
            <p className="text-[11px] text-amber-200/90 truncate hidden sm:block">
              {language === 'te' 
                ? 'మీ ఫోన్ హోమ్ స్క్రీన్‌పై డౌన్‌లోడ్ చేసుకొని సులభంగా జొన్న రొట్టెలు ఆర్డర్ చేయండి'
                : 'Install to your phone home screen to order fresh jowar rotis anytime'}
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
            <span className="font-bold">{language === 'te' ? 'యాప్ ఇన్‌స్టాల్' : 'Install App'}</span>
          </button>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            id="dismiss-install-banner-btn"
            className="p-1 rounded-md text-amber-300/80 hover:text-white hover:bg-black/20 transition-colors cursor-pointer"
            title="మూసివేయండి"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
