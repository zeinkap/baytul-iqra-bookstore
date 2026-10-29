import { describe, it, expect } from 'vitest';
import { computeInsights, type InsightOrder } from '@/lib/insights';

describe('Hand-recorded sales: reports', () => {
  it('cash and other hand-recorded sales carry no estimated card fee', () => {
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
