import React from 'react';
import { ArrowDown, Clock3, Smartphone } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface HeroSectionProps {
  onScrollToOrder: () => void;
  isOpen: boolean;
  onOpenInstallModal?: () => void;
  isInstalled?: boolean;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onScrollToOrder, onOpenInstallModal, isInstalled = false }) => {
  const { language, t } = useLanguage();
  const te = language === 'te';
  return (
    <section id="home" className="solara-hero relative overflow-hidden border-b border-[#ded7ce] bg-[#f7f2e9] px-4 py-16 text-[#26231f] dark:border-stone-700 dark:bg-[#211f1c] dark:text-stone-100 sm:px-6 sm:py-20">
      <div className="solara-orbit pointer-events-none absolute left-1/2 top-1/2 -z-0 hidden h-[630px] w-[630px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ab4d3e]/10 lg:block" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-9 lg:grid-cols-[1.1fr_.9fr] lg:gap-16">
        <div>
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.22em] text-[#ab4d3e] dark:text-[#e3a795]">KOLLUR · HYDERABAD · HOME KITCHEN</p>
          <h1 className="solara-display m-0 text-[clamp(3rem,7vw,6.25rem)] leading-[1.2] tracking-[-0.05em]">
            {te ? <>మన ఇంటి<br /><em className="not-italic text-[#ab4d3e]">వంట.</em></> : <>Everyday food.<br /><em className="not-italic text-[#ab4d3e]">Always familiar.</em></>}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-loose text-[#5f584f] dark:text-stone-300">
            {te ? 'ఉదయం టిఫిన్లు. సాయంత్రం ఇంటి వంటకాలు. మీకు నచ్చిన రోజు, సమయం కోసం ముందుగా ఎంచుకోండి.' : 'Start with idly or dosa. Come back for rotis, pappu and kurma. Explore everyday Telugu favourites, with clear portions and prices.'}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-5 text-xs font-bold uppercase tracking-[0.1em]">
            <button id="hero-order-now-btn" onClick={onScrollToOrder} type="button" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#ab4d3e] px-6 py-3 text-white transition-colors hover:bg-[#934034]">
              {te ? 'మెనూ చూడండి' : 'Explore the menu'} <ArrowDown size={17} aria-hidden="true"/>
            </button>
            <a href="#delivery-info" className="border-b border-[#ab4d3e] pb-1 text-[#ab4d3e] hover:text-[#934034]">{te ? 'డెలివరీ వివరాలు' : 'Delivery details'}</a>
            {!isInstalled && onOpenInstallModal && <button type="button" id="hero-install-app-btn" onClick={onOpenInstallModal} className="inline-flex min-h-11 items-center gap-2 border-b border-[#ab4d3e] text-[#ab4d3e]"><Smartphone size={16} aria-hidden="true"/>{t.androidAppBtn}</button>}
          </div>
          <p className="mt-8 flex items-center gap-2 text-xs tracking-wide text-[#756f67] dark:text-stone-400"><Clock3 size={16} aria-hidden="true"/>{te ? 'ఉదయం 7–11 AM · సాయంత్రం 6–8 PM · బుధవారం సెలవు' : 'Morning 7–11 AM · Evening 6–8 PM · Wednesday closed'}</p>
        </div>
        <div className="solara-hero-art grid grid-cols-3 gap-2 sm:gap-4" aria-label={te ? 'ఇంటి వంటల భావనను సూచించే చిత్రాలు' : 'Illustrative home-food artwork'}>
          <div className="solara-poster solara-poster-one relative aspect-[3/4] overflow-hidden rounded-xl bg-[#dec7a7]" role="img" aria-label="Stylised idly illustration">
            <span className="solara-poster-plate" aria-hidden="true"><i/><i/></span>
            <span className="absolute bottom-4 left-0 right-0 text-center text-[10px] italic text-[#6d5144]">morning table</span>
          </div>
          <div className="solara-poster solara-poster-two relative aspect-[3/4] overflow-hidden rounded-xl bg-[#38261e]" role="img" aria-label="Stylised cooking preparation illustration">
            <span className="solara-poster-cook" aria-hidden="true"/>
            <span className="absolute bottom-4 left-0 right-0 text-center text-[10px] italic text-[#eed8c2]">made with care</span>
          </div>
          <div className="solara-poster solara-poster-three relative aspect-[3/4] overflow-hidden rounded-xl bg-[#ddd1b7]" role="img" aria-label="Stylised evening meal illustration">
            <span className="solara-poster-bowl" aria-hidden="true"/>
            <span className="absolute bottom-4 left-0 right-0 text-center text-[10px] italic text-[#796355]">evening table</span>
          </div>
          <p className="col-span-3 text-right text-[11px] italic text-[#756f67] dark:text-stone-300">{te ? 'ఇవి సూచన చిత్రాలు మాత్రమే, నిజమైన వంటకాల ఫోటోలు కావు.' : 'Illustrative artwork only · Not photographs of our kitchen or meals.'}</p>
        </div>
      </div>
    </section>
  );
};
