import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createExpressApp } from './server/app.ts';
import { initDb } from './server/db/index.ts';
import { seedDevelopmentData } from './server/db/seed.ts';

const PORT = 3000;

async function startServer() {
  try {
    // 1. Initialize SQLite Database Tables and Indexes
    await initDb();

    // 2. In development only, seed test mock orders if empty
    await seedDevelopmentData();

    // 3. Create modular Express app with all security, validation, and API routes
    const app = createExpressApp();

    // 4. Vite middleware for development / Static file serving for production
    if (process.env.NODE_ENV !== 'production') {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Mana Enti Vanta] Server running at http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
