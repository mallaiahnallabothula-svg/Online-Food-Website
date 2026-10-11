/**
 * INACTIVE internal two-step new-menu checkout orchestration.
 *
 * No Express route, live checkout, UI or scheduler imports this service.
 * Prepared orders are intentionally NOT auto-recreated on gateway retries:
 * keep the returned orderId + access token and use the start function for
 * same-order idempotency. Before public launch, separately implement durable
 * request-level idempotency and reconciliation for lost preparation responses.
 */
import crypto from 'node:crypto';
import type { Client } from '@libsql/client';
import { NEW_MENU_LAUNCH_ENABLED } from '../../shared/menuCatalog.ts';
import {
  createPendingNewMenuCheckout,
  type NewMenuCheckoutRequest,
} from './newMenuCheckoutService.ts';
import {
  createInactiveNewMenuGatewayOrder,
  type InactiveGatewayCredentials,
  type InactiveGatewayOrderResult,
} from './inactiveNewMenuGatewayOrderService.ts';

const MENU_ID = /^MENU-[0-9a-f-]{36}$/;
const ACCESS_TOKEN = /^[a-f0-9]{64}$/;

/**
 * Phase 1: server-authoritative cart/IST slot/location validation and one
 * transaction containing a PENDING order, item snapshots, and capped holds.
 * No gateway call is made here. Only use with an isolated/staging DB.
 */
export async function prepareInactiveNewMenuCheckout(
  db: Client,
  request: NewMenuCheckoutRequest,
  placedAt: Date = new Date(),
) {
  if (NEW_MENU_LAUNCH_ENABLED) {
    throw new Error('Inactive new-menu checkout cannot run after launch');
  }
  return createPendingNewMenuCheckout(db, request, placedAt);
}

/**
 * Phase 2: require possession of the 256-bit customer access token before
 * contacting Razorpay test-mode. Pricing comes ONLY from saved order snapshots.
 *
 * Repeating Phase 2 for the same bound order returns the existing gateway
 * intent; definitive API rejection releases holds, ambiguous network outcomes
 * require manual reconciliation and never trigger a second gateway POST.
 *
 * Must NOT be mounted as a public route without separate approval, CSRF/rate
 * limiting, durable preparation idempotency and full captured-payment workflow.
 */
export async function startInactiveNewMenuCheckoutGateway(
  db: Client,
  input: { readonly orderId: string; readonly customerAccessToken: string },
  credentials: InactiveGatewayCredentials,
  transport: typeof fetch,
  nowMs = Date.now(),
): Promise<InactiveGatewayOrderResult> {
  if (NEW_MENU_LAUNCH_ENABLED) {
    throw new Error('Inactive new-menu checkout cannot run after launch');
  }
  if (!input || typeof input.orderId !== 'string' || !MENU_ID.test(input.orderId) ||
      typeof input.customerAccessToken !== 'string' ||
      !ACCESS_TOKEN.test(input.customerAccessToken) ||
      !Number.isSafeInteger(nowMs) || nowMs <= 0 ||
      !credentials || !/^rzp_test_[A-Za-z0-9]+$/.test(credentials.keyId) ||
      typeof credentials.keySecret !== 'string' || credentials.keySecret.length === 0 ||
      typeof transport !== 'function') {
    throw new Error('Invalid inactive checkout authorization or test credentials');
  }

  const row = await db.execute({
    sql: 'SELECT public_token_hash FROM orders WHERE id = ? LIMIT 1',
    args: [input.orderId],
  });
  const storedHash = row.rows[0]?.public_token_hash;
  if (typeof storedHash !== 'string' || !ACCESS_TOKEN.test(storedHash)) {
    throw new Error('Invalid inactive checkout authorization');
  }
  const presentedHash = crypto.createHash('sha256')
    .update(input.customerAccessToken).digest();
  const expectedHash = Buffer.from(storedHash, 'hex');
  if (expectedHash.length !== presentedHash.length ||
      !crypto.timingSafeEqual(expectedHash, presentedHash)) {
    throw new Error('Invalid inactive checkout authorization');
  }

  // Already-tested gateway adapter enforces immutable saved price, inventory
  // holds, one-time provider attempt and strict test-mode credentials.
  return createInactiveNewMenuGatewayOrder(
    db, input.orderId, credentials, transport, nowMs,
  );
}
