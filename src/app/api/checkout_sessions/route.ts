import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

type CartItem = {
  title: string;
  image?: string;
  price: number;
  quantity: number;
};

export async function POST(req: NextRequest) {
  try {
    const { items, fulfillmentType, orderId, email } = await req.json();
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    let line_items = items.map((item: CartItem) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.title,
          images: item.image
            ? [item.image.startsWith('http') ? item.image : `${baseUrl}${item.image}`]
            : undefined,
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    // Add shipping fee if needed
    if (fulfillmentType === 'shipping') {
      line_items = [
        ...line_items,
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Shipping', images: undefined },
            unit_amount: 500,
          },
          quantity: 1,
        },
      ];
    } else if (fulfillmentType === 'pickup') {
      line_items = [
        ...line_items,
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Free Local Pickup', images: undefined },
            unit_amount: 0,
          },
          quantity: 1,
        },
      ];
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `${req.nextUrl.origin}/checkout/success?orderId=${orderId}`,
      cancel_url: `${req.nextUrl.origin}/cart`,
      shipping_address_collection: { allowed_countries: ['US', 'CA'] },
      customer_email: email,
      metadata: { orderId },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
} 