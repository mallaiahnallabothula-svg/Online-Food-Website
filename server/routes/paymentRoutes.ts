import { Router, Request, Response } from 'express';
import { CreatePaymentIntentSchema, VerifyPaymentSchema } from '../validation/schemas.ts';
import { createPaymentIntent, verifyPaymentIntent } from '../payments/provider.ts';
import { createOrderFromVerifiedPayment } from '../services/orderService.ts';
import { paymentRateLimiter } from '../middleware/rateLimit.ts';

export const paymentRouter = Router();

// Apply rate limiter to payment intent creation
paymentRouter.post('/create-intent', paymentRateLimiter, async (req: Request, res: Response) => {
  const parsed = CreatePaymentIntentSchema.safeParse(req.body);

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Invalid order parameters.';
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: firstError,
        details: parsed.error.format(),
      },
    });
  }

  try {
    const intentResult = await createPaymentIntent(parsed.data);
    res.json(intentResult);
  } catch (err: any) {
    res.status(400).json({
      error: {
        code: 'ORDER_INTENT_ERROR',
        message: err.message || 'Failed to create payment intent.',
      },
    });
  }
});

// Verify Payment and Finalize Order
paymentRouter.post('/verify', paymentRateLimiter, async (req: Request, res: Response) => {
  const parsed = VerifyPaymentSchema.safeParse(req.body);

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Invalid payment verification payload.';
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: firstError,
      },
    });
  }

  const { intentId, providerPaymentId, providerSignature, mockVerificationToken } = parsed.data;

  // 1. Authoritatively verify signature / mock token with provider
  const verification = verifyPaymentIntent(
    intentId,
    providerPaymentId,
    providerSignature,
    mockVerificationToken
  );

  if (!verification.verified || !verification.intent) {
    return res.status(400).json({
      error: {
        code: 'PAYMENT_VERIFICATION_FAILED',
        message: verification.reason || 'Payment could not be verified by provider.',
      },
    });
  }

  try {
    // 2. Insert order + payment into DB atomically
    const orderResult = await createOrderFromVerifiedPayment(
      verification.intent,
      providerPaymentId,
      providerSignature
    );

    res.json({
      success: true,
      message: 'Payment verified and order successfully placed!',
      orderId: orderResult.orderId,
      customerAccessToken: orderResult.customerAccessToken,
      order: orderResult.order,
    });
  } catch (err: any) {
    console.error('Error creating order from verified payment:', err);
    res.status(500).json({
      error: {
        code: 'ORDER_CREATION_FAILED',
        message: err.message || 'Failed to record verified order in database.',
      },
    });
  }
});
