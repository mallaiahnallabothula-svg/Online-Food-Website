import React, { useEffect, useState } from 'react';
import { ChefHat, CheckCircle2, Clock3, PackageCheck, RefreshCw, Truck } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import type { FulfillmentStatus, Order } from '../../types';
import {
  fetchKitchenDeliveryOrders, istToday, kitchenLines, kitchenOrderSession, kitchenUnitText,
  projectKitchenBoard, type KitchenFilter,
} from '../../utils/kitchenBoard';

type Props = {
  onStatusChange: (orderId: string, status: FulfillmentStatus) => Promise<boolean>;
  initialDate?: string;
};

const filters: { key: KitchenFilter; en: string; te: string }[] = [
  { key: 'ALL', en: 'All sessions', te: 'అన్ని వేళలు' },
  { key: 'MORNING', en: 'Morning', te: 'ఉదయం' },
  { key: 'EVENING', en: 'Evening', te: 'సాయంత్రం' },
  { key: 'UNCLASSIFIED', en: 'Other / Review', te: 'ఇతర / తనిఖీ' },
];

export function KitchenBoard({ onStatusChange, initialDate }: Props) {
  const { language } = useLanguage();
  const te = language === 'te';
  const [date, setDate] = useState(() => initialDate ?? istToday());
  const [session, setSession] = useState<KitchenFilter>('ALL');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  // Temporary paper-like checklist: NEVER claims persisted packing/fulfillment.
  const [packed, setPacked] = useState<Record<string, readonly string[]>>({});

  useEffect(() => {
    let active = true;
    let inFlight = false;
    const controller = new AbortController();
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      setLoading(true);
      try {
        const all = await fetchKitchenDeliveryOrders(date, controller.signal);
        if (active) {
          setOrders(all);
          setError('');
        }
      } catch {
        if (active) {
          setOrders([]); // Fail closed: never display incomplete data as current totals.
          setError(te
            ? 'కిచెన్ ఆర్డర్లు పూర్తిగా లోడ్ కాలేదు. Refresh చేసి చూడండి.'
            : 'Kitchen orders could not be loaded completely. Please refresh.');
        }
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    };
    void load();
    const interval = window.setInterval(() => { void load(); }, 30_000);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [date, refresh, te]);

  const board = projectKitchenBoard(orders, date, session);
  const effectiveOrders = error ? [] : board.orders;

  async function advance(order: Order, next: FulfillmentStatus) {
    if (updatingId || order.paymentStatus !== 'PAID') return;
    setUpdatingId(order.id);
    try {
      const updated = await onStatusChange(order.id, next);
      if (updated) {
        setPacked(previous => {
          const copy = { ...previous };
          delete copy[order.id];
          return copy;
        });
        setRefresh(value => value + 1);
      }
    } finally {
      setUpdatingId(null);
    }
  }

  function togglePacked(orderId: string, key: string) {
    setPacked(previous => {
      const current = previous[orderId] ?? [];
      const next = current.includes(key) ? current.filter(value => value !== key) : [...current, key];
      return { ...previous, [orderId]: next };
    });
  }

  return (
    <section className="space-y-4" aria-labelledby="kitchen-board-heading">
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs dark:border-stone-800 dark:bg-[#211E1A] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="kitchen-board-heading" className="flex items-center gap-2 text-lg font-bold text-stone-900 dark:text-stone-100">
              <ChefHat size={22} className="text-emerald-700" />
              {te ? 'కిచెన్ ప్రిపరేషన్ బోర్డు' : 'Kitchen Preparation Board'}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-stone-500 dark:text-stone-300">
              {te ? 'చెల్లించిన ఆర్డర్లు మాత్రమే. 30 సెకన్లకొకసారి రిఫ్రెష్ అవుతుంది.' : 'Paid orders only. Refreshes every 30 seconds.'}
            </p>
          </div>
          <button type="button" onClick={() => setRefresh(value => value + 1)} disabled={loading}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-stone-300 px-3 text-sm font-semibold text-stone-800 disabled:opacity-50 dark:border-stone-600 dark:text-stone-100">
            <RefreshCw size={16} />{te ? 'రిఫ్రెష్' : 'Refresh'}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-bold text-stone-700 dark:text-stone-200">
            {te ? 'డెలివరీ తేదీ (IST)' : 'Delivery date (IST)'}
            <input type="date" aria-label="Kitchen delivery date" value={date}
              onChange={event => { setDate(event.target.value); setPacked({}); }}
              className="min-h-11 rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-900 dark:border-stone-600 dark:bg-stone-900 dark:text-white" />
          </label>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Kitchen session filter">
            {filters.map(option => (
              <button type="button" key={option.key} aria-pressed={session === option.key}
                onClick={() => setSession(option.key)}
                className={'min-h-10 rounded-lg border px-3 text-xs font-bold ' +
                  (session === option.key
                    ? 'border-emerald-700 bg-emerald-800 text-white'
                    : 'border-stone-300 bg-white text-stone-700 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-200')}>
                {te ? option.te : option.en}
              </button>
            ))}
          </div>
        </div>
        {error && <p role="alert" className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</p>}
        {loading && <p role="status" className="mt-3 text-xs text-stone-500">{te ? 'ఆర్డర్లు లోడ్ అవుతున్నాయి…' : 'Loading kitchen orders…'}</p>}
      </div>

      {!error && !loading && (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Active paid order counts">
            {[
              { key: 'received', label: te ? 'కొత్తవి' : 'New', icon: Clock3 },
              { key: 'preparing', label: te ? 'తయారవుతున్నవి' : 'Preparing', icon: ChefHat },
              { key: 'outForDelivery', label: te ? 'డెలివరీలో' : 'Out for delivery', icon: Truck },
            ].map(({ key, label, icon: Icon }) => (
              <div key={key} className="rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-[#211E1A]">
                <Icon size={17} className="text-emerald-700 dark:text-emerald-400" />
                <p className="mt-2 text-2xl font-black tabular-nums text-stone-900 dark:text-stone-100">{board[key as 'received' | 'preparing' | 'outForDelivery']}</p>
                <p className="text-xs text-stone-500 dark:text-stone-300">{label}</p>
              </div>
            ))}
          </div>
          {(board.unclassified > 0 || board.incomplete > 0) && (
            <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              {te
                ? 'కొన్ని పాత/అసంపూర్ణ ఆర్డర్లను మాన్యువల్‌గా తనిఖీ చేయండి. ఐటమ్ లెక్కలు అసంపూర్ణంగా ఉండవచ్చు.'
                : 'Some older/unclassified orders need manual review. Item preparation totals may be incomplete.'}
            </p>
          )}
          <div className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-[#211E1A] sm:p-5">
            <h3 className="flex items-center gap-2 font-extrabold text-stone-900 dark:text-stone-100">
              <PackageCheck size={19} />{te ? 'ఇంకా తయారు చేయాల్సినవి' : 'Items to prepare'}
            </h3>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-300">
              {te ? 'కొత్తవి + తయారవుతున్నవి మాత్రమే; డెలివరీకి పంపినవి లెక్కలో ఉండవు.' : 'New + Preparing only. Dispatched orders are excluded.'}
            </p>
            {board.toPrepare.length === 0
              ? <p className="mt-4 text-sm text-stone-500">{te ? 'ఈ ఎంపికకు ప్రిపరేషన్ ఐటమ్స్ లేవు.' : 'No preparation items for this selection.'}</p>
              : <ul className="mt-3 divide-y divide-stone-100 dark:divide-stone-800">
                {board.toPrepare.map(line => (
                  <li key={line.key} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span className="font-bold text-stone-800 dark:text-stone-100">{te ? line.nameTe : line.nameEn}</span>
                    <span className="font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">{kitchenUnitText(line, te)}</span>
                  </li>
                ))}
              </ul>}
          </div>
          <div className="space-y-3">
            <h3 className="text-base font-extrabold text-stone-900 dark:text-stone-100">
              {te ? 'ఆర్డర్ల వారీ తయారీ' : 'Order preparation'} ({effectiveOrders.length})
            </h3>
            {!effectiveOrders.length && <p className="rounded-xl border border-stone-200 bg-white p-5 text-sm text-stone-500 dark:border-stone-800 dark:bg-[#211E1A]">
              {te ? 'ఈ తేదీ, సమయానికి పెండింగ్ కిచెన్ ఆర్డర్లు లేవు.' : 'No active paid kitchen orders for this date/session.'}
            </p>}
            {effectiveOrders.map(order => {
              const lines = kitchenLines(order);
              const canPack = order.fulfillmentStatus === 'RECEIVED' || order.fulfillmentStatus === 'PREPARING';
              const checked = packed[order.id] ?? [];
              const nextStatus: FulfillmentStatus | null = order.fulfillmentStatus === 'RECEIVED' ? 'PREPARING'
                : order.fulfillmentStatus === 'PREPARING' ? 'OUT_FOR_DELIVERY'
                  : order.fulfillmentStatus === 'OUT_FOR_DELIVERY' ? 'DELIVERED' : null;
              const nextLabel = nextStatus === 'PREPARING' ? (te ? 'తయారీ ప్రారంభించు' : 'Start preparing')
                : nextStatus === 'OUT_FOR_DELIVERY' ? (te ? 'డెలివరీకి పంపు' : 'Out for delivery')
                  : (te ? 'డెలివరీ పూర్తయింది' : 'Mark delivered');
              return (
                <article key={order.id} className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-[#211E1A] sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-all font-mono text-sm font-bold text-stone-900 dark:text-white">{order.id}</p>
                      <p className="mt-1 text-xs text-stone-500 dark:text-stone-300">
                        {order.customerName || order.customer?.name || 'Customer'} · {order.deliveryDate} · {order.deliveryWindow} IST
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                      {order.fulfillmentStatus === 'RECEIVED' ? (te ? 'కొత్తది' : 'New')
                        : order.fulfillmentStatus === 'PREPARING' ? (te ? 'తయారవుతోంది' : 'Preparing')
                          : (te ? 'డెలివరీలో' : 'Out for delivery')}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-stone-500 dark:text-stone-300">
                    {te ? 'సెషన్: ' : 'Session: '}{kitchenOrderSession(order)}
                  </p>
                  {lines.length
                    ? <div className="mt-3 space-y-2" aria-label="Packing checklist">
                      {lines.map(line => (
                        <label key={line.key} className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-lg bg-stone-50 p-2 text-sm dark:bg-stone-900">
                          <span className="flex items-center gap-2 text-stone-800 dark:text-stone-100">
                            {canPack && <input type="checkbox" aria-label={'Pack ' + line.nameEn + ' for ' + order.id}
                              checked={checked.includes(line.key)}
                              onChange={() => togglePacked(order.id, line.key)}
                              className="h-4 w-4 accent-emerald-700" />}
                            <span className={checked.includes(line.key) && canPack ? 'line-through opacity-60' : ''}>{te ? line.nameTe : line.nameEn}</span>
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums text-stone-800 dark:text-stone-100">{kitchenUnitText(line, te)}</span>
                        </label>
                      ))}
                    </div>
                    : <p role="alert" className="mt-3 text-sm text-amber-700">{te ? 'ఐటమ్స్ లేవు — Ordersలో చెక్ చేయండి.' : 'Item details missing — review in Orders.'}</p>}
                  {canPack && lines.length > 0 && (
                    <p className="mt-2 text-xs text-stone-500 dark:text-stone-300">
                      <CheckCircle2 size={13} className="mr-1 inline" />{checked.length}/{lines.length}
                      {te ? ' ప్యాక్ చేసినవి (ఈ స్క్రీన్‌లో మాత్రమే)' : ' packed (this screen only)'}
                    </p>
                  )}
                  {nextStatus && (
                    <button type="button" disabled={updatingId !== null} onClick={() => { void advance(order, nextStatus); }}
                      className="mt-3 min-h-11 w-full rounded-xl bg-[#26543A] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                      {updatingId === order.id ? (te ? 'అప్‌డేట్ అవుతోంది…' : 'Updating…') : nextLabel}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-300">
            {te ? 'ప్యాకింగ్ చెక్‌బాక్స్‌లు తాత్కాలికం. రిఫ్రెష్/పేజీ మూసిన తర్వాత సేవ్ కావు. ఆర్డర్ స్థితి మాత్రమే సర్వర్‌లో సేవ్ అవుతుంది.' :
              'Packing checkboxes are temporary and are not saved after a page reload. Only order status changes are saved on the server.'}
          </p>
        </>
      )}
    </section>
  );
}
