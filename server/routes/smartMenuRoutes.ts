/** Strict ADMIN-only opt-in Smart Menu controls. No automatic migration. */
import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { getDb } from '../db/index.ts';
import { requireAuth,requireRole,requireAdminCsrf,type AuthenticatedRequest } from '../auth/index.ts';
import { MENU_CATALOG,SMART_MENU_CONTROLS_ENABLED } from '../../shared/menuCatalog.ts';
import { getSmartMenuRules,validateSmartDay,validMenuDate,istDateTime } from '../services/smartMenuService.ts';

export const smartMenuRouter=Router();
smartMenuRouter.use(requireAuth,requireRole(['ADMIN']));
smartMenuRouter.use((_req,res,next)=>{
  if (!SMART_MENU_CONTROLS_ENABLED) return res.status(503).json({error:'Smart Menu controls are not activated'});
  next();
});
const dateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const inputSchema=z.strictObject({
  holidayClosed:z.boolean(),
  holidayReason:z.string().max(120),
  morningCutoffIst:z.string().nullable(),
  eveningCutoffIst:z.string().nullable(),
  curryName:z.string().max(60),
  curryNameTe:z.string().max(60),
  pauses:z.array(z.strictObject({
    itemId:z.string().max(64),
    reason:z.enum(['PAUSED','INGREDIENT_SHORTAGE'])
  })).max(MENU_CATALOG.length)
});
smartMenuRouter.get('/options',async(_req,res)=>{
  try {
    const result=await getDb().execute("SELECT DISTINCT curry_name FROM smart_menu_days WHERE curry_name<>'' ORDER BY updated_at_utc DESC LIMIT 40");
    res.setHeader('Cache-Control','no-store');
    return res.json({options:result.rows.map(row=>String(row.curry_name))});
  } catch {return res.status(503).json({error:'Menu configuration unavailable'});}
});
smartMenuRouter.get('/:date',async(req,res)=>{
  const date=String(req.params.date);
  if (!dateSchema.safeParse(date).success || !validMenuDate(date)) return res.status(400).json({error:'Invalid delivery date'});
  try {
    const db=getDb();
    const [m,e]=await Promise.all([getSmartMenuRules(db,'MORNING',date),getSmartMenuRules(db,'EVENING',date)]);
    res.setHeader('Cache-Control','no-store');
    return res.json({
      date,holidayClosed:m.closed,holidayReason:m.holidayReason,
      morningCutoffIst:m.cutoffIst,eveningCutoffIst:e.cutoffIst,
      curryName:e.curryName||'',curryNameTe:e.curryNameTe||'',
      pauses:Object.entries(m.pauses).map(([itemId,reason])=>({itemId,reason}))
    });
  } catch {return res.status(503).json({error:'Menu configuration unavailable'});}
});
smartMenuRouter.put('/:date',requireAdminCsrf,async(req:AuthenticatedRequest,res)=>{
  const date=String(req.params.date);
  const parsed=inputSchema.safeParse(req.body);
  if (!parsed.success || !dateSchema.safeParse(date).success) return res.status(400).json({error:'Invalid menu configuration'});
  try {validateSmartDay(date,parsed.data);} catch(e) {
    return res.status(400).json({error:e instanceof Error?e.message:'Invalid date'});
  }
  const actor=req.user!.username;
  const now=new Date().toISOString(),d=parsed.data;
  const db=getDb(),tx=await db.transaction('write');
  try {
    if (date<istDateTime(new Date()).date) throw new Error('Past date');
    await tx.execute({sql:[
      'INSERT INTO smart_menu_days',
      '(delivery_date,holiday_closed,holiday_reason,morning_cutoff_ist,evening_cutoff_ist,curry_name,curry_name_te,updated_by,updated_at_utc)',
      'VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(delivery_date) DO UPDATE SET',
      'holiday_closed=excluded.holiday_closed,holiday_reason=excluded.holiday_reason,',
      'morning_cutoff_ist=excluded.morning_cutoff_ist,evening_cutoff_ist=excluded.evening_cutoff_ist,',
      'curry_name=excluded.curry_name,curry_name_te=excluded.curry_name_te,',
      'updated_by=excluded.updated_by,updated_at_utc=excluded.updated_at_utc'
      ].join(' '),
      args:[date,d.holidayClosed?1:0,d.holidayReason,d.morningCutoffIst,d.eveningCutoffIst,d.curryName,d.curryNameTe,actor,now]});
    await tx.execute({sql:'DELETE FROM smart_menu_item_pauses WHERE delivery_date=?',args:[date]});
    for (const pause of d.pauses) await tx.execute({
      sql:'INSERT INTO smart_menu_item_pauses(delivery_date,item_id,reason,updated_at_utc) VALUES (?,?,?,?)',
      args:[date,pause.itemId,pause.reason,now]
    });
    await tx.execute({sql:'INSERT INTO audit_logs(id,actor_type,actor_id,action,target_type,target_id,details,created_at) VALUES (?,?,?,?,?,?,?,?)',
      args:['AUD-'+crypto.randomUUID(),'ADMIN',actor,'SMART_MENU_UPDATED','DELIVERY_DATE',date,
        JSON.stringify({holidayClosed:d.holidayClosed,pausedItems:d.pauses.length,currySelected:!!d.curryName,
          morningCutoff:d.morningCutoffIst,eveningCutoff:d.eveningCutoffIst}),now]});
    await tx.commit();
    return res.json({saved:true,date});
  } catch {
    await tx.rollback().catch(()=>{});
    return res.status(503).json({error:'Menu save failed. No changes committed.'});
  } finally {tx.close();}
});
