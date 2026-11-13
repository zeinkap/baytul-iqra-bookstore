import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getHiddenPaymentLinks, hidePaymentLink, unhidePaymentLink } from '@/lib/hiddenPaymentLinks';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const hiddenLinks = await getHiddenPaymentLinks();
    return NextResponse.json(hiddenLinks);
  } catch (error) {
    console.error('Error reading hidden payment links:', error);
    return NextResponse.json(
      { error: 'Failed to read hidden payment links' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const { paymentLinkId } = await req.json();
    
    if (!paymentLinkId) {
      return NextResponse.json(
        { error: 'Payment link ID is required' },
        { status: 400 }
      );
    }

    await hidePaymentLink(paymentLinkId);
    const hiddenLinks = await getHiddenPaymentLinks();

    return NextResponse.json({
      success: true,
      message: 'Payment link hidden successfully',
      hiddenLinks
    });
  } catch (error) {
    console.error('Error hiding payment link:', error);
    return NextResponse.json(
      { error: 'Failed to hide payment link' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const { paymentLinkId } = await req.json();
    
    if (!paymentLinkId) {
      return NextResponse.json(
        { error: 'Payment link ID is required' },
        { status: 400 }
      );
    }

    await unhidePaymentLink(paymentLinkId);
    const updatedHiddenLinks = await getHiddenPaymentLinks();

    return NextResponse.json({
      success: true,
      message: 'Payment link unhidden successfully',
      hiddenLinks: updatedHiddenLinks
    });
  } catch (error) {
    console.error('Error unhiding payment link:', error);
    return NextResponse.json(
      { error: 'Failed to unhide payment link' },
      { status: 500 }
    );
  }
}
