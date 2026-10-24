import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { priceItems } from '@/lib/pricing';
import { findStockProblems, stockProblemMessage } from '@/lib/stockManager';
import { normalizeLocation } from '@/lib/location';
import { deviceFromUserAgent } from '@/lib/device';
import { getOrCreateInShopOrder, safeInShopCancelPath } from '@/lib/inShopOrders';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * One-step "Buy now" for QR scans: creates (or reuses) the unpaid in-shop order and the Stripe Checkout
 * session in a single request, so the phone makes one round trip instead of two.
 * Prices come from the database; the browser only supplies book ids and quantities.
 */
export async function POST(req: NextRequest) {
  try {
    const { items: rawItems, location, cancelPath } = await req.json();
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

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin || 'http://localhost:3000';
    const params = {
      mode: 'payment',
      line_items: items.map((item) => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.title,
            images: item.image ? [item.image.startsWith('http') ? item.image : `${baseUrl}${item.image}`] : undefined,
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      })),
      success_url: `${req.nextUrl.origin}/receipt?orderId=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.nextUrl.origin}${safeInShopCancelPath(cancelPath)}`,
      // A stale link can't be paid after the book has moved on
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      // Keep checkout to email + payment (wallet-friendly): no billing address or phone
      billing_address_collection: 'auto',
      phone_number_collection: { enabled: false },
      metadata: {
        orderId,
        promoCodeId: '',
        fulfillmentType: 'pickup',
        discountAmount: '0',
        pickupLocation: 'In shop',
        source: 'in-shop',
        location: venue || '',
        customerPhone: '',
        cartItems: JSON.stringify(
          items.map((i) => ({ title: i.title.length > 50 ? i.title.substring(0, 47) + '...' : i.title, price: i.price, quantity: i.quantity }))
        ),
        itemCount: String(items.length),
        totalItems: String(items.reduce((sum, i) => sum + i.quantity, 0)),
      },
    } satisfies Omit<Stripe.Checkout.SessionCreateParams, 'payment_method_types'>;

    // Card covers Apple Pay and Google Pay. Link fills in email and card in one tap for returning customers. No slow
    // methods (bank debits): the buyer needs an instant "Paid" to walk out. If Link isn't enabled on the Stripe
    // account, fall back to card only rather than failing the sale.
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create({ ...params, payment_method_types: ['card', 'link'] });
    } catch (linkError) {
      if (!(linkError instanceof Stripe.errors.StripeInvalidRequestError)) throw linkError;
      console.warn('Checkout with Link failed, retrying with card only:', linkError.message);
      session = await stripe.checkout.sessions.create({ ...params, payment_method_types: ['card'] });
    }

    return NextResponse.json({ url: session.url, orderId });
  } catch (err) {
    console.error('Error in in-shop buy:', err);
    return NextResponse.json({ error: 'Failed to start checkout' }, { status: 500 });
  }
}
