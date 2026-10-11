import { createClient, type Client } from '@libsql/client';
import { describe, expect, it, vi } from 'vitest';
import { DB_SCHEMA } from '../server/db/schema.ts';
import { createPendingNewMenuCheckout } from '../server/services/newMenuCheckoutService.ts';
import { createInactiveNewMenuGatewayOrder } from '../server/services/inactiveNewMenuGatewayOrderService.ts';
import { getMenuStockRemaining } from '../server/services/menuStockService.ts';
import { NEW_MENU_LAUNCH_ENABLED } from '../shared/menuCatalog.ts';

const placedAt = new Date('2026-10-10T00:30:00.000Z');
const now = placedAt.getTime() + 1000;
const credentials = { keyId: 'rzp_test_fixture123', keySecret: 'fixture-secret-not-real' };
const customer = {
  name: 'Test Customer', mobile: '9000000001', address: 'Fixture flat, Kollur',
  latitude: 17.485, longitude: 78.235,
};
const request = { customer, lines: [{ itemId: 'idly', quantity: 4 }] };
const providerOrderId = 'order_TEST123456789';

async function setup() {
  const db = createClient({ url: ':memory:' });
  for (const sql of DB_SCHEMA.split(';').map(s => s.trim()).filter(Boolean)) {
    await db.execute(sql);
  }
  const pending = await createPendingNewMenuCheckout(db, request, placedAt);
  return { db, pending };
}

function gatewayMock(status = 200, overrides: Record<string, unknown> = {}) {
  const spy = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method !== 'POST') {
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => ({ id: providerOrderId, amount: 12000, currency: 'INR',
          status: 'created', amount_paid: 0, amount_due: 12000, ...overrides }),
      };
    }
    const payload = JSON.parse(String(init?.body || '{}'));
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => ({
        id: providerOrderId, receipt: payload.receipt, amount: payload.amount,
        currency: 'INR', status: 'created', amount_paid: 0, amount_due: payload.amount,
        ...overrides,
      }),
    };
  });
  return { spy, transport: spy as unknown as typeof fetch };
}

describe('inactive new menu Razorpay gateway order integration — mocked test mode', () => {
  it('keeps live launch disabled and rejects live Razorpay keys before API calls', async () => {
    const { db, pending } = await setup();
    try {
      expect(NEW_MENU_LAUNCH_ENABLED).toBe(false);
      const gateway = gatewayMock();
      await expect(createInactiveNewMenuGatewayOrder(db, pending.orderId,
        { keyId: 'rzp_live_123', keySecret: credentials.keySecret }, gateway.transport, now))
        .rejects.toThrow('test credentials');
      expect(gateway.spy).not.toHaveBeenCalled();
      expect((await db.execute({ sql: 'SELECT provider_payment_id FROM orders WHERE id=?',
        args: [pending.orderId] })).rows[0]?.provider_payment_id).toBe('AWAITING_PAYMENT');
    } finally { db.close(); }
  });

  it('creates one gateway order from saved authoritative total and binds payment intent', async () => {
    const { db, pending } = await setup();
    try {
      const gateway = gatewayMock();
      const initial = await createInactiveNewMenuGatewayOrder(db, pending.orderId,
        credentials, gateway.transport, now);
      expect(initial).toMatchObject({
        orderId: pending.orderId, providerOrderId,
        publicKeyId: credentials.keyId, amountPaisa: 12000,
        currency: 'INR', idempotent: false,
        expiresAtMs: pending.expiresAtMs,
      });
      expect(gateway.spy).toHaveBeenCalledTimes(1);
      const [url, init] = gateway.spy.mock.calls[0]!;
      expect(url).toBe('https://api.razorpay.com/v1/orders');
      expect(init?.method).toBe('POST');
      const payload = JSON.parse(String(init?.body));
      expect(payload).toEqual({ amount: 12000, currency: 'INR', receipt: expect.any(String) });
      expect(payload.receipt.length).toBeLessThanOrEqual(40);
      expect(JSON.stringify(payload)).not.toContain(customer.mobile);
      expect(JSON.stringify(payload)).not.toContain(customer.name);
      const order = (await db.execute({sql:'SELECT provider_order_id,payment_status FROM orders WHERE id=?',
        args:[pending.orderId]})).rows[0];
      expect(order).toMatchObject({provider_order_id: providerOrderId, payment_status:'PENDING'});
      const intent = (await db.execute({sql:'SELECT provider_order_id,amount_paisa,currency FROM payment_intents WHERE order_id=?',
        args:[pending.orderId]})).rows[0];
      expect(intent).toMatchObject({provider_order_id:providerOrderId,amount_paisa:12000,currency:'INR'});
      expect((await db.execute('SELECT COUNT(*) as total FROM payments')).rows[0]?.total).toBe(0);

      const repeat = await createInactiveNewMenuGatewayOrder(db, pending.orderId,
        credentials, gateway.transport, now+1000);
      expect(repeat).toMatchObject({ providerOrderId, idempotent: true, amountPaisa: 12000 });
      expect(gateway.spy).toHaveBeenCalledTimes(2);
      expect(gateway.spy.mock.calls[1]?.[0]).toBe('https://api.razorpay.com/v1/orders/' + providerOrderId);
    } finally { db.close(); }
  });

  it('prevents concurrent gateway POSTs even when two callers start together', async () => {
    const { db, pending } = await setup();
    try {
      const gate = gatewayMock();
      const [a, b] = await Promise.allSettled([
        createInactiveNewMenuGatewayOrder(db, pending.orderId, credentials, gate.transport, now),
        createInactiveNewMenuGatewayOrder(db, pending.orderId, credentials, gate.transport, now),
      ]);
      expect(gate.spy.mock.calls.filter((call) => call[1]?.method === 'POST')).toHaveLength(1);
      expect([a, b].filter(x => x.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
      expect((await db.execute('SELECT COUNT(*) AS total FROM payment_intents')).rows[0]?.total).toBe(1);
      expect((await db.execute('SELECT COUNT(*) AS total FROM payments')).rows[0]?.total).toBe(0);
    } finally { db.close(); }
  });

  it('releases held inventory on definitive gateway 422 rejection with no order payment', async () => {
    const { db, pending } = await setup();
    try {
      const gate = gatewayMock(422);
      await expect(createInactiveNewMenuGatewayOrder(db, pending.orderId,
        credentials, gate.transport, now)).rejects.toThrow('holds released');
      expect(gate.spy).toHaveBeenCalledTimes(1);
      expect((await db.execute({sql:'SELECT payment_status FROM orders WHERE id=?',
        args:[pending.orderId]})).rows[0]?.payment_status).toBe('FAILED');
      expect((await db.execute({sql:'SELECT status FROM menu_stock_reservations WHERE order_id=?',
        args:[pending.orderId]})).rows[0]?.status).toBe('RELEASED');
      expect(await getMenuStockRemaining(db, 'idly', '2026-10-10', now)).toBe(30);
      expect((await db.execute('SELECT COUNT(*) AS total FROM payment_intents')).rows[0]?.total).toBe(0);
      expect((await db.execute('SELECT COUNT(*) AS total FROM orders')).rows[0]?.total).toBe(1);
    } finally { db.close(); }
  });

  it('keeps uncertain network outcomes in pending review and never retries gateway blindly', async () => {
    const { db, pending } = await setup();
    try {
      const spy = vi.fn(async () => { throw new Error('synthetic-timeout'); });
      const transport = spy as unknown as typeof fetch;
      await expect(createInactiveNewMenuGatewayOrder(db, pending.orderId,
        credentials, transport, now)).rejects.toThrow('manual reconciliation');
      expect((await db.execute({sql:'SELECT provider_payment_id,payment_status FROM orders WHERE id=?',
        args:[pending.orderId]})).rows[0]).toMatchObject({
          provider_payment_id:'MENU_GATEWAY_STARTING',payment_status:'PENDING',
        });
      expect(await getMenuStockRemaining(db,'idly','2026-10-10',now)).toBe(26);
      await expect(createInactiveNewMenuGatewayOrder(db, pending.orderId,
        credentials, transport, now+1000)).rejects.toThrow('manual reconciliation');
      expect(spy).toHaveBeenCalledTimes(1);
    } finally { db.close(); }
  });

  it('rejects inconsistent gateway amount and preserves order for manual reconciliation', async () => {
    const { db, pending } = await setup();
    try {
      const gate = gatewayMock(200, { amount: 1 });
      await expect(createInactiveNewMenuGatewayOrder(db,pending.orderId,
        credentials,gate.transport,now)).rejects.toThrow('manual reconciliation');
      expect((await db.execute({sql:'SELECT provider_order_id,payment_status FROM orders WHERE id=?',
        args:[pending.orderId]})).rows[0]).toMatchObject({provider_order_id:null,payment_status:'PENDING'});
      expect((await db.execute('SELECT COUNT(*) AS total FROM payment_intents')).rows[0]?.total).toBe(0);
      await expect(createInactiveNewMenuGatewayOrder(db,pending.orderId,
        credentials,gate.transport,now+1000)).rejects.toThrow('manual reconciliation');
      expect(gate.spy).toHaveBeenCalledTimes(1);
    } finally { db.close(); }
  });

  it('rejects corrupted saved prices and expired holds without contacting the provider', async () => {
    const { db, pending } = await setup();
    try {
      const gate = gatewayMock();
      await db.execute({sql:'UPDATE orders SET total_amount_paisa=1 WHERE id=?',args:[pending.orderId]});
      await expect(createInactiveNewMenuGatewayOrder(db, pending.orderId,
        credentials, gate.transport, now)).rejects.toThrow('saved order amount');
      await db.execute({sql:'UPDATE orders SET total_amount_paisa=12000 WHERE id=?',args:[pending.orderId]});
      await db.execute({sql:"UPDATE menu_stock_reservations SET status='EXPIRED' WHERE order_id=?",
        args:[pending.orderId]});
      await expect(createInactiveNewMenuGatewayOrder(db, pending.orderId,
        credentials, gate.transport, now)).rejects.toThrow('inventory reservation');
      expect(gate.spy).not.toHaveBeenCalled();
    } finally { db.close(); }
  });
});
