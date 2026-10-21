import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeIsbn } from '@/lib/isbn';
import { isRateLimited } from '@/lib/chat/rateLimit';
import { normalizeLocation } from '@/lib/location';
import { deviceFromUserAgent } from '@/lib/device';
import { FAILURE_EVENTS, BUY_FAILURE_REASONS, type FailureEvent } from '@/lib/scanStatus';

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

  // A failure event (Buy now broke, or the page crashed) is logged against the same code; the status and
  // reason are checked against fixed lists so the table can't be filled with arbitrary text.
  const event = FAILURE_EVENTS.includes(body?.event) ? (body.event as FailureEvent) : null;
  const reason = typeof body?.detail === 'string' ? body.detail.trim() : '';
  const detail = event === 'buy-failed' ? ((BUY_FAILURE_REASONS as readonly string[]).includes(reason) ? reason : 'other') : event === 'page-error' ? reason.slice(0, 80) || 'unknown' : null;

  await prisma.scan.create({
    data: {
      code,
      bookId: book?.id ?? null,
      status: event ?? (!book ? 'not-found' : book.stock > 0 ? 'ok' : 'sold-out'),
      detail,
      location: normalizeLocation(body?.location),
      device: deviceFromUserAgent(req.headers.get('user-agent')),
    },
  });
  return new NextResponse(null, { status: 204 });
}
