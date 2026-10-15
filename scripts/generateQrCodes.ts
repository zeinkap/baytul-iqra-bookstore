/**
 * Generates direct-to-cart QR labels for every book.
 *
 *   BASE_URL=https://yourshop.com npm run qr:generate
 *
 * Writes to qr-labels/:
 *   <isbn-or-id>.svg  one QR per book (for custom label software)
 *   labels.html       printable sheet; open in a browser and print (Ctrl/Cmd+P)
 *
 * Each QR encodes {BASE_URL}/b/<isbn>, falling back to the book id when a book
 * has no ISBN. Books with stock 0 are skipped unless INCLUDE_OUT_OF_STOCK=1.
 */
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { prisma } from '../src/lib/prisma';

const baseUrl = (process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? '').replace(/\/$/, '');
const outDir = path.resolve('qr-labels');

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

async function main() {
  if (!baseUrl) {
    console.error('Set BASE_URL to your live site, e.g. BASE_URL=https://yourshop.com npm run qr:generate');
    process.exit(1);
  }

  const books = await prisma.book.findMany({
    where: process.env.INCLUDE_OUT_OF_STOCK ? {} : { stock: { gt: 0 } },
    orderBy: { title: 'asc' },
  });
  fs.mkdirSync(outDir, { recursive: true });

  const labels: string[] = [];
  for (const book of books) {
    const code = book.isbn ?? book.id;
    const url = `${baseUrl}/b/${code}`;
    // Error correction M: tolerates scuffs but keeps the pattern simple for small labels
    const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 4 });
    fs.writeFileSync(path.join(outDir, `${code}.svg`), svg);
    labels.push(`<div class="label">${svg}<div class="t">${esc(book.title)}</div><div class="c">Scan to buy</div></div>`);
  }

  const html = `<!doctype html><meta charset="utf-8"><title>Book QR labels</title>
<style>
  body{font-family:sans-serif;margin:1cm}
  .sheet{display:grid;grid-template-columns:repeat(4,1fr);gap:.4cm}
  .label{break-inside:avoid;border:1px dashed #ccc;padding:.25cm;text-align:center}
  .label svg{width:2.5cm;height:2.5cm}
  .t{font-size:8pt;font-weight:600;line-height:1.1;margin-top:.1cm}
  .c{font-size:7pt;color:#555}
</style><div class="sheet">${labels.join('\n')}</div>`;
  fs.writeFileSync(path.join(outDir, 'labels.html'), html);

  const noIsbn = books.filter((b) => !b.isbn).length;
  console.log(`Generated ${books.length} QR codes in ${outDir}`);
  if (noIsbn) console.log(`${noIsbn} books have no ISBN and use their database id in the URL (run npm run isbn:export to add ISBNs).`);
}

main().finally(() => prisma.$disconnect());
