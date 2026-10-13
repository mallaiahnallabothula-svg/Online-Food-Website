import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../server/db/index.ts', async () => {
  const { createClient } = await import('@libsql/client');
  const { DB_SCHEMA } = await import('../server/db/schema.ts');
  const db = createClient({ url: ':memory:' });
  return {
    getDb: () => db,
    initDb: async () => {
      for (const sql of DB_SCHEMA.split(';').map(s => s.trim()).filter(Boolean)) {
        await db.execute(sql);
      }
    },
  };
});

import { getDb, initDb } from '../server/db/index.ts';
import { getAuthoritativeAnalytics } from '../server/services/analyticsService.ts';

async function createOrder(placedUtc: string, paymentStatus: 'PAID' | 'PENDING') {
  const id = 'TEST-' + crypto.randomUUID();
  await getDb().execute({
    sql: `INSERT INTO orders (
      id,public_token_hash,created_at_utc,created_at_ist,delivery_date,delivery_window,
      total_items,jowar_unit_price_paisa,chapathi_unit_price_paisa,
      subtotal_paisa,delivery_charge_paisa,total_amount_paisa,payment_status,order_status,
      payment_provider,provider_payment_id,fulfillment_status,customer_name,customer_mobile,
      address,distance_km,created_by,updated_at,updated_by
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [id, 'hash-' + crypto.randomUUID(), placedUtc, placedUtc, '2026-10-14', '18:00-20:00',
      4, 3000, 1000, 12000, 0, 12000, paymentStatus, 'PENDING',
      'mock', 'not-set', 'RECEIVED', 'Fixture', '9000000001', 'Fixture address',
      1, 'TEST', placedUtc, 'TEST'],
  });
}

beforeAll(async () => {
  await initDb();
  // Midnight IST, noon IST, evening IST and an early-morning next-day order.
  await createOrder('2026-10-13T18:30:00.000Z', 'PAID'); // 00:00 IST
  await createOrder('2026-10-13T06:30:00.000Z', 'PAID'); // 12:00 IST
  await createOrder('2026-10-13T13:15:00.000Z', 'PAID'); // 18:45 IST
  await createOrder('2026-10-13T23:59:00.000Z', 'PAID'); // 05:29 IST
  await createOrder('2026-10-13T18:30:00.000Z', 'PENDING'); // must NOT inflate chart
});
afterAll(() => { getDb().close(); });

describe('P2 analytics accuracy — paid placement hours in IST', () => {
  it('accounts for every IST hour and paid orders outside legacy 11–4 window', async () => {
    const data = await getAuthoritativeAnalytics();
    const hours = data.hourlyOrderDistribution;
    expect(hours).toHaveLength(24);
    expect(hours[0]).toEqual({ hourSlot: '12:00 AM', count: 1 });
    expect(hours[5]).toEqual({ hourSlot: '5:00 AM', count: 1 });
    expect(hours[12]).toEqual({ hourSlot: '12:00 PM', count: 1 });
    expect(hours[18]).toEqual({ hourSlot: '6:00 PM', count: 1 });
    expect(hours.reduce((sum, hour) => sum + hour.count, 0)).toBe(4);
    expect(hours[11]).toEqual({ hourSlot: '11:00 AM', count: 0 });
    expect(hours[23]).toEqual({ hourSlot: '11:00 PM', count: 0 });
    expect(data.summary.totalOrders).toBe(4);
    expect(data.summary.totalRevenueRupees).toBe(480);
  });

  it('represents no customer reviews as zero, not a fictional five-star rating', async () => {
    const data = await getAuthoritativeAnalytics();
    expect(data.feedbackSummary).toMatchObject({ totalReviews: 0, averageRating: 0 });
  });
});
