import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateServerConfig } from '../server/config/validate.ts';

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('VERCEL', '1');
  vi.stubEnv('VERCEL_ENV', 'preview');
  vi.stubEnv('ADMIN_INITIAL_PASSWORD', 'fixture-admin-password');
  vi.stubEnv('TURSO_DATABASE_URL', 'libsql://fixture-preview.example');
  vi.stubEnv('TURSO_AUTH_TOKEN', 'fixture-database-token');
  vi.stubEnv('RAZORPAY_KEY_ID', 'rzp_test_fixture');
  vi.stubEnv('RAZORPAY_KEY_SECRET', 'fixture-api-secret');
  vi.stubEnv('RAZORPAY_WEBHOOK_SECRET', 'fixture-webhook-secret');
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('Razorpay deployment environment boundary', () => {
  it.each(['rzp_live_fixture', 'invalid-key'])('rejects %s in a Vercel Preview', keyId => {
    vi.stubEnv('RAZORPAY_KEY_ID', keyId);
    expect(validateServerConfig).toThrow(/preview website requires Razorpay test keys/);
  });

  it('allows test keys in a Vercel Preview', () => {
    expect(validateServerConfig).not.toThrow();
  });

  it('continues to reject test keys in Vercel Production', () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(validateServerConfig).toThrow(/production website requires live Razorpay keys/);
  });

  it('continues to allow live keys in Vercel Production', () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('RAZORPAY_KEY_ID', 'rzp_live_fixture');
    expect(validateServerConfig).not.toThrow();
  });

  it.each(['rzp_test_fixture', 'rzp_live_fixture'])('preserves %s outside Vercel', keyId => {
    vi.stubEnv('VERCEL', undefined);
    vi.stubEnv('VERCEL_ENV', undefined);
    vi.stubEnv('TURSO_DATABASE_URL', undefined);
    vi.stubEnv('TURSO_AUTH_TOKEN', undefined);
    vi.stubEnv('RAZORPAY_KEY_ID', keyId);
    expect(validateServerConfig).not.toThrow();
  });
});
