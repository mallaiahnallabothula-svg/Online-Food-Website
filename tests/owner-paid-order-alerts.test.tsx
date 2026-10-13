// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../src/context/LanguageContext.tsx';
import { PaidOrderAlerts } from '../src/components/OwnerPortal/PaidOrderAlerts.tsx';
import {
  diffPaidOrderAlerts, fetchPaidOrderAlertSnapshot, paidOrderAlertSession,
  isTomorrowPaidOrder, type PaidOrderAlert,
} from '../src/utils/paidOrderAlerts.ts';
import { tomorrowIst } from '../src/utils/preorderNotices.ts';
import { playOrderNotificationSound } from '../src/utils/audio.ts';

vi.mock('../src/utils/audio.ts', () => ({ playOrderNotificationSound: vi.fn() }));

const day = tomorrowIst();
const paid = (id: string, patch: Partial<PaidOrderAlert> = {}): PaidOrderAlert => ({
  id, customerName: 'Test Buyer', deliveryDate: day, deliveryWindow: '07:00-11:00',
  totalAmount: 170, paymentStatus: 'PAID', fulfillmentStatus: 'RECEIVED',
  updatedAt: '2026-10-13T14:00:00.000Z', ...patch,
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

describe('Owner Paid Order Alerts V1', () => {
  it('first successful snapshot is a silent baseline; detects new PAID IDs only once', () => {
    const original = paid('MENU-A');
    const first = diffPaidOrderAlerts(null, [original]);
    expect(first.newlyPaid).toHaveLength(0);
    const next = diffPaidOrderAlerts(first.seen, [paid('MENU-B'), original]);
    expect(next.newlyPaid.map(x => x.id)).toEqual(['MENU-B']);
    expect(diffPaidOrderAlerts(next.seen, [paid('MENU-B', { fulfillmentStatus: 'PREPARING' }), original]).newlyPaid).toHaveLength(0);
  });

  it('uses saved delivery schedule and IST tomorrow, not creation time', () => {
    expect(paidOrderAlertSession(paid('M'))).toBe('MORNING');
    expect(paidOrderAlertSession(paid('E', { deliveryWindow: '18:00-20:00' }))).toBe('EVENING');
    expect(paidOrderAlertSession(paid('LEGACY', { deliveryWindow: 'unknown' }))).toBe('UNCLASSIFIED');
    expect(isTomorrowPaidOrder(paid('M'))).toBe(true);
    expect(isTomorrowPaidOrder(paid('TODAY', { deliveryDate: '2026-10-01' }))).toBe(false);
  });

  it('fetches authenticated unfiltered paid alerts and rejects pending or malformed API data', async () => {
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe('/api/admin/paid-order-alerts');
      expect(init.credentials).toBe('include');
      expect(init.cache).toBe('no-store');
      return { ok: true, json: async () => ({ alerts: [paid('MENU-1')] }) } as Response;
    });
    expect(await fetchPaidOrderAlertSnapshot(undefined, fetcher as unknown as typeof fetch))
      .toEqual([paid('MENU-1')]);
    const pending = vi.fn(async () => ({ ok: true, json: async () => ({
      alerts: [{ ...paid('MENU-1'), paymentStatus: 'PENDING' }],
    }) } as Response));
    await expect(fetchPaidOrderAlertSnapshot(undefined, pending as unknown as typeof fetch)).rejects.toThrow('Invalid');
    const dupe = vi.fn(async () => ({ ok: true, json: async () => ({ alerts: [paid('A'), paid('A')] }) } as Response));
    await expect(fetchPaidOrderAlertSnapshot(undefined, dupe as unknown as typeof fetch)).rejects.toThrow('Duplicate');
    const expired = vi.fn(async () => ({ status: 401, ok: false } as Response));
    await expect(fetchPaidOrderAlertSnapshot(undefined, expired as unknown as typeof fetch)).rejects.toThrow('OWNER_SESSION_EXPIRED');
  });

  it('shows new paid order only after baseline, sounds once and navigates by exact order ID', async () => {
    let snapshot = [paid('EXISTING')];
    const fetcher = vi.fn(async (url: string) => {
      expect(url).toBe('/api/admin/paid-order-alerts');
      return { ok: true, json: async () => ({ alerts: snapshot }) } as Response;
    });
    vi.stubGlobal('fetch', fetcher);
    const view = vi.fn();
    render(<LanguageProvider><PaidOrderAlerts soundEnabled={true} onViewOrder={view} onSessionExpired={() => {}} /></LanguageProvider>);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('paid-order-alert')).toBeNull();
    expect(playOrderNotificationSound).not.toHaveBeenCalled();
    snapshot = [
      paid('NEW-EVENING', { deliveryWindow: '18:00-20:00' }),
      paid('EXISTING'),
    ];
    fireEvent(window, new Event('focus'));
    const card = await screen.findByTestId('paid-order-alert');
    expect(card.textContent).toContain('NEW-EVENING');
    expect(card.textContent).toMatch(/Evening|సాయంత్రం/);
    expect(card.textContent).toMatch(/Tomorrow's pre-order|రేపటి ప్రీ-ఆర్డర్/);
    expect(screen.getByTestId('paid-alert-count').textContent).toBe('1');
    expect(playOrderNotificationSound).toHaveBeenCalledTimes(1);
    fireEvent(window, new Event('focus'));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    expect(playOrderNotificationSound).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'View paid order NEW-EVENING' }));
    expect(view).toHaveBeenCalledWith('NEW-EVENING');
    expect(screen.queryByTestId('paid-order-alert')).toBeNull();
  });

  it('respects mute and keeps alerts after a poll failure, recovering without duplicate sounds', async () => {
    let attempt = 0;
    const fetcher = vi.fn(async () => {
      attempt += 1;
      if (attempt === 2) throw new Error('temporarily down');
      return { ok: true, json: async () => ({
        alerts: attempt === 1 ? [paid('OLD')] : [paid('NEW'), paid('OLD')],
      }) } as Response;
    });
    vi.stubGlobal('fetch', fetcher);
    render(<LanguageProvider><PaidOrderAlerts soundEnabled={false} onViewOrder={() => {}} onSessionExpired={() => {}} /></LanguageProvider>);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    fireEvent(window, new Event('focus'));
    await screen.findByRole('alert');
    fireEvent(window, new Event('focus'));
    await screen.findByTestId('paid-order-alert');
    expect(playOrderNotificationSound).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
