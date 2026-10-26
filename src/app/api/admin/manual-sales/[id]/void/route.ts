import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { extractBookItems } from '@/lib/stockManager';
import { isManualMethod } from '@/lib/manualSales';

// POST /api/admin/manual-sales/[id]/void - undo a hand-recorded sale entered by mistake: marks it fully
// refunded (so reports ignore it) and puts the books back in stock. Only works once, and only on manual sales.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
  if (!isManualMethod(order.paymentMethod)) {
    return NextResponse.json({ error: 'Only sales recorded by hand can be undone here' }, { status: 409 });
  }

  // Claim first so a double tap can't put the books back twice
  const claimed = await prisma.order.updateMany({
    where: { id, refundedAt: null },
    data: { refundedAt: new Date(), refundedAmount: order.finalTotal, restockedAt: new Date() },
  });
  if (claimed.count !== 1) return NextResponse.json({ error: 'This sale was already undone' }, { status: 409 });

  const items = extractBookItems(order.items).filter((i) => i.id);
  await prisma.$transaction(items.map((i) => prisma.book.update({ where: { id: i.id as string }, data: { stock: { increment: i.quantity } } })));
  revalidateTag('books', { expire: 0 });
  return NextResponse.json({ restocked: items.reduce((n, i) => n + i.quantity, 0) });
}
