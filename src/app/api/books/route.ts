import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/books - List all books
export async function GET() {
  const books = await prisma.book.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(books);
}

// POST /api/books - Add a new book
export async function POST(req: NextRequest) {
  const data = await req.json();
  const { title, author, description, price, image, stock } = data;
  if (!title || !author || !description || !price || !image || stock == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  const book = await prisma.book.create({
    data: { title, author, description, price, image, stock },
  });
  return NextResponse.json(book, { status: 201 });
} 