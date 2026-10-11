/**
 * Additive 10-item menu price quotation. Disabled on the live customer site
 * until customer checkout, capture settlement and owner delivery are approved.
 *
 * This endpoint never creates orders, reserves inventory or calls Razorpay.
 * Checkout MUST independently recompute prices and atomically reserve stock.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { NEW_MENU_LAUNCH_ENABLED, MENU_CATALOG } from '../../shared/menuCatalog.ts';
import { priceNewMenuCheckout } from '../services/newMenuCheckoutService.ts';
import { createRateLimiter } from '../middleware/rateLimit.ts';

const cartLineSchema = z.strictObject({
  itemId: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(500),
});

const customerSchema = z.strictObject({
  name: z.string().trim().min(2).max(100),
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  address: z.string().trim().min(5).max(500),
  landmark: z.string().max(200).optional(),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  locationLink: z.string().max(2000).optional(),
});

export const quoteSchema = z.strictObject({
  lines: z.array(cartLineSchema).min(1).max(MENU_CATALOG.length),
  customer: customerSchema,
  requestedDeliveryDateIst: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const menuQuoteLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 20,
  message: 'Too many menu quote requests. Please retry shortly.',
});

/** Boolean override exists solely to test the still-inactive route locally. */
export function createNewMenuQuoteRouter(enabled = NEW_MENU_LAUNCH_ENABLED) {
  const router = Router();
  router.post('/quote',
    (req: Request, res: Response, next) => {
      if (!enabled) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Menu checkout is not available yet.' } });
      menuQuoteLimiter(req, res, next);
    },
    (req: Request, res: Response) => {
      const parsed = quoteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'INVALID_MENU_QUOTE', message: 'Invalid cart or delivery information.' } });
      }
      try {
        const quote = priceNewMenuCheckout(parsed.data);
        // No personal customer information is returned or persisted.
        return res.json({
          quote: {
            period: quote.period,
            deliveryDateIst: quote.deliveryDateIst,
            deliveryWindow: quote.deliveryWindow,
            earliestEligibleDeliveryUtc: quote.earliestEligibleDeliveryUtc,
            items: quote.items.map(({ item, quantity, lineTotalPaisa }) => ({
              itemId: item.id, unitPricePaisa: item.pricePaisa, quantity, lineTotalPaisa,
            })),
            totalUnits: quote.totalUnits,
            subtotalPaisa: quote.subtotalPaisa,
            deliveryChargePaisa: quote.deliveryChargePaisa,
            totalAmountPaisa: quote.totalAmountPaisa,
            distanceKm: quote.distanceKm,
          },
          stockReserved: false,
          paymentInitiated: false,
        });
      } catch (error: unknown) {
        return res.status(400).json({
          error: {
            code: 'UNAVAILABLE_MENU_QUOTE',
            message: error instanceof Error ? error.message : 'Unable to quote this cart.',
          },
        });
      }
    },
  );
  return router;
}

export const newMenuQuoteRouter = createNewMenuQuoteRouter();
