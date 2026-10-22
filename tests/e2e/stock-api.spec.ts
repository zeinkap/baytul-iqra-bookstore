import { test, expect } from '@playwright/test';
import { Fixtures, db, disconnect, localDbAvailable, stripeTestMode, webhookSecret, signedEvent, sessionIdFromUrl } from '../helpers/money-path.helper';

/**
 * API tests: when stock changes.
 *  - Checking out never takes stock; it only blocks buying more than is left.
 *  - A paid Stripe event takes stock exactly once, even if Stripe delivers it again.
 *
 * Not covered on purpose: the "stock went negative" oversell alert. It emails the shop, which tests must not do.
 */
test.describe('Stock: order creation', () => {
  test.skip(!localDbAvailable, 'needs a local database (the tests create and delete their own rows)');
  const fx = new Fixtures();
  test.afterAll(async () => {
    await fx.cleanup();
    await disconnect();
  });

  const createOrder = (request: import('@playwright/test').APIRequestContext, bookId: string, quantity: number) =>
    request.post('/api/orders', { data: { items: [{ id: bookId, quantity }], fulfillmentType: 'pickup' } });

  test('buying more copies than are in stock is refused and creates no order', async ({ request }) => {
    const book = await fx.book({ stock: 2 });
    const res = await createOrder(request, book.id, 3);
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('Only 2 left');
    expect(body.stockProblems).toEqual([expect.objectContaining({ id: book.id, requested: 3, available: 2 })]);
  });

  test('a sold-out book cannot be ordered', async ({ request }) => {
    const book = await fx.book({ stock: 0 });
    const res = await createOrder(request, book.id, 1);
    expect(res.status()).toBe(409);
    expect((await res.json()).error).toContain('just sold out');
  });

  test('ordering exactly the remaining stock works, and creating the order does not take stock yet', async ({ request }) => {
    const book = await fx.book({ stock: 2 });
    const res = await createOrder(request, book.id, 2);
    expect(res.status()).toBe(201);
    fx.trackOrder((await res.json()).id);
    expect((await db.book.findUniqueOrThrow({ where: { id: book.id } })).stock).toBe(2);
  });

  test('the same book on two lines counts together against stock', async ({ request }) => {
    const book = await fx.book({ stock: 3 });
    const res = await request.post('/api/orders', {
      data: { items: [{ id: book.id, quantity: 2 }, { id: book.id, quantity: 2 }], fulfillmentType: 'pickup' },
    });
    expect(res.status()).toBe(409);
  });

  test('invalid quantities are rejected', async ({ request }) => {
    const book = await fx.book({ stock: 5 });
    for (const quantity of [0, -1, 1.5, 100]) {
      expect((await createOrder(request, book.id, quantity)).status(), `quantity ${quantity}`).toBe(400);
    }
  });
});

test.describe('Stock: paid Stripe event', () => {
  test.skip(!localDbAvailable || !stripeTestMode || !webhookSecret, 'needs a local database, a Stripe test key and STRIPE_WEBHOOK_SECRET');
  const fx = new Fixtures();
  test.afterAll(async () => {
    await fx.cleanup();
    await disconnect();
  });

  /** A real (never paid) Stripe test session for a fresh book + order, already marked paid so no sale alert is sent. */
  async function paidEventFor(request: import('@playwright/test').APIRequestContext, opts: { stockTaken?: boolean } = {}) {
    const book = await fx.book({ stock: 5, price: 15 });
    // The webhook reads the session's line items from Stripe, so the session has to be real
    const buy = await request.post('/api/in-shop/buy', { data: { items: [{ id: book.id, quantity: 1 }], location: `e2e-stock-${book.id}` } });
    const { url, orderId } = await buy.json();
    fx.trackOrder(orderId);
    // Mark it paid first (as the receipt page's fallback does), so the webhook doesn't send the shop's sale alert
    await db.order.update({ where: { id: orderId }, data: { paidAt: new Date(), stockUpdatedAt: opts.stockTaken ? new Date() : null } });

    const { payload, header } = signedEvent('checkout.session.completed', {
      id: sessionIdFromUrl(url),
      object: 'checkout.session',
      payment_status: 'paid',
      metadata: { orderId, fulfillmentType: 'pickup', source: 'in-shop' },
    });
    const send = () =>
      request.post('/api/stripe/webhook', { data: payload, headers: { 'content-type': 'application/json', 'stripe-signature': header } });
    const stock = async () => (await db.book.findUniqueOrThrow({ where: { id: book.id } })).stock;
    return { orderId, send, stock };
  }

  test('a paid event takes stock by the ordered quantity once, and a repeat delivery does not take it again', async ({ request }) => {
    const { orderId, send, stock } = await paidEventFor(request);

    expect((await send()).status()).toBe(200);
    expect(await stock()).toBe(4);
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).stockUpdatedAt).not.toBeNull();

    // Stripe retries deliveries: the same event again must not take stock a second time
    expect((await send()).status()).toBe(200);
    expect(await stock()).toBe(4);
  });

  test('two deliveries of the same event at the same moment take stock once', async ({ request }) => {
    const { send, stock } = await paidEventFor(request);
    const [a, b] = await Promise.all([send(), send()]);
    expect([a.status(), b.status()]).toEqual([200, 200]);
    expect(await stock()).toBe(4);
  });

  test('stock already taken by another server instance (recorded in the database) is not taken again', async ({ request }) => {
    // The in-memory shortcut can't know about other instances, so this must be decided by Order.stockUpdatedAt
    const { send, stock } = await paidEventFor(request, { stockTaken: true });
    expect((await send()).status()).toBe(200);
    expect(await stock()).toBe(5);
  });
});
