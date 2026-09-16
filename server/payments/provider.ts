import crypto from 'crypto';
import { BUSINESS_CONFIG } from '../config/business.ts';
import { calculateDelivery } from '../services/deliveryService.ts';
import { getOrderingStatus } from '../services/timeService.ts';
import type { CreatePaymentIntentInput } from '../validation/schemas.ts';
import { createPendingOrder } from '../services/orderService.ts';
import { getDb, withDbRetry } from '../db/index.ts';

export interface CalculatedOrderPricing {
  jowarQuantity: number;
  chapathiQuantity: number;
  totalItems: number;
  karamSelection: {
    karivepaku: boolean;
    aviseGinjalu: boolean;
  };
  karamQuantities: {
    karivepakuGrams: number;
    aviseGinjaluGrams: number;
  };
  jowarUnitPricePaisa: number;
  chapathiUnitPricePaisa: number;
  subtotalPaisa: number;
  deliveryDistanceKm: number;
  deliveryChargePaisa: number;
  totalAmountPaisa: number;
  deliveryDate: string;
  deliveryWindow: string;
}

export interface PaymentIntent {
  intentId: string;
  orderId?: string;
  customerAccessToken?: string;
  provider: 'mock' | 'razorpay' | 'phonepe';
  orderPricing: CalculatedOrderPricing;
  customer: CreatePaymentIntentInput['customer'];
  createdAt: number;
  expiresAt: number;
  upiUri?: string;
  isVerified?: boolean;
  // If in development mock mode:
  mockVerificationToken?: string;
  // If in production provider mode:
  providerOrderId?: string;
  providerKey?: string;
}

// In-memory cache for short-lived payment intents (TTL: 30 minutes)
const paymentIntentsMap = new Map<string, PaymentIntent>();

// Prune expired intents periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, intent] of paymentIntentsMap.entries()) {
    if (intent.expiresAt < now) {
      paymentIntentsMap.delete(key);
    }
  }
}, 60 * 1000);

export async function getIntent(intentId: string): Promise<PaymentIntent | undefined> {
  const cached = paymentIntentsMap.get(intentId);
  if (cached) return cached;

  try {
    const db = getDb();
    const res = await withDbRetry(async () =>
      db.execute({
        sql: 'SELECT * FROM payment_intents WHERE id = ? LIMIT 1',
        args: [intentId],
      })
    );

    if (res.rows.length === 0) return undefined;
    const row = res.rows[0]!;

    if (Number(row.expires_at) < Date.now()) {
      return undefined;
    }

    const orderRes = await withDbRetry(async () =>
      db.execute({
        sql: 'SELECT * FROM orders WHERE id = ? LIMIT 1',
        args: [String(row.order_id)],
      })
    );

    if (orderRes.rows.length === 0) return undefined;
    const oRow = orderRes.rows[0]!;

    const intent: PaymentIntent = {
      intentId: String(row.id),
      orderId: String(row.order_id),
      provider: String(row.provider) as any,
      providerOrderId: row.provider_order_id ? String(row.provider_order_id) : undefined,
      mockVerificationToken: row.mock_verification_token ? String(row.mock_verification_token) : undefined,
      isVerified: Boolean(row.is_verified),
      createdAt: Number(row.created_at),
      expiresAt: Number(row.expires_at),
      orderPricing: {
        jowarQuantity: Number(oRow.jowar_quantity),
        chapathiQuantity: Number(oRow.chapathi_quantity),
        totalItems: Number(oRow.total_items),
        karamSelection: {
          karivepaku: Number(oRow.karivepaku_grams) > 0,
          aviseGinjalu: Number(oRow.avise_grams) > 0,
        },
        karamQuantities: {
          karivepakuGrams: Number(oRow.karivepaku_grams),
          aviseGinjaluGrams: Number(oRow.avise_grams),
        },
        jowarUnitPricePaisa: Number(oRow.jowar_unit_price_paisa),
        chapathiUnitPricePaisa: Number(oRow.chapathi_unit_price_paisa),
        subtotalPaisa: Number(oRow.subtotal_paisa),
        deliveryDistanceKm: Number(oRow.distance_km),
        deliveryChargePaisa: Number(oRow.delivery_charge_paisa),
        totalAmountPaisa: Number(oRow.total_amount_paisa),
        deliveryDate: String(oRow.delivery_date),
        deliveryWindow: String(oRow.delivery_window),
      },
      customer: {
        name: String(oRow.customer_name),
        mobile: String(oRow.customer_mobile),
        address: String(oRow.address),
        landmark: oRow.landmark ? String(oRow.landmark) : '',
        latitude: oRow.latitude ? Number(oRow.latitude) : undefined,
        longitude: oRow.longitude ? Number(oRow.longitude) : undefined,
        locationLink: oRow.location_link ? String(oRow.location_link) : undefined,
      },
    };

    paymentIntentsMap.set(intentId, intent);
    return intent;
  } catch {
    return undefined;
  }
}

export async function findIntentByOrderId(orderIdOrProviderOrderId: string): Promise<PaymentIntent | undefined> {
  for (const intent of paymentIntentsMap.values()) {
    if (intent.orderId === orderIdOrProviderOrderId || intent.providerOrderId === orderIdOrProviderOrderId) {
      return intent;
    }
  }

  try {
    const db = getDb();
    const res = await withDbRetry(async () =>
      db.execute({
        sql: 'SELECT id FROM payment_intents WHERE order_id = ? OR provider_order_id = ? LIMIT 1',
        args: [orderIdOrProviderOrderId, orderIdOrProviderOrderId],
      })
    );

    if (res.rows.length > 0) {
      return await getIntent(String(res.rows[0]?.id));
    }
  } catch {}

  return undefined;
}

/**
 * Authoritatively calculates server-side pricing, limits, and delivery charge.
 * Client-submitted totals are never trusted.
 */
export function calculateAuthoritativePricing(
  input: CreatePaymentIntentInput
): CalculatedOrderPricing {
  // 1. Check ordering schedule
  const orderingStatus = getOrderingStatus();
  // Allow ordering outside hours if non-production dev mode or open
  if (!orderingStatus.isOpen && process.env.NODE_ENV === 'production') {
    throw new Error(
      `ఆర్డరింగ్ సమయం ముగిసింది. ఆర్డర్లు ఉదయం 11:00 నుండి సాయంత్రం 4:00 (16:00 IST) వరకు మాత్రమే స్వీకరించబడతాయి. డెలివరీలు సాయంత్రం 6:00 – 8:00 మధ్య జరుగుతాయి. తదుపరి డెలివరీ తేదీ: ${orderingStatus.deliveryDateFormattedEn} (${orderingStatus.deliveryDateFormattedTe}). Ordering cutoff is 4:00 PM (16:00 IST). Deliveries occur 6:00 PM – 8:00 PM. Next available delivery date: ${orderingStatus.deliveryDateFormattedEn}.`
    );
  }

  // 2. Validate quantities
  const jowarQty = input.jowarQuantity;
  const chapathiQty = input.chapathiQuantity;
  const totalItems = jowarQty + chapathiQty;

  if (totalItems < 1) {
    throw new Error('Please select at least 1 roti or chapathi.');
  }

  const jowarUnitPricePaisa = BUSINESS_CONFIG.prices.jowarRotiPaisa;
  const chapathiUnitPricePaisa = BUSINESS_CONFIG.prices.chapathiPaisa;
  const subtotalPaisa = jowarQty * jowarUnitPricePaisa + chapathiQty * chapathiUnitPricePaisa;

  // 3. Compute complimentary Podi/Karam weights:
  // For each 5 items (jowar + chapathi), customer receives 50g free podi.
  const multiplier = Math.floor(totalItems / 5);
  const totalFreeGrams = multiplier * 50;

  let karivepakuGrams = 0;
  let aviseGinjaluGrams = 0;

  if (totalFreeGrams > 0) {
    const hasKarivepaku = Boolean(input.karamSelection?.karivepaku);
    const hasAvise = Boolean(input.karamSelection?.aviseGinjalu);

    if (hasKarivepaku && hasAvise) {
      karivepakuGrams = Math.floor(totalFreeGrams / 2);
      aviseGinjaluGrams = totalFreeGrams - karivepakuGrams;
    } else if (hasKarivepaku) {
      karivepakuGrams = totalFreeGrams;
    } else if (hasAvise) {
      aviseGinjaluGrams = totalFreeGrams;
    } else {
      // Default to karivepaku if customer selected items but didn't check
      karivepakuGrams = totalFreeGrams;
    }
  }

  // 4. Calculate authoritative delivery distance & charges
  const deliveryCalc = calculateDelivery(
    input.customer.latitude,
    input.customer.longitude
  );

  if (!deliveryCalc.eligible) {
    throw new Error(
      `Delivery is unavailable: ${deliveryCalc.reason || `Distance exceeds maximum delivery radius of ${deliveryCalc.maxRadiusKm} km.`}`
    );
  }

  const deliveryChargePaisa = deliveryCalc.deliveryChargePaisa;
  const totalAmountPaisa = subtotalPaisa + deliveryChargePaisa;

  return {
    jowarQuantity: jowarQty,
    chapathiQuantity: chapathiQty,
    totalItems,
    karamSelection: {
      karivepaku: input.karamSelection?.karivepaku ?? false,
      aviseGinjalu: input.karamSelection?.aviseGinjalu ?? false,
    },
    karamQuantities: {
      karivepakuGrams,
      aviseGinjaluGrams,
    },
    jowarUnitPricePaisa,
    chapathiUnitPricePaisa,
    subtotalPaisa,
    deliveryDistanceKm: deliveryCalc.distanceKm,
    deliveryChargePaisa,
    totalAmountPaisa,
    deliveryDate: orderingStatus.deliveryDate,
    deliveryWindow: orderingStatus.deliveryWindowTe,
  };
}

export async function createPaymentIntent(
  input: CreatePaymentIntentInput
): Promise<{
  intentId: string;
  orderId: string;
  customerAccessToken: string;
  orderStatus: 'PENDING';
  provider: string;
  amountPaisa: number;
  amountRupees: number;
  subtotalRupees: number;
  deliveryChargeRupees: number;
  distanceKm: number;
  currency: string;
  businessUpiId: string;
  businessPhone: string;
  upiUri: string;
  mockDetails?: {
    isMock: boolean;
    verificationToken: string;
    instructions: string;
  };
  providerDetails?: {
    keyId: string;
    orderId: string;
  };
}> {
  const pricing = calculateAuthoritativePricing(input);

  const intentId = `pi_${crypto.randomBytes(16).toString('hex')}`;
  const hasRazorpayKeys = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  const useMockProvider = !hasRazorpayKeys || process.env.PAYMENT_PROVIDER === 'mock';

  if (useMockProvider) {
    const mockVerificationToken = `mock_sec_${crypto.randomBytes(24).toString('hex')}`;
    const intent: PaymentIntent = {
      intentId,
      provider: 'mock',
      orderPricing: pricing,
      customer: input.customer,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 60 * 1000,
      mockVerificationToken,
    };

    // Immediately record pending order in the database
    const pending = await createPendingOrder(intent, mockVerificationToken);
    intent.orderId = pending.orderId;
    intent.customerAccessToken = pending.customerAccessToken;

    const amountRupees = Math.round(pricing.totalAmountPaisa / 100);
    const upiUri = `upi://pay?pa=${BUSINESS_CONFIG.brand.upiId}&pn=${encodeURIComponent('Mana Enti Vanta')}&am=${amountRupees}&cu=INR&tr=${pending.orderId}&tn=${encodeURIComponent('Mana Enti Vanta ' + pending.orderId)}`;
    intent.upiUri = upiUri;

    paymentIntentsMap.set(intentId, intent);

    // Fail-closed: Persist payment intent to SQLite immediately
    const db = getDb();
    await withDbRetry(async () =>
      db.execute({
        sql: `INSERT INTO payment_intents (
          id, order_id, provider, provider_order_id, mock_verification_token,
          amount_paisa, currency, created_at, expires_at, is_verified
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        args: [
          intentId,
          pending.orderId,
          'mock',
          `mock_order_${pending.orderId}`,
          mockVerificationToken,
          pricing.totalAmountPaisa,
          'INR',
          intent.createdAt,
          intent.expiresAt,
        ],
      })
    );

    return {
      intentId,
      orderId: pending.orderId,
      customerAccessToken: pending.customerAccessToken,
      orderStatus: 'PENDING',
      provider: 'mock',
      amountPaisa: pricing.totalAmountPaisa,
      amountRupees,
      subtotalRupees: Math.round(pricing.subtotalPaisa / 100),
      deliveryChargeRupees: Math.round(pricing.deliveryChargePaisa / 100),
      distanceKm: pricing.deliveryDistanceKm,
      currency: 'INR',
      businessUpiId: BUSINESS_CONFIG.brand.upiId,
      businessPhone: BUSINESS_CONFIG.brand.phone,
      upiUri,
      mockDetails: {
        isMock: true,
        verificationToken: mockVerificationToken,
        instructions: 'UPI payment intent initialized. Awaiting gateway webhook / server verification.',
      },
    };
  }

  // Real production provider (Razorpay Official Orders API)
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID!;
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET!;

  const intent: PaymentIntent = {
    intentId,
    provider: 'razorpay',
    orderPricing: pricing,
    customer: input.customer,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 60 * 1000,
    providerKey: razorpayKeyId,
  };

  const pending = await createPendingOrder(intent);
  intent.orderId = pending.orderId;
  intent.customerAccessToken = pending.customerAccessToken;

  // Call real Razorpay Orders API
  const authHeader = 'Basic ' + Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64');
  const rpRes = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: pricing.totalAmountPaisa,
      currency: 'INR',
      receipt: pending.orderId,
      notes: {
        orderId: pending.orderId,
        customerMobile: input.customer.mobile,
      },
    }),
  });

  if (!rpRes.ok) {
    const errorText = await rpRes.text();
    throw new Error(`Razorpay gateway order creation failed (${rpRes.status}): ${errorText}`);
  }

  const rpData: any = await rpRes.json();
  const providerOrderId = rpData.id;
  intent.providerOrderId = providerOrderId;

  const amountRupees = Math.round(pricing.totalAmountPaisa / 100);
  const upiUri = `upi://pay?pa=${BUSINESS_CONFIG.brand.upiId}&pn=${encodeURIComponent('Mana Enti Vanta')}&am=${amountRupees}&cu=INR&tr=${pending.orderId}&tn=${encodeURIComponent('Mana Enti Vanta ' + pending.orderId)}`;
  intent.upiUri = upiUri;

  paymentIntentsMap.set(intentId, intent);

  // Fail-closed: Persist payment intent to SQLite
  const db = getDb();
  await withDbRetry(async () =>
    db.execute({
      sql: `INSERT INTO payment_intents (
        id, order_id, provider, provider_order_id, mock_verification_token,
        amount_paisa, currency, created_at, expires_at, is_verified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      args: [
        intentId,
        pending.orderId,
        'razorpay',
        providerOrderId,
        null,
        pricing.totalAmountPaisa,
        'INR',
        intent.createdAt,
        intent.expiresAt,
      ],
    })
  );

  return {
    intentId,
    orderId: pending.orderId,
    customerAccessToken: pending.customerAccessToken,
    orderStatus: 'PENDING',
    provider: 'razorpay',
    amountPaisa: pricing.totalAmountPaisa,
    amountRupees,
    subtotalRupees: Math.round(pricing.subtotalPaisa / 100),
    deliveryChargeRupees: Math.round(pricing.deliveryChargePaisa / 100),
    distanceKm: pricing.deliveryDistanceKm,
    currency: 'INR',
    businessUpiId: BUSINESS_CONFIG.brand.upiId,
    businessPhone: BUSINESS_CONFIG.brand.phone,
    upiUri,
    providerDetails: {
      keyId: razorpayKeyId,
      orderId: providerOrderId,
    },
  };
}

export async function verifyPaymentIntent(
  intentId: string,
  providerPaymentId: string,
  providerSignature?: string,
  mockVerificationToken?: string
): Promise<{
  verified: boolean;
  intent?: PaymentIntent;
  reason?: string;
}> {
  const intent = await getIntent(intentId);

  if (!intent) {
    return { verified: false, reason: 'Payment intent not found or expired. Please initiate checkout again.' };
  }

  if (Date.now() > intent.expiresAt) {
    paymentIntentsMap.delete(intentId);
    return { verified: false, reason: 'Payment intent has expired.' };
  }

  if (intent.isVerified) {
    return { verified: false, reason: 'Payment intent has already been verified.' };
  }

  const isProduction = process.env.NODE_ENV === 'production';

  if (intent.provider === 'mock') {
    if (isProduction) {
      return { verified: false, reason: 'Mock payment provider is strictly disallowed in production.' };
    }

    if (!mockVerificationToken || !intent.mockVerificationToken) {
      return { verified: false, reason: 'Missing mock verification token.' };
    }

    const providedBuf = Buffer.from(mockVerificationToken, 'utf8');
    const expectedBuf = Buffer.from(intent.mockVerificationToken, 'utf8');

    if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
      return { verified: false, reason: 'Invalid mock verification token.' };
    }

    // Clear token upon successful verification to prevent replay
    intent.mockVerificationToken = undefined;
    intent.isVerified = true;

    try {
      const db = getDb();
      await withDbRetry(async () =>
        db.execute({
          sql: 'UPDATE payment_intents SET is_verified = 1, mock_verification_token = NULL WHERE id = ?',
          args: [intentId],
        })
      );
    } catch {}

    return { verified: true, intent };
  }

  if (intent.provider === 'razorpay') {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return { verified: false, reason: 'Server payment configuration missing provider secret.' };
    }

    if (!providerSignature) {
      return { verified: false, reason: 'Missing provider cryptographic signature.' };
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${intent.providerOrderId}|${providerPaymentId}`)
      .digest('hex');

    const sigBuf = Buffer.from(providerSignature, 'utf8');
    const expBuf = Buffer.from(expectedSignature, 'utf8');

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { verified: false, reason: 'Provider payment cryptographic signature verification failed.' };
    }

    intent.isVerified = true;

    try {
      const db = getDb();
      await withDbRetry(async () =>
        db.execute({
          sql: 'UPDATE payment_intents SET is_verified = 1 WHERE id = ?',
          args: [intentId],
        })
      );
    } catch {}

    return { verified: true, intent };
  }

  return { verified: false, reason: 'Unsupported payment provider verification.' };
}
