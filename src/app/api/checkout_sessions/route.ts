import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

type CartItem = {
  title: string;
  image?: string;
  price: number;
  quantity: number;
};

export async function POST(req: NextRequest) {
  try {
    const { items, fulfillmentType, orderId, email, promoCodeId, createPaymentLink, discountAmount, pickupLocation } = await req.json();
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // Create product line items first (without shipping)
    let product_line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item: CartItem) => ({
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

    // Apply discount to product line items only (before adding shipping)
    if (promoCodeId) {
      try {
        const promoCode = await prisma.promoCode.findUnique({
          where: { id: promoCodeId }
        });
        
        if (promoCode) {
          const productSubtotal = product_line_items.reduce((sum, item) => {
            if (item.price_data && item.price_data.unit_amount && item.quantity) {
              return sum + (item.price_data.unit_amount * item.quantity);
            }
            return sum;
          }, 0);
          let discountAmount = 0;
          
          if (promoCode.discountType === 'percentage') {
            discountAmount = Math.round((productSubtotal * promoCode.discountValue) / 100);
          } else if (promoCode.discountType === 'fixed') {
            // promoCode.discountValue is already in cents, so we use it directly
            discountAmount = promoCode.discountValue;
          }
          
          // Log discount calculation for debugging
          console.log('Discount applied to products only:', {
            promoCodeId,
            discountType: promoCode.discountType,
            discountValue: promoCode.discountValue,
            productSubtotal,
            discountAmount
          });
          
          // Ensure discount doesn't exceed product subtotal
          discountAmount = Math.min(discountAmount, productSubtotal);
          
          if (discountAmount > 0) {
            // Apply discount proportionally to product line items only
            const discountRatio = discountAmount / productSubtotal;
            
            product_line_items = product_line_items.map(item => {
              if (!item.price_data || !item.price_data.unit_amount || !item.quantity) return item;
              
              const itemTotal = item.price_data.unit_amount * item.quantity;
              const itemDiscount = Math.round(itemTotal * discountRatio);
              const newUnitAmount = Math.max(0, item.price_data.unit_amount - Math.round(itemDiscount / item.quantity));
              
              return {
                ...item,
                price_data: {
                  ...item.price_data,
                  unit_amount: newUnitAmount
                }
              };
            });
          }
        }
      } catch (error) {
        console.error('Error applying promo code:', error);
        // Continue without discount if there's an error
      }
    }

    // Start with discounted product line items
    let line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [...product_line_items];

    // Add shipping fee after discount has been applied
    if (fulfillmentType === 'shipping') {
      // Don't add shipping as a separate line item for payment links as it gets archived by Stripe
      // Instead, we'll include shipping cost in the product prices or handle it via metadata
      console.log('Skipping shipping line item to prevent Stripe archiving - shipping cost will be included in product prices');
      
      // Add shipping cost to each product line item proportionally
      const shippingCostCents = 500; // $5.00 shipping
      const totalProductValue = product_line_items.reduce((sum, item) => {
        if (item.price_data && item.price_data.unit_amount && item.quantity) {
          return sum + (item.price_data.unit_amount * item.quantity);
        }
        return sum;
      }, 0);
      
      if (totalProductValue > 0) {
        const shippingRatio = shippingCostCents / totalProductValue;
        
        line_items = product_line_items.map(item => {
          if (!item.price_data || !item.price_data.unit_amount || !item.quantity) return item;
          
          const itemTotal = item.price_data.unit_amount * item.quantity;
          const itemShippingCost = Math.round(itemTotal * shippingRatio);
          const newUnitAmount = item.price_data.unit_amount + Math.round(itemShippingCost / item.quantity);
          
          return {
            ...item,
            price_data: {
              ...item.price_data,
              unit_amount: newUnitAmount
            }
          };
        });
      }
    } else if (fulfillmentType === 'pickup') {
      // Don't add a zero-price line item for pickup as it gets archived by Stripe
      // Instead, we'll handle pickup as metadata only
      console.log('Skipping zero-price pickup line item to prevent Stripe archiving');
    }

    // If creating a payment link for in-person sales
    if (createPaymentLink) {
      console.log('Creating payment link with:', {
        orderId,
        fulfillmentType,
        pickupLocation,
        lineItemsCount: line_items.length,
        totalAmount: line_items.reduce((sum, item) => {
          if (item.price_data && item.price_data.unit_amount && item.quantity) {
            return sum + (item.price_data.unit_amount * item.quantity);
          }
          return sum;
        }, 0)
      });

      const paymentLink = await stripe.paymentLinks.create({
        line_items: line_items as Stripe.PaymentLinkCreateParams.LineItem[],
        after_completion: { type: 'redirect', redirect: { url: `${req.nextUrl.origin}/checkout/success?orderId=${orderId}` } },
        metadata: { 
          orderId, 
          promoCodeId: promoCodeId || '',
          fulfillmentType,
          discountAmount: discountAmount ? String(discountAmount) : '0',
          pickupLocation: pickupLocation || '',
          shippingIncluded: fulfillmentType === 'shipping' ? 'true' : 'false',
          shippingCost: fulfillmentType === 'shipping' ? '500' : '0',
        },
        // Add payment method types for payment links
        payment_method_types: ['card'],
        // Add shipping address collection if needed
        ...(fulfillmentType === 'shipping' && {
          shipping_address_collection: { allowed_countries: ['US', 'CA'] }
        }),
        // Add billing address collection for customer information
        billing_address_collection: 'required',
      });

      console.log('Payment link created successfully:', {
        paymentLinkId: paymentLink.id,
        paymentLinkUrl: paymentLink.url,
        active: paymentLink.active,
        stripeMode: process.env.STRIPE_SECRET_KEY?.includes('sk_test_') ? 'test' : 'live',
        lineItems: line_items.length,
        totalAmount: line_items.reduce((sum, item) => {
          if (item.price_data && item.price_data.unit_amount && item.quantity) {
            return sum + (item.price_data.unit_amount * item.quantity);
          }
          return sum;
        }, 0)
      });



      // Verify the payment link is still active after creation
      try {
        const verifyPaymentLink = await stripe.paymentLinks.retrieve(paymentLink.id);
        console.log('Payment link verification after creation:', {
          id: verifyPaymentLink.id,
          active: verifyPaymentLink.active,
          url: verifyPaymentLink.url
        });
        
        if (!verifyPaymentLink.active) {
          console.error('Payment link was deactivated immediately after creation!');
        }
      } catch (verifyError) {
        console.error('Error verifying payment link:', verifyError);
      }

      return NextResponse.json({ 
        paymentLinkUrl: paymentLink.url,
        orderId 
      });
    }

    // Regular Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `${req.nextUrl.origin}/checkout/success?orderId=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.nextUrl.origin}/cart`,
      shipping_address_collection: { allowed_countries: ['US', 'CA'] },
      customer_email: email,
      billing_address_collection: 'required', // This will collect customer name
      metadata: { 
        orderId, 
        promoCodeId: promoCodeId || '',
        fulfillmentType,
        discountAmount: discountAmount ? String(discountAmount) : '0',
        pickupLocation: pickupLocation || '',
        shippingIncluded: fulfillmentType === 'shipping' ? 'true' : 'false',
        shippingCost: fulfillmentType === 'shipping' ? '500' : '0',
      },
    });



    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('Error in checkout session creation:', err);
    
    // Provide more specific error messages
    if (err instanceof Error) {
      if (err.message.includes('payment_link_deactivated')) {
        return NextResponse.json({ 
          error: 'Payment link has been deactivated. Please create a new one.' 
        }, { status: 400 });
      }
      if (err.message.includes('invalid_request_error')) {
        return NextResponse.json({ 
          error: 'Invalid request. Please check your payment configuration.' 
        }, { status: 400 });
      }
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
} 