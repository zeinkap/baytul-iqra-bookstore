import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { priceItems } from '@/lib/pricing';
import { findStockProblems, stockProblemMessage, updateBookStock } from '@/lib/stockManager';
import { normalizeLocation } from '@/lib/location';
import { getCurrentVenue } from '@/lib/venue';
import { MANUAL_PAYMENT_METHODS, isManualMethod, type ManualPaymentMethod } from '@/lib/manualSales';

// GET /api/admin/manual-sales - the most recent hand-recorded sales (cash, Zelle, ...), newest first
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const orders = await prisma.order.findMany({
    where: { paymentMethod: { in: Object.keys(MANUAL_PAYMENT_METHODS) } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, items: true, finalTotal: true, paymentMethod: true, location: true, paidAt: true, refundedAt: true },
  });
  return NextResponse.json({ sales: orders });
}

// POST /api/admin/manual-sales { items: [{ id, quantity }], method: "cash" | "zelle" | "other", venue?: string }
// Records a sale that didn't go through Stripe: a paid in-shop order at the in-person price, and takes the stock.
// The venue defaults to "where the books are today". No emails are sent.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!isManualMethod(body?.method)) {
    return NextResponse.json({ error: 'method must be cash, zelle or other' }, { status: 400 });
  }
  const method: ManualPaymentMethod = body.method;

  const priced = await priceItems(body?.items, 'in-shop');
  if (!priced.ok) return NextResponse.json({ error: priced.error }, { status: priced.status });

  const stockProblems = await findStockProblems(priced.items, priced.stockById);
  if (stockProblems.length > 0) {
    return NextResponse.json({ error: stockProblemMessage(stockProblems), stockProblems }, { status: 409 });
  }

  const venue = body.venue ? normalizeLocation(body.venue) : await getCurrentVenue();
  if (body.venue && !venue) {
    return NextResponse.json({ error: 'Use a short venue name with letters, numbers and dashes, e.g. bazaar-oct' }, { status: 400 });
  }

  const order = await prisma.order.create({
    data: {
      items: priced.items as unknown as import('@prisma/client').Prisma.InputJsonValue,
      total: priced.subtotal,
      discountAmount: 0,
      finalTotal: priced.subtotal,
      fulfillmentType: 'pickup',
      pickupLocation: 'In shop',
      source: 'in-shop',
      location: venue,
      paidAt: new Date(),
      paymentMethod: method,
      paymentMethodDetail: MANUAL_PAYMENT_METHODS[method],
    },
  });
  await updateBookStock(priced.items, order.id);
  revalidateTag('books', { expire: 0 });
  return NextResponse.json({ id: order.id, total: order.finalTotal, venue }, { status: 201 });
}
