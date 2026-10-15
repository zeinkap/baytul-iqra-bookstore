/**
 * Add extra image URLs to books in bulk.
 *
 *   npm run images:export             -> writes book-images.csv with books that have 0-1 images
 *   npm run images:export -- --all    -> include every book
 *   (fill the add_image_1..add_image_4 columns in a spreadsheet, save)
 *   npm run images:apply -- --dry-run -> shows what would change, writes nothing
 *   npm run images:apply              -> appends the new URLs to each book's existing images
 *
 * Existing images are never removed or reordered; new URLs are appended after them and
 * repeats are skipped. Use a different file with: npm run images:apply -- path/to/file.csv
 * Valid URLs: https://... or a site path like /book-images/foo.jpg
 */
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { prisma } from '../src/lib/prisma';
import { collectNewImages } from '../src/lib/imageCsv';

const args = process.argv.slice(3);
const dryRun = args.includes('--dry-run');
const includeAll = args.includes('--all');
const csvPath = path.resolve(args.find((a) => !a.startsWith('--')) ?? 'book-images.csv');
const NEW_COLUMNS = 4;

const csvCell = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;

async function exportCsv() {
  const books = await prisma.book.findMany({ orderBy: { title: 'asc' } });
  const rows = books.filter((b) => includeAll || b.images.length <= 1);
  const header = ['id', 'title', 'image_count', 'current_images', ...Array.from({ length: NEW_COLUMNS }, (_, i) => `add_image_${i + 1}`)];
  const lines = [
    header.join(','),
    ...rows.map((b) => [b.id, b.title, b.images.length, b.images.join(' | '), ...Array(NEW_COLUMNS).fill('')].map(csvCell).join(',')),
  ];
  fs.writeFileSync(csvPath, lines.join('\n') + '\n');
  console.log(`Wrote ${rows.length} of ${books.length} books to ${csvPath}${includeAll ? '' : ' (books with 0-1 images; use --all for every book)'}`);
}

async function applyCsv() {
  const rows: Record<string, string>[] = parse(fs.readFileSync(csvPath, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });

  let updated = 0;
  let imagesAdded = 0;
  for (const row of rows) {
    const label = row.title || row.id;
    const book = row.id ? await prisma.book.findUnique({ where: { id: row.id }, select: { id: true, images: true } }) : null;
    if (!book) {
      if (Object.keys(row).some((c) => /^add_image/i.test(c) && row[c]?.trim())) console.warn(`SKIP "${label}": no book with that id`);
      continue;
    }

    const { toAdd, invalid } = collectNewImages(row, book.images);
    for (const url of invalid) console.warn(`SKIP invalid URL for "${label}": ${url}`);
    if (toAdd.length === 0) continue;

    console.log(`${dryRun ? 'WOULD ADD' : 'ADD'} ${toAdd.length} image(s) to "${label}" (${book.images.length} -> ${book.images.length + toAdd.length})`);
    if (!dryRun) {
      await prisma.book.update({ where: { id: book.id }, data: { images: { set: [...book.images, ...toAdd] } } });
    }
    updated++;
    imagesAdded += toAdd.length;
  }
  console.log(`${dryRun ? 'Dry run: would update' : 'Updated'} ${updated} books with ${imagesAdded} new images`);
  if (!dryRun && updated > 0) console.log('The storefront may take a few minutes to show them (cached book lists refresh on a timer).');
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'export') await exportCsv();
  else if (mode === 'apply') await applyCsv();
  else console.error('Usage: tsx scripts/imageUrlsCsv.ts <export|apply> [file.csv] [--dry-run] [--all]');
}

main().finally(() => prisma.$disconnect());
