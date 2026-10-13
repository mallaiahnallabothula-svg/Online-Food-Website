import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, LocateFixed, Lock, MapPin, RefreshCw, ShieldCheck, ShoppingBag, UserRound } from 'lucide-react';
import { type MealPeriod, type MenuItem } from '../../shared/menuCatalog.ts';
import { OrderTrackingModal } from './OrderTrackingModal';
import { persistCustomerOrder } from '../utils/checkout';
import type { ReorderRequest } from '../utils/reorder';

type Line = { item: MenuItem; quantity: number };
type Quote = {
  quote: {
    expectedPappu?: string;
    items: Array<{ itemId: string; itemName: string; quantity: number; lineTotalPaisa: number }>;
    deliveryDateIst: string; deliveryWindow: string; subtotalPaisa: number;
    deliveryChargePaisa: number; totalAmountPaisa: number; distanceKm: number;
  };
};
type GatewayResult = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RazorpayGateway = { open(): void; on(event: string, callback: (result: any) => void): void };
declare global { interface Window { Razorpay?: new (options: Record<string, any>) => RazorpayGateway } }
let razorpayScript: Promise<void> | undefined;

async function loadRazorpay() {
  if (window.Razorpay) return;
  razorpayScript ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => window.Razorpay ? resolve() : reject(new Error('Payment service did not load.'));
    script.onerror = () => { script.remove(); reject(new Error('Payment service could not load.')); };
    document.head.appendChild(script);
  }).catch(error => { razorpayScript = undefined; throw error; });
  return razorpayScript;
}

const money = (paisa: number) => '₹' + (paisa / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export function LiveNewMenuCheckout({ period, lines, te, onReorder }: { period: MealPeriod; lines: readonly Line[]; te: boolean; onReorder?: (request: ReorderRequest) => void }) {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [quote, setQuote] = useState<Quote['quote'] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [trackingToken, setTrackingToken] = useState('');
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [completed, setCompleted] = useState(false);
  const requestKey = useRef('');
  const lastInputKey = useRef('');
  const paymentProof = useRef<GatewayResult | null>(null);
  const inputKey = JSON.stringify({ period, name, mobile, address, landmark, coordinates, lines: lines.map(x => [x.item.id, x.quantity]) });

  function rotateRequestKey() {
    requestKey.current = crypto.randomUUID();
    try { sessionStorage.setItem('mana_new_menu_request_key', requestKey.current); } catch { /* Key remains for this page session. */ }
  }
  useEffect(() => {
    if (lastInputKey.current && lastInputKey.current !== inputKey) {
      setQuote(null);
      setError('');
      rotateRequestKey();
    }
    lastInputKey.current = inputKey;
  }, [inputKey]);
  useEffect(() => {
    try { requestKey.current = sessionStorage.getItem('mana_new_menu_request_key') || ''; } catch { /* Use a fresh key below. */ }
    if (!requestKey.current) rotateRequestKey();
    try {
      const pending = JSON.parse(sessionStorage.getItem('mana_new_menu_pending_order') || 'null');
      if (typeof pending?.orderId === 'string' && typeof pending?.token === 'string') {
        setTrackingToken(pending.token);
        const proof = JSON.parse(sessionStorage.getItem('mana_new_menu_payment_proof') || 'null') as GatewayResult | null;
        if (proof && typeof proof.razorpay_payment_id === 'string' &&
            typeof proof.razorpay_order_id === 'string' && typeof proof.razorpay_signature === 'string') {
          setBusy(true);
          void confirmPayment(proof, pending.orderId, pending.token).catch(() => {
            setError(te ? 'పేమెంట్ ధృవీకరణ కొనసాగుతోంది. మళ్లీ చెల్లించవద్దు; ఆర్డర్ ట్రాక్ చేయండి.' : 'Payment verification is still pending. Do not pay again; track this order.');
            setBusy(false);
          });
        }
      }
    } catch { /* Tracking remains available through the explicit confirmation flow. */ }
  }, []);

  function change(setter: (value: string) => void, value: string) {
    setter(value); setQuote(null); setError(''); setStatus('');
  }
  function getLocation() {
    if (!navigator.geolocation) { setError(te ? 'ఈ పరికరంలో లొకేషన్ అందుబాటులో లేదు.' : 'Location is unavailable on this device.'); return; }
    setLocationBusy(true); setError('');
    navigator.geolocation.getCurrentPosition(
      position => { setCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude }); setQuote(null); setLocationBusy(false); },
      () => { setError(te ? 'లొకేషన్ అనుమతి ఇవ్వండి లేదా మళ్లీ ప్రయత్నించండి.' : 'Allow location access and try again.'); setLocationBusy(false); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  function requestBody() {
    if (!coordinates) throw new Error(te ? 'ముందుగా మీ డెలివరీ లొకేషన్ ఎంచుకోండి.' : 'Choose your delivery location first.');
    if (lines.length === 0) throw new Error(te ? 'కార్ట్‌లో ఐటమ్స్ జోడించండి.' : 'Add items to your cart.');
    return {
      lines: lines.map(({ item, quantity }) => ({ itemId: item.id, quantity })),
      customer: {
        name: name.trim(), mobile, address: address.trim(), landmark: landmark.trim(),
        ...coordinates,
        locationLink: `https://maps.google.com/?q=${coordinates.latitude},${coordinates.longitude}`,
      },
    };
  }

  async function post(path: string, body: unknown) {
    const response = await fetch('/api/new-menu' + path, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-Menu-Checkout': '1' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error?.message || (te ? 'సేవ తాత్కాలికంగా అందుబాటులో లేదు.' : 'Checkout is temporarily unavailable.'));
    return data;
  }

  async function checkQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setStatus('');
    try {
      const cart = requestBody();
      const result = await post('/quote', cart) as Quote;
      setQuote(result.quote);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to check delivery.'); }
    finally { setBusy(false); }
  }

  async function confirmPayment(proof: GatewayResult, orderId: string, token: string) {
    paymentProof.current = proof;
    const result = await post('/confirm', {
      orderId, customerAccessToken: token,
      providerPaymentId: proof.razorpay_payment_id,
      providerSignature: proof.razorpay_signature,
    });
    if (result?.settlement?.status === 'CONFIRMED') {
      paymentProof.current = null;
      setCompleted(true);
      try {
        sessionStorage.removeItem('mana_new_menu_request_key');
        sessionStorage.removeItem('mana_new_menu_pending_order');
        sessionStorage.removeItem('mana_new_menu_payment_proof');
      } catch { /* Ignore storage failures. */ }
      rotateRequestKey();
      setStatus(te ? 'చెల్లింపు ధృవీకరించబడింది. మీ ఆర్డర్ ఖరారైంది.' : 'Payment verified. Your order is confirmed.');
      setError(''); setBusy(false);
    } else {
      setStatus(te ? 'చెల్లింపు సమీక్షలో ఉంది. మళ్లీ చెల్లించవద్దు; ఆర్డర్ ట్రాక్ చేయండి.' : 'Payment needs review. Do not pay again; track your order.');
      setBusy(false);
    }
  }

  async function pay() {
    if (busy) return;
    setBusy(true); setError(''); setStatus('');
    try {
      if (paymentProof.current && trackingToken) {
        const order = JSON.parse(sessionStorage.getItem('mana_new_menu_pending_order') || 'null');
        if (typeof order?.orderId === 'string' && order?.token === trackingToken) {
          await confirmPayment(paymentProof.current, order.orderId, trackingToken);
          return;
        }
      }
      const request = { ...requestBody(), expectedPappu: quote?.expectedPappu, requestedDeliveryDateIst: quote?.deliveryDateIst };
      const prepared = await post('/prepare', { request, requestKey: requestKey.current });
      const orderId = prepared.checkout.orderId as string;
      const token = prepared.checkout.customerAccessToken as string;
      setTrackingToken(token); persistCustomerOrder(orderId, token);
      try { sessionStorage.setItem('mana_new_menu_pending_order', JSON.stringify({ orderId, token })); } catch { /* Tracking remains available in memory. */ }
      const gateway = await post('/gateway', { orderId, customerAccessToken: token });
      await loadRazorpay();
      const checkout = new window.Razorpay!({
        key: gateway.gateway.publicKeyId,
        order_id: gateway.gateway.providerOrderId,
        amount: gateway.gateway.amountPaisa,
        currency: 'INR',
        name: 'Mana Enti Vanta',
        description: `Order ${orderId}`,
        prefill: { name: name.trim(), contact: mobile },
        theme: { color: '#78350F' },
        modal: { ondismiss: () => setBusy(false) },
        handler: async (proof: GatewayResult) => {
          if (proof.razorpay_order_id !== gateway.gateway.providerOrderId) {
            setError(te ? 'పేమెంట్ ఆర్డర్ సరిపోలలేదు.' : 'Payment order did not match.'); setBusy(false); return;
          }
          paymentProof.current = proof;
          try { sessionStorage.setItem('mana_new_menu_payment_proof', JSON.stringify(proof)); } catch { /* Keep proof in memory. */ }
          try { await confirmPayment(proof, orderId, token); }
          catch { setError(te ? 'పేమెంట్ వచ్చిందో లేదో సర్వర్ ధృవీకరిస్తోంది. మళ్లీ చెల్లించవద్దు.' : 'Payment verification is pending. Do not pay again; track this order.'); setBusy(false); }
        },
      });
      checkout.on('payment.failed', (result: any) => {
        setError(result?.error?.description || (te ? 'పేమెంట్ విఫలమైంది. ఆర్డర్ ట్రాక్ చేసి స్థితి చూడండి.' : 'Payment failed. Check order status before retrying.'));
        setBusy(false);
      });
      checkout.open();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to start payment.';
      if (message.includes('fresh quote') || message.includes('next eligible')) {
        setQuote(null); rotateRequestKey();
      }
      setError(message); setBusy(false);
    }
  }

  const selected = lines.reduce((sum, line) => sum + line.item.pricePaisa * line.quantity, 0);

  return (
    <div
      className="mt-7 overflow-hidden rounded-[28px] border border-emerald-900/15 bg-white text-stone-900 shadow-[0_14px_42px_-30px_rgba(25,61,42,0.55)] dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
      data-testid="live-new-menu-checkout"
    >
      <div className="border-b border-emerald-900/10 bg-gradient-to-r from-[#EDF4EC] via-[#F6F2E7] to-[#FAF7F0] px-4 py-5 dark:border-stone-700 dark:from-emerald-950/60 dark:via-stone-800 dark:to-stone-800 sm:px-7 sm:py-6">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-800/15 bg-white/75 px-3 py-1 text-[11px] font-bold tracking-wide text-[#26543A] dark:border-emerald-400/30 dark:bg-stone-900/60 dark:text-emerald-200">
          <ShieldCheck size={13} aria-hidden="true" />
          {te ? 'సురక్షితమైన చెకౌట్' : 'Secure checkout'}
        </span>
        <h3 className="mt-3 text-xl font-extrabold tracking-tight text-[#213E30] dark:text-emerald-100 sm:text-2xl">
          {te ? 'ఆర్డర్ & డెలివరీ వివరాలు' : 'Order and delivery details'}
        </h3>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-stone-600 dark:text-stone-300">
          {te ? 'మీ వివరాలు నమోదు చేసి, డెలివరీ తేదీ మరియు మొత్తం సరిచూసి చెల్లించండి.' : 'Add your details, then review your delivery date and total before paying.'}
        </p>
      </div>

      <form noValidate autoComplete="on" onSubmit={checkQuote} className="space-y-6 px-4 py-5 sm:px-7 sm:py-7">
        <div className="rounded-2xl border border-[#DEE9DB] bg-[#F7FAF5] p-4 dark:border-stone-600 dark:bg-stone-900/70 sm:p-5" aria-label={te ? 'ఆర్డర్ సారాంశం' : 'Order summary'}>
          <div className="flex items-center gap-2 text-sm font-bold text-[#26543A] dark:text-emerald-200">
            <ShoppingBag size={17} aria-hidden="true" />
            <span>{te ? 'మీ ఆర్డర్' : 'Your order'}</span>
          </div>
          {lines.length > 0 ? (
            <ul className="mt-3 space-y-2 border-b border-emerald-900/10 pb-3 text-sm dark:border-stone-700">
              {lines.map(({ item, quantity }) => (
                <li key={item.id} className="flex items-start justify-between gap-4 text-stone-700 dark:text-stone-200">
                  <span className="min-w-0">{te ? item.nameTe : item.nameEn} × {quantity}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{money(item.pricePaisa * quantity)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-stone-500 dark:text-stone-300">
              {te ? 'పైన మీకు నచ్చిన వంటకాలను కార్ట్‌లో జోడించండి.' : 'Add food from the menu above to see your total.'}
            </p>
          )}
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-emerald-900/10 pt-3 dark:border-stone-700">
            <span className="text-sm font-bold text-stone-700 dark:text-stone-200">{te ? 'ఆహార మొత్తం' : 'Food subtotal'}</span>
            <strong className="text-2xl font-extrabold tabular-nums text-[#26543A] dark:text-emerald-200">{money(selected)}</strong>
          </div>
          <p className="mt-1 text-right text-[11px] text-stone-500 dark:text-stone-400">
            {te ? 'డెలివరీ ఛార్జీ తర్వాత చూపబడుతుంది' : 'Delivery charge calculated after location check'}
          </p>
        </div>

        <section aria-labelledby="checkout-customer-heading">
          <h4 id="checkout-customer-heading" className="flex items-center gap-2 text-sm font-extrabold text-[#254733] dark:text-emerald-200">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200"><UserRound size={17} aria-hidden="true" /></span>
            {te ? 'కస్టమర్ వివరాలు' : 'Customer details'}
          </h4>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-200">
              {te ? 'పేరు' : 'Name'}
              <input required autoComplete="name" maxLength={100} value={name} onChange={e => change(setName, e.target.value)} placeholder={te ? 'మీ పూర్తి పేరు' : 'Your full name'} className="mt-1.5 block min-h-12 w-full min-w-0 rounded-xl border border-stone-300 bg-white px-4 py-3 text-base font-normal text-stone-900 placeholder:text-stone-400 focus-visible:border-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-700 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100" />
            </label>
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-200">
              {te ? 'మొబైల్' : 'Mobile'}
              <input required autoComplete="tel-national" type="tel" inputMode="numeric" maxLength={10} value={mobile} onChange={e => change(setMobile, e.target.value)} placeholder={te ? '10 అంకెల మొబైల్ నంబర్' : '10-digit mobile number'} className="mt-1.5 block min-h-12 w-full min-w-0 rounded-xl border border-stone-300 bg-white px-4 py-3 text-base font-normal text-stone-900 placeholder:text-stone-400 focus-visible:border-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-700 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100" />
            </label>
          </div>
        </section>

        <section aria-labelledby="checkout-delivery-heading">
          <h4 id="checkout-delivery-heading" className="flex items-center gap-2 text-sm font-extrabold text-[#254733] dark:text-emerald-200">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200"><MapPin size={17} aria-hidden="true" /></span>
            {te ? 'డెలివరీ చిరునామా' : 'Delivery address'}
          </h4>
          <div className="mt-3 space-y-4">
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-200">
              {te ? 'పూర్తి చిరునామా' : 'Full address'}
              <textarea required autoComplete="street-address" rows={3} maxLength={500} value={address} onChange={e => change(setAddress, e.target.value)} placeholder={te ? 'ఫ్లాట్ నంబర్, బిల్డింగ్, ఏరియా' : 'Flat number, building and area'} className="mt-1.5 block min-h-24 w-full min-w-0 resize-y rounded-xl border border-stone-300 bg-white px-4 py-3 text-base font-normal text-stone-900 placeholder:text-stone-400 focus-visible:border-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-700 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100" />
            </label>
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-200">
              {te ? 'ల్యాండ్‌మార్క్ (ఐచ్ఛికం)' : 'Landmark (optional)'}
              <input maxLength={200} value={landmark} onChange={e => change(setLandmark, e.target.value)} placeholder={te ? 'దగ్గరలో గుర్తించగల స్థలం' : 'Nearby landmark'} className="mt-1.5 block min-h-12 w-full min-w-0 rounded-xl border border-stone-300 bg-white px-4 py-3 text-base font-normal text-stone-900 placeholder:text-stone-400 focus-visible:border-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-700 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100" />
            </label>
            <div className="rounded-2xl border border-dashed border-emerald-800/30 bg-emerald-50/40 p-3 dark:border-emerald-400/30 dark:bg-emerald-950/20">
              <button type="button" onClick={getLocation} disabled={locationBusy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-white px-4 py-3 text-sm font-bold text-[#26543A] transition-colors hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-wait disabled:opacity-60 dark:border-emerald-400/60 dark:bg-stone-800 dark:text-emerald-200 dark:hover:bg-stone-700">
                {locationBusy ? <RefreshCw size={18} className="animate-spin" aria-hidden="true" /> : <LocateFixed size={18} aria-hidden="true" />}
                {locationBusy ? (te ? 'లొకేషన్ తీసుకుంటోంది…' : 'Getting location…') : coordinates ? (te ? 'లొకేషన్ తీసుకుంది ✓' : 'Location captured ✓') : (te ? 'డెలివరీ లొకేషన్ ఎంచుకోండి' : 'Use delivery location')}
              </button>
              <p className="mt-2 text-center text-xs leading-relaxed text-stone-600 dark:text-stone-300">
                {coordinates
                  ? (te ? 'లొకేషన్ సిద్ధం. పైన ఉన్న చిరునామా సరిచూసి కొనసాగించండి.' : 'Location ready. Check your address above before continuing.')
                  : (te ? 'డెలివరీ ప్రాంతం, ఛార్జీ నిర్ధారించడానికి లొకేషన్ అవసరం.' : 'Location is needed to check your delivery area and charge.')}
              </p>
            </div>
          </div>
        </section>

        {quote && (
          <div className="rounded-2xl border border-emerald-300/60 bg-emerald-50/60 p-4 text-sm dark:border-emerald-800 dark:bg-emerald-950/30 sm:p-5">
            <h4 className="font-extrabold text-[#254733] dark:text-emerald-200">{te ? 'చెల్లింపు ముందు సారాంశం' : 'Review before payment'}</h4>
            <ul className="mt-3 space-y-1.5 text-stone-700 dark:text-stone-200">
              {quote.items.map(item => <li key={item.itemId}>{item.itemName} × {item.quantity}</li>)}
            </ul>
            <p className="mt-3 flex items-center justify-between gap-3 text-stone-700 dark:text-stone-200">
              <span>{te ? 'డెలివరీ' : 'Delivery'} ({quote.distanceKm} km)</span><strong className="tabular-nums">{money(quote.deliveryChargePaisa)}</strong>
            </p>
            <p className="mt-3 flex items-center justify-between gap-3 border-t border-emerald-800/15 pt-3 text-base dark:border-emerald-400/20">
              <span className="font-bold">{te ? 'చెల్లించాల్సిన మొత్తం' : 'Total to pay'}</span>
              <strong className="text-xl font-extrabold tabular-nums text-[#26543A] dark:text-emerald-200">{money(quote.totalAmountPaisa)}</strong>
            </p>
            <p className="mt-2 text-xs text-stone-600 dark:text-stone-300">{quote.deliveryDateIst} · {quote.deliveryWindow} IST</p>
          </div>
        )}

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
        {status && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100">{status}</p>}

        <div className="space-y-3 border-t border-stone-200 pt-5 dark:border-stone-700">
          {!quote ? (
            <button type="submit" disabled={busy || lines.length === 0} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#26543A] px-4 py-3.5 text-base font-extrabold text-white shadow-sm transition-colors hover:bg-[#1A402B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:bg-[#92A99B] disabled:text-white disabled:shadow-none">
              {busy ? <RefreshCw size={20} className="animate-spin" aria-hidden="true" /> : <ArrowRight size={19} aria-hidden="true" />}
              {busy ? (te ? 'దయచేసి వేచి ఉండండి…' : 'Checking…') : te ? 'డెలివరీ & మొత్తం చెక్ చేయండి' : 'Check delivery and total'}
            </button>
          ) : (
            <button type="button" onClick={pay} disabled={busy || completed} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#78350F] px-4 py-3.5 text-base font-extrabold text-white shadow-sm transition-colors hover:bg-[#602A0C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? <RefreshCw size={19} className="animate-spin" aria-hidden="true" /> : <Lock size={19} aria-hidden="true" />}
              {completed ? (te ? 'ఆర్డర్ ఖరారైంది' : 'Order confirmed') : busy ? (te ? 'దయచేసి వేచి ఉండండి…' : 'Please wait…') : te ? 'Razorpay ద్వారా చెల్లించండి' : 'Pay ' + money(quote.totalAmountPaisa) + ' with Razorpay'}
            </button>
          )}
          {lines.length === 0 && <p className="text-center text-xs text-stone-500 dark:text-stone-300">{te ? 'కొనసాగించడానికి పైన కార్ట్‌లో ఐటమ్స్ జోడించండి.' : 'Add items to the cart above to continue.'}</p>}
          {trackingToken && (
            <button type="button" onClick={() => setTrackingOpen(true)} className="min-h-11 w-full rounded-xl border border-emerald-700/40 bg-white px-4 py-2.5 text-sm font-bold text-[#26543A] transition-colors hover:bg-emerald-50 dark:border-emerald-400/40 dark:bg-stone-900 dark:text-emerald-200">
              {te ? 'నా ఆర్డర్ ట్రాక్ చేయండి' : 'Track this order'}
            </button>
          )}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-1 text-center text-xs text-stone-500 dark:text-stone-300">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} aria-hidden="true" />{te ? 'ధర, స్టాక్ మళ్లీ చెక్ చేస్తాం' : 'Price and stock rechecked'}</span>
            <span className="inline-flex items-center gap-1.5"><Lock size={13} aria-hidden="true" />{te ? 'Razorpay పేమెంట్' : 'Razorpay payment'}</span>
          </div>
          <p className="text-center text-xs leading-relaxed text-stone-500 dark:text-stone-300">
            {te ? 'చెల్లింపుకు ముందు మొత్తం, డెలివరీ తేదీ, చిరునామా సరిచూడండి.' : 'Review total, delivery time and address before payment.'}
          </p>
        </div>
      </form>
      <OrderTrackingModal isOpen={trackingOpen} onClose={() => setTrackingOpen(false)} initialOrderId={trackingToken} onReorder={onReorder} />
    </div>
  );
}
