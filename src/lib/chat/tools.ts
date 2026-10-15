import type Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export const CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_books',
    description:
      'Search the bookstore catalog. Use for recommendations by topic, author or age, and for price and stock lookups by title. Returns live price and stock. Call it with a short keyword query (e.g. "seerah", "prayer", "Quran stories") and/or a category and/or the reader age.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Keywords matched against title, author and description. Omit to browse by category or age only.',
        },
        category: {
          type: 'string',
          description: 'Category name (partial match), e.g. "Seerah", "Children".',
        },
        age: {
          type: 'integer',
          description: 'Age of the intended reader in years. Prefers books whose ageRange includes this age.',
        },
        in_stock_only: {
          type: 'boolean',
          description: 'Only return books that are currently in stock.',
        },
        limit: { type: 'integer', description: 'Max results (default 6, max 10).' },
      },
    },
  },
  {
    name: 'get_book',
    description: 'Get full details for one book by its exact id (from a previous search_books result).',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Book id' } },
      required: ['id'],
    },
  },
];

type BookRow = Prisma.BookGetPayload<{ include: { categories: true } }>;

function summarize(book: BookRow, full = false) {
  const description = book.description.trim();
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    price: book.price,
    stock: book.stock,
    inStock: book.stock > 0,
    ageRange: book.ageRange ?? null,
    format: book.format ?? null,
    categories: book.categories.map((c) => c.name),
    bestseller: book.isBestseller,
    url: `/books/${book.id}`,
    description: full || description.length <= 300 ? description : `${description.slice(0, 300)}…`,
  };
}

/** Parses ageRange strings like "6-9", "10+", "All ages" into [min, max]; null if unparseable. */
function parseAgeRange(range: string | null): [number, number] | null {
  if (!range) return null;
  const text = range.toLowerCase();
  if (text.includes('all')) return [0, 120];
  const nums = text.match(/\d+/g)?.map(Number);
  if (!nums || nums.length === 0) return null;
  if (nums.length === 1) return text.includes('+') ? [nums[0], 120] : [nums[0], nums[0]];
  return [Math.min(nums[0], nums[1]), Math.max(nums[0], nums[1])];
}

async function searchBooks(input: Record<string, unknown>) {
  const query = typeof input.query === 'string' ? input.query.trim().slice(0, 100) : '';
  const category = typeof input.category === 'string' ? input.category.trim().slice(0, 60) : '';
  const age = typeof input.age === 'number' && Number.isFinite(input.age) ? input.age : null;
  const inStockOnly = input.in_stock_only === true;
  const limit = Math.min(Math.max(Number(input.limit) || 6, 1), 10);

  const words = query.split(/\s+/).filter((w) => w.length > 1).slice(0, 5);
  const and: Prisma.BookWhereInput[] = [];
  if (words.length > 0) {
    and.push({
      OR: words.flatMap((w) => [
        { title: { contains: w, mode: 'insensitive' as const } },
        { author: { contains: w, mode: 'insensitive' as const } },
        { description: { contains: w, mode: 'insensitive' as const } },
        { categories: { some: { name: { contains: w, mode: 'insensitive' as const } } } },
      ]),
    });
  }
  if (category) and.push({ categories: { some: { name: { contains: category, mode: 'insensitive' } } } });
  if (inStockOnly) and.push({ stock: { gt: 0 } });

  const candidates = await prisma.book.findMany({
    where: and.length > 0 ? { AND: and } : undefined,
    include: { categories: true },
    orderBy: [{ isBestseller: 'desc' }, { updatedAt: 'desc' }],
    take: 60,
  });

  let ranked = candidates;
  if (age !== null) {
    const fits: BookRow[] = [];
    const unknown: BookRow[] = [];
    for (const b of candidates) {
      const r = parseAgeRange(b.ageRange);
      if (!r) unknown.push(b);
      else if (age >= r[0] && age <= r[1]) fits.push(b);
    }
    ranked = [...fits, ...unknown];
  }
  // Prefer in-stock books (stable within the ordering above).
  ranked = [...ranked.filter((b) => b.stock > 0), ...ranked.filter((b) => b.stock <= 0)];

  return { count: Math.min(ranked.length, limit), books: ranked.slice(0, limit).map((b) => summarize(b)) };
}

async function getBook(input: Record<string, unknown>) {
  const id = typeof input.id === 'string' ? input.id : '';
  const book = await prisma.book.findUnique({ where: { id }, include: { categories: true } });
  return book ? summarize(book, true) : { error: 'Book not found' };
}

export async function runChatTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    if (name === 'search_books') return JSON.stringify(await searchBooks(input));
    if (name === 'get_book') return JSON.stringify(await getBook(input));
    return JSON.stringify({ error: `Unknown tool ${name}` });
  } catch (error) {
    console.error(`Chat tool ${name} failed:`, error);
    return JSON.stringify({ error: 'Lookup failed. Ask the customer to try again or contact support.' });
  }
}
