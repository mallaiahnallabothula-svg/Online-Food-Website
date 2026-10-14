import { PAPPU_VARIETIES, pappuForDate } from '../../shared/pappu';
import { getNextPreorderDeliverySlot } from '../../shared/preorderScheduling';
import { useCallback, useEffect, useState } from 'react';
import { Clock3, Coffee, Sun, Moon, UtensilsCrossed, ArrowRight } from 'lucide-react';
import { MENU_CATALOG, NEW_MENU_LAUNCH_ENABLED, NEW_MENU_ORDER_POLICY, type MealPeriod, type MenuItem } from '../../shared/menuCatalog.ts';
import { useLanguage } from '../context/LanguageContext';
import type { CheckoutSelection } from '../utils/checkoutSelection';
import { checkReorderStock, type ReorderError, type ReorderRequest } from '../utils/reorder';
import { FoodArtwork } from './FoodArtwork';
import { FoodDetailDialog } from './FoodDetailDialog';
import { MenuAvailabilityBadge } from './MenuAvailabilityBadge';
import { availabilityForItem, STATUS_RECHECK_MS, validateMenuStatus, type VerifiedMenuStatus } from '../utils/menuAvailability';

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
export function UpcomingMenuSection({ reorderRequest, onCheckout, initialCheckoutSelection }: { reorderRequest?: ReorderRequest | null; onCheckout?: (selection: CheckoutSelection) => void; initialCheckoutSelection?: CheckoutSelection | null } = {}) {
  const { language } = useLanguage();
  const te = language === 'te';
  const [period, setPeriod] = useState<MealPeriod>(initialCheckoutSelection?.period ?? 'MORNING');
  const [quantities, setQuantities] = useState<Record<string, number>>(() => Object.fromEntries((initialCheckoutSelection?.lines ?? []).map(line => [line.item.id, line.quantity])));
  const [availability, setAvailability] = useState<VerifiedMenuStatus | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const closeDetail = useCallback(() => setDetailId(null), []);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [reorderNotice, setReorderNotice] = useState<'checking' | 'ready' | 'error' | ReorderError | null>(null);
  useEffect(() => {
    if (!NEW_MENU_LAUNCH_ENABLED) return;
    let active = true;
    const controller = new AbortController();
    setAvailability(null); setAvailabilityError(false);
    fetch('/api/new-menu/menu-status?period=' + period, { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Availability unavailable');
      const snapshot = validateMenuStatus(await response.json(), period, new Date());
      if (!snapshot) throw new Error('Invalid or mismatched stock date');
      if (active) setAvailability(snapshot);
    }).catch(() => { if (active) { setAvailability(null); setAvailabilityError(true); } });
    return () => { active = false; controller.abort(); };
  }, [period, refresh]);
  // Invalidate on return/focus and at most once per two minutes while visible.
  useEffect(() => {
    if (!NEW_MENU_LAUNCH_ENABLED) return;
    const onVisible = () => { if (document.visibilityState !== 'hidden') setRefresh(value => value + 1); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    const timer = window.setInterval(onVisible, STATUS_RECHECK_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.clearInterval(timer);
    };
  }, []);
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
        const snapshot = validateMenuStatus(data, reorderRequest.period, new Date());
        if (!snapshot || !snapshot.orderingEnabled) {
          setReorderNotice('unavailable');
          return;
        }
        const issue = checkReorderStock(reorderRequest, snapshot.stock);
        if (issue) {
          setReorderNotice(issue);
          return;
        }
        setAvailability(snapshot);
        setAvailabilityError(false);
        // Replace the old cart: do not silently combine it with a prior selection.
        setQuantities(Object.fromEntries(reorderRequest.lines.map(line => [line.itemId, line.quantity])));
        setReorderNotice('ready');
      })
      .catch(() => { if (active) setReorderNotice('error'); });
    return () => { active = false; };
  }, [reorderRequest]);
  const deliveryDate = availability?.deliveryDateIst ?? getNextPreorderDeliverySlot(period, new Date()).deliveryDateIst;
  const pappu = availability ? availability.pappu : NEW_MENU_LAUNCH_ENABLED ? null : pappuForDate(deliveryDate);
  function showCheckout() {
    if (subtotalPaisa < NEW_MENU_ORDER_POLICY.minimumCartPaisa || selected.length === 0) return;
    if (NEW_MENU_LAUNCH_ENABLED && selected.some(line => {
      const status = availabilityForItem(line.item, true, availability, availabilityError, new Date());
      return (status !== 'available' && status !== 'preorder') || line.quantity > (availability?.stock[line.item.id] ?? 0);
    })) return;
    onCheckout?.({ period, lines: selected, subtotalPaisa });
  }
  const visible = MENU_CATALOG.filter(item => item.mealPeriod === period).map(item => item.id === 'pappu-of-the-day' && pappu ? { ...item, ...PAPPU_VARIETIES[pappu] } : item);
  const detailItem = visible.find(item => item.id === detailId);
  const selected = visible.filter(item => (quantities[item.id] ?? 0) > 0)
    .map(item => ({ item, quantity: quantities[item.id]! }));
  const subtotalPaisa = selected.reduce((total, line) =>
    total + line.item.pricePaisa * line.quantity, 0);
  const selectedQuantity = selected.reduce((total, line) => total + line.quantity, 0);

  function adjustQuantity(item: MenuItem, adjustment: number) {
    setReorderNotice(null);
    setQuantities(current => {
      const old = current[item.id] ?? 0;
      if (adjustment > 0 && NEW_MENU_LAUNCH_ENABLED) {
        const status = availabilityForItem(item, true, availability, availabilityError, new Date());
        if (status !== 'available' && status !== 'preorder') return current;
      }
      const max = NEW_MENU_LAUNCH_ENABLED ? (availability?.stock[item.id] ?? 0) : (item.dailyPlateLimit ?? 500);
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
      className="menu-storefront solara-storefront scroll-mt-40 sm:scroll-mt-24 border-y border-[#e6dece] bg-[#FAF6ED] px-4 py-10 sm:px-6 sm:py-12 lg:py-14 dark:border-stone-700 dark:bg-[#25221f]"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              {NEW_MENU_LAUNCH_ENABLED ? (te ? 'ఆర్డర్లు స్వీకరిస్తున్నాం' : 'Ordering open') : (te ? 'త్వరలో అందుబాటులోకి' : 'Coming Soon')}
            </span>
            <h2 id="upcoming-menu-heading" className="solara-display mt-3 text-4xl font-normal tracking-tight text-[#384B35] sm:text-6xl dark:text-amber-100">
              {te ? 'మన మెనూ — 12 వంటకాలు' : 'Our menu — 12 favourites'}
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
        <div className="solara-menu-tabs relative mt-6 flex w-full max-w-sm gap-2" data-period={period} role="group" aria-label={te ? 'మెనూ సమయం ఎంచుకోండి' : 'Choose meal period'}>
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
                'solara-menu-tab relative inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border px-2 py-2.5 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:px-4 ' +
                (period === key
                  ? 'border-[#A44732] bg-[#A44732] text-white'
                  : 'border-[#ded7ce] bg-transparent text-[#756f67] hover:border-[#A44732] dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100')
              }
            >
              {key === 'MORNING' ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
              {te ? periods[key].te : periods[key].en}
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm">{deliveryDate} · {period === 'EVENING' && pappu ? (te ? PAPPU_VARIETIES[pappu].nameTe : PAPPU_VARIETIES[pappu].nameEn) : ''}</p>
        {availabilityError && <p role="alert" className="mt-2 text-sm text-amber-900 dark:text-amber-200">{te ? 'స్టాక్ వివరాలు ధృవీకరించలేకపోయాం.' : 'Unable to verify stock.'} <button type="button" className="font-semibold underline" onClick={() => setRefresh(value => value + 1)}>{te ? 'మళ్లీ ప్రయత్నించండి' : 'Retry'}</button></p>}
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
        <div className="mt-5 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-2xl font-medium text-[#384B35] dark:text-stone-100">
            {period === 'MORNING' ? <Coffee size={19} aria-hidden="true" /> : <UtensilsCrossed size={19} aria-hidden="true" />}
            {te ? periods[period].titleTe : periods[period].titleEn}
          </h3>
          <span className="text-xs text-stone-500 dark:text-stone-400">{visible.length} {te ? 'రకాలు' : 'items'}</span>
        </div>

        {selected.length > 0 && <p className="mt-2 text-xs text-stone-600 dark:text-stone-300">{te ? 'ప్రతి సమయానికి వేరు కార్ట్, ఆర్డర్, పేమెంట్.' : 'Each session has a separate cart, order and payment.'}</p>}
        <div className="mt-6">
          <div key={period} className="solara-menu-list grid min-w-0 grid-cols-1 gap-x-10 md:auto-rows-fr md:grid-cols-2" role="list">
            {visible.map(item => (
              <article key={item.id} role="listitem" data-testid="upcoming-menu-card" data-item-id={item.id}
                className="solara-menu-row grid h-full min-w-0 grid-cols-[64px_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 border-b border-[#ded7ce] py-4 sm:py-5 sm:grid-cols-[80px_minmax(0,1fr)_auto] sm:gap-x-4 dark:border-stone-600">
                <button type="button" aria-label={'View artwork details for ' + item.nameEn} onClick={() => setDetailId(item.id)} className="shrink-0 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-[#A44732]">
                  <FoodArtwork itemId={item.id} className="h-16 w-16 rounded-lg sm:h-20 sm:w-20" />
                </button>
                <div className="min-w-0 pt-1">
                  <h4 className="text-base font-medium leading-snug text-[#384B35] dark:text-stone-100 sm:text-lg"><button type="button" aria-label={'View details for ' + item.nameEn} onClick={() => setDetailId(item.id)} className="text-left hover:underline focus-visible:outline-2 focus-visible:outline-[#A44732]">{te ? item.nameTe : item.nameEn}</button></h4>
                  <p className="mt-2 text-[11px] leading-relaxed text-[#756f67] dark:text-stone-300 sm:text-xs">{serving(item, te)}{item.includesChutney && <span> · {te ? 'చట్నీతో' : 'Chutney included'}</span>}</p>
                   {!NEW_MENU_LAUNCH_ENABLED && <p className="mt-1 text-[10px] leading-relaxed text-[#756f67] dark:text-stone-400">{te ? 'కొత్త మెనూ ఆర్డర్లు త్వరలో' : 'New-menu ordering coming soon'}</p>}
                   <div className="mt-2"><MenuAvailabilityBadge status={availabilityForItem(item, NEW_MENU_LAUNCH_ENABLED, availability, availabilityError, new Date())} te={te} /></div>
                </div>
                <div className="flex min-w-[70px] flex-col items-end gap-3 pt-0.5">
                  <p className="text-right font-serif text-xl text-[#A44732] dark:text-[#e8ad99]">{money(item.pricePaisa)}</p>
                  {(quantities[item.id] ?? 0) === 0 ? (
                    <button type="button" disabled={NEW_MENU_LAUNCH_ENABLED && !['available','preorder'].includes(availabilityForItem(item, true, availability, availabilityError, new Date()))}
                      aria-label={'Add ' + item.nameEn + (NEW_MENU_LAUNCH_ENABLED ? ' to cart' : ' to sample cart')}
                      onClick={() => adjustQuantity(item, 1)}
                      className="min-h-11 rounded-md border border-[#A44732] px-3 py-2 text-xs font-semibold text-[#A44732] transition-colors hover:bg-[#A44732] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm">
                      {te ? 'జోడించండి +' : 'Add +'}
                    </button>
                  ) : (
                    <div className="solara-quantity-enter inline-flex h-11 items-center rounded-md border border-[#c7bcb0]">
                      <button type="button" aria-label={'Decrease ' + item.nameEn + (NEW_MENU_LAUNCH_ENABLED ? ' quantity' : ' sample quantity')} onClick={() => adjustQuantity(item, -1)} className="h-11 w-9 rounded-l-md text-base font-bold text-[#A44732]">−</button>
                      <span aria-label={item.nameEn + (NEW_MENU_LAUNCH_ENABLED ? ' quantity' : ' sample quantity')} className="min-w-5 text-center text-sm font-bold text-[#384B35] dark:text-stone-100">{quantities[item.id]}</span>
                      <button type="button" aria-label={'Increase ' + item.nameEn + (NEW_MENU_LAUNCH_ENABLED ? ' quantity' : ' sample quantity')} disabled={NEW_MENU_LAUNCH_ENABLED
                          ? !['available','preorder'].includes(availabilityForItem(item, true, availability, availabilityError, new Date())) || (quantities[item.id] ?? 0) >= (availability?.stock[item.id] ?? 0)
                          : (quantities[item.id] ?? 0) >= (item.dailyPlateLimit ?? 500)} onClick={() => adjustQuantity(item, 1)} className="h-11 w-9 rounded-r-md text-base font-bold text-[#A44732] disabled:opacity-40">+</button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        <div className="mt-6 flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-[#ded7ce] py-4 dark:border-stone-600" aria-label={te ? 'ఆహార మొత్తం మరియు డెలివరీ' : 'Food total and delivery'}>
          <div>
            <p className="text-sm text-[#5f584f] dark:text-stone-200">{te ? 'ఆహార మొత్తం' : 'Food subtotal'} <strong data-testid="menu-cart-total" className="ml-1 font-bold tabular-nums text-[#A44732]"><span key={subtotalPaisa} className="solara-cart-count">{money(subtotalPaisa)}</span></strong></p>
            <p aria-live="polite" className="mt-1 text-xs text-[#756f67] dark:text-stone-300">
              {subtotalPaisa < NEW_MENU_ORDER_POLICY.minimumCartPaisa
                ? (te ? 'కనీసం ₹100. ఇంకా ' : '₹100 minimum. Add ') + money(NEW_MENU_ORDER_POLICY.minimumCartPaisa - subtotalPaisa) + (te ? ' జోడించండి.' : ' more.')
                : (te ? 'కనీస ఆహార మొత్తం పూర్తైంది.' : 'Food minimum met.')}
              {' · '}{te ? 'డెలివరీ ఛార్జీ లొకేషన్ తనిఖీ తర్వాత.' : 'Delivery checked after location.'}
            </p>
          </div>
          <button type="button" onClick={showCheckout} disabled={subtotalPaisa < NEW_MENU_ORDER_POLICY.minimumCartPaisa}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#A44732] px-5 py-2.5 text-sm font-semibold text-white sm:w-auto hover:bg-[#934034] disabled:cursor-not-allowed disabled:opacity-40">
            {te ? 'డెలివరీ వివరాలకు' : 'Continue to delivery'} <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
        </div>
        <p className="mt-4 text-xs text-stone-500 dark:text-stone-300">{te ? 'ఆహార పరిమాణాలు, ధరలు, స్టాక్ వివరాలు ఆర్డర్ ముందు సరిచూసుకోండి.' : 'Check portions, prices and availability before ordering.'}</p>
        {selected.length > 0 && (
          <div className="menu-mobile-cart sticky bottom-3 z-30 mt-4 flex min-w-0 items-center justify-between gap-3 rounded-lg bg-[#A44732] p-3 text-white shadow-xl sm:mx-auto sm:w-[430px]">
            <span key={selectedQuantity} className="solara-cart-count min-w-0 pl-1 text-sm font-bold">{selectedQuantity} {te ? 'ఐటమ్స్' : 'items'} · {money(subtotalPaisa)}<span className="block text-[10px] font-normal text-emerald-100">{te ? 'ఆహార మొత్తం' : 'Food subtotal'}</span></span>
            <button type="button" onClick={showCheckout} disabled={subtotalPaisa < NEW_MENU_ORDER_POLICY.minimumCartPaisa} className="flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#A44732] disabled:cursor-not-allowed disabled:opacity-50">
              {te ? 'డెలివరీకి వెళ్లండి' : 'View cart'}<ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        )}
        <p className="mt-4 text-center text-xs leading-relaxed text-stone-500 dark:text-stone-400">
          {te
            ? (NEW_MENU_LAUNCH_ENABLED ? 'ఆర్డర్‌కు ముందు ధర, డెలివరీ ప్రాంతం, స్టాక్ సర్వర్‌లో మళ్లీ ధృవీకరించబడతాయి.' : 'ఇక్కడి ధరలు ప్రివ్యూ మాత్రమే. కొత్త మెనూ ఆర్డర్లు ఇంకా ప్రారంభం కాలేదు.')
            : (NEW_MENU_LAUNCH_ENABLED ? 'Price, delivery area and stock are rechecked on the server before payment.' : 'These are preview prices. New-menu ordering is not open yet.')}
        </p>
      </div>
      {detailItem && (
        <FoodDetailDialog item={detailItem} te={te} deliveryDate={deliveryDate}
          status={availabilityForItem(detailItem, NEW_MENU_LAUNCH_ENABLED, availability, availabilityError, new Date())}
          quantity={quantities[detailItem.id] ?? 0}
          maxQuantity={NEW_MENU_LAUNCH_ENABLED ? (availability?.stock[detailItem.id] ?? 0) : (detailItem.dailyPlateLimit ?? 500)}
          canIncrease={!NEW_MENU_LAUNCH_ENABLED || ['available','preorder'].includes(availabilityForItem(detailItem, true, availability, availabilityError, new Date()))}
          previewOnly={!NEW_MENU_LAUNCH_ENABLED}
          onAdjust={adjustment => adjustQuantity(detailItem, adjustment)}
          onClose={closeDetail}
        />
      )}
    </section>
  );
}
