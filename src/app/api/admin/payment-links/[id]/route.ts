import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Payment link ID is required' },
        { status: 400 }
      );
    }

    // Delete the payment link from Stripe
    // Note: Stripe doesn't have a direct delete method for payment links
    // Instead, we can deactivate them by updating them
    const updatedPaymentLink = await stripe.paymentLinks.update(id, {
      active: false
    });

    console.log('Payment link deactivated:', {
      id: updatedPaymentLink.id,
      active: updatedPaymentLink.active
    });

    return NextResponse.json({
      success: true,
      message: 'Payment link deactivated successfully',
      updatedPaymentLink
    });
  } catch (error) {
    console.error('Error deleting payment link:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('No such payment_link')) {
        return NextResponse.json(
          { error: 'Payment link not found' },
          { status: 404 }
        );
      }
      if (error.message.includes('payment_link_deactivated')) {
        return NextResponse.json(
          { error: 'Payment link is already deactivated' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete payment link' },
      { status: 500 }
    );
  }
}
