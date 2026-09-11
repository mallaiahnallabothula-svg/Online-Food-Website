import React from 'react';
import { X, Download, Smartphone, CheckCircle2, Share2, Sparkles, ExternalLink, ShieldCheck } from 'lucide-react';
import brandLogo from '../assets/images/mallikarjuna_rottelu_logo_1789103187340.jpg';

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
            <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-amber-400/40 shadow-lg flex-shrink-0 bg-white">
              <img
                src={brandLogo}
                alt="శ్రీ మల్లికార్జున పల్లె జొన్న రొట్టెలు"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400/25 border border-amber-300/30 text-[11px] font-bold text-amber-200 mb-1">
                <Smartphone className="w-3 h-3" />
                <span>ఆండ్రాయిడ్ యాప్ (PWA)</span>
              </div>
              <h3 className="font-extrabold text-base sm:text-lg leading-tight text-white">
                శ్రీ మల్లికార్జున పల్లె జొన్న రొట్టెలు
              </h3>
              <p className="text-xs text-amber-200/90 font-sans">
                Official Mobile App • కొల్లూరు
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
              <span>ప్లేస్టోర్ అవసరం లేదు (Direct)</span>
            </div>
            <div className="flex items-center gap-1.5 p-2 rounded-xl bg-white dark:bg-stone-900 border border-amber-900/10 dark:border-stone-800 text-stone-800 dark:text-stone-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>100% ఉచితం & సురక్షితం</span>
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
                <span>ఇప్పుడే యాప్ ఇన్‌స్టాల్ / డౌన్‌లోడ్ చేయండి</span>
              </button>
              <p className="text-[11px] text-center text-stone-500 dark:text-stone-400">
                బటన్ క్లిక్ చేయగానే మీ మొబైల్‌లో 'Install' ఆప్షన్ కనిపిస్తుంది.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleOpenInNewTab}
                id="open-new-tab-install-btn"
                className="w-full py-3.5 px-4 rounded-xl font-extrabold text-sm sm:text-base text-white bg-[#78350F] hover:bg-[#8C4A26] active:scale-[0.98] shadow-lg shadow-amber-950/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <ExternalLink className="w-4.5 h-4.5" />
                <span>పూర్తి స్క్రీన్‌లో తెరవండి (One-Click Install)</span>
              </button>
              <p className="text-[11px] text-center text-stone-500 dark:text-stone-400">
                మొబైల్ బ్రౌజర్‌లో నేరుగా ఇన్‌స్టాల్ పాప్-అప్ రావడానికి పైన క్లిక్ చేయండి.
              </p>
            </div>
          )}

          {/* Step-by-Step Instructions */}
          <div className="p-4 rounded-xl bg-white dark:bg-stone-900 border border-amber-900/10 dark:border-stone-800 space-y-3">
            <h4 className="font-bold text-xs sm:text-sm text-[#451A03] dark:text-amber-200 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#78350F] dark:text-amber-400" />
              <span>
                {isIOS ? 'iPhone / iPad లో ఇన్‌స్టాల్ చేసుకునే విధానం:' : 'Android మొబైల్‌లో డౌన్‌లోడ్ / ఇన్‌స్టాల్ చేసుకునే సులువైన పద్ధతి:'}
              </span>
            </h4>

            {isIOS ? (
              <ol className="space-y-2 text-xs text-stone-600 dark:text-stone-300">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-200 dark:bg-stone-800 text-[#78350F] dark:text-amber-300 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">1</span>
                  <span>Safari బ్రౌజర్ క్రింద ఉన్న <strong className="text-stone-900 dark:text-white">Share <Share2 className="w-3 h-3 inline" /></strong> బటన్ నొక్కండి.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-200 dark:bg-stone-800 text-[#78350F] dark:text-amber-300 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">2</span>
                  <span>క్రిందికి స్క్రోల్ చేసి <strong className="text-stone-900 dark:text-white">'Add to Home Screen'</strong> ఎంచుకోండి.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-200 dark:bg-stone-800 text-[#78350F] dark:text-amber-300 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">3</span>
                  <span>కుడివైపు పైన <strong className="text-stone-900 dark:text-white">'Add'</strong> నొక్కండి. యాప్ మీ ఫోన్ స్క్రీన్‌పై డౌన్‌లోడ్ అవుతుంది!</span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-2 text-xs text-stone-600 dark:text-stone-300">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-200 dark:bg-stone-800 text-[#78350F] dark:text-amber-300 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">1</span>
                  <span>మొబైల్ Chrome బ్రౌజర్ పైభాగంలో కుడివైపు ఉన్న <strong className="text-stone-900 dark:text-white">3 చుక్కల (⋮) మెనూ</strong> నొక్కండి.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-200 dark:bg-stone-800 text-[#78350F] dark:text-amber-300 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">2</span>
                  <span>మెనూలోని <strong className="text-stone-900 dark:text-white">'Install app'</strong> లేదా <strong className="text-stone-900 dark:text-white">'Add to Home screen'</strong> పై క్లిక్ చేయండి.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-200 dark:bg-stone-800 text-[#78350F] dark:text-amber-300 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">3</span>
                  <span>'Install' అని నిర్ధారించగానే, మీ ఫోన్ హోమ్ స్క్రీన్‌పై రొట్టెల బొమ్మతో యాప్ ఐకాన్ సేవ్ అవుతుంది!</span>
                </li>
              </ol>
            )}
          </div>

          {/* Benefits summary */}
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>ఇన్‌స్టాల్ చేసిన తర్వాత ఇది నెట్ స్లోగా ఉన్నా వెంటనే ఓపెన్ అవుతుంది మరియు నేరుగా ఆర్డర్ చేయవచ్చు.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-xs font-bold text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 text-center transition-colors cursor-pointer"
          >
            సరే, అర్థమైంది (Close)
          </button>
        </div>
      </div>
    </div>
  );
};
