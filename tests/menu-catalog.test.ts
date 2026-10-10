import { describe, expect, it } from 'vitest';
import {
  MENU_CATALOG,
  NEW_MENU_LAUNCH_ENABLED,
  NEW_MENU_ORDER_POLICY,
  findMenuItem,
} from '../shared/menuCatalog.ts';
import { BUSINESS_CONFIG } from '../server/config/business.ts';

describe('10-item menu catalog foundation (not live)', () => {
  it('contains six morning and four evening items with unique stable IDs', () => {
    expect(MENU_CATALOG).toHaveLength(10);
    expect(new Set(MENU_CATALOG.map(item => item.id)).size).toBe(10);
    expect(MENU_CATALOG.filter(item => item.mealPeriod === 'MORNING')).toHaveLength(6);
    expect(MENU_CATALOG.filter(item => item.mealPeriod === 'EVENING')).toHaveLength(4);
    expect(NEW_MENU_LAUNCH_ENABLED).toBe(false);
  });

  it('preserves current jowar and chapathi unit prices and minimum quantities', () => {
    expect(findMenuItem('jowar-roti')).toMatchObject({
      pricePaisa: BUSINESS_CONFIG.prices.jowarRotiPaisa,
      minimumQuantity: 5, saleUnit: 'PIECE', legacyItem: true,
    });
    expect(findMenuItem('chapathi')).toMatchObject({
      pricePaisa: BUSINESS_CONFIG.prices.chapathiPaisa,
      minimumQuantity: 5, saleUnit: 'PIECE', legacyItem: true,
    });
  });

  it('matches approved new-item prices, plate sizes, chutney and per-day stock', () => {
    const expected = [
      ['idly', 3000, 4, true], ['ragi-idly', 4000, 4, true],
      ['plain-pesarattu', 3000, null, true], ['onion-pesarattu', 4000, null, true],
      ['plain-minapa-dosa', 2000, null, true], ['onion-minapa-dosa', 4000, null, true],
      ['pulka', 3000, 5, false], ['guntha-ponganaalu', 4000, 12, true],
    ] as const;
    for (const [id, pricePaisa, piecesPerUnit, includesChutney] of expected) {
      expect(findMenuItem(id)).toMatchObject({
        pricePaisa, piecesPerUnit, includesChutney,
        saleUnit: 'PLATE', dailyPlateLimit: 30,
        minimumQuantity: 1, photoUrl: null, legacyItem: false,
      });
    }
  });

  it('keeps planned policy data separate from live checkout and hides coming-soon karam', () => {
    expect(NEW_MENU_ORDER_POLICY.minimumCartPaisa).toBe(10000);
    expect(NEW_MENU_ORDER_POLICY.acceptPreordersAnytime).toBe(true);
    expect(NEW_MENU_ORDER_POLICY.minimumDeliveryLeadMinutes).toBe(30);
    expect(NEW_MENU_ORDER_POLICY.mealWindowsIst).toEqual({
      MORNING: { start: '07:00', end: '11:00' },
      EVENING: { start: '18:00', end: '20:00' },
    });
    expect(NEW_MENU_ORDER_POLICY.complimentaryKaram).toBe('COMING_SOON');
    expect(NEW_MENU_LAUNCH_ENABLED).toBe(false);
  });
});
