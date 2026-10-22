import BookDetailClient from './BookDetailClient';
import { notFound } from 'next/navigation';
import { getCatalogBook, getRelatedCatalogBooks } from '@/lib/catalog';

export type Book = {
  id: string;
  title: string;
  author: string;
  description: string;
  price: number;
  images: string[];
  stock: number;
  format?: string;
  categories: string[];
  createdAt: string;
  updatedAt: string;
};

export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book: Book | null = await getCatalogBook(id);
  if (!book) return notFound();
  
  const relatedBooks: Book[] = await getRelatedCatalogBooks(book.categories, book.id);
  
  return (
    <>
      {/* Preload the main book image for faster loading */}
      {book.images && book.images[0] && (
        <link
          rel="preload"
          as="image"
          href={book.images[0]}
          type="image/webp"
        />
      )}
      <BookDetailClient book={book} relatedBooks={relatedBooks} />
    </>
  );
} 