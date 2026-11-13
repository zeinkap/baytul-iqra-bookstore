import { describe, expect, it } from 'vitest';
import { FREE_SHIPPING_MIN_CENTS, SHIPPING_FLAT_CENTS, centsToFreeShipping, shippingCentsFor, isUsShippingCountry } from '@/lib/shipping';

describe('Shipping', () => {
  it('is a flat $5 under $60', () => {
    expect(shippingCentsFor(1, 'shipping')).toBe(SHIPPING_FLAT_CENTS);
    expect(shippingCentsFor(5999, 'shipping')).toBe(500);
  });

  it('is free from $60', () => {
    expect(FREE_SHIPPING_MIN_CENTS).toBe(6000);
    expect(shippingCentsFor(6000, 'shipping')).toBe(0);
    expect(shippingCentsFor(12345, 'shipping')).toBe(0);
  });

  it('is always free for pickup', () => {
    expect(shippingCentsFor(1000, 'pickup')).toBe(0);
  });

  it('says how much more is needed for free shipping', () => {
    expect(centsToFreeShipping(4550)).toBe(1450);
    expect(centsToFreeShipping(6000)).toBe(0);
    expect(centsToFreeShipping(9000)).toBe(0);
  });

  it('TC-261: only US shipping addresses are accepted', () => {
    expect(isUsShippingCountry('US')).toBe(true);
    expect(isUsShippingCountry(' us ')).toBe(true);
    expect(isUsShippingCountry('CA')).toBe(false);
    expect(isUsShippingCountry('')).toBe(false);
    expect(isUsShippingCountry(undefined)).toBe(false);
  });
});
