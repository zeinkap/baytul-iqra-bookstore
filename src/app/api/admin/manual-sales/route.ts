import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { priceItems } from '@/lib/pricing';
import { findStockProblems, stockProblemMessage } from '@/lib/stockManager';
import { normalizeLocation } from '@/lib/location';
import { getCurrentVenue } from '@/lib/venue';
import { MANUAL_PAYMENT_METHODS, MAX_MANUAL_DISCOUNT_PERCENT, applyManualDiscount, isManualMethod, type ManualPaymentMethod } from '@/lib/manualSales';

class SoldOutError extends Error {}

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

// POST /api/admin/manual-sales { items: [{ id, quantity }], method: "cash" | "zelle" | "venmo" | "cash_app" | "other", venue?: string, discountPercent?: number }
// Records a sale that didn't go through Stripe: a paid in-shop order at the in-person price (less the optional
// percentage discount, e.g. a cash discount), and takes the stock.
// The venue defaults to "where the books are today". No emails are sent.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!isManualMethod(body?.method)) {
    return NextResponse.json({ error: 'method must be cash, zelle, venmo, cash_app or other' }, { status: 400 });
  }
  const method: ManualPaymentMethod = body.method;

  const priced = await priceItems(body?.items, 'in-shop');
  if (!priced.ok) return NextResponse.json({ error: priced.error }, { status: priced.status });

  const discounted = applyManualDiscount(priced.subtotal, body?.discountPercent);
  if (!discounted) {
    return NextResponse.json({ error: `discountPercent must be a number from 0 to ${MAX_MANUAL_DISCOUNT_PERCENT}` }, { status: 400 });
  }

  const stockProblems = await findStockProblems(priced.items, priced.stockById);
  if (stockProblems.length > 0) {
    return NextResponse.json({ error: stockProblemMessage(stockProblems), stockProblems }, { status: 409 });
  }

  const venue = body.venue ? normalizeLocation(body.venue) : await getCurrentVenue();
  if (body.venue && !venue) {
    return NextResponse.json({ error: 'Use a short venue name with letters, numbers and dashes, e.g. bazaar-oct' }, { status: 400 });
  }

  // One transaction: record the order and take the stock. Each book is decremented only if enough is still
  // on the shelf, so two sales of the last copy can't both succeed, and a failure leaves no order behind.
  const wanted = new Map<string, number>();
  for (const item of priced.items) {
    if (item.id) wanted.set(item.id, (wanted.get(item.id) ?? 0) + item.quantity);
  }
  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          items: priced.items as unknown as import('@prisma/client').Prisma.InputJsonValue,
          total: priced.subtotal,
          discountAmount: discounted.discountAmount,
          finalTotal: discounted.finalTotal,
          fulfillmentType: 'pickup',
          pickupLocation: 'In shop',
          source: 'in-shop',
          location: venue,
          paidAt: new Date(),
          paymentMethod: method,
          paymentMethodDetail: MANUAL_PAYMENT_METHODS[method],
          stockUpdatedAt: new Date(), // stock is taken below; stops other paths from taking it again
        },
      });
      for (const [bookId, quantity] of wanted) {
        const taken = await tx.book.updateMany({ where: { id: bookId, stock: { gte: quantity } }, data: { stock: { decrement: quantity } } });
        if (taken.count !== 1) throw new SoldOutError();
      }
      return created;
    });
  } catch (e) {
    if (e instanceof SoldOutError) {
      const problems = await findStockProblems(priced.items);
      return NextResponse.json(
        { error: problems.length ? stockProblemMessage(problems) : 'Not enough stock for this sale', stockProblems: problems },
        { status: 409 }
      );
    }
    throw e;
  }
  revalidateTag('books', { expire: 0 });
  return NextResponse.json({ id: order.id, total: order.finalTotal, venue }, { status: 201 });
}
