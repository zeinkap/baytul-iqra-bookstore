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
  categories: string[];
  createdAt: string;
  updatedAt: string;
};

async function getBook(id: string): Promise<Book | null> {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const res = await fetch(`${baseUrl}/api/books/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) return notFound();
  return <BookDetailClient book={book} />;
} 