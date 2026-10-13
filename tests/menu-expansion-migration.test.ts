import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createClient } from '@libsql/client';
import { DB_SCHEMA } from '../server/db/schema';
import { createPendingNewMenuCheckout } from '../server/services/newMenuCheckoutService';
const sql = readFileSync('server/db/migrations/20261012_menu_packs.sql','utf8');
describe('isolated menu expansion migration', () => {
 it('blocks pending payments, then preserves paid snapshots and backfills piece inventory', async () => {
  const db=createClient({url:':memory:'});
  try {
   for (const statement of DB_SCHEMA.replace("'PIECE', 'PLATE', 'PACK'", "'PIECE', 'PLATE'").split(';').filter(x=>x.trim())) await db.execute(statement);
   const order=await createPendingNewMenuCheckout(db,{lines:[{itemId:'jowar-roti',quantity:5}],customer:{name:'Test Buyer',mobile:'9000000001',address:'Kollur test address',latitude:17.485,longitude:78.235}},new Date('2026-10-12T06:00:00Z'));
   const run = () => db.executeMultiple(sql);
   await expect(run()).rejects.toThrow('CHECK constraint failed');
   // libSQL automatically rolls back executeMultiple on failure.
   expect((await db.execute("SELECT COUNT(*) n FROM sqlite_temp_master WHERE name='menu_migration_guard'")).rows[0]?.n).toBe(0);
   await db.execute("UPDATE orders SET payment_status='PAID'");
   await db.execute('DELETE FROM menu_stock_reservations');
   const before=(await db.execute('SELECT * FROM order_items')).rows;
   await run();
   expect((await db.execute('SELECT * FROM order_items')).rows).toEqual(before);
   expect((await db.execute('SELECT status,quantity_plates FROM menu_stock_reservations')).rows[0]).toMatchObject({status:'CONFIRMED',quantity_plates:5});
   await db.execute({sql:"INSERT INTO order_items SELECT order_id,'mixed-veg-kurma','Mixed Veg Kurma','కుర్మా',meal_period,'PACK',NULL,1,4000,4000,created_at_utc FROM order_items WHERE order_id=?",args:[order.orderId]});
   expect((await db.execute('SELECT COUNT(*) n FROM order_items')).rows[0]?.n).toBe(2);
  } finally { db.close(); }
 });
});
