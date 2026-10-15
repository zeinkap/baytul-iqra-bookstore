import { test, expect } from '../fixtures/base-test';
import { initializeAPIHelper } from '../helpers/test-workflows.helper';

/**
 * End-to-End Test: QR direct-to-cart (/b/<code>)
 *
 * Uses the book id as the code (the fallback for books without an ISBN),
 * so it doesn't depend on ISBN data existing in the test database.
 */
test.describe('QR scan to cart', () => {
  test('scanning a book code adds it to the cart and lands on /cart', async ({ page, cartPage }) => {
    const book = await initializeAPIHelper(page).findInStockBook();

    await page.goto(`/b/${book.id}`);
    await page.waitForURL('**/cart');

    expect(await cartPage.getCartBookTitles()).toContain(book.title);
  });

  test('re-scanning the same book does not add a second copy', async ({ page, cartPage }) => {
    const book = await initializeAPIHelper(page).findInStockBook();

    await page.goto(`/b/${book.id}`);
    await page.waitForURL('**/cart');
    await page.goto(`/b/${book.id}`);
    await page.waitForURL('**/cart');

    expect(await cartPage.getCartItemCount()).toBe(1);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cart') ?? '[]')[0].quantity)).toBe(1);
  });

  test('scanned cart asks only for email (no shipping/pickup choice)', async ({ page, cartPage }) => {
    const book = await initializeAPIHelper(page).findInStockBook();

    await page.goto(`/b/${book.id}`);
    await page.waitForURL('**/cart');

    await expect(cartPage.emailInput).toBeVisible();
    await expect(cartPage.fulfillmentTypeShipping).toHaveCount(0);
    await expect(cartPage.fulfillmentTypePickup).toHaveCount(0);
  });

  test('unknown code shows a friendly message', async ({ page }) => {
    await page.goto('/b/0000000000000');
    await expect(page.getByText("We couldn't find that book")).toBeVisible();
  });
});
