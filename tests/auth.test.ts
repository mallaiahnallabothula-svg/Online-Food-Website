import { describe, it, expect, beforeEach } from 'vitest';
import { initDb } from '../server/db/index.ts';
import { loginAdmin, requireAdminCsrf, extractSessionToken } from '../server/auth/index.ts';

describe('Admin Authentication & Security', () => {
  beforeEach(async () => {
    await initDb();
  });

  it('rejects nonexistent admin username with uniform failure message', async () => {
    const res = await loginAdmin('nonexistent_user', 'some_password', '127.0.0.1');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Invalid username or password credentials');
  });

  it('enforces lockout after 5 consecutive failed attempts from same IP', async () => {
    const testIp = '192.168.1.99';
    for (let i = 0; i < 5; i++) {
      await loginAdmin('admin', 'wrong_pass', testIp);
    }

    const lockedAttempt = await loginAdmin('admin', 'wrong_pass', testIp);
    expect(lockedAttempt.success).toBe(false);
    expect(lockedAttempt.error).toContain('Too many failed attempts');
  });

  it('enforces lockout across rotating IPs for the same targeted account', async () => {
    const targetUser = 'victim_admin';
    for (let i = 1; i <= 5; i++) {
      await loginAdmin(targetUser, 'wrong_pass', `10.0.0.${i}`);
    }

    // Attempt from a brand-new 6th IP should still be locked out due to account-level rate limiting
    const lockedAttempt = await loginAdmin(targetUser, 'wrong_pass', '10.0.0.99');
    expect(lockedAttempt.success).toBe(false);
    expect(lockedAttempt.error).toContain('Account temporarily locked');
  });

  it('rejects cross-origin mutations in requireAdminCsrf', () => {
    let statusSent = 0;
    let jsonSent: any = null;

    const mockReq: any = {
      method: 'POST',
      headers: {
        host: 'app.manaentivanta.in',
        origin: 'https://evil-attacker.com',
      },
    };
    const mockRes: any = {
      status: (code: number) => {
        statusSent = code;
        return {
          json: (data: any) => {
            jsonSent = data;
          },
        };
      },
    };
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    requireAdminCsrf(mockReq, mockRes, next);

    expect(nextCalled).toBe(false);
    expect(statusSent).toBe(403);
    expect(jsonSent?.error?.code).toBe('CSRF_FORBIDDEN');
  });

  it('permits same-origin mutations in requireAdminCsrf', () => {
    const mockReq: any = {
      method: 'POST',
      headers: {
        host: 'app.manaentivanta.in',
        origin: 'https://app.manaentivanta.in',
      },
    };
    const mockRes: any = {};
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    requireAdminCsrf(mockReq, mockRes, next);
    expect(nextCalled).toBe(true);
  });

  it('extracts session token only from HttpOnly cookie and ignores Authorization header', () => {
    const reqWithBearer: any = {
      cookies: {},
      headers: {
        authorization: 'Bearer leaked_raw_token_in_header',
      },
    };
    expect(extractSessionToken(reqWithBearer)).toBeNull();

    const reqWithCookie: any = {
      cookies: {
        admin_session: 'valid_secure_cookie_session_token',
      },
      headers: {},
    };
    expect(extractSessionToken(reqWithCookie)).toBe('valid_secure_cookie_session_token');
  });
});
