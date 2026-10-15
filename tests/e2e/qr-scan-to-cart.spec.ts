import { test, expect } from '../fixtures/base-test';
import { initializeAPIHelper, setupCartViaLocalStorage } from '../helpers/test-workflows.helper';

/**
 * End-to-End Test: QR direct-to-cart (/b/<code>)
 *
 * Uses the book id as the code (the fallback for books without an ISBN),
 * so it doesn't depend on ISBN data existing in the test database.
 * A scan shows the book with a single "Buy now" action (it goes to Stripe, so it's only
 * checked for presence here); the email-only cart mode is covered by seeding its state.
 */
test.describe('QR scan to cart', () => {
  test('scan shows the book with a single Buy now action', async ({ page }) => {
    const book = await initializeAPIHelper(page).findInStockBook();

    await page.goto(`/b/${book.id}`);

    await expect(page.getByTestId('scan-book-title')).toHaveText(book.title);
    await expect(page.getByTestId('scan-buy-now')).toBeVisible();
    await expect(page.getByTestId('scan-add-to-cart')).toHaveCount(0);
    await expect(page.getByTestId('scan-trust-note')).toContainText('Stripe');
    await expect(page.getByTestId('scan-description')).toBeVisible();
  });

  test('scan page is focused: tax note shown, no navbar or chat button', async ({ page }) => {
    const book = await initializeAPIHelper(page).findInStockBook();

    await page.goto(`/b/${book.id}`);

    await expect(page.getByTestId('scan-tax-note')).toHaveText('Tax included');
    await expect(page.locator('header')).toHaveCount(0);
    await expect(page.getByRole('img', { name: 'Baytul Iqra Bookstore' })).toBeVisible();
    await expect(page.getByText('Ask us')).toHaveCount(0);
  });

  test('in-shop cart mode asks only for email (no shipping/pickup choice)', async ({ page, cartPage }) => {
    const book = await initializeAPIHelper(page).findInStockBook();

    await setupCartViaLocalStorage(page, cartPage, [book]);
    await page.evaluate(() => sessionStorage.setItem('checkoutMode', 'in-shop'));
    await page.reload();

    await expect(cartPage.emailInput).toBeVisible();
    await expect(cartPage.fulfillmentTypeShipping).toHaveCount(0);
    await expect(cartPage.fulfillmentTypePickup).toHaveCount(0);
  });

  test('unknown code shows a friendly message with book suggestions', async ({ page }) => {
    await page.goto('/b/0000000000000');
    await expect(page.getByTestId('scan-message-title')).toHaveText("We couldn't find that book");
    await expect(page.getByTestId('scan-suggestions')).toBeVisible();
  });

  test('tapping the cover opens the larger photo viewer', async ({ page }) => {
    const book = await initializeAPIHelper(page).findInStockBook();

    await page.goto(`/b/${book.id}`);
    await page.getByTestId('scan-cover').click();

    await expect(page.locator('.yarl__container')).toBeVisible();
  });

  test('scans are recorded', async ({ page }) => {
    const book = await initializeAPIHelper(page).findInStockBook();

    const scanRequest = page.waitForRequest((r) => r.url().includes('/api/scans') && r.method() === 'POST');
    await page.goto(`/b/${book.id}`);
    expect((await scanRequest).postDataJSON()).toEqual({ code: book.id });
  });
});
