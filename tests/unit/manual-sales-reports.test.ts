import { describe, it, expect } from 'vitest';
import { computeInsights, type InsightOrder } from '@/lib/insights';
import { applyManualDiscount, isManualMethod } from '@/lib/manualSales';

describe('Hand-recorded sales: reports', () => {
  it('TC-169: cash and other hand-recorded sales carry no estimated card fee', () => {
    const order = (paymentMethod: string): InsightOrder => ({
      items: [{ id: 'b1', title: 'Book', price: 20, quantity: 1 }],
      finalTotal: 20,
      paidAt: new Date(),
      email: null,
      paymentMethod,
      device: null,
      source: 'in-shop',
      location: 'bazaar-oct',
    });
    const book = { id: 'b1', title: 'Book', stock: 5, costPrice: 8, createdAt: new Date('2026-01-01') };
    const run = (m: string) => computeInsights([order(m)], [book], [], { days: 30, source: 'in-shop' }).profit;

    expect(run('cash').estimatedStripeFees).toBe(0);
    expect(run('cash').profitAfterFees).toBe(12);
    expect(run('zelle').estimatedStripeFees).toBe(0);
    expect(run('card').estimatedStripeFees).toBeCloseTo(0.88, 2); // 20 * 2.9% + 0.30
  });
});

describe('Hand-recorded sales: discount and methods', () => {
  it('TC-264: a percentage discount comes off in whole cents, and a bad percent is refused', () => {
    expect(applyManualDiscount(40, undefined)).toEqual({ discountAmount: 0, finalTotal: 40 });
    expect(applyManualDiscount(40, 10)).toEqual({ discountAmount: 4, finalTotal: 36 });
    expect(applyManualDiscount(26.9, 5)).toEqual({ discountAmount: 1.35, finalTotal: 25.55 }); // 134.5 cents rounds to 135
    expect(applyManualDiscount(40, '10')?.finalTotal).toBe(36);
    for (const bad of [-1, 51, NaN, 'abc', Infinity]) expect(applyManualDiscount(40, bad)).toBeNull();
  });

  it('TC-265: Venmo and Cash App are manual methods (no card fee), but Stripe\'s own cashapp type is not', () => {
    expect(isManualMethod('venmo')).toBe(true);
    expect(isManualMethod('cash_app')).toBe(true);
    expect(isManualMethod('cashapp')).toBe(false);
  });
});
