import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeIsbn } from '@/lib/isbn';
import { isRateLimited } from '@/lib/chat/rateLimit';
import { normalizeLocation } from '@/lib/location';
import { deviceFromUserAgent } from '@/lib/device';

// POST /api/scans - records one QR label scan. Public (customers aren't logged in), so:
// the book and status are resolved server-side from the code, and writes are rate limited.
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(`scan:${ip}`, 30, 60_000)) {
    return new NextResponse(null, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const code = typeof body?.code === 'string' ? body.code.trim() : '';
  if (!code || code.length > 64) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  }

  const isbn = normalizeIsbn(code);
  const book = await prisma.book.findFirst({
    where: isbn ? { OR: [{ isbn }, { id: code }] } : { id: code },
    select: { id: true, stock: true },
  });

  await prisma.scan.create({
    data: {
      code,
      bookId: book?.id ?? null,
      status: !book ? 'not-found' : book.stock > 0 ? 'ok' : 'sold-out',
      location: normalizeLocation(body?.location),
      device: deviceFromUserAgent(req.headers.get('user-agent')),
    },
  });
  return new NextResponse(null, { status: 204 });
}
