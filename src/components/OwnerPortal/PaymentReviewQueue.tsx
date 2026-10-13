import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Copy, RefreshCw, ShieldAlert } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import {
  fetchPaymentReviewPage, formatPaymentReviewAmount, type PaymentReviewPage,
} from '../../utils/paymentReview';

interface Props {
  visible: boolean;
  onCountChange: (count: number | null) => void;
  onViewOrder: (orderId: string) => void;
  onAccessDenied: () => void;
}

const REFRESH_MS = 60_000;

/** ADMIN-only read-only panel. Keep mounted across tabs to poll the warning count. */
export function PaymentReviewQueue({ visible, onCountChange, onViewOrder, onAccessDenied }: Props) {
  const { language } = useLanguage();
  const te = language === 'te';
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<PaymentReviewPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const countRef = useRef(onCountChange);
  const deniedRef = useRef(onAccessDenied);
  countRef.current = onCountChange;
  deniedRef.current = onAccessDenied;

  useEffect(() => {
    let alive = true;
    let inFlight = false;
    const controller = new AbortController();
    setSnapshot(null);
    setLoading(true);
    setError(false);
    async function load() {
      if (!alive || inFlight) return;
      inFlight = true;
      try {
        const data = await fetchPaymentReviewPage(page, controller.signal);
        if (!alive) return;
        setSnapshot(data);
        setError(false);
        countRef.current(data.pagination.total);
      } catch (reason) {
        if (!alive) return;
        setSnapshot(null);
        setError(true);
        countRef.current(null);
        if (reason instanceof Error && reason.message === 'OWNER_REVIEW_ACCESS_DENIED') {
          deniedRef.current();
        }
      } finally {
        inFlight = false;
        if (alive) setLoading(false);
      }
    }
    void load();
    const timer = window.setInterval(() => { void load(); }, REFRESH_MS);
    const focus = () => { void load(); };
    window.addEventListener('focus', focus);
    return () => {
      alive = false;
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', focus);
    };
  }, [page, revision]);

  async function copyPaymentId(id: string) {
    setCopiedId(null);
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
    } catch {
      // Manual selection remains possible; no private details are sent anywhere.
    }
  }

  if (!visible) return null;
  const count = snapshot?.pagination.total ?? null;
  const pages = count === null ? 1 : Math.max(1, Math.ceil(count / 20));
  return (
    <section aria-label="Payment Review Queue" className="space-y-4 rounded-2xl border border-amber-300 bg-white p-4 dark:border-amber-800 dark:bg-[#211E1A] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-extrabold text-amber-950 dark:text-amber-100">
            <ShieldAlert size={20} aria-hidden="true" />
            {te ? 'పేమెంట్ మాన్యువల్ రివ్యూ' : 'Payment Review Queue'}
          </h3>
          <p className="mt-1 text-xs text-stone-600 dark:text-stone-300">
            {te ? 'Razorpayలో captured అయినా order confirm కాని రికార్డులు. కింద ఉన్నవి ఆటోమేటిక్‌గా పరిష్కరించబడవు.' :
              'Recorded captured-payment exceptions only. Review against Razorpay before any manual action.'}
          </p>
        </div>
        <button type="button" aria-label="Refresh payment reviews" onClick={() => setRevision(n => n + 1)}
          disabled={loading}
          className="flex min-h-10 items-center gap-2 rounded-lg border border-amber-400 px-3 text-xs font-bold text-amber-950 disabled:opacity-50 dark:text-amber-200">
          <RefreshCw size={15} aria-hidden="true" />{te ? 'రిఫ్రెష్' : 'Refresh'}
        </button>
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
        {te ? 'పేమెంట్ రివ్యూ వివరాలు లోడ్ కాలేదు. దయచేసి మళ్లీ ప్రయత్నించండి.' : 'Unable to load payment exceptions. Refresh to retry; zero exceptions cannot be assumed.'}
      </p>}
      {!error && loading && !snapshot && <p role="status" className="text-sm text-stone-600 dark:text-stone-300">
        {te ? 'రివ్యూ పేమెంట్లు చెక్ చేస్తున్నాం…' : 'Checking payment review records…'}
      </p>}
      {!error && snapshot && (
        <>
          <p data-testid="payment-review-total" className="text-sm font-bold text-stone-800 dark:text-stone-100">
            {te ? 'మొత్తం రివ్యూ రికార్డులు' : 'Recorded reviews needing attention'}: {snapshot.pagination.total.toLocaleString('en-IN')}
          </p>
          {snapshot.pagination.total === 0 ? (
            <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              {te ? 'వెబ్‌సైట్ డేటాబేస్‌లో REVIEW_REQUIRED రికార్డులు లేవు. Razorpayతో మాన్యువల్‌గా ఇంకా చెక్ చేయాలి.' :
                'No REVIEW_REQUIRED payment records in the website database. Still reconcile independently with Razorpay.'}
            </p>
          ) : snapshot.reviews.length === 0 ? (
            <p className="text-sm text-amber-900 dark:text-amber-200">
              {te ? 'ఈ పేజీలో రికార్డులు లేవు. Previous పేజీ చూడండి.' : 'No records on this page. Return to a previous page.'}
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {snapshot.reviews.map(review => (
                <article key={review.id} data-testid="payment-review-card" className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="break-all text-sm text-stone-900 dark:text-white">{review.orderId}</strong>
                    <span className="rounded-md border border-amber-500 bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-950 dark:bg-amber-900/40 dark:text-amber-100">REVIEW_REQUIRED</span>
                  </div>
                  <p className="text-xl font-extrabold tabular-nums text-stone-900 dark:text-white">
                    {formatPaymentReviewAmount(review.amountPaisa)}
                  </p>
                  <dl className="space-y-1 text-xs text-stone-700 dark:text-stone-300">
                    <div className="flex justify-between gap-2"><dt>{te ? 'ఆర్డర్ పేమెంట్ స్థితి' : 'Order payment status'}</dt><dd className="font-bold">{review.paymentStatus}</dd></div>
                    <div className="flex justify-between gap-2"><dt>{te ? 'డెలివరీ తేదీ' : 'Delivery date'}</dt><dd>{review.deliveryDate}</dd></div>
                    <div className="flex justify-between gap-2"><dt>{te ? 'రివ్యూ రికార్డ్ సమయం' : 'Recorded'}</dt><dd>{new Date(review.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST</dd></div>
                  </dl>
                  <p className="break-all text-xs font-semibold text-stone-700 dark:text-stone-200">Payment ID: {review.providerPaymentId}</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => { void copyPaymentId(review.providerPaymentId); }}
                      aria-label={'Copy payment ID ' + review.providerPaymentId}
                      className="flex min-h-10 items-center gap-1 rounded-lg border border-stone-300 px-3 text-xs font-bold dark:border-stone-700">
                      <Copy size={14} aria-hidden="true" />{copiedId === review.providerPaymentId ? (te ? 'కాపీ అయింది' : 'Copied') : (te ? 'పేమెంట్ ID కాపీ' : 'Copy Payment ID')}
                    </button>
                    <button type="button" onClick={() => onViewOrder(review.orderId)}
                      aria-label={'View review order ' + review.orderId}
                      className="min-h-10 rounded-lg bg-[#26543A] px-3 text-xs font-bold text-white">
                      {te ? 'ఆర్డర్ చూడండి' : 'View Order'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {snapshot.pagination.total > 20 && (
            <div className="flex items-center justify-between gap-2 text-sm">
              <button type="button" onClick={() => setPage(n => Math.max(1, n - 1))} disabled={page <= 1}
                className="min-h-10 rounded-lg border border-stone-300 px-3 disabled:opacity-50 dark:border-stone-700">Previous</button>
              <span>Page {page} / {pages}</span>
              <button type="button" onClick={() => setPage(n => Math.min(pages, n + 1))} disabled={page >= pages}
                className="min-h-10 rounded-lg border border-stone-300 px-3 disabled:opacity-50 dark:border-stone-700">Next</button>
            </div>
          )}
        </>
      )}
      <p className="flex items-start gap-2 rounded-lg border border-amber-300 p-3 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:text-amber-200">
        <AlertTriangle size={16} className="shrink-0" aria-hidden="true" />
        {te ? 'ఈ పేజీ డేటాబేస్‌లో నమోదైన exceptions మాత్రమే చూపిస్తుంది. Razorpay Dashboardలో payment నిజంగా captured అయ్యిందా, refund అవసరమా అని వేరుగా పరిశీలించండి. ఇక్కడ refund లేదా confirmation చేయలేరు.' :
          'This read-only queue shows recorded exceptions only. Verify captured status and any refund in Razorpay separately. No refund, order confirmation or status change is available here.'}
      </p>
    </section>
  );
}
