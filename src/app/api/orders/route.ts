import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const fulfillmentType = searchParams.get('fulfillmentType') || '';
    
    const skip = (page - 1) * limit;
    
    // Build where clause
    const where: {
      OR?: Array<{ email?: { contains: string; mode: 'insensitive' }; id?: { contains: string; mode: 'insensitive' } }>;
      fulfillmentType?: string;
    } = {};
    
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { id: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (fulfillmentType) {
      where.fulfillmentType = fulfillmentType;
    }
    
    // Get orders with pagination
    const orders = await prisma.order.findMany({
      where,
      include: {
        promoCode: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    });
    
    // Get total count for pagination
    const total = await prisma.order.count({ where });
    
    return NextResponse.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

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