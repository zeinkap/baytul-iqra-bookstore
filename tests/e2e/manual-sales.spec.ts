import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { ADMIN_COOKIE, createSessionToken } from '../../src/lib/adminAuth';
import { Fixtures, db, disconnect, localDbAvailable } from '../helpers/money-path.helper';

test.describe('Hand-recorded sales: admin API and page', () => {
  test.skip(!localDbAvailable || !process.env.ADMIN_PASSWORD, 'needs a local database and ADMIN_PASSWORD');
  const fx = new Fixtures();
  test.afterAll(async () => {
    await fx.cleanup();
    await disconnect();
  });
  const headers = async () => ({ cookie: `${ADMIN_COOKIE}=${await createSessionToken()}` });
  const record = async (request: import('@playwright/test').APIRequestContext, data: unknown) =>
    request.post('/api/admin/manual-sales', { headers: await headers(), data });
  const stockOf = async (id: string) => (await db.book.findUniqueOrThrow({ where: { id } })).stock;

  test('needs an admin session', async ({ request }) => {
    expect((await request.post('/api/admin/manual-sales', { data: {} })).status()).toBe(401);
    expect((await request.get('/api/admin/manual-sales')).status()).toBe(401);
    expect((await request.post('/api/admin/manual-sales/x/void')).status()).toBe(401);
  });

  test('rejects a bad payment method, an empty cart and a bad venue', async ({ request }) => {
    const book = await fx.book({ stock: 3 });
    const items = [{ id: book.id, quantity: 1 }];
    expect((await record(request, { items, method: 'bitcoin' })).status()).toBe(400);
    expect((await record(request, { items: [], method: 'cash' })).status()).toBe(400);
    expect((await record(request, { items, method: 'cash', venue: 'Not A Venue!' })).status()).toBe(400);
    expect(await stockOf(book.id)).toBe(3);
  });

  test('a sold-out book cannot be recorded', async ({ request }) => {
    const book = await fx.book({ stock: 1 });
    const res = await record(request, { items: [{ id: book.id, quantity: 2 }], method: 'cash' });
    expect(res.status()).toBe(409);
    expect(await stockOf(book.id)).toBe(1);
  });

  test('a cash sale is a paid in-shop order at the in-person price, at the venue, and takes stock', async ({ request }) => {
    const venue = `e2e-cash-${randomUUID().slice(0, 8)}`;
    const book = await fx.book({ price: 15, inShopPrice: 12, stock: 5 });
    // The browser's own price is ignored: only ids and quantities count
    const res = await record(request, { items: [{ id: book.id, quantity: 2, price: 0.01 }], method: 'cash', venue });
    expect(res.status()).toBe(201);
    const { id, total } = await res.json();
    fx.trackOrder(id);
    expect(total).toBeCloseTo(24, 2);

    const order = await db.order.findUniqueOrThrow({ where: { id } });
    expect(order).toMatchObject({ source: 'in-shop', paymentMethod: 'cash', paymentMethodDetail: 'Cash', location: venue, email: null, refundedAt: null });
    expect(order.paidAt).not.toBeNull();
    expect(order.finalTotal).toBeCloseTo(24, 2);
    expect(await stockOf(book.id)).toBe(3);

    const recent = await (await request.get('/api/admin/manual-sales', { headers: await headers() })).json();
    expect(recent.sales.some((s: { id: string }) => s.id === id)).toBe(true);

    // And it shows up in the venue's insights with no card fee
    const insights = await (await request.get(`/api/admin/insights?days=30&source=in-shop&loc=${venue}`, { headers: await headers() })).json();
    expect(insights.profit.revenue).toBe(24);
    expect(insights.profit.estimatedStripeFees).toBe(0);
    expect(insights.payments.methods[0]).toMatchObject({ method: 'cash', orders: 1 });
  });

  test('a sale entered by mistake can be undone once, putting the books back', async ({ request }) => {
    const book = await fx.book({ price: 20, stock: 4 });
    const { id } = await (await record(request, { items: [{ id: book.id, quantity: 3 }], method: 'zelle' })).json();
    fx.trackOrder(id);
    expect(await stockOf(book.id)).toBe(1);

    const undo = await request.post(`/api/admin/manual-sales/${id}/void`, { headers: await headers() });
    expect(undo.status()).toBe(200);
    expect((await undo.json()).restocked).toBe(3);
    expect(await stockOf(book.id)).toBe(4);
    const order = await db.order.findUniqueOrThrow({ where: { id } });
    expect(order.refundedAmount).toBeCloseTo(60, 2);
    expect(order.restockedAt).not.toBeNull();

    expect((await request.post(`/api/admin/manual-sales/${id}/void`, { headers: await headers() })).status()).toBe(409);
    expect(await stockOf(book.id)).toBe(4);
  });

  test('only hand-recorded sales can be undone here', async ({ request }) => {
    const book = await fx.book({ stock: 2 });
    const stripeOrder = await fx.order(book, { paid: true });
    const res = await request.post(`/api/admin/manual-sales/${stripeOrder.id}/void`, { headers: await headers() });
    expect(res.status()).toBe(409);
    expect((await request.post('/api/admin/manual-sales/does-not-exist/void', { headers: await headers() })).status()).toBe(404);
  });

  test('the Record Sale page records a cash sale and lists it', async ({ page, context, baseURL }) => {
    const venue = `e2e-ui-${randomUUID().slice(0, 8)}`;
    const book = await fx.book({ price: 15, inShopPrice: 12, stock: 4 });
    await db.book.update({ where: { id: book.id }, data: { title: `E2E CASH BOOK ${venue}` } });
    await context.addCookies([{ name: ADMIN_COOKIE, value: (await createSessionToken())!, url: baseURL! }]);

    await page.goto('/admin/record-sale');
    await page.getByTestId('sale-venue').fill(venue);
    await page.getByTestId('sale-search').fill(venue);
    await page.getByTestId('sale-matches').getByRole('button').first().click();
    await page.getByRole('button', { name: /More E2E CASH BOOK/ }).click();
    await expect(page.getByTestId('sale-qty')).toHaveText('2');
    await page.getByTestId('sale-method-cash').click();
    await expect(page.getByTestId('sale-record')).toContainText('$24.00 cash');
    await page.getByTestId('sale-record').click();

    await expect(page.getByTestId('sale-recent')).toContainText('$24.00 · cash · 2× E2E CASH BOOK');
    const order = await db.order.findFirstOrThrow({ where: { location: venue } });
    fx.trackOrder(order.id);
    expect(await stockOf(book.id)).toBe(2);
  });
});
