// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../src/context/LanguageContext.tsx';
import { AnalyticsDashboard } from '../src/components/OwnerPortal/AnalyticsDashboard.tsx';
import { CustomerFeedbackView } from '../src/components/OwnerPortal/CustomerFeedbackView.tsx';
import { OwnerDashboard } from '../src/components/OwnerPortal/OwnerDashboard.tsx';
import type { AnalyticsData } from '../src/types.ts';

// Isolate dashboard polling from independent live alerts / Kitchen Board.
vi.mock('../src/components/OwnerPortal/PaidOrderAlerts.tsx', () => ({ PaidOrderAlerts: () => null }));
vi.mock('../src/components/OwnerPortal/PaymentReviewQueue.tsx', () => ({ PaymentReviewQueue: () => null }));
vi.mock('../src/components/OwnerPortal/TomorrowPreordersSummary.tsx', () => ({ TomorrowPreordersSummary: () => null }));
vi.mock('../src/components/OwnerPortal/PappuSettings.tsx', () => ({ PappuSettings: () => null }));

const analytics: AnalyticsData = {
  summary: {
    totalRevenueRupees: 480, totalOrders: 4, totalItems: 16,
    totalJowarRotis: 0, totalChapathis: 0,
    totalKarivepakuGrams: 0, totalAviseGrams: 0,
    todayOrdersCount: 4, todayRevenueRupees: 480, averageOrderValueRupees: 120,
  },
  ordersByStatus: { RECEIVED: 4, PREPARING: 0, OUT_FOR_DELIVERY: 0, DELIVERED: 0, CANCELLED: 0 },
  hourlyOrderDistribution: [
    { hourSlot: '12:00 AM', count: 2 },
    { hourSlot: '12:00 PM', count: 2 },
  ],
  feedbackSummary: { totalReviews: 0, averageRating: 0, ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
};

function ok(payload: unknown) {
  return { ok: true, status: 200, json: async () => payload } as Response;
}
function unavailable() {
  return { ok: false, status: 503, json: async () => ({ error: { message: 'Unavailable' } }) } as Response;
}
function setupEnglish() {
  localStorage.setItem('miv_language', 'en');
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  localStorage.clear();
});

describe('P2 final polish — accurate copy and incomplete network data', () => {
  it('shows no rating when reviews are absent in both owner analytics and feedback', () => {
    setupEnglish();
    const { unmount } = render(<LanguageProvider><AnalyticsDashboard analytics={analytics} /></LanguageProvider>);
    expect(screen.getByText(/Not rated yet/)).toBeTruthy();
    expect(screen.getByText(/24-hour placement time/)).toBeTruthy();
    expect(screen.getByText(/Morning 7–11 AM/)).toBeTruthy();
    expect(screen.queryByText('5.0')).toBeNull();
    unmount();
    render(<LanguageProvider><CustomerFeedbackView feedbacks={[]} averageRating={0} totalFeedbacks={0} /></LanguageProvider>);
    expect(screen.getByText(/Not rated yet/)).toBeTruthy();
    expect(screen.queryByText('0.0')).toBeNull();
  });

  it('preserves actual ratings after customer feedback exists', () => {
    setupEnglish();
    const data = { ...analytics, feedbackSummary: { ...analytics.feedbackSummary!, averageRating: 4.5, totalReviews: 2 } };
    const { unmount } = render(<LanguageProvider><AnalyticsDashboard analytics={data} /></LanguageProvider>);
    expect(screen.getByText('4.5')).toBeTruthy();
    unmount();
    render(<LanguageProvider><CustomerFeedbackView feedbacks={[]} averageRating={4.5} totalFeedbacks={2} /></LanguageProvider>);
    expect(screen.getByText('4.5')).toBeTruthy();
  });

  it('hides stale analytics and feedback during failures, then recovers on manual refresh', async () => {
    setupEnglish();
    let mode: 'good' | 'partial' | 'ordersDown' = 'good';
    const fetcher = vi.fn(async (url: string) => {
      if (url.startsWith('/api/admin/orders?')) {
        return mode === 'ordersDown' ? unavailable() : ok({ orders: [], pagination: { total: 0, totalPages: 1 } });
      }
      if (url === '/api/admin/analytics') return mode === 'partial' ? unavailable() : ok(analytics);
      if (url === '/api/admin/feedback') return mode === 'partial' ? unavailable() : ok({ feedback: [] });
      if (url === '/api/admin/audit-logs') return mode === 'partial' ? unavailable() : ok({ auditLogs: [] });
      throw new Error('Unexpected fetch: ' + url);
    });
    vi.stubGlobal('fetch', fetcher);
    render(<LanguageProvider><OwnerDashboard role="ADMIN" onLogout={() => {}} /></LanguageProvider>);
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/admin/analytics', expect.anything()));
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/admin/feedback', expect.anything()));
    fireEvent.click(screen.getByRole('button', { name: /Analytics/ }));
    expect(await screen.findByText('₹480')).toBeTruthy();

    mode = 'partial';
    fireEvent.click(screen.getByRole('button', { name: /Refresh|రిఫ్రెష్/ }));
    expect(await screen.findByText(/Analytics unavailable/)).toBeTruthy();
    expect(screen.queryByText('₹480')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Feedback/ }));
    expect(await screen.findByText(/Feedback summary unavailable/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Audit Logs/ }));
    expect(await screen.findByText(/Audit logs unavailable/)).toBeTruthy();

    mode = 'good';
    fireEvent.click(screen.getByRole('button', { name: /Refresh|రిఫ్రెష్/ }));
    await waitFor(() => expect(screen.queryByText(/Audit logs unavailable/)).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: /Analytics/ }));
    expect(await screen.findByText('₹480')).toBeTruthy();

    mode = 'ordersDown';
    fireEvent.click(screen.getByRole('button', { name: /Orders/ }));
    fireEvent.click(screen.getByRole('button', { name: /Refresh|రిఫ్రెష్/ }));
    expect(await screen.findByText(/Orders unavailable/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Orders \(—\)/ })).toBeTruthy();
    expect(screen.queryByText(/No orders found matching criteria/)).toBeNull();
  });

  it('ignores an older delayed analytics response after a newer refresh succeeds', async () => {
    setupEnglish();
    let analyticsCalls = 0;
    let finishOld!: (response: Response) => void;
    const old = new Promise<Response>(resolve => { finishOld = resolve; });
    const fresher = { ...analytics, summary: { ...analytics.summary!, totalRevenueRupees: 750 } };
    const fetcher = vi.fn(async (url: string) => {
      if (url.startsWith('/api/admin/orders?')) return ok({ orders: [], pagination: { total: 0, totalPages: 1 } });
      if (url === '/api/admin/analytics') return ++analyticsCalls === 1 ? old : ok(fresher);
      if (url === '/api/admin/feedback') return ok({ feedback: [] });
      if (url === '/api/admin/audit-logs') return ok({ auditLogs: [] });
      throw new Error('Unexpected fetch');
    });
    vi.stubGlobal('fetch', fetcher);
    render(<LanguageProvider><OwnerDashboard role="ADMIN" onLogout={() => {}} /></LanguageProvider>);
    await waitFor(() => expect(analyticsCalls).toBe(1));
    // The first request has not finished and its Refresh button is disabled.
    // Changing the search starts a newer request that invalidates that old result.
    fireEvent.change(screen.getByPlaceholderText('Search by ID, name, or phone...'), { target: { value: 'fixture' } });
    fireEvent.click(screen.getByRole('button', { name: /Analytics/ }));
    expect(await screen.findByText('₹750')).toBeTruthy();
    finishOld(ok(analytics));
    await waitFor(() => expect(screen.getByText('₹750')).toBeTruthy());
    expect(screen.queryByText('₹480')).toBeNull();
  });
});
