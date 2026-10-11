import { InactiveMenuStage2Client } from './inactiveNewMenuStage2Client';
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
  const client = new InactiveMenuStage2Client(async (path, body) => {
    const response = await transport('/api/menu/checkout' + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Menu-Checkout': '1' },
      body: JSON.stringify(body), cache: 'no-store',
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || (path === '/confirm' ? 'Payment is not confirmed. Retry verification; do not pay again.' : 'Checkout is unverified. Do not pay again.'));
    return result;
  });
  return {
    async run(): Promise<MenuConfirmation> {
      if (import.meta.env.MODE !== 'test') throw new Error('New menu checkout is not available yet.');
      if (running) throw new Error('Checkout already in progress.');
      running = true;
      try {
        if (!prepared) {
          const { checkout: result } = await client.prepare(lockedRequest, requestKey) as { checkout: { orderId: string; customerAccessToken: string } };
          prepared = { orderId: result.orderId, customerAccessToken: result.customerAccessToken };
        }
        if (!receipt) {
          if (paymentAttempted) throw new Error('Payment outcome unknown. Keep the order for manual review; do not pay again.');
          const { gateway } = await client.startGateway(prepared.orderId, prepared.customerAccessToken) as { gateway: MenuGateway };
          if (!gateway.publicKeyId.startsWith('rzp_test_') || gateway.orderId !== prepared.orderId ||
              gateway.currency !== 'INR' || !Number.isSafeInteger(gateway.amountPaisa) || gateway.amountPaisa <= 0 ||
              Date.now() >= gateway.expiresAtMs) throw new Error('Payment details are unavailable.');
          paymentAttempted = true;
          receipt = await pay(gateway);
        }
        const { settlement: result } = await client.confirm(prepared.orderId, prepared.customerAccessToken, receipt.providerPaymentId, receipt.providerSignature) as { settlement: { status: 'CONFIRMED' | 'REVIEW_REQUIRED'; orderId: string } };
        if (result.orderId !== prepared.orderId || !['CONFIRMED', 'REVIEW_REQUIRED'].includes(result.status)) {
          throw new Error('Payment confirmation is unverified.');
        }
        return { ...result, customerAccessToken: prepared.customerAccessToken };
      } finally { running = false; }
    },
  };
}
