/**
 * Fills an EMPTY database with a small, fixed catalog so the Playwright tests have books to work with
 * (used by CI; run locally with `npm run db:seed-test` against a throwaway database).
 *
 * Safety: refuses to run unless DATABASE_URL points at localhost, or if the database already has books.
 */
import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL ?? '';
if (!/@(localhost|127\.0\.0\.1|\[::1\])(:|\/)/.test(url)) {
  console.error('Refusing to seed: DATABASE_URL is not a local database.');
  process.exit(1);
}

const prisma = new PrismaClient();

const CATEGORIES = ['Hadith & Sunnah', 'Biography & Seerah', "Children's Books", 'Quran & Tafsir', 'Dua & Dhikr'];

// Real files from public/book-images, so book cards, the photo viewer and the scan page have pictures
const IMAGES = [
  '/book-images/027d12fe-6754-4920-bbc2-f5729edf65fc-0.webp',
  '/book-images/03637df8-dcae-4937-bdee-0e960550b504-0.jpg',
  '/book-images/056c90fb-6ea0-4ef4-88cf-1a2f823f45f3-0.png',
  '/book-images/05ab26ea-f6c6-4199-bf91-e229d9f5c8a2-0.webp',
];

const BOOKS: { title: string; author: string; price: number; stock: number; categories: string[]; isbn?: string; format?: string; ageRange?: string }[] = [
  { title: 'Forty Hadith for Everyday Life', author: 'Imam Nawawi', price: 14.99, stock: 8, categories: ['Hadith & Sunnah'], format: 'Paperback' },
  { title: 'Gardens of the Righteous', author: 'Imam Nawawi', price: 24.5, stock: 6, categories: ['Hadith & Sunnah', 'Dua & Dhikr'], format: 'Hardcover' },
  { title: 'The Sealed Nectar', author: 'Safiur Rahman Mubarakpuri', price: 29.99, stock: 5, categories: ['Biography & Seerah'], isbn: '9781591440710', format: 'Hardcover' },
  { title: 'Life of the Prophet for Teens', author: 'A. Teacher', price: 18, stock: 7, categories: ['Biography & Seerah', "Children's Books"], ageRange: '10-13', format: 'Paperback' },
  { title: 'My First Surah Book', author: 'Little Readers', price: 9.99, stock: 12, categories: ["Children's Books", 'Quran & Tafsir'], ageRange: '3-5', format: 'Board book' },
  { title: 'Stories of the Prophets for Kids', author: 'Ibn Kathir', price: 16.25, stock: 9, categories: ["Children's Books"], ageRange: '6-9', format: 'Paperback' },
  { title: 'Understanding the Quran', author: 'M. Scholar', price: 32, stock: 4, categories: ['Quran & Tafsir'], format: 'Hardcover' },
  { title: 'Daily Duas Collection', author: 'Dar Al Iqra', price: 7.5, stock: 15, categories: ['Dua & Dhikr'], format: 'Pocket' },
  { title: 'Fortress of the Muslim', author: 'Sa\'id al-Qahtani', price: 11, stock: 10, categories: ['Dua & Dhikr', 'Hadith & Sunnah'], isbn: '9781891540356', format: 'Paperback' },
  { title: 'Out of Stock Classic', author: 'Old Press', price: 12, stock: 0, categories: ['Biography & Seerah'], format: 'Paperback' },
];

async function main() {
  if ((await prisma.book.count()) > 0) {
    console.error('Refusing to seed: the database already has books.');
    process.exit(1);
  }
  for (const name of CATEGORIES) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  }
  for (const [i, book] of BOOKS.entries()) {
    await prisma.book.create({
      data: {
        title: book.title,
        author: book.author,
        description: `<p><strong>${book.title}</strong> by ${book.author}. A seeded book for automated tests.</p>`,
        price: book.price,
        images: [IMAGES[i % IMAGES.length]],
        stock: book.stock,
        isBestseller: i < 3,
        format: book.format ?? null,
        ageRange: book.ageRange ?? null,
        isbn: book.isbn ?? null,
        categories: { connect: book.categories.map((name) => ({ name })) },
      },
    });
  }
  console.log(`Seeded ${CATEGORIES.length} categories and ${BOOKS.length} books.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
