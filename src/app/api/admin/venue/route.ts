import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { normalizeLocation } from '@/lib/location';
import { CURRENT_VENUE_KEY, VENUE_CACHE_TAG, getCurrentVenue } from '@/lib/venue';
import { venueFeeKey } from '@/lib/venueFees';

// GET /api/admin/venue - the venue the books are at today, plus venues seen before (for the picker) with how much
// history each one has (for the "Remove venue" confirmation)
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const tagged = { location: { not: null } };
  const [current, scanVenues, orderVenues, paidVenues] = await Promise.all([
    getCurrentVenue(),
    prisma.scan.groupBy({ by: ['location'], where: tagged, _count: { _all: true } }),
    prisma.order.groupBy({ by: ['location'], where: tagged, _count: { _all: true } }),
    prisma.order.groupBy({ by: ['location'], where: { ...tagged, paidAt: { not: null } }, _count: { _all: true } }),
  ]);
  const details = new Map<string, { venue: string; scans: number; orders: number; paidOrders: number }>();
  const entry = (venue: string) => {
    if (!details.has(venue)) details.set(venue, { venue, scans: 0, orders: 0, paidOrders: 0 });
    return details.get(venue)!;
  };
  for (const v of scanVenues) entry(v.location as string).scans = v._count._all;
  for (const v of orderVenues) entry(v.location as string).orders = v._count._all;
  for (const v of paidVenues) entry(v.location as string).paidOrders = v._count._all;
  if (current) entry(current);
  const venues = [...details.values()].sort((a, b) => a.venue.localeCompare(b.venue));
  return NextResponse.json({ current, known: venues.map((v) => v.venue), venues });
}

// PUT /api/admin/venue { venue: "cafe-a" | null } - set or clear where the books are today
export async function PUT(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (body?.venue === null || body?.venue === '') {
    await prisma.appSetting.deleteMany({ where: { key: CURRENT_VENUE_KEY } });
    revalidateTag(VENUE_CACHE_TAG, { expire: 0 });
    return NextResponse.json({ current: null });
  }
  const venue = normalizeLocation(body?.venue);
  if (!venue) {
    return NextResponse.json({ error: 'Use a short name with letters, numbers and dashes, e.g. cafe-a' }, { status: 400 });
  }
  await prisma.appSetting.upsert({
    where: { key: CURRENT_VENUE_KEY },
    create: { key: CURRENT_VENUE_KEY, value: venue },
    update: { value: venue },
  });
  revalidateTag(VENUE_CACHE_TAG, { expire: 0 });
  return NextResponse.json({ current: venue });
}

const SCAN_CHOICES = ['untag', 'delete'] as const;
const ORDER_CHOICES = ['untag', 'keep'] as const;

// DELETE /api/admin/venue { venue: "cafe-a", scans: "untag" | "delete", orders: "untag" | "keep" } - remove a venue.
// Its scans lose the venue name (or are deleted); its orders lose it only when asked (the sales themselves are never
// deleted). Removing a venue from its orders also removes its flat fee. If it is where the books are today, that is cleared.
// Leaving out a choice picks the one that deletes nothing and keeps the sales' venue.
export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const venue = normalizeLocation(body?.venue);
  if (!venue) {
    return NextResponse.json({ error: 'Choose the venue to remove' }, { status: 400 });
  }
  const scans = body?.scans ?? 'untag';
  const orders = body?.orders ?? 'keep';
  if (!SCAN_CHOICES.includes(scans) || !ORDER_CHOICES.includes(orders)) {
    return NextResponse.json({ error: 'scans must be "untag" or "delete" and orders must be "untag" or "keep"' }, { status: 400 });
  }

  // All or nothing: a half-removed venue would leave some records tagged and others not
  const steps: Prisma.PrismaPromise<Prisma.BatchPayload>[] = [
    scans === 'delete'
      ? prisma.scan.deleteMany({ where: { location: venue } })
      : prisma.scan.updateMany({ where: { location: venue }, data: { location: null } }),
  ];
  if (orders === 'untag') {
    steps.push(prisma.order.updateMany({ where: { location: venue }, data: { location: null } }));
    // A venue's flat fee goes with the venue name on its sales; with the sales kept under it, the fee stays too
    steps.push(prisma.appSetting.deleteMany({ where: { key: venueFeeKey(venue) } }));
  }
  steps.push(prisma.appSetting.deleteMany({ where: { key: CURRENT_VENUE_KEY, value: venue } }));
  const results = await prisma.$transaction(steps);
  const scanResult = results[0];
  const orderResult = orders === 'untag' ? results[1] : { count: 0 };
  const currentResult = results[results.length - 1];
  revalidateTag(VENUE_CACHE_TAG, { expire: 0 });

  return NextResponse.json({
    venue,
    scans: scans === 'delete' ? { deleted: scanResult.count } : { untagged: scanResult.count },
    orders: { untagged: orderResult.count },
    clearedCurrent: currentResult.count > 0,
  });
}
