import { describe, it, expect } from 'vitest';
import {
  CreatePaymentIntentSchema,
  CustomerFeedbackSchema,
  VerifyPaymentSchema,
} from '../server/validation/schemas.ts';

describe('Zod Validation & Sanitization Schemas', () => {
  it('validates a correct CreatePaymentIntent payload', () => {
    const valid = {
      jowarQuantity: 5,
      chapathiQuantity: 0,
      karamSelection: {
        karivepaku: true,
        aviseGinjalu: false,
      },
      customer: {
        name: 'Suresh Kumar',
        mobile: '9876543210',
        address: 'Plot 42, Jubilee Hills, Road No 36',
        landmark: 'Near Metro Pillar 12',
        latitude: 17.43,
        longitude: 78.41,
        deliveryDistanceKm: 4.5,
      },
    };

    const parsed = CreatePaymentIntentSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('rejects an order when total items is 0', () => {
    const invalid = {
      jowarQuantity: 0,
      chapathiQuantity: 0,
      karamSelection: { karivepaku: true, aviseGinjalu: false },
      customer: {
        name: 'Ramesh',
        mobile: '9876543210',
        address: 'Madhapur',
      },
    };

    const parsed = CreatePaymentIntentSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it('rejects an invalid Indian 10-digit mobile number', () => {
    const invalidPhone = {
      jowarQuantity: 3,
      chapathiQuantity: 2,
      karamSelection: { karivepaku: true, aviseGinjalu: false },
      customer: {
        name: 'Ramesh',
        mobile: '1234567890', // Doesn't start with 6-9
        address: 'Banjara Hills',
      },
    };

    const parsed = CreatePaymentIntentSchema.safeParse(invalidPhone);
    expect(parsed.success).toBe(false);
  });

  it('sanitizes HTML injection in CustomerFeedback comments', () => {
    const maliciousComment = {
      rating: 5,
      comment: 'Very tasty! <script>alert("XSS")</script><img src=x onerror=alert(1)> Awesome rotis.',
    };

    const parsed = CustomerFeedbackSchema.safeParse(maliciousComment);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.comment).not.toContain('<script>');
      expect(parsed.data.comment).not.toContain('<img');
      expect(parsed.data.comment).toContain('Very tasty!');
      expect(parsed.data.comment).toContain('Awesome rotis.');
    }
  });

  it('rejects rating outside 1-5 in CustomerFeedback', () => {
    const invalidRating = {
      rating: 6,
      comment: 'Good',
    };

    const parsed = CustomerFeedbackSchema.safeParse(invalidRating);
    expect(parsed.success).toBe(false);
  });

  it('validates VerifyPaymentSchema requires intentId and providerPaymentId', () => {
    const missingPaymentId = {
      intentId: 'pi_test123456',
    };
    const parsed = VerifyPaymentSchema.safeParse(missingPaymentId);
    expect(parsed.success).toBe(false);
  });
});
