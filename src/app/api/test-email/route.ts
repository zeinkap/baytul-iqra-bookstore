import { NextRequest, NextResponse } from 'next/server';
import { sendOrderConfirmationEmail } from '@/lib/sendEmail';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
    }

    // Fetch order from database
    const { prisma } = await import('@/lib/prisma');
    const order = await prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (!order.email) {
      return NextResponse.json({ error: 'Order has no email' }, { status: 400 });
    }

    let items: { title: string; quantity: number; price: number }[] = [];
    if (Array.isArray(order.items)) {
      items = order.items
        .filter((item): item is { title: string; quantity: number; price: number } => {
          if (typeof item !== 'object' || item === null) return false;
          
          const typedItem = item as Record<string, unknown>;
          return (
            'title' in typedItem && typeof typedItem.title === 'string' &&
            'quantity' in typedItem && typeof typedItem.quantity === 'number' &&
            'price' in typedItem && typeof typedItem.price === 'number'
          );
        })
        .map(item => ({
          title: item.title,
          quantity: item.quantity,
          price: item.price,
        }));
    }

    let shippingAddress: {
      name?: string;
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    } | undefined = undefined;
    if (order.shippingAddress && typeof order.shippingAddress === 'object' && !Array.isArray(order.shippingAddress)) {
      shippingAddress = order.shippingAddress;
    }

    await sendOrderConfirmationEmail({
      to: order.email,
      orderId: order.id,
      items,
      total: order.total,
      fulfillmentType: order.fulfillmentType,
      shippingAddress,
    });

    return NextResponse.json({ 
      success: true, 
      message: `Customer confirmation email sent to ${order.email}` 
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    return NextResponse.json(
      { error: 'Failed to send test email', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 