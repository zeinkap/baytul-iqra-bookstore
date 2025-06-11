import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/books/[id] - Get a single book
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numId = Number(id);
  if (isNaN(numId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  const book = await prisma.book.findUnique({ where: { id: numId } });
  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(book);
}

// PUT /api/books/[id] - Update a book
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numId = Number(id);
  if (isNaN(numId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  const data = await req.json();
  const { title, author, description, price, image, stock } = data;
  const book = await prisma.book.update({
    where: { id: numId },
    data: { title, author, description, price, image, stock },
  });
  return NextResponse.json(book);
}

// DELETE /api/books/[id] - Delete a book
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numId = Number(id);
  if (isNaN(numId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  await prisma.book.delete({ where: { id: numId } });
  return NextResponse.json({ success: true });
} 