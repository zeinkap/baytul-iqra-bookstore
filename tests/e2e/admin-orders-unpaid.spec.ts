import { test, expect } from '../fixtures/base-test';
import { ADMIN_COOKIE, createSessionToken } from '../../src/lib/adminAuth';
import { Fixtures, db, disconnect, localDbAvailable } from '../helpers/money-path.helper';

/** Orders are created before the customer pays, so the admin list has to say which ones were never paid. */
test.describe('Admin orders: unpaid orders', () => {
  test.skip(!localDbAvailable || !process.env.ADMIN_PASSWORD, 'needs a local database and ADMIN_PASSWORD');
  const fx = new Fixtures();
  test.afterAll(async () => {
    await fx.cleanup();
    await disconnect();
  });

  test('TC-253: an order that was never paid is marked Unpaid and explains the missing name and email; a paid one is not', async ({ page, context, baseURL }) => {
    const book = await fx.book({ price: 20 });
    const unpaid = await fx.order(book, { paid: false });
    const paid = await fx.order(book, { paid: true });
    await db.order.updateMany({ where: { id: { in: [unpaid.id, paid.id] } }, data: { email: null } });
    await context.addCookies([{ name: ADMIN_COOKIE, value: (await createSessionToken())!, url: baseURL! }]);

    await page.goto('/admin/orders');
    // Abandoned (never paid) orders are hidden until "Show unpaid" is ticked
    await page.getByPlaceholder(/Search by email/).fill(unpaid.id);
    await expect(page.getByText('No orders found')).toBeVisible();
    await page.getByTestId('show-unpaid-toggle').check();
    const unpaidRow = page.locator('tr', { hasText: 'View Details' }).first();
    await expect(unpaidRow.getByTestId('unpaid-badge')).toBeVisible();
    await unpaidRow.getByText('View Details').click();
    await expect(page.getByText('Not paid (the customer never finished paying')).toBeVisible();
    await page.getByRole('button', { name: /close/i }).first().click().catch(() => page.keyboard.press('Escape'));

    await page.getByTestId('show-unpaid-toggle').uncheck();
    await page.getByPlaceholder(/Search by email/).fill(paid.id);
    const paidRow = page.locator('tr', { hasText: 'View Details' }).first();
    await expect(paidRow).toBeVisible();
    await expect(paidRow.getByTestId('unpaid-badge')).toHaveCount(0);
  });
});
