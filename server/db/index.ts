import { createClient, type Client } from '@libsql/client';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { DB_SCHEMA } from './schema.ts';

let dbClient: Client | null = null;

export async function withDbRetry<T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const isBusy =
        err?.message?.includes('SQLITE_BUSY') ||
        err?.code === 'SQLITE_BUSY' ||
        err?.message?.includes('database is locked') ||
        err?.message?.includes('busy');
      if (isBusy && attempt < maxRetries) {
        const delay = Math.min(1000, 20 * Math.pow(2, attempt) + Math.random() * 30);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
}

export function getDb(): Client {
  if (!dbClient) {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = path.join(dataDir, 'mana_enti_vanta.db');
    dbClient = createClient({
      url: `file:${dbPath}`,
    });
  }
  return dbClient;
}

export async function initDb(): Promise<void> {
  const db = getDb();

  // Configure SQLite performance and concurrency
  try {
    await db.execute('PRAGMA journal_mode = WAL;');
    await db.execute('PRAGMA busy_timeout = 5000;');
  } catch {}
  
  // Execute schema statements
  const statements = DB_SCHEMA.split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    await db.execute(statement);
  }

  // Ensure default administrator exists securely
  const existingAdmin = await db.execute({
    sql: 'SELECT id FROM admin_users WHERE username = ? LIMIT 1',
    args: ['admin'],
  });

  if (existingAdmin.rows.length === 0) {
    const isProduction = process.env.NODE_ENV === 'production';
    let initialPassword = process.env.ADMIN_INITIAL_PASSWORD || process.env.ADMIN_DEFAULT_PASSWORD;

    if (!initialPassword) {
      if (isProduction) {
        console.error('[DB] CRITICAL: No administrator user found and ADMIN_INITIAL_PASSWORD is not set in environment.');
        return;
      } else {
        // In local development only, generate a secure random one-time password
        initialPassword = `Dev_${crypto.randomBytes(8).toString('hex')}!`;
        console.warn(`[DB] DEVELOPMENT NOTICE: Generated one-time admin password for 'admin': ${initialPassword}`);
      }
    }

    const passwordHash = await bcrypt.hash(initialPassword, 12);
    const adminId = `USR-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

    await db.execute({
      sql: `INSERT INTO admin_users (id, username, password_hash, role, name, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [adminId, 'admin', passwordHash, 'ADMIN', 'Owner Admin', new Date().toISOString()],
    });

    await db.execute({
      sql: `INSERT INTO audit_logs (id, actor_type, actor_id, action, target_type, target_id, details, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `AUD-${crypto.randomBytes(8).toString('hex')}`,
        'SYSTEM',
        'SYSTEM',
        'ADMIN_INITIALIZED',
        'ADMIN_USER',
        adminId,
        JSON.stringify({ username: 'admin', role: 'ADMIN' }),
        new Date().toISOString(),
      ],
    });
    console.log('[DB] Initial admin user initialized securely.');
  }
}
