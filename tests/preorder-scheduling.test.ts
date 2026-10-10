import { describe, expect, it } from 'vitest';
import { NEW_MENU_LAUNCH_ENABLED, NEW_MENU_ORDER_POLICY } from '../shared/menuCatalog.ts';
import { getNextPreorderDeliverySlot } from '../shared/preorderScheduling.ts';

function at(utc: string): Date {
  return new Date(utc);
}

describe('inactive 24-hour pre-order meal-slot foundation (IST)', () => {
  it('keeps confirmed business policy and leaves the new checkout disabled', () => {
    expect(NEW_MENU_LAUNCH_ENABLED).toBe(false);
    expect(NEW_MENU_ORDER_POLICY.acceptPreordersAnytime).toBe(true);
    expect(NEW_MENU_ORDER_POLICY.minimumDeliveryLeadMinutes).toBe(30);
    expect(NEW_MENU_ORDER_POLICY.mealWindowsIst).toEqual({
      MORNING: { start: '07:00', end: '11:00' },
      EVENING: { start: '18:00', end: '20:00' },
    });
  });

  it.each([
    // UTC timestamps are absolute instants; descriptions show local IST clock.
    ['before breakfast, 06:00', 'MORNING', '2026-10-10T00:30:00.000Z', '2026-10-10', '2026-10-10T01:30:00.000Z'],
    ['during breakfast, 07:10 + 30', 'MORNING', '2026-10-10T01:40:00.000Z', '2026-10-10', '2026-10-10T02:10:00.000Z'],
    ['just before breakfast cutoff, 10:29', 'MORNING', '2026-10-10T04:59:00.000Z', '2026-10-10', '2026-10-10T05:29:00.000Z'],
    ['at breakfast cutoff, 10:30', 'MORNING', '2026-10-10T05:00:00.000Z', '2026-10-11', '2026-10-11T01:30:00.000Z'],
    ['afternoon breakfast preorder, 14:00', 'MORNING', '2026-10-10T08:30:00.000Z', '2026-10-11', '2026-10-11T01:30:00.000Z'],
    ['afternoon evening preorder, 14:00', 'EVENING', '2026-10-10T08:30:00.000Z', '2026-10-10', '2026-10-10T12:30:00.000Z'],
    ['inside evening window, 19:29', 'EVENING', '2026-10-10T13:59:00.000Z', '2026-10-10', '2026-10-10T14:29:00.000Z'],
    ['at evening cutoff, 19:30', 'EVENING', '2026-10-10T14:00:00.000Z', '2026-10-11', '2026-10-11T12:30:00.000Z'],
    ['late night morning preorder, 21:00', 'MORNING', '2026-10-10T15:30:00.000Z', '2026-10-11', '2026-10-11T01:30:00.000Z'],
    ['late night evening preorder, 21:00', 'EVENING', '2026-10-10T15:30:00.000Z', '2026-10-11', '2026-10-11T12:30:00.000Z'],
    ['year rollover, 31 Dec at 23:59 IST', 'MORNING', '2026-12-31T18:29:00.000Z', '2027-01-01', '2027-01-01T01:30:00.000Z'],
    ['leap-day rollover, 28 Feb at 23:00 IST', 'MORNING', '2028-02-28T17:30:00.000Z', '2028-02-29', '2028-02-29T01:30:00.000Z'],
  ] as const)('%s', (_case, meal, nowUtc, expectedIstDate, earliestUtc) => {
    const input = at(nowUtc);
    const originalInputMs = input.getTime();
    const slot = getNextPreorderDeliverySlot(meal, input);

    expect(slot.mealPeriod).toBe(meal);
    expect(slot.deliveryDateIst).toBe(expectedIstDate);
    expect(slot.earliestEligibleDeliveryUtc).toBe(earliestUtc);
    expect(new Date(slot.earliestEligibleDeliveryUtc).getTime())
      .toBeGreaterThanOrEqual(input.getTime() + 30 * 60_000);
    expect(new Date(slot.earliestEligibleDeliveryUtc).getTime())
      .toBeGreaterThanOrEqual(new Date(slot.windowStartUtc).getTime());
    expect(new Date(slot.earliestEligibleDeliveryUtc).getTime())
      .toBeLessThan(new Date(slot.windowEndUtc).getTime());
    expect(input.getTime()).toBe(originalInputMs); // pure calculation
  });

  it('returns precise UTC boundaries and local IST times for both meals', () => {
    const morning = getNextPreorderDeliverySlot('MORNING', at('2026-10-10T00:30:00.000Z'));
    expect(morning).toMatchObject({
      windowStartIst: '07:00', windowEndIst: '11:00',
      windowStartUtc: '2026-10-10T01:30:00.000Z',
      windowEndUtc: '2026-10-10T05:30:00.000Z',
    });
    const evening = getNextPreorderDeliverySlot('EVENING', at('2026-10-10T08:30:00.000Z'));
    expect(evening).toMatchObject({
      windowStartIst: '18:00', windowEndIst: '20:00',
      windowStartUtc: '2026-10-10T12:30:00.000Z',
      windowEndUtc: '2026-10-10T14:30:00.000Z',
    });
  });

  it('rejects invalid dates and unrecognized meal periods', () => {
    expect(() => getNextPreorderDeliverySlot('MORNING', new Date('invalid'))).toThrow('valid order placement date');
    expect(() => getNextPreorderDeliverySlot('EVENING', null as unknown as Date)).toThrow('valid order placement date');
    expect(() => getNextPreorderDeliverySlot('LUNCH' as 'MORNING', at('2026-10-10T00:30:00.000Z')))
      .toThrow('Invalid meal period');
  });
});
