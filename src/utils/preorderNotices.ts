import type { Order } from '../types';
import { istToday, kitchenOrderSession, validKitchenDate } from './kitchenBoard';

/** Date arithmetic in the business timezone, regardless of the browser timezone. */
export function tomorrowIst(now: Date = new Date()): string {
  const today = istToday(now);
  return new Date(Date.parse(today + 'T00:00:00.000Z') + 86_400_000)
    .toISOString().slice(0, 10);
}

export interface TomorrowPreorderSummary {
  readonly date: string;
  readonly total: number;
  readonly morning: number;
  readonly evening: number;
  readonly needsReview: number;
}

/** Paid orders due tomorrow; cancelled, failed, pending and completed are excluded. */
export function summarizeTomorrowPreorders(orders: readonly Order[], date: string): TomorrowPreorderSummary {
  if (!validKitchenDate(date)) throw new Error('Invalid delivery date');
  const active = orders.filter(order =>
    order.deliveryDate === date &&
    order.paymentStatus === 'PAID' &&
    ['RECEIVED', 'PREPARING', 'OUT_FOR_DELIVERY'].includes(order.fulfillmentStatus));
  const sessions = active.map(kitchenOrderSession);
  return {
    date,
    total: active.length,
    morning: sessions.filter(period => period === 'MORNING').length,
    evening: sessions.filter(period => period === 'EVENING').length,
    needsReview: sessions.filter(period => period === 'UNCLASSIFIED').length,
  };
}

export interface ConfirmedPreorderSlot {
  readonly orderId: string;
  readonly deliveryDateIst: string;
  readonly deliveryWindow: string;
}

/** Display only the confirmed order's saved checkout schedule, never a guessed window. */
export function parsePreparedPreorderSlot(value: unknown, expectedOrderId: string): ConfirmedPreorderSlot | null {
  if (!value || typeof value !== 'object') return null;
  const slot = value as Record<string, unknown>;
  if (slot.orderId !== expectedOrderId ||
      typeof slot.deliveryDateIst !== 'string' || !validKitchenDate(slot.deliveryDateIst) ||
      typeof slot.deliveryWindow !== 'string' ||
      !/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(slot.deliveryWindow)) return null;
  const [from, to] = slot.deliveryWindow.split('-');
  const minute = (s: string) => {
    const [h, m] = s.split(':').map(Number);
    return h! * 60 + m!;
  };
  if (minute(from!) >= minute(to!) || minute(to!) > 1_439) return null;
  return {
    orderId: expectedOrderId,
    deliveryDateIst: slot.deliveryDateIst,
    deliveryWindow: slot.deliveryWindow,
  };
}
