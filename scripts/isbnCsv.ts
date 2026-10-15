/**
 * Fill in ISBNs in bulk.
 *
 *   npm run isbn:export   -> writes isbn-template.csv (id,title,author,isbn) for every book
 *   (fill in the isbn column in a spreadsheet, save)
 *   npm run isbn:apply    -> reads isbn-template.csv and updates books that have an ISBN filled in
 *
 * Pass a different file as the 2nd arg: npx tsx scripts/isbnCsv.ts apply path/to/file.csv
 */
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { prisma } from '../src/lib/prisma';
import { normalizeIsbn } from '../src/lib/isbn';

const csvPath = path.resolve(process.argv[3] ?? 'isbn-template.csv');

const csvCell = (v: string | null) => `"${(v ?? '').replace(/"/g, '""')}"`;

async function exportCsv() {
  const books = await prisma.book.findMany({ orderBy: { title: 'asc' } });
  const lines = ['id,title,author,isbn', ...books.map((b) => [b.id, b.title, b.author, b.isbn].map(csvCell).join(','))];
  fs.writeFileSync(csvPath, lines.join('\n') + '\n');
  const missing = books.filter((b) => !b.isbn).length;
  console.log(`Wrote ${books.length} books to ${csvPath} (${missing} without an ISBN)`);
}

async function applyCsv() {
  const rows: { id: string; title: string; isbn?: string }[] = parse(fs.readFileSync(csvPath, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });

  let updated = 0;
  for (const row of rows) {
    if (!row.isbn?.trim()) continue;
    const isbn = normalizeIsbn(row.isbn);
    if (!isbn) {
      console.warn(`SKIP invalid ISBN "${row.isbn}" for "${row.title}"`);
      continue;
    }
    try {
      await prisma.book.update({ where: { id: row.id }, data: { isbn } });
      updated++;
    } catch (e) {
      console.warn(`SKIP "${row.title}": ${e instanceof Error ? e.message.split('\n').pop() : e}`);
    }
  }
  console.log(`Updated ${updated} books`);
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'export') await exportCsv();
  else if (mode === 'apply') await applyCsv();
  else console.error('Usage: tsx scripts/isbnCsv.ts <export|apply> [file.csv]');
}

main().finally(() => prisma.$disconnect());
