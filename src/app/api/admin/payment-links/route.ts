import { NextResponse, NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import Stripe from 'stripe';
import { getHiddenPaymentLinks } from '@/lib/hiddenPaymentLinks';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    // Check if Stripe secret key is properly configured
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey || stripeKey === 'sk_test_placeholder' || stripeKey.length < 20) {
      console.error('Invalid or missing Stripe secret key');
      return NextResponse.json(
        { 
          error: 'Stripe is not properly configured. Please set a valid STRIPE_SECRET_KEY in your .env file.',
          details: 'Current key is invalid or placeholder'
        },
        { status: 500 }
      );
    }

    // Fetch payment links from Stripe with expanded data
    const paymentLinks = await stripe.paymentLinks.list({
      limit: 50, // Get the most recent 50 payment links
    });

    // Debug: log the raw data from Stripe
    console.log('Raw payment links from Stripe:', paymentLinks.data.map(link => ({
      id: link.id,
      object: link.object,
      active: link.active
    })));

    // Get hidden payment link IDs
    const hiddenLinks = await getHiddenPaymentLinks();

    // Transform the data to match our interface and filter out hidden links
    const transformedLinks = paymentLinks.data
      .filter(link => !hiddenLinks.includes(link.id))
      .map(link => ({
        id: link.id,
        url: link.url,
        active: link.active,
        created: null, // Stripe PaymentLink doesn't have a created field
        metadata: link.metadata,
      }));

    return NextResponse.json(transformedLinks);
  } catch (error) {
    console.error('Error fetching payment links:', error);
    
    // Provide more specific error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Failed to fetch payment links',
        details: errorMessage,
        hint: errorMessage.includes('key') ? 'Check your Stripe API key configuration' : undefined
      },
      { status: 500 }
    );
  }
}
