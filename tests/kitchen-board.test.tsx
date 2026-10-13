// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../src/context/LanguageContext.tsx';
import { KitchenBoard } from '../src/components/OwnerPortal/KitchenBoard.tsx';
import {
  fetchKitchenDeliveryOrders, istToday, kitchenLines, kitchenOrderSession, kitchenUnitText,
  projectKitchenBoard, validKitchenDate,
} from '../src/utils/kitchenBoard.ts';
import type { Order } from '../src/types.ts';

const DATE = '2026-10-13';
function makeOrder(id: string, patch: Partial<Order> = {}): Order {
  return {
    id, paymentStatus: 'PAID', fulfillmentStatus: 'RECEIVED', deliveryDate: DATE,
    deliveryWindow: '07:00-11:00', customerName: 'Test Customer',
    jowarQuantity: 0, chapathiQuantity: 0,
    items: [{ itemId: 'idly', nameEn: 'Idly', nameTe: 'ఇడ్లీ', quantity: 2,
      saleUnit: 'PLATE', piecesPerUnit: 4, unitPricePaisa: 3000, lineTotalPaisa: 6000,
      mealPeriod: 'MORNING' }],
    ...patch,
  } as unknown as Order;
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('Kitchen Board V1 — complete, paid-only, accurate preparation', () => {
  it('uses India time for delivery date, including IST midnight rollover', () => {
    expect(istToday(new Date('2026-10-13T20:00:00Z'))).toBe('2026-10-14');
    expect(istToday(new Date('2026-10-13T17:00:00Z'))).toBe('2026-10-13');
    expect(validKitchenDate('2026-10-13')).toBe(true);
    expect(validKitchenDate('2026-02-30')).toBe(false);
  });

  it('fetches every authenticated page (not only first 20/100 orders)', async () => {
    const all = Array.from({ length: 101 }, (_, i) => makeOrder('MENU-' + i));
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      const qs = new URL(url, 'https://example.test').searchParams;
      expect(qs.get('date')).toBe(DATE);
      expect(qs.get('limit')).toBe('100');
      expect(init.credentials).toBe('include');
      const page = Number(qs.get('page'));
      return { ok: true, json: async () => ({
        orders: all.slice((page - 1) * 100, page * 100),
        pagination: { total: all.length, totalPages: 2 },
      }) } as Response;
    });
    const got = await fetchKitchenDeliveryOrders(DATE, undefined, fetcher as unknown as typeof fetch);
    expect(got).toHaveLength(101);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(projectKitchenBoard(got, DATE, 'ALL').received).toBe(101);
  });

  it('refuses partial page failures, duplicates and changing pagination counts', async () => {
    const first = makeOrder('MENU-ONE');
    const fetcher = vi.fn(async (url: string) => {
      const page = Number(new URL(url, 'https://example.test').searchParams.get('page'));
      if (page === 1) return { ok: true, json: async () => ({
        orders: Array.from({ length: 100 }, (_, i) => makeOrder('MENU-' + i)),
        pagination: { total: 101, totalPages: 2 },
      }) } as Response;
      return { ok: true, json: async () => ({ orders: [first], pagination: { total: 102, totalPages: 2 } }) } as Response;
    });
    await expect(fetchKitchenDeliveryOrders(DATE, undefined, fetcher as unknown as typeof fetch))
      .rejects.toThrow('changed');
    const bad = vi.fn(async () => ({ ok: true, json: async () => ({
      orders: [first, first], pagination: { total: 2, totalPages: 1 },
    }) } as Response));
    await expect(fetchKitchenDeliveryOrders(DATE, undefined, bad as unknown as typeof fetch))
      .rejects.toThrow('Incomplete');
    const failed = vi.fn(async () => ({ ok: false } as Response));
    await expect(fetchKitchenDeliveryOrders(DATE, undefined, failed as unknown as typeof fetch))
      .rejects.toThrow('unavailable');
  });

  it('excludes pending, cancelled, dispatched and delivered food from cook totals', () => {
    const received = makeOrder('MENU-1');
    const preparing = makeOrder('MENU-2', { fulfillmentStatus: 'PREPARING' });
    const dispatched = makeOrder('MENU-3', { fulfillmentStatus: 'OUT_FOR_DELIVERY' });
    const unpaid = makeOrder('MENU-4', { paymentStatus: 'PENDING' });
    const cancelled = makeOrder('MENU-5', { fulfillmentStatus: 'CANCELLED' });
    const delivered = makeOrder('MENU-6', { fulfillmentStatus: 'DELIVERED' });
    const wrongDate = makeOrder('MENU-7', { deliveryDate: '2026-10-14' });
    const board = projectKitchenBoard([received, preparing, dispatched, unpaid, cancelled, delivered, wrongDate], DATE, 'ALL');
    expect([board.received, board.preparing, board.outForDelivery]).toEqual([1, 1, 1]);
    expect(board.orders).toHaveLength(3);
    expect(board.toPrepare).toMatchObject([{ itemId: 'idly', quantity: 4, orders: 2 }]);
    expect(kitchenUnitText(board.toPrepare[0]!, false)).toBe('4 plates (16 pieces)');
  });

  it('keeps saved item/plate names and separates morning, evening and legacy safely', () => {
    const evening = makeOrder('MENU-2', {
      items: [{ itemId: 'pappu-of-the-day', nameEn: 'Palakura Pappu',
        nameTe: 'పాలకూర పప్పు', quantity: 2, saleUnit: 'PACK',
        piecesPerUnit: null, unitPricePaisa: 3000, lineTotalPaisa: 6000,
        mealPeriod: 'EVENING' }] as unknown as Order['items'],
    });
    const legacy = makeOrder('SMJR-OLD', {
      items: undefined, jowarQuantity: 5, chapathiQuantity: 3,
      deliveryWindow: '18:00-20:00',
    });
    expect(kitchenOrderSession(evening)).toBe('EVENING');
    expect(kitchenOrderSession(legacy)).toBe('EVENING');
    expect(kitchenLines(legacy).map(x => [x.itemId, x.quantity])).toEqual([
      ['jowar-roti', 5], ['chapathi', 3],
    ]);
    const orders = [makeOrder('MENU-1'), evening, legacy];
    expect(projectKitchenBoard(orders, DATE, 'MORNING').orders).toHaveLength(1);
    expect(projectKitchenBoard(orders, DATE, 'EVENING').orders).toHaveLength(2);
    expect(projectKitchenBoard(orders, DATE, 'EVENING').toPrepare.some(x => x.nameEn === 'Palakura Pappu')).toBe(true);
  });

  it('renders a temporary packing checklist and reuses the existing status callback', async () => {
    const currentDate = istToday();
    const order = makeOrder('MENU-1', { deliveryDate: currentDate });
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({
      orders: [order], pagination: { total: 1, totalPages: 1 },
    }) } as Response));
    vi.stubGlobal('fetch', fetcher);
    const changeStatus = vi.fn(async () => true);
    render(<LanguageProvider><KitchenBoard onStatusChange={changeStatus} /></LanguageProvider>);
    const checkbox = await screen.findByRole('checkbox', { name: 'Pack Idly for MENU-1' });
    fireEvent.click(checkbox);
    expect((checkbox as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Start preparing|తయారీ ప్రారంభించు/ }));
    await waitFor(() => expect(changeStatus).toHaveBeenCalledWith('MENU-1', 'PREPARING'));
    expect(fetcher).toHaveBeenCalled();
  });
});
