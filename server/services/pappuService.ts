import type { Client, Transaction } from '@libsql/client';
import { PAPPU_VARIETIES, pappuForDate, type PappuVariety } from '../../shared/pappu.ts';
import type { NewMenuPricing } from './newMenuCheckoutService.ts';
export async function resolvePappu(db: Client | Transaction, date: string): Promise<PappuVariety | null> {
  const normal = pappuForDate(date);
  if (!normal) return null;
  const result = await db.execute({ sql: 'SELECT variety FROM menu_pappu_overrides WHERE delivery_date=?', args: [date] });
  const override = result.rows[0]?.variety;
  if (override !== undefined && !(String(override) in PAPPU_VARIETIES)) throw new Error('Invalid saved pappu variety');
  return override ? override as PappuVariety : normal;
}
export async function applyPappuSnapshot(db: Client | Transaction, pricing: NewMenuPricing, expected?: string): Promise<PappuVariety | null> {
  const line = pricing.items.find(line => line.item.id === 'pappu-of-the-day');
  if (!line) return null;
  const variety = await resolvePappu(db, pricing.deliveryDateIst);
  if (!variety) throw new Error('Wednesday is closed');
  if (expected !== undefined && expected !== pricing.deliveryDateIst + ':' + variety) throw new Error('Pappu or delivery date changed. Review a fresh quote before payment.');
  line.item = { ...line.item, ...PAPPU_VARIETIES[variety] };
  return variety;
}
