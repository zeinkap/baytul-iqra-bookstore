import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { sendOrderConfirmationEmail, sendOrderNotificationToSales } from '@/lib/sendEmail';

// Test endpoint to verify webhook connectivity
export async function GET() {
  try {
    return NextResponse.json({ 
      status: 'Webhook endpoint is active',
      timestamp: new Date().toISOString(),
      hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
      hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('Error in GET webhook endpoint:', error);
    return NextResponse.json({ 
      error: 'Webhook endpoint error',
      message: (error as Error).message 
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const sig = req.headers.get('stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;
    
    console.log('Webhook received:', { 
      hasSignature: !!sig, 
      hasSecret: !!webhookSecret,
      contentType: req.headers.get('content-type'),
      timestamp: new Date().toISOString()
    });
    
    try {
      const body = await req.text();
      if (!sig || !webhookSecret) {
        console.error('Missing Stripe signature or webhook secret');
        return NextResponse.json({ error: 'Missing Stripe signature or webhook secret' }, { status: 400 });
      }
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
      console.log('Webhook event type:', event.type, 'Event ID:', event.id);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: `Webhook Error: ${(err as Error).message}` }, { status: 400 });
    }

    try {
      // Handle both checkout.session.completed (regular checkout) and payment_intent.succeeded (payment links)
      if (event.type === 'checkout.session.completed') {
        console.log('Processing checkout.session.completed event');
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
      } else if (event.type === 'payment_intent.succeeded') {
        console.log('Processing payment_intent.succeeded event');
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
      } else {
        console.log('Unhandled event type:', event.type);
      }
    } catch (error) {
      console.error('Error processing webhook event:', error);
      return NextResponse.json({ error: 'Error processing webhook' }, { status: 500 });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error in POST webhook endpoint:', error);
    return NextResponse.json({ 
      error: 'Webhook endpoint error',
      message: (error as Error).message 
    }, { status: 500 });
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const orderId = session.metadata?.orderId as string | undefined;
  const promoCodeId = session.metadata?.promoCodeId as string | undefined;
  const fulfillmentType = session.metadata?.fulfillmentType as 'shipping' | 'pickup' | undefined;
  const discountAmountCents = session.metadata?.discountAmount ? Number(session.metadata.discountAmount) : 0;
  const pickupLocation = session.metadata?.pickupLocation || undefined;

  // Build order items from line_items
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
  const productItems: { title: string; quantity: number; price: number }[] = [];
  let totalCents = 0;
  let shippingCostCents = 0;
  
  for (const li of lineItems.data) {
    const name = li.description || li.price?.product as unknown as string;
    const qty = li.quantity || 1;
    const unit = (li.price?.unit_amount ?? 0);
    const lineTotal = unit * qty;
    
    if (name?.toLowerCase() === 'shipping') {
      shippingCostCents += lineTotal;
      totalCents += lineTotal;
      continue;
    }
    
    // Check if this is a regular checkout session (where shipping is embedded) or payment link
    // For regular checkout, shipping might be embedded in product prices
    const isEmbeddedShipping = fulfillmentType === 'shipping' && !lineItems.data.some(item => 
      (item.description || '').toLowerCase() === 'shipping'
    );
    
    if (isEmbeddedShipping) {
      // For embedded shipping, we need to extract the original product price
      // The shipping cost is embedded proportionally, so we need to reverse-calculate
      const embeddedShippingCost = 500; // $5.00 in cents
      const originalUnitPrice = unit - Math.round(embeddedShippingCost / lineItems.data.length / qty);
      const originalPrice = Math.max(originalUnitPrice, unit * 0.8); // Prevent going below 80% of current price
      
      productItems.push({ title: name || 'Item', quantity: qty, price: originalPrice / 100 });
      totalCents += (originalPrice * qty);
      shippingCostCents += embeddedShippingCost;
    } else {
      // Regular line item without embedded shipping
      productItems.push({ title: name || 'Item', quantity: qty, price: (unit / 100) });
      totalCents += lineTotal;
    }
  }

  // Map shipping address
  const customerDetails = session.customer_details;
  const sessionWithShipping = session as Stripe.Checkout.Session & { 
    shipping_details?: { 
      name?: string; 
      address?: { 
        line1?: string; 
        line2?: string; 
        city?: string; 
        state?: string; 
        postal_code?: string; 
        country?: string; 
      } 
    } 
  };
  
  // Log customer details for debugging
  console.log('Customer details from session (webhook.ts):', {
    orderId,
    sessionId: session.id,
    customerEmail: customerDetails?.email || session.customer_email,
    customerName: customerDetails?.name,
    hasShippingDetails: !!sessionWithShipping.shipping_details,
    hasCustomerAddress: !!customerDetails?.address,
    shippingDetailsName: sessionWithShipping.shipping_details?.name,
    fulfillmentType
  });
  
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
    // First try to get shipping info from session.shipping_details (Stripe's dedicated shipping field)
    if (sessionWithShipping.shipping_details?.address) {
      const shipDetails = sessionWithShipping.shipping_details;
      const address = shipDetails.address!;
      shippingAddress = {
        name: shipDetails.name ?? undefined,
        line1: address.line1 ?? undefined,
        line2: address.line2 ?? undefined,
        city: address.city ?? undefined,
        state: address.state ?? undefined,
        postal_code: address.postal_code ?? undefined,
        country: address.country ?? undefined,
      };
      console.log('Shipping address retrieved from session.shipping_details (webhook.ts):', shippingAddress);
    }
    
    // Fallback to payment intent shipping details
    if (!shippingAddress) {
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
            console.log('Shipping address retrieved from payment intent (webhook.ts):', shippingAddress);
          }
        }
      } catch {
        // ignore and fall back to billing
      }
    }
    
    // Last resort: use billing address
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
      console.log('Shipping address fallback to billing address (webhook.ts):', shippingAddress);
    }
    
    if (!shippingAddress) {
      console.error('WARNING: Shipping address not found in webhook.ts!', {
        orderId,
        sessionId: session.id,
        hasShippingDetails: !!sessionWithShipping.shipping_details,
        hasCustomerDetails: !!customerDetails,
        hasCustomerAddress: !!customerDetails?.address
      });
    }
  }

  // Determine customer name with priority fallback
  // Priority: shipping name > customer details name
  const customerName = 
    (fulfillmentType === 'shipping' ? shippingAddress?.name : undefined) || 
    customerDetails?.name || 
    undefined;
  
  console.log('Final customer data for order creation (webhook.ts):', {
    orderId,
    customerName,
    email: customerDetails?.email || session.customer_email,
    hasShippingAddress: !!shippingAddress,
    shippingAddressName: shippingAddress?.name
  });

  await createOrder({
    orderId,
    promoCodeId,
    fulfillmentType,
    discountAmountCents,
    pickupLocation,
    productItems,
    totalCents,
    shippingCostCents,
    shippingAddress,
    email: customerDetails?.email || session.customer_email || undefined,
    customerName: customerName,
  });
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  // For payment links, we need to get the metadata from the payment link
  // Payment links store metadata in the payment_intent.metadata
  const orderId = paymentIntent.metadata?.orderId as string | undefined;
  const promoCodeId = paymentIntent.metadata?.promoCodeId as string | undefined;
  const fulfillmentType = paymentIntent.metadata?.fulfillmentType as 'shipping' | 'pickup' | undefined;
  const discountAmountCents = paymentIntent.metadata?.discountAmount ? Number(paymentIntent.metadata.discountAmount) : 0;
  const pickupLocation = paymentIntent.metadata?.pickupLocation || undefined;

  // Log payment intent details for debugging
  console.log('Payment intent details (payment link):', {
    orderId,
    paymentIntentId: paymentIntent.id,
    hasShipping: !!paymentIntent.shipping,
    shippingName: paymentIntent.shipping?.name,
    receiptEmail: paymentIntent.receipt_email,
    fulfillmentType
  });

  // For payment links, we need to reconstruct the line items from the payment intent
  // Since payment links don't provide line items directly, we'll need to store this info differently
  // For now, we'll create a basic order with the amount from the payment intent
  
  // Try to get line items from the payment link if possible
  const productItems: { title: string; quantity: number; price: number }[] = [];
  
  // If we have orderId, we might be able to get the original cart items from the database
  // For now, create a generic item entry
  if (paymentIntent.amount > 0) {
    productItems.push({ 
      title: 'Book Purchase', 
      quantity: 1, 
      price: (paymentIntent.amount / 100) 
    });
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

  if (fulfillmentType === 'shipping' && paymentIntent.shipping?.address) {
    const ship = paymentIntent.shipping;
    const address = ship.address!;
    shippingAddress = {
      name: ship.name ?? undefined,
      line1: address.line1 ?? undefined,
      line2: address.line2 ?? undefined,
      city: address.city ?? undefined,
      state: address.state ?? undefined,
      postal_code: address.postal_code ?? undefined,
      country: address.country ?? undefined,
    };
    console.log('Shipping address from payment intent:', shippingAddress);
  }

  const customerName = shippingAddress?.name || undefined;
  const totalCents = paymentIntent.amount;
  
  console.log('Final customer data for order creation (payment link):', {
    orderId,
    customerName,
    email: paymentIntent.receipt_email,
    hasShippingAddress: !!shippingAddress,
    stripeTotalCents: totalCents
  });

  await createOrder({
    orderId,
    promoCodeId,
    fulfillmentType,
    discountAmountCents,
    pickupLocation,
    productItems,
    totalCents,
    shippingCostCents: 0, // Payment links typically don't have separate shipping line items
    shippingAddress,
    email: paymentIntent.receipt_email || undefined,
    customerName: customerName,
  });
}

async function createOrder({
  orderId,
  promoCodeId,
  fulfillmentType,
  discountAmountCents,
  pickupLocation,
  productItems,
  totalCents,
  shippingCostCents,
  shippingAddress,
  email,
  customerName,
}: {
  orderId?: string;
  promoCodeId?: string;
  fulfillmentType?: 'shipping' | 'pickup';
  discountAmountCents: number;
  pickupLocation?: string;
  productItems: { title: string; quantity: number; price: number }[];
  totalCents: number;
  shippingCostCents?: number;
  shippingAddress?: {
    name?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  email?: string;
  customerName?: string;
}) {
  // Check if order already exists to prevent duplicates
  if (orderId) {
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId }
    });
    
    if (existingOrder) {
      console.log(`Order ${orderId} already exists, skipping creation`);
      return existingOrder;
    }
  }

  // Calculate proper totals
  const subtotal = productItems.reduce((s, it) => s + (it.price * it.quantity), 0);
  const finalTotal = subtotal + ((shippingCostCents || 0) / 100) - ((discountAmountCents || 0) / 100);
  
  console.log('Order totals calculation (webhook):', {
    orderId,
    subtotal,
    shippingCost: (shippingCostCents || 0) / 100,
    discountAmount: (discountAmountCents || 0) / 100,
    finalTotal,
    stripeTotalCents: totalCents,
    fulfillmentType
  });

  // Create order after successful payment
  const created = await prisma.order.create({
    data: {
      id: orderId, // use pre-generated id if present
      items: productItems,
      total: subtotal, // This should be the subtotal without shipping
      discountAmount: (discountAmountCents || 0) / 100,
      finalTotal: finalTotal, // This should include shipping and subtract discount
      promoCodeId: promoCodeId || null,
      fulfillmentType: fulfillmentType || 'shipping',
      pickupLocation: fulfillmentType === 'pickup' ? (pickupLocation || 'Alpharetta, GA') : null,
      ...(shippingAddress ? { shippingAddress } : {}),
      email: email,
      customerName: customerName,
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
    try {
      await sendOrderConfirmationEmail({
        to: created.email,
        orderId: created.id,
        items: productItems,
        total: created.total,
        fulfillmentType: created.fulfillmentType,
        shippingAddress: undefined,
      });
    } catch (error) {
      console.error('Error sending order confirmation email:', error);
    }
  }

  // Send sales notification email (always, even if customer email is missing)
  try {
    await sendOrderNotificationToSales({
      orderId: created.id,
      items: productItems,
      total: created.total,
      fulfillmentType: created.fulfillmentType,
      customerEmail: created.email || 'No email provided',
      shippingAddress: shippingAddress,
    });
    console.log('Sales notification email sent for order:', created.id);
  } catch (error) {
    console.error('Error sending sales notification email:', error);
  }

  return created;
}
