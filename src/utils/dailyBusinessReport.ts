import type { Order } from '../types';
import { kitchenOrderSession, projectKitchenBoard, validKitchenDate } from './kitchenBoard';

export interface DailyBusinessSummary {
  readonly date: string;
  readonly paidOrders: number;
  readonly foodSalesPaisa: number;
  readonly deliveryFeesPaisa: number;
  readonly paidTotalPaisa: number;
  readonly awaitingDelivery: number;
  readonly delivered: number;
  readonly cancelledPaid: number;
  readonly morning: number;
  readonly evening: number;
  readonly unclassified: number;
  readonly toPrepare: ReturnType<typeof projectKitchenBoard>['toPrepare'];
}

/**
 * Daily figures describe orders scheduled for DELIVERY on the given IST date.
 * Revenue is recorded gross PAID amount, not profit, payout or net of refunds.
 * A cancelled order still marked PAID remains counted and is flagged for review.
 */
export function summarizeDailyBusiness(orders: readonly Order[], date: string): DailyBusinessSummary {
  if (!validKitchenDate(date)) throw new Error('Invalid report date');
  if (orders.some(order => order.deliveryDate !== date || typeof order.id !== 'string')) {
    throw new Error('Daily report contains orders for a different date');
  }
  const paid = orders.filter(o => o.paymentStatus === 'PAID');
  const toPaisa = (amount: unknown) => {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
      throw new Error('Incomplete financial data. Please retry.');
    }
    return Math.round(amount * 100);
  };
  let foodSalesPaisa = 0;
  let deliveryFeesPaisa = 0;
  let paidTotalPaisa = 0;
  for (const o of paid) {
    foodSalesPaisa += toPaisa(o.subtotal);
    deliveryFeesPaisa += toPaisa(o.deliveryCharge);
    paidTotalPaisa += toPaisa(o.totalAmount);
  }
  const sessionTypes = paid.map(kitchenOrderSession);
  const board = projectKitchenBoard(orders, date, 'ALL');
  return {
    date, paidOrders: paid.length, foodSalesPaisa, deliveryFeesPaisa, paidTotalPaisa,
    awaitingDelivery: board.orders.length,
    delivered: paid.filter(o => o.fulfillmentStatus === 'DELIVERED').length,
    cancelledPaid: paid.filter(o => o.fulfillmentStatus === 'CANCELLED').length,
    morning: sessionTypes.filter(x => x === 'MORNING').length,
    evening: sessionTypes.filter(x => x === 'EVENING').length,
    unclassified: sessionTypes.filter(x => x === 'UNCLASSIFIED').length,
    toPrepare: board.toPrepare,
  };
}

export function rupeesFromPaisa(amount: number): string {
  return '₹' + (amount / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}
