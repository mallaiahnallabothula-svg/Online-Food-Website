import React,{useCallback,useEffect,useState} from 'react';
import {ShieldAlert,RefreshCw} from 'lucide-react';
import {useLanguage} from '../../context/LanguageContext';
import {refundRequest,validateRefundPage,type RefundCase,type RefundPage,type RefundCaseStatus,type RefundReason} from '../../utils/refundReview';

interface Props{onAccessDenied:()=>void;onViewOrder:(orderId:string)=>void}
export function RefundReviewQueue({onAccessDenied,onViewOrder}:Props){
  const {language}=useLanguage(),te=language!=='en';
  const [page,setPage]=useState(1),[snapshot,setSnapshot]=useState<RefundPage|null>(null);
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState('');
  const [revision,setRevision]=useState(0);
  const [orderId,setOrderId]=useState(''),[reason,setReason]=useState<RefundReason>('CUSTOMER_REQUEST');
  const [note,setNote]=useState(''),[refundId,setRefundId]=useState('');
  const [events,setEvents]=useState<Array<{action:string;from:string|null;to:string;note:string;actor:string;version:number;createdAt:string}>|null>(null);
  const [eventCaseId,setEventCaseId]=useState<string|null>(null);
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const result=validateRefundPage(await refundRequest('?page='+page),page);
      setSnapshot(result);
    }catch(e){
      setSnapshot(null);
      const message=e instanceof Error?e.message:'Refund reviews unavailable';
      if(message==='REFUND_ACCESS_DENIED')onAccessDenied();
      else setError(message);
    }finally{setLoading(false)}
  },[page,revision,onAccessDenied]);
  useEffect(()=>{void load()},[load]);
  async function createCase(event:React.FormEvent){
    event.preventDefault();if(saving)return;setSaving(true);setError('');
    try{
      await refundRequest('/',{method:'POST',body:JSON.stringify({orderId:orderId.trim(),reason,note:note.trim()})});
      setOrderId('');setNote('');setRevision(x=>x+1);setPage(1);
    }catch(e){setError(e instanceof Error?e.message:'Unable to create refund review')}
    finally{setSaving(false)}
  }
  async function changeCase(row:RefundCase,status:RefundCaseStatus){
    if(saving)return;setSaving(true);setError('');
    try{
      await refundRequest('/'+encodeURIComponent(row.id),{method:'PATCH',body:JSON.stringify({
        status,expectedVersion:row.version,note:note.trim(),
        ...(status==='REFUND_REPORTED_UNVERIFIED'?{reportedRefundId:refundId.trim()}:{}),
      })});
      setNote('');setRefundId('');setRevision(x=>x+1);
    }catch(e){setError(e instanceof Error?e.message:'Unable to update refund case')}
    finally{setSaving(false)}
  }
  async function verify(row:RefundCase){
    if(saving)return;
    setSaving(true);setError('');
    try{
      await refundRequest('/'+encodeURIComponent(row.id)+'/verify',{
        method:'POST',body:JSON.stringify({expectedVersion:row.version}),
      });
      setRevision(x=>x+1);
    }catch(e){setError(e instanceof Error?e.message:'Razorpay verification unavailable')}
    finally{setSaving(false)}
  }
  async function history(row:RefundCase){
    setError('');
    try{
      const data=await refundRequest('/'+encodeURIComponent(row.id)+'/history');
      if(!data||!Array.isArray(data.events))throw new Error('Invalid history');
      setEvents(data.events);setEventCaseId(row.id);
    }catch(e){setError(e instanceof Error?e.message:'Unable to load case history')}
  }
  const unavailable=error==='REFUND_REVIEW_NOT_ACTIVATED';
  return <section aria-label="Manual Refund Review" className="space-y-4 rounded-2xl border border-amber-300 bg-white p-4 dark:border-amber-800 dark:bg-[#211E1A] sm:p-6">
    <div className="flex items-center justify-between gap-3">
      <div><h3 className="flex items-center gap-2 text-lg font-extrabold text-stone-900 dark:text-white"><ShieldAlert size={20}/> {te?'మాన్యువల్ రిఫండ్ రివ్యూ':'Manual Refund Review'}</h3>
        <p className="text-xs text-stone-600 dark:text-stone-300">No automatic refunds. An external refund report is NOT verified or completed by this website.</p></div>
      <button type="button" className="rounded-lg border px-3 py-2 text-sm" disabled={loading} onClick={()=>setRevision(x=>x+1)}><RefreshCw size={16}/></button>
    </div>
    {error&&<p role="alert" className="rounded-xl border border-amber-400 p-3 text-sm text-amber-950 dark:text-amber-200">
      {unavailable?(te?'రిఫండ్ రివ్యూ ఇంకా యాక్టివేట్ కాలేదు. ప్రత్యేక డేటాబేస్ ఆమోదం అవసరం.':'Refund Review not activated. Separate database migration and activation approval required.'):error}
    </p>}
    {!unavailable&&<>
      <form onSubmit={e=>void createCase(e)} className="grid gap-2 rounded-xl bg-stone-50 p-3 dark:bg-stone-900">
        <strong className="text-sm">{te?'రివ్యూ కేసు నమోదు':'Open manual review case'}</strong>
        <label className="text-xs">Order ID<input value={orderId} onChange={e=>setOrderId(e.target.value)} required maxLength={100}
          className="mt-1 min-h-10 w-full rounded-md border border-stone-300 bg-white p-2 text-sm text-stone-900 dark:bg-stone-800 dark:text-white"/></label>
        <label className="text-xs">Reason<select value={reason} onChange={e=>setReason(e.target.value as RefundReason)}
          className="mt-1 min-h-10 w-full rounded-md border bg-white p-2 text-sm dark:bg-stone-800">
          <option value="CUSTOMER_REQUEST">Customer request</option><option value="ORDER_UNAVAILABLE">Order unavailable</option>
          <option value="PAYMENT_EXCEPTION">Payment exception</option><option value="OTHER">Other</option>
        </select></label>
        <label className="text-xs">Owner note (5–500 characters)<textarea value={note} onChange={e=>setNote(e.target.value)}
          rows={2} required minLength={5} maxLength={500} className="mt-1 w-full rounded-md border bg-white p-2 text-sm dark:bg-stone-800"/></label>
        <button type="submit" disabled={saving||loading} className="min-h-10 rounded-lg bg-[#26543A] px-3 font-semibold text-white disabled:opacity-40">Create review case — no refund issued</button>
      </form>
      {loading&&<p role="status">Loading manual refund cases…</p>}
      {!loading&&snapshot&&<>
        <p className="text-sm font-bold">Recorded cases: {snapshot.pagination.total}</p>
        {snapshot.cases.length===0&&<p className="text-xs">No cases recorded here. Verify Razorpay separately.</p>}
        <div className="grid gap-3 md:grid-cols-2">{snapshot.cases.map(row=><article key={row.id} className="space-y-2 rounded-xl border border-stone-200 p-3 dark:border-stone-700">
          <p className="break-all font-bold">{row.orderId}</p><p className="text-xs">Status: <strong>{row.status}</strong> · Version {row.version}</p>
          <p className="font-bold">₹{(row.amountPaisa/100).toFixed(2)}</p>
          <p className="break-all text-xs">Payment: {row.providerPaymentId??'Unverified'}</p>
          {row.reportedRefundId&&<p className="break-all text-xs">{row.status==='REFUND_PROCESSED_VERIFIED'?'Razorpay processed — verified by API: ':'Externally reported (NOT verified): '}{row.reportedRefundId}</p>}
          <p className="text-xs">Reason: {row.reason}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="min-h-10 rounded-md border px-2 text-xs" onClick={()=>onViewOrder(row.orderId)}>View order</button>
            <button type="button" className="min-h-10 rounded-md border px-2 text-xs" onClick={()=>void history(row)}>Audit history</button>
            {row.status==='REFUND_REPORTED_UNVERIFIED'&&<button
              type="button" disabled={saving} onClick={()=>void verify(row)}
              className="min-h-10 rounded-md border border-emerald-700 px-2 text-xs">
              Verify processed refund with Razorpay (READ ONLY)
            </button>}
            {row.status==='NEEDS_REVIEW'&&<button type="button" disabled={saving||note.trim().length<5} onClick={()=>void changeCase(row,'IN_PROGRESS')}
              className="min-h-10 rounded-md border px-2 text-xs">Begin review</button>}
            {(row.status==='NEEDS_REVIEW'||row.status==='IN_PROGRESS')&&<button type="button" disabled={saving||note.trim().length<5} onClick={()=>void changeCase(row,'CLOSED_NO_REFUND')}
              className="min-h-10 rounded-md border px-2 text-xs">Close — no refund</button>}
          </div>
          {row.status==='IN_PROGRESS'&&<div className="space-y-1">
            <label className="text-xs">External refund ID (unverified)<input value={refundId} onChange={e=>setRefundId(e.target.value)}
              placeholder="rfnd_..." className="min-h-10 w-full rounded-md border p-2 text-sm dark:bg-stone-800"/></label>
            <button type="button" disabled={saving||note.trim().length<5||!/^rfnd_[A-Za-z0-9]{5,64}$/.test(refundId.trim())}
              onClick={()=>void changeCase(row,'REFUND_REPORTED_UNVERIFIED')} className="min-h-10 rounded-lg border border-amber-500 px-3 text-xs">
              Record external refund report (UNVERIFIED)
            </button>
          </div>}
          {eventCaseId===row.id&&events&&<div className="space-y-1 border-t pt-2 text-xs" aria-label="Refund case audit history">
            {events.map((ev,i)=><p key={i}>{ev.version??i}: {ev.action} — {ev.to} ({ev.actor}): {ev.note}</p>)}
          </div>}
        </article>)}</div>
        {snapshot.pagination.total>20&&<div className="flex justify-between gap-3 text-sm">
          <button disabled={page<=1} onClick={()=>setPage(x=>x-1)}>Previous</button>
          <span>Page {page}</span><button disabled={page*20>=snapshot.pagination.total} onClick={()=>setPage(x=>x+1)}>Next</button>
        </div>}
      </>}
    </>}
    <p className="text-xs text-amber-900 dark:text-amber-200">Financial order status stays unchanged. Only a matching full-amount refund marked processed by Razorpay is displayed as provider-verified. Bank credit is not guaranteed. No refund is initiated here.</p>
  </section>;
}
