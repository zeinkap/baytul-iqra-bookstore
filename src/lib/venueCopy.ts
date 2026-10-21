/**
 * The "how it works" text shown on the venue welcome page (/venue/welcome) and printed on the venue signs
 * (npm run qr:venue-signs). One source so the sign and the page always say the same thing.
 * Text between ** ** is shown bold.
 */
export const VENUE_STEPS = [
  'Pick a book and find the QR sticker on the back cover.',
  'Scan it with your phone camera.',
  'Tap **Buy now** and pay with Apple Pay, Google Pay or card.',
  'Enjoy your book! A receipt is emailed to you.',
];

export const VENUE_STORE_NAME = 'Baytul Iqra Bookstore';

/** "cafe-a" -> "Cafe A" */
export const prettyVenue = (slug: string) =>
  slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/** Splits "Tap **Buy now** and pay" into [{text, bold}] segments. */
export function boldSegments(step: string): { text: string; bold: boolean }[] {
  return step.split('**').map((text, i) => ({ text, bold: i % 2 === 1 })).filter((s) => s.text);
}
