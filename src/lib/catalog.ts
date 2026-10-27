import { unstable_cache } from 'next/cache';
import { prisma } from './prisma';

// Storefront pages read the catalog straight from the database (no HTTP hop to our own API) and keep the result
// in the Next.js data cache. The 'books' / 'categories' tags are the ones the admin routes already revalidate.

const bookWithCategories = { categories: { select: { name: true } } } as const;

type BookRow = NonNullable<Awaited<ReturnType<typeof findBook>>>;
const findBook = (id: string) => prisma.book.findUnique({ where: { id }, include: bookWithCategories });

/** Same shape the /api/books endpoints return: category names instead of rows, dates as ISO strings. */
function toCatalogBook(book: BookRow) {
  return {
    ...book,
    // Pages treat a missing format as undefined (JSON drops it, so cached and fresh results look the same)
    format: book.format ?? undefined,
    categories: book.categories.map((c) => c.name),
    createdAt: book.createdAt.toISOString(),
    updatedAt: book.updatedAt.toISOString(),
  };
}

/** In development every request reads fresh data, like the fetch calls this replaces. */
function cached<Args extends unknown[], T>(fn: (...args: Args) => Promise<T>, key: string, tag: string, revalidate: number) {
  if (process.env.NODE_ENV !== 'production') return fn;
  return unstable_cache(fn, [key], { tags: [tag], revalidate });
}

export const getCatalogBooks = cached(
  async () => {
    const books = await prisma.book.findMany({ include: bookWithCategories, orderBy: { createdAt: 'desc' } });
    return books.map(toCatalogBook);
  },
  'catalog-books',
  'books',
  300
);

export const getCatalogBook = cached(
  async (id: string) => {
    const book = await findBook(id);
    return book ? toCatalogBook(book) : null;
  },
  'catalog-book',
  'books',
  60
);

export const getCatalogCategories = cached(
  async () => (await prisma.category.findMany({ select: { name: true }, orderBy: { name: 'asc' } })).map((c) => c.name),
  'catalog-categories',
  'categories',
  300
);

/** Up to 5 newest books that share a category with the given book (a query, not the whole catalog). */
export const getRelatedCatalogBooks = cached(
  async (categories: string[], currentBookId: string) => {
    if (categories.length === 0) return [];
    const books = await prisma.book.findMany({
      where: { id: { not: currentBookId }, categories: { some: { name: { in: categories } } } },
      include: bookWithCategories,
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    return books.map(toCatalogBook);
  },
  'catalog-related',
  'books',
  300
);

/**
 * Book behind a scanned QR label, looked up by ISBN or id. Kept for a few seconds so a busy venue's scans don't each
 * wait on the database; stock is checked again on the server when someone pays. Dates come back as ISO strings.
 */
export const getScanBook = cached(
  async (isbn: string | null, code: string) => {
    const book = await prisma.book.findFirst({
      where: isbn ? { OR: [{ isbn }, { id: code }] } : { id: code },
      include: { categories: { select: { id: true } } },
    });
    return book && { ...book, createdAt: book.createdAt.toISOString(), updatedAt: book.updatedAt.toISOString() };
  },
  'scan-book',
  'books',
  15
);
