import { useEffect, useState } from 'react';
import { CalendarDays, ChefHat, Download, RefreshCw } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { fetchKitchenDeliveryOrders, istToday, kitchenUnitText, validKitchenDate } from '../../utils/kitchenBoard';
import { rupeesFromPaisa, summarizeDailyBusiness, type DailyBusinessSummary } from '../../utils/dailyBusinessReport';
import { tomorrowIst } from '../../utils/preorderNotices';

interface Props {
  onExportDate: (date: string) => void;
  isExporting: boolean;
  onViewKitchenDate: (date: string) => void;
}

/** Read-only daily report. Uses every page of existing authenticated orders API. */
export function DailyBusinessReport({ onExportDate, isExporting, onViewKitchenDate }: Props) {
  const { language } = useLanguage();
  const te = language === 'te';
  const [date, setDate] = useState(istToday);
  const [revision, setRevision] = useState(0);
  const [summary, setSummary] = useState<DailyBusinessSummary | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    let inFlight = false;
    const controller = new AbortController();
    // Never carry stale financial totals into a different selected date.
    setSummary(null);
    setLoading(true);
    setError(false);
    async function load() {
      if (!alive || inFlight) return;
      if (!validKitchenDate(date)) {
        if (alive) { setError(true); setSummary(null); setLoading(false); }
        return;
      }
      inFlight = true;
      try {
        const orders = await fetchKitchenDeliveryOrders(date, controller.signal);
        if (alive) {
          setSummary(summarizeDailyBusiness(orders, date));
          setError(false);
        }
      } catch {
        if (alive) {
          setSummary(null);
          setError(true);
        }
      } finally {
        inFlight = false;
        if (alive) setLoading(false);
      }
    }
    void load();
    const timer = window.setInterval(() => { void load(); }, 60_000);
    return () => { alive = false; controller.abort(); window.clearInterval(timer); };
  }, [date, revision]);

  const num = (n: number) => n.toLocaleString('en-IN');
  const cards = summary ? [
    { key: 'paid', label: te ? 'చెల్లించిన ఆర్డర్లు' : 'Paid orders', value: num(summary.paidOrders) },
    { key: 'food', label: te ? 'ఫుడ్ అమ్మకాలు' : 'Food sales', value: rupeesFromPaisa(summary.foodSalesPaisa) },
    { key: 'fees', label: te ? 'డెలివరీ ఛార్జీలు' : 'Delivery charges', value: rupeesFromPaisa(summary.deliveryFeesPaisa) },
    { key: 'total', label: te ? 'మొత్తం Paid' : 'Total paid', value: rupeesFromPaisa(summary.paidTotalPaisa) },
    { key: 'awaiting', label: te ? 'డెలివరీ పెండింగ్' : 'Awaiting delivery', value: num(summary.awaitingDelivery) },
    { key: 'delivered', label: te ? 'డెలివరీ పూర్తయింది' : 'Delivered', value: num(summary.delivered) },
  ] : [];

  return (
    <section aria-label="Daily Business Report" className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs dark:border-stone-800 dark:bg-[#211E1A] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-extrabold text-[#451A03] dark:text-amber-100">
            <CalendarDays size={20} aria-hidden="true" />
            {te ? 'రోజువారీ బిజినెస్ రిపోర్ట్' : 'Daily Business Report'}
          </h3>
          <p className="mt-1 text-xs text-stone-600 dark:text-stone-300">
            {te ? 'IST డెలివరీ తేదీ ఆధారంగా మాత్రమే. Payment PAID ఉన్న ఆర్డర్లు.' :
              'Grouped by delivery date (IST), not the payment date. PAID orders only.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold text-stone-800 dark:text-stone-200" htmlFor="daily-business-date">
            {te ? 'డెలివరీ తేదీ' : 'Delivery date'}
          </label>
          <input id="daily-business-date" type="date" value={date}
            onChange={event => setDate(event.target.value)}
            className="min-h-10 rounded-lg border border-stone-300 bg-white px-2 text-sm text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-white" />
          <button type="button" onClick={() => setRevision(x => x + 1)}
            disabled={loading} aria-label="Refresh daily report"
            className="flex min-h-10 items-center gap-1 rounded-lg border border-stone-300 px-3 text-xs font-bold text-stone-800 disabled:opacity-50 dark:border-stone-700 dark:text-stone-200">
            <RefreshCw size={14} aria-hidden="true" />{te ? 'రిఫ్రెష్' : 'Refresh'}
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {te ? 'రోజువారీ ఆర్డర్ల పూర్తి లెక్క రాలేదు. Refresh చేయండి. తప్పు మొత్తాలు చూపడం లేదు.' :
            'Could not load the complete daily report. Please refresh. Financial totals are hidden until the data is complete.'}
        </p>
      ) : loading ? (
        <p role="status" className="py-4 text-sm text-stone-600 dark:text-stone-300">
          {te ? 'రోజువారీ ఆర్డర్లు చెక్ చేస్తున్నాం…' : 'Loading all orders for the selected delivery date…'}
        </p>
      ) : summary && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {cards.map(card => (
              <div key={card.key} className="rounded-xl border border-stone-200 bg-stone-50 p-3 dark:border-stone-700 dark:bg-stone-900">
                <p className="text-xs font-semibold text-stone-600 dark:text-stone-300">{card.label}</p>
                <p data-testid={'daily-' + card.key} className="mt-1 text-xl font-extrabold tabular-nums text-stone-900 dark:text-stone-100">{card.value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
            <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-100">
              {te ? 'ఉదయం / సాయంత్రం Paid orders' : 'Paid orders by delivery session'}
            </h4>
            <p data-testid="daily-sessions" className="mt-1 text-sm text-emerald-900 dark:text-emerald-200">
              {te ? 'ఉదయం' : 'Morning'}: {num(summary.morning)} · {te ? 'సాయంత్రం' : 'Evening'}: {num(summary.evening)}
              {summary.unclassified > 0 && <> · {te ? 'తనిఖీ' : 'Review'}: {num(summary.unclassified)}</>}
            </p>
            {summary.cancelledPaid > 0 && <p className="mt-2 text-xs font-bold text-red-800 dark:text-red-300" role="note">
              {te ? 'Cancelled అయినా PAIDగా ఉన్న ఆర్డర్లు' : 'Cancelled but still marked PAID — review refunds'}: {num(summary.cancelledPaid)}
            </p>}
          </div>
          <div className="rounded-xl border border-stone-200 p-3 dark:border-stone-700">
            <h4 className="flex items-center gap-2 text-sm font-bold text-stone-900 dark:text-stone-100">
              <ChefHat size={17} aria-hidden="true" />{te ? 'ఇంకా తయారు చేయాల్సినవి' : 'Still to prepare'}
            </h4>
            {summary.toPrepare.length ? (
              <ul className="mt-2 space-y-1 text-sm text-stone-700 dark:text-stone-200">
                {summary.toPrepare.map(item => <li key={item.key}>{te ? item.nameTe : item.nameEn}: {kitchenUnitText(item, te)}</li>)}
              </ul>
            ) : <p className="mt-1 text-sm text-stone-500">{te ? 'ప్రస్తుతానికి తయారీ పెండింగ్ లేదు' : 'No remaining preparation for this date.'}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onViewKitchenDate(date)}
              className="min-h-11 rounded-lg bg-[#26543A] px-4 text-xs font-bold text-white">
              {te ? 'ఈ తేదీ కిచెన్ బోర్డ్' : 'View Kitchen Board'}
            </button>
            <button type="button" onClick={() => onViewKitchenDate(tomorrowIst())}
              className="min-h-11 rounded-lg border border-emerald-700 px-4 text-xs font-bold text-emerald-900 dark:text-emerald-200">
              {te ? 'రేపటి తయారీ చూడండి' : 'Tomorrow’s Kitchen Board'}
            </button>
            <button type="button" disabled={isExporting} onClick={() => onExportDate(date)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-stone-300 px-4 text-xs font-bold text-stone-800 disabled:opacity-50 dark:border-stone-700 dark:text-stone-200">
              <Download size={14} aria-hidden="true" />{te ? 'ఆర్డర్ల CSV డౌన్‌లోడ్' : 'Export date orders CSV'}
            </button>
          </div>
          <p className="text-xs leading-relaxed text-stone-500 dark:text-stone-400">
            {te ? 'ఈ మొత్తాలు PAID ఆర్డర్ల gross amounts మాత్రమే; లాభం/నికర ఆదాయం కాదు. Cancelled కానీ PAID ఆర్డర్లూ ఇందులో ఉంటాయి. Existing orders CSVలో unpaid orders కూడా ఉండవచ్చు.' :
              'These are gross recorded PAID amounts, not profit or payout. PAID cancellations are included and flagged. The existing orders CSV may also contain unpaid orders.'}
          </p>
        </>
      )}
    </section>
  );
}
