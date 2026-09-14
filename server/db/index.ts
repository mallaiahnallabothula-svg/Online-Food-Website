import { createClient, Client } from '@libsql/client';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { DB_SCHEMA } from './schema.ts';

let dbClient: Client | null = null;

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
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'ManaEntiVanta@2026';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
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
