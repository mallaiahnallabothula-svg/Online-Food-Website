import { describe, expect, it } from 'vitest';
import { createClient } from '@libsql/client';
import { DB_SCHEMA } from '../server/db/schema.ts';

describe('additive food menu database tables', () => {
  it('initializes idempotently and preserves old order/payment schema', async () => {
    const db = createClient({ url: ':memory:' });
    try {
      const statements = DB_SCHEMA.split(';').map(s => s.trim()).filter(Boolean);
      for (const sql of statements) await db.execute(sql);
      for (const sql of statements) await db.execute(sql);

      const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table'");
      const names = tables.rows.map(row => String(row.name));
      for (const name of ['orders', 'payments', 'payment_intents', 'feedback', 'order_items', 'menu_stock_reservations']) {
        expect(names).toContain(name);
      }

      const legacy = await db.execute('PRAGMA table_info(orders)');
      expect(legacy.rows.map(row => String(row.name))).toContain('jowar_quantity');
      expect(legacy.rows.map(row => String(row.name))).toContain('chapathi_quantity');

      const payment = await db.execute('PRAGMA table_info(payments)');
      expect(payment.rows.map(row => String(row.name))).toContain('provider_payment_id');

      const item = await db.execute('PRAGMA table_info(order_items)');
      expect(item.rows.map(row => String(row.name))).toEqual(expect.arrayContaining([
        'order_id', 'item_id', 'item_name_en', 'item_name_te',
        'meal_period', 'sale_unit', 'quantity', 'unit_price_paisa', 'line_total_paisa',
      ]));

      const reservation = await db.execute('PRAGMA table_info(menu_stock_reservations)');
      expect(reservation.rows.map(row => String(row.name))).toEqual(expect.arrayContaining([
        'order_id', 'item_id', 'delivery_date', 'quantity_plates', 'status', 'held_until_ms',
      ]));
    } finally {
      db.close();
    }
  });

  it('enforces positive quantities, valid meal slots and status in schema', async () => {
    const db = createClient({ url: ':memory:' });
    try {
      for (const sql of DB_SCHEMA.split(';').map(s => s.trim()).filter(Boolean)) await db.execute(sql);
      // No order can be inserted through this fixture; CHECK constraints are
      // evaluated before foreign keys on these deliberately invalid writes.
      await expect(db.execute({
        sql: "INSERT INTO order_items(order_id,item_id,item_name_en,item_name_te,meal_period,sale_unit,quantity,unit_price_paisa,line_total_paisa,created_at_utc) VALUES (?,?,?,?,?,?,?,?,?,?)",
        args: ['missing','idly','Idly','ఇడ్లీ','LUNCH','PLATE',1,3000,3000,'2026-10-10T00:00:00Z'],
      })).rejects.toThrow();
      await expect(db.execute({
        sql: "INSERT INTO menu_stock_reservations(order_id,item_id,delivery_date,quantity_plates,status,created_at_utc,updated_at_utc) VALUES (?,?,?,?,?,?,?)",
        args: ['missing','idly','2026-10-11',-1,'HELD','now','now'],
      })).rejects.toThrow();
      await expect(db.execute({
        sql: "INSERT INTO menu_stock_reservations(order_id,item_id,delivery_date,quantity_plates,status,created_at_utc,updated_at_utc) VALUES (?,?,?,?,?,?,?)",
        args: ['missing','idly','2026-10-11',1,'SOLD','now','now'],
      })).rejects.toThrow();
    } finally {
      db.close();
    }
  });
});
