/** In-memory Smart Menu ON acceptance; NEVER connects to Turso, Razorpay or Vercel. */
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { createClient, type Client } from '@libsql/client';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DB_SCHEMA } from '../server/db/schema.ts';
import type { NewMenuPricing } from '../server/services/newMenuCheckoutService.ts';

const migration = readFileSync(fileURLToPath(new URL('../server/db/migrations/20261016_smart_menu_controls.sql', import.meta.url)), 'utf8');
const date = '2026-10-17'; // Saturday, non-holiday and future relative to the test clock
const now = new Date('2026-10-16T03:30:00.000Z'); // 9 AM IST
let menu: typeof import('../shared/menuCatalog.ts');
let rules: typeof import('../server/services/smartMenuService.ts');
let stock: typeof import('../server/services/menuStockService.ts');

async function isolatedDb(): Promise<Client> {
  const db = createClient({ url: ':memory:' });
  await db.executeMultiple(DB_SCHEMA);
  await db.executeMultiple(migration);
  return db;
}
async function saveCurry(db: Client, nameEn: string, nameTe = ''): Promise<void> {
  await db.execute({
    sql: `INSERT INTO smart_menu_days
      (delivery_date, holiday_closed, holiday_reason, morning_cutoff_ist, evening_cutoff_ist,
       curry_name, curry_name_te, updated_by, updated_at_utc)
      VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(delivery_date) DO UPDATE SET
      curry_name=excluded.curry_name,curry_name_te=excluded.curry_name_te`,
    args: [date, 0, '', null, null, nameEn, nameTe, 'isolated-test-owner', now.toISOString()],
  });
}
function getItem(id:string) {
  const item=menu.MENU_CATALOG.find(x=>x.id===id);
  if (!item) throw new Error('Required test menu item missing: '+id);
  return item;
}
function curryQuote(): NewMenuPricing {
  const item=getItem('curry-of-the-day');
  return {
    period: 'EVENING', deliveryDateIst:date, deliveryWindow:'18:00-20:00',
    earliestEligibleDeliveryUtc:'2026-10-17T12:30:00.000Z',
    items:[{item,quantity:2,lineTotalPaisa:10000}],
    totalUnits:2,subtotalPaisa:10000,deliveryChargePaisa:0,
    totalAmountPaisa:10000,distanceKm:2,
  };
}

beforeAll(async()=>{
  // The production deployment never receives these temporary CI-only variables.
  vi.stubEnv('SMART_MENU_CONTROLS_ENABLED','true');
  vi.stubEnv('SMART_MENU_SCHEMA_READY','true');
  vi.resetModules();
  menu=await import('../shared/menuCatalog.ts');
  rules=await import('../server/services/smartMenuService.ts');
  stock=await import('../server/services/menuStockService.ts');
});
afterAll(()=>{
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('Smart Menu controls explicit ON, isolated ephemeral SQLite',()=>{
  it('enables exactly the two approved menu items and preserves prior daily caps',()=>{
    expect(menu.SMART_MENU_CONTROLS_ENABLED).toBe(true);
    expect(menu.MENU_CATALOG).toHaveLength(14);
    const uthappam=getItem('uthappam');
    expect([uthappam.nameEn,uthappam.nameTe,uthappam.mealPeriod]).toEqual(['Uthappam','ఉత్తప్పం','MORNING']);
    expect([uthappam.pricePaisa,uthappam.saleUnit,uthappam.piecesPerUnit,uthappam.dailyPlateLimit])
      .toEqual([3000,'PLATE',2,30]);
    const curry=getItem('curry-of-the-day');
    expect([curry.nameEn,curry.mealPeriod,curry.saleUnit,curry.gramsPerUnit,curry.pricePaisa,curry.dailyPlateLimit])
      .toEqual(['Curry of the Day','EVENING','PACK',100,5000,30]);
    expect(getItem('idly').dailyPlateLimit).toBe(30);
    expect(getItem('jowar-roti').dailyPlateLimit).toBe(50);
    expect(getItem('chapathi').minimumQuantity).toBe(3);
  });
  it('checks actual inventory for both new items and does not silently seed stock reservations',async()=>{
    const db=await isolatedDb();
    try {
      expect(await stock.getMenuStockRemaining(db,'uthappam',date,now.getTime())).toBe(30);
      expect(await stock.getMenuStockRemaining(db,'curry-of-the-day',date,now.getTime())).toBe(30);
      expect(Number((await db.execute('SELECT COUNT(*) AS n FROM menu_stock_reservations')).rows[0]?.n)).toBe(0);
      expect((await db.execute('PRAGMA integrity_check')).rows[0]?.integrity_check).toBe('ok');
      expect((await db.execute('PRAGMA foreign_key_check')).rows).toHaveLength(0);
    } finally {db.close();}
  });
  it('requires owner-selected daily curry and snapshots the selected name',async()=>{
    const db=await isolatedDb();
    try {
      await expect(rules.assertSmartMenuAvailable(db,'EVENING',date,['curry-of-the-day'],now))
        .rejects.toThrow('not selected');
      await saveCurry(db,'Tomato Curry','టమాటా కూర');
      const quote=curryQuote();
      const token=await rules.applyCurrySnapshot(db,quote,date+':Tomato Curry');
      expect(token).toBe(date+':Tomato Curry');
      expect(quote.items[0]?.item.nameEn).toBe('Tomato Curry');
      expect(quote.items[0]?.item.nameTe).toBe('టమాటా కూర');
      await saveCurry(db,'Palakura Curry','పాలకూర కూర');
      await expect(rules.applyCurrySnapshot(db,curryQuote(),date+':Tomato Curry')).rejects.toThrow('changed');
      expect((await db.execute('SELECT COUNT(*) AS n FROM orders')).rows[0]?.n).toBe(0);
    } finally {db.close();}
  });
  it('halts future orders on shortages, pauses, holidays and owner cutoff',async()=>{
    const db=await isolatedDb();
    try {
      await saveCurry(db,'Tomato Curry');
      expect(await rules.assertSmartMenuAvailable(db,'MORNING',date,['uthappam'],now)).toBeDefined();
      await db.execute({
        sql:'INSERT INTO smart_menu_item_pauses(delivery_date,item_id,reason,updated_at_utc) VALUES (?,?,?,?)',
        args:[date,'uthappam','INGREDIENT_SHORTAGE',now.toISOString()]
      });
      await expect(rules.assertSmartMenuAvailable(db,'MORNING',date,['uthappam'],now))
        .rejects.toThrow('unavailable');
      await db.execute({sql:'DELETE FROM smart_menu_item_pauses WHERE delivery_date=?',args:[date]});
      await db.execute({sql:'UPDATE smart_menu_days SET holiday_closed=1 WHERE delivery_date=?',args:[date]});
      await expect(rules.assertSmartMenuAvailable(db,'EVENING',date,['curry-of-the-day'],now))
        .rejects.toThrow('holiday');
      await db.execute({sql:'UPDATE smart_menu_days SET holiday_closed=0,morning_cutoff_ist=? WHERE delivery_date=?',args:['08:30',date]});
      const onDate=new Date('2026-10-17T03:30:00.000Z'); // 9 AM IST, after 08:30
      await expect(rules.assertSmartMenuAvailable(db,'MORNING',date,['uthappam'],onDate))
        .rejects.toThrow('cutoff');
      expect(await rules.assertSmartMenuAvailable(db,'EVENING',date,['curry-of-the-day'],now)).toBeDefined();
    } finally {db.close();}
  });
});
