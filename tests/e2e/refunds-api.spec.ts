import { test, expect } from '@playwright/test';
import { Fixtures, db, disconnect, localDbAvailable, webhookSecret, signedEvent } from '../helpers/money-path.helper';
import { ADMIN_COOKIE, createSessionToken } from '../../src/lib/adminAuth';
import { recordRefund, netOrderTotal, isFullyRefunded } from '../../src/lib/finalizeOrder';

/**
 * Refunds: how Stripe refunds are recorded on an order (recordRefund, called by the charge.refunded webhook) and
 * the admin "restock" action for fully refunded orders.
 *
 * recordRefund is called directly with orders that have no email, and the helper sets a dummy email key, so no refund
 * email can be sent. The webhook's happy path (a refund found through its Checkout Session) is not automated: it needs a paid
 * Stripe session, which can only be created on Stripe's hosted page.
 */
test.describe('Refunds: recording', () => {
  test.skip(!localDbAvailable, 'needs a local database (the tests create and delete their own rows)');
  const fx = new Fixtures();
  test.afterAll(async () => {
    await fx.cleanup();
    await disconnect();
  });

  const refundedOf = async (id: string) => db.order.findUniqueOrThrow({ where: { id }, select: { refundedAmount: true, refundedAt: true } });

  test('a partial refund is stored and the order keeps its remaining value', async () => {
    const book = await fx.book({ price: 20 });
    const order = await fx.order(book, { paid: true });

    const updated = await recordRefund(order.id, 5);

    expect(updated).toMatchObject({ refundedAmount: 5 });
    expect(updated!.refundedAt).not.toBeNull();
    expect(netOrderTotal(updated!)).toBeCloseTo(15, 2);
    expect(isFullyRefunded(updated!)).toBe(false);
  });

  test('refunds are cumulative: a bigger total raises the amount and keeps the first refund time', async () => {
    const book = await fx.book({ price: 20 });
    const order = await fx.order(book, { paid: true });

    await recordRefund(order.id, 5);
    const first = await refundedOf(order.id);
    await recordRefund(order.id, 12);
    const second = await refundedOf(order.id);

    expect(second.refundedAmount).toBe(12);
    expect(second.refundedAt!.getTime()).toBe(first.refundedAt!.getTime());
  });

  test('repeated or out-of-order Stripe events never lower or change the recorded refund', async () => {
    const book = await fx.book({ price: 20 });
    const order = await fx.order(book, { paid: true });

    await recordRefund(order.id, 12);
    await recordRefund(order.id, 12); // Stripe re-delivers the same event
    await recordRefund(order.id, 5); // an older event arrives late

    expect((await refundedOf(order.id)).refundedAmount).toBe(12);
  });

  test('two events at the same moment end at the highest amount', async () => {
    const book = await fx.book({ price: 20 });
    const order = await fx.order(book, { paid: true });

    await Promise.all([recordRefund(order.id, 7), recordRefund(order.id, 9), recordRefund(order.id, 7)]);

    expect((await refundedOf(order.id)).refundedAmount).toBe(9);
  });

  test('refunding the whole order marks it fully refunded', async () => {
    const book = await fx.book({ price: 20 });
    const order = await fx.order(book, { paid: true, quantity: 2 });

    const updated = await recordRefund(order.id, 40);

    expect(isFullyRefunded(updated!)).toBe(true);
    expect(netOrderTotal(updated!)).toBeCloseTo(0, 2);
  });

  test('a refund for an order we do not have is ignored', async () => {
    expect(await recordRefund('no-such-order', 5)).toBeNull();
  });
});

test.describe('Refunds: charge.refunded webhook', () => {
  test.skip(!localDbAvailable || !webhookSecret, 'needs a local database and STRIPE_WEBHOOK_SECRET');

  test('a signed refund with no payment attached is acknowledged and changes nothing', async ({ request }) => {
    const { payload, header } = signedEvent('charge.refunded', { id: 'ch_e2e', object: 'charge', amount_refunded: 500, payment_intent: null });
    const res = await request.post('/api/stripe/webhook', {
      data: payload,
      headers: { 'content-type': 'application/json', 'stripe-signature': header },
    });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ eventType: 'charge.refunded' });
  });

  test('a refund signed with the wrong secret is refused', async ({ request }) => {
    const { payload, header } = signedEvent(
      'charge.refunded',
      { id: 'ch_e2e', object: 'charge', amount_refunded: 500, payment_intent: 'pi_e2e' },
      { secret: 'whsec_wrong' }
    );
    const res = await request.post('/api/stripe/webhook', {
      data: payload,
      headers: { 'content-type': 'application/json', 'stripe-signature': header },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe('Refunds: admin restock', () => {
  test.skip(!localDbAvailable || !process.env.ADMIN_PASSWORD, 'needs a local database and ADMIN_PASSWORD');
  const fx = new Fixtures();
  test.afterAll(async () => {
    await fx.cleanup();
    await disconnect();
  });

  /** A signed admin session made directly, so tests don't use up the login rate limit. */
  async function adminHeaders() {
    return { cookie: `${ADMIN_COOKIE}=${await createSessionToken()}` };
  }
  const restock = async (request: import('@playwright/test').APIRequestContext, id: string) =>
    request.post(`/api/admin/orders/${id}/restock`, { headers: await adminHeaders() });
  const refundOrder = async (orderId: string, amount: number) =>
    db.order.update({ where: { id: orderId }, data: { refundedAmount: amount, refundedAt: new Date() } });
  const stockOf = async (bookId: string) => (await db.book.findUniqueOrThrow({ where: { id: bookId } })).stock;

  test('an unknown order is not found', async ({ request }) => {
    expect((await restock(request, 'no-such-order')).status()).toBe(404);
  });

  test('an order that was never refunded cannot be restocked', async ({ request }) => {
    const book = await fx.book({ stock: 3, price: 20 });
    const order = await fx.order(book, { paid: true });
    const res = await restock(request, order.id);
    expect(res.status()).toBe(409);
    expect(await stockOf(book.id)).toBe(3);
  });

  test('a partly refunded order cannot be restocked', async ({ request }) => {
    const book = await fx.book({ stock: 3, price: 20 });
    const order = await fx.order(book, { paid: true });
    await refundOrder(order.id, 5);
    expect((await restock(request, order.id)).status()).toBe(409);
    expect(await stockOf(book.id)).toBe(3);
  });

  test('a fully refunded order puts its books back once', async ({ request }) => {
    const book = await fx.book({ stock: 3, price: 20 });
    const order = await fx.order(book, { paid: true, quantity: 2 });
    await refundOrder(order.id, 40);

    const first = await restock(request, order.id);
    expect(first.status()).toBe(200);
    expect(await first.json()).toEqual({ restocked: 2 });
    expect(await stockOf(book.id)).toBe(5);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).restockedAt).not.toBeNull();

    const second = await restock(request, order.id);
    expect(second.status()).toBe(409);
    expect((await second.json()).error).toContain('already restocked');
    expect(await stockOf(book.id)).toBe(5);
  });

  test('a double click restocks only once', async ({ request }) => {
    const book = await fx.book({ stock: 1, price: 20 });
    const order = await fx.order(book, { paid: true });
    await refundOrder(order.id, 20);

    const results = await Promise.all([restock(request, order.id), restock(request, order.id)]);

    expect(results.map((r) => r.status()).sort()).toEqual([200, 409]);
    expect(await stockOf(book.id)).toBe(2);
  });
});
