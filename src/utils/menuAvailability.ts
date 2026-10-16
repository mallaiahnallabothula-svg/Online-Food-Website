import { getNextPreorderDeliverySlot } from '../../shared/preorderScheduling.ts';
import { MENU_CATALOG, SMART_MENU_CONTROLS_ENABLED, type MealPeriod, type MenuItem } from '../../shared/menuCatalog.ts';
import { PAPPU_VARIETIES, type PappuVariety } from '../../shared/pappu.ts';

export type MenuStatus = 'available' | 'sold-out' | 'preorder' | 'unavailable' | 'checking' | 'error';
export interface VerifiedMenuStatus {
  readonly period: MealPeriod;
  readonly deliveryDateIst: string;
  readonly pappu: PappuVariety | null;
  readonly stock: Record<string, number>;
  readonly orderingEnabled: boolean;
  readonly checkedAt: number;
  readonly closed: boolean;
  readonly unavailableItemIds: readonly string[];
  readonly curryName: string | null;
  readonly curryNameTe: string | null;
}
export const STATUS_RECHECK_MS = 120_000;

/** Fail closed: never show a stock claim from malformed, out-of-period, or stale API data. */
export function validateMenuStatus(data: unknown, period: MealPeriod, now: Date): VerifiedMenuStatus | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (typeof d.orderingEnabled !== 'boolean' ||
    d.deliveryDateIst !== getNextPreorderDeliverySlot(period, now).deliveryDateIst ||
    !d.stock || typeof d.stock !== 'object' || Array.isArray(d.stock)) return null;
  if (d.pappu !== null && !(typeof d.pappu === 'string' && Object.prototype.hasOwnProperty.call(PAPPU_VARIETIES, d.pappu))) return null;
  if (SMART_MENU_CONTROLS_ENABLED && (
      typeof d.closed !== 'boolean' || !Array.isArray(d.unavailableItemIds) ||
      d.unavailableItemIds.some((id:unknown)=>typeof id!=='string' || !MENU_CATALOG.some(item=>item.id===id)) ||
      (d.curryName!==null && (typeof d.curryName!=='string' || d.curryName.length>60)) ||
      (d.curryNameTe!==null && (typeof d.curryNameTe!=='string' || d.curryNameTe.length>60))
    )) return null;
  const stock = d.stock as Record<string, unknown>;
  for (const item of MENU_CATALOG.filter(x => x.mealPeriod === period)) {
    const amount = stock[item.id];
    if (!Number.isSafeInteger(amount) || (amount as number) < 0 ||
      item.dailyPlateLimit === null || (amount as number) > item.dailyPlateLimit) return null;
  }
  return { period, deliveryDateIst:d.deliveryDateIst as string,
    pappu:d.pappu as PappuVariety | null,
    stock:stock as Record<string,number>, orderingEnabled:d.orderingEnabled,
    checkedAt:now.getTime(),
    closed:SMART_MENU_CONTROLS_ENABLED ? d.closed as boolean : false,
    unavailableItemIds:SMART_MENU_CONTROLS_ENABLED ? d.unavailableItemIds as string[] : [],
    curryName:SMART_MENU_CONTROLS_ENABLED ? d.curryName as string|null : null,
    curryNameTe:SMART_MENU_CONTROLS_ENABLED ? d.curryNameTe as string|null : null };
}

/** Closed legacy kitchen hours never override the valid future preorder window. */
export function availabilityForItem(item: MenuItem, launchEnabled: boolean,
  snapshot: VerifiedMenuStatus | null, hasError: boolean, now: Date): MenuStatus {
  if (!launchEnabled) return 'unavailable';
  if (hasError) return 'error';
  if (!snapshot || snapshot.period !== item.mealPeriod ||
    snapshot.deliveryDateIst !== getNextPreorderDeliverySlot(item.mealPeriod, now).deliveryDateIst ||
    now.getTime() - snapshot.checkedAt >= STATUS_RECHECK_MS ||
    now.getTime() < snapshot.checkedAt) return 'checking';
  if (!snapshot.orderingEnabled || snapshot.closed ||
    snapshot.unavailableItemIds.includes(item.id) ||
    (item.id==='curry-of-the-day' && !snapshot.curryName)) return 'unavailable';
  const remaining = snapshot.stock[item.id];
  if (typeof remaining !== 'number' || !Number.isSafeInteger(remaining) || remaining < 0) return 'error';
  if (remaining < item.minimumQuantity) return 'sold-out';
  const istToday = new Date(now.getTime() + 330*60_000).toISOString().slice(0,10);
  return snapshot.deliveryDateIst > istToday ? 'preorder' : 'available';
}

export const statusLabels: Record<MenuStatus, { en:string; te:string }> = {
  available:{en:'Available',te:'అందుబాటులో ఉంది'},
  'sold-out':{en:'Sold Out',te:'స్టాక్ అయిపోయింది'},
  preorder:{en:'Pre-order Available',te:'ముందస్తు ఆర్డర్ అందుబాటులో ఉంది'},
  unavailable:{en:'Ordering Unavailable',te:'ఆర్డర్లు అందుబాటులో లేవు'},
  checking:{en:'Checking availability',te:'స్టాక్ తనిఖీ చేస్తున్నాం'},
  error:{en:'Unable to Verify',te:'స్టాక్ తనిఖీ సాధ్యం కాలేదు'}
};
