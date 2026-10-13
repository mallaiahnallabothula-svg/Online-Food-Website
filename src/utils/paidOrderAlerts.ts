import { tomorrowIst } from './preorderNotices';
import { validKitchenDate } from './kitchenBoard';

export interface PaidOrderAlert {
  readonly id: string;
  readonly customerName: string;
  readonly deliveryDate: string;
  readonly deliveryWindow: string;
  readonly totalAmount: number;
  readonly paymentStatus: 'PAID';
  readonly fulfillmentStatus: string;
  readonly updatedAt: string;
}

/** This is a deliberately bounded read-only feed, not an exhaustive order history. */
export async function fetchPaidOrderAlertSnapshot(
  signal?: AbortSignal, fetcher: typeof fetch = fetch,
): Promise<PaidOrderAlert[]> {
  const response = await fetcher('/api/admin/paid-order-alerts', {
    cache: 'no-store', credentials: 'include', signal,
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error('OWNER_SESSION_EXPIRED');
  }
  if (!response.ok) throw new Error('Paid order alerts unavailable');
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object') throw new Error('Invalid paid order alerts');
  const alerts = (payload as { alerts?: unknown }).alerts;
  if (!Array.isArray(alerts) || alerts.length > 100 ||
      !alerts.every((a: unknown) => {
        if (!a || typeof a !== 'object') return false;
        const p = a as Record<string, unknown>;
        return typeof p.id === 'string' && p.id.length > 0 && p.id.length < 130 &&
          p.paymentStatus === 'PAID' && typeof p.customerName === 'string' &&
          typeof p.deliveryDate === 'string' && validKitchenDate(p.deliveryDate) &&
          typeof p.deliveryWindow === 'string' && typeof p.fulfillmentStatus === 'string' &&
          typeof p.updatedAt === 'string' && typeof p.totalAmount === 'number' &&
          Number.isFinite(p.totalAmount) && p.totalAmount >= 0;
      })) throw new Error('Invalid paid order alert data');
  const results = alerts as PaidOrderAlert[];
  if (new Set(results.map(a => a.id)).size !== results.length) {
    throw new Error('Duplicate paid order alert data');
  }
  return results;
}

/** Treat the first valid poll as a silent baseline, so historical paid orders don't ring. */
export function diffPaidOrderAlerts(
  seen: ReadonlySet<string> | null, current: readonly PaidOrderAlert[],
): { newlyPaid: PaidOrderAlert[]; seen: Set<string> } {
  const newlyPaid = seen === null ? [] : current.filter(order => !seen.has(order.id));
  const updated = new Set(seen ?? []);
  current.forEach(order => updated.add(order.id));
  // Keep a bounded session cache to avoid repeated alerts from ordinary status updates.
  while (updated.size > 1000) updated.delete(updated.values().next().value!);
  return { newlyPaid, seen: updated };
}

export type AlertSession = 'MORNING' | 'EVENING' | 'UNCLASSIFIED';

/** Use the saved server delivery window only; never infer from the order time. */
export function paidOrderAlertSession(order: PaidOrderAlert): AlertSession {
  const match = /^(\d{2}):(\d{2})[-–](\d{2}):(\d{2})$/.exec(order.deliveryWindow);
  if (!match) return 'UNCLASSIFIED';
  const start = Number(match[1]) * 60 + Number(match[2]);
  const end = Number(match[3]) * 60 + Number(match[4]);
  if (start < 0 || end <= start || end > 1440) return 'UNCLASSIFIED';
  if (start >= 360 && end <= 720) return 'MORNING';
  if (start >= 1020 && end <= 1320) return 'EVENING';
  return 'UNCLASSIFIED';
}

export function isTomorrowPaidOrder(order: PaidOrderAlert, now: Date = new Date()): boolean {
  return order.deliveryDate === tomorrowIst(now);
}
