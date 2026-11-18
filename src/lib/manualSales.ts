/**
 * Sales the shop records by hand because the customer didn't pay through Stripe (cash, Zelle, ...).
 * They are stored as ordinary paid in-shop orders with one of these payment methods, so reports, stock,
 * venues and event fees treat them like any other sale.
 */
export const MANUAL_PAYMENT_METHODS = {
  cash: 'Cash',
  zelle: 'Zelle',
  venmo: 'Venmo',
  // Not "cashapp": that is Stripe's own payment method type, and manual methods skip the Stripe fee and can be undone
  cash_app: 'Cash App',
  other: 'Other (not through Stripe)',
} as const;

export type ManualPaymentMethod = keyof typeof MANUAL_PAYMENT_METHODS;

export const isManualMethod = (value: unknown): value is ManualPaymentMethod =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(MANUAL_PAYMENT_METHODS, value);

/** The most a hand-recorded sale can be discounted: a typo like 50 instead of 5 is caught, not silently accepted. */
export const MAX_MANUAL_DISCOUNT_PERCENT = 50;

/** A percentage off a subtotal, in whole cents so the total never has fractions of a cent. Null if the percent isn't a number from 0 to the maximum. */
export function applyManualDiscount(subtotal: number, percent: unknown): { discountAmount: number; finalTotal: number } | null {
  const pct = percent === undefined || percent === null || percent === '' ? 0 : Number(percent);
  if (!Number.isFinite(pct) || pct < 0 || pct > MAX_MANUAL_DISCOUNT_PERCENT) return null;
  const subtotalCents = Math.round(subtotal * 100);
  const discountCents = Math.round((subtotalCents * pct) / 100);
  return { discountAmount: discountCents / 100, finalTotal: (subtotalCents - discountCents) / 100 };
}
