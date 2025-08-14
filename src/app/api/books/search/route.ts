import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!query || query.trim().length === 0) {
      return NextResponse.json([]);
    }

    const books = await prisma.book.findMany({
      where: {
        title: {
          contains: query.trim(),
          mode: 'insensitive', // Case-insensitive search
        },
      },
      select: {
        id: true,
        title: true,
        price: true,
        author: true,
      },
      take: limit,
      orderBy: {
        title: 'asc',
      },
    });

    return NextResponse.json(books);
  } catch (error) {
    console.error('Error searching books:', error);
    return NextResponse.json(
      { error: 'Failed to search books' },
      { status: 500 }
    );
  }
} 