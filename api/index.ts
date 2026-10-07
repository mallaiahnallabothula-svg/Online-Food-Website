import type { Request, Response } from 'express';
import { createExpressApp } from '../server/app.ts';
import { initDb } from '../server/db/index.ts';
import { validateServerConfig } from '../server/config/validate.ts';

const app = createExpressApp();
let initialization: Promise<void> | undefined;

// No listener or local database files in Vercel functions.
export default async function handler(req: Request, res: Response) {
  try {
    initialization ??= (async () => {
      validateServerConfig();
      await initDb();
    })().catch(error => {
      initialization = undefined;
      throw error;
    });
    await initialization;
    app(req, res);
  } catch {
    res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Orders are temporarily unavailable. Please try again later.' } });
  }
}
