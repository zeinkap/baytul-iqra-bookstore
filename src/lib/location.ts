/**
 * Venue tags travel in QR links as ?loc=cafe-a. Keep them to short lowercase slugs so they are
 * safe to store, show in reports and put in URLs.
 */
export function normalizeLocation(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const slug = input.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,39}$/.test(slug) ? slug : null;
}
