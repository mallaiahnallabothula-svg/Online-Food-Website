/** P0-B2. Isolated libSQL/SQLite migration and recovery acceptance tests.
 * Never reads credentials, remote Turso, Vercel, or real Razorpay data. */
import { createClient, type Client } from '@libsql/client';
import { readFileSync, mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import crypto from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { DB_SCHEMA } from '../server/db/schema.ts';

const migration=readFileSync(fileURLToPath(new URL('../server/db/migrations/20261015_refund_review.sql', import.meta.url)), 'utf8');
const now='2026-10-15T05:00:00.000Z';

async function seed(db:Client) {
  const orderId='MENU-'+crypto.randomUUID();
  const paymentId='pay_'+crypto.randomBytes(10).toString('hex');
  await db.execute({sql:`INSERT INTO orders
    (id,public_token_hash,created_at_utc,created_at_ist,delivery_date,delivery_window,total_items,
     jowar_unit_price_paisa,chapathi_unit_price_paisa,subtotal_paisa,delivery_charge_paisa,
     total_amount_paisa,currency,payment_status,order_status,payment_provider,provider_order_id,
     provider_payment_id,fulfillment_status,customer_name,customer_mobile,address,
     distance_km,created_by,updated_at,updated_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args:[orderId,'hash-'+crypto.randomUUID(),now,now,'2026-10-16','07:00-11:00',4,
      3000,1000,12000,0,12000,'INR','PAID','TICKET_GENERATED','razorpay',
      'order_'+crypto.randomBytes(8).toString('hex'),paymentId,'RECEIVED','Fixture',
      '9000000001','Existing historical address',1,'CUSTOMER',now,'SYSTEM']});
  await db.execute({sql:`INSERT INTO payments
    (id,order_id,provider,provider_order_id,provider_payment_id,amount_paisa,currency,
     status,signature,raw_payload,verified_at,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args:['PAY-'+crypto.randomUUID(),orderId,'razorpay',null,paymentId,12000,'INR',
      'SUCCESS','unchanged-signature','unchanged-raw-payload',now,now,now]});
  await db.execute({sql:`INSERT INTO order_items
    (order_id,item_id,item_name_en,item_name_te,meal_period,sale_unit,pieces_per_unit,
     quantity,unit_price_paisa,line_total_paisa,created_at_utc)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    args:[orderId,'idly','Idly','ఇడ్లీ','MORNING','PLATE',4,4,3000,12000,now]});
  await db.execute({sql:`INSERT INTO menu_stock_reservations
    (order_id,item_id,delivery_date,quantity_plates,status,held_until_ms,created_at_utc,updated_at_utc)
    VALUES (?,?,?,?,?,?,?,?)`,
    args:[orderId,'idly','2026-10-16',4,'CONFIRMED',null,now,now]});
  await db.execute({sql:`INSERT INTO audit_logs
    (id,actor_type,actor_id,action,target_type,target_id,details,created_at)
    VALUES (?,'SYSTEM','GATEWAY','PAYMENT_VERIFIED','ORDER',?,?,?)`,
    args:['AUD-'+crypto.randomUUID(),orderId,'{"origin":"before-migration"}',now]});
  return {orderId,paymentId};
}
const oldTables=['orders','payments','order_items','menu_stock_reservations','audit_logs','payment_intents'];
async function snapshot(db:Client) {
  const out:Record<string,string>={};
  for(const table of oldTables){
    const result=await db.execute('SELECT * FROM '+table+' ORDER BY rowid');
    out[table]=JSON.stringify(result.rows);
  }
  return out;
}
async function count(db:Client,table:string) {
  const rows=await db.execute('SELECT COUNT(*) AS n FROM '+table);
  return Number(rows.rows[0]?.n??0);
}
async function addCase(db:Client,orderId:string,paymentId:string,opts:{
  id?:string;amount?:number;status?:string;reportedId?:string|null;currency?:string
}={}) {
  const cid=opts.id??'RRC-'+crypto.randomBytes(12).toString('hex');
  await db.execute({sql:`INSERT INTO refund_review_cases
    (id,order_id,provider_payment_id,amount_paisa,currency,reason,status,reported_refund_id,
     initial_note,created_by,updated_by,version,created_at_utc,updated_at_utc)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args:[cid,orderId,paymentId,opts.amount??12000,opts.currency??'INR','CUSTOMER_REQUEST',
      opts.status??'NEEDS_REVIEW',opts.reportedId??null,
      'Unverified manual case','owner','owner',1,now,now]});
  return cid;
}
async function inMemory(work:(db:Client)=>Promise<void>) {
  const db=createClient({url:':memory:'});
  try{await db.executeMultiple(DB_SCHEMA);await work(db)}finally{db.close()}
}
describe('Stage 2G P0-B2 manual refund ledger migration — isolated DB only',()=>{
  it('adds only the approved tables and indexes, preserving seeded order, payment, stock and historical audit rows',async()=>{
    await inMemory(async db=>{
      await seed(db);
      const before=await snapshot(db);
      const oldSql=await db.execute("SELECT name,sql FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%' ORDER BY name");
      expect(DB_SCHEMA).not.toContain('refund_review_cases');
      expect(migration).toMatch(/BEGIN IMMEDIATE;/);
      expect(migration).toMatch(/COMMIT;/);
      await db.executeMultiple(migration);
      expect(await snapshot(db)).toEqual(before);
      const afterSql=await db.execute("SELECT name,sql FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%' ORDER BY name");
      const added=new Set(afterSql.rows.map(row=>String(row.name)));
      for(const row of oldSql.rows)expect(added.has(String(row.name))).toBe(true);
      expect([...added].filter(name=>!oldSql.rows.some(row=>row.name===name)).sort()).toEqual([
        'idx_refund_review_cases_status','idx_refund_review_events_case',
        'refund_review_cases','refund_review_events',
        'sqlite_autoindex_refund_review_cases_1','sqlite_autoindex_refund_review_cases_2',
        'sqlite_autoindex_refund_review_cases_3','sqlite_autoindex_refund_review_cases_4',
        'sqlite_autoindex_refund_review_events_1','sqlite_autoindex_refund_review_events_2',
      ].sort().filter(x=>!x.startsWith('sqlite_')));
      expect(await count(db,'refund_review_cases')).toBe(0);
      expect(await count(db,'refund_review_events')).toBe(0);
    });
  });

  it('is safe to rerun and startup schema reruns cannot overwrite financial data or case audit history',async()=>{
    await inMemory(async db=>{
      const {orderId,paymentId}=await seed(db);
      await db.executeMultiple(migration);
      const caseId=await addCase(db,orderId,paymentId);
      await db.execute({sql:`INSERT INTO refund_review_events
        (id,case_id,event_type,from_status,to_status,note,actor_id,version,created_at_utc)
        VALUES (?,?,'CASE_CREATED',NULL,'NEEDS_REVIEW',?,?,1,?)`,
        args:['RRE-'+crypto.randomUUID(),caseId,'Original audit','owner',now]});
      const before=await snapshot(db);
      await db.executeMultiple(migration);
      await db.executeMultiple(DB_SCHEMA);
      await db.executeMultiple(migration);
      expect(await snapshot(db)).toEqual(before);
      expect(await count(db,'refund_review_cases')).toBe(1);
      expect(await count(db,'refund_review_events')).toBe(1);
      expect((await db.execute('SELECT status,version FROM refund_review_cases')).rows[0])
        .toMatchObject({status:'NEEDS_REVIEW',version:1});
    });
  });

  it('enforces unique order, payment, reported refund ID, event version, status and amount constraints',async()=>{
    await inMemory(async db=>{
      const a=await seed(db),b=await seed(db);
      await db.executeMultiple(migration);
      const aId=await addCase(db,a.orderId,a.paymentId,{
        status:'REFUND_REPORTED_UNVERIFIED',reportedId:'rfnd_DUPLICATE12345'});
      await expect(addCase(db,a.orderId,b.paymentId)).rejects.toThrow();
      await expect(addCase(db,b.orderId,a.paymentId)).rejects.toThrow();
      await expect(addCase(db,b.orderId,b.paymentId,{
        status:'REFUND_REPORTED_UNVERIFIED',reportedId:'rfnd_DUPLICATE12345'})).rejects.toThrow();
      await expect(addCase(db,b.orderId,b.paymentId,{amount:0})).rejects.toThrow();
      await expect(addCase(db,b.orderId,b.paymentId,{currency:'USD'})).rejects.toThrow();
      await expect(addCase(db,b.orderId,b.paymentId,{status:'REFUNDED'})).rejects.toThrow();
      await expect(addCase(db,b.orderId,b.paymentId,{status:'REFUND_REPORTED_UNVERIFIED'})).rejects.toThrow();
      await db.execute({sql:`INSERT INTO refund_review_events
        (id,case_id,event_type,from_status,to_status,note,actor_id,version,created_at_utc)
        VALUES (?,?,'CASE_CREATED',NULL,'NEEDS_REVIEW',?,?,1,?)`,
        args:['RRE-'+crypto.randomUUID(),aId,'Original','owner',now]});
      await expect(db.execute({sql:`INSERT INTO refund_review_events
        (id,case_id,event_type,from_status,to_status,note,actor_id,version,created_at_utc)
        VALUES (?,?,'STATUS_CHANGED','NEEDS_REVIEW','IN_PROGRESS',?,?,1,?)`,
        args:['RRE-'+crypto.randomUUID(),aId,'Replay','owner',now]})).rejects.toThrow();
      expect(await count(db,'refund_review_cases')).toBe(1);
      expect(await count(db,'refund_review_events')).toBe(1);
      expect((await db.execute('PRAGMA integrity_check')).rows[0]?.integrity_check).toBe('ok');
    });
  });

  it('rolls back a deliberately broken migration before new tables can persist; clean retry works',async()=>{
    await inMemory(async db=>{
      await seed(db);
      const before=await snapshot(db);
      const injected=migration.replace('CREATE TABLE IF NOT EXISTS refund_review_events (',
        'INSERT INTO migration_failure_fixture_missing_table VALUES (1);\nCREATE TABLE IF NOT EXISTS refund_review_events (');
      expect(injected).not.toBe(migration);
      await expect(db.executeMultiple(injected)).rejects.toThrow();
      await db.execute('ROLLBACK').catch(()=>{});
      const newTables=await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'refund_review_%'");
      expect(newTables.rows).toHaveLength(0);
      expect(await snapshot(db)).toEqual(before);
      await db.executeMultiple(migration);
      expect(await count(db,'refund_review_cases')).toBe(0);
      expect(await snapshot(db)).toEqual(before);
    });
  });

  it('restores a closed, isolated file-backed database copy after migration without deleting original financial records',async()=>{
    const dir=mkdtempSync(join(tmpdir(),'mannus-refund-p0b2-'));
    const path=join(dir,'isolated.sqlite'),backup=join(dir,'isolated.backup.sqlite');
    let db:Client|null=null;
    try{
      db=createClient({url:'file:'+path});
      await db.executeMultiple(DB_SCHEMA);
      await seed(db);
      const before=await snapshot(db);
      db.close();db=null;
      copyFileSync(path,backup);
      db=createClient({url:'file:'+path});
      await db.executeMultiple(migration);
      expect(await count(db,'refund_review_cases')).toBe(0);
      db.close();db=null;
      copyFileSync(backup,path);
      db=createClient({url:'file:'+path});
      const rows=await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='refund_review_cases'");
      expect(rows.rows).toHaveLength(0);
      expect(await snapshot(db)).toEqual(before);
      await db.executeMultiple(migration);
      expect(await count(db,'refund_review_cases')).toBe(0);
      expect(await snapshot(db)).toEqual(before);
    }finally{db?.close();rmSync(dir,{recursive:true,force:true})}
  });
});
