import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/base-test';
import { initializeAPIHelper } from '../helpers/test-workflows.helper';

/**
 * End-to-End Test: QR direct-to-cart (/b/<code>)
 *
 * Uses the book id as the code (the fallback for books without an ISBN),
 * so it doesn't depend on ISBN data existing in the test database.
 * A scan shows the book first; "Add to cart" then opens the email-only cart.
 * ("Buy now" goes to Stripe, so it's only checked for presence here.)
 */
async function scanAndAddToCart(page: Page, code: string) {
  await page.goto(`/b/${code}`);
  await page.getByTestId('scan-add-to-cart').click();
  await page.waitForURL('**/cart');
}

test.describe('QR scan to cart', () => {
  test('scan shows the book with Buy now and Add to cart options', async ({ page }) => {
    const book = await initializeAPIHelper(page).findInStockBook();

    await page.goto(`/b/${book.id}`);

    await expect(page.getByTestId('scan-book-title')).toHaveText(book.title);
    await expect(page.getByTestId('scan-buy-now')).toBeVisible();
    await expect(page.getByTestId('scan-add-to-cart')).toBeVisible();
    await expect(page.getByTestId('scan-trust-note')).toContainText('Stripe');
    await expect(page.getByTestId('scan-description')).toBeVisible();
  });

  test('scanning a book code adds it to the cart and lands on /cart', async ({ page, cartPage }) => {
    const book = await initializeAPIHelper(page).findInStockBook();

    await scanAndAddToCart(page, book.id);

    expect(await cartPage.getCartBookTitles()).toContain(book.title);
  });

  test('re-scanning the same book does not add a second copy', async ({ page, cartPage }) => {
    const book = await initializeAPIHelper(page).findInStockBook();

    await scanAndAddToCart(page, book.id);
    await scanAndAddToCart(page, book.id);

    expect(await cartPage.getCartItemCount()).toBe(1);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cart') ?? '[]')[0].quantity)).toBe(1);
  });

  test('scan page is focused: tax note shown, no navbar or chat button', async ({ page }) => {
    const book = await initializeAPIHelper(page).findInStockBook();

    await page.goto(`/b/${book.id}`);

    await expect(page.getByTestId('scan-tax-note')).toHaveText('Tax included');
    await expect(page.locator('header')).toHaveCount(0);
    await expect(page.getByRole('img', { name: 'Baytul Iqra Bookstore' })).toBeVisible();
    await expect(page.getByText('Ask us')).toHaveCount(0);
  });

  test('scanned cart asks only for email (no shipping/pickup choice)', async ({ page, cartPage }) => {
    const book = await initializeAPIHelper(page).findInStockBook();

    await scanAndAddToCart(page, book.id);

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
