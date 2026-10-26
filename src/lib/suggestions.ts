import { prisma } from './prisma';
import { unitPrice } from './pricing';

/** Suggestions are shown on the QR scan page, so they carry the in-person price. */
export type Suggestion = { id: string; title: string; author: string; price: number; image: string; code: string };

type BookForSuggestions = { id: string; ageRange: string | null; categories: { id: number }[] };

function toSuggestion(b: { id: string; isbn: string | null; title: string; author: string; price: number; inShopPrice: number | null; images: string[] }): Suggestion {
  return { id: b.id, title: b.title, author: b.author, price: unitPrice(b, 'in-shop'), image: b.images[0] ?? '', code: b.isbn ?? b.id };
}

/** Fallback when there's nothing to compare with: in-stock bestsellers, then newest. */
export async function popularBooks(excludeId?: string): Promise<Suggestion[]> {
  const books = await prisma.book.findMany({
    where: { stock: { gt: 0 }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    orderBy: [{ isBestseller: 'desc' }, { createdAt: 'desc' }],
    take: 4,
  });
  return books.map(toSuggestion);
}

/** In-stock books sharing categories (and age range) with the given book, best matches first. */
export async function similarBooks(book: BookForSuggestions): Promise<Suggestion[]> {
  const categoryIds = book.categories.map((c) => c.id);
  const or = [
    ...(categoryIds.length ? [{ categories: { some: { id: { in: categoryIds } } } }] : []),
    ...(book.ageRange ? [{ ageRange: book.ageRange }] : []),
  ];
  if (or.length === 0) return popularBooks(book.id);

  const candidates = await prisma.book.findMany({
    where: { stock: { gt: 0 }, id: { not: book.id }, OR: or },
    include: { categories: { select: { id: true } } },
    take: 24,
  });
  const score = (b: (typeof candidates)[number]) =>
    b.categories.filter((c) => categoryIds.includes(c.id)).length * 2 +
    (book.ageRange && b.ageRange === book.ageRange ? 1 : 0) +
    (b.isBestseller ? 0.5 : 0);
  const ranked = candidates.sort((a, b) => score(b) - score(a)).slice(0, 4).map(toSuggestion);
  return ranked.length > 0 ? ranked : popularBooks(book.id);
}
