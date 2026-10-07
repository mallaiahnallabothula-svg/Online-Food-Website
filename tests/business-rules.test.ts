import { describe, it, expect } from 'vitest';
import { calculateAuthoritativePricing } from '../server/payments/provider.ts';
import { CreatePaymentIntentSchema } from '../server/validation/schemas.ts';

const draft = {
  jowarQuantity: 5, chapathiQuantity: 0,
  karamSelection: { karivepaku: true, aviseGinjalu: false },
  customer: { name: 'Test customer', mobile: '9000000001', address: 'Test address', landmark: '', latitude: 17.485, longitude: 78.235 },
};
describe('Published menu and checkout agreement', () => {
  it('requires at least five of every selected food item and an explicit delivery location', () => {
    expect(CreatePaymentIntentSchema.safeParse(draft).success).toBe(true);
    expect(CreatePaymentIntentSchema.safeParse({ ...draft, jowarQuantity: 1 }).success).toBe(false);
    expect(CreatePaymentIntentSchema.safeParse({ ...draft, chapathiQuantity: 1 }).success).toBe(false);
    expect(CreatePaymentIntentSchema.safeParse({ ...draft, customer: { ...draft.customer, latitude: undefined } }).success).toBe(false);
    expect(() => calculateAuthoritativePricing({ ...draft, customer: { ...draft.customer, latitude: undefined } } as any)).toThrow(/delivery location/);
  });
  it('confirms the menu promise of twenty grams per full set of five', () => {
    expect(calculateAuthoritativePricing(draft).karamQuantities).toEqual({ karivepakuGrams: 20, aviseGinjaluGrams: 0 });
    expect(calculateAuthoritativePricing({ ...draft, jowarQuantity: 15, karamSelection: { karivepaku: true, aviseGinjalu: true } }).karamQuantities).toEqual({ karivepakuGrams: 60, aviseGinjaluGrams: 60 });
    expect(() => calculateAuthoritativePricing({ ...draft, karamSelection: { karivepaku: true, aviseGinjalu: true } })).toThrow(/Choose one/);
  });
});
