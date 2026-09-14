import crypto from 'crypto';
import { getDb } from '../db/index.ts';
import { PaymentIntent } from '../payments/provider.ts';
import { BUSINESS_CONFIG } from '../config/business.ts';

export interface FinalOrderResult {
  orderId: string;
  customerAccessToken: string;
  order: {
    id: string;
    createdAtUtc: string;
    createdAtIst: string;
    deliveryDate: string;
    deliveryWindow: string;
    jowarQuantity: number;
    chapathiQuantity: number;
    totalItems: number;
    karivepakuGrams: number;
    aviseGrams: number;
    jowarUnitPrice: number;
    chapathiUnitPrice: number;
    subtotal: number;
    deliveryCharge: number;
    totalAmount: number;
    currency: string;
    paymentStatus: string;
    fulfillmentStatus: string;
    customerName: string;
    customerMobile: string;
    address: string;
    landmark?: string;
    distanceKm: number;
    locationLink?: string;
    paymentProvider: string;
    providerPaymentId: string;
  };
}

export async function createOrderFromVerifiedPayment(
  intent: PaymentIntent,
  providerPaymentId: string,
  providerSignature?: string
): Promise<FinalOrderResult> {
  const db = getDb();

  // Check idempotency: if payment with this providerPaymentId already exists
  const existingPayment = await db.execute({
    sql: 'SELECT order_id FROM payments WHERE provider_payment_id = ? LIMIT 1',
    args: [providerPaymentId],
  });

  if (existingPayment.rows.length > 0) {
    const existingOrderId = String(existingPayment.rows[0]?.order_id);
    const existingOrderRow = await db.execute({
      sql: 'SELECT * FROM orders WHERE id = ? LIMIT 1',
      args: [existingOrderId],
    });
    if (existingOrderRow.rows.length > 0) {
      throw new Error(`Payment ${providerPaymentId} has already been recorded for order ${existingOrderId}.`);
    }
  }

  // Generate canonical sequential/unique order ID
  const todayStr = intent.orderPricing.deliveryDate.replace(/-/g, '');
  const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  const orderId = `SMJR-${todayStr}-${randomSuffix}`;

  // High-entropy 256-bit customer access token
  const customerAccessToken = crypto.randomBytes(32).toString('hex');
  const publicTokenHash = crypto.createHash('sha256').update(customerAccessToken).digest('hex');

  const nowUtc = new Date().toISOString();
  // Formatted IST for display
  const istDate = new Date(Date.now() + (5 * 60 + 30) * 60 * 1000);
  const istFormatted = `${istDate.getUTCDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][istDate.getUTCMonth()]} ${istDate.getUTCFullYear()}, ${String(istDate.getUTCHours()).padStart(2, '0')}:${String(istDate.getUTCMinutes()).padStart(2, '0')} IST`;

  const pricing = intent.orderPricing;
  const customer = intent.customer;

  const paymentId = `PAY-${crypto.randomBytes(8).toString('hex')}`;

  // SQLite Batch Transaction: Order, Payment, Audit Log
  await db.batch([
    {
      sql: `INSERT INTO orders (
        id, public_token_hash, created_at_utc, created_at_ist, delivery_date, delivery_window,
        jowar_quantity, chapathi_quantity, total_items, karivepaku_grams, avise_grams,
        jowar_unit_price_paisa, chapathi_unit_price_paisa, subtotal_paisa, delivery_charge_paisa, total_amount_paisa,
        currency, payment_status, payment_provider, provider_payment_id, fulfillment_status,
        customer_name, customer_mobile, address, landmark, latitude, longitude, distance_km,
        location_link, location_verified, created_by, updated_at, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        orderId,
        publicTokenHash,
        nowUtc,
        istFormatted,
        pricing.deliveryDate,
        pricing.deliveryWindow,
        pricing.jowarQuantity,
        pricing.chapathiQuantity,
        pricing.totalItems,
        pricing.karamQuantities.karivepakuGrams,
        pricing.karamQuantities.aviseGinjaluGrams,
        pricing.jowarUnitPricePaisa,
        pricing.chapathiUnitPricePaisa,
        pricing.subtotalPaisa,
        pricing.deliveryChargePaisa,
        pricing.totalAmountPaisa,
        'INR',
        'PAID',
        intent.provider,
        providerPaymentId,
        'RECEIVED',
        customer.name,
        customer.mobile,
        customer.address,
        customer.landmark || '',
        customer.latitude ?? null,
        customer.longitude ?? null,
        pricing.deliveryDistanceKm,
        customer.locationLink || null,
        customer.latitude && customer.longitude ? 1 : 0,
        'CUSTOMER',
        nowUtc,
        'SYSTEM',
      ],
    },
    {
      sql: `INSERT INTO payments (
        id, order_id, provider, provider_payment_id, amount_paisa, status, signature, raw_payload, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        paymentId,
        orderId,
        intent.provider,
        providerPaymentId,
        pricing.totalAmountPaisa,
        'SUCCESS',
        providerSignature || null,
        JSON.stringify({ verifiedAt: nowUtc, provider: intent.provider }),
        nowUtc,
      ],
    },
    {
      sql: `INSERT INTO audit_logs (
        id, actor_type, actor_id, action, target_type, target_id, details, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `AUD-${crypto.randomBytes(8).toString('hex')}`,
        'SYSTEM',
        'PAYMENT_WEBHOOK',
        'ORDER_CREATED_AND_PAID',
        'ORDER',
        orderId,
        JSON.stringify({
          provider: intent.provider,
          paymentId: providerPaymentId,
          amountRupees: Math.round(pricing.totalAmountPaisa / 100),
          customerMobile: customer.mobile,
        }),
        nowUtc,
      ],
    },
  ]);

  return {
    orderId,
    customerAccessToken,
    order: {
      id: orderId,
      createdAtUtc: nowUtc,
      createdAtIst: istFormatted,
      deliveryDate: pricing.deliveryDate,
      deliveryWindow: pricing.deliveryWindow,
      jowarQuantity: pricing.jowarQuantity,
      chapathiQuantity: pricing.chapathiQuantity,
      totalItems: pricing.totalItems,
      karivepakuGrams: pricing.karamQuantities.karivepakuGrams,
      aviseGrams: pricing.karamQuantities.aviseGinjaluGrams,
      jowarUnitPrice: Math.round(pricing.jowarUnitPricePaisa / 100),
      chapathiUnitPrice: Math.round(pricing.chapathiUnitPricePaisa / 100),
      subtotal: Math.round(pricing.subtotalPaisa / 100),
      deliveryCharge: Math.round(pricing.deliveryChargePaisa / 100),
      totalAmount: Math.round(pricing.totalAmountPaisa / 100),
      currency: 'INR',
      paymentStatus: 'PAID',
      fulfillmentStatus: 'RECEIVED',
      customerName: customer.name,
      customerMobile: customer.mobile,
      address: customer.address,
      landmark: customer.landmark,
      distanceKm: pricing.deliveryDistanceKm,
      locationLink: customer.locationLink,
      paymentProvider: intent.provider,
      providerPaymentId,
    },
  };
}

export async function getOrderByCustomerToken(tokenOrId: string) {
  if (!tokenOrId || typeof tokenOrId !== 'string') {
    return null;
  }
  const clean = tokenOrId.trim();
  const tokenHash = crypto.createHash('sha256').update(clean).digest('hex');
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT * FROM orders WHERE public_token_hash = ? OR id = ? LIMIT 1',
    args: [tokenHash, clean],
  });

  if (res.rows.length === 0) {
    return null;
  }

  const row = res.rows[0]!;
  return {
    id: String(row.id),
    createdAtUtc: String(row.created_at_utc),
    createdAtIst: String(row.created_at_ist),
    deliveryDate: String(row.delivery_date),
    deliveryWindow: String(row.delivery_window),
    jowarQuantity: Number(row.jowar_quantity),
    chapathiQuantity: Number(row.chapathi_quantity),
    totalItems: Number(row.total_items),
    karivepakuGrams: Number(row.karivepaku_grams),
    aviseGrams: Number(row.avise_grams),
    jowarUnitPrice: Math.round(Number(row.jowar_unit_price_paisa) / 100),
    chapathiUnitPrice: Math.round(Number(row.chapathi_unit_price_paisa) / 100),
    subtotal: Math.round(Number(row.subtotal_paisa) / 100),
    deliveryCharge: Math.round(Number(row.delivery_charge_paisa) / 100),
    totalAmount: Math.round(Number(row.total_amount_paisa) / 100),
    currency: String(row.currency),
    paymentStatus: String(row.payment_status),
    paymentProvider: String(row.payment_provider),
    providerPaymentId: String(row.provider_payment_id),
    fulfillmentStatus: String(row.fulfillment_status),
    customerName: String(row.customer_name),
    customerMobile: String(row.customer_mobile),
    address: String(row.address),
    landmark: row.landmark ? String(row.landmark) : undefined,
    distanceKm: Number(row.distance_km),
    locationLink: row.location_link ? String(row.location_link) : undefined,
    receivedAt: row.received_at ? String(row.received_at) : undefined,
    updatedAt: String(row.updated_at),
  };
}

export async function markOrderReceivedByCustomer(tokenOrId: string) {
  const clean = tokenOrId.trim();
  const tokenHash = crypto.createHash('sha256').update(clean).digest('hex');
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT id, fulfillment_status, customer_name FROM orders WHERE public_token_hash = ? OR id = ? LIMIT 1',
    args: [tokenHash, clean],
  });

  if (res.rows.length === 0) {
    throw new Error('Order not found or unauthorized customer access token');
  }

  const row = res.rows[0]!;
  const orderId = String(row.id);
  const nowUtc = new Date().toISOString();

  await db.batch([
    {
      sql: `UPDATE orders SET
        fulfillment_status = 'DELIVERED',
        received_at = ?,
        received_by = 'CUSTOMER',
        updated_at = ?,
        updated_by = 'CUSTOMER'
      WHERE id = ?`,
      args: [nowUtc, nowUtc, orderId],
    },
    {
      sql: `INSERT INTO audit_logs (id, actor_type, actor_id, action, target_type, target_id, details, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `AUD-${crypto.randomBytes(8).toString('hex')}`,
        'CUSTOMER',
        String(row.customer_name),
        'CONFIRMED_DELIVERY_RECEIPT',
        'ORDER',
        orderId,
        JSON.stringify({ markedReceivedAt: nowUtc }),
        nowUtc,
      ],
    },
  ]);

  return { success: true, orderId, markedReceivedAt: nowUtc };
}

export async function submitOrderFeedback(
  tokenOrId: string,
  rating: number,
  comment?: string
) {
  const clean = tokenOrId.trim();
  const tokenHash = crypto.createHash('sha256').update(clean).digest('hex');
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT id, customer_name FROM orders WHERE public_token_hash = ? OR id = ? LIMIT 1',
    args: [tokenHash, clean],
  });

  if (res.rows.length === 0) {
    throw new Error('Order not found or unauthorized customer access token');
  }

  const row = res.rows[0]!;
  const orderId = String(row.id);
  const customerName = String(row.customer_name);
  const nowUtc = new Date().toISOString();

  // Check if feedback already submitted
  const existing = await db.execute({
    sql: 'SELECT id FROM feedback WHERE order_id = ? LIMIT 1',
    args: [orderId],
  });

  if (existing.rows.length > 0) {
    // Update existing feedback
    const feedbackId = String(existing.rows[0]?.id);
    await db.execute({
      sql: 'UPDATE feedback SET rating = ?, comment = ?, created_at = ? WHERE id = ?',
      args: [rating, comment || null, nowUtc, feedbackId],
    });
    return { success: true, feedbackId, updated: true };
  }

  const feedbackId = `FDB-${crypto.randomBytes(8).toString('hex')}`;
  await db.batch([
    {
      sql: `INSERT INTO feedback (id, order_id, customer_name, rating, comment, is_public, created_at)
            VALUES (?, ?, ?, ?, ?, 1, ?)`,
      args: [feedbackId, orderId, customerName, rating, comment || null, nowUtc],
    },
    {
      sql: `INSERT INTO audit_logs (id, actor_type, actor_id, action, target_type, target_id, details, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `AUD-${crypto.randomBytes(8).toString('hex')}`,
        'CUSTOMER',
        customerName,
        'SUBMITTED_FEEDBACK',
        'FEEDBACK',
        feedbackId,
        JSON.stringify({ orderId, rating }),
        nowUtc,
      ],
    },
  ]);

  return { success: true, feedbackId, updated: false };
}
