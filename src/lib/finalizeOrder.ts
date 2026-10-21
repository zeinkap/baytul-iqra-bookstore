import Stripe from 'stripe';
import type { Order } from '@prisma/client';
import { prisma } from './prisma';
import { sendOrderConfirmationEmail } from './sendEmail';

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

  await prisma.order.updateMany({ where: { id: orderId, paidAt: null }, data: { paidAt: new Date() } });
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
