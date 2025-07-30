import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Category } from '@prisma/client';

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
  });
}

// PUT /api/books/[id] - Update a book
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await req.json();
  const { title, author, description, price, images, stock, isBestseller, categories } = data;
  if (!title || !author || !description || !price || !Array.isArray(images) || stock == null || !Array.isArray(categories)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    const categoryConnect = categories.map((name: string) => ({ name }));
    const updatedBook = await prisma.book.update({
    where: { id },
    data: {
        title,
        author,
        description,
        price,
        images,
        stock,
        isBestseller: isBestseller || false,
        categories: {
          set: [], // Disconnect all existing categories first
          connect: categoryConnect,
        },
    },
      include: { categories: true },
  });
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