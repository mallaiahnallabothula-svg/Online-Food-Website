import { useState } from 'react';
import { Clock3, Coffee, Sun, Moon, UtensilsCrossed, Wheat } from 'lucide-react';
import { MENU_CATALOG, type MealPeriod, type MenuItem } from '../../shared/menuCatalog.ts';
import { useLanguage } from '../context/LanguageContext';
import { UpcomingCheckoutPreview } from './UpcomingCheckoutPreview';

const money = (paisa: number) => '₹' + (paisa / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const periods = {
  MORNING: {
    en: 'Morning (6)',
    te: 'ఉదయం (6)',
    hours: '7:00 AM – 11:00 AM',
    titleEn: 'Homestyle breakfast',
    titleTe: 'ఇంటి రుచితో ఉదయం అల్పాహారం',
  },
  EVENING: {
    en: 'Evening (4)',
    te: 'సాయంత్రం (4)',
    hours: '6:00 PM – 8:00 PM',
    titleEn: 'Comforting evening favourites',
    titleTe: 'సాయంత్రం ఇంటి రుచులు',
  },
} as const;

function serving(item: MenuItem, telugu: boolean): string {
  if (item.saleUnit === 'PIECE') {
    return item.minimumQuantity > 1
      ? (telugu ? 'కనీసం ' : 'Minimum ') + item.minimumQuantity + (telugu ? ' ముక్కలు' : ' pieces')
      : (telugu ? 'ఒక్కొక్కటి' : 'Per piece');
  }
  return item.piecesPerUnit === null
    ? (telugu ? 'ఒక ప్లేట్' : 'Per plate')
    : item.piecesPerUnit + (telugu ? ' ముక్కలు / ప్లేట్' : ' pieces / plate');
}

/**
 * Inactive public catalog with a purely local sample cart and preview form.
 * No order, Razorpay, stock, persistence or API calls are permitted here.
 * The existing two-item OrderForm remains the only live customer checkout.
 */
export function UpcomingMenuSection() {
  const { language } = useLanguage();
  const te = language === 'te';
  const [period, setPeriod] = useState<MealPeriod>('MORNING');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const visible = MENU_CATALOG.filter(item => item.mealPeriod === period);
  const selected = visible.filter(item => (quantities[item.id] ?? 0) > 0)
    .map(item => ({ item, quantity: quantities[item.id]! }));
  const subtotalPaisa = selected.reduce((total, line) =>
    total + line.item.pricePaisa * line.quantity, 0);

  function adjustQuantity(item: MenuItem, adjustment: number) {
    setQuantities(current => {
      const old = current[item.id] ?? 0;
      const max = item.dailyPlateLimit ?? 500;
      const next = adjustment > 0
        ? Math.min(max, old === 0 ? item.minimumQuantity : old + 1)
        : old <= item.minimumQuantity ? 0 : old - 1;
      return { ...current, [item.id]: next };
    });
  }

  return (
    <section
      id="upcoming-menu"
      aria-labelledby="upcoming-menu-heading"
      data-testid="upcoming-menu-section"
      className="border-y border-amber-900/10 bg-[#F8F4EB] px-4 py-10 sm:px-6 sm:py-14 dark:border-stone-700 dark:bg-[#23211D]"
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              {te ? 'త్వరలో అందుబాటులోకి' : 'Coming Soon'}
            </span>
            <h2 id="upcoming-menu-heading" className="mt-3 text-2xl font-extrabold text-[#4B2F1D] sm:text-3xl dark:text-amber-100">
              {te ? 'మన ఇంటి వంట — కొత్త 10 రకాల మెనూ' : 'Our upcoming 10-item menu'}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600 dark:text-stone-300">
              {te
                ? 'కొత్త మెనూ చూడవచ్చు. ఈ కార్డుల నుంచి ఆర్డర్ లేదా పేమెంట్ చేయడం ఇంకా ప్రారంభం కాలేదు.'
                : 'Explore our planned menu. Ordering and payment from these cards are not available yet.'}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-xs font-semibold text-[#5F4B33] dark:bg-stone-800 dark:text-stone-200">
            <Clock3 size={16} aria-hidden="true" />
            <span>{periods[period].hours} IST</span>
          </div>
        </div>

        <div className="mt-6 flex w-full flex-wrap gap-2" role="group" aria-label={te ? 'మెనూ సమయం ఎంచుకోండి' : 'Choose meal period'}>
          {(['MORNING', 'EVENING'] as const).map(key => (
            <button
              key={key}
              type="button"
              aria-pressed={period === key}
              onClick={() => {
                if (period !== key) {
                  setPeriod(key);
                  setQuantities({}); // never mix morning and evening checkout slots
                }
              }
              className={
                'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:flex-none ' +
                (period === key
                  ? 'border-emerald-800 bg-[#26543A] text-white'
                  : 'border-stone-300 bg-white text-[#3C493C] hover:border-emerald-700 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100')
              }
            >
              {key === 'MORNING' ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
              {te ? periods[key].te : periods[key].en}
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-base font-bold text-[#36533A] dark:text-emerald-200">
            {period === 'MORNING' ? <Coffee size={19} aria-hidden="true" /> : <UtensilsCrossed size={19} aria-hidden="true" />}
            {te ? periods[period].titleTe : periods[period].titleEn}
          </h3>
          <span className="text-xs text-stone-500 dark:text-stone-400">{visible.length} {te ? 'రకాలు' : 'items'}</span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map(item => (
            <article
              key={item.id}
              data-testid="upcoming-menu-card"
              data-item-id={item.id}
              className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-800"
            >
              <div className="flex h-24 items-center justify-center bg-[#EEE6D6] dark:bg-stone-700" aria-hidden="true">
                {item.saleUnit === 'PIECE'
                  ? <Wheat size={38} strokeWidth={1.4} className="text-amber-700 dark:text-amber-300" />
                  : <UtensilsCrossed size={38} strokeWidth={1.4} className="text-emerald-700 dark:text-emerald-300" />}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-base font-extrabold text-stone-900 dark:text-white">{te ? item.nameTe : item.nameEn}</h4>
                    <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-300">{te ? item.nameEn : item.nameTe}</p>
                  </div>
                  <p className="shrink-0 text-lg font-extrabold text-[#26543A] dark:text-emerald-300">{money(item.pricePaisa)}</p>
                </div>
                <p className="mt-3 text-xs text-stone-600 dark:text-stone-300">
                  {serving(item, te)}
                  {item.includesChutney && <span> · {te ? 'చట్నీతో' : 'Chutney included'}</span>}
                </p>
                <div className="mt-4 border-t border-stone-100 pt-3 dark:border-stone-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-300">
                      {te ? 'డెమో కార్ట్ మాత్రమే' : 'Sample cart only'}
                    </span>
                    {(quantities[item.id] ?? 0) === 0 ? (
                      <button type="button"
                        aria-label={'Add ' + item.nameEn + ' to sample cart'}
                        onClick={() => adjustQuantity(item, 1)}
                        className="min-h-10 rounded-lg bg-[#26543A] px-3 py-2 text-xs font-bold text-white hover:bg-[#1E4330]">
                        {te ? 'జోడించండి +' : 'Add +'}
                      </button>
                    ) : (
                      <div className="inline-flex items-center gap-2">
                        <button type="button"
                          aria-label={'Decrease ' + item.nameEn + ' sample quantity'}
                          onClick={() => adjustQuantity(item, -1)}
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-300 bg-white text-lg font-bold text-emerald-900 dark:border-stone-600 dark:bg-stone-900 dark:text-white">−</button>
                        <span aria-label={item.nameEn + ' sample quantity'}
                          className="min-w-5 text-center text-sm font-bold text-stone-900 dark:text-white">
                          {quantities[item.id]}
                        </span>
                        <button type="button"
                          aria-label={'Increase ' + item.nameEn + ' sample quantity'}
                          disabled={quantities[item.id] >= (item.dailyPlateLimit ?? 500)}
                          onClick={() => adjustQuantity(item, 1)}
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-300 bg-white text-lg font-bold text-emerald-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-stone-600 dark:bg-stone-900 dark:text-white">+</button>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                    {item.legacyItem
                      ? (te ? 'ప్రస్తుతం దిగువ ఆర్డర్ ఫారంలో అందుబాటులో ఉంది' : 'Already available in the order form below')
                      : (te ? 'కొత్త మెనూ ఆర్డర్లు త్వరలో' : 'New-menu ordering coming soon')}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
        <UpcomingCheckoutPreview key={period} period={period} lines={selected} subtotalPaisa={subtotalPaisa} te={te} />
        <p className="mt-6 text-center text-xs leading-relaxed text-stone-500 dark:text-stone-400">
          {te
            ? 'ఇక్కడ చూపిన ధరలు కొత్త మెనూ ప్రివ్యూ కోసం మాత్రమే. లైవ్ ఆర్డరింగ్ కేవలం దిగువ ఉన్న ప్రస్తుత ఫారంలోనే అందుబాటులో ఉంది.'
            : 'Prices shown are for the upcoming menu preview only. Live ordering remains available exclusively through the existing form below.'}
        </p>
      </div>
    </section>
  );
}
