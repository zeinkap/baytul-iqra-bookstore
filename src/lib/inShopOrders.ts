import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { extractBookItems } from './stockManager';
import type { PricedItem } from './pricing';

/**
 * Backing out of Stripe and tapping Buy now again would create a second unpaid order for the same book and
 * inflate the abandoned count, so reuse a recent unpaid in-shop order for the same book, price, venue and device.
 */
export async function findReusableInShopOrder(args: {
  items: { id?: string; quantity: number }[];
  finalTotal: number;
  promoCodeId?: string | null;
  venue: string | null;
  device: string | null;
}) {
  const { items, finalTotal, promoCodeId, venue, device } = args;
  if (items.length !== 1) return null;
  const recent = await prisma.order.findMany({
    where: { source: 'in-shop', paidAt: null, email: null, location: venue, device, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  return (
    recent.find((o) => {
      const prev = extractBookItems(o.items);
      return prev.length === 1 && prev[0].id === items[0].id && prev[0].quantity === items[0].quantity && Math.abs(o.finalTotal - finalTotal) < 0.005 && (o.promoCodeId ?? null) === (promoCodeId ?? null);
    }) ?? null
  );
}

/** In-shop buyers return to the book they scanned (or their basket); only those same-site paths are accepted. */
export function safeInShopCancelPath(cancelPath: unknown): string {
  return typeof cancelPath === 'string' && (/^\/b\/[\w-]+(\?loc=[a-z0-9-]{1,40})?$/.test(cancelPath) || cancelPath === '/basket')
    ? cancelPath
    : '/cart';
}

/** The unpaid in-shop order for these items: a recent matching one is reused, otherwise a new one is created. */
export async function getOrCreateInShopOrder(args: {
  items: PricedItem[];
  total: number;
  /** One promo code at most: its id and the discount in cents, already worked out on the server */
  promo?: { promoCodeId: string; discountCents: number } | null;
  venue: string | null;
  device: string | null;
}): Promise<string> {
  const { items, total, promo, venue, device } = args;
  const discountAmount = promo ? promo.discountCents / 100 : 0;
  const finalTotal = Math.round((total - discountAmount) * 100) / 100;
  const existing = await findReusableInShopOrder({ items, finalTotal, promoCodeId: promo?.promoCodeId ?? null, venue, device });
  if (existing) return existing.id;
  const created = await prisma.order.create({
    data: {
      items: items as unknown as Prisma.InputJsonValue,
      total,
      discountAmount,
      finalTotal,
      promoCodeId: promo?.promoCodeId ?? null,
      fulfillmentType: 'pickup',
      pickupLocation: 'In shop',
      source: 'in-shop',
      location: venue,
      device,
    },
  });
  return created.id;
}
