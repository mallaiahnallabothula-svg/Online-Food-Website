import React from 'react';
import { Languages, Check } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const LanguageSelectorBar: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="bg-amber-900 text-amber-50 border-b border-amber-950 py-2 px-4 text-xs font-medium">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2">
          <Languages className="w-4 h-4 text-amber-300 flex-shrink-0" />
          <span className="font-semibold tracking-wide">
            భాషను ఎంచుకోండి / Choose Language:
          </span>
        </div>

        <div className="flex items-center gap-1.5 bg-amber-950/70 p-1 rounded-lg border border-amber-700/50 shadow-inner">
          <button
            type="button"
            onClick={() => setLanguage('te')}
            id="lang-select-telugu"
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
              language === 'te'
                ? 'bg-amber-100 text-amber-950 shadow-sm'
                : 'text-amber-200 hover:text-white hover:bg-amber-800/60'
            }`}
          >
            {language === 'te' && <Check className="w-3 h-3 text-amber-800" />}
            <span>తెలుగు (Telugu)</span>
          </button>

          <button
            type="button"
            onClick={() => setLanguage('en')}
            id="lang-select-english"
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
              language === 'en'
                ? 'bg-amber-100 text-amber-950 shadow-sm'
                : 'text-amber-200 hover:text-white hover:bg-amber-800/60'
            }`}
          >
            {language === 'en' && <Check className="w-3 h-3 text-amber-800" />}
            <span>English</span>
          </button>
        </div>
      </div>
    </div>
  );
};
