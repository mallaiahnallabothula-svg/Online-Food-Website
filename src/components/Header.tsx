import { useUiText } from '../context/useUiText';
import React from 'react';
import { Phone, Moon, Sun, ShoppingBag, MessageSquareHeart, Languages } from 'lucide-react';
import { OrderingHoursStatus } from '../types';
import { NEW_MENU_LAUNCH_ENABLED } from '../../shared/menuCatalog.ts';
import { BrandEmblem } from './BrandEmblem';
import { useLanguage } from '../context/LanguageContext';

interface HeaderProps {
  hoursStatus: OrderingHoursStatus | null;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenOwnerPortal: () => void;
  isOwnerView: boolean;
  onBackToCustomerView: () => void;
  onOpenOrderTracker?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  hoursStatus,
  darkMode,
  onToggleDarkMode,
  onOpenOwnerPortal,
  isOwnerView,
  onBackToCustomerView,
  onOpenOrderTracker,
}) => {
  const ui = useUiText();
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="solara-header sticky top-0 z-40 w-full backdrop-blur-md transition-colors duration-200 border-b border-[#ded7ce] dark:border-stone-800 bg-[#f7f2e9]/95 dark:bg-[#1A1816]/95">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 min-h-18 flex flex-wrap items-center justify-between gap-3 py-2.5">
        
        {/* Brand Emblem & Name */}
        <div 
          onClick={onBackToCustomerView}
          className="flex items-center gap-3 cursor-pointer group"
          id="brand-header-link"
        >
          <BrandEmblem size="md" />
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#26231f] dark:text-amber-100 font-telugu leading-tight">
              {t.brandName}
            </h1>
            <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#756f67] dark:text-stone-400 sm:text-[10px]">HOME KITCHEN · KOLLUR</p>
          </div>
        </div>

        {!isOwnerView && <nav aria-label="On-page sections" className="hidden items-center gap-5 text-sm text-[#514a43] lg:flex">
          <a href="#home" className="hover:text-[#ab4d3e]">Home</a>
          <a href="#upcoming-menu" className="hover:text-[#ab4d3e]">Menu</a>
          <a href="#brand-story" className="hover:text-[#ab4d3e]">Our Story</a>
          <a href="#delivery-info" className="hover:text-[#ab4d3e]">Delivery</a>
          <a href="#contact-info" className="hover:text-[#ab4d3e]">Contact</a>
        </nav>}
        {/* Center: Status indicator for customer */}
        <div className="hidden lg:flex items-center gap-2">
          {hoursStatus && !NEW_MENU_LAUNCH_ENABLED && (
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
                  ? t.ordersOpenStatus 
                  : t.ordersClosedStatus}
              </span>
            </div>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-3">

          {/* Quick Language Toggle */}
          <div className="inline-flex items-center bg-[#eee8dc] dark:bg-stone-800 p-0.5 rounded-lg border border-amber-900/10 dark:border-stone-700">
            <button
              type="button"
              onClick={() => setLanguage(language === 'te' ? 'en' : 'te')}
              id="header-lang-toggle-btn"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md text-amber-950 dark:text-amber-100 hover:bg-white/60 dark:hover:bg-stone-700 transition-colors cursor-pointer"
              title={ui("భాష మార్చండి / Change Language")}
            >
              <Languages className="w-3.5 h-3.5 text-[#ab4d3e] dark:text-amber-400" />
              <span>{language === 'te' ? 'English' : 'తెలుగు'}</span>
            </button>
          </div>

          {/* Track Order & Feedback button */}
          {!isOwnerView && onOpenOrderTracker && (
            <button
              onClick={onOpenOrderTracker}
              id="header-track-order-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-[#ab4d3e] dark:text-amber-300 bg-[#fcf9f3] hover:bg-[#eee8dc] dark:bg-stone-800 dark:hover:bg-stone-700 border border-[#ded7ce] dark:border-stone-700 transition-colors font-telugu cursor-pointer"
              title={ui("నా ఆర్డర్లు — ఆర్డర్ స్థితి చూడండి / My Orders — Track your order")}
            >
              <ShoppingBag className="w-3.5 h-3.5 text-[#ab4d3e] dark:text-amber-400" />
              <span className="hidden sm:inline">{t.trackFeedbackBtn}</span>
              <span className="sm:hidden">{t.trackFeedbackBtn}</span>
            </button>
          )}

          {/* Owner Phone quick call */}
          <a
            href="tel:+918499865803"
            id="owner-phone-call-btn"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-[#26231f] bg-[#eee8dc] hover:bg-[#e3d9cb] dark:bg-stone-800 dark:text-stone-200 border border-amber-900/15 dark:border-stone-700 transition-colors"
            title={ui("యజమాని సంప్రదించండి")}
          >
            <Phone className="w-3.5 h-3.5 text-[#78350F] dark:text-amber-400" />
            <span className="hidden sm:inline font-mono font-medium">+91 8499865803</span>
            <span className="hidden font-telugu text-xs">{t.callOwnerBtn}</span>
          </a>

          {/* Dark Mode Toggle */}
          <button
            onClick={onToggleDarkMode}
            id="toggle-theme-btn"
            aria-label={language === 'te' ? 'డార్క్ మోడ్ మార్చండి' : 'Toggle Dark Mode'}
            className="min-h-11 min-w-11 p-2 rounded-lg text-stone-700 dark:text-stone-300 hover:bg-[#eee8dc] dark:hover:bg-stone-800 transition-colors cursor-pointer"
            title={darkMode ? ui("లైట్ మోడ్") : ui("డార్క్ మోడ్")}
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-stone-700" />}
          </button>

          {/* Owner Portal Return Button */}
          {isOwnerView && (
            <button
              onClick={onBackToCustomerView}
              id="back-to-shop-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#78350F] text-amber-50 hover:bg-[#8C4A26] shadow-sm transition-colors font-telugu cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>{t.orderPageBtn}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
