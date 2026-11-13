import { cookies } from 'next/headers';
import { unstable_cache } from 'next/cache';
import { prisma } from './prisma';
import { normalizeLocation } from './location';

export const VENUE_COOKIE = 'venue';
export const CURRENT_VENUE_KEY = 'current_venue';
/** Cache tag for the "current venue" lookup; the admin route that changes the setting revalidates it. */
export const VENUE_CACHE_TAG = 'venue';

/** Where the books are today, as set in Admin → QR Scans. */
export async function getCurrentVenue(): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: CURRENT_VENUE_KEY } });
  return normalizeLocation(row?.value);
}

/**
 * Same as getCurrentVenue, kept in the data cache so most QR scans don't wait on a database query for it. The admin
 * route that changes the setting expires the tag right away; the 5-minute limit is only a safety net.
 * (Development reads fresh, like the catalog helpers.)
 */
const getCurrentVenueCached =
  process.env.NODE_ENV === 'production'
    ? unstable_cache(getCurrentVenue, ['current-venue'], { tags: [VENUE_CACHE_TAG], revalidate: 300 })
    : getCurrentVenue;

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
  return (await getCurrentVenueCached()) ?? undefined;
}
