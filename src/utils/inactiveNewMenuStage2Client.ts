/**
 * Inactive 10-item checkout client contract, independent of the legacy cart.
 * Only inject a stage-2 test transport; this module does not call fetch,
 * launch Razorpay, persist tokens or activate public ordering.
 */
import { MENU_CATALOG, NEW_MENU_LAUNCH_ENABLED } from '../../shared/menuCatalog.ts';
import type { NewMenuCheckoutRequest } from '../../server/services/newMenuCheckoutService.ts';

export interface Stage2CartLine { readonly itemId: string; readonly quantity: number }
export type Stage2Transport = (path: string, payload: unknown) => Promise<unknown>;

export function buildStage2CheckoutRequest(
  lines: readonly Stage2CartLine[],
  customer: NewMenuCheckoutRequest['customer'],
): NewMenuCheckoutRequest {
  if (NEW_MENU_LAUNCH_ENABLED) throw new Error('Stage-2 preview must not run in live checkout');
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > MENU_CATALOG.length) {
    throw new Error('Select menu items before checkout');
  }
  const catalog = new Map(MENU_CATALOG.map(item => [item.id, item]));
  const seen = new Set<string>();
  let period: string | undefined;
  let subtotalPaisa = 0;
  for (const line of lines) {
    const item = catalog.get(line.itemId);
    if (!item || seen.has(line.itemId) ||
        !Number.isSafeInteger(line.quantity) ||
        line.quantity < item.minimumQuantity ||
        line.quantity > (item.dailyPlateLimit ?? 500) ||
        (period && period !== item.mealPeriod)) {
      throw new Error('Invalid or mixed meal-period cart');
    }
    seen.add(line.itemId);
    period = item.mealPeriod;
    subtotalPaisa += item.pricePaisa * line.quantity;
  }
  if (subtotalPaisa < 10000) throw new Error('Minimum food cart ₹100');
  if (!customer || !/^[6-9]\d{9}$/.test(customer.mobile) ||
      customer.name.trim().length < 2 || customer.address.trim().length < 5 ||
      !Number.isFinite(customer.latitude) || !Number.isFinite(customer.longitude)) {
    throw new Error('Valid customer address, phone and location coordinates are required');
  }
  // NEVER send a client price or an assumed stock/reservation status.
  return { lines: lines.map(({itemId,quantity}) => ({itemId,quantity})), customer: {
    name: customer.name.trim(), mobile: customer.mobile,
    address: customer.address.trim(), landmark: customer.landmark?.trim() ?? '',
    latitude: customer.latitude, longitude: customer.longitude,
    locationLink: customer.locationLink,
  }};
}

export class InactiveMenuStage2Client {
  constructor(private readonly send: Stage2Transport) {}
  quote(request: NewMenuCheckoutRequest) { return this.send('/quote', request); }
  prepare(request: NewMenuCheckoutRequest, requestKey: string) {
    return this.send('/prepare', {request,requestKey});
  }
  startGateway(orderId: string, customerAccessToken: string) {
    return this.send('/gateway', {orderId,customerAccessToken});
  }
  confirm(orderId: string, customerAccessToken: string,
          providerPaymentId: string, providerSignature: string) {
    return this.send('/confirm', {
      orderId,customerAccessToken,providerPaymentId,providerSignature,
    });
  }
  track(customerAccessToken: string) { return this.send('/track', {customerAccessToken}); }
}
