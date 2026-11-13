import { test, expect } from '@playwright/test';
import { Fixtures, disconnect, localDbAvailable } from '../helpers/money-path.helper';

/**
 * Shipping: a flat $5, free from $60 of books (counted before any promo code), always free for pickup.
 * Orders are priced on the server, so these go through POST /api/orders with the test's own books.
 */
test.describe('Shipping', () => {
  test.skip(!localDbAvailable, 'needs a local database (the tests create and delete their own rows)');
  const fx = new Fixtures();
  test.afterAll(async () => {
    await fx.cleanup();
    await disconnect();
  });

  async function orderTotal(request: import('@playwright/test').APIRequestContext, data: Record<string, unknown>) {
    const res = await request.post('/api/orders', { data: { fulfillmentType: 'shipping', shippingAddress: { line1: '1 Test St', country: 'US' }, ...data } });
    expect(res.status()).toBe(201);
    const { id } = await res.json();
    fx.trackOrder(id);
    return (await (await request.get(`/api/orders/${id}`)).json()).finalTotal as number;
  }

  test('TC-262: a shipping order to a non-US address is rejected, a US one is accepted', async ({ request }) => {
    const book = await fx.book({ price: 20, stock: 10 });
    for (const country of ['CA', undefined]) {
      const res = await request.post('/api/orders', {
        data: { items: [{ id: book.id, quantity: 1 }], fulfillmentType: 'shipping', shippingAddress: { line1: '1 Test St', country } },
      });
      expect(res.status()).toBe(400);
      expect((await res.json()).error).toContain('only ship within the USA');
    }
  });

  test('TC-263: pickup orders are unaffected by the US-only rule', async ({ request }) => {
    const book = await fx.book({ price: 20, stock: 10 });
    const res = await request.post('/api/orders', { data: { items: [{ id: book.id, quantity: 1 }], fulfillmentType: 'pickup' } });
    expect(res.status()).toBe(201);
    fx.trackOrder((await res.json()).id);
  });

  test('an order under $60 pays the flat $5', async ({ request }) => {
    const book = await fx.book({ price: 29.99, stock: 10 });
    expect(await orderTotal(request, { items: [{ id: book.id, quantity: 2 }] })).toBeCloseTo(59.98 + 5, 2);
  });

  test('an order of exactly $60 ships free', async ({ request }) => {
    const book = await fx.book({ price: 30, stock: 10 });
    expect(await orderTotal(request, { items: [{ id: book.id, quantity: 2 }] })).toBeCloseTo(60, 2);
  });

  test('a promo code does not take an order back under the free-shipping line', async ({ request }) => {
    const book = await fx.book({ price: 40, stock: 10 });
    const promo = await fx.promo({ discountType: 'percentage', discountValue: 25 });
    // 80 of books, 20 off, and still free shipping
    expect(await orderTotal(request, { items: [{ id: book.id, quantity: 2 }], promoCodeId: promo.id })).toBeCloseTo(60, 2);
  });

  test('pickup is always free', async ({ request }) => {
    const book = await fx.book({ price: 10, stock: 10 });
    expect(await orderTotal(request, { items: [{ id: book.id, quantity: 1 }], fulfillmentType: 'pickup' })).toBeCloseTo(10, 2);
  });
});

test.describe('Book page', () => {
  test.skip(!localDbAvailable, 'needs a local database (the tests create and delete their own rows)');
  const fx = new Fixtures();
  test.afterAll(async () => {
    await fx.cleanup();
    await disconnect();
  });

  test('shows the shipping promise and not the date the book was added', async ({ page }) => {
    const book = await fx.book({ price: 20, stock: 3 });
    await page.goto(`/books/${book.id}`);
    await expect(page.getByTestId('book-shipping-note')).toHaveText('Orders are dispatched within 1-2 days. Free standard shipping on orders over $60 (USA only)');
    await expect(page.getByText('Availability')).toBeVisible();
    await expect(page.getByText('Added', { exact: true })).toHaveCount(0);
  });
});
