import React from 'react';
import { X, Download, Smartphone, CheckCircle2, Share2, Sparkles, ExternalLink, ShieldCheck } from 'lucide-react';
import { BrandEmblem } from './BrandEmblem';
import { useLanguage } from '../context/LanguageContext';

interface AndroidInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInstallable: boolean;
  onInstall: () => Promise<boolean | void>;
  isIOS?: boolean;
}

export const AndroidInstallModal: React.FC<AndroidInstallModalProps> = ({
  isOpen,
  onClose,
  isInstallable,
  onInstall,
  isIOS = false,
}) => {
  const { language, t } = useLanguage();

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (isInstallable) {
      const result = await onInstall();
      if (result) {
        onClose();
      }
    }
  };

  const handleOpenInNewTab = () => {
    // Opening in top/new tab allows Chrome to trigger native install prompt directly
    window.open(window.location.href, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-6 bg-black/75 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div 
        className="relative w-full max-w-md bg-[#FAF4EA] dark:bg-[#1E1B18] rounded-2xl shadow-2xl border border-amber-900/20 dark:border-stone-800 overflow-hidden flex flex-col font-telugu"
        role="dialog"
        aria-modal="true"
      >
        {/* Header with App Logo & Title */}
        <div className="relative p-5 bg-gradient-to-br from-[#78350F] to-[#451A03] text-amber-50">
          <button
            onClick={onClose}
            id="close-install-modal-btn"
            className="absolute top-3.5 right-3.5 p-1.5 rounded-lg bg-black/25 hover:bg-black/40 text-amber-200 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3.5">
            <BrandEmblem size="lg" />
            <div>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400/25 border border-amber-300/30 text-[11px] font-bold text-amber-200 mb-1">
                <Smartphone className="w-3 h-3" />
                <span>{language === 'te' ? 'ఆండ్రాయిడ్ యాప్ (PWA)' : 'Android App (PWA)'}</span>
              </div>
              <h3 className="font-extrabold text-base sm:text-lg leading-tight text-white">
                {t.brandName}
              </h3>
              <p className="text-xs text-amber-200/90 font-sans">
                {t.brandTagline} • కొల్లూరు
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Key Advantages */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5 p-2 rounded-xl bg-white dark:bg-stone-900 border border-amber-900/10 dark:border-stone-800 text-stone-800 dark:text-stone-200">
              <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>{language === 'te' ? 'ప్లేస్టోర్ అవసరం లేదు (Direct)' : 'No Play Store needed (Direct)'}</span>
            </div>
            <div className="flex items-center gap-1.5 p-2 rounded-xl bg-white dark:bg-stone-900 border border-amber-900/10 dark:border-stone-800 text-stone-800 dark:text-stone-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{language === 'te' ? '100% ఉచితం & సురక్షితం' : '100% Free & Safe'}</span>
            </div>
          </div>

          {/* Primary Action Button: Native Install or Direct Trigger */}
          {isInstallable ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleInstallClick}
                id="native-install-prompt-btn"
                className="w-full py-3.5 px-4 rounded-xl font-extrabold text-base text-white bg-[#78350F] hover:bg-[#8C4A26] active:scale-[0.98] shadow-lg shadow-amber-950/30 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
              >
                <Download className="w-5 h-5 animate-bounce" />
                <span>{language === 'te' ? 'ఇప్పుడే యాప్ ఇన్‌స్టాల్ / డౌన్‌లోడ్ చేయండి' : 'Install / Download App Now'}</span>
              </button>
              <p className="text-[11px] text-center text-stone-500 dark:text-stone-400">
                {language === 'te' ? "బటన్ క్లిక్ చేయగానే మీ మొబైల్‌లో 'Install' ఆప్షన్ కనిపిస్తుంది." : "Clicking this will prompt the 'Install' dialog on your phone."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleOpenInNewTab}
                id="open-in-browser-install-btn"
                className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>{language === 'te' ? 'క్రోమ్ బ్రౌజర్‌లో ఓపెన్ చేసి ఇన్‌స్టాల్ చేయండి' : 'Open in Chrome Browser & Install'}</span>
              </button>
            </div>
          )}

          {/* Step-by-Step Instructions */}
          <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-stone-900 border border-amber-900/10 dark:border-stone-800 space-y-2.5">
            <h4 className="font-bold text-xs sm:text-sm text-[#451A03] dark:text-amber-200">
              {language === 'te' ? 'ఫోన్‌లో ఇన్‌స్టాల్ చేసే సులువైన పద్ధతి:' : 'How to install on your phone:'}
            </h4>
            <ol className="space-y-2 text-xs text-stone-700 dark:text-stone-300">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-200 dark:bg-stone-800 text-[#78350F] dark:text-amber-300 font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                  1
                </span>
                <span>{language === 'te' ? 'ఈ పేజీని గూగుల్ క్రోమ్ (Google Chrome) బ్రౌజర్‌లో ఓపెన్ చేయండి.' : 'Open this page in Google Chrome browser.'}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-200 dark:bg-stone-800 text-[#78350F] dark:text-amber-300 font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                  2
                </span>
                <span>{language === 'te' ? 'కుడివైపు పైభాగంలో ఉన్న 3 చుక్కలు (⋮ Menu) నొక్కండి.' : 'Tap the 3 dots (⋮ Menu) at top right.'}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-200 dark:bg-stone-800 text-[#78350F] dark:text-amber-300 font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                  3
                </span>
                <span>
                  <strong>"Install App"</strong> లేదా <strong>"Add to Home screen"</strong> ఎంచుకోండి.
                </span>
              </li>
            </ol>
          </div>

          <button
            type="button"
            onClick={onClose}
            id="close-install-dialog-btn"
            className="w-full py-2.5 rounded-xl font-bold text-xs text-stone-600 dark:text-stone-400 hover:bg-amber-100/50 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            {language === 'te' ? 'సరే, అర్థమైంది' : 'Got it, close'}
          </button>
        </div>
      </div>
    </div>
  );
};
