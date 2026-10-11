// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../src/context/LanguageContext.tsx';
import { UpcomingCheckoutPreview } from '../src/components/UpcomingCheckoutPreview.tsx';
import { OrderItemLines } from '../src/components/OrderItemLines.tsx';
import { MENU_CATALOG } from '../shared/menuCatalog.ts';
import { createInactiveMenuCheckoutSession } from '../src/utils/inactiveMenuCheckout.ts';

const request = { lines: [{ itemId: 'idly', quantity: 4 }], customer: {
  name: 'Test Customer', mobile: '9000000001', address: 'Test address Kollur', latitude: 17.485, longitude: 78.235,
} };
const orderId = 'MENU-00000000-0000-4000-8000-000000000001';
const token = 'a'.repeat(64);
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('inactive checkout components', () => {
  it('connects validated cart, authoritative gateway amount and verified confirmation in the isolated harness', async () => {
    const transport = vi.fn(async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      if (url.endsWith('/prepare')) {
        expect(body.request.lines).toEqual(request.lines);
        expect(body.request.customer.latitude).toBe(17.485);
        return { ok: true, json: async () => ({ orderId, customerAccessToken: token }) };
      }
      if (url.endsWith('/gateway')) return { ok: true, json: async () => ({ orderId, providerOrderId: 'order_fixture', publicKeyId: 'rzp_test_fixture', amountPaisa: 12000, currency: 'INR', expiresAtMs: Date.now()+60000 }) };
      return { ok: true, json: async () => ({ orderId, status: 'CONFIRMED' }) };
    });
    vi.stubGlobal('fetch', transport);
    const pay = vi.fn(async () => ({ providerPaymentId: 'pay_fixture', providerSignature: 'b'.repeat(64) }));
    render(<LanguageProvider><UpcomingCheckoutPreview period="MORNING" lines={[{ item: MENU_CATALOG.find(x => x.id === 'idly')!, quantity: 4 }]} subtotalPaisa={12000} te={false} isolatedCheckout={{ latitude: 17.485, longitude: 78.235, pay }} /></LanguageProvider>);
    for (const [label, value] of [['Name', 'Test Customer'], ['Mobile', '9000000001'], ['Delivery address', 'Test address Kollur']]) fireEvent.change(screen.getByLabelText(label!), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Check preview details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Test checkout' }));
    await waitFor(() => expect(screen.getByText('Payment verified. Order confirmed.')).toBeTruthy());
    expect(pay).toHaveBeenCalledTimes(1);
    expect(pay).toHaveBeenCalledWith(expect.objectContaining({ amountPaisa: 12000 }));
    expect(screen.getByRole('button', { name: 'Track order' })).toBeTruthy();
    expect(transport).toHaveBeenCalledTimes(3);
  });
  it('renders saved item prices, quantities and units', () => {
    render(<LanguageProvider><OrderItemLines items={[{ itemId: 'idly', nameEn: 'Idly', nameTe: 'ఇడ్లీ', quantity: 4, saleUnit: 'PLATE', piecesPerUnit: 4, unitPricePaisa: 3000, lineTotalPaisa: 12000 }]} /></LanguageProvider>);
    expect(screen.getByRole('list', { name: 'Order items' }).textContent).toContain('4 plates — ₹120.00');
  });
  it('blocks production driver calls before fetch and never retries an ambiguous payment popup', async () => {
    const transport = vi.fn();
    vi.stubEnv('MODE', 'production');
    await expect(createInactiveMenuCheckoutSession(request, vi.fn(), transport).run()).rejects.toThrow('not available');
    expect(transport).not.toHaveBeenCalled();
    vi.stubEnv('MODE', 'test');
    transport.mockResolvedValueOnce({ ok: true, json: async () => ({ orderId, customerAccessToken: token }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ orderId, publicKeyId: 'rzp_test_fixture', amountPaisa: 12000, currency: 'INR', expiresAtMs: Date.now()+60000 }) });
    const pay = vi.fn(async () => { throw new Error('lost popup response'); });
    const session = createInactiveMenuCheckoutSession(request, pay, transport);
    await expect(session.run()).rejects.toThrow('lost popup');
    await expect(session.run()).rejects.toThrow('outcome unknown');
    expect(pay).toHaveBeenCalledTimes(1);
  });
});
