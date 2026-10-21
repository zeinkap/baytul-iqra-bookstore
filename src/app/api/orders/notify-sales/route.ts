import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendOrderNotificationToSales } from '@/lib/sendEmail';

// POST /api/orders/notify-sales { orderId } - emails the shop about a new order. Called by the order confirmation
// pages, which are public, so everything in the email comes from the stored order, never from the request body.
export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json();
    if (typeof orderId !== 'string' || !orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const result = await sendOrderNotificationToSales({
      orderId: order.id,
      items: order.items as { title: string; quantity: number; price: number }[],
      total: order.finalTotal,
      fulfillmentType: order.fulfillmentType,
      customerEmail: order.email || 'Collected by Stripe (see the Stripe receipt)',
      source: order.source,
      shippingAddress: (order.shippingAddress as Record<string, string> | null) ?? undefined,
    });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Error sending sales notification:', error);
    return NextResponse.json({ error: 'Failed to send sales notification' }, { status: 500 });
  }
}
