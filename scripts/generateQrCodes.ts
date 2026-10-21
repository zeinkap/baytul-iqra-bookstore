/**
 * Generates direct-to-cart QR labels for every book.
 *
 *   BASE_URL=https://yourshop.com npm run qr:generate
 *
 * Writes to qr-labels/:
 *   <isbn-or-id>.svg  one QR per book (for custom label software)
 *   labels.html       printable sheet; open in a browser and print (Ctrl/Cmd+P)
 *   labels-2x2.pdf    one label per page, 2 x 2 inch (LABEL_SIZE_IN to change), for label-printer apps;
 *                     LABEL_TOP_PADDING_MM=8 adds more white above the QR code if the top prints cut off;
 *                     LABEL_CORNER_MARKS=0 removes the small corner marks (they keep apps that auto-crop PDFs from
 *                     erasing the label's margins)
 *   labels.csv        isbn/title/author/price/url columns for apps that import spreadsheets
 *
 * Venue: you normally do NOT need LOCATION. The same books travel between venues, so sticker links stay
 * venue-free and the venue comes from the admin's "Where are the books today?" setting or a venue sign
 * (see npm run qr:venue-signs). LOCATION=cafe-a is only for a set of books that stays at one venue: it adds
 * ?loc=cafe-a to every link and writes to qr-labels/cafe-a/.
 *
 * Each QR encodes {BASE_URL}/b/<isbn>, falling back to the book id when a book
 * has no ISBN. Books with stock 0 are skipped unless INCLUDE_OUT_OF_STOCK=1.
 */
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { buildLabelsPdf } from '../src/lib/labelPdf';
import { prisma } from '../src/lib/prisma';
import { normalizeLocation } from '../src/lib/location';

const baseUrl = (process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? '').replace(/\/$/, '');
const location = process.env.LOCATION ? normalizeLocation(process.env.LOCATION) : null;
const outDir = path.resolve('qr-labels', location ?? '');

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

async function main() {
  if (process.env.LOCATION && !location) {
    console.error('LOCATION must be a short lowercase slug (letters, numbers, dashes), e.g. LOCATION=cafe-a');
    process.exit(1);
  }
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
  const pdfLabels: { url: string; title: string }[] = [];
  const csvRows: string[] = ['isbn,title,author,price,url'];
  const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  for (const book of books) {
    const code = book.isbn ?? book.id;
    const url = `${baseUrl}/b/${code}${location ? `?loc=${location}` : ''}`;
    // Error correction M: tolerates scuffs but keeps the pattern simple for small labels
    const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 4 });
    fs.writeFileSync(path.join(outDir, `${code}.svg`), svg);
    pdfLabels.push({ url, title: book.title });
    csvRows.push([book.isbn ?? '', book.title, book.author, book.price.toFixed(2), url].map(csvCell).join(','));
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
  fs.writeFileSync(path.join(outDir, 'labels.csv'), '\uFEFF' + csvRows.join('\n') + '\n'); // BOM so Excel/Numbers read UTF-8 titles correctly
  fs.writeFileSync(path.join(outDir, 'labels-2x2.pdf'), await buildLabelsPdf(pdfLabels, Number(process.env.LABEL_SIZE_IN) || 2, { topPaddingMm: process.env.LABEL_TOP_PADDING_MM ? Number(process.env.LABEL_TOP_PADDING_MM) : undefined, cornerMarks: process.env.LABEL_CORNER_MARKS !== '0' }));

  const noIsbn = books.filter((b) => !b.isbn).length;
  console.log(`Generated ${books.length} QR codes in ${outDir} (labels-2x2.pdf, labels.csv, labels.html, one .svg per book)`);
  if (noIsbn) console.log(`${noIsbn} books have no ISBN and use their database id in the URL (run npm run isbn:export to add ISBNs).`);
}

main().finally(() => prisma.$disconnect());
