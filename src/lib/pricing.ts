import type { PromoCode } from '@prisma/client';
import { prisma } from './prisma';

const MAX_QUANTITY_PER_ITEM = 99;

export interface PricedItem {
  id: string;
  title: string;
  author: string;
  price: number;
  image: string;
  quantity: number;
  format?: string;
}

/** Where a sale happens: the website (`online`) or a QR scan at a venue (`in-shop`). */
export type SaleChannel = 'online' | 'in-shop';

/**
 * Unit price for a channel. In-person sales use the book's in-shop price when it has one (and it is never
 * above the online price); online sales always use `price`.
 */
export function unitPrice(book: { price: number; inShopPrice?: number | null }, channel: SaleChannel): number {
  if (channel === 'in-shop' && book.inShopPrice != null && book.inShopPrice >= 0) {
    return Math.min(book.inShopPrice, book.price);
  }
  return book.price;
}

type PriceResult =
  | { ok: true; items: PricedItem[]; subtotal: number; stockById: Map<string, { title: string; stock: number }> }
  | { ok: false; error: string; status: number };

/**
 * Rebuilds cart items from the database so prices, titles and images can't be
 * tampered with in the browser. Only `id` and `quantity` are taken from the client.
 * `channel` picks which price applies (online vs in-person).
 */
export async function priceItems(rawItems: unknown, channel: SaleChannel = 'online'): Promise<PriceResult> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { ok: false, error: 'No items provided', status: 400 };
  }

  const requested = new Map<string, number>();
  for (const raw of rawItems) {
    const id = typeof raw?.id === 'string' ? raw.id : '';
    const quantity = raw?.quantity;
    if (!id || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY_PER_ITEM) {
      return { ok: false, error: 'Invalid item in cart', status: 400 };
    }
    requested.set(id, (requested.get(id) ?? 0) + quantity);
  }

  const books = await prisma.book.findMany({ where: { id: { in: [...requested.keys()] } } });
  const bookById = new Map(books.map((b) => [b.id, b]));

  const items: PricedItem[] = [];
  for (const [id, quantity] of requested) {
    const book = bookById.get(id);
    if (!book) return { ok: false, error: 'A book in your cart is no longer available', status: 409 };
    items.push({
      id,
      title: book.title,
      author: book.author,
      price: unitPrice(book, channel),
      image: book.images[0] ?? '',
      quantity,
      ...(book.format ? { format: book.format } : {}),
    });
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const stockById = new Map(books.map((b) => [b.id, { title: b.title, stock: b.stock }]));
  return { ok: true, items, subtotal, stockById };
}

type PromoResult = { valid: true; discountAmount: number } | { valid: false; error: string };

/** Single source of truth for promo rules (used by the validate endpoint, orders and checkout). */
export function checkPromoCode(promo: PromoCode, orderTotal: number): PromoResult {
  if (!promo.isActive) return { valid: false, error: 'This promo code is no longer active' };

  const now = new Date();
  if (now < promo.validFrom) return { valid: false, error: 'This promo code is not yet valid' };
  if (promo.validUntil && now > promo.validUntil) return { valid: false, error: 'This promo code has expired' };

  if (promo.minimumOrderAmount && orderTotal < promo.minimumOrderAmount) {
    return { valid: false, error: `Minimum order amount of $${promo.minimumOrderAmount.toFixed(2)} required` };
  }
  if (promo.maxUses && promo.currentUses >= promo.maxUses) {
    return { valid: false, error: 'This promo code has reached its usage limit' };
  }

  let discountAmount = 0;
  if (promo.discountType === 'percentage') {
    discountAmount = (orderTotal * promo.discountValue) / 100;
  } else if (promo.discountType === 'fixed') {
    discountAmount = promo.discountValue / 100; // stored in cents
  }
  return { valid: true, discountAmount: Math.min(discountAmount, orderTotal) };
}

/** Looks up a promo by id and returns the server-computed discount in dollars. */
export async function discountForPromoId(promoCodeId: string, orderTotal: number): Promise<PromoResult> {
  const promo = await prisma.promoCode.findUnique({ where: { id: promoCodeId } });
  if (!promo) return { valid: false, error: 'Invalid promo code' };
  return checkPromoCode(promo, orderTotal);
}

/** Stripe can't charge less than this, so an in-shop promo may not bring the total below it. */
export const MIN_CHARGE_CENTS = 50;

export type InShopPromoResult =
  | { ok: true; promoId: string; code: string; discountCents: number; finalCents: number }
  | { ok: false; error: string; status: number };

/**
 * Applies one promo code to an in-shop purchase. Works in whole cents so the amount the customer sees, the amount
 * on the order and the amount Stripe charges are always the same number. `subtotalCents` must be priced on the server.
 */
export async function resolveInShopPromo(rawCode: unknown, subtotalCents: number): Promise<InShopPromoResult> {
  const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase().slice(0, 40) : '';
  if (!code) return { ok: false, error: 'Enter a promo code', status: 400 };
  const promo = await prisma.promoCode.findUnique({ where: { code } });
  if (!promo) return { ok: false, error: "That promo code isn't valid", status: 400 };
  const checked = checkPromoCode(promo, subtotalCents / 100);
  if (!checked.valid) return { ok: false, error: checked.error, status: 400 };
  const discountCents = Math.min(Math.round(checked.discountAmount * 100), subtotalCents);
  if (discountCents <= 0) return { ok: false, error: "This code doesn't give a discount on this order", status: 400 };
  const finalCents = subtotalCents - discountCents;
  if (finalCents < MIN_CHARGE_CENTS) {
    return { ok: false, error: `This code would bring the total below $${(MIN_CHARGE_CENTS / 100).toFixed(2)}, the least we can charge by card`, status: 400 };
  }
  return { ok: true, promoId: promo.id, code: promo.code, discountCents, finalCents };
}

/** What the customer pays for in-shop items, in cents (the same sum the payment amounts use). */
export const subtotalCentsOf = (items: { price: number; quantity: number }[]) =>
  items.reduce((sum, i) => sum + Math.round(i.price * 100) * i.quantity, 0);
