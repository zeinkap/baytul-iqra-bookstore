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

  // One simple line icon per step (pick a book, scan, pay, enjoy), in the same order as VENUE_STEPS
  const icon = (paths: string) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  const ICONS = [
    icon('<path d="M4 5.5C4 4.7 4.7 4 5.5 4H19v14H5.5C4.7 18 4 18.7 4 19.5z"/><path d="M4 19.5C4 20.3 4.7 21 5.5 21H19"/><path d="M9 8h6"/>'),
    icon('<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M8 12h8"/>'),
    icon('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/><path d="M7 15h3"/>'),
    icon('<circle cx="12" cy="12" r="9"/><path d="M8.5 14c1 1.4 2.2 2 3.5 2s2.5-.6 3.5-2"/><path d="M9 9.5h.01M15 9.5h.01"/>'),
  ];
  const steps = VENUE_STEPS.map(
    (step, i) =>
      `<li><span class="n">${i + 1}</span><span class="ic">${ICONS[i] ?? ''}</span><span class="t">${boldSegments(step)
        .map((seg) => (seg.bold ? `<strong>${escapeHtml(seg.text)}</strong>` : escapeHtml(seg.text)))
        .join('')}</span></li>`
  ).join('\n      ');

  // Autumn leaves for the header band
  const leaf = (rot: number, fill: string, size: number, x: string, y: string) =>
    `<svg class="leaf" style="left:${x};top:${y};width:${size}in;height:${size}in;transform:rotate(${rot}deg)" viewBox="0 0 24 24"><path fill="${fill}" d="M12 2c1 3 4 4 6 3-1 3 0 5 3 6-3 1-4 3-3 6-3-1-5 0-6 3-1-3-3-4-6-3 1-3 0-5-3-6 3-1 4-3 3-6 3 1 5 0 6-3z"/><path stroke="#0008" stroke-width="0.8" d="M12 22V9"/></svg>`;
  const leaves = [
    leaf(-20, '#d97706', 0.9, '4%', '8%'),
    leaf(25, '#b91c1c', 0.5, '22%', '14%'),
    leaf(35, '#ea580c', 0.85, '86%', '7%'),
    leaf(-30, '#c9a24b', 0.5, '72%', '16%'),
    leaf(12, '#c9a24b', 0.55, '4%', '80%'),
    leaf(-15, '#b91c1c', 0.55, '90%', '80%'),
].join('');

  const pages: string[] = [];
  for (const raw of venues) {
    const venue = normalizeLocation(raw);
    if (!venue) {
      console.error(`Skipping "${raw}": use lowercase letters, numbers and dashes (e.g. cafe-a)`);
      continue;
    }
    pages.push(`<section class="page">
  <header class="band">${leaves}
    <img class="logo" src="${logo}" alt="${escapeHtml(VENUE_STORE_NAME)}">
    <h1>Welcome to ${escapeHtml(prettyVenue(venue))}!</h1>
    <p class="store">${escapeHtml(VENUE_STORE_NAME)}</p>
  </header>
  <p class="tagline">Tap to pay, no cash needed.</p>
  <ol>
      ${steps}
  </ol>
  <div class="pay"><span>Apple Pay</span><span>Google Pay</span><span>Credit / debit card</span></div>
</section>`);
  }
  if (pages.length === 0) process.exit(1);

  const outDir = path.resolve('qr-labels');
  fs.mkdirSync(outDir, { recursive: true });
  // Fall bazaar look: dark header band with leaves, tagline, steps as cards with number + icon, payment badges at the bottom
  const html = `<!doctype html><meta charset="utf-8"><title>Venue signs</title>
<style>
  @page { size: letter; margin: 0 }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact }
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #1f2937 }
  .page { width: 8.5in; height: 11in; text-align: center; page-break-after: always; display: flex; flex-direction: column; align-items: center; background: #fffaf0; border-bottom: 0.22in solid #d97706 }
  .band { position: relative; width: 100%; background: #050505; color: #fff; padding: 0.5in 0.7in 0.45in; border-bottom: 0.1in solid #c9a24b; display: flex; flex-direction: column; align-items: center; overflow: hidden }
  .leaf { position: absolute }
  .logo { width: 1.7in; height: 1.7in; object-fit: contain; position: relative }
  h1 { margin: 0.15in 0 0; font-size: 42pt; font-weight: 800; color: #fff; position: relative }
  .store { margin: 0.08in 0 0; font-size: 18pt; letter-spacing: 0.08em; text-transform: uppercase; color: #e5c36a; position: relative }
  .tagline { margin: 0.4in 0 0; font-size: 26pt; font-weight: 800; color: #b45309 }
  ol { list-style: none; padding: 0; margin: 0.3in 0 0; text-align: left; font-size: 19pt; line-height: 1.3; width: 6.9in }
  li { display: flex; align-items: center; gap: 0.22in; margin-bottom: 0.2in; padding: 0.14in 0.22in; background: #fff; border: 2px solid #f3d9a4; border-radius: 0.2in }
  .n { flex: none; width: 0.55in; height: 0.55in; border-radius: 50%; background: #d97706; color: #fff; font-weight: 800; font-size: 22pt; display: flex; align-items: center; justify-content: center }
  .ic { flex: none; width: 0.55in; height: 0.55in; color: #0f766e }
  .ic svg { width: 100%; height: 100% }
  .t { flex: 1 }
  .pay { margin-top: auto; margin-bottom: 0.45in; display: flex; gap: 0.15in }
  .pay span { padding: 0.09in 0.24in; border: 2px solid #111827; border-radius: 999px; font-size: 14pt; font-weight: 700; color: #111827; background: #fff }
</style>${pages.join('\n')}`;
  fs.writeFileSync(path.join(outDir, 'venue-signs.html'), html);
  console.log(`Wrote ${pages.length} venue sign(s) to ${path.join(outDir, 'venue-signs.html')} (open in a browser and print)`);
}

main();
