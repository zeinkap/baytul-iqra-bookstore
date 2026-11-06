/** Flat standard shipping per order, and the order value from which it is free. Cents, to match Stripe. */
export const SHIPPING_FLAT_CENTS = 500;
export const FREE_SHIPPING_MIN_CENTS = 6000;

/** Shown on book pages, so it always matches what checkout charges. */
export const SHIPPING_PROMISE = 'Ships in 1-2 days. Free standard shipping on orders over $60';

/**
 * Shipping for an order, in cents. `merchandiseCents` is the value of the books before any promo code, so a code
 * never takes an order back under the free-shipping line. Pickup is always free; shipping is free from $60.
 */
export function shippingCentsFor(merchandiseCents: number, fulfillmentType: 'shipping' | 'pickup' | string): number {
  if (fulfillmentType !== 'shipping') return 0;
  return merchandiseCents >= FREE_SHIPPING_MIN_CENTS ? 0 : SHIPPING_FLAT_CENTS;
}

/** How much more the customer needs to add for free shipping (0 once they have it), in cents. */
export const centsToFreeShipping = (merchandiseCents: number) => Math.max(0, FREE_SHIPPING_MIN_CENTS - merchandiseCents);
