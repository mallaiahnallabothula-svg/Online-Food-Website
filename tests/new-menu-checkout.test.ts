import { describe, expect, it } from 'vitest';
import { createClient, type Client } from '@libsql/client';
import { DB_SCHEMA } from '../server/db/schema.ts';
import { NEW_MENU_LAUNCH_ENABLED } from '../shared/menuCatalog.ts';
import { createPendingNewMenuCheckout, priceNewMenuCheckout, type NewMenuCheckoutRequest } from '../server/services/newMenuCheckoutService.ts';
import { getMenuStockRemaining } from '../server/services/menuStockService.ts';

const placedAt = new Date('2026-10-10T00:30:00.000Z'); // 06:00 IST
const customer = {
  name:'Test Customer',mobile:'9000000001',address:'Flat 1, Kollur test address',
  latitude:17.4850, longitude:78.2350,
};
const request = (lines: readonly {itemId:string;quantity:number}[], extra:Partial<NewMenuCheckoutRequest>={}) => ({
  lines,customer,...extra,
});
const basket = request([{itemId:'idly',quantity:2},{itemId:'ragi-idly',quantity:2}]);
async function dbFixture():Promise<Client>{
  const db=createClient({url:':memory:'});
  for(const sql of DB_SCHEMA.split(';').map(x=>x.trim()).filter(Boolean))await db.execute(sql);
  return db;
}
describe('inactive new menu checkout foundation',()=>{
  it('derives item prices and next eligible morning slot only from authoritative catalog',()=>{
    expect(NEW_MENU_LAUNCH_ENABLED).toBe(false);
    const p=priceNewMenuCheckout(basket,placedAt);
    expect(p.subtotalPaisa).toBe(14000);
    expect(p.totalAmountPaisa).toBe(14000);
    expect(p.period).toBe('MORNING');
    expect(p.deliveryDateIst).toBe('2026-10-10');
    expect(p.deliveryWindow).toBe('07:00-11:00');
    expect(p.totalUnits).toBe(4);
    expect(p.items.map(x=>[x.item.id,x.quantity,x.lineTotalPaisa])).toEqual([
      ['idly',2,6000],['ragi-idly',2,8000],
    ]);
  });
  it('validates minimum cart, duplicate items, per-item quantity and mixed meal slots',()=>{
    expect(()=>priceNewMenuCheckout(request([{itemId:'idly',quantity:1}]),placedAt)).toThrow('Minimum food cart');
    expect(()=>priceNewMenuCheckout(request([{itemId:'idly',quantity:2},{itemId:'idly',quantity:2}]),placedAt)).toThrow('duplicate');
    expect(()=>priceNewMenuCheckout(request([{itemId:'idly',quantity:31}]),placedAt)).toThrow('quantity');
    expect(()=>priceNewMenuCheckout(request([{itemId:'chapathi',quantity:4}]),placedAt)).toThrow('quantity');
    expect(()=>priceNewMenuCheckout(request([{itemId:'idly',quantity:4},{itemId:'pulka',quantity:1}]),placedAt)).toThrow('separately');
    expect(()=>priceNewMenuCheckout(request([{itemId:'fake-item',quantity:1}]),placedAt)).toThrow('Unknown item');
  });
  it('rejects altered future date and respects cutoff / evening scheduling',()=>{
    expect(()=>priceNewMenuCheckout(request(basket.lines,{requestedDeliveryDateIst:'2026-10-11'}),placedAt)).toThrow('next eligible');
    const late=new Date('2026-10-10T05:00:00.000Z'); // 10:30 IST exactly
    expect(priceNewMenuCheckout(basket,late).deliveryDateIst).toBe('2026-10-11');
    const evening=priceNewMenuCheckout(request([{itemId:'pulka',quantity:4}]),new Date('2026-10-10T08:30:00.000Z'));
    expect(evening.deliveryWindow).toBe('18:00-20:00');
    expect(evening.deliveryDateIst).toBe('2026-10-10');
  });
  it('rejects invalid customer coordinates and unsupported delivery area',()=>{
    expect(()=>priceNewMenuCheckout({...basket,customer:{...customer,mobile:'broken'}},placedAt)).toThrow('customer');
    expect(()=>priceNewMenuCheckout({...basket,customer:{...customer,latitude:0,longitude:0}},placedAt)).toThrow('outside');
  });
  it('atomically stores pending order snapshots and capped stock holds',async()=>{
    const db=await dbFixture();
    try{
      const created=await createPendingNewMenuCheckout(db,basket,placedAt);
      expect(created.orderId.startsWith('MENU-')).toBe(true);
      expect(created.customerAccessToken.length).toBe(64);
      const orders=await db.execute({sql:'SELECT payment_status,order_status,subtotal_paisa,delivery_date,total_items FROM orders WHERE id=?',args:[created.orderId]});
      expect(orders.rows[0]).toMatchObject({payment_status:'PENDING',order_status:'PENDING',subtotal_paisa:14000,delivery_date:'2026-10-10',total_items:4});
      const items=await db.execute({sql:'SELECT item_id,quantity,unit_price_paisa FROM order_items WHERE order_id=? ORDER BY item_id',args:[created.orderId]});
      expect(items.rows).toHaveLength(2);
      expect(items.rows[0]).toMatchObject({item_id:'idly',quantity:2,unit_price_paisa:3000});
      const holds=await db.execute({sql:'SELECT item_id,quantity_plates,status FROM menu_stock_reservations WHERE order_id=?',args:[created.orderId]});
      expect(holds.rows).toHaveLength(2);
      expect(holds.rows.every(x=>x.status==='HELD')).toBe(true);
      expect(await getMenuStockRemaining(db,'idly','2026-10-10',placedAt.getTime())).toBe(28);
      expect((await db.execute('SELECT COUNT(*) AS n FROM payments')).rows[0]?.n).toBe(0);
      expect((await db.execute('SELECT COUNT(*) AS n FROM payment_intents')).rows[0]?.n).toBe(0);
    }finally{db.close();}
  });
  it('rolls back pending order and all snapshots on out-of-stock reservation',async()=>{
    const db=await dbFixture();
    try {
      await createPendingNewMenuCheckout(db,request([{itemId:'idly',quantity:30}]),placedAt);
      await expect(createPendingNewMenuCheckout(db,request([{itemId:'idly',quantity:1},{itemId:'ragi-idly',quantity:3}]),placedAt)).rejects.toThrow('OUT_OF_STOCK');
      expect((await db.execute('SELECT COUNT(*) AS n FROM orders')).rows[0]?.n).toBe(1);
      expect((await db.execute('SELECT COUNT(*) AS n FROM order_items')).rows[0]?.n).toBe(1);
      expect((await db.execute('SELECT COUNT(*) AS n FROM menu_stock_reservations')).rows[0]?.n).toBe(1);
    }finally{db.close();}
  });
  it('permits uncapped piece-only carts without any inventory reservations',async()=>{
    const db=await dbFixture();
    try{
      const plan=request([{itemId:'jowar-roti',quantity:5}]);
      const result=await createPendingNewMenuCheckout(db,plan,placedAt);
      expect(result.pricing.period).toBe('EVENING');
      expect(result.pricing.subtotalPaisa).toBe(15000);
      expect((await db.execute({sql:'SELECT COUNT(*) AS n FROM menu_stock_reservations WHERE order_id=?',args:[result.orderId]})).rows[0]?.n).toBe(0);
    }finally{db.close();}
  });
  it('prevents parallel checkouts from selling more than thirty capped plates',async()=>{
    const db=await dbFixture();
    try{
      const [a,b]=await Promise.allSettled([
        createPendingNewMenuCheckout(db,request([{itemId:'idly',quantity:20}]),placedAt),
        createPendingNewMenuCheckout(db,request([{itemId:'idly',quantity:20}]),placedAt),
      ]);
      expect([a,b].filter(x=>x.status==='fulfilled')).toHaveLength(1);
      expect(await getMenuStockRemaining(db,'idly','2026-10-10',placedAt.getTime())).toBe(10);
      expect((await db.execute('SELECT COUNT(*) AS n FROM orders')).rows[0]?.n).toBe(1);
    }finally{db.close();}
  });
});