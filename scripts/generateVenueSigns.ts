/**
 * Prints a sign with a QR code for each venue (no database needed).
 *
 *   BASE_URL=https://www.baytuliqra.com npm run qr:venue-signs -- cafe-a bazaar-oct
 *
 * Writes qr-labels/venue-signs.html: one page per venue. Customers who scan a sign get a short "how to buy"
 * page and their purchases are credited to that venue for the day. Book stickers stay the same.
 */
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { normalizeLocation } from '../src/lib/location';

const baseUrl = (process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? '').replace(/\/$/, '');
const pretty = (slug: string) => slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

async function main() {
  const venues = process.argv.slice(2);
  if (!baseUrl || venues.length === 0) {
    console.error('Usage: BASE_URL=https://yourshop.com npm run qr:venue-signs -- <venue> [<venue> ...]   (e.g. cafe-a bazaar-oct)');
    process.exit(1);
  }
  const pages: string[] = [];
  for (const raw of venues) {
    const venue = normalizeLocation(raw);
    if (!venue) {
      console.error(`Skipping "${raw}": use lowercase letters, numbers and dashes (e.g. cafe-a)`);
      continue;
    }
    const svg = await QRCode.toString(`${baseUrl}/v/${venue}`, { type: 'svg', errorCorrectionLevel: 'M', margin: 4 });
    pages.push(`<section class="page">
  <h1>Self-service books</h1>
  <h2>${pretty(venue)}</h2>
  <div class="qr">${svg}</div>
  <p class="big">Scan to see how it works</p>
  <ol>
    <li>Find the QR sticker on the back of any book</li>
    <li>Scan it with your phone camera</li>
    <li>Tap <b>Buy now</b> and pay with Apple Pay, Google Pay or card</li>
  </ol>
  <p class="small">Baytul Iqra Bookstore · Tax included</p>
</section>`);
  }
  if (pages.length === 0) process.exit(1);

  const outDir = path.resolve('qr-labels');
  fs.mkdirSync(outDir, { recursive: true });
  const html = `<!doctype html><meta charset="utf-8"><title>Venue signs</title>
<style>
  body{font-family:sans-serif;margin:0}
  .page{page-break-after:always;text-align:center;padding:1.5cm}
  h1{font-size:28pt;margin:0 0 .2cm} h2{font-size:22pt;margin:0 0 .6cm;color:#047857}
  .qr svg{width:11cm;height:11cm} .big{font-size:20pt;font-weight:700;margin:.4cm 0}
  ol{display:inline-block;text-align:left;font-size:15pt;line-height:1.6} .small{font-size:11pt;color:#555}
</style>${pages.join('\n')}`;
  fs.writeFileSync(path.join(outDir, 'venue-signs.html'), html);
  console.log(`Wrote ${pages.length} venue sign(s) to ${path.join(outDir, 'venue-signs.html')} (open in a browser and print)`);
}

main();
