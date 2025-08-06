import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Category } from '@prisma/client';

// GET /api/books - List all books
export async function GET() {
  const books = await prisma.book.findMany({
    include: { categories: true },
    orderBy: { createdAt: 'desc' }
  });
  const booksWithCategories = books.map(book => ({
    ...book,
    categories: (book.categories as Category[]).map((cat) => cat.name)
  }));
  
  return NextResponse.json(booksWithCategories, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // 5 min cache, 10 min stale
    },
  });
}

// POST /api/books - Add a new book
export async function POST(req: NextRequest) {
  const data = await req.json();
  const { title, author, description, price, images, stock, isBestseller, categories } = data;
  if (!title || !author || !description || !price || !Array.isArray(images) || images.length === 0 || stock == null || !Array.isArray(categories)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  // Connect to existing categories by name
  const categoryConnect = categories.map((name: string) => ({ name }));
  const book = await prisma.book.create({
    data: { title, author, description, price, images, stock, isBestseller: isBestseller || false, categories: { connect: categoryConnect } },
    include: { categories: true }
  });
  return NextResponse.json({
    ...book,
    categories: (book.categories as Category[]).map((cat) => cat.name)
  }, { status: 201 });
} 