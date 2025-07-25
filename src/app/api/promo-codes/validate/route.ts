import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { code, orderTotal } = await req.json();

    if (!code) {
      return NextResponse.json({ error: 'Promo code is required' }, { status: 400 });
    }

    if (!orderTotal || typeof orderTotal !== 'number') {
      return NextResponse.json({ error: 'Valid order total is required' }, { status: 400 });
    }

    // Find the promo code
    const promoCode = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() }
    });

    if (!promoCode) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Invalid promo code' 
      });
    }

    // Check if promo code is active
    if (!promoCode.isActive) {
      return NextResponse.json({ 
        valid: false, 
        error: 'This promo code is no longer active' 
      });
    }

    // Check if promo code is within valid date range
    const now = new Date();
    if (now < promoCode.validFrom) {
      return NextResponse.json({ 
        valid: false, 
        error: 'This promo code is not yet valid' 
      });
    }

    if (promoCode.validUntil && now > promoCode.validUntil) {
      return NextResponse.json({ 
        valid: false, 
        error: 'This promo code has expired' 
      });
    }

    // Check minimum order amount
    if (promoCode.minimumOrderAmount && orderTotal < promoCode.minimumOrderAmount) {
      return NextResponse.json({ 
        valid: false, 
        error: `Minimum order amount of $${promoCode.minimumOrderAmount.toFixed(2)} required` 
      });
    }

    // Check usage limits
    if (promoCode.maxUses && promoCode.currentUses >= promoCode.maxUses) {
      return NextResponse.json({ 
        valid: false, 
        error: 'This promo code has reached its usage limit' 
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (promoCode.discountType === 'percentage') {
      discountAmount = (orderTotal * promoCode.discountValue) / 100;
    } else if (promoCode.discountType === 'fixed') {
      discountAmount = promoCode.discountValue / 100; // Convert cents to dollars
    }

    // Ensure discount doesn't exceed order total
    discountAmount = Math.min(discountAmount, orderTotal);

    const finalTotal = orderTotal - discountAmount;

    return NextResponse.json({
      valid: true,
      promoCode: {
        id: promoCode.id,
        code: promoCode.code,
        description: promoCode.description,
        discountType: promoCode.discountType,
        discountValue: promoCode.discountValue,
        discountAmount,
        finalTotal
      }
    });

  } catch (error) {
    console.error('Error validating promo code:', error);
    return NextResponse.json({ 
      error: 'Failed to validate promo code' 
    }, { status: 500 });
  }
} 