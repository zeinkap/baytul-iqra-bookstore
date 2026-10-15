import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { extractBookItems } from '@/lib/stockManager';

// GET /api/admin/scan-stats?days=30 - QR scans vs paid in-shop purchases, per book
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get('days')) || 30, 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [scansByBook, scansByStatus, paidOrders] = await Promise.all([
    prisma.scan.groupBy({ by: ['bookId'], where: { createdAt: { gte: since }, bookId: { not: null } }, _count: { _all: true } }),
    prisma.scan.groupBy({ by: ['status'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.order.findMany({ where: { source: 'in-shop', paidAt: { gte: since } }, select: { items: true } }),
  ]);

  const purchases = new Map<string, number>();
  for (const order of paidOrders) {
    for (const item of extractBookItems(order.items)) {
      if (item.id) purchases.set(item.id, (purchases.get(item.id) ?? 0) + item.quantity);
    }
  }

  const scans = new Map(scansByBook.map((s) => [s.bookId as string, s._count._all]));
  const bookIds = [...new Set([...scans.keys(), ...purchases.keys()])];
  const books = await prisma.book.findMany({ where: { id: { in: bookIds } }, select: { id: true, title: true, isbn: true, stock: true } });
  const bookById = new Map(books.map((b) => [b.id, b]));

  const rows = bookIds
    .map((id) => {
      const scanCount = scans.get(id) ?? 0;
      const purchaseCount = purchases.get(id) ?? 0;
      return {
        bookId: id,
        title: bookById.get(id)?.title ?? 'Deleted book',
        isbn: bookById.get(id)?.isbn ?? null,
        stock: bookById.get(id)?.stock ?? 0,
        scans: scanCount,
        purchases: purchaseCount,
        conversion: scanCount > 0 ? purchaseCount / scanCount : null,
      };
    })
    .sort((a, b) => b.scans - a.scans);

  const statusCount = (status: string) => scansByStatus.find((s) => s.status === status)?._count._all ?? 0;
  return NextResponse.json({
    days,
    totals: {
      scans: scansByStatus.reduce((sum, s) => sum + s._count._all, 0),
      soldOutScans: statusCount('sold-out'),
      notFoundScans: statusCount('not-found'),
      purchases: [...purchases.values()].reduce((a, b) => a + b, 0),
    },
    rows,
  });
}
