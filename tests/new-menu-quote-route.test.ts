import { describe, expect, it } from 'vitest';
import express, { type Express } from 'express';
import type { AddressInfo } from 'node:net';
import { createExpressApp } from '../server/app.ts';
import { createNewMenuQuoteRouter } from '../server/routes/newMenuQuoteRoutes.ts';
import { NEW_MENU_LAUNCH_ENABLED } from '../shared/menuCatalog.ts';

const validCart = {
  lines: [{ itemId: 'idly', quantity: 4 }],
  customer: {
    name: 'Test Customer', mobile: '9000000001',
    address: 'Test Kollur apartment', latitude: 17.485, longitude: 78.235,
  },
};

async function withHttp(app: Express, check: (base: string) => Promise<void>): Promise<void> {
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve, reject) => {
      if (server.listening) return resolve();
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const port = (server.address() as AddressInfo).port;
    await check('http://127.0.0.1:' + port);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
}

async function quote(base: string, data: unknown) {
  return fetch(base + '/api/menu/quote', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  });
}

describe('inactive server-priced new-menu quote endpoint', () => {
  it('keeps the public Vercel/Express menu route unavailable until explicit launch', async () => {
    expect(NEW_MENU_LAUNCH_ENABLED).toBe(false);
    await withHttp(createExpressApp(), async base => {
      const response = await quote(base, validCart);
      expect(response.status).toBe(404);
      expect((await response.json()).error.code).toBe('NOT_FOUND');
      expect((await fetch(base + '/api/health')).status).toBe(200);
    });
  });

  it('uses authoritative catalog prices, IST slot and no stock or payment writes', async () => {
    const app = express();
    app.use(express.json());
    // Enabled only inside isolated HTTP test, NOT in the actual application.
    app.use('/api/menu', createNewMenuQuoteRouter(true));
    await withHttp(app, async base => {
      const response = await quote(base, validCart);
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.quote.period).toBe('MORNING');
      expect(result.quote.items).toEqual([{
        itemId: 'idly', unitPricePaisa: 3000, quantity: 4, lineTotalPaisa: 12000,
      }]);
      expect(result.quote.subtotalPaisa).toBe(12000);
      expect(result.quote.totalAmountPaisa).toBe(12000);
      expect(result.quote.deliveryWindow).toBe('07:00-11:00');
      expect(result.quote.deliveryDateIst).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.stockReserved).toBe(false);
      expect(result.paymentInitiated).toBe(false);
      expect(JSON.stringify(result)).not.toContain('9000000001');
    });
  });

  it('rejects arbitrary client prices, invalid quantities and mixed meal slots', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/menu', createNewMenuQuoteRouter(true));
    await withHttp(app, async base => {
      expect((await quote(base, { ...validCart, clientTotalPaisa: 1 })).status).toBe(400);
      expect((await quote(base, {
        ...validCart, lines: [{ itemId: 'idly', quantity: '4' }],
      })).status).toBe(400);
      expect((await quote(base, {
        ...validCart, lines: [{ itemId: 'idly', quantity: 1 }],
      })).status).toBe(400); // ₹100 minimum
      expect((await quote(base, {
        ...validCart, lines: [{ itemId: 'idly', quantity: 4 }, { itemId: 'pulka', quantity: 4 }],
      })).status).toBe(400);
      expect((await quote(base, {
        ...validCart, customer: { ...validCart.customer, longitude: null },
      })).status).toBe(400);
      expect((await quote(base, {
        ...validCart, customer: { ...validCart.customer, latitude: 0, longitude: 0 },
      })).status).toBe(400); // outside delivery region
    });
  });
});
