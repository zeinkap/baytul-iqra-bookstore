import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session || session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Session not paid' }, { status: 400 });
    }
    const orderId = session.metadata?.orderId as string | undefined;
    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId in session metadata' }, { status: 400 });
    }
    const existing = await prisma.order.findUnique({ where: { id: orderId } });
    if (existing) return NextResponse.json(existing);

    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId);
    const productItems: { title: string; quantity: number; price: number }[] = [];
    let totalCents = 0;
    for (const li of lineItems.data) {
      const name = li.description || (li.price?.product as unknown as string);
      const qty = li.quantity || 1;
      const unit = li.price?.unit_amount ?? 0;
      const lineTotal = unit * qty;
      if (name?.toLowerCase() === 'shipping' || name?.toLowerCase() === 'free local pickup') {
        totalCents += lineTotal;
        continue;
      }
      productItems.push({ title: name || 'Item', quantity: qty, price: unit / 100 });
      totalCents += lineTotal;
    }
    const discountAmountCents = Number(session.metadata?.discountAmount || '0');
    const fulfillmentType = (session.metadata?.fulfillmentType as 'shipping' | 'pickup') || 'shipping';
    const pickupLocation = session.metadata?.pickupLocation || undefined;
    try {
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
          const ship = (pi as any)?.shipping as { name?: string; address?: { line1?: string; line2?: string; city?: string; state?: string; postal_code?: string; country?: string } } | undefined;
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
        // ignore
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

    const created = await prisma.order.create({
        data: {
          id: orderId,
          items: productItems,
          total: productItems.reduce((s, it) => s + it.price * it.quantity, 0),
          discountAmount: (discountAmountCents || 0) / 100,
          finalTotal: (totalCents || 0) / 100,
          promoCodeId: session.metadata?.promoCodeId || null,
          fulfillmentType,
          pickupLocation: fulfillmentType === 'pickup' ? (pickupLocation || 'Alpharetta, GA') : null,
        ...(shippingAddress ? { shippingAddress } : {}),
        email: session.customer_details?.email || session.customer_email || undefined,
        customerName: shippingAddress?.name || session.customer_details?.name || undefined,
        },
      });
      return NextResponse.json(created);
    } catch (err: unknown) {
      // If already created by webhook, return existing idempotently
      if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'P2002') {
        const existing = await prisma.order.findUnique({ where: { id: orderId } });
        if (existing) return NextResponse.json(existing);
      }
      throw err;
    }
  } catch (error) {
    console.error('Failed to create order from session:', error);
    return NextResponse.json({ error: 'Failed to create order from session' }, { status: 500 });
  }
}


