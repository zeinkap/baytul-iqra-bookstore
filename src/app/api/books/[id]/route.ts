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
  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 });
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
  const { title, author, description, price, images, stock, categories } = data;
  // Update book and categories connection
  const book = await prisma.book.update({
    where: { id },
    data: {
      title, author, description, price, images, stock,
      ...(Array.isArray(categories) && {
        categories: {
          set: categories.map((name: string) => ({ name }))
        }
      })
    },
    include: { categories: true }
  });
  return NextResponse.json({
    ...book,
    categories: book.categories.map((cat: Category) => cat.name)
  });
}

// DELETE /api/books/[id] - Delete a book
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.book.delete({ where: { id } });
  return NextResponse.json({ success: true });
} 