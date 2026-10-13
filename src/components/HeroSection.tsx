import React from 'react';
import { ArrowDown, Clock3, Smartphone } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import heroArtwork from '../assets/images/menu-hero.webp';

interface HeroSectionProps {
  onScrollToOrder: () => void;
  isOpen: boolean;
  onOpenInstallModal?: () => void;
  isInstalled?: boolean;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onScrollToOrder, onOpenInstallModal, isInstalled = false }) => {
  const { language, t } = useLanguage();
  const te = language === 'te';
  return <section className="menu-hero">
    <div className="mx-auto grid max-w-6xl items-center gap-6 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-2 lg:gap-10">
      <div className="relative z-10">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-emerald-800 dark:text-emerald-300">{te ? 'ఉదయం 6 రకాలు · సాయంత్రం 4 రకాలు' : '6 morning favourites · 4 evening favourites'}</p>
        <h1 className="menu-display text-3xl font-bold leading-snug text-[#4B2F1D] sm:text-5xl dark:text-amber-100">{te ? 'ఇంటి రుచులు.' : 'Homestyle food.'}<br />{te ? 'ఉదయం నుంచి సాయంత్రం వరకు.' : 'Morning to evening.'}</h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-stone-600 dark:text-stone-300">{te ? 'మన ఇంటి వంట — మీకు నచ్చిన వంటకాలను 12 రకాల మెనూ నుంచి ఎంచుకోండి.' : 'Mana Enti Vanta — choose your favourites from our 12-item menu.'}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button onClick={onScrollToOrder} id="hero-order-now-btn" className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#26543A] px-7 py-3 font-bold text-white transition hover:bg-[#1E4330]">{t.orderNowBtn}<ArrowDown size={18} aria-hidden="true" /></button>
          {!isInstalled && onOpenInstallModal && <button onClick={onOpenInstallModal} id="hero-install-app-btn" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-stone-300 px-4 py-3 text-sm font-semibold text-stone-700 dark:border-stone-600 dark:text-stone-200"><Smartphone size={17} aria-hidden="true" />{t.androidAppBtn}</button>}
        </div>
        <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-stone-600 dark:text-stone-300"><Clock3 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{te ? 'ఉదయం 7–11 · సాయంత్రం 6–8 IST' : 'Morning 7–11 AM · Evening 6–8 PM IST'}</p>
      </div>
      <figure className="relative m-0 overflow-hidden rounded-[2rem] bg-[#EEE6D6] shadow-sm">
        <img src={heroArtwork} alt={te ? 'ఇడ్లీ మరియు దోసె సూచనార్థ చిత్రం' : 'Illustration of idly and dosa'} width={1536} height={1024} fetchPriority="high" className="aspect-[3/2] w-full object-cover" />
        <figcaption className="absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1 text-[11px] text-stone-600">{te ? 'చిత్రం సూచనార్థం' : 'Illustrative food image'}</figcaption>
      </figure>
    </div>
  </section>;
};
