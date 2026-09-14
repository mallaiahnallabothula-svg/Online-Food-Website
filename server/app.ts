import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import { publicRouter } from './routes/publicRoutes.ts';
import { paymentRouter } from './routes/paymentRoutes.ts';
import { customerRouter } from './routes/customerRoutes.ts';
import { adminRouter } from './routes/adminRoutes.ts';

export function createExpressApp() {
  const app = express();

  // 1. Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Vite development server compatibility
      crossOriginEmbedderPolicy: false,
    })
  );

  // 2. Request size limit & JSON Parser
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // 3. Cookie Parser
  app.use(cookieParser());

  // 4. Request ID & Request Logger Middleware
  app.use((req: any, res: Response, next: NextFunction) => {
    req.requestId = crypto.randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    next();
  });

  // 5. Mount API Routes
  app.use('/api', publicRouter);
  app.use('/api/payment', paymentRouter);
  app.use('/api/customer', customerRouter);
  app.use('/api/orders', customerRouter);
  app.use('/api/admin', adminRouter);

  // 6. 404 handler for API routes
  app.use('/api/*', (req: any, res: Response) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `API endpoint '${req.originalUrl}' not found.`,
        requestId: req.requestId,
      },
    });
  });

  // 7. Structured Centralized Error Handler (No stack traces leaked)
  app.use((err: any, req: any, res: Response, _next: NextFunction) => {
    console.error(`[ERROR] [${req.requestId || 'no-id'}]`, err);

    const statusCode = typeof err.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
    const errorCode = err.code || 'INTERNAL_SERVER_ERROR';
    const message = statusCode === 500 && process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred on the server. Please try again later.'
      : (err.message || 'Internal server error');

    res.status(statusCode).json({
      error: {
        code: errorCode,
        message,
        requestId: req.requestId,
      },
    });
  });

  return app;
}
