import type { CustomerDetails, KaramSelection } from '../types';
export interface CheckoutDraft { jowarQuantity: number; chapathiQuantity: number; karamSelection: KaramSelection; customer: CustomerDetails }
export interface CheckoutIntent {
  intentId: string; orderId: string; customerAccessToken: string; provider: string;
  amountPaisa: number; amountRupees: number; subtotalRupees: number; deliveryChargeRupees: number;
  distanceKm: number; currency: string; providerDetails?: { keyId: string; orderId: string };
}
const pendingKey = 'smjr_pending_checkout';
const requests = new Map<string, { promise: Promise<CheckoutIntent>; expiresAt: number }>();
export function persistCustomerOrder(orderId: string, customerAccessToken: string) {
  if (!customerAccessToken) return;
  try {
    const stored = JSON.parse(localStorage.getItem('smjr_customer_orders') || '[]');
    const orders = Array.isArray(stored) ? stored : [];
    const existing = orders.find(order => order.id === orderId) || {};
    localStorage.setItem('smjr_customer_orders', JSON.stringify([
      { date: new Date().toISOString(), status: 'PENDING', ...existing, id: orderId, customerAccessToken },
      ...orders.filter(order => order.id !== orderId),
    ].slice(0, 20)));
  } catch { /* Browser storage may be disabled. */ }
}
export function clearPendingCheckout(intentId: string) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(pendingKey) || 'null');
    if (saved?.intent?.intentId === intentId) sessionStorage.removeItem(pendingKey);
  } catch { /* Ignore unavailable storage. */ }
  requests.clear();
}
export async function createCheckout(draft: CheckoutDraft): Promise<CheckoutIntent> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(draft)));
  const fingerprint = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  try {
    const saved = JSON.parse(sessionStorage.getItem(pendingKey) || 'null');
    if (saved?.fingerprint === fingerprint && saved.expiresAt > Date.now()) {
      persistCustomerOrder(saved.intent.orderId, saved.intent.customerAccessToken);
      return saved.intent;
    }
  } catch { /* New checkout still works without storage. */ }
  const existing = requests.get(fingerprint);
  if (existing && existing.expiresAt > Date.now()) return existing.promise;
  const request = (async () => {
    const response = await fetch('/api/payment/create-intent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.intentId) throw new Error(data?.error?.message || 'Payment service is unavailable. Please try again.');
    persistCustomerOrder(data.orderId, data.customerAccessToken);
    try { sessionStorage.setItem(pendingKey, JSON.stringify({ fingerprint, intent: data, expiresAt: Date.now() + 29 * 60 * 1000 })); } catch { /* Storage unavailable. */ }
    return data as CheckoutIntent;
  })();
  requests.set(fingerprint, { promise: request, expiresAt: Date.now() + 29 * 60 * 1000 });
  request.catch(() => requests.delete(fingerprint));
  return request;
}
