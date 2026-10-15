import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Category } from '@prisma/client';
import { revalidateTag } from 'next/cache';
import { normalizeIsbn } from '@/lib/isbn';

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
  const { title, author, description, price, costPrice, shippingCost, images, stock, isBestseller, format, ageRange, isbn, categories } = data;
  if (!title || !author || !description || !Array.isArray(categories)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  const priceNum = typeof price === 'number' ? price : Number(price);
  const stockNum = typeof stock === 'number' ? stock : Number(stock);
  if (Number.isNaN(priceNum) || priceNum < 0) {
    return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
  }
  if (Number.isNaN(stockNum) || stockNum < 0 || !Number.isInteger(stockNum)) {
    return NextResponse.json({ error: 'Invalid stock (must be a non-negative integer)' }, { status: 400 });
  }
  // Normalize images: optional, filter to valid ones only
  const isValidImageSrc = (src: unknown): src is string =>
    typeof src === 'string' && src.trim().length > 0 && (src.startsWith('/') || /^https?:\/\//.test(src));
  const normalizedImages: string[] = Array.isArray(images) ? images.filter(isValidImageSrc) : [];
  const normalizedFormat = format != null && String(format).trim() !== '' ? String(format).trim() : null;
  const normalizedAgeRange = ageRange != null && String(ageRange).trim() !== '' ? String(ageRange).trim() : null;
  const hasIsbn = isbn != null && String(isbn).trim() !== '';
  const normalizedIsbn = hasIsbn ? normalizeIsbn(String(isbn)) : null;
  if (hasIsbn && !normalizedIsbn) {
    return NextResponse.json({ error: 'Invalid ISBN (must be a valid ISBN-10 or ISBN-13)' }, { status: 400 });
  }
  // Optional numeric fields: only set if valid number
  const optionalCostPrice = costPrice !== undefined && typeof costPrice === 'number' && !Number.isNaN(costPrice) ? costPrice : undefined;
  const optionalShippingCost = shippingCost !== undefined && typeof shippingCost === 'number' && !Number.isNaN(shippingCost) ? shippingCost : undefined;
  // Connect to existing categories by name
  const categoryConnect = categories.map((name: string) => ({ name }));
  try {
    const book = await prisma.book.create({
      data: {
        title: String(title).trim(),
        author: String(author).trim(),
        description: String(description).trim(),
        price: priceNum,
        ...(optionalCostPrice !== undefined && { costPrice: optionalCostPrice }),
        ...(optionalShippingCost !== undefined && { shippingCost: optionalShippingCost }),
        images: normalizedImages,
        stock: stockNum,
        isBestseller: Boolean(isBestseller),
        format: normalizedFormat,
        ageRange: normalizedAgeRange,
        isbn: normalizedIsbn,
        categories: { connect: categoryConnect },
      },
      include: { categories: true }
    });
    // Invalidate caches for any pages/data tagged with 'books'
    revalidateTag('books', { expire: 0 });

    return NextResponse.json({
      ...book,
      categories: (book.categories as Category[]).map((cat) => cat.name)
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create book:', error);
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'A book with this title or ISBN already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create book' }, { status: 500 });
  }
}
