import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendOrderConfirmationEmail } from '@/lib/sendEmail';
import { isRateLimited } from '@/lib/chat/rateLimit';

// POST /api/orders/[id]/send-receipt - re-sends the receipt for a PAID order to the email already on it.
// Public (the buyer isn't logged in), so it never accepts a recipient, only resends to the stored address,
// and it's rate limited per order and per IP.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(`receipt-order:${id}`, 3, 10 * 60_000) || isRateLimited(`receipt-ip:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again in a few minutes.' }, { status: 429 });
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  if (!order.paidAt || !order.email) {
    return NextResponse.json({ error: 'Your receipt is still being prepared. Please try again in a moment.' }, { status: 409 });
  }

  try {
    await sendOrderConfirmationEmail({
      to: order.email,
      orderId: order.id,
      items: order.items as { title: string; quantity: number; price: number }[],
      total: order.finalTotal,
      fulfillmentType: order.fulfillmentType,
      source: order.source,
      discount: order.discountAmount,
      paidAt: order.paidAt,
      paymentMethod: order.paymentMethod,
      shippingAddress: (order.shippingAddress as Record<string, string> | null) ?? undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to resend receipt:', order.id, error);
    return NextResponse.json({ error: 'Could not send the receipt. Please try again.' }, { status: 500 });
  }
}
