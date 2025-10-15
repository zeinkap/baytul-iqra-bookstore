import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

// Extended Stripe session type to include shipping_details which may not be in all TypeScript definitions
interface StripeSessionWithShipping extends Stripe.Response<Stripe.Checkout.Session> {
  shipping_details?: {
    name?: string | null;
    address?: {
      line1?: string | null;
      line2?: string | null;
      city?: string | null;
      state?: string | null;
      postal_code?: string | null;
      country?: string | null;
    } | null;
  } | null;
  shipping?: {
    name?: string | null;
    address?: {
      line1?: string | null;
      line2?: string | null;
      city?: string | null;
      state?: string | null;
      postal_code?: string | null;
      country?: string | null;
    } | null;
  } | null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const fulfillmentType = searchParams.get('fulfillmentType') || '';
    
    const skip = (page - 1) * limit;
    
    // Build where clause
    const where: {
      OR?: Array<{ email?: { contains: string; mode: 'insensitive' }; id?: { contains: string; mode: 'insensitive' } }>;
      fulfillmentType?: string;
    } = {};
    
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { id: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (fulfillmentType) {
      where.fulfillmentType = fulfillmentType;
    }
    
    // Get orders with pagination
    const orders = await prisma.order.findMany({
      where,
      include: {
        promoCode: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    });
    
    // Get total count for pagination
    const total = await prisma.order.count({ where });
    
    return NextResponse.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { items, total, fulfillmentType, pickupLocation, shippingAddress, email, promoCodeId, discountAmount } = data;
    if (!items || !Array.isArray(items) || typeof total !== 'number' || !fulfillmentType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (fulfillmentType !== 'shipping' && fulfillmentType !== 'pickup') {
      return NextResponse.json({ error: 'Invalid fulfillment type' }, { status: 400 });
    }
    const finalTotal = total - (discountAmount || 0);
    
    const order = await prisma.order.create({
      data: {
        items,
        total,
        discountAmount: discountAmount || 0,
        finalTotal,
        promoCodeId: promoCodeId || null,
        fulfillmentType,
        pickupLocation: fulfillmentType === 'pickup' ? (pickupLocation || 'Alpharetta, GA') : null,
        shippingAddress: fulfillmentType === 'shipping' ? shippingAddress : null,
        email,
      },
    });
    return NextResponse.json({ id: order.id }, { status: 201 });
  } catch (error) {
    console.error('Failed to create order:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
} 

// Create order idempotently from a Stripe session id. Useful when webhook is delayed in development.
export async function PUT(req: NextRequest) {
  try {
    const { sessionId } = await req.json();
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }
    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session || session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Session not paid' }, { status: 400 });
    }
    const orderId = session.metadata?.orderId as string | undefined;
    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId in session metadata' }, { status: 400 });
    }
    // If already exists, return it
    const existing = await prisma.order.findUnique({ where: { id: orderId } });
    if (existing) return NextResponse.json(existing);

    // Build from line items similar to webhook
    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId);
    const productItems: { title: string; quantity: number; price: number }[] = [];
    let totalCents = 0;
      for (const li of lineItems.data) {
    const name = li.description || (li.price?.product as unknown as string);
    const qty = li.quantity || 1;
    const unit = li.price?.unit_amount ?? 0;
    const lineTotal = unit * qty;
    if (name?.toLowerCase() === 'shipping') {
      totalCents += lineTotal;
      continue;
    }
    productItems.push({ title: name || 'Item', quantity: qty, price: unit / 100 });
    totalCents += lineTotal;
  }
    const discountAmountCents = Number(session.metadata?.discountAmount || '0');
    const fulfillmentType = (session.metadata?.fulfillmentType as 'shipping' | 'pickup') || 'shipping';
    const pickupLocation = session.metadata?.pickupLocation || undefined;
    
    // Extract shipping address if fulfillment type is shipping
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
      // First try to get shipping address from session.shipping_details (preferred)
      // Note: shipping_details is available in newer Stripe API versions but may not be in all TypeScript definitions
      const sessionWithShipping = session as StripeSessionWithShipping;
      if (sessionWithShipping.shipping_details?.address) {
        shippingAddress = {
          name: sessionWithShipping.shipping_details.name ?? undefined,
          line1: sessionWithShipping.shipping_details.address.line1 ?? undefined,
          line2: sessionWithShipping.shipping_details.address.line2 ?? undefined,
          city: sessionWithShipping.shipping_details.address.city ?? undefined,
          state: sessionWithShipping.shipping_details.address.state ?? undefined,
          postal_code: sessionWithShipping.shipping_details.address.postal_code ?? undefined,
          country: sessionWithShipping.shipping_details.address.country ?? undefined,
        };
      }
      // Fallback to deprecated session.shipping
      else if (sessionWithShipping.shipping?.address) {
        const shipping = sessionWithShipping.shipping;
        const address = shipping.address;
        if (address) {
          shippingAddress = {
            name: shipping.name ?? undefined,
            line1: address.line1 ?? undefined,
            line2: address.line2 ?? undefined,
            city: address.city ?? undefined,
            state: address.state ?? undefined,
            postal_code: address.postal_code ?? undefined,
            country: address.country ?? undefined,
          };
        }
      }
      // Fallback to customer_details.address (billing address)
      else if (session.customer_details?.address) {
        shippingAddress = {
          name: session.customer_details.name ?? undefined,
          line1: session.customer_details.address.line1 ?? undefined,
          line2: session.customer_details.address.line2 ?? undefined,
          city: session.customer_details.address.city ?? undefined,
          state: session.customer_details.address.state ?? undefined,
          postal_code: session.customer_details.address.postal_code ?? undefined,
          country: session.customer_details.address.country ?? undefined,
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
        shippingAddress: shippingAddress || undefined,
        email: session.customer_details?.email || session.customer_email || undefined,
      },
    });
    return NextResponse.json(created);
  } catch (error) {
    console.error('Failed to create order from session:', error);
    return NextResponse.json({ error: 'Failed to create order from session' }, { status: 500 });
  }
}