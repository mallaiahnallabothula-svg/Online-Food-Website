import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createClient as createWebClient } from '@libsql/client/web';
import { createExpressApp } from '../server/app.ts';
import { DB_SCHEMA } from '../server/db/schema.ts';
import { MENU_CATALOG, NEW_MENU_LAUNCH_ENABLED } from '../shared/menuCatalog.ts';
import fs from 'node:fs';
import path from 'node:path';

describe('PR13 offline Cloudflare Workers feasibility probes (NOT a Workers runtime test)', () => {
  it('confirms current frontend is still inactive and has a separate Vite entry', () => {
    expect(MENU_CATALOG).toHaveLength(10);
    expect(NEW_MENU_LAUNCH_ENABLED).toBe(false);
    const conf = fs.readFileSync(path.resolve('vite.config.ts'),'utf8');
    expect(conf).toContain('menu-preview.html');
    expect(conf).toContain("path.resolve(__dirname, 'index.html')");
    expect(fs.existsSync('public')).toBe(true);
    const vercel = JSON.parse(fs.readFileSync('vercel.json','utf8'));
    expect(vercel.rewrites.some((x: { source:string }) => x.source.includes('/api/'))).toBe(true);
  });
  it('confirms Express app can be assembled locally but makes NO Worker compatibility claim', () => {
    const app=createExpressApp();
    expect(typeof app).toBe('function');
    const src=fs.readFileSync('server/app.ts','utf8');
    expect(src).toContain('req.rawBody = buf');
    expect(src).toContain("app.use('/api/admin', adminRouter)");
    expect(src).toContain("app.use('/api/payment', paymentRouter)");
  });
  it('validates raw-byte webhook HMAC behavior with synthetic payload only', () => {
    const secret='TEST_ONLY_SECRET';
    const raw=Buffer.from('{"event":"payment.captured","value":"a b"}');
    const changed=Buffer.from('{"event":"payment.captured", "value":"a b"}');
    const expected=crypto.createHmac('sha256',secret).update(raw).digest('hex');
    expect(crypto.timingSafeEqual(Buffer.from(expected,'hex'),
      Buffer.from(crypto.createHmac('sha256',secret).update(raw).digest('hex'),'hex'))).toBe(true);
    expect(crypto.createHmac('sha256',secret).update(changed).digest('hex')).not.toBe(expected);
  });
  it('confirms local schema and a network-safe libSQL web adapter can be created without connections', () => {
    expect(DB_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS admin_sessions');
    expect(DB_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS payments');
    // Construct only: no execute(), no Turso token, no network and no production data.
    const client=createWebClient({url:'https://isolated-test.invalid',authToken:'TEST_ONLY'});
    expect(client).toBeDefined();
    client.close();
    const source=fs.readFileSync('server/db/index.ts','utf8');
    expect(source).toContain("from '@libsql/client'");
    expect(source).toContain("import fs from 'fs'");
    expect(source).toContain("import path from 'path'");
  });
  it('benchmarks bcrypt locally but does NOT claim to measure Cloudflare CPU or owner-login readiness', async()=>{
    const password='test-password';
    const hash=await bcrypt.hash(password,10);
    const start=process.cpuUsage();
    expect(await bcrypt.compare(password,hash)).toBe(true);
    const elapsed=process.cpuUsage(start);
    expect(elapsed.user+elapsed.system).toBeGreaterThan(0);
    // Deliberately NO CPU < 10ms assertion: Node timing does not validate Workers Free quota.
  });
});
