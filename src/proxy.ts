import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';

// Server-side gate for admin pages: no valid signed session means no admin page is ever served.
// (Admin API routes check the session themselves with requireAdmin.)
export async function proxy(req: NextRequest) {
  if (req.nextUrl.pathname === '/admin/login') return NextResponse.next();
  if (await isAdminRequest(req)) return NextResponse.next();
  return NextResponse.redirect(new URL('/admin/login', req.url));
}

export const config = {
  matcher: ['/admin/:path*'],
};
