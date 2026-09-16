import crypto from 'crypto';
import { getDb, withDbRetry } from '../db/index.ts';
import type { PaymentIntent } from '../payments/provider.ts';
import { generateServerOrderTicket, type OrderForTicket } from './ticketService.ts';

export interface FinalOrderResult {
  orderId: string;
  customerAccessToken: string;
  order: FormattedOrder;
  ticket?: string;
  idempotent?: boolean;
}

export interface FormattedOrder {
  id: string;
  customerAccessToken?: string;
  createdAtUtc: string;
  createdAtIst: string;
  createdAtIST: string;
  deliveryDate: string;
  deliveryWindow: string;
  jowarQuantity: number;
  chapathiQuantity: number;
  totalItems: number;
  quantity: number;
  karivepakuGrams: number;
  aviseGrams: number;
  karamQuantities: {
    karivepakuGrams: number;
    aviseGinjaluGrams: number;
  };
  karamSelection: {
    karivepaku: boolean;
    aviseGinjalu: boolean;
  };
  jowarUnitPrice: number;
  chapathiUnitPrice: number;
  pricePerRoti: number;
  pricePerChapathi: number;
  subtotal: number;
  deliveryCharge: number;
  totalAmount: number;
  totalPaid: number;
  currency: string;
  paymentStatus: string;
  orderStatus: 'PENDING' | 'PAID' | 'CONFIRMED' | 'TICKET_GENERATED';
  ticketText?: string;
  ticketGeneratedAt?: string;
  fulfillmentStatus: string;
  customerName: string;
  customerMobile: string;
  address: string;
  landmark?: string;
  distanceKm: number;
  locationLink?: string;
  paymentProvider: string;
  providerPaymentId: string;
  paymentReference: string;
  customer?: {
    name: string;
    mobile: string;
    address: string;
    landmark?: string;
    distanceKm: number;
    locationLink?: string;
  };
  receivedAt?: string;
  updatedAt: string;
}

export function formatCustomerSafeOrder(order: FormattedOrder) {
  return {
    id: order.id,
    orderStatus: order.orderStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    paymentStatus: order.paymentStatus,
    createdAtIst: order.createdAtIst,
    deliveryDate: order.deliveryDate,
    deliveryWindow: order.deliveryWindow,
    jowarQuantity: order.jowarQuantity,
    chapathiQuantity: order.chapathiQuantity,
    totalItems: order.totalItems,
    subtotal: order.subtotal,
    deliveryCharge: order.deliveryCharge,
    totalAmount: order.totalAmount,
    currency: order.currency,
    ticketText: order.ticketText,
    ticketGeneratedAt: order.ticketGeneratedAt,
    karamSelection: order.karamSelection,
    karamQuantities: order.karamQuantities,
    customer: {
      name: order.customerName,
      mobile: order.customerMobile ? (order.customerMobile.length > 4 ? order.customerMobile.slice(0, 2) + '******' + order.customerMobile.slice(-2) : '******') : '',
      address: order.address,
      landmark: order.landmark,
      distanceKm: order.distanceKm,
    },
    receivedAt: order.receivedAt,
  };
}

export function formatOrderRow(row: any, fallbackToken?: string): FormattedOrder {
  const jowarQty = Number(row.jowar_quantity || 0);
  const chapathiQty = Number(row.chapathi_quantity || 0);
  const totalItems = Number(row.total_items || (jowarQty + chapathiQty));
  const jowarUnitPrice = Math.round(Number(row.jowar_unit_price_paisa || 3000) / 100);
  const chapathiUnitPrice = Math.round(Number(row.chapathi_unit_price_paisa || 1000) / 100);
  const subtotal = Math.round(Number(row.subtotal_paisa || 0) / 100);
  const deliveryCharge = Math.round(Number(row.delivery_charge_paisa || 0) / 100);
  const totalAmount = Math.round(Number(row.total_amount_paisa || 0) / 100);
  const karivepakuGrams = Number(row.karivepaku_grams || 0);
  const aviseGrams = Number(row.avise_grams || 0);
  const providerPaymentId = String(row.provider_payment_id || '');
  const orderId = String(row.id);
  const customerName = String(row.customer_name || 'Customer');
  const customerMobile = String(row.customer_mobile || '');
  const address = String(row.address || '');
  const landmark = row.landmark ? String(row.landmark) : undefined;
  const distanceKm = Number(row.distance_km || 0);
  const locationLink = row.location_link ? String(row.location_link) : undefined;
  const orderStatus = (row.order_status || 'TICKET_GENERATED') as FormattedOrder['orderStatus'];
  const token = fallbackToken || undefined;

  return {
    id: orderId,
    customerAccessToken: token,
    createdAtUtc: String(row.created_at_utc || new Date().toISOString()),
    createdAtIst: String(row.created_at_ist || ''),
    createdAtIST: String(row.created_at_ist || ''),
    deliveryDate: String(row.delivery_date || ''),
    deliveryWindow: String(row.delivery_window || '18:00-20:00'),
    jowarQuantity: jowarQty,
    chapathiQuantity: chapathiQty,
    totalItems,
    quantity: totalItems,
    karivepakuGrams,
    aviseGrams,
    karamQuantities: {
      karivepakuGrams,
      aviseGinjaluGrams: aviseGrams,
    },
    karamSelection: {
      karivepaku: karivepakuGrams > 0,
      aviseGinjalu: aviseGrams > 0,
    },
    jowarUnitPrice,
    chapathiUnitPrice,
    pricePerRoti: jowarUnitPrice,
    pricePerChapathi: chapathiUnitPrice,
    subtotal,
    deliveryCharge,
    totalAmount,
    totalPaid: totalAmount,
    currency: String(row.currency || 'INR'),
    paymentStatus: String(row.payment_status || 'PENDING'),
    orderStatus,
    ticketText: row.ticket_text ? String(row.ticket_text) : undefined,
    ticketGeneratedAt: row.ticket_generated_at ? String(row.ticket_generated_at) : undefined,
    fulfillmentStatus: String(row.fulfillment_status || 'RECEIVED'),
    customerName,
    customerMobile,
    address,
    landmark,
    distanceKm,
    locationLink,
    paymentProvider: String(row.payment_provider || 'UPI'),
    providerPaymentId,
    paymentReference: providerPaymentId,
    customer: {
      name: customerName,
      mobile: customerMobile,
      address,
      landmark,
      distanceKm,
      locationLink,
    },
    receivedAt: row.received_at ? String(row.received_at) : undefined,
    updatedAt: String(row.updated_at || ''),
  };
}

/**
 * 1. Create PENDING Order in Database upon checkout initiation
 */
export async function createPendingOrder(
  intent: PaymentIntent,
  mockVerificationToken?: string
): Promise<{
  orderId: string;
  customerAccessToken: string;
  order: FormattedOrder;
}> {
  const db = getDb();
  const pricing = intent.orderPricing;
  const customer = intent.customer;

  const todayStr = pricing.deliveryDate.replace(/-/g, '');
  const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  const orderId = `SMJR-${todayStr}-${randomSuffix}`;

  const customerAccessToken = crypto.randomBytes(32).toString('hex');
  const publicTokenHash = crypto.createHash('sha256').update(customerAccessToken).digest('hex');

  const nowUtc = new Date().toISOString();
  const istDate = new Date(Date.now() + (5 * 60 + 30) * 60 * 1000);
  const istFormatted = `${istDate.getUTCDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][istDate.getUTCMonth()]} ${istDate.getUTCFullYear()}, ${String(istDate.getUTCHours()).padStart(2, '0')}:${String(istDate.getUTCMinutes()).padStart(2, '0')} IST`;

  await db.batch([
    {
      sql: `INSERT INTO orders (
        id, public_token_hash, created_at_utc, created_at_ist, delivery_date, delivery_window,
        jowar_quantity, chapathi_quantity, total_items, karivepaku_grams, avise_grams,
        jowar_unit_price_paisa, chapathi_unit_price_paisa, subtotal_paisa, delivery_charge_paisa, total_amount_paisa,
        currency, payment_status, order_status, payment_provider, provider_payment_id, fulfillment_status,
        customer_name, customer_mobile, address, landmark, latitude, longitude, distance_km,
        location_link, location_verified, created_by, updated_at, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        orderId,
        publicTokenHash,
        nowUtc,
        istFormatted,
        pricing.deliveryDate,
        pricing.deliveryWindow,
        pricing.jowarQuantity,
        pricing.chapathiQuantity,
        pricing.totalItems,
        pricing.karamQuantities.karivepakuGrams,
        pricing.karamQuantities.aviseGinjaluGrams,
        pricing.jowarUnitPricePaisa,
        pricing.chapathiUnitPricePaisa,
        pricing.subtotalPaisa,
        pricing.deliveryChargePaisa,
        pricing.totalAmountPaisa,
        'INR',
        'PENDING',
        'PENDING',
        intent.provider,
        'AWAITING_PAYMENT',
        'RECEIVED',
        customer.name,
        customer.mobile,
        customer.address,
        customer.landmark || '',
        customer.latitude ?? null,
        customer.longitude ?? null,
        pricing.deliveryDistanceKm,
        customer.locationLink || null,
        customer.latitude && customer.longitude ? 1 : 0,
        'CUSTOMER',
        nowUtc,
        'SYSTEM',
      ],
    },
    {
      sql: `INSERT INTO audit_logs (
        id, actor_type, actor_id, action, target_type, target_id, details, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `AUD-${crypto.randomBytes(8).toString('hex')}`,
        'SYSTEM',
        'CHECKOUT',
        'ORDER_PENDING_CREATED',
        'ORDER',
        orderId,
        JSON.stringify({
          amountRupees: Math.round(pricing.totalAmountPaisa / 100),
          customerMobile: customer.mobile,
          deliveryDate: pricing.deliveryDate,
        }),
        nowUtc,
      ],
    },
  ]);

  const orderRes = await db.execute({
    sql: 'SELECT * FROM orders WHERE id = ? LIMIT 1',
    args: [orderId],
  });

  const formatted = formatOrderRow(orderRes.rows[0], customerAccessToken);

  return {
    orderId,
    customerAccessToken,
    order: formatted,
  };
}

/**
 * 2. Idempotent & Atomic Order Transition:
 * PENDING → PAID → CONFIRMED → TICKET_GENERATED
 */
export async function transitionOrderToTicketGenerated(
  orderIdOrIntentId: string,
  paymentInfo: {
    provider: string;
    providerPaymentId: string;
    providerSignature?: string;
    amountPaisa?: number;
    rawPayload?: any;
  },
  actorType: 'GATEWAY_WEBHOOK' | 'GATEWAY_VERIFIER' | 'GATEWAY_AUTO_SETTLER' = 'GATEWAY_WEBHOOK'
): Promise<FinalOrderResult> {
  const db = getDb();
  const cleanId = orderIdOrIntentId.trim();

  // Find order by ID, provider_payment_id, or active token
  const safeProviderPaymentId = paymentInfo.providerPaymentId || '';
  let orderRowRes = await withDbRetry(async () =>
    db.execute({
      sql: 'SELECT * FROM orders WHERE id = ? OR (provider_payment_id IS NOT NULL AND provider_payment_id = ?) LIMIT 1',
      args: [cleanId, safeProviderPaymentId],
    })
  );

  if (orderRowRes.rows.length === 0 && safeProviderPaymentId) {
    // If passed providerPaymentId, check payments table
    const payRes = await withDbRetry(async () =>
      db.execute({
        sql: 'SELECT order_id FROM payments WHERE provider_payment_id = ? LIMIT 1',
        args: [safeProviderPaymentId],
      })
    );
    if (payRes.rows.length > 0) {
      const oid = String(payRes.rows[0]?.order_id);
      orderRowRes = await withDbRetry(async () =>
        db.execute({
          sql: 'SELECT * FROM orders WHERE id = ? LIMIT 1',
          args: [oid],
        })
      );
    }
  }

  if (orderRowRes.rows.length === 0) {
    throw new Error(`Order not found for identifier ${cleanId}`);
  }

  const existingRow = orderRowRes.rows[0]!;
  const orderId = String(existingRow.id);

  // SECURITY: Prevent Payment Reuse
  // Ensure the provider payment ID has not already been used for another order
  if (paymentInfo.providerPaymentId) {
    const existingPaymentRes = await withDbRetry(async () =>
      db.execute({
        sql: 'SELECT order_id FROM payments WHERE provider_payment_id = ? AND order_id != ? LIMIT 1',
        args: [paymentInfo.providerPaymentId, orderId],
      })
    );
    if (existingPaymentRes.rows.length > 0) {
      throw new Error(
        `Security Violation: Payment transaction ${paymentInfo.providerPaymentId} has already been settled for another order.`
      );
    }
  }

  // IDEMPOTENCY CHECK:
  // If order is already PAID / CONFIRMED / TICKET_GENERATED, return current state
  if (
    existingRow.order_status === 'TICKET_GENERATED' ||
    existingRow.payment_status === 'PAID'
  ) {
    const formatted = formatOrderRow(existingRow);
    return {
      orderId,
      customerAccessToken: '',
      order: formatted,
      ticket: String(existingRow.ticket_text || ''),
      idempotent: true,
    };
  }

  const nowUtc = new Date().toISOString();
  const totalAmountPaisa = Number(existingRow.total_amount_paisa);

  // SECURITY: Prevent Underpayment / Overpayment
  // If amountPaisa is provided by the gateway, it MUST match the server-calculated order total
  if (paymentInfo.amountPaisa !== undefined && paymentInfo.amountPaisa !== totalAmountPaisa) {
    await withDbRetry(async () =>
      db.execute({
        sql: `INSERT INTO audit_logs (id, actor_type, actor_id, action, target_type, target_id, details, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          `AUD-${crypto.randomBytes(8).toString('hex')}`,
          'SYSTEM',
          actorType,
          'PAYMENT_AMOUNT_MISMATCH',
          'ORDER',
          orderId,
          JSON.stringify({ expectedPaisa: totalAmountPaisa, receivedPaisa: paymentInfo.amountPaisa }),
          nowUtc,
        ],
      })
    );
    throw new Error(
      `Security Violation: Payment amount mismatch. Expected ₹${totalAmountPaisa / 100}, received ₹${paymentInfo.amountPaisa / 100}`
    );
  }

  // Authoritatively format order details for ticket generation
  const orderForTicket: OrderForTicket = {
    id: orderId,
    createdAtIst: String(existingRow.created_at_ist || ''),
    deliveryDate: String(existingRow.delivery_date),
    deliveryWindow: String(existingRow.delivery_window || '18:00-20:00'),
    jowarQuantity: Number(existingRow.jowar_quantity),
    chapathiQuantity: Number(existingRow.chapathi_quantity),
    jowarUnitPrice: Math.round(Number(existingRow.jowar_unit_price_paisa) / 100),
    chapathiUnitPrice: Math.round(Number(existingRow.chapathi_unit_price_paisa) / 100),
    subtotal: Math.round(Number(existingRow.subtotal_paisa) / 100),
    deliveryCharge: Math.round(Number(existingRow.delivery_charge_paisa) / 100),
    totalAmount: Math.round(totalAmountPaisa / 100),
    karivepakuGrams: Number(existingRow.karivepaku_grams),
    aviseGrams: Number(existingRow.avise_grams),
    customerName: String(existingRow.customer_name),
    customerMobile: String(existingRow.customer_mobile),
    address: String(existingRow.address),
    landmark: existingRow.landmark ? String(existingRow.landmark) : undefined,
    distanceKm: Number(existingRow.distance_km),
    locationLink: existingRow.location_link ? String(existingRow.location_link) : undefined,
    latitude: existingRow.latitude ? Number(existingRow.latitude) : undefined,
    longitude: existingRow.longitude ? Number(existingRow.longitude) : undefined,
    providerPaymentId: paymentInfo.providerPaymentId,
    paymentProvider: paymentInfo.provider,
  };

  // Generate authoritative WhatsApp ticket
  const ticketText = generateServerOrderTicket(orderForTicket, 'te');
  const paymentRecordId = `PAY-${crypto.randomBytes(8).toString('hex')}`;

  // Execute atomic multi-step transaction:
  // PENDING → PAID → CONFIRMED → TICKET_GENERATED
  await db.batch([
    // Step 1: Update order record with PAID, CONFIRMED, and TICKET_GENERATED
    {
      sql: `UPDATE orders SET
        payment_status = 'PAID',
        order_status = 'TICKET_GENERATED',
        payment_provider = ?,
        provider_payment_id = ?,
        fulfillment_status = 'RECEIVED',
        ticket_text = ?,
        ticket_generated_at = ?,
        updated_at = ?,
        updated_by = ?
      WHERE id = ?`,
      args: [
        paymentInfo.provider,
        paymentInfo.providerPaymentId,
        ticketText,
        nowUtc,
        nowUtc,
        actorType,
        orderId,
      ],
    },
    // Step 2: Record Payment in payments table
    {
      sql: `INSERT INTO payments (
        id, order_id, provider, provider_payment_id, amount_paisa, status, signature, raw_payload, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        paymentRecordId,
        orderId,
        paymentInfo.provider,
        paymentInfo.providerPaymentId,
        paymentInfo.amountPaisa || totalAmountPaisa,
        'SUCCESS',
        paymentInfo.providerSignature || null,
        paymentInfo.rawPayload ? JSON.stringify(paymentInfo.rawPayload) : JSON.stringify({ actorType, verifiedAt: nowUtc }),
        nowUtc,
      ],
    },
    // Step 3: Audit Log PENDING -> PAID
    {
      sql: `INSERT INTO audit_logs (
        id, actor_type, actor_id, action, target_type, target_id, details, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `AUD-${crypto.randomBytes(8).toString('hex')}`,
        'SYSTEM',
        actorType,
        'ORDER_STATUS_PAID',
        'ORDER',
        orderId,
        JSON.stringify({
          previousStatus: 'PENDING',
          newStatus: 'PAID',
          providerPaymentId: paymentInfo.providerPaymentId,
          amountRupees: Math.round(totalAmountPaisa / 100),
        }),
        nowUtc,
      ],
    },
    // Step 4: Audit Log PAID -> CONFIRMED
    {
      sql: `INSERT INTO audit_logs (
        id, actor_type, actor_id, action, target_type, target_id, details, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `AUD-${crypto.randomBytes(8).toString('hex')}`,
        'SYSTEM',
        actorType,
        'ORDER_STATUS_CONFIRMED',
        'ORDER',
        orderId,
        JSON.stringify({
          previousStatus: 'PAID',
          newStatus: 'CONFIRMED',
          message: 'Order confirmed authoritatively upon verified payment.',
        }),
        nowUtc,
      ],
    },
    // Step 5: Audit Log CONFIRMED -> TICKET_GENERATED
    {
      sql: `INSERT INTO audit_logs (
        id, actor_type, actor_id, action, target_type, target_id, details, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `AUD-${crypto.randomBytes(8).toString('hex')}`,
        'SYSTEM',
        actorType,
        'TICKET_GENERATED',
        'ORDER',
        orderId,
        JSON.stringify({
          previousStatus: 'CONFIRMED',
          newStatus: 'TICKET_GENERATED',
          ticketLength: ticketText.length,
          generatedAt: nowUtc,
        }),
        nowUtc,
      ],
    },
  ]);

  const updatedRowRes = await db.execute({
    sql: 'SELECT * FROM orders WHERE id = ? LIMIT 1',
    args: [orderId],
  });

  const formatted = formatOrderRow(updatedRowRes.rows[0]);

  return {
    orderId,
    customerAccessToken: '',
    order: formatted,
    ticket: ticketText,
    idempotent: false,
  };
}

/**
 * 3. Polling and Lookup: Get current order and payment status
 * Requires valid customerAccessToken OR unexpired payment intentId
 */
export async function getOrderStatus(tokenOrIntentId: string): Promise<{
  orderId: string;
  orderStatus: 'PENDING' | 'PAID' | 'CONFIRMED' | 'TICKET_GENERATED';
  paymentStatus: string;
  isPaid: boolean;
  isConfirmed: boolean;
  ticketGenerated: boolean;
  order: FormattedOrder | null;
  ticket?: string;
  customerAccessToken?: string;
} | null> {
  const clean = tokenOrIntentId.trim();
  const db = getDb();

  let orderRow: any = null;

  // 1. Check if token matches customer public_token_hash
  const tokenHash = crypto.createHash('sha256').update(clean).digest('hex');
  const tokenRes = await withDbRetry(async () =>
    db.execute({
      sql: 'SELECT * FROM orders WHERE public_token_hash = ? LIMIT 1',
      args: [tokenHash],
    })
  );

  if (tokenRes.rows.length > 0) {
    orderRow = tokenRes.rows[0];
  } else if (clean.startsWith('pi_')) {
    // 2. Check if it's an active intentId for the checkout session
    const intentRes = await withDbRetry(async () =>
      db.execute({
        sql: 'SELECT order_id FROM payment_intents WHERE id = ? LIMIT 1',
        args: [clean],
      })
    );
    if (intentRes.rows.length > 0) {
      const orderId = String(intentRes.rows[0]?.order_id);
      const rowRes = await withDbRetry(async () =>
        db.execute({
          sql: 'SELECT * FROM orders WHERE id = ? LIMIT 1',
          args: [orderId],
        })
      );
      if (rowRes.rows.length > 0) {
        orderRow = rowRes.rows[0];
      }
    }
  }

  if (!orderRow) {
    return null;
  }

  const orderId = String(orderRow.id);
  const formatted = formatOrderRow(orderRow);
  const isPaid = orderRow.payment_status === 'PAID';
  const orderStatus = (orderRow.order_status || 'TICKET_GENERATED') as FormattedOrder['orderStatus'];
  const isConfirmed = orderStatus === 'CONFIRMED' || orderStatus === 'TICKET_GENERATED';
  const ticketGenerated = orderStatus === 'TICKET_GENERATED';

  return {
    orderId,
    orderStatus,
    paymentStatus: String(orderRow.payment_status),
    isPaid,
    isConfirmed,
    ticketGenerated,
    order: formatted,
    ticket: orderRow.ticket_text ? String(orderRow.ticket_text) : undefined,
    customerAccessToken: clean.startsWith('pi_') ? undefined : clean,
  };
}

/**
 * 4. Backward-compatible wrapper for createOrderFromVerifiedPayment
 */
export async function createOrderFromVerifiedPayment(
  intent: PaymentIntent,
  providerPaymentId: string,
  providerSignature?: string
): Promise<FinalOrderResult> {
  // If order was already created as pending with intent.orderId
  if (intent.orderId) {
    return await transitionOrderToTicketGenerated(
      intent.orderId,
      {
        provider: intent.provider,
        providerPaymentId,
        providerSignature,
      },
      'GATEWAY_VERIFIER'
    );
  }

  // Otherwise create pending then transition atomically
  const pending = await createPendingOrder(intent);
  return await transitionOrderToTicketGenerated(
    pending.orderId,
    {
      provider: intent.provider,
      providerPaymentId,
      providerSignature,
    },
    'GATEWAY_VERIFIER'
  );
}

/**
 * 5. Customer Tracking Token Lookup
 * MUST use customerAccessToken only. Arbitrary order ID lookup is rejected.
 */
export async function getOrderByCustomerToken(token: string): Promise<FormattedOrder | null> {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return null;
  }
  const clean = token.trim();
  const tokenHash = crypto.createHash('sha256').update(clean).digest('hex');
  const db = getDb();

  const res = await withDbRetry(async () =>
    db.execute({
      sql: 'SELECT * FROM orders WHERE public_token_hash = ? LIMIT 1',
      args: [tokenHash],
    })
  );

  if (res.rows.length === 0) {
    return null;
  }

  return formatOrderRow(res.rows[0]!);
}

/**
 * 6. Customer Confirms Receipt
 * MUST use customerAccessToken only.
 * Only permitted if fulfillment_status is OUT_FOR_DELIVERY or DELIVERED.
 */
export async function markOrderReceivedByCustomer(token: string) {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    throw new Error('Invalid or missing customer access token');
  }
  const clean = token.trim();
  const tokenHash = crypto.createHash('sha256').update(clean).digest('hex');
  const db = getDb();
  const res = await withDbRetry(async () =>
    db.execute({
      sql: 'SELECT id, fulfillment_status, customer_name FROM orders WHERE public_token_hash = ? LIMIT 1',
      args: [tokenHash],
    })
  );

  if (res.rows.length === 0) {
    throw new Error('Order not found or unauthorized customer access token');
  }

  const row = res.rows[0]!;
  const currentFulfillment = String(row.fulfillment_status);

  // Business Rule: Can only mark received if out for delivery or already delivered
  if (currentFulfillment !== 'OUT_FOR_DELIVERY' && currentFulfillment !== 'DELIVERED') {
    throw new Error('Order cannot be marked received until it is out for delivery');
  }

  const orderId = String(row.id);
  const nowUtc = new Date().toISOString();

  await withDbRetry(async () =>
    db.batch([
      {
        sql: `UPDATE orders SET
          fulfillment_status = 'DELIVERED',
          received_at = ?,
          received_by = 'CUSTOMER',
          updated_at = ?,
          updated_by = 'CUSTOMER'
        WHERE id = ?`,
        args: [nowUtc, nowUtc, orderId],
      },
      {
        sql: `INSERT INTO audit_logs (id, actor_type, actor_id, action, target_type, target_id, details, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          `AUD-${crypto.randomBytes(8).toString('hex')}`,
          'CUSTOMER',
          String(row.customer_name),
          'CONFIRMED_DELIVERY_RECEIPT',
          'ORDER',
          orderId,
          JSON.stringify({ markedReceivedAt: nowUtc }),
          nowUtc,
        ],
      },
    ])
  );

  return { success: true, orderId, markedReceivedAt: nowUtc };
}

/**
 * 7. Customer Feedback Submission
 * MUST use customerAccessToken only.
 * Only permitted for completed orders (order_status === 'TICKET_GENERATED').
 */
export async function submitOrderFeedback(
  token: string,
  rating: number,
  comment?: string
) {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    throw new Error('Invalid or missing customer access token');
  }
  const clean = token.trim();
  const tokenHash = crypto.createHash('sha256').update(clean).digest('hex');
  const db = getDb();
  const res = await withDbRetry(async () =>
    db.execute({
      sql: 'SELECT id, customer_name, order_status FROM orders WHERE public_token_hash = ? LIMIT 1',
      args: [tokenHash],
    })
  );

  if (res.rows.length === 0) {
    throw new Error('Order not found or unauthorized customer access token');
  }

  const row = res.rows[0]!;
  if (row.order_status !== 'TICKET_GENERATED') {
    throw new Error('Feedback can only be submitted for completed orders');
  }

  const orderId = String(row.id);
  const customerName = String(row.customer_name);
  const nowUtc = new Date().toISOString();

  const existing = await withDbRetry(async () =>
    db.execute({
      sql: 'SELECT id FROM feedback WHERE order_id = ? LIMIT 1',
      args: [orderId],
    })
  );

  if (existing.rows.length > 0) {
    const feedbackId = String(existing.rows[0]?.id);
    await withDbRetry(async () =>
      db.execute({
        sql: 'UPDATE feedback SET rating = ?, comment = ?, created_at = ? WHERE id = ?',
        args: [rating, comment || null, nowUtc, feedbackId],
      })
    );
    return { success: true, feedbackId, updated: true };
  }

  const feedbackId = `FDB-${crypto.randomBytes(8).toString('hex')}`;
  await withDbRetry(async () =>
    db.batch([
      {
        sql: `INSERT INTO feedback (id, order_id, customer_name, rating, comment, is_public, created_at)
              VALUES (?, ?, ?, ?, ?, 1, ?)`,
        args: [feedbackId, orderId, customerName, rating, comment || null, nowUtc],
      },
      {
        sql: `INSERT INTO audit_logs (id, actor_type, actor_id, action, target_type, target_id, details, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          `AUD-${crypto.randomBytes(8).toString('hex')}`,
          'CUSTOMER',
          customerName,
          'SUBMITTED_FEEDBACK',
          'FEEDBACK',
          feedbackId,
          JSON.stringify({ orderId, rating }),
          nowUtc,
        ],
      },
    ])
  );

  return { success: true, feedbackId, updated: false };
}
