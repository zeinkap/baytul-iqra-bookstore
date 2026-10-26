import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { ADMIN_COOKIE, createSessionToken } from '../../src/lib/adminAuth';
import { buildDailySummary } from '../../src/lib/dailySummary';
import { computeInsights, type InsightOrder } from '../../src/lib/insights';
import { Fixtures, db, disconnect, localDbAvailable } from '../helpers/money-path.helper';

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

test.describe('Event fees: calculation', () => {
  test('profit per venue is shown after the flat fee, with books still needed to break even', () => {
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

  test('once profit passes the fee the venue is covered', () => {
    const row = insights([order('bazaar-oct', 12)], { venueFees: { 'bazaar-oct': 50 } }).events.rows[0];
    expect(row.covered).toBe(true);
    expect(row.stillToCover).toBeNull();
    expect(row.net).toBeGreaterThan(0);
  });

  test('venues without a fee and untagged sales are not charged', () => {
    const r = insights([order('cafe-a', 2), order(null, 2)], { venueFees: { 'bazaar-oct': 50 } }).events;
    expect(r.rows.map((x) => x.venue)).toEqual(['cafe-a']);
    expect(r.rows[0]).toMatchObject({ fee: null, covered: null, breakEvenBooks: null });
    expect(r.totalFees).toBe(0);
  });

  test('profit after event fees subtracts the fees of venues with sales', () => {
    const orders = [order('bazaar-oct', 12), order('cafe-a', 2)];
    const result = insights(orders, { venueFees: { 'bazaar-oct': 50 } });
    expect(result.events.profitAfterEventFees).toBeCloseTo(result.profit.profitAfterFees - 50, 2);
  });

  test('a picked venue with a fee but no sales shows the whole fee as a loss; unpicked ones stay hidden', () => {
    const picked = insights([order('cafe-a')], { venue: 'bazaar-oct', venueFees: { 'bazaar-oct': 50 } }).events;
    expect(picked.rows).toMatchObject([{ venue: 'bazaar-oct', orders: 0, fee: 50, net: -50, stillToCover: 50, breakEvenBooks: null }]);
    const all = insights([order('cafe-a')], { venueFees: { 'bazaar-oct': 50 } }).events;
    expect(all.rows.map((x) => x.venue)).toEqual(['cafe-a']);
  });
});

test.describe('Event fees: admin API', () => {
  test.skip(!localDbAvailable || !process.env.ADMIN_PASSWORD, 'needs a local database and ADMIN_PASSWORD');
  const fx = new Fixtures();
  // Every test gets its own venue name, so sales from one test never show up in another
  const venues: string[] = [];
  const newVenue = () => {
    const v = `e2e-fee-${randomUUID().slice(0, 8)}`;
    venues.push(v);
    return v;
  };
  test.afterAll(async () => {
    await db.appSetting.deleteMany({ where: { key: { in: venues.map((v) => `venue_fee:${v}`) } } });
    await fx.cleanup();
    await disconnect();
  });
  const headers = async () => ({ cookie: `${ADMIN_COOKIE}=${await createSessionToken()}` });

  test('needs an admin session', async ({ request }) => {
    const venue = newVenue();
    expect((await request.get('/api/admin/venue-fees')).status()).toBe(401);
    expect((await request.put('/api/admin/venue-fees', { data: { venue, fee: 50 } })).status()).toBe(401);
  });

  test('rejects a bad venue name or fee', async ({ request }) => {
    const venue = newVenue();
    for (const data of [{ venue: 'Not A Slug!', fee: 50 }, { venue, fee: -5 }, { venue, fee: 'lots' }, { venue, fee: 1e9 }]) {
      expect((await request.put('/api/admin/venue-fees', { headers: await headers(), data })).status()).toBe(400);
    }
  });

  test('a saved fee shows up in the insights for that venue, and clears again', async ({ request }) => {
    const venue = newVenue();
    const book = await fx.book({ price: 20 });
    await fx.order(book, { paid: true, location: venue });

    const saved = await request.put('/api/admin/venue-fees', { headers: await headers(), data: { venue, fee: 50 } });
    expect(saved.status()).toBe(200);
    expect((await saved.json()).fees[venue]).toBe(50);

    const res = await request.get(`/api/admin/insights?days=30&source=in-shop&loc=${venue}`, { headers: await headers() });
    expect(res.status()).toBe(200);
    const { events } = await res.json();
    expect(events.rows).toHaveLength(1);
    expect(events.rows[0]).toMatchObject({ venue, orders: 1, books: 1, revenue: 20, fee: 50, covered: false });
    expect(events.rows[0].net).toBeCloseTo(20 - (20 * 0.029 + 0.3) - 50, 2);
    expect(events.rows[0].breakEvenBooks).toBe(3);

    const cleared = await request.put('/api/admin/venue-fees', { headers: await headers(), data: { venue, fee: null } });
    expect((await cleared.json()).fees[venue]).toBeUndefined();
  });

  test('the Insights page sets a fee and shows the venue after the fee', async ({ page, context, baseURL }) => {
    const venue = newVenue();
    const book = await fx.book({ price: 20 });
    await fx.order(book, { paid: true, location: venue });
    await context.addCookies([{ name: ADMIN_COOKIE, value: (await createSessionToken())!, url: baseURL! }]);

    await page.goto('/admin/insights');
    await expect(page.getByTestId('events-table')).toContainText(venue);
    await expect(page.getByTestId('events-table')).toContainText('no fee');

    await page.getByTestId('fee-venue').selectOption(venue);
    await page.getByTestId('fee-amount').fill('50');
    await page.getByTestId('fee-save').click();

    const row = page.getByTestId('events-table').locator('tr', { hasText: venue });
    await expect(row).toContainText('$50.00');
    await expect(row).toContainText('to go');
    await expect(row).toContainText('3 (sold 1)');
  });

  test('the daily summary email shows the fee and what is still to cover', async () => {
    const venue = newVenue();
    const book = await fx.book({ price: 20 });
    await fx.order(book, { paid: true, location: venue });
    await db.appSetting.upsert({ where: { key: `venue_fee:${venue}` }, create: { key: `venue_fee:${venue}`, value: '50' }, update: { value: '50' } });

    const summary = await buildDailySummary();
    expect(summary.text).toContain(`Event fee, ${venue}: $50.00 fee`);
    expect(summary.text).toContain('still to cover');
    expect(summary.html).toContain('Event fees');
  });
});

