import { describe, expect, it } from 'vitest';
import type { Order } from '../src/types.ts';
import { createWhatsAppOrderUpdate, normalizeWhatsAppMobile } from '../src/utils/whatsappOrderUpdates.ts';

const paidOrder = {
  id: 'MENU-00000000-0000-4000-8000-000000000001',
  customerName: 'Test Customer',
  customerMobile: '9876543210',
  deliveryDate: '2026-10-14',
  deliveryWindow: '07:00-11:00',
  paymentStatus: 'PAID',
  fulfillmentStatus: 'RECEIVED',
  customerAccessToken: 'private-token-never-share',
  providerPaymentId: 'pay_private',
  address: 'Private street address',
} as unknown as Order;

describe('Owner WhatsApp Updates V1 (manual drafts only)', () => {
  it('formats valid Indian numbers, avoids double prefix, blocks unsafe inputs', () => {
    for (const input of ['9876543210', '+919876543210', '919876543210', '+91 98765-43210', '(98765) 43210']) {
      expect(normalizeWhatsAppMobile(input)).toBe('919876543210');
    }
    for (const input of ['', '123', '1234567890', '019876543210', '+91919876543210', '+199876543210', '98765\n43210', null]) {
      expect(normalizeWhatsAppMobile(input)).toBeNull();
    }
  });

  it.each([
    ['RECEIVED', 'is confirmed.', 'Order confirmed'],
    ['PREPARING', 'is being prepared.', 'Preparing'],
    ['OUT_FOR_DELIVERY', 'is out for delivery.', 'Out for delivery'],
    ['DELIVERED', 'has been marked delivered.', 'Delivered'],
  ] as const)('matches %s to correct message and label', (status, phrase, label) => {
    const update = createWhatsAppOrderUpdate({ ...paidOrder, fulfillmentStatus: status }, 'en');
    expect(update?.label).toBe(label);
    expect(update?.message).toContain(phrase);
    expect(update?.message).toContain(paidOrder.id);
    expect(update?.url.startsWith('https://wa.me/919876543210?text=')).toBe(true);
    expect(decodeURIComponent(update!.url.split('?text=')[1]!)).toBe(update?.message);
    expect(update?.message).not.toContain('6 and 8 PM');
    expect(update?.message).not.toContain('private-token-never-share');
    expect(update?.message).not.toContain('pay_private');
    expect(update?.message).not.toContain('Private street address');
  });

  it('uses saved morning/evening delivery date and window without inventing one', () => {
    const morning = createWhatsAppOrderUpdate(paidOrder, 'en');
    expect(morning?.message).toContain('2026-10-14 · 07:00-11:00 IST');
    const evening = createWhatsAppOrderUpdate({ ...paidOrder, deliveryWindow: '18:00-20:00' }, 'en');
    expect(evening?.message).toContain('2026-10-14 · 18:00-20:00 IST');
    const unknown = createWhatsAppOrderUpdate({ ...paidOrder, deliveryWindow: '' }, 'en');
    expect(unknown?.message).not.toContain('Delivery:');
    const delivered = createWhatsAppOrderUpdate({ ...paidOrder, fulfillmentStatus: 'DELIVERED' }, 'en');
    expect(delivered?.message).not.toContain('Delivery:');
  });

  it('supports Telugu and sanitized customer name', () => {
    const update = createWhatsAppOrderUpdate({ ...paidOrder, customerName: 'Test\nCustomer' }, 'te');
    expect(update?.label).toBe('ఆర్డర్ ధృవీకరించబడింది');
    expect(update?.message).toContain('నమస్కారం Test Customer గారు');
    expect(update?.message).toContain('డెలివరీ: 2026-10-14 · 07:00-11:00 IST');
    expect(update?.message).not.toContain('Test\nCustomer');
  });

  it('returns no draft for unpaid, refunded, failed, cancelled, invalid phone or missing ID', () => {
    for (const override of [
      { paymentStatus: 'PENDING' }, { paymentStatus: 'FAILED' },
      { paymentStatus: 'REFUNDED' }, { paymentStatus: 'PAY_ON_DELIVERY' },
      { fulfillmentStatus: 'CANCELLED' },
      { customerMobile: 'bad', customer: { mobile: 'bad' } },
      { id: '' },
    ]) expect(createWhatsAppOrderUpdate({ ...paidOrder, ...override } as Order, 'en')).toBeNull();
  });

  it('accepts valid fallback mobile without including private data in WhatsApp draft', () => {
    const update = createWhatsAppOrderUpdate({
      ...paidOrder, customerMobile: '', customer: { name: 'Fallback', mobile: '+919876543210', address: 'Test address' },
    }, 'en');
    expect(update?.url).toContain('wa.me/919876543210?');
    expect(update?.message).not.toContain('private-token-never-share');
  });
});
