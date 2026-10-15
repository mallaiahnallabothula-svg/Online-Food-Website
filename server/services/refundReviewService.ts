/** Manual-only refund case ledger. This module NEVER talks to Razorpay and NEVER
 * updates orders, payments, inventory or customer-facing financial statuses. */
import crypto from 'node:crypto';
import type { Client, Transaction } from '@libsql/client';

export type RefundCaseStatus = 'NEEDS_REVIEW' | 'IN_PROGRESS' | 'REFUND_REPORTED_UNVERIFIED' | 'CLOSED_NO_REFUND';
export type RefundReason = 'CUSTOMER_REQUEST' | 'ORDER_UNAVAILABLE' | 'PAYMENT_EXCEPTION' | 'OTHER';

export class RefundReviewFault extends Error {
  constructor(public readonly code: string, public readonly httpStatus: number, message: string) {
    super(message);
  }
}
const conflict = (message: string) => new RefundReviewFault('REFUND_REVIEW_CONFLICT',409,message);
const nowIso = () => new Date().toISOString();
const id = (prefix: string) => prefix + crypto.randomBytes(12).toString('hex');

type Input = { orderId: string; reason: RefundReason; note: string; actor: string };
type Change = { caseId: string; status: RefundCaseStatus; note: string; expectedVersion: number; reportedRefundId?: string; actor: string };

async function writeTx<T>(db: Client, run: (tx: Transaction) => Promise<T>): Promise<T> {
  const tx = await db.transaction('write');
  try { const result = await run(tx); await tx.commit(); return result; }
  catch (error) { await tx.rollback().catch(()=>{}); throw error; }
  finally { tx.close(); }
}
function project(row: Record<string, unknown>) {
  return {
    id: String(row.id), orderId: String(row.order_id),
    providerPaymentId: row.provider_payment_id === null ? null : String(row.provider_payment_id),
    amountPaisa: Number(row.amount_paisa), currency: 'INR' as const,
    reason: String(row.reason), status: String(row.status) as RefundCaseStatus,
    reportedRefundId: row.reported_refund_id === null ? null : String(row.reported_refund_id),
    initialNote: String(row.initial_note), version: Number(row.version),
    createdAt: String(row.created_at_utc), updatedAt: String(row.updated_at_utc),
  };
}
export async function listRefundReviewCases(db: Client, page: number) {
  if (!Number.isSafeInteger(page) || page < 1 || page > 99999) {
    throw new RefundReviewFault('INVALID_PAGE',400,'Invalid page');
  }
  const total = await db.execute('SELECT COUNT(*) AS total FROM refund_review_cases');
  const result = await db.execute({
    sql: `SELECT id,order_id,provider_payment_id,amount_paisa,currency,reason,status,reported_refund_id,
                 initial_note,version,created_at_utc,updated_at_utc
          FROM refund_review_cases ORDER BY created_at_utc DESC,id DESC LIMIT 20 OFFSET ?`,
    args: [(page-1)*20],
  });
  return { cases: result.rows.map(row => project(row as Record<string,unknown>)),
    pagination: {page,limit:20,total:Number(total.rows[0]?.total??0)} };
}
export async function createRefundReviewCase(db: Client, input: Input) {
  return writeTx(db, async tx => {
    const existing = await tx.execute({sql:'SELECT * FROM refund_review_cases WHERE order_id=? LIMIT 1',args:[input.orderId]});
    if (existing.rows.length) {
      if (existing.rows[0]?.reason !== input.reason) throw conflict('Order already has a different refund review case');
      return {case:project(existing.rows[0] as Record<string,unknown>),idempotent:true};
    }
    const orderRes = await tx.execute({
      sql:'SELECT id,payment_provider,payment_status,provider_payment_id,total_amount_paisa,currency FROM orders WHERE id=? LIMIT 1',
      args:[input.orderId],
    });
    const order = orderRes.rows[0];
    if (!order) throw new RefundReviewFault('ORDER_NOT_FOUND',404,'Order not found');
    if (order.payment_provider !== 'razorpay' || order.currency !== 'INR' ||
        (order.payment_status !== 'PENDING' && order.payment_status !== 'PAID')) {
      throw conflict('Order has no eligible Razorpay charge for manual review');
    }
    const receipts = await tx.execute({
      sql:`SELECT provider_payment_id,amount_paisa,currency,status FROM payments
            WHERE order_id=? AND provider='razorpay' AND status IN ('SUCCESS','REVIEW_REQUIRED')
            AND verified_at IS NOT NULL`,args:[input.orderId],
    });
    // Ambiguous or missing receipts are not sufficient financial evidence.
    if (receipts.rows.length !== 1) throw conflict('Verify ambiguous or missing captured payment in Razorpay before creating a case');
    const payment = receipts.rows[0]!;
    if (payment.currency !== 'INR' || !Number.isSafeInteger(Number(payment.amount_paisa)) ||
        Number(payment.amount_paisa)<=0 || Number(payment.amount_paisa)!==Number(order.total_amount_paisa) ||
        (payment.status==='SUCCESS' && (order.payment_status!=='PAID' || payment.provider_payment_id!==order.provider_payment_id)) ||
        (payment.status==='REVIEW_REQUIRED' && order.payment_status!=='PENDING')) {
      throw conflict('Captured payment and order snapshot mismatch; manual investigation required');
    }
    const providerPaymentId=payment.provider_payment_id;
    if(typeof providerPaymentId!=='string'||!/^pay_[A-Za-z0-9]{5,64}$/.test(providerPaymentId))
      throw conflict('Invalid payment reference; manual investigation required');
    const date=nowIso(),caseId=id('RRC-');
    await tx.execute({
      sql:`INSERT INTO refund_review_cases
        (id,order_id,provider_payment_id,amount_paisa,currency,reason,status,initial_note,
         created_by,updated_by,version,created_at_utc,updated_at_utc)
        VALUES (?,?,?,?,? ,?,'NEEDS_REVIEW',?,?,?,1,?,?)`,
      args:[caseId,input.orderId,providerPaymentId,Number(payment.amount_paisa),
        'INR',input.reason,input.note,input.actor,input.actor,date,date],
    });
    await tx.execute({sql:`INSERT INTO refund_review_events
      (id,case_id,event_type,from_status,to_status,note,actor_id,version,created_at_utc)
      VALUES (?,?,'CASE_CREATED',NULL,'NEEDS_REVIEW',?,?,1,?)`,
      args:[id('RRE-'),caseId,input.note,input.actor,date]});
    await tx.execute({sql:`INSERT INTO audit_logs
      (id,actor_type,actor_id,action,target_type,target_id,details,created_at)
      VALUES (?,'ADMIN',?,'REFUND_REVIEW_CASE_CREATED','ORDER',?,?,?)`,
      args:[id('AUD-'),input.actor,input.orderId,JSON.stringify({caseId,reason:input.reason,amountPaisa:Number(payment.amount_paisa)}),date]});
    const row=await tx.execute({sql:'SELECT * FROM refund_review_cases WHERE id=?',args:[caseId]});
    return {case:project(row.rows[0] as Record<string,unknown>),idempotent:false};
  });
}
export async function changeRefundReviewCase(db: Client, input: Change) {
  return writeTx(db, async tx=>{
    const existing=await tx.execute({sql:'SELECT * FROM refund_review_cases WHERE id=? LIMIT 1',args:[input.caseId]});
    const current=existing.rows[0];
    if(!current) throw new RefundReviewFault('CASE_NOT_FOUND',404,'Refund case not found');
    if(Number(current.version)!==input.expectedVersion) throw conflict('Case changed. Refresh before updating');
    const before=String(current.status) as RefundCaseStatus;
    const allowed: Record<RefundCaseStatus,RefundCaseStatus[]>={
      NEEDS_REVIEW:['IN_PROGRESS','CLOSED_NO_REFUND'],
      IN_PROGRESS:['REFUND_REPORTED_UNVERIFIED','CLOSED_NO_REFUND'],
      REFUND_REPORTED_UNVERIFIED:[],CLOSED_NO_REFUND:[],
    };
    if(!allowed[before].includes(input.status)) throw conflict('Invalid manual review transition');
    if(input.status==='REFUND_REPORTED_UNVERIFIED'&&!input.reportedRefundId) {
      throw new RefundReviewFault('REFUND_ID_REQUIRED',400,'External refund ID required for unverified report');
    }
    if(input.status!=='REFUND_REPORTED_UNVERIFIED'&&input.reportedRefundId) {
      throw new RefundReviewFault('REFUND_ID_UNEXPECTED',400,'Refund ID only allowed for an unverified report');
    }
    const date=nowIso(),version=input.expectedVersion+1;
    const changed=await tx.execute({
      sql:`UPDATE refund_review_cases SET status=?,reported_refund_id=?,version=?,updated_by=?,updated_at_utc=?
            WHERE id=? AND version=?`,
      args:[input.status,input.reportedRefundId??null,version,input.actor,date,input.caseId,input.expectedVersion],
    });
    if(Number(changed.rowsAffected)!==1) throw conflict('Concurrent case update; refresh and retry');
    await tx.execute({sql:`INSERT INTO refund_review_events
      (id,case_id,event_type,from_status,to_status,note,actor_id,version,created_at_utc)
      VALUES (?,?,'STATUS_CHANGED',?,?,?,?,?,?)`,
      args:[id('RRE-'),input.caseId,before,input.status,input.note,input.actor,version,date]});
    await tx.execute({sql:`INSERT INTO audit_logs
      (id,actor_type,actor_id,action,target_type,target_id,details,created_at)
      VALUES (?,'ADMIN',?,'REFUND_REVIEW_STATUS_CHANGED','REFUND_CASE',?,?,?)`,
      args:[id('AUD-'),input.actor,input.caseId,JSON.stringify({
        from:before,to:input.status,version,reportedRefundId:input.reportedRefundId??null,
        providerVerified:false
      }),date]});
    const result=await tx.execute({sql:'SELECT * FROM refund_review_cases WHERE id=?',args:[input.caseId]});
    return project(result.rows[0] as Record<string,unknown>);
  });
}
export async function getRefundReviewHistory(db:Client,caseId:string) {
  const result=await db.execute({sql:`SELECT event_type,from_status,to_status,note,actor_id,version,created_at_utc
    FROM refund_review_events WHERE case_id=? ORDER BY version ASC`,args:[caseId]});
  return result.rows.map(r=>({
    action:String(r.event_type),from:r.from_status===null?null:String(r.from_status),
    to:String(r.to_status),note:String(r.note),actor:String(r.actor_id),
    version:Number(r.version),createdAt:String(r.created_at_utc),
  }));
}
