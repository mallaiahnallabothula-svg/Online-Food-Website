import { describe, expect, it } from 'vitest';
import { createClient, type Client } from '@libsql/client';
import { DB_SCHEMA } from '../server/db/schema.ts';
import { reserveStockForPendingOrder, getMenuStockRemaining, expireUnpaidMenuHolds, releaseFailedMenuHolds, confirmMenuHoldsForVerifiedPayment } from '../server/services/menuStockService.ts';

const now = Date.UTC(2026, 9, 10, 6, 0);
const date = '2026-10-11';
async function setup(): Promise<Client> {
  const db = createClient({ url: ':memory:' });
  for (const sql of DB_SCHEMA.split(';').map(s=>s.trim()).filter(Boolean)) await db.execute(sql);
  return db;
}
async function pending(db: Client, id: string, quantity: number) {
  const subtotal=quantity*3000;
  await db.execute({sql:[
    'INSERT INTO orders (id, public_token_hash, created_at_utc, created_at_ist, delivery_date, delivery_window,',
    'total_items,jowar_unit_price_paisa,chapathi_unit_price_paisa,subtotal_paisa,delivery_charge_paisa,total_amount_paisa,',
    'payment_status,order_status,payment_provider,provider_payment_id,fulfillment_status,customer_name,customer_mobile,',
    'address,distance_km,created_by,updated_at,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ].join(' '),args:[id,'hash-'+id,'2026-10-10','10 Oct',date,'07:00-11:00',quantity,3000,1000,subtotal,0,subtotal,
    'PENDING','PENDING','razorpay','AWAITING_PAYMENT','RECEIVED','Test','9000000001','Kollur test address',
    1,'CUSTOMER','2026-10-10','SYSTEM']});
  await db.execute({sql:[
    'INSERT INTO order_items (order_id,item_id,item_name_en,item_name_te,meal_period,sale_unit,pieces_per_unit,',
    'quantity,unit_price_paisa,line_total_paisa,created_at_utc) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  ].join(' '),args:[id,'idly','Idly','ఇడ్లీ','MORNING','PLATE',4,quantity,3000,subtotal,'2026-10-10']});
}
const request=(id:string,qty:number,at=now)=>({orderId:id,deliveryDateIst:date,lines:[{itemId:'idly',plates:qty}],expiresAtMs:at+1800000});

describe('inactive daily plate stock protection', () => {
  it('has 30-plate capacity, atomic rejection and idempotency', async () => {
    const db=await setup();
    try {
      await pending(db,'A',20);await pending(db,'B',11);
      expect(await reserveStockForPendingOrder(db,request('A',20),now)).toEqual({idempotent:false});
      expect(await reserveStockForPendingOrder(db,request('A',20),now)).toEqual({idempotent:true});
      await expect(reserveStockForPendingOrder(db,request('B',11),now)).rejects.toThrow('OUT_OF_STOCK');
      expect(await getMenuStockRemaining(db,'idly',date,now)).toBe(10);
    }finally{db.close();}
  });
  it('expires unpaid holds and cannot revive them', async () => {
    const db=await setup();
    try {
      await pending(db,'C',30);await pending(db,'D',30);
      await reserveStockForPendingOrder(db,request('C',30),now);
      const later=now+1800000;
      expect(await expireUnpaidMenuHolds(db,later)).toBe(1);
      expect(await getMenuStockRemaining(db,'idly',date,later)).toBe(30);
      await expect(reserveStockForPendingOrder(db,request('C',30,later),later)).rejects.toThrow('Existing hold');
      expect(await reserveStockForPendingOrder(db,request('D',30,later),later)).toEqual({idempotent:false});
    }finally{db.close();}
  });
  it('validates server-priced cart value and line quantities', async () => {
    const db=await setup();
    try {
      await pending(db,'E',2);
      await expect(reserveStockForPendingOrder(db,request('E',2),now)).rejects.toThrow('minimum cart');
      await pending(db,'F',4);
      await expect(reserveStockForPendingOrder(db,request('F',5),now)).rejects.toThrow('Stock lines');
    }finally{db.close();}
  });
  it('confirms only verified matching paid orders and never expires confirmed stock', async () => {
    const db=await setup();
    try {
      await pending(db,'G',4);
      await reserveStockForPendingOrder(db,request('G',4),now);
      await expect(confirmMenuHoldsForVerifiedPayment(db,'G',now)).rejects.toThrow('Verified paid');
      await db.execute({sql:"UPDATE orders SET payment_status='PAID',order_status='TICKET_GENERATED',provider_payment_id=? WHERE id=?",args:['pay-G','G']});
      await db.execute({sql:[
        'INSERT INTO payments (id,order_id,provider,provider_payment_id,amount_paisa,status,verified_at,created_at,updated_at)',
        "VALUES (?,?,?,?,?,'SUCCESS',?,?,?)"
      ].join(' '),args:['PAY-G','G','razorpay','pay-G',12000,'2026-10-10','2026-10-10','2026-10-10']});
      expect(await confirmMenuHoldsForVerifiedPayment(db,'G',now)).toEqual({idempotent:false});
      expect(await confirmMenuHoldsForVerifiedPayment(db,'G',now)).toEqual({idempotent:true});
      expect(await expireUnpaidMenuHolds(db,now+3600000)).toBe(0);
      expect(await getMenuStockRemaining(db,'idly',date,now+3600000)).toBe(26);
      await expect(releaseFailedMenuHolds(db,'G',now)).rejects.toThrow();
    }finally{db.close();}
  });
  it('releases failed unpaid holds without deleting any order', async () => {
    const db=await setup();
    try {
      await pending(db,'H',5);
      await reserveStockForPendingOrder(db,request('H',5),now);
      await db.execute({sql:"UPDATE orders SET payment_status='FAILED' WHERE id=?",args:['H']});
      expect(await releaseFailedMenuHolds(db,'H',now)).toBe(1);
      expect(await releaseFailedMenuHolds(db,'H',now)).toBe(0);
      expect(await getMenuStockRemaining(db,'idly',date,now)).toBe(30);
      expect((await db.execute("SELECT payment_status FROM orders WHERE id='H'")).rows[0]?.payment_status).toBe('FAILED');
    }finally{db.close();}
  });
  it('serializes simultaneous holds and prevents overselling', async () => {
    const db=await setup();
    try {
      await pending(db,'I',20);await pending(db,'J',20);
      const results=await Promise.allSettled([
        reserveStockForPendingOrder(db,request('I',20),now),
        reserveStockForPendingOrder(db,request('J',20),now),
      ]);
      expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);
      expect(await getMenuStockRemaining(db,'idly',date,now)).toBe(10);
    }finally{db.close();}
  });
});