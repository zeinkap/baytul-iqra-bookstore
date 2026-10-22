import { prisma } from './prisma';
import { revalidateTag } from 'next/cache';

export interface OrderItem {
  id?: string;
  title: string;
  quantity: number;
  price: number;
}

// Orders this server instance has already taken stock for (a shortcut; Order.stockUpdatedAt is the real guard)
const stockUpdatedOrders = new Set<string>();

/**
 * Updates book stock after a successful order
 * @param items - Array of order items with book IDs and quantities
 * @param orderId - Order ID for logging purposes
 */
export async function updateBookStock(items: OrderItem[], orderId: string): Promise<void> {
  // Fast path for the same server instance; the database claim below is what actually prevents duplicates
  if (stockUpdatedOrders.has(orderId)) {
    console.log(`Stock already updated for order ${orderId}, skipping duplicate update`);
    return;
  }

  console.log(`Updating stock for order ${orderId}:`, items);

  try {
    // One transaction: claim the order (stockUpdatedAt is null -> now) and take the stock. Stripe re-delivers
    // events, and on serverless a retry can land on a different instance, so the claim lives in the database.
    // If anything fails the whole transaction rolls back, claim included, so a retry starts clean.
    const result = await prisma.$transaction(async (tx) => {
      const claim = await tx.order.updateMany({ where: { id: orderId, stockUpdatedAt: null }, data: { stockUpdatedAt: new Date() } });
      if (claim.count === 0) return null;

      const updated: { id: string; title: string; stock: number; quantity: number }[] = [];
      for (const item of items) {
        // Skip items without book ID (shouldn't happen but safety check)
        if (!item.id) {
          console.warn(`Skipping item without ID in order ${orderId}:`, item.title);
          continue;
        }
        // Atomic decrement to prevent race conditions between concurrent orders
        const book = await tx.book.update({
          where: { id: item.id },
          data: { stock: { decrement: item.quantity } },
          select: { id: true, title: true, stock: true },
        });
        updated.push({ ...book, quantity: item.quantity });
      }
      return updated;
    });

    stockUpdatedOrders.add(orderId);

    if (result === null) {
      console.log(`Stock already updated for order ${orderId} (or order not found), skipping duplicate update`);
      return;
    }

    for (const book of result) {
      console.log(`Updated stock for book ${book.title} (${book.id}): -${book.quantity}, new stock: ${book.stock}`);

      // Check if stock went negative (shouldn't happen with proper validation)
      if (book.stock < 0) {
        console.error(`CRITICAL: Stock went negative for book ${book.title} (${book.id}). Current stock: ${book.stock}`);
        // Pre-payment stock checks can't stop two customers paying for the last copy at once, so tell staff
        try {
          // Lazy import: the email client needs RESEND_API_KEY, which order/checkout routes shouldn't require
          const { sendOversellAlert } = await import('./sendEmail');
          await sendOversellAlert({ bookTitle: book.title, stock: book.stock, orderId });
        } catch (alertError) {
          console.error('Failed to send oversell alert:', alertError);
        }
      }
    }

    // Revalidate book caches to ensure frontend shows updated stock
    try {
      revalidateTag('books', { expire: 0 });
      console.log('Revalidated book caches after stock update');
    } catch (cacheError) {
      console.warn('Failed to revalidate book caches:', cacheError);
    }

    console.log(`Successfully updated stock for order ${orderId}`);
  } catch (error) {
    console.error(`Failed to update stock for order ${orderId}:`, error);
    throw new Error(`Stock update failed for order ${orderId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Checks if stock has already been updated for an order
 * @param orderId - Order ID to check
 * @returns true if stock has already been updated
 */
export function hasStockBeenUpdated(orderId: string): boolean {
  return stockUpdatedOrders.has(orderId);
}

/**
 * Extracts book IDs and quantities from order items
 * Handles different formats of order items (from cart, from Stripe, etc.)
 * @param items - Order items (can be from cart or Stripe line items)
 * @returns Array of items with book IDs and quantities
 */
export function extractBookItems(items: unknown): OrderItem[] {
  if (!Array.isArray(items)) {
    return [];
  }
  
  return items
    .filter((item): item is Record<string, unknown> => 
      typeof item === 'object' && item !== null && 'id' in item
    )
    .map(item => ({
      id: typeof item.id === 'string' ? item.id : undefined,
      title: typeof item.title === 'string' ? item.title : 
             typeof item.name === 'string' ? item.name : 'Unknown Item',
      quantity: typeof item.quantity === 'number' ? item.quantity : 1,
      price: typeof item.price === 'number' ? item.price : 0
    }));
}

/**
 * Extracts book IDs and quantities from Stripe metadata
 * @param metadata - Stripe session/payment intent metadata
 * @returns Array of items with book IDs and quantities
 */
export function extractBookItemsFromMetadata(metadata: Record<string, string>): OrderItem[] {
  const bookIds = metadata.bookIds?.split(',') || [];
  const quantities = metadata.quantities?.split(',') || [];
  
  if (bookIds.length !== quantities.length) {
    console.warn('Mismatch between book IDs and quantities in metadata');
    return [];
  }

  return bookIds
    .map((id, index) => ({
      id: id.trim(),
      title: `Book ${id}`, // We don't have title in metadata
      quantity: parseInt(quantities[index] || '1', 10),
      price: 0 // We don't have price in metadata
    }))
    .filter(item => item.id && item.quantity > 0);
}


export interface StockProblem {
  id: string;
  title: string;
  requested: number;
  available: number;
}

/**
 * Checks cart/order items against current stock. Returns the items that can't be fulfilled
 * (empty array means everything is available). Call before creating an order or Stripe session.
 */
export async function findStockProblems(
  items: unknown,
  knownStock?: Map<string, { title: string; stock: number }>
): Promise<StockProblem[]> {
  const requestedById = new Map<string, number>();
  for (const item of extractBookItems(items)) {
    if (!item.id) continue;
    requestedById.set(item.id, (requestedById.get(item.id) ?? 0) + item.quantity);
  }
  if (requestedById.size === 0) return [];

  // Callers that just loaded the books (priceItems) pass their stock so we don't query the same rows again
  const stockById =
    knownStock ??
    new Map(
      (
        await prisma.book.findMany({
          where: { id: { in: [...requestedById.keys()] } },
          select: { id: true, title: true, stock: true },
        })
      ).map((b) => [b.id, b])
    );

  const problems: StockProblem[] = [];
  for (const [id, requested] of requestedById) {
    const book = stockById.get(id);
    const available = Math.max(book?.stock ?? 0, 0);
    if (requested > available) {
      problems.push({ id, title: book?.title ?? 'This book', requested, available });
    }
  }
  return problems;
}

/** Customer-facing message for stock problems, e.g. 'Sorry, "X" just sold out.' */
export function stockProblemMessage(problems: StockProblem[]): string {
  return problems
    .map((p) =>
      p.available === 0
        ? `Sorry, "${p.title}" just sold out.`
        : `Only ${p.available} left of "${p.title}" (you asked for ${p.requested}).`
    )
    .join(' ');
}
