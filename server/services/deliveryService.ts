import { BUSINESS_CONFIG } from '../config/business.ts';

export interface DeliveryCalculationResult {
  eligible: boolean;
  distanceKm: number;
  deliveryChargePaisa: number;
  deliveryChargeRupees: number;
  freeRadiusKm: number;
  maxRadiusKm: number;
  calculationMethod: 'geodesic_haversine';
  reason?: string;
  reasonTe?: string;
}

/**
 * Calculates geodesic (great-circle) distance between two points on earth using the Haversine formula.
 * Formula:
 * a = sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlon/2)
 * c = 2 * atan2(√a, √(1−a))
 * d = R * c
 * Where R = 6371 km
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in kilometers

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Round to 1 decimal place for clean, predictable user presentation
  return Math.round(distance * 10) / 10;
}

export function calculateDelivery(latitude?: number, longitude?: number, defaultDistanceKm?: number): DeliveryCalculationResult {
  const kitchen = BUSINESS_CONFIG.kitchen;
  const deliveryConfig = BUSINESS_CONFIG.delivery;

  let distanceKm = 0;

  if (typeof latitude === 'number' && typeof longitude === 'number') {
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return {
        eligible: false,
        distanceKm: 0,
        deliveryChargePaisa: 0,
        deliveryChargeRupees: 0,
        freeRadiusKm: deliveryConfig.freeRadiusKm,
        maxRadiusKm: deliveryConfig.maxRadiusKm,
        calculationMethod: 'geodesic_haversine',
        reason: 'Invalid GPS coordinates provided',
        reasonTe: 'చెల్లని GPS కోఆర్డినేట్‌లు ఇవ్వబడ్డాయి',
      };
    }
    distanceKm = calculateHaversineDistanceKm(kitchen.latitude, kitchen.longitude, latitude, longitude);
  } else if (typeof defaultDistanceKm === 'number' && defaultDistanceKm >= 0) {
    distanceKm = Math.round(defaultDistanceKm * 10) / 10;
  } else {
    // Default inside Kollur central hub (0.8 km)
    distanceKm = 0.8;
  }

  if (distanceKm > deliveryConfig.maxRadiusKm) {
    return {
      eligible: false,
      distanceKm,
      deliveryChargePaisa: 0,
      deliveryChargeRupees: 0,
      freeRadiusKm: deliveryConfig.freeRadiusKm,
      maxRadiusKm: deliveryConfig.maxRadiusKm,
      calculationMethod: 'geodesic_haversine',
      reason: `Location is ${distanceKm} km away, which exceeds our maximum delivery range of ${deliveryConfig.maxRadiusKm} km from Kollur`,
      reasonTe: `లొకేషన్ ${distanceKm} కి.మీ దూరంలో ఉంది, మా గరిష్ట డెలివరీ పరిధి ${deliveryConfig.maxRadiusKm} కి.మీ మించింది`,
    };
  }

  // Delivery charge calculation in integer paise:
  // <= 5 km: Free (0 paise)
  // > 5 km: ₹9/km (900 paise/km) for excess distance beyond 5 km
  let deliveryChargePaisa = 0;
  if (distanceKm > deliveryConfig.freeRadiusKm) {
    const excessKm = distanceKm - deliveryConfig.freeRadiusKm;
    deliveryChargePaisa = Math.round(excessKm * deliveryConfig.extraKmRatePaisa);
  }

  return {
    eligible: true,
    distanceKm,
    deliveryChargePaisa,
    deliveryChargeRupees: Math.round(deliveryChargePaisa / 100),
    freeRadiusKm: deliveryConfig.freeRadiusKm,
    maxRadiusKm: deliveryConfig.maxRadiusKm,
    calculationMethod: 'geodesic_haversine',
  };
}
