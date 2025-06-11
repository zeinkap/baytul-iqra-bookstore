import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/books/search?q=searchterm - Search books by title and author
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q')?.trim();
  
  if (!query) {
    // If no search query, return all books
    const books = await prisma.book.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(books);
  }
  
  // Get all books and filter them for case-insensitive search
  const allBooks = await prisma.book.findMany({ orderBy: { createdAt: 'desc' } });
  const lowercaseQuery = query.toLowerCase();
  
  // Filter results for case-insensitive search
  const filteredBooks = allBooks.filter(book => 
    book.title.toLowerCase().includes(lowercaseQuery) || 
    book.author.toLowerCase().includes(lowercaseQuery)
  );
  
  return NextResponse.json(filteredBooks);
} 