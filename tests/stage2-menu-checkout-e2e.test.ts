import 'express-async-errors';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createClient, type Client } from '@libsql/client';
import { DB_SCHEMA } from '../server/db/schema.ts';
import { INACTIVE_CHECKOUT_IDEMPOTENCY_TEST_SCHEMA } from '../server/services/inactiveNewMenuIdempotencyService.ts';
import { createInactiveNewMenuStage2Router } from '../server/routes/inactiveNewMenuStage2Routes.ts';
import { createInactiveMenuCheckoutSession } from '../src/utils/inactiveMenuCheckout.ts';
import { createExpressApp } from '../server/app.ts';
import { NEW_MENU_LAUNCH_ENABLED } from '../shared/menuCatalog.ts';

const shared = vi.hoisted(() => ({ db: null as Client | null }));
vi.mock('../server/db/index.ts', () => ({ getDb: () => shared.db!, withDbRetry: (work: () => unknown) => work() }));
const credentials = { keyId: 'rzp_test_stage2fixture', keySecret: 'isolated-test-only' };
const gatewayId = 'order_STAGE2FIXTURE';
const paymentId = 'pay_STAGE2FIXTURE';
const request = { lines: [{ itemId: 'idly', quantity: 4 }], customer: {
  name: 'Fixture Customer', mobile: '9000000001', address: 'Fixture Kollur address', latitude: 17.485, longitude: 78.235,
} };
let db: Client;
let now: Date;
let captured: boolean;
let gatewayCalls: number;
const transport = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
  if (init?.method === 'POST') {
    gatewayCalls++;
    const body = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ id: gatewayId, receipt: body.receipt, amount: body.amount,
      amount_due: body.amount, amount_paid: 0, currency: 'INR', status: 'created' }));
  }
  return new Response(JSON.stringify({ id: paymentId, order_id: gatewayId, amount: 12000,
    currency: 'INR', status: captured ? 'captured' : 'authorized', captured }));
}) as unknown as typeof fetch;
async function http(app: express.Express, work: (base: string) => Promise<void>) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  try { await work('http://127.0.0.1:' + (server.address() as AddressInfo).port); }
  finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}
const post = (base: string, action: string, body: unknown, headers = { 'content-type': 'application/json', 'x-menu-checkout': '1' }) => fetch(base + '/api/menu/checkout/' + action, { method: 'POST', headers, body: JSON.stringify(body) });
function app() {
  const app = createExpressApp();
  // Production app is intentionally immutable. Test-only router mounts first.
  const harness = express(); harness.use(express.json());
  harness.use('/api/menu/checkout', createInactiveNewMenuStage2Router({ db, idempotencySecret: Buffer.alloc(32, 3), credentials, gatewayOrderTransport: transport, capturedPaymentTransport: transport, now: () => now }));
  harness.use(app); return harness;
}
beforeEach(async () => {
  db = createClient({ url: ':memory:' }); shared.db = db;
  for (const sql of DB_SCHEMA.split(';').map(s => s.trim()).filter(Boolean)) await db.execute(sql);
  await db.execute(INACTIVE_CHECKOUT_IDEMPOTENCY_TEST_SCHEMA);
  now = new Date(); captured = true; gatewayCalls = 0;
});
afterEach(() => { db.close(); shared.db = null; vi.unstubAllEnvs(); });

describe('Stage 2 isolated customer -> HTTP -> payment -> tracking integration', () => {
  it('keeps the actual app disabled, even in test, without DB/provider access', async () => {
    expect(NEW_MENU_LAUNCH_ENABLED).toBe(false);
    shared.db = null;
    await http(createExpressApp(), async base => {
      for (const action of ['prepare', 'gateway', 'confirm']) expect((await post(base, action, {})).status).toBe(404);
    });
    expect(gatewayCalls).toBe(0);
  });
  it('fails closed in production even with injected dependencies', async () => {
    const harness = app(); vi.stubEnv('NODE_ENV', 'production');
    await http(harness, async base => expect((await post(base, 'prepare', { requestKey: crypto.randomUUID(), request })).status).toBe(404));
    expect(gatewayCalls).toBe(0);
  });
  it('runs the frontend driver through real HTTP, confirms once, tracks privately and protects owner API', async () => {
    await http(app(), async base => {
      const pay = vi.fn(async () => ({ providerPaymentId: paymentId, providerSignature: crypto.createHmac('sha256', credentials.keySecret).update(gatewayId + '|' + paymentId).digest('hex') }));
      const browserFetch = ((path: string, init: RequestInit) => fetch(base + path, init)) as typeof fetch;
      const session = createInactiveMenuCheckoutSession(request, pay, browserFetch);
      captured = false;
      await expect(session.run()).rejects.toThrow('not confirmed');
      captured = true;
      const result = await session.run();
      expect(result.status).toBe('CONFIRMED');
      expect((await session.run()).status).toBe('CONFIRMED');
      expect(pay).toHaveBeenCalledTimes(1); expect(gatewayCalls).toBe(1);
      expect(Number((await db.execute('SELECT COUNT(*) n FROM orders')).rows[0]?.n)).toBe(1);
      expect(Number((await db.execute("SELECT COUNT(*) n FROM payments WHERE status='SUCCESS'")).rows[0]?.n)).toBe(1);
      const tracked = await fetch(base + '/api/customer/' + result.customerAccessToken);
      expect(tracked.status).toBe(200); expect(tracked.headers.get('cache-control')).toBe('no-store');
      const order = (await tracked.json()).order;
      expect(order.items).toMatchObject([{ itemId: 'idly', quantity: 4, lineTotalPaisa: 12000 }]);
      expect(order.paymentStatus).toBe('PAID');
      expect(order.public_token_hash).toBeUndefined(); expect(order.providerSignature).toBeUndefined();
      expect((await fetch(base + '/api/customer/' + 'a'.repeat(64))).status).toBe(404);
      expect((await fetch(base + '/api/customer/' + result.orderId)).status).toBe(404);
      expect((await fetch(base + '/api/admin/orders')).status).toBe(401);
      const ownerToken = crypto.randomBytes(32).toString('hex');
      await db.execute({ sql: "INSERT INTO admin_users VALUES ('owner','owner','fixture','ADMIN','Owner',?)", args: [now.toISOString()] });
      await db.execute({ sql: 'INSERT INTO admin_sessions (id,session_token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?,?)',
        args: ['session', crypto.createHash('sha256').update(ownerToken).digest('hex'), 'owner', new Date(Date.now()+60000).toISOString(), now.toISOString()] });
      const ownerResponse = await fetch(base + '/api/admin/orders', { headers: { cookie: 'admin_session=' + ownerToken } });
      expect(ownerResponse.status).toBe(200);
      expect((await ownerResponse.json()).orders[0].items).toEqual(order.items);
    });
  });
  it('keeps late captured payments under review without confirming stock or issuing a ticket', async () => {
    await http(app(), async base => {
      const { checkout: result } = await (await post(base, 'prepare', { requestKey: crypto.randomUUID(), request })).json();
      const auth = { orderId: result.orderId, customerAccessToken: result.customerAccessToken };
      expect((await post(base, 'gateway', auth)).status).toBe(200);
      now = new Date(now.getTime() + 31 * 60_000);
      const response = await post(base, 'confirm', { ...auth, providerPaymentId: paymentId,
        providerSignature: crypto.createHmac('sha256', credentials.keySecret).update(gatewayId + '|' + paymentId).digest('hex') });
      expect(response.status).toBe(200);
      expect((await response.json()).settlement.status).toBe('REVIEW_REQUIRED');
      const row = (await db.execute('SELECT payment_status,ticket_text FROM orders')).rows[0];
      expect(row?.payment_status).toBe('PENDING'); expect(row?.ticket_text).toBeFalsy();
      expect(Number((await db.execute("SELECT COUNT(*) n FROM menu_stock_reservations WHERE status='CONFIRMED'")).rows[0]?.n)).toBe(0);
    });
  });
  it('replays lost prepare responses and rejects changed payload, forged tokens and simple requests', async () => {
    await http(app(), async base => {
      const body = { requestKey: crypto.randomUUID(), request };
      const { checkout: first } = await (await post(base, 'prepare', body)).json();
      const { checkout: replay } = await (await post(base, 'prepare', body)).json();
      expect(replay.orderId).toBe(first.orderId); expect(replay.customerAccessToken).toBe(first.customerAccessToken);
      expect((await post(base, 'prepare', { ...body, request: { ...request, lines: [{ itemId: 'idly', quantity: 5 }] } })).status).toBe(409);
      expect((await post(base, 'gateway', { orderId: first.orderId, customerAccessToken: 'a'.repeat(64) })).status).toBe(409);
      expect((await post(base, 'prepare', body, { 'content-type': 'application/json' } as never)).status).toBe(403);
      expect(gatewayCalls).toBe(0);
    });
  });
});
