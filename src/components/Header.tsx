import React from 'react';
import { Phone, Moon, Sun, ShoppingBag, Smartphone, MessageSquareHeart, Languages } from 'lucide-react';
import { OrderingHoursStatus } from '../types';
import { BrandEmblem } from './BrandEmblem';
import { useLanguage } from '../context/LanguageContext';

interface HeaderProps {
  hoursStatus: OrderingHoursStatus | null;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenOwnerPortal: () => void;
  isOwnerView: boolean;
  onBackToCustomerView: () => void;
  onOpenInstallModal?: () => void;
  onOpenOrderTracker?: () => void;
  isInstalled?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  hoursStatus,
  darkMode,
  onToggleDarkMode,
  onOpenOwnerPortal,
  isOwnerView,
  onBackToCustomerView,
  onOpenInstallModal,
  onOpenOrderTracker,
  isInstalled = false,
}) => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md transition-colors duration-200 border-b border-amber-900/10 dark:border-stone-800 bg-[#FDFBF7]/95 dark:bg-[#1A1816]/95">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
        
        {/* Brand Emblem & Name */}
        <div 
          onClick={onBackToCustomerView}
          className="flex items-center gap-3 cursor-pointer group"
          id="brand-header-link"
        >
          <BrandEmblem size="md" />
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#451A03] dark:text-amber-100 font-telugu leading-tight">
              {t.brandName}
            </h1>
            <p className="text-xs text-amber-900/70 dark:text-stone-400 font-medium font-telugu hidden sm:block">
              {t.brandTagline}
            </p>
          </div>
        </div>

        {/* Center: Status indicator for customer */}
        <div className="hidden lg:flex items-center gap-2">
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
                  ? t.ordersOpenStatus 
                  : t.ordersClosedStatus}
              </span>
            </div>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">

          {/* Quick Language Toggle */}
          <div className="inline-flex items-center bg-amber-100/70 dark:bg-stone-800 p-0.5 rounded-lg border border-amber-900/10 dark:border-stone-700">
            <button
              type="button"
              onClick={() => setLanguage(language === 'te' ? 'en' : 'te')}
              id="header-lang-toggle-btn"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md text-amber-950 dark:text-amber-100 hover:bg-white/60 dark:hover:bg-stone-700 transition-colors cursor-pointer"
              title="భాష మార్చండి / Change Language"
            >
              <Languages className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
              <span>{language === 'te' ? 'English' : 'తెలుగు'}</span>
            </button>
          </div>

          {/* Download / Install Android App Button */}
          {!isInstalled && onOpenInstallModal && (
            <button
              onClick={onOpenInstallModal}
              id="header-install-app-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs transition-all font-telugu cursor-pointer"
              title="Android యాప్ డౌన్‌లోడ్ / Install App"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-200" />
              <span className="hidden sm:inline">{t.androidAppBtn}</span>
              <span className="sm:hidden">App</span>
            </button>
          )}

          {/* Track Order & Feedback button */}
          {!isOwnerView && onOpenOrderTracker && (
            <button
              onClick={onOpenOrderTracker}
              id="header-track-order-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-[#78350F] dark:text-amber-300 bg-amber-50 hover:bg-amber-100 dark:bg-stone-800 dark:hover:bg-stone-700 border border-amber-300/80 dark:border-stone-700 transition-colors font-telugu cursor-pointer"
              title="ఆర్డర్ స్థితి & ఫీడ్‌బ్యాక్ / Order Feedback"
            >
              <MessageSquareHeart className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
              <span className="hidden sm:inline">{t.trackFeedbackBtn}</span>
              <span className="sm:hidden">Feedback</span>
            </button>
          )}

          {/* Owner Phone quick call */}
          <a
            href="tel:+918499865803"
            id="owner-phone-call-btn"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-amber-950 bg-amber-100/80 hover:bg-amber-200/80 dark:bg-stone-800 dark:text-stone-200 border border-amber-900/15 dark:border-stone-700 transition-colors"
            title="యజమాని సంప్రదించండి"
          >
            <Phone className="w-3.5 h-3.5 text-[#78350F] dark:text-amber-400" />
            <span className="hidden sm:inline font-mono font-medium">+91 8499865803</span>
            <span className="sm:hidden font-telugu text-xs">{t.callOwnerBtn}</span>
          </a>

          {/* Dark Mode Toggle */}
          <button
            onClick={onToggleDarkMode}
            id="toggle-theme-btn"
            aria-label="Toggle Dark Mode"
            className="p-2 rounded-lg text-stone-700 dark:text-stone-300 hover:bg-amber-100/60 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            title={darkMode ? 'లైట్ మోడ్' : 'డార్క్ మోడ్'}
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
