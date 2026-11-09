import BookDetailClient from './BookDetailClient';
import { notFound, redirect } from 'next/navigation';
import { getCatalogBook, getRelatedCatalogBooks } from '@/lib/catalog';
import { isArtPiece } from '@/lib/artCollection';
import { getArtPieces } from '@/lib/artPages';

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
  // Paintings have their own readable address; old /books/<id> links (cart, wishlist, chat, search) land there
  if (isArtPiece(book.categories)) {
    const art = (await getArtPieces()).find((p) => p.piece.id === book.id);
    if (art) redirect(art.href);
  }
  
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