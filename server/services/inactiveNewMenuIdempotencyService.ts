/**
 * TEST-ONLY / UNMOUNTED durable new-menu checkout preparation idempotency.
 *
 * This service does not initialize or migrate production DB tables. Its
 * dedicated table is created only by isolated test fixtures using the SQL
 * below; activation needs an independently approved persistence migration.
 *
 * A durable claim is inserted BEFORE order creation. If a worker crashes
 * between the claim and completing the response, replay FAILS CLOSED for
 * manual reconciliation rather than creating another order. The existing
 * order + stock inserts remain atomic in their own write transaction.
 *
 * Never call this from live routes or real-money payment flows.
 */
import crypto from 'node:crypto';
import type { Client } from '@libsql/client';
import { NEW_MENU_LAUNCH_ENABLED } from '../../shared/menuCatalog.ts';
import {
  createPendingNewMenuCheckout, priceNewMenuCheckout,
  type NewMenuCheckoutRequest,
} from './newMenuCheckoutService.ts';

export const INACTIVE_CHECKOUT_IDEMPOTENCY_TEST_SCHEMA = [
  'CREATE TABLE inactive_menu_checkout_idempotency (',
  'key_hash TEXT PRIMARY KEY NOT NULL,',
  'request_fingerprint TEXT NOT NULL,',
  "status TEXT NOT NULL CHECK (status IN ('CLAIMED','READY','REVIEW_REQUIRED')),",
  'claim_nonce TEXT NOT NULL,',
  'order_id TEXT,',
  'encrypted_result TEXT,',
  'created_at_utc TEXT NOT NULL,',
  'updated_at_utc TEXT NOT NULL',
  ')',
].join(' ');

const LIVE_CHECKOUT_IDEMPOTENCY_TABLE = 'new_menu_checkout_idempotency';

type Prepared = Awaited<ReturnType<typeof createPendingNewMenuCheckout>>;
export type IdempotentPrepared = Prepared & { readonly idempotent: boolean };
type ClaimRow = {
  key_hash: string;
  request_fingerprint: string;
  status: string;
  claim_nonce: string;
  order_id: string | null;
  encrypted_result: string | null;
};
const REQUEST_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MENU_ID = /^MENU-[0-9a-f-]{36}$/;
const TOKEN = /^[a-f0-9]{64}$/;
const HOLD_MS = 30 * 60_000;

function reviewError(): Error {
  return new Error('Checkout idempotency requires manual reconciliation; no automatic retry');
}

function requireInactiveTestMode(secret: Buffer, requestKey: string, now: Date): void {
  if (NEW_MENU_LAUNCH_ENABLED || process.env.NODE_ENV !== 'test') {
    throw new Error('Inactive idempotency may run only in isolated tests');
  }
  if (!Buffer.isBuffer(secret) || secret.length !== 32 ||
      typeof requestKey !== 'string' || !REQUEST_KEY.test(requestKey) ||
      !(now instanceof Date) || !Number.isSafeInteger(now.getTime()) || now.getTime() <= 0) {
    throw new Error('Invalid checkout idempotency key, secret or time');
  }
}

function fingerprintOf(request: NewMenuCheckoutRequest): string {
  if (!request || !Array.isArray(request.lines) || !request.customer ||
      request.lines.some(line => !line || typeof line.itemId !== 'string' ||
        !Number.isSafeInteger(line.quantity))) {
    throw new Error('Invalid checkout idempotency request');
  }
  const c = request.customer;
  // Canonical JSON binds the key to customer, prices' authoritative inputs,
  // location, requested date and quantities. Cart display order is irrelevant.
  const canonical = JSON.stringify({
    lines: request.lines.map(line => [line.itemId, line.quantity])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    customer: {
      name: c.name, mobile: c.mobile, address: c.address, landmark: c.landmark ?? '',
      latitude: c.latitude, longitude: c.longitude, locationLink: c.locationLink ?? '',
    },
    requestedDeliveryDateIst: request.requestedDeliveryDateIst ?? null,
    expectedPappu: request.expectedPappu ?? null,
    expectedCurry: request.expectedCurry ?? null,
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function keyHash(key: string): string {
  // Stable across secret rotation: changing encryption secrets must NEVER
  // create a fresh claim for the same request key.
  return crypto.createHash('sha256').update('new-menu-checkout:' + key).digest('hex');
}

function encryptResult(prepared: Prepared, secret: Buffer, aad: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secret, iv);
  cipher.setAAD(Buffer.from(aad));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(prepared), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(x => x.toString('base64url')).join('.');
}

function decryptResult(encoded: string, secret: Buffer, aad: string): Prepared {
  const parts = encoded.split('.');
  if (parts.length !== 3) throw reviewError();
  try {
    const [iv, tag, ciphertext] = parts.map(x => Buffer.from(x, 'base64url'));
    if (!iv || !tag || !ciphertext || iv.length !== 12 || tag.length !== 16 ||
        ciphertext.length === 0) throw reviewError();
    const decipher = crypto.createDecipheriv('aes-256-gcm', secret, iv);
    decipher.setAAD(Buffer.from(aad));
    decipher.setAuthTag(tag);
    const result = JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')) as Prepared;
    if (!result || typeof result.orderId !== 'string' || !MENU_ID.test(result.orderId) ||
        typeof result.customerAccessToken !== 'string' || !TOKEN.test(result.customerAccessToken) ||
        !Number.isSafeInteger(result.expiresAtMs) ||
        !result.pricing || typeof result.pricing !== 'object') throw reviewError();
    return result;
  } catch {
    throw reviewError();
  }
}

async function getClaim(db: Client, hash: string, tableName: string): Promise<ClaimRow | undefined> {
  const rows = await db.execute({
    sql: `SELECT key_hash, request_fingerprint, status, claim_nonce, order_id, encrypted_result FROM ${tableName} WHERE key_hash=? LIMIT 1`,
    args: [hash],
  });
  return rows.rows[0] as ClaimRow | undefined;
}

async function retrieveReady(
  db: Client, claim: ClaimRow, hash: string, fingerprint: string,
  secret: Buffer, nowMs: number,
): Promise<IdempotentPrepared> {
  if (claim.request_fingerprint !== fingerprint) {
    throw new Error('Idempotency key reuse with a changed checkout payload is forbidden');
  }
  if (claim.status !== 'READY' || !claim.encrypted_result || !claim.order_id) throw reviewError();
  const prepared = decryptResult(claim.encrypted_result, secret, hash + ':' + fingerprint);
  if (prepared.orderId !== claim.order_id || nowMs >= prepared.expiresAtMs) throw reviewError();
  const result = await db.execute({
    sql: 'SELECT public_token_hash, created_at_utc, total_amount_paisa, delivery_date, payment_status, provider_payment_id FROM orders WHERE id=? LIMIT 1',
    args: [prepared.orderId],
  });
  const order = result.rows[0];
  const actualHash = crypto.createHash('sha256').update(prepared.customerAccessToken).digest('hex');
  if (!order || order.public_token_hash !== actualHash ||
      order.payment_status !== 'PENDING' ||
      order.provider_payment_id === 'MENU_GATEWAY_STARTING' ||
      Number(order.total_amount_paisa) !== prepared.pricing.totalAmountPaisa ||
      order.delivery_date !== prepared.pricing.deliveryDateIst ||
      Date.parse(String(order.created_at_utc)) + HOLD_MS !== prepared.expiresAtMs) {
    throw reviewError();
  }
  return { ...prepared, idempotent: true };
}

/**
 * Idempotency applies to the same cryptographically random request key.
 * For a READY claim, the original token and original quote are recovered
 * encrypted-at-rest, without creating another order/stock hold.
 * Unfinished, conflicting, corrupted, paid, expired and ambiguous gateway
 * states fail closed with no automatic new order.
 *
 * A missing dedicated test table fails immediately; NEVER create it here.
 */
async function prepareNewMenuCheckoutIdempotent(
  db: Client,
  request: NewMenuCheckoutRequest,
  requestKey: string,
  secret: Buffer,
  now: Date = new Date(),
  tableName: string,
  mode: 'inactive-test' | 'production',
): Promise<IdempotentPrepared> {
  if (mode === 'inactive-test') requireInactiveTestMode(secret, requestKey, now);
  else if (secret.length !== 32 || !NEW_MENU_LAUNCH_ENABLED ||
      process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV !== 'production') {
    throw new Error('Production checkout idempotency is not enabled for this environment');
  }
  const fingerprint = fingerprintOf(request);
  const hash = keyHash(requestKey);
  let existing: ClaimRow | undefined;
  try {
    existing = await getClaim(db, hash, tableName);
  } catch {
    // Missing staging table or concurrent DB failure must never turn into a
    // fresh order. Do not silently fall back to a non-idempotent checkout.
    throw reviewError();
  }
  if (existing) return retrieveReady(db, existing, hash, fingerprint, secret, now.getTime());

  // Validate using EXISTING authoritative pricing before trying to reserve a key.
  // The winner calculates the slot from this call's actual server time.
  priceNewMenuCheckout(request, now);

  const nonce = crypto.randomUUID();
  const timestamp = now.toISOString();
  let claimed: Awaited<ReturnType<Client['execute']>>;
  try {
    claimed = await db.execute({
      sql: [
        `INSERT INTO ${tableName}`,
        '(key_hash,request_fingerprint,status,claim_nonce,created_at_utc,updated_at_utc)',
        "VALUES (?,?,'CLAIMED',?,?,?) ON CONFLICT(key_hash) DO NOTHING",
      ].join(' '),
      args: [hash, fingerprint, nonce, timestamp, timestamp],
    });
  } catch {
    // A simultaneous claim may have won while the DB returned SQLITE_BUSY,
    // a network error, or an ambiguous commit result. Never create an order.
    throw reviewError();
  }
  if (claimed.rowsAffected !== 1) {
    let competing: ClaimRow | undefined;
    try {
      competing = await getClaim(db, hash, tableName);
    } catch {
      throw reviewError();
    }
    if (!competing) throw reviewError();
    return retrieveReady(db, competing, hash, fingerprint, secret, now.getTime());
  }

  let prepared: Prepared;
  try {
    prepared = await createPendingNewMenuCheckout(
      db, request, now, mode === 'production' ? 'production' : 'inactive-test',
    );
  } catch (error) {
    // No second attempt is made. An ambiguous commit may have left an order;
    // retain the claim until a separately approved reconciliation process.
    await db.execute({
      sql: `UPDATE ${tableName} SET status='REVIEW_REQUIRED',updated_at_utc=? WHERE key_hash=? AND claim_nonce=? AND status='CLAIMED'`,
      args: [new Date().toISOString(), hash, nonce],
    }).catch(() => {});
    throw error;
  }

  const encrypted = encryptResult(prepared, secret, hash + ':' + fingerprint);
  const saved = await db.execute({
    sql: [
      `UPDATE ${tableName}`,
      "SET status='READY', order_id=?, encrypted_result=?, updated_at_utc=?",
      "WHERE key_hash=? AND claim_nonce=? AND request_fingerprint=? AND status='CLAIMED'",
    ].join(' '),
    args: [prepared.orderId, encrypted, new Date().toISOString(), hash, nonce, fingerprint],
  });
  if (saved.rowsAffected !== 1) throw reviewError();
  return { ...prepared, idempotent: false };
}

export function prepareInactiveNewMenuCheckoutIdempotent(
  db: Client, request: NewMenuCheckoutRequest, requestKey: string,
  secret: Buffer, now: Date = new Date(),
): Promise<IdempotentPrepared> {
  return prepareNewMenuCheckoutIdempotent(
    db, request, requestKey, secret, now, 'inactive_menu_checkout_idempotency', 'inactive-test',
  );
}

export function prepareProductionNewMenuCheckoutIdempotent(
  db: Client, request: NewMenuCheckoutRequest, requestKey: string,
  secret: Buffer, now: Date = new Date(),
): Promise<IdempotentPrepared> {
  return prepareNewMenuCheckoutIdempotent(
    db, request, requestKey, secret, now, LIVE_CHECKOUT_IDEMPOTENCY_TABLE, 'production',
  );
}
