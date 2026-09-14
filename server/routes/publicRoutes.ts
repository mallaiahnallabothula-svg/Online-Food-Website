import { Router, Request, Response } from 'express';
import { getOrderingStatus } from '../services/timeService.ts';
import { calculateDelivery } from '../services/deliveryService.ts';
import { DeliveryCalculationSchema } from '../validation/schemas.ts';
import { BUSINESS_CONFIG } from '../config/business.ts';
import { getDb } from '../db/index.ts';

export const publicRouter = Router();

// Health check endpoint
publicRouter.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Mana Enti Vanta API',
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
        freeRadiusKm: BUSINESS_CONFIG.delivery.freeRadiusKm,
        maxRadiusKm: BUSINESS_CONFIG.delivery.maxRadiusKm,
        extraKmRateRupees: Math.round(BUSINESS_CONFIG.delivery.extraKmRatePaisa / 100),
      },
      kitchen: BUSINESS_CONFIG.kitchen,
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

// Public Approved Feedback for social proof
publicRouter.get(['/public-feedback', '/feedback/approved'], async (req: Request, res: Response) => {
  const db = getDb();
  const resFb = await db.execute(`
    SELECT customer_name, rating, comment, created_at
    FROM feedback
    WHERE is_public = 1
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
