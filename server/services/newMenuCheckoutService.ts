/**
 * INACTIVE new-menu checkout foundation. No routes/UI/payment provider import
 * this module. Gateway integration and user approval are required before launch.
 */
import crypto from 'node:crypto';
import type { Client } from '@libsql/client';
import { MENU_CATALOG, NEW_MENU_LAUNCH_ENABLED, NEW_MENU_ORDER_POLICY, type MealPeriod, type MenuItem } from '../../shared/menuCatalog.ts';
import { getNextPreorderDeliverySlot } from '../../shared/preorderScheduling.ts';
import { calculateDelivery } from './deliveryService.ts';
import { reserveStockForPendingOrderInTransaction } from './menuStockService.ts';
import { withDbRetry } from '../db/index.ts';

export interface NewMenuCartLine { readonly itemId: string; readonly quantity: number }
export interface NewMenuCustomer {
  readonly name: string; readonly mobile: string; readonly address: string;
  readonly landmark?: string; readonly latitude: number; readonly longitude: number;
  readonly locationLink?: string;
}
export interface NewMenuCheckoutRequest {
  readonly lines: readonly NewMenuCartLine[];
  readonly customer: NewMenuCustomer;
  /** Optional requested slot; the next eligible IST date is calculated server-side. */
  readonly requestedDeliveryDateIst?: string;
}
export interface NewMenuPricing {
  readonly period: MealPeriod;
  readonly deliveryDateIst: string;
  readonly deliveryWindow: string;
  readonly earliestEligibleDeliveryUtc: string;
  readonly items: readonly { item: MenuItem; quantity: number; lineTotalPaisa: number }[];
  readonly totalUnits: number;
  readonly subtotalPaisa: number;
  readonly deliveryChargePaisa: number;
  readonly totalAmountPaisa: number;
  readonly distanceKm: number;
}

const MAX_HOLD_MS = 30 * 60_000;
const byId = new Map(MENU_CATALOG.map(item => [item.id, item]));
const MAX_TOTAL_PAISA = 10_000_000_00; // keep all integer arithmetic safe

function validCustomer(customer: NewMenuCustomer): void {
  if (!customer || typeof customer.name !== 'string' ||
      customer.name.trim().length < 2 || customer.name.trim().length > 100 ||
      typeof customer.mobile !== 'string' || !/^[6-9]\d{9}$/.test(customer.mobile) ||
      typeof customer.address !== 'string' ||
      customer.address.trim().length < 5 || customer.address.trim().length > 500 ||
      (customer.landmark !== undefined && (typeof customer.landmark !== 'string' || customer.landmark.length > 200)) ||
      typeof customer.latitude !== 'number' || typeof customer.longitude !== 'number' ||
      !Number.isFinite(customer.latitude) || !Number.isFinite(customer.longitude) ||
      (customer.locationLink !== undefined && (typeof customer.locationLink !== 'string' || customer.locationLink.length > 2000))) {
    throw new Error('Invalid customer or delivery details');
  }
}

/** Authoritative catalog pricing, minimum cart, meal period and IST scheduling. */
export function priceNewMenuCheckout(
  request: NewMenuCheckoutRequest,
  placedAt: Date = new Date(),
): NewMenuPricing {
  if (!request || !Array.isArray(request.lines) ||
      request.lines.length < 1 || request.lines.length > MENU_CATALOG.length) {
    throw new Error('Cart must contain menu items');
  }
  validCustomer(request.customer);
  const seen = new Set<string>();
  let period: MealPeriod | undefined;
  let subtotalPaisa = 0;
  let totalUnits = 0;
  const items: { item: MenuItem; quantity: number; lineTotalPaisa: number }[] = [];

  for (const line of request.lines) {
    const item = line && typeof line.itemId === 'string' ? byId.get(line.itemId) : undefined;
    if (!item || !Number.isSafeInteger(line.quantity) || line.quantity < item.minimumQuantity ||
        line.quantity > (item.dailyPlateLimit ?? 500) || seen.has(item.id)) {
      throw new Error('Unknown item, duplicate item or invalid quantity');
    }
    if (period && period !== item.mealPeriod) {
      throw new Error('Morning and evening items must be ordered separately');
    }
    period = item.mealPeriod;
    seen.add(item.id);
    const lineTotalPaisa = item.pricePaisa * line.quantity;
    subtotalPaisa += lineTotalPaisa;
    totalUnits += line.quantity;
    if (!Number.isSafeInteger(subtotalPaisa) || subtotalPaisa > MAX_TOTAL_PAISA) {
      throw new Error('Cart amount exceeds safe maximum');
    }
    items.push({ item, quantity: line.quantity, lineTotalPaisa });
  }

  if (subtotalPaisa < NEW_MENU_ORDER_POLICY.minimumCartPaisa) {
    throw new Error('Minimum food cart is ₹100');
  }
  // period is necessarily assigned by nonempty validated lines.
  const slot = getNextPreorderDeliverySlot(period!, placedAt);
  if (request.requestedDeliveryDateIst !== undefined &&
      request.requestedDeliveryDateIst !== slot.deliveryDateIst) {
    throw new Error('Requested delivery date is not the next eligible IST slot');
  }
  const delivery = calculateDelivery(request.customer.latitude, request.customer.longitude);
  if (!delivery.eligible) throw new Error('Delivery location is outside the supported range');
  const totalAmountPaisa = subtotalPaisa + delivery.deliveryChargePaisa;
  if (!Number.isSafeInteger(totalAmountPaisa) || totalAmountPaisa > MAX_TOTAL_PAISA) {
    throw new Error('Order amount exceeds safe maximum');
  }
  return {
    period: period!, items, subtotalPaisa, totalAmountPaisa,
    deliveryChargePaisa: delivery.deliveryChargePaisa,
    distanceKm: delivery.distanceKm, totalUnits,
    deliveryDateIst: slot.deliveryDateIst,
    deliveryWindow: slot.windowStartIst + '-' + slot.windowEndIst,
    earliestEligibleDeliveryUtc: slot.earliestEligibleDeliveryUtc,
  };
}

/**
 * Internal-only atomic PENDING order + saved price snapshots + capped item holds.
 * Caller must later start a verified gateway intent AND handle orphaned pending
 * holds / failed gateway starts. No payment is initiated here.
 *
 * No external order ID supplied, so retries cannot overwrite legacy records.
 * Uncapped legacy item-only carts do not need capped reservations.
 */
export async function createPendingNewMenuCheckout(
  db: Client,
  request: NewMenuCheckoutRequest,
  placedAt: Date = new Date(),
): Promise<{ orderId: string; customerAccessToken: string; expiresAtMs: number; pricing: NewMenuPricing }> {
  if (NEW_MENU_LAUNCH_ENABLED) {
    throw new Error('This inactive foundation must be reviewed before activation');
  }
  const nowMs = placedAt.getTime();
  if (!Number.isSafeInteger(nowMs) || nowMs <= 0) throw new Error('Invalid placement date');
  const pricing = priceNewMenuCheckout(request, placedAt);
  const customer = request.customer;
  const orderId = 'MENU-' + crypto.randomUUID();
  const customerAccessToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(customerAccessToken).digest('hex');
  const expiresAtMs = nowMs + MAX_HOLD_MS;
  const nowUtc = placedAt.toISOString();

  await withDbRetry(async () => {
    const tx = await db.transaction('write');
    try {
      await tx.execute({
        sql: [
          'INSERT INTO orders (id,public_token_hash,created_at_utc,created_at_ist,delivery_date,delivery_window,',
          'jowar_quantity,chapathi_quantity,total_items,jowar_unit_price_paisa,chapathi_unit_price_paisa,',
          'subtotal_paisa,delivery_charge_paisa,total_amount_paisa,currency,payment_status,order_status,',
          'payment_provider,provider_payment_id,fulfillment_status,customer_name,customer_mobile,address,',
          'landmark,latitude,longitude,distance_km,location_link,location_verified,created_by,updated_at,updated_by)',
          'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        ].join(' '),
        args: [
          orderId,tokenHash,nowUtc,nowUtc,pricing.deliveryDateIst,pricing.deliveryWindow,
          0,0,pricing.totalUnits,3000,1000,pricing.subtotalPaisa,
          pricing.deliveryChargePaisa,pricing.totalAmountPaisa,'INR','PENDING','PENDING',
          'razorpay','AWAITING_PAYMENT','RECEIVED',customer.name.trim(),customer.mobile,
          customer.address.trim(),customer.landmark?.trim() ?? '',customer.latitude,customer.longitude,
          pricing.distanceKm,customer.locationLink ?? null,1,'CUSTOMER',nowUtc,'SYSTEM',
        ],
      });

      for (const { item, quantity, lineTotalPaisa } of pricing.items) {
        await tx.execute({
          sql: [
            'INSERT INTO order_items (order_id,item_id,item_name_en,item_name_te,meal_period,sale_unit,',
            'pieces_per_unit,quantity,unit_price_paisa,line_total_paisa,created_at_utc)',
            'VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          ].join(' '),
          args: [orderId,item.id,item.nameEn,item.nameTe,item.mealPeriod,item.saleUnit,
            item.piecesPerUnit,quantity,item.pricePaisa,lineTotalPaisa,nowUtc],
        });
      }

      const capped = pricing.items.filter(({ item }) => item.dailyPlateLimit !== null)
        .map(({ item, quantity }) => ({ itemId: item.id, plates: quantity }));
      if (capped.length) {
        await reserveStockForPendingOrderInTransaction(tx, {
          orderId,deliveryDateIst:pricing.deliveryDateIst,lines:capped,expiresAtMs,
        },nowMs);
      }
      await tx.commit();
    } catch (error) {
      await tx.rollback().catch(() => {});
      throw error;
    } finally {
      tx.close();
    }
  });

  return { orderId, customerAccessToken, expiresAtMs, pricing };
}
