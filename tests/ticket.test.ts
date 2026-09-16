import { describe, it, expect } from 'vitest';
import { generateServerOrderTicket, type OrderForTicket } from '../server/services/ticketService.ts';

describe('Server WhatsApp Ticket Generation', () => {
  const sampleOrder: OrderForTicket = {
    id: 'MEV-2026-0001',
    createdAtIst: '15 Sep 2026, 12:30 IST',
    deliveryDate: '2026-09-15',
    deliveryWindow: '18:00-20:00 (6:00 PM - 8:00 PM)',
    jowarQuantity: 4,
    chapathiQuantity: 2,
    jowarUnitPrice: 30,
    chapathiUnitPrice: 10,
    subtotal: 140,
    deliveryCharge: 0,
    totalAmount: 140,
    karivepakuGrams: 40,
    aviseGrams: 20,
    customerName: 'Anand Rao',
    customerMobile: '9848022338',
    address: 'Flat 302, Sai Residency, Ameerpet',
    landmark: 'Opposite Metro Pillar A20',
    distanceKm: 3.2,
    providerPaymentId: 'pay_test123456789',
    paymentProvider: 'razorpay',
  };

  it('generates a Telugu order ticket with correct customer details and prices', () => {
    const ticket = generateServerOrderTicket(sampleOrder, 'te');

    expect(ticket).toContain('మన ఇంటి వంట');
    expect(ticket).toContain('MEV-2026-0001');
    expect(ticket).toContain('Anand Rao');
    expect(ticket).toContain('9848022338');
    expect(ticket).toContain('4 రొట్టెలు');
    expect(ticket).toContain('2 చపాతీలు');
    expect(ticket).toContain('₹140');
    expect(ticket).toContain('కరివేపాకు కారం');
    expect(ticket).toContain('అవిసె గింజల కారం');
    expect(ticket).toContain('pay_test123456789');
    expect(ticket).toContain('12:30 IST');
    expect(ticket).not.toContain('UTC');
  });

  it('generates an English order ticket when requested', () => {
    const ticket = generateServerOrderTicket(sampleOrder, 'en');

    expect(ticket).toContain('MANA ENTI VANTA');
    expect(ticket).toContain('MEV-2026-0001');
    expect(ticket).toContain('Anand Rao');
    expect(ticket).toContain('4 rotis');
    expect(ticket).toContain('2 chapathis');
    expect(ticket).toContain('₹140');
    expect(ticket).toContain('Curry Leaf Podi');
    expect(ticket).toContain('Flax Seeds Podi');
    expect(ticket).toContain('pay_test123456789');
    expect(ticket).toContain('12:30 IST');
    expect(ticket).not.toContain('UTC');
  });
});
