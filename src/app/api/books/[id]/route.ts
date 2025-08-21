import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Category } from '@prisma/client';
import { revalidateTag } from 'next/cache';

// GET /api/books/[id] - Get a single book
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const book = await prisma.book.findUnique({
    where: { id },
    include: { categories: true }
  });
  if (!book) return NextResponse.json({ error: 'Book not found' }, { status: 404 });
  return NextResponse.json({
    ...book,
    categories: book.categories.map((cat: Category) => cat.name)
  }, {
    headers: {
      'Cache-Control': 'private, no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  });
}

// PUT /api/books/[id] - Update a book
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await req.json();
  const { title, author, description, price, costPrice, images, stock, isBestseller, format, categories } = data;
  if (!title || !author || !description || !price || stock == null || !Array.isArray(categories)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  const isValidImageSrc = (src: unknown): src is string =>
    typeof src === 'string' && src.trim().length > 0 && (src.startsWith('/') || /^https?:\/\//.test(src));
  const normalizedImages: string[] = Array.isArray(images) ? images.filter(isValidImageSrc) : [];

  try {
    const categoryConnect = categories.map((name: string) => ({ name }));
    const updatedBook = await prisma.book.update({
    where: { id },
    data: {
        title,
        author,
        description,
        price,
        costPrice: costPrice !== undefined ? costPrice : undefined,
        images: normalizedImages,
        stock,
        isBestseller: isBestseller || false,
        format,
        categories: {
          set: [], // Disconnect all existing categories first
          connect: categoryConnect,
        },
    },
      include: { categories: true },
  });
  // Revalidate book listings/details caches
  revalidateTag('books');

  return NextResponse.json({
      ...updatedBook,
      categories: updatedBook.categories.map((cat: Category) => cat.name)
  });
  } catch (error) {
    console.error("Failed to update book:", error);
    return NextResponse.json({ error: 'Failed to update book' }, { status: 500 });
  }
}

// PATCH /api/books/[id] - Update specific fields (like bestseller status)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await req.json();
  
  try {
    const updatedBook = await prisma.book.update({
      where: { id },
      data,
      include: { categories: true },
    });
    // Revalidate caches for books data
    revalidateTag('books');
    return NextResponse.json({
      ...updatedBook,
      categories: updatedBook.categories.map((cat: Category) => cat.name)
    });
  } catch (error) {
    console.error("Failed to update book:", error);
    // Check for specific Prisma error for record not found
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update book' }, { status: 500 });
  }
}

// DELETE /api/books/[id] - Delete a book
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.book.delete({
      where: { id },
    });
    // Revalidate caches for books data
    revalidateTag('books');
    return NextResponse.json({ message: 'Book deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Failed to delete book:', error);
    // Check for specific Prisma error for record not found
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete book' }, { status: 500 });
  }
} 