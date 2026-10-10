/**
 * INACTIVE foundation for the future owner dashboard + itemized WhatsApp tickets.
 * No existing owner API, dashboard, checkout or legacy ticket code imports this.
 *
 * Read-only by design: no updates to historical orders, tickets, payments,
 * inventory or customer data. Future callers must enforce owner authentication.
 */
import type { Client } from '@libsql/client';
import { findMenuItem, type MealPeriod, type SaleUnit } from '../../shared/menuCatalog.ts';

type DataRow = Record<string, unknown>;

export interface OwnerOrderLine {
  readonly itemId: string;
  readonly nameEn: string;
  readonly nameTe: string;
  readonly mealPeriod: MealPeriod | null;
  readonly saleUnit: SaleUnit;
  readonly piecesPerUnit: number | null;
  readonly quantity: number;
  readonly unitPricePaisa: number;
  readonly lineTotalPaisa: number;
}

export interface OwnerOrderCompatibility {
  readonly orderId: string;
  readonly format: 'LEGACY' | 'ITEMIZED';
  readonly customerName: string;
  readonly customerMobile: string;
  readonly address: string;
  readonly landmark: string;
  readonly createdAtIst: string;
  readonly deliveryDate: string;
  readonly deliveryWindow: string;
  readonly paymentStatus: string;
  readonly fulfillmentStatus: string;
  readonly providerPaymentId: string;
  readonly lines: readonly OwnerOrderLine[];
  /** Authoritative saved amounts; never recomputed using today's menu prices. */
  readonly subtotalPaisa: number;
  readonly deliveryChargePaisa: number;
  readonly totalAmountPaisa: number;
  /** Unit quantities (plates or pieces), NOT equivalent physical piece counts. */
  readonly totalUnits: number;
  readonly summaryMatchesSavedSubtotal: boolean;
  /** Existing legacy stored ticket or safe future itemized ticket. */
  readonly ticketText: string | null;
  readonly ticketStatus: 'LEGACY_STORED' | 'READY' | 'NOT_READY';
  readonly ticketBlockReason: string | null;
}

function wholePaisa(value: unknown, field: string): number {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error('Invalid saved ' + field);
  }
  return amount;
}

function positiveQuantity(value: unknown): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error('Invalid saved item quantity');
  return n;
}

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

function singleLine(value: string): string {
  return value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function rupees(paisa: number): string {
  return '₹' + (paisa / 100).toFixed(2);
}

function safeLegacyLines(order: DataRow): OwnerOrderLine[] {
  const lines: OwnerOrderLine[] = [];
  for (const spec of [
    { id: 'jowar-roti', en: 'Jowar Roti', te: 'జొన్న రొట్టె', qty: 'jowar_quantity', price: 'jowar_unit_price_paisa' },
    { id: 'chapathi', en: 'Chapathi', te: 'చపాతీ', qty: 'chapathi_quantity', price: 'chapathi_unit_price_paisa' },
  ]) {
    const qty = wholePaisa(order[spec.qty] ?? 0, spec.qty);
    if (qty === 0) continue;
    const price = wholePaisa(order[spec.price], spec.price);
    lines.push({
      itemId: spec.id, nameEn: spec.en, nameTe: spec.te,
      mealPeriod: null, saleUnit: 'PIECE', piecesPerUnit: 1, quantity: qty,
      unitPricePaisa: price, lineTotalPaisa: qty * price,
    });
  }
  return lines;
}

function itemizedLines(rows: readonly DataRow[]): OwnerOrderLine[] {
  return rows.map(row => {
    const unit = text(row.sale_unit);
    const period = text(row.meal_period);
    if (unit !== 'PLATE' && unit !== 'PIECE') throw new Error('Invalid saved sale unit');
    if (period !== 'MORNING' && period !== 'EVENING') throw new Error('Invalid saved meal period');
    const qty = positiveQuantity(row.quantity);
    const price = wholePaisa(row.unit_price_paisa, 'unit price');
    const total = wholePaisa(row.line_total_paisa, 'line total');
    if (total !== qty * price || !Number.isSafeInteger(total)) {
      throw new Error('Saved line total does not match snapshot pricing');
    }
    const pieces = row.pieces_per_unit === null ? null : positiveQuantity(row.pieces_per_unit);
    const nameEn = singleLine(text(row.item_name_en));
    const nameTe = singleLine(text(row.item_name_te));
    if (!nameEn || !nameTe || !text(row.item_id)) throw new Error('Invalid saved item name');
    return {
      itemId: text(row.item_id), nameEn, nameTe, mealPeriod: period,
      saleUnit: unit, piecesPerUnit: pieces, quantity: qty,
      unitPricePaisa: price, lineTotalPaisa: total,
    };
  });
}

/** Pure owner dashboard projection; unchanged legacy orders use saved legacy columns. */
export function buildOwnerOrderCompatibility(
  order: DataRow,
  savedItems: readonly DataRow[],
  hasVerifiedPayment = false,
  confirmedReservations: readonly DataRow[] = [],
): OwnerOrderCompatibility {
  const format = savedItems.length > 0 ? 'ITEMIZED' : 'LEGACY';
  const lines = format === 'ITEMIZED' ? itemizedLines(savedItems) : safeLegacyLines(order);
  const subtotalPaisa = wholePaisa(order.subtotal_paisa, 'subtotal');
  const deliveryChargePaisa = wholePaisa(order.delivery_charge_paisa, 'delivery charge');
  const totalAmountPaisa = wholePaisa(order.total_amount_paisa, 'total');
  const lineSubtotal = lines.reduce((acc, line) => acc + line.lineTotalPaisa, 0);
  const summaryMatchesSavedSubtotal = lineSubtotal === subtotalPaisa &&
    subtotalPaisa + deliveryChargePaisa === totalAmountPaisa;
  const base = {
    orderId: text(order.id),
    format,
    customerName: text(order.customer_name),
    customerMobile: text(order.customer_mobile),
    address: text(order.address),
    landmark: text(order.landmark),
    createdAtIst: text(order.created_at_ist),
    deliveryDate: text(order.delivery_date),
    deliveryWindow: text(order.delivery_window),
    paymentStatus: text(order.payment_status),
    fulfillmentStatus: text(order.fulfillment_status),
    providerPaymentId: text(order.provider_payment_id),
    lines,
    subtotalPaisa, deliveryChargePaisa, totalAmountPaisa,
    totalUnits: lines.reduce((acc, line) => acc + line.quantity, 0),
    summaryMatchesSavedSubtotal,
  } as const;

  // Historical tickets remain stored bytes, regardless of later catalog edits.
  // Never synthesize a legacy ticket in this adapter or change old payment flow.
  if (format === 'LEGACY') {
    const stored = text(order.ticket_text);
    return {
      ...base,
      ticketText: stored || null,
      ticketStatus: stored ? 'LEGACY_STORED' : 'NOT_READY',
      ticketBlockReason: stored ? null : 'No historical ticket stored',
    };
  }

  const cappedLines = lines.filter(line => {
    const item = findMenuItem(line.itemId);
    return item && item.dailyPlateLimit !== null;
  });
  const unknownItems = lines.some(line => !findMenuItem(line.itemId));
  const allCappedConfirmed = cappedLines.every(line => confirmedReservations.some(r =>
    text(r.item_id) === line.itemId &&
    text(r.delivery_date) === base.deliveryDate &&
    text(r.status) === 'CONFIRMED' &&
    Number(r.quantity_plates) === line.quantity
  ));

  let reason: string | null = null;
  if (!summaryMatchesSavedSubtotal) reason = 'Saved line totals do not reconcile';
  else if (base.paymentStatus !== 'PAID') reason = 'Order not paid';
  else if (!hasVerifiedPayment) reason = 'Matching verified payment missing';
  else if (unknownItems) reason = 'Unknown historical item requires review';
  else if (!allCappedConfirmed) reason = 'Stock reservation not confirmed';
  else if (lines.some(line => line.mealPeriod !== lines[0]?.mealPeriod)) {
    reason = 'Mixed meal periods require review';
  }

  const result: OwnerOrderCompatibility = {
    ...base,
    ticketText: null,
    ticketStatus: reason ? 'NOT_READY' : 'READY',
    ticketBlockReason: reason,
  };
  return reason ? result : {
    ...result,
    ticketText: renderItemizedOwnerTicket(result),
  };
}

/** New-menu-only ticket text. Called only after payment and stock checks. */
export function renderItemizedOwnerTicket(
  order: OwnerOrderCompatibility,
  language: 'te' | 'en' = 'te',
): string {
  if (order.format !== 'ITEMIZED' || order.ticketStatus !== 'READY' ||
      !order.summaryMatchesSavedSubtotal) {
    throw new Error('Only verified, ready itemized orders can create a new menu ticket');
  }
  const te = language === 'te';
  const title = te ? '🧾 *మన ఇంటి వంట — ఆర్డర్ టికెట్*' : '🧾 *MANA ENTI VANTA — ORDER TICKET*';
  const result = [
    title,
    '--------------------------------',
    '🎫 ' + (te ? 'ఆర్డర్ ID' : 'Order ID') + ': ' + singleLine(order.orderId),
    '📅 ' + (te ? 'డెలివరీ తేదీ' : 'Delivery date') + ': ' + singleLine(order.deliveryDate),
    '🕒 ' + (te ? 'డెలివరీ సమయం' : 'Delivery window') + ': ' + singleLine(order.deliveryWindow) + ' IST',
    '👤 ' + (te ? 'కస్టమర్' : 'Customer') + ': ' + singleLine(order.customerName),
    '📞 ' + (te ? 'ఫోన్' : 'Phone') + ': ' + singleLine(order.customerMobile),
    '📍 ' + (te ? 'చిరునామా' : 'Address') + ': ' + singleLine(order.address),
  ];
  if (order.landmark) result.push('🏠 Landmark: ' + singleLine(order.landmark));
  result.push('', te ? '*ఆర్డర్ వస్తువులు:*' : '*Order items:*');
  for (const line of order.lines) {
    const name = te ? line.nameTe : line.nameEn;
    const unit = line.saleUnit === 'PLATE' ? (te ? 'ప్లేట్లు' : 'plates') : (te ? 'ముక్కలు' : 'pieces');
    const pieces = line.piecesPerUnit && line.saleUnit === 'PLATE'
      ? ' (' + line.piecesPerUnit + (te ? ' పీసులు/ప్లేట్)' : ' pcs/plate)') : '';
    result.push('• ' + name + ': ' + line.quantity + ' ' + unit + pieces +
      ' × ' + rupees(line.unitPricePaisa) + ' = ' + rupees(line.lineTotalPaisa));
  }
  result.push(
    '',
    'Subtotal: ' + rupees(order.subtotalPaisa),
    'Delivery: ' + rupees(order.deliveryChargePaisa),
    '💰 Total: ' + rupees(order.totalAmountPaisa),
    '✅ ' + (te ? 'ధృవీకరించిన చెల్లింపు' : 'Verified payment') + ': ' + singleLine(order.providerPaymentId),
  );
  return result.join('\n');
}

/**
 * Read-only owner adapter for a future authenticated API.
 * No DB write and no change to current /api/admin/orders response.
 */
export async function loadOwnerOrderCompatibility(
  db: Client, orderId: string,
): Promise<OwnerOrderCompatibility | null> {
  if (typeof orderId !== 'string' || !orderId.trim() || orderId.length > 128) {
    throw new Error('A valid order ID is required');
  }
  const order = await db.execute({ sql: 'SELECT * FROM orders WHERE id = ? LIMIT 1', args: [orderId] });
  const row = order.rows[0];
  if (!row) return null;
  const snapshots = await db.execute({
    sql: 'SELECT * FROM order_items WHERE order_id = ? ORDER BY rowid ASC',
    args: [orderId],
  });
  if (!snapshots.rows.length) return buildOwnerOrderCompatibility(row, []);

  const verified = await db.execute({
    sql: [
      "SELECT 1 FROM payments WHERE order_id = ? AND status = 'SUCCESS'",
      'AND verified_at IS NOT NULL AND provider_payment_id = ?',
      'AND amount_paisa = ? AND currency = ? LIMIT 1',
    ].join(' '),
    args: [orderId, text(row.provider_payment_id), wholePaisa(row.total_amount_paisa, 'total'),
      text(row.currency)],
  });
  const reservations = await db.execute({
    sql: 'SELECT item_id, delivery_date, quantity_plates, status FROM menu_stock_reservations WHERE order_id = ?',
    args: [orderId],
  });
  return buildOwnerOrderCompatibility(row, snapshots.rows, verified.rows.length > 0, reservations.rows);
}
