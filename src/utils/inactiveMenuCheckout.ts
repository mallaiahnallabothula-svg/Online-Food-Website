/** Isolated checkout driver; production calls fail before any network request.
 * A session locks its cart and request key. Retry reuses preparation and receipt.
 */
export interface MenuCheckoutRequest {
  lines: { itemId: string; quantity: number }[];
  customer: { name: string; mobile: string; address: string; landmark?: string; latitude: number; longitude: number };
}
export interface MenuGateway {
  orderId: string; providerOrderId: string; publicKeyId: string;
  amountPaisa: number; currency: 'INR'; expiresAtMs: number;
}
export interface MenuReceipt { providerPaymentId: string; providerSignature: string }
export interface MenuConfirmation { status: 'CONFIRMED' | 'REVIEW_REQUIRED'; orderId: string; customerAccessToken: string }
export type TestPayment = (gateway: MenuGateway) => Promise<MenuReceipt>;

export function createInactiveMenuCheckoutSession(
  request: MenuCheckoutRequest, pay: TestPayment, transport: typeof fetch = fetch,
) {
  const requestKey = crypto.randomUUID();
  const lockedRequest = JSON.parse(JSON.stringify(request)) as MenuCheckoutRequest;
  let prepared: { orderId: string; customerAccessToken: string } | undefined;
  let receipt: MenuReceipt | undefined;
  let running = false;
  let paymentAttempted = false;
  async function post<T>(action: string, body: unknown): Promise<T> {
    const response = await transport('/api/menu/checkout/' + action, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Menu-Checkout': '1' },
      body: JSON.stringify(body), cache: 'no-store',
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || 'Checkout is unverified. Do not pay again.');
    return result as T;
  }
  return {
    async run(): Promise<MenuConfirmation> {
      if (import.meta.env.MODE !== 'test') throw new Error('New menu checkout is not available yet.');
      if (running) throw new Error('Checkout already in progress.');
      running = true;
      try {
        if (!prepared) {
          const result = await post<{ orderId: string; customerAccessToken: string }>('prepare', { requestKey, request: lockedRequest });
          prepared = { orderId: result.orderId, customerAccessToken: result.customerAccessToken };
        }
        if (!receipt) {
          if (paymentAttempted) throw new Error('Payment outcome unknown. Keep the order for manual review; do not pay again.');
          const gateway = await post<MenuGateway>('gateway', prepared);
          if (!gateway.publicKeyId.startsWith('rzp_test_') || gateway.orderId !== prepared.orderId ||
              gateway.currency !== 'INR' || !Number.isSafeInteger(gateway.amountPaisa) || gateway.amountPaisa <= 0 ||
              Date.now() >= gateway.expiresAtMs) throw new Error('Payment details are unavailable.');
          paymentAttempted = true;
          receipt = await pay(gateway);
        }
        const result = await post<{ status: 'CONFIRMED' | 'REVIEW_REQUIRED'; orderId: string }>('confirm', { ...prepared, ...receipt });
        if (result.orderId !== prepared.orderId || !['CONFIRMED', 'REVIEW_REQUIRED'].includes(result.status)) {
          throw new Error('Payment confirmation is unverified.');
        }
        return { ...result, customerAccessToken: prepared.customerAccessToken };
      } finally { running = false; }
    },
  };
}
