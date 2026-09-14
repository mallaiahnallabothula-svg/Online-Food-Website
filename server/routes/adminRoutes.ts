import { Router, Response } from 'express';
import crypto from 'crypto';
import {
  loginAdmin,
  logoutSession,
  requireAuth,
  requireRole,
  extractSessionToken,
  AuthenticatedRequest,
} from '../auth/index.ts';
import { AdminLoginSchema, UpdateOrderStatusSchema } from '../validation/schemas.ts';
import { authRateLimiter } from '../middleware/rateLimit.ts';
import { getDb } from '../db/index.ts';
import { getAuthoritativeAnalytics } from '../services/analyticsService.ts';
import { generateOrdersCsv } from '../services/exportService.ts';

export const adminRouter = Router();

// -------------------------------------------------------------
// Authentication Endpoints
// -------------------------------------------------------------

adminRouter.post('/login', authRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = AdminLoginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message || 'Invalid login details.',
      },
    });
  }

  const { username, password } = parsed.data;
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'];

  const loginResult = await loginAdmin(username, password, ip, userAgent);

  if (!loginResult.success || !loginResult.sessionToken || !loginResult.user) {
    return res.status(401).json({
      error: {
        code: 'AUTH_FAILED',
        message: loginResult.error || 'Authentication failed.',
        lockedUntil: loginResult.lockedUntil,
      },
    });
  }

  // Set secure HttpOnly cookie
  res.cookie('admin_session', loginResult.sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
  });

  res.json({
    success: true,
    user: loginResult.user,
    sessionToken: loginResult.sessionToken, // Also returned for API clients/tests
  });
});

adminRouter.post('/logout', async (req: AuthenticatedRequest, res: Response) => {
  const token = extractSessionToken(req);
  if (token) {
    await logoutSession(token);
  }
  res.clearCookie('admin_session', { path: '/' });
  res.json({ success: true, message: 'Logged out successfully.' });
});

adminRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    user: req.user,
  });
});

// -------------------------------------------------------------
// Protected Operations (ADMIN or STAFF)
// -------------------------------------------------------------

// Orders List with pagination, search, status, and date filters
adminRouter.get('/orders', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
  const offset = (page - 1) * limit;

  const status = req.query.status as string | undefined;
  const date = req.query.date as string | undefined;
  const search = req.query.search as string | undefined;

  let whereClauses: string[] = [];
  let queryArgs: any[] = [];

  if (status && status !== 'ALL') {
    whereClauses.push('fulfillment_status = ?');
    queryArgs.push(status);
  }

  if (date) {
    whereClauses.push('delivery_date = ?');
    queryArgs.push(date);
  }

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    whereClauses.push('(id LIKE ? OR customer_name LIKE ? OR customer_mobile LIKE ? OR address LIKE ?)');
    queryArgs.push(term, term, term, term);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Count total matching orders
  const countSql = `SELECT COUNT(*) as total FROM orders ${whereSql}`;
  const countRes = await db.execute({ sql: countSql, args: queryArgs });
  const total = Number(countRes.rows[0]?.total || 0);

  // Fetch paginated orders
  const selectSql = `
    SELECT
      id, created_at_utc, created_at_ist, delivery_date, delivery_window,
      jowar_quantity, chapathi_quantity, total_items, karivepaku_grams, avise_grams,
      jowar_unit_price_paisa, chapathi_unit_price_paisa, subtotal_paisa, delivery_charge_paisa, total_amount_paisa,
      payment_status, payment_provider, provider_payment_id, fulfillment_status,
      customer_name, customer_mobile, address, landmark, distance_km, location_link,
      received_at, received_by, updated_at, updated_by
    FROM orders
    ${whereSql}
    ORDER BY created_at_utc DESC
    LIMIT ? OFFSET ?
  `;

  const orderRes = await db.execute({ sql: selectSql, args: [...queryArgs, limit, offset] });

  const orders = orderRes.rows.map(r => ({
    id: String(r.id),
    createdAtUtc: String(r.created_at_utc),
    createdAtIst: String(r.created_at_ist),
    deliveryDate: String(r.delivery_date),
    deliveryWindow: String(r.delivery_window),
    jowarQuantity: Number(r.jowar_quantity),
    chapathiQuantity: Number(r.chapathi_quantity),
    totalItems: Number(r.total_items),
    karivepakuGrams: Number(r.karivepaku_grams),
    aviseGrams: Number(r.avise_grams),
    jowarUnitPrice: Math.round(Number(r.jowar_unit_price_paisa) / 100),
    chapathiUnitPrice: Math.round(Number(r.chapathi_unit_price_paisa) / 100),
    subtotal: Math.round(Number(r.subtotal_paisa) / 100),
    deliveryCharge: Math.round(Number(r.delivery_charge_paisa) / 100),
    totalAmount: Math.round(Number(r.total_amount_paisa) / 100),
    paymentStatus: String(r.payment_status),
    paymentProvider: String(r.payment_provider),
    providerPaymentId: String(r.provider_payment_id),
    fulfillmentStatus: String(r.fulfillment_status),
    customerName: String(r.customer_name),
    customerMobile: String(r.customer_mobile),
    address: String(r.address),
    landmark: r.landmark ? String(r.landmark) : '',
    distanceKm: Number(r.distance_km),
    locationLink: r.location_link ? String(r.location_link) : '',
    receivedAt: r.received_at ? String(r.received_at) : undefined,
    receivedBy: r.received_by ? String(r.received_by) : undefined,
    updatedAt: String(r.updated_at),
    updatedBy: String(r.updated_by),
  }));

  res.json({
    orders,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
});

// Update Order Fulfillment Status
adminRouter.patch('/orders/:id/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const orderId = String(req.params.id || '');
  if (!orderId) {
    return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Order ID is required.' } });
  }

  const parsed = UpdateOrderStatusSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message || 'Invalid status value.',
      },
    });
  }

  const newStatus = parsed.data.status;
  const db = getDb();

  const existingRes = await db.execute({
    sql: 'SELECT id, fulfillment_status FROM orders WHERE id = ? LIMIT 1',
    args: [orderId],
  });

  if (existingRes.rows.length === 0) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Order ${orderId} not found.`,
      },
    });
  }

  const oldStatus = String(existingRes.rows[0]?.fulfillment_status);
  const nowUtc = new Date().toISOString();
  // Authoritative actor derived from session only
  const actor = req.user!;

  await db.batch([
    {
      sql: `UPDATE orders SET
        fulfillment_status = ?,
        updated_at = ?,
        updated_by = ?
      WHERE id = ?`,
      args: [newStatus, nowUtc, `${actor.role}:${actor.username}`, orderId],
    },
    {
      sql: `INSERT INTO audit_logs (id, actor_type, actor_id, action, target_type, target_id, details, ip, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `AUD-${crypto.randomBytes(8).toString('hex')}`,
        actor.role,
        actor.username,
        'ORDER_STATUS_UPDATED',
        'ORDER',
        orderId,
        JSON.stringify({ from: oldStatus, to: newStatus }),
        req.ip ? String(req.ip) : null,
        nowUtc,
      ],
    },
  ]);

  res.json({
    success: true,
    orderId,
    oldStatus,
    newStatus,
    updatedAt: nowUtc,
    updatedBy: actor.username,
  });
});

// Analytics endpoint
adminRouter.get('/analytics', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await getAuthoritativeAnalytics();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'ANALYTICS_ERROR',
        message: err.message || 'Failed to compute analytics.',
      },
    });
  }
});

// Feedback list
adminRouter.get('/feedback', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  const resFb = await db.execute(`
    SELECT f.id, f.order_id, f.customer_name, f.rating, f.comment, f.is_public, f.created_at, o.customer_mobile
    FROM feedback f
    JOIN orders o ON f.order_id = o.id
    ORDER BY f.created_at DESC
  `);

  res.json({
    feedback: resFb.rows.map(r => ({
      id: String(r.id),
      orderId: String(r.order_id),
      customerName: String(r.customer_name),
      customerMobile: String(r.customer_mobile),
      rating: Number(r.rating),
      comment: r.comment ? String(r.comment) : '',
      isPublic: Boolean(r.is_public),
      createdAt: String(r.created_at),
    })),
  });
});

// Audit logs
adminRouter.get('/audit-logs', requireAuth, requireRole(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  const logsRes = await db.execute(`
    SELECT id, actor_type, actor_id, action, target_type, target_id, details, ip, created_at
    FROM audit_logs
    ORDER BY created_at DESC
    LIMIT 100
  `);

  res.json({
    auditLogs: logsRes.rows.map(r => ({
      id: String(r.id),
      actorType: String(r.actor_type),
      actorId: String(r.actor_id),
      action: String(r.action),
      targetType: String(r.target_type),
      targetId: String(r.target_id),
      details: r.details ? JSON.parse(String(r.details)) : null,
      ip: r.ip ? String(r.ip) : null,
      createdAt: String(r.created_at),
    })),
  });
});

// CSV Export
adminRouter.post('/exports/csv', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const dateFilter = req.body.date as string | undefined;
  const csv = await generateOrdersCsv(dateFilter);

  // Audit log the export
  const db = getDb();
  const nowUtc = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO audit_logs (id, actor_type, actor_id, action, target_type, target_id, details, ip, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      `AUD-${crypto.randomBytes(8).toString('hex')}`,
      req.user!.role,
      req.user!.username,
      'EXPORT_ORDERS_CSV',
      'EXPORT',
      dateFilter || 'ALL',
      JSON.stringify({ dateFilter }),
      req.ip || null,
      nowUtc,
    ],
  });

  const filename = `mana_enti_vanta_orders_${dateFilter || 'all'}_${Date.now()}.csv`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});
