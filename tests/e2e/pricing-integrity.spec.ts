import { test, expect } from '../fixtures/base-test';
import { generateTestEmail } from '../fixtures/test-data';
import { initializeAPIHelper } from '../helpers/test-workflows.helper';

/**
 * End-to-End Test: server-side pricing
 *
 * The browser only supplies book ids and quantities; prices and totals must come
 * from the database, so a tampered request can't underpay.
 */
test.describe('Pricing integrity', () => {
  test('order total ignores client-supplied prices and total', async ({ page }) => {
    const apiHelper = initializeAPIHelper(page);
    const book = await apiHelper.findInStockBook();

    const order = await apiHelper.createOrder({
      items: [{ id: book.id, title: 'Tampered', author: 'x', price: 0.01, quantity: 1 }],
      total: 0.01,
      fulfillmentType: 'pickup',
      email: generateTestEmail(),
    });

    const saved = await apiHelper.getOrder(order.id);
    expect(saved.total).toBeCloseTo(book.price, 2);
    expect(saved.finalTotal).toBeCloseTo(book.price, 2);
    expect(saved.items[0].price).toBeCloseTo(book.price, 2);
    expect(saved.items[0].title).toBe(book.title);
  });

  test('order with an unknown book id is rejected', async ({ page }) => {
    const response = await page.request.post('/api/orders', {
      data: {
        items: [{ id: 'does-not-exist', title: 'Nope', price: 1, quantity: 1 }],
        fulfillmentType: 'pickup',
      },
    });
    expect(response.status()).toBe(409);
  });
});
