import React from 'react';
import { ArrowDown, Clock3 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface HeroSectionProps {
  onScrollToOrder: () => void;
  isOpen: boolean;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onScrollToOrder }) => {
  const { language } = useLanguage();
  const te = language === 'te';
  return (
    <section id="home" className="solara-hero relative overflow-hidden border-b border-[#e6dece] bg-[#FAF6ED] px-4 py-8 text-[#384B35] dark:border-stone-700 dark:bg-[#211f1c] dark:text-stone-100 sm:px-6 sm:py-10 lg:py-12">
      <div className="solara-orbit pointer-events-none absolute left-1/2 top-1/2 -z-0 hidden h-[570px] w-[570px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#A44732]/10 lg:block" aria-hidden="true" />
      <div className="solara-motion-hero solara-hero-inner relative mx-auto grid w-full max-w-7xl items-center gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:gap-8 xl:gap-12">
        <div className="min-w-0">
          <p className="solara-hero-eyebrow mb-4 text-[11px] font-bold uppercase tracking-[0.22em] text-[#A44732] dark:text-[#e3a795]">KOLLUR · HYDERABAD · CLOUD KITCHEN</p>
          <h1 className="solara-display solara-hero-title solara-hero-heading m-0 text-[clamp(3rem,4.85vw,5rem)] leading-[1.09] tracking-[-0.055em]">
            {te ? <>ఇంటి రుచులు.<br /><em className="not-italic text-[#A44732]">మీ ఇంటికి.</em></> : <>Everyday food.<br /><em className="not-italic text-[#A44732] lg:whitespace-nowrap">Always familiar.</em></>}
          </h1>
          <p className="solara-hero-description mt-5 max-w-lg text-base leading-relaxed text-[#50584B] dark:text-stone-300">
            {te ? 'ఉదయం టిఫిన్లు. సాయంత్రం ఇంటి వంటకాలు. మీకు నచ్చిన రోజు, సమయం కోసం ముందుగా ఎంచుకోండి.' : 'Start with idly or dosa. Come back for rotis, pappu and kurma. Explore everyday Telugu favourites, with clear portions and prices.'}
          </p>
          <div className="solara-hero-actions mt-6 flex flex-wrap items-center gap-5 text-xs font-bold tracking-[0.04em]">
            <button id="hero-order-now-btn" onClick={onScrollToOrder} type="button" className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-[#A44732] px-6 py-3 text-white transition-colors hover:bg-[#8e3928]">
              {te ? 'మెనూ చూడండి' : 'Explore the menu'} <ArrowDown size={17} aria-hidden="true"/>
            </button>
            <a href="#delivery-info" className="border-b border-[#A44732] pb-1 text-[#384B35] hover:text-[#A44732]">{te ? 'డెలివరీ వివరాలు' : 'Delivery details'}</a>
          </div>
          <p className="mt-5 flex items-center gap-2 text-xs tracking-wide text-[#63685A] dark:text-stone-400"><Clock3 size={16} aria-hidden="true"/>{te ? 'ఉదయం 7–11 AM · సాయంత్రం 6–8 PM · బుధవారం సెలవు' : 'Morning 7–11 AM · Evening 6–8 PM · Wednesday closed'}</p>
        </div>
        <div className="solara-hero-art mx-auto grid w-full max-w-xl min-w-0 grid-cols-3 items-end gap-2 sm:gap-4 lg:mx-0 lg:max-w-none" aria-label={te ? 'ఉదయం, పెసరట్టు, సాయంత్రం వంటకాల సూచన చిత్రాలు' : 'Three home-food editorial illustrations'}>
          {([
            { key: 'idly', en: 'Morning favourites', te: 'ఉదయం టిఫిన్లు', dark: false },
            { key: 'pesarattu', en: 'A familiar flavour', te: 'తెలిసిన ఇంటి రుచి', dark: true },
            { key: 'roti', en: 'Evening comfort', te: 'సాయంత్రం రుచులు', dark: false },
          ] as const).map(item => (
            <div key={item.key} className={'solara-hero-illustration relative aspect-[2/3] overflow-hidden rounded-2xl ' + (item.dark ? 'bg-[#384B35]' : 'bg-[#e8dec5]')} role="img"
              aria-label={te ? item.te + ' — సూచన చిత్రం' : item.en + ' — illustrative artwork'}>
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 160 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M68 59 C59 50 66 44 69 39 M87 59 C77 49 87 42 90 36" fill="none" stroke={item.dark ? '#cdaa7e' : '#c7b49b'} strokeWidth="1.6" strokeLinecap="round"/>
                <ellipse cx="80" cy="171" rx="76" ry="27" fill="#b58c72"/>
                <ellipse cx="80" cy="158" rx="76" ry="27" fill={item.dark ? '#d7c6a9' : '#a9a08a'} />
                <ellipse cx="80" cy="151" rx="70" ry="25" fill="#f7f0db"/>
                {item.key === 'idly' && (
                  <>
                    <ellipse cx="57" cy="136" rx="25" ry="19" fill="#fef9ea"/><ellipse cx="102" cy="136" rx="26" ry="19" fill="#fef9ea"/>
                    <ellipse cx="57" cy="159" rx="26" ry="19" fill="#fff9e8"/><ellipse cx="102" cy="159" rx="26" ry="19" fill="#fff9e8"/>
                  </>
                )}
                {item.key === 'pesarattu' && (
                  <>
                    <path d="M17 168 L89 75 Q105 93 146 166 Q84 189 17 168" fill="#b57b42"/>
                    <path d="M21 164 L89 79 L130 166 Q78 177 21 164" fill="#d49a53"/>
                    <path d="M33 159 L88 99 L118 160" fill="none" stroke="#e9b874" strokeWidth="3"/>
                  </>
                )}
                {item.key === 'roti' && (
                  <>
                    <ellipse cx="80" cy="160" rx="53" ry="20" fill="#ba8652"/>
                    <ellipse cx="80" cy="149" rx="53" ry="19" fill="#dbb37c"/>
                    <ellipse cx="80" cy="143" rx="53" ry="18" fill="#eac68d"/>
                    <ellipse cx="62" cy="140" rx="7" ry="3" fill="#bb946c"/>
                    <ellipse cx="98" cy="144" rx="5" ry="3" fill="#bb946c"/>
                    <ellipse cx="82" cy="151" rx="8" ry="3" fill="#bb946c"/>
                  </>
                )}
              </svg>
              <span className={'absolute inset-x-1 bottom-5 text-center text-[10px] font-medium sm:text-xs ' + (item.dark ? 'text-[#fff1dc]' : 'text-[#fffaf1]')}>{te ? item.te : item.en}</span>
            </div>
          ))}
          <p className="col-span-3 text-left text-[11px] text-[#756f67] dark:text-stone-300">{te ? 'ఆహార సూచన చిత్రాలు మాత్రమే. పరిమాణాలకు మెనూ చూడండి.' : 'Food illustrations · See the menu for serving sizes.'}</p>
        </div>
      </div>
    </section>
  );
};
