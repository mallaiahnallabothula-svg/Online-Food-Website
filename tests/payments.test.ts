import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  createPaymentIntent,
  verifyPaymentIntent,
  getIntent,
} from '../server/payments/provider.ts';
import { initDb } from '../server/db/index.ts';
import { BUSINESS_CONFIG } from '../server/config/business.ts';
import { transitionOrderToTicketGenerated } from '../server/services/orderService.ts';

describe('Payment Provider & Authoritative Security', () => {
  beforeEach(async () => {
    await initDb();
  });

  it('creates and persists a payment intent with authoritative UPI ID nmallaiah12@axl', async () => {
    const intentResult = await createPaymentIntent({
      jowarQuantity: 5,
      chapathiQuantity: 5,
      karamSelection: { karivepaku: true, aviseGinjalu: false },
      customer: {
        name: 'Venkatesh',
        mobile: '9988776655',
        address: 'Kollur Center',
        landmark: 'Near Water Tank',
        latitude: 17.4782,
        longitude: 78.2323,
      },
    });

    expect(intentResult.intentId).toBeDefined();
    expect(intentResult.orderId).toBeDefined();
    expect(intentResult.amountRupees).toBeGreaterThan(0);
    expect(intentResult.customerAccessToken).toBeDefined();

    // Verify authoritative UPI ID is present and formatted
    expect(intentResult.businessUpiId).toBe('nmallaiah12@axl');
    expect(intentResult.upiUri).toContain('pa=nmallaiah12@axl');
    expect(intentResult.upiUri).toContain('pn=');
    expect(intentResult.upiUri).toContain('cu=INR');

    // Verify it is retrievable from SQLite
    const retrieved = await getIntent(intentResult.intentId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.intentId).toBe(intentResult.intentId);
    expect(retrieved?.orderId).toBe(intentResult.orderId);
  });

  it('rejects verification when verification token is invalid or corrupted', async () => {
    const intentResult = await createPaymentIntent({
      jowarQuantity: 5,
      chapathiQuantity: 0,
      karamSelection: { karivepaku: true, aviseGinjalu: false },
      customer: {
        name: 'Venkatesh',
        mobile: '9988776655',
        address: 'Kollur Center',
        landmark: 'Opposite Community Hall',
        latitude: 17.4782,
        longitude: 78.2323,
      },
    });

    const result = await verifyPaymentIntent(
      intentResult.intentId,
      'pay_fake123',
      undefined,
      'invalid_mock_token'
    );

    expect(result.verified).toBe(false);
    expect(result.reason).toContain('Invalid');
  });

  it('verifies receipts without consuming them before settlement', async () => {
    const intentResult = await createPaymentIntent({
      jowarQuantity: 5,
      chapathiQuantity: 0,
      karamSelection: { karivepaku: true, aviseGinjalu: false },
      customer: {
        name: 'Venkatesh',
        mobile: '9988776655',
        address: 'Kollur Center',
        landmark: 'Near Water Tank',
        latitude: 17.4782,
        longitude: 78.2323,
      },
    });

    const validToken = intentResult.mockDetails?.verificationToken;
    expect(validToken).toBeDefined();

    const result = await verifyPaymentIntent(
      intentResult.intentId,
      'pay_realmock123',
      undefined,
      validToken
    );

    expect(result.verified).toBe(true);
    expect(result.intent?.intentId).toBe(intentResult.intentId);
    expect(result.intent?.isVerified).not.toBe(true);

    // Repeating receipt verification is safe; settlement supplies idempotency.
    const replayResult = await verifyPaymentIntent(
      intentResult.intentId,
      'pay_realmock123',
      undefined,
      validToken
    );
    expect(replayResult.verified).toBe(true);
  });

  it('rejects transition to ticket generated when payment amount mismatches authoritative order total', async () => {
    const intentResult = await createPaymentIntent({
      jowarQuantity: 5,
      chapathiQuantity: 5,
      karamSelection: { karivepaku: true, aviseGinjalu: false },
      customer: {
        name: 'Suresh',
        mobile: '9876543210',
        address: 'Kollur',
        landmark: 'Opposite Panchayat Office',
        latitude: 17.4782,
        longitude: 78.2323,
      },
    });

    // Mismatched payment info (e.g. paying 100 paise instead of authoritative total)
    const mismatchedPayment = {
      provider: 'mock' as const,
      providerPaymentId: 'pay_underpaid_123',
      amountPaisa: 100, // Tampered underpaid amount
      currency: 'INR',
    };

    await expect(
      transitionOrderToTicketGenerated(intentResult.orderId, mismatchedPayment, 'GATEWAY_VERIFIER')
    ).rejects.toThrow(/Security Violation: Payment amount mismatch/);
  });

  it('validates webhook HMAC SHA-256 signature verification and rejects corrupted signatures', () => {
    const secret = 'whsec_test_secret_key_12345';
    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_test123',
            amount: 8000,
            currency: 'INR',
          },
        },
      },
    });

    const validSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const corruptedSignature = crypto.createHmac('sha256', secret).update(payload + '_tampered').digest('hex');

    // Helper implementing the webhook timing-safe verification logic
    const verifyWebhookSig = (sig: string, raw: string, sec: string) => {
      const expected = crypto.createHmac('sha256', sec).update(raw).digest('hex');
      const sigBuf = Buffer.from(sig, 'utf8');
      const expBuf = Buffer.from(expected, 'utf8');
      return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
    };

    expect(verifyWebhookSig(validSignature, payload, secret)).toBe(true);
    expect(verifyWebhookSig(corruptedSignature, payload, secret)).toBe(false);
    expect(verifyWebhookSig('random_invalid_sig', payload, secret)).toBe(false);
  });
});
