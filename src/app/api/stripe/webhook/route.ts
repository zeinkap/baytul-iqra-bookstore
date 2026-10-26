import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { updateBookStock, extractBookItems, hasStockBeenUpdated } from '@/lib/stockManager';
import { sendOrderConfirmationEmail } from '@/lib/sendEmail';
import { finalizePaidOrder, finalizeInShopIntent, IN_SHOP_WALLET_FLOW, notifySalesOfPaidOrder, paymentMethodLabel, recordRefund } from '@/lib/finalizeOrder';

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
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      console.log(`Processing ${event.type} event`);
      await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
    } else if (event.type === 'charge.refunded') {
      await handleChargeRefunded(event.data.object as Stripe.Charge);
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

const CARD_BRANDS: Record<string, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', discover: 'Discover', diners: 'Diners Club', jcb: 'JCB', unionpay: 'UnionPay' };

/** Where a refund goes back to, from the charge: "Visa ending 4242", or "Apple Pay (Visa ending 4242)". Null if unknown. */
function refundDestination(charge: Stripe.Charge): string | null {
  const card = charge.payment_method_details?.card;
  if (!card) return null;
  const brand = (card.brand && CARD_BRANDS[card.brand]) || 'card';
  const base = card.last4 ? `${brand} ending ${card.last4}` : brand;
  const wallet = card.wallet?.type === 'apple_pay' ? 'Apple Pay' : card.wallet?.type === 'google_pay' ? 'Google Pay' : null;
  return wallet ? `${wallet} (${base})` : base;
}

/** The newest refund on the charge: its id, and the bank's reference (ARN) if the bank has already issued one. Never throws. */
async function latestRefundReference(stripe: Stripe, chargeId: string): Promise<{ id: string; bankReference: string | null } | null> {
  try {
    const refund = (await stripe.refunds.list({ charge: chargeId, limit: 1 })).data[0];
    if (!refund) return null;
    const card = refund.destination_details?.card;
    return { id: refund.id, bankReference: card?.reference && card.reference_type === 'acquirer_reference_number' ? card.reference : null };
  } catch (error) {
    console.error('Could not read refund reference:', error);
    return null;
  }
}

/** A refund (full or partial) in Stripe: record it on the order so reports stop counting that money. */
async function handleChargeRefunded(charge: Stripe.Charge) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const intentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  if (!intentId) return;
  // The order id lives on the Checkout Session that created this payment, or on the PaymentIntent itself for
  // Apple Pay / Google Pay payments made on the scan page (no Checkout Session)
  const sessions = await stripe.checkout.sessions.list({ payment_intent: intentId, limit: 1 });
  let orderId = sessions.data[0]?.metadata?.orderId;
  if (!orderId) {
    const intent = await stripe.paymentIntents.retrieve(intentId);
    orderId = intent.metadata?.orderId || undefined;
  }
  if (!orderId) {
    console.log('Refund for a payment with no checkout order (ignored):', charge.id);
    return;
  }
  await recordRefund(orderId, charge.amount_refunded / 100, refundDestination(charge), await latestRefundReference(stripe, charge.id));
  console.log(`Recorded refund of $${(charge.amount_refunded / 100).toFixed(2)} on order ${orderId}`);
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  // Delayed payment methods (e.g. bank debits) complete the checkout before the money arrives. Wait for
  // checkout.session.async_payment_succeeded instead of marking the order paid, stocked and emailed too early.
  if (session.payment_status === 'unpaid') {
    console.log('Checkout completed but payment still pending; waiting for async payment confirmation:', session.id);
    return;
  }
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
    source: session.metadata?.source === 'in-shop' ? 'in-shop' : 'online',
    location: session.metadata?.location || undefined,
    paymentMethod: await paymentMethodLabel(stripe, session),
  });
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  // Apple Pay / Google Pay on the scan page: the order already exists, just finish it
  if (paymentIntent.metadata?.flow === IN_SHOP_WALLET_FLOW) {
    const result = await finalizeInShopIntent(stripe, paymentIntent.id);
    if (!result.ok) console.error('Could not finalize in-shop wallet payment:', paymentIntent.id, result.error);
    return;
  }
  
  // For payment links, we need to get the metadata from the payment intent
  const orderId = paymentIntent.metadata?.orderId as string | undefined;
  const promoCodeId = paymentIntent.metadata?.promoCodeId as string | undefined;
  const fulfillmentType = paymentIntent.metadata?.fulfillmentType as 'shipping' | 'pickup' | undefined;
  const discountAmountCents = paymentIntent.metadata?.discountAmount ? Number(paymentIntent.metadata.discountAmount) : 0;
  const pickupLocation = paymentIntent.metadata?.pickupLocation || undefined;

  // Not one of ours: every Checkout payment has a PaymentIntent too (its order id lives on the session, which
  // checkout.session.completed handles), and so do payments made straight in the Stripe Dashboard. Without an
  // order id there is nothing to finish, and guessing one would create a stray "Book Purchase" order.
  if (!orderId) {
    console.log('payment_intent.succeeded without an order id (Checkout or Dashboard payment): ignored', paymentIntent.id);
    return;
  }

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
          
          // Type guard: Check if customer is not deleted
          if (!customer.deleted) {
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
          } else {
            console.log('Customer has been deleted');
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
  source,
  location,
  paymentMethod,
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
  source?: 'online' | 'in-shop';
  location?: string;
  paymentMethod?: string | null;
}) {
  console.log('Creating order:', { orderId, email, customerName, totalCents });

  // Check if order already exists (e.g. created before payment link or Terminal payment)
  if (orderId) {
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (existingOrder) {
      // Mark paid and save what Stripe collected (email, name, payment method). Shared with the receipt page's
      // fallback so whichever runs first does the work and the receipt email goes out exactly once.
      const finalized = await finalizePaidOrder(existingOrder.id, { email, customerName, paymentMethod });
      console.log(`Order ${orderId} already exists, ensuring stock updated and skipping duplicate creation`);
      // Still deduct inventory: order was created before payment, so stock wasn't updated yet
      try {
        if (!hasStockBeenUpdated(existingOrder.id)) {
          const orderItems = existingOrder.items as Array<{ id?: string; title?: string; quantity?: number; price?: number }>;
          const bookItems = extractBookItems(orderItems);
          if (bookItems.length > 0) {
            await updateBookStock(bookItems, existingOrder.id);
            console.log('Stock updated for existing order:', existingOrder.id);
          }
        }
      } catch (stockError) {
        console.error('Failed to update stock for existing order:', existingOrder.id, stockError);
      }

      return finalized ?? existingOrder;
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
        source: source || 'online',
        location: location || null,
        paymentMethod: paymentMethod || null,
        paidAt: new Date(),
      },
  });

  console.log('Order created successfully:', created.id);

  // Alert the shop about this sale (once: this branch only runs when the order didn't exist yet)
  await notifySalesOfPaidOrder(created);

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
        total: created.finalTotal,
        fulfillmentType: created.fulfillmentType,
        source: created.source,
        discount: created.discountAmount,
        paidAt: created.paidAt,
        paymentMethod: created.paymentMethod,
        shippingAddress: (created.shippingAddress as Record<string, string> | null) ?? undefined,
      });
      console.log('Order confirmation email sent to:', created.email);
    } catch (error) {
      console.error('Error sending order confirmation email:', error);
    }
  }

  return created;
}
