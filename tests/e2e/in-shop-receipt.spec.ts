import { test, expect } from '../fixtures/base-test';
import { initializeAPIHelper } from '../helpers/test-workflows.helper';

/**
 * End-to-End Test: in-shop receipt (/receipt)
 *
 * Creates an in-shop order via the API (no email, like a Buy now before the Stripe webhook runs)
 * and checks the focused receipt screen that QR buyers land on after paying.
 */
test.describe('In-shop receipt', () => {
  test('shows a focused receipt with no placeholders, shipping rows or navbar', async ({ page }) => {
    const apiHelper = initializeAPIHelper(page);
    const book = await apiHelper.findInStockBook();
    const order = await apiHelper.createOrder({
      items: [{ id: book.id, title: book.title, author: book.author, price: book.price, quantity: 1 }],
      total: book.price,
      fulfillmentType: 'pickup',
      pickupLocation: 'In shop',
      source: 'in-shop',
    });

    await page.goto(`/receipt?orderId=${order.id}`);

    await expect(page.getByTestId('in-shop-receipt')).toBeVisible();
    await expect(page.getByTestId('order-success-message')).toContainText('Paid');
    await expect(page.getByTestId('receipt-paid-line')).toContainText(`$${book.price.toFixed(2)}`);
    await expect(page.getByTestId('receipt-short-ref')).toHaveText(`#${order.id.slice(-8).toUpperCase()}`);

    // No leftover placeholders or shipping/pickup rows, and no site navbar
    await expect(page.getByText('In-Person Sale')).toHaveCount(0);
    await expect(page.getByText('Pickup')).toHaveCount(0);
    await expect(page.locator('header')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Browse more books' })).toBeVisible();
  });

  test('email receipt is unavailable until the order is paid and has an email', async ({ page }) => {
    const apiHelper = initializeAPIHelper(page);
    const book = await apiHelper.findInStockBook();
    const order = await apiHelper.createOrder({
      items: [{ id: book.id, title: book.title, author: book.author, price: book.price, quantity: 1 }],
      total: book.price,
      fulfillmentType: 'pickup',
      source: 'in-shop',
    });

    await page.goto(`/receipt?orderId=${order.id}`);
    await expect(page.getByTestId('receipt-email-button')).toBeDisabled();

    // The API refuses too (never sends for unpaid orders or to an address that isn't on the order)
    const response = await page.request.post(`/api/orders/${order.id}/send-receipt`);
    expect(response.status()).toBe(409);
  });

  test('customers can leave a book request on the receipt', async ({ page }) => {
    const apiHelper = initializeAPIHelper(page);
    const book = await apiHelper.findInStockBook();
    const order = await apiHelper.createOrder({
      items: [{ id: book.id, title: book.title, author: book.author, price: book.price, quantity: 1 }],
      total: book.price,
      fulfillmentType: 'pickup',
      source: 'in-shop',
    });

    await page.goto(`/receipt?orderId=${order.id}`);
    await expect(page.getByTestId('receipt-wish-send')).toBeDisabled();
    await page.getByTestId('receipt-wish-input').fill('E2E test request: more Seerah books for teens');
    await page.getByTestId('receipt-wish-send').click();

    await expect(page.getByTestId('receipt-wish')).toContainText('Thank you');
  });

  test('suggests other books to buy', async ({ page }) => {
    const apiHelper = initializeAPIHelper(page);
    const book = await apiHelper.findInStockBook();
    const order = await apiHelper.createOrder({
      items: [{ id: book.id, title: book.title, author: book.author, price: book.price, quantity: 1 }],
      total: book.price,
      fulfillmentType: 'pickup',
      source: 'in-shop',
    });

    await page.goto(`/receipt?orderId=${order.id}`);

    await expect(page.getByTestId('scan-suggestions')).toBeVisible();
    await expect(page.getByText('You might also like')).toBeVisible();
  });
});
