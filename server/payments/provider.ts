import crypto from 'crypto';
import { BUSINESS_CONFIG } from '../config/business.ts';
import { calculateDelivery } from '../services/deliveryService.ts';
import { getOrderingStatus } from '../services/timeService.ts';
import { CreatePaymentIntentInput } from '../validation/schemas.ts';

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
  provider: 'mock' | 'razorpay' | 'phonepe';
  orderPricing: CalculatedOrderPricing;
  customer: CreatePaymentIntentInput['customer'];
  createdAt: number;
  expiresAt: number;
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
}, 60000);

export function calculateAuthoritativePricing(
  input: CreatePaymentIntentInput
): CalculatedOrderPricing {
  const jowarQty = input.jowarQuantity;
  const chapathiQty = input.chapathiQuantity;
  const totalItems = jowarQty + chapathiQty;

  const jowarUnitPricePaisa = BUSINESS_CONFIG.prices.jowarRotiPaisa; // 3000 (₹30)
  const chapathiUnitPricePaisa = BUSINESS_CONFIG.prices.chapathiPaisa; // 1000 (₹10)

  const subtotalPaisa = jowarQty * jowarUnitPricePaisa + chapathiQty * chapathiUnitPricePaisa;

  // Delivery calculation from authoritative server service
  const deliveryResult = calculateDelivery(
    input.customer.latitude,
    input.customer.longitude
  );

  if (!deliveryResult.eligible) {
    throw new Error(deliveryResult.reason || 'Delivery location is not eligible');
  }

  const deliveryChargePaisa = deliveryResult.deliveryChargePaisa;
  const totalAmountPaisa = subtotalPaisa + deliveryChargePaisa;

  // Complimentary karam calculation:
  // Every 5 items get complimentary 100g of selected karam(s)
  const portions = Math.max(1, Math.ceil(totalItems / 5));
  const gramsPerSelectedKaram = input.karamSelection.karivepaku && input.karamSelection.aviseGinjalu
    ? portions * 50
    : portions * 100;

  const karamQuantities = {
    karivepakuGrams: input.karamSelection.karivepaku ? gramsPerSelectedKaram : 0,
    aviseGinjaluGrams: input.karamSelection.aviseGinjalu ? gramsPerSelectedKaram : 0,
  };

  const timeStatus = getOrderingStatus();

  return {
    jowarQuantity: jowarQty,
    chapathiQuantity: chapathiQty,
    totalItems,
    karamSelection: input.karamSelection,
    karamQuantities,
    jowarUnitPricePaisa,
    chapathiUnitPricePaisa,
    subtotalPaisa,
    deliveryDistanceKm: deliveryResult.distanceKm,
    deliveryChargePaisa,
    totalAmountPaisa,
    deliveryDate: timeStatus.deliveryDate,
    deliveryWindow: BUSINESS_CONFIG.deliveryWindow.start + '-' + BUSINESS_CONFIG.deliveryWindow.end,
  };
}

export async function createPaymentIntent(
  input: CreatePaymentIntentInput
): Promise<{
  intentId: string;
  provider: string;
  amountPaisa: number;
  amountRupees: number;
  subtotalRupees: number;
  deliveryChargeRupees: number;
  distanceKm: number;
  currency: string;
  businessUpiId: string;
  businessPhone: string;
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
  const isProduction = process.env.NODE_ENV === 'production';
  const hasRazorpayKeys = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

  if (isProduction && !hasRazorpayKeys) {
    throw new Error('Payment gateway credentials not configured on server for production.');
  }

  // Development mock provider is ONLY available in non-production
  const useMockProvider = !hasRazorpayKeys || process.env.PAYMENT_PROVIDER === 'mock';

  if (!isProduction && useMockProvider) {
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

    paymentIntentsMap.set(intentId, intent);

    return {
      intentId,
      provider: 'mock',
      amountPaisa: pricing.totalAmountPaisa,
      amountRupees: Math.round(pricing.totalAmountPaisa / 100),
      subtotalRupees: Math.round(pricing.subtotalPaisa / 100),
      deliveryChargeRupees: Math.round(pricing.deliveryChargePaisa / 100),
      distanceKm: pricing.deliveryDistanceKm,
      currency: 'INR',
      businessUpiId: BUSINESS_CONFIG.brand.upiId,
      businessPhone: BUSINESS_CONFIG.brand.phone,
      mockDetails: {
        isMock: true,
        verificationToken: mockVerificationToken,
        instructions: 'Development sandbox mode active. Online payment simulated via verified server intent.',
      },
    };
  }

  // Real production provider (Razorpay HMAC verified)
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID!;
  const providerOrderId = `order_${crypto.randomBytes(12).toString('hex')}`;

  const intent: PaymentIntent = {
    intentId,
    provider: 'razorpay',
    orderPricing: pricing,
    customer: input.customer,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 60 * 1000,
    providerOrderId,
    providerKey: razorpayKeyId,
  };

  paymentIntentsMap.set(intentId, intent);

  return {
    intentId,
    provider: 'razorpay',
    amountPaisa: pricing.totalAmountPaisa,
    amountRupees: Math.round(pricing.totalAmountPaisa / 100),
    subtotalRupees: Math.round(pricing.subtotalPaisa / 100),
    deliveryChargeRupees: Math.round(pricing.deliveryChargePaisa / 100),
    distanceKm: pricing.deliveryDistanceKm,
    currency: 'INR',
    businessUpiId: BUSINESS_CONFIG.brand.upiId,
    businessPhone: BUSINESS_CONFIG.brand.phone,
    providerDetails: {
      keyId: razorpayKeyId,
      orderId: providerOrderId,
    },
  };
}

export function verifyPaymentIntent(
  intentId: string,
  providerPaymentId: string,
  providerSignature?: string,
  mockVerificationToken?: string
): {
  verified: boolean;
  intent?: PaymentIntent;
  reason?: string;
} {
  const intent = paymentIntentsMap.get(intentId);

  if (!intent) {
    return { verified: false, reason: 'Payment intent not found or expired. Please initiate checkout again.' };
  }

  if (Date.now() > intent.expiresAt) {
    paymentIntentsMap.delete(intentId);
    return { verified: false, reason: 'Payment intent has expired.' };
  }

  const isProduction = process.env.NODE_ENV === 'production';

  if (intent.provider === 'mock') {
    if (isProduction) {
      return { verified: false, reason: 'Mock payment provider is strictly disallowed in production.' };
    }

    if (!mockVerificationToken || mockVerificationToken !== intent.mockVerificationToken) {
      return { verified: false, reason: 'Invalid mock verification signature token.' };
    }

    // Payment intent verified successfully in development
    paymentIntentsMap.delete(intentId);
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

    if (expectedSignature !== providerSignature) {
      return { verified: false, reason: 'Provider payment cryptographic signature verification failed.' };
    }

    paymentIntentsMap.delete(intentId);
    return { verified: true, intent };
  }

  return { verified: false, reason: 'Unsupported payment provider verification.' };
}
