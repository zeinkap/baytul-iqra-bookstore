import { test, expect } from '@playwright/test';
import { DEFAULT_RULES, isWholeDollar, priceFloor, suggestPrices, today, type PriceRules } from '../../scripts/priceUtils';

/** The pricing rules behind scripts/suggestPrices.ts (pure functions: no server, database or network). */
test.describe('Price research rules', () => {
  const noTax: PriceRules = { ...DEFAULT_RULES, taxRate: 0 };

  test('the market price gets 8% sales tax by default, to match what a customer pays at a competitor', () => {
    const s = suggestPrices(10, {});
    expect(s.online).toBe(10.8);
    expect(s.inPerson).toBe(9); // 10.80 * 0.9 = 9.72 -> 9
  });

  test('in-person is the online price less the discount, rounded down to a whole dollar', () => {
    const s = suggestPrices(14.99, {}, noTax);
    expect(s.online).toBe(14.99);
    expect(s.inPerson).toBe(13); // 14.99 * 0.9 = 13.49 -> 13
    expect(isWholeDollar(s.inPerson)).toBe(true);
    expect(s.notes).toEqual([]);
  });

  test('online price is raised to keep the minimum margin after cost and shipping', () => {
    const s = suggestPrices(10, { costPrice: 9, shippingCost: 1 }, noTax); // floor = 10 / 0.85 = 11.7647 -> 11.77
    expect(s.online).toBeCloseTo(11.77, 2);
    expect(s.notes.join(' ')).toContain('online raised');
  });

  test('the margin is measured on the price before tax', () => {
    // cost 9 + shipping 1 = 10; pre-tax floor 11.7647; with 8% tax the tax-included floor is 12.7059 -> 12.71
    expect(priceFloor(9, 1, 'online', 0.15, 0.08)).toBeCloseTo(12.71, 2);
    const s = suggestPrices(10, { costPrice: 9, shippingCost: 1 }); // 10.80 is below the floor
    expect(s.online).toBeCloseTo(12.71, 2);
    expect(s.online / 1.08 - 10).toBeGreaterThanOrEqual(0.15 * (s.online / 1.08) - 0.005); // profit share holds before tax
  });

  test('in-person ignores shipping when checking its margin floor', () => {
    expect(priceFloor(8, 3, 'online', 0.15)).toBeCloseTo(12.95, 2);
    expect(priceFloor(8, 3, 'in-shop', 0.15)).toBeCloseTo(9.42, 2);
    const s = suggestPrices(12, { costPrice: 8, shippingCost: 3 }, noTax);
    expect(s.online).toBeCloseTo(12.95, 2);
    expect(s.inPerson).toBe(11); // 12.95 * 0.9 = 11.65 -> 11, above its floor of 9.42
  });

  test('in-person is lifted to its own floor, but never above the online price', () => {
    const s = suggestPrices(10, { costPrice: 9 }, { minMargin: 0.15, inPersonDiscount: 0.3, taxRate: 0 });
    expect(s.online).toBeCloseTo(10.59, 2); // 9 / 0.85
    expect(s.inPerson).toBe(10); // floor 10.59 -> lifted to 11, capped to floor(online) = 10
    expect(s.inPerson).toBeLessThanOrEqual(s.online);
  });

  test('no cost price means no margin check', () => {
    expect(priceFloor(null, 2, 'online', 0.15)).toBeNull();
    expect(suggestPrices(5, {}, noTax).online).toBe(5);
  });

  test('defaults and date format', () => {
    expect(DEFAULT_RULES).toEqual({ minMargin: 0.15, inPersonDiscount: 0.1, taxRate: 0.08 });
    expect(today(new Date(2026, 9, 5))).toBe('2026-10-05');
  });
});
