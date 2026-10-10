import crypto from 'node:crypto';
import { createClient, type Client } from '@libsql/client';
import { describe, expect, it, vi } from 'vitest';
import { DB_SCHEMA } from '../server/db/schema.ts';
import { createPendingNewMenuCheckout } from '../server/services/newMenuCheckoutService.ts';
import { bindNewMenuRazorpayOrder, abandonUnboundNewMenuCheckout, verifyAndSettleNewMenuPayment } from '../server/services/newMenuPaymentSafetyService.ts';
import { getMenuStockRemaining } from '../server/services/menuStockService.ts';

const start=new Date('2026-10-10T00:30:00Z');
const secret='fixture-only-secret';
const keyId='rzp_test_fixture';
const gateway='order_TEST12345678',payment='pay_TEST12345678';
const customer={name:'Fixture Customer',mobile:'9000000001',address:'Kollur mock address',latitude:17.485,longitude:78.235};
const request=(qty=4)=>({customer,lines:[{itemId:'idly',quantity:qty}]});
const signature=(gatewayId=gateway,paymentId=payment)=>crypto.createHmac('sha256',secret).update(gatewayId+'|'+paymentId).digest('hex');
const gatewayFetch=(id=payment,orderId=gateway,amount=12000,status='captured')=>vi.fn(async()=>({
  ok:true,json:async()=>({id,order_id:orderId,amount,currency:'INR',status,captured:status==='captured'}),
})) as unknown as typeof fetch;
async function setup():Promise<Client>{
  const db=createClient({url:':memory:'});
  for(const stmt of DB_SCHEMA.split(';').map(x=>x.trim()).filter(Boolean))await db.execute(stmt);
  return db;
}
const signed={keyId,keySecret:secret};
const input=(orderId:string)=>({orderId,providerPaymentId:payment,providerSignature:signature()});
describe('inactive new-menu payment and stock settlement safety',()=>{
  it('binds the gateway order once and refuses conflicting order IDs',async()=>{
    const db=await setup();try{
      const created=await createPendingNewMenuCheckout(db,request(),start);
      expect(await bindNewMenuRazorpayOrder(db,created.orderId,gateway,start.getTime())).toEqual({
        idempotent:false,expiresAtMs:created.expiresAtMs,
      });
      expect((await bindNewMenuRazorpayOrder(db,created.orderId,gateway,start.getTime())).idempotent).toBe(true);
      await expect(bindNewMenuRazorpayOrder(db,created.orderId,'order_OTHER1234567',start.getTime())).rejects.toThrow('another');
      expect((await db.execute('SELECT COUNT(*) AS n FROM payment_intents')).rows[0]?.n).toBe(1);
    }finally{db.close();}
  });
  it('confirms verified captured payment and ticket exactly once',async()=>{
    const db=await setup();try{
      const created=await createPendingNewMenuCheckout(db,request(),start);
      await bindNewMenuRazorpayOrder(db,created.orderId,gateway,start.getTime());
      const now=start.getTime()+60_000,fetcher=gatewayFetch();
      const first=await verifyAndSettleNewMenuPayment(db,input(created.orderId),now,signed,fetcher);
      expect(first.status).toBe('CONFIRMED');
      expect(first.idempotent).toBe(false);
      expect(first.ticketText).toContain('ఇడ్లీ');
      const again=await verifyAndSettleNewMenuPayment(db,input(created.orderId),now,signed,fetcher);
      expect(again).toMatchObject({status:'CONFIRMED',idempotent:true});
      const order=(await db.execute({sql:'SELECT payment_status,order_status,ticket_text FROM orders WHERE id=?',args:[created.orderId]})).rows[0];
      expect(order?.payment_status).toBe('PAID');
      expect(order?.order_status).toBe('TICKET_GENERATED');
      expect((await db.execute('SELECT COUNT(*) AS n FROM payments')).rows[0]?.n).toBe(1);
      expect(await getMenuStockRemaining(db,'idly','2026-10-10',now)).toBe(26);
      expect(fetcher).toHaveBeenCalledTimes(2);
    }finally{db.close();}
  });
  it('does not settle invalid signatures or gateway amounts',async()=>{
    const db=await setup();try{
      const created=await createPendingNewMenuCheckout(db,request(),start);
      await bindNewMenuRazorpayOrder(db,created.orderId,gateway,start.getTime());
      const fetcher=gatewayFetch();
      await expect(verifyAndSettleNewMenuPayment(db,{...input(created.orderId),providerSignature:'bad'},
        start.getTime()+60_000,signed,fetcher)).rejects.toThrow('signature');
      expect(fetcher).not.toHaveBeenCalled();
      await expect(verifyAndSettleNewMenuPayment(db,input(created.orderId),
        start.getTime()+60_000,signed,gatewayFetch(payment,gateway,11000))).rejects.toThrow('amount');
      expect((await db.execute('SELECT COUNT(*) AS n FROM payments')).rows[0]?.n).toBe(0);
    }finally{db.close();}
  });
  it('records captured late payment for manual review without paid status, ticket or confirmed stock',async()=>{
    const db=await setup();try{
      const created=await createPendingNewMenuCheckout(db,request(),start);
      await bindNewMenuRazorpayOrder(db,created.orderId,gateway,start.getTime());
      const late=created.expiresAtMs+10;
      const first=await verifyAndSettleNewMenuPayment(db,input(created.orderId),late,signed,gatewayFetch());
      expect(first).toMatchObject({status:'REVIEW_REQUIRED',idempotent:false});
      const again=await verifyAndSettleNewMenuPayment(db,input(created.orderId),late,signed,gatewayFetch());
      expect(again).toMatchObject({status:'REVIEW_REQUIRED',idempotent:true});
      const o=(await db.execute({sql:'SELECT payment_status,ticket_text FROM orders WHERE id=?',args:[created.orderId]})).rows[0];
      expect(o?.payment_status).toBe('PENDING');
      expect(o?.ticket_text).toBeNull();
      expect((await db.execute('SELECT status FROM payments')).rows[0]?.status).toBe('REVIEW_REQUIRED');
      expect((await db.execute('SELECT status FROM menu_stock_reservations')).rows[0]?.status).toBe('HELD');
    }finally{db.close();}
  });
  it('releases only unbound unpaid failed gateway setup and preserves order history',async()=>{
    const db=await setup();try{
      const created=await createPendingNewMenuCheckout(db,request(),start);
      expect(await abandonUnboundNewMenuCheckout(db,created.orderId,start.getTime())).toEqual({idempotent:false});
      expect(await abandonUnboundNewMenuCheckout(db,created.orderId,start.getTime())).toEqual({idempotent:true});
      const order=(await db.execute({sql:'SELECT payment_status FROM orders WHERE id=?',args:[created.orderId]})).rows[0];
      expect(order?.payment_status).toBe('FAILED');
      expect((await db.execute('SELECT status FROM menu_stock_reservations')).rows[0]?.status).toBe('RELEASED');
      expect((await db.execute('SELECT COUNT(*) AS n FROM orders')).rows[0]?.n).toBe(1);
    }finally{db.close();}
  });
});