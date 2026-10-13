import { PAPPU_VARIETIES, pappuForDate, type PappuVariety } from '../../shared/pappu';
import { getNextPreorderDeliverySlot } from '../../shared/preorderScheduling';
import { useEffect, useRef, useState } from 'react';
import { Clock3, Coffee, Sun, Moon, UtensilsCrossed, ShoppingBag, ArrowRight } from 'lucide-react';
import { MENU_CATALOG, NEW_MENU_LAUNCH_ENABLED, NEW_MENU_ORDER_POLICY, type MealPeriod, type MenuItem } from '../../shared/menuCatalog.ts';
import { useLanguage } from '../context/LanguageContext';
import { FoodArtwork } from './FoodArtwork';
import { UpcomingCheckoutPreview } from './UpcomingCheckoutPreview';
import { checkReorderStock, type ReorderError, type ReorderRequest } from '../utils/reorder';

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
    en: 'Evening (6)',
    te: 'సాయంత్రం (6)',
    hours: '6:00 PM – 8:00 PM',
    titleEn: 'Comforting evening favourites',
    titleTe: 'సాయంత్రం ఇంటి రుచులు',
  },
} as const;

function serving(item: MenuItem, telugu: boolean): string {
  if (item.saleUnit === 'PACK') return '120 g / ' + (telugu ? 'ప్యాక్' : 'pack');
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
 * Public catalog and cart for the additive 12-item menu. The production flag
 * selects the verified checkout; the fail-closed default remains preview-only.
 */
export function UpcomingMenuSection({ reorderRequest, onReorder }: { reorderRequest?: ReorderRequest | null; onReorder?: (request: ReorderRequest) => void } = {}) {
  const { language } = useLanguage();
  const te = language === 'te';
  const [period, setPeriod] = useState<MealPeriod>('MORNING');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [availability, setAvailability] = useState<{ deliveryDateIst: string; pappu: PappuVariety | null; stock: Record<string, number> } | null>(null);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [reorderNotice, setReorderNotice] = useState<'checking' | 'ready' | 'error' | ReorderError | null>(null);
  const [reorderCheckoutVersion, setReorderCheckoutVersion] = useState(0);
  useEffect(() => {
    if (!NEW_MENU_LAUNCH_ENABLED) return;
    let active = true;
    setAvailability(null); setAvailabilityError(false);
    fetch('/api/new-menu/menu-status?period=' + period).then(async response => {
      if (!response.ok) throw new Error('Availability unavailable');
      const data = await response.json();
      if (active) setAvailability(data);
    }).catch(() => { if (active) setAvailabilityError(true); });
    return () => { active = false; };
  }, [period, refresh]);
  // This can only refill a fresh cart; new quote/payment is always customer-initiated.
  useEffect(() => {
    if (!reorderRequest) return;
    let active = true;
    setReorderNotice('checking');
    setPeriod(reorderRequest.period);
    document.getElementById('upcoming-menu')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    if (!NEW_MENU_LAUNCH_ENABLED) {
      setReorderNotice('unavailable');
      return;
    }
    fetch('/api/new-menu/menu-status?period=' + reorderRequest.period, { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('Menu availability unavailable');
        return response.json();
      })
      .then(data => {
        if (!active) return;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data?.deliveryDateIst) ||
            !data?.stock || typeof data.stock !== 'object') {
          setReorderNotice('unavailable');
          return;
        }
        const issue = checkReorderStock(reorderRequest, data.stock);
        if (issue) {
          setReorderNotice(issue);
          return;
        }
        setAvailability(data);
        setAvailabilityError(false);
        // Replace the old cart: do not silently combine it with a prior selection.
        setQuantities(Object.fromEntries(reorderRequest.lines.map(line => [line.itemId, line.quantity])));
        setReorderCheckoutVersion(n => n + 1); // Reset old checkout state; review & pay again.
        setReorderNotice('ready');
      })
      .catch(() => { if (active) setReorderNotice('error'); });
    return () => { active = false; };
  }, [reorderRequest]);
  const deliveryDate = availability?.deliveryDateIst ?? getNextPreorderDeliverySlot(period, new Date()).deliveryDateIst;
  const pappu = availability ? availability.pappu : NEW_MENU_LAUNCH_ENABLED ? null : pappuForDate(deliveryDate);
  const checkoutRef = useRef<HTMLDivElement>(null);
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  useEffect(() => {
    if (!checkoutRef.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setCheckoutVisible(entry?.isIntersecting ?? false), { threshold: 0.05 });
    observer.observe(checkoutRef.current);
    return () => observer.disconnect();
  }, []);
  function showCheckout() {
    checkoutRef.current?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    checkoutRef.current?.focus({ preventScroll: true });
  }
  const visible = MENU_CATALOG.filter(item => item.mealPeriod === period).map(item => item.id === 'pappu-of-the-day' && pappu ? { ...item, ...PAPPU_VARIETIES[pappu] } : item);
  const selected = visible.filter(item => (quantities[item.id] ?? 0) > 0)
    .map(item => ({ item, quantity: quantities[item.id]! }));
  const subtotalPaisa = selected.reduce((total, line) =>
    total + line.item.pricePaisa * line.quantity, 0);

  function adjustQuantity(item: MenuItem, adjustment: number) {
    setReorderNotice(null);
    setQuantities(current => {
      const old = current[item.id] ?? 0;
      const max = availability?.stock[item.id] ?? item.dailyPlateLimit ?? 500;
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
      className="menu-storefront scroll-mt-40 sm:scroll-mt-24 border-y border-stone-200 bg-[#FBFAF7] px-4 py-12 sm:px-6 sm:py-14 dark:border-stone-700 dark:bg-[#232820]"
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="inline-flex rounded-full border border-[#DDDCCF] bg-[#EFEEE6] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#385440] dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              {NEW_MENU_LAUNCH_ENABLED ? (te ? 'ఆర్డర్లు స్వీకరిస్తున్నాం' : 'Ordering open') : (te ? 'త్వరలో అందుబాటులోకి' : 'Coming Soon')}
            </span>
            <h2 id="upcoming-menu-heading" className="menu-display mt-3 text-3xl font-extrabold text-[#183E29] sm:text-4xl dark:text-amber-100">
              {te ? 'మన మెనూ — 12 రకాలు' : 'Our Menu — 12 choices'}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600 dark:text-stone-300">
              {te
                ? (NEW_MENU_LAUNCH_ENABLED ? 'ఉదయం, సాయంత్రం మెనూ నుంచి ఎంచుకుని డెలివరీ వివరాలు ధృవీకరించండి.' : 'కొత్త మెనూను చూడండి. ఆర్డర్లు ఇంకా ప్రారంభం కాలేదు.')
                : (NEW_MENU_LAUNCH_ENABLED ? 'Choose from the morning or evening menu and confirm your delivery details.' : 'Explore the planned menu. Ordering is not open yet.')}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-xs font-semibold text-[#5F4B33] dark:bg-stone-800 dark:text-stone-200">
            <Clock3 size={16} aria-hidden="true" />
            <span>{periods[period].hours} IST</span>
          </div>
        </div>

        <p className="mt-3 text-sm">{te ? 'ప్యాకింగ్ ధరలో కలిపి ఉంది. కూరలు ఐచ్ఛికం. ప్రతి ఆర్డర్ ఆహార కనీస మొత్తం ₹100; డెలివరీ అదనం.' : 'Packing included. Curries are optional. ₹100 food minimum per order, excluding delivery.'}</p>
        <div className="mt-6 flex w-full flex-wrap gap-2" role="group" aria-label={te ? 'మెనూ సమయం ఎంచుకోండి' : 'Choose meal period'}>
          {(['MORNING', 'EVENING'] as const).map(key => (
            <button
              key={key}
              type="button"
              aria-pressed={period === key}
              onClick={() => {
                if (period !== key) {
                  setPeriod(key);
                  // Preserve each session cart; only the active session is checked out.
                }
              }}
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

        <p className="mt-4 text-sm">{deliveryDate} · {period === 'EVENING' && pappu ? (te ? PAPPU_VARIETIES[pappu].nameTe : PAPPU_VARIETIES[pappu].nameEn) : ''}</p>
        {availabilityError && <p role="alert">Menu availability unavailable. <button type="button" onClick={() => setRefresh(value => value + 1)}>Retry</button></p>}
        {reorderNotice && (
          <p
            role={['error', 'unavailable', 'stock', 'minimum'].includes(reorderNotice) ? 'alert' : 'status'}
            aria-live="polite"
            className={'mt-3 rounded-xl border p-3 text-sm font-semibold ' + (reorderNotice === 'ready' ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200')}
          >
            {reorderNotice === 'checking'
              ? (te ? 'తాజా స్టాక్ చెక్ చేస్తున్నాం…' : 'Checking current stock for your reorder…')
              : reorderNotice === 'ready'
                ? (te ? 'మీ పాత ఐటమ్స్ కొత్త కార్ట్‌లో ఉన్నాయి. ధర, పరిమాణం, డెలివరీ వివరాలు సరిచూసుకోండి.' : 'Items added to a fresh cart. Review current prices, quantities and delivery details.')
                : reorderNotice === 'stock'
                  ? (te ? 'ఈ ఐటమ్స్ అన్ని ఇప్పుడు స్టాక్‌లో లేవు. దయచేసి కొత్తగా కార్ట్ తయారు చేయండి.' : 'Not enough stock for the same quantities. Please build a new cart.')
                  : reorderNotice === 'minimum'
                    ? (te ? 'ఈ ఐటమ్స్‌కు ప్రస్తుతం కనీస పరిమాణం మారింది. దయచేసి కొత్తగా కార్ట్ తయారు చేయండి.' : 'An item minimum has changed. Please build a new cart.')
                    : (te ? 'ప్రస్తుతం రీఆర్డర్ చేయలేము. కొత్తగా కార్ట్ తయారు చేసి ప్రయత్నించండి.' : 'Reorder unavailable right now. Please select items from the menu.')}
          </p>
        )}
        <div className="mt-6 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-base font-bold text-[#36533A] dark:text-emerald-200">
            {period === 'MORNING' ? <Coffee size={19} aria-hidden="true" /> : <UtensilsCrossed size={19} aria-hidden="true" />}
            {te ? periods[period].titleTe : periods[period].titleEn}
          </h3>
          <span className="text-xs text-stone-500 dark:text-stone-400">{visible.length} {te ? 'రకాలు' : 'items'}</span>
        </div>

        {selected.length > 0 && <p className="mt-2 text-xs text-stone-600 dark:text-stone-300">{te ? 'ప్రతి సమయానికి వేరు కార్ట్, ఆర్డర్, పేమెంట్.' : 'Each session has a separate cart, order and payment.'}</p>}
        <div className="mt-4 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-3">
          {visible.map(item => (
            <article
              key={item.id}
              data-testid="upcoming-menu-card"
              data-item-id={item.id}
              className="flex min-w-0 flex-col overflow-hidden rounded-[22px] border border-stone-200/80 bg-white shadow-[0_10px_32px_-24px_rgba(28,47,36,0.4)] transition-shadow hover:shadow-md dark:border-stone-700 dark:bg-stone-800"
            >
              <FoodArtwork itemId={item.id} className="aspect-[5/4] w-full" />
              <div className="flex flex-1 flex-col p-3 sm:p-4">
                <div className="flex flex-col items-start gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-extrabold leading-relaxed text-stone-900 dark:text-white">{te ? item.nameTe : item.nameEn}</h4>
                    <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-300">{te ? item.nameEn : item.nameTe}</p>
                  </div>
                  <p className="shrink-0 text-lg font-extrabold text-[#26543A] dark:text-emerald-300">{money(item.pricePaisa)}<span className="ml-1 text-[11px] font-normal text-stone-500 dark:text-stone-300">/ {item.saleUnit === 'PACK' ? (te ? 'ప్యాక్' : 'pack') : item.saleUnit === 'PIECE' ? (te ? 'ముక్క' : 'piece') : (te ? 'ప్లేట్' : 'plate')}</span></p>
                </div>
                <p className="mb-4 mt-2 text-xs leading-relaxed text-stone-600 dark:text-stone-300">
                  {serving(item, te)}
                  {item.includesChutney && <span> · {te ? 'చట్నీతో' : 'Chutney included'}</span>}
                </p>
                <div className="mt-auto border-t border-stone-100 pt-3 dark:border-stone-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-300">
                      {NEW_MENU_LAUNCH_ENABLED ? (te ? 'మీ కార్ట్' : 'Your cart') : (te ? 'డెమో కార్ట్ మాత్రమే' : 'Sample cart only')}
                    </span>
                    {(quantities[item.id] ?? 0) === 0 ? (
                      <button type="button"
                      disabled={NEW_MENU_LAUNCH_ENABLED && (!availability || (availability.stock[item.id] ?? 0) < item.minimumQuantity)}
                      aria-label={'Add ' + item.nameEn + (NEW_MENU_LAUNCH_ENABLED ? ' to cart' : ' to sample cart')}
                        onClick={() => adjustQuantity(item, 1)}
                        className="min-h-11 rounded-full bg-[#26543A] px-3 py-2 text-xs font-bold text-white hover:bg-[#1E4330]">
                        {availability && (availability.stock[item.id] ?? 0) < item.minimumQuantity ? (te ? 'స్టాక్ లేదు' : 'Sold out') : te ? 'జోడించండి +' : 'Add +'}
                      </button>
                    ) : (
                      <div className="inline-flex items-center gap-0">
                        <button type="button"
                          aria-label={'Decrease ' + item.nameEn + (NEW_MENU_LAUNCH_ENABLED ? ' quantity' : ' sample quantity')}
                          onClick={() => adjustQuantity(item, -1)}
                          className="flex h-11 w-11 items-center justify-center rounded-lg border border-stone-300 bg-white text-lg font-bold text-emerald-900 dark:border-stone-600 dark:bg-stone-900 dark:text-white">−</button>
                        <span aria-label={item.nameEn + (NEW_MENU_LAUNCH_ENABLED ? ' quantity' : ' sample quantity')}
                          className="min-w-5 text-center text-sm font-bold text-stone-900 dark:text-white">
                          {quantities[item.id]}
                        </span>
                        <button type="button"
                          aria-label={'Increase ' + item.nameEn + (NEW_MENU_LAUNCH_ENABLED ? ' quantity' : ' sample quantity')}
                          disabled={(quantities[item.id] ?? 0) >= (availability?.stock[item.id] ?? item.dailyPlateLimit ?? 500)}
                          onClick={() => adjustQuantity(item, 1)}
                          className="flex h-11 w-11 items-center justify-center rounded-lg border border-stone-300 bg-white text-lg font-bold text-emerald-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-stone-600 dark:bg-stone-900 dark:text-white">+</button>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                    {NEW_MENU_LAUNCH_ENABLED
                      ? ((quantities[item.id] ?? 0) > 0 ? money(item.pricePaisa * (quantities[item.id] ?? 0)) : '')
                      : (te ? 'కొత్త మెనూ ఆర్డర్లు త్వరలో' : 'New-menu ordering coming soon')}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
        <aside aria-label={te ? 'మీ కార్ట్ సారాంశం' : 'Your cart summary'} className="rounded-[22px] border border-stone-200 bg-white p-5 shadow-sm lg:sticky lg:top-24 dark:border-stone-700 dark:bg-stone-800">
          <h3 className="menu-display flex items-center justify-between gap-2 text-xl font-bold text-[#4B2F1D] dark:text-amber-100">{te ? 'మీ కార్ట్' : 'Your cart'}<ShoppingBag size={21} aria-hidden="true" /></h3>
          {selected.length === 0 ? <p className="py-8 text-sm leading-relaxed text-stone-500 dark:text-stone-300">{te ? 'మీకు నచ్చిన వంటకాలను పైన జోడించండి.' : 'Add your favourites from the menu to get started.'}</p> : <ul className="my-5 space-y-4">
            {selected.map(({ item, quantity }) => <li key={item.id} className="flex items-center gap-3 text-sm">
              <FoodArtwork itemId={item.id} className="h-12 w-12 shrink-0 rounded-lg" />
              <span className="min-w-0 flex-1 text-stone-800 dark:text-stone-100">{te ? item.nameTe : item.nameEn}<span className="block text-xs text-stone-500 dark:text-stone-300">× {quantity} {item.saleUnit === 'PACK' ? (te ? 'ప్యాక్' : 'pack') : item.saleUnit === 'PIECE' ? (te ? 'ముక్కలు' : 'pieces') : (te ? 'ప్లేట్లు' : 'plates')}</span></span>
              <strong className="shrink-0">{money(item.pricePaisa * quantity)}</strong>
            </li>)}
          </ul>}
          <div className="flex justify-between gap-3 border-t border-stone-200 pt-4 text-sm dark:border-stone-600"><span>{te ? 'ఆహార మొత్తం' : 'Food subtotal'}</span><strong data-testid="menu-cart-total">{money(subtotalPaisa)}</strong></div>
          <p aria-live="polite" className="mt-3 text-xs leading-relaxed text-stone-600 dark:text-stone-300">{subtotalPaisa < NEW_MENU_ORDER_POLICY.minimumCartPaisa ? (te ? 'కనీస ఆహార ధర ₹100. ఇంకా ' : '₹100 food minimum. Add ') + money(NEW_MENU_ORDER_POLICY.minimumCartPaisa - subtotalPaisa) + (te ? ' జోడించండి.' : ' more.') : (te ? 'కనీస ఆహార ధర పూర్తైంది.' : 'Food minimum met.')}</p>
          <p className="mt-2 text-xs leading-relaxed text-stone-500 dark:text-stone-300">{te ? 'లొకేషన్ తనిఖీ తర్వాత డెలివరీ ఛార్జీ చూపిస్తాం.' : 'Delivery calculated after location check.'}</p>
          <button type="button" onClick={showCheckout} disabled={subtotalPaisa < NEW_MENU_ORDER_POLICY.minimumCartPaisa} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#26543A] px-3 py-3 text-sm font-bold text-white disabled:opacity-40">{te ? 'డెలివరీ వివరాలకు వెళ్లండి' : 'Continue to delivery'}<ArrowRight size={16} aria-hidden="true" /></button>
        </aside>
        </div>
        <p className="mt-4 text-xs text-stone-500 dark:text-stone-300">{te ? 'AI చిత్రాలు సూచనార్థం మాత్రమే. పరిమాణాలకు మెనూ వివరాలు చూడండి.' : 'AI food illustrations. Refer to menu details for serving quantities.'}</p>
        <div ref={checkoutRef} id="menu-delivery" tabIndex={-1} className="scroll-mt-40 sm:scroll-mt-24 rounded-2xl focus-visible:outline-2 focus-visible:outline-emerald-700">
          <UpcomingCheckoutPreview key={period + ':' + reorderCheckoutVersion} period={period} lines={selected} subtotalPaisa={subtotalPaisa} te={te} onReorder={onReorder} />
        </div>
        {selected.length > 0 && !checkoutVisible && <div className="menu-mobile-cart fixed inset-x-3 bottom-3 z-30 flex items-center justify-between gap-3 rounded-2xl bg-[#26543A] p-3 text-white shadow-xl lg:hidden">
          <span className="pl-1 text-sm font-bold">{selected.length} {te ? 'రకాలు' : 'items'} · {money(subtotalPaisa)}<span className="block text-[10px] font-normal text-emerald-100">{te ? 'ఆహార మొత్తం' : 'Food subtotal'}</span></span>
          <button type="button" onClick={showCheckout} className="flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#26543A]">{te ? 'కార్ట్ చూడండి' : 'View cart'}<ArrowRight size={16} aria-hidden="true" /></button>
        </div>}
        <p className="mt-6 text-center text-xs leading-relaxed text-stone-500 dark:text-stone-400">
          {te
            ? (NEW_MENU_LAUNCH_ENABLED ? 'ఆర్డర్‌కు ముందు ధర, డెలివరీ ప్రాంతం, స్టాక్ సర్వర్‌లో మళ్లీ ధృవీకరించబడతాయి.' : 'ఇక్కడి ధరలు ప్రివ్యూ మాత్రమే. కొత్త మెనూ ఆర్డర్లు ఇంకా ప్రారంభం కాలేదు.')
            : (NEW_MENU_LAUNCH_ENABLED ? 'Price, delivery area and stock are rechecked on the server before payment.' : 'These are preview prices. New-menu ordering is not open yet.')}
        </p>
      </div>
    </section>
  );
}
