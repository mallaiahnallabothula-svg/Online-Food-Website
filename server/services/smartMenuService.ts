/** Opt-in owner schedule: persisted date-scoped controls. Fail-closed when enabled. */
import type { Client, Transaction } from '@libsql/client';
import type { NewMenuPricing } from './newMenuCheckoutService.ts';
import { MENU_CATALOG, SMART_MENU_CONTROLS_ENABLED, type MealPeriod } from '../../shared/menuCatalog.ts';

type Db = Client | Transaction;
export type PauseReason = 'PAUSED' | 'INGREDIENT_SHORTAGE';
export interface MenuRules {
  readonly date: string;
  readonly closed: boolean;
  readonly holidayReason: string;
  readonly cutoffIst: string | null;
  readonly curryName: string | null;
  readonly curryNameTe: string | null;
  readonly pauses: Record<string,PauseReason>;
}
export interface SmartMenuDayInput {
  readonly holidayClosed: boolean;
  readonly holidayReason: string;
  readonly morningCutoffIst: string | null;
  readonly eveningCutoffIst: string | null;
  readonly curryName: string;
  readonly curryNameTe: string;
  readonly pauses: readonly {itemId:string;reason:PauseReason}[];
}
export function validMenuDate(date:string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date+'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10)===date;
}
export function istDateTime(date:Date): {date:string;clock:string} {
  const d = new Date(date.getTime()+330*60_000).toISOString();
  return {date:d.slice(0,10),clock:d.slice(11,16)};
}
const clockValid=(v:string|null,limit:string)=>v===null || (/^([01]\d|2[0-3]):[0-5]\d$/.test(v) && v<=limit);
const nameValid=(v:string)=>v==='' || (v.length<=60 && v.trim()===v && /^[\p{L}\p{M}\p{N} .,'()-]+$/u.test(v));
export function validateSmartDay(date:string,data:SmartMenuDayInput,now:Date=new Date()): void {
  if (!validMenuDate(date) || date<istDateTime(now).date) throw new Error('Past or invalid delivery date');
  if (typeof data?.holidayClosed!=='boolean' || typeof data.holidayReason!=='string' || data.holidayReason.length>120 ||
      !clockValid(data.morningCutoffIst,'10:30') || !clockValid(data.eveningCutoffIst,'19:30') ||
      typeof data.curryName!=='string' || typeof data.curryNameTe!=='string' ||
      !nameValid(data.curryName) || !nameValid(data.curryNameTe) ||
      !Array.isArray(data.pauses) || data.pauses.length>MENU_CATALOG.length) throw new Error('Invalid menu configuration');
  const seen=new Set<string>();
  for (const pause of data.pauses) {
    if (!pause || !MENU_CATALOG.some(item=>item.id===pause.itemId) ||
        (pause.reason!=='PAUSED' && pause.reason!=='INGREDIENT_SHORTAGE') || seen.has(pause.itemId))
      throw new Error('Invalid or duplicate item pause');
    seen.add(pause.itemId);
  }
  if (!data.curryName && data.curryNameTe) throw new Error('Set curry name before Telugu label');
}
export async function getSmartMenuRules(db:Db,period:MealPeriod,date:string,enabled=SMART_MENU_CONTROLS_ENABLED):Promise<MenuRules>{
  if (!validMenuDate(date)) throw new Error('Invalid date');
  if (!enabled) return {date,closed:false,holidayReason:'',cutoffIst:null,curryName:null,curryNameTe:null,pauses:{}};
  const [day,pauses]=await Promise.all([
    db.execute({sql:'SELECT * FROM smart_menu_days WHERE delivery_date=?',args:[date]}),
    db.execute({sql:'SELECT item_id,reason FROM smart_menu_item_pauses WHERE delivery_date=?',args:[date]})
  ]);
  const d=day.rows[0],p:Record<string,PauseReason>={};
  for (const row of pauses.rows) {
    const reason=String(row.reason);
    if (reason!=='PAUSED' && reason!=='INGREDIENT_SHORTAGE') throw new Error('Invalid stored pause');
    p[String(row.item_id)]=reason;
  }
  const cutoff=d?(period==='MORNING'?d.morning_cutoff_ist:d.evening_cutoff_ist):null;
  return {
    date,closed:Number(d?.holiday_closed??0)===1,holidayReason:String(d?.holiday_reason??''),
    cutoffIst:cutoff===null?null:String(cutoff),
    curryName:String(d?.curry_name??'')||null,curryNameTe:String(d?.curry_name_te??'')||null,pauses:p
  };
}
export function menuRuleBlock(rules:MenuRules,itemIds:readonly string[],now:Date):string|null {
  if (rules.closed) return 'Special holiday: new orders are closed';
  const clock=istDateTime(now);
  // Earlier owner cutoff is permitted. Normal 30-minute lead/window still applies separately.
  if (clock.date===rules.date && rules.cutoffIst && clock.clock>=rules.cutoffIst) return 'Owner cutoff has passed';
  for (const id of itemIds) {
    if (rules.pauses[id]) return 'Menu item temporarily unavailable';
    if (id==='curry-of-the-day' && !rules.curryName) return 'Owner has not selected the daily curry';
  }
  return null;
}
export async function assertSmartMenuAvailable(
  db:Db, period:MealPeriod, date:string, itemIds:readonly string[],now:Date=new Date(),
  enabled=SMART_MENU_CONTROLS_ENABLED
):Promise<MenuRules> {
  const rules=await getSmartMenuRules(db,period,date,enabled);
  if (enabled) {
    const block=menuRuleBlock(rules,itemIds,now);
    if (block) throw new Error(block);
  }
  return rules;
}
export async function applyCurrySnapshot(
  db:Db,pricing:NewMenuPricing,
  expected?:string,enabled=SMART_MENU_CONTROLS_ENABLED
):Promise<string|undefined>{
  const line=pricing.items.find(x=>x.item.id==='curry-of-the-day');
  if (!line || !enabled) return undefined;
  const r=await assertSmartMenuAvailable(db,pricing.period,pricing.deliveryDateIst,pricing.items.map(x=>x.item.id),new Date(),enabled);
  if (!r.curryName) throw new Error('Curry has not been selected');
  const token=pricing.deliveryDateIst+':'+r.curryName;
  if (expected!==undefined && expected!==token) throw new Error('Daily curry changed; request a fresh quote');
  line.item={...line.item,nameEn:r.curryName,nameTe:r.curryNameTe||r.curryName};
  return token;
}
export async function isPendingOrderMenuOpen(db:Db,orderId:string,now:Date=new Date()):Promise<void>{
  if (!SMART_MENU_CONTROLS_ENABLED) return;
  const orders=await db.execute({sql:'SELECT delivery_date FROM orders WHERE id=? AND payment_status=\'PENDING\' LIMIT 1',args:[orderId]});
  const date=String(orders.rows[0]?.delivery_date??'');
  if (!validMenuDate(date)) throw new Error('Pending order not available');
  const lines=await db.execute({sql:'SELECT item_id,meal_period FROM order_items WHERE order_id=?',args:[orderId]});
  if (!lines.rows.length) throw new Error('No order items');
  const p=String(lines.rows[0]?.meal_period);
  if (p!=='MORNING'&&p!=='EVENING') throw new Error('Invalid meal period');
  await assertSmartMenuAvailable(db,p,date,lines.rows.map(row=>String(row.item_id)),now);
}
