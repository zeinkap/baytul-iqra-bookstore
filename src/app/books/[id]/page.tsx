import BookDetailClient from './BookDetailClient';
import { notFound } from 'next/navigation';

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

async function getBook(id: string): Promise<Book | null> {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const res = await fetch(`${baseUrl}/api/books/${id}`, { 
    next: { revalidate: 600, tags: ['books'] } // Cache for 10 minutes, tag for revalidation
  });
  if (!res.ok) return null;
  return res.json();
}

async function getRelatedBooks(categories: string[], currentBookId: string): Promise<Book[]> {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  
  try {
    // Get all books
    const res = await fetch(`${baseUrl}/api/books`, { 
      next: { revalidate: 300, tags: ['books'] } // Cache for 5 minutes, tag for revalidation
    });
    if (!res.ok) return [];
    
    const allBooks: Book[] = await res.json();
    
    // Filter books that share categories with the current book, excluding the current book
    const relatedBooks = allBooks
      .filter(book => 
        book.id !== currentBookId && 
        book.categories.some(category => categories.includes(category))
      )
      .slice(0, 5); // Limit to 5 books
    
    return relatedBooks;
  } catch (error) {
    console.error('Error fetching related books:', error);
    return [];
  }
}

export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) return notFound();
  
  const relatedBooks = await getRelatedBooks(book.categories, book.id);
  
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