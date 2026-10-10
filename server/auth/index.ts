import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/index.ts';

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: 'ADMIN' | 'STAFF';
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  sessionId?: string;
  requestId?: string;
}

// Shared, hashed-key failed-login counters: portable across Vercel instances.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const loginHash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

async function getLoginLock(keys: string[], now: number): Promise<number> {
  const db = getDb();
  let lockedUntil = 0;
  for (const key of keys) {
    const result = await db.execute({
      sql: 'SELECT locked_until_ms FROM admin_login_attempts WHERE key_hash = ? LIMIT 1',
      args: [key],
    });
    lockedUntil = Math.max(lockedUntil, Number(result.rows[0]?.locked_until_ms || 0));
  }
  return lockedUntil > now ? lockedUntil : 0;
}

async function recordLoginFailure(keys: string[], now: number): Promise<void> {
  const db = getDb();
  for (const key of keys) {
    await db.execute({
      sql: `INSERT INTO admin_login_attempts (key_hash, failed_count, window_expires_at_ms, locked_until_ms)
            VALUES (?, 1, ?, 0)
            ON CONFLICT(key_hash) DO UPDATE SET
              failed_count = CASE WHEN window_expires_at_ms <= ? THEN 1 ELSE failed_count + 1 END,
              window_expires_at_ms = CASE WHEN window_expires_at_ms <= ? THEN ? ELSE window_expires_at_ms END,
              locked_until_ms = CASE
                WHEN locked_until_ms > ? THEN locked_until_ms
                WHEN window_expires_at_ms <= ? THEN 0
                WHEN failed_count + 1 >= ? THEN ?
                ELSE 0 END`,
      args: [key, now + LOGIN_WINDOW_MS, now, now, now + LOGIN_WINDOW_MS, now, now, LOGIN_MAX_FAILURES, now + LOGIN_WINDOW_MS],
    });
  }
}

async function clearLoginFailures(keys: string[]): Promise<void> {
  const db = getDb();
  for (const key of keys) {
    await db.execute({ sql: 'DELETE FROM admin_login_attempts WHERE key_hash = ?', args: [key] });
  }
}

// Periodic automatic cleanup of stale sessions in database (every 15 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cleanupStaleSessions().catch(() => {});
  }, 15 * 60 * 1000).unref();
}

// Dummy hash for constant-time comparison against nonexistent users
const DUMMY_BCRYPT_HASH = '$2a$10$wK1Fm8.9w1H45fVqP7gQe.u3rPzHhYh0GzH2K6Z1VbS0sXb8qU3uW';

export async function loginAdmin(
  username: string,
  passwordPlain: string,
  ip: string,
  userAgent?: string
): Promise<{
  success: boolean;
  sessionCookie?: string;
  user?: AuthenticatedUser;
  error?: string;
  lockedUntil?: number;
}> {
  const now = Date.now();
  const cleanUsername = (username || '').toLowerCase().trim();
  const keys = [loginHash(`ip:${ip}`), loginHash(`user:${cleanUsername}`)];
  const lockedUntil = await getLoginLock(keys, now);
  if (lockedUntil) {
    const waitSeconds = Math.ceil((lockedUntil - now) / 1000);
    return {
      success: false,
      error: `Too many failed attempts. Account temporarily locked. Please retry in ${waitSeconds} seconds.`,
      lockedUntil,
    };
  }

  // Auto clean stale expired sessions on login attempt
  cleanupStaleSessions().catch(() => {});

  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT id, username, password_hash, role, name FROM admin_users WHERE username = ? LIMIT 1',
    args: [cleanUsername],
  });

  if (res.rows.length === 0) {
    // Constant-time compare to prevent user enumeration
    await bcrypt.compare(passwordPlain || '', DUMMY_BCRYPT_HASH);

    await recordLoginFailure(keys, Date.now());
    return { success: false, error: 'Invalid username or password credentials.' };
  }

  const userRow = res.rows[0]!;
  const isValidPassword = await bcrypt.compare(passwordPlain, String(userRow.password_hash));

  if (!isValidPassword) {
    await recordLoginFailure(keys, Date.now());
    return { success: false, error: 'Invalid username or password credentials.' };
  }

  // Reset the two persistent counters only on a verified successful login.
  await clearLoginFailures(keys);

  // Generate 256-bit secure session ID (raw token returned only for HttpOnly cookie)
  const rawSessionToken = crypto.randomBytes(32).toString('hex');
  const sessionTokenHash = crypto.createHash('sha256').update(rawSessionToken).digest('hex');
  const sessionId = `SESS-${crypto.randomBytes(8).toString('hex')}`;
  const sessionDurationMs = 24 * 60 * 60 * 1000; // 24 hours
  const expiresAt = new Date(now + sessionDurationMs).toISOString();
  const createdAt = new Date(now).toISOString();

  // Store only the session hash in database, never the raw token
  await db.execute({
    sql: `INSERT INTO admin_sessions (id, session_token_hash, user_id, expires_at, created_at, user_agent, ip)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [sessionId, sessionTokenHash, String(userRow.id), expiresAt, createdAt, userAgent || null, ip],
  });

  // Audit log using distinct sessionId, never the session token
  await db.execute({
    sql: `INSERT INTO audit_logs (id, actor_type, actor_id, action, target_type, target_id, details, ip, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      `AUD-${crypto.randomBytes(8).toString('hex')}`,
      String(userRow.role),
      String(userRow.username),
      'ADMIN_LOGIN_SUCCESS',
      'ADMIN_SESSION',
      sessionId,
      JSON.stringify({ username: cleanUsername }),
      ip,
      createdAt,
    ],
  });

  return {
    success: true,
    sessionCookie: rawSessionToken,
    user: {
      id: String(userRow.id),
      username: String(userRow.username),
      role: String(userRow.role) as 'ADMIN' | 'STAFF',
      name: String(userRow.name),
    },
  };
}

export async function validateSession(sessionToken: string): Promise<AuthenticatedUser | null> {
  if (!sessionToken || typeof sessionToken !== 'string') {
    return null;
  }

  const db = getDb();
  const nowUtc = new Date().toISOString();
  const tokenHash = crypto.createHash('sha256').update(sessionToken.trim()).digest('hex');

  const res = await db.execute({
    sql: `SELECT s.id as session_id, s.expires_at, u.id, u.username, u.role, u.name
          FROM admin_sessions s
          JOIN admin_users u ON s.user_id = u.id
          WHERE s.session_token_hash = ? AND s.expires_at > ?
          LIMIT 1`,
    args: [tokenHash, nowUtc],
  });

  if (res.rows.length === 0) {
    return null;
  }

  const row = res.rows[0]!;
  return {
    id: String(row.id),
    username: String(row.username),
    role: String(row.role) as 'ADMIN' | 'STAFF',
    name: String(row.name),
  };
}

export async function logoutSession(sessionToken: string): Promise<void> {
  if (!sessionToken) return;
  const db = getDb();
  const tokenHash = crypto.createHash('sha256').update(sessionToken.trim()).digest('hex');
  await db.execute({
    sql: 'DELETE FROM admin_sessions WHERE session_token_hash = ?',
    args: [tokenHash],
  });
}

export async function cleanupStaleSessions(): Promise<void> {
  try {
    const db = getDb();
    const nowUtc = new Date().toISOString();
    await db.execute({
      sql: 'DELETE FROM admin_sessions WHERE expires_at <= ?',
      args: [nowUtc],
    });
  } catch {}
}

export function extractSessionToken(req: Request): string | null {
  // Purely HttpOnly cookie authentication - raw tokens are never accepted via Authorization headers
  if (req.cookies && typeof req.cookies.admin_session === 'string' && req.cookies.admin_session.trim().length > 0) {
    return req.cookies.admin_session.trim();
  }
  return null;
}

// CSRF / Same-Origin validation for state-changing admin requests
export function requireAdminCsrf(req: Request, res: Response, next: NextFunction) {
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const rawHost = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
    const host = (rawHost.split(',')[0] || '').trim().toLowerCase();
    const secFetchSite = req.headers['sec-fetch-site'];

    // Reject explicit cross-site requests signaled by browser security metadata
    if (secFetchSite === 'cross-site') {
      return res.status(403).json({
        error: { code: 'CSRF_FORBIDDEN', message: 'Cross-site request blocked by browser Sec-Fetch-Site security.' },
      });
    }

    if (origin) {
      try {
        const originUrl = new URL(origin);
        if (host && originUrl.host.toLowerCase() !== host) {
          return res.status(403).json({
            error: { code: 'CSRF_FORBIDDEN', message: 'Cross-origin admin request rejected.' },
          });
        }
      } catch {
        return res.status(403).json({
          error: { code: 'CSRF_FORBIDDEN', message: 'Invalid origin header.' },
        });
      }
    } else if (referer) {
      try {
        const refererUrl = new URL(referer);
        if (host && refererUrl.host.toLowerCase() !== host) {
          return res.status(403).json({
            error: { code: 'CSRF_FORBIDDEN', message: 'Cross-origin admin request rejected.' },
          });
        }
      } catch {
        return res.status(403).json({
          error: { code: 'CSRF_FORBIDDEN', message: 'Invalid referer header.' },
        });
      }
    } else if (process.env.NODE_ENV === 'production') {
      // In production, require either Origin, Referer, or custom header
      const customHeader = req.headers['x-requested-with'];
      if (!customHeader) {
        return res.status(403).json({
          error: { code: 'CSRF_FORBIDDEN', message: 'Missing origin or custom header on state mutation.' },
        });
      }
    }
  }
  next();
}

// Authentication Middleware
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractSessionToken(req);
  if (!token) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication session required to access this endpoint.',
        requestId: req.requestId,
      },
    });
  }

  const user = await validateSession(token);
  if (!user) {
    return res.status(401).json({
      error: {
        code: 'INVALID_SESSION',
        message: 'Session is invalid or has expired. Please log in again.',
        requestId: req.requestId,
      },
    });
  }

  req.user = user;
  req.sessionId = token;
  next();
}

// Role authorization middleware
export function requireRole(allowedRoles: Array<'ADMIN' | 'STAFF'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
          requestId: req.requestId,
        },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Forbidden: role '${req.user.role}' lacks permissions for this operation.`,
          requestId: req.requestId,
        },
      });
    }

    next();
  };
}
