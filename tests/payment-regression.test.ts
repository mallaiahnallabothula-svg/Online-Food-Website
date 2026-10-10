import { describe, it, expect, beforeEach, afterAll, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

vi.mock('../server/db/index.ts', async () => {
  const { createClient } = await import('@libsql/client');
  const { DB_SCHEMA } = await import('../server/db/schema.ts');
  const database = createClient({ url: ':memory:' });
  return {
    getDb: () => database,
    initDb: async () => database.executeMultiple(DB_SCHEMA),
    withDbRetry: async (operation: () => Promise<unknown>) => operation(),
  };
});

import { createPaymentIntent, verifyPaymentIntent, getIntent } from '../server/payments/provider.ts';
import { getDb, initDb } from '../server/db/index.ts';
import {
  transitionOrderToTicketGenerated, getOrderStatus, getOrderByCustomerToken,
  formatCustomerSafeOrder, markOrderReceivedByCustomer, submitOrderFeedback,
} from '../server/services/orderService.ts';
import { paymentRouter } from '../server/routes/paymentRoutes.ts';
import { adminRouter } from '../server/routes/adminRoutes.ts';
import { loginAdmin } from '../server/auth/index.ts';
import { seedDevelopmentData } from '../server/db/seed.ts';

const checkout = {
  jowarQuantity: 5, chapathiQuantity: 5,
  karamSelection: { karivepaku: true, aviseGinjalu: false },
  customer: { name: 'Test Customer', mobile: '9000000001', address: 'Test delivery address', landmark: '', latitude: 17.4782, longitude: 78.2323 },
};
const gatewaySecret = 'fixture-gateway-secret';
const webhookSecret = 'fixture-webhook-secret';
async function post(payload: unknown, signature?: string) {
  const body = JSON.stringify(payload);
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    // Invoke the actual router without opening sockets or using a network.
    const request: any = { method: 'POST', url: '/webhook', body: payload, rawBody: Buffer.from(body), headers: {
      'content-type': 'application/json', ...(signature ? { 'x-razorpay-signature': signature } : {}),
    } };
    const response: any = {
      statusCode: 200,
      status(code: number) { this.statusCode = code; return this; },
      json(result: unknown) { resolve({ status: this.statusCode, body: result }); return this; },
    };
    paymentRouter(request, response, error => reject(error || new Error('Webhook did not send a response.')));
  });
}

async function realIntent() {
  vi.stubEnv('RAZORPAY_KEY_ID', 'fixture-key');
  vi.stubEnv('RAZORPAY_KEY_SECRET', gatewaySecret);
  const gatewayOrderId = 'order_' + crypto.randomBytes(8).toString('hex');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: gatewayOrderId }) }));
  return { intent: await createPaymentIntent(checkout), gatewayOrderId };
}

function event(intent: Awaited<ReturnType<typeof createPaymentIntent>>, gatewayOrderId: string, overrides = {}) {
  return { event: 'payment.captured', payload: { payment: { entity: {
    id: 'pay_' + crypto.randomBytes(8).toString('hex'), order_id: gatewayOrderId,
    amount: intent.amountPaisa, currency: 'INR', status: 'captured', captured: true, ...overrides,
  } } } };
}
const sign = (payload: unknown) => crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(payload)).digest('hex');

afterAll(() => { getDb().close(); });
beforeEach(async () => {
  vi.stubEnv('NODE_ENV', 'test');
  for (const key of ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'PAYMENT_PROVIDER']) vi.stubEnv(key, '');
  vi.stubEnv('RAZORPAY_WEBHOOK_SECRET', webhookSecret);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await initDb();
  await getDb().batch(['DELETE FROM admin_login_attempts', 'DELETE FROM admin_sessions', 'DELETE FROM admin_users', 'DELETE FROM payments', 'DELETE FROM feedback', 'DELETE FROM payment_intents', 'DELETE FROM audit_logs', 'DELETE FROM orders'], 'write');
});

describe('Customer receipt and saved reviews', () => {
  it('restores receipt and updated feedback from the database on customer lookup', async () => {
    const intent = await createPaymentIntent(checkout);
    await transitionOrderToTicketGenerated(intent.orderId, {
      provider: 'mock', providerPaymentId: 'pay_received_fixture', amountPaisa: intent.amountPaisa, currency: 'INR',
    });
    await expect(markOrderReceivedByCustomer(intent.customerAccessToken)).rejects.toThrow(/out for delivery/);
    await getDb().execute({ sql: "UPDATE orders SET fulfillment_status = 'OUT_FOR_DELIVERY' WHERE id = ?", args: [intent.orderId] });
    const receipt = await markOrderReceivedByCustomer(intent.customerAccessToken);
    const first = await submitOrderFeedback(intent.customerAccessToken, 4, 'Good food');
    const updated = await submitOrderFeedback(intent.customerAccessToken, 5, 'Excellent food');
    expect(updated.feedbackId).toBe(first.feedbackId);
    expect(updated.updated).toBe(true);

    const restored = formatCustomerSafeOrder((await getOrderByCustomerToken(intent.customerAccessToken))!);
    expect(restored.fulfillmentStatus).toBe('DELIVERED');
    expect(restored.receivedAt).toBe(receipt.markedReceivedAt);
    expect(restored.feedback).toMatchObject({
      id: first.feedbackId, orderId: intent.orderId,
      customerName: checkout.customer.name, rating: 5, comment: 'Excellent food',
    });
    expect(restored.feedback!.createdAt).toBeTruthy();
    expect((await getOrderStatus(intent.customerAccessToken))!.order!.feedback).toEqual(restored.feedback);
    expect(await getOrderByCustomerToken(intent.orderId)).toBeNull();
    await expect(submitOrderFeedback(intent.orderId, 1, 'Unauthorized')).rejects.toThrow(/unauthorized/);
    expect((await getDb().execute('SELECT id FROM feedback')).rows).toHaveLength(1);
  });

  it('keeps reviews private without opt-in and resets approval when edited', async () => {
    const intent = await createPaymentIntent(checkout);
    await transitionOrderToTicketGenerated(intent.orderId, {
      provider: 'mock', providerPaymentId: 'pay_privacy_fixture', amountPaisa: intent.amountPaisa, currency: 'INR',
    });
    const first = await submitOrderFeedback(intent.customerAccessToken, 4, 'Private review');
    let review = (await getDb().execute({ sql: 'SELECT is_public, publication_consent FROM feedback WHERE id = ?', args: [first.feedbackId] })).rows[0]!;
    expect(Number(review.is_public)).toBe(0);
    expect(Number(review.publication_consent)).toBe(0);

    await submitOrderFeedback(intent.customerAccessToken, 5, 'Consented review', true);
    review = (await getDb().execute({ sql: 'SELECT is_public, publication_consent FROM feedback WHERE id = ?', args: [first.feedbackId] })).rows[0]!;
    expect(Number(review.is_public)).toBe(0);
    expect(Number(review.publication_consent)).toBe(1);
    await getDb().execute({ sql: 'UPDATE feedback SET is_public = 1 WHERE id = ?', args: [first.feedbackId] });
    await submitOrderFeedback(intent.customerAccessToken, 3, 'Changed review', true);
    review = (await getDb().execute({ sql: 'SELECT is_public, publication_consent FROM feedback WHERE id = ?', args: [first.feedbackId] })).rows[0]!;
    expect(Number(review.is_public)).toBe(0);
    expect(Number(review.publication_consent)).toBe(1);
    await submitOrderFeedback(intent.customerAccessToken, 2, 'Revoked consent', false);
    review = (await getDb().execute({ sql: 'SELECT is_public, publication_consent FROM feedback WHERE id = ?', args: [first.feedbackId] })).rows[0]!;
    expect(Number(review.is_public)).toBe(0);
    expect(Number(review.publication_consent)).toBe(0);
  });

});

describe('Persistent serverless owner login limits', () => {
  it('locks the account after five bad passwords, rejects valid password while locked and resets expired counters', async () => {
    const username = 'owner-limit';
    const goodPassword = 'test-correct-password';
    await getDb().execute({
      sql: 'INSERT INTO admin_users (id, username, password_hash, role, name, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: ['USR-limit', username, await bcrypt.hash(goodPassword, 4), 'ADMIN', 'Owner', new Date().toISOString()],
    });
    for (let attempt = 0; attempt < 5; attempt++) {
      expect((await loginAdmin(username, 'wrong-password', '127.0.0.50')).success).toBe(false);
    }
    const locked = await loginAdmin(username, goodPassword, '127.0.0.51');
    expect(locked.success).toBe(false);
    expect(locked.lockedUntil).toBeGreaterThan(Date.now());
    const saved = await getDb().execute('SELECT failed_count FROM admin_login_attempts');
    expect(saved.rows.length).toBeGreaterThan(0);
    await getDb().execute({ sql: 'UPDATE admin_login_attempts SET window_expires_at_ms = 0, locked_until_ms = 0', args: [] });
    const allowed = await loginAdmin(username, goodPassword, '127.0.0.51');
    expect(allowed.success).toBe(true);
    const accountKey = crypto.createHash('sha256').update('user:' + username).digest('hex');
    const account = await getDb().execute({ sql: 'SELECT * FROM admin_login_attempts WHERE key_hash = ?', args: [accountKey] });
    expect(account.rows).toHaveLength(0);
  });

  it('locks an IP across unknown usernames and records only hashed keys', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      expect((await loginAdmin('not-a-user-' + attempt, 'bad-password', '127.0.0.60')).success).toBe(false);
    }
    const locked = await loginAdmin('another-account', 'bad-password', '127.0.0.60');
    expect(locked.lockedUntil).toBeGreaterThan(Date.now());
    const rows = (await getDb().execute('SELECT key_hash FROM admin_login_attempts')).rows;
    expect(rows.every(row => /^[a-f0-9]{64}$/.test(String(row.key_hash)))).toBe(true);
  });
});

describe('Administrator access and exact order amounts', () => {
  it('normalizes login username and preserves decimal amounts in the protected order list', async () => {
    const fixturePassword = 'Local-test-password-only';
    await getDb().execute({
      sql: 'INSERT INTO admin_users (id, username, password_hash, role, name, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: ['USR-fixture', 'admin', await bcrypt.hash(fixturePassword, 4), 'ADMIN', 'Test administrator', new Date().toISOString()],
    });
    const login = await loginAdmin('  AdMiN  ', fixturePassword, '127.0.0.1');
    expect(login.success).toBe(true);
    expect(login.user!.username).toBe('admin');
    const intent = await createPaymentIntent(checkout);
    await getDb().execute({
      sql: 'UPDATE orders SET jowar_unit_price_paisa = ?, chapathi_unit_price_paisa = ?, subtotal_paisa = ?, delivery_charge_paisa = ?, total_amount_paisa = ? WHERE id = ?',
      args: [3033, 1011, 8088, 1507, 9595, intent.orderId],
    });
    const result = await new Promise<{ status: number; body: any }>((resolve, reject) => {
      const request: any = { method: 'GET', url: '/orders', headers: {}, query: {}, cookies: { admin_session: login.sessionCookie } };
      const response: any = {
        statusCode: 200,
        status(code: number) { this.statusCode = code; return this; },
        json(body: unknown) { resolve({ status: this.statusCode, body }); return this; },
      };
      adminRouter(request, response, error => reject(error || new Error('Order list did not send a response.')));
    });
    expect(result.status).toBe(200);
    expect(result.body.orders).toHaveLength(1);
    expect(result.body.orders[0]).toMatchObject({ jowarUnitPrice: 30.33, chapathiUnitPrice: 10.11, subtotal: 80.88, deliveryCharge: 15.07, totalAmount: 95.95 });
  });
});

describe('Owner order-status backend safety', () => {
  async function statusRequest(orderId: string, status: string, sessionToken: string) {
    return new Promise<{ status: number; body: any }>((resolve, reject) => {
      const request: any = {
        method: 'PATCH',
        url: `/orders/${orderId}/status`,
        params: { id: orderId }, body: { status }, headers: { 'x-requested-with': 'XMLHttpRequest' },
        cookies: { admin_session: sessionToken }, ip: '127.0.0.1',
      };
      const response: any = {
        statusCode: 200,
        status(code: number) { this.statusCode = code; return this; },
        json(body: any) { resolve({ status: this.statusCode, body }); return this; },
      };
      adminRouter(request, response, error => reject(error || new Error('Status request did not send a response.')));
    });
  }

  it('rejects unpaid fulfillment, invalid jumps and terminal changes; preserves cancellation and audit integrity', async () => {
    const password = 'Only-for-test-admin-password';
    await getDb().execute({
      sql: 'INSERT INTO admin_users (id, username, password_hash, role, name, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: ['USR-status', 'admin', await bcrypt.hash(password, 4), 'ADMIN', 'Test admin', new Date().toISOString()],
    });
    const login = await loginAdmin('admin', password, '127.0.0.1');
    expect(login.success).toBe(true);
    const session = login.sessionCookie!;
    const first = await createPaymentIntent(checkout);
    const second = await createPaymentIntent(checkout);
    const auditCount = async () => Number((await getDb().execute("SELECT COUNT(*) as total FROM audit_logs WHERE action = 'ORDER_STATUS_UPDATED'")).rows[0]?.total ?? 0);
    const baseline = await auditCount();

    expect((await statusRequest(first.orderId, 'PREPARING', session)).status).toBe(409);
    expect((await statusRequest(first.orderId, 'DELIVERED', session)).status).toBe(409);
    expect((await getDb().execute({ sql: 'SELECT fulfillment_status FROM orders WHERE id = ?', args: [first.orderId] })).rows[0]?.fulfillment_status).toBe('RECEIVED');
    expect(await auditCount()).toBe(baseline);

    const cancelled = await statusRequest(second.orderId, 'CANCELLED', session);
    expect(cancelled.status).toBe(200);
    expect((await statusRequest(second.orderId, 'PREPARING', session)).status).toBe(409);

    await transitionOrderToTicketGenerated(first.orderId, {
      provider: 'mock', providerPaymentId: 'pay_status_fixture', amountPaisa: first.amountPaisa, currency: 'INR',
    });
    expect((await statusRequest(first.orderId, 'DELIVERED', session)).status).toBe(409);
    for (const next of ['PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED']) {
      const result = await statusRequest(first.orderId, next, session);
      expect(result.status).toBe(200);
      expect(result.body.newStatus).toBe(next);
    }
    expect((await statusRequest(first.orderId, 'PREPARING', session)).status).toBe(409);
    expect((await statusRequest(first.orderId, 'CANCELLED', session)).status).toBe(409);
    expect((await statusRequest(first.orderId, 'DELIVERED', session)).status).toBe(409);
    expect(await auditCount()).toBe(baseline + 4);
  });
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('Payment persistence and retry safety', () => {
  it('rolls back failed settlement without consuming the receipt, then records a retry exactly once', async () => {
    const intent = await createPaymentIntent(checkout);
    const paymentId = 'pay_' + crypto.randomBytes(8).toString('hex');
    const verify = () => verifyPaymentIntent(intent.intentId, paymentId, undefined, intent.mockDetails!.verificationToken);
    expect((await verify()).verified).toBe(true);
    const payment = { provider: 'mock', providerPaymentId: paymentId, amountPaisa: intent.amountPaisa, currency: 'INR' };
    await getDb().execute("CREATE TRIGGER fail_payment BEFORE INSERT ON payments BEGIN SELECT RAISE(ABORT, 'temporary payment storage failure'); END");
    await expect(transitionOrderToTicketGenerated(intent.orderId, payment)).rejects.toThrow();
    expect((await getOrderStatus(intent.customerAccessToken))?.isPaid).toBe(false);
    expect(Number((await getDb().execute({ sql: 'SELECT is_verified FROM payment_intents WHERE id = ?', args: [intent.intentId] })).rows[0]!.is_verified)).toBe(0);
    await getDb().execute('DROP TRIGGER fail_payment');
    expect((await verify()).verified).toBe(true);
    expect((await transitionOrderToTicketGenerated(intent.orderId, payment)).order.orderStatus).toBe('TICKET_GENERATED');
    expect((await transitionOrderToTicketGenerated(intent.orderId, payment)).idempotent).toBe(true);
    const rows = (await getDb().execute('SELECT verified_at, created_at, updated_at FROM payments')).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.updated_at).toBeTruthy();
    expect(rows[0]!.verified_at).toBeTruthy();
  });
  it('rejects underpayment and prevents reuse for another order', async () => {
    const first = await createPaymentIntent(checkout);
    const second = await createPaymentIntent(checkout);
    await expect(transitionOrderToTicketGenerated(first.orderId, { provider: 'mock', providerPaymentId: 'pay_fixture', amountPaisa: 1 })).rejects.toThrow(/amount mismatch/);
    await transitionOrderToTicketGenerated(first.orderId, { provider: 'mock', providerPaymentId: 'pay_fixture', amountPaisa: first.amountPaisa });
    await expect(transitionOrderToTicketGenerated(second.orderId, { provider: 'mock', providerPaymentId: 'pay_fixture', amountPaisa: second.amountPaisa })).rejects.toThrow(/another order/);
  });
  it('expires checkout ID lookup while preserving the customer tracking token', async () => {
    const intent = await createPaymentIntent(checkout);
    await getDb().execute({ sql: 'UPDATE payment_intents SET expires_at = ? WHERE id = ?', args: [Date.now() - 1, intent.intentId] });
    expect(await getOrderStatus(intent.intentId)).toBeNull();
    expect((await getOrderStatus(intent.customerAccessToken))?.orderId).toBe(intent.orderId);
  });
  it('development seed payments satisfy required timestamp columns', async () => {
    await seedDevelopmentData();
    const rows = (await getDb().execute('SELECT updated_at FROM payments')).rows;
    expect(rows).toHaveLength(2);
    expect(rows.every(row => Boolean(row.updated_at))).toBe(true);
  });
});

describe('Authoritative Razorpay confirmation', () => {
  it('requires captured status, exact amount, INR and the saved gateway order', async () => {
    const { intent, gatewayOrderId } = await realIntent();
    const paymentId = 'pay_fixture_captured';
    const signature = crypto.createHmac('sha256', gatewaySecret).update(`${gatewayOrderId}|${paymentId}`).digest('hex');
    const entity = { id: paymentId, order_id: gatewayOrderId, amount: intent.amountPaisa, currency: 'INR', status: 'captured', captured: true };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => entity });
    vi.stubGlobal('fetch', fetchMock);
    expect((await verifyPaymentIntent(intent.intentId, paymentId, signature)).verified).toBe(true);
    for (const override of [{ status: 'authorized', captured: false }, { amount: 1 }, { currency: 'USD' }, { order_id: 'order_unrelated' }]) {
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ...entity, ...override }) });
      expect((await verifyPaymentIntent(intent.intentId, paymentId, signature)).verified).toBe(false);
    }
    fetchMock.mockClear();
    expect((await verifyPaymentIntent(intent.intentId, paymentId, 'corrupted')).verified).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('ignores authentic failed/authorized webhooks and rejects missing or altered signatures', async () => {
    const { intent, gatewayOrderId } = await realIntent();
    for (const state of ['failed', 'authorized']) {
      const payload = event(intent, gatewayOrderId, { status: state, captured: false });
      payload.event = 'payment.' + state;
      expect((await post(payload, sign(payload))).body.ignored).toBe(true);
    }
    const payload = event(intent, gatewayOrderId);
    expect((await post(payload)).status).toBe(400);
    expect((await post(payload, 'corrupted')).status).toBe(400);
    expect((await getOrderStatus(intent.customerAccessToken))?.isPaid).toBe(false);
  });
  it('rejects wrong amount, currency or provider order even when notes contain a valid internal order', async () => {
    const { intent, gatewayOrderId } = await realIntent();
    for (const override of [{ currency: 'USD' }, { amount: 1 }, { order_id: 'order_unrelated' }]) {
      const payload = event(intent, gatewayOrderId, { ...override, notes: { orderId: intent.orderId } });
      expect((await post(payload, sign(payload))).status).toBeGreaterThanOrEqual(400);
      expect((await getOrderStatus(intent.customerAccessToken))?.isPaid).toBe(false);
    }
  });
  it('records late captured payments once and supports safe webhook retries', async () => {
    const { intent, gatewayOrderId } = await realIntent();
    (await getIntent(intent.intentId))!.expiresAt = Date.now() - 1;
    await getDb().execute({ sql: 'UPDATE payment_intents SET expires_at = ? WHERE id = ?', args: [Date.now() - 1, intent.intentId] });
    const payload = event(intent, gatewayOrderId);
    expect((await post(payload, sign(payload))).status).toBe(200);
    const repeated = await post(payload, sign(payload));
    expect(repeated.status).toBe(200);
    expect(repeated.body.idempotent).toBe(true);
    expect((await getOrderStatus(intent.customerAccessToken))?.isPaid).toBe(true);
    expect((await getDb().execute('SELECT id FROM payments')).rows).toHaveLength(1);
  });
});
