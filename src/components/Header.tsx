import React from 'react';
import { Phone, Clock, Moon, Sun, ShieldCheck, ShoppingBag } from 'lucide-react';
import { OrderingHoursStatus } from '../types';

interface HeaderProps {
  hoursStatus: OrderingHoursStatus | null;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenOwnerPortal: () => void;
  isOwnerView: boolean;
  onBackToCustomerView: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  hoursStatus,
  darkMode,
  onToggleDarkMode,
  onOpenOwnerPortal,
  isOwnerView,
  onBackToCustomerView,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md transition-colors duration-200 border-b border-amber-900/10 dark:border-stone-800 bg-[#FDFBF7]/95 dark:bg-[#1A1816]/95">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
        {/* Brand Logo & Name */}
        <div 
          onClick={onBackToCustomerView}
          className="flex items-center gap-3 cursor-pointer group"
          id="brand-header-link"
        >
          <div className="w-11 h-11 rounded-xl bg-[#78350F] flex items-center justify-center text-amber-100 shadow-md shadow-amber-950/20 group-hover:scale-105 transition-transform flex-shrink-0">
            <span className="font-bold text-xl font-telugu">మ</span>
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#451A03] dark:text-amber-100 font-telugu leading-tight">
              శ్రీ మల్లికార్జున జొన్న రొట్టెలు
            </h1>
            <p className="text-xs text-amber-900/70 dark:text-stone-400 font-medium font-telugu hidden sm:block">
              కొల్లూరు గ్రామం, హైదరాబాద్ | తాజా జొన్న రొట్టెలు & ఉచిత కారాలు
            </p>
          </div>
        </div>

        {/* Center / Status info for customer */}
        <div className="hidden md:flex items-center gap-2">
          {hoursStatus && (
            <div 
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold font-telugu ${
                hoursStatus.isOpen 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' 
                  : 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${hoursStatus.isOpen ? 'bg-emerald-600 animate-pulse' : 'bg-amber-600'}`} />
              <span>
                {hoursStatus.isOpen 
                  ? 'ఆర్డర్లు అందుబాటులో ఉన్నాయి (11 AM - 4 PM)' 
                  : 'ఆర్డర్లు ముగిశాయి (11 AM - 4 PM)'}
              </span>
            </div>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Owner Phone quick call */}
          <a
            href="tel:+918499865803"
            id="owner-phone-call-btn"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-amber-950 bg-amber-100/80 hover:bg-amber-200/80 dark:bg-stone-800 dark:text-stone-200 border border-amber-900/15 dark:border-stone-700 transition-colors"
            title="యజమాని సంప్రదించండి"
          >
            <Phone className="w-3.5 h-3.5 text-[#78350F] dark:text-amber-400" />
            <span className="hidden sm:inline font-mono font-medium">+91 8499865803</span>
            <span className="sm:hidden font-telugu text-xs">కాల్</span>
          </a>

          {/* Dark Mode Toggle */}
          <button
            onClick={onToggleDarkMode}
            id="toggle-theme-btn"
            aria-label="Toggle Dark Mode"
            className="p-2 rounded-lg text-stone-700 dark:text-stone-300 hover:bg-amber-100/60 dark:hover:bg-stone-800 transition-colors"
            title={darkMode ? 'లైట్ మోడ్ మార్చు' : 'డార్క్ మోడ్ మార్చు'}
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-stone-700" />}
          </button>

          {/* Owner Portal / Customer View Toggle */}
          {isOwnerView ? (
            <button
              onClick={onBackToCustomerView}
              id="back-to-shop-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#78350F] text-amber-50 hover:bg-[#8C4A26] shadow-sm transition-colors font-telugu"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>ఆర్డరింగ్ పేజీ</span>
            </button>
          ) : (
            <button
              onClick={onOpenOwnerPortal}
              id="owner-portal-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-stone-200/80 dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-stone-300/80 dark:hover:bg-stone-700 border border-stone-300 dark:border-stone-700 transition-colors font-telugu"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
              <span className="hidden sm:inline">యజమాని లాగిన్</span>
              <span className="sm:hidden">లాగిన్</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
