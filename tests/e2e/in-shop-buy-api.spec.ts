import { test, expect } from '@playwright/test';
import { Fixtures, db, disconnect, localDbAvailable, stripeTestMode, stripe, sessionIdFromUrl } from '../helpers/money-path.helper';

/**
 * API tests: POST /api/in-shop/buy (QR scan "Buy now": creates the unpaid order and the Stripe Checkout session).
 * Uses its own test books; sessions are created in Stripe test mode and never paid.
 */
test.describe('In-shop buy API', () => {
  test.skip(!localDbAvailable, 'needs a local database (the tests create and delete their own rows)');
  const fx = new Fixtures();
  test.afterAll(async () => {
    await fx.cleanup();
    await disconnect();
  });

  const buy = (request: import('@playwright/test').APIRequestContext, data: unknown) => request.post('/api/in-shop/buy', { data });

  test('rejects an empty or malformed cart', async ({ request }) => {
    expect((await buy(request, { items: [] })).status()).toBe(400);
    expect((await buy(request, {})).status()).toBe(400);
    expect((await buy(request, { items: [{ id: 'x', quantity: 0 }] })).status()).toBe(400);
    expect((await buy(request, { items: [{ id: 'x', quantity: 1.5 }] })).status()).toBe(400);
  });

  test('rejects a book that does not exist', async ({ request }) => {
    const res = await buy(request, { items: [{ id: 'does-not-exist', quantity: 1 }] });
    expect(res.status()).toBe(409);
  });

  test('a sold-out book is refused before any order or session is created', async ({ request }) => {
    const book = await fx.book({ stock: 0 });
    const res = await buy(request, { items: [{ id: book.id, quantity: 1 }] });
    expect(res.status()).toBe(409);
    expect((await res.json()).error).toContain('just sold out');
  });

  test('asking for more copies than are in stock is refused', async ({ request }) => {
    const book = await fx.book({ stock: 1 });
    const res = await buy(request, { items: [{ id: book.id, quantity: 2 }] });
    expect(res.status()).toBe(409);
    expect((await res.json()).error).toContain('Only 1 left');
  });

  test('the in-shop basket quote uses the in-person price, falling back to the online price', async ({ request }) => {
    const withPrice = await fx.book({ price: 15, inShopPrice: 12, stock: 3 });
    const without = await fx.book({ price: 9.5, stock: 3 });
    const res = await request.post('/api/in-shop/quote', {
      data: { items: [{ id: withPrice.id, quantity: 1 }, { id: without.id, quantity: 1 }] },
    });
    expect(res.status()).toBe(200);
    const { lines } = await res.json();
    const priceOf = (id: string) => lines.find((l: { id: string }) => l.id === id).price;
    expect(priceOf(withPrice.id)).toBe(12);
    expect(priceOf(without.id)).toBe(9.5);
  });

  test('online orders ignore the in-person price', async ({ request }) => {
    const book = await fx.book({ price: 15, inShopPrice: 12, stock: 3 });
    const res = await request.post('/api/orders', {
      data: { items: [{ id: book.id, quantity: 1 }], fulfillmentType: 'pickup', email: 'e2e@example.com' },
    });
    expect(res.status()).toBe(201);
    const { id } = await res.json();
    fx.trackOrder(id);
    const order = await db.order.findUniqueOrThrow({ where: { id } });
    expect(order.finalTotal).toBeCloseTo(15, 2);
  });

  test.describe('with Stripe test mode', () => {
    test.skip(!stripeTestMode, 'needs STRIPE_SECRET_KEY to be a test-mode key');

    test('an in-shop order is charged the in-person price', async ({ request }) => {
      const book = await fx.book({ price: 15, inShopPrice: 12, stock: 3 });
      const res = await buy(request, { items: [{ id: book.id, quantity: 2 }] });
      expect(res.status()).toBe(200);
      const { url, orderId } = await res.json();
      fx.trackOrder(orderId);
      const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(order.finalTotal).toBeCloseTo(24, 2);
      const session = await stripe.checkout.sessions.retrieve(sessionIdFromUrl(url), { expand: ['line_items'] });
      expect(session.amount_total).toBe(2400);
    });

    test('prices come from the database, the order is unpaid and in-shop, and the session matches it', async ({ request }) => {
      const book = await fx.book({ price: 12.34, stock: 3 });
      const res = await buy(request, {
        items: [{ id: book.id, title: 'Tampered', price: 0.01, quantity: 1 }],
        total: 0.01,
        location: 'e2e-venue',
      });
      expect(res.status()).toBe(200);
      const { url, orderId } = await res.json();
      fx.trackOrder(orderId);
      expect(url).toContain('checkout.stripe.com');

      const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(order.finalTotal).toBeCloseTo(12.34, 2);
      expect(order.paidAt).toBeNull();
      expect(order.source).toBe('in-shop');
      expect(order.fulfillmentType).toBe('pickup');
      expect(order.location).toBe('e2e-venue');
      expect((order.items as { title: string; price: number }[])[0]).toMatchObject({ title: book.title, price: 12.34 });

      const session = await stripe.checkout.sessions.retrieve(sessionIdFromUrl(url));
      expect(session.amount_total).toBe(1234);
      expect(session.metadata).toMatchObject({ orderId, source: 'in-shop', fulfillmentType: 'pickup', location: 'e2e-venue' });
      expect(session.payment_status).toBe('unpaid');
      // In-shop sessions expire in about half an hour
      const minutesLeft = (session.expires_at - Date.now() / 1000) / 60;
      expect(minutesLeft).toBeGreaterThan(25);
      expect(minutesLeft).toBeLessThan(32);
      // Buying never takes stock: that only happens once Stripe confirms payment
      expect((await db.book.findUniqueOrThrow({ where: { id: book.id } })).stock).toBe(3);
    });

    test('tapping Buy now again reuses the unpaid order instead of creating a second one', async ({ request }) => {
      const book = await fx.book();
      const data = { items: [{ id: book.id, quantity: 1 }], location: 'e2e-reuse' };
      const first = await (await buy(request, data)).json();
      const second = await (await buy(request, data)).json();
      fx.trackOrder(first.orderId);
      expect(second.orderId).toBe(first.orderId);
      expect(await db.order.count({ where: { id: first.orderId } })).toBe(1);
    });

    test('a different venue gets its own order', async ({ request }) => {
      const book = await fx.book();
      const a = await (await buy(request, { items: [{ id: book.id, quantity: 1 }], location: 'e2e-a' })).json();
      const b = await (await buy(request, { items: [{ id: book.id, quantity: 1 }], location: 'e2e-b' })).json();
      fx.trackOrder(a.orderId);
      fx.trackOrder(b.orderId);
      expect(b.orderId).not.toBe(a.orderId);
    });

    test('the cancel link only goes back to a scanned book page, never off-site', async ({ request }) => {
      const book = await fx.book();
      const ok = await (await buy(request, { items: [{ id: book.id, quantity: 1 }], location: 'e2e-cancel-1', cancelPath: '/b/abc123?loc=cafe' })).json();
      const bad = await (await buy(request, { items: [{ id: book.id, quantity: 1 }], location: 'e2e-cancel-2', cancelPath: 'https://evil.example.com/b/abc' })).json();
      fx.trackOrder(ok.orderId);
      fx.trackOrder(bad.orderId);

      const okSession = await stripe.checkout.sessions.retrieve(sessionIdFromUrl(ok.url));
      const badSession = await stripe.checkout.sessions.retrieve(sessionIdFromUrl(bad.url));
      expect(new URL(okSession.cancel_url!).pathname + new URL(okSession.cancel_url!).search).toBe('/b/abc123?loc=cafe');
      expect(new URL(badSession.cancel_url!).pathname).toBe('/cart');
      expect(new URL(badSession.cancel_url!).host).not.toContain('evil');
    });
  });
});
