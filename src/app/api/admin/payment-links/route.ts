import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { promises as fs } from 'fs';
import path from 'path';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const HIDDEN_LINKS_FILE = path.join(process.cwd(), 'data', 'hidden-payment-links.json');

// Read hidden payment link IDs
async function readHiddenLinks(): Promise<string[]> {
  try {
    const data = await fs.readFile(HIDDEN_LINKS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    // File doesn't exist or is invalid, return empty array
    return [];
  }
}

export async function GET() {
  try {
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
    const hiddenLinks = await readHiddenLinks();

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
    return NextResponse.json(
      { error: 'Failed to fetch payment links' },
      { status: 500 }
    );
  }
}
