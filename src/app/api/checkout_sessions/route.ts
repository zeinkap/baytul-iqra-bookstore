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
    const { items, fulfillmentType, orderId, email, phone, promoCodeId, createPaymentLink, discountAmount, pickupLocation } = await req.json();
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin || 'http://localhost:3000';
    
    console.log('Base URL for image construction:', {
      NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
      requestOrigin: req.nextUrl.origin,
      finalBaseUrl: baseUrl
    });
    
    // Log important info about image URLs for payment links
    if (createPaymentLink && (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1'))) {
      console.log('📋 PAYMENT LINK IMAGES NOTE:');
      console.log('   Stripe cannot access localhost URLs for images.');
      console.log('   Images will be skipped in payment links during local development.');
      console.log('   To test with images:');
      console.log('   1. Deploy to a public URL (Vercel, Netlify, etc.)');
      console.log('   2. Set NEXT_PUBLIC_BASE_URL environment variable to your public URL');
      console.log('   3. Or use a service like ngrok to expose localhost');
    }

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

      // For payment links, we need to use the original line_items structure
      // but we can enhance the product names and descriptions to show more details
      const enhancedLineItems = line_items.map((item, index) => {
        if (item.price_data && item.price_data.product_data) {
          const originalItem = items[index];
          
          // Create proper absolute URL for images
          let imageUrl: string | undefined;
          if (originalItem.image) {
            if (originalItem.image.startsWith('http://') || originalItem.image.startsWith('https://')) {
              // Already absolute URL
              imageUrl = originalItem.image;
            } else {
              // Relative path - convert to absolute
              const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
              const cleanImagePath = originalItem.image.startsWith('/') ? originalItem.image : `/${originalItem.image}`;
              const constructedUrl = `${cleanBaseUrl}${cleanImagePath}`;
              
              // Check if this is a localhost URL (Stripe can't access localhost)
              if (constructedUrl.includes('localhost') || constructedUrl.includes('127.0.0.1')) {
                console.log('⚠️  Localhost detected - Stripe cannot access localhost URLs for images');
                console.log('💡 To see images in payment links, deploy to a public URL and set NEXT_PUBLIC_BASE_URL');
                // For localhost, we'll skip the image but keep the detailed product info
                imageUrl = undefined;
              } else {
                imageUrl = constructedUrl;
              }
            }
            
            console.log('Payment link image URL constructed:', {
              originalImage: originalItem.image,
              baseUrl,
              constructedUrl: imageUrl || 'Skipped (localhost)',
              isLocalhost: imageUrl === undefined
            });
          }
          
          return {
            ...item,
            price_data: {
              ...item.price_data,
              product_data: {
                ...item.price_data.product_data,
                name: `${originalItem.title} (Qty: ${originalItem.quantity})`,
                description: `Quantity: ${originalItem.quantity} × $${originalItem.price.toFixed(2)} each`,
                images: imageUrl ? [imageUrl] : undefined,
              }
            }
          };
        }
        return item;
      });

      const paymentLink = await stripe.paymentLinks.create({
        line_items: enhancedLineItems as Stripe.PaymentLinkCreateParams.LineItem[],
        after_completion: { type: 'redirect', redirect: { url: `${req.nextUrl.origin}/checkout/success?orderId=${orderId}` } },
        metadata: { 
          orderId, 
          promoCodeId: promoCodeId || '',
          fulfillmentType,
          discountAmount: discountAmount ? String(discountAmount) : '0',
          pickupLocation: pickupLocation || '',
          shippingIncluded: fulfillmentType === 'shipping' ? 'true' : 'false',
          shippingCost: fulfillmentType === 'shipping' ? '500' : '0',
          customerPhone: phone || '',
          // Store only essential cart info to stay under 500 character limit
          itemCount: String(items.length),
          totalItems: String(items.reduce((sum, item) => sum + item.quantity, 0)),
          // Store just book IDs and quantities instead of full JSON
          bookIds: items.map(item => item.id).join(','),
          quantities: items.map(item => item.quantity).join(','),
        },
        // Add payment method types for payment links
        payment_method_types: ['card'],
        // Add shipping address collection if needed
        ...(fulfillmentType === 'shipping' && {
          shipping_address_collection: { allowed_countries: ['US', 'CA'] }
        }),
        // Add billing address collection for customer information
        billing_address_collection: 'required',
        // Add customer email collection for payment links
        customer_creation: 'always',
      });

      console.log('Payment link created successfully:', {
        paymentLinkId: paymentLink.id,
        paymentLinkUrl: paymentLink.url,
        active: paymentLink.active,
        stripeMode: process.env.STRIPE_SECRET_KEY?.includes('sk_test_') ? 'test' : 'live',
        lineItems: enhancedLineItems.length,
        totalAmount: enhancedLineItems.reduce((sum, item) => {
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
        customerPhone: phone || '',
        // Store only essential cart info to stay under 500 character limit
        itemCount: String(items.length),
        totalItems: String(items.reduce((sum, item) => sum + item.quantity, 0)),
        // Store just book IDs and quantities instead of full JSON
        bookIds: items.map(item => item.id).join(','),
        quantities: items.map(item => item.quantity).join(','),
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