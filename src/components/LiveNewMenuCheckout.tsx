import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, LocateFixed, Lock, MapPin, RefreshCw, ShieldCheck, ShoppingBag, UserRound } from 'lucide-react';
import { type MealPeriod, type MenuItem } from '../../shared/menuCatalog.ts';
import { OrderTrackingModal } from './OrderTrackingModal';
import { persistCustomerOrder } from '../utils/checkout';
import type { ReorderRequest } from '../utils/reorder';
import { parsePreparedPreorderSlot, type ConfirmedPreorderSlot } from '../utils/preorderNotices';
import { parseGoogleMapsCoordinates, googleMapsPinUrl, isGoogleMapsShortLink } from '../utils/location';

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
  const [locationSource, setLocationSource] = useState<'GPS' | 'MAPS' | null>(null);
  const [mapLinkDraft, setMapLinkDraft] = useState('');
  const [confirmedLocationKey, setConfirmedLocationKey] = useState<string | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const locationRequestId = useRef(0);
  const quoteRequestId = useRef(0);
  const [quote, setQuote] = useState<Quote['quote'] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [trackingToken, setTrackingToken] = useState('');
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [confirmedSlot, setConfirmedSlot] = useState<ConfirmedPreorderSlot | null>(null);
  const preparedSlotRef = useRef<ConfirmedPreorderSlot | null>(null);
  const requestKey = useRef('');
  const lastInputKey = useRef('');
  const paymentProof = useRef<GatewayResult | null>(null);
  const inputKey = JSON.stringify({ period, name, mobile, address, landmark, coordinates, lines: lines.map(x => [x.item.id, x.quantity]) });
  const selectedLocationKey = coordinates ? JSON.stringify({ coordinates, address: address.trim(), landmark: landmark.trim() }) : '';
  const locationConfirmed = selectedLocationKey !== '' && selectedLocationKey === confirmedLocationKey;

  function rotateRequestKey() {
    requestKey.current = crypto.randomUUID();
    try { sessionStorage.setItem('mana_new_menu_request_key', requestKey.current); } catch { /* Key remains for this page session. */ }
  }
  useEffect(() => {
    if (lastInputKey.current && lastInputKey.current !== inputKey) {
      setQuote(null);
      setError('');
      quoteRequestId.current += 1;
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
        preparedSlotRef.current = parsePreparedPreorderSlot(pending, pending.orderId);
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
    quoteRequestId.current += 1;
  }
  function clearSelectedLocation() {
    setCoordinates(null); setLocationSource(null); setConfirmedLocationKey(null); setQuote(null);
    quoteRequestId.current += 1;
  }
  function getLocation() {
    const requestId = ++locationRequestId.current;
    clearSelectedLocation();
    setMapLinkDraft('');
    if (!navigator.geolocation) {
      setError(te ? 'ఈ పరికరంలో లొకేషన్ అందుబాటులో లేదు. Google Maps pin వాడండి.' : 'GPS is unavailable. Use a Google Maps pin.');
      return;
    }
    setLocationBusy(true); setError('');
    navigator.geolocation.getCurrentPosition(
      position => {
        if (locationRequestId.current !== requestId) return;
        setCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationSource('GPS'); setLocationBusy(false);
      },
      () => {
        if (locationRequestId.current !== requestId) return;
        setError(te ? 'GPS అనుమతి రాలేదు. Google Maps link ద్వారా ఇంటి location ఇవ్వండి.' : 'GPS unavailable or denied. Paste a Google Maps link for your delivery address.');
        setLocationBusy(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }
  function editMapLink(value: string) {
    locationRequestId.current += 1;
    setLocationBusy(false);
    setMapLinkDraft(value);
    clearSelectedLocation();
    setError('');
  }
  async function useMapPin() {
    const submitted = mapLinkDraft.trim();
    const requestId = ++locationRequestId.current;
    clearSelectedLocation();
    setError('');
    let parsed = parseGoogleMapsCoordinates(submitted);
    if (!parsed && isGoogleMapsShortLink(submitted)) {
      setLocationBusy(true);
      try {
        const response = await fetch('/api/location/resolve', {
          method: 'POST', cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: submitted }),
        });
        const data = await response.json().catch(() => null);
        if (requestId !== locationRequestId.current) return;
        if (!response.ok) throw new Error(data?.error?.message || 'Could not read the Google Maps pin.');
        if (typeof data?.latitude !== 'number' || typeof data?.longitude !== 'number') {
          throw new Error('Google Maps did not return coordinates for this pin.');
        }
        // Reuse the existing coordinate validation before accepting a remote result.
        parsed = parseGoogleMapsCoordinates(googleMapsPinUrl(data.latitude, data.longitude));
      } catch {
        if (requestId === locationRequestId.current) setError(te
          ? 'Short Maps link నుంచి ఖచ్చితమైన pin తీసుకోలేకపోయాం. Google Mapsలో పూర్తి coordinate link share చేయండి లేదా GPS వాడండి.'
          : 'Could not resolve the exact pin from this short Google Maps link. Share a full coordinates link or use GPS.');
        return;
      } finally {
        if (requestId === locationRequestId.current) setLocationBusy(false);
      }
    }
    if (requestId !== locationRequestId.current) return;
    if (!parsed) {
      setError(te
        ? 'Google Maps coordinate link లేదా maps.app.goo.gl short share link ఇవ్వండి.'
        : 'Enter a Google Maps coordinate link or a maps.app.goo.gl short share link.');
      return;
    }
    setCoordinates(parsed);
    setLocationSource('MAPS');
    setError('');
  }

  function requestBody() {
    if (!coordinates) throw new Error(te ? 'ముందుగా మీ డెలివరీ లొకేషన్ ఎంచుకోండి.' : 'Choose your delivery location first.');
    if (!locationConfirmed) throw new Error(te ? 'Payment ముందు delivery address, pin confirm చేయండి.' : 'Confirm your delivery address and map pin before checkout.');
    if (lines.length === 0) throw new Error(te ? 'కార్ట్‌లో ఐటమ్స్ జోడించండి.' : 'Add items to your cart.');
    return {
      lines: lines.map(({ item, quantity }) => ({ itemId: item.id, quantity })),
      customer: {
        name: name.trim(), mobile, address: address.trim(), landmark: landmark.trim(),
        ...coordinates,
        locationLink: googleMapsPinUrl(coordinates.latitude, coordinates.longitude),
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
      const requestId = quoteRequestId.current;
      const result = await post('/quote', cart) as Quote;
      if (quoteRequestId.current === requestId) setQuote(result.quote);
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
      setConfirmedSlot(preparedSlotRef.current?.orderId === orderId ? preparedSlotRef.current : null);
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
    if (!locationConfirmed) { setQuote(null); setError(te ? 'ముందు delivery address, pin confirm చేయండి.' : 'Confirm the delivery address and pin before paying.'); return; }
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
      const slot = parsePreparedPreorderSlot(prepared.checkout, orderId);
      preparedSlotRef.current = slot;
      setTrackingToken(token); persistCustomerOrder(orderId, token);
      try { sessionStorage.setItem('mana_new_menu_pending_order', JSON.stringify({ orderId, token, ...(slot ?? {}) })); } catch { /* Tracking remains available in memory. */ }
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
      className="solara-checkout compact-checkout mx-auto mt-5 max-w-3xl overflow-hidden rounded-2xl border border-[#ded7ce] bg-white text-stone-900 shadow-[0_14px_36px_-30px_rgba(65,45,33,0.4)] dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
      data-testid="live-new-menu-checkout"
    >
      <div className="border-b border-[#ded7ce] bg-[#f7f2e9] px-4 py-4 dark:border-stone-700 dark:bg-stone-800 sm:px-6 sm:py-5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-800/15 bg-white/75 px-3 py-1 text-[11px] font-bold tracking-wide text-[#ab4d3e] dark:border-emerald-400/30 dark:bg-stone-900/60 dark:text-emerald-200">
          <ShieldCheck size={13} aria-hidden="true" />
          {te ? 'సురక్షితమైన చెకౌట్' : 'Secure checkout'}
        </span>
        <h3 className="mt-2 text-xl font-bold tracking-tight text-[#26231f] dark:text-emerald-100 sm:text-2xl">
          {te ? 'ఆర్డర్ & డెలివరీ వివరాలు' : 'Order and delivery details'}
        </h3>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-stone-600 dark:text-stone-300">
          {te ? 'మీ వివరాలు నమోదు చేసి, డెలివరీ తేదీ మరియు మొత్తం సరిచూసి చెల్లించండి.' : 'Add your details, then review your delivery date and total before paying.'}
        </p>
        <div aria-label="Checkout progress" className="mt-3 grid grid-cols-3 gap-2 text-[11px] font-semibold">
          <span className="rounded-md bg-[#ab4d3e] px-2 py-2 text-center text-white">1 · {te ? 'వివరాలు' : 'Details'}</span>
          <span className={'rounded-md px-2 py-2 text-center ' + (quote ? 'bg-[#ab4d3e] text-white' : 'bg-[#ebe4da] text-[#81766d] dark:bg-stone-700 dark:text-stone-200')}>2 · {te ? 'సమీక్ష' : 'Review'}</span>
          <span className="rounded-md bg-[#ebe4da] px-2 py-2 text-center text-[#81766d] dark:bg-stone-700 dark:text-stone-200">3 · {te ? 'చెల్లింపు' : 'Payment'}</span>
        </div>
      </div>

      <form noValidate autoComplete="on" onSubmit={checkQuote} className="space-y-3 px-3 py-3 sm:px-5 sm:py-4">
        <div className="rounded-xl border border-[#e8dccf] bg-[#fcf8f1] p-3 dark:border-stone-600 dark:bg-stone-900/70" aria-label={te ? 'ఆర్డర్ సారాంశం' : 'Order summary'}>
          <div className="flex items-center gap-2 text-sm font-bold text-[#26231f] dark:text-stone-100">
            <ShoppingBag size={17} aria-hidden="true" />
            <span>{te ? 'మీ ఆర్డర్' : 'Your order'} · {lines.reduce((sum, line) => sum + line.quantity, 0)} {te ? 'ఐటమ్స్' : 'items'}</span>
          </div>
          {lines.length > 0 ? (
            <details data-testid="checkout-order-items" className="mt-2">
              <summary className="w-fit cursor-pointer rounded-md py-1 text-xs font-semibold text-[#ab4d3e] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ab4d3e]">
                {te ? 'వంటకాలు చూడండి / దాచండి' : 'View / hide items'}
              </summary>
              <ul className="mt-2 space-y-2 border-t border-[#e8dccf] pt-3 text-sm dark:border-stone-700">
              {lines.map(({ item, quantity }) => (
                <li key={item.id} className="flex items-start justify-between gap-4 text-stone-700 dark:text-stone-200">
                  <span className="min-w-0">{te ? item.nameTe : item.nameEn} × {quantity}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{money(item.pricePaisa * quantity)}</span>
                </li>
              ))}
              </ul>
            </details>
          ) : (
            <p className="mt-2 text-sm text-stone-500 dark:text-stone-300">
              {te ? 'పైన మీకు నచ్చిన వంటకాలను కార్ట్‌లో జోడించండి.' : 'Add food from the menu above to see your total.'}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#e8dccf] pt-2 dark:border-stone-700">
            <span className="text-sm font-bold text-stone-700 dark:text-stone-200">{te ? 'ఆహార మొత్తం' : 'Food subtotal'}</span>
            <strong className="text-lg font-bold tabular-nums text-[#ab4d3e] dark:text-emerald-200">{money(selected)}</strong>
          </div>
          <p className="mt-1 text-right text-[11px] text-stone-500 dark:text-stone-400">
            {te ? 'డెలివరీ ఛార్జీ తర్వాత చూపబడుతుంది' : 'Delivery charge calculated after location check'}
          </p>
        </div>

        <section aria-labelledby="checkout-customer-heading">
          <h4 id="checkout-customer-heading" className="flex items-center gap-2 text-sm font-bold text-[#26231f] dark:text-stone-100">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#f7f2e9] text-[#ab4d3e] dark:bg-stone-700 dark:text-emerald-200"><UserRound size={17} aria-hidden="true" /></span>
            {te ? 'కస్టమర్ వివరాలు' : 'Customer details'}
          </h4>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-200">
              {te ? 'పేరు' : 'Name'}
              <input required autoComplete="name" maxLength={100} value={name} onChange={e => change(setName, e.target.value)} placeholder={te ? 'మీ పూర్తి పేరు' : 'Your full name'} className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-base font-normal text-stone-900 placeholder:text-stone-400 focus-visible:border-[#ab4d3e] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#ab4d3e] dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100" />
            </label>
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-200">
              {te ? 'మొబైల్' : 'Mobile'}
              <input required autoComplete="tel-national" type="tel" inputMode="numeric" maxLength={10} value={mobile} onChange={e => change(setMobile, e.target.value)} placeholder={te ? '10 అంకెల మొబైల్ నంబర్' : '10-digit mobile number'} className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-base font-normal text-stone-900 placeholder:text-stone-400 focus-visible:border-[#ab4d3e] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#ab4d3e] dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100" />
            </label>
          </div>
        </section>

        <section aria-labelledby="checkout-delivery-heading">
          <h4 id="checkout-delivery-heading" className="flex items-center gap-2 text-sm font-bold text-[#26231f] dark:text-stone-100">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#f7f2e9] text-[#ab4d3e] dark:bg-stone-700 dark:text-emerald-200"><MapPin size={17} aria-hidden="true" /></span>
            {te ? 'డెలివరీ చిరునామా' : 'Delivery address'}
          </h4>
          <div className="mt-2 space-y-2">
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-200">
              {te ? 'పూర్తి చిరునామా' : 'Full address'}
              <textarea required autoComplete="street-address" rows={2} maxLength={500} value={address} onChange={e => change(setAddress, e.target.value)} placeholder={te ? 'ఫ్లాట్ నంబర్, బిల్డింగ్, ఏరియా' : 'Flat number, building and area'} className="mt-1 block min-h-16 w-full min-w-0 resize-y rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-base font-normal text-stone-900 placeholder:text-stone-400 focus-visible:border-[#ab4d3e] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#ab4d3e] dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100" />
            </label>
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-200">
              {te ? 'ల్యాండ్‌మార్క్ (ఐచ్ఛికం)' : 'Landmark (optional)'}
              <input maxLength={200} value={landmark} onChange={e => change(setLandmark, e.target.value)} placeholder={te ? 'దగ్గరలో గుర్తించగల స్థలం' : 'Nearby landmark'} className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-base font-normal text-stone-900 placeholder:text-stone-400 focus-visible:border-[#ab4d3e] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#ab4d3e] dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100" />
            </label>
            <div className="rounded-xl border border-[#d8e0cf] bg-[#f0f4ea] p-2.5 dark:border-emerald-400/30 dark:bg-emerald-950/20">
              <button type="button" onClick={getLocation} disabled={locationBusy} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#3d7152] bg-white px-3 py-2 text-sm font-semibold text-[#315c43] transition-colors hover:bg-[#fafdf8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ab4d3e] disabled:cursor-wait disabled:opacity-60 dark:border-emerald-400/60 dark:bg-stone-800 dark:text-emerald-200 dark:hover:bg-stone-700">
                {locationBusy ? <RefreshCw size={18} className="animate-spin" aria-hidden="true" /> : <LocateFixed size={18} aria-hidden="true" />}
                {locationBusy ? (te ? 'లొకేషన్ తీసుకుంటోంది…' : 'Getting location…') : coordinates ? (te ? 'లొకేషన్ తీసుకుంది ✓' : 'Location captured ✓') : (te ? 'డెలివరీ లొకేషన్ ఎంచుకోండి' : 'Use delivery location')}
              </button>
              <p className="mt-2 text-center text-[11px] font-medium leading-relaxed text-stone-700 dark:text-stone-200">
                {te ? 'కిచెన్ నుండి 0–5 కి.మీ. ఉచితం · 5–7 కి.మీ. ₹27 · 7–10 కి.మీ. ₹45 · 10 కి.మీ. దాటితే డెలివరీ లేదు' : 'From kitchen: 0–5 km free · 5–7 km ₹27 · 7–10 km ₹45 · No delivery beyond 10 km (straight-line distance)'}
              </p>
              <p className="mt-1 text-center text-[11px] leading-relaxed text-stone-600 dark:text-stone-300">
                {coordinates
                  ? (te ? 'లొకేషన్ సిద్ధం. క్రింద pin సరిచూసి confirm చేయండి.' : 'Location selected. Review the pin below and confirm.')
                  : (te ? 'GPS లేదా Google Maps pin ద్వారా delivery address ఎంచుకోండి.' : 'Choose the delivery address using GPS or a Google Maps pin.')}
              </p>
              <details data-testid="checkout-maps-alternative" className="group mt-2 border-t border-[#d8e0cf] pt-2 dark:border-emerald-400/20">
                <summary className="flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-md py-1 text-xs font-semibold text-[#315c43] focus-visible:outline-2 focus-visible:outline-[#ab4d3e] dark:text-emerald-200">
                  <span>{te ? 'GPS బదులు Google Maps link వాడండి' : 'Use Google Maps instead'}</span>
                  <span aria-hidden="true" className="text-base group-open:rotate-180">⌄</span>
                </summary>
                <div className="mt-2 space-y-2">
                <label htmlFor="new-menu-map-link" className="block text-xs font-bold text-stone-800 dark:text-stone-100">
                  {te ? 'Google Maps location link (ఐచ్ఛికం — GPS బదులు)' : 'Google Maps location link (instead of GPS)'}
                </label>
                <input id="new-menu-map-link" type="url" value={mapLinkDraft} maxLength={2000}
                  onChange={event => editMapLink(event.target.value)}
                  placeholder="https://www.google.com/maps?q=17.44421,78.251478"
                  className="min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 dark:border-stone-600 dark:bg-stone-900 dark:text-white" />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-emerald-800 underline dark:text-emerald-300">
                    {te ? 'Google Maps తెరవండి' : 'Open Google Maps'}
                  </a>
                  <button type="button" onClick={() => { void useMapPin(); }} disabled={locationBusy || !mapLinkDraft.trim()}
                    className="min-h-10 rounded-lg border border-emerald-700 bg-white px-3 text-xs font-bold text-emerald-800 disabled:opacity-50 dark:bg-stone-900 dark:text-emerald-300">
                    {locationBusy ? (te ? 'Maps pin చెక్ చేస్తున్నాం…' : 'Resolving Maps pin…') : te ? 'ఈ Maps pin వాడండి' : 'Use this Maps pin'}
                  </button>
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-300">
                  {te ? 'Google Mapsలో Copy link ద్వారా పొందిన maps.app.goo.gl short link కూడా వాడవచ్చు. Pin తప్పనిసరిగా confirm చేయండి.' : 'Paste a full Google Maps coordinates URL or a maps.app.goo.gl share link. Always review and confirm the pin.'}
                </p>
                </div>
              </details>
              {coordinates && (
                <div className="mt-3 rounded-lg border border-emerald-300 bg-white p-3 text-xs dark:border-emerald-800 dark:bg-stone-900">
                  <p className="font-bold text-stone-800 dark:text-stone-100">
                    {locationSource === 'GPS' ? (te ? 'GPS ద్వారా ఎంపిక' : 'Selected using GPS') : (te ? 'Google Maps ద్వారా ఎంపిక' : 'Selected from Google Maps')}
                  </p>
                  <p className="mt-1 font-mono text-stone-600 dark:text-stone-300">
                    {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
                  </p>
                  <a href={googleMapsPinUrl(coordinates.latitude, coordinates.longitude)} target="_blank" rel="noopener noreferrer"
                    className="mt-2 inline-block font-bold text-blue-700 underline dark:text-blue-300">
                    {te ? 'డెలివరీ pin మ్యాప్స్‌లో చూడండి ↗' : 'Review delivery pin on Maps ↗'}
                  </a>
                  <p className="mt-1 text-stone-600 dark:text-stone-300">
                    {te ? 'ఈ pin నుంచే delivery distance/charge calculate అవుతుంది.' : 'Delivery distance and charge use exactly this pin.'}
                  </p>
                </div>
              )}
              <label className="mt-2 flex items-start gap-2 rounded-lg border border-[#d8e0cf] bg-white p-2 text-xs leading-relaxed text-stone-800 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100">
                <input type="checkbox" checked={locationConfirmed}
                  disabled={!coordinates || address.trim().length < 5 || locationBusy}
                  onChange={event => {
                    setConfirmedLocationKey(event.target.checked ? selectedLocationKey : null);
                    setQuote(null); quoteRequestId.current += 1;
                  }} className="mt-0.5 h-4 w-4 shrink-0 accent-[#ab4d3e]"
                  aria-label="Confirm delivery address and map pin" />
                <span>{te ? 'నా డెలివరీ చిరునామా, మ్యాప్ pin సరిగా ఉన్నాయి. ఇక్కడికే ఫుడ్ పంపండి.' :
                  'I checked my delivery address and map pin. Deliver my food to this location.'}</span>
              </label>
            </div>
          </div>
        </section>

        {quote && (
          <div className="rounded-xl border border-emerald-300/60 bg-emerald-50/60 p-3 text-sm dark:border-emerald-800 dark:bg-emerald-950/30 sm:p-4">
            <h4 className="font-extrabold text-[#ab4d3e] dark:text-emerald-200">{te ? 'చెల్లింపు ముందు సారాంశం' : 'Review before payment'}</h4>
            <ul className="mt-3 space-y-1.5 text-stone-700 dark:text-stone-200">
              {quote.items.map(item => <li key={item.itemId}>{item.itemName} × {item.quantity}</li>)}
            </ul>
            <p className="mt-3 flex items-center justify-between gap-3 text-stone-700 dark:text-stone-200">
              <span>{te ? 'డెలివరీ' : 'Delivery'} ({quote.distanceKm} km)</span><strong className="tabular-nums">{money(quote.deliveryChargePaisa)}</strong>
            </p>
            <p className="mt-3 flex items-center justify-between gap-3 border-t border-emerald-800/15 pt-3 text-base dark:border-emerald-400/20">
              <span className="font-bold">{te ? 'చెల్లించాల్సిన మొత్తం' : 'Total to pay'}</span>
              <strong className="text-xl font-extrabold tabular-nums text-[#ab4d3e] dark:text-emerald-200">{money(quote.totalAmountPaisa)}</strong>
            </p>
            <p className="mt-2 text-xs text-stone-600 dark:text-stone-300">{quote.deliveryDateIst} · {quote.deliveryWindow} IST</p>
          </div>
        )}

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
        {status && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100">{status}</p>}
        {completed && (
          <div role="region" aria-label="Verified pre-order confirmation" className="rounded-2xl border-2 border-emerald-600 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-100">
            <p className="font-extrabold">{te ? 'ప్రీ-ఆర్డర్ ధృవీకరించబడింది' : 'Pre-order confirmed'}</p>
            {confirmedSlot ? (
              <>
                <p className="mt-2 font-semibold">
                  {te ? 'డెలివరీ తేదీ' : 'Delivery date'}: {confirmedSlot.deliveryDateIst}
                </p>
                <p className="mt-1 font-semibold">
                  {te ? 'డెలివరీ సమయం' : 'Delivery window'}: {confirmedSlot.deliveryWindow} IST
                </p>
                <p className="mt-2 break-all text-xs">{te ? 'ఆర్డర్' : 'Order'}: {confirmedSlot.orderId}</p>
              </>
            ) : (
              <p className="mt-2 text-sm">
                {te ? 'డెలివరీ తేదీ/సమయం కోసం Track this order తెరవండి.' : 'Open Track this order to see the verified delivery date and time.'}
              </p>
            )}
            <p className="mt-2 text-xs">
              {te ? 'ఆర్డర్ స్టేటస్ Track Orderలో చూడండి. WhatsApp/SMS ఆటోమేటిక్‌గా పంపబడదు.' :
                'Track your order for status updates. No automatic WhatsApp/SMS is sent.'}
            </p>
          </div>
        )}

        <div className="space-y-2 border-t border-stone-200 pt-3 dark:border-stone-700">
          {!quote ? (
            <button type="submit" disabled={busy || lines.length === 0 || !locationConfirmed} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#ab4d3e] px-4 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-[#934034] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ab4d3e] disabled:cursor-not-allowed disabled:bg-[#b0bdb2] disabled:text-white disabled:shadow-none">
              {busy ? <RefreshCw size={20} className="animate-spin" aria-hidden="true" /> : <ArrowRight size={19} aria-hidden="true" />}
              {busy ? (te ? 'దయచేసి వేచి ఉండండి…' : 'Checking…') : te ? 'డెలివరీ & మొత్తం చెక్ చేయండి' : 'Check delivery and total'}
            </button>
          ) : (
            <button type="button" onClick={pay} disabled={busy || completed || !locationConfirmed} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#ab4d3e] px-4 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-[#934034] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? <RefreshCw size={19} className="animate-spin" aria-hidden="true" /> : <Lock size={19} aria-hidden="true" />}
              {completed ? (te ? 'ఆర్డర్ ఖరారైంది' : 'Order confirmed') : busy ? (te ? 'దయచేసి వేచి ఉండండి…' : 'Please wait…') : te ? 'Razorpay ద్వారా చెల్లించండి' : 'Pay ' + money(quote.totalAmountPaisa) + ' with Razorpay'}
            </button>
          )}
          {lines.length === 0 && <p className="text-center text-xs text-stone-500 dark:text-stone-300">{te ? 'కొనసాగించడానికి పైన కార్ట్‌లో ఐటమ్స్ జోడించండి.' : 'Add items to the cart above to continue.'}</p>}
          {trackingToken && (
            <button type="button" onClick={() => setTrackingOpen(true)} className="min-h-11 w-full rounded-xl border border-emerald-700/40 bg-white px-4 py-2.5 text-sm font-bold text-[#ab4d3e] transition-colors hover:bg-emerald-50 dark:border-emerald-400/40 dark:bg-stone-900 dark:text-emerald-200">
              {te ? 'నా ఆర్డర్ ట్రాక్ చేయండి' : 'Track this order'}
            </button>
          )}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-0.5 text-center text-[11px] text-stone-500 dark:text-stone-300">
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
