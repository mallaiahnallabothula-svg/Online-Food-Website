import { describe, it, expect } from 'vitest';
import { createClient } from '@libsql/client';
import { DB_SCHEMA } from '../server/db/schema';
import { PAPPU_VARIETIES, pappuForDate } from '../shared/pappu';
import { createPendingNewMenuCheckout, priceNewMenuCheckout } from '../server/services/newMenuCheckoutService';
import { resolvePappu } from '../server/services/pappuService';
import { getMenuStockRemaining } from '../server/services/menuStockService';
import { loadOwnerOrderCompatibility } from '../server/services/ownerMenuCompatibilityService';
const now = new Date('2026-10-12T06:00:00Z');
const customer = { name:'Menu Tester', mobile:'9000000001', address:'Kollur test address', latitude:17.485, longitude:78.235 };
const request = (lines: {itemId:string;quantity:number}[]) => ({lines,customer});
async function fixture() { const db=createClient({url:':memory:'}); for(const sql of DB_SCHEMA.split(';').filter(s=>s.trim())) await db.execute(sql); return db; }
describe('confirmed twelve-item menu', () => {
 it('prices both confirmed examples and rejects mixed sessions / subminimum pieces', () => {
  expect(priceNewMenuCheckout(request([{itemId:'jowar-roti',quantity:3},{itemId:'pappu-of-the-day',quantity:1}]),now).subtotalPaisa).toBe(12000);
  expect(priceNewMenuCheckout(request([{itemId:'chapathi',quantity:6},{itemId:'mixed-veg-kurma',quantity:1}]),now).subtotalPaisa).toBe(10000);
  expect(()=>priceNewMenuCheckout(request([{itemId:'jowar-roti',quantity:2},{itemId:'pappu-of-the-day',quantity:2}]),now)).toThrow('quantity');
  expect(()=>priceNewMenuCheckout(request([{itemId:'idly',quantity:4},{itemId:'pappu-of-the-day',quantity:1}]),now)).toThrow('separately');
 });
 it('uses delivery-date rotation with Wednesday closed', () => {
  expect(Array.from({length:7},(_,i)=>pappuForDate('2026-10-'+(12+i)))).toEqual(['TOMATO','PALAKURA',null,'TOMATO','PALAKURA','THOTAKURA','THOTAKURA']);
 });
 it('snapshots owner overrides, retains one shared pappu stock and rejects stale quotes', async () => {
  const db=await fixture(); try {
   const cart=request([{itemId:'jowar-roti',quantity:3},{itemId:'pappu-of-the-day',quantity:1}]);
   const first=await createPendingNewMenuCheckout(db,{...cart,expectedPappu:'2026-10-12:TOMATO'},now);
   await db.execute("INSERT INTO menu_pappu_overrides VALUES ('2026-10-12','PALAKURA','2026-10-12T06:00:00Z')");
   expect(await resolvePappu(db,'2026-10-12')).toBe('PALAKURA');
   await expect(createPendingNewMenuCheckout(db,{...cart,expectedPappu:'2026-10-12:TOMATO'},now)).rejects.toThrow('fresh quote');
   await createPendingNewMenuCheckout(db,{...cart,expectedPappu:'2026-10-12:PALAKURA'},now);
   expect(await getMenuStockRemaining(db,'pappu-of-the-day','2026-10-12',now.getTime())).toBe(28);
   const saved=await loadOwnerOrderCompatibility(db,first.orderId);
   expect(saved?.lines.find(line=>line.itemId==='pappu-of-the-day')).toMatchObject({nameEn:PAPPU_VARIETIES.TOMATO.nameEn,saleUnit:'PACK',quantity:1});
  } finally { db.close(); }
 });
 it('enforces 50 pieces and 30 curry packs atomically, independently by delivery date', async () => {
  const db=await fixture(); try {
   await createPendingNewMenuCheckout(db,request([{itemId:'jowar-roti',quantity:48},{itemId:'mixed-veg-kurma',quantity:30}]),now);
   await expect(createPendingNewMenuCheckout(db,request([{itemId:'jowar-roti',quantity:3},{itemId:'pappu-of-the-day',quantity:1}]),now)).rejects.toThrow('OUT_OF_STOCK');
   await expect(createPendingNewMenuCheckout(db,request([{itemId:'chapathi',quantity:6},{itemId:'mixed-veg-kurma',quantity:1}]),now)).rejects.toThrow('OUT_OF_STOCK');
   expect(await getMenuStockRemaining(db,'jowar-roti','2026-10-13',now.getTime())).toBe(50);
   expect((await db.execute('SELECT COUNT(*) n FROM orders')).rows[0]?.n).toBe(1);
  } finally { db.close(); }
 });
});
