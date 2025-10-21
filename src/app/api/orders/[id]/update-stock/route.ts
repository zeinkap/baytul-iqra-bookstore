import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateBookStock, extractBookItems, hasStockBeenUpdated } from '@/lib/stockManager';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;

    // Check if stock has already been updated for this order
    if (hasStockBeenUpdated(orderId)) {
      console.log(`Stock already updated for order ${orderId}, skipping backup update`);
      return NextResponse.json({ 
        message: 'Stock already updated for this order',
        stockUpdated: true,
        skipped: true
      });
    }

    // Get the order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        items: true,
        createdAt: true
      }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Check if this order is recent (within last 24 hours) to prevent abuse
    const orderAge = Date.now() - order.createdAt.getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    if (orderAge > maxAge) {
      return NextResponse.json({ 
        error: 'Order is too old for stock updates' 
      }, { status: 400 });
    }

    // Extract book items from order
    const bookItems = extractBookItems(order.items);

    if (bookItems.length === 0) {
      return NextResponse.json({ 
        message: 'No book items found in order',
        stockUpdated: false 
      });
    }

    // Update stock
    await updateBookStock(bookItems, orderId);

    console.log(`Stock updated for order ${orderId} via success page backup`);

    return NextResponse.json({ 
      message: 'Stock updated successfully',
      stockUpdated: true,
      itemsUpdated: bookItems.length
    });

  } catch (error) {
    console.error('Failed to update stock for order:', error);
    return NextResponse.json({ 
      error: 'Failed to update stock',
      stockUpdated: false 
    }, { status: 500 });
  }
}
