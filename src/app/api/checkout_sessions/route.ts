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
    const { items, fulfillmentType, orderId, email, promoCodeId } = await req.json();
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // Create product line items first (without shipping)
    let product_line_items = items.map((item: CartItem) => ({
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
          const productSubtotal = product_line_items.reduce((sum, item) => sum + (item.price_data.unit_amount * item.quantity), 0);
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
    const line_items = [...product_line_items];

    // Add shipping fee after discount has been applied
    if (fulfillmentType === 'shipping') {
      line_items.push({
        price_data: {
          currency: 'usd',
          product_data: { name: 'Shipping', images: undefined },
          unit_amount: 500,
        },
        quantity: 1,
      });
    } else if (fulfillmentType === 'pickup') {
      line_items.push({
        price_data: {
          currency: 'usd',
          product_data: { name: 'Free Local Pickup', images: undefined },
          unit_amount: 0,
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `${req.nextUrl.origin}/checkout/success?orderId=${orderId}`,
      cancel_url: `${req.nextUrl.origin}/cart`,
      shipping_address_collection: { allowed_countries: ['US', 'CA'] },
      customer_email: email,
      metadata: { 
        orderId, 
        promoCodeId: promoCodeId || ''
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
} 