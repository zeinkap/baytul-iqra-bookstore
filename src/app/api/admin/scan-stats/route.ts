import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { extractBookItems } from '@/lib/stockManager';
import { normalizeLocation } from '@/lib/location';

// A buyer who tapped Buy now but never paid is only "abandoned" after this long (they may still be paying)
const ABANDONED_AFTER_MS = 30 * 60 * 1000;
const NO_VENUE = '(no venue tag)';

// GET /api/admin/scan-stats?days=30&loc=cafe-a - QR scans vs paid in-shop purchases and abandoned checkouts
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get('days')) || 30, 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const abandonedBefore = new Date(Date.now() - ABANDONED_AFTER_MS);
  const locParam = req.nextUrl.searchParams.get('loc');
  const loc = locParam === 'none' ? 'none' : normalizeLocation(locParam);
  const locWhere = loc === 'none' ? { location: null } : loc ? { location: loc } : {};

  const inShop = { source: 'in-shop' };
  const [scansByBook, scansByStatus, scansByVenue, paidOrders, abandonedOrders] = await Promise.all([
    prisma.scan.groupBy({ by: ['bookId'], where: { createdAt: { gte: since }, bookId: { not: null }, ...locWhere }, _count: { _all: true } }),
    prisma.scan.groupBy({ by: ['status'], where: { createdAt: { gte: since }, ...locWhere }, _count: { _all: true } }),
    prisma.scan.groupBy({ by: ['location'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.order.findMany({ where: { ...inShop, paidAt: { gte: since } }, select: { items: true, finalTotal: true, location: true } }),
    prisma.order.findMany({ where: { ...inShop, paidAt: null, createdAt: { gte: since, lte: abandonedBefore } }, select: { items: true, location: true } }),
  ]);

  const matchesVenue = (venue: string | null) => (loc === 'none' ? venue === null : loc ? venue === loc : true);

  // Per-venue breakdown always covers every venue so the filter dropdown and comparison stay complete
  const venues = new Map<string, { scans: number; paidOrders: number; revenue: number; abandoned: number }>();
  const venue = (name: string | null) => {
    const key = name ?? NO_VENUE;
    if (!venues.has(key)) venues.set(key, { scans: 0, paidOrders: 0, revenue: 0, abandoned: 0 });
    return venues.get(key)!;
  };
  for (const s of scansByVenue) venue(s.location).scans += s._count._all;
  for (const o of paidOrders) {
    const v = venue(o.location);
    v.paidOrders += 1;
    v.revenue += o.finalTotal;
  }
  for (const o of abandonedOrders) venue(o.location).abandoned += 1;

  // Per-book numbers respect the venue filter
  const purchases = new Map<string, number>();
  const revenueByBook = new Map<string, number>();
  const abandonedByBook = new Map<string, number>();
  let paidCount = 0;
  let paidRevenue = 0;
  let abandonedCount = 0;
  for (const order of paidOrders.filter((o) => matchesVenue(o.location))) {
    paidCount += 1;
    paidRevenue += order.finalTotal;
    for (const item of extractBookItems(order.items)) {
      if (!item.id) continue;
      purchases.set(item.id, (purchases.get(item.id) ?? 0) + item.quantity);
      revenueByBook.set(item.id, (revenueByBook.get(item.id) ?? 0) + item.price * item.quantity);
    }
  }
  for (const order of abandonedOrders.filter((o) => matchesVenue(o.location))) {
    abandonedCount += 1;
    for (const item of extractBookItems(order.items)) {
      if (item.id) abandonedByBook.set(item.id, (abandonedByBook.get(item.id) ?? 0) + 1);
    }
  }

  const scans = new Map(scansByBook.map((s) => [s.bookId as string, s._count._all]));
  const bookIds = [...new Set([...scans.keys(), ...purchases.keys(), ...abandonedByBook.keys()])];
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
        abandoned: abandonedByBook.get(id) ?? 0,
        revenue: revenueByBook.get(id) ?? 0,
        conversion: scanCount > 0 ? purchaseCount / scanCount : null,
      };
    })
    .sort((a, b) => b.scans - a.scans);

  const statusCount = (status: string) => scansByStatus.find((s) => s.status === status)?._count._all ?? 0;
  return NextResponse.json({
    days,
    location: loc,
    totals: {
      scans: scansByStatus.reduce((sum, s) => sum + s._count._all, 0),
      soldOutScans: statusCount('sold-out'),
      notFoundScans: statusCount('not-found'),
      paidOrders: paidCount,
      purchases: [...purchases.values()].reduce((a, b) => a + b, 0),
      revenue: paidRevenue,
      abandoned: abandonedCount,
    },
    venues: [...venues.entries()].map(([name, v]) => ({ location: name, ...v })).sort((a, b) => b.revenue - a.revenue || b.scans - a.scans),
    rows,
  });
}
