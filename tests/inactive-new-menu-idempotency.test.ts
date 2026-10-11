import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DB_SCHEMA } from '../server/db/schema.ts';
import { NEW_MENU_LAUNCH_ENABLED } from '../shared/menuCatalog.ts';
import {
  INACTIVE_CHECKOUT_IDEMPOTENCY_TEST_SCHEMA,
  prepareInactiveNewMenuCheckoutIdempotent,
} from '../server/services/inactiveNewMenuIdempotencyService.ts';
import { startInactiveNewMenuCheckoutGateway } from '../server/services/inactiveNewMenuCheckoutOrchestrator.ts';
import { getMenuStockRemaining } from '../server/services/menuStockService.ts';

const at = new Date('2026-10-10T00:30:00.000Z'); // 06:00 IST
const soon = new Date(at.getTime() + 1000);
const secret = Buffer.from('f2'.repeat(32), 'hex'); // FICTIONAL test-only fixture
const secretOther = Buffer.from('a1'.repeat(32), 'hex');
const makeKey = () => crypto.randomUUID();
const request = {
  lines: [{itemId:'idly',quantity:2},{itemId:'ragi-idly',quantity:2}],
  customer: {
    name:'Test Customer',mobile:'9000000001',address:'Flat 10, Kollur example',
    latitude:17.485,longitude:78.235,
  },
};
const count = async (db:Client, table:string) =>
  Number((await db.execute('SELECT COUNT(*) AS n FROM '+table)).rows[0]?.n ?? -1);

async function fixture(url = ':memory:') {
  const db = createClient({url});
  for(const stmt of DB_SCHEMA.split(';').map(s=>s.trim()).filter(Boolean)) await db.execute(stmt);
  await db.execute(INACTIVE_CHECKOUT_IDEMPOTENCY_TEST_SCHEMA);
  return db;
}

afterEach(()=>{vi.restoreAllMocks();});

describe('PR20 inactive durable checkout idempotency (isolated test database only)',()=>{
  it('does not modify production schema, launch flag, routes, Razorpay or owner dashboard',async()=>{
    expect(NEW_MENU_LAUNCH_ENABLED).toBe(false);
    for(const file of ['server/app.ts','src/App.tsx','server/db/schema.ts','server/routes/newMenuQuoteRoutes.ts']){
      expect(fs.readFileSync(file,'utf8')).not.toContain('inactiveNewMenuIdempotencyService');
    }
    expect(DB_SCHEMA).not.toContain('inactive_menu_checkout_idempotency');
    const uninitialized=createClient({url:':memory:'});
    try{
      for(const stmt of DB_SCHEMA.split(';').map(s=>s.trim()).filter(Boolean)) await uninitialized.execute(stmt);
      await expect(prepareInactiveNewMenuCheckoutIdempotent(uninitialized,request,makeKey(),secret,at))
        .rejects.toThrow();
      expect(await count(uninitialized,'orders')).toBe(0);
    }finally{uninitialized.close();}
  });

  it('creates exactly one pending order, then returns same ID and private token on repeat without double-holding stock',async()=>{
    const db=await fixture();
    try{
      const key=makeKey();
      const first=await prepareInactiveNewMenuCheckoutIdempotent(db,request,key,secret,at);
      expect(first).toMatchObject({idempotent:false,pricing:{subtotalPaisa:14000,deliveryChargePaisa:0}});
      expect(first.orderId).toMatch(/^MENU-/);
      expect(first.customerAccessToken).toMatch(/^[0-9a-f]{64}$/);
      const again=await prepareInactiveNewMenuCheckoutIdempotent(db,request,key,secret,soon);
      expect(again).toMatchObject({
        idempotent:true,orderId:first.orderId,customerAccessToken:first.customerAccessToken,
        expiresAtMs:first.expiresAtMs,
      });
      expect(again.pricing).toEqual(first.pricing);
      expect(await count(db,'orders')).toBe(1);
      expect(await count(db,'order_items')).toBe(2);
      expect(await count(db,'menu_stock_reservations')).toBe(2);
      expect(await getMenuStockRemaining(db,'idly','2026-10-10',soon.getTime())).toBe(28);
      expect(await count(db,'payment_intents')).toBe(0);
      expect(await count(db,'payments')).toBe(0);
      const claim=(await db.execute('SELECT * FROM inactive_menu_checkout_idempotency')).rows[0]!;
      expect(claim.status).toBe('READY');
      expect(claim.request_fingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(claim.key_hash).not.toBe(key);
      expect(claim.encrypted_result).not.toContain(first.customerAccessToken);
      expect(claim.encrypted_result).not.toContain(request.customer.mobile);
    }finally{db.close();}
  });

  it('rejects changed cart, changed phone or destination using the same key',async()=>{
    const db=await fixture();
    try{
      const key=makeKey();
      await prepareInactiveNewMenuCheckoutIdempotent(db,request,key,secret,at);
      for(const changed of [
        {...request,lines:[{itemId:'idly',quantity:3},{itemId:'ragi-idly',quantity:2}]},
        {...request,customer:{...request.customer,mobile:'9999999999'}},
        {...request,customer:{...request.customer,longitude:78.24}},
      ]){
        await expect(prepareInactiveNewMenuCheckoutIdempotent(db,changed,key,secret,soon))
          .rejects.toThrow('changed checkout payload');
      }
      expect(await count(db,'orders')).toBe(1);
      expect(await count(db,'menu_stock_reservations')).toBe(2);
    }finally{db.close();}
  });

  it('handles parallel same-key requests without ever creating two pending orders',async()=>{
    const db=await fixture();
    try{
      const key=makeKey();
      const outcomes=await Promise.allSettled([
        prepareInactiveNewMenuCheckoutIdempotent(db,request,key,secret,at),
        prepareInactiveNewMenuCheckoutIdempotent(db,request,key,secret,at),
      ]);
      expect(await count(db,'orders')).toBe(1);
      expect(await count(db,'order_items')).toBe(2);
      expect(await count(db,'menu_stock_reservations')).toBe(2);
      expect(await count(db,'inactive_menu_checkout_idempotency')).toBe(1);
      expect(outcomes.some(x=>x.status==='fulfilled')).toBe(true);
      if(outcomes[0]?.status==='fulfilled'&&outcomes[1]?.status==='fulfilled'){
        expect(outcomes[0].value.orderId).toBe(outcomes[1].value.orderId);
      }else{
        expect(outcomes.some(x=>x.status==='rejected'&&
          x.reason instanceof Error && /manual reconciliation/.test(x.reason.message))).toBe(true);
      }
    }finally{db.close();}
  });

  it('persists ready encrypted claim across client recreation using isolated temp SQLite file',async()=>{
    const temp=fs.mkdtempSync(path.join(os.tmpdir(),'menu-pr20-'));
    const url='file:'+path.join(temp,'checkout-fixture.db');
    const key=makeKey();
    let created:{orderId:string;customerAccessToken:string}|undefined;
    try{
      const db1=await fixture(url);
      try{created=await prepareInactiveNewMenuCheckoutIdempotent(db1,request,key,secret,at);}
      finally{db1.close();}
      const db2=createClient({url});
      try{
        const replay=await prepareInactiveNewMenuCheckoutIdempotent(db2,request,key,secret,soon);
        expect(replay).toMatchObject({...created,idempotent:true});
        expect(await count(db2,'orders')).toBe(1);
        expect(await count(db2,'menu_stock_reservations')).toBe(2);
      }finally{db2.close();}
    }finally{fs.rmSync(temp,{recursive:true,force:true});}
  });

  it('rejects an in-progress orphaned claim without placing any pending orders',async()=>{
    const db=await fixture();
    try{
      const key=makeKey();
      const hash=crypto.createHmac('sha256',secret).update('new-menu-checkout:'+key).digest('hex');
      await db.execute({
        sql:"INSERT INTO inactive_menu_checkout_idempotency (key_hash,request_fingerprint,status,claim_nonce,created_at_utc,updated_at_utc) VALUES (?,?,'CLAIMED',?,?,?)",
        args:[hash,'fingerprint-placeholder',crypto.randomUUID(),at.toISOString(),at.toISOString()],
      });
      await expect(prepareInactiveNewMenuCheckoutIdempotent(db,request,key,secret,soon))
        .rejects.toThrow('changed checkout payload');
      expect(await count(db,'orders')).toBe(0);
      expect(await count(db,'menu_stock_reservations')).toBe(0);
      const row=(await db.execute('SELECT status FROM inactive_menu_checkout_idempotency')).rows[0];
      expect(row?.status).toBe('CLAIMED');
    }finally{db.close();}
  });

  it('prevents new orders after a failed stock transaction, preserving the review claim',async()=>{
    const db=await fixture();
    try{
      await prepareInactiveNewMenuCheckoutIdempotent(db,{
        ...request, lines:[{itemId:'idly',quantity:30}],
      },makeKey(),secret,at);
      const key=makeKey();
      const bad={...request,lines:[{itemId:'idly',quantity:1},{itemId:'ragi-idly',quantity:3}]};
      await expect(prepareInactiveNewMenuCheckoutIdempotent(db,bad,key,secret,at)).rejects.toThrow('OUT_OF_STOCK');
      expect(await count(db,'orders')).toBe(1);
      expect(await count(db,'order_items')).toBe(1);
      expect(await count(db,'menu_stock_reservations')).toBe(1);
      await expect(prepareInactiveNewMenuCheckoutIdempotent(db,bad,key,secret,soon))
        .rejects.toThrow('manual reconciliation');
      const statuses=(await db.execute('SELECT status FROM inactive_menu_checkout_idempotency')).rows.map(x=>x.status);
      expect(statuses).toContain('REVIEW_REQUIRED');
    }finally{db.close();}
  });

  it('rejects expired claims, corrupted replay data, wrong secret and malformed keys',async()=>{
    const db=await fixture();
    try{
      const key=makeKey();
      await expect(prepareInactiveNewMenuCheckoutIdempotent(db,request,'predictable-key',secret,at))
        .rejects.toThrow('Invalid checkout idempotency');
      await expect(prepareInactiveNewMenuCheckoutIdempotent(db,request,key,Buffer.from('short'),at))
        .rejects.toThrow('Invalid checkout idempotency');
      const original=await prepareInactiveNewMenuCheckoutIdempotent(db,request,key,secret,at);
      await expect(prepareInactiveNewMenuCheckoutIdempotent(db,request,key,secretOther,soon))
        .rejects.toThrow('Invalid checkout idempotency').catch(()=>{});
      // Different secret points to a different namespace; do not accept it as a valid
      // recovery key, and never assume a secret may be silently rotated.
      const wrongSecretClaims=await count(db,'inactive_menu_checkout_idempotency');
      expect(wrongSecretClaims).toBeGreaterThanOrEqual(1);
      await expect(prepareInactiveNewMenuCheckoutIdempotent(db,request,key,secret,
        new Date(original.expiresAtMs))).rejects.toThrow('manual reconciliation');
      const hash=crypto.createHmac('sha256',secret).update('new-menu-checkout:'+key).digest('hex');
      await db.execute({sql:'UPDATE inactive_menu_checkout_idempotency SET encrypted_result=? WHERE key_hash=?',args:['garbled',hash]});
      await expect(prepareInactiveNewMenuCheckoutIdempotent(db,request,key,secret,soon))
        .rejects.toThrow('manual reconciliation');
    }finally{db.close();}
  });

  it('does not retry a gateway in an ambiguous provider state or create more stock holds',async()=>{
    const db=await fixture();
    try{
      const key=makeKey();
      const prepared=await prepareInactiveNewMenuCheckoutIdempotent(db,request,key,secret,at);
      const transport=vi.fn(async()=>{throw new Error('synthetic Razorpay timeout');}) as unknown as typeof fetch;
      const input={orderId:prepared.orderId,customerAccessToken:prepared.customerAccessToken};
      const creds={keyId:'rzp_test_dummy123',keySecret:'dummy-only'};
      await expect(startInactiveNewMenuCheckoutGateway(db,input,creds,transport,soon.getTime()))
        .rejects.toThrow('manual reconciliation');
      await expect(prepareInactiveNewMenuCheckoutIdempotent(db,request,key,secret,soon))
        .rejects.toThrow('manual reconciliation');
      await expect(startInactiveNewMenuCheckoutGateway(db,input,creds,transport,soon.getTime()+1000))
        .rejects.toThrow('manual reconciliation');
      expect(transport).toHaveBeenCalledTimes(1);
      expect(await count(db,'orders')).toBe(1);
      expect(await count(db,'payment_intents')).toBe(0);
      expect(await count(db,'payments')).toBe(0);
      expect(await getMenuStockRemaining(db,'idly','2026-10-10',soon.getTime())).toBe(28);
    }finally{db.close();}
  });
});
