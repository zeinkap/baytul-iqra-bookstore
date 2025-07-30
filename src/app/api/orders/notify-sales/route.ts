import { NextRequest, NextResponse } from 'next/server';
import { sendOrderNotificationToSales } from '@/lib/sendEmail';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, items, total, fulfillmentType, customerEmail, shippingAddress } = body;

    console.log('Sales notification request:', { orderId, items, total, fulfillmentType, customerEmail });

    if (!orderId || !items || !total || !fulfillmentType || !customerEmail) {
      console.log('Missing required fields:', { orderId, items, total, fulfillmentType, customerEmail });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('Sending sales notification to sales@baytulirqra.com');
    const result = await sendOrderNotificationToSales({
      orderId,
      items,
      total,
      fulfillmentType,
      customerEmail,
      shippingAddress,
    });

    console.log('Sales notification result:', result);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Error sending sales notification:', error);
    return NextResponse.json(
      { error: 'Failed to send sales notification', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 