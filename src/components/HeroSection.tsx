import React from 'react';
import { ArrowDown, Clock3, MapPin, Smartphone, ArrowRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { MENU_CATALOG, NEW_MENU_LAUNCH_ENABLED } from '../../shared/menuCatalog.ts';
import heroArtwork from '../assets/images/menu-hero.webp';

interface HeroSectionProps {
  onScrollToOrder: () => void;
  isOpen: boolean;
  onOpenInstallModal?: () => void;
  isInstalled?: boolean;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onScrollToOrder, onOpenInstallModal, isInstalled = false,
}) => {
  const { language, t } = useLanguage();
  const te = language === 'te';
  const morningCount = MENU_CATALOG.filter(item => item.mealPeriod === 'MORNING').length;
  const eveningCount = MENU_CATALOG.filter(item => item.mealPeriod === 'EVENING').length;

  return (
    <section className="menu-hero overflow-hidden border-b border-stone-200/70 dark:border-stone-800" aria-label={te ? 'మన ఇంటి వంట పరిచయం' : 'Mana Enti Vanta introduction'}>
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,0.90fr)_minmax(0,1.10fr)] lg:gap-12 lg:py-20">
        <div className="relative z-10">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#DCDCCF] bg-white/75 px-4 py-2 text-xs font-semibold tracking-wide text-[#31513C] dark:border-stone-700 dark:bg-stone-800 dark:text-emerald-200">
            <MapPin size={14} aria-hidden="true" />
            {te ? 'కొల్లూరు నుంచి ఇంటి వంట' : 'Home-style food from Kollur'}
          </p>
          <h1 className="menu-display max-w-lg text-[2.65rem] font-extrabold leading-[1.25] tracking-tight text-[#183E29] sm:text-5xl lg:text-[3.45rem] dark:text-emerald-100">
            {te ? 'ఇంటి వంటలు,' : 'A little taste of home.'}
            <span className="mt-1 block text-[#1D6738] dark:text-emerald-300">
              {te ? 'మీ ఇంటికే!' : 'Made for your day.'}
            </span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-8 text-stone-700 dark:text-stone-300">
            {te
              ? 'ఉదయం అల్పాహారం నుంచి సాయంత్రం ఇంటి రుచుల వరకు — మీకు నచ్చిన వంటకాలను సులభంగా ఎంచుకోండి.'
              : 'From breakfast favourites to comforting evening food. Explore our menu and choose what feels like home.'}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onScrollToOrder}
              id="hero-order-now-btn"
              className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#18552C] px-7 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#124324] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#18552C]"
            >
              {NEW_MENU_LAUNCH_ENABLED ? t.orderNowBtn : (te ? 'మెనూ చూడండి' : 'View Menu')}
              <ArrowDown size={18} aria-hidden="true" />
            </button>
            <a href="#how-it-works" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-stone-300 bg-white/80 px-6 py-3 text-sm font-semibold text-[#244A34] hover:bg-white dark:border-stone-600 dark:bg-stone-800 dark:text-emerald-100">
              {te ? 'ఎలా పని చేస్తుంది?' : 'How it works'}
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs font-medium text-stone-600 dark:text-stone-300">
            <span className="inline-flex items-center gap-2"><Clock3 size={16} className="text-[#27643C]" aria-hidden="true" />{te ? 'ఉదయం 7–11 · సాయంత్రం 6–8 IST' : 'Morning 7–11 AM · Evening 6–8 PM IST'}</span>
            <span>{te ? 'ఉదయం ' : 'Morning '}{morningCount} · {te ? 'సాయంత్రం ' : 'Evening '}{eveningCount}</span>
          </div>
          {!isInstalled && onOpenInstallModal && (
            <button type="button" id="hero-install-app-btn" onClick={onOpenInstallModal} className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[#27643C] underline-offset-4 hover:underline dark:text-emerald-300">
              <Smartphone size={14} aria-hidden="true" />
              {t.androidAppBtn}
            </button>
          )}
        </div>
        <figure className="relative m-0 overflow-hidden rounded-[28px] bg-[#EEE9E0] shadow-[0_18px_45px_-26px_rgba(44,38,26,0.35)] dark:bg-stone-800">
          <img src={heroArtwork} alt={te ? 'ఇడ్లీ, దోసె వంటకాల సూచనార్థ చిత్రం' : 'Illustrative image of South Indian food'} width={1536} height={1024} fetchPriority="high" className="aspect-[4/3] w-full object-cover sm:aspect-[3/2] lg:aspect-[4/5]" />
          <figcaption className="absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-medium text-stone-600">
            {te ? 'వంటకాల సూచనార్థ చిత్రం' : 'Illustrative food image'}
          </figcaption>
        </figure>
      </div>
    </section>
  );
};
