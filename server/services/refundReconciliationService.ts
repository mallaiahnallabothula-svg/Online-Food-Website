/** Owner-initiated Razorpay refund verification: GET only. No refunds are initiated.
 * Writes ONLY refund case and audit ledgers, NOT payments/orders/stock. */
import crypto from 'node:crypto';
import type { Client } from '@libsql/client';
import {RefundReviewFault} from './refundReviewService.ts';

const CASE_ID=/^RRC-[a-f0-9]{24}$/;
const PAYMENT_ID=/^pay_[A-Za-z0-9]{5,64}$/;
const REFUND_ID=/^rfnd_[A-Za-z0-9]{5,64}$/;
type VerifyInput={caseId:string;expectedVersion:number;actor:string};
const conflict=(message:string)=>new RefundReviewFault('REFUND_RECONCILIATION_CONFLICT',409,message);
const unavailable=(message:string)=>new RefundReviewFault('REFUND_GATEWAY_UNAVAILABLE',503,message);

export async function verifyReportedRefund(db:Client,input:VerifyInput,fetcher:typeof fetch=fetch) {
  if(!CASE_ID.test(input.caseId)||!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<1)
    throw new RefundReviewFault('INVALID_REFUND_VERIFICATION_REQUEST',400,'Invalid case or version');
  const first=(await db.execute({sql:'SELECT * FROM refund_review_cases WHERE id=?',args:[input.caseId]})).rows[0];
  if(!first)throw new RefundReviewFault('CASE_NOT_FOUND',404,'Refund case not found');
  if(first.status==='REFUND_PROCESSED_VERIFIED')
    return {status:'REFUND_PROCESSED_VERIFIED',idempotent:true,caseId:input.caseId};
  if(first.status!=='REFUND_REPORTED_UNVERIFIED'||Number(first.version)!==input.expectedVersion)
    throw conflict('Refresh the refund case before provider verification');
  const paymentId=String(first.provider_payment_id??'');
  const refundId=String(first.reported_refund_id??'');
  if(!PAYMENT_ID.test(paymentId)||!REFUND_ID.test(refundId))throw conflict('Missing valid provider identifiers');
  const key=process.env.RAZORPAY_KEY_ID,secret=process.env.RAZORPAY_KEY_SECRET;
  if(!key||!secret)throw unavailable('Razorpay verification credentials not configured');
  const authorization='Basic '+Buffer.from(key+':'+secret).toString('base64');
  let response:Response;
  try{
    response=await fetcher('https://api.razorpay.com/v1/refunds/'+refundId,{
      method:'GET',
      headers:{Authorization:authorization,Accept:'application/json'},
      cache:'no-store',
      signal:AbortSignal.timeout(8000),
    });
  }catch{throw unavailable('Unable to reach Razorpay; case remains unverified');}
  if(!response.ok)throw unavailable('Razorpay could not confirm the refund; case remains unverified');
  let json:unknown;
  try{json=await response.json();}catch{throw unavailable('Invalid Razorpay refund response');}
  if(!json||typeof json!=='object')throw unavailable('Invalid Razorpay refund response');
  const provider=json as Record<string,unknown>;
  if(provider.entity!=='refund'||provider.id!==refundId||
     provider.payment_id!==paymentId||provider.currency!=='INR'||
     !Number.isSafeInteger(provider.amount)||Number(provider.amount)!==Number(first.amount_paisa))
    throw conflict('Refund/payment/full amount/currency mismatch; manual investigation required');
  if(provider.status!=='processed')throw conflict('Refund not yet processed by Razorpay; case remains unverified');

  const tx=await db.transaction('write');
  try{
    const current=(await tx.execute({
      sql:'SELECT * FROM refund_review_cases WHERE id=?',args:[input.caseId],
    })).rows[0];
    if(!current)throw conflict('Refund case no longer exists');
    if(current.status==='REFUND_PROCESSED_VERIFIED'){
      await tx.rollback();
      return {status:'REFUND_PROCESSED_VERIFIED',idempotent:true,caseId:input.caseId};
    }
    if(current.status!=='REFUND_REPORTED_UNVERIFIED'||
       Number(current.version)!==input.expectedVersion||
       current.provider_payment_id!==paymentId||
       current.reported_refund_id!==refundId||
       Number(current.amount_paisa)!==Number(provider.amount))
      throw conflict('Refund case changed during verification');
    const receipt=await tx.execute({sql:`SELECT p.provider_payment_id,p.amount_paisa,p.currency,o.payment_provider
      FROM payments p JOIN orders o ON o.id=p.order_id
      WHERE p.order_id=? AND p.provider='razorpay' AND p.verified_at IS NOT NULL
        AND p.status IN ('SUCCESS','REVIEW_REQUIRED')`,args:[current.order_id]});
    if(receipt.rows.length!==1||receipt.rows[0]?.provider_payment_id!==paymentId||
       Number(receipt.rows[0]?.amount_paisa)!==Number(provider.amount)||
       receipt.rows[0]?.currency!=='INR'||receipt.rows[0]?.payment_provider!=='razorpay')
      throw conflict('Stored financial receipt changed; manual investigation required');
    const next=input.expectedVersion+1,date=new Date().toISOString();
    const changed=await tx.execute({sql:`UPDATE refund_review_cases
      SET status='REFUND_PROCESSED_VERIFIED',version=?,updated_by=?,updated_at_utc=?
      WHERE id=? AND status='REFUND_REPORTED_UNVERIFIED' AND version=? AND reported_refund_id=?`,
      args:[next,input.actor,date,input.caseId,input.expectedVersion,refundId]});
    if(Number(changed.rowsAffected)!==1)throw conflict('Concurrent provider verification');
    await tx.execute({sql:`INSERT INTO refund_review_events
      (id,case_id,event_type,from_status,to_status,note,actor_id,version,created_at_utc)
      VALUES (?,?,'PROVIDER_VERIFIED','REFUND_REPORTED_UNVERIFIED','REFUND_PROCESSED_VERIFIED',?,?,?,?)`,
      args:['RRE-'+crypto.randomBytes(12).toString('hex'),input.caseId,
        'Razorpay GET confirmed matching refund, captured amount and processed status',input.actor,next,date]});
    await tx.execute({sql:`INSERT INTO audit_logs
      (id,actor_type,actor_id,action,target_type,target_id,details,created_at)
      VALUES (?,'ADMIN',?,'REFUND_PROVIDER_PROCESSED_VERIFIED','REFUND_CASE',?,?,?)`,
      args:['AUD-'+crypto.randomBytes(12).toString('hex'),input.actor,input.caseId,
        JSON.stringify({refundId,paymentId,amountPaisa:provider.amount,
          providerStatus:'processed',bankCreditConfirmed:false,version:next}),date]});
    await tx.commit();
    return {status:'REFUND_PROCESSED_VERIFIED',idempotent:false,caseId:input.caseId};
  }catch(error){await tx.rollback().catch(()=>{});throw error;}
  finally{tx.close();}
}
