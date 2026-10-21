import { NextRequest, NextResponse } from 'next/server';
import { normalizeLocation } from '@/lib/location';
import { VENUE_COOKIE } from '@/lib/venue';

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12; // one day at a stall

// GET /v/<venue> - target of the venue sign QR at a stall: remembers the venue for this phone, then explains how to buy
export async function GET(req: NextRequest, { params }: { params: Promise<{ venue: string }> }) {
  const venue = normalizeLocation((await params).venue);
  if (!venue) return NextResponse.redirect(new URL('/', req.url));

  const response = NextResponse.redirect(new URL(`/venue/welcome?v=${venue}`, req.url));
  response.cookies.set(VENUE_COOKIE, venue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: '/',
  });
  return response;
}
