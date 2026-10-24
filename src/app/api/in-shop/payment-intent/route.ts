import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { priceItems } from '@/lib/pricing';
import { findStockProblems, stockProblemMessage } from '@/lib/stockManager';
import { normalizeLocation } from '@/lib/location';
import { deviceFromUserAgent } from '@/lib/device';
import { getOrCreateInShopOrder } from '@/lib/inShopOrders';
import { IN_SHOP_WALLET_FLOW } from '@/lib/finalizeOrder';
import { isRateLimited } from '@/lib/chat/rateLimit';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const cap = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/**
 * Called by the scan page / basket right when the customer confirms Apple Pay or Google Pay: creates (or reuses)
 * the unpaid in-shop order and a PaymentIntent for it. Prices come from the database; the browser only supplies
 * book ids and quantities, plus the email and name the wallet shared.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (isRateLimited(`in-shop-pi:${ip}`, 20, 60_000)) {
      return NextResponse.json({ error: 'Too many attempts. Please wait a moment and try again.' }, { status: 429 });
    }

    const { items: rawItems, location, email, name } = await req.json();
    const priced = await priceItems(rawItems);
    if (!priced.ok) {
      return NextResponse.json({ error: priced.error }, { status: priced.status });
    }
    const { items, subtotal: total } = priced;

    const stockProblems = await findStockProblems(items, priced.stockById);
    if (stockProblems.length > 0) {
      return NextResponse.json({ error: stockProblemMessage(stockProblems), stockProblems }, { status: 409 });
    }

    const venue = normalizeLocation(location);
    const device = deviceFromUserAgent(req.headers.get('user-agent'));
    const orderId = await getOrCreateInShopOrder({ items, total, venue, device });

    const intent = await stripe.paymentIntents.create({
      amount: items.reduce((sum, i) => sum + Math.round(i.price * 100) * i.quantity, 0),
      currency: 'usd',
      // Wallets (Apple Pay, Google Pay, Link) come through Stripe's automatic payment methods
      automatic_payment_methods: { enabled: true },
      description: `Baytul Iqra in-shop order ${orderId.slice(-8).toUpperCase()}`,
      metadata: {
        flow: IN_SHOP_WALLET_FLOW,
        orderId,
        source: 'in-shop',
        location: venue || '',
        // Kept here (not on receipt_email) so Stripe doesn't send its own receipt; the shop's receipt email does
        email: cap(email, 200),
        name: cap(name, 100),
        itemCount: String(items.length),
        totalItems: String(items.reduce((sum, i) => sum + i.quantity, 0)),
      },
    });

    return NextResponse.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id, orderId });
  } catch (err) {
    console.error('Error creating in-shop payment intent:', err);
    return NextResponse.json({ error: 'Could not start the payment. Please try again.' }, { status: 500 });
  }
}
