import crypto from 'node:crypto';
import {createClient,type Client} from '@libsql/client';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {DB_SCHEMA} from '../server/db/schema.ts';
import {createRefundReviewCase,changeRefundReviewCase} from '../server/services/refundReviewService.ts';
import {verifyReportedRefund} from '../server/services/refundReconciliationService.ts';

const migration=readFileSync(fileURLToPath(new URL('../server/db/migrations/20261015_refund_review.sql',import.meta.url)),'utf8');
let db:Client;
const date='2026-10-15T05:00:00.000Z';
let caseId='',payId='',refId='rfnd_TEST123456';
const orderId='MENU-12345678-1234-4123-8123-123456789abc';
function gateway(fields:Record<string,unknown>={},status=200) {
  const payload={entity:'refund',id:refId,payment_id:payId,amount:12000,
    currency:'INR',status:'processed',...fields};
  const mock=vi.fn(async()=>new Response(JSON.stringify(payload),{status}));
  return mock as unknown as typeof fetch;
}
beforeEach(async()=>{
  vi.stubEnv('RAZORPAY_KEY_ID','rzp_test_safefixture');
  vi.stubEnv('RAZORPAY_KEY_SECRET','test-secret-only');
  vi.stubEnv('REFUND_RECONCILIATION_ENABLED','true');
  db=createClient({url:':memory:'});
  await db.executeMultiple(DB_SCHEMA);
  await db.executeMultiple(migration);
  payId='pay_'+crypto.randomBytes(10).toString('hex');
  await db.execute({sql:`INSERT INTO orders
    (id,public_token_hash,created_at_utc,created_at_ist,delivery_date,delivery_window,
     total_items,jowar_unit_price_paisa,chapathi_unit_price_paisa,subtotal_paisa,
     delivery_charge_paisa,total_amount_paisa,currency,payment_status,order_status,
     payment_provider,provider_order_id,provider_payment_id,fulfillment_status,
     customer_name,customer_mobile,address,distance_km,created_by,updated_at,updated_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args:[orderId,'private-fixture-'+crypto.randomUUID(),date,date,'2026-10-16','07:00-11:00',
      4,3000,1000,12000,0,12000,'INR','PAID','TICKET_GENERATED','razorpay',
      'order_TEST123456',payId,'RECEIVED','Test Name','9000000001','Private Address',1,
      'CUSTOMER',date,'SYSTEM']});
  await db.execute({sql:`INSERT INTO payments
    (id,order_id,provider,provider_order_id,provider_payment_id,amount_paisa,currency,
    status,signature,raw_payload,verified_at,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args:['PAY-'+crypto.randomUUID(),orderId,'razorpay','order_TEST123456',payId,
      12000,'INR','SUCCESS','signature-secret','gateway-payload-secret',date,date,date]});
  const created=await createRefundReviewCase(db,{
    orderId,reason:'CUSTOMER_REQUEST',note:'Refund investigation',actor:'admin',
  });
  caseId=created.case.id;
  await changeRefundReviewCase(db,{caseId,status:'IN_PROGRESS',expectedVersion:1,
    note:'Owner checking refund',actor:'admin'});
  await changeRefundReviewCase(db,{caseId,status:'REFUND_REPORTED_UNVERIFIED',expectedVersion:2,
    reportedRefundId:refId,note:'External refund ID, not yet verified',actor:'admin'});
});
afterEach(()=>{db.close();vi.unstubAllEnvs();vi.restoreAllMocks()});
const request=()=>({caseId,expectedVersion:3,actor:'admin'});
const counts=async()=>({
  events:Number((await db.execute('SELECT COUNT(*) n FROM refund_review_events')).rows[0]?.n),
  audits:Number((await db.execute("SELECT COUNT(*) n FROM audit_logs WHERE action='REFUND_PROVIDER_PROCESSED_VERIFIED'")).rows[0]?.n),
});
describe('Stage 2G P0-C safe Razorpay refund GET verification (mocked network only)',()=>{
  it('checks exact provider refund and records one processed confirmation without altering financial order',async()=>{
    const fetcher=gateway();
    const before=(await db.execute({sql:'SELECT * FROM orders WHERE id=?',args:[orderId]})).rows[0];
    const paymentBefore=(await db.execute({sql:'SELECT * FROM payments WHERE order_id=?',args:[orderId]})).rows[0];
    const result=await verifyReportedRefund(db,request(),fetcher);
    expect(result).toMatchObject({status:'REFUND_PROCESSED_VERIFIED',idempotent:false});
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url,options]=vi.mocked(fetcher).mock.calls[0]!;
    expect(String(url)).toBe('https://api.razorpay.com/v1/refunds/'+refId);
    expect((options as RequestInit).method).toBe('GET');
    expect((await db.execute({sql:'SELECT * FROM orders WHERE id=?',args:[orderId]})).rows[0]).toEqual(before);
    expect((await db.execute({sql:'SELECT * FROM payments WHERE order_id=?',args:[orderId]})).rows[0]).toEqual(paymentBefore);
    expect((await db.execute({sql:'SELECT status,version FROM refund_review_cases WHERE id=?',args:[caseId]})).rows[0])
      .toMatchObject({status:'REFUND_PROCESSED_VERIFIED',version:4});
    expect(await counts()).toEqual({events:4,audits:1});
    const again=await verifyReportedRefund(db,request(),fetcher);
    expect(again.idempotent).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await counts()).toEqual({events:4,audits:1});
  });
  it.each([
    [{status:'created'},'not yet processed'],
    [{status:'pending'},'not yet processed'],
    [{status:'failed'},'not yet processed'],
    [{payment_id:'pay_WRONG12345'},'mismatch'],
    [{amount:11999},'mismatch'],
    [{currency:'USD'},'mismatch'],
    [{id:'rfnd_WRONG12345'},'mismatch'],
    [{entity:'payment'},'mismatch'],
  ])('rejects unconfirmed/mismatched evidence %j',async(fields,error)=>{
    await expect(verifyReportedRefund(db,request(),gateway(fields))).rejects.toThrow(error);
    expect((await db.execute({sql:'SELECT status FROM refund_review_cases WHERE id=?',args:[caseId]})).rows[0]?.status)
      .toBe('REFUND_REPORTED_UNVERIFIED');
    expect(await counts()).toEqual({events:3,audits:0});
  });
  it('fails closed on missing credentials, invalid API payload and HTTP failure',async()=>{
    vi.stubEnv('RAZORPAY_KEY_SECRET','');
    const mock=gateway();
    await expect(verifyReportedRefund(db,request(),mock)).rejects.toMatchObject({httpStatus:503});
    expect(mock).not.toHaveBeenCalled();
    vi.stubEnv('RAZORPAY_KEY_SECRET','test-secret-only');
    await expect(verifyReportedRefund(db,request(),gateway({},401))).rejects.toMatchObject({httpStatus:503});
    expect(await counts()).toEqual({events:3,audits:0});
  });
  it('blocks stale versions and refuses mismatching local financial receipt',async()=>{
    const mock=gateway();
    await expect(verifyReportedRefund(db,{...request(),expectedVersion:2},mock)).rejects.toThrow();
    expect(mock).not.toHaveBeenCalled();
    await db.execute({sql:'UPDATE payments SET amount_paisa=11000 WHERE order_id=?',args:[orderId]});
    await expect(verifyReportedRefund(db,request(),mock)).rejects.toThrow('Financial');
    expect(await counts()).toEqual({events:3,audits:0});
  });
});
