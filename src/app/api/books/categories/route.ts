import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';

// GET /api/books/categories - Get all unique book categories
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      select: { name: true },
      orderBy: { name: 'asc' },
    });
    const categoryList = categories.map((c) => c.name);
    return NextResponse.json(categoryList, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200', // 1 hour cache, 2 hours stale
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
} 

// Exported utility for potential external revalidation
export function revalidateCategories() {
  revalidateTag('categories');
}