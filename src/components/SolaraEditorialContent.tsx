import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { ArrowUpRight, Clock3, MapPin, Phone, MessageCircle } from 'lucide-react';

export const SolaraEditorialContent: React.FC = () => {
  const { language } = useLanguage();
  const te = language === 'te';
  return (
    <>
      <section id="brand-story" className="border-b border-[#ded7ce] bg-[#FAF6ED] px-4 py-16 dark:border-stone-700 dark:bg-[#211f1c] sm:px-6 sm:py-20" aria-labelledby="brand-story-heading">
        <div className="mx-auto grid max-w-7xl items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-16">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#A44732]">YOUR NEIGHBOURHOOD KITCHEN</p>
            <h2 id="brand-story-heading" className="solara-display mt-4 text-4xl leading-snug text-[#384B35] dark:text-stone-100 sm:text-5xl">
              {te ? <>మా వంటింటి నుంచి<br /><span className="text-[#A44732]">మీ ఇంటికి.</span></> : <>From Our Kitchen<br /><span className="text-[#A44732]">to Your Home.</span></>}
            </h2>
            <p className="mt-5 text-sm font-medium leading-relaxed text-[#A44732]">
              {te ? 'రోజుకు రెండు సమయాలు. మన ఇంటి రుచులు.' : 'Two simple sessions. A familiar taste.'}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-base leading-loose text-[#605b53] dark:text-stone-300">
              {te
                ? 'కొల్లూరు, హైదరాబాద్‌లోని మా చిన్న హోమ్ కిచెన్ నుంచి చుట్టుపక్కల ఉన్నవారి కోసం సులభమైన మెనూ. ఉదయం టిఫిన్లు, సాయంత్రం రొట్టెలు, పప్పు, కుర్మా — మీకు ఏది కావాలో ధరలు, పరిమాణాలు స్పష్టంగా చూసి ఎంచుకోండి.'
                : 'From our home kitchen in Kollur, Hyderabad, we keep the menu simple for nearby neighbourhoods. Start the morning with tiffins; choose rotis, pappu or kurma in the evening. Familiar everyday food, with clear portions and prices.'}
            </p>
            <div className="mt-6 flex items-center gap-3 border-t border-[#ded7ce] pt-5">
              <span aria-hidden="true" className="h-px w-9 shrink-0 bg-[#A44732]" />
              <p className="text-xs font-semibold tracking-wide text-[#756f67] dark:text-stone-300">12 MENU ITEMS · 2 MEAL SESSIONS · PRE-ORDERS</p>
            </div>
          </div>
        </div>
      </section>
      <section id="at-the-table" className="border-y border-[#ded7ce] bg-[#FAF6ED] px-4 py-16 sm:py-20 dark:border-stone-700 dark:bg-[#211f1c] sm:px-6">
        <div className="mx-auto max-w-7xl"><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#A44732]">AT THE TABLE</p><h2 className="solara-display mt-3 text-4xl dark:text-stone-100 sm:text-5xl">{te ? 'మీ తదుపరి భోజనానికి కొన్ని ఎంపికలు.' : 'A little inspiration for your next meal.'}</h2><p className="mt-3 max-w-2xl text-sm leading-loose text-[#605b53] dark:text-stone-300">{te ? 'ఇవి కేవలం వంటకాల కలయిక సూచనలు. కార్ట్ కనీస మొత్తాన్ని సరిచూసుకోండి.' : 'No complicated set meals. These are simple combinations to explore from the available menu; check the food minimum at checkout.'}</p>
          <div className="mt-8 grid gap-8 sm:auto-rows-fr sm:grid-cols-3 lg:mt-10">{[
            ['Idly & chutney','Four idlies with included chutney, or try the ragi idly plate.','ఇడ్లీ & చట్నీ','చట్నీతో నాలుగు ఇడ్లీలు లేదా రాగి ఇడ్లీ ప్లేట్.'],
            ['Jowar roti & pappu','Try three jowar rotis with a separate 120 g Pappu of the Day pack.','జొన్న రొట్టె & పప్పు','మూడు జొన్న రొట్టెలు, విడిగా 120 గ్రాముల పప్పు ప్యాక్.'],
            ['Chapathi & kurma','Combine chapathis with a 120 g mixed-veg kurma pack.','చపాతీ & కుర్మా','చపాతీలకు 120 గ్రాముల మిక్స్ వెజ్ కుర్మా ప్యాక్ జోడించండి.']
          ].map((m,i)=><article key={m[0]} className="flex h-full min-w-0 flex-col border-t border-dotted border-[#c7bcb0] pt-4"><p className="font-serif text-sm italic text-[#A44732]">0{i+1} / {i===0?'MORNING':'EVENING'}</p><h3 className="solara-display mt-3 text-2xl">{te?m[2]:m[0]}</h3><p className="mt-2 text-sm leading-loose text-[#605b53] dark:text-stone-300">{te?m[3]:m[1]}</p><a className="mt-auto inline-flex items-center self-start gap-1 border-b border-[#A44732] pt-4 text-xs text-[#A44732]" href="#upcoming-menu">{te?'మెనూ చూడండి':'Browse the menu'} <ArrowUpRight size={13} /></a></article>)}</div>
        </div>
      </section>
      <section id="delivery-info" className="bg-[#e8ebdc] px-4 py-16 sm:py-20 text-[#384B35] dark:bg-[#302b25] dark:text-stone-100 sm:px-6">
        <div className="mx-auto max-w-7xl"><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#A44732]">ORDERING & DELIVERY</p><h2 className="solara-display mt-3 text-4xl sm:text-6xl">{te?'మీ ఇంటి వరకు.':'To your door.'}</h2>
          <div className="mt-8 grid gap-7 border-t border-[#d8d0c5] pt-7 sm:auto-rows-fr sm:grid-cols-2 lg:mt-10 lg:grid-cols-4">
            <div><h3 className="mb-3 text-sm font-semibold">{te?'డెలివరీ ఛార్జీలు':'Delivery rates'}</h3><p className="text-sm leading-loose">0–5 km · Free<br/>5–7 km · ₹27<br/>7–10 km · ₹45<br/>10+ km · {te?'డెలివరీ లేదు':'No delivery'}</p></div>
            <div><h3 className="mb-3 text-sm font-semibold">{te?'డెలివరీ సమయాలు':'Delivery hours'}</h3><p className="text-sm leading-loose">Morning · 7–11 AM<br/>Evening · 6–8 PM</p></div>
            <div><h3 className="mb-3 text-sm font-semibold">{te?'వారపు సెలవు':'Weekly holiday'}</h3><p className="text-sm leading-loose">{te?'బుధవారం సెలవు':'Wednesday closed'}<br/>{te?'ఆహార కనీస మొత్తం ₹100':'₹100 minimum food subtotal'}</p></div>
            <div><h3 className="mb-3 text-sm font-semibold">{te?'మా ప్రాంతం':'Our area'}</h3><p className="text-sm leading-loose">Kollur, Hyderabad<br/>{te?'తుది డెలివరీ ఛార్జీ లొకేషన్ ఆధారంగా.':'Final charge depends on your location.'}</p><a className="mt-2 inline-flex items-center gap-1 border-b border-[#A44732] text-xs text-[#A44732]" target="_blank" rel="noopener noreferrer" href="https://maps.google.com/?q=17.444210,78.251478"><MapPin size={14}/>{te?'మ్యాప్‌లో చూడండి':'View location'}</a></div>
          </div>
        </div>
      </section>
      <section id="contact-info" className="bg-[#FAF6ED] px-4 py-16 sm:py-20 text-center dark:bg-[#25221f] sm:px-6"><div className="mx-auto max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#A44732]">QUESTIONS? GET IN TOUCH.</p><h2 className="solara-display mt-4 text-4xl sm:text-6xl">{te?'మాతో మాట్లాడండి.':'Talk to us.'}</h2><p className="mt-4 text-sm leading-loose text-[#605b53] dark:text-stone-300">{te?'మెనూ లేదా డెలివరీ గురించి ఏదైనా సందేహం ఉందా?':'Questions about the menu or delivery?'}</p><a className="mt-6 inline-block border-b border-[#A44732] pb-1 font-serif text-3xl text-[#A44732] sm:text-5xl" href="tel:+918499865803">84998 65803</a><div className="mt-6 flex justify-center gap-6 text-sm text-[#A44732]"><a href="tel:+918499865803" className="inline-flex items-center gap-2"><Phone size={16}/>Call us</a><a href="https://wa.me/918499865803" rel="noopener noreferrer" target="_blank" className="inline-flex items-center gap-2"><MessageCircle size={16}/>WhatsApp</a></div>
      </div></section>
    </>
  );
};
