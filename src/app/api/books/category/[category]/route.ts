import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Category } from '@prisma/client';

// GET /api/books/category/[category] - Get books by category
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    console.log('=== Category API Called ===');
    console.log('Request URL:', req.url);
    
    const resolvedParams = await params;
    console.log('Raw params:', resolvedParams);
    
    const { category } = resolvedParams;
    console.log('Raw category parameter:', JSON.stringify(category));
    
    if (!category) {
      console.log('Category parameter is missing');
      return NextResponse.json({ error: 'Category parameter is required' }, { status: 400 });
    }

    // Decode the category name (in case it has special characters)
    const decodedCategory = decodeURIComponent(category);
    console.log('Decoded category:', JSON.stringify(decodedCategory));
    
    // Test database connection first
    console.log('Testing database connection...');
    const totalBooks = await prisma.book.count();
    console.log(`Total books in database: ${totalBooks}`);
    
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

    console.log(`Found ${books.length} books for category: ${decodedCategory}`);
    
    // Log first book if any
    if (books.length > 0) {
      console.log('First book:', { 
        title: books[0].title, 
        category: books[0].categories[0] 
      });
    }

    return NextResponse.json(booksWithCategories);
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