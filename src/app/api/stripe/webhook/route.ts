import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { updateBookStock, extractBookItems, extractBookItemsFromMetadata } from '@/lib/stockManager';
import { sendOrderConfirmationEmail } from '@/lib/sendEmail';

// Extended Stripe session type to include shipping_details which may not be in all TypeScript definitions
interface StripeSessionWithShipping extends Stripe.Checkout.Session {
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



export async function POST(req: NextRequest) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const sig = req.headers.get('stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    console.log('Webhook POST received:', { 
      hasSignature: !!sig, 
      hasSecret: !!webhookSecret,
      contentType: req.headers.get('content-type'),
      timestamp: new Date().toISOString()
    });

    // If no signature, return success (for testing)
    if (!sig || !webhookSecret) {
      console.log('No signature or webhook secret, returning test response');
      return NextResponse.json({ 
        status: 'POST endpoint received (test mode)',
        timestamp: new Date().toISOString(),
        message: 'Webhook POST endpoint is working - no signature provided'
      });
    }

    // Process actual webhook
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    
    console.log('Webhook event processed:', event.type, event.id);
    
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
    
    return NextResponse.json({ 
      status: 'Webhook processed successfully',
      eventType: event.type,
      eventId: event.id,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ 
      status: 'Webhook error',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    }, { status: 400 });
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const orderId = session.metadata?.orderId as string | undefined;
  const promoCodeId = session.metadata?.promoCodeId as string | undefined;
  const fulfillmentType = session.metadata?.fulfillmentType as 'shipping' | 'pickup' | undefined;
  const discountAmountCents = session.metadata?.discountAmount ? Number(session.metadata.discountAmount) : 0;
  const pickupLocation = session.metadata?.pickupLocation || undefined;

  console.log('Processing checkout session:', { 
    orderId, 
    promoCodeId, 
    fulfillmentType,
    sessionId: session.id
  });

  // Build order items from line_items
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
  const productItems: { title: string; quantity: number; price: number }[] = [];
  let totalCents = 0;
  for (const li of lineItems.data) {
    const name = li.description || li.price?.product as unknown as string;
    const qty = li.quantity || 1;
    const unit = (li.price?.unit_amount ?? 0);
    const lineTotal = unit * qty;
    
    // For payment links, shipping costs are embedded in product prices
    // For regular checkout sessions, we still need to exclude shipping line items
    if (name?.toLowerCase() === 'shipping') {
      totalCents += lineTotal; // still count for finalTotal
      continue;
    }
    
    productItems.push({ title: name || 'Item', quantity: qty, price: (unit / 100) });
    totalCents += lineTotal;
  }

  // Map shipping address
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
    // First try to get shipping address from session.shipping_details (preferred for checkout sessions)
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
      console.log('Got shipping address from session.shipping_details');
    }
    // Fallback to deprecated session.shipping (older Stripe API versions)
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
        console.log('Got shipping address from session.shipping (deprecated)');
      }
    }
    // Fallback to customer_details.address (billing address - not ideal but better than nothing)
    else if (customerDetails?.address) {
      shippingAddress = {
        name: customerDetails?.name ?? undefined,
        line1: customerDetails.address.line1 ?? undefined,
        line2: customerDetails.address.line2 ?? undefined,
        city: customerDetails.address.city ?? undefined,
        state: customerDetails.address.state ?? undefined,
        postal_code: customerDetails.address.postal_code ?? undefined,
        country: customerDetails.address.country ?? undefined,
      };
      console.log('Got shipping address from customer_details.address (billing address fallback)');
    }
    // Last resort: try payment intent
    else {
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
            console.log('Got shipping address from payment intent');
          }
        }
      } catch (error) {
        console.error('Error getting shipping from payment intent:', error);
      }
    }
    
    // Log if no shipping address was found
    if (!shippingAddress) {
      console.warn('No shipping address found for shipping order:', session.id);
    }
  }

  // Try multiple sources for customer name
  let customerName = undefined;
  
  // First try shipping address name (most reliable for shipping orders)
  if (shippingAddress?.name) {
    customerName = shippingAddress.name;
  }
  // Then try customer details name
  else if (session.customer_details?.name) {
    customerName = session.customer_details.name;
  }

  await createOrder({
    orderId,
    promoCodeId,
    fulfillmentType,
    discountAmountCents,
    pickupLocation,
    productItems,
    totalCents,
    shippingAddress,
    email: session.customer_details?.email || session.customer_email || undefined,
    customerName: customerName,
  });
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  
  // For payment links, we need to get the metadata from the payment intent
  const orderId = paymentIntent.metadata?.orderId as string | undefined;
  const promoCodeId = paymentIntent.metadata?.promoCodeId as string | undefined;
  const fulfillmentType = paymentIntent.metadata?.fulfillmentType as 'shipping' | 'pickup' | undefined;
  const discountAmountCents = paymentIntent.metadata?.discountAmount ? Number(paymentIntent.metadata.discountAmount) : 0;
  const pickupLocation = paymentIntent.metadata?.pickupLocation || undefined;

  console.log('Processing payment intent:', { orderId, promoCodeId, fulfillmentType, customerId: paymentIntent.customer });

  // Try to get customer information from multiple sources
  let customerEmail: string | undefined = undefined;
  let customerName: string | undefined = undefined;

  // First try to get customer information from the customer object
  if (paymentIntent.customer) {
    try {
      const customerId = typeof paymentIntent.customer === 'string' 
        ? paymentIntent.customer 
        : paymentIntent.customer.id;
      
      const customer = await stripe.customers.retrieve(customerId);
      if ('email' in customer && customer.email) {
        customerEmail = customer.email;
        console.log('Got customer email from customer object:', customerEmail);
      }
      if ('name' in customer && customer.name) {
        customerName = customer.name;
        console.log('Got customer name from customer object:', customerName);
      }
    } catch (error) {
      console.error('Error retrieving customer:', error);
    }
  }

  // Fallback to receipt_email if no customer email found
  if (!customerEmail && paymentIntent.receipt_email) {
    customerEmail = paymentIntent.receipt_email;
    console.log('Using receipt_email as fallback:', customerEmail);
  }

  // For payment links, we need to reconstruct the line items from the payment intent
  const totalCents = paymentIntent.amount;
  
  // Try to get line items from the payment link if possible
  const productItems: { title: string; quantity: number; price: number }[] = [];
  
  // If we have orderId, we might be able to get the original cart items from the database
  // For now, create a generic item entry
  if (totalCents > 0) {
    productItems.push({ 
      title: 'Book Purchase', 
      quantity: 1, 
      price: (totalCents / 100) 
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

  if (fulfillmentType === 'shipping') {
    console.log('Looking for shipping address in payment intent:', {
      hasShipping: !!paymentIntent.shipping,
      shippingData: paymentIntent.shipping,
      hasCustomer: !!paymentIntent.customer,
      customerId: paymentIntent.customer
    });

    // Try to get shipping address from payment intent
    if (paymentIntent.shipping?.address) {
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
      console.log('Found shipping address in payment intent:', shippingAddress);
    } else {
      console.log('No shipping address found in payment intent');
      
      // For payment links, try to get shipping address from customer object
      if (paymentIntent.customer) {
        try {
          const customerId = typeof paymentIntent.customer === 'string' 
            ? paymentIntent.customer 
            : paymentIntent.customer.id;
          
          const customer = await stripe.customers.retrieve(customerId);
          console.log('Retrieved customer for shipping address:', {
            hasAddress: !!customer.address,
            address: customer.address,
            hasName: !!customer.name,
            name: customer.name
          });
          
          if (customer.address) {
            shippingAddress = {
              name: customer.name ?? undefined,
              line1: customer.address.line1 ?? undefined,
              line2: customer.address.line2 ?? undefined,
              city: customer.address.city ?? undefined,
              state: customer.address.state ?? undefined,
              postal_code: customer.address.postal_code ?? undefined,
              country: customer.address.country ?? undefined,
            };
            console.log('Found shipping address in customer object:', shippingAddress);
          } else {
            console.log('Customer has no address information');
          }
        } catch (error) {
          console.error('Error retrieving customer for shipping address:', error);
        }
      } else {
        console.log('No customer object in payment intent');
      }
    }
  }

  // Try multiple sources for customer name in payment intent
  if (!customerName) {
    // First try shipping address name
    if (shippingAddress?.name) {
      customerName = shippingAddress.name;
    }
  }

  console.log('Final customer info for payment intent:', { email: customerEmail, name: customerName });
  console.log('Creating order with shipping address:', {
    orderId,
    fulfillmentType,
    shippingAddress,
    hasShippingAddress: !!shippingAddress
  });

  await createOrder({
    orderId,
    promoCodeId,
    fulfillmentType,
    discountAmountCents,
    pickupLocation,
    productItems,
    totalCents,
    shippingAddress,
    email: customerEmail,
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
  console.log('Creating order:', { orderId, email, customerName, totalCents });

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
        shippingAddress: shippingAddress || undefined,
        email: email,
        customerName: customerName,
      },
  });

  console.log('Order created successfully:', created.id);

  // Update promo code usage if applicable
  if (promoCodeId) {
    try {
      await prisma.promoCode.update({
        where: { id: promoCodeId },
        data: { currentUses: { increment: 1 } }
      });
      console.log('Promo code usage updated:', promoCodeId);
    } catch (error) {
      console.error('Error updating promo code usage:', error);
    }
  }

  // Update book stock after successful order creation
  try {
    const bookItems = extractBookItems(productItems);
    await updateBookStock(bookItems, created.id);
  } catch (stockError) {
    console.error('Failed to update stock for order:', created.id, stockError);
    // Note: Order is already created, so we log the error but don't fail the request
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
      console.log('Order confirmation email sent to:', created.email);
    } catch (error) {
      console.error('Error sending order confirmation email:', error);
    }
  }

  return created;
}
