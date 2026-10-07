import 'dotenv/config';

// Clean up global __dirname contamination from container environment if present
if (typeof (globalThis as any).__dirname !== 'undefined' && (globalThis as any).__dirname === '.') {
  delete (globalThis as any).__dirname;
}

import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createExpressApp } from './server/app.ts';
import { initDb } from './server/db/index.ts';
import { seedDevelopmentData } from './server/db/seed.ts';
import { validateServerConfig } from './server/config/validate.ts';

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  try {
    // 0. Validate production server configuration fail-fast
    validateServerConfig();

    // 1. Initialize SQLite Database Tables and Indexes
    await initDb();

    // 2. In development only, seed test mock orders if empty
    await seedDevelopmentData();

    // 3. Create modular Express app with all security, validation, and API routes
    const app = createExpressApp();

    // 4. Vite middleware for development / Static file serving for production
    if (process.env.NODE_ENV !== 'production' && process.env.SERVE_STATIC !== '1') {
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          ws: false,
          hmr: false,
        },
        appType: 'spa',
      });

      // Serve clean @vite/client in sandbox environment to prevent unexposed HMR websocket connection errors
      app.use(async (req, res, next) => {
        if (req.path === '/@vite/client') {
          try {
            const clientPath = path.resolve(process.cwd(), 'node_modules/vite/dist/client/client.mjs');
            let code = await fs.promises.readFile(clientPath, 'utf8');
            const idx1 = code.indexOf('const transport =');
            const idx2 = code.indexOf('let willUnload = false;');
            if (idx1 !== -1 && idx2 !== -1) {
              code =
                code.substring(0, idx1) +
                'const transport = normalizeModuleRunnerTransport({ connect: async () => {}, disconnect: async () => {}, send: () => {} });\n' +
                code.substring(idx2);
            }
            code = code
              .replace("import '@vite/env';", 'import "/node_modules/vite/dist/client/env.mjs";')
              .replace('console.debug("[vite] connecting...");', '')
              .replace('error: (err) => console.error("[vite]", err),', 'error: () => {},')
              .replace('debug: (...msg) => console.debug("[vite]", ...msg)', 'debug: () => {}')
              .replace(/__MODE__/g, JSON.stringify('development'))
              .replace(/__BASE__/g, JSON.stringify('/'))
              .replace(/__SERVER_HOST__/g, JSON.stringify('localhost:3000/'))
              .replace(/__HMR_PROTOCOL__/g, 'null')
              .replace(/__HMR_HOSTNAME__/g, 'null')
              .replace(/__HMR_PORT__/g, 'null')
              .replace(/__HMR_DIRECT_TARGET__/g, JSON.stringify('localhost:3000/'))
              .replace(/__HMR_BASE__/g, JSON.stringify('/'))
              .replace(/__HMR_TIMEOUT__/g, '30000')
              .replace(/__HMR_ENABLE_OVERLAY__/g, 'false')
              .replace(/__HMR_CONFIG_NAME__/g, JSON.stringify('vite.config.ts'))
              .replace(/__WS_TOKEN__/g, JSON.stringify('token'));

            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
            return res.send(code);
          } catch {
            return next();
          }
        }
        next();
      });

      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
    app.listen(PORT, host, () => {
      console.log(`[Mana Enti Vanta] Server running at http://${host}:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
