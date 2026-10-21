import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { normalizeLocation } from './location';

export const VENUE_COOKIE = 'venue';
export const CURRENT_VENUE_KEY = 'current_venue';

/** Where the books are today, as set in Admin → QR Scans. */
export async function getCurrentVenue(): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: CURRENT_VENUE_KEY } });
  return normalizeLocation(row?.value);
}

/**
 * Which venue a QR scan belongs to. The same books travel between venues, so stickers carry no venue;
 * instead, in order of priority:
 *  1. an explicit ?loc=<venue> in the link,
 *  2. the venue cookie set by scanning a venue sign (/v/<venue>) at a stall,
 *  3. the admin's "current venue" setting.
 */
export async function resolveVenue(explicit: unknown): Promise<string | undefined> {
  const fromLink = normalizeLocation(explicit);
  if (fromLink) return fromLink;
  const fromSign = normalizeLocation((await cookies()).get(VENUE_COOKIE)?.value);
  if (fromSign) return fromSign;
  return (await getCurrentVenue()) ?? undefined;
}
