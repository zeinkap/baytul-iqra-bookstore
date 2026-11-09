import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ART_CATEGORY } from '@/lib/artCollection';

// GET /api/books/categories - Get all unique book categories
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      select: { name: true },
      orderBy: { name: 'asc' },
    });
    // Always offer the art category in the admin's picker, even before the first painting creates it
    const categoryList = [...new Set([...categories.map((c) => c.name), ART_CATEGORY])].sort((a, b) => a.localeCompare(b));
    return NextResponse.json(categoryList, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200', // 1 hour cache, 2 hours stale
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
} 

// Note: Avoid exporting non-route functions from this file to satisfy Next.js route typing