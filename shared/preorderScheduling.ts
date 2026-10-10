/**
 * Pure, inactive 24-hour pre-order scheduling foundation for Mana Enti Vanta.
 * No checkout/API/UI imports this module yet. This only calculates the next
 * eligible IST meal window, NOT a promised delivery time or stock availability.
 */
import { NEW_MENU_ORDER_POLICY, type MealPeriod } from './menuCatalog.ts';

const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export interface PreorderDeliverySlot {
  readonly mealPeriod: MealPeriod;
  /** Calendar date in India, YYYY-MM-DD. */
  readonly deliveryDateIst: string;
  /** Local IST business window, HH:mm (24-hour clock). */
  readonly windowStartIst: string;
  readonly windowEndIst: string;
  /** UTC instants for the meal window (end exclusive). */
  readonly windowStartUtc: string;
  readonly windowEndUtc: string;
  /**
   * Earliest eligible instant given the minimum lead time and meal window.
   * Actual dispatch/delivery time remains subject to the kitchen and capacity.
   */
  readonly earliestEligibleDeliveryUtc: string;
}

function minutesAfterMidnight(clock: string): number {
  if (!/^\d{2}:\d{2}$/.test(clock)) {
    throw new Error('Invalid meal window clock');
  }
  const [h, m] = clock.split(':').map(Number);
  if (h === undefined || m === undefined || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new Error('Invalid meal window clock');
  }
  return h * 60 + m;
}

/**
 * Find the next morning/evening delivery window, for an order placed ANY time.
 *
 * - Clock input is a real UTC instant (JS Date), not a pre-shifted IST Date.
 * - Asia/Kolkata has a fixed UTC+05:30 offset and no daylight-saving changes.
 * - The latest eligible instant is strictly BEFORE the window's end.
 * - A missed window schedules the same meal for the next calendar day.
 * - Does not modify legacy 11 AM–4 PM ordering rules, stock or payments.
 */
export function getNextPreorderDeliverySlot(
  mealPeriod: MealPeriod,
  placedAt: Date,
): PreorderDeliverySlot {
  if (!(placedAt instanceof Date) || !Number.isFinite(placedAt.getTime())) {
    throw new TypeError('A valid order placement date is required');
  }

  const window = NEW_MENU_ORDER_POLICY.mealWindowsIst[mealPeriod];
  if (!window) {
    throw new Error('Invalid meal period');
  }

  const openMinute = minutesAfterMidnight(window.start);
  const closeMinute = minutesAfterMidnight(window.end);
  if (openMinute >= closeMinute) {
    throw new Error('Meal window must start before it ends');
  }

  const earliestUtcMs = placedAt.getTime()
    + NEW_MENU_ORDER_POLICY.minimumDeliveryLeadMinutes * MINUTE_MS;

  // Shift only for IST calendar arithmetic; all returned instants remain UTC.
  const localIst = new Date(placedAt.getTime() + IST_OFFSET_MS);
  const todayIstMidnightAsUtcMs = Date.UTC(
    localIst.getUTCFullYear(),
    localIst.getUTCMonth(),
    localIst.getUTCDate(),
  );

  for (let dayOffset = 0; dayOffset <= 2; dayOffset++) {
    const dayMs = todayIstMidnightAsUtcMs + dayOffset * DAY_MS;
    const startUtcMs = dayMs + openMinute * MINUTE_MS - IST_OFFSET_MS;
    const endUtcMs = dayMs + closeMinute * MINUTE_MS - IST_OFFSET_MS;
    const eligibleUtcMs = Math.max(startUtcMs, earliestUtcMs);

    // The closing time is a cutoff, not a guaranteed delivery instant.
    if (eligibleUtcMs < endUtcMs) {
      return {
        mealPeriod,
        deliveryDateIst: new Date(dayMs).toISOString().slice(0, 10),
        windowStartIst: window.start,
        windowEndIst: window.end,
        windowStartUtc: new Date(startUtcMs).toISOString(),
        windowEndUtc: new Date(endUtcMs).toISOString(),
        earliestEligibleDeliveryUtc: new Date(eligibleUtcMs).toISOString(),
      };
    }
  }

  // Impossible for the configured same-day meal windows and 30-minute lead.
  throw new Error('No eligible delivery window found');
}
