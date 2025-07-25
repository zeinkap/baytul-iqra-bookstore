import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data = await req.json();
    const { 
      code, 
      description, 
      discountType, 
      discountValue, 
      minimumOrderAmount, 
      maxUses, 
      validFrom, 
      validUntil,
      isActive 
    } = data;

    if (!code || !description || !discountType || !discountValue) {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    if (discountType !== 'percentage' && discountType !== 'fixed') {
      return NextResponse.json({ 
        error: 'Discount type must be "percentage" or "fixed"' 
      }, { status: 400 });
    }

    const promoCode = await prisma.promoCode.update({
      where: { id: params.id },
      data: {
        code: code.toUpperCase(),
        description,
        discountType,
        discountValue,
        minimumOrderAmount: minimumOrderAmount || null,
        maxUses: maxUses || null,
        validFrom: validFrom ? new Date(validFrom) : new Date(),
        validUntil: validUntil ? new Date(validUntil) : null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json(promoCode);
  } catch (error) {
    console.error('Error updating promo code:', error);
    return NextResponse.json({ 
      error: 'Failed to update promo code' 
    }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data = await req.json();
    const { isActive } = data;

    if (typeof isActive !== 'boolean') {
      return NextResponse.json({ 
        error: 'isActive must be a boolean' 
      }, { status: 400 });
    }

    const promoCode = await prisma.promoCode.update({
      where: { id: params.id },
      data: { isActive },
    });

    return NextResponse.json(promoCode);
  } catch (error) {
    console.error('Error updating promo code status:', error);
    return NextResponse.json({ 
      error: 'Failed to update promo code status' 
    }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.promoCode.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: 'Promo code deleted successfully' });
  } catch (error) {
    console.error('Error deleting promo code:', error);
    return NextResponse.json({ 
      error: 'Failed to delete promo code' 
    }, { status: 500 });
  }
} 