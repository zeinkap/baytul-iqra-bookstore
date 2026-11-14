import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { ADMIN_COOKIE, createSessionToken } from '../../src/lib/adminAuth';
import { CURRENT_VENUE_KEY } from '../../src/lib/venue';
import { Fixtures, db, disconnect, localDbAvailable } from '../helpers/money-path.helper';

/**
 * Removing a venue from Admin → QR Scans (DELETE /api/admin/venue). Every test makes its own venue name, so
 * nothing here touches the real venues. The sales themselves are never deleted, only the venue name on them.
 */
test.describe('Remove venue: admin', () => {
  test.skip(!localDbAvailable || !process.env.ADMIN_PASSWORD, 'needs a local database and ADMIN_PASSWORD');
  const fx = new Fixtures();
  const venues: string[] = [];
  const newVenue = () => {
    const v = `e2e-rm-${randomUUID().slice(0, 8)}`;
    venues.push(v);
    return v;
  };
  const feeKey = (venue: string) => `venue_fee:${venue}`;
  const headers = async () => ({ cookie: `${ADMIN_COOKIE}=${await createSessionToken()}` });

  /** A venue with `scans` scan records and, optionally, one paid order and a flat fee. */
  async function seedVenue(opts: { scans: number; order?: boolean; fee?: number }) {
    const venue = newVenue();
    await db.scan.createMany({ data: Array.from({ length: opts.scans }, () => ({ code: `e2e-${venue}`, status: 'ok', location: venue })) });
    const book = opts.order ? await fx.book({ price: 20 }) : null;
    const order = book ? await fx.order(book, { paid: true, location: venue }) : null;
    if (opts.fee) await db.appSetting.create({ data: { key: feeKey(venue), value: String(opts.fee) } });
    return { venue, order };
  }

  test.afterAll(async () => {
    await db.scan.deleteMany({ where: { location: { in: venues } } });
    await db.appSetting.deleteMany({ where: { key: { in: venues.map(feeKey) } } });
    await fx.cleanup();
    await disconnect();
  });

  test('TC-264: removing a venue needs an admin session and a valid venue and choices', async ({ request }) => {
    const { venue } = await seedVenue({ scans: 1 });
    expect((await request.delete('/api/admin/venue', { data: { venue } })).status()).toBe(401);

    for (const data of [{ venue: 'Not A Slug!' }, {}, { venue, scans: 'everything' }, { venue, orders: 'delete' }]) {
      expect((await request.delete('/api/admin/venue', { headers: await headers(), data })).status()).toBe(400);
    }
    // Nothing was changed by the refused requests
    expect(await db.scan.count({ where: { location: venue } })).toBe(1);
  });

  test('TC-265: removing a venue untags its scans and sales, drops its fee, and keeps the sales', async ({ request }) => {
    const { venue, order } = await seedVenue({ scans: 2, order: true, fee: 50 });

    const res = await request.delete('/api/admin/venue', { headers: await headers(), data: { venue, scans: 'untag', orders: 'untag' } });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ venue, scans: { untagged: 2 }, orders: { untagged: 1 }, clearedCurrent: false });

    expect(await db.scan.count({ where: { location: venue } })).toBe(0);
    expect(await db.scan.count({ where: { code: `e2e-${venue}`, location: null } })).toBe(2);
    const kept = await db.order.findUnique({ where: { id: order!.id } });
    expect(kept?.location).toBeNull();
    expect(kept?.paidAt).not.toBeNull(); // the sale is still there and still paid
    expect(await db.appSetting.findUnique({ where: { key: feeKey(venue) } })).toBeNull();

    const list = await (await request.get('/api/admin/venue', { headers: await headers() })).json();
    expect(list.known).not.toContain(venue);
  });

  test('TC-266: deleting a venue\'s scans while keeping its sales leaves the venue (and its fee) on those sales', async ({ request }) => {
    const { venue, order } = await seedVenue({ scans: 2, order: true, fee: 50 });

    const res = await request.delete('/api/admin/venue', { headers: await headers(), data: { venue, scans: 'delete', orders: 'keep' } });
    expect(await res.json()).toMatchObject({ scans: { deleted: 2 }, orders: { untagged: 0 } });

    expect(await db.scan.count({ where: { code: `e2e-${venue}` } })).toBe(0);
    expect((await db.order.findUnique({ where: { id: order!.id } }))?.location).toBe(venue);
    expect((await db.appSetting.findUnique({ where: { key: feeKey(venue) } }))?.value).toBe('50');

    const list = await (await request.get('/api/admin/venue', { headers: await headers() })).json();
    expect(list.venues.find((v: { venue: string }) => v.venue === venue)).toMatchObject({ scans: 0, orders: 1, paidOrders: 1 });
  });

  test('TC-267: removing the venue the books are at today also clears that setting', async ({ request }) => {
    const { venue } = await seedVenue({ scans: 1 });
    const before = await db.appSetting.findUnique({ where: { key: CURRENT_VENUE_KEY } });
    try {
      await db.appSetting.upsert({ where: { key: CURRENT_VENUE_KEY }, create: { key: CURRENT_VENUE_KEY, value: venue }, update: { value: venue } });

      const res = await request.delete('/api/admin/venue', { headers: await headers(), data: { venue } });
      expect((await res.json()).clearedCurrent).toBe(true);
      expect(await db.appSetting.findUnique({ where: { key: CURRENT_VENUE_KEY } })).toBeNull();
    } finally {
      // Put back whatever the real setting was
      if (before) await db.appSetting.upsert({ where: { key: CURRENT_VENUE_KEY }, create: before, update: { value: before.value } });
      else await db.appSetting.deleteMany({ where: { key: CURRENT_VENUE_KEY } });
    }
  });

  test('TC-268: removing a different venue leaves the current-venue setting alone', async ({ request }) => {
    const { venue } = await seedVenue({ scans: 1 });
    const res = await request.delete('/api/admin/venue', { headers: await headers(), data: { venue } });
    expect((await res.json()).clearedCurrent).toBe(false);
  });

  test('TC-269: the QR Scans page lists venues with their history, and Remove venue asks what to do with it first', async ({ page, context, baseURL }) => {
    const { venue, order } = await seedVenue({ scans: 2, order: true });
    await context.addCookies([{ name: ADMIN_COOKIE, value: (await createSessionToken())!, url: baseURL! }]);

    await page.goto('/admin/scans');
    const row = page.getByTestId(`venue-row-${venue}`);
    await expect(row).toContainText('2 scans · 1 paid sale');

    // Cancelling changes nothing
    await page.getByTestId(`venue-remove-${venue}`).click();
    await expect(page.getByRole('heading', { name: `Remove venue "${venue}"?` })).toBeVisible();
    await expect(page.getByTestId('remove-venue-options')).toContainText('Its 2 scans');
    await expect(page.getByTestId('remove-venue-options')).toContainText('Its 1 order (1 paid)');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: `Remove venue "${venue}"?` })).toHaveCount(0);
    expect(await db.scan.count({ where: { location: venue } })).toBe(2);

    // Delete the scans but keep the sales under the venue: the venue stays listed, now with no scans
    await page.getByTestId(`venue-remove-${venue}`).click();
    await page.getByTestId('remove-scans-delete').check();
    await page.getByTestId('remove-orders-keep').check();
    await page.getByRole('button', { name: 'Remove venue', exact: true }).click();
    await expect(row).toContainText('0 scans · 1 paid sale');
    expect(await db.scan.count({ where: { code: `e2e-${venue}` } })).toBe(0);
    expect((await db.order.findUnique({ where: { id: order!.id } }))?.location).toBe(venue);

    // With the defaults the venue name comes off its sales too, and the venue disappears
    await page.getByTestId(`venue-remove-${venue}`).click();
    await expect(page.getByTestId('remove-scans-untag')).toHaveCount(0); // no scans left, so no scan choice
    await page.getByRole('button', { name: 'Remove venue', exact: true }).click();
    await expect(row).toHaveCount(0);
    expect((await db.order.findUnique({ where: { id: order!.id } }))?.location).toBeNull();
  });
});
