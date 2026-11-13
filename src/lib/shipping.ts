/** Flat standard shipping per order, and the order value from which it is free. Cents, to match Stripe. */
export const SHIPPING_FLAT_CENTS = 500;
export const FREE_SHIPPING_MIN_CENTS = 6000;

/** Shown on book pages, so it always matches what checkout charges. */
export const SHIPPING_PROMISE = 'Orders are dispatched within 1-2 days. Free standard shipping on orders over $60 (USA only)';

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

/** International shipping costs too much, so we only ship within the USA. Pickup and in-shop orders are unaffected. */
export const SHIPPING_COUNTRIES = ['US'] as const;
export const US_ONLY_SHIPPING_MESSAGE = 'Sorry, we only ship within the USA. Please choose local pickup or use a US shipping address.';

/** True when a shipping address is in the USA. A missing country counts as unsupported. */
export const isUsShippingCountry = (country: string | null | undefined) =>
  typeof country === 'string' && country.trim().toUpperCase() === 'US';

/** Server-side safeguard: Stripe should only ever collect US addresses. If a non-US one arrives, log loudly so it is noticed. */
export function flagNonUsShippingAddress(orderId: string | undefined, country: string | null | undefined, where: string) {
  if (!country || isUsShippingCountry(country)) return false;
  console.error(`[NON-US SHIPPING] Order ${orderId ?? '(unknown)'} has a shipping address in "${country}" (${where}). We only ship within the USA; review, cancel or refund this order.`);
  return true;
}
