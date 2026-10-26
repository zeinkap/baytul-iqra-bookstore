import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { normalizeLocation } from '@/lib/location';
import { computeInsights } from '@/lib/insights';
import { loadInsightInputs } from '@/lib/insightsData';
import { SCAN_STATUSES } from '@/lib/scanStatus';
import { getVenueFees } from '@/lib/venueFees';

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

  const [{ orders, books }, venueFees, scanDevices] = await Promise.all([
    loadInsightInputs(),
    getVenueFees(),
    prisma.scan.groupBy({
      by: ['device'],
      where: { createdAt: { gte: since }, status: { in: SCAN_STATUSES }, ...(venue === 'none' ? { location: null } : venue ? { location: venue } : {}) },
      _count: { _all: true },
    }),
  ]);

  return NextResponse.json(
    computeInsights(orders, books, scanDevices.map((s) => ({ device: s.device, count: s._count._all })), { days, source, venue, venueFees })
  );
}
