import { test, expect } from '../fixtures/base-test';
import { initializeAPIHelper } from '../helpers/test-workflows.helper';

/**
 * End-to-End Test: in-shop basket (/basket) and the scan page's pay options
 *
 * Paying needs Stripe, so these cover everything up to the pay buttons: adding books from the scan page,
 * the basket page, and the server endpoints behind it.
 */
test.describe('In-shop basket', () => {
  test('a scanned book can be added to the basket and shows up on the basket page', async ({ page }) => {
    const book = await initializeAPIHelper(page).findInStockBook();

    await page.goto(`/b/${book.id}`);
    await page.getByTestId('scan-add-to-basket').click();

    await expect(page).toHaveURL(/\/basket$/);
    await expect(page.getByTestId('basket-line')).toHaveCount(1);
    await expect(page.getByTestId('basket-line')).toContainText(book.title);
    await expect(page.getByTestId('basket-total')).toHaveText(`$${book.price.toFixed(2)}`);
    await expect(page.getByTestId('in-shop-pay')).toBeVisible();
    await expect(page.locator('header')).toHaveCount(0);
  });

  test('quantity and remove work, and an empty basket says so', async ({ page }) => {
    const book = await initializeAPIHelper(page).findInStockBook();

    await page.goto(`/b/${book.id}`);
    await page.getByTestId('scan-add-to-basket').click();
    await expect(page.getByTestId('basket-line')).toHaveCount(1);

    if (book.stock >= 2) {
      await page.getByTestId('basket-qty-plus').click();
      await expect(page.getByTestId('basket-qty-value')).toHaveText('2');
      await expect(page.getByTestId('basket-total')).toHaveText(`$${(book.price * 2).toFixed(2)}`);
    }

    await page.getByTestId('basket-remove').click();
    await expect(page.getByTestId('basket-empty')).toBeVisible();
    await expect(page.getByTestId('basket-line')).toHaveCount(0);
  });

  test('with books in the basket, scanning adds to it instead of paying for one book alone', async ({ page }) => {
    const book = await initializeAPIHelper(page).findInStockBook();

    await page.goto(`/b/${book.id}`);
    await expect(page.getByTestId('scan-buy-now')).toBeVisible(); // empty basket: pay right here
    await page.getByTestId('scan-add-to-basket').click();
    await expect(page).toHaveURL(/\/basket$/);

    await page.goto(`/b/${book.id}`);
    await expect(page.getByTestId('scan-in-basket')).toBeVisible();
    await expect(page.getByTestId('scan-view-basket')).toBeVisible();
    await expect(page.getByTestId('scan-buy-now')).toHaveCount(0);
  });

  test('the basket survives a reload', async ({ page }) => {
    const book = await initializeAPIHelper(page).findInStockBook();

    await page.goto(`/b/${book.id}`);
    await page.getByTestId('scan-add-to-basket').click();
    await expect(page.getByTestId('basket-line')).toHaveCount(1);

    await page.reload();
    await expect(page.getByTestId('basket-line')).toHaveCount(1);
    await expect(page.getByTestId('basket-line')).toContainText(book.title);
  });

  test('quote returns fresh prices and drops books that no longer exist', async ({ page }) => {
    const book = await initializeAPIHelper(page).findInStockBook();

    const response = await page.request.post('/api/in-shop/quote', {
      data: { items: [{ id: book.id, quantity: 1 }, { id: 'no-such-book', quantity: 1 }] },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.lines).toHaveLength(1);
    expect(body.lines[0]).toMatchObject({ id: book.id, title: book.title, price: book.price, quantity: 1 });
    expect(body.removed).toEqual(['no-such-book']);

    expect((await page.request.post('/api/in-shop/quote', { data: { items: [] } })).status()).toBe(400);
  });

  test('wallet payment endpoints refuse bad requests without calling Stripe', async ({ page }) => {
    expect((await page.request.post('/api/in-shop/payment-intent', { data: { items: [] } })).status()).toBe(400);
    expect(
      (await page.request.post('/api/in-shop/payment-intent', { data: { items: [{ id: 'no-such-book', quantity: 1 }] } })).status()
    ).toBe(409);
    expect((await page.request.post('/api/in-shop/confirm-payment', { data: {} })).status()).toBe(400);
    expect((await page.request.post('/api/in-shop/confirm-payment', { data: { paymentIntentId: 'not-a-payment-intent' } })).status()).toBe(400);
  });
});
