// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../src/context/LanguageContext.tsx';
import { TomorrowPreordersSummary } from '../src/components/OwnerPortal/TomorrowPreordersSummary.tsx';
import { LiveNewMenuCheckout } from '../src/components/LiveNewMenuCheckout.tsx';
import {
  parsePreparedPreorderSlot, summarizeTomorrowPreorders, tomorrowIst,
} from '../src/utils/preorderNotices.ts';
import type { Order } from '../src/types.ts';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

const order = (id: string, date: string, status = 'RECEIVED', paid = 'PAID', item = 'idly'): Order => ({
  id, deliveryDate: date, fulfillmentStatus: status, paymentStatus: paid,
  items: [{ itemId: item, nameEn: item, nameTe: item, quantity: 1, saleUnit: 'PLATE',
    piecesPerUnit: 4, lineTotalPaisa: 3000, unitPricePaisa: 3000 }],
}) as unknown as Order;

describe('Pre-order clarity — confirmed delivery and tomorrow counts', () => {
  it('computes tomorrow in IST across midnight, month/year/leap transitions', () => {
    expect(tomorrowIst(new Date('2026-10-13T17:00:00Z'))).toBe('2026-10-14');
    expect(tomorrowIst(new Date('2026-10-13T20:00:00Z'))).toBe('2026-10-15');
    expect(tomorrowIst(new Date('2026-12-31T17:00:00Z'))).toBe('2027-01-01');
    expect(tomorrowIst(new Date('2028-02-28T16:00:00Z'))).toBe('2028-02-29');
  });

  it('counts only active PAID orders for tomorrow including all sessions', () => {
    const date = '2026-10-14';
    const summary = summarizeTomorrowPreorders([
      order('MORNING', date),
      order('EVENING', date, 'PREPARING', 'PAID', 'jowar-roti'),
      order('OUT', date, 'OUT_FOR_DELIVERY'),
      order('OTHER', date, 'RECEIVED', 'PAID', 'unknown-item'),
      order('PENDING', date, 'RECEIVED', 'PENDING'),
      order('FAILED', date, 'RECEIVED', 'FAILED'),
      order('CANCELLED', date, 'CANCELLED'),
      order('DELIVERED', date, 'DELIVERED'),
      order('WRONG_DATE', '2026-10-15'),
    ], date);
    expect(summary).toEqual({
      date, total: 4, morning: 2, evening: 1, needsReview: 1,
    });
  });

  it('does not invent a confirmed schedule for stale, invalid or other order details', () => {
    const id = 'MENU-TEST-ORDER';
    const good = { orderId: id, deliveryDateIst: '2026-10-14', deliveryWindow: '07:00-11:00' };
    expect(parsePreparedPreorderSlot(good, id)).toEqual(good);
    expect(parsePreparedPreorderSlot(good, 'different-id')).toBeNull();
    expect(parsePreparedPreorderSlot({ ...good, deliveryDateIst: '2026-02-30' }, id)).toBeNull();
    expect(parsePreparedPreorderSlot({ ...good, deliveryWindow: '18:00-6:00' }, id)).toBeNull();
    expect(parsePreparedPreorderSlot(null, id)).toBeNull();
  });

  it('shows owner tomorrow count, morning/evening breakdown and Kitchen Board shortcut', async () => {
    const date = tomorrowIst();
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      expect(new URL(url, 'https://example.test').searchParams.get('date')).toBe(date);
      expect(init.credentials).toBe('include');
      return { ok: true, json: async () => ({
        orders: [order('A', date), order('B', date, 'RECEIVED', 'PAID', 'chapathi'), order('C', date, 'CANCELLED')],
        pagination: { total: 3, totalPages: 1 },
      }) } as Response;
    });
    vi.stubGlobal('fetch', fetcher);
    const onView = vi.fn();
    render(<LanguageProvider><TomorrowPreordersSummary onViewTomorrow={onView} /></LanguageProvider>);
    const count = await screen.findByTestId('tomorrow-paid-order-count');
    expect(count.textContent).toContain('2');
    expect(screen.getByText(date)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: "Open tomorrow's Kitchen Board" }));
    expect(onView).toHaveBeenCalledWith(date);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('fails closed on server error instead of displaying incorrect zero counts', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 } as Response)));
    render(<LanguageProvider><TomorrowPreordersSummary onViewTomorrow={() => {}} /></LanguageProvider>);
    await screen.findByRole('alert');
    expect(screen.queryByTestId('tomorrow-paid-order-count')).toBeNull();
  });

  it('shows saved delivery details only after confirmed payment settlement', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'another-request-id' });
    const id = 'MENU-00000000-0000-4000-8000-000000000001';
    const pending = {
      orderId: id, token: 'a'.repeat(64), deliveryDateIst: '2026-10-14',
      deliveryWindow: '07:00-11:00',
    };
    sessionStorage.setItem('mana_new_menu_pending_order', JSON.stringify(pending));
    sessionStorage.setItem('mana_new_menu_payment_proof', JSON.stringify({
      razorpay_payment_id: 'pay_fixture', razorpay_order_id: 'order_fixture', razorpay_signature: 'sig_fixture',
    }));
    const fetcher = vi.fn(async (url: string) => {
      expect(url).toBe('/api/new-menu/confirm');
      return { ok: true, json: async () => ({ settlement: { status: 'CONFIRMED', orderId: id } }) } as Response;
    });
    vi.stubGlobal('fetch', fetcher);
    render(<LanguageProvider><LiveNewMenuCheckout period="MORNING" lines={[]} te={false} /></LanguageProvider>);
    const confirmation = await screen.findByRole('region', { name: 'Verified pre-order confirmation' });
    expect(confirmation.textContent).toContain('Pre-order confirmed');
    expect(confirmation.textContent).toContain('2026-10-14');
    expect(confirmation.textContent).toContain('07:00-11:00 IST');
    expect(confirmation.textContent).not.toContain('pay_fixture');
    expect(confirmation.textContent).not.toContain('a'.repeat(64));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  });

  it('does not claim confirmation for unsettled / pending payment', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'another-request-id' });
    const id = 'MENU-00000000-0000-4000-8000-000000000001';
    sessionStorage.setItem('mana_new_menu_pending_order', JSON.stringify({
      orderId: id, token: 'b'.repeat(64), deliveryDateIst: '2026-10-14', deliveryWindow: '18:00-20:00',
    }));
    sessionStorage.setItem('mana_new_menu_payment_proof', JSON.stringify({
      razorpay_payment_id: 'pay_fixture', razorpay_order_id: 'order_fixture', razorpay_signature: 'sig_fixture',
    }));
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, json: async () => ({ settlement: { status: 'REVIEW_REQUIRED' } }),
    } as Response)));
    render(<LanguageProvider><LiveNewMenuCheckout period="EVENING" lines={[]} te={false} /></LanguageProvider>);
    await screen.findByText(/Payment needs review/);
    expect(screen.queryByRole('region', { name: 'Verified pre-order confirmation' })).toBeNull();
  });
});
