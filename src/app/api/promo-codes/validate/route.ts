import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkPromoCode } from '@/lib/pricing';

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

    const result = checkPromoCode(promoCode, orderTotal);
    if (!result.valid) {
      return NextResponse.json({ valid: false, error: result.error });
    }
    const discountAmount = result.discountAmount;

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