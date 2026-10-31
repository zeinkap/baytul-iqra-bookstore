/**
 * Prints a sign for each venue (no database needed).
 *
 *   npm run qr:venue-signs -- cafe-a bazaar-oct
 *
 * Writes qr-labels/venue-signs.html: one letter-size page per venue, styled like the venue welcome page
 * (/venue/welcome) and using the same steps (src/lib/venueCopy.ts). Book stickers stay the same.
 */
import fs from 'fs';
import path from 'path';
import { normalizeLocation } from '../src/lib/location';
import { VENUE_STEPS, VENUE_STORE_NAME, boldSegments, prettyVenue } from '../src/lib/venueCopy';

const escapeHtml = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function main() {
  const venues = process.argv.slice(2);
  if (venues.length === 0) {
    console.error('Usage: npm run qr:venue-signs -- <venue> [<venue> ...]   (e.g. cafe-a bazaar-oct)');
    process.exit(1);
  }

  // The logo is embedded so the sign prints correctly offline
  const logoPath = path.resolve('public', 'logo-baytul-iqra.png');
  const logo = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;

  const steps = VENUE_STEPS.map(
    (step, i) =>
      `<li><span class="n">${i + 1}.</span> ${boldSegments(step)
        .map((seg) => (seg.bold ? `<strong>${escapeHtml(seg.text)}</strong>` : escapeHtml(seg.text)))
        .join('')}</li>`
  ).join('\n      ');

  const pages: string[] = [];
  for (const raw of venues) {
    const venue = normalizeLocation(raw);
    if (!venue) {
      console.error(`Skipping "${raw}": use lowercase letters, numbers and dashes (e.g. cafe-a)`);
      continue;
    }
    pages.push(`<section class="page">
  <img class="logo" src="${logo}" alt="${escapeHtml(VENUE_STORE_NAME)}">
  <h1>Welcome to ${escapeHtml(prettyVenue(venue))}!</h1>
  <p class="store">${escapeHtml(VENUE_STORE_NAME)}</p>
  <ol>
      ${steps}
  </ol>
</section>`);
  }
  if (pages.length === 0) process.exit(1);

  const outDir = path.resolve('qr-labels');
  fs.mkdirSync(outDir, { recursive: true });
  // Mirrors the welcome page: centered logo, bold heading, grey store name, left-aligned numbered steps
  const html = `<!doctype html><meta charset="utf-8"><title>Venue signs</title>
<style>
  @page { size: letter; margin: 0 }
  * { box-sizing: border-box }
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #1f2937 }
  .page { width: 8.5in; height: 11in; padding: 0.9in 0.7in 0.7in; text-align: center; page-break-after: always; display: flex; flex-direction: column; align-items: center }
  .logo { width: 1.5in; height: 1.5in; object-fit: contain }
  h1 { margin: 0.25in 0 0; font-size: 44pt; font-weight: 700; color: #111827 }
  .store { margin: 0.1in 0 0; font-size: 20pt; color: #4b5563 }
  ol { list-style: none; padding: 0; margin: 0.4in 0 0; text-align: left; font-size: 19pt; line-height: 1.35; max-width: 6.9in }
  li { margin-bottom: 0.16in }
  .n { font-weight: 600 }
</style>${pages.join('\n')}`;
  fs.writeFileSync(path.join(outDir, 'venue-signs.html'), html);
  console.log(`Wrote ${pages.length} venue sign(s) to ${path.join(outDir, 'venue-signs.html')} (open in a browser and print)`);
}

main();
