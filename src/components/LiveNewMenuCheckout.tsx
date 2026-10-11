import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LocateFixed, Lock, RefreshCw } from 'lucide-react';
import { type MealPeriod, type MenuItem } from '../../shared/menuCatalog.ts';
import { OrderTrackingModal } from './OrderTrackingModal';
import { persistCustomerOrder } from '../utils/checkout';

type Line = { item: MenuItem; quantity: number };
type Quote = {
  quote: {
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

export function LiveNewMenuCheckout({ period, lines, te }: { period: MealPeriod; lines: readonly Line[]; te: boolean }) {
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
      const request = requestBody();
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
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to start payment.'); setBusy(false); }
  }

  const selected = lines.reduce((sum, line) => sum + line.item.pricePaisa * line.quantity, 0);
  return <div className="mt-7 overflow-hidden rounded-2xl border border-emerald-900/15 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-800" data-testid="live-new-menu-checkout">
    <div className="border-b border-stone-200 bg-emerald-50 px-4 py-4 dark:border-stone-700 dark:bg-emerald-950/40 sm:px-6">
      <h3 className="text-lg font-extrabold text-emerald-950 dark:text-emerald-100">{te ? 'ఆర్డర్ & డెలివరీ వివరాలు' : 'Order and delivery details'}</h3>
      <p className="mt-1 text-xs text-stone-600 dark:text-stone-300">{te ? 'ధర, లొకేషన్, స్టాక్ సర్వర్‌లో ధృవీకరించిన తర్వాతే పేమెంట్ తెరుచుకుంటుంది.' : 'Payment opens only after the server checks price, location and stock.'}</p>
    </div>
    <form noValidate autoComplete="on" onSubmit={checkQuote} className="space-y-3 px-4 py-5 sm:px-6">
      <div className="flex items-center justify-between gap-3"><span className="font-bold">{te ? 'ఆహార మొత్తం' : 'Food subtotal'}</span><strong>{money(selected)}</strong></div>
      <label className="block text-xs font-semibold">{te ? 'పేరు' : 'Name'}<input required maxLength={100} value={name} onChange={e => change(setName, e.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm dark:bg-stone-900" /></label>
      <label className="block text-xs font-semibold">{te ? 'మొబైల్' : 'Mobile'}<input required type="tel" inputMode="numeric" maxLength={10} value={mobile} onChange={e => change(setMobile, e.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm dark:bg-stone-900" /></label>
      <label className="block text-xs font-semibold">{te ? 'డెలివరీ చిరునామా' : 'Delivery address'}<textarea required rows={2} maxLength={500} value={address} onChange={e => change(setAddress, e.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm dark:bg-stone-900" /></label>
      <label className="block text-xs font-semibold">{te ? 'ల్యాండ్‌మార్క్ (ఐచ్ఛికం)' : 'Landmark (optional)'}<input maxLength={200} value={landmark} onChange={e => change(setLandmark, e.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm dark:bg-stone-900" /></label>
      <button type="button" onClick={getLocation} disabled={locationBusy} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-700 px-4 py-2.5 text-sm font-bold text-emerald-800 disabled:opacity-50 dark:text-emerald-200"><LocateFixed size={17} />{locationBusy ? (te ? 'లొకేషన్ తీసుకుంటోంది…' : 'Getting location…') : coordinates ? (te ? 'లొకేషన్ తీసుకుంది ✓' : 'Location captured ✓') : (te ? 'డెలివరీ లొకేషన్ ఎంచుకోండి' : 'Use delivery location')}</button>
      {coordinates && <p className="text-xs text-stone-500">{te ? 'లొకేషన్ సిద్ధం. చిరునామా సరిచూసి కొనసాగించండి.' : 'Location ready. Confirm the address before continuing.'}</p>}
      {quote && <div className="rounded-xl bg-stone-50 p-3 text-sm dark:bg-stone-900"><p className="flex justify-between"><span>{te ? 'డెలివరీ' : 'Delivery'} ({quote.distanceKm} km)</span><strong>{money(quote.deliveryChargePaisa)}</strong></p><p className="mt-1 flex justify-between border-t pt-2 text-base"><span>{te ? 'చెల్లించాల్సిన మొత్తం' : 'Total to pay'}</span><strong>{money(quote.totalAmountPaisa)}</strong></p><p className="mt-2 text-xs">{quote.deliveryDateIst} · {quote.deliveryWindow} IST</p></div>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
      {status && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100">{status}</p>}
      {!quote ? <button type="submit" disabled={busy || lines.length === 0} className="min-h-11 w-full rounded-xl bg-[#26543A] px-4 py-3 font-bold text-white disabled:opacity-50">{busy ? <RefreshCw className="mx-auto animate-spin" /> : te ? 'డెలివరీ & మొత్తం చెక్ చేయండి' : 'Check delivery and total'}</button> : <button type="button" onClick={pay} disabled={busy || completed} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#78350F] px-4 py-3 font-bold text-white disabled:opacity-50">{busy ? <RefreshCw className="animate-spin" /> : <Lock size={17} />}{completed ? (te ? 'ఆర్డర్ ఖరారైంది' : 'Order confirmed') : te ? 'Razorpay ద్వారా చెల్లించండి' : `Pay ${money(quote.totalAmountPaisa)} with Razorpay`}</button>}
      {trackingToken && <button type="button" onClick={() => setTrackingOpen(true)} className="min-h-11 w-full rounded-xl border px-4 py-2 font-bold">{te ? 'నా ఆర్డర్ ట్రాక్ చేయండి' : 'Track this order'}</button>}
      <p className="text-center text-xs text-stone-500">{te ? 'చెల్లింపుకు ముందు మొత్తం, డెలివరీ తేదీ, చిరునామా సరిచూడండి.' : 'Review total, delivery time and address before payment.'}</p>
    </form>
    <OrderTrackingModal isOpen={trackingOpen} onClose={() => setTrackingOpen(false)} initialOrderId={trackingToken} />
  </div>;
}
