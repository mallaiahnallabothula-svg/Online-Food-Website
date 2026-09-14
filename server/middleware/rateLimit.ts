import { Request, Response, NextFunction } from 'express';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message: string;
}

interface ClientBucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(config: RateLimitConfig) {
  const buckets = new Map<string, ClientBucket>();

  // Cleanup expired buckets every minute
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt < now) {
        buckets.delete(key);
      }
    }
  }, 60000);

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();

    let bucket = buckets.get(ip);
    if (!bucket || bucket.resetAt < now) {
      bucket = {
        count: 0,
        resetAt: now + config.windowMs,
      };
      buckets.set(ip, bucket);
    }

    bucket.count += 1;

    // Set standard rate limit headers
    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - bucket.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetAt / 1000));

    if (bucket.count > config.maxRequests) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: config.message,
          retryAfterSeconds: retryAfter,
        },
      });
    }

    next();
  };
}

// Pre-configured rate limiters
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 mins
  maxRequests: 10,
  message: 'Too many login attempts from this IP. Please wait 15 minutes before trying again.',
});

export const paymentRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 mins
  maxRequests: 30,
  message: 'Too many payment requests. Please wait a few minutes.',
});

export const customerActionRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 mins
  maxRequests: 60,
  message: 'Too many customer requests. Please try again shortly.',
});
