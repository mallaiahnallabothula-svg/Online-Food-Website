import { afterEach, describe, it, expect, vi } from 'vitest';
import { getOrderingStatus, formatIstDate } from '../server/services/timeService.ts';

afterEach(() => vi.unstubAllEnvs());

describe('Hosted test checkout hours', () => {
  it.each([9, 17])('allows a Razorpay Test preview at %i:00 IST and labels it as a test', hour => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('RAZORPAY_KEY_ID', 'rzp_test_fixture');
    const status = getOrderingStatus(new Date(Date.UTC(2026, 9, 8, hour)));
    expect(status).toMatchObject({ isOpen: true, testMode: true });
    expect(status.nextOrderingWindowEn).toContain('No real money');
  });

  it.each([
    ['production', 'rzp_live_fixture'],
    ['production', 'rzp_test_fixture'],
    ['preview', 'rzp_live_fixture'],
    ['preview', ''],
    [undefined, 'rzp_test_fixture'],
  ])('keeps closed hours for environment %s and key %s', (environment, key) => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', environment);
    vi.stubEnv('RAZORPAY_KEY_ID', key);
    vi.stubEnv('DEV_ALWAYS_OPEN_ORDERING', 'true');
    expect(getOrderingStatus(new Date(Date.UTC(2026, 9, 8, 9))))
      .toMatchObject({ isOpen: false, testMode: false });
  });
});

describe('Time Service & Ordering Windows (11:00 - 16:00 IST)', () => {
  it('identifies store as OPEN during ordering window (e.g. 12:30 IST)', () => {
    // 12:30 IST is 07:00 UTC
    const date = new Date(Date.UTC(2026, 8, 15, 7, 0, 0));
    const status = getOrderingStatus(new Date(date.getTime() + (5 * 60 + 30) * 60 * 1000));

    expect(status.openHour).toBe(11);
    expect(status.closeHour).toBe(16);
    expect(status.deliveryDate).toBeDefined();
    expect(status.deliveryWindowEn).toContain('6:00 PM');
    expect(status.deliveryWindowTe).toContain('6:00');
  });

  it('accurately enforces precise opening and closing boundaries (10:59, 11:00, 15:59, 16:00 IST)', () => {
    // 10:59 IST -> CLOSED
    const time1059 = new Date(Date.UTC(2026, 8, 15, 10, 59, 0));
    const status1059 = getOrderingStatus(time1059);
    expect(status1059.isOpen).toBe(false);

    // 11:00 IST -> OPEN
    const time1100 = new Date(Date.UTC(2026, 8, 15, 11, 0, 0));
    const status1100 = getOrderingStatus(time1100);
    expect(status1100.isOpen).toBe(true);

    // 15:59 IST -> OPEN
    const time1559 = new Date(Date.UTC(2026, 8, 15, 15, 59, 0));
    const status1559 = getOrderingStatus(time1559);
    expect(status1559.isOpen).toBe(true);

    // 16:00 IST -> CLOSED (cutoff reached, delivery set to next day)
    const time1600 = new Date(Date.UTC(2026, 8, 15, 16, 0, 0));
    const status1600 = getOrderingStatus(time1600);
    expect(status1600.isOpen).toBe(false);
    expect(status1600.deliveryDate).toBe('2026-09-16');
  });

  it('identifies store as CLOSED before 11:00 IST (e.g. 09:00 IST)', () => {
    const mockIst = new Date(Date.UTC(2026, 8, 15, 9, 0, 0));
    const status = getOrderingStatus(mockIst);

    expect(status.isOpen).toBe(false);
  });

  it('identifies store as CLOSED after 16:00 IST and sets delivery to next day', () => {
    const mockIst = new Date(Date.UTC(2026, 8, 15, 17, 30, 0));
    const status = getOrderingStatus(mockIst);

    expect(status.isOpen).toBe(false);
    expect(status.deliveryDate).toBe('2026-09-16');
  });

  it('formats dates cleanly as YYYY-MM-DD', () => {
    const d = new Date(Date.UTC(2026, 0, 5));
    expect(formatIstDate(d)).toBe('2026-01-05');
  });
});
