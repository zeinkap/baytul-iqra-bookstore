import { test, expect } from '@playwright/test';
import { DEFAULT_RULES, isWholeDollar, priceFloor, suggestPrices, today } from '../../scripts/priceUtils';

/** The pricing rules behind scripts/suggestPrices.ts (pure functions: no server, database or network). */
test.describe('Price research rules', () => {
  test('in-person is the online price less the discount, rounded down to a whole dollar', () => {
    const s = suggestPrices(14.99, {});
    expect(s.online).toBe(14.99);
    expect(s.inPerson).toBe(13); // 14.99 * 0.9 = 13.49 -> 13
    expect(isWholeDollar(s.inPerson)).toBe(true);
    expect(s.notes).toEqual([]);
  });

  test('online price is raised to keep the minimum margin after cost and shipping', () => {
    const s = suggestPrices(10, { costPrice: 9, shippingCost: 1 }); // floor = 10 / 0.85 = 11.7647 -> 11.77
    expect(s.online).toBeCloseTo(11.77, 2);
    expect(s.notes.join(' ')).toContain('online raised');
  });

  test('in-person ignores shipping when checking its margin floor', () => {
    expect(priceFloor(8, 3, 'online', 0.15)).toBeCloseTo(12.95, 2);
    expect(priceFloor(8, 3, 'in-shop', 0.15)).toBeCloseTo(9.42, 2);
    const s = suggestPrices(12, { costPrice: 8, shippingCost: 3 });
    expect(s.online).toBeCloseTo(12.95, 2);
    expect(s.inPerson).toBe(11); // 12.95 * 0.9 = 11.65 -> 11, above its floor of 9.42
  });

  test('in-person is lifted to its own floor, but never above the online price', () => {
    const s = suggestPrices(10, { costPrice: 9 }, { minMargin: 0.15, inPersonDiscount: 0.3 });
    expect(s.online).toBeCloseTo(10.59, 2); // 9 / 0.85
    expect(s.inPerson).toBe(11 - 1); // floor 10.59 -> lifted to 11, capped to floor(online) = 10
    expect(s.inPerson).toBeLessThanOrEqual(s.online);
  });

  test('no cost price means no margin check', () => {
    expect(priceFloor(null, 2, 'online', 0.15)).toBeNull();
    expect(suggestPrices(5, {}).online).toBe(5);
  });

  test('defaults and date format', () => {
    expect(DEFAULT_RULES).toEqual({ minMargin: 0.15, inPersonDiscount: 0.1 });
    expect(today(new Date(2026, 9, 5))).toBe('2026-10-05');
  });
});
