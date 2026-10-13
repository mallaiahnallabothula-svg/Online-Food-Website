import { describe, it, expect } from 'vitest';
import { calculateHaversineDistanceKm, calculateDelivery } from '../server/services/deliveryService.ts';
import { DELIVERY_POLICY, deliveryTierForDistanceKm } from '../shared/deliveryPolicy.ts';
import { PRESET_LOCALITIES, KOLLUR_CENTER, checkKollurDeliveryEligibility, calculateDeliveryCharge } from '../src/data/kollurAreas.ts';

describe('Delivery tiers and kitchen location — authoritative policy', () => {
  const kitchen = { latitude: DELIVERY_POLICY.kitchenLatitude, longitude: DELIVERY_POLICY.kitchenLongitude };

  it('uses the exact requested kitchen GPS coordinates', () => {
    expect(kitchen).toEqual({ latitude: 17.444210, longitude: 78.251478 });
    expect(KOLLUR_CENTER.lat).toBe(17.444210);
    expect(KOLLUR_CENTER.lng).toBe(78.251478);
    expect(calculateHaversineDistanceKm(kitchen.latitude, kitchen.longitude, kitchen.latitude, kitchen.longitude)).toBe(0);
    expect(calculateDelivery(kitchen.latitude, kitchen.longitude)).toMatchObject({
      eligible: true, distanceKm: 0, deliveryChargePaisa: 0, maxRadiusKm: 10,
    });
  });

  it.each([
    [0, true, 0],
    [4.9, true, 0],
    [5, true, 0],
    [5.0001, true, 3000],
    [5.1, true, 3000],
    [6, true, 3000],
    [7, true, 3000],
    [7.0001, true, 5000],
    [7.1, true, 5000],
    [8, true, 5000],
    [10, true, 5000],
    [10.0001, false, 0],
    [10.1, false, 0],
    [35, false, 0],
  ])('prices a distance of %s km -> eligible=%s fee=%s paisa', (km, eligible, price) => {
    const tier = deliveryTierForDistanceKm(km);
    const charge = calculateDelivery(undefined, undefined, km);
    expect(tier).toEqual({ eligible, deliveryChargePaisa: price });
    expect(charge.eligible).toBe(eligible);
    expect(charge.deliveryChargePaisa).toBe(price);
    expect(charge.deliveryChargeRupees).toBe(price / 100);
    expect(charge.freeRadiusKm).toBe(5);
    expect(charge.standardRadiusKm).toBe(7);
    expect(charge.maxRadiusKm).toBe(10);
  });

  it('rejects bad GPS, and does not round a just-outside-10km location into service range', () => {
    expect(calculateDelivery(999, -999).eligible).toBe(false);
    expect(deliveryTierForDistanceKm(Number.NaN).eligible).toBe(false);
    expect(deliveryTierForDistanceKm(-1).eligible).toBe(false);
    // Move due north by ~10.01 km using the sphere's meridional arc.
    const latitude = kitchen.latitude + 10.01 / 111.195;
    const check = calculateDelivery(latitude, kitchen.longitude);
    expect(check.eligible).toBe(false);
    expect(check.reason).toContain('10 km');
  });

  it('uses kitchen coordinates for actual GPS fees, not old Kollur reference location', () => {
    const actual = calculateDelivery(kitchen.latitude + 6 / 111.195, kitchen.longitude);
    expect(actual.eligible).toBe(true);
    expect(actual.deliveryChargeRupees).toBe(30);
    const farther = calculateDelivery(kitchen.latitude + 8.5 / 111.195, kitchen.longitude);
    expect(farther.deliveryChargeRupees).toBe(50);
  });

  it('front-end presets and helper never advertise old ₹9/km or 35km eligibility', () => {
    for (const area of PRESET_LOCALITIES) {
      const result = checkKollurDeliveryEligibility(area.lat, area.lng);
      expect(area.distanceKm).toBe(result.distanceKm);
      expect(area.isEligible).toBe(result.isEligible);
      expect(area.deliveryCharge).toBe(result.deliveryCharge);
    }
    expect(calculateDeliveryCharge(6).deliveryCharge).toBe(30);
    expect(calculateDeliveryCharge(8).deliveryCharge).toBe(50);
    expect(checkKollurDeliveryEligibility(undefined, undefined, 11).isEligible).toBe(false);
  });
});
