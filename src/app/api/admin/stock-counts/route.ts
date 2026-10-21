import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { normalizeLocation } from '@/lib/location';

const MAX_COUNTS_PER_REQUEST = 500;

// GET /api/admin/stock-counts - recent physical counts plus a shrinkage summary (last 90 days)
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const counts = await prisma.stockCount.findMany({ where: { countedAt: { gte: since } }, orderBy: { countedAt: 'desc' }, take: 300 });

  const missing = counts.filter((c) => c.difference < 0);
  return NextResponse.json({
    counts,
    summary: {
      booksCounted: counts.length,
      missingUnits: missing.reduce((sum, c) => sum - c.difference, 0),
      extraUnits: counts.filter((c) => c.difference > 0).reduce((sum, c) => sum + c.difference, 0),
      missingValueAtCost: missing.reduce((sum, c) => sum - c.difference * (c.costPrice ?? 0), 0),
    },
  });
}

// POST /api/admin/stock-counts { counts: [{ bookId, counted }], adjust?: boolean, location?: string }
// Records what was physically on the shelf vs the system's stock; optionally sets stock to the counted number.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const counts: { bookId: string; counted: number }[] = Array.isArray(body?.counts) ? body.counts : [];
  if (counts.length === 0 || counts.length > MAX_COUNTS_PER_REQUEST) {
    return NextResponse.json({ error: `Send between 1 and ${MAX_COUNTS_PER_REQUEST} counts` }, { status: 400 });
  }
  if (counts.some((c) => typeof c?.bookId !== 'string' || !Number.isInteger(c?.counted) || c.counted < 0)) {
    return NextResponse.json({ error: 'Each count needs a bookId and a whole number counted (0 or more)' }, { status: 400 });
  }
  const adjust = body?.adjust === true;
  const location = normalizeLocation(body?.location);

  const books = await prisma.book.findMany({
    where: { id: { in: counts.map((c) => c.bookId) } },
    select: { id: true, title: true, stock: true, costPrice: true },
  });
  const bookById = new Map(books.map((b) => [b.id, b]));
  const unknown = counts.filter((c) => !bookById.has(c.bookId));
  if (unknown.length > 0) {
    return NextResponse.json({ error: `${unknown.length} book(s) not found` }, { status: 404 });
  }

  await prisma.$transaction([
    ...counts.map((c) => {
      const book = bookById.get(c.bookId)!;
      return prisma.stockCount.create({
        data: {
          bookId: book.id,
          bookTitle: book.title,
          costPrice: book.costPrice,
          systemStock: book.stock,
          countedStock: c.counted,
          difference: c.counted - book.stock,
          adjusted: adjust && c.counted !== book.stock,
          location,
        },
      });
    }),
    ...(adjust
      ? counts
          .filter((c) => c.counted !== bookById.get(c.bookId)!.stock)
          .map((c) => prisma.book.update({ where: { id: c.bookId }, data: { stock: c.counted } }))
      : []),
  ]);
  if (adjust) revalidateTag('books', { expire: 0 });

  const differences = counts.filter((c) => c.counted !== bookById.get(c.bookId)!.stock).length;
  return NextResponse.json({ saved: counts.length, differences, adjusted: adjust });
}
