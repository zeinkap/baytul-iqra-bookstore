import { beforeEach, describe, expect, it, vi } from 'vitest';

// The promo rules and the use counting run against a stand-in database, so no server or Stripe is needed
const { promoCode, order } = vi.hoisted(() => ({
  promoCode: { findUnique: vi.fn(), update: vi.fn() },
  order: { findUnique: vi.fn(), updateMany: vi.fn() },
}));
vi.mock('@/lib/prisma', () => ({ prisma: { promoCode, order } }));
vi.mock('@/lib/sendEmail', () => ({
  sendOrderConfirmationEmail: vi.fn(),
  sendOrderNotificationToSales: vi.fn(),
  sendRefundEmail: vi.fn(),
}));

import { MIN_CHARGE_CENTS, resolveInShopPromo, subtotalCentsOf } from '@/lib/pricing';
import { finalizePaidOrder } from '@/lib/finalizeOrder';

const promo = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  code: 'FALL10',
  description: '',
  discountType: 'percentage',
  discountValue: 10,
  minimumOrderAmount: null,
  maxUses: null,
  currentUses: 0,
  validFrom: new Date(Date.now() - 86_400_000),
  validUntil: null,
  isActive: true,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('In-shop promo: resolveInShopPromo', () => {
  it('TC-234: takes a percentage off in whole cents, and ignores case and spaces in the typed code', async () => {
    promoCode.findUnique.mockResolvedValue(promo());
    const r = await resolveInShopPromo('  fall10 ', 2400);
    expect(promoCode.findUnique).toHaveBeenCalledWith({ where: { code: 'FALL10' } });
    expect(r).toMatchObject({ ok: true, promoId: 'p1', code: 'FALL10', discountCents: 240, finalCents: 2160 });
  });

  it('TC-234: rounds a percentage to the cent, so the discount and the charge add back up to the subtotal', async () => {
    promoCode.findUnique.mockResolvedValue(promo({ discountValue: 15 }));
    const r = await resolveInShopPromo('FALL10', 1234); // 15% of 12.34 = 1.851
    expect(r).toMatchObject({ ok: true, discountCents: 185, finalCents: 1049 });
  });

  it('TC-234: a fixed code is stored in cents', async () => {
    promoCode.findUnique.mockResolvedValue(promo({ discountType: 'fixed', discountValue: 300 }));
    const r = await resolveInShopPromo('FALL10', 2400);
    expect(r).toMatchObject({ ok: true, discountCents: 300, finalCents: 2100 });
  });

  it('TC-234: refuses unknown, expired, inactive, used-up and below-minimum codes with a reason', async () => {
    promoCode.findUnique.mockResolvedValueOnce(null);
    expect(await resolveInShopPromo('NOPE', 2400)).toMatchObject({ ok: false, status: 400 });

    promoCode.findUnique.mockResolvedValueOnce(promo({ validUntil: new Date(Date.now() - 1000) }));
    expect(await resolveInShopPromo('FALL10', 2400)).toMatchObject({ ok: false, error: expect.stringContaining('expired') });

    promoCode.findUnique.mockResolvedValueOnce(promo({ isActive: false }));
    expect(await resolveInShopPromo('FALL10', 2400)).toMatchObject({ ok: false, error: expect.stringContaining('no longer active') });

    promoCode.findUnique.mockResolvedValueOnce(promo({ maxUses: 5, currentUses: 5 }));
    expect(await resolveInShopPromo('FALL10', 2400)).toMatchObject({ ok: false, error: expect.stringContaining('usage limit') });

    promoCode.findUnique.mockResolvedValueOnce(promo({ minimumOrderAmount: 30 }));
    expect(await resolveInShopPromo('FALL10', 2400)).toMatchObject({ ok: false, error: expect.stringContaining('Minimum order') });
  });

  it('TC-234: refuses an empty code without asking the database', async () => {
    expect(await resolveInShopPromo('   ', 2400)).toMatchObject({ ok: false, status: 400 });
    expect(await resolveInShopPromo(undefined, 2400)).toMatchObject({ ok: false, status: 400 });
    expect(promoCode.findUnique).not.toHaveBeenCalled();
  });

  it('TC-234: refuses a code that would bring the total below what Stripe can charge', async () => {
    promoCode.findUnique.mockResolvedValue(promo({ discountType: 'percentage', discountValue: 100 }));
    const r = await resolveInShopPromo('FALL10', 2400);
    expect(r).toMatchObject({ ok: false, status: 400 });
    expect(MIN_CHARGE_CENTS).toBe(50);
  });

  it('TC-234: a fixed discount larger than the order is refused rather than going negative', async () => {
    promoCode.findUnique.mockResolvedValue(promo({ discountType: 'fixed', discountValue: 10000 }));
    expect(await resolveInShopPromo('FALL10', 2000)).toMatchObject({ ok: false });
  });
});

describe('In-shop promo: subtotalCentsOf', () => {
  it('TC-234: sums price x quantity in whole cents', () => {
    expect(subtotalCentsOf([{ price: 12.34, quantity: 2 }, { price: 9.5, quantity: 1 }])).toBe(3418);
  });
});

describe('In-shop promo: counting a use', () => {
  const paidOrder = (over: Record<string, unknown> = {}) => ({ id: 'o1', source: 'in-shop', promoCodeId: 'p1', items: [], email: null, ...over });

  it('TC-234: counts one use for the call that flips an in-shop order to paid', async () => {
    order.findUnique.mockResolvedValue(paidOrder());
    order.updateMany.mockResolvedValue({ count: 1 });
    promoCode.update.mockResolvedValue({});
    await finalizePaidOrder('o1', {});
    expect(promoCode.update).toHaveBeenCalledTimes(1);
    expect(promoCode.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { currentUses: { increment: 1 } } });
  });

  it('TC-234: does not count again when the order was already paid (webhook retry, receipt-page fallback)', async () => {
    order.findUnique.mockResolvedValue(paidOrder());
    order.updateMany.mockResolvedValue({ count: 0 });
    await finalizePaidOrder('o1', {});
    expect(promoCode.update).not.toHaveBeenCalled();
  });

  it('TC-234: does not count for an in-shop order without a promo code', async () => {
    order.findUnique.mockResolvedValue(paidOrder({ promoCodeId: null }));
    order.updateMany.mockResolvedValue({ count: 1 });
    await finalizePaidOrder('o1', {});
    expect(promoCode.update).not.toHaveBeenCalled();
  });

  it('TC-234: leaves online orders alone: they count their code when the webhook creates them', async () => {
    order.findUnique.mockResolvedValue(paidOrder({ source: 'online' }));
    order.updateMany.mockResolvedValue({ count: 1 });
    await finalizePaidOrder('o1', {});
    expect(promoCode.update).not.toHaveBeenCalled();
  });
});
