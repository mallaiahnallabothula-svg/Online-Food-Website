import { MENU_CATALOG, NEW_MENU_ORDER_POLICY, type MealPeriod, type MenuItem } from '../../shared/menuCatalog';

export type CheckoutSelection = {
  period: MealPeriod;
  lines: { item: MenuItem; quantity: number }[];
  subtotalPaisa: number;
};
const KEY = 'mana_secure_checkout_selection_v1';

/** Store only selected item IDs and counts; never PII, payment or quote data. */
export function rememberCheckoutSelection(selection: CheckoutSelection): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({
      period: selection.period,
      lines: selection.lines.map(({ item, quantity }) => ({ itemId: item.id, quantity })),
    }));
  } catch { /* Keep cart in memory if storage is unavailable. */ }
}

/** Recompute cart prices from catalog on refresh, never trust stored prices. */
export function restoreCheckoutSelection(): CheckoutSelection | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const cart = parsed as { period?: unknown; lines?: unknown };
    if (cart.period !== 'MORNING' && cart.period !== 'EVENING') return null;
    if (!Array.isArray(cart.lines) || cart.lines.length === 0 || cart.lines.length > 6) return null;
    const seen = new Set<string>();
    const lines: CheckoutSelection['lines'] = [];
    for (const value of cart.lines) {
      if (!value || typeof value !== 'object') return null;
      const entry = value as { itemId?: unknown; quantity?: unknown };
      if (typeof entry.itemId !== 'string' || seen.has(entry.itemId)) return null;
      const item = MENU_CATALOG.find(m => m.id === entry.itemId && m.mealPeriod === cart.period);
      if (!item || typeof entry.quantity !== 'number' || !Number.isInteger(entry.quantity) ||
          entry.quantity < item.minimumQuantity || entry.quantity > (item.dailyPlateLimit ?? 500)) return null;
      seen.add(entry.itemId);
      lines.push({ item, quantity: entry.quantity });
    }
    const subtotalPaisa = lines.reduce((sum, line) => sum + line.item.pricePaisa * line.quantity, 0);
    if (subtotalPaisa < NEW_MENU_ORDER_POLICY.minimumCartPaisa) return null;
    return { period: cart.period, lines, subtotalPaisa };
  } catch { return null; }
}
