/** Pure pricing rules for the price research scripts (no database or network, so they are easy to test). */

export interface PriceRules {
  /** Smallest acceptable profit as a share of the selling price, e.g. 0.15 = 15% */
  minMargin: number;
  /** How much cheaper the in-person price is than the online price, e.g. 0.1 = 10% */
  inPersonDiscount: number;
  /**
   * Sales tax rate, e.g. 0.08 = 8%. The shop's prices include tax while competitor prices don't, so the
   * market price is raised by this rate and the margin is measured on the price before tax.
   */
  taxRate: number;
}

export const DEFAULT_RULES: PriceRules = { minMargin: 0.15, inPersonDiscount: 0.1, taxRate: 0.08 };

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * Lowest tax-included price that still earns `minMargin` on the price before tax: online sales carry shipping,
 * in-person sales don't. Null when the book has no cost price (nothing to protect).
 */
export function priceFloor(
  costPrice: number | null | undefined,
  shippingCost: number | null | undefined,
  channel: 'online' | 'in-shop',
  minMargin: number,
  taxRate = 0
): number | null {
  if (costPrice == null || costPrice <= 0) return null;
  const cost = channel === 'online' ? costPrice + (shippingCost ?? 0) : costPrice;
  // Round UP to the cent so the margin is never a hair under the minimum
  return Math.ceil(Math.round(((cost / (1 - minMargin)) * (1 + taxRate)) * 1e6) / 1e4) / 100;
}

/** In-person prices are whole dollars. */
export const isWholeDollar = (n: number) => Number.isInteger(n) && n >= 0;

export interface Suggested {
  online: number;
  inPerson: number;
  notes: string[];
}

/**
 * Turns the market price the model found (before tax) into the two prices we suggest:
 * - online = the market price plus sales tax (the shop's prices include tax, so this matches what a customer pays
 *   at a competitor after tax), raised to the margin floor if needed;
 * - in-person = online less the in-person discount, rounded DOWN to a whole dollar (so it stays cheaper),
 *   but never below its own margin floor (rounded up to a whole dollar) and never above the online price.
 */
export function suggestPrices(
  market: number,
  book: { costPrice?: number | null; shippingCost?: number | null },
  rules: PriceRules = DEFAULT_RULES
): Suggested {
  const notes: string[] = [];

  let online = cents(market * (1 + rules.taxRate));
  const onlineFloor = priceFloor(book.costPrice, book.shippingCost, 'online', rules.minMargin, rules.taxRate);
  if (onlineFloor != null && online < onlineFloor) {
    online = Math.ceil(onlineFloor * 100) / 100;
    notes.push(`online raised to $${online.toFixed(2)} to keep a ${Math.round(rules.minMargin * 100)}% margin after tax, cost and shipping`);
  }

  let inPerson = Math.floor(online * (1 - rules.inPersonDiscount));
  const inPersonFloor = priceFloor(book.costPrice, book.shippingCost, 'in-shop', rules.minMargin, rules.taxRate);
  if (inPersonFloor != null && inPerson < inPersonFloor) {
    inPerson = Math.ceil(inPersonFloor);
    notes.push(`in-person raised to $${inPerson} to keep a ${Math.round(rules.minMargin * 100)}% margin after tax and cost`);
  }
  if (inPerson > online) {
    inPerson = Math.floor(online);
  }
  if (inPerson >= online) {
    notes.push('in-person is not cheaper than online (price too low to round down)');
  }
  return { online, inPerson, notes };
}

export function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Local calendar date, e.g. 2026-10-26 (used for the runDate column and the default file name). */
export function today(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
