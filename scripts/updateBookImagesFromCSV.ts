// updateBookImagesFromCSV.ts
// Usage: npx tsx scripts/updateBookImagesFromCSV.ts
// This script reads products_export_1.csv, collects all image URLs for each book (by Title),
// and updates the images array for each book in the database (matched by title) using Prisma.

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

const CSV_PATH = path.join(__dirname, '../products_export_1.csv');

async function main() {
  // Read and parse CSV
  const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  });

  // Map: handle -> { title, images: [{url, pos}] }
  const handleMap: Record<string, { title: string, images: { url: string, pos: number }[] }> = {};

  for (const row of records) {
    const handle = row['Handle']?.trim();
    const title = row['Title']?.trim();
    const imageUrl = row['Image Src']?.trim();
    const imagePos = parseInt(row['Image Position'] || '1', 10);
    if (!handle) continue;
    if (!handleMap[handle]) {
      handleMap[handle] = { title: title || '', images: [] };
    }
    // If this row has a title, prefer it (first row for this handle)
    if (title && !handleMap[handle].title) {
      handleMap[handle].title = title;
    }
    if (imageUrl && imageUrl.startsWith('https://cdn.shopify.com/s/files')) {
      if (!handleMap[handle].images.some(img => img.url === imageUrl)) {
        handleMap[handle].images.push({ url: imageUrl, pos: imagePos });
      }
    }
  }

  // Sort images by position for each handle
  for (const handle in handleMap) {
    handleMap[handle].images.sort((a, b) => a.pos - b.pos);
  }

  let updated = 0;
  const notFound: string[] = [];

  for (const { title, images } of Object.values(handleMap)) {
    if (!title) continue;
    const imageUrls = images.map(img => img.url);
    const book = await prisma.book.findFirst({ where: { title } });
    if (book) {
      await prisma.book.update({ where: { id: book.id }, data: { images: { set: imageUrls } } });
      updated++;
    } else {
      notFound.push(title);
    }
  }

  console.log(`Updated images for ${updated} books.`);
  if (notFound.length) {
    console.log('Titles not found in DB:', notFound);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
}); 