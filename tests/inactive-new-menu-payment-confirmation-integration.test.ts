/**
 * PR21: INACTIVE new-menu payment confirmation integration regression tests.
 * All DBs are isolated in-memory libSQL clients. Both Razorpay transports are
 * injected mocks: no production credentials, remote calls or live routes.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createClient, type Client } from '@libsql/client';
import { describe, expect, it, vi } from 'vitest';
import { DB_SCHEMA } from '../server/db/schema.ts';
import { NEW_MENU_LAUNCH_ENABLED } from '../shared/menuCatalog.ts';
import {
  prepareInactiveNewMenuCheckout,
  startInactiveNewMenuCheckoutGateway,
} from '../server/services/inactiveNewMenuCheckoutOrchestrator.ts';
import { verifyAndSettleNewMenuPayment } from '../server/services/newMenuPaymentSafetyService.ts';
import { getMenuStockRemaining } from '../server/services/menuStockService.ts';

const placedAt = new Date('2026-10-10T00:30:00.000Z'); // 06:00 IST
const duringHold = placedAt.getTime() + 60_000;
const keyId = 'rzp_test_pr21fixture';
const keySecret = 'pr21-fixture-not-a-real-secret';
const credentials = { keyId, keySecret };
const orderGatewayId = 'order_PR21TEST1234567';
const secondGatewayId = 'order_PR21ALT1234567';
const paymentId = 'pay_PR21TEST1234567';

const request = {
  customer: {
    name: 'Fixture Customer', mobile: '9000000001',
    address: 'Flat 1, Kollur (test fixture)', latitude: 17.485, longitude: 78.235,
  },
  lines: [{ itemId: 'idly', quantity: 2 }, { itemId: 'ragi-idly', quantity: 2 }],
};

async function fixture(): Promise<Client> {
  const db = createClient({ url: ':memory:' });
  for (const sql of DB_SCHEMA.split(';').map(s => s.trim()).filter(Boolean)) {
    await db.execute(sql);
  }
  return db;
}

async function count(db: Client, table: 'orders' | 'order_items' | 'menu_stock_reservations' | 'payment_intents' | 'payments' | 'audit_logs') {
  return Number((await db.execute('SELECT COUNT(*) AS n FROM ' + table)).rows[0]?.n ?? -1);
}

async function orderState(db: Client, orderId: string) {
  return (await db.execute({
    sql: 'SELECT payment_status,order_status,provider_payment_id,ticket_text,ticket_generated_at FROM orders WHERE id=?',
    args: [orderId],
  })).rows[0];
}

function signed(providerOrderId: string, providerPaymentId = paymentId) {
  return crypto.createHmac('sha256', keySecret)
    .update(providerOrderId + '|' + providerPaymentId).digest('hex');
}

function createOrderMock(providerOrderId = orderGatewayId) {
  const spy = vi.fn(async (url: string, options?: RequestInit) => {
    const payload = JSON.parse(String(options?.body ?? '{}'));
    expect(url).toBe('https://api.razorpay.com/v1/orders');
    expect(options?.method).toBe('POST');
    expect(payload).toMatchObject({ currency: 'INR', amount: 14000 });
    expect(String(options?.headers && (options.headers as Record<string, string>).Authorization)).toContain('Basic ');
    return {
      ok: true, status: 200, json: async () => ({
        id: providerOrderId, receipt: payload.receipt, amount: payload.amount,
        amount_due: payload.amount, amount_paid: 0, currency: 'INR', status: 'created',
      }),
    };
  });
  return { spy, transport: spy as unknown as typeof fetch };
}

function captureMock(options: {
  id?: string; providerOrderId?: string; amount?: number; currency?: string;
  status?: string; captured?: boolean; httpStatus?: number; throwNetwork?: boolean;
} = {}) {
  const id = options.id ?? paymentId;
  const oid = options.providerOrderId ?? orderGatewayId;
  const status = options.status ?? 'captured';
  const responseStatus = options.httpStatus ?? 200;
  const spy = vi.fn(async (url: string, init?: RequestInit) => {
    expect(url).toBe('https://api.razorpay.com/v1/payments/' + encodeURIComponent(id));
    expect(init?.method).not.toBe('POST');
    if (options.throwNetwork) throw new Error('Mock Razorpay unavailable');
    return {
      ok: responseStatus >= 200 && responseStatus < 300,
      status: responseStatus,
      json: async () => ({
        id, order_id: oid, amount: options.amount ?? 14000,
        currency: options.currency ?? 'INR',
        status, captured: options.captured ?? (status === 'captured'),
      }),
    };
  });
  return { spy, transport: spy as unknown as typeof fetch };
}

async function ready(db: Client, gateway = orderGatewayId) {
  const prepared = await prepareInactiveNewMenuCheckout(db, request, placedAt);
  const orderMock = createOrderMock(gateway);
  const started = await startInactiveNewMenuCheckoutGateway(db,
    { orderId: prepared.orderId, customerAccessToken: prepared.customerAccessToken },
    credentials, orderMock.transport, placedAt.getTime() + 1000);
  expect(started.amountPaisa).toBe(14000);
  expect(started.providerOrderId).toBe(gateway);
  expect(orderMock.spy).toHaveBeenCalledTimes(1);
  return { prepared, orderMock, gateway };
}

const paymentInput = (orderId: string, providerOrderId = orderGatewayId, id = paymentId) => ({
  orderId, providerPaymentId: id, providerSignature: signed(providerOrderId, id),
});

describe('PR21 inactive Razorpay captured payment -> stock -> owner ticket safety', () => {
  it('is test-only and does not add new-menu payment routes, schema, live access or activation', () => {
    expect(NEW_MENU_LAUNCH_ENABLED).toBe(false);
    for (const pathname of [
      'server/app.ts', 'server/db/schema.ts', 'src/App.tsx',
      'server/routes/paymentRoutes.ts', 'src/components/PaymentModal.tsx',
    ]) {
      expect(fs.readFileSync(pathname, 'utf8')).not.toContain('payment-confirmation-safety');
    }
  });

  it('integrates server-priced pending checkout, mocked test gateway, captured payment and ONE itemized owner ticket', async () => {
    const db = await fixture();
    try {
      const { prepared } = await ready(db);
      expect(await count(db, 'payments')).toBe(0);
      expect(await getMenuStockRemaining(db, 'idly', '2026-10-10', duringHold)).toBe(28);
      const capture = captureMock();
      const result = await verifyAndSettleNewMenuPayment(
        db, paymentInput(prepared.orderId), duringHold, credentials, capture.transport);
      expect(result).toMatchObject({
        status: 'CONFIRMED', idempotent: false, orderId: prepared.orderId,
      });
      expect(result.ticketText).toContain('ఇడ్లీ');
      expect(result.ticketText).toContain('రాగి');
      expect(capture.spy).toHaveBeenCalledTimes(1);

      const stored = await orderState(db, prepared.orderId);
      expect(stored).toMatchObject({
        payment_status: 'PAID', order_status: 'TICKET_GENERATED',
        provider_payment_id: paymentId,
      });
      expect(stored?.ticket_generated_at).toBeTruthy();
      expect(stored?.ticket_text).toBe(result.ticketText);
      expect((await db.execute('SELECT status FROM menu_stock_reservations')).rows.map(x => x.status))
        .toEqual(['CONFIRMED', 'CONFIRMED']);
      expect((await db.execute('SELECT provider_payment_id,amount_paisa,currency,status FROM payments')).rows[0])
        .toMatchObject({ provider_payment_id: paymentId, amount_paisa: 14000, currency: 'INR', status: 'SUCCESS' });
      expect((await db.execute('SELECT is_verified FROM payment_intents')).rows[0]?.is_verified).toBe(1);
      expect(await count(db,'payments')).toBe(1);
      expect((await db.execute("SELECT COUNT(*) AS n FROM audit_logs WHERE action='NEW_MENU_PAYMENT_CONFIRMED'")).rows[0]?.n).toBe(1);
      expect(await getMenuStockRemaining(db,'idly','2026-10-10',duringHold)).toBe(28);
    } finally { db.close(); }
  });

  it('replayed captured callback is idempotent: one payment, one ticket, one confirmation audit', async () => {
    const db = await fixture();
    try {
      const { prepared } = await ready(db);
      const capture = captureMock();
      const first = await verifyAndSettleNewMenuPayment(db,paymentInput(prepared.orderId),duringHold,credentials,capture.transport);
      const second = await verifyAndSettleNewMenuPayment(db,paymentInput(prepared.orderId),duringHold+1000,credentials,capture.transport);
      expect(first.status).toBe('CONFIRMED');
      expect(second).toMatchObject({status:'CONFIRMED',idempotent:true,ticketText:first.ticketText});
      expect(await count(db,'orders')).toBe(1);
      expect(await count(db,'payments')).toBe(1);
      expect(await count(db,'payment_intents')).toBe(1);
      expect((await db.execute("SELECT COUNT(*) AS n FROM audit_logs WHERE action='NEW_MENU_PAYMENT_CONFIRMED'")).rows[0]?.n).toBe(1);
      expect((await db.execute('SELECT DISTINCT status FROM menu_stock_reservations')).rows.map(x=>x.status)).toEqual(['CONFIRMED']);
      expect(capture.spy).toHaveBeenCalledTimes(2); // reverify captured status, never re-record
    } finally { db.close(); }
  });

  it('concurrent identical callbacks cannot generate duplicate payment, stock settlement or ticket', async () => {
    const db = await fixture();
    try {
      const { prepared } = await ready(db);
      const capture = captureMock();
      const responses = await Promise.allSettled([
        verifyAndSettleNewMenuPayment(db,paymentInput(prepared.orderId),duringHold,credentials,capture.transport),
        verifyAndSettleNewMenuPayment(db,paymentInput(prepared.orderId),duringHold,credentials,capture.transport),
      ]);
      // SQLite may surface a transient write contention. Either way the DB
      // must contain exactly one valid settlement and no partial duplicate.
      expect(responses.some(x=>x.status==='fulfilled'&&x.value.status==='CONFIRMED')).toBe(true);
      expect(await count(db,'payments')).toBe(1);
      expect((await db.execute("SELECT COUNT(*) AS n FROM audit_logs WHERE action='NEW_MENU_PAYMENT_CONFIRMED'")).rows[0]?.n).toBe(1);
      expect((await db.execute('SELECT DISTINCT status FROM menu_stock_reservations')).rows.map(x=>x.status)).toEqual(['CONFIRMED']);
      expect((await orderState(db, prepared.orderId))?.order_status).toBe('TICKET_GENERATED');
    } finally { db.close(); }
  });

  it('rejects invalid signatures BEFORE gateway fetch and rejects failed/non-captured/mismatched receipts', async () => {
    const db = await fixture();
    try {
      const { prepared } = await ready(db);
      const capture = captureMock();
      for (const signature of ['', 'wrong-signature', 'f'.repeat(64)]) {
        await expect(verifyAndSettleNewMenuPayment(db,
          {...paymentInput(prepared.orderId),providerSignature:signature},
          duringHold,credentials,capture.transport)).rejects.toThrow('signature');
      }
      expect(capture.spy).not.toHaveBeenCalled();
      for (const input of [
        {status:'authorized'},
        {status:'captured',captured:false},
        {providerOrderId:secondGatewayId},
        {currency:'USD'},
        {amount:14001},
      ]) {
        const gateway = captureMock(input);
        await expect(verifyAndSettleNewMenuPayment(db,paymentInput(prepared.orderId),
          duringHold,credentials,gateway.transport)).rejects.toThrow();
      }
      expect(await count(db,'payments')).toBe(0);
      expect((await orderState(db,prepared.orderId))?.payment_status).toBe('PENDING');
      expect((await orderState(db,prepared.orderId))?.ticket_text).toBeNull();
      expect((await db.execute('SELECT DISTINCT status FROM menu_stock_reservations')).rows.map(x=>x.status)).toEqual(['HELD']);
    } finally { db.close(); }
  });

  it('gateway 503 or network failure leaves PENDING unchanged; a later genuine captured callback settles once', async () => {
    const db = await fixture();
    try {
      const { prepared } = await ready(db);
      const input = paymentInput(prepared.orderId);
      await expect(verifyAndSettleNewMenuPayment(db,input,duringHold,credentials,
        captureMock({httpStatus:503}).transport)).rejects.toThrow('retry without marking');
      await expect(verifyAndSettleNewMenuPayment(db,input,duringHold,credentials,
        captureMock({throwNetwork:true}).transport)).rejects.toThrow('Mock Razorpay unavailable');
      expect(await count(db,'payments')).toBe(0);
      expect((await orderState(db,prepared.orderId))?.payment_status).toBe('PENDING');
      const captured = await verifyAndSettleNewMenuPayment(db,input,duringHold,credentials,captureMock().transport);
      expect(captured.status).toBe('CONFIRMED');
      expect(await count(db,'payments')).toBe(1);
    } finally { db.close(); }
  });

  it('captured payment after hold expiry enters durable REVIEW_REQUIRED, never paid/ticketed', async () => {
    const db = await fixture();
    try {
      const { prepared } = await ready(db);
      const late = prepared.expiresAtMs + 1000;
      const capture = captureMock();
      const first = await verifyAndSettleNewMenuPayment(db,paymentInput(prepared.orderId),late,credentials,capture.transport);
      expect(first).toMatchObject({status:'REVIEW_REQUIRED',idempotent:false});
      const repeat = await verifyAndSettleNewMenuPayment(db,paymentInput(prepared.orderId),late+1000,credentials,capture.transport);
      expect(repeat).toMatchObject({status:'REVIEW_REQUIRED',idempotent:true});
      expect((await orderState(db,prepared.orderId))?.payment_status).toBe('PENDING');
      expect((await orderState(db,prepared.orderId))?.ticket_text).toBeNull();
      expect((await db.execute('SELECT status FROM payments')).rows[0]?.status).toBe('REVIEW_REQUIRED');
      expect((await db.execute('SELECT DISTINCT status FROM menu_stock_reservations')).rows.map(x=>x.status)).toEqual(['HELD']);
      expect((await db.execute("SELECT COUNT(*) AS n FROM audit_logs WHERE action='NEW_MENU_PAYMENT_REVIEW_REQUIRED'")).rows[0]?.n).toBe(1);
      expect((await db.execute("SELECT COUNT(*) AS n FROM audit_logs WHERE action='NEW_MENU_PAYMENT_CONFIRMED'")).rows[0]?.n).toBe(0);
      expect(await count(db,'payments')).toBe(1);
    } finally { db.close(); }
  });

  it('a released or missing stock hold causes captured payment to be recorded for review, not fulfillment', async () => {
    for (const condition of ['RELEASED', 'MISSING'] as const) {
      const db = await fixture();
      try {
        const { prepared } = await ready(db);
        if (condition === 'RELEASED') {
          await db.execute({sql:"UPDATE menu_stock_reservations SET status='RELEASED' WHERE order_id=?",args:[prepared.orderId]});
        } else {
          await db.execute({sql:'DELETE FROM menu_stock_reservations WHERE order_id=?',args:[prepared.orderId]});
        }
        const result = await verifyAndSettleNewMenuPayment(db,paymentInput(prepared.orderId),
          duringHold,credentials,captureMock().transport);
        expect(result.status).toBe('REVIEW_REQUIRED');
        expect((await db.execute('SELECT status FROM payments')).rows[0]?.status).toBe('REVIEW_REQUIRED');
        expect((await orderState(db,prepared.orderId))?.payment_status).toBe('PENDING');
        expect((await orderState(db,prepared.orderId))?.ticket_text).toBeNull();
        expect((await db.execute("SELECT COUNT(*) AS n FROM audit_logs WHERE action='NEW_MENU_PAYMENT_CONFIRMED'")).rows[0]?.n).toBe(0);
      } finally { db.close(); }
    }
  });

  it('same gateway payment ID cannot settle two distinct pending new-menu orders', async () => {
    const db = await fixture();
    try {
      const first = await ready(db);
      const second = await ready(db,secondGatewayId);
      expect(first.prepared.orderId).not.toBe(second.prepared.orderId);
      await verifyAndSettleNewMenuPayment(db,paymentInput(first.prepared.orderId),
        duringHold,credentials,captureMock().transport);
      // Even an injected (impossible in genuine Razorpay) captured response
      // for the second order cannot reuse a payment ID already attributed.
      await expect(verifyAndSettleNewMenuPayment(db,paymentInput(second.prepared.orderId,secondGatewayId),
        duringHold,credentials,captureMock({providerOrderId:secondGatewayId}).transport))
        .rejects.toThrow('another order');
      expect(await count(db,'payments')).toBe(1);
      expect((await orderState(db,second.prepared.orderId))?.payment_status).toBe('PENDING');
      expect((await orderState(db,second.prepared.orderId))?.ticket_text).toBeNull();
      expect((await db.execute("SELECT COUNT(*) AS n FROM audit_logs WHERE action='NEW_MENU_PAYMENT_CONFIRMED'")).rows[0]?.n).toBe(1);
    } finally { db.close(); }
  });

  it('mismatched saved intent amount fails closed without creating a payment or confirming stock', async () => {
    const db = await fixture();
    try {
      const { prepared } = await ready(db);
      await db.execute({sql:'UPDATE payment_intents SET amount_paisa=1 WHERE order_id=?',args:[prepared.orderId]});
      await expect(verifyAndSettleNewMenuPayment(db,paymentInput(prepared.orderId),
        duringHold,credentials,captureMock().transport)).rejects.toThrow('Matching saved gateway intent');
      expect(await count(db,'payments')).toBe(0);
      expect((await orderState(db,prepared.orderId))?.payment_status).toBe('PENDING');
      expect((await db.execute('SELECT DISTINCT status FROM menu_stock_reservations')).rows.map(x=>x.status)).toEqual(['HELD']);
    } finally { db.close(); }
  });

  it('a late transaction error rolls back paid status, payment, hold and ticket; safe retry confirms exactly once', async () => {
    const db = await fixture();
    try {
      const { prepared } = await ready(db);
      // Force failure at the FINAL audit insert after payment + stock +
      // ticket updates; the entire write transaction must roll back.
      await db.execute([
        'CREATE TRIGGER pr21_rollback BEFORE INSERT ON audit_logs',
        "WHEN NEW.action='NEW_MENU_PAYMENT_CONFIRMED'",
        "BEGIN SELECT RAISE(ABORT, 'pr21 intentional rollback'); END",
      ].join(' '));
      const capture = captureMock();
      await expect(verifyAndSettleNewMenuPayment(db,paymentInput(prepared.orderId),
        duringHold,credentials,capture.transport)).rejects.toThrow('pr21 intentional rollback');
      expect(await count(db,'payments')).toBe(0);
      expect((await orderState(db,prepared.orderId))?.payment_status).toBe('PENDING');
      expect((await orderState(db,prepared.orderId))?.ticket_text).toBeNull();
      expect((await db.execute('SELECT is_verified FROM payment_intents')).rows[0]?.is_verified).toBe(0);
      expect((await db.execute('SELECT DISTINCT status FROM menu_stock_reservations')).rows.map(x=>x.status)).toEqual(['HELD']);
      await db.execute('DROP TRIGGER pr21_rollback');
      const retry = await verifyAndSettleNewMenuPayment(db,paymentInput(prepared.orderId),
        duringHold+1000,credentials,capture.transport);
      expect(retry.status).toBe('CONFIRMED');
      expect(await count(db,'payments')).toBe(1);
      expect((await db.execute("SELECT COUNT(*) AS n FROM audit_logs WHERE action='NEW_MENU_PAYMENT_CONFIRMED'")).rows[0]?.n).toBe(1);
    } finally { db.close(); }
  });
});
