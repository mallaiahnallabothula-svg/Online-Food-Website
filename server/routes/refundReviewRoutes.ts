/** ADMIN-only feature-gated refund review ledger.
 * Razorpay GET verification is separately gated. No refund creation, schema
 * auto-creation, or order/payment/stock changes. */
import { Router, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { getDb } from '../db/index.ts';
import { requireAuth, requireRole, requireAdminCsrf, type AuthenticatedRequest } from '../auth/index.ts';
import { RefundReviewFault, createRefundReviewCase, listRefundReviewCases,
  changeRefundReviewCase, getRefundReviewHistory } from '../services/refundReviewService.ts';
import {verifyReportedRefund} from '../services/refundReconciliationService.ts';

export const refundReviewRouter=Router();
refundReviewRouter.use(requireAuth,requireRole(['ADMIN']));
refundReviewRouter.use((_req,res,next)=>{
  if(process.env.REFUND_REVIEW_ENABLED!=='true'||process.env.REFUND_REVIEW_SCHEMA_READY!=='true')
    return res.status(503).json({error:{code:'REFUND_REVIEW_NOT_ACTIVATED',message:'Refund Review awaits separately approved database migration and activation.'}});
  next();
});
function handleError(error:unknown,res:Response,next:NextFunction) {
  if(error instanceof RefundReviewFault)
    return res.status(error.httpStatus).json({error:{code:error.code,message:error.message}});
  if(error instanceof Error && /no such table: refund_review_/i.test(error.message))
    return res.status(503).json({error:{code:'REFUND_REVIEW_SCHEMA_NOT_READY',message:'Refund review database migration is not applied.'}});
  next(error);
}
const orderId=z.string().min(5).max(100).regex(/^[A-Za-z0-9-]+$/);
const caseId=z.string().regex(/^RRC-[a-f0-9]{24}$/);
const note=z.string().trim().min(5).max(500);
const reason=z.enum(['CUSTOMER_REQUEST','ORDER_UNAVAILABLE','PAYMENT_EXCEPTION','OTHER']);
const status=z.enum(['IN_PROGRESS','REFUND_REPORTED_UNVERIFIED','CLOSED_NO_REFUND']);

refundReviewRouter.get('/',async(req:AuthenticatedRequest,res:Response,next:NextFunction)=>{
  const page=z.coerce.number().int().min(1).max(99999).safeParse(req.query.page??'1');
  if(!page.success) return res.status(400).json({error:{code:'INVALID_PAGE'}});
  try {res.json(await listRefundReviewCases(getDb(),page.data));}
  catch(err){handleError(err,res,next);}
});
refundReviewRouter.get('/:id/history',async(req:AuthenticatedRequest,res:Response,next:NextFunction)=>{
  const parsed=caseId.safeParse(req.params.id);
  if(!parsed.success) return res.status(400).json({error:{code:'INVALID_CASE_ID'}});
  try{res.json({events:await getRefundReviewHistory(getDb(),parsed.data)});}
  catch(err){handleError(err,res,next);}
});
refundReviewRouter.post('/',requireAdminCsrf,async(req:AuthenticatedRequest,res:Response,next:NextFunction)=>{
  const parsed=z.strictObject({orderId,reason,note}).safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:{code:'INVALID_REFUND_CASE',message:'Invalid order, reason or note'}});
  try{
    const result=await createRefundReviewCase(getDb(),{...parsed.data,actor:req.user!.username});
    res.status(result.idempotent?200:201).json(result);
  }catch(err){handleError(err,res,next);}
});
refundReviewRouter.patch('/:id',requireAdminCsrf,async(req:AuthenticatedRequest,res:Response,next:NextFunction)=>{
  const parsed=z.strictObject({
    status,note,expectedVersion:z.number().int().min(1),reportedRefundId:z.string().regex(/^rfnd_[A-Za-z0-9]{5,64}$/).optional(),
  }).safeParse(req.body);
  const idResult=caseId.safeParse(req.params.id);
  if(!parsed.success||!idResult.success)
    return res.status(400).json({error:{code:'INVALID_REFUND_REVIEW_UPDATE'}});
  try{
    res.json({case:await changeRefundReviewCase(getDb(),{...parsed.data,caseId:idResult.data,actor:req.user!.username})});
  }catch(err){handleError(err,res,next);}
});

// Owner-triggered server-side Razorpay READ ONLY lookup. No gateway refund is sent.
refundReviewRouter.post('/:id/verify',requireAdminCsrf,async(req:AuthenticatedRequest,res:Response,next:NextFunction)=>{
  if(process.env.REFUND_RECONCILIATION_ENABLED!=='true')return res.status(503).json({
    error:{code:'REFUND_RECONCILIATION_NOT_ACTIVATED',
      message:'Provider refund verification is not activated.'},
  });
  const caseResult=caseId.safeParse(req.params.id);
  const parsed=z.strictObject({expectedVersion:z.number().int().min(1)}).safeParse(req.body);
  if(!caseResult.success||!parsed.success)return res.status(400).json({error:{code:'INVALID_REFUND_VERIFICATION_REQUEST'}});
  try{
    res.json(await verifyReportedRefund(getDb(),{
      caseId:caseResult.data,expectedVersion:parsed.data.expectedVersion,actor:req.user!.username,
    }));
  }catch(error){handleError(error,res,next);}
});
