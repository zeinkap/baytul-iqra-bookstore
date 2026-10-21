import type { Order } from '@prisma/client';

/** a***@gmail.com: enough to recognise your own address without exposing it to anyone holding the receipt link. */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [name, domain] = email.split('@');
  return domain ? `${name.slice(0, 1)}***@${domain}` : null;
}

/** "Pat Buyer" -> "Pat B." */
function shortName(name: string | null | undefined): string | null {
  if (!name) return null;
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.length ? `${rest[rest.length - 1].charAt(0)}.` : '';
  return [first, last].filter(Boolean).join(' ');
}

/**
 * What an order link shows to the browser. The order id in the URL is the only credential, and URLs end up in
 * browser history, screenshots and chats, so personal data is trimmed: masked email, abbreviated name, and a
 * shipping address without the street, name or zip code. The full order stays available to the admin.
 */
export function toPublicOrder(order: Order) {
  const address = order.shippingAddress as { city?: string; state?: string; country?: string } | null;
  return {
    id: order.id,
    items: order.items,
    total: order.total,
    finalTotal: order.finalTotal,
    discountAmount: order.discountAmount,
    fulfillmentType: order.fulfillmentType,
    pickupLocation: order.pickupLocation,
    source: order.source,
    paidAt: order.paidAt,
    createdAt: order.createdAt,
    refundedAmount: order.refundedAmount,
    refundedAt: order.refundedAt,
    email: maskEmail(order.email),
    customerName: shortName(order.customerName),
    shippingAddress: address ? { city: address.city, state: address.state, country: address.country } : null,
  };
}
