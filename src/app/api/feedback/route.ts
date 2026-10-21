import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isRateLimited } from '@/lib/chat/rateLimit';

// POST /api/feedback { orderId, message } - "What book do you wish we had?" from the in-shop receipt page.
// Public, so: the order must exist (limits drive-by spam), length is capped, and writes are rate limited.
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const body = await req.json().catch(() => null);
  const orderId = typeof body?.orderId === 'string' ? body.orderId : '';
  const message = typeof body?.message === 'string' ? body.message.trim() : '';

  if (isRateLimited(`feedback-ip:${ip}`, 5, 10 * 60_000) || (orderId && isRateLimited(`feedback-order:${orderId}`, 3, 10 * 60_000))) {
    return NextResponse.json({ error: 'Too many messages. Please try again later.' }, { status: 429 });
  }
  if (message.length < 2 || message.length > 500) {
    return NextResponse.json({ error: 'Please write between 2 and 500 characters.' }, { status: 400 });
  }
  const order = orderId ? await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, location: true } }) : null;
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  await prisma.feedback.create({ data: { orderId: order.id, message, location: order.location } });
  return NextResponse.json({ ok: true }, { status: 201 });
}
