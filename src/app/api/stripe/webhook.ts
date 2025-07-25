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
    const orderId = session.metadata?.orderId;
    const promoCodeId = session.metadata?.promoCodeId;
    
    if (orderId) {
      // Fetch order from DB
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      
      // Update promo code usage if used
      if (promoCodeId && order?.promoCodeId) {
        try {
          await prisma.promoCode.update({
            where: { id: promoCodeId },
            data: { currentUses: { increment: 1 } }
          });
          console.log(`Updated usage for promo code: ${promoCodeId}`);
        } catch (error) {
          console.error('Error updating promo code usage:', error);
        }
      }
      if (order && order.email) {
        let items: { title: string; quantity: number; price: number }[] = [];
        if (Array.isArray(order.items)) {
          items = order.items.filter(isCartItem).map((item) => ({
            title: item.title,
            quantity: item.quantity,
            price: item.price,
          }));
        }
        let shippingAddress: {
          name?: string;
          line1?: string;
          line2?: string;
          city?: string;
          state?: string;
          postal_code?: string;
          country?: string;
        } | undefined = undefined;
        if (order.shippingAddress && typeof order.shippingAddress === 'object' && !Array.isArray(order.shippingAddress)) {
          shippingAddress = order.shippingAddress as {
            name?: string;
            line1?: string;
            line2?: string;
            city?: string;
            state?: string;
            postal_code?: string;
            country?: string;
          };
        }
        await sendOrderConfirmationEmail({
          to: order.email,
          orderId: order.id,
          items,
          total: order.total,
          fulfillmentType: order.fulfillmentType,
          shippingAddress,
        });
      }
    }
  }
  return NextResponse.json({ received: true });
}

// Type guard for cart item
function isCartItem(item: unknown): item is { title: string; quantity: number; price: number } {
  return (
    typeof item === 'object' && item !== null &&
    'title' in item && typeof (item as { title: unknown }).title === 'string' &&
    'quantity' in item && typeof (item as { quantity: unknown }).quantity === 'number' &&
    'price' in item && typeof (item as { price: unknown }).price === 'number'
  );
} 