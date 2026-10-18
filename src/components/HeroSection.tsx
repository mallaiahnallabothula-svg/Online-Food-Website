import React from 'react';
import { ArrowDown, Clock3 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { FoodArtwork } from './FoodArtwork';
import { DELIVERY_POLICY } from '../../shared/deliveryPolicy.ts';
import { NEW_MENU_ORDER_POLICY } from '../../shared/menuCatalog.ts';

interface HeroSectionProps {
  onScrollToOrder: () => void;
  isOpen: boolean;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onScrollToOrder }) => {
  const { language } = useLanguage();
  const te = language === 'te';
  const minimumFoodRupees = NEW_MENU_ORDER_POLICY.minimumCartPaisa / 100;
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
            {te ? 'సాయంత్రం జొన్న రొట్టె, చపాతీ, పుల్కా, పప్పు, కుర్మా, గుంత పొంగనాలు — స్పష్టమైన ధరలు, పరిమాణాలతో ఎంచుకోండి.' : 'Choose from evening jowar roti, chapathi, pulka, pappu, kurma and guntha ponganaalu, with clear portions and prices.'}
          </p>
          <div className="solara-hero-actions mt-6 flex flex-wrap items-center gap-5 text-xs font-bold tracking-[0.04em]">
            <button id="hero-order-now-btn" onClick={onScrollToOrder} type="button" className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-[#A44732] px-6 py-3 text-white transition-colors hover:bg-[#8e3928]">
              {te ? 'మెనూ చూడండి' : 'Explore the menu'} <ArrowDown size={17} aria-hidden="true"/>
            </button>
            <a href="#delivery-info" className="border-b border-[#A44732] pb-1 text-[#384B35] hover:text-[#A44732]">{te ? 'డెలివరీ వివరాలు' : 'Delivery details'}</a>
          </div>
          <p className="mt-5 flex items-center gap-2 text-xs tracking-wide text-[#63685A] dark:text-stone-400"><Clock3 size={16} aria-hidden="true"/>{te ? 'సాయంత్రం 6–8 PM · బుధవారం సెలవు' : 'Evening 6–8 PM · Wednesday closed'}</p>
        </div>
        <div className="solara-hero-art relative mx-auto h-[250px] w-full max-w-xl min-w-0 sm:h-[345px] lg:mx-0 lg:h-[390px] lg:max-w-none"
          aria-label={te ? 'మా సాయంత్రం మెనూలోని జొన్న రొట్టె, గుంత పొంగనాలు, చపాతీ సూచన చిత్రాలు' : 'Illustrated Jowar Roti, Guntha Ponganaalu and Chapathi from our evening menu'}>
          <div className="solara-hero-illustration absolute inset-y-[7%] right-[1%] w-[79%] overflow-hidden rounded-[24px] border border-[#e6dece] bg-[#fffdf8] shadow-[0_15px_32px_rgba(43,38,28,0.12)] dark:border-stone-700 dark:bg-stone-800"
            role="img" aria-label={te ? 'సాయంత్రం రుచులు — గుంత పొంగనాలు సూచన చిత్రం' : 'Evening comfort — Guntha Ponganaalu illustration'}>
            <FoodArtwork itemId="guntha-ponganaalu" className="h-full w-full" />
          </div>
          <div className="solara-hero-illustration absolute left-[1%] top-[7%] w-[37%] overflow-hidden rounded-2xl border-[3px] border-[#FAF6ED] bg-[#fffdf8] shadow-[0_8px_18px_rgba(43,38,28,0.12)] dark:border-[#211f1c]"
            role="img" aria-label={te ? 'సాయంత్రం రుచులు — జొన్న రొట్టె సూచన చిత్రం' : 'Evening favourites — Jowar Roti illustration'}>
            <FoodArtwork itemId="jowar-roti" className="aspect-[4/3] w-full" />
          </div>
          <div className="solara-hero-illustration absolute bottom-[8%] left-[1%] w-[39%] overflow-hidden rounded-2xl border-[3px] border-[#FAF6ED] bg-[#fffdf8] shadow-[0_8px_18px_rgba(43,38,28,0.12)] dark:border-[#211f1c]"
            role="img" aria-label={te ? 'సాయంత్రం ఇంటి రుచి — చపాతీ సూచన చిత్రం' : 'A familiar evening flavour — Chapathi illustration'}>
            <FoodArtwork itemId="chapathi" className="aspect-[4/3] w-full" />
          </div>
          <p className="sr-only">{te ? 'ఇవి సూచన చిత్రాలు మాత్రమే; వడ్డించే పరిమాణాల కోసం మెనూ చూడండి.' : 'Food illustrations only; see the menu for exact portions.'}</p>
        </div>
      </div>
      <div className="solara-hero-trust relative mx-auto mt-8 grid w-full max-w-7xl grid-cols-3 divide-x divide-[#d4dbc9] rounded-xl border border-[#d4dbc9] bg-[#e8ebdc] py-3 text-center text-[#384B35] dark:divide-stone-600 dark:border-stone-700 dark:bg-[#302b25] dark:text-stone-100 sm:mt-9 sm:py-4" aria-label={te ? 'డెలివరీ మరియు ఆర్డర్ వివరాలు' : 'Delivery and ordering highlights'}>
        <div className="min-w-0 px-2 sm:px-4">
          <p className="text-xs font-bold sm:text-sm">{te ? DELIVERY_POLICY.freeRadiusKm + ' కి.మీ. లోపు' : 'Within ' + DELIVERY_POLICY.freeRadiusKm + ' km'}</p>
          <p className="mt-1 text-[10px] leading-snug opacity-80 sm:text-xs">{te ? 'ఉచిత డెలివరీ' : 'Free delivery'}</p>
        </div>
        <div className="min-w-0 px-2 sm:px-4">
          <p className="text-xs font-bold sm:text-sm">₹{minimumFoodRupees}</p>
          <p className="mt-1 text-[10px] leading-snug opacity-80 sm:text-xs">{te ? 'కనీస ఆహార మొత్తం' : 'Food order minimum'}</p>
        </div>
        <div className="min-w-0 px-2 sm:px-4">
          <p className="text-xs font-bold sm:text-sm">{te ? '6 సాయంత్రం వంటకాలు' : '6 evening dishes'}</p>
          <p className="mt-1 text-[10px] leading-snug opacity-80 sm:text-xs">{te ? 'సాయంత్రం మెనూ' : 'Evening menu only'}</p>
        </div>
      </div>
    </section>
  );
};
