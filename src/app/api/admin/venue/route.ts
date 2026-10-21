import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { normalizeLocation } from '@/lib/location';
import { CURRENT_VENUE_KEY, getCurrentVenue } from '@/lib/venue';

// GET /api/admin/venue - the venue the books are at today, plus venues seen before (for the picker)
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const [current, scanVenues, orderVenues] = await Promise.all([
    getCurrentVenue(),
    prisma.scan.groupBy({ by: ['location'], where: { location: { not: null } } }),
    prisma.order.groupBy({ by: ['location'], where: { location: { not: null } } }),
  ]);
  const known = new Set<string>([...scanVenues, ...orderVenues].map((v) => v.location as string));
  if (current) known.add(current);
  return NextResponse.json({ current, known: [...known].sort() });
}

// PUT /api/admin/venue { venue: "cafe-a" | null } - set or clear where the books are today
export async function PUT(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (body?.venue === null || body?.venue === '') {
    await prisma.appSetting.deleteMany({ where: { key: CURRENT_VENUE_KEY } });
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
  return NextResponse.json({ current: venue });
}
