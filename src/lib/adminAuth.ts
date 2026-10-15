import { NextRequest, NextResponse } from 'next/server';

/**
 * Admin sessions: a signed, expiring cookie (HMAC-SHA256 via Web Crypto, so it works in both
 * route handlers and src/proxy.ts). The cookie can't be forged without the server secret.
 *
 * Secret: ADMIN_SESSION_SECRET (recommended, long random string); falls back to ADMIN_PASSWORD.
 */
export const ADMIN_COOKIE = 'admin_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

const encoder = new TextEncoder();

function getSecret(): string | null {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || null;
}

const toHex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Constant-time string comparison (length is not secret here: both sides are fixed-size hex). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sign(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

export async function createSessionToken(): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  return `${exp}.${await sign(`admin:${exp}`, secret)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  const secret = getSecret();
  if (!token || !secret) return false;
  const [expStr, signature] = token.split('.');
  const exp = Number(expStr);
  if (!signature || !Number.isInteger(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  return safeEqual(signature, await sign(`admin:${exp}`, secret));
}

/** Compares the submitted password to ADMIN_PASSWORD without leaking timing information. */
export async function verifyPassword(input: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const digest = async (s: string) => toHex(await crypto.subtle.digest('SHA-256', encoder.encode(s)));
  return safeEqual(await digest(input), await digest(expected));
}

export async function isAdminRequest(req: NextRequest): Promise<boolean> {
  return verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value);
}

/** Use at the top of an admin-only route handler: `const denied = await requireAdmin(req); if (denied) return denied;` */
export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  if (await isAdminRequest(req)) return null;
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
