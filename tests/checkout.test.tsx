// @vitest-environment jsdom
import React from 'react';
import { webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createCheckout, clearPendingCheckout, type CheckoutDraft, type CheckoutIntent } from '../src/utils/checkout';
import { PaymentModal } from '../src/components/PaymentModal';

vi.mock('../src/context/LanguageContext', () => ({ useLanguage: () => ({ language: 'en' }) }));

const draft: CheckoutDraft = {
  jowarQuantity: 2, chapathiQuantity: 2,
  karamSelection: { karivepaku: true, aviseGinjalu: false },
  customer: { name: 'Fixture Customer', mobile: '9000000001', address: 'Fixture address', latitude: 17.4782, longitude: 78.2323 },
};
const intent: CheckoutIntent = {
  intentId: 'intent_fixture', orderId: 'SMJR-FIXTURE-001', customerAccessToken: 'tracking_fixture',
  provider: 'razorpay', amountPaisa: 10725, amountRupees: 107.25, subtotalRupees: 80,
  deliveryChargeRupees: 27.25, distanceKm: 8.03, currency: 'INR',
  providerDetails: { keyId: 'fixture_public_key', orderId: 'order_fixture_gateway' },
};
const gatewayResult = {
  razorpay_payment_id: 'pay_fixture', razorpay_order_id: intent.providerDetails!.orderId,
  razorpay_signature: 'fixture_signature',
};
const paidResult = {
  isPaid: true, ticketGenerated: true, ticket: 'Fixture verified ticket',
  order: { id: intent.orderId, paymentStatus: 'PAID', orderStatus: 'TICKET_GENERATED' },
};
const response = (data: unknown, ok = true) => ({ ok, json: async () => data }) as Response;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

let fetchMock: Mock<(url: string, init?: RequestInit) => Promise<Response>>;
let options: Record<string, any> | undefined;
let paymentFailed: ((result: any) => void) | undefined;
let openGateway: Mock<() => void>;
function installGateway() {
  openGateway = vi.fn();
  window.Razorpay = class {
    constructor(configuration: Record<string, any>) { options = configuration; }
    open() { openGateway(); }
    on(event: string, callback: (result: any) => void) {
      if (event === 'payment.failed') paymentFailed = callback;
    }
  };
}
function mockPaymentApi(verify: () => Promise<Response> = async () => response(paidResult), status: unknown = { isPaid: false, ticketGenerated: false }) {
  fetchMock.mockImplementation((url: string) => {
    if (url === '/api/payment/create-intent') return Promise.resolve(response(intent));
    if (url === '/api/payment/verify') return verify();
    if (url.startsWith('/api/payment/status/')) return Promise.resolve(response(status));
    throw new Error(`Unexpected network request: ${url}`);
  });
}
async function showPayment() {
  const success = vi.fn();
  render(<PaymentModal isOpen orderData={draft} onClose={vi.fn()} onPaymentSuccess={success} />);
  const pay = await screen.findByRole('button', { name: 'Pay ₹107.25 with Razorpay' });
  return { success, pay };
}
async function openPayment() {
  const state = await showPayment();
  fireEvent.click(state.pay);
  await waitFor(() => expect(openGateway).toHaveBeenCalledOnce());
  return state;
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); clearPendingCheckout('fixture_reset');
  vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('TextEncoder', TextEncoder);
  fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
  options = undefined; paymentFailed = undefined; installGateway();
});
afterEach(() => {
  cleanup(); clearPendingCheckout(intent.intentId);
  delete window.Razorpay;
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe('Checkout retries and customer tracking', () => {
  it('shares one create request across concurrent submissions of the same cart', async () => {
    const pending = deferred<Response>();
    fetchMock.mockReturnValue(pending.promise);
    const first = createCheckout(draft);
    const second = createCheckout(structuredClone(draft));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0]).toEqual(['/api/payment/create-intent', expect.objectContaining({
      method: 'POST', body: JSON.stringify(draft),
    })]);
    pending.resolve(response(intent));
    expect(await first).toEqual(intent);
    expect(await second).toEqual(intent);
  });

  it('saves pending tracking access before payment and reuses a valid saved checkout', async () => {
    fetchMock.mockResolvedValue(response(intent));
    await createCheckout(draft);
    expect(JSON.parse(localStorage.getItem('smjr_customer_orders')!)).toEqual([
      expect.objectContaining({ id: intent.orderId, customerAccessToken: intent.customerAccessToken, status: 'PENDING' }),
    ]);
    expect(JSON.parse(sessionStorage.getItem('smjr_pending_checkout')!)).toMatchObject({ intent });
    fetchMock.mockClear();
    expect(await createCheckout(draft)).toEqual(intent);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('smjr_customer_orders')!)).toHaveLength(1);
  });

  it('lets a failed initialization make a fresh request instead of caching the rejection', async () => {
    fetchMock.mockResolvedValueOnce(response({ error: { message: 'Temporary payment outage' } }, false))
      .mockResolvedValueOnce(response(intent));
    await expect(createCheckout(draft)).rejects.toThrow('Temporary payment outage');
    expect(localStorage.getItem('smjr_customer_orders')).toBeNull();
    expect(await createCheckout(draft)).toEqual(intent);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('creates a fresh intent after the saved checkout expires', async () => {
    fetchMock.mockResolvedValueOnce(response(intent))
      .mockResolvedValueOnce(response({ ...intent, intentId: 'intent_fresh', orderId: 'SMJR-FIXTURE-002' }));
    await createCheckout(draft);
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 30 * 60 * 1000);
    expect((await createCheckout(draft)).intentId).toBe('intent_fresh');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('offers a working retry in the payment dialog after initialization fails', async () => {
    let attempts = 0;
    fetchMock.mockImplementation((url: string) => Promise.resolve(url === '/api/payment/create-intent'
      ? ++attempts === 1 ? response({ error: { message: 'Temporary payment outage' } }, false) : response(intent)
      : response({ isPaid: false, ticketGenerated: false })));
    render(<PaymentModal isOpen orderData={draft} onClose={vi.fn()} onPaymentSuccess={vi.fn()} />);
    expect((await screen.findByRole('alert')).textContent).toContain('Temporary payment outage');
    fireEvent.click(await screen.findByRole('button', { name: /retry|try again/i }));
    expect(await screen.findByRole('button', { name: 'Pay ₹107.25 with Razorpay' })).toBeTruthy();
    expect(attempts).toBe(2);
  });
});

describe('Authoritative customer payment confirmation', () => {
  it('passes the exact server paise amount, currency and gateway order to Razorpay', async () => {
    mockPaymentApi();
    const { success } = await openPayment();
    expect(options).toMatchObject({
      key: intent.providerDetails!.keyId, order_id: intent.providerDetails!.orderId,
      amount: 10725, currency: 'INR', prefill: { name: draft.customer.name, contact: draft.customer.mobile },
    });
    expect(success).not.toHaveBeenCalled();
  });

  it('waits for the server verification response before success, then completes exactly once', async () => {
    const verification = deferred<Response>();
    mockPaymentApi(() => verification.promise);
    const { success } = await openPayment();
    let handling!: Promise<void>;
    act(() => { handling = options!.handler(gatewayResult); });
    expect(success).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith('/api/payment/verify', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ intentId: intent.intentId, providerPaymentId: 'pay_fixture', providerSignature: 'fixture_signature' }),
    }));
    await act(async () => { verification.resolve(response(paidResult)); await handling; });
    expect(success).toHaveBeenCalledOnce();
    expect(success).toHaveBeenCalledWith(expect.objectContaining({
      paymentStatus: 'PAID', orderStatus: 'TICKET_GENERATED', customerAccessToken: intent.customerAccessToken,
      ticketText: 'Fixture verified ticket',
    }));
    expect(sessionStorage.getItem('smjr_pending_checkout')).toBeNull();
    await act(async () => { await options!.handler(gatewayResult); });
    expect(success).toHaveBeenCalledOnce();
  });

  it.each([
    { paymentStatus: 'PENDING', orderStatus: 'PENDING' },
    { paymentStatus: 'PAID', orderStatus: 'PAID' },
    { paymentStatus: 'FAILED', orderStatus: 'TICKET_GENERATED' },
  ])('does not confirm when the server order is $paymentStatus/$orderStatus', async incompleteOrder => {
    mockPaymentApi(async () => response({ order: { ...paidResult.order, ...incompleteOrder } }));
    const { success } = await openPayment();
    await act(async () => { await options!.handler(gatewayResult); });
    expect(success).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('smjr_pending_checkout')).not.toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('Payment confirmation is pending');
    expect((screen.getByRole('button', { name: 'Pay ₹107.25 with Razorpay' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('does not confirm when the server rejects verification, even if the body claims a paid ticket', async () => {
    mockPaymentApi(async () => response({ ...paidResult, error: { message: 'Fixture signature rejected' } }, false));
    const { success } = await openPayment();
    await act(async () => { await options!.handler(gatewayResult); });
    expect(screen.getByRole('alert').textContent).toContain('Fixture signature rejected');
    expect(success).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('smjr_pending_checkout')).not.toBeNull();
  });

  it('never treats gateway payment failure as order success and allows another attempt', async () => {
    mockPaymentApi();
    const { success } = await openPayment();
    act(() => { paymentFailed!({ error: { description: 'Payment declined by fixture bank' } }); });
    expect(screen.getByRole('alert').textContent).toContain('Payment declined by fixture bank');
    expect((screen.getByRole('button', { name: 'Pay ₹107.25 with Razorpay' }) as HTMLButtonElement).disabled).toBe(false);
    expect(success).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/payment/verify')).toHaveLength(0);
    expect(localStorage.getItem('smjr_customer_orders')).toContain(intent.customerAccessToken);
  });

  it('rejects an unrelated gateway order before asking the server to verify', async () => {
    mockPaymentApi();
    const { success } = await openPayment();
    await act(async () => { await options!.handler({ ...gatewayResult, razorpay_order_id: 'order_unrelated' }); });
    expect(screen.getByRole('alert').textContent).toContain('Payment order mismatch');
    expect(success).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/payment/verify')).toHaveLength(0);
  });

  it('confirms a server-generated ticket through customer status polling without an SDK callback', async () => {
    mockPaymentApi(undefined, paidResult);
    const success = vi.fn();
    render(<PaymentModal isOpen orderData={draft} onClose={vi.fn()} onPaymentSuccess={success} />);
    await waitFor(() => expect(success).toHaveBeenCalledOnce());
    expect(success).toHaveBeenCalledWith(expect.objectContaining({ paymentStatus: 'PAID', orderStatus: 'TICKET_GENERATED' }));
    expect(openGateway).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith('/api/payment/status/tracking_fixture', { cache: 'no-store' });
  });
});
