/**
 * Sales the shop records by hand because the customer didn't pay through Stripe (cash, Zelle, ...).
 * They are stored as ordinary paid in-shop orders with one of these payment methods, so reports, stock,
 * venues and event fees treat them like any other sale.
 */
export const MANUAL_PAYMENT_METHODS = {
  cash: 'Cash',
  zelle: 'Zelle',
  other: 'Other (not through Stripe)',
} as const;

export type ManualPaymentMethod = keyof typeof MANUAL_PAYMENT_METHODS;

export const isManualMethod = (value: unknown): value is ManualPaymentMethod =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(MANUAL_PAYMENT_METHODS, value);
