/** @vitest-environment node */
/** Owner API acceptance using real Express/auth and ephemeral SQLite; NO Turso credentials. */
import 'express-async-errors';
import crypto from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient, type Client } from '@libsql/client';
import { beforeAll, beforeEach, afterEach, afterAll, describe, expect, it, vi } from 'vitest';
import { DB_SCHEMA } from '../server/db/schema.ts';
import type { createExpressApp as createAppType } from '../server/app.ts';

const dbRef = vi.hoisted(() => ({ db: null as Client | null }));
vi.mock('../server/db/index.ts', () => ({
  getDb: () => { if (!dbRef.db) throw new Error('Isolated DB not configured'); return dbRef.db; },
  withDbRetry: async <T>(fn: () => Promise<T>) => fn(),
}));
const migration = readFileSync(fileURLToPath(new URL('../server/db/migrations/20261016_smart_menu_controls.sql', import.meta.url)), 'utf8');
const tomorrow = new Date(Date.now() + 330 * 60_000 + 86400_000).toISOString().slice(0,10);
let db: Client;
let createApp: typeof createAppType;
const config = (patch: Record<string,unknown> = {}) => ({
  holidayClosed: false, holidayReason: '',
  morningCutoffIst: null, eveningCutoffIst: null,
  curryName: 'Tomato Curry', curryNameTe: 'టమాటా కూర',
  pauses: [], ...patch,
});

async function session(role:'ADMIN'|'STAFF'):Promise<string> {
  const id = 'USR-' + crypto.randomUUID();
  const secret = crypto.randomBytes(32).toString('hex');
  const username = role.toLowerCase()+'-'+crypto.randomBytes(4).toString('hex');
  await db.execute({sql:'INSERT INTO admin_users(id,username,password_hash,role,name,created_at) VALUES(?,?,?,?,?,?)',
    args:[id,username,'test-password-unused',role,'Isolated',new Date().toISOString()]});
  await db.execute({sql:'INSERT INTO admin_sessions(id,session_token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?,?)',
    args:['SESS-'+crypto.randomUUID(),crypto.createHash('sha256').update(secret).digest('hex'),id,
      new Date(Date.now()+600_000).toISOString(),new Date().toISOString()]});
  return secret;
}

async function http(work:(base:string)=>Promise<void>):Promise<void> {
  const server:Server=createApp().listen(0,'127.0.0.1');
  try {
    if (!server.listening) await new Promise<void>((ok,no)=>{server.once('listening',ok);server.once('error',no)});
    await work('http://127.0.0.1:'+(server.address() as AddressInfo).port);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((ok,no)=>server.close(err=>err?no(err):ok()));
  }
}
function call(base:string,date:string,token='',method:'GET'|'PUT'='GET',body?:unknown,extra:Record<string,string>={}) {
  return fetch(base+'/api/admin/smart-menu/'+date,{
    method, headers:{
      ...(token?{cookie:'admin_session='+token}:{}),
      'x-requested-with':'XMLHttpRequest',
      ...(method==='PUT'?{'content-type':'application/json'}:{}),
      ...extra,
    },
    ...(body!==undefined?{body:JSON.stringify(body)}:{}),
  });
}
const count=async(table:'orders'|'payments'|'menu_stock_reservations'|'smart_menu_item_pauses')=>
  Number((await db.execute('SELECT COUNT(*) AS n FROM '+table)).rows[0]?.n);

beforeAll(async()=>{
  vi.stubEnv('SMART_MENU_CONTROLS_ENABLED','true');
  vi.stubEnv('SMART_MENU_SCHEMA_READY','true');
  vi.resetModules();
  ({createExpressApp:createApp}=await import('../server/app.ts'));
});
beforeEach(async()=>{
  db=createClient({url:':memory:'}); dbRef.db=db;
  await db.executeMultiple(DB_SCHEMA);
  await db.executeMultiple(migration);
});
afterEach(()=>{dbRef.db=null;db.close();});
afterAll(()=>{vi.unstubAllEnvs();vi.resetModules();});

describe('Stage 2B authenticated Smart Menu owner API / isolated in-memory DB',()=>{
  it('rejects anonymous GET, STAFF GET/PUT, CSRF mutation without changing rows',async()=>{
    const staff=await session('STAFF'), owner=await session('ADMIN');
    await http(async base=>{
      expect((await call(base,tomorrow)).status).toBe(401);
      expect((await call(base,tomorrow,staff)).status).toBe(403);
      expect((await call(base,tomorrow,staff,'PUT',config())).status).toBe(403);
      expect((await call(base,tomorrow,owner,'PUT',config(),{'sec-fetch-site':'cross-site'})).status).toBe(403);
    });
    expect(Number((await db.execute('SELECT COUNT(*) n FROM smart_menu_days')).rows[0]?.n)).toBe(0);
    expect(await count('smart_menu_item_pauses')).toBe(0);
  });

  it('saves daily curry, holiday, earlier cutoffs and item shortages; readback and audit are consistent',async()=>{
    const owner=await session('ADMIN');
    const initial=config({holidayClosed:true,holidayReason:'Special closure',
      morningCutoffIst:'09:45',eveningCutoffIst:'18:30',
      pauses:[{itemId:'uthappam',reason:'INGREDIENT_SHORTAGE'},{itemId:'chapathi',reason:'PAUSED'}]});
    await http(async base=>{
      const saved=await call(base,tomorrow,owner,'PUT',initial);
      expect(saved.status).toBe(200);
      expect((await saved.json()).saved).toBe(true);
      const read=await call(base,tomorrow,owner);
      expect(read.status).toBe(200);
      expect(await read.json()).toMatchObject({...initial,date:tomorrow});
      const opts=await call(base,'options',owner);
      expect(opts.status).toBe(200);
      expect((await opts.json()).options).toContain('Tomato Curry');
    });
    expect(Number((await db.execute('SELECT COUNT(*) n FROM audit_logs WHERE action=\'SMART_MENU_UPDATED\'')).rows[0]?.n)).toBe(1);
    expect(await count('smart_menu_item_pauses')).toBe(2);
    expect(await count('orders')).toBe(0);
    expect(await count('payments')).toBe(0);
    expect(await count('menu_stock_reservations')).toBe(0);
    expect((await db.execute('PRAGMA integrity_check')).rows[0]?.integrity_check).toBe('ok');
    expect((await db.execute('PRAGMA foreign_key_check')).rows).toHaveLength(0);
  });

  it('resumes item, changes daily curry by date; saves without mutating other days',async()=>{
    const owner=await session('ADMIN');
    const secondDay=new Date(Date.now()+330*60_000+2*86400_000).toISOString().slice(0,10);
    await http(async base=>{
      expect((await call(base,tomorrow,owner,'PUT',config({pauses:[{itemId:'idly',reason:'PAUSED'}]}))).status).toBe(200);
      expect((await call(base,secondDay,owner,'PUT',config({curryName:'Dal Curry',curryNameTe:'పప్పు కూర'}))).status).toBe(200);
      expect((await call(base,tomorrow,owner,'PUT',config({curryName:'Tomato Curry',pauses:[]}))).status).toBe(200);
      expect((await (await call(base,tomorrow,owner)).json()).pauses).toEqual([]);
      expect((await (await call(base,secondDay,owner)).json()).curryName).toBe('Dal Curry');
      const opts=(await (await call(base,'options',owner)).json()).options;
      expect(opts).toEqual(expect.arrayContaining(['Tomato Curry','Dal Curry']));
    });
    expect(await count('smart_menu_item_pauses')).toBe(0);
  });

  it('invalid/unsafe requests do not save (past dates, extra fields, stock edits, invalid cutoffs)',async()=>{
    const owner=await session('ADMIN');
    const past=new Date(Date.now()+330*60_000-86400_000).toISOString().slice(0,10);
    await http(async base=>{
      expect((await call(base,past,owner,'PUT',config())).status).toBe(400);
      expect((await call(base,tomorrow,owner,'PUT',config({morningCutoffIst:'11:00'}))).status).toBe(400);
      expect((await call(base,tomorrow,owner,'PUT',config({eveningCutoffIst:'20:00'}))).status).toBe(400);
      expect((await call(base,tomorrow,owner,'PUT',config({dailyPlateLimit:999}))).status).toBe(400);
      expect((await call(base,tomorrow,owner,'PUT',config({pauses:[{itemId:'fake',reason:'PAUSED'}]}))).status).toBe(400);
    });
    expect(Number((await db.execute('SELECT COUNT(*) n FROM smart_menu_days')).rows[0]?.n)).toBe(0);
  });

  it('transaction rolls back ALL menu writes if audit insert fails',async()=>{
    const owner=await session('ADMIN');
    await db.execute(`CREATE TRIGGER block_menu_audit BEFORE INSERT ON audit_logs
      WHEN NEW.action = 'SMART_MENU_UPDATED'
      BEGIN SELECT RAISE(ABORT,'injected audit error'); END`);
    await http(async base=>{
      const result=await call(base,tomorrow,owner,'PUT',config({pauses:[{itemId:'idly',reason:'PAUSED'}]}));
      expect(result.status).toBe(503);
    });
    expect(Number((await db.execute('SELECT COUNT(*) n FROM smart_menu_days')).rows[0]?.n)).toBe(0);
    expect(await count('smart_menu_item_pauses')).toBe(0);
  });
});
