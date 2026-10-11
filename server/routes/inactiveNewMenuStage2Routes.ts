/**
 * INACTIVE new-menu release candidate API. Tests may mount this router on an
 * ISOLATED app with an injected test DB and mocked Razorpay transports.
 * NEVER import/mount it in server/app.ts or Vercel routes before separately
 * approved production migration, auth, anti-abuse and go-live reviews.
 */
import crypto from 'node:crypto';
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { Client } from '@libsql/client';
import { MENU_CATALOG, NEW_MENU_LAUNCH_ENABLED } from '../../shared/menuCatalog.ts';
import { priceNewMenuCheckout } from '../services/newMenuCheckoutService.ts';
import { getMenuStockRemaining } from '../services/menuStockService.ts';
import {
  INACTIVE_CHECKOUT_IDEMPOTENCY_TEST_SCHEMA,
  prepareInactiveNewMenuCheckoutIdempotent,
} from '../services/inactiveNewMenuIdempotencyService.ts';
import { startInactiveNewMenuCheckoutGateway } from '../services/inactiveNewMenuCheckoutOrchestrator.ts';
import { verifyAndSettleNewMenuPayment } from '../services/newMenuPaymentSafetyService.ts';
import { loadOwnerOrderCompatibility } from '../services/ownerMenuCompatibilityService.ts';
import { formatCustomerSafeOrder, formatOrderRow } from '../services/orderService.ts';

export { INACTIVE_CHECKOUT_IDEMPOTENCY_TEST_SCHEMA };
const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
const orderIdSchema = z.string().regex(/^MENU-[0-9a-f-]{36}$/);
const cartSchema = z.strictObject({
  lines: z.array(z.strictObject({
    itemId: z.string().min(1).max(64),
    quantity: z.number().int().min(1).max(500),
  })).min(1).max(MENU_CATALOG.length),
  customer: z.strictObject({
    name: z.string().trim().min(2).max(100),
    mobile: z.string().regex(/^[6-9]\d{9}$/),
    address: z.string().trim().min(5).max(500),
    landmark: z.string().max(200).optional(),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    locationLink: z.string().max(2000).optional(),
  }),
  requestedDeliveryDateIst: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
const prepareSchema = z.strictObject({
  request: cartSchema,
  requestKey: z.string().uuid(),
});
const gatewaySchema = z.strictObject({
  orderId: orderIdSchema,
  customerAccessToken: tokenSchema,
});
const confirmSchema = gatewaySchema.extend({
  providerPaymentId: z.string().regex(/^pay_[A-Za-z0-9]{5,64}$/),
  providerSignature: z.string().regex(/^[a-fA-F0-9]{64}$/),
});
const trackSchema = z.strictObject({ customerAccessToken: tokenSchema });
const ownerSchema = z.strictObject({ orderId: orderIdSchema });

export interface InactiveMenuStage2Deps {
  db: Client;
  /** Temporary 32-byte encryption key used ONLY with an isolated test DB. */
  idempotencySecret: Buffer;
  credentials: { keyId: string; keySecret: string };
  gatewayOrderTransport: typeof fetch;
  capturedPaymentTransport: typeof fetch;
  now?: () => Date;
  /** Caller-provided test owner authorization; never trust a body flag. */
  isAuthorizedOwner?: (request: Request) => boolean;
}

function tokenHash(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
async function findByToken(db: Client, token: string) {
  const result = await db.execute({
    sql: 'SELECT * FROM orders WHERE public_token_hash = ? LIMIT 1',
    args: [tokenHash(token)],
  });
  return result.rows[0] ?? null;
}

export function createInactiveNewMenuStage2Router(deps: InactiveMenuStage2Deps) {
  if (NEW_MENU_LAUNCH_ENABLED || process.env.NODE_ENV !== 'test' ||
      !deps || !deps.db || !Buffer.isBuffer(deps.idempotencySecret) ||
      deps.idempotencySecret.length !== 32 ||
      !/^rzp_test_[A-Za-z0-9]+$/.test(deps.credentials?.keyId ?? '') ||
      !deps.credentials?.keySecret ||
      typeof deps.gatewayOrderTransport !== 'function' ||
      typeof deps.capturedPaymentTransport !== 'function') {
    throw new Error('Inactive new-menu stage 2 can run only in isolated mocked tests');
  }
  const router = Router();
  const now = () => deps.now?.() ?? new Date();
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.post('/quote', async (req, res) => {
    const parsed = cartSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_CART' } });
    try {
      const pricing = priceNewMenuCheckout(parsed.data, now());
      const items = await Promise.all(pricing.items.map(async ({item, quantity, lineTotalPaisa}) => ({
        itemId: item.id,
        itemName: item.nameEn,
        quantity, lineTotalPaisa,
        unitPricePaisa: item.pricePaisa,
        // Read-only estimate; only atomic pending-order creation reserves stock.
        remainingEstimate: item.dailyPlateLimit === null
          ? null
          : await getMenuStockRemaining(deps.db, item.id, pricing.deliveryDateIst, now().getTime()),
      })));
      return res.json({
        quote: {
          items, period: pricing.period,
          deliveryDateIst: pricing.deliveryDateIst, deliveryWindow: pricing.deliveryWindow,
          subtotalPaisa: pricing.subtotalPaisa, deliveryChargePaisa: pricing.deliveryChargePaisa,
          totalAmountPaisa: pricing.totalAmountPaisa,
          distanceKm: pricing.distanceKm,
        },
        stockReserved: false, paymentInitiated: false,
      });
    } catch {
      return res.status(422).json({ error: { code: 'QUOTE_UNAVAILABLE' } });
    }
  });

  router.post('/prepare', async (req, res) => {
    const parsed = prepareSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error:{code:'INVALID_CHECKOUT'}});
    try {
      const p = await prepareInactiveNewMenuCheckoutIdempotent(
        deps.db, parsed.data.request, parsed.data.requestKey,
        deps.idempotencySecret, now(),
      );
      return res.json({
        checkout: {
          orderId: p.orderId,
          customerAccessToken: p.customerAccessToken,
          expiresAtMs: p.expiresAtMs,
          idempotent: p.idempotent,
          totalAmountPaisa: p.pricing.totalAmountPaisa,
          currency: 'INR',
          deliveryDateIst: p.pricing.deliveryDateIst,
          deliveryWindow: p.pricing.deliveryWindow,
        },
      });
    } catch {
      // Never retry an ambiguous claim automatically or leak access tokens.
      return res.status(409).json({error:{code:'CHECKOUT_REVIEW_REQUIRED'}});
    }
  });

  router.post('/gateway', async (req, res) => {
    const parsed = gatewaySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error:{code:'INVALID_CHECKOUT'}});
    try {
      const result = await startInactiveNewMenuCheckoutGateway(
        deps.db, parsed.data, deps.credentials, deps.gatewayOrderTransport, now().getTime());
      return res.json({ gateway: result });
    } catch {
      return res.status(409).json({error:{code:'GATEWAY_REVIEW_REQUIRED'}});
    }
  });

  router.post('/confirm', async (req, res) => {
    const parsed = confirmSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error:{code:'INVALID_PAYMENT'}});
    try {
      // Revalidate order ownership BEFORE Razorpay fetch or database mutation.
      const owned = await findByToken(deps.db, parsed.data.customerAccessToken);
      if (!owned || owned.id !== parsed.data.orderId) {
        return res.status(403).json({error:{code:'INVALID_TRACKING_TOKEN'}});
      }
      const result = await verifyAndSettleNewMenuPayment(deps.db, {
        orderId: parsed.data.orderId,
        providerPaymentId: parsed.data.providerPaymentId,
        providerSignature: parsed.data.providerSignature,
      }, now().getTime(), deps.credentials, deps.capturedPaymentTransport);
      return res.json({settlement: {
        orderId: result.orderId,
        status: result.status, idempotent: result.idempotent,
        // Ticket is kept in the private tracking response, never on errors.
        reason: result.reason ?? null,
      }});
    } catch {
      return res.status(409).json({error:{code:'PAYMENT_VERIFICATION_FAILED'}});
    }
  });

  router.post('/track', async (req, res) => {
    const parsed = trackSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error:{code:'INVALID_TRACKING_TOKEN'}});
    const order = await findByToken(deps.db, parsed.data.customerAccessToken);
    if (!order) return res.status(404).json({error:{code:'NOT_FOUND'}});
    const items = await deps.db.execute({
      sql: 'SELECT item_id, item_name_en, item_name_te, sale_unit, quantity, line_total_paisa FROM order_items WHERE order_id = ? ORDER BY rowid',
      args: [String(order.id)],
    });
    // Legacy orders remain untouched; this stage-2 router is MENU-only.
    if (!String(order.id).startsWith('MENU-')) {
      return res.status(404).json({error:{code:'NOT_FOUND'}});
    }
    return res.json({
      order: {
        ...formatCustomerSafeOrder(formatOrderRow(order)),
        ticketText: order.ticket_text ? String(order.ticket_text) : null,
        items: items.rows.map(item => ({
          itemId: String(item.item_id),
          nameEn: String(item.item_name_en),
          nameTe: String(item.item_name_te),
          unit: String(item.sale_unit),
          quantity: Number(item.quantity),
          lineTotalPaisa: Number(item.line_total_paisa),
        })),
      },
    });
  });

  router.post('/owner/order', async (req, res) => {
    if (!deps.isAuthorizedOwner?.(req)) {
      return res.status(403).json({error:{code:'OWNER_AUTH_REQUIRED'}});
    }
    const parsed = ownerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error:{code:'INVALID_ORDER_ID'}});
    const order = await loadOwnerOrderCompatibility(deps.db, parsed.data.orderId);
    if (!order || order.format !== 'ITEMIZED') return res.status(404).json({error:{code:'NOT_FOUND'}});
    return res.json({ order });
  });
  return router;
}
