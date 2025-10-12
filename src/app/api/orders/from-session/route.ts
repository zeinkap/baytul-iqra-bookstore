import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import { sendOrderNotificationToSales } from '@/lib/sendEmail';

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session || session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Session not paid' }, { status: 400 });
    }
    const orderId = session.metadata?.orderId as string | undefined;
    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId in session metadata' }, { status: 400 });
    }

    const discountAmountCents = Number(session.metadata?.discountAmount || '0');
    const fulfillmentType = (session.metadata?.fulfillmentType as 'shipping' | 'pickup') || 'shipping';
    const pickupLocation = session.metadata?.pickupLocation || undefined;

    // Extract line items
    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId);
    const productItems: { title: string; quantity: number; price: number }[] = [];
    let totalCents = 0;
    let shippingCostCents = 0;
    
    for (const li of lineItems.data) {
      const name = li.description || (li.price?.product as unknown as string);
      const qty = li.quantity || 1;
      const unit = li.price?.unit_amount ?? 0;
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
        productItems.push({ title: name || 'Item', quantity: qty, price: unit / 100 });
        totalCents += lineTotal;
      }
    }
    
    const customerDetails = session.customer_details;
    
    // Log customer details for debugging
    console.log('Customer details from session (from-session):', {
      orderId,
      sessionId: session.id,
      customerEmail: customerDetails?.email || session.customer_email,
      customerName: customerDetails?.name,
      hasShippingDetails: !!session.shipping_details,
      hasCustomerAddress: !!customerDetails?.address,
      shippingDetailsName: session.shipping_details?.name,
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
      if (session.shipping_details?.address) {
        const shipDetails = session.shipping_details;
        shippingAddress = {
          name: shipDetails.name ?? undefined,
          line1: shipDetails.address.line1 ?? undefined,
          line2: shipDetails.address.line2 ?? undefined,
          city: shipDetails.address.city ?? undefined,
          state: shipDetails.address.state ?? undefined,
          postal_code: shipDetails.address.postal_code ?? undefined,
          country: shipDetails.address.country ?? undefined,
        };
        console.log('Shipping address retrieved from session.shipping_details (from-session):', shippingAddress);
      }
      
      // Fallback to payment intent shipping details
      if (!shippingAddress) {
        try {
          const paymentIntentId = typeof session.payment_intent === 'string'
            ? session.payment_intent
            : (session.payment_intent && 'id' in session.payment_intent ? (session.payment_intent as { id: string }).id : undefined);
          if (paymentIntentId) {
            const pi = await stripe.paymentIntents.retrieve(paymentIntentId as string);
            const ship = (pi as Stripe.PaymentIntent).shipping as { name?: string; address?: { line1?: string; line2?: string; city?: string; state?: string; postal_code?: string; country?: string } } | undefined;
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
              console.log('Shipping address retrieved from payment intent (from-session):', shippingAddress);
            }
          }
        } catch {
          // ignore
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
        console.log('Shipping address fallback to billing address (from-session):', shippingAddress);
      }
      
      if (!shippingAddress) {
        console.error('WARNING: Shipping address not found in from-session!', {
          orderId,
          sessionId: session.id,
          hasShippingDetails: !!session.shipping_details,
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
    
    const email = customerDetails?.email || session.customer_email || undefined;
    
    console.log('Final customer data for order (from-session):', {
      orderId,
      customerName,
      email,
      hasShippingAddress: !!shippingAddress,
      shippingAddressName: shippingAddress?.name
    });

    // Check if order already exists
    const existing = await prisma.order.findUnique({ where: { id: orderId } });
    
    if (existing) {
      // Check if existing order is missing customer information
      const needsUpdate = !existing.customerName || !existing.shippingAddress || !existing.email;
      
      if (needsUpdate && (customerName || shippingAddress || email)) {
        console.log('Updating existing order with customer info from session:', {
          orderId: existing.id,
          hadCustomerName: !!existing.customerName,
          hadShippingAddress: !!existing.shippingAddress,
          hadEmail: !!existing.email,
          nowHasCustomerName: !!customerName,
          nowHasShippingAddress: !!shippingAddress,
          nowHasEmail: !!email
        });
        
        // Update the existing order with customer information
        const updated = await prisma.order.update({
          where: { id: orderId },
          data: {
            ...(customerName && !existing.customerName ? { customerName } : {}),
            ...(shippingAddress && !existing.shippingAddress ? { shippingAddress } : {}),
            ...(email && !existing.email ? { email } : {}),
          }
        });
        
        console.log('Order updated successfully with customer info');
        return NextResponse.json(updated);
      }
      
      // Order exists and has all necessary information
      return NextResponse.json(existing);
    }

    // Create new order
    try {
      // Calculate proper totals
      const subtotal = productItems.reduce((s, it) => s + it.price * it.quantity, 0);
      const finalTotal = subtotal + (shippingCostCents / 100) - ((discountAmountCents || 0) / 100);
      
      console.log('Order totals calculation (from-session):', {
        orderId,
        subtotal,
        shippingCost: shippingCostCents / 100,
        discountAmount: (discountAmountCents || 0) / 100,
        finalTotal,
        fulfillmentType
      });

      const created = await prisma.order.create({
        data: {
          id: orderId,
          items: productItems,
          total: subtotal, // This should be the subtotal without shipping
          discountAmount: (discountAmountCents || 0) / 100,
          finalTotal: finalTotal, // This should include shipping and subtract discount
          promoCodeId: session.metadata?.promoCodeId || null,
          fulfillmentType,
          pickupLocation: fulfillmentType === 'pickup' ? (pickupLocation || 'Alpharetta, GA') : null,
          ...(shippingAddress ? { shippingAddress } : {}),
          email,
          customerName,
        },
      });

      // Send sales notification email (only when order is newly created)
      try {
        await sendOrderNotificationToSales({
          orderId: created.id,
          items: productItems,
          total: created.total,
          fulfillmentType: created.fulfillmentType,
          customerEmail: created.email || 'No email provided',
          shippingAddress: shippingAddress,
        });
        console.log('Sales notification email sent for order (from-session):', created.id);
      } catch (emailError) {
        console.error('Error sending sales notification email:', emailError);
        // Don't fail the request if email fails
      }

      return NextResponse.json(created);
    } catch (err: unknown) {
      // If already created by webhook, return existing idempotently
      if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'P2002') {
        const existing = await prisma.order.findUnique({ where: { id: orderId } });
        if (existing) return NextResponse.json(existing);
      }
      throw err;
    }
  } catch (error) {
    console.error('Failed to create order from session:', error);
    return NextResponse.json({ error: 'Failed to create order from session' }, { status: 500 });
  }
}
