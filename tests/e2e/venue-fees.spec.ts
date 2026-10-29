import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { ADMIN_COOKIE, createSessionToken } from '../../src/lib/adminAuth';
import { buildDailySummary } from '../../src/lib/dailySummary';
import { Fixtures, db, disconnect, localDbAvailable } from '../helpers/money-path.helper';

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

