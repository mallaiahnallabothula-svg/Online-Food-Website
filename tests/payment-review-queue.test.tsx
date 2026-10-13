// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../src/context/LanguageContext.tsx';
import { PaymentReviewQueue } from '../src/components/OwnerPortal/PaymentReviewQueue.tsx';
import {
  fetchPaymentReviewPage, formatPaymentReviewAmount, validatePaymentReviewPage,
  type PaymentReview, type PaymentReviewPage,
} from '../src/utils/paymentReview.ts';
import express from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';

vi.mock('../server/db/index.ts', async () => {
  const { createClient } = await import('@libsql/client');
  const { DB_SCHEMA } = await import('../server/db/schema.ts');
  const db = createClient({ url: ':memory:' });
  return {
    getDb: () => db,
    initDb: async () => {
      for (const statement of DB_SCHEMA.split(';').map(x => x.trim()).filter(Boolean)) {
        await db.execute(statement);
      }
    },
    withDbRetry: async (fn: () => Promise<unknown>) => fn(),
  };
});

import { adminRouter } from '../server/routes/adminRoutes.ts';
import { getDb, initDb } from '../server/db/index.ts';

const paymentId = 'pay_REVIEW1234567';
const orderId = 'MENU-12345678-1234-1234-1234-123456789abc';
const sample: PaymentReview = {
  id: 'payrecord-1', orderId, providerPaymentId: paymentId,
  amountPaisa: 25000, currency: 'INR', createdAt: '2026-10-13T12:00:00.000Z',
  paymentStatus: 'PENDING', orderStatus: 'PENDING', deliveryDate: '2026-10-14',
  status: 'REVIEW_REQUIRED',
};
const page = (reviews: PaymentReview[] = [sample], total = reviews.length, number = 1): PaymentReviewPage => ({
  reviews, pagination: { total, page: number, limit: 20 },
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe('Read-only payment review validation', () => {
  it('uses integer paise and strict, deduplicated captured-exception payload', () => {
    expect(formatPaymentReviewAmount(25000)).toBe('₹250.00');
    expect(validatePaymentReviewPage(page(), 1)).toEqual(page());
    for (const changed of [
      { ...sample, status: 'SUCCESS' }, { ...sample, amountPaisa: NaN },
      { ...sample, paymentStatus: 'UNKNOWN' }, { ...sample, currency: 'USD' },
      { ...sample, providerPaymentId: 'invalid' },
    ]) expect(() => validatePaymentReviewPage(page([changed as PaymentReview]), 1)).toThrow('Invalid');
    expect(() => validatePaymentReviewPage(page([sample, sample]), 1)).toThrow('Duplicate');
    expect(() => validatePaymentReviewPage(page(), 2)).toThrow('Invalid');
  });

  it('uses authenticated, no-store GET only and fails closed on missing access and errors', async () => {
    const ok = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe('/api/admin/payment-reviews?page=1');
      expect(init.credentials).toBe('include');
      expect(init.cache).toBe('no-store');
      expect(init.method).toBeUndefined();
      return { ok: true, json: async () => page() } as Response;
    });
    expect(await fetchPaymentReviewPage(1, undefined, ok as unknown as typeof fetch)).toEqual(page());
    for (const status of [401, 403]) {
      const blocked = vi.fn(async () => ({ ok: false, status } as Response));
      await expect(fetchPaymentReviewPage(1, undefined, blocked as unknown as typeof fetch))
        .rejects.toThrow('OWNER_REVIEW_ACCESS_DENIED');
    }
    const down = vi.fn(async () => ({ ok: false, status: 503 } as Response));
    await expect(fetchPaymentReviewPage(1, undefined, down as unknown as typeof fetch))
      .rejects.toThrow('unavailable');
  });
});

describe('Payment review owner UI', () => {
  it('renders a recorded exception, copies payment ID, navigates by exact order and preserves alert count', async () => {
    const fetcher = vi.fn(async () => ({
      ok: true, status: 200, json: async () => page(),
    } as Response));
    vi.stubGlobal('fetch', fetcher);
    const copy = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } });
    const counts = vi.fn();
    const view = vi.fn();
    const { rerender } = render(
      <LanguageProvider><PaymentReviewQueue visible={true} onCountChange={counts}
        onViewOrder={view} onAccessDenied={() => {}} /></LanguageProvider>
    );
    const card = await screen.findByTestId('payment-review-card');
    expect(card.textContent).toContain('₹250.00');
    expect(card.textContent).toContain('REVIEW_REQUIRED');
    expect(card.textContent).toContain('PENDING');
    expect(screen.getByTestId('payment-review-total').textContent).toContain('1');
    expect(counts).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: 'Copy payment ID ' + paymentId }));
    await waitFor(() => expect(copy).toHaveBeenCalledWith(paymentId));
    fireEvent.click(screen.getByRole('button', { name: 'View review order ' + orderId }));
    expect(view).toHaveBeenCalledWith(orderId);
    rerender(<LanguageProvider><PaymentReviewQueue visible={false} onCountChange={counts}
      onViewOrder={view} onAccessDenied={() => {}} /></LanguageProvider>);
    expect(screen.queryByTestId('payment-review-card')).toBeNull();
    fireEvent(window, new Event('focus'));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(counts).toHaveBeenLastCalledWith(1);
  });

  it('never renders false zero on a failed server fetch', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 } as Response)));
    const counts = vi.fn();
    render(<LanguageProvider><PaymentReviewQueue visible={true} onCountChange={counts}
      onViewOrder={() => {}} onAccessDenied={() => {}} /></LanguageProvider>);
    await screen.findByRole('alert');
    expect(screen.queryByTestId('payment-review-total')).toBeNull();
    expect(counts).toHaveBeenLastCalledWith(null);
  });

  it('denies invalid or STAFF session instead of showing payment details', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403 } as Response)));
    const denied = vi.fn();
    render(<LanguageProvider><PaymentReviewQueue visible={true} onCountChange={() => {}}
      onViewOrder={() => {}} onAccessDenied={denied} /></LanguageProvider>);
    await waitFor(() => expect(denied).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('payment-review-card')).toBeNull();
  });
});

async function withHttp(check: (base: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/admin', adminRouter);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve, reject) => {
      if (server.listening) return resolve();
      server.once('listening', resolve);
      server.once('error', reject);
    });
    await check('http://127.0.0.1:' + (server.address() as AddressInfo).port);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

async function seedOrderAndPayment(status: string, provider: string, forcedId?: string) {
  const id = forcedId ?? 'MENU-' + crypto.randomUUID();
  const now = '2026-10-13T12:00:00.000Z';
  await getDb().execute({
    sql: `INSERT INTO orders (
      id,public_token_hash,created_at_utc,created_at_ist,delivery_date,delivery_window,
      total_items,jowar_unit_price_paisa,chapathi_unit_price_paisa,subtotal_paisa,
      delivery_charge_paisa,total_amount_paisa,payment_status,order_status,payment_provider,
      provider_payment_id,fulfillment_status,customer_name,customer_mobile,address,
      distance_km,created_by,updated_at,updated_by
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [id, 'hash-' + crypto.randomUUID(), now, now, '2026-10-14', '07:00-11:00',
      4, 3000, 1000, 25000, 0, 25000, 'PENDING', 'PENDING', 'razorpay',
      'MENU_GATEWAY_UNBOUND', 'RECEIVED', 'Sensitive Customer Name', '9000000001',
      'Sensitive Customer Address', 1, 'CUSTOMER', now, 'SYSTEM'],
  });
  await getDb().execute({
    sql: `INSERT INTO payments (
      id,order_id,provider,provider_order_id,provider_payment_id,amount_paisa,
      currency,status,signature,raw_payload,verified_at,created_at,updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: ['payrecord-' + crypto.randomUUID(), id, provider, 'order_TEST1234567',
      'pay_' + crypto.randomBytes(9).toString('hex'), 25000, 'INR',
      status, 'SECRET_SIGNATURE_SHOULD_NOT_LEAK', 'SECRET_RAW_PAYLOAD', now, now, now],
  });
  return id;
}
async function session(role: 'ADMIN' | 'STAFF'): Promise<string> {
  const id = 'USR-' + crypto.randomUUID();
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date().toISOString();
  await getDb().execute({
    sql: 'INSERT INTO admin_users (id, username, password_hash, role, name, created_at) VALUES (?,?,?,?,?,?)',
    args: [id, role + id, 'not-used-by-this-test', role, role, now],
  });
  await getDb().execute({
    sql: 'INSERT INTO admin_sessions (id,session_token_hash,user_id,expires_at,created_at,user_agent,ip) VALUES (?,?,?,?,?,?,?)',
    args: ['SESS-' + crypto.randomUUID(), crypto.createHash('sha256').update(token).digest('hex'),
      id, new Date(Date.now() + 60_000).toISOString(), now, 'Test', '127.0.0.1'],
  });
  return token;
}

beforeAll(async () => { await initDb(); });
afterAll(() => { getDb().close(); });

describe('Owner ADMIN-only payment review API with isolated in-memory DB', () => {
  it('blocks anonymous/STAFF, limits to recorded menu Razorpay exceptions and omits private payloads', async () => {
    const exceptionId = await seedOrderAndPayment('REVIEW_REQUIRED', 'razorpay');
    await seedOrderAndPayment('SUCCESS', 'razorpay');
    await seedOrderAndPayment('REVIEW_REQUIRED', 'mock');
    await seedOrderAndPayment('REVIEW_REQUIRED', 'razorpay', 'LEGACY-TEST-ORDER');
    const adminToken = await session('ADMIN');
    const staffToken = await session('STAFF');
    await withHttp(async base => {
      const url = base + '/api/admin/payment-reviews?page=1';
      expect((await fetch(url)).status).toBe(401);
      expect((await fetch(url, { headers: { cookie: 'admin_session=' + staffToken } })).status).toBe(403);
      expect((await fetch(url + 'abc', { headers: { cookie: 'admin_session=' + adminToken } })).status).toBe(400);
      const res = await fetch(url, { headers: { cookie: 'admin_session=' + adminToken } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.pagination).toEqual({ page: 1, limit: 20, total: 1 });
      expect(data.reviews).toHaveLength(1);
      expect(data.reviews[0]).toMatchObject({
        orderId: exceptionId, amountPaisa: 25000, currency: 'INR',
        paymentStatus: 'PENDING', status: 'REVIEW_REQUIRED',
      });
      expect(JSON.stringify(data)).not.toMatch(/SECRET_SIGNATURE|SECRET_RAW|9000000001|Sensitive Customer/);
      expect((await fetch(url, { method: 'POST', headers: { cookie: 'admin_session=' + adminToken } })).status).toBe(404);
    });
    const saved = await getDb().execute("SELECT COUNT(*) AS n FROM payments WHERE status='REVIEW_REQUIRED'");
    expect(Number(saved.rows[0]?.n)).toBe(3); // No read accidentally wrote/reconciled payments.
  });

  it('returns a real total and deterministic pagination, not only the first 20 cases', async () => {
    // Existing fixture records from the previous test remain (isolated from production).
    for (let n = 0; n < 21; n++) await seedOrderAndPayment('REVIEW_REQUIRED', 'razorpay');
    const token = await session('ADMIN');
    await withHttp(async base => {
      const first = await (await fetch(base + '/api/admin/payment-reviews?page=1', {
        headers: { cookie: 'admin_session=' + token },
      })).json();
      const second = await (await fetch(base + '/api/admin/payment-reviews?page=2', {
        headers: { cookie: 'admin_session=' + token },
      })).json();
      expect(first.pagination.total).toBe(22);
      expect(first.reviews).toHaveLength(20);
      expect(second.pagination.total).toBe(22);
      expect(second.reviews).toHaveLength(2);
      expect(new Set([...first.reviews, ...second.reviews].map(x => x.id)).size).toBe(22);
    });
  });
});
