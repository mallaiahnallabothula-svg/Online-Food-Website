import { MENU_CATALOG, isPublicMenuPeriod, type MealPeriod } from '../../shared/menuCatalog.ts';
import type { Order } from '../types';

export type ReorderRequest = {
  readonly sourceOrderId: string;
  readonly period: MealPeriod;
  readonly lines: readonly { readonly itemId: string; readonly quantity: number }[];
};
export type ReorderError = 'unavailable' | 'stock' | 'minimum';

/** Only finished, itemized orders fetched via a private tracking key qualify. */
export function buildReorderRequest(order: Order): ReorderRequest | null {
  if (!order.id.startsWith('MENU-') || order.paymentStatus !== 'PAID' ||
      order.fulfillmentStatus !== 'DELIVERED' || !order.items?.length) return null;
  let period: MealPeriod | undefined;
  const seen = new Set<string>();
  const lines: { itemId: string; quantity: number }[] = [];
  for (const line of order.items) {
    const item = MENU_CATALOG.find(candidate => candidate.id === line.itemId);
    if (!item || !Number.isSafeInteger(line.quantity) || line.quantity <= 0 ||
        seen.has(item.id) || (period && item.mealPeriod !== period)) return null;
    period = item.mealPeriod;
    seen.add(item.id);
    lines.push({ itemId: item.id, quantity: line.quantity });
  }
  // No old prices, customer PII, payment info, tracking key, or delivery date.
  return period && isPublicMenuPeriod(period) ? { sourceOrderId: order.id, period, lines } : null;
}

/** Reject invalid/stale stock or incompatible old quantities; never reduce silently. */
export function checkReorderStock(request: ReorderRequest, stock: Record<string, number>): ReorderError | null {
  if (!request.lines.length || !stock || typeof stock !== 'object') return 'unavailable';
  const seen = new Set<string>();
  for (const { itemId, quantity } of request.lines) {
    const item = MENU_CATALOG.find(candidate => candidate.id === itemId);
    if (!item || item.mealPeriod !== request.period || seen.has(itemId) ||
        !Number.isSafeInteger(quantity) || quantity < 1) return 'unavailable';
    seen.add(itemId);
    if (quantity < item.minimumQuantity) return 'minimum';
    const available = stock[itemId];
    if (typeof available !== 'number' || !Number.isSafeInteger(available) || available < 0) return 'unavailable';
    if (quantity > available || (item.dailyPlateLimit !== null && quantity > item.dailyPlateLimit)) return 'stock';
  }
  return null;
}
