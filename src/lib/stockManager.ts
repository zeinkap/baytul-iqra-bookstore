import { prisma } from './prisma';
import { revalidateTag } from 'next/cache';

export interface OrderItem {
  id?: string;
  title: string;
  quantity: number;
  price: number;
}

// Track orders that have already had stock updated to prevent duplicates
const stockUpdatedOrders = new Set<string>();

/**
 * Updates book stock after a successful order
 * @param items - Array of order items with book IDs and quantities
 * @param orderId - Order ID for logging purposes
 */
export async function updateBookStock(items: OrderItem[], orderId: string): Promise<void> {
  // Check if stock has already been updated for this order
  if (stockUpdatedOrders.has(orderId)) {
    console.log(`Stock already updated for order ${orderId}, skipping duplicate update`);
    return;
  }

  console.log(`Updating stock for order ${orderId}:`, items);

  try {
    // Process each item in the order
    for (const item of items) {
      // Skip items without book ID (shouldn't happen but safety check)
      if (!item.id) {
        console.warn(`Skipping item without ID in order ${orderId}:`, item.title);
        continue;
      }

      // Update stock using atomic decrement to prevent race conditions
      const updatedBook = await prisma.book.update({
        where: { id: item.id },
        data: {
          stock: {
            decrement: item.quantity
          }
        },
        select: {
          id: true,
          title: true,
          stock: true
        }
      });

      console.log(`Updated stock for book ${updatedBook.title} (${updatedBook.id}): -${item.quantity}, new stock: ${updatedBook.stock}`);

      // Check if stock went negative (shouldn't happen with proper validation)
      if (updatedBook.stock < 0) {
        console.error(`CRITICAL: Stock went negative for book ${updatedBook.title} (${updatedBook.id}). Current stock: ${updatedBook.stock}`);
        // Pre-payment stock checks can't stop two customers paying for the last copy at once, so tell staff
        try {
          // Lazy import: the email client needs RESEND_API_KEY, which order/checkout routes shouldn't require
          const { sendOversellAlert } = await import('./sendEmail');
          await sendOversellAlert({ bookTitle: updatedBook.title, stock: updatedBook.stock, orderId });
        } catch (alertError) {
          console.error('Failed to send oversell alert:', alertError);
        }
      }
    }

    // Mark this order as having stock updated
    stockUpdatedOrders.add(orderId);
    
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
