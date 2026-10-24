import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { finalizeInShopIntent } from '@/lib/finalizeOrder';
import { toPublicOrder } from '@/lib/publicOrder';

/**
 * Receipt-page fallback for wallet payments made on the scan page: finishes the order straight from the
 * PaymentIntent in case Stripe's webhook is slow. Same work as the webhook, safe to repeat. 400 = not paid (yet).
 */
export async function POST(req: NextRequest) {
  try {
    const { paymentIntentId } = await req.json();
    if (typeof paymentIntentId !== 'string' || !paymentIntentId.startsWith('pi_')) {
      return NextResponse.json({ error: 'Missing paymentIntentId' }, { status: 400 });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const result = await finalizeInShopIntent(stripe, paymentIntentId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(toPublicOrder(result.order));
  } catch (error) {
    console.error('Failed to confirm in-shop payment:', error);
    return NextResponse.json({ error: 'Failed to confirm payment' }, { status: 500 });
  }
}
