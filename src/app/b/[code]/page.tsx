import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';
import { normalizeIsbn } from '@/lib/isbn';
import { htmlToText } from '@/lib/htmlToText';
import ScanBook from './ScanBook';
import ScanLogger from './ScanLogger';
import { resolveVenue } from '@/lib/venue';
import { unitPrice } from '@/lib/pricing';
import BookSuggestions from '@/components/BookSuggestions';
import { similarBooks, popularBooks, type Suggestion } from '@/lib/suggestions';

// Always look the book up fresh: stock changes and QR labels are printed once
export const dynamic = 'force-dynamic';

/**
 * Direct-to-cart landing page for QR labels stuck on physical books.
 * `code` is an ISBN (preferred) or the book id (fallback for books without one).
 */
export default async function ScanBookPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { code } = await params;
  const isbn = normalizeIsbn(decodeURIComponent(code));

  // The venue lookup (cookie + settings row) and the book query don't depend on each other
  const [location, book] = await Promise.all([
    searchParams.then((sp) => resolveVenue(sp.loc)),
    prisma.book.findFirst({
      where: isbn ? { OR: [{ isbn }, { id: code }] } : { id: code },
      include: { categories: { select: { id: true } } },
    }),
  ]);

  if (!book) {
    return (
      <Message code={code} location={location} title="We couldn't find that book" suggestions={await popularBooks()} suggestionsTitle="Popular right now">
        Sorry, that label isn&apos;t linked to a book. Here are some books you might like.
      </Message>
    );
  }

  if (book.stock <= 0) {
    return (
      <Message code={code} location={location} title={`"${book.title}" is out of stock`} suggestions={await similarBooks(book)} suggestionsTitle="Similar books you can buy now">
        Sorry about that. These are similar and available right now.
      </Message>
    );
  }

  return (
    <>
      <ScanLogger code={code} location={location} />
      <ScanBook
        location={location}
        code={book.isbn ?? book.id}
        stock={book.stock}
        description={htmlToText(book.description)}
        ageRange={book.ageRange ?? undefined}
        images={book.images}
        book={{
          id: book.id,
          title: book.title,
          author: book.author,
          price: unitPrice(book, 'in-shop'),
          image: book.images[0] ?? '',
          format: book.format ?? undefined,
        }}
      />
    </>
  );
}

function Message({
  code,
  location,
  title,
  children,
  suggestions,
  suggestionsTitle,
}: {
  code: string;
  location?: string;
  title: string;
  children: React.ReactNode;
  suggestions: Suggestion[];
  suggestionsTitle: string;
}) {
  return (
    <main className="max-w-md mx-auto px-4 pt-6 pb-10 text-center">
      <ScanLogger code={code} location={location} />
      <div className="flex flex-col items-center mb-4">
        <Image src="/logo-baytul-iqra.png" alt="Baytul Iqra Bookstore" width={64} height={64} className="w-16 h-16 object-contain" priority />
        <p className="mt-1 text-sm font-semibold text-emerald-800">Baytul Iqra Bookstore</p>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2" data-testid="scan-message-title">{title}</h1>
      <p className="text-gray-600 mb-6">{children}</p>

      <div className="mb-6">
        <BookSuggestions title={suggestionsTitle} suggestions={suggestions} />
      </div>

      <Link href="/" className="inline-block px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500">
        Browse all books
      </Link>
    </main>
  );
}
