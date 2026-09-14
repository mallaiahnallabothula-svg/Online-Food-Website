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

// In-memory brute-force defense tracker
interface LoginAttemptRecord {
  attempts: number;
  lastAttempt: number;
  lockoutUntil: number;
}
const loginAttempts = new Map<string, LoginAttemptRecord>();

export async function loginAdmin(
  username: string,
  passwordPlain: string,
  ip: string,
  userAgent?: string
): Promise<{
  success: boolean;
  sessionToken?: string;
  user?: AuthenticatedUser;
  error?: string;
  lockedUntil?: number;
}> {
  const now = Date.now();
  const attemptRecord = loginAttempts.get(ip) || { attempts: 0, lastAttempt: now, lockoutUntil: 0 };

  if (attemptRecord.lockoutUntil > now) {
    const waitSeconds = Math.ceil((attemptRecord.lockoutUntil - now) / 1000);
    return {
      success: false,
      error: `Too many failed attempts. Account temporarily locked. Please retry in ${waitSeconds} seconds.`,
      lockedUntil: attemptRecord.lockoutUntil,
    };
  }

  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT id, username, password_hash, role, name FROM admin_users WHERE username = ? LIMIT 1',
    args: [username],
  });

  if (res.rows.length === 0) {
    attemptRecord.attempts += 1;
    attemptRecord.lastAttempt = now;
    if (attemptRecord.attempts >= 5) {
      attemptRecord.lockoutUntil = now + 15 * 60 * 1000; // 15-minute lockout
    }
    loginAttempts.set(ip, attemptRecord);
    return { success: false, error: 'Invalid username or password credentials.' };
  }

  const userRow = res.rows[0]!;
  const isValidPassword = await bcrypt.compare(passwordPlain, String(userRow.password_hash));

  if (!isValidPassword) {
    attemptRecord.attempts += 1;
    attemptRecord.lastAttempt = now;
    if (attemptRecord.attempts >= 5) {
      attemptRecord.lockoutUntil = now + 15 * 60 * 1000;
    }
    loginAttempts.set(ip, attemptRecord);
    return { success: false, error: 'Invalid username or password credentials.' };
  }

  // Successful login -> Reset rate limiter for this IP
  loginAttempts.delete(ip);

  // Generate 256-bit secure session ID
  const sessionToken = `sess_${crypto.randomBytes(32).toString('hex')}`;
  const sessionDurationMs = 24 * 60 * 60 * 1000; // 24 hours
  const expiresAt = new Date(now + sessionDurationMs).toISOString();
  const createdAt = new Date(now).toISOString();

  await db.execute({
    sql: `INSERT INTO admin_sessions (id, user_id, expires_at, created_at, user_agent, ip)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [sessionToken, String(userRow.id), expiresAt, createdAt, userAgent || null, ip],
  });

  await db.execute({
    sql: `INSERT INTO audit_logs (id, actor_type, actor_id, action, target_type, target_id, details, ip, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      `AUD-${crypto.randomBytes(8).toString('hex')}`,
      String(userRow.role),
      String(userRow.username),
      'ADMIN_LOGIN_SUCCESS',
      'ADMIN_SESSION',
      sessionToken,
      JSON.stringify({ username }),
      ip,
      createdAt,
    ],
  });

  return {
    success: true,
    sessionToken,
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

  const res = await db.execute({
    sql: `SELECT s.id as session_id, s.expires_at, u.id, u.username, u.role, u.name
          FROM admin_sessions s
          JOIN admin_users u ON s.user_id = u.id
          WHERE s.id = ? AND s.expires_at > ?
          LIMIT 1`,
    args: [sessionToken, nowUtc],
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
  await db.execute({
    sql: 'DELETE FROM admin_sessions WHERE id = ?',
    args: [sessionToken],
  });
}

export function extractSessionToken(req: Request): string | null {
  // 1. Check HttpOnly cookie
  if (req.cookies && req.cookies.admin_session) {
    return req.cookies.admin_session;
  }
  // 2. Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return null;
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
