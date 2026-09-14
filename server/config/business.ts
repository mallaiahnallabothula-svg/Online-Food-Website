export const BUSINESS_CONFIG = {
  brand: {
    nameTe: 'మన ఇంటి వంట',
    nameEn: 'Mana Enti Vanta',
    taglineTe: 'అచ్చమైన పల్లెటూరి రుచులు, స్వచ్ఛమైన ఆరోగ్యం',
    taglineEn: 'Authentic Village Tastes & Wholesome Health',
    phone: '8499865803',
    whatsapp: '918499865803',
    upiId: '8499865803@ybl',
  },
  kitchen: {
    name: 'Kollur Central Kitchen',
    latitude: 17.4850,
    longitude: 78.2350,
  },
  prices: {
    jowarRotiPaisa: 3000,    // ₹30
    chapathiPaisa: 1000,     // ₹10
  },
  delivery: {
    freeRadiusKm: 5,
    maxRadiusKm: 35,
    extraKmRatePaisa: 900,   // ₹9 per extra km
    method: 'geodesic_haversine', // Note: Geodesic straight-line distance; road distance may vary slightly
  },
  ordering: {
    timezone: 'Asia/Kolkata',
    openHour: 11,            // 11:00 AM IST
    closeHour: 16,           // 4:00 PM IST
  },
  deliveryWindow: {
    start: '18:00',
    end: '20:00',
    displayLabelTe: 'సాయంత్రం 6:00 – 8:00 గంటల మధ్య',
    displayLabelEn: 'Evening 6:00 PM – 8:00 PM',
  },
  limits: {
    minItems: 1,
    maxJowarQty: 500,
    maxChapathiQty: 500,
    nameMin: 2,
    nameMax: 100,
    addressMin: 5,
    addressMax: 500,
    landmarkMax: 200,
    feedbackMax: 2000,
  }
} as const;
