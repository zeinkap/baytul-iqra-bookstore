/** Coarse device class from a User-Agent. Only this label is stored, never the raw user agent. */
export function deviceFromUserAgent(userAgent: string | null | undefined): 'ios' | 'android' | 'desktop' | 'other' {
  const ua = userAgent ?? '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Macintosh|Windows|X11|Linux|CrOS/i.test(ua)) return 'desktop';
  return 'other';
}
