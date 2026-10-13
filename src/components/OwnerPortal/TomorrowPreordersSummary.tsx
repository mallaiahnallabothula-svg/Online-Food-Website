import { useEffect, useState } from 'react';
import { CalendarClock, RefreshCw } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { fetchKitchenDeliveryOrders } from '../../utils/kitchenBoard';
import { summarizeTomorrowPreorders, tomorrowIst, type TomorrowPreorderSummary } from '../../utils/preorderNotices';

interface Props {
  onViewTomorrow: (date: string) => void;
}

/** Owner-only read-only dashboard reminder. No messages, writes or payment changes. */
export function TomorrowPreordersSummary({ onViewTomorrow }: Props) {
  const { language } = useLanguage();
  const te = language === 'te';
  const [summary, setSummary] = useState<TomorrowPreorderSummary | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let alive = true;
    let inFlight = false;
    const controller = new AbortController();
    const fetchSummary = async () => {
      if (inFlight) return;
      inFlight = true;
      if (alive) setLoading(true);
      const date = tomorrowIst();
      try {
        const orders = await fetchKitchenDeliveryOrders(date, controller.signal);
        if (alive) {
          setSummary(summarizeTomorrowPreorders(orders, date));
          setError(false);
        }
      } catch {
        if (alive) {
          setSummary(null); // Never show yesterday's or partial counts as current.
          setError(true);
        }
      } finally {
        inFlight = false;
        if (alive) setLoading(false);
      }
    };
    void fetchSummary();
    const timer = window.setInterval(() => { void fetchSummary(); }, 60_000);
    return () => { alive = false; controller.abort(); window.clearInterval(timer); };
  }, [revision]);

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/20" aria-label="Tomorrow pre-orders summary">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-emerald-950 dark:text-emerald-100">
            <CalendarClock size={18} />
            {te ? 'రేపటి ప్రీ-ఆర్డర్లు (IST)' : "Tomorrow's pre-orders (IST)"}
          </h3>
          <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">
            {te ? 'రేపు డెలివరీ చేయాల్సిన, చెల్లించిన ఆర్డర్లు మాత్రమే.' : 'Paid, active orders scheduled for tomorrow only.'}
          </p>
        </div>
        <button type="button" disabled={loading} onClick={() => setRevision(value => value + 1)}
          aria-label="Refresh tomorrow pre-orders"
          className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-emerald-300 px-3 text-xs font-bold text-emerald-900 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-200">
          <RefreshCw size={14}/>{te ? 'రిఫ్రెష్' : 'Refresh'}
        </button>
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">
        {te ? 'రేపటి ఆర్డర్ల లెక్క పూర్తిగా లోడ్ కాలేదు. Refresh చేయండి.' : 'Tomorrow order summary unavailable. Please refresh.'}
      </p> : loading ? <p role="status" className="mt-3 text-sm text-emerald-800 dark:text-emerald-200">
        {te ? 'రేపటి ఆర్డర్లు చెక్ చేస్తున్నాం…' : "Checking tomorrow's orders…"}
      </p> : summary && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">{summary.date}</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-emerald-950 dark:text-emerald-100" data-testid="tomorrow-paid-order-count">
              {summary.total} <span className="text-sm font-semibold">{te ? 'ఆర్డర్లు' : 'orders'}</span>
            </p>
            <p className="text-xs text-emerald-900 dark:text-emerald-200">
              {te ? 'ఉదయం' : 'Morning'}: {summary.morning} · {te ? 'సాయంత్రం' : 'Evening'}: {summary.evening}
              {summary.needsReview > 0 && <> · {te ? 'తనిఖీ' : 'Review'}: {summary.needsReview}</>}
            </p>
          </div>
          <button type="button" onClick={() => onViewTomorrow(summary.date)}
            aria-label="Open tomorrow's Kitchen Board"
            className="min-h-11 rounded-lg bg-[#26543A] px-4 py-2 text-xs font-bold text-white">
            {te ? 'కిచెన్ బోర్డులో చూడండి' : 'View in Kitchen Board'}
          </button>
        </div>
      )}
    </section>
  );
}
