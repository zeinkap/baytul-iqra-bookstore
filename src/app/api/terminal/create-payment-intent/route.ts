import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Create a PaymentIntent for Stripe Terminal Tap to Pay (in-person, card on your phone).
 * Used by a mobile app that uses the Terminal SDK to collect payment.
 *
 * POST body: { orderId: string }
 * Returns: { clientSecret: string, paymentIntentId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();
    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { promoCode: true },
    });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const amountCents = Math.round(order.finalTotal * 100);
    if (amountCents < 50) {
      return NextResponse.json(
        { error: 'Order total is below Stripe minimum (e.g. $0.50)' },
        { status: 400 }
      );
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      capture_method: 'automatic',
      payment_method_types: ['card_present'],
      metadata: {
        orderId: order.id,
        fulfillmentType: order.fulfillmentType || 'pickup',
        pickupLocation: order.pickupLocation || '',
        discountAmount: String((order.discountAmount || 0) * 100),
        promoCodeId: order.promoCodeId || '',
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error('Terminal create-payment-intent error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}
