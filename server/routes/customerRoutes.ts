import { Router, Request, Response } from 'express';
import { CustomerFeedbackSchema } from '../validation/schemas.ts';
import {
  getOrderByCustomerToken,
  markOrderReceivedByCustomer,
  submitOrderFeedback,
  formatCustomerSafeOrder,
} from '../services/orderService.ts';
import { customerActionRateLimiter } from '../middleware/rateLimit.ts';

export const customerRouter = Router();

// Track / Lookup Order by high-entropy customer access token
customerRouter.get(['/:token', '/orders/:token'], customerActionRateLimiter, async (req: Request, res: Response) => {
  const { token } = req.params;

  if (!token || token.length < 16) {
    return res.status(400).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or missing customer tracking access token.',
      },
    });
  }

  const order = await getOrderByCustomerToken(token);

  if (!order) {
    return res.status(404).json({
      error: {
        code: 'ORDER_NOT_FOUND',
        message: 'No order matching this tracking access token was found.',
      },
    });
  }

  res.json({ order: formatCustomerSafeOrder(order) });
});

// Customer confirms order receipt
customerRouter.post(['/:token/received', '/orders/:token/received'], customerActionRateLimiter, async (req: Request, res: Response) => {
  const { token } = req.params;

  if (!token || token.length < 16) {
    return res.status(400).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or missing customer access token.',
      },
    });
  }

  try {
    const result = await markOrderReceivedByCustomer(token);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({
      error: {
        code: 'RECEIPT_CONFIRMATION_FAILED',
        message: err.message || 'Could not confirm order receipt.',
      },
    });
  }
});

// Customer submits feedback
customerRouter.post(['/:token/feedback', '/orders/:token/feedback'], customerActionRateLimiter, async (req: Request, res: Response) => {
  const { token } = req.params;

  if (!token || token.length < 16) {
    return res.status(400).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or missing customer access token.',
      },
    });
  }

  const parsed = CustomerFeedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message || 'Invalid feedback parameters.';
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: msg,
      },
    });
  }

  try {
    const result = await submitOrderFeedback(token, parsed.data.rating, parsed.data.comment);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({
      error: {
        code: 'FEEDBACK_SUBMISSION_FAILED',
        message: err.message || 'Could not submit feedback.',
      },
    });
  }
});
