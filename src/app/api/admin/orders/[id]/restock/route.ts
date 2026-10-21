import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { extractBookItems } from '@/lib/stockManager';
import { isFullyRefunded } from '@/lib/finalizeOrder';

// POST /api/admin/orders/[id]/restock - puts the books of a fully refunded order back in stock.
// A refund doesn't always mean the book came back, so this is an explicit admin action, and it only works once.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (!order.refundedAt || !isFullyRefunded(order)) {
    return NextResponse.json({ error: 'Only fully refunded orders can be restocked' }, { status: 409 });
  }

  // Claim the restock first so a double click can't add the books twice
  const claimed = await prisma.order.updateMany({ where: { id, restockedAt: null }, data: { restockedAt: new Date() } });
  if (claimed.count !== 1) {
    return NextResponse.json({ error: 'This order was already restocked' }, { status: 409 });
  }

  const items = extractBookItems(order.items).filter((i) => i.id);
  await prisma.$transaction(
    items.map((i) => prisma.book.update({ where: { id: i.id as string }, data: { stock: { increment: i.quantity } } }))
  );
  revalidateTag('books', { expire: 0 });
  return NextResponse.json({ restocked: items.reduce((n, i) => n + i.quantity, 0) });
}
