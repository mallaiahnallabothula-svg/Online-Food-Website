import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function withHttp(app: express.Express, work: (base: string) => Promise<void>) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    if (server.listening) return resolve();
    server.once('listening', resolve);
    server.once('error', reject);
  });
  try {
    await work('http://127.0.0.1:' + (server.address() as import('node:net').AddressInfo).port);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

const morningRequest = {
  lines: [{ itemId: 'idly', quantity: 4 }],
  customer: {
    name: 'Test Customer', mobile: '9000000001',
    address: 'Test Kollur apartment', latitude: 17.485, longitude: 78.235,
  },
};
const headers = { 'content-type': 'application/json', 'x-menu-checkout': '1' };

describe('production morning menu removal', () => {
  it('rejects morning status, quote and new checkout preparation without database/provider access', async () => {
    vi.stubEnv('NEW_MENU_LAUNCH_ENABLED', 'true');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('RAZORPAY_KEY_ID', 'rzp_live_TestKey123');
    vi.stubEnv('NEW_MENU_IDEMPOTENCY_SECRET', 'a'.repeat(64));
    vi.resetModules();
    const { newMenuCheckoutRouter } = await import('../server/routes/newMenuCheckoutRoutes.ts');
    const app = express();
    app.use(express.json());
    app.use('/api/new-menu', newMenuCheckoutRouter);

    await withHttp(app, async base => {
      const status = await fetch(base + '/api/new-menu/menu-status?period=MORNING');
      expect(status.status).toBe(404);

      const quote = await fetch(base + '/api/new-menu/quote', {
        method: 'POST', headers, body: JSON.stringify(morningRequest),
      });
      expect(quote.status).toBe(410);
      expect((await quote.json()).error.code).toBe('MENU_PERIOD_DISCONTINUED');

      const prepare = await fetch(base + '/api/new-menu/prepare', {
        method: 'POST', headers,
        body: JSON.stringify({ request: morningRequest, requestKey: '11111111-1111-4111-8111-111111111111' }),
      });
      expect(prepare.status).toBe(410);
      expect((await prepare.json()).error.code).toBe('MENU_PERIOD_DISCONTINUED');
    });
  });
});
