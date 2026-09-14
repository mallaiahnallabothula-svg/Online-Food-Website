import crypto from 'crypto';
import { getDb } from './index.ts';

export async function seedDevelopmentData(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const db = getDb();
  const existingOrders = await db.execute('SELECT COUNT(*) as count FROM orders');
  const count = Number(existingOrders.rows[0]?.count ?? 0);

  if (count > 0) {
    return; // Already has data
  }

  console.log('[DB] Seeding isolated development mock orders...');

  // Sample development orders with sanitized test phone and non-PII test addresses
  const sampleOrders = [
    {
      id: 'SMJR-20260914-1001',
      token: 'dev-token-customer-1001-secret',
      createdAtUtc: new Date(Date.now() - 3600000 * 4).toISOString(),
      createdAtIst: '14 Sep 2026, 11:30 AM',
      deliveryDate: new Date().toISOString().split('T')[0]!,
      deliveryWindow: '18:00-20:00',
      jowarQty: 10,
      chapathiQty: 5,
      totalItems: 15,
      karivepakuGrams: 100,
      aviseGrams: 100,
      jowarUnitPrice: 3000,
      chapathiUnitPrice: 1000,
      subtotal: 35000,
      deliveryCharge: 0,
      total: 35000,
      paymentStatus: 'PAID',
      provider: 'mock',
      providerPaymentId: 'mock_pay_1001_demo',
      fulfillmentStatus: 'PREPARING',
      name: 'Ravi Kumar (Test)',
      mobile: '9848011111',
      address: 'Flat 202, Block A, Kollur Hub Layout',
      landmark: 'Near Gram Panchayat',
      distanceKm: 2.5,
      locationLink: 'https://maps.google.com/?q=17.4850,78.2350',
    },
    {
      id: 'SMJR-20260914-1002',
      token: 'dev-token-customer-1002-secret',
      createdAtUtc: new Date(Date.now() - 3600000 * 2).toISOString(),
      createdAtIst: '14 Sep 2026, 01:15 PM',
      deliveryDate: new Date().toISOString().split('T')[0]!,
      deliveryWindow: '18:00-20:00',
      jowarQty: 5,
      chapathiQty: 0,
      totalItems: 5,
      karivepakuGrams: 50,
      aviseGrams: 50,
      jowarUnitPrice: 3000,
      chapathiUnitPrice: 1000,
      subtotal: 15000,
      deliveryCharge: 2700, // 8 km -> 3 km excess @ ₹9 = ₹27 (2700 paise)
      total: 17700,
      paymentStatus: 'PAID',
      provider: 'mock',
      providerPaymentId: 'mock_pay_1002_demo',
      fulfillmentStatus: 'RECEIVED',
      name: 'Sunitha Reddy (Test)',
      mobile: '9848022222',
      address: 'Villa 14, Golden Meadows, Tellapur',
      landmark: 'Beside Community Park',
      distanceKm: 8.0,
      locationLink: 'https://maps.google.com/?q=17.5100,78.2600',
    },
  ];

  for (const order of sampleOrders) {
    const tokenHash = crypto.createHash('sha256').update(order.token).digest('hex');
    await db.execute({
      sql: `INSERT INTO orders (
        id, public_token_hash, created_at_utc, created_at_ist, delivery_date, delivery_window,
        jowar_quantity, chapathi_quantity, total_items, karivepaku_grams, avise_grams,
        jowar_unit_price_paisa, chapathi_unit_price_paisa, subtotal_paisa, delivery_charge_paisa, total_amount_paisa,
        currency, payment_status, payment_provider, provider_payment_id, fulfillment_status,
        customer_name, customer_mobile, address, landmark, distance_km, location_link, location_verified,
        created_by, updated_at, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        order.id, tokenHash, order.createdAtUtc, order.createdAtIst, order.deliveryDate, order.deliveryWindow,
        order.jowarQty, order.chapathiQty, order.totalItems, order.karivepakuGrams, order.aviseGrams,
        order.jowarUnitPrice, order.chapathiUnitPrice, order.subtotal, order.deliveryCharge, order.total,
        'INR', order.paymentStatus, order.provider, order.providerPaymentId, order.fulfillmentStatus,
        order.name, order.mobile, order.address, order.landmark, order.distanceKm, order.locationLink, 1,
        'CUSTOMER', order.createdAtUtc, 'SYSTEM'
      ],
    });

    await db.execute({
      sql: `INSERT INTO payments (id, order_id, provider, provider_payment_id, amount_paisa, status, signature, raw_payload, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `PAY-${crypto.randomBytes(8).toString('hex')}`,
        order.id,
        order.provider,
        order.providerPaymentId,
        order.total,
        'SUCCESS',
        'dev_mock_signature',
        JSON.stringify({ simulated: true }),
        order.createdAtUtc
      ]
    });
  }

  console.log('[DB] Seeded development test orders successfully.');
}
