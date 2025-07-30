import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
// @ts-expect-error - context.params is not typed
export async function GET(request, context) {
  const { id } = await context.params;
  try {
    const order = await prisma.order.findUnique({
      where: { id },
    });
    if (!order) {

      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    return NextResponse.json(order);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
} 