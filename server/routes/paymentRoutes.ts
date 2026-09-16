import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import { CreatePaymentIntentSchema, VerifyPaymentSchema } from '../validation/schemas.ts';
import {
  createPaymentIntent,
  verifyPaymentIntent,
  getIntent,
  findIntentByOrderId,
} from '../payments/provider.ts';
import {
  transitionOrderToTicketGenerated,
  getOrderStatus,
  formatCustomerSafeOrder,
} from '../services/orderService.ts';
import { paymentRateLimiter, statusPollingRateLimiter } from '../middleware/rateLimit.ts';

export const paymentRouter = Router();

/**
 * 1. Create Payment Intent and Register Pending Order
 * Initiates checkout, computes authoritative pricing, creates PENDING order in DB.
 */
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

/**
 * 2. Gateway Webhook Listener (Authoritative Server-to-Server Confirmation)
 * Handles Razorpay Webhook payloads.
 * Strictly verifies cryptographic HMAC SHA-256 signature (Fail-Closed).
 * Idempotent: safe against retries.
 */
paymentRouter.post('/webhook', async (req: any, res: Response) => {
  try {
    const webhookSignature = req.headers['x-razorpay-signature'] as string | undefined;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.PAYMENT_WEBHOOK_SECRET;
    const isProduction = process.env.NODE_ENV === 'production';

    // Strict Fail-Closed Verification
    if (isProduction || webhookSecret) {
      if (!webhookSecret) {
        console.error('[WEBHOOK] FAIL-CLOSED: Webhook secret is not configured in production environment.');
        return res.status(500).json({ error: 'Server payment webhook configuration missing secret.' });
      }

      if (!webhookSignature || !req.rawBody) {
        console.error('[WEBHOOK] FAIL-CLOSED: Missing signature header or raw body.');
        return res.status(400).json({ error: 'Missing webhook signature or raw payload.' });
      }

      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(req.rawBody)
        .digest('hex');

      const sigBuf = Buffer.from(webhookSignature, 'utf8');
      const expBuf = Buffer.from(expectedSignature, 'utf8');

      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        console.error('[WEBHOOK] FAIL-CLOSED: Cryptographic signature mismatch.');
        return res.status(400).json({ error: 'Invalid webhook signature.' });
      }
    }

    const payload = req.body || {};
    let providerPaymentId: string = '';
    let orderId: string = '';
    let amountPaisa: number | undefined;

    if (payload.payload?.payment?.entity) {
      const paymentEntity = payload.payload.payment.entity;
      providerPaymentId = paymentEntity.id;
      amountPaisa = typeof paymentEntity.amount === 'number' ? paymentEntity.amount : undefined;

      // Check notes for orderId or lookup by provider order_id
      orderId = paymentEntity.notes?.orderId || paymentEntity.notes?.order_id || '';
      if (!orderId && paymentEntity.order_id) {
        const intent = await findIntentByOrderId(paymentEntity.order_id);
        if (intent?.orderId) {
          orderId = intent.orderId;
        }
      }
    } else if (payload.orderId || payload.order_id) {
      orderId = payload.orderId || payload.order_id;
      providerPaymentId = payload.paymentId || payload.payment_id || `UPI_WH_${Date.now()}`;
      amountPaisa = typeof payload.amountPaisa === 'number' ? payload.amountPaisa : undefined;
    }

    if (!orderId) {
      return res.json({ received: true, ignored: true, reason: 'No order identifier in payload' });
    }

    // Atomically transition order: PENDING → PAID → CONFIRMED → TICKET_GENERATED
    const transitionResult = await transitionOrderToTicketGenerated(
      orderId,
      {
        provider: 'razorpay',
        providerPaymentId,
        providerSignature: webhookSignature,
        amountPaisa,
        rawPayload: payload,
      },
      'GATEWAY_WEBHOOK'
    );

    return res.json({
      received: true,
      orderId: transitionResult.orderId,
      status: transitionResult.order.orderStatus,
      idempotent: transitionResult.idempotent ?? false,
    });
  } catch (err: any) {
    console.error('Webhook processing error:', err);
    return res.status(500).json({ error: 'Webhook processing failed', details: err.message });
  }
});

/**
 * 3. Short Polling & Status Check API
 * Requires valid customerAccessToken OR unexpired checkout intentId.
 * No auto-settlers. Returns customer-safe order representation.
 */
paymentRouter.get('/status/:id', statusPollingRateLimiter, async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id || id.trim().length < 4) {
    return res.status(400).json({
      error: {
        code: 'INVALID_ID',
        message: 'Order access token or Intent ID is required.',
      },
    });
  }

  try {
    const orderStatus = await getOrderStatus(id);

    if (!orderStatus) {
      return res.status(404).json({
        error: {
          code: 'ORDER_NOT_FOUND',
          message: 'No order matching this authorization was found.',
        },
      });
    }

    // Return customer-safe order status (no internal secrets or unmasked sensitive data)
    res.json({
      status: orderStatus.orderStatus,
      orderStatus: orderStatus.orderStatus,
      paymentStatus: orderStatus.paymentStatus,
      isPaid: orderStatus.isPaid,
      isConfirmed: orderStatus.isConfirmed,
      ticketGenerated: orderStatus.ticketGenerated,
      orderId: orderStatus.orderId,
      customerAccessToken: orderStatus.customerAccessToken,
      order: orderStatus.order ? formatCustomerSafeOrder(orderStatus.order) : null,
      ticket: orderStatus.ticket,
    });
  } catch (err: any) {
    console.error('Status check error:', err);
    res.status(500).json({
      error: {
        code: 'STATUS_CHECK_FAILED',
        message: err.message || 'Failed to check order status.',
      },
    });
  }
});

/**
 * 4. Verify Payment Endpoint (Gateway verification callback)
 * Receives cryptographic signatures from gateway callbacks.
 * Server authoritatively verifies signature and transitions order.
 */
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

  // 1. Cryptographically verify signature or mock token
  const verification = await verifyPaymentIntent(
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
    // 2. Authoritative Atomic Transition: PENDING → PAID → CONFIRMED → TICKET_GENERATED
    const targetOrderId = verification.intent.orderId || intentId;
    const result = await transitionOrderToTicketGenerated(
      targetOrderId,
      {
        provider: verification.intent.provider,
        providerPaymentId,
        providerSignature,
        amountPaisa: verification.intent.orderPricing.totalAmountPaisa,
      },
      'GATEWAY_VERIFIER'
    );

    res.json({
      success: true,
      message: 'Payment verified and order ticket generated!',
      orderId: result.orderId,
      customerAccessToken: result.customerAccessToken,
      order: formatCustomerSafeOrder(result.order),
      ticket: result.ticket,
      idempotent: result.idempotent,
    });
  } catch (err: any) {
    console.error('Error in payment verification:', err);
    res.status(500).json({
      error: {
        code: 'ORDER_TRANSITION_FAILED',
        message: err.message || 'Failed to transition order status upon payment verification.',
      },
    });
  }
});

/**
 * 5. Development Test Endpoint: Simulate Gateway Webhook
 * STRICTLY disabled in production (returns 404).
 */
paymentRouter.post('/simulate-webhook', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).end();
  }

  const { orderId, intentId } = req.body;
  const targetId = orderId || intentId;

  if (!targetId) {
    return res.status(400).json({ error: 'orderId or intentId required.' });
  }

  try {
    const result = await transitionOrderToTicketGenerated(
      targetId,
      {
        provider: 'mock',
        providerPaymentId: `SIM_WH_${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        providerSignature: 'simulated_test_signature',
      },
      'GATEWAY_WEBHOOK'
    );

    res.json({
      success: true,
      orderId: result.orderId,
      orderStatus: result.order.orderStatus,
      ticket: result.ticket,
      customerAccessToken: result.customerAccessToken,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
