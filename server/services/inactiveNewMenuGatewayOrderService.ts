/**
 * INACTIVE server-only Razorpay Orders API adapter for an ALREADY created
 * pending itemized order. No route, checkout UI or scheduler imports this.
 *
 * This deliberately accepts only Razorpay TEST credentials. Real-money
 * payment creation requires a separate approved integration and launch.
 */
import crypto from 'node:crypto';
import type { Client } from '@libsql/client';
import { NEW_MENU_LAUNCH_ENABLED, findMenuItem } from '../../shared/menuCatalog.ts';
import {
  abandonUnboundNewMenuCheckout,
  bindNewMenuRazorpayOrder,
} from './newMenuPaymentSafetyService.ts';

type GatewayTransport = typeof fetch;
const HOLD_MS = 30 * 60_000;
const ORDER_ID = /^MENU-[0-9a-f-]{36}$/;
const PROVIDER_ORDER = /^order_[A-Za-z0-9]{5,64}$/;
const STARTING = 'MENU_GATEWAY_STARTING';
const UNBOUND = 'AWAITING_PAYMENT';

export interface InactiveGatewayOrderResult {
  readonly orderId: string;
  readonly providerOrderId: string;
  readonly publicKeyId: string;
  readonly amountPaisa: number;
  readonly currency: 'INR';
  readonly expiresAtMs: number;
  readonly idempotent: boolean;
}

export interface InactiveGatewayCredentials {
  readonly keyId: string;
  readonly keySecret: string;
}

function reviewRequired(): Error {
  return new Error('Gateway outcome unverified; manual reconciliation required before retry');
}

function receiptForOrder(orderId: string): string {
  // Razorpay receipt maximum length is 40; MENU-UUID would be 41.
  return 'mn_' + crypto.createHash('sha256').update(orderId).digest('hex').slice(0, 32);
}

export async function createInactiveNewMenuGatewayOrder(
  db: Client,
  orderId: string,
  credentials: InactiveGatewayCredentials,
  transport: GatewayTransport,
  nowMs = Date.now(),
): Promise<InactiveGatewayOrderResult> {
  if (NEW_MENU_LAUNCH_ENABLED) {
    throw new Error('This inactive test-only adapter must not run after launch');
  }
  if (!ORDER_ID.test(orderId) ||
      !Number.isSafeInteger(nowMs) || nowMs <= 0 ||
      !credentials || !/^rzp_test_[A-Za-z0-9]+$/.test(credentials.keyId) ||
      !credentials.keySecret || typeof transport !== 'function') {
    throw new Error('Invalid inactive gateway request or test credentials');
  }

  const result = await db.execute({
    sql: [
      'SELECT id,created_at_utc,payment_status,order_status,currency,payment_provider,',
      'provider_order_id,provider_payment_id,subtotal_paisa,delivery_charge_paisa,total_amount_paisa',
      'FROM orders WHERE id = ? LIMIT 1',
    ].join(' '),
    args: [orderId],
  });
  const order = result.rows[0];
  if (!order || order.payment_status !== 'PENDING' || order.order_status !== 'PENDING' ||
      order.payment_provider !== 'razorpay' || order.currency !== 'INR') {
    throw new Error('Unpaid pending itemized order required');
  }

  const createdAtMs = Date.parse(String(order.created_at_utc));
  const expiresAtMs = createdAtMs + HOLD_MS;
  if (!Number.isSafeInteger(expiresAtMs) || nowMs < createdAtMs || nowMs >= expiresAtMs) {
    throw new Error('Pending order checkout has expired or is invalid');
  }

  const subtotal = Number(order.subtotal_paisa);
  const delivery = Number(order.delivery_charge_paisa);
  const amountPaisa = Number(order.total_amount_paisa);
  if (![subtotal, delivery, amountPaisa].every(Number.isSafeInteger) ||
      subtotal <= 0 || delivery < 0 || subtotal + delivery !== amountPaisa ||
      amountPaisa <= 0 || amountPaisa > 100_000_000) {
    throw new Error('Invalid authoritative saved order amount');
  }

  const snapshots = await db.execute({
    sql: 'SELECT item_id,quantity,unit_price_paisa,line_total_paisa FROM order_items WHERE order_id = ?',
    args: [orderId],
  });
  if (!snapshots.rows.length) throw new Error('Saved itemized cart required');
  let savedSubtotal = 0;
  const capped = new Map<string, number>();
  for (const item of snapshots.rows) {
    const catalog = findMenuItem(String(item.item_id));
    const qty = Number(item.quantity);
    const unitPrice = Number(item.unit_price_paisa);
    const line = Number(item.line_total_paisa);
    if (!catalog || !Number.isSafeInteger(qty) || qty <= 0 ||
        !Number.isSafeInteger(unitPrice) || unitPrice < 0 ||
        !Number.isSafeInteger(line) || line !== unitPrice * qty) {
      throw new Error('Invalid saved itemized cart snapshot');
    }
    savedSubtotal += line;
    if (catalog.dailyPlateLimit !== null) capped.set(catalog.id, qty);
  }
  if (savedSubtotal !== subtotal) throw new Error('Saved item total does not match pending order');

  const reservations = await db.execute({
    sql: 'SELECT item_id,quantity_plates,status,held_until_ms FROM menu_stock_reservations WHERE order_id = ?',
    args: [orderId],
  });
  if (reservations.rows.length !== capped.size) throw new Error('Required stock holds missing');
  for (const hold of reservations.rows) {
    if (capped.get(String(hold.item_id)) !== Number(hold.quantity_plates) ||
        hold.status !== 'HELD' || Number(hold.held_until_ms) <= nowMs) {
      throw new Error('Pending inventory reservation invalid or expired');
    }
  }

  const providerOrderId = order.provider_order_id ? String(order.provider_order_id) : '';
  if (providerOrderId) {
    if (!PROVIDER_ORDER.test(providerOrderId)) throw reviewRequired();
    // Binding validates the existing saved payment intent, not merely the ID.
    await bindNewMenuRazorpayOrder(db, orderId, providerOrderId, nowMs);
    return {
      orderId, providerOrderId, publicKeyId: credentials.keyId,
      amountPaisa, currency: 'INR', expiresAtMs, idempotent: true,
    };
  }
  if (order.provider_payment_id !== UNBOUND) throw reviewRequired();

  // Cross-instance compare-and-set: only one invocation may contact gateway.
  // Keep ambiguous requests marked STARTING to forbid unsafe automatic retries.
  const claim = await db.execute({
    sql: [
      'UPDATE orders SET provider_payment_id = ?, updated_at = ?, updated_by = ?',
      'WHERE id = ? AND provider_payment_id = ? AND provider_order_id IS NULL',
      "AND payment_status = 'PENDING' AND order_status = 'PENDING'",
    ].join(' '),
    args: [STARTING, new Date(nowMs).toISOString(), 'SYSTEM', orderId, UNBOUND],
  });
  if (claim.rowsAffected !== 1) {
    // Another instance claimed the gateway attempt. Never issue a second POST.
    throw reviewRequired();
  }

  const receipt = receiptForOrder(orderId);
  let response: Response;
  try {
    response = await transport('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(credentials.keyId + ':' + credentials.keySecret).toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountPaisa,
        currency: 'INR',
        receipt,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // A timeout/network error can happen AFTER gateway accepted the order.
    // Never create another order automatically or release its stock prematurely.
    throw reviewRequired();
  }

  if (!response.ok) {
    // A definitive non-transient client-side rejection means no order created.
    // Timeouts, conflicts, throttling, and server failures remain ambiguous.
    if ([400, 401, 403, 404, 422].includes(response.status)) {
      try {
        await abandonUnboundNewMenuCheckout(db, orderId, nowMs);
      } catch {
        throw reviewRequired();
      }
      throw new Error('Gateway rejected checkout; unpaid inventory holds released');
    }
    throw reviewRequired();
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw reviewRequired();
  }
  if (!body || typeof body !== 'object') throw reviewRequired();
  const gateway = body as Record<string, unknown>;
  if (typeof gateway.id !== 'string' || !PROVIDER_ORDER.test(gateway.id) ||
      gateway.receipt !== receipt || gateway.amount !== amountPaisa ||
      gateway.currency !== 'INR' || gateway.status !== 'created' ||
      gateway.amount_paid !== 0 || gateway.amount_due !== amountPaisa) {
    // A successful HTTP response with inconsistent details still may have
    // created an order. Require manual reconciliation; never retry blindly.
    throw reviewRequired();
  }

  try {
    await bindNewMenuRazorpayOrder(db, orderId, gateway.id, nowMs);
  } catch {
    // Gateway order exists. Do not release holds or issue a second gateway POST.
    throw reviewRequired();
  }
  return {
    orderId, providerOrderId: gateway.id, publicKeyId: credentials.keyId,
    amountPaisa, currency: 'INR', expiresAtMs, idempotent: false,
  };
}
