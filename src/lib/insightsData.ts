import { prisma } from './prisma';
import { isFullyRefunded, netOrderTotal } from './finalizeOrder';
import type { InsightBook, InsightOrder } from './insights';

/**
 * Paid orders (fully refunded ones removed, partial refunds subtracted) and books, in the shape the insights
 * calculations expect. Shared by the Insights page and the daily summary email.
 */
export async function loadInsightInputs(): Promise<{ orders: InsightOrder[]; books: InsightBook[] }> {
  const [paid, books] = await Promise.all([
    prisma.order.findMany({
      where: { paidAt: { not: null } },
      select: { items: true, finalTotal: true, refundedAmount: true, paidAt: true, email: true, paymentMethod: true, device: true, source: true, location: true },
      orderBy: { paidAt: 'desc' },
      take: 20000, // repeat-buyer history; far more than a stall business will reach for years
    }),
    prisma.book.findMany({ select: { id: true, title: true, stock: true, costPrice: true, createdAt: true } }),
  ]);
  const orders: InsightOrder[] = paid
    .filter((o) => !isFullyRefunded(o))
    .map(({ refundedAmount, ...o }) => ({ ...o, finalTotal: netOrderTotal({ finalTotal: o.finalTotal, refundedAmount }), paidAt: o.paidAt as Date }));
  return { orders, books };
}
