import { test, expect } from '@playwright/test';
import { Fixtures, db, disconnect, localDbAvailable, stripeTestMode, stripe, sessionIdFromUrl } from '../helpers/money-path.helper';

/**
 * Promo codes at the stall: the scan page and the in-shop basket take one code, the server works out the discount
 * (at in-person prices) and the order, the Stripe session and the wallet payment all use that same amount.
 * Uses its own test books and codes; Stripe objects are created in test mode and never paid.
 */
test.describe('In-shop promo codes', () => {
  test.skip(!localDbAvailable, 'needs a local database (the tests create and delete their own rows)');
  const fx = new Fixtures();
  test.afterAll(async () => {
    await fx.cleanup();
    await disconnect();
  });

  const check = (request: import('@playwright/test').APIRequestContext, data: unknown) => request.post('/api/in-shop/promo', { data });

  test.describe('checking a code', () => {
    test('a percentage code is worked out from the in-person price, in cents', async ({ request }) => {
      const book = await fx.book({ price: 15, inShopPrice: 12, stock: 5 });
      const promo = await fx.promo({ discountType: 'percentage', discountValue: 10 });
      const res = await check(request, { items: [{ id: book.id, quantity: 2 }], code: promo.code });
      expect(res.status()).toBe(200);
      expect(await res.json()).toEqual({ code: promo.code, subtotalCents: 2400, discountCents: 240, finalCents: 2160 });
    });

    test('a fixed code is stored in cents, and the typed code ignores case and spaces', async ({ request }) => {
      const book = await fx.book({ price: 20, stock: 5 });
      const promo = await fx.promo({ discountType: 'fixed', discountValue: 300 });
      const res = await check(request, { items: [{ id: book.id, quantity: 1 }], code: `  ${promo.code.toLowerCase()} ` });
      expect(res.status()).toBe(200);
      expect(await res.json()).toMatchObject({ discountCents: 300, finalCents: 1700 });
    });

    test('unknown, expired and below-minimum codes are refused with a reason', async ({ request }) => {
      const book = await fx.book({ price: 20, stock: 5 });
      const items = [{ id: book.id, quantity: 1 }];

      const unknown = await check(request, { items, code: 'NO-SUCH-CODE' });
      expect(unknown.status()).toBe(400);
      expect((await unknown.json()).error).toContain("isn't valid");

      const expired = await fx.promo({ discountType: 'percentage', discountValue: 10, validUntil: new Date(Date.now() - 86_400_000) });
      const expiredRes = await check(request, { items, code: expired.code });
      expect(expiredRes.status()).toBe(400);
      expect((await expiredRes.json()).error).toContain('expired');

      const minimum = await fx.promo({ discountType: 'percentage', discountValue: 10, minimumOrderAmount: 50 });
      const minimumRes = await check(request, { items, code: minimum.code });
      expect(minimumRes.status()).toBe(400);
      expect((await minimumRes.json()).error).toContain('Minimum order');
    });

    test('a code that would leave less than Stripe can charge is refused', async ({ request }) => {
      const book = await fx.book({ price: 20, stock: 5 });
      const promo = await fx.promo({ discountType: 'percentage', discountValue: 100 });
      const res = await check(request, { items: [{ id: book.id, quantity: 1 }], code: promo.code });
      expect(res.status()).toBe(400);
      expect((await res.json()).error).toContain('below');
    });

    test('an empty cart or an empty code is refused', async ({ request }) => {
      const book = await fx.book({ stock: 5 });
      expect((await check(request, { items: [], code: 'X' })).status()).toBe(400);
      expect((await check(request, { items: [{ id: book.id, quantity: 1 }], code: '  ' })).status()).toBe(400);
    });
  });

  test.describe('with Stripe test mode', () => {
    test.skip(!stripeTestMode, 'needs STRIPE_SECRET_KEY to be a test-mode key');

    test('Buy with a code: the order, the discount and the Stripe session all agree', async ({ request }) => {
      const book = await fx.book({ price: 15, inShopPrice: 12, stock: 5 });
      const promo = await fx.promo({ discountType: 'percentage', discountValue: 10 });
      const res = await request.post('/api/in-shop/buy', { data: { items: [{ id: book.id, quantity: 2 }], promoCode: promo.code, location: 'e2e-promo' } });
      expect(res.status()).toBe(200);
      const { url, orderId } = await res.json();
      fx.trackOrder(orderId);

      const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(order.total).toBeCloseTo(24, 2);
      expect(order.discountAmount).toBeCloseTo(2.4, 2);
      expect(order.finalTotal).toBeCloseTo(21.6, 2);
      expect(order.promoCodeId).toBe(promo.id);
      expect(order.paidAt).toBeNull();

      const session = await stripe.checkout.sessions.retrieve(sessionIdFromUrl(url));
      expect(session.amount_subtotal).toBe(2400);
      expect(session.amount_total).toBe(2160);
      expect(session.metadata).toMatchObject({ orderId, promoCodeId: promo.id, discountAmount: '240' });
      // Nothing is used up until the order is paid
      expect((await db.promoCode.findUniqueOrThrow({ where: { id: promo.id } })).currentUses).toBe(0);
    });

    test('Buy with a bad code is refused and creates no order', async ({ request }) => {
      const book = await fx.book({ price: 20, stock: 5 });
      const res = await request.post('/api/in-shop/buy', { data: { items: [{ id: book.id, quantity: 1 }], promoCode: 'NO-SUCH-CODE', location: 'e2e-promo-bad' } });
      expect(res.status()).toBe(400);
      expect(await db.order.count({ where: { location: 'e2e-promo-bad' } })).toBe(0);
    });

    test('with and without a code are different orders, and the same code reuses its order', async ({ request }) => {
      const book = await fx.book({ price: 20, stock: 5 });
      const promo = await fx.promo({ discountType: 'fixed', discountValue: 200 });
      const items = [{ id: book.id, quantity: 1 }];
      const full = await (await request.post('/api/in-shop/buy', { data: { items, location: 'e2e-promo-reuse' } })).json();
      const first = await (await request.post('/api/in-shop/buy', { data: { items, promoCode: promo.code, location: 'e2e-promo-reuse' } })).json();
      const second = await (await request.post('/api/in-shop/buy', { data: { items, promoCode: promo.code, location: 'e2e-promo-reuse' } })).json();
      [full, first].forEach((o) => fx.trackOrder(o.orderId));
      expect(first.orderId).not.toBe(full.orderId);
      expect(second.orderId).toBe(first.orderId);
      expect((await db.order.findUniqueOrThrow({ where: { id: full.orderId } })).finalTotal).toBeCloseTo(20, 2);
      expect((await db.order.findUniqueOrThrow({ where: { id: first.orderId } })).finalTotal).toBeCloseTo(18, 2);
    });

    test('Apple Pay / Google Pay: the PaymentIntent is for the discounted amount', async ({ request }) => {
      const book = await fx.book({ price: 20, stock: 5 });
      const promo = await fx.promo({ discountType: 'percentage', discountValue: 25 });
      const res = await request.post('/api/in-shop/payment-intent', { data: { items: [{ id: book.id, quantity: 1 }], promoCode: promo.code } });
      expect(res.status()).toBe(200);
      const { paymentIntentId, orderId } = await res.json();
      fx.trackOrder(orderId);

      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      expect(intent.amount).toBe(1500);
      expect(intent.metadata).toMatchObject({ orderId, promoCodeId: promo.id, discountAmount: '500' });
      const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(order.finalTotal).toBeCloseTo(15, 2);
      expect(order.promoCodeId).toBe(promo.id);
    });

    test('Apple Pay / Google Pay with a bad code is refused before any payment starts', async ({ request }) => {
      const book = await fx.book({ price: 20, stock: 5 });
      const res = await request.post('/api/in-shop/payment-intent', { data: { items: [{ id: book.id, quantity: 1 }], promoCode: 'NO-SUCH-CODE' } });
      expect(res.status()).toBe(400);
    });
  });

  test.describe('on the scan page and the basket', () => {
    test('one code can be applied to a scanned book, shows in the pay button, and can be removed', async ({ page }) => {
      const book = await fx.book({ price: 20, stock: 5 });
      const promo = await fx.promo({ discountType: 'percentage', discountValue: 10 });
      await page.goto(`/b/${book.id}`);
      await expect(page.getByTestId('scan-buy-now')).toContainText('$20.00');

      await page.getByTestId('promo-open').click();
      await page.getByTestId('promo-input').fill('NO-SUCH-CODE');
      await page.getByTestId('promo-apply').click();
      await expect(page.getByTestId('promo-error')).toBeVisible();

      await page.getByTestId('promo-input').fill(promo.code);
      await page.getByTestId('promo-apply').click();
      await expect(page.getByTestId('promo-applied')).toContainText(promo.code);
      await expect(page.getByTestId('promo-applied')).toContainText('$2.00');
      await expect(page.getByTestId('scan-buy-now')).toContainText('$18.00');
      // Only one code at a time: the field is gone until the first one is removed
      await expect(page.getByTestId('promo-form')).toHaveCount(0);

      await page.getByTestId('promo-remove').click();
      await expect(page.getByTestId('scan-buy-now')).toContainText('$20.00');
      // The field is back, so a different code can be tried
      await expect(page.getByTestId('promo-input')).toBeVisible();
    });

    test('the discount follows the quantity, and the code carries over to the basket', async ({ page }) => {
      const book = await fx.book({ price: 20, stock: 5 });
      const promo = await fx.promo({ discountType: 'percentage', discountValue: 10 });
      await page.goto(`/b/${book.id}`);
      await page.getByTestId('promo-open').click();
      await page.getByTestId('promo-input').fill(promo.code);
      await page.getByTestId('promo-apply').click();
      await expect(page.getByTestId('scan-buy-now')).toContainText('$18.00');

      await page.getByTestId('scan-qty-plus').click();
      await expect(page.getByTestId('scan-buy-now')).toContainText('$36.00');

      await page.getByTestId('scan-add-to-basket').click();
      await expect(page).toHaveURL(/\/basket$/);
      await expect(page.getByTestId('basket-discount')).toContainText('$4.00');
      await expect(page.getByTestId('basket-total')).toHaveText('$36.00');
      await expect(page.getByTestId('basket-subtotal')).toContainText('$40.00');
    });

    test('the basket takes a code too', async ({ page }) => {
      const book = await fx.book({ price: 20, stock: 5 });
      const promo = await fx.promo({ discountType: 'fixed', discountValue: 500 });
      await page.goto(`/b/${book.id}`);
      await page.getByTestId('scan-add-to-basket').click();
      await expect(page.getByTestId('basket-total')).toHaveText('$20.00');

      await page.getByTestId('promo-open').click();
      await page.getByTestId('promo-input').fill(promo.code);
      await page.getByTestId('promo-apply').click();
      await expect(page.getByTestId('basket-total')).toHaveText('$15.00');
      await expect(page.getByTestId('scan-buy-now')).toContainText('$15.00');
    });
  });
});
