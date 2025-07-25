import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/books/categories - Get all unique book categories
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      select: { name: true },
      orderBy: { name: 'asc' },
    });
    const categoryList = categories.map((c) => c.name);
    return NextResponse.json(categoryList);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
} 