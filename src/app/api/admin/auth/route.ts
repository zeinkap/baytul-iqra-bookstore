import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  isAdminRequest,
  verifyPassword,
} from '@/lib/adminAuth';
import { isRateLimited } from '@/lib/chat/rateLimit';

export async function POST(req: NextRequest) {
  try {
    // Best-effort brute-force protection (per instance): 5 attempts per 15 minutes per IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (isRateLimited(`admin-login:${ip}`, 5, 15 * 60_000)) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    }

    const { password } = await req.json();
    if (!process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Admin password not configured' }, { status: 500 });
    }
    if (typeof password !== 'string' || !(await verifyPassword(password))) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    const token = await createSessionToken();
    if (!token) {
      return NextResponse.json({ error: 'Admin password not configured' }, { status: 500 });
    }
    const response = NextResponse.json({ success: true });
    response.cookies.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: SESSION_TTL_SECONDS,
      path: '/',
    });
    return response;
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Verify authentication status
export async function GET(req: NextRequest) {
  if (await isAdminRequest(req)) {
    return NextResponse.json({ authenticated: true });
  }
  return NextResponse.json({ authenticated: false }, { status: 401 });
}

// Logout endpoint
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(ADMIN_COOKIE);
  response.cookies.delete('adminAuth'); // legacy cookie from before signed sessions
  return response;
}
