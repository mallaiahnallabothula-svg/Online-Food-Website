import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { ArrowUpRight, Clock3, MapPin, Phone, MessageCircle } from 'lucide-react';

const faq = [
  ['Can I place an order for another day?', 'The new menu is designed to support advance orders. Exact dates and delivery slots must be checked on the live website once ordering is enabled.', 'మరో రోజు కోసం ఆర్డర్ చేయవచ్చా?', 'ముందస్తు ఆర్డర్లకు మెనూ సిద్ధంగా ఉంది. అందుబాటులో ఉన్న రోజులు, స్లాట్లు live website లో ధృవీకరించాలి.'],
  ['Is the kitchen open on Wednesdays?', 'No. Wednesday is our weekly kitchen holiday. Choose another available date.', 'బుధవారం వంటశాల తెరిచి ఉంటుందా?', 'లేదు. ప్రతి బుధవారం వంటశాలకు సెలవు. మరో అందుబాటులో ఉన్న రోజు ఎంచుకోండి.'],
  ['How much is delivery?', '0–5 km free; 5–7 km ₹27; 7–10 km ₹45. Beyond 10 km, no delivery. Final eligibility and charges are checked against your location.', 'డెలివరీ ఛార్జీలు ఎంత?', '0–5 కి.మీ. ఉచితం, 5–7 కి.మీ. ₹27, 7–10 కి.మీ. ₹45. 10 కి.మీ. దాటితే డెలివరీ లేదు. తుది ఛార్జీలు మీ లొకేషన్ ఆధారంగా నిర్ణయిస్తాం.'],
  ['Is there a minimum order?', 'Yes. The food subtotal must be at least ₹100, excluding delivery. Some items also have their own minimum quantities.', 'కనీస ఆర్డర్ ఎంత?', 'ఆహార మొత్తం కనీసం ₹100 ఉండాలి. డెలివరీ ఛార్జీలు వేరు. కొన్ని వంటకాలకు ప్రత్యేక కనీస పరిమాణం ఉంటుంది.'],
  ['Do the dishes come with chutney?', 'All six morning tiffins and guntha ponganaalu include chutney. Add pappu or kurma separately when you want them.', 'చట్నీ ఇస్తారా?', 'ఉదయం ఆరు టిఫిన్లు, గుంత పొంగనాలతో చట్నీ ఉంటుంది. పప్పు, కుర్మా విడిగా ఎంచుకోవచ్చు.'],
  ['Will the same pappu be available every day?', 'Pappu of the Day changes with the delivery date. Check the selected variety on the live menu.', 'రోజూ ఒకే పప్పు ఉంటుందా?', 'లేదు. డెలివరీ తేదీని బట్టి పప్పు మారుతుంది. మెనూలో ఆ రోజు రకాన్ని చెక్ చేయండి.'],
  ['Are these pictures from your kitchen?', 'No. The three editorial panels are stylised illustrations, not photographs of our kitchen or the food you will receive.', 'ఇవి మీ వంటశాల ఫోటోలా?', 'కాదు. ఇవి భావనను చూపించే illustrations మాత్రమే. మా వంటశాల లేదా నిజమైన వంటకాల ఫోటోలు కావు.'],
  ['Can I pay or reserve food when ordering is disabled?', 'No. Real payment, ordering and inventory reservation are possible only when ordering is enabled on the live website.', 'ఆర్డర్లు ప్రారంభం కాకముందే చెల్లించవచ్చా?', 'లేదు. Live website లో ordering enabled ఉన్నప్పుడు మాత్రమే నిజమైన order, payment, stock reservation జరుగుతాయి.'],
] as const;

export const SolaraEditorialContent: React.FC = () => {
  const { language } = useLanguage();
  const te = language === 'te';
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <section id="brand-story" className="border-b border-[#ded7ce] bg-[#FAF6ED] px-4 py-20 dark:border-stone-700 dark:bg-[#211f1c] sm:px-6">
        <div className="mx-auto grid max-w-7xl items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-16">
          <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#A44732]">YOUR NEIGHBOURHOOD KITCHEN</p>
          <h2 className="solara-display mt-4 text-4xl leading-relaxed text-[#384B35] dark:text-stone-100 sm:text-5xl">{te ? <>రోజుకు రెండు సమయాలు.<br /><span className="text-[#A44732]">మన ఇంటి రుచులు.</span></> : <>Two simple sessions.<br /><span className="text-[#A44732]">A familiar taste.</span></>}</h2></div>
          <div><p className="text-base leading-loose text-[#605b53] dark:text-stone-300">{te ? 'కొల్లూరు చుట్టుపక్కల ఉన్నవారి కోసం చిన్న మెనూ. ఉదయం టిఫిన్లు, సాయంత్రం రొట్టెలు, పప్పు, కుర్మా — ధరలు, పరిమాణాలు స్పష్టంగా.' : 'A focused menu for Kollur and nearby neighbourhoods. Morning tiffins and evening rotis, dal and kurma, with clear portions and prices. Choose what you like for your preferred meal session.'}</p><p className="mt-6 border-t border-[#ded7ce] pt-5 text-xs font-semibold tracking-widest text-[#756f67]">12 MENU ITEMS · 2 MEAL SESSIONS · PRE-ORDERS</p></div>
        </div>
      </section>
      <section id="at-the-table" className="border-y border-[#ded7ce] bg-[#FAF6ED] px-4 py-20 dark:border-stone-700 dark:bg-[#211f1c] sm:px-6">
        <div className="mx-auto max-w-7xl"><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#A44732]">AT THE TABLE</p><h2 className="solara-display mt-3 text-4xl dark:text-stone-100 sm:text-5xl">{te ? 'మీ తదుపరి భోజనానికి కొన్ని ఎంపికలు.' : 'A little inspiration for your next meal.'}</h2><p className="mt-3 max-w-2xl text-sm leading-loose text-[#605b53] dark:text-stone-300">{te ? 'ఇవి కేవలం వంటకాల కలయిక సూచనలు. కార్ట్ కనీస మొత్తాన్ని సరిచూసుకోండి.' : 'No complicated set meals. These are simple combinations to explore from the available menu; check the food minimum at checkout.'}</p>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">{[
            ['Idly & chutney','Four idlies with included chutney, or try the ragi idly plate.','ఇడ్లీ & చట్నీ','చట్నీతో నాలుగు ఇడ్లీలు లేదా రాగి ఇడ్లీ ప్లేట్.'],
            ['Jowar roti & pappu','Try three jowar rotis with a separate 120 g Pappu of the Day pack.','జొన్న రొట్టె & పప్పు','మూడు జొన్న రొట్టెలు, విడిగా 120 గ్రాముల పప్పు ప్యాక్.'],
            ['Chapathi & kurma','Combine chapathis with a 120 g mixed-veg kurma pack.','చపాతీ & కుర్మా','చపాతీలకు 120 గ్రాముల మిక్స్ వెజ్ కుర్మా ప్యాక్ జోడించండి.']
          ].map((m,i)=><article key={m[0]} className="border-t border-dotted border-[#c7bcb0] pt-4"><p className="font-serif text-sm italic text-[#A44732]">0{i+1} / {i===0?'MORNING':'EVENING'}</p><h3 className="solara-display mt-3 text-2xl">{te?m[2]:m[0]}</h3><p className="mt-2 text-sm leading-loose text-[#605b53] dark:text-stone-300">{te?m[3]:m[1]}</p><a className="mt-3 inline-flex items-center gap-1 border-b border-[#A44732] text-xs text-[#A44732]" href="#upcoming-menu">{te?'మెనూ చూడండి':'Browse the menu'} <ArrowUpRight size={13} /></a></article>)}</div>
        </div>
      </section>
      <section id="delivery-info" className="bg-[#e8ebdc] px-4 py-20 text-[#384B35] dark:bg-[#302b25] dark:text-stone-100 sm:px-6">
        <div className="mx-auto max-w-7xl"><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#A44732]">ORDERING & DELIVERY</p><h2 className="solara-display mt-3 text-4xl sm:text-6xl">{te?'మీ ఇంటి వరకు.':'To your door.'}</h2>
          <div className="mt-10 grid gap-7 border-t border-[#d8d0c5] pt-7 sm:grid-cols-2 lg:grid-cols-4">
            <div><h3 className="mb-3 text-sm font-semibold">{te?'డెలివరీ ఛార్జీలు':'Delivery rates'}</h3><p className="text-sm leading-loose">0–5 km · Free<br/>5–7 km · ₹27<br/>7–10 km · ₹45<br/>10+ km · {te?'డెలివరీ లేదు':'No delivery'}</p></div>
            <div><h3 className="mb-3 text-sm font-semibold">{te?'డెలివరీ సమయాలు':'Delivery hours'}</h3><p className="text-sm leading-loose">Morning · 7–11 AM<br/>Evening · 6–8 PM</p></div>
            <div><h3 className="mb-3 text-sm font-semibold">{te?'వారపు సెలవు':'Weekly holiday'}</h3><p className="text-sm leading-loose">{te?'బుధవారం సెలవు':'Wednesday closed'}<br/>{te?'ఆహార కనీస మొత్తం ₹100':'₹100 minimum food subtotal'}</p></div>
            <div><h3 className="mb-3 text-sm font-semibold">{te?'మా ప్రాంతం':'Our area'}</h3><p className="text-sm leading-loose">Kollur, Hyderabad<br/>{te?'తుది డెలివరీ ఛార్జీ లొకేషన్ ఆధారంగా.':'Final charge depends on your location.'}</p><a className="mt-2 inline-flex items-center gap-1 border-b border-[#A44732] text-xs text-[#A44732]" target="_blank" rel="noopener noreferrer" href="https://maps.google.com/?q=17.444210,78.251478"><MapPin size={14}/>{te?'మ్యాప్‌లో చూడండి':'View location'}</a></div>
          </div>
        </div>
      </section>
      <section id="faq" className="bg-[#FAF6ED] px-4 py-20 dark:bg-[#211f1c] sm:px-6"><div className="mx-auto max-w-4xl"><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#A44732]">QUESTIONS, ANSWERED</p><h2 className="solara-display mt-3 text-4xl sm:text-5xl">{te?'తెలుసుకోవాల్సినవి.':'Good to know.'}</h2>
        <p className="mt-3 text-sm leading-loose text-[#605b53] dark:text-stone-300">{te?'ఆర్డర్ ముందు ఈ వివరాలు చదవండి.':'A few helpful details before your next meal. No surprises about portions or delivery.'}</p>
        <div className="mt-8 border-t border-[#ded7ce]">{faq.map((row,i)=><div key={row[0]} className="border-b border-[#ded7ce]">
          <button id={'faq-question-' + i} type="button" aria-expanded={open===i} aria-controls={'faq-answer-' + i} onClick={()=>setOpen(current=>current===i?null:i)} className="flex min-h-14 w-full items-center justify-between gap-4 py-4 text-left font-semibold">
            <span>{te?row[2]:row[0]}</span><span className={'solara-faq-symbol shrink-0 text-[#A44732] ' + (open===i?'solara-faq-symbol-open':'')} aria-hidden="true">+</span>
          </button>
          <div id={'faq-answer-' + i} role="region" aria-labelledby={'faq-question-' + i} aria-hidden={open!==i} className={'solara-faq-panel ' + (open===i?'solara-faq-panel-open':'')}>
            <div className="min-h-0 overflow-hidden"><p className="pb-5 text-sm leading-loose text-[#605b53] dark:text-stone-300">{te?row[3]:row[1]}</p></div>
          </div>
        </div>)}</div></div>
      </section>
      <section id="contact-info" className="bg-[#FAF6ED] px-4 py-20 text-center dark:bg-[#25221f] sm:px-6"><div className="mx-auto max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#A44732]">QUESTIONS? GET IN TOUCH.</p><h2 className="solara-display mt-4 text-4xl sm:text-6xl">{te?'మాతో మాట్లాడండి.':'Talk to us.'}</h2><p className="mt-4 text-sm leading-loose text-[#605b53] dark:text-stone-300">{te?'మెనూ లేదా డెలివరీ గురించి ఏదైనా సందేహం ఉందా?':'Questions about the menu or delivery?'}</p><a className="mt-6 inline-block border-b border-[#A44732] pb-1 font-serif text-3xl text-[#A44732] sm:text-5xl" href="tel:+918499865803">84998 65803</a><div className="mt-6 flex justify-center gap-6 text-sm text-[#A44732]"><a href="tel:+918499865803" className="inline-flex items-center gap-2"><Phone size={16}/>Call us</a><a href="https://wa.me/918499865803" rel="noopener noreferrer" target="_blank" className="inline-flex items-center gap-2"><MessageCircle size={16}/>WhatsApp</a></div>
      </div></section>
    </>
  );
};
