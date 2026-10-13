import { MENU_CATALOG, type MealPeriod, type SaleUnit } from '../../shared/menuCatalog.ts';
import type { Order, OrderLine } from '../types';

export type KitchenSession = MealPeriod | 'UNCLASSIFIED';
export type KitchenFilter = 'ALL' | KitchenSession;
export type KitchenLine = {
  key: string;
  itemId: string;
  nameEn: string;
  nameTe: string;
  quantity: number;
  saleUnit: SaleUnit;
  piecesPerUnit: number | null;
};
export type KitchenItemTotal = KitchenLine & { orders: number };
export type KitchenBoardView = {
  orders: Order[];
  toPrepare: KitchenItemTotal[];
  received: number;
  preparing: number;
  outForDelivery: number;
  unclassified: number;
  incomplete: number;
};
const activeStatuses = new Set(['RECEIVED', 'PREPARING', 'OUT_FOR_DELIVERY']);

export function istToday(now: Date = new Date()): string {
  const pieces = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric',
  }).formatToParts(now);
  const get = (type: string) => pieces.find(piece => piece.type === type)?.value ?? '';
  return get('year') + '-' + get('month') + '-' + get('day');
}

export function validKitchenDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date + 'T00:00:00.000Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

/**
 * Fetch all pages of the existing authenticated owner orders endpoint.
 * Do not silently show 20/100-row totals as complete. If a page fails or
 * the count changes during pagination, fail closed rather than undercount.
 */
export async function fetchKitchenDeliveryOrders(
  date: string, signal?: AbortSignal, fetcher: typeof fetch = fetch,
): Promise<Order[]> {
  if (!validKitchenDate(date)) throw new Error('Choose a valid delivery date');
  const pageSize = 100;
  let expectedTotal: number | undefined;
  let pages = 1;
  const all: Order[] = [];
  for (let page = 1; page <= pages; page++) {
    const query = new URLSearchParams({ date, page: String(page), limit: String(pageSize) });
    const response = await fetcher('/api/admin/orders?' + query.toString(), {
      credentials: 'include', cache: 'no-store', signal,
    });
    if (!response.ok) throw new Error('Kitchen orders unavailable. Please retry.');
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object') throw new Error('Invalid kitchen orders response');
    const payload = data as { orders?: unknown; pagination?: { total?: unknown; totalPages?: unknown } };
    const total = payload.pagination?.total;
    const totalPages = payload.pagination?.totalPages;
    if (!Number.isSafeInteger(total) || typeof total !== 'number' || total < 0 ||
        !Number.isSafeInteger(totalPages) || typeof totalPages !== 'number' || totalPages < 1 ||
        totalPages !== Math.max(1, Math.ceil(total / pageSize)) ||
        !Array.isArray(payload.orders) || payload.orders.length > pageSize) {
      throw new Error('Incomplete kitchen orders response. Please retry.');
    }
    if (expectedTotal === undefined) {
      expectedTotal = total;
      pages = totalPages;
    } else if (total !== expectedTotal || totalPages !== pages) {
      throw new Error('Orders changed while loading. Please refresh.');
    }
    all.push(...payload.orders as Order[]);
  }
  if (all.length !== expectedTotal || new Set(all.map(order => order.id)).size !== all.length ||
      all.some(order => order.deliveryDate !== date)) {
    throw new Error('Incomplete kitchen order list. Please refresh.');
  }
  return all;
}

export function kitchenLines(order: Order): KitchenLine[] {
  const source = order.items?.length ? order.items : !order.id.startsWith('MENU-')
    ? [
      { itemId: 'jowar-roti', quantity: order.jowarQuantity ?? 0 },
      { itemId: 'chapathi', quantity: order.chapathiQuantity ?? 0 },
    ] : [];
  return source.flatMap(line => {
    if (!line || !Number.isSafeInteger(line.quantity) || line.quantity <= 0) return [];
    const catalog = MENU_CATALOG.find(item => item.id === line.itemId);
    const saved = line as Partial<OrderLine>;
    const saleUnit = saved.saleUnit ?? catalog?.saleUnit;
    if (saleUnit !== 'PLATE' && saleUnit !== 'PIECE' && saleUnit !== 'PACK') return [];
    const piecesPerUnit = saved.piecesPerUnit === undefined
      ? catalog?.piecesPerUnit ?? null : saved.piecesPerUnit;
    const nameEn = saved.nameEn || catalog?.nameEn || line.itemId;
    const nameTe = saved.nameTe || catalog?.nameTe || line.itemId;
    return [{
      key: [line.itemId, nameEn, saleUnit, String(piecesPerUnit)].join(':'),
      itemId: line.itemId, nameEn, nameTe, quantity: line.quantity,
      saleUnit, piecesPerUnit,
    }];
  });
}

export function kitchenOrderSession(order: Order): KitchenSession {
  const lines = kitchenLines(order);
  if (!lines.length) return 'UNCLASSIFIED';
  if (!order.items?.length && !order.id.startsWith('MENU-')) return 'EVENING';
  const sessions = new Set(lines.map(line => {
    const saved = order.items?.find(item => item.itemId === line.itemId) as
      | (OrderLine & { mealPeriod?: MealPeriod | null }) | undefined;
    const fromSnapshot = saved?.mealPeriod;
    if (fromSnapshot === 'MORNING' || fromSnapshot === 'EVENING') return fromSnapshot;
    return MENU_CATALOG.find(item => item.id === line.itemId)?.mealPeriod;
  }));
  return sessions.size === 1 && (sessions.has('MORNING') || sessions.has('EVENING'))
    ? [...sessions][0]! as MealPeriod : 'UNCLASSIFIED';
}

export function projectKitchenBoard(
  orders: readonly Order[], date: string, filter: KitchenFilter,
): KitchenBoardView {
  const active = orders.filter(order => order.deliveryDate === date &&
    order.paymentStatus === 'PAID' && activeStatuses.has(order.fulfillmentStatus) &&
    (filter === 'ALL' || kitchenOrderSession(order) === filter));
  const toPrepare = new Map<string, KitchenItemTotal>();
  let incomplete = 0;
  for (const order of active.filter(o => o.fulfillmentStatus !== 'OUT_FOR_DELIVERY')) {
    const lines = kitchenLines(order);
    if (!lines.length || (order.items?.length && lines.length !== order.items.length)) incomplete++;
    for (const line of lines) {
      const prior = toPrepare.get(line.key);
      toPrepare.set(line.key, {
        ...line, quantity: (prior?.quantity ?? 0) + line.quantity,
        orders: (prior?.orders ?? 0) + 1,
      });
    }
  }
  return {
    orders: active.slice().sort((a, b) =>
      (a.deliveryWindow || '').localeCompare(b.deliveryWindow || '') ||
      (a.createdAtUtc || '').localeCompare(b.createdAtUtc || '') ||
      a.id.localeCompare(b.id)),
    toPrepare: [...toPrepare.values()].sort((a, b) => a.nameEn.localeCompare(b.nameEn)),
    received: active.filter(o => o.fulfillmentStatus === 'RECEIVED').length,
    preparing: active.filter(o => o.fulfillmentStatus === 'PREPARING').length,
    outForDelivery: active.filter(o => o.fulfillmentStatus === 'OUT_FOR_DELIVERY').length,
    unclassified: active.filter(o => kitchenOrderSession(o) === 'UNCLASSIFIED').length,
    incomplete,
  };
}

export function kitchenUnitText(line: KitchenLine, te: boolean): string {
  const unit = line.saleUnit === 'PLATE'
    ? (te ? 'ప్లేట్లు' : 'plates') : line.saleUnit === 'PACK'
      ? (te ? 'ప్యాక్‌లు' : 'packs') : (te ? 'ముక్కలు' : 'pieces');
  const physicalPieces = line.saleUnit === 'PLATE' && line.piecesPerUnit
    ? ' (' + (line.quantity * line.piecesPerUnit) + (te ? ' ముక్కలు' : ' pieces') + ')' : '';
  return line.quantity + ' ' + unit + physicalPieces;
}
