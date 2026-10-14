import { Router, Request, Response } from 'express';
import { getOrderingStatus } from '../services/timeService.ts';
import { calculateDelivery } from '../services/deliveryService.ts';
import { DeliveryCalculationSchema } from '../validation/schemas.ts';
import { BUSINESS_CONFIG } from '../config/business.ts';
import { DELIVERY_POLICY } from '../../shared/deliveryPolicy.ts';
import { getDb } from '../db/index.ts';
import { z } from 'zod';
import { createRateLimiter } from '../middleware/rateLimit.ts';
import { resolveGoogleMapsShortLink, MapsShortLinkError } from '../services/mapsShortLinkService.ts';

export const publicRouter = Router();

// Health check endpoint
publicRouter.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Mannu’s Cloud Kitchen API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Business Status & Ordering Hours
publicRouter.get('/status', (req: Request, res: Response) => {
  const status = getOrderingStatus();
  res.json({
    ...status,
    status,
    business: {
      brand: BUSINESS_CONFIG.brand,
      prices: {
        jowarRotiRupees: Math.round(BUSINESS_CONFIG.prices.jowarRotiPaisa / 100),
        chapathiRupees: Math.round(BUSINESS_CONFIG.prices.chapathiPaisa / 100),
      },
      delivery: {
        freeRadiusKm: DELIVERY_POLICY.freeRadiusKm,
        standardRadiusKm: DELIVERY_POLICY.standardRadiusKm,
        maxRadiusKm: DELIVERY_POLICY.maxRadiusKm,
        standardChargeRupees: DELIVERY_POLICY.standardChargePaisa / 100,
        outerChargeRupees: DELIVERY_POLICY.outerChargePaisa / 100,
      },
      kitchen: {
        ...BUSINESS_CONFIG.kitchen,
        latitude: DELIVERY_POLICY.kitchenLatitude,
        longitude: DELIVERY_POLICY.kitchenLongitude,
      },
    },
  });
});

// Calculate Delivery Distance and Fee
publicRouter.post('/delivery/calculate', (req: Request, res: Response) => {
  const parsed = DeliveryCalculationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'INVALID_COORDINATES',
        message: 'Invalid coordinate or location parameters provided.',
        details: parsed.error.format(),
      },
    });
  }

  const { latitude, longitude } = parsed.data;
  const result = calculateDelivery(latitude, longitude);
  res.json(result);
});

// Google Maps short-link expansion (strictly allowlisted server-side; no arbitrary URL fetching).
const shortLinkLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
  message: 'Too many map link checks. Please wait a minute.',
});
const shortLinkInput = z.strictObject({ url: z.string().trim().min(15).max(300) });
publicRouter.post('/location/resolve', shortLinkLimiter, async (req: Request, res: Response) => {
  if (!req.is('application/json')) return res.status(415).json({ error: { code: 'INVALID_CONTENT_TYPE', message: 'JSON required.' } });
  const parsed = shortLinkInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_LINK', message: 'Enter a valid Google Maps share link.' } });
  try {
    const pin = await resolveGoogleMapsShortLink(parsed.data.url);
    return res.json(pin);
  } catch (error) {
    if (error instanceof MapsShortLinkError) return res.status(error.code === 'INVALID_LINK' ? 400 : 422)
      .json({ error: { code: error.code, message: error.message } });
    return res.status(422).json({ error: { code: 'UNRESOLVED_LINK', message: 'Could not check this Google Maps pin.' } });
  }
});

// Public Approved Feedback for social proof
publicRouter.get(['/public-feedback', '/feedback/approved'], async (req: Request, res: Response) => {
  const db = getDb();
  const resFb = await db.execute(`
    SELECT customer_name, rating, comment, created_at
    FROM feedback
    WHERE is_public = 1 AND publication_consent = 1
    ORDER BY created_at DESC
    LIMIT 6
  `);

  res.json({
    feedback: resFb.rows.map(r => ({
      customerName: String(r.customer_name),
      rating: Number(r.rating),
      comment: r.comment ? String(r.comment) : '',
      createdAt: String(r.created_at),
    })),
  });
});
