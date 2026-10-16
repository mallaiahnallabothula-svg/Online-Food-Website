/** Confirmed menu. Shared by customer presentation and authoritative pricing. */
export type MealPeriod = 'MORNING' | 'EVENING';
export type SaleUnit = 'PIECE' | 'PLATE' | 'PACK';

export interface MenuItem {
  readonly id: string;
  readonly nameEn: string;
  readonly nameTe: string;
  readonly mealPeriod: MealPeriod;
  readonly saleUnit: SaleUnit;
  /** Pieces in one sale unit, if explicitly specified by the business. */
  readonly piecesPerUnit: number | null;
  readonly gramsPerUnit?: number;
  readonly pricePaisa: number;
  /** Minimum quantity for this item if selected in a new order. */
  readonly minimumQuantity: number;
  /** Daily sale-unit stock cap. Historical field name retained for compatibility; includes pieces and packs. */
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
  complimentaryKaram: 'REMOVED',
} as const;

/**
 * Safety switch for subsequent work: do not publish this new menu until
 * itemized pricing, payment verification, inventory and owner tickets are ready.
 */
// Vite replaces this expression with the production build flag for the
// customer UI. Server code reads the same Vercel environment variable at
// runtime. The default remains fail-closed.
export const NEW_MENU_LAUNCH_ENABLED = process.env.NEW_MENU_LAUNCH_ENABLED === 'true';

/** Explicitly OFF until isolated migration, acceptance and owner-approved production activation. */
export const SMART_MENU_CONTROLS_ENABLED =
  process.env.SMART_MENU_CONTROLS_ENABLED === 'true' &&
  process.env.SMART_MENU_SCHEMA_READY === 'true';

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
    mealPeriod: 'MORNING', saleUnit: 'PLATE', piecesPerUnit: 1,
    pricePaisa: 3000, minimumQuantity: 1, dailyPlateLimit: 30,
    includesChutney: true, photoUrl: null, legacyItem: false,
  },
  {
    id: 'onion-pesarattu', nameEn: 'Onion Pesarattu', nameTe: 'ఉల్లి పెసరట్టు',
    mealPeriod: 'MORNING', saleUnit: 'PLATE', piecesPerUnit: 1,
    pricePaisa: 4000, minimumQuantity: 1, dailyPlateLimit: 30,
    includesChutney: true, photoUrl: null, legacyItem: false,
  },
  {
    id: 'plain-minapa-dosa', nameEn: 'Plain Minapa Dosa', nameTe: 'ప్లెయిన్ మినప దోసె',
    mealPeriod: 'MORNING', saleUnit: 'PLATE', piecesPerUnit: 1,
    pricePaisa: 2000, minimumQuantity: 1, dailyPlateLimit: 30,
    includesChutney: true, photoUrl: null, legacyItem: false,
  },
  {
    id: 'onion-minapa-dosa', nameEn: 'Onion Minapa Dosa', nameTe: 'ఉల్లి మినప దోసె',
    mealPeriod: 'MORNING', saleUnit: 'PLATE', piecesPerUnit: 1,
    pricePaisa: 4000, minimumQuantity: 1, dailyPlateLimit: 30,
    includesChutney: true, photoUrl: null, legacyItem: false,
  },
  {
    id: 'jowar-roti', nameEn: 'Jowar Roti', nameTe: 'జొన్న రొట్టె',
    mealPeriod: 'EVENING', saleUnit: 'PIECE', piecesPerUnit: 1,
    pricePaisa: 3000, minimumQuantity: 3, dailyPlateLimit: 50,
    includesChutney: false, photoUrl: null, legacyItem: true,
  },
  {
    id: 'chapathi', nameEn: 'Chapathi', nameTe: 'చపాతీ',
    mealPeriod: 'EVENING', saleUnit: 'PIECE', piecesPerUnit: 1,
    pricePaisa: 1000, minimumQuantity: 3, dailyPlateLimit: 50,
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
  {
    id: 'pappu-of-the-day', nameEn: 'Pappu of the Day', nameTe: 'రోజు పప్పు',
    mealPeriod: 'EVENING', saleUnit: 'PACK', piecesPerUnit: null, gramsPerUnit: 120,
    pricePaisa: 3000, minimumQuantity: 1, dailyPlateLimit: 30,
    includesChutney: false, photoUrl: null, legacyItem: false,
  },
  {
    id: 'mixed-veg-kurma', nameEn: 'Mixed Veg Kurma', nameTe: 'మిక్స్ వెజ్ కుర్మా',
    mealPeriod: 'EVENING', saleUnit: 'PACK', piecesPerUnit: null, gramsPerUnit: 120,
    pricePaisa: 4000, minimumQuantity: 1, dailyPlateLimit: 30,
    includesChutney: false, photoUrl: null, legacyItem: false,
  },

  ...(SMART_MENU_CONTROLS_ENABLED ? [{
    id: 'uthappam', nameEn: 'Uthappam', nameTe: 'ఉత్తప్పం',
    mealPeriod: 'MORNING', saleUnit: 'PLATE', piecesPerUnit: 2,
    pricePaisa: 3000, minimumQuantity: 1, dailyPlateLimit: 30,
    includesChutney: false, photoUrl: null, legacyItem: false,
  }, {
    id: 'curry-of-the-day', nameEn: 'Curry of the Day', nameTe: 'రోజు కూర',
    mealPeriod: 'EVENING', saleUnit: 'PACK', piecesPerUnit: null, gramsPerUnit: 100,
    pricePaisa: 5000, minimumQuantity: 1, dailyPlateLimit: 30,
    includesChutney: false, photoUrl: null, legacyItem: false,
  }] as const : []),
];

export function findMenuItem(id: string): MenuItem | undefined {
  return MENU_CATALOG.find(item => item.id === id);
}
