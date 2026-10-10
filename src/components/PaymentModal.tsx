import { uiError } from '../utils/uiCopy';
import React, { useEffect, useRef, useState } from 'react';
import { X, Lock, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Order } from '../types';
import { BrandEmblem } from './BrandEmblem';
import { useLanguage } from '../context/LanguageContext';
import { createCheckout, clearPendingCheckout, type CheckoutDraft, type CheckoutIntent } from '../utils/checkout';

type GatewayResult = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type Gateway = { open(): void; on(event: string, callback: (result: any) => void): void };
declare global { interface Window { Razorpay?: new (options: Record<string, any>) => Gateway } }
let gatewayScript: Promise<void> | undefined;
function loadGateway() {
  if (window.Razorpay) return Promise.resolve();
  gatewayScript ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => window.Razorpay ? resolve() : reject(new Error('Payment checkout did not load.'));
    script.onerror = () => { script.remove(); reject(new Error('Could not load Razorpay. Please check your connection.')); };
    document.head.appendChild(script);
  }).catch(error => { gatewayScript = undefined; throw error; });
  return gatewayScript;
}
interface PaymentModalProps {
  isOpen: boolean; onClose(): void; orderData: CheckoutDraft; onPaymentSuccess(order: Order): void;
}
export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, orderData, onPaymentSuccess }) => {
  const { language } = useLanguage();
  const te = language !== 'en';
  const [intent, setIntent] = useState<CheckoutIntent | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const completed = useRef(false);
  const successCallback = useRef(onPaymentSuccess);
  successCallback.current = onPaymentSuccess;
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    completed.current = false;
    setLoading(true); setError(''); setIntent(null); setConfirmed(false); setBusy(false);
    createCheckout(orderData).then(data => { if (active) setIntent(data); })
      .catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isOpen, orderData, retryCount]);
  function finish(data: any, checkout: CheckoutIntent) {
    if (completed.current || !data?.order || data.order.paymentStatus !== 'PAID' || data.order.orderStatus !== 'TICKET_GENERATED') return;
    completed.current = true;
    clearPendingCheckout(checkout.intentId);
    setConfirmed(true); setBusy(false); setError('');
    successCallback.current({ ...data.order, customerAccessToken: checkout.customerAccessToken, ticketText: data.ticket || data.order.ticketText });
  }
  useEffect(() => {
    if (!isOpen || !intent) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (!active || completed.current) return;
      try {
        const response = await fetch(`/api/payment/status/${encodeURIComponent(intent.customerAccessToken)}`, { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          if (active && data.isPaid && data.ticketGenerated) finish(data, intent);
        }
      } catch { /* Check again after reconnect. */ }
      if (active && !completed.current) timer = setTimeout(poll, 4000);
    };
    poll();
    return () => { active = false; clearTimeout(timer); };
  }, [isOpen, intent]);
  const pay = async () => {
    if (!intent || busy) return;
    if (intent.provider !== 'razorpay' || !intent.providerDetails) {
      setError(te ? 'చెల్లింపు సేవ ఇంకా సిద్ధంగా లేదు. దయచేసి తరువాత ప్రయత్నించండి.' : 'Online payment is not ready yet. Please try again later.');
      return;
    }
    setBusy(true); setError('');
    try {
      await loadGateway();
      const checkout = new window.Razorpay!({
        key: intent.providerDetails.keyId, order_id: intent.providerDetails.orderId,
        amount: intent.amountPaisa, currency: intent.currency,
        name: 'Mana Enti Vanta', description: `Order ${intent.orderId}`,
        prefill: { name: orderData.customer.name, contact: orderData.customer.mobile },
        theme: { color: '#78350F' }, modal: { ondismiss: () => setBusy(false) },
        handler: async (result: GatewayResult) => {
          try {
            if (result.razorpay_order_id !== intent.providerDetails?.orderId) throw new Error('Payment order mismatch.');
            const response = await fetch('/api/payment/verify', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ intentId: intent.intentId, providerPaymentId: result.razorpay_payment_id, providerSignature: result.razorpay_signature }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || 'Payment confirmation is pending. Check your order status before paying again.');
            finish(data, intent);
            if (!completed.current) {
              setError(te ? 'చెల్లింపు ధృవీకరణ కోసం వేచి ఉంది. మళ్ళీ చెల్లించే ముందు “నా ఆర్డర్లు”లో స్థితి చూడండి.' : 'Payment confirmation is pending. Check My Orders before paying again.');
              setBusy(false);
            }
          } catch (error: any) { setError(error.message); setBusy(false); }
        },
      });
      checkout.on('payment.failed', (result: any) => { setError(result.error?.description || 'Payment failed. Please try again.'); setBusy(false); });
      checkout.open();
    } catch (error: any) { setError(error.message); setBusy(false); }
  };
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="payment-title">
    <div className="bg-white dark:bg-[#211E1A] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden font-telugu my-8">
      <div className="bg-[#78350F] p-5 text-white flex items-center justify-between">
        <div className="flex items-center gap-3"><BrandEmblem size="sm" /><h3 id="payment-title" className="font-bold text-lg">{te ? 'సురక్షిత ఆన్‌లైన్ చెల్లింపు' : 'Secure Online Payment'}</h3></div>
        <button onClick={onClose} aria-label={te ? 'చెల్లింపు మూసివేయి' : 'Close payment'} className="p-2 rounded-full hover:bg-white/20"><X className="w-5 h-5" /></button>
      </div>
      <div className="p-6 space-y-5">
        {loading ? <div className="text-center py-10"><RefreshCw className="animate-spin mx-auto mb-3" /><p>{te ? 'చెల్లింపు వివరాలు పొందుతోంది...' : 'Preparing checkout...'}</p></div> : <>
          {error && <div role="alert" className="rounded-xl bg-red-50 text-red-800 p-3 text-sm flex gap-2"><AlertTriangle className="w-5 h-5 shrink-0" />{uiError(error, language)}</div>}
          {!intent && error && <button onClick={() => setRetryCount(value => value + 1)} className="w-full rounded-xl bg-[#78350F] text-white p-3 font-bold">{te ? 'మళ్ళీ ప్రయత్నించండి' : 'Retry checkout'}</button>}
          {intent && <>
            <div className="rounded-2xl bg-stone-50 dark:bg-stone-900 p-4 space-y-2 text-sm dark:text-stone-200">
              <p className="flex justify-between"><span>{te ? 'రొట్టెలు & చపాతీలు' : 'Items subtotal'}</span><strong>₹{intent.subtotalRupees.toFixed(2)}</strong></p>
              <p className="flex justify-between"><span>{te ? 'డెలివరీ రుసుము' : 'Delivery fee'} ({intent.distanceKm} {te ? 'కి.మీ.' : 'km'})</span><strong>₹{intent.deliveryChargeRupees.toFixed(2)}</strong></p>
              <p className="flex justify-between border-t pt-3 text-lg"><span>{te ? 'మొత్తం' : 'Total'}</span><strong>₹{intent.amountRupees.toFixed(2)}</strong></p>
              <p className="text-xs text-stone-500">{te ? 'ఆర్డర్ నంబర్' : 'Order number'}: {intent.orderId}</p>
            </div>
            <button onClick={pay} disabled={busy || confirmed || intent.provider !== 'razorpay'} className="w-full bg-[#78350F] hover:bg-amber-900 text-white rounded-xl p-4 font-bold disabled:opacity-50 flex justify-center items-center gap-2">
              {confirmed ? <CheckCircle2 className="w-5 h-5" /> : busy ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
              {confirmed ? (te ? 'ఆర్డర్ ఖరారైంది' : 'Order confirmed') : busy ? (te ? 'చెల్లింపు కొనసాగుతోంది...' : 'Payment in progress...') : (te ? `Razorpay ద్వారా ₹${intent.amountRupees.toFixed(2)} చెల్లించండి` : `Pay ₹${intent.amountRupees.toFixed(2)} with Razorpay`)}
            </button>
            {intent.provider !== 'razorpay' && <p className="text-sm text-amber-800">{te ? 'ఆన్‌లైన్ చెల్లింపు సేవ ఇంకా సిద్ధంగా లేదు.' : 'Online payments are not configured yet.'}</p>}
            <p className="text-xs text-stone-500 text-center">{te ? 'UPI, కార్డు లేదా నెట్ బ్యాంకింగ్ ద్వారా చెల్లించండి. చెల్లింపు ధృవీకరించాక ఆర్డర్ ఖరారవుతుంది.' : 'Pay using UPI, card or net banking. Your order is confirmed after payment verification.'}</p>
            <p className="text-xs text-stone-500 text-center">{te ? 'ఈ పేజీ మూసినా “నా ఆర్డర్లు” నుండి స్థితి చూడవచ్చు.' : 'You can check the status in My Orders after closing this page.'}</p>
          </>}
        </>}
      </div>
    </div>
  </div>;
};
