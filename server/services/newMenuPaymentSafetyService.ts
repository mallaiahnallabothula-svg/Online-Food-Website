/**
 * INACTIVE new-menu Razorpay reconciliation foundation.
 *
 * No API route, existing checkout, or owner dashboard imports this module.
 * Do not expose these internal functions to untrusted requests until the
 * gateway-order creation, webhook authentication, retries, and refund/manual
 * review workflow have been separately approved and end-to-end tested.
 */
import crypto from 'node:crypto';
import type { Client, Transaction } from '@libsql/client';
import { findMenuItem, NEW_MENU_ORDER_POLICY } from '../../shared/menuCatalog.ts';
import { buildOwnerOrderCompatibility } from './ownerMenuCompatibilityService.ts';
import { withDbRetry } from '../db/index.ts';

type GatewayFetch = typeof fetch;
const HOLD_MS = 30 * 60_000;
const ORDER_ID = /^MENU-[0-9a-f-]{36}$/;
const RAZORPAY_ORDER_ID = /^order_[A-Za-z0-9]{5,64}$/;
const RAZORPAY_PAYMENT_ID = /^pay_[A-Za-z0-9]{5,64}$/;

export type MenuReconciliationStatus = 'CONFIRMED' | 'REVIEW_REQUIRED';
export interface MenuCaptureResult {
  readonly status: MenuReconciliationStatus;
  readonly idempotent: boolean;
  readonly orderId: string;
  readonly ticketText?: string;
  readonly reason?: string;
}
interface GatewayReceipt {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  captured: boolean;
}

function isSafeTime(ms: number): boolean {
  return Number.isSafeInteger(ms) && ms > 0;
}
function ensureMenuId(orderId: string): void {
  if (typeof orderId !== 'string' || !ORDER_ID.test(orderId)) {
    throw new Error('A valid new-menu order ID is required');
  }
}
function newAuditId(): string {
  return 'AUD-' + crypto.randomBytes(8).toString('hex');
}
function newPaymentId(): string {
  return 'PAY-' + crypto.randomBytes(8).toString('hex');
}
async function writeTx<T>(db: Client, work: (tx: Transaction) => Promise<T>): Promise<T> {
  return withDbRetry(async () => {
    const tx = await db.transaction('write');
    try {
      const result = await work(tx);
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback().catch(() => {});
      throw error;
    } finally {
      tx.close();
    }
  });
}

/**
 * Bind the actual gateway-created order ID to an unpaid new-menu order.
 * This NEVER calls Razorpay, creates a gateway order, or permits a customer-
 * supplied gateway ID on a live route. The future trusted integration must
 * verify gateway creation amount/receipt before calling.
 */
export async function bindNewMenuRazorpayOrder(
  db: Client, orderId: string, providerOrderId: string, nowMs = Date.now(),
): Promise<{ idempotent: boolean; expiresAtMs: number }> {
  ensureMenuId(orderId);
  if (!RAZORPAY_ORDER_ID.test(providerOrderId) || !isSafeTime(nowMs)) {
    throw new Error('Invalid gateway binding');
  }
  return writeTx(db, async tx => {
    const res = await tx.execute({
      sql: 'SELECT * FROM orders WHERE id = ? LIMIT 1', args: [orderId],
    });
    const o = res.rows[0];
    if (!o || o.payment_status !== 'PENDING' || o.order_status !== 'PENDING' ||
        o.payment_provider !== 'razorpay' || o.currency !== 'INR') {
      throw new Error('Unpaid new-menu order required');
    }
    const expiresAtMs = Date.parse(String(o.created_at_utc)) + HOLD_MS;
    if (!isSafeTime(expiresAtMs) || nowMs >= expiresAtMs) {
      throw new Error('Order reservation expired before gateway binding');
    }
    const existingOrderId = o.provider_order_id ? String(o.provider_order_id) : '';
    if (existingOrderId && existingOrderId !== providerOrderId) {
      throw new Error('This order is already bound to another gateway order');
    }
    const duplicate = await tx.execute({
      sql: 'SELECT 1 FROM orders WHERE provider_order_id = ? AND id != ? LIMIT 1',
      args: [providerOrderId, orderId],
    });
    if (duplicate.rows.length) throw new Error('Gateway order belongs to another order');

    const lines = await tx.execute({sql:'SELECT item_id FROM order_items WHERE order_id = ? LIMIT 1',args:[orderId]});
    if (!lines.rows.length) throw new Error('New-menu item snapshots required');
    const holds = await tx.execute({sql:[
      'SELECT status, held_until_ms FROM menu_stock_reservations WHERE order_id = ?',
    ].join(' '),args:[orderId]});
    if (holds.rows.some(row => row.status !== 'HELD' || Number(row.held_until_ms) <= nowMs)) {
      throw new Error('Order stock hold has expired or is no longer active');
    }
    const old = await tx.execute({
      sql: 'SELECT id, provider_order_id, expires_at, amount_paisa, currency, provider FROM payment_intents WHERE order_id = ?',
      args: [orderId],
    });
    if (old.rows.length) {
      if (old.rows.length !== 1 || old.rows[0]?.provider !== 'razorpay' ||
          old.rows[0]?.provider_order_id !== providerOrderId ||
          Number(old.rows[0]?.amount_paisa) !== Number(o.total_amount_paisa) ||
          old.rows[0]?.currency !== 'INR' || Number(old.rows[0]?.expires_at) !== expiresAtMs) {
        throw new Error('Conflicting or invalid existing gateway intent');
      }
      return { idempotent: true, expiresAtMs };
    }
    if (existingOrderId) throw new Error('Gateway order bound without matching saved intent');
    await tx.execute({sql:'UPDATE orders SET provider_order_id = ? WHERE id = ?',
      args:[providerOrderId,orderId]});
    await tx.execute({sql:[
      'INSERT INTO payment_intents (id,order_id,provider,provider_order_id,',
      'amount_paisa,currency,created_at,expires_at,is_verified)',
      "VALUES (?,?,'razorpay',?,?,'INR',?,?,0)",
    ].join(' '),args:[
      'mi-' + crypto.randomUUID(),orderId,providerOrderId,Number(o.total_amount_paisa),
      Date.parse(String(o.created_at_utc)),expiresAtMs,
    ]});
    return { idempotent: false, expiresAtMs };
  });
}

/**
 * Server-only recovery if Razorpay Order API failed BEFORE any payment order
 * was bound. A failed frontend callback is NOT sufficient to call this.
 * Once a gateway order exists, use captured-payment reconciliation instead.
 */
export async function abandonUnboundNewMenuCheckout(
  db: Client, orderId: string, nowMs = Date.now(),
): Promise<{ idempotent: boolean }> {
  ensureMenuId(orderId);
  if (!isSafeTime(nowMs)) throw new Error('Invalid failure timestamp');
  return writeTx(db, async tx => {
    const res = await tx.execute({
      sql:'SELECT payment_status,order_status,provider_order_id FROM orders WHERE id = ?',
      args:[orderId],
    });
    const o = res.rows[0];
    if (!o) throw new Error('Order not found');
    if (o.provider_order_id) throw new Error('Bound gateway order cannot be abandoned');
    const intents = await tx.execute({sql:'SELECT 1 FROM payment_intents WHERE order_id=? LIMIT 1',args:[orderId]});
    const payments = await tx.execute({sql:'SELECT 1 FROM payments WHERE order_id=? LIMIT 1',args:[orderId]});
    if (intents.rows.length || payments.rows.length) {
      throw new Error('Payment evidence exists; cannot abandon this order');
    }
    if (o.payment_status === 'FAILED') return { idempotent:true };
    if (o.payment_status !== 'PENDING' || o.order_status !== 'PENDING') {
      throw new Error('Only unpaid pending orders can be abandoned');
    }
    const now = new Date(nowMs).toISOString();
    await tx.execute({sql:"UPDATE orders SET payment_status = 'FAILED', updated_at = ?, updated_by = 'SYSTEM' WHERE id = ?",
      args:[now,orderId]});
    await tx.execute({sql:"UPDATE menu_stock_reservations SET status='RELEASED',updated_at_utc=? WHERE order_id=? AND status='HELD'",
      args:[now,orderId]});
    await tx.execute({sql:[
      'INSERT INTO audit_logs (id,actor_type,actor_id,action,target_type,target_id,details,created_at)',
      "VALUES (?,'SYSTEM','MENU_GATEWAY','NEW_MENU_GATEWAY_INIT_FAILED','ORDER',?,?,?)",
    ].join(' '),args:[newAuditId(),orderId,'Gateway order creation failed before binding',now]});
    return {idempotent:false};
  });
}

function timingSafeSignature(expectedOrderId: string, paymentId: string, signature: string, secret: string): boolean {
  if (!/^[a-fA-F0-9]{64}$/.test(signature)) return false;
  const expected = crypto.createHmac('sha256', secret)
    .update(expectedOrderId+'|'+paymentId).digest();
  const given = Buffer.from(signature,'hex');
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

async function fetchCapturedPayment(
  paymentId: string, orderId: string, signature: string,
  credentials: { keyId: string; keySecret: string },
  transport: GatewayFetch,
): Promise<GatewayReceipt> {
  if (!credentials.keyId || !credentials.keySecret ||
      !RAZORPAY_ORDER_ID.test(orderId) || !RAZORPAY_PAYMENT_ID.test(paymentId) ||
      !timingSafeSignature(orderId,paymentId,signature,credentials.keySecret)) {
    throw new Error('Razorpay payment signature or credentials invalid');
  }
  const response = await transport('https://api.razorpay.com/v1/payments/'+encodeURIComponent(paymentId), {
    headers:{ Authorization:'Basic '+Buffer.from(credentials.keyId+':'+credentials.keySecret).toString('base64') },
    signal:AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Unable to verify gateway payment; retry without marking order paid');
  const payment: unknown = await response.json();
  if (!payment || typeof payment !== 'object') throw new Error('Invalid gateway response');
  const p = payment as Partial<GatewayReceipt>;
  if (p.id !== paymentId || p.order_id !== orderId || p.currency !== 'INR' ||
      !Number.isSafeInteger(p.amount) || p.amount! <= 0 ||
      p.status !== 'captured' || p.captured !== true) {
    throw new Error('Gateway receipt is not a matching captured INR payment');
  }
  return p as GatewayReceipt;
}

/**
 * Verify Razorpay signature AND server-side captured status before opening
 * one write transaction for payment, stock and itemized ticket.
 *
 * If payment was captured AFTER hold expiry / stock loss, persist an auditable
 * REVIEW_REQUIRED payment row and leave order PENDING with NO confirmation
 * or ticket. No automatic refund, promise of delivery or silent deletion.
 */
export async function verifyAndSettleNewMenuPayment(
  db: Client,
  input: { readonly orderId: string; readonly providerPaymentId: string; readonly providerSignature: string },
  nowMs = Date.now(),
  credentials: { keyId: string; keySecret: string } = {
    keyId: process.env.RAZORPAY_KEY_ID ?? '',
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
  },
  transport: GatewayFetch = fetch,
): Promise<MenuCaptureResult> {
  ensureMenuId(input.orderId);
  if (!isSafeTime(nowMs)) throw new Error('Invalid verification timestamp');
  const initial = await db.execute({
    sql:'SELECT provider_order_id,total_amount_paisa,currency FROM orders WHERE id=? LIMIT 1',
    args:[input.orderId],
  });
  const initialOrder = initial.rows[0];
  if (!initialOrder || !initialOrder.provider_order_id) throw new Error('Bound new-menu order required');
  const gatewayOrderId = String(initialOrder.provider_order_id);
  const captured = await fetchCapturedPayment(
    input.providerPaymentId,gatewayOrderId,input.providerSignature,credentials,transport,
  );
  if (captured.amount !== Number(initialOrder.total_amount_paisa) || initialOrder.currency !== 'INR') {
    throw new Error('Gateway captured amount does not match saved order');
  }

  return writeTx(db, async tx => {
    const orderRes = await tx.execute({sql:'SELECT * FROM orders WHERE id=? LIMIT 1',args:[input.orderId]});
    const o = orderRes.rows[0];
    if (!o || o.provider_order_id !== gatewayOrderId || o.payment_provider !== 'razorpay' ||
        o.currency !== 'INR' || Number(o.total_amount_paisa) !== captured.amount) {
      throw new Error('Order binding, provider or amount changed during verification');
    }
    const intents = await tx.execute({sql:[
      'SELECT provider_order_id, amount_paisa, currency, expires_at',
      "FROM payment_intents WHERE order_id=? AND provider='razorpay'",
    ].join(' '),args:[input.orderId]});
    if (intents.rows.length !== 1 || intents.rows[0]?.provider_order_id !== gatewayOrderId ||
        Number(intents.rows[0]?.amount_paisa) !== captured.amount || intents.rows[0]?.currency !== 'INR') {
      throw new Error('Matching saved gateway intent required');
    }
    const paymentCheck = await tx.execute({
      sql:'SELECT order_id,status FROM payments WHERE provider_payment_id=? LIMIT 1',
      args:[captured.id],
    });
    if (paymentCheck.rows.length) {
      const recorded = paymentCheck.rows[0]!;
      if (recorded.order_id !== input.orderId) throw new Error('Gateway payment ID already belongs to another order');
      if (recorded.status === 'SUCCESS' && o.payment_status === 'PAID' &&
          o.provider_payment_id === captured.id && o.order_status === 'TICKET_GENERATED') {
        return {orderId:input.orderId,status:'CONFIRMED',idempotent:true,ticketText:String(o.ticket_text || '')};
      }
      if (recorded.status === 'REVIEW_REQUIRED' && o.payment_status === 'PENDING') {
        return {orderId:input.orderId,status:'REVIEW_REQUIRED',idempotent:true,
          reason:'Payment captured but requires manual review'};
      }
      throw new Error('Payment is in a conflicting state');
    }
    const anyOther = await tx.execute({sql:'SELECT 1 FROM payments WHERE order_id=? LIMIT 1',args:[input.orderId]});
    if (anyOther.rows.length || o.payment_status !== 'PENDING' || o.order_status !== 'PENDING') {
      throw new Error('Order is not an unpaid, unsettled new-menu order');
    }

    const snapshots = await tx.execute({sql:'SELECT * FROM order_items WHERE order_id=? ORDER BY rowid ASC',args:[input.orderId]});
    if (!snapshots.rows.length) throw new Error('Missing authoritative item snapshots');
    const reservations = await tx.execute({sql:[
      'SELECT item_id,delivery_date,quantity_plates,status,held_until_ms',
      'FROM menu_stock_reservations WHERE order_id=?',
    ].join(' '),args:[input.orderId]});
    const capped = new Map<string,number>();
    let subtotal = 0;
    let period: string | null = null;
    let valid = true;
    for (const line of snapshots.rows) {
      const item = findMenuItem(String(line.item_id));
      const qty = Number(line.quantity), price = Number(line.unit_price_paisa);
      const lineAmount = Number(line.line_total_paisa);
      if (!item || !Number.isSafeInteger(qty) || qty < item.minimumQuantity ||
          (item.dailyPlateLimit !== null && qty > item.dailyPlateLimit) ||
          price !== item.pricePaisa || lineAmount !== qty * price ||
          line.meal_period !== item.mealPeriod || line.sale_unit !== item.saleUnit ||
          (period !== null && period !== item.mealPeriod)) {
        valid=false;break;
      }
      period=item.mealPeriod;subtotal += lineAmount;
      if(item.dailyPlateLimit !== null)capped.set(item.id,qty);
    }
    if (subtotal < NEW_MENU_ORDER_POLICY.minimumCartPaisa ||
        subtotal !== Number(o.subtotal_paisa) ||
        subtotal + Number(o.delivery_charge_paisa) !== captured.amount) valid=false;
    if (capped.size !== reservations.rows.length) valid=false;
    for(const [id,qty] of capped){
      const hold=reservations.rows.find(x=>x.item_id===id);
      if (!hold || hold.status!=='HELD' || hold.delivery_date!==o.delivery_date ||
          Number(hold.quantity_plates)!==qty || Number(hold.held_until_ms)<=nowMs) valid=false;
      // Serialize same-date stock checks with competing checkout write transactions.
      const stock = await tx.execute({sql:[
        'SELECT COALESCE(SUM(r.quantity_plates),0) AS used FROM menu_stock_reservations r',
        "WHERE r.item_id=? AND r.delivery_date=? AND (r.status='CONFIRMED' OR",
        "(r.status='HELD' AND (r.held_until_ms>?",
        "OR EXISTS(SELECT 1 FROM orders z WHERE z.id=r.order_id AND z.payment_status='PAID')",
        "OR EXISTS(SELECT 1 FROM payments p WHERE p.order_id=r.order_id AND p.status='SUCCESS' AND p.verified_at IS NOT NULL))))",
      ].join(' '),args:[id,String(o.delivery_date),nowMs]});
      const item=findMenuItem(id)!;
      if(Number(stock.rows[0]?.used??0)>item.dailyPlateLimit!)valid=false;
    }
    if(Number(intents.rows[0]?.expires_at)<=nowMs)valid=false;

    const now=new Date(nowMs).toISOString();
    if (!valid) {
      await tx.execute({sql:[
        'INSERT INTO payments (id,order_id,provider,provider_order_id,provider_payment_id,',
        'amount_paisa,currency,status,signature,verified_at,created_at,updated_at)',
        "VALUES (?,?,'razorpay',?,? ,?,'INR','REVIEW_REQUIRED',?,?,?,?)",
      ].join(' '),args:[
        newPaymentId(),input.orderId,gatewayOrderId,captured.id,captured.amount,
        input.providerSignature,now,now,now,
      ]});
      await tx.execute({sql:[
        'INSERT INTO audit_logs (id,actor_type,actor_id,action,target_type,target_id,details,created_at)',
        "VALUES (?,'SYSTEM','MENU_GATEWAY','NEW_MENU_PAYMENT_REVIEW_REQUIRED','ORDER',?,?,?)",
      ].join(' '),args:[newAuditId(),input.orderId,
        JSON.stringify({reason:'Expired or invalid stock hold/price snapshot; captured payment requires manual resolution',
          providerPaymentId:captured.id}),now]});
      return {orderId:input.orderId,status:'REVIEW_REQUIRED',idempotent:false,
        reason:'Captured payment requires manual review/refund; order not confirmed'};
    }

    await tx.execute({sql:[
      "UPDATE menu_stock_reservations SET status='CONFIRMED',updated_at_utc=?",
      "WHERE order_id=? AND status='HELD'",
    ].join(' '),args:[now,input.orderId]});
    await tx.execute({sql:[
      "UPDATE orders SET payment_status='PAID',order_status='TICKET_GENERATED',provider_payment_id=?,",
      "updated_at=?,updated_by='SYSTEM' WHERE id=? AND payment_status='PENDING'",
    ].join(' '),args:[captured.id,now,input.orderId]});
    await tx.execute({sql:[
      'INSERT INTO payments (id,order_id,provider,provider_order_id,provider_payment_id,',
      'amount_paisa,currency,status,signature,verified_at,created_at,updated_at)',
      "VALUES (?,?,'razorpay',?,? ,?,'INR','SUCCESS',?,?,?,?)",
    ].join(' '),args:[
      newPaymentId(),input.orderId,gatewayOrderId,captured.id,captured.amount,
      input.providerSignature,now,now,now,
    ]});
    await tx.execute({sql:'UPDATE payment_intents SET is_verified=1 WHERE order_id=?',args:[input.orderId]});
    const ready = buildOwnerOrderCompatibility(
      {...o,payment_status:'PAID',provider_payment_id:captured.id},
      snapshots.rows,true,
      reservations.rows.map(row=>({...row,status:'CONFIRMED'})),
    );
    if (ready.ticketStatus !== 'READY' || !ready.ticketText) throw new Error('Verified ticket generation failed');
    await tx.execute({sql:[
      'UPDATE orders SET ticket_text=?,ticket_generated_at=? WHERE id=?',
    ].join(' '),args:[ready.ticketText,now,input.orderId]});
    await tx.execute({sql:[
      'INSERT INTO audit_logs (id,actor_type,actor_id,action,target_type,target_id,details,created_at)',
      "VALUES (?,'SYSTEM','MENU_GATEWAY','NEW_MENU_PAYMENT_CONFIRMED','ORDER',?,?,?)",
    ].join(' '),args:[newAuditId(),input.orderId,JSON.stringify({providerPaymentId:captured.id}),now]});
    return {orderId:input.orderId,status:'CONFIRMED',idempotent:false,ticketText:ready.ticketText};
  });
}
