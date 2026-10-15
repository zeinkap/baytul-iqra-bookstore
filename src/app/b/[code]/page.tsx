import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { normalizeIsbn } from '@/lib/isbn';
import ScanBook from './ScanBook';

// Always look the book up fresh: stock changes and QR labels are printed once
export const dynamic = 'force-dynamic';

/**
 * Direct-to-cart landing page for QR labels stuck on physical books.
 * `code` is an ISBN (preferred) or the book id (fallback for books without one).
 */
export default async function ScanBookPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const isbn = normalizeIsbn(decodeURIComponent(code));

  const book = await prisma.book.findFirst({
    where: isbn ? { OR: [{ isbn }, { id: code }] } : { id: code },
  });

  if (!book) {
    return (
      <Message title="We couldn't find that book">
        Try browsing the shelf instead.
      </Message>
    );
  }

  if (book.stock <= 0) {
    return (
      <Message title={`"${book.title}" is out of stock`}>
        Sorry about that. Ask the staff or browse for something similar.
      </Message>
    );
  }

  return (
    <ScanBook
      code={book.isbn ?? book.id}
      stock={book.stock}
      description={book.description}
      ageRange={book.ageRange ?? undefined}
      book={{
        id: book.id,
        title: book.title,
        author: book.author,
        price: book.price,
        image: book.images[0] ?? '',
        format: book.format ?? undefined,
      }}
    />
  );
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="max-w-md mx-auto px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
      <p className="text-gray-600 mb-6">{children}</p>
      <Link href="/" className="inline-block px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500">
        Browse books
      </Link>
    </main>
  );
}
