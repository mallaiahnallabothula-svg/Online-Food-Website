import { useEffect, useRef, useState } from 'react';
import { BellRing, RefreshCw, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { playOrderNotificationSound } from '../../utils/audio';
import {
  diffPaidOrderAlerts, fetchPaidOrderAlertSnapshot,
  isTomorrowPaidOrder, paidOrderAlertSession, type PaidOrderAlert,
} from '../../utils/paidOrderAlerts';

interface Props {
  soundEnabled: boolean;
  onViewOrder: (id: string) => void;
  onSessionExpired: () => void;
}

const refreshMs = 12_000;

/** Owner-only, in-app alert panel; no Push API, SMS, payment write or database mutation. */
export function PaidOrderAlerts({ soundEnabled, onViewOrder, onSessionExpired }: Props) {
  const { language } = useLanguage();
  const te = language === 'te';
  const [newOrders, setNewOrders] = useState<PaidOrderAlert[]>([]);
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const soundRef = useRef(soundEnabled);
  soundRef.current = soundEnabled;
  const logoutRef = useRef(onSessionExpired);
  logoutRef.current = onSessionExpired;

  useEffect(() => {
    let alive = true;
    let inFlight = false;
    const controller = new AbortController();
    async function poll() {
      if (inFlight || !alive) return;
      inFlight = true;
      setChecking(true);
      try {
        const current = await fetchPaidOrderAlertSnapshot(controller.signal);
        if (!alive) return;
        const next = diffPaidOrderAlerts(seen.current, current);
        seen.current = next.seen;
        if (next.newlyPaid.length) {
          setNewOrders(previous => {
            const ids = new Set(previous.map(order => order.id));
            return [...next.newlyPaid.filter(order => !ids.has(order.id)), ...previous].slice(0, 20);
          });
          if (soundRef.current) playOrderNotificationSound();
        }
        setError(false);
      } catch (err) {
        if (!alive) return;
        if (err instanceof Error && err.message === 'OWNER_SESSION_EXPIRED') {
          seen.current = null;
          setNewOrders([]);
          logoutRef.current();
        } else {
          // A failed poll does not advance the baseline or silently hide previous alerts.
          setError(true);
        }
      } finally {
        inFlight = false;
        if (alive) setChecking(false);
      }
    }
    void poll();
    const interval = window.setInterval(() => { void poll(); }, refreshMs);
    const onFocus = () => { void poll(); };
    window.addEventListener('focus', onFocus);
    return () => {
      alive = false;
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const dismiss = (id: string) => setNewOrders(previous => previous.filter(o => o.id !== id));

  return (
    <section aria-label="Paid order alerts" className="rounded-2xl border border-amber-300 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-amber-950 dark:text-amber-100">
          <BellRing size={18} aria-hidden="true" />
          {te ? 'కొత్త చెల్లించిన ఆర్డర్ అలర్ట్స్' : 'New paid order alerts'}
          {newOrders.length > 0 && <span data-testid="paid-alert-count" className="rounded-full bg-amber-800 px-2 py-0.5 text-xs text-white">{newOrders.length}</span>}
        </h3>
        <div className="flex items-center gap-2">
          {newOrders.length > 0 && (
            <button type="button" onClick={() => setNewOrders([])} className="min-h-9 rounded-lg border border-amber-300 px-3 text-xs font-bold text-amber-900 dark:border-amber-800 dark:text-amber-200">
              {te ? 'అన్ని అలర్ట్స్ తీసివేయి' : 'Dismiss all'}
            </button>
          )}
          <span className="text-xs text-amber-900 dark:text-amber-200">
            {checking ? (te ? 'చెక్ చేస్తున్నాం…' : 'Checking…') : (te ? 'ప్రతి 12 సెకన్లకు చెక్' : 'Checks every 12s')}
          </span>
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-xs font-semibold text-red-800 dark:text-red-300">
        {te ? 'కొత్త ఆర్డర్లు చెక్ కాలేదు. కనెక్షన్ చూసి Refresh చేయండి.' : 'Could not check recent paid orders. Check your connection and refresh.'}
      </p>}
      {newOrders.length === 0 ? (
        <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
          {te ? 'ఈ పేజీ ఓపెన్ చేసిన తర్వాత కొత్త paid orders ఇక్కడ కనిపిస్తాయి. పాత orders కోసం Orders చూడండి.' :
            'New payments detected while this dashboard is open appear here. See Orders for existing orders.'}
        </p>
      ) : (
        <div className="mt-3 space-y-2" aria-live="polite">
          {newOrders.map(order => {
            const session = paidOrderAlertSession(order);
            const label = session === 'MORNING' ? (te ? 'ఉదయం' : 'Morning')
              : session === 'EVENING' ? (te ? 'సాయంత్రం' : 'Evening') : (te ? 'సెషన్ చెక్' : 'Review session');
            return (
              <article key={order.id} data-testid="paid-order-alert" className="rounded-xl border border-amber-300 bg-white p-3 dark:border-amber-800 dark:bg-stone-900">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-all text-sm font-extrabold text-stone-900 dark:text-white">{order.id}</p>
                    <p className="mt-1 text-xs text-stone-700 dark:text-stone-300">
                      {order.customerName || (te ? 'కస్టమర్' : 'Customer')} · ₹{order.totalAmount.toLocaleString('en-IN')}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-amber-900 dark:text-amber-200">
                      {label} · {order.deliveryDate} · {order.deliveryWindow} IST
                      {isTomorrowPaidOrder(order) && <> · {te ? 'రేపటి ప్రీ-ఆర్డర్' : "Tomorrow's pre-order"}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label={'View paid order ' + order.id}
                      className="min-h-10 rounded-lg bg-[#26543A] px-3 text-xs font-bold text-white"
                      onClick={() => { dismiss(order.id); onViewOrder(order.id); }}>
                      {te ? 'ఆర్డర్ చూడండి' : 'View Order'}
                    </button>
                    <button type="button" aria-label={'Dismiss paid alert ' + order.id}
                      onClick={() => dismiss(order.id)}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-300 dark:border-stone-700">
                      <X size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <p className="mt-2 text-[11px] text-amber-800 dark:text-amber-300">
        {te ? 'డాష్‌బోర్డ్ ఓపెన్ ఉన్నప్పుడు మాత్రమే alerts. Browser sound permission అవసరం కావచ్చు. WhatsApp/SMS పంపబడవు.' :
          'In-app alerts only while the dashboard is open. Browser sound may require interaction. No WhatsApp/SMS is sent.'}
      </p>
    </section>
  );
}
