/** Strict owner-only refund review records. These are NOT provider-verified refunds. */
export type RefundCaseStatus = 'NEEDS_REVIEW'|'IN_PROGRESS'|'REFUND_REPORTED_UNVERIFIED'|'CLOSED_NO_REFUND';
export type RefundReason = 'CUSTOMER_REQUEST'|'ORDER_UNAVAILABLE'|'PAYMENT_EXCEPTION'|'OTHER';
export interface RefundCase {
  id:string;orderId:string;providerPaymentId:string|null;amountPaisa:number;currency:'INR';
  reason:RefundReason;status:RefundCaseStatus;reportedRefundId:string|null;initialNote:string;
  version:number;createdAt:string;updatedAt:string;
}
export interface RefundPage {cases:RefundCase[];pagination:{page:number;limit:20;total:number}}
const statuses=['NEEDS_REVIEW','IN_PROGRESS','REFUND_REPORTED_UNVERIFIED','CLOSED_NO_REFUND'];
const reasons=['CUSTOMER_REQUEST','ORDER_UNAVAILABLE','PAYMENT_EXCEPTION','OTHER'];
export function validateRefundPage(v:unknown,page:number):RefundPage {
  if(!v||typeof v!=='object')throw new Error('Invalid refund review response');
  const o=v as Record<string,unknown>,p=o.pagination as Record<string,unknown>;
  if(!p||p.page!==page||p.limit!==20||!Number.isSafeInteger(p.total)||
     Number(p.total)<0||!Array.isArray(o.cases)||o.cases.length>20)throw new Error('Invalid refund review response');
  const cases=o.cases as unknown[];
  const ids=new Set();
  for(const c of cases){
    if(!c||typeof c!=='object')throw new Error('Invalid refund case');
    const x=c as Record<string,unknown>;
    if(typeof x.id!=='string'||!/^RRC-[a-f0-9]{24}$/.test(x.id)||
       typeof x.orderId!=='string'||!/^[a-z0-9-]{5,100}$/i.test(x.orderId)||
       (x.providerPaymentId!==null&&(typeof x.providerPaymentId!=='string'||!/^pay_[a-zA-Z0-9]{5,64}$/.test(x.providerPaymentId)))||
       !Number.isSafeInteger(x.amountPaisa)||Number(x.amountPaisa)<=0||x.currency!=='INR'||
       !reasons.includes(String(x.reason))||!statuses.includes(String(x.status))||
       (x.reportedRefundId!==null&&(typeof x.reportedRefundId!=='string'||!/^rfnd_[a-zA-Z0-9]{5,64}$/.test(x.reportedRefundId)))||
       (x.status==='REFUND_REPORTED_UNVERIFIED'&&!x.reportedRefundId)||
       !Number.isSafeInteger(x.version)||Number(x.version)<1||
       typeof x.initialNote!=='string'||typeof x.createdAt!=='string'||typeof x.updatedAt!=='string')
       throw new Error('Invalid refund case');
    if(ids.has(x.id))throw new Error('Duplicate refund cases');
    ids.add(x.id);
  }
  return {cases:cases as RefundCase[],pagination:p as RefundPage['pagination']};
}
export async function refundRequest(path:string,options:RequestInit={}) {
  const response=await fetch('/api/admin/refund-reviews'+path,{
    credentials:'include',cache:'no-store',...options,
    headers:{'X-Requested-With':'XMLHttpRequest',...(options.body?{'Content-Type':'application/json'}:{}),...options.headers},
  });
  if(response.status===401||response.status===403)throw new Error('REFUND_ACCESS_DENIED');
  if(!response.ok){
    const value=await response.json().catch(()=>({}));
    throw new Error(value?.error?.code==='REFUND_REVIEW_NOT_ACTIVATED'?'REFUND_REVIEW_NOT_ACTIVATED':
      value?.error?.message||'Refund review request failed');
  }
  return response.json();
}
