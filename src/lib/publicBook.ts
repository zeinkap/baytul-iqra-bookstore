/**
 * What the shop pays for a book (cost price, shipping cost) is only for the admin. Anything a visitor can fetch,
 * or that is sent to the browser inside a page, must go through this first.
 */
export function withoutPrivateFields<T extends object>(book: T): Omit<T, 'costPrice' | 'shippingCost'> {
  const copy = { ...book } as Record<string, unknown>;
  delete copy.costPrice;
  delete copy.shippingCost;
  return copy as Omit<T, 'costPrice' | 'shippingCost'>;
}
