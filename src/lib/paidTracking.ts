/**
 * Orders are created before the customer pays, so one that was never paid has no name or email. paidAt only exists
 * from this date, so older orders (paid, but without it) are not called unpaid.
 */
export const PAID_TRACKING_SINCE = new Date('2026-10-15T00:00:00Z');
