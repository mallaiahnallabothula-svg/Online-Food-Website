// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../src/context/LanguageContext.tsx';
import { OrderTrackingModal } from '../src/components/OrderTrackingModal.tsx';
import { buildReorderRequest, checkReorderStock } from '../src/utils/reorder.ts';
import type { Order } from '../src/types.ts';

const sourceOrder = {
  id: 'MENU-00000000-0000-4000-8000-000000000001',
  paymentStatus: 'PAID',
  fulfillmentStatus: 'DELIVERED',
  customerName: 'Test Customer',
  deliveryDate: '2026-10-12',
  totalAmount: 120,
  totalItems: 4,
  items: [
    { itemId: 'jowar-roti', nameEn: 'Jowar Roti', nameTe: 'జొన్న రొట్టె',
      quantity: 3, saleUnit: 'PIECE', piecesPerUnit: 1, unitPricePaisa: 3000, lineTotalPaisa: 9000 },
    { itemId: 'pappu-of-the-day', nameEn: 'Tomato Pappu', nameTe: 'టమాటా పప్పు',
      quantity: 1, saleUnit: 'PACK', piecesPerUnit: null, unitPricePaisa: 3000, lineTotalPaisa: 3000 },
  ],
} as unknown as Order;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('one-click reorder V1 safety', () => {
  it('copies only IDs and quantities (no old price, payment, delivery date or PII)', () => {
    const request = buildReorderRequest(sourceOrder);
    expect(request).toEqual({
      sourceOrderId: sourceOrder.id,
      period: 'EVENING',
      lines: [{ itemId: 'jowar-roti', quantity: 3 }, { itemId: 'pappu-of-the-day', quantity: 1 }],
    });
    const json = JSON.stringify(request);
    for (const secret of ['Tomato', 'Test Customer', 'deliveryDate', 'payment', 'trackingToken']) {
      expect(json).not.toContain(secret);
    }
  });

  it('denies pending, failed, unfinished, legacy, non-itemized, invalid or mixed orders', () => {
    const cases: Partial<Order>[] = [
      { paymentStatus: 'PENDING' }, { paymentStatus: 'FAILED' },
      { fulfillmentStatus: 'RECEIVED' }, { fulfillmentStatus: 'CANCELLED' },
      { id: 'SMJR-OLD-100' }, { items: [] }, { items: undefined },
      { items: [{ ...sourceOrder.items![0]!, itemId: 'invalid-item' }] },
      { items: [sourceOrder.items![0]!, sourceOrder.items![0]!] },
      { items: [sourceOrder.items![0]!, { ...sourceOrder.items![1]!, itemId: 'idly' }] },
      { items: [{ ...sourceOrder.items![0]!, quantity: 0 }] },
      { items: [{ ...sourceOrder.items![0]!, itemId: 'idly' }] },
    ];
    for (const patch of cases) expect(buildReorderRequest({ ...sourceOrder, ...patch })).toBeNull();
  });

  it('fails closed for missing, low, sold-out stock, or incompatible minimum quantities', () => {
    const request = buildReorderRequest(sourceOrder)!;
    expect(checkReorderStock(request, { 'jowar-roti': 8, 'pappu-of-the-day': 5 })).toBeNull();
    expect(checkReorderStock(request, { 'jowar-roti': 2, 'pappu-of-the-day': 5 })).toBe('stock');
    expect(checkReorderStock(request, { 'jowar-roti': 3 })).toBe('unavailable');
    expect(checkReorderStock(request, { 'jowar-roti': 3, 'pappu-of-the-day': -1 })).toBe('unavailable');
    expect(checkReorderStock({ ...request, lines: [{ itemId: 'jowar-roti', quantity: 2 }] }, { 'jowar-roti': 50 })).toBe('minimum');
  });

  it('only offers reorder after tracking-key lookup; clicking does not start payment', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ order: sourceOrder }),
    });
    vi.stubGlobal('fetch', fetcher);
    const onReorder = vi.fn();
    const onClose = vi.fn();
    render(<LanguageProvider>
      <OrderTrackingModal isOpen={true} onClose={onClose} initialOrderId={'a'.repeat(64)} onReorder={onReorder} />
    </LanguageProvider>);
    const button = await screen.findByRole('button', { name: /Reorder these items|ఈ ఐటమ్స్ మళ్లీ ఆర్డర్ చేయండి/ });
    fireEvent.click(button);
    expect(onReorder).toHaveBeenCalledWith(buildReorderRequest(sourceOrder));
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('/api/orders/');
  });

  it('does not offer pending-payment order for reorder', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ order: { ...sourceOrder, paymentStatus: 'PENDING' } }),
    });
    vi.stubGlobal('fetch', fetcher);
    render(<LanguageProvider>
      <OrderTrackingModal isOpen={true} onClose={() => {}} initialOrderId={'b'.repeat(64)} onReorder={vi.fn()} />
    </LanguageProvider>);
    await screen.findByText('Test Customer');
    expect(screen.queryByRole('button', { name: /Reorder these items|ఈ ఐటమ్స్ మళ్లీ ఆర్డర్ చేయండి/ })).toBeNull();
  });
});
