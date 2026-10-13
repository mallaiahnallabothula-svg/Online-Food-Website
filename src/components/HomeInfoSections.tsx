import React from 'react';
import { ArrowUpRight, Clock3, MapPin, Truck } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { DELIVERY_POLICY } from '../../shared/deliveryPolicy.ts';
import { NEW_MENU_LAUNCH_ENABLED } from '../../shared/menuCatalog.ts';

export function HomeInfoSections() {
  const { language } = useLanguage();
  const te = language === 'te';
  const deliveryRows = [
    { range: '0–' + DELIVERY_POLICY.freeRadiusKm + ' km', price: te ? 'ఉచితం' : 'Free' },
    { range: DELIVERY_POLICY.freeRadiusKm + '–' + DELIVERY_POLICY.standardRadiusKm + ' km', price: '₹' + DELIVERY_POLICY.standardChargePaisa / 100 },
    { range: DELIVERY_POLICY.standardRadiusKm + '–' + DELIVERY_POLICY.maxRadiusKm + ' km', price: '₹' + DELIVERY_POLICY.outerChargePaisa / 100 },
    { range: te ? DELIVERY_POLICY.maxRadiusKm + ' km పైన' : 'Above ' + DELIVERY_POLICY.maxRadiusKm + ' km', price: te ? 'డెలివరీ లేదు' : 'No delivery' },
  ];
  const steps = te
    ? ['మెనూలో వంటకాలను ఎంచుకోండి', 'డెలివరీ లొకేషన్ నిర్ధారించండి', 'మొత్తం చూసి చెల్లించండి', 'మీ ఆర్డర్‌ను ట్రాక్ చేయండి']
    : ['Choose your favourites', 'Confirm delivery location', 'Review total and pay', 'Track your order'];
  const kitchenMapUrl = 'https://www.google.com/maps?q=' + DELIVERY_POLICY.kitchenLatitude + ',' + DELIVERY_POLICY.kitchenLongitude;

  return (
    <div className="bg-white text-[#26362D] dark:bg-[#191C19] dark:text-stone-100">
      <section id="how-it-works" aria-labelledby="how-it-works-heading" className="scroll-mt-24 border-t border-stone-100 px-4 py-12 sm:px-6 sm:py-16 dark:border-stone-800">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8D6D50] dark:text-amber-300">{te ? 'ఆర్డర్ చేసే విధానం' : 'Simple steps'}</p>
          <h2 id="how-it-works-heading" className="menu-display mt-2 text-2xl font-bold text-[#1C3828] sm:text-3xl dark:text-emerald-100">
            {te ? 'ఇష్టమైన ఆహారం, సులభమైన ఆర్డర్' : 'Your food, in four simple steps'}
          </h2>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step} className="flex items-start gap-3 rounded-2xl border border-[#E8E7DF] bg-[#FCFBF8] p-5 dark:border-stone-700 dark:bg-stone-800">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8EFE5] text-sm font-bold text-[#1C5732] dark:bg-emerald-950 dark:text-emerald-200">{index + 1}</span>
                <p className="pt-1 text-sm font-semibold leading-6">{step}</p>
              </div>
            ))}
          </div>
          {!NEW_MENU_LAUNCH_ENABLED && (
            <p className="mt-4 text-sm text-stone-600 dark:text-stone-300" role="status">
              {te ? 'ప్రస్తుతం కొత్త మెనూ ప్రివ్యూ మాత్రమే. కొత్త మెనూ ఆర్డర్లు ఇంకా ప్రారంభం కాలేదు.' : 'The new menu is a preview for now. Checkout is not open for these items yet.'}
            </p>
          )}
        </div>
      </section>
      <section id="delivery-details" aria-labelledby="delivery-heading" className="border-t border-[#E9E8E1] bg-[#F8F7F3] px-4 py-12 sm:px-6 sm:py-16 dark:border-stone-800 dark:bg-[#222520]">
        <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-2">
          <div className="rounded-[24px] border border-stone-200 bg-white p-6 sm:p-8 dark:border-stone-700 dark:bg-stone-800">
            <div className="flex items-center gap-3">
              <Truck size={22} className="text-[#1F5E36]" aria-hidden="true" />
              <h2 id="delivery-heading" className="text-xl font-bold text-[#1C3828] dark:text-emerald-100">{te ? 'డెలివరీ ఛార్జీలు' : 'Delivery charges'}</h2>
            </div>
            <dl className="mt-6 space-y-3 text-sm">
              {deliveryRows.map(row => (
                <div key={row.range} className="flex items-center justify-between gap-3 border-b border-stone-100 pb-3 last:border-0 last:pb-0 dark:border-stone-700">
                  <dt className="text-stone-600 dark:text-stone-300">{row.range}</dt>
                  <dd className="font-bold text-[#1F5E36] dark:text-emerald-200">{row.price}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 text-xs leading-5 text-stone-500 dark:text-stone-400">{te ? 'లొకేషన్ నిర్ధారణ తర్వాత కిచెన్ నుంచి నేర దూరం ఆధారంగా ఛార్జీ లెక్కిస్తాం.' : 'Distance is measured in a straight line from our kitchen, after location confirmation.'}</p>
          </div>
          <div className="rounded-[24px] border border-stone-200 bg-white p-6 sm:p-8 dark:border-stone-700 dark:bg-stone-800">
            <div className="flex items-center gap-3">
              <MapPin size={22} className="text-[#1F5E36]" aria-hidden="true" />
              <h2 className="text-xl font-bold text-[#1C3828] dark:text-emerald-100">{te ? 'మన కిచెన్ — కొల్లూరు' : 'Our kitchen in Kollur'}</h2>
            </div>
            <p className="mt-5 text-sm leading-7 text-stone-600 dark:text-stone-300">{te ? 'కొల్లూరు, హైదరాబాద్' : 'Kollur, Hyderabad'}</p>
            <p className="mt-1 text-xs font-medium text-stone-500 dark:text-stone-400">{DELIVERY_POLICY.kitchenLatitude}, {DELIVERY_POLICY.kitchenLongitude}</p>
            <a href={kitchenMapUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-stone-200 bg-[#FAF9F5] px-5 py-2.5 text-sm font-bold text-[#18552C] hover:bg-[#F0F3ED] dark:border-stone-700 dark:bg-stone-700 dark:text-emerald-200">
              {te ? 'మ్యాప్‌లో చూడండి' : 'View on Google Maps'} <ArrowUpRight size={16} aria-hidden="true" />
            </a>
            <div className="mt-6 flex items-start gap-3 border-t border-stone-100 pt-5 text-sm text-stone-600 dark:border-stone-700 dark:text-stone-300">
              <Clock3 size={19} className="mt-0.5 shrink-0 text-[#1F5E36]" aria-hidden="true" />
              <span>{te ? 'ఉదయం 7:00–11:00 · సాయంత్రం 6:00–8:00 IST' : 'Morning 7:00–11:00 AM · Evening 6:00–8:00 PM IST'}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
