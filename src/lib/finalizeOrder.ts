import Stripe from 'stripe';
import type { Order } from '@prisma/client';
import { prisma } from './prisma';
import { sendOrderConfirmationEmail, sendOrderNotificationToSales } from './sendEmail';
import { extractBookItems } from './stockManager';

/** How the customer paid, from Stripe: "apple_pay", "google_pay", "link", "card"... (null if it can't be read). */
export async function paymentMethodLabel(stripe: Stripe, session: Stripe.Checkout.Session): Promise<string | null> {
  try {
    const intentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
    if (!intentId) return null;
    const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ['payment_method'] });
    const method = intent.payment_method;
    if (!method || typeof method === 'string') return null;
    return method.type === 'card' ? (method.card?.wallet?.type ?? 'card') : method.type;
  } catch (error) {
    console.error('Could not read payment method:', error);
    return null;
  }
}

/**
 * Records what Stripe knows about a paid order that was created before payment: paid time, payment method,
 * name and the email Stripe collected. Safe to call from several places (the webhook, and the receipt page's
 * fallback when the webhook is slow or missing): each field is only filled if still empty, and the receipt
 * email goes out only for the one call that actually saved the email.
 */
export async function finalizePaidOrder(
  orderId: string,
  details: { email?: string | null; customerName?: string | null; paymentMethod?: string | null }
): Promise<Order | null> {
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) return null;

  // Only the call that flips the order from unpaid to paid sends the shop's sale alert, so it goes out once
  const justPaid = (await prisma.order.updateMany({ where: { id: orderId, paidAt: null }, data: { paidAt: new Date() } })).count === 1;
  if (details.paymentMethod) {
    await prisma.order.updateMany({ where: { id: orderId, paymentMethod: null }, data: { paymentMethod: details.paymentMethod } });
  }
  if (details.customerName) {
    await prisma.order.updateMany({ where: { id: orderId, customerName: null }, data: { customerName: details.customerName } });
  }
  let savedEmail = false;
  if (details.email) {
    savedEmail = (await prisma.order.updateMany({ where: { id: orderId, email: null }, data: { email: details.email } })).count === 1;
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (order && justPaid) await notifySalesOfPaidOrder(order);
  if (order && savedEmail && order.email) {
    try {
      await sendOrderConfirmationEmail({
        to: order.email,
        orderId: order.id,
        items: order.items as { title: string; quantity: number; price: number }[],
        total: order.finalTotal,
        fulfillmentType: order.fulfillmentType,
        source: order.source,
      });
    } catch (error) {
      console.error('Error sending order confirmation email:', error);
    }
  }
  return order;
}

/** Records a Stripe refund on the order. `refundedAmount` is the cumulative total refunded (dollars), so repeats are harmless. */
export async function recordRefund(orderId: string, refundedAmount: number): Promise<Order | null> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return null;
  return prisma.order.update({
    where: { id: orderId },
    data: { refundedAmount, refundedAt: order.refundedAt ?? new Date() },
  });
}

/** What the order is actually worth after refunds. */
export const netOrderTotal = (o: { finalTotal: number; refundedAmount: number | null }) => o.finalTotal - (o.refundedAmount ?? 0);

/** True when the whole order was refunded (reports should ignore it). */
export const isFullyRefunded = (o: { finalTotal: number; refundedAmount: number | null }) => netOrderTotal(o) <= 0.005;

/** Tells the shop about a paid order (venue, payment method, device, estimated profit). Never throws. */
export async function notifySalesOfPaidOrder(order: Order): Promise<void> {
  try {
    const items = extractBookItems(order.items);
    const ids = items.map((i) => i.id).filter((id): id is string => !!id);
    const books = ids.length ? await prisma.book.findMany({ where: { id: { in: ids } }, select: { id: true, costPrice: true } }) : [];
    const costById = new Map(books.map((b) => [b.id, b.costPrice]));
    const known = items.filter((i) => i.id && costById.get(i.id) != null);
    const estimatedProfit = known.length === items.length && items.length > 0
      ? order.finalTotal - items.reduce((sum, i) => sum + (costById.get(i.id as string) as number) * i.quantity, 0)
      : null;
    await sendOrderNotificationToSales({
      orderId: order.id,
      items: order.items as { title: string; quantity: number; price: number }[],
      total: order.finalTotal,
      fulfillmentType: order.fulfillmentType,
      customerEmail: order.email || 'Collected by Stripe (see the Stripe receipt)',
      source: order.source,
      venue: order.location,
      paymentMethod: order.paymentMethod,
      device: order.device,
      estimatedProfit,
      shippingAddress: (order.shippingAddress as Record<string, string> | null) ?? undefined,
    });
  } catch (error) {
    console.error('Error sending sales notification:', error);
  }
}
