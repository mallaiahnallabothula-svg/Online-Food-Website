/**
 * One shared delivery policy for frontend labels, legacy checkout and new-menu
 * server pricing. Distances use straight-line Haversine km, NOT road distance.
 * Bounds: <=5 free, >5 <=7 ₹30, >7 <=10 ₹50, >10 ineligible.
 */
export const DELIVERY_POLICY = {
  kitchenLatitude: 17.444210,
  kitchenLongitude: 78.251478,
  freeRadiusKm: 5,
  standardRadiusKm: 7,
  maxRadiusKm: 10,
  standardChargePaisa: 3000,
  outerChargePaisa: 5000,
} as const;

export function deliveryTierForDistanceKm(distanceKm: number): {
  eligible: boolean;
  deliveryChargePaisa: number;
} {
  if (!Number.isFinite(distanceKm) || distanceKm < 0 || distanceKm > DELIVERY_POLICY.maxRadiusKm) {
    return { eligible: false, deliveryChargePaisa: 0 };
  }
  if (distanceKm <= DELIVERY_POLICY.freeRadiusKm) {
    return { eligible: true, deliveryChargePaisa: 0 };
  }
  if (distanceKm <= DELIVERY_POLICY.standardRadiusKm) {
    return { eligible: true, deliveryChargePaisa: DELIVERY_POLICY.standardChargePaisa };
  }
  return { eligible: true, deliveryChargePaisa: DELIVERY_POLICY.outerChargePaisa };
}
