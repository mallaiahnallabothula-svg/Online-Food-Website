/**
 * Mana Enti Vanta: proposed 10-item menu foundation.
 *
 * This module is data-only and safe for both frontend and backend imports.
 * IMPORTANT: the legacy two-item checkout remains authoritative until the
 * additive itemized order/payment flow is fully tested and explicitly launched.
 */
export type MealPeriod = 'MORNING' | 'EVENING';
export type SaleUnit = 'PIECE' | 'PLATE';

export interface MenuItem {
  readonly id: string;
  readonly nameEn: string;
  readonly nameTe: string;
  readonly mealPeriod: MealPeriod;
  readonly saleUnit: SaleUnit;
  /** Pieces in one sale unit, if explicitly specified by the business. */
  readonly piecesPerUnit: number | null;
  readonly pricePaisa: number;
  /** Minimum quantity for this item if selected in a new order. */
  readonly minimumQuantity: number;
  /** Null means no new limit is specified; do not invent a legacy stock cap. */
  readonly dailyPlateLimit: number | null;
  readonly includesChutney: boolean;
  /** Real food photos have not been provided yet. */
  readonly photoUrl: null;
  readonly legacyItem: boolean;
}

/** Metadata for future checkout integration. Does not alter live ordering rules. */
export const NEW_MENU_ORDER_POLICY = {
  minimumCartPaisa: 10_000, // ₹100
  acceptPreordersAnytime: true,
  minimumDeliveryLeadMinutes: 30,
  mealWindowsIst: {
    MORNING: { start: '07:00', end: '11:00' },
    EVENING: { start: '18:00', end: '20:00' },
  },
  complimentaryKaram: 'COMING_SOON',
} as const;

/**
 * Safety switch for subsequent work: do not publish this new menu until
 * itemized pricing, payment verification, inventory and owner tickets are ready.
 */
export const NEW_MENU_LAUNCH_ENABLED = false;

export const MENU_CATALOG: readonly MenuItem[] = [
  {
    id: 'idly', nameEn: 'Idly', nameTe: 'ఇడ్లీ',
    mealPeriod: 'MORNING', saleUnit: 'PLATE', piecesPerUnit: 4,
    pricePaisa: 3000, minimumQuantity: 1, dailyPlateLimit: 30,
    includesChutney: true, photoUrl: null, legacyItem: false,
  },
  {
    id: 'ragi-idly', nameEn: 'Ragi Idly', nameTe: 'రాగి ఇడ్లీ',
    mealPeriod: 'MORNING', saleUnit: 'PLATE', piecesPerUnit: 4,
    pricePaisa: 4000, minimumQuantity: 1, dailyPlateLimit: 30,
    includesChutney: true, photoUrl: null, legacyItem: false,
  },
  {
    id: 'plain-pesarattu', nameEn: 'Plain Pesarattu', nameTe: 'ప్లెయిన్ పెసరట్టు',
    mealPeriod: 'MORNING', saleUnit: 'PLATE', piecesPerUnit: null,
    pricePaisa: 3000, minimumQuantity: 1, dailyPlateLimit: 30,
    includesChutney: true, photoUrl: null, legacyItem: false,
  },
  {
    id: 'onion-pesarattu', nameEn: 'Onion Pesarattu', nameTe: 'ఉల్లి పెసరట్టు',
    mealPeriod: 'MORNING', saleUnit: 'PLATE', piecesPerUnit: null,
    pricePaisa: 4000, minimumQuantity: 1, dailyPlateLimit: 30,
    includesChutney: true, photoUrl: null, legacyItem: false,
  },
  {
    id: 'plain-minapa-dosa', nameEn: 'Plain Minapa Dosa', nameTe: 'ప్లెయిన్ మినప దోసె',
    mealPeriod: 'MORNING', saleUnit: 'PLATE', piecesPerUnit: null,
    pricePaisa: 2000, minimumQuantity: 1, dailyPlateLimit: 30,
    includesChutney: true, photoUrl: null, legacyItem: false,
  },
  {
    id: 'onion-minapa-dosa', nameEn: 'Onion Minapa Dosa', nameTe: 'ఉల్లి మినప దోసె',
    mealPeriod: 'MORNING', saleUnit: 'PLATE', piecesPerUnit: null,
    pricePaisa: 4000, minimumQuantity: 1, dailyPlateLimit: 30,
    includesChutney: true, photoUrl: null, legacyItem: false,
  },
  {
    id: 'jowar-roti', nameEn: 'Jowar Roti', nameTe: 'జొన్న రొట్టె',
    mealPeriod: 'EVENING', saleUnit: 'PIECE', piecesPerUnit: 1,
    pricePaisa: 3000, minimumQuantity: 5, dailyPlateLimit: null,
    includesChutney: false, photoUrl: null, legacyItem: true,
  },
  {
    id: 'chapathi', nameEn: 'Chapathi', nameTe: 'చపాతీ',
    mealPeriod: 'EVENING', saleUnit: 'PIECE', piecesPerUnit: 1,
    pricePaisa: 1000, minimumQuantity: 5, dailyPlateLimit: null,
    includesChutney: false, photoUrl: null, legacyItem: true,
  },
  {
    id: 'pulka', nameEn: 'Pulka', nameTe: 'పుల్కా',
    mealPeriod: 'EVENING', saleUnit: 'PLATE', piecesPerUnit: 5,
    pricePaisa: 3000, minimumQuantity: 1, dailyPlateLimit: 30,
    includesChutney: false, photoUrl: null, legacyItem: false,
  },
  {
    id: 'guntha-ponganaalu', nameEn: 'Guntha Ponganaalu', nameTe: 'గుంత పొంగనాలు',
    mealPeriod: 'EVENING', saleUnit: 'PLATE', piecesPerUnit: 12,
    pricePaisa: 4000, minimumQuantity: 1, dailyPlateLimit: 30,
    includesChutney: true, photoUrl: null, legacyItem: false,
  },
];

export function findMenuItem(id: string): MenuItem | undefined {
  return MENU_CATALOG.find(item => item.id === id);
}
