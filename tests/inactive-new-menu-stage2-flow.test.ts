import crypto from 'node:crypto';
import fs from 'node:fs';
import express from 'express';
import { createClient, type Client } from '@libsql/client';
import type { AddressInfo } from 'node:net';
import { describe, expect, it, vi } from 'vitest';
import { DB_SCHEMA } from '../server/db/schema.ts';
import { NEW_MENU_LAUNCH_ENABLED } from '../shared/menuCatalog.ts';
import {
  createInactiveNewMenuStage2Router, INACTIVE_CHECKOUT_IDEMPOTENCY_TEST_SCHEMA,
} from '../server/routes/inactiveNewMenuStage2Routes.ts';
import {
  buildStage2CheckoutRequest, InactiveMenuStage2Client,
} from '../src/utils/inactiveNewMenuStage2Client.ts';
import { createExpressApp } from '../server/app.ts';

const createdAt = new Date('2026-10-10T00:30:00.000Z');
const gatewayId = 'order_STAGE2TEST12345';
const paymentId = 'pay_STAGE2TEST12345';
const credentials = {keyId:'rzp_test_stage2fixture',keySecret:'stage2-fixture-secret'};
const idempotencySecret = Buffer.alloc(32, 8);
const customer = {
  name:'Staging Customer',mobile:'9000000001',
  address:'Kollur 1st floor staging flat',latitude:17.485,longitude:78.235,
};
const cart = buildStage2CheckoutRequest([
  {itemId:'idly',quantity:2},{itemId:'ragi-idly',quantity:2},
],customer);

async function fixture() {
  const db = createClient({url:':memory:'});
  for(const statement of DB_SCHEMA.split(';').map(s=>s.trim()).filter(Boolean)) {
    await db.execute(statement);
  }
  await db.execute(INACTIVE_CHECKOUT_IDEMPOTENCY_TEST_SCHEMA);
  return db;
}
async function count(db: Client, table:'orders'|'order_items'|'payments'|'payment_intents'|'menu_stock_reservations') {
  return Number((await db.execute('SELECT COUNT(*) AS n FROM '+table)).rows[0]?.n ?? -1);
}
async function withHttp(app: ReturnType<typeof express>, work:(base:string)=>Promise<void>) {
  const server=app.listen(0,'127.0.0.1');
  try {
    await new Promise<void>((resolve,reject)=>{
      if(server.listening)return resolve();
      server.once('listening',resolve);server.once('error',reject);
    });
    await work('http://127.0.0.1:'+String((server.address() as AddressInfo).port));
  }finally{
    server.closeAllConnections();
    await new Promise<void>((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
  }
}

function paymentSignature() {
  return crypto.createHmac('sha256',credentials.keySecret)
    .update(gatewayId+'|'+paymentId).digest('hex');
}
function gateway() {
  const create=vi.fn(async(_url:string,init?:RequestInit)=>{
    const body=JSON.parse(String(init?.body));
    return {ok:true,status:200,json:async()=>({
      id:gatewayId,receipt:body.receipt,amount:body.amount,
      amount_due:body.amount,amount_paid:0,currency:'INR',status:'created',
    })};
  });
  const captured=vi.fn(async()=>({
    ok:true,status:200,json:async()=>({
      id:paymentId,order_id:gatewayId,amount:14000,
      currency:'INR',status:'captured',captured:true,
    }),
  }));
  return {create,captured};
}
async function harness(db:Client, state:{now:Date}, mocks:ReturnType<typeof gateway>) {
  const app=express();app.use(express.json());
  app.use('/staging',createInactiveNewMenuStage2Router({
    db,idempotencySecret,credentials,
    gatewayOrderTransport:mocks.create as unknown as typeof fetch,
    capturedPaymentTransport:mocks.captured as unknown as typeof fetch,
    now:()=>state.now,
    isAuthorizedOwner:req=>req.get('x-test-owner')==='test-owner-authorized',
  }));
  return app;
}
async function invoke(base:string, path:string, data:unknown, headers:Record<string,string>={}) {
  const res=await fetch(base+'/staging'+path,{
    method:'POST',headers:{'content-type':'application/json','x-menu-checkout':'1',...headers},
    body:JSON.stringify(data),
  });
  return {status:res.status,body:await res.json()};
}

describe('PR22 consolidated inactive stage 2 (no live routes or production DB)',()=>{
  it('leaves the real app, launch flag, legacy checkout and owner routes untouched',async()=>{
    expect(NEW_MENU_LAUNCH_ENABLED).toBe(false);
    for(const path of ['server/app.ts','server/db/schema.ts','src/App.tsx',
      'src/components/PaymentModal.tsx','src/components/OwnerPortal/OwnerDashboard.tsx']){
      expect(fs.readFileSync(path,'utf8')).not.toContain('inactiveNewMenuStage2Routes');
    }
    const app=createExpressApp();
    await withHttp(app,async base=>{
      expect((await fetch(base+'/api/health')).status).toBe(200);
      expect((await fetch(base+'/staging/quote',{method:'POST'})).status).toBe(404);
      expect((await fetch(base+'/api/menu/prepare',{method:'POST'})).status).toBe(404);
    });
  });

  it('quotes then prepares once; same UUID replay never duplicates order or stock',async()=>{
    const db=await fixture();
    try{
      const state={now:createdAt},mocks=gateway(),app=await harness(db,state,mocks);
      await withHttp(app,async base=>{
        const send=(path:string,payload:unknown)=>invoke(base,path,payload).then(r=>{
          if(r.status!==200)throw new Error(String(r.body.error?.code));
          return r.body;
        });
        const client=new InactiveMenuStage2Client(send);
        const quote=await client.quote(cart) as any;
        expect(quote.quote.totalAmountPaisa).toBe(14000);
        expect(quote.quote.items[0].remainingEstimate).toBe(30);
        expect(quote.stockReserved).toBe(false);
        const key=crypto.randomUUID();
        const first=await client.prepare(cart,key) as any;
        const repeat=await client.prepare(cart,key) as any;
        expect(first.checkout.orderId).toBe(repeat.checkout.orderId);
        expect(first.checkout.customerAccessToken).toBe(repeat.checkout.customerAccessToken);
        expect(repeat.checkout.idempotent).toBe(true);
        expect(await count(db,'orders')).toBe(1);
        expect(await count(db,'order_items')).toBe(2);
        expect(await count(db,'menu_stock_reservations')).toBe(2);
        expect(await count(db,'payments')).toBe(0);
        expect(mocks.create).not.toHaveBeenCalled();
        const changed=await invoke(base,'/prepare',{
          request:{...cart,lines:[{itemId:'idly',quantity:4}]},requestKey:key,
        });
        expect(changed.status).toBe(409);
      });
    }finally{db.close();}
  });

  it('full mock flow confirms exactly once, owner sees saved line items, private token tracks status',async()=>{
    const db=await fixture();
    try{
      const state={now:createdAt},mocks=gateway(),app=await harness(db,state,mocks);
      await withHttp(app,async base=>{
        const key=crypto.randomUUID();
        const {body:{checkout}}=await invoke(base,'/prepare',{request:cart,requestKey:key});
        expect(checkout.totalAmountPaisa).toBe(14000);
        state.now=new Date(createdAt.getTime()+60_000);
        const started=await invoke(base,'/gateway',{
          orderId:checkout.orderId,customerAccessToken:checkout.customerAccessToken,
        });
        expect(started.status).toBe(200);
        expect(started.body.gateway.amountPaisa).toBe(14000);
        expect(mocks.create).toHaveBeenCalledTimes(1);
        const again=await invoke(base,'/gateway',{
          orderId:checkout.orderId,customerAccessToken:checkout.customerAccessToken,
        });
        expect(again.body.gateway.idempotent).toBe(true);
        expect(mocks.create).toHaveBeenCalledTimes(1);
        const unauthorized=await invoke(base,'/confirm',{
          orderId:checkout.orderId,customerAccessToken:'f'.repeat(64),
          providerPaymentId:paymentId,providerSignature:paymentSignature(),
        });
        expect(unauthorized.status).toBe(403);
        expect(mocks.captured).not.toHaveBeenCalled();
        const settled=await invoke(base,'/confirm',{
          orderId:checkout.orderId,customerAccessToken:checkout.customerAccessToken,
          providerPaymentId:paymentId,providerSignature:paymentSignature(),
        });
        expect(settled.status).toBe(200);
        expect(settled.body.settlement.status).toBe('CONFIRMED');
        const duplicate=await invoke(base,'/confirm',{
          orderId:checkout.orderId,customerAccessToken:checkout.customerAccessToken,
          providerPaymentId:paymentId,providerSignature:paymentSignature(),
        });
        expect(duplicate.body.settlement.idempotent).toBe(true);
        expect(await count(db,'payments')).toBe(1);
        const denied=await invoke(base,'/owner/order',{orderId:checkout.orderId});
        expect(denied.status).toBe(403);
        const owner=await invoke(base,'/owner/order',{orderId:checkout.orderId},{
          'x-test-owner':'test-owner-authorized',
        });
        expect(owner.status).toBe(200);
        expect(owner.body.order.ticketStatus).toBe('READY');
        expect(owner.body.order.lines.map((line:any)=>line.itemId)).toEqual(['idly','ragi-idly']);
        expect(owner.body.order.ticketText).toContain('రాగి');
        const wrongTrack=await invoke(base,'/track',{customerAccessToken:'a'.repeat(64)});
        expect(wrongTrack.status).toBe(404);
        const tracking=await invoke(base,'/track',{customerAccessToken:checkout.customerAccessToken});
        expect(tracking.status).toBe(200);
        expect(tracking.body.order.paymentStatus).toBe('PAID');
        expect(tracking.body.order.fulfillmentStatus).toBe('RECEIVED');
        expect(tracking.body.order.items).toHaveLength(2);
        expect(tracking.body.order.customer.mobile).not.toBe(customer.mobile);
        expect(JSON.stringify(tracking.body)).not.toContain(credentials.keySecret);
      });
    }finally{db.close();}
  });

  it('captured payment after expiry is REVIEW_REQUIRED and never shown as paid',async()=>{
    const db=await fixture();
    try{
      const state={now:createdAt},mocks=gateway(),app=await harness(db,state,mocks);
      await withHttp(app,async base=>{
        const {body:{checkout}}=await invoke(base,'/prepare',{request:cart,requestKey:crypto.randomUUID()});
        state.now=new Date(createdAt.getTime()+1000);
        expect((await invoke(base,'/gateway',{
          orderId:checkout.orderId,customerAccessToken:checkout.customerAccessToken,
        })).status).toBe(200);
        state.now=new Date(checkout.expiresAtMs+1000);
        const late=await invoke(base,'/confirm',{
          orderId:checkout.orderId,customerAccessToken:checkout.customerAccessToken,
          providerPaymentId:paymentId,providerSignature:paymentSignature(),
        });
        expect(late.status).toBe(200);
        expect(late.body.settlement.status).toBe('REVIEW_REQUIRED');
        const track=await invoke(base,'/track',{customerAccessToken:checkout.customerAccessToken});
        expect(track.body.order.paymentStatus).toBe('PENDING');
        expect(track.body.order.ticketText).toBeNull();
        expect(await count(db,'payments')).toBe(1);
      });
    }finally{db.close();}
  });

  it('invalid payloads and changed prices are rejected before persistence or gateway access',async()=>{
    expect(()=>buildStage2CheckoutRequest([{itemId:'idly',quantity:1}],customer)).toThrow('Minimum');
    expect(()=>buildStage2CheckoutRequest([{itemId:'idly',quantity:4},{itemId:'pulka',quantity:1}],customer)).toThrow('mixed');
    expect(()=>buildStage2CheckoutRequest([{itemId:'idly',quantity:4}],{...customer,latitude:NaN})).toThrow('coordinates');
    const db=await fixture();
    try{
      const state={now:createdAt},mocks=gateway(),app=await harness(db,state,mocks);
      await withHttp(app,async base=>{
        expect((await invoke(base,'/quote',{...cart,clientTotalPaisa:1})).status).toBe(400);
        expect((await invoke(base,'/prepare',{request:{...cart,clientPrice:1},requestKey:crypto.randomUUID()})).status).toBe(400);
        expect((await invoke(base,'/gateway',{orderId:'wrong',customerAccessToken:'x'})).status).toBe(400);
        expect(await count(db,'orders')).toBe(0);
        expect(mocks.create).not.toHaveBeenCalled();
      });
    }finally{db.close();}
  });
});
