import Stripe from 'stripe';
import type { Order } from '@prisma/client';
import { prisma } from './prisma';
import { sendOrderConfirmationEmail, sendOrderNotificationToSales, sendRefundEmail } from './sendEmail';
import { extractBookItems, updateBookStock } from './stockManager';

const CARD_BRANDS: Record<string, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', discover: 'Discover', diners: 'Diners Club', jcb: 'JCB', unionpay: 'UnionPay' };

/** How a Stripe payment method reads to a customer: "Visa ending 4242", or "Apple Pay (Visa ending 4242)". Null for non-card methods. */
export function describePaymentMethod(method: Stripe.PaymentMethod): string | null {
  const card = method.card;
  if (method.type !== 'card' || !card) return null;
  const brand = (card.brand && CARD_BRANDS[card.brand]) || 'card';
  const base = card.last4 ? `${brand} ending ${card.last4}` : brand;
  const wallet = card.wallet?.type === 'apple_pay' ? 'Apple Pay' : card.wallet?.type === 'google_pay' ? 'Google Pay' : null;
  return wallet ? `${wallet} (${base})` : base;
}

/** The method type ("apple_pay", "google_pay", "link", "card"...) plus the customer-facing detail, from a Stripe payment method. */
export function paymentMethodInfo(method: Stripe.PaymentMethod | null): { paymentMethod: string | null; paymentMethodDetail: string | null } {
  if (!method) return { paymentMethod: null, paymentMethodDetail: null };
  return {
    paymentMethod: method.type === 'card' ? (method.card?.wallet?.type ?? 'card') : method.type,
    paymentMethodDetail: describePaymentMethod(method),
  };
}

/** How the customer paid a Checkout Session, from Stripe (both fields null if it can't be read). */
export async function checkoutPaymentMethodInfo(stripe: Stripe, session: Stripe.Checkout.Session) {
  try {
    const sessionIntent = session.payment_intent;
    // A session retrieved with expand: ['payment_intent.payment_method'] already carries the method: no extra Stripe call
    let intent = sessionIntent && typeof sessionIntent !== 'string' ? sessionIntent : null;
    if (!intent || !intent.payment_method) {
      const intentId = typeof sessionIntent === 'string' ? sessionIntent : sessionIntent?.id;
      if (!intentId) return paymentMethodInfo(null);
      intent = await stripe.paymentIntents.retrieve(intentId, { expand: ['payment_method'] });
    }
    const method = intent.payment_method;
    return paymentMethodInfo(!method || typeof method === 'string' ? null : method);
  } catch (error) {
    console.error('Could not read payment method:', error);
    return paymentMethodInfo(null);
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
  details: { email?: string | null; customerName?: string | null; paymentMethod?: string | null; paymentMethodDetail?: string | null },
  // Pass `after` (next/server) to send the sale alert and receipt email once the response has gone out
  runLater?: (task: () => Promise<void>) => void
): Promise<Order | null> {
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) return null;

  // Only the call that flips the order from unpaid to paid sends the shop's sale alert, so it goes out once
  const justPaid = (await prisma.order.updateMany({ where: { id: orderId, paidAt: null }, data: { paidAt: new Date() } })).count === 1;
  if (details.paymentMethod) {
    await prisma.order.updateMany({ where: { id: orderId, paymentMethod: null }, data: { paymentMethod: details.paymentMethod } });
  }
  if (details.paymentMethodDetail) {
    await prisma.order.updateMany({ where: { id: orderId, paymentMethodDetail: null }, data: { paymentMethodDetail: details.paymentMethodDetail } });
  }
  if (details.customerName) {
    await prisma.order.updateMany({ where: { id: orderId, customerName: null }, data: { customerName: details.customerName } });
  }
  let savedEmail = false;
  if (details.email) {
    savedEmail = (await prisma.order.updateMany({ where: { id: orderId, email: null }, data: { email: details.email } })).count === 1;
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  const sendEmails = async () => {
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
          discount: order.discountAmount,
          paidAt: order.paidAt,
          paymentMethod: order.paymentMethod,
          paymentMethodDetail: order.paymentMethodDetail,
          shippingAddress: (order.shippingAddress as Record<string, string> | null) ?? undefined,
        });
      } catch (error) {
        console.error('Error sending order confirmation email:', error);
      }
    }
  };
  if (runLater) runLater(() => sendEmails().catch((error) => console.error('Error sending order emails:', error)));
  else await sendEmails();
  return order;
}

/** Marks the PaymentIntents the scan page creates for Apple Pay / Google Pay, so the webhook can tell them apart. */
export const IN_SHOP_WALLET_FLOW = 'in-shop-wallet';

export type FinalizeIntentResult =
  | { ok: true; order: Order }
  | { ok: false; status: number; error: string };

/**
 * Finishes an in-shop wallet payment once Stripe says the PaymentIntent succeeded: paid time, payment method,
 * name and email (from the wallet), the receipt email and the stock. Called by the webhook and by the receipt page's
 * fallback, so whichever runs first does the work and the other is a no-op. Never trusts the browser: everything
 * is read from Stripe.
 */
export async function finalizeInShopIntent(stripe: Stripe, intentId: string): Promise<FinalizeIntentResult> {
  const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ['payment_method'] });
  const orderId = intent.metadata?.orderId;
  if (intent.metadata?.flow !== IN_SHOP_WALLET_FLOW || !orderId) {
    return { ok: false, status: 400, error: 'Not an in-shop payment' };
  }
  if (intent.status !== 'succeeded') {
    return { ok: false, status: 400, error: 'Payment not completed' };
  }
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) return { ok: false, status: 404, error: 'Order not found' };
  if (intent.amount !== Math.round(existing.finalTotal * 100)) {
    // Prices are computed on the server, so this only happens if the order was edited after the payment started
    console.error(`In-shop payment ${intent.id} amount ${intent.amount} does not match order ${orderId} total ${existing.finalTotal}`);
  }

  const method = intent.payment_method && typeof intent.payment_method !== 'string' ? intent.payment_method : null;
  const { paymentMethod, paymentMethodDetail } = paymentMethodInfo(method);
  const order = await finalizePaidOrder(orderId, {
    email: method?.billing_details?.email || intent.metadata.email || null,
    customerName: method?.billing_details?.name || intent.metadata.name || null,
    paymentMethod,
    paymentMethodDetail,
  });
  if (!order) return { ok: false, status: 404, error: 'Order not found' };

  try {
    // Claims the stock in the database, so a second call (webhook retry, receipt-page fallback) does nothing
    await updateBookStock(extractBookItems(order.items), order.id);
  } catch (error) {
    console.error('Failed to update stock for in-shop wallet order:', order.id, error);
  }
  return { ok: true, order };
}

/**
 * Records a Stripe refund on the order and emails the customer about it. `refundedAmount` is the cumulative total
 * refunded (dollars). Only a call that raises the stored total sends the email, so Stripe's webhook retries
 * and repeats never send it twice.
 */
export async function recordRefund(orderId: string, refundedAmount: number, refundedTo?: string | null, refundReference?: { id?: string | null; bankReference?: string | null } | null): Promise<Order | null> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return null;
  const previous = order.refundedAmount ?? 0;
  const raised = (
    await prisma.order.updateMany({
      where: { id: orderId, OR: [{ refundedAmount: null }, { refundedAmount: { lt: refundedAmount } }] },
      data: { refundedAmount, refundedAt: order.refundedAt ?? new Date() },
    })
  ).count === 1;
  const updated = await prisma.order.findUnique({ where: { id: orderId } });
  if (updated && raised && updated.email) {
    try {
      await sendRefundEmail({
        to: updated.email,
        orderId: updated.id,
        refundAmount: refundedAmount - previous,
        totalRefunded: refundedAmount,
        orderTotal: updated.finalTotal,
        paymentMethod: updated.paymentMethod,
        refundedTo,
        paidAt: updated.paidAt,
        refundReference,
        items: extractBookItems(updated.items).map(({ title, quantity }) => ({ title, quantity })),
      });
    } catch (error) {
      console.error('Error sending refund email:', error);
    }
  }
  return updated;
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
