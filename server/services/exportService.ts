import { getDb } from '../db/index.ts';

/**
 * Sanitizes a string for CSV to prevent Formula Injection (CSV injection).
 * If a field begins with '=', '+', '-', '@', '\t', or '\r', prefix with single quote `'`.
 */
export function sanitizeCsvField(value: any): string {
  if (value === null || value === undefined) {
    return '""';
  }
  let str = String(value);

  // Formula injection defense
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape double quotes
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

export async function generateOrdersCsv(dateFilter?: string): Promise<string> {
  const db = getDb();
  let sql = `
    SELECT
      id, created_at_utc, created_at_ist, delivery_date, delivery_window,
      jowar_quantity, chapathi_quantity, total_items, karivepaku_grams, avise_grams,
      jowar_unit_price_paisa, chapathi_unit_price_paisa, subtotal_paisa, delivery_charge_paisa, total_amount_paisa,
      payment_status, payment_provider, provider_payment_id, fulfillment_status,
      customer_name, customer_mobile, address, landmark, distance_km
    FROM orders
  `;
  const args: any[] = [];

  if (dateFilter) {
    sql += ' WHERE delivery_date = ? ';
    args.push(dateFilter);
  }

  sql += ' ORDER BY created_at_utc DESC';

  const res = await db.execute({ sql, args });

  const headers = [
    'Order ID',
    'Created At UTC',
    'Created At IST',
    'Delivery Date',
    'Delivery Window',
    'Jowar Roti Qty',
    'Chapathi Qty',
    'Total Items',
    'Karivepaku Karam (g)',
    'Avise Ginjalu Karam (g)',
    'Subtotal (INR)',
    'Delivery Fee (INR)',
    'Total Paid (INR)',
    'Payment Status',
    'Provider',
    'Payment Reference',
    'Fulfillment Status',
    'Customer Name',
    'Customer Mobile',
    'Address',
    'Landmark',
    'Distance (km)'
  ];

  const rows: string[] = [];
  rows.push(headers.map(sanitizeCsvField).join(','));

  for (const r of res.rows) {
    const row = [
      r.id,
      r.created_at_utc,
      r.created_at_ist,
      r.delivery_date,
      r.delivery_window,
      r.jowar_quantity,
      r.chapathi_quantity,
      r.total_items,
      r.karivepaku_grams,
      r.avise_grams,
      Math.round(Number(r.subtotal_paisa || 0) / 100),
      Math.round(Number(r.delivery_charge_paisa || 0) / 100),
      Math.round(Number(r.total_amount_paisa || 0) / 100),
      r.payment_status,
      r.payment_provider,
      r.provider_payment_id,
      r.fulfillment_status,
      r.customer_name,
      r.customer_mobile,
      r.address,
      r.landmark,
      r.distance_km,
    ];
    rows.push(row.map(sanitizeCsvField).join(','));
  }

  return rows.join('\r\n');
}
