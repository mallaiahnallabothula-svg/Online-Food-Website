import { DELIVERY_POLICY, deliveryTierForDistanceKm } from '../../shared/deliveryPolicy.ts';

export interface DeliveryCalculationResult {
  eligible: boolean;
  distanceKm: number;
  deliveryChargePaisa: number;
  deliveryChargeRupees: number;
  freeRadiusKm: number;
  maxRadiusKm: number;
  standardRadiusKm: number;
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
function rawHaversineDistanceKm(
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

  return distance;
}

/** Rounded distance for display; fee band decisions use unrounded GPS distance. */
export function calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return Math.round(rawHaversineDistanceKm(lat1, lon1, lat2, lon2) * 10) / 10;
}

export function calculateDelivery(latitude?: number, longitude?: number, defaultDistanceKm?: number): DeliveryCalculationResult {
  const kitchen = { latitude: DELIVERY_POLICY.kitchenLatitude, longitude: DELIVERY_POLICY.kitchenLongitude };
  const deliveryConfig = DELIVERY_POLICY;

  let exactDistanceKm = 0;

  if (typeof latitude === 'number' && typeof longitude === 'number') {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return {
        eligible: false,
        distanceKm: 0,
        deliveryChargePaisa: 0,
        deliveryChargeRupees: 0,
        freeRadiusKm: deliveryConfig.freeRadiusKm,
        maxRadiusKm: deliveryConfig.maxRadiusKm,
        standardRadiusKm: deliveryConfig.standardRadiusKm,
        calculationMethod: 'geodesic_haversine',
        reason: 'Invalid GPS coordinates provided',
        reasonTe: 'చెల్లని GPS కోఆర్డినేట్‌లు ఇవ్వబడ్డాయి',
      };
    }
    exactDistanceKm = rawHaversineDistanceKm(kitchen.latitude, kitchen.longitude, latitude, longitude);
  } else if (typeof defaultDistanceKm === 'number' && Number.isFinite(defaultDistanceKm) && defaultDistanceKm >= 0) {
    exactDistanceKm = defaultDistanceKm;
  } else {
    // Default inside Kollur central hub (0.8 km)
    exactDistanceKm = 0.8;
  }

  const distanceKm = Math.round(exactDistanceKm * 10) / 10;
  const tier = deliveryTierForDistanceKm(exactDistanceKm);
  if (!tier.eligible) {
    return {
      eligible: false,
      distanceKm,
      deliveryChargePaisa: 0,
      deliveryChargeRupees: 0,
      freeRadiusKm: deliveryConfig.freeRadiusKm,
      maxRadiusKm: deliveryConfig.maxRadiusKm,
      standardRadiusKm: deliveryConfig.standardRadiusKm,
      calculationMethod: 'geodesic_haversine',
      reason: `Location is ${distanceKm} km away, which exceeds our maximum delivery range of ${deliveryConfig.maxRadiusKm} km from Kollur`,
      reasonTe: `లొకేషన్ ${distanceKm} కి.మీ దూరంలో ఉంది, మా గరిష్ట డెలివరీ పరిధి ${deliveryConfig.maxRadiusKm} కి.మీ మించింది`,
    };
  }

  // Fixed tiers: 0–5 km free; >5–7 km ₹30; >7–10 km ₹50.
  const deliveryChargePaisa = tier.deliveryChargePaisa;

  return {
    eligible: true,
    distanceKm,
    deliveryChargePaisa,
    deliveryChargeRupees: deliveryChargePaisa / 100,
    freeRadiusKm: deliveryConfig.freeRadiusKm,
    maxRadiusKm: deliveryConfig.maxRadiusKm,
    standardRadiusKm: deliveryConfig.standardRadiusKm,
    calculationMethod: 'geodesic_haversine',
  };
}
