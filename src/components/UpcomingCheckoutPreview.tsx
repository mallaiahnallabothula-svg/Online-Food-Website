import { InactiveMenuCheckout } from './InactiveMenuCheckout';
import type { TestPayment } from '../utils/inactiveMenuCheckout';
import { useState, type FormEvent } from 'react';
import { Clock3, ShieldCheck, ShoppingBag } from 'lucide-react';
import { NEW_MENU_ORDER_POLICY, type MealPeriod, type MenuItem } from '../../shared/menuCatalog.ts';
import { getNextPreorderDeliverySlot } from '../../shared/preorderScheduling.ts';
import { NEW_MENU_LAUNCH_ENABLED } from '../../shared/menuCatalog.ts';
import { LiveNewMenuCheckout } from './LiveNewMenuCheckout';
import type { ReorderRequest } from '../utils/reorder';

export interface PreviewCartLine {
  readonly item: MenuItem;
  readonly quantity: number;
}

interface PreviewDetails {
  name: string;
  mobile: string;
  address: string;
  landmark: string;
}

/**
 * Local formatting checks only. Real checkout must independently validate
 * coordinates, delivery eligibility, available stock and saved gateway pricing.
 */
export function validateUpcomingPreview(
  subtotalPaisa: number,
  details: PreviewDetails,
): string[] {
  const errors: string[] = [];
  if (!Number.isSafeInteger(subtotalPaisa) ||
      subtotalPaisa < NEW_MENU_ORDER_POLICY.minimumCartPaisa) {
    errors.push('Food cart must be at least ₹100.');
  }
  if (details.name.trim().length < 2 || details.name.trim().length > 100) {
    errors.push('Enter a name between 2 and 100 characters.');
  }
  if (!/^[6-9]\d{9}$/.test(details.mobile)) {
    errors.push('Enter a valid 10-digit Indian mobile number.');
  }
  if (details.address.trim().length < 5 || details.address.trim().length > 500) {
    errors.push('Enter a delivery address of at least 5 characters.');
  }
  if (details.landmark.length > 200) {
    errors.push('Landmark must be under 200 characters.');
  }
  return errors;
}

const money = (paisa: number) =>
  '₹' + (paisa / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

/** Public UI stays local-only. Explicit test injection exercises inactive checkout. */
function PreviewCheckoutOnly({
  period, lines, subtotalPaisa, te, isolatedCheckout,
}: {
  isolatedCheckout?: { latitude: number; longitude: number; pay: TestPayment };
  period: MealPeriod;
  lines: readonly PreviewCartLine[];
  subtotalPaisa: number;
  te: boolean;
}) {
  const [details, setDetails] = useState<PreviewDetails>({
    name: '', mobile: '', address: '', landmark: '',
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const minimum = NEW_MENU_ORDER_POLICY.minimumCartPaisa;
  const missingPaisa = Math.max(0, minimum - subtotalPaisa);
  const slot = getNextPreorderDeliverySlot(period, new Date());

  function change(field: keyof PreviewDetails, value: string) {
    setDetails(old => ({ ...old, [field]: value }));
    setErrors([]);
    setChecked(false);
  }

  function checkPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const issues = validateUpcomingPreview(subtotalPaisa, details);
    setErrors(issues);
    setChecked(issues.length === 0);
    // Deliberately no API, localStorage, order creation or Razorpay.
  }

  return (
    <div
      data-testid="upcoming-checkout-preview"
      className="solara-checkout mt-5 min-w-0 overflow-hidden rounded-xl border border-[#ded7ce] sm:mt-6 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-800"
    >
      <div className="border-b border-stone-200 bg-[#FAF6ED] px-4 py-5 dark:border-stone-700 dark:bg-emerald-950/40 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <ShoppingBag size={19} aria-hidden="true" className="text-[#A44732] dark:text-emerald-300" />
          <h3 className="text-lg font-extrabold text-[#384B35] dark:text-emerald-100">
            {te ? 'శాంపిల్ కార్ట్ & చెకౌట్' : 'Sample cart & checkout preview'}
          </h3>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
            {te ? 'ఆర్డర్లు నిలిపివేయబడ్డాయి' : 'Ordering disabled'}
          </span>
        </div>
        <p className="mt-1 text-xs text-stone-600 dark:text-stone-300">
          {te
            ? 'ఇది డెమో మాత్రమే. వివరాలు సర్వర్‌కు పంపబడవు లేదా సేవ్ చేయబడవు; ఆర్డర్ / పేమెంట్ జరగదు.'
            : 'Demo only. Details stay in this page; nothing is sent or saved. No order or payment can be placed.'}
        </p>
      </div>

      <div className="grid min-w-0 gap-5 px-4 py-4 sm:gap-6 sm:px-6 sm:py-5">
        <div>
          <h4 className="text-sm font-bold text-stone-800 dark:text-stone-100">
            {te ? 'మీ ఎంపికలు' : 'Your sample selections'}
          </h4>
          {lines.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500 dark:text-stone-300" data-testid="upcoming-empty-cart">
              {te ? 'పైన మీకు నచ్చిన పదార్థాలను కార్ట్‌లో చేర్చండి.' : 'Add items above to see a sample total.'}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {lines.map(({ item, quantity }) => (
                <li key={item.id} className="flex items-center justify-between gap-3 text-sm text-stone-700 dark:text-stone-200">
                  <span>{te ? item.nameTe : item.nameEn} × {quantity}</span>
                  <span className="shrink-0 font-bold">{money(item.pricePaisa * quantity)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex items-center justify-between border-t border-stone-200 pt-3 dark:border-stone-700">
            <span className="font-bold text-stone-900 dark:text-stone-100">{te ? 'ఆహార ధర మొత్తం' : 'Food subtotal'}</span>
            <strong className="text-xl text-[#A44732] dark:text-emerald-300" data-testid="upcoming-cart-subtotal">{money(subtotalPaisa)}</strong>
          </div>
          <p role="status" className="mt-2 text-xs font-semibold text-stone-600 dark:text-stone-300" data-testid="upcoming-minimum-message">
            {missingPaisa > 0
              ? (te ? 'కనీసం ₹100 కోసం ఇంకా ' : 'Add ') + money(missingPaisa) + (te ? ' చేర్చండి' : ' more for the ₹100 minimum')
              : (te ? '₹100 కనీస ఆహార ధర పూర్తైంది' : '₹100 food minimum met')}
          </p>
          <p className="mt-3 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
            {te
              ? 'ఇది ఆహార ధర మాత్రమే. డెలివరీ ఛార్జీలు, స్టాక్, లొకేషన్ లైవ్ చెకౌట్‌లోనే ధృవీకరించాలి.'
              : 'Food subtotal only. Delivery fee, location eligibility and stock are not checked in this preview.'}
          </p>
          <div className="mt-5 rounded-xl bg-[#FAF6ED] p-3 dark:bg-stone-700/70" data-testid="upcoming-slot-preview">
            <div className="flex items-center gap-2 text-sm font-bold text-stone-800 dark:text-stone-100">
              <Clock3 size={16} aria-hidden="true" />
              {te ? 'తదుపరి అర్హత గల డెలివరీ విండో (IST)' : 'Next eligible delivery window (IST)'}
            </div>
            <p className="mt-2 text-sm font-bold text-[#A44732] dark:text-emerald-300">
              {slot.deliveryDateIst} · {slot.windowStartIst}–{slot.windowEndIst} IST
            </p>
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-300">
              {te
                ? 'కనీసం 30 నిమిషాల ముందస్తు సమయం. ఇది అంచనా మాత్రమే, డెలివరీ హామీ కాదు.'
                : 'Minimum 30-minute lead time. Indicative only, not a confirmed delivery or available stock.'}
            </p>
          </div>
        </div>

        <form noValidate autoComplete="off" onSubmit={checkPreview} data-testid="upcoming-preview-form" className="space-y-3">
          <h4 className="text-sm font-bold text-stone-800 dark:text-stone-100">
            {te ? 'డెలివరీ వివరాలు — ప్రివ్యూ మాత్రమే' : 'Delivery details — preview only'}
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <label htmlFor="upcoming-customer-name" className="block text-xs font-semibold text-stone-700 dark:text-stone-200">
              {te ? 'పేరు' : 'Name'}
              <input
                id="upcoming-customer-name" type="text" maxLength={100}
                value={details.name} onChange={e => change('name', e.target.value)}
                className="mt-1 block w-full min-w-0 rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
              />
            </label>
            <label htmlFor="upcoming-customer-mobile" className="block text-xs font-semibold text-stone-700 dark:text-stone-200">
              {te ? 'మొబైల్' : 'Mobile'}
              <input
                id="upcoming-customer-mobile" type="tel" inputMode="numeric" maxLength={10}
                value={details.mobile} onChange={e => change('mobile', e.target.value)}
                className="mt-1 block w-full min-w-0 rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
              />
            </label>
          </div>
          <label htmlFor="upcoming-customer-address" className="block text-xs font-semibold text-stone-700 dark:text-stone-200">
            {te ? 'డెలివరీ అడ్రస్' : 'Delivery address'}
            <textarea
              id="upcoming-customer-address" rows={2} maxLength={500}
              value={details.address} onChange={e => change('address', e.target.value)}
              className="mt-1 block w-full min-w-0 rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
            />
          </label>
          <label htmlFor="upcoming-customer-landmark" className="block text-xs font-semibold text-stone-700 dark:text-stone-200">
            {te ? 'ల్యాండ్‌మార్క్ (ఐచ్ఛికం)' : 'Landmark (optional)'}
            <input
              id="upcoming-customer-landmark" type="text" maxLength={200}
              value={details.landmark} onChange={e => change('landmark', e.target.value)}
              className="mt-1 block w-full min-w-0 rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
            />
          </label>
          <button
            type="submit"
            className="min-h-11 w-full rounded-xl border border-[#A44732] bg-white px-4 py-2.5 text-sm font-bold text-[#A44732] hover:bg-[#FAF6ED] dark:border-emerald-400 dark:bg-stone-800 dark:text-emerald-200"
          >
            {te ? 'ప్రివ్యూ వివరాలు చెక్ చేయండి' : 'Check preview details'}
          </button>
          {errors.length > 0 && (
            <div role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-900 dark:bg-red-950/40 dark:text-red-200">
              <ul className="list-inside list-disc space-y-1">
                {errors.map(error => <li key={error}>{error}</li>)}
              </ul>
            </div>
          )}
          {checked && (
            <p role="status" data-testid="upcoming-format-valid" className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100">
              {te
                ? 'ప్రాథమిక వివరాల ఫార్మాట్ సరైనది. ఆర్డర్ సృష్టించబడలేదు; లొకేషన్ / స్టాక్ / పేమెంట్ ధృవీకరించబడలేదు.'
                : 'Basic field formats pass. No order was created; delivery eligibility, stock and payment were not verified.'}
            </p>
          )}
          {import.meta.env.MODE === 'test' && isolatedCheckout && checked && validateUpcomingPreview(subtotalPaisa, details).length === 0 ? (
            <InactiveMenuCheckout request={{ lines: lines.map(({ item, quantity }) => ({ itemId: item.id, quantity })),
              customer: { ...details, latitude: isolatedCheckout.latitude, longitude: isolatedCheckout.longitude } }} pay={isolatedCheckout.pay} />
          ) : null}
          <button
            type="button"
            disabled
            aria-label="New menu checkout unavailable"
            className="flex min-h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-stone-300 px-4 py-3 font-bold text-stone-600 dark:bg-stone-600 dark:text-stone-200"
          >
            <ShieldCheck size={17} aria-hidden="true" />
            {te ? 'పేమెంట్ త్వరలో' : 'Payment coming soon'}
          </button>
          <p className="text-center text-xs text-stone-500 dark:text-stone-300">
            {te ? 'కొత్త మెనూ ఆర్డర్లు ఇంకా ప్రారంభం కాలేదు.' : 'New-menu ordering is not open yet.'}
          </p>
        </form>
      </div>
    </div>
  );
}

export function UpcomingCheckoutPreview(props: {
  isolatedCheckout?: { latitude: number; longitude: number; pay: TestPayment };
  onReorder?: (request: ReorderRequest) => void;
  period: MealPeriod;
  lines: readonly PreviewCartLine[];
  subtotalPaisa: number;
  te: boolean;
}) {
  if (NEW_MENU_LAUNCH_ENABLED) {
    return <LiveNewMenuCheckout period={props.period} lines={props.lines} te={props.te} onReorder={props.onReorder} />;
  }
  return <PreviewCheckoutOnly {...props} />;
}
