/** Stage 2 harness. Default router always 404; no environment switch enables it.
 * Only isolated tests may supply dependencies. Never opens the production DB.
 */
import crypto from 'node:crypto';
import { Router } from 'express';
import type { Client } from '@libsql/client';
import { z } from 'zod';
import { NEW_MENU_LAUNCH_ENABLED } from '../../shared/menuCatalog.ts';
import { quoteSchema } from './newMenuQuoteRoutes.ts';
import { createRateLimiter } from '../middleware/rateLimit.ts';
import { prepareInactiveNewMenuCheckoutIdempotent } from '../services/inactiveNewMenuIdempotencyService.ts';
import { startInactiveNewMenuCheckoutGateway } from '../services/inactiveNewMenuCheckoutOrchestrator.ts';
import { verifyAndSettleNewMenuPayment } from '../services/newMenuPaymentSafetyService.ts';

export interface IsolatedCheckoutDependencies {
  db: Client;
  secret: Buffer;
  credentials: { keyId: string; keySecret: string };
  transport: typeof fetch;
  now: () => Date;
}
const authorization = z.strictObject({
  orderId: z.string().regex(/^MENU-[0-9a-f-]{36}$/),
  customerAccessToken: z.string().regex(/^[a-f0-9]{64}$/),
});
const preparation = z.strictObject({ requestKey: z.string().uuid(), request: quoteSchema });
const confirmation = authorization.extend({
  providerPaymentId: z.string().regex(/^pay_[A-Za-z0-9]{5,64}$/),
  providerSignature: z.string().regex(/^[a-f0-9]{64}$/),
});

export function createInactiveNewMenuCheckoutRouter(deps?: IsolatedCheckoutDependencies) {
  const router = Router();
  const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 20, message: 'Please retry shortly.' });
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!deps || process.env.NODE_ENV !== 'test' || NEW_MENU_LAUNCH_ENABLED ||
        !/^rzp_test_[A-Za-z0-9]+$/.test(deps.credentials.keyId)) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Menu checkout is not available yet.' } });
    }
    next();
  });
  router.use(limiter);
  router.use((req, res, next) => {
    // Non-simple JSON request required; no CORS or cookie-based authorization.
    if (!req.is('application/json') || req.get('x-menu-checkout') !== '1') {
      return res.status(403).json({ error: { code: 'INVALID_REQUEST', message: 'Invalid checkout request.' } });
    }
    next();
  });
  router.post('/prepare', async (req, res) => {
    const parsed = preparation.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_CART', message: 'Invalid cart or customer details.' } });
    try {
      const result = await prepareInactiveNewMenuCheckoutIdempotent(deps!.db, parsed.data.request,
        parsed.data.requestKey, deps!.secret, deps!.now());
      return res.json(result);
    } catch {
      return res.status(409).json({ error: { code: 'CHECKOUT_UNAVAILABLE', message: 'Checkout could not be verified. Keep this attempt; do not create another payment.' } });
    }
  });
  for (const action of ['gateway', 'confirm'] as const) {
    router.post('/' + action, async (req, res) => {
      const parsed = (action === 'confirm' ? confirmation : authorization).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Invalid payment request.' } });
      const input = parsed.data;
      const row = await deps!.db.execute({ sql: 'SELECT public_token_hash FROM orders WHERE id=?', args: [input.orderId] });
      const stored = String(row.rows[0]?.public_token_hash ?? '');
      const hash = crypto.createHash('sha256').update(input.customerAccessToken).digest('hex');
      if (stored.length !== 64 || !crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(hash))) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found.' } });
      }
      try {
        if (action === 'gateway') return res.json(await startInactiveNewMenuCheckoutGateway(
          deps!.db, input, deps!.credentials, deps!.transport, deps!.now().getTime()));
        const confirmed = confirmation.parse(req.body);
        return res.json(await verifyAndSettleNewMenuPayment(deps!.db, confirmed,
          deps!.now().getTime(), deps!.credentials, deps!.transport));
      } catch {
        return res.status(409).json({ error: { code: 'PAYMENT_UNVERIFIED', message: 'Payment is not confirmed. Retry verification; do not pay again.' } });
      }
    });
  }
  return router;
}
