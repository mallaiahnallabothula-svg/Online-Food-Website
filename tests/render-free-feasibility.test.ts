import { afterEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import { createExpressApp } from '../server/app.ts';
import { NEW_MENU_LAUNCH_ENABLED, MENU_CATALOG } from '../shared/menuCatalog.ts';

async function onIsolatedHttpServer(run: (url: string) => Promise<void>) {
  // Ephemeral loopback HTTP only: NO credentials, DB initialization, payments, or Render API.
  const server = createExpressApp().listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve, reject) => {
      if (server.listening) return resolve();
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address() as AddressInfo;
    await run('http://127.0.0.1:' + address.port);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close(err => err ? reject(err) : resolve())
    );
  }
}

afterEach(() => vi.unstubAllEnvs());

describe('PR14 Render Free feasibility checks — local only, not a Render deployment', () => {
  it('checks the existing Node build/start contract and deployed static SPA routing', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const server = fs.readFileSync('server.ts', 'utf8');
    expect(pkg.scripts.build).toContain('vite build');
    expect(pkg.scripts.build).toContain('esbuild server.ts');
    expect(pkg.scripts.start).toBe('node dist/server.cjs');
    expect(server).toContain('process.env.PORT || 3000');
    expect(server).toContain("'0.0.0.0'");
    expect(server).toContain('express.static(distPath)');
    expect(server).toContain("app.get('*'");
    expect(NEW_MENU_LAUNCH_ENABLED).toBe(false);
    expect(MENU_CATALOG).toHaveLength(10);
    // Source inspection does NOT prove the production bundle starts on Render.
  });

  it('smoke-tests /api/health and existing API 404 through real localhost Express HTTP', async () => {
    await onIsolatedHttpServer(async base => {
      const health = await fetch(base + '/api/health');
      expect(health.status).toBe(200);
      const result = await health.json() as { status: string; service: string };
      expect(result.status).toBe('ok');
      expect(result.service).toBe('Mana Enti Vanta API');

      const missing = await fetch(base + '/api/not-a-real-path');
      expect(missing.status).toBe(404);
    });
  });

  it('checks webhook signature over exact raw HTTP bytes, with synthetic ignored event', async () => {
    vi.stubEnv('RAZORPAY_WEBHOOK_SECRET', 'fixture-render-webhook-only');
    const raw = '{"event":"fixture.render_probe","note":"a b"}';
    const changed = '{"event":"fixture.render_probe", "note":"a b"}';
    const signature = crypto.createHmac('sha256', 'fixture-render-webhook-only')
      .update(Buffer.from(raw)).digest('hex');

    await onIsolatedHttpServer(async base => {
      const endpoint = base + '/api/payment/webhook';
      const good = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-razorpay-signature': signature },
        body: raw,
      });
      expect(good.status).toBe(200);
      const body = await good.json() as { received: boolean; ignored: boolean };
      expect(body).toMatchObject({ received: true, ignored: true });

      const altered = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-razorpay-signature': signature },
        body: changed,
      });
      expect(altered.status).toBe(400);
    });
    // Does NOT invoke Razorpay or settle any order: non-captured synthetic event.
  });
});
