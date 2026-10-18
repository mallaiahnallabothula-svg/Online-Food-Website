import express from 'express';
import { readFileSync } from 'node:fs';
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

describe('public menu metadata', () => {
  it('does not advertise morning items in page or PWA metadata', () => {
    const html = readFileSync('index.html', 'utf8');
    const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8')) as { description: string };
    const vite = readFileSync('vite.config.ts', 'utf8');
    const hero = readFileSync('src/components/HeroSection.tsx', 'utf8');
    const editorial = readFileSync('src/components/SolaraEditorialContent.tsx', 'utf8');
    const translations = readFileSync('src/utils/translations.ts', 'utf8');
    const orderHours = readFileSync('src/components/OrderingHoursBanner.tsx', 'utf8');
    expect(html).not.toContain('ఉదయం');
    expect(html).not.toContain('ఇడ్లీ');
    expect(html).toContain('సాయంత్రం');
    expect(manifest.description).not.toContain('ఉదయం');
    expect(manifest.description).toContain('సాయంత్రం');
    expect(vite).not.toContain('ఉదయం అల్పాహారం');
    expect(vite).toContain('సాయంత్రం');
    expect(hero).not.toContain('ఉదయం టిఫిన్లు');
    expect(hero).not.toContain('Morning favourites');
    expect(hero).not.toContain('Morning 7–11 AM');
    expect(editorial).not.toContain('morning tiffins');
    expect(editorial).not.toContain('Morning · 7–11 AM');
    expect(editorial).not.toContain('All six morning tiffins');
    expect(translations).not.toContain('Fresh breakfast & homestyle evening meals');
    expect(translations).not.toContain('Choose from 6 morning and 4 evening dishes.');
    expect(translations).not.toContain('ఉదయం అల్పాహారం | సాయంత్రం');
    expect(translations).not.toContain('12-item menu');
    expect(translations).not.toContain('12 రకాల మెనూ');
    expect(translations).not.toContain('12 రకాల మెనూను');
    expect(translations).toContain('Homestyle evening meals — 6 dishes');
    expect(orderHours).not.toContain('ఆర్డర్లు: ఉదయం');
  });
});

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
