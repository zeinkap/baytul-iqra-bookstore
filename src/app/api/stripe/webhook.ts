import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { sendOrderConfirmationEmail } from '@/lib/sendEmail';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;
  try {
    const body = await req.text();
    if (!sig || !webhookSecret) {
      return NextResponse.json({ error: 'Missing Stripe signature or webhook secret' }, { status: 400 });
    }
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: `Webhook Error: ${(err as Error).message}` }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId as string | undefined;
    const promoCodeId = session.metadata?.promoCodeId as string | undefined;
    const fulfillmentType = session.metadata?.fulfillmentType as 'shipping' | 'pickup' | undefined;
    const discountAmountCents = session.metadata?.discountAmount ? Number(session.metadata.discountAmount) : 0;
    const pickupLocation = session.metadata?.pickupLocation || undefined;

    // Build order items from line_items
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
    const productItems: { title: string; quantity: number; price: number }[] = [];
    let totalCents = 0;
    for (const li of lineItems.data) {
      const name = li.description || li.price?.product as unknown as string;
      const qty = li.quantity || 1;
      const unit = (li.price?.unit_amount ?? 0);
      const lineTotal = unit * qty;
      // Exclude shipping line by its name we set
      if (name?.toLowerCase() === 'shipping' || name?.toLowerCase() === 'free local pickup') {
        totalCents += lineTotal; // still count for finalTotal
        continue;
      }
      productItems.push({ title: name || 'Item', quantity: qty, price: (unit / 100) });
      totalCents += lineTotal;
    }

    // Map shipping address: fetch from PaymentIntent.shipping if available; fall back to customer_details.address
    const customerDetails = session.customer_details;
    let shippingAddress: {
      name?: string;
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    } | undefined = undefined;
    if (fulfillmentType === 'shipping') {
      try {
        const paymentIntentId = typeof session.payment_intent === 'string'
          ? session.payment_intent
          : (session.payment_intent && 'id' in session.payment_intent ? (session.payment_intent as { id: string }).id : undefined);
        if (paymentIntentId) {
          const pi = await stripe.paymentIntents.retrieve(paymentIntentId as string);
          const ship = (pi as Stripe.PaymentIntent).shipping;
          if (ship?.address) {
            shippingAddress = {
              name: ship.name ?? undefined,
              line1: ship.address.line1 ?? undefined,
              line2: ship.address.line2 ?? undefined,
              city: ship.address.city ?? undefined,
              state: ship.address.state ?? undefined,
              postal_code: ship.address.postal_code ?? undefined,
              country: ship.address.country ?? undefined,
            };
          }
        }
      } catch {
        // ignore and fall back to billing
      }
      if (!shippingAddress && customerDetails?.address) {
        const billingAddr = customerDetails.address;
        shippingAddress = {
          name: customerDetails?.name ?? undefined,
          line1: billingAddr.line1 ?? undefined,
          line2: billingAddr.line2 ?? undefined,
          city: billingAddr.city ?? undefined,
          state: billingAddr.state ?? undefined,
          postal_code: billingAddr.postal_code ?? undefined,
          country: billingAddr.country ?? undefined,
        };
      }
    }

    // Create order after successful payment
    const created = await prisma.order.create({
      data: {
        id: orderId, // use pre-generated id if present
        items: productItems,
        total: productItems.reduce((s, it) => s + (it.price * it.quantity), 0),
        discountAmount: (discountAmountCents || 0) / 100,
        finalTotal: (totalCents || 0) / 100,
        promoCodeId: promoCodeId || null,
        fulfillmentType: fulfillmentType || 'shipping',
        pickupLocation: fulfillmentType === 'pickup' ? (pickupLocation || 'Alpharetta, GA') : null,
        ...(shippingAddress ? { shippingAddress } : {}),
        email: session.customer_details?.email || session.customer_email || undefined,
        customerName: shippingAddress?.name || session.customer_details?.name || undefined,
      },
    });

    // Update promo code usage if applicable
    if (promoCodeId) {
      try {
        await prisma.promoCode.update({
          where: { id: promoCodeId },
          data: { currentUses: { increment: 1 } }
        });
      } catch (error) {
        console.error('Error updating promo code usage:', error);
      }
    }

    if (created.email) {
      await sendOrderConfirmationEmail({
        to: created.email,
        orderId: created.id,
        items: productItems,
        total: created.total,
        fulfillmentType: created.fulfillmentType,
        shippingAddress: undefined,
      });
    }
  }
  return NextResponse.json({ received: true });
}