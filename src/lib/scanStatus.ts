/** Statuses that count as a QR scan (a phone opened a label). */
export const SCAN_STATUSES = ['ok', 'sold-out', 'not-found'];
/** Failure events logged against a scan: the customer tried to buy and something broke. */
export const FAILURE_EVENTS = ['buy-failed', 'page-error'] as const;
export type FailureEvent = (typeof FAILURE_EVENTS)[number];

/** Short, safe reasons recorded for buy-failed events (anything else is stored as "other"). */
export const BUY_FAILURE_REASONS = ['sold-out-race', 'order-failed', 'checkout-failed', 'network'] as const;
