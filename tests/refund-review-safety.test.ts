import 'express-async-errors';
import crypto from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createClient,type Client} from '@libsql/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {DB_SCHEMA} from '../server/db/schema.ts';
import {createExpressApp} from '../server/app.ts';
import {createRefundReviewCase,changeRefundReviewCase} from '../server/services/refundReviewService.ts';
import {validateRefundPage} from '../src/utils/refundReview.ts';
import type {AddressInfo} from 'node:net';
import type {Server} from 'node:http';

let db:Client;
vi.mock('../server/db/index.ts',()=>({
  getDb:()=>db,withDbRetry:async <T>(work:()=>Promise<T>)=>work(),
}));
const migration=readFileSync(fileURLToPath(new URL('../server/db/migrations/20261015_refund_review.sql',import.meta.url)),'utf8');
const now='2026-10-15T00:00:00.000Z';
let counter=0;
async function paidOrder(state:'PAID'|'PENDING'|'FAILED'='PAID', paymentStatus:'SUCCESS'|'REVIEW_REQUIRED'='SUCCESS') {
  const orderId='MENU-'+crypto.randomUUID();
  const paymentId='pay_'+crypto.randomBytes(12).toString('hex');
  const tokenHash=crypto.randomBytes(32).toString('hex');
  await db.execute({sql:`INSERT INTO orders (
    id,public_token_hash,created_at_utc,created_at_ist,delivery_date,delivery_window,
    total_items,jowar_unit_price_paisa,chapathi_unit_price_paisa,subtotal_paisa,delivery_charge_paisa,total_amount_paisa,
    currency,payment_status,order_status,payment_provider,provider_order_id,provider_payment_id,fulfillment_status,
    customer_name,customer_mobile,address,distance_km,created_by,updated_at,updated_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args:[orderId,tokenHash,now,now,'2026-10-16','07:00-11:00',4,3000,1000,12000,0,12000,
      'INR',state,state==='PAID'?'TICKET_GENERATED':'PENDING','razorpay','order_TEST1234567',
      state==='PAID'?paymentId:'AWAITING_PAYMENT','RECEIVED','Sensitive Customer','9000000001','Secret Address',1,'CUSTOMER',now,'SYSTEM'],
  });
  await db.execute({sql:`INSERT INTO payments
    (id,order_id,provider,provider_order_id,provider_payment_id,amount_paisa,currency,status,signature,raw_payload,verified_at,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args:['PAY-fixture-'+(++counter),orderId,'razorpay','order_TEST1234567',paymentId,12000,'INR',paymentStatus,
    'DO_NOT_EXPOSE_SIGNATURE','SECRET_GATEWAY_PAYLOAD',now,now,now]});
  return {orderId,paymentId};
}
async function login(role:'ADMIN'|'STAFF'){
  const userId='USR-'+crypto.randomUUID(),token=crypto.randomBytes(32).toString('hex');
  await db.execute({sql:`INSERT INTO admin_users (id,username,password_hash,role,name,created_at) VALUES (?,?,?,?,?,?)`,
    args:[userId,role+counter,'irrelevant',role,'Test',now]});
  await db.execute({sql:`INSERT INTO admin_sessions
    (id,session_token_hash,user_id,expires_at,created_at,user_agent,ip) VALUES (?,?,?,?,?,?,?)`,
    args:['SESS-'+crypto.randomUUID(),crypto.createHash('sha256').update(token).digest('hex'),userId,
      new Date(Date.now()+600_000).toISOString(),now,'tests','127.0.0.1']});
  return token;
}
async function withHttp(run:(base:string)=>Promise<void>){
  const app=createExpressApp();
  const server:Server=app.listen(0,'127.0.0.1');
  try{
    if(!server.listening)await new Promise<void>((ok,no)=>{server.once('listening',ok);server.once('error',no)});
    await run('http://127.0.0.1:'+(server.address() as AddressInfo).port);
  }finally{
    server.closeAllConnections();
    await new Promise<void>((ok,no)=>server.close(err=>err?no(err):ok()));
  }
}
const call=(base:string,token:string,path:string,method:'GET'|'POST'|'PATCH'='GET',body?:unknown)=>fetch(base+'/api/admin/refund-reviews'+path,{
  method,headers:{cookie:'admin_session='+token,'x-requested-with':'XMLHttpRequest',
    ...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),
});
const createBody=(orderId:string,reason='CUSTOMER_REQUEST')=>({orderId,reason,note:'Owner investigation required for this charge'});

beforeEach(async()=>{
  vi.stubEnv('NODE_ENV','test');
  vi.stubEnv('REFUND_REVIEW_ENABLED','true');
  vi.stubEnv('REFUND_REVIEW_SCHEMA_READY','true');
  db=createClient({url:':memory:'});
  await db.executeMultiple(DB_SCHEMA);
  await db.executeMultiple(migration);
});
afterEach(()=>{db.close();vi.unstubAllEnvs();vi.restoreAllMocks();});

describe('Stage 2G P0-B1 manual-only refund review with isolated DB',()=>{
  it('does not auto-register migration in startup schema; defaults to API disabled',async()=>{
    expect(DB_SCHEMA).not.toContain('refund_review_cases');
    vi.stubEnv('REFUND_REVIEW_ENABLED','false');
    const token=await login('ADMIN');
    await withHttp(async base=>{
      const blocked=await call(base,token,'?page=1');
      expect(blocked.status).toBe(503);
      expect((await blocked.json()).error.code).toBe('REFUND_REVIEW_NOT_ACTIVATED');
    });
    expect(Number((await db.execute('SELECT COUNT(*) n FROM refund_review_cases')).rows[0]?.n)).toBe(0);
  });

  it('rejects anonymous, STAFF and cross-site mutations before writing cases',async()=>{
    const {orderId}=await paidOrder();
    const staff=await login('STAFF'),admin=await login('ADMIN');
    await withHttp(async base=>{
      expect((await fetch(base+'/api/admin/refund-reviews')).status).toBe(401);
      expect((await call(base,staff,'?page=1')).status).toBe(403);
      const denied=await fetch(base+'/api/admin/refund-reviews/',{
        method:'POST',headers:{cookie:'admin_session='+admin,'sec-fetch-site':'cross-site',
        'content-type':'application/json'},body:JSON.stringify(createBody(orderId)),
      });
      expect(denied.status).toBe(403);
    });
    expect(Number((await db.execute('SELECT COUNT(*) n FROM refund_review_cases')).rows[0]?.n)).toBe(0);
  });

  it('creates one authoritative case; idempotent retries never duplicate events or touch financial history',async()=>{
    const {orderId,paymentId}=await paidOrder();
    const admin=await login('ADMIN');
    const before=await db.execute({sql:'SELECT payment_status,fulfillment_status,provider_payment_id FROM orders WHERE id=?',args:[orderId]});
    await withHttp(async base=>{
      const a=await call(base,admin,'/','POST',createBody(orderId));
      expect(a.status).toBe(201);
      const first=await a.json();
      expect(first.idempotent).toBe(false);
      expect(first.case).toMatchObject({orderId,providerPaymentId:paymentId,
        amountPaisa:12000,status:'NEEDS_REVIEW',version:1});
      const again=await call(base,admin,'/','POST',createBody(orderId));
      expect(again.status).toBe(200);
      expect((await again.json()).idempotent).toBe(true);
      const mismatch=await call(base,admin,'/','POST',createBody(orderId,'OTHER'));
      expect(mismatch.status).toBe(409);
      const listed=await call(base,admin,'?page=1');
      const page=validateRefundPage(await listed.json(),1);
      expect(page.pagination.total).toBe(1);
      expect(page.cases).toHaveLength(1);
      const raw=JSON.stringify(page);
      expect(raw).not.toMatch(/DO_NOT_EXPOSE_SIGNATURE|SECRET_GATEWAY_PAYLOAD|9000000001|Secret Address/);
      const history=await call(base,admin,'/'+first.case.id+'/history');
      expect((await history.json()).events).toHaveLength(1);
    });
    const after=await db.execute({sql:'SELECT payment_status,fulfillment_status,provider_payment_id FROM orders WHERE id=?',args:[orderId]});
    expect(after.rows[0]).toEqual(before.rows[0]);
    expect(Number((await db.execute({sql:'SELECT COUNT(*) n FROM payments WHERE order_id=?',args:[orderId]})).rows[0]?.n)).toBe(1);
    expect(Number((await db.execute('SELECT COUNT(*) n FROM refund_review_events')).rows[0]?.n)).toBe(1);
    expect(Number((await db.execute("SELECT COUNT(*) n FROM audit_logs WHERE action='REFUND_REVIEW_CASE_CREATED'")).rows[0]?.n)).toBe(1);
  });

  it('fails closed on missing/ambiguous payment evidence and financial mismatches',async()=>{
    const {orderId}=await paidOrder('PAID','REVIEW_REQUIRED');
    await expect(createRefundReviewCase(db,{...createBody(orderId),reason:'CUSTOMER_REQUEST',actor:'admin'}))
      .rejects.toMatchObject({code:'REFUND_REVIEW_CONFLICT'});
    const ambiguous=await paidOrder();
    await db.execute({sql:'UPDATE payments SET amount_paisa=10000 WHERE order_id=?',args:[ambiguous.orderId]});
    await expect(createRefundReviewCase(db,{orderId:ambiguous.orderId,reason:'OTHER',note:'Payment mismatch review',actor:'admin'}))
      .rejects.toMatchObject({code:'REFUND_REVIEW_CONFLICT'});
    expect(Number((await db.execute('SELECT COUNT(*) n FROM refund_review_cases')).rows[0]?.n)).toBe(0);
  });

  it('tracks versioned manual steps but never marks a refund verified or changes PAID',async()=>{
    const {orderId}=await paidOrder();
    const admin=await login('ADMIN');
    await withHttp(async base=>{
      const created=await (await call(base,admin,'/','POST',createBody(orderId))).json();
      const cid=created.case.id;
      const open=await call(base,admin,'/'+cid,'PATCH',{status:'IN_PROGRESS',note:'Refund payment being checked manually',expectedVersion:1});
      expect(open.status).toBe(200);
      expect((await open.json()).case.version).toBe(2);
      const stale=await call(base,admin,'/'+cid,'PATCH',{status:'CLOSED_NO_REFUND',note:'Wrong outdated version',expectedVersion:1});
      expect(stale.status).toBe(409);
      const fakeVerified=await call(base,admin,'/'+cid,'PATCH',{status:'REFUNDED',note:'Misleading verified refund',expectedVersion:2});
      expect(fakeVerified.status).toBe(400);
      const withoutId=await call(base,admin,'/'+cid,'PATCH',{status:'REFUND_REPORTED_UNVERIFIED',note:'External report received',expectedVersion:2});
      expect(withoutId.status).toBe(400);
      const reported=await call(base,admin,'/'+cid,'PATCH',{
        status:'REFUND_REPORTED_UNVERIFIED',note:'External Razorpay reference recorded; NOT provider verified',
        expectedVersion:2,reportedRefundId:'rfnd_FIXTURE12345',
      });
      expect(reported.status).toBe(200);
      expect((await reported.json()).case).toMatchObject({
        status:'REFUND_REPORTED_UNVERIFIED',reportedRefundId:'rfnd_FIXTURE12345',version:3,
      });
      expect((await call(base,admin,'/'+cid,'PATCH',{
        status:'CLOSED_NO_REFUND',note:'Cannot close reported case',expectedVersion:3
      })).status).toBe(409);
      const history=await (await call(base,admin,'/'+cid+'/history')).json();
      expect(history.events.map((e:{to:string})=>e.to)).toEqual([
        'NEEDS_REVIEW','IN_PROGRESS','REFUND_REPORTED_UNVERIFIED',
      ]);
    });
    expect((await db.execute({sql:'SELECT payment_status,fulfillment_status FROM orders WHERE id=?',args:[orderId]})).rows[0])
      .toMatchObject({payment_status:'PAID',fulfillment_status:'RECEIVED'});
    expect(Number((await db.execute('SELECT COUNT(*) n FROM refund_review_events')).rows[0]?.n)).toBe(3);
    expect(Number((await db.execute("SELECT COUNT(*) n FROM audit_logs WHERE action LIKE 'REFUND_REVIEW_%'")).rows[0]?.n)).toBe(3);
  });

  it('enforces external refund ID uniqueness and preserves both case histories',async()=>{
    const a=await paidOrder(),b=await paidOrder();
    const c1=await createRefundReviewCase(db,{...createBody(a.orderId),reason:'CUSTOMER_REQUEST',actor:'admin'});
    const c2=await createRefundReviewCase(db,{...createBody(b.orderId),reason:'CUSTOMER_REQUEST',actor:'admin'});
    for(const c of [c1,c2]){
      await changeRefundReviewCase(db,{caseId:c.case.id,expectedVersion:1,status:'IN_PROGRESS',note:'Checking payment details',actor:'admin'});
    }
    await changeRefundReviewCase(db,{caseId:c1.case.id,expectedVersion:2,status:'REFUND_REPORTED_UNVERIFIED',
      note:'Reported external refund, not verified',reportedRefundId:'rfnd_DUPLICATE1234',actor:'admin'});
    await expect(changeRefundReviewCase(db,{caseId:c2.case.id,expectedVersion:2,status:'REFUND_REPORTED_UNVERIFIED',
      note:'Must not duplicate reference',reportedRefundId:'rfnd_DUPLICATE1234',actor:'admin'})).rejects.toThrow();
    expect(Number((await db.execute("SELECT COUNT(*) n FROM refund_review_cases WHERE reported_refund_id='rfnd_DUPLICATE1234'")).rows[0]?.n)).toBe(1);
    expect(Number((await db.execute('SELECT COUNT(*) n FROM refund_review_events')).rows[0]?.n)).toBe(5);
  });
  it('P0-C provider verification denies anonymous/STAFF and remains OFF for ADMIN by default',async()=>{
    const admin=await login('ADMIN'),staff=await login('STAFF');
    const fakeId='RRC-'+ 'a'.repeat(24);
    const mk=(base:string,token:string)=>fetch(base+'/api/admin/refund-reviews/'+fakeId+'/verify',{
      method:'POST',
      headers:{cookie:'admin_session='+token,'x-requested-with':'XMLHttpRequest',
        'content-type':'application/json'},
      body:JSON.stringify({expectedVersion:1}),
    });
    await withHttp(async base=>{
      expect((await fetch(base+'/api/admin/refund-reviews/'+fakeId+'/verify',{
        method:'POST',headers:{'x-requested-with':'XMLHttpRequest','content-type':'application/json'},
        body:JSON.stringify({expectedVersion:1}),
      })).status).toBe(401);
      expect((await mk(base,staff)).status).toBe(403);
      const blocked=await mk(base,admin);
      expect(blocked.status).toBe(503);
      expect((await blocked.json()).error.code).toBe('REFUND_RECONCILIATION_NOT_ACTIVATED');
    });
  });

});
