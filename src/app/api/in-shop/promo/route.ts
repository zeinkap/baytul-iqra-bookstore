import { NextRequest, NextResponse } from 'next/server';
import { priceItems, resolveInShopPromo, subtotalCentsOf } from '@/lib/pricing';
import { isRateLimited } from '@/lib/chat/rateLimit';

/**
 * Checks one promo code against what the customer is buying (priced on the server at in-person prices) and says
 * what it takes off. Nothing is saved: the code is applied for real when the payment starts.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    // Blunts guessing codes
    if (isRateLimited(`in-shop-promo:${ip}`, 30, 60_000)) {
      return NextResponse.json({ error: 'Too many tries. Please wait a moment.' }, { status: 429 });
    }
    const { items: rawItems, code } = await req.json();
    const priced = await priceItems(rawItems, 'in-shop');
    if (!priced.ok) return NextResponse.json({ error: priced.error }, { status: priced.status });

    const subtotalCents = subtotalCentsOf(priced.items);
    const result = await resolveInShopPromo(code, subtotalCents);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ code: result.code, subtotalCents, discountCents: result.discountCents, finalCents: result.finalCents });
  } catch (err) {
    console.error('Error checking in-shop promo code:', err);
    return NextResponse.json({ error: 'Could not check the code. Please try again.' }, { status: 500 });
  }
}
