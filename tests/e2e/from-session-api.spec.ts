import { test, expect } from '@playwright/test';
import { Fixtures, db, disconnect, localDbAvailable, stripeTestMode, sessionIdFromUrl } from '../helpers/money-path.helper';

/**
 * API tests: POST /api/orders/from-session (the receipt page's fallback when the Stripe webhook is slow).
 *
 * Only the "refuses" cases can run here. A session can't be paid through the Stripe API (only on Stripe's hosted
 * page), and paying one would also make the app email the shop, so the happy path (paid session, calling it
 * twice, receipt email only for the call that saved the email) is not covered by an automated test.
 */
test.describe('from-session API: refusals', () => {
  test.skip(!localDbAvailable || !stripeTestMode, 'needs a local database and a Stripe test key');
  const fx = new Fixtures();
  test.afterAll(async () => {
    await fx.cleanup();
    await disconnect();
  });

  test('a request without a session id is rejected', async ({ request }) => {
    const res = await request.post('/api/orders/from-session', { data: {} });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe('Missing sessionId');
  });

  test('an unpaid session is refused and leaves the order untouched', async ({ request }) => {
    const book = await fx.book({ stock: 3 });
    const buy = await request.post('/api/in-shop/buy', { data: { items: [{ id: book.id, quantity: 1 }], location: 'e2e-from-session' } });
    const { url, orderId } = await buy.json();
    fx.trackOrder(orderId);

    const res = await request.post('/api/orders/from-session', { data: { sessionId: sessionIdFromUrl(url) } });

    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe('Session not paid');
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order).toMatchObject({ paidAt: null, email: null, customerName: null, paymentMethod: null, stockUpdatedAt: null });
    expect((await db.book.findUniqueOrThrow({ where: { id: book.id } })).stock).toBe(3);
  });

  test('a session id Stripe does not know fails cleanly without creating an order', async ({ request }) => {
    const before = await db.order.count();
    const res = await request.post('/api/orders/from-session', { data: { sessionId: 'cs_test_doesnotexist123' } });
    expect(res.status()).toBe(500);
    expect((await res.json()).error).toBe('Failed to create order from session');
    expect(await db.order.count()).toBe(before);
  });
});
