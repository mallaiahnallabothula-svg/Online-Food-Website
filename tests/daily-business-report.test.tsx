// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../src/context/LanguageContext.tsx';
import { DailyBusinessReport } from '../src/components/OwnerPortal/DailyBusinessReport.tsx';
import { fetchKitchenDeliveryOrders, istToday } from '../src/utils/kitchenBoard.ts';
import { rupeesFromPaisa, summarizeDailyBusiness } from '../src/utils/dailyBusinessReport.ts';
import type { Order } from '../src/types.ts';

const DAY = '2026-10-13';
const paid = (id: string, patch: Partial<Order> = {}): Order => ({
  id, paymentStatus: 'PAID', fulfillmentStatus: 'RECEIVED',
  deliveryDate: DAY, deliveryWindow: '07:00-11:00',
  subtotal: 140, deliveryCharge: 30, totalAmount: 170,
  jowarQuantity: 0, chapathiQuantity: 0,
  items: [{ itemId: 'idly', nameEn: 'Idly', nameTe: 'ఇడ్లీ',
    quantity: 2, saleUnit: 'PLATE', piecesPerUnit: 4,
    unitPricePaisa: 3000, lineTotalPaisa: 6000 }],
  ...patch,
} as unknown as Order);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('Daily Business Report V1 — authoritative paid delivery-date aggregates', () => {
  it('computes exact paise totals, sessions, awaiting delivery, prep and cancelled-paid separately', () => {
    const summary = summarizeDailyBusiness([
      paid('MORNING'),
      paid('EVENING', {
        deliveryWindow: '18:00-20:00', subtotal: 125.25, deliveryCharge: 50,
        totalAmount: 175.25, fulfillmentStatus: 'PREPARING',
        items: [{ itemId: 'chapathi', nameEn: 'Chapathi', nameTe: 'చపాతీ',
          quantity: 5, saleUnit: 'PIECE', piecesPerUnit: null, unitPricePaisa: 600, lineTotalPaisa: 3000 }],
      }),
      paid('DELIVERED', { fulfillmentStatus: 'DELIVERED', deliveryCharge: 0, totalAmount: 140 }),
      paid('CANCELLED', { fulfillmentStatus: 'CANCELLED' }),
      paid('PENDING', { paymentStatus: 'PENDING' }),
      paid('REFUNDED', { paymentStatus: 'REFUNDED' }),
      paid('FAILED', { paymentStatus: 'FAILED' }),
    ], DAY);
    expect(summary).toMatchObject({
      date: DAY, paidOrders: 4, foodSalesPaisa: 54525, deliveryFeesPaisa: 11000,
      paidTotalPaisa: 65525, awaitingDelivery: 2, delivered: 1, cancelledPaid: 1,
      morning: 3, evening: 1, unclassified: 0,
    });
    expect(summary.toPrepare.map(x => [x.itemId, x.quantity])).toEqual([
      ['chapathi', 5], ['idly', 2],
    ]);
    expect(rupeesFromPaisa(17525)).toBe('₹175.25');
  });

  it('does not conflate day of payment with day of delivery or display wrong-date records', () => {
    expect(() => summarizeDailyBusiness([paid('FUTURE', { deliveryDate: '2026-10-14' })], DAY))
      .toThrow('different date');
    expect(() => summarizeDailyBusiness([], '2026-02-30')).toThrow('Invalid report date');
    expect(summarizeDailyBusiness([paid('PENDING', { paymentStatus: 'PENDING' })], DAY).paidOrders).toBe(0);
  });

  it('fails closed on corrupt paid financial fields instead of showing false revenue', () => {
    expect(() => summarizeDailyBusiness([paid('BAD', { totalAmount: Number.NaN })], DAY))
      .toThrow('Incomplete financial data');
    expect(() => summarizeDailyBusiness([paid('NEGATIVE', { deliveryCharge: -1 })], DAY))
      .toThrow('Incomplete financial data');
  });

  it('reads every authenticated date-filtered page rather than only the first 20/100', async () => {
    const rows = Array.from({ length: 101 }, (_, i) => paid('PAID-' + i));
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      const query = new URL(url, 'https://example.test').searchParams;
      expect(query.get('date')).toBe(DAY);
      expect(query.get('limit')).toBe('100');
      expect(init.credentials).toBe('include');
      const page = Number(query.get('page'));
      return { ok: true, json: async () => ({
        orders: rows.slice((page - 1) * 100, page * 100),
        pagination: { total: rows.length, totalPages: 2 },
      }) } as Response;
    });
    const all = await fetchKitchenDeliveryOrders(DAY, undefined, fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(summarizeDailyBusiness(all, DAY).paidOrders).toBe(101);
    expect(summarizeDailyBusiness(all, DAY).paidTotalPaisa).toBe(1_717_000);
  });

  it('renders daily figures and passes selected delivery date to existing CSV and Kitchen Board', async () => {
    const today = istToday();
    const orders = [
      paid('M', { deliveryDate: today }),
      paid('E', { deliveryDate: today, deliveryWindow: '18:00-20:00', subtotal: 100, deliveryCharge: 50, totalAmount: 150,
        items: [{ itemId: 'chapathi', nameEn: 'Chapathi', nameTe: 'చపాతీ', quantity: 2,
          saleUnit: 'PIECE', piecesPerUnit: null, unitPricePaisa: 600, lineTotalPaisa: 1200 }],
      }),
      paid('PENDING', { deliveryDate: today, paymentStatus: 'PENDING' }),
    ];
    const fetcher = vi.fn(async (url: string) => {
      expect(new URL(url, 'https://example.test').searchParams.get('date')).toBe(today);
      return { ok: true, json: async () => ({
        orders, pagination: { total: orders.length, totalPages: 1 },
      }) } as Response;
    });
    vi.stubGlobal('fetch', fetcher);
    const exportDate = vi.fn();
    const openKitchen = vi.fn();
    render(<LanguageProvider><DailyBusinessReport onExportDate={exportDate} isExporting={false} onViewKitchenDate={openKitchen} /></LanguageProvider>);
    expect((await screen.findByTestId('daily-paid')).textContent).toBe('2');
    expect(screen.getByTestId('daily-food').textContent).toBe('₹240.00');
    expect(screen.getByTestId('daily-fees').textContent).toBe('₹80.00');
    expect(screen.getByTestId('daily-total').textContent).toBe('₹320.00');
    expect(screen.getByTestId('daily-awaiting').textContent).toBe('2');
    expect(screen.getByTestId('daily-sessions').textContent).toMatch(/1.*1/);
    fireEvent.click(screen.getByRole('button', { name: /CSV/ }));
    expect(exportDate).toHaveBeenCalledWith(today);
    fireEvent.click(screen.getByRole('button', { name: /^View Kitchen Board$|^ఈ తేదీ కిచెన్ బోర్డ్$/ }));
    expect(openKitchen).toHaveBeenCalledWith(today);
  });

  it('fails closed on an incomplete page/error; no misleading zero revenue', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 } as Response)));
    render(<LanguageProvider><DailyBusinessReport onExportDate={() => {}} isExporting={false} onViewKitchenDate={() => {}} /></LanguageProvider>);
    await screen.findByRole('alert');
    expect(screen.queryByTestId('daily-paid')).toBeNull();
    expect(screen.queryByTestId('daily-total')).toBeNull();
  });

  it('refreshing the selected date ignores stale prior-date results', async () => {
    const today = istToday();
    const otherDate = today === '2026-10-12' ? '2026-10-11' : '2026-10-12';
    let completeFirst!: (payload: unknown) => void;
    const first = new Promise<unknown>(resolve => { completeFirst = resolve; });
    const fetcher = vi.fn(async (url: string) => {
      const date = new URL(url, 'https://example.test').searchParams.get('date');
      if (date === today) return { ok: true, json: async () => first } as Response;
      return { ok: true, json: async () => ({
        orders: [paid('OTHER-DATE', { deliveryDate: otherDate })],
        pagination: { total: 1, totalPages: 1 },
      }) } as Response;
    });
    vi.stubGlobal('fetch', fetcher);
    render(<LanguageProvider><DailyBusinessReport onExportDate={() => {}} isExporting={false} onViewKitchenDate={() => {}} /></LanguageProvider>);
    const picker = document.getElementById('daily-business-date') as HTMLInputElement;
    fireEvent.change(picker, { target: { value: otherDate } });
    expect((await screen.findByTestId('daily-paid')).textContent).toBe('1');
    completeFirst({ orders: [], pagination: { total: 0, totalPages: 1 } });
    await waitFor(() => expect(screen.getByTestId('daily-paid').textContent).toBe('1'));
    expect((picker as HTMLInputElement).value).toBe(otherDate);
  });
});
