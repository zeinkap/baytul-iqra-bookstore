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
  venue: string | null;
  device: string | null;
}) {
  const { items, finalTotal, venue, device } = args;
  if (items.length !== 1) return null;
  const recent = await prisma.order.findMany({
    where: { source: 'in-shop', paidAt: null, email: null, location: venue, device, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  return (
    recent.find((o) => {
      const prev = extractBookItems(o.items);
      return prev.length === 1 && prev[0].id === items[0].id && prev[0].quantity === items[0].quantity && Math.abs(o.finalTotal - finalTotal) < 0.005;
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
  venue: string | null;
  device: string | null;
}): Promise<string> {
  const { items, total, venue, device } = args;
  const existing = await findReusableInShopOrder({ items, finalTotal: total, venue, device });
  if (existing) return existing.id;
  const created = await prisma.order.create({
    data: {
      items: items as unknown as Prisma.InputJsonValue,
      total,
      discountAmount: 0,
      finalTotal: total,
      fulfillmentType: 'pickup',
      pickupLocation: 'In shop',
      source: 'in-shop',
      location: venue,
      device,
    },
  });
  return created.id;
}
