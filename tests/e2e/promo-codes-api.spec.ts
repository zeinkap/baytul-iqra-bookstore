import { test, expect } from '@playwright/test';
import { Fixtures, disconnect, localDbAvailable } from '../helpers/money-path.helper';

/**
 * API tests: promo code rules, through POST /api/promo-codes/validate and through order creation
 * (where the discount must be worked out on the server, never trusted from the browser).
 */
test.describe('Promo codes', () => {
  test.skip(!localDbAvailable, 'needs a local database (the tests create and delete their own rows)');
  const fx = new Fixtures();
  test.afterAll(async () => {
    await fx.cleanup();
    await disconnect();
  });

  const day = 24 * 60 * 60 * 1000;
  const validate = (request: import('@playwright/test').APIRequestContext, code: string, orderTotal: number) =>
    request.post('/api/promo-codes/validate', { data: { code, orderTotal } });

  test('a percentage code takes that percent off', async ({ request }) => {
    const promo = await fx.promo({ discountType: 'percentage', discountValue: 10 });
    const body = await (await validate(request, promo.code, 50)).json();
    expect(body.valid).toBe(true);
    expect(body.promoCode.discountAmount).toBeCloseTo(5, 2);
    expect(body.promoCode.finalTotal).toBeCloseTo(45, 2);
  });

  test('a fixed code is stored in cents and takes that many dollars off', async ({ request }) => {
    const promo = await fx.promo({ discountType: 'fixed', discountValue: 300 });
    const body = await (await validate(request, promo.code, 50)).json();
    expect(body.valid).toBe(true);
    expect(body.promoCode.discountAmount).toBeCloseTo(3, 2);
  });

  test('a fixed discount never goes below zero total', async ({ request }) => {
    const promo = await fx.promo({ discountType: 'fixed', discountValue: 10000 });
    const body = await (await validate(request, promo.code, 20)).json();
    expect(body.promoCode.discountAmount).toBeCloseTo(20, 2);
    expect(body.promoCode.finalTotal).toBeCloseTo(0, 2);
  });

  test('codes are matched case-insensitively', async ({ request }) => {
    const promo = await fx.promo({ discountType: 'percentage', discountValue: 10 });
    expect((await (await validate(request, promo.code.toLowerCase(), 50)).json()).valid).toBe(true);
  });

  test('an unknown code is invalid', async ({ request }) => {
    const body = await (await validate(request, 'NOSUCHCODE123', 50)).json();
    expect(body).toMatchObject({ valid: false, error: 'Invalid promo code' });
  });

  test('inactive, expired, not-yet-valid, below-minimum and used-up codes are refused with a reason', async ({ request }) => {
    const cases = [
      { data: { isActive: false }, error: 'no longer active' },
      { data: { validUntil: new Date(Date.now() - day) }, error: 'expired' },
      { data: { validFrom: new Date(Date.now() + day) }, error: 'not yet valid' },
      { data: { minimumOrderAmount: 100 }, error: 'Minimum order amount of $100.00' },
      { data: { maxUses: 2, currentUses: 2 }, error: 'usage limit' },
    ];
    for (const c of cases) {
      const promo = await fx.promo({ discountType: 'percentage', discountValue: 10, ...c.data });
      const body = await (await validate(request, promo.code, 50)).json();
      expect(body.valid, c.error).toBe(false);
      expect(body.error, c.error).toContain(c.error);
    }
  });

  test('a code still has uses left just below its limit, and works exactly at the minimum order', async ({ request }) => {
    const lastUse = await fx.promo({ discountType: 'percentage', discountValue: 10, maxUses: 2, currentUses: 1 });
    expect((await (await validate(request, lastUse.code, 50)).json()).valid).toBe(true);
    const atMinimum = await fx.promo({ discountType: 'percentage', discountValue: 10, minimumOrderAmount: 50 });
    expect((await (await validate(request, atMinimum.code, 50)).json()).valid).toBe(true);
  });

  test('missing or malformed requests are rejected', async ({ request }) => {
    expect((await request.post('/api/promo-codes/validate', { data: { orderTotal: 50 } })).status()).toBe(400);
    expect((await request.post('/api/promo-codes/validate', { data: { code: 'X', orderTotal: '50' } })).status()).toBe(400);
    expect((await request.post('/api/promo-codes/validate', { data: { code: 'X' } })).status()).toBe(400);
  });

  test.describe('applied to an order', () => {
    const createOrder = (request: import('@playwright/test').APIRequestContext, bookId: string, extra: Record<string, unknown>) =>
      request.post('/api/orders', { data: { items: [{ id: bookId, quantity: 2 }], fulfillmentType: 'pickup', ...extra } });

    test('the discount is computed on the server and ignores a client-supplied discount', async ({ request }) => {
      const book = await fx.book({ price: 25, stock: 10 });
      const promo = await fx.promo({ discountType: 'percentage', discountValue: 20 });
      const res = await createOrder(request, book.id, { promoCodeId: promo.id, discountAmount: 49.99, finalTotal: 0.01 });
      expect(res.status()).toBe(201);
      const { id } = await res.json();
      fx.trackOrder(id);
      const order = await (await request.get(`/api/orders/${id}`)).json();
      expect(order.total).toBeCloseTo(50, 2);
      expect(order.discountAmount).toBeCloseTo(10, 2);
      expect(order.finalTotal).toBeCloseTo(40, 2);
    });

    test('an order below the code\'s minimum is refused', async ({ request }) => {
      const book = await fx.book({ price: 10, stock: 10 });
      const promo = await fx.promo({ discountType: 'percentage', discountValue: 20, minimumOrderAmount: 100 });
      const res = await createOrder(request, book.id, { promoCodeId: promo.id });
      expect(res.status()).toBe(400);
      expect((await res.json()).error).toContain('Minimum order amount');
    });

    test('an expired code or an unknown promo id is refused', async ({ request }) => {
      const book = await fx.book({ price: 25, stock: 10 });
      const expired = await fx.promo({ discountType: 'percentage', discountValue: 20, validUntil: new Date(Date.now() - day) });
      expect((await createOrder(request, book.id, { promoCodeId: expired.id })).status()).toBe(400);
      expect((await createOrder(request, book.id, { promoCodeId: 'not-a-real-id' })).status()).toBe(400);
    });

    test('shipping is added after the discount', async ({ request }) => {
      const book = await fx.book({ price: 25, stock: 10 });
      const promo = await fx.promo({ discountType: 'percentage', discountValue: 20 });
      const res = await request.post('/api/orders', {
        data: { items: [{ id: book.id, quantity: 2 }], fulfillmentType: 'shipping', promoCodeId: promo.id, shippingAddress: { line1: '1 Test St' } },
      });
      const { id } = await res.json();
      fx.trackOrder(id);
      const order = await (await request.get(`/api/orders/${id}`)).json();
      // 50 - 10 discount + 5 shipping
      expect(order.finalTotal).toBeCloseTo(45, 2);
    });
  });
});
