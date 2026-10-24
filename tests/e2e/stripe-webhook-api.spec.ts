import { test, expect } from '@playwright/test';
import { Fixtures, db, disconnect, localDbAvailable, webhookSecret, signedEvent } from '../helpers/money-path.helper';

/**
 * API tests: POST /api/stripe/webhook. Events are signed with the same STRIPE_WEBHOOK_SECRET the dev server reads.
 * Nothing here marks an order paid for the first time, so no sale-alert or receipt email can be sent.
 */
test.describe('Stripe webhook API: signatures', () => {
  test.skip(!localDbAvailable || !webhookSecret, 'needs a local database and STRIPE_WEBHOOK_SECRET');
  const fx = new Fixtures();
  test.afterAll(async () => {
    await fx.cleanup();
    await disconnect();
  });

  const post = (request: import('@playwright/test').APIRequestContext, payload: string, signature?: string) =>
    request.post('/api/stripe/webhook', {
      data: payload,
      headers: { 'content-type': 'application/json', ...(signature ? { 'stripe-signature': signature } : {}) },
    });

  test('a valid signature is accepted, and unhandled event types are acknowledged without side effects', async ({ request }) => {
    const { payload, header } = signedEvent('customer.created', { id: 'cus_e2e', object: 'customer' });
    const res = await post(request, payload, header);
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'Webhook processed successfully', eventType: 'customer.created' });
  });

  test('a signature made with the wrong secret is rejected', async ({ request }) => {
    const { payload, header } = signedEvent('customer.created', { id: 'cus_e2e', object: 'customer' }, { secret: 'whsec_not_the_real_one' });
    expect((await post(request, payload, header)).status()).toBe(400);
  });

  test('a body changed after signing is rejected', async ({ request }) => {
    const { payload, header } = signedEvent('customer.created', { id: 'cus_e2e', object: 'customer' }, { tamper: true });
    expect((await post(request, payload, header)).status()).toBe(400);
  });

  test('a replayed old event (outside the 5 minute window) is rejected', async ({ request }) => {
    const tenMinutesAgo = Math.floor(Date.now() / 1000) - 10 * 60;
    const { payload, header } = signedEvent('customer.created', { id: 'cus_e2e', object: 'customer' }, { timestamp: tenMinutesAgo });
    expect((await post(request, payload, header)).status()).toBe(400);
  });

  test('a garbage signature header is rejected', async ({ request }) => {
    const { payload } = signedEvent('customer.created', { id: 'cus_e2e', object: 'customer' });
    expect((await post(request, payload, 't=1,v1=deadbeef')).status()).toBe(400);
  });

  test('a payment that is not one of ours (no order id, like every Checkout payment\'s PaymentIntent) creates no stray order', async ({ request }) => {
    const strayOrders = () => db.order.count({ where: { items: { path: ['0', 'title'], equals: 'Book Purchase' } } });
    const before = await strayOrders();
    const { payload, header } = signedEvent('payment_intent.succeeded', {
      id: 'pi_e2e_not_ours',
      object: 'payment_intent',
      amount: 1500,
      currency: 'usd',
      status: 'succeeded',
      metadata: {},
      customer: null,
      receipt_email: null,
    });

    const res = await post(request, payload, header);

    expect(res.status()).toBe(200);
    expect(await strayOrders()).toBe(before);
  });

  test('an unsigned "payment completed" request does nothing to the order', async ({ request }) => {
    const book = await fx.book({ stock: 5 });
    const order = await fx.order(book, { paid: false });
    const { payload } = signedEvent('checkout.session.completed', {
      id: 'cs_test_unsigned',
      object: 'checkout.session',
      payment_status: 'paid',
      metadata: { orderId: order.id, fulfillmentType: 'pickup', source: 'in-shop' },
    });

    await post(request, payload); // no stripe-signature header at all

    const after = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.paidAt).toBeNull();
    expect((await db.book.findUniqueOrThrow({ where: { id: book.id } })).stock).toBe(5);
  });

  test('a signed event whose payment is still pending (delayed methods) does not mark the order paid or take stock', async ({ request }) => {
    const book = await fx.book({ stock: 5 });
    const order = await fx.order(book, { paid: false });
    const { payload, header } = signedEvent('checkout.session.completed', {
      id: 'cs_test_pending',
      object: 'checkout.session',
      payment_status: 'unpaid',
      metadata: { orderId: order.id, fulfillmentType: 'pickup', source: 'in-shop' },
    });

    const res = await post(request, payload, header);

    expect(res.status()).toBe(200);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).paidAt).toBeNull();
    expect((await db.book.findUniqueOrThrow({ where: { id: book.id } })).stock).toBe(5);
  });
});
