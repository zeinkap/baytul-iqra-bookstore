import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { normalizeLocation } from '@/lib/location';
import { computeInsights, type InsightOrder } from '@/lib/insights';
import { SCAN_STATUSES } from '@/lib/scanStatus';
import { isFullyRefunded, netOrderTotal } from '@/lib/finalizeOrder';

// GET /api/admin/insights?days=30&source=in-shop|all&loc=<venue>|none
// Sales by time, profit, baskets and repeat buyers, restock list, payment method and device.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get('days')) || 30, 1), 365);
  const source = req.nextUrl.searchParams.get('source') === 'all' ? 'all' : 'in-shop';
  const locParam = req.nextUrl.searchParams.get('loc');
  const venue = locParam === 'none' ? 'none' : (normalizeLocation(locParam) ?? undefined);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [paid, books, scanDevices] = await Promise.all([
    prisma.order.findMany({
      where: { paidAt: { not: null } },
      select: { items: true, finalTotal: true, refundedAmount: true, paidAt: true, email: true, paymentMethod: true, device: true, source: true, location: true },
      orderBy: { paidAt: 'desc' },
      take: 20000, // repeat-buyer history; far more than a stall business will reach for years
    }),
    prisma.book.findMany({ select: { id: true, title: true, stock: true, costPrice: true, createdAt: true } }),
    prisma.scan.groupBy({
      by: ['device'],
      where: { createdAt: { gte: since }, status: { in: SCAN_STATUSES }, ...(venue === 'none' ? { location: null } : venue ? { location: venue } : {}) },
      _count: { _all: true },
    }),
  ]);

  // Fully refunded sales don't count; partial refunds reduce the amount
  const orders: InsightOrder[] = paid
    .filter((o) => !isFullyRefunded(o))
    .map(({ refundedAmount, ...o }) => ({ ...o, finalTotal: netOrderTotal({ finalTotal: o.finalTotal, refundedAmount }), paidAt: o.paidAt as Date }));
  return NextResponse.json(
    computeInsights(orders, books, scanDevices.map((s) => ({ device: s.device, count: s._count._all })), { days, source, venue })
  );
}
