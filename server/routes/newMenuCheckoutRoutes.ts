/** Production new-menu checkout. This router stays closed unless the
 * production Vercel flag, live Razorpay key, and persistent idempotency key
 * are all configured. Legacy checkout routes are independent.
 */
import { applyPappuSnapshot, resolvePappu } from '../services/pappuService.ts';
import { getSmartMenuRules,menuRuleBlock,assertSmartMenuAvailable,applyCurrySnapshot,isPendingOrderMenuOpen } from '../services/smartMenuService.ts';
import { getNextPreorderDeliverySlot } from '../../shared/preorderScheduling.ts';
import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/index.ts';
import { createRateLimiter } from '../middleware/rateLimit.ts';
import { MENU_CATALOG, NEW_MENU_LAUNCH_ENABLED, isPublicMenuPeriod, isDiscontinuedPublicMenuItem } from '../../shared/menuCatalog.ts';
import { priceNewMenuCheckout, type NewMenuCheckoutRequest } from '../services/newMenuCheckoutService.ts';
import { getMenuStockRemaining } from '../services/menuStockService.ts';
import { prepareProductionNewMenuCheckoutIdempotent } from '../services/inactiveNewMenuIdempotencyService.ts';
import { createProductionNewMenuGatewayOrder } from '../services/inactiveNewMenuGatewayOrderService.ts';
import { verifyAndSettleNewMenuPayment } from '../services/newMenuPaymentSafetyService.ts';

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
  expectedPappu: z.string().regex(/^\d{4}-\d{2}-\d{2}:(TOMATO|PALAKURA|THOTAKURA)$/).optional(),
  expectedCurry: z.string().min(12).max(80).optional(),
  requestedDeliveryDateIst: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
const prepareSchema = z.strictObject({ request: cartSchema, requestKey: z.string().uuid() });
const accessSchema = z.strictObject({ orderId: orderIdSchema, customerAccessToken: tokenSchema });
const confirmSchema = accessSchema.extend({
  providerPaymentId: z.string().regex(/^pay_[A-Za-z0-9]{5,64}$/),
  providerSignature: z.string().regex(/^[a-fA-F0-9]{64}$/),
});

const limiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 30,
  message: 'Too many checkout requests. Please retry shortly.',
});

function isProductionCheckoutEnabled(): boolean {
  return NEW_MENU_LAUNCH_ENABLED && process.env.NODE_ENV === 'production' &&
    process.env.VERCEL_ENV === 'production' &&
    /^rzp_live_[A-Za-z0-9]+$/.test(process.env.RAZORPAY_KEY_ID ?? '') &&
    /^[a-f0-9]{64}$/.test(process.env.NEW_MENU_IDEMPOTENCY_SECRET ?? '');
}

function idempotencySecret(): Buffer {
  const value = process.env.NEW_MENU_IDEMPOTENCY_SECRET ?? '';
  if (!/^[a-f0-9]{64}$/.test(value)) throw new Error('Checkout idempotency is not configured');
  return Buffer.from(value, 'hex');
}

function credentials() {
  return {
    keyId: process.env.RAZORPAY_KEY_ID ?? '',
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
  };
}

async function orderForToken(orderId: string, token: string) {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const result = await getDb().execute({
    sql: 'SELECT id FROM orders WHERE id=? AND public_token_hash=? LIMIT 1',
    args: [orderId, hash],
  });
  return result.rows.length > 0;
}

export const newMenuCheckoutRouter = Router();
newMenuCheckoutRouter.get('/menu-status', limiter, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!NEW_MENU_LAUNCH_ENABLED) return res.status(404).json({ error: 'Menu unavailable' });
  const period = req.query.period;
  if (period !== 'MORNING' && period !== 'EVENING') return res.status(400).json({ error: 'Invalid session' });
  if (!isPublicMenuPeriod(period)) return res.status(404).json({ error: 'Menu unavailable' });
  const date = getNextPreorderDeliverySlot(period, new Date()).deliveryDateIst;
  try {
    const db = getDb();
    const pappu = period === 'EVENING' ? await resolvePappu(db, date) : null;
    const rules=await getSmartMenuRules(db,period,date);
    const closed=Boolean(menuRuleBlock(rules,[],new Date()));
    const menu=MENU_CATALOG.filter(item=>item.mealPeriod===period);
    const unavailableItemIds=menu.filter(item=>closed || rules.pauses[item.id] ||
      (item.id==='curry-of-the-day' && !rules.curryName)).map(item=>item.id);
    const stock:Record<string,number>={};
    for (const item of menu)
      stock[item.id]=unavailableItemIds.includes(item.id)?0:await getMenuStockRemaining(db,item.id,date);
    return res.json({ deliveryDateIst: date, pappu, stock, orderingEnabled: isProductionCheckoutEnabled(),
      closed,unavailableItemIds,curryName:rules.curryName,curryNameTe:rules.curryNameTe });
  } catch { return res.status(503).json({ error: 'Menu availability unavailable. Please retry.' }); }
});
newMenuCheckoutRouter.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!isProductionCheckoutEnabled()) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'New menu ordering is unavailable.' } });
  }
  if (!req.is('application/json') || req.get('x-menu-checkout') !== '1') {
    return res.status(403).json({ error: { code: 'INVALID_REQUEST' } });
  }
  return limiter(req, res, next);
});

newMenuCheckoutRouter.post('/quote', async (req, res) => {
  const parsed = cartSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_CART' } });
  if (parsed.data.lines.some(line => isDiscontinuedPublicMenuItem(line.itemId))) {
    return res.status(410).json({ error: { code: 'MENU_PERIOD_DISCONTINUED', message: 'Morning menu is no longer available.' } });
  }
  try {
    const db = getDb();
    const pricing = priceNewMenuCheckout(parsed.data);
    await assertSmartMenuAvailable(db,pricing.period,pricing.deliveryDateIst,pricing.items.map(x=>x.item.id));
    const pappu = await applyPappuSnapshot(db, pricing);
    const expectedCurry = await applyCurrySnapshot(db, pricing);
    const items = await Promise.all(pricing.items.map(async ({ item, quantity, lineTotalPaisa }) => ({
      itemId: item.id,
      itemName: item.nameEn,
      quantity,
      lineTotalPaisa,
      unitPricePaisa: item.pricePaisa,
      remainingEstimate: item.dailyPlateLimit === null ? null : await getMenuStockRemaining(
        db, item.id, pricing.deliveryDateIst, Date.now(),
      ),
    })));
    return res.json({
      quote: {
        items,
        expectedPappu: pappu ? pricing.deliveryDateIst + ':' + pappu : undefined,
        expectedCurry,
        period: pricing.period,
        deliveryDateIst: pricing.deliveryDateIst,
        deliveryWindow: pricing.deliveryWindow,
        earliestEligibleDeliveryUtc: pricing.earliestEligibleDeliveryUtc,
        subtotalPaisa: pricing.subtotalPaisa,
        deliveryChargePaisa: pricing.deliveryChargePaisa,
        totalAmountPaisa: pricing.totalAmountPaisa,
        distanceKm: pricing.distanceKm,
      },
      stockReserved: false,
      paymentInitiated: false,
    });
  } catch (error) {
    return res.status(422).json({
      error: { code: 'QUOTE_UNAVAILABLE', message: error instanceof Error ? error.message : 'Unable to quote this cart.' },
    });
  }
});

newMenuCheckoutRouter.post('/prepare', async (req, res) => {
  const parsed = prepareSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_CHECKOUT' } });
  if (parsed.data.request.lines.some(line => isDiscontinuedPublicMenuItem(line.itemId))) {
    return res.status(410).json({ error: { code: 'MENU_PERIOD_DISCONTINUED', message: 'Morning menu is no longer available.' } });
  }
  try {
    const prepared = await prepareProductionNewMenuCheckoutIdempotent(
      getDb(), parsed.data.request as NewMenuCheckoutRequest,
      parsed.data.requestKey, idempotencySecret(), new Date(),
    );
    return res.json({ checkout: {
      orderId: prepared.orderId,
      customerAccessToken: prepared.customerAccessToken,
      expiresAtMs: prepared.expiresAtMs,
      idempotent: prepared.idempotent,
      totalAmountPaisa: prepared.pricing.totalAmountPaisa,
      currency: 'INR',
      deliveryDateIst: prepared.pricing.deliveryDateIst,
      deliveryWindow: prepared.pricing.deliveryWindow,
    } });
  } catch {
    return res.status(409).json({ error: { code: 'CHECKOUT_REVIEW_REQUIRED' } });
  }
});

newMenuCheckoutRouter.post('/gateway', async (req, res) => {
  const parsed = accessSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_CHECKOUT' } });
  try {
    if (!await orderForToken(parsed.data.orderId, parsed.data.customerAccessToken)) {
      return res.status(403).json({ error: { code: 'INVALID_TRACKING_TOKEN' } });
    }
    // Stop NEW payment attempts when the owner closes, pauses or changes today's menu.
    await isPendingOrderMenuOpen(getDb(),parsed.data.orderId);
    const result = await createProductionNewMenuGatewayOrder(
      getDb(), parsed.data.orderId, credentials(), fetch, Date.now(),
    );
    return res.json({ gateway: result });
  } catch {
    return res.status(409).json({ error: { code: 'GATEWAY_REVIEW_REQUIRED' } });
  }
});

newMenuCheckoutRouter.post('/confirm', async (req, res) => {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_PAYMENT' } });
  try {
    if (!await orderForToken(parsed.data.orderId, parsed.data.customerAccessToken)) {
      return res.status(403).json({ error: { code: 'INVALID_TRACKING_TOKEN' } });
    }
    const settled = await verifyAndSettleNewMenuPayment(getDb(), {
      orderId: parsed.data.orderId,
      providerPaymentId: parsed.data.providerPaymentId,
      providerSignature: parsed.data.providerSignature,
    }, Date.now(), credentials(), fetch);
    return res.json({ settlement: {
      orderId: settled.orderId,
      status: settled.status,
      idempotent: settled.idempotent,
      reason: settled.reason ?? null,
    } });
  } catch {
    return res.status(409).json({ error: { code: 'PAYMENT_VERIFICATION_FAILED' } });
  }
});
