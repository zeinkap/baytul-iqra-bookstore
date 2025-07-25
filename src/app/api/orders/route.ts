import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { items, total, fulfillmentType, pickupLocation, shippingAddress, email, promoCodeId, discountAmount } = data;
    if (!items || !Array.isArray(items) || typeof total !== 'number' || !fulfillmentType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (fulfillmentType !== 'shipping' && fulfillmentType !== 'pickup') {
      return NextResponse.json({ error: 'Invalid fulfillment type' }, { status: 400 });
    }
    const finalTotal = total - (discountAmount || 0);
    
    const order = await prisma.order.create({
      data: {
        items,
        total,
        discountAmount: discountAmount || 0,
        finalTotal,
        promoCodeId: promoCodeId || null,
        fulfillmentType,
        pickupLocation: fulfillmentType === 'pickup' ? (pickupLocation || 'Alpharetta, GA') : null,
        shippingAddress: fulfillmentType === 'shipping' ? shippingAddress : null,
        email,
      },
    });
    return NextResponse.json({ id: order.id }, { status: 201 });
  } catch (error) {
    console.error('Failed to create order:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
} 