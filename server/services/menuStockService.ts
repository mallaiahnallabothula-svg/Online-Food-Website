/**
 * INACTIVE foundation for future itemized checkout; no live route imports it.
 *
 * All availability decisions and state changes use one database write
 * transaction, not in-memory counters (Vercel functions are stateless).
 * This module does NOT authorize/capture Razorpay payments. The future payment
 * integration must reserve stock before offering checkout and handle late
 * payment after a released/expired hold via a safe refund/manual-review path.
 */
import type { Client, Transaction } from '@libsql/client';
import { MENU_CATALOG, NEW_MENU_ORDER_POLICY } from '../../shared/menuCatalog.ts';
import { withDbRetry } from '../db/index.ts';

export interface StockLine {
  readonly itemId: string;
  readonly plates: number;
}

export interface HoldRequest {
  readonly orderId: string;
  readonly deliveryDateIst: string;
  readonly lines: readonly StockLine[];
  readonly expiresAtMs: number;
}

const MAX_HOLD_MS = 30 * 60_000;
const byId = new Map(MENU_CATALOG.map(item => [item.id, item]));

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function positiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

async function writeTx<T>(db: Client, run: (tx: Transaction) => Promise<T>): Promise<T> {
  return withDbRetry(async () => {
    const tx = await db.transaction('write');
    try {
      const value = await run(tx);
      await tx.commit();
      return value;
    } catch (error) {
      await tx.rollback().catch(() => {});
      throw error;
    } finally {
      tx.close();
    }
  });
}

async function occupiedPlates(tx: Transaction | Client, itemId: string, date: string, nowMs: number): Promise<number> {
  const res = await tx.execute({
    sql: [
      'SELECT COALESCE(SUM(r.quantity_plates), 0) AS used FROM menu_stock_reservations r',
      'WHERE r.item_id = ? AND r.delivery_date = ? AND (',
      "r.status = 'CONFIRMED' OR (r.status = 'HELD' AND (r.held_until_ms > ?",
      "OR EXISTS (SELECT 1 FROM orders o WHERE o.id = r.order_id AND o.payment_status = 'PAID')",
      "OR EXISTS (SELECT 1 FROM payments p WHERE p.order_id = r.order_id AND p.status = 'SUCCESS' AND p.verified_at IS NOT NULL)",
      ')))',
    ].join(' '),
    args: [itemId, date, nowMs],
  });
  return Number(res.rows[0]?.used ?? 0);
}

/** A read-only estimate; only reserveStockForPendingOrder guarantees capacity. */
export async function getMenuStockRemaining(db: Client, itemId: string, deliveryDateIst: string, nowMs = Date.now()): Promise<number> {
  const item = byId.get(itemId);
  if (!item || item.dailyPlateLimit === null || !validDate(deliveryDateIst) || !Number.isFinite(nowMs)) {
    throw new Error('Invalid inventory item or date');
  }
  return Math.max(0, item.dailyPlateLimit - await occupiedPlates(db, itemId, deliveryDateIst, nowMs));
}

/**
 * Atomic all-or-nothing hold. A pending order and authoritative order_items
 * rows must already exist. The future checkout adapter is responsible for
 * keeping payment-intent expiration aligned with expiresAtMs.
 */
export async function reserveStockForPendingOrder(
  db: Client, request: HoldRequest, nowMs = Date.now(),
): Promise<{ idempotent: boolean }> {
  const { orderId, deliveryDateIst, lines, expiresAtMs } = request;
  if (!orderId || !validDate(deliveryDateIst) || !Number.isFinite(nowMs) ||
      !Number.isSafeInteger(expiresAtMs) || expiresAtMs <= nowMs ||
      expiresAtMs > nowMs + MAX_HOLD_MS || !Array.isArray(lines) || lines.length === 0) {
    throw new Error('Invalid stock hold request');
  }
  const requested = new Map<string, number>();
  for (const line of lines) {
    const item = byId.get(line.itemId);
    if (!item || item.dailyPlateLimit === null || item.saleUnit !== 'PLATE' ||
        !positiveSafeInteger(line.plates) || line.plates > item.dailyPlateLimit ||
        requested.has(line.itemId)) {
      throw new Error('Invalid or duplicate capped menu item');
    }
    requested.set(line.itemId, line.plates);
  }

  return writeTx(db, async tx => {
    const o = await tx.execute({
      sql: 'SELECT delivery_date, payment_status, order_status, subtotal_paisa, total_amount_paisa, delivery_charge_paisa, currency FROM orders WHERE id = ?',
      args: [orderId],
    });
    const order = o.rows[0];
    if (!order || order.delivery_date !== deliveryDateIst ||
        order.payment_status !== 'PENDING' || order.order_status !== 'PENDING' || order.currency !== 'INR') {
      throw new Error('A matching unpaid pending order is required');
    }

    const saved = await tx.execute({
      sql: 'SELECT item_id, meal_period, sale_unit, quantity, unit_price_paisa, line_total_paisa FROM order_items WHERE order_id = ?',
      args: [orderId],
    });
    if (!saved.rows.length) throw new Error('Itemized order details are required');
    let subtotal = 0;
    let period: string | undefined;
    const capped = new Map<string, number>();
    for (const row of saved.rows) {
      const item = byId.get(String(row.item_id));
      if (!item || item.mealPeriod !== row.meal_period || item.saleUnit !== row.sale_unit ||
          !positiveSafeInteger(Number(row.quantity)) ||
          Number(row.quantity) < item.minimumQuantity ||
          Number(row.unit_price_paisa) !== item.pricePaisa ||
          Number(row.line_total_paisa) !== item.pricePaisa * Number(row.quantity) ||
          (period && period !== item.mealPeriod)) {
        throw new Error('Invalid authoritative order item or mixed meal periods');
      }
      period = item.mealPeriod;
      subtotal += Number(row.line_total_paisa);
      if (item.dailyPlateLimit !== null) capped.set(item.id, Number(row.quantity));
    }
    if (subtotal !== Number(order.subtotal_paisa) ||
        subtotal < NEW_MENU_ORDER_POLICY.minimumCartPaisa ||
        subtotal + Number(order.delivery_charge_paisa) !== Number(order.total_amount_paisa) ||
        capped.size !== requested.size ||
        [...capped].some(([id, qty]) => requested.get(id) !== qty)) {
      throw new Error('Stock lines do not match server-priced order or minimum cart');
    }

    const existing = await tx.execute({
      sql: 'SELECT item_id, quantity_plates, status, held_until_ms FROM menu_stock_reservations WHERE order_id = ?',
      args: [orderId],
    });
    if (existing.rows.length) {
      if (existing.rows.length !== requested.size ||
          existing.rows.some(row => row.status !== 'HELD' ||
            Number(row.held_until_ms) <= nowMs ||
            requested.get(String(row.item_id)) !== Number(row.quantity_plates))) {
        throw new Error('Existing hold cannot be changed, revived or partially reserved');
      }
      return { idempotent: true };
    }

    // A write transaction serializes capacity decisions across concurrent
    // checkouts, including separate Vercel instances sharing one Turso DB.
    const nowUtc = new Date(nowMs).toISOString();
    for (const [id, qty] of requested) {
      const item = byId.get(id)!;
      const used = await occupiedPlates(tx, id, deliveryDateIst, nowMs);
      if (used + qty > item.dailyPlateLimit!) {
        throw new Error('OUT_OF_STOCK: insufficient plates for ' + id);
      }
      await tx.execute({
        sql: [
          'INSERT INTO menu_stock_reservations',
          '(order_id, item_id, delivery_date, quantity_plates, status, held_until_ms, created_at_utc, updated_at_utc)',
          "VALUES (?, ?, ?, ?, 'HELD', ?, ?, ?)",
        ].join(' '),
        args: [orderId, id, deliveryDateIst, qty, expiresAtMs, nowUtc, nowUtc],
      });
    }
    return { idempotent: false };
  });
}

/** Release only unpaid FAILED/CANCELLED holds; never release confirmed stock. */
export async function releaseFailedMenuHolds(db: Client, orderId: string, nowMs = Date.now()): Promise<number> {
  if (!orderId || !Number.isFinite(nowMs)) throw new Error('Invalid release request');
  return writeTx(db, async tx => {
    const order = await tx.execute({
      sql: 'SELECT payment_status, fulfillment_status FROM orders WHERE id = ?',
      args: [orderId],
    });
    if (!order.rows[0] || (order.rows[0].payment_status !== 'FAILED' &&
        order.rows[0].fulfillment_status !== 'CANCELLED')) {
      throw new Error('Only failed or cancelled unpaid orders may release a hold');
    }
    const paid = await tx.execute({
      sql: "SELECT 1 FROM payments WHERE order_id = ? AND status = 'SUCCESS' AND verified_at IS NOT NULL LIMIT 1",
      args: [orderId],
    });
    if (paid.rows.length || order.rows[0].payment_status === 'PAID') {
      throw new Error('Verified payments may not release inventory');
    }
    const result = await tx.execute({
      sql: "UPDATE menu_stock_reservations SET status = 'RELEASED', updated_at_utc = ? WHERE order_id = ? AND status = 'HELD'",
      args: [new Date(nowMs).toISOString(), orderId],
    });
    return result.rowsAffected;
  });
}

/** Lazily expire unpaid holds; paid or verified payments continue counting. */
export async function expireUnpaidMenuHolds(db: Client, nowMs = Date.now()): Promise<number> {
  if (!Number.isFinite(nowMs)) throw new Error('Invalid expiration timestamp');
  return writeTx(db, async tx => {
    const result = await tx.execute({
      sql: [
        "UPDATE menu_stock_reservations AS r SET status = 'EXPIRED', updated_at_utc = ?",
        "WHERE status = 'HELD' AND held_until_ms <= ?",
        "AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = r.order_id AND o.payment_status = 'PAID')",
        "AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = r.order_id AND p.status = 'SUCCESS' AND p.verified_at IS NOT NULL)",
      ].join(' '),
      args: [new Date(nowMs).toISOString(), nowMs],
    });
    return result.rowsAffected;
  });
}

/**
 * Idempotent stock settlement only AFTER order is marked PAID and a matching
 * successful, verified payment row exists. Never trusts a frontend paid flag.
 * This does not itself verify/capture gateway signatures or take payment.
 */
export async function confirmMenuHoldsForVerifiedPayment(
  db: Client, orderId: string, nowMs = Date.now(),
): Promise<{ idempotent: boolean }> {
  if (!orderId || !Number.isFinite(nowMs)) throw new Error('Invalid confirmation request');
  return writeTx(db, async tx => {
    const orderRes = await tx.execute({
      sql: 'SELECT payment_status, provider_payment_id, total_amount_paisa FROM orders WHERE id = ?',
      args: [orderId],
    });
    const order = orderRes.rows[0];
    if (!order || order.payment_status !== 'PAID') {
      throw new Error('Verified paid order required before stock confirmation');
    }
    const verified = await tx.execute({
      sql: [
        "SELECT 1 FROM payments WHERE order_id = ? AND status = 'SUCCESS'",
        'AND verified_at IS NOT NULL AND provider_payment_id = ? AND amount_paisa = ? LIMIT 1',
      ].join(' '),
      args: [orderId, order.provider_payment_id, order.total_amount_paisa],
    });
    if (!verified.rows.length) throw new Error('Matching verified payment record required');

    const held = await tx.execute({
      sql: 'SELECT item_id, delivery_date, status FROM menu_stock_reservations WHERE order_id = ?',
      args: [orderId],
    });
    if (!held.rows.length || held.rows.some(row => row.status !== 'HELD' && row.status !== 'CONFIRMED')) {
      throw new Error('No active stock holds; late payment requires manual resolution');
    }
    if (held.rows.every(row => row.status === 'CONFIRMED')) return { idempotent: true };
    if (held.rows.some(row => row.status !== 'HELD')) throw new Error('Partial stock confirmation is invalid');

    // Count includes the now-paid order's own hold even after its TTL. If other
    // orders filled an expired hold's slots, fail closed (no oversell).
    for (const row of held.rows) {
      const item = byId.get(String(row.item_id));
      if (!item || item.dailyPlateLimit === null ||
          await occupiedPlates(tx, item.id, String(row.delivery_date), nowMs) > item.dailyPlateLimit) {
        throw new Error('Stock no longer available; payment requires manual resolution');
      }
    }
    await tx.execute({
      sql: "UPDATE menu_stock_reservations SET status = 'CONFIRMED', updated_at_utc = ? WHERE order_id = ? AND status = 'HELD'",
      args: [new Date(nowMs).toISOString(), orderId],
    });
    return { idempotent: false };
  });
}
