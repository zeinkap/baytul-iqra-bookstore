import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import { prisma } from '../src/lib/prisma';

const csvPath = path.join(__dirname, '../products_export_1.csv');

/**
 * @typedef {Object} CsvBook
 * @property {string} Title
 * @property {string=} Vendor
 * @property {string=} 'Body (HTML)'
 * @property {string} 'Variant Price'
 * @property {string=} 'Image Src'
 * @property {string=} 'Variant Inventory Qty'
 */

async function main() {
  /** @type {CsvBook[]} */
  const records = [];
  const parser = fs
    .createReadStream(csvPath)
    .pipe(parse({ columns: true, skip_empty_lines: true }));

  for await (const record of parser) {
    // Only import rows with a title and price
    if (!record['Title'] || !record['Variant Price']) continue;
    records.push(record);
  }

  for (const record of records) {
    const title = record['Title'].trim();
    const author = record['Vendor']?.trim() || 'Unknown';
    const description = record['Body (HTML)']?.trim() || '';
    const price = parseFloat(record['Variant Price']) || 0;
    const images = record['Image Src']?.split(',').map((img: string) => img.trim()) || [];
    const stock = parseInt(record['Variant Inventory Qty'] || '0') || 0;

    // Avoid duplicates by title
    const exists = await prisma.book.findFirst({ where: { title } });
    if (exists) continue;

    await prisma.book.create({
      data: {
        title,
        author,
        description,
        price,
        images: { set: images },
        stock,
      },
    });
    console.log(`Imported: ${title}`);
  }

  console.log('Import complete!');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}); 