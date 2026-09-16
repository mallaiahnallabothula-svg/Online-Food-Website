import { describe, it, expect } from 'vitest';
import { calculateHaversineDistanceKm, calculateDelivery } from '../server/services/deliveryService.ts';
import { BUSINESS_CONFIG } from '../server/config/business.ts';

describe('Delivery Service & Geodesic Calculation', () => {
  const kitchen = BUSINESS_CONFIG.kitchen;

  it('calculates 0 km distance when coordinates match kitchen', () => {
    const dist = calculateHaversineDistanceKm(
      kitchen.latitude,
      kitchen.longitude,
      kitchen.latitude,
      kitchen.longitude
    );
    expect(dist).toBe(0);
  });

  it('correctly calculates distance for nearby location in Hyderabad', () => {
    // A point approx 3.5 km away
    const testLat = kitchen.latitude + 0.025;
    const testLon = kitchen.longitude + 0.02;
    const dist = calculateHaversineDistanceKm(kitchen.latitude, kitchen.longitude, testLat, testLon);
    expect(dist).toBeGreaterThan(2);
    expect(dist).toBeLessThan(5);
  });

  it('grants free delivery within free radius (<= 5km)', () => {
    // Within 2km of kitchen
    const lat = kitchen.latitude + 0.01;
    const lon = kitchen.longitude + 0.01;
    const result = calculateDelivery(lat, lon);

    expect(result.eligible).toBe(true);
    expect(result.distanceKm).toBeLessThanOrEqual(5);
    expect(result.deliveryChargeRupees).toBe(0);
    expect(result.deliveryChargePaisa).toBe(0);
  });

  it('calculates delivery fee for distance between 5km and 10km', () => {
    // Approx 7km away
    const lat = kitchen.latitude + 0.05;
    const lon = kitchen.longitude + 0.04;
    const result = calculateDelivery(lat, lon);

    expect(result.eligible).toBe(true);
    expect(result.distanceKm).toBeGreaterThan(5);
    expect(result.deliveryChargeRupees).toBeGreaterThan(0);
    expect(result.deliveryChargePaisa).toBe(result.deliveryChargeRupees * 100);
  });

  it('handles boundary conditions: 0km, 5km (free), 5.1km (charged), 35km (eligible), 35.1km (rejected)', () => {
    // 0km
    const r0 = calculateDelivery(undefined, undefined, 0);
    expect(r0.eligible).toBe(true);
    expect(r0.distanceKm).toBe(0);
    expect(r0.deliveryChargePaisa).toBe(0);
    expect(r0.deliveryChargeRupees).toBe(0);

    // 5km (free boundary)
    const r5 = calculateDelivery(undefined, undefined, 5.0);
    expect(r5.eligible).toBe(true);
    expect(r5.distanceKm).toBe(5.0);
    expect(r5.deliveryChargePaisa).toBe(0);
    expect(r5.deliveryChargeRupees).toBe(0);

    // 5.1km (extra 0.1km @ 900 paise = 90 paise = ~₹1)
    const r51 = calculateDelivery(undefined, undefined, 5.1);
    expect(r51.eligible).toBe(true);
    expect(r51.distanceKm).toBe(5.1);
    expect(r51.deliveryChargePaisa).toBe(90);

    // 35km (maximum deliverable radius boundary)
    const r35 = calculateDelivery(undefined, undefined, 35.0);
    expect(r35.eligible).toBe(true);
    expect(r35.distanceKm).toBe(35.0);
    // (35 - 5) * 900 = 27000 paise = ₹270
    expect(r35.deliveryChargeRupees).toBe(270);

    // 35.1km (exceeds 35km cutoff)
    const r351 = calculateDelivery(undefined, undefined, 35.1);
    expect(r351.eligible).toBe(false);
    expect(r351.distanceKm).toBe(35.1);
    expect(r351.reason).toContain('exceeds our maximum delivery range of 35 km');
  });

  it('rejects delivery beyond maximum delivery radius (> 35km)', () => {
    // 50km away
    const farLat = kitchen.latitude + 0.5;
    const farLon = kitchen.longitude + 0.5;
    const result = calculateDelivery(farLat, farLon);

    expect(result.eligible).toBe(false);
    expect(result.distanceKm).toBeGreaterThan(35);
    expect(result.reason).toBeDefined();
    expect(result.reasonTe).toBeDefined();
  });

  it('rejects invalid coordinate inputs', () => {
    const invalidResult = calculateDelivery(999, -999);
    expect(invalidResult.eligible).toBe(false);
  });
});
