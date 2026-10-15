import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';
import { normalizeIsbn } from '@/lib/isbn';
import ScanBook from './ScanBook';
import ScanLogger from './ScanLogger';

// Always look the book up fresh: stock changes and QR labels are printed once
export const dynamic = 'force-dynamic';

type Suggestion = { id: string; title: string; author: string; price: number; image: string; code: string };

/** In-stock books sharing categories (and age range) with the given book, best matches first. */
async function similarBooks(book: { id: string; ageRange: string | null; categories: { id: number }[] }): Promise<Suggestion[]> {
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
    b.categories.filter((c) => categoryIds.includes(c.id)).length * 2 + (book.ageRange && b.ageRange === book.ageRange ? 1 : 0) + (b.isBestseller ? 0.5 : 0);
  const ranked = candidates.sort((a, b) => score(b) - score(a)).slice(0, 4).map(toSuggestion);
  return ranked.length > 0 ? ranked : popularBooks(book.id);
}

/** Fallback when there's nothing to compare with: in-stock bestsellers, then newest. */
async function popularBooks(excludeId?: string): Promise<Suggestion[]> {
  const books = await prisma.book.findMany({
    where: { stock: { gt: 0 }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    orderBy: [{ isBestseller: 'desc' }, { createdAt: 'desc' }],
    take: 4,
  });
  return books.map(toSuggestion);
}

function toSuggestion(b: { id: string; isbn: string | null; title: string; author: string; price: number; images: string[] }): Suggestion {
  return { id: b.id, title: b.title, author: b.author, price: b.price, image: b.images[0] ?? '', code: b.isbn ?? b.id };
}

/**
 * Direct-to-cart landing page for QR labels stuck on physical books.
 * `code` is an ISBN (preferred) or the book id (fallback for books without one).
 */
export default async function ScanBookPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const isbn = normalizeIsbn(decodeURIComponent(code));

  const book = await prisma.book.findFirst({
    where: isbn ? { OR: [{ isbn }, { id: code }] } : { id: code },
    include: { categories: { select: { id: true } } },
  });

  if (!book) {
    return (
      <Message code={code} title="We couldn't find that book" suggestions={await popularBooks()} suggestionsTitle="Popular right now">
        Sorry, that label isn't linked to a book. Here are some books you might like.
      </Message>
    );
  }

  if (book.stock <= 0) {
    return (
      <Message code={code} title={`"${book.title}" is out of stock`} suggestions={await similarBooks(book)} suggestionsTitle="Similar books you can buy now">
        Sorry about that. These are similar and available right now.
      </Message>
    );
  }

  return (
    <>
      <ScanLogger code={code} />
      <ScanBook
        code={book.isbn ?? book.id}
        stock={book.stock}
        description={book.description}
        ageRange={book.ageRange ?? undefined}
        images={book.images}
        book={{
          id: book.id,
          title: book.title,
          author: book.author,
          price: book.price,
          image: book.images[0] ?? '',
          format: book.format ?? undefined,
        }}
      />
    </>
  );
}

function Message({
  code,
  title,
  children,
  suggestions,
  suggestionsTitle,
}: {
  code: string;
  title: string;
  children: React.ReactNode;
  suggestions: Suggestion[];
  suggestionsTitle: string;
}) {
  return (
    <main className="max-w-md mx-auto px-4 pt-6 pb-10 text-center">
      <ScanLogger code={code} />
      <div className="flex flex-col items-center mb-4">
        <Image src="/logo-baytul-iqra.png" alt="Baytul Iqra Bookstore" width={64} height={64} className="w-16 h-16 object-contain" priority />
        <p className="mt-1 text-sm font-semibold text-emerald-800">Baytul Iqra Bookstore</p>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2" data-testid="scan-message-title">{title}</h1>
      <p className="text-gray-600 mb-6">{children}</p>

      {suggestions.length > 0 && (
        <section className="text-left mb-6" data-testid="scan-suggestions">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">{suggestionsTitle}</h2>
          <ul className="grid grid-cols-2 gap-3">
            {suggestions.map((s) => (
              <li key={s.id}>
                <Link href={`/b/${s.code}`} className="block bg-white rounded-xl border border-gray-100 shadow-sm p-3 h-full">
                  {s.image && (
                    <div className="relative mx-auto mb-2 w-24 h-32">
                      <Image src={s.image} alt={s.title} fill sizes="96px" className="object-contain" />
                    </div>
                  )}
                  <p className="text-sm font-semibold text-gray-900 line-clamp-2">{s.title}</p>
                  <p className="text-xs text-gray-500 line-clamp-1">{s.author}</p>
                  <p className="text-sm font-bold text-emerald-700 mt-1">${s.price.toFixed(2)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link href="/" className="inline-block px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500">
        Browse all books
      </Link>
    </main>
  );
}
