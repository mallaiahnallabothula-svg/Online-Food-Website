import { createClient, type Client } from '@libsql/client';
import { describe, expect, it, vi } from 'vitest';
import { DB_SCHEMA } from '../server/db/schema.ts';
import { NEW_MENU_LAUNCH_ENABLED } from '../shared/menuCatalog.ts';
import {
  prepareInactiveNewMenuCheckout,
  startInactiveNewMenuCheckoutGateway,
} from '../server/services/inactiveNewMenuCheckoutOrchestrator.ts';
import { getMenuStockRemaining } from '../server/services/menuStockService.ts';
import type { NewMenuCheckoutRequest } from '../server/services/newMenuCheckoutService.ts';

const at = new Date('2026-10-10T00:30:00.000Z');
const now = at.getTime() + 1000;
const creds = { keyId: 'rzp_test_fixture123', keySecret: 'test-fixture-secret' };
const original: NewMenuCheckoutRequest = {
  customer: {
    name: 'Test Customer', mobile: '9000000001',
    address: 'Kollur test flat address', latitude: 17.485, longitude: 78.235,
  },
  lines: [{ itemId: 'idly', quantity: 2 }, { itemId: 'ragi-idly', quantity: 2 }],
};
const providerId = 'order_TEST123456789';

async function fixture(): Promise<Client> {
  const db = createClient({ url: ':memory:' });
  for (const statement of DB_SCHEMA.split(';').map(s => s.trim()).filter(Boolean)) {
    await db.execute(statement);
  }
  return db;
}

function gateway(status = 200, overrides: Record<string, unknown> = {}) {
  const send = vi.fn(async (_url: string, options?: RequestInit) => {
    if (options?.method !== 'POST') {
      return {
        status, ok: status >= 200 && status < 300,
        json: async () => ({ id: providerId, amount: 14000, amount_due: 14000,
          amount_paid: 0, currency: 'INR', status: 'created', ...overrides }),
      };
    }
    const request = JSON.parse(String(options?.body ?? '{}'));
    return {
      status, ok: status >= 200 && status < 300,
      json: async () => ({
        id: providerId, amount: request.amount, amount_due: request.amount,
        amount_paid: 0, currency: 'INR', receipt: request.receipt, status: 'created',
        ...overrides,
      }),
    };
  });
  return { send, transport: send as unknown as typeof fetch };
}

async function count(db: Client, table: 'orders'|'order_items'|'menu_stock_reservations'|'payment_intents'|'payments') {
  return Number((await db.execute('SELECT COUNT(*) AS n FROM ' + table)).rows[0]?.n ?? 0);
}

describe('PR19 inactive backend checkout orchestration (in-memory DB, mocked gateway)', () => {
  it('keeps launch flag off and does not mount into production routes or legacy checkout', async () => {
    expect(NEW_MENU_LAUNCH_ENABLED).toBe(false);
    const fs = await import('node:fs');
    const paths = ['server/app.ts', 'src/App.tsx', 'server/payments/provider.ts'];
    for (const path of paths) {
      expect(fs.readFileSync(path, 'utf8')).not.toContain('inactiveNewMenuCheckoutOrchestrator');
    }
  });

  it('prepares exact server price and atomic stock holds without payment or API call', async () => {
    const db = await fixture();
    try {
      const order = await prepareInactiveNewMenuCheckout(db, original, at);
      expect(order.orderId).toMatch(/^MENU-[0-9a-f-]{36}$/);
      expect(order.customerAccessToken).toMatch(/^[0-9a-f]{64}$/);
      expect(order.pricing).toMatchObject({
        period: 'MORNING', subtotalPaisa: 14000, deliveryChargePaisa: 0,
        totalAmountPaisa: 14000, deliveryDateIst: '2026-10-10', deliveryWindow: '07:00-11:00',
      });
      expect(await count(db,'orders')).toBe(1);
      expect(await count(db,'order_items')).toBe(2);
      expect(await count(db,'menu_stock_reservations')).toBe(2);
      expect(await getMenuStockRemaining(db,'idly','2026-10-10',now)).toBe(28);
      expect(await count(db,'payment_intents')).toBe(0);
      expect(await count(db,'payments')).toBe(0);
      const saved = (await db.execute({
        sql:'SELECT public_token_hash, payment_status, total_amount_paisa, provider_order_id FROM orders WHERE id=?',
        args:[order.orderId],
      })).rows[0]!;
      expect(saved.public_token_hash).not.toBe(order.customerAccessToken);
      expect(saved).toMatchObject({payment_status:'PENDING',total_amount_paisa:14000,provider_order_id:null});
    } finally { db.close(); }
  });

  it('fails validation before inserting any rows for fake prices, mixed slots and out-of-range delivery', async () => {
    const db = await fixture();
    try {
      for (const bad of [
        { ...original, lines:[{itemId:'idly',quantity:1}] },
        { ...original, lines:[{itemId:'idly',quantity:4},{itemId:'pulka',quantity:1}] },
        { ...original, lines:[{itemId:'idly',quantity:4}], customer:{...original.customer,latitude:0,longitude:0} },
        { ...original, lines:[{itemId:'idly',quantity:4}], requestedDeliveryDateIst:'2026-10-11' },
      ]) {
        await expect(prepareInactiveNewMenuCheckout(db, bad, at)).rejects.toThrow();
      }
      expect(await count(db,'orders')).toBe(0);
      expect(await count(db,'order_items')).toBe(0);
      expect(await count(db,'menu_stock_reservations')).toBe(0);
    } finally { db.close(); }
  });

  it('rolls back snapshots and order when a reserved plate would oversell stock', async () => {
    const db = await fixture();
    try {
      const fill = await prepareInactiveNewMenuCheckout(db,
        {...original,lines:[{itemId:'idly',quantity:30}]},at);
      expect(fill.orderId).toMatch(/^MENU-/);
      await expect(prepareInactiveNewMenuCheckout(db,
        {...original,lines:[{itemId:'idly',quantity:1},{itemId:'ragi-idly',quantity:3}]},at))
        .rejects.toThrow('OUT_OF_STOCK');
      expect(await count(db,'orders')).toBe(1);
      expect(await count(db,'order_items')).toBe(1);
      expect(await count(db,'menu_stock_reservations')).toBe(1);
      expect(await getMenuStockRemaining(db,'idly','2026-10-10',now)).toBe(0);
    } finally { db.close(); }
  });

  it('requires correct access token and rejects live keys without contacting payment gateway', async () => {
    const db = await fixture();
    try {
      const prepared = await prepareInactiveNewMenuCheckout(db,original,at);
      const gate = gateway();
      await expect(startInactiveNewMenuCheckoutGateway(db,{
        orderId:prepared.orderId,customerAccessToken:'0'.repeat(64),
      },creds,gate.transport,now)).rejects.toThrow('authorization');
      await expect(startInactiveNewMenuCheckoutGateway(db,{
        orderId:prepared.orderId,customerAccessToken:prepared.customerAccessToken,
      },{keyId:'rzp_live_123',keySecret:creds.keySecret},gate.transport,now))
        .rejects.toThrow('test credentials');
      expect(gate.send).not.toHaveBeenCalled();
      expect(await count(db,'payment_intents')).toBe(0);
      expect((await db.execute({sql:'SELECT provider_payment_id FROM orders WHERE id=?',
        args:[prepared.orderId]})).rows[0]?.provider_payment_id).toBe('AWAITING_PAYMENT');
    } finally { db.close(); }
  });

  it('sends exact stored INR paise, saves one gateway intent, is idempotent on repeat', async () => {
    const db = await fixture();
    try {
      const prepared = await prepareInactiveNewMenuCheckout(db,original,at);
      const gate = gateway();
      const input = {orderId:prepared.orderId,customerAccessToken:prepared.customerAccessToken};
      const first = await startInactiveNewMenuCheckoutGateway(db,input,creds,gate.transport,now);
      expect(first).toMatchObject({
        orderId:prepared.orderId,providerOrderId:providerId,amountPaisa:14000,
        currency:'INR',idempotent:false,publicKeyId:creds.keyId,
      });
      expect(gate.send).toHaveBeenCalledTimes(1);
      const [url,options] = gate.send.mock.calls[0]!;
      expect(url).toBe('https://api.razorpay.com/v1/orders');
      const body=JSON.parse(String(options?.body));
      expect(body).toEqual({amount:14000,currency:'INR',receipt:expect.any(String)});
      expect(body.receipt.length).toBeLessThanOrEqual(40);
      expect(JSON.stringify(body)).not.toContain(original.customer.mobile);
      const again = await startInactiveNewMenuCheckoutGateway(db,input,creds,gate.transport,now+1000);
      expect(again).toMatchObject({providerOrderId:providerId,amountPaisa:14000,idempotent:true});
      expect(gate.send).toHaveBeenCalledTimes(2);
      expect(gate.send.mock.calls[1]?.[0]).toBe('https://api.razorpay.com/v1/orders/' + providerId);
      expect(await count(db,'payment_intents')).toBe(1);
      expect(await count(db,'payments')).toBe(0);
      expect((await db.execute({sql:'SELECT payment_status FROM orders WHERE id=?',
        args:[prepared.orderId]})).rows[0]?.payment_status).toBe('PENDING');
    } finally { db.close(); }
  });

  it('single provider POST when two authorized requests race for the same prepared order', async () => {
    const db = await fixture();
    try {
      const prepared=await prepareInactiveNewMenuCheckout(db,original,at);
      const gate=gateway();
      const input={orderId:prepared.orderId,customerAccessToken:prepared.customerAccessToken};
      const outcomes=await Promise.allSettled([
        startInactiveNewMenuCheckoutGateway(db,input,creds,gate.transport,now),
        startInactiveNewMenuCheckoutGateway(db,input,creds,gate.transport,now),
      ]);
      expect(gate.send.mock.calls.filter((call) => call[1]?.method === 'POST')).toHaveLength(1);
      expect(outcomes.some(x=>x.status==='fulfilled')).toBe(true);
      expect(await count(db,'payment_intents')).toBe(1);
    } finally {db.close();}
  });

  it('definitive Razorpay rejection rolls back unpaid stock hold and prevents retry on failed order', async () => {
    const db=await fixture();
    try {
      const prepared=await prepareInactiveNewMenuCheckout(db,original,at);
      const gate=gateway(422);
      const input={orderId:prepared.orderId,customerAccessToken:prepared.customerAccessToken};
      await expect(startInactiveNewMenuCheckoutGateway(db,input,creds,gate.transport,now))
        .rejects.toThrow('holds released');
      expect(await getMenuStockRemaining(db,'idly','2026-10-10',now)).toBe(30);
      expect(await count(db,'payment_intents')).toBe(0);
      expect(await count(db,'payments')).toBe(0);
      expect((await db.execute({sql:'SELECT payment_status FROM orders WHERE id=?',
        args:[prepared.orderId]})).rows[0]?.payment_status).toBe('FAILED');
      await expect(startInactiveNewMenuCheckoutGateway(db,input,creds,gate.transport,now+1000))
        .rejects.toThrow('Unpaid pending');
      expect(gate.send).toHaveBeenCalledTimes(1);
    } finally {db.close();}
  });

  it('ambiguous network failure blocks second POST, preserves pending order for reconciliation', async () => {
    const db=await fixture();
    try {
      const prepared=await prepareInactiveNewMenuCheckout(db,original,at);
      const spy=vi.fn(async()=>{throw new Error('mock timeout');});
      const transport=spy as unknown as typeof fetch;
      const input={orderId:prepared.orderId,customerAccessToken:prepared.customerAccessToken};
      await expect(startInactiveNewMenuCheckoutGateway(db,input,creds,transport,now))
        .rejects.toThrow('manual reconciliation');
      await expect(startInactiveNewMenuCheckoutGateway(db,input,creds,transport,now+1000))
        .rejects.toThrow('manual reconciliation');
      expect(spy).toHaveBeenCalledTimes(1);
      expect((await db.execute({sql:'SELECT payment_status,provider_payment_id FROM orders WHERE id=?',
        args:[prepared.orderId]})).rows[0]).toMatchObject({
        payment_status:'PENDING',provider_payment_id:'MENU_GATEWAY_STARTING',
      });
      expect(await getMenuStockRemaining(db,'idly','2026-10-10',now)).toBe(28);
      expect(await count(db,'payment_intents')).toBe(0);
      expect(await count(db,'payments')).toBe(0);
    } finally {db.close();}
  });

  it('mismatched gateway amount fails closed, never marks paid or silently retries', async () => {
    const db=await fixture();
    try {
      const prepared=await prepareInactiveNewMenuCheckout(db,original,at);
      const gate=gateway(200,{amount:100});
      const input={orderId:prepared.orderId,customerAccessToken:prepared.customerAccessToken};
      await expect(startInactiveNewMenuCheckoutGateway(db,input,creds,gate.transport,now))
        .rejects.toThrow('manual reconciliation');
      await expect(startInactiveNewMenuCheckoutGateway(db,input,creds,gate.transport,now+1000))
        .rejects.toThrow('manual reconciliation');
      expect(gate.send).toHaveBeenCalledTimes(1);
      expect(await count(db,'payment_intents')).toBe(0);
      expect(await count(db,'payments')).toBe(0);
      expect((await db.execute({sql:'SELECT payment_status FROM orders WHERE id=?',
        args:[prepared.orderId]})).rows[0]?.payment_status).toBe('PENDING');
    } finally {db.close();}
  });
});
