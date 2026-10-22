import { test, expect, type APIRequestContext } from '@playwright/test';
import { Fixtures, db, disconnect, localDbAvailable, stripe, stripeTestMode, webhookSecret, signedEvent } from '../helpers/money-path.helper';
import { EmailStub, payOrderWithStripeCli, stripeCliAvailable } from '../helpers/stripe-cli.helper';
import { ADMIN_COOKIE, createSessionToken } from '../../src/lib/adminAuth';

/**
 * The paid-checkout path, against a production-build server (playwright.config.server.ts) with a local database and
 * Stripe TEST mode. A Checkout Session is created through /api/in-shop/buy, then a second, real session carrying the
 * same order id is paid with the Stripe CLI (`stripe trigger`, the only way to pay one). The server's emails go to a
 * local stub, so they can be counted and never reach anyone.
 *
 * Covers the receipt page's fallback (/api/orders/from-session), the Stripe webhook, refunds and restock.
 */
const SALES = 'sales@baytuliqra.com';
const BUYER = 'stripe@example.com'; // the buyer the Stripe CLI fixture uses

test.describe('Paid checkout (Stripe CLI)', () => {
  test.skip(
    !localDbAvailable || !stripeTestMode || !webhookSecret || !stripeCliAvailable,
    'needs a local database, a Stripe test key, STRIPE_WEBHOOK_SECRET and the Stripe CLI'
  );
  test.describe.configure({ mode: 'serial' });

  const fx = new Fixtures();
  const emails = new EmailStub();
  test.beforeAll(() => emails.start());
  test.afterAll(async () => {
    await emails.stop();
    await fx.cleanup();
    await disconnect();
  });
  test.beforeEach(() => emails.clear());

  /** A book, its unpaid order (as the scan page creates it), and a paid Stripe session for that order. */
  async function paidOrder(request: APIRequestContext) {
    const book = await fx.book({ stock: 5, price: 15 });
    const buy = await request.post('/api/in-shop/buy', { data: { items: [{ id: book.id, quantity: 1 }], location: `e2e-paid-${book.id}` } });
    const { orderId } = await buy.json();
    fx.trackOrder(orderId);
    const session = await payOrderWithStripeCli(orderId);
    expect(session.payment_status).toBe('paid');
    return { book, orderId, session };
  }
  const fromSession = (request: APIRequestContext, sessionId: string) => request.post('/api/orders/from-session', { data: { sessionId } });
  const webhook = (request: APIRequestContext, type: string, object: unknown) => {
    const { payload, header } = signedEvent(type, JSON.parse(JSON.stringify(object)));
    return request.post('/api/stripe/webhook', { data: payload, headers: { 'content-type': 'application/json', 'stripe-signature': header } });
  };
  const stockOf = async (bookId: string) => (await db.book.findUniqueOrThrow({ where: { id: bookId } })).stock;
  const orderOf = (id: string) => db.order.findUniqueOrThrow({ where: { id } });

  test('from-session finalizes a paid order and sends one sale alert and one receipt; calling it again sends nothing', async ({ request }) => {
    const { orderId, session } = await paidOrder(request);

    const first = await fromSession(request, session.id);
    expect(first.status()).toBe(200);
    const body = await first.json();
    expect(body.id).toBe(orderId);
    expect(body.paidAt).not.toBeNull();
    expect(body.email).toBe('s***@example.com'); // the browser only ever sees a masked address

    const order = await orderOf(orderId);
    expect(order).toMatchObject({ email: BUYER, customerName: 'Jenny Rosen', paymentMethod: 'card', source: 'in-shop' });
    expect(order.paidAt).not.toBeNull();

    // The emails go out after the response; exactly one of each
    await emails.waitFor(SALES, 'New sale');
    await emails.waitFor(BUYER, 'receipt');
    await emails.settle();
    expect(emails.to(SALES, 'New sale')).toHaveLength(1);
    expect(emails.to(BUYER, 'receipt')).toHaveLength(1);

    // Calling it again (the receipt page polls) changes nothing and sends nothing
    emails.clear();
    const second = await fromSession(request, session.id);
    expect(second.status()).toBe(200);
    expect((await second.json()).id).toBe(orderId);
    await emails.settle();
    expect(emails.emails).toEqual([]);
    expect(await db.order.count({ where: { id: orderId } })).toBe(1);
  });

  test('the webhook after from-session takes stock once and sends no second sale alert or receipt', async ({ request }) => {
    const { book, orderId, session } = await paidOrder(request);

    expect((await fromSession(request, session.id)).status()).toBe(200);
    await emails.waitFor(SALES, 'New sale');
    await emails.waitFor(BUYER, 'receipt');
    expect(await stockOf(book.id)).toBe(5); // from-session never takes stock: only the webhook does
    emails.clear();

    const hook = await webhook(request, 'checkout.session.completed', session);
    expect(hook.status()).toBe(200);
    expect(await stockOf(book.id)).toBe(4);
    expect((await orderOf(orderId)).stockUpdatedAt).not.toBeNull();

    // Stripe delivers it again
    expect((await webhook(request, 'checkout.session.completed', session)).status()).toBe(200);
    expect(await stockOf(book.id)).toBe(4);
    await emails.settle();
    expect(emails.emails).toEqual([]);
  });

  test('the webhook first: it pays the order, takes stock once and sends one sale alert and one receipt; from-session then sends nothing', async ({ request }) => {
    const { book, orderId, session } = await paidOrder(request);

    expect((await webhook(request, 'checkout.session.completed', session)).status()).toBe(200);
    const order = await orderOf(orderId);
    expect(order).toMatchObject({ email: BUYER, customerName: 'Jenny Rosen', paymentMethod: 'card' });
    expect(order.paidAt).not.toBeNull();
    expect(await stockOf(book.id)).toBe(4);
    await emails.waitFor(SALES, 'New sale');
    await emails.waitFor(BUYER, 'receipt');

    emails.clear();
    expect((await fromSession(request, session.id)).status()).toBe(200);
    expect((await webhook(request, 'checkout.session.completed', session)).status()).toBe(200);
    await emails.settle();
    expect(emails.emails).toEqual([]);
    expect(await stockOf(book.id)).toBe(4);
  });

  test('refunds: recorded from the charge.refunded webhook, one email per refund, then restock puts the book back once', async ({ request }) => {
    const { book, orderId, session } = await paidOrder(request);
    expect((await webhook(request, 'checkout.session.completed', session)).status()).toBe(200);
    expect(await stockOf(book.id)).toBe(4);
    emails.clear();

    // The order is $15 (the book's price); Stripe's CLI session was paid $30, so up to that can be refunded
    const intentId = session.payment_intent as string;
    const refundCharge = async (cents: number) => {
      await stripe.refunds.create({ payment_intent: intentId, amount: cents });
      const intent = await stripe.paymentIntents.retrieve(intentId);
      return stripe.charges.retrieve(intent.latest_charge as string);
    };

    const partial = await refundCharge(500);
    expect((await webhook(request, 'charge.refunded', partial)).status()).toBe(200);
    expect((await orderOf(orderId)).refundedAmount).toBe(5);
    await emails.waitFor(BUYER, 'refund');
    expect(emails.to(BUYER, 'refund')).toHaveLength(1);

    // The same event again: nothing changes and no second email
    emails.clear();
    expect((await webhook(request, 'charge.refunded', partial)).status()).toBe(200);
    await emails.settle();
    expect(emails.emails).toEqual([]);
    expect((await orderOf(orderId)).refundedAmount).toBe(5);

    // A partly refunded order can't be restocked yet
    const adminHeaders = { cookie: `${ADMIN_COOKIE}=${await createSessionToken()}` };
    expect((await request.post(`/api/admin/orders/${orderId}/restock`, { headers: adminHeaders })).status()).toBe(409);

    // Refund the rest of the order ($10 more = $15 total)
    const full = await refundCharge(1000);
    expect((await webhook(request, 'charge.refunded', full)).status()).toBe(200);
    expect((await orderOf(orderId)).refundedAmount).toBe(15);
    await emails.waitFor(BUYER, 'refund');
    expect(emails.to(BUYER, 'refund')).toHaveLength(1);

    const restock = await request.post(`/api/admin/orders/${orderId}/restock`, { headers: adminHeaders });
    expect(restock.status()).toBe(200);
    expect(await stockOf(book.id)).toBe(5);
    expect((await request.post(`/api/admin/orders/${orderId}/restock`, { headers: adminHeaders })).status()).toBe(409);
    expect(await stockOf(book.id)).toBe(5);
  });
});
