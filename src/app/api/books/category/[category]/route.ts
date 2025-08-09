import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Category } from '@prisma/client';

// GET /api/books/category/[category] - Get books by category
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const resolvedParams = await params;
    const { category } = resolvedParams;
    
    if (!category) {
      return NextResponse.json({ error: 'Category parameter is required' }, { status: 400 });
    }

    // Decode the category name (in case it has special characters)
    const decodedCategory = decodeURIComponent(category);
    
    // Query for books in this category (many-to-many)
    const books = await prisma.book.findMany({
      where: {
        categories: {
          some: { name: decodedCategory }
        }
      },
      include: {
        categories: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Map categories to string[]
    const booksWithCategories = books.map(book => ({
      ...book,
      categories: (book.categories as Category[]).map((cat) => cat.name)
    }));

    return NextResponse.json(booksWithCategories, {
      headers: {
      'Cache-Control': 'private, no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      },
    });
  } catch (error) {
    console.error('=== ERROR in category API ===');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack available');
    return NextResponse.json({ 
      error: 'Failed to fetch books',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 

// Note: Avoid exporting non-route functions from this file to satisfy Next.js route typing