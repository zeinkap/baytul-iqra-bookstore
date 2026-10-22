import { prisma } from './prisma';
import { extractBookItems } from './stockManager';

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

/** In-shop buyers return to the book they scanned; only same-site /b/ paths are accepted. */
export function safeInShopCancelPath(cancelPath: unknown): string {
  return typeof cancelPath === 'string' && /^\/b\/[\w-]+(\?loc=[a-z0-9-]{1,40})?$/.test(cancelPath) ? cancelPath : '/cart';
}
