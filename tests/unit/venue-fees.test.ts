import { describe, it, expect } from 'vitest';
import { computeInsights, type InsightOrder } from '@/lib/insights';

const book = { id: 'b1', title: 'Book', stock: 5, costPrice: 8, createdAt: new Date('2026-01-01') };
const order = (location: string | null, quantity = 1): InsightOrder => ({
  items: [{ id: 'b1', title: 'Book', price: 15, quantity }],
  finalTotal: 15 * quantity,
  paidAt: new Date(),
  email: null,
  paymentMethod: 'card',
  device: null,
  source: 'in-shop',
  location,
});
const insights = (orders: InsightOrder[], options: { venue?: string; venueFees?: Record<string, number> } = {}) =>
  computeInsights(orders, [book], [], { days: 30, source: 'in-shop', ...options });

describe('Event fees: calculation', () => {
  it('profit per venue is shown after the flat fee, with books still needed to break even', () => {
    // One order of 3 books at $15, cost $8: revenue 45, cost 24, est. Stripe fee 45 * 2.9% + 0.30 = 1.605 -> profit 19.395
    const r = insights([order('bazaar-oct', 3)], { venueFees: { 'bazaar-oct': 50 } }).events;
    expect(r.rows).toHaveLength(1);
    const row = r.rows[0];
    expect(row).toMatchObject({ venue: 'bazaar-oct', orders: 1, books: 3, revenue: 45, fee: 50, covered: false });
    expect(row.profitBeforeFee).toBeCloseTo(19.4, 1);
    expect(row.net).toBeCloseTo(-30.6, 1);
    expect(row.stillToCover).toBeCloseTo(30.6, 1);
    expect(row.breakEvenBooks).toBe(8); // 50 / (about 6.47 profit per book) -> 8
    expect(r.totalFees).toBe(50);
  });

  it('once profit passes the fee the venue is covered', () => {
    const row = insights([order('bazaar-oct', 12)], { venueFees: { 'bazaar-oct': 50 } }).events.rows[0];
    expect(row.covered).toBe(true);
    expect(row.stillToCover).toBeNull();
    expect(row.net).toBeGreaterThan(0);
  });

  it('venues without a fee and untagged sales are not charged', () => {
    const r = insights([order('cafe-a', 2), order(null, 2)], { venueFees: { 'bazaar-oct': 50 } }).events;
    expect(r.rows.map((x) => x.venue)).toEqual(['cafe-a']);
    expect(r.rows[0]).toMatchObject({ fee: null, covered: null, breakEvenBooks: null });
    expect(r.totalFees).toBe(0);
  });

  it('profit after event fees subtracts the fees of venues with sales', () => {
    const orders = [order('bazaar-oct', 12), order('cafe-a', 2)];
    const result = insights(orders, { venueFees: { 'bazaar-oct': 50 } });
    expect(result.events.profitAfterEventFees).toBeCloseTo(result.profit.profitAfterFees - 50, 2);
  });

  it('a picked venue with a fee but no sales shows the whole fee as a loss; unpicked ones stay hidden', () => {
    const picked = insights([order('cafe-a')], { venue: 'bazaar-oct', venueFees: { 'bazaar-oct': 50 } }).events;
    expect(picked.rows).toMatchObject([{ venue: 'bazaar-oct', orders: 0, fee: 50, net: -50, stillToCover: 50, breakEvenBooks: null }]);
    const all = insights([order('cafe-a')], { venueFees: { 'bazaar-oct': 50 } }).events;
    expect(all.rows.map((x) => x.venue)).toEqual(['cafe-a']);
  });
});
