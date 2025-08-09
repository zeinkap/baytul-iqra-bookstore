import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Category } from '@prisma/client';
import { revalidateTag } from 'next/cache';

// GET /api/books - List all books
export async function GET(req: NextRequest) {
  const books = await prisma.book.findMany({
    include: { categories: true },
    orderBy: { createdAt: 'desc' }
  });
  const booksWithCategories = books.map(book => ({
    ...book,
    categories: (book.categories as Category[]).map((cat) => cat.name)
  }));

  // Allow cache bypass for admin/editor views
  const bypass = req.nextUrl.searchParams.get('bypassCache');
  if (bypass) {
    return NextResponse.json(booksWithCategories, {
      headers: {
        // Prevent CDN and browser caching
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  }

  // Default to no-store to avoid CDN staleness; rely on Next.js fetch cache with tags instead
  return NextResponse.json(booksWithCategories, {
    headers: {
      'Cache-Control': 'private, no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  });
}

// POST /api/books - Add a new book
export async function POST(req: NextRequest) {
  const data = await req.json();
  const { title, author, description, price, images, stock, isBestseller, categories } = data;
  if (!title || !author || !description || !price || stock == null || !Array.isArray(categories)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  // Normalize images: optional, filter to valid ones only
  const isValidImageSrc = (src: unknown): src is string =>
    typeof src === 'string' && src.trim().length > 0 && (src.startsWith('/') || /^https?:\/\//.test(src));
  const normalizedImages: string[] = Array.isArray(images) ? images.filter(isValidImageSrc) : [];
  // Connect to existing categories by name
  const categoryConnect = categories.map((name: string) => ({ name }));
  const book = await prisma.book.create({
    data: { title, author, description, price, images: normalizedImages, stock, isBestseller: isBestseller || false, categories: { connect: categoryConnect } },
    include: { categories: true }
  });
  // Invalidate caches for any pages/data tagged with 'books'
  revalidateTag('books');

  return NextResponse.json({
    ...book,
    categories: (book.categories as Category[]).map((cat) => cat.name)
  }, { status: 201 });
} 