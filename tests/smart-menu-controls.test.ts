/** Isolated Smart Menu schema/policy tests; no external DB or Razorpay access. */
import {describe,it,expect} from 'vitest';
import {createClient} from '@libsql/client';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {DB_SCHEMA} from '../server/db/schema.ts';
import {MENU_CATALOG,SMART_MENU_CONTROLS_ENABLED} from '../shared/menuCatalog.ts';
import {
  getSmartMenuRules,menuRuleBlock,assertSmartMenuAvailable,validateSmartDay
} from '../server/services/smartMenuService.ts';

const migration=readFileSync(fileURLToPath(new URL('../server/db/migrations/20261016_smart_menu_controls.sql',import.meta.url)),'utf8');
const now=new Date('2026-10-16T03:30:00Z'); // 09:00 IST
describe('Smart Menu V1 isolated safety',()=>{
  it('is OFF by default, preserving exact 12 prior catalog items and stock limits',()=>{
    expect(SMART_MENU_CONTROLS_ENABLED).toBe(false);
    expect(MENU_CATALOG).toHaveLength(12);
    expect(MENU_CATALOG.find(i=>i.id==='idly')?.dailyPlateLimit).toBe(30);
    expect(MENU_CATALOG.find(i=>i.id==='jowar-roti')?.dailyPlateLimit).toBe(50);
    expect(MENU_CATALOG.some(i=>i.id==='uthappam')).toBe(false);
  });
  it('adds only two independent date-scoped tables, is repeatable and preserves prior schema',async()=>{
    const db=createClient({url:':memory:'});
    try{
      await db.executeMultiple(DB_SCHEMA);
      const before=(await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")).rows.map(x=>String(x.name)).sort();
      expect(DB_SCHEMA).not.toContain('smart_menu_days');
      await db.executeMultiple(migration);
      await db.executeMultiple(migration);
      const after=(await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")).rows.map(x=>String(x.name));
      expect(before.every(name=>after.includes(name))).toBe(true);
      expect(after.filter(name=>!before.includes(name)).sort()).toEqual(['smart_menu_days','smart_menu_item_pauses']);
      expect((await db.execute('PRAGMA integrity_check')).rows[0]?.integrity_check).toBe('ok');
      expect((await db.execute('PRAGMA foreign_key_check')).rows).toHaveLength(0);
    }finally{db.close();}
  });
  it('date/clock, pause, holiday and unscheduled curry fail closed',async()=>{
    const db=createClient({url:':memory:'});
    try {
      await db.executeMultiple(DB_SCHEMA);
      await db.executeMultiple(migration);
      const defaults=await getSmartMenuRules(db,'MORNING','2026-10-16',true);
      expect(defaults.closed).toBe(false);
      expect(menuRuleBlock(defaults,['idly'],now)).toBe(null);
      await expect(assertSmartMenuAvailable(db,'EVENING','2026-10-16',['curry-of-the-day'],now,true))
        .rejects.toThrow('not selected');
      await db.execute({sql:"INSERT INTO smart_menu_days(delivery_date,holiday_closed,holiday_reason,morning_cutoff_ist,evening_cutoff_ist,curry_name,curry_name_te,updated_by,updated_at_utc) VALUES(?,0,'',? ,NULL,?,?,?,?)",
        args:['2026-10-16','08:30','Vegetable Curry','కూర','owner',now.toISOString()]});
      const morning=await getSmartMenuRules(db,'MORNING','2026-10-16',true);
      expect(menuRuleBlock(morning,['idly'],now)).toContain('cutoff');
      await db.execute({sql:"INSERT INTO smart_menu_item_pauses(delivery_date,item_id,reason,updated_at_utc) VALUES(?,?,'INGREDIENT_SHORTAGE',?)",
        args:['2026-10-16','chapathi',now.toISOString()]});
      const evening=await getSmartMenuRules(db,'EVENING','2026-10-16',true);
      expect(menuRuleBlock(evening,['chapathi'],now)).toContain('unavailable');
      expect(menuRuleBlock(evening,['curry-of-the-day'],now)).toBe(null);
      await db.execute({sql:'UPDATE smart_menu_days SET holiday_closed=1 WHERE delivery_date=?',args:['2026-10-16']});
      const closed=await getSmartMenuRules(db,'EVENING','2026-10-16',true);
      expect(menuRuleBlock(closed,['curry-of-the-day'],now)).toContain('holiday');
    }finally{db.close();}
  });
  it('rejects stock changes, duplicate pauses and unsafe cutoff extensions',()=>{
    const candidate={
      holidayClosed:false,holidayReason:'',morningCutoffIst:null,
      eveningCutoffIst:null,curryName:'',curryNameTe:'',
      pauses:[] as {itemId:string;reason:'PAUSED'|'INGREDIENT_SHORTAGE'}[],
    };
    expect(()=>validateSmartDay('2026-10-17',candidate,now)).not.toThrow();
    expect(()=>validateSmartDay('2026-10-17',{...candidate,morningCutoffIst:'11:15'},now)).toThrow();
    expect(()=>validateSmartDay('2026-10-17',{...candidate,eveningCutoffIst:'20:00'},now)).toThrow();
    expect(()=>validateSmartDay('2026-10-17',{...candidate,pauses:[
      {itemId:'idly',reason:'PAUSED'},{itemId:'idly',reason:'INGREDIENT_SHORTAGE'}
    ]},now)).toThrow();
    expect(()=>validateSmartDay('2026-10-15',candidate,now)).toThrow();
  });
});
