import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/base-test';
import { initializeAPIHelper } from '../helpers/test-workflows.helper';
import type { APIHelper } from '../helpers/api.helper';

/**
 * End-to-End Test: in-shop receipt (/receipt)
 *
 * Orders are created through the API like a Buy now before payment (unpaid, no email). A real payment needs
 * Stripe, so the "paid" views make the order lookup answer as the server would after the payment is confirmed.
 */
async function createInShopOrder(apiHelper: APIHelper) {
  const book = await apiHelper.findInStockBook();
  const order = await apiHelper.createOrder({
    items: [{ id: book.id, title: book.title, author: book.author, price: book.price, quantity: 1 }],
    total: book.price,
    fulfillmentType: 'pickup',
    pickupLocation: 'In shop',
    source: 'in-shop',
  });
  return { book, order };
}

/** Open the receipt as it looks once the server has confirmed payment (paid time and email saved). */
async function openPaidReceipt(page: Page, orderId: string) {
  await page.route(`**/api/orders/${orderId}`, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const response = await route.fetch();
    const order = await response.json();
    await route.fulfill({ response, json: { ...order, paidAt: new Date().toISOString(), email: 'p***@example.com' } });
  });
  await page.goto(`/receipt?orderId=${orderId}&session_id=cs_test_paid_view`);
}

test.describe('In-shop receipt', () => {
  test('a paid receipt is focused: amount, time, short ref, no placeholders, shipping rows or navbar', async ({ page }) => {
    const { book, order } = await createInShopOrder(initializeAPIHelper(page));

    await openPaidReceipt(page, order.id);

    await expect(page.getByTestId('in-shop-receipt')).toBeVisible();
    await expect(page.getByTestId('order-success-message')).toContainText('Paid');
    await expect(page.getByTestId('receipt-paid-line')).toContainText(`$${book.price.toFixed(2)}`);
    await expect(page.getByTestId('receipt-short-ref')).toHaveText(`#${order.id.slice(-8).toUpperCase()}`);

    await expect(page.getByText('In-Person Sale')).toHaveCount(0);
    await expect(page.getByText('Pickup')).toHaveCount(0);
    await expect(page.locator('header')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Browse more books' })).toBeVisible();
  });

  test('an unpaid order never shows "Paid" while the payment is being confirmed', async ({ page }) => {
    const { order } = await createInShopOrder(initializeAPIHelper(page));

    await page.goto(`/receipt?orderId=${order.id}&session_id=cs_test_not_paid_yet`);

    await expect(page.getByTestId('receipt-status')).toHaveAttribute('data-status', 'confirming');
    await expect(page.getByText('Confirming your payment')).toBeVisible();
    await expect(page.getByText('Paid ✓')).toHaveCount(0);
    // Post-payment actions are not offered before payment is confirmed
    await expect(page.getByTestId('receipt-email-hint')).toHaveCount(0);
    await expect(page.getByTestId('receipt-wish')).toHaveCount(0);
  });

  test('an unpaid order opened without a Stripe session is shown as processing, not paid', async ({ page }) => {
    const { order } = await createInShopOrder(initializeAPIHelper(page));

    await page.goto(`/receipt?orderId=${order.id}`);

    await expect(page.getByTestId('receipt-status')).toHaveAttribute('data-status', 'processing');
    await expect(page.getByText('Payment processing')).toBeVisible();
    await expect(page.getByText('Please wait for the green')).toBeVisible();
    await expect(page.getByText('Paid ✓')).toHaveCount(0);
  });

  test('"processing" turns into the paid receipt by itself once the payment is confirmed', async ({ page }) => {
    const { order } = await createInShopOrder(initializeAPIHelper(page));

    let confirmed = false;
    await page.route(`**/api/orders/${order.id}`, async (route) => {
      if (route.request().method() !== 'GET' || !confirmed) return route.fallback();
      const response = await route.fetch();
      await route.fulfill({ response, json: { ...(await response.json()), paidAt: new Date().toISOString(), email: 'p***@example.com' } });
    });
    await page.goto(`/receipt?orderId=${order.id}`);
    await expect(page.getByTestId('receipt-status')).toHaveAttribute('data-status', 'processing');

    confirmed = true; // the webhook / Stripe confirmation arrives
    await expect(page.getByTestId('order-success-message')).toContainText('Paid', { timeout: 15_000 });
  });

  test('the paid receipt shows a live clock and says the receipt was emailed; the resend API refuses unpaid orders', async ({ page }) => {
    const { order } = await createInShopOrder(initializeAPIHelper(page));

    await openPaidReceipt(page, order.id);
    await expect(page.getByTestId('receipt-live-clock')).not.toBeEmpty();
    await expect(page.getByTestId('receipt-email-hint')).toContainText('emailed');

    // The server still checks the real order: unpaid, no email on file
    const response = await page.request.post(`/api/orders/${order.id}/send-receipt`);
    expect(response.status()).toBe(409);
  });

  test('opening the receipt of an unpaid order never takes stock', async ({ page }) => {
    const apiHelper = initializeAPIHelper(page);
    const { book, order } = await createInShopOrder(apiHelper);
    const stockBefore = (await apiHelper.getBook(book.id)).stock;

    // What the receipt page's backup call does; the server must refuse because nothing was paid
    const response = await page.request.post(`/api/orders/${order.id}/update-stock`);
    expect(response.status()).toBe(409);

    expect((await apiHelper.getBook(book.id)).stock).toBe(stockBefore);
  });

  test('customers can leave a book request on the receipt', async ({ page }) => {
    const { order } = await createInShopOrder(initializeAPIHelper(page));

    await openPaidReceipt(page, order.id);
    await expect(page.getByTestId('receipt-wish-send')).toBeDisabled();
    await page.getByTestId('receipt-wish-input').fill('E2E test request: more Seerah books for teens');
    await page.getByTestId('receipt-wish-send').click();

    await expect(page.getByTestId('receipt-wish')).toContainText('Thank you');
  });

  test('suggests other books to buy', async ({ page }) => {
    const { order } = await createInShopOrder(initializeAPIHelper(page));

    await openPaidReceipt(page, order.id);

    await expect(page.getByTestId('scan-suggestions')).toBeVisible();
    await expect(page.getByText('You might also like')).toBeVisible();
  });
});
