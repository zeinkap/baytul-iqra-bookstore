import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Define the image updates you want to make
const imageUpdates: { bookId: string; newImages: string[] }[] = [
  {
    bookId: "36590090-5b6d-48a3-9a1f-75fd7a993c12",
    newImages: ["/book-images/blessed-birth.jpg"],
  },
  {
    bookId: "ebcda2fd-3981-4d5e-86a0-846380c1ec4b",
    newImages: ["/book-images/a-beautiful-patience.jpg"],
  },
];

export async function POST() {
  try {
    console.log('🔄 Starting book image updates in PRODUCTION...');
    
    const results: Array<{
      bookId: string;
      title?: string;
      status: string;
      message?: string;
      oldImages?: string[];
      newImages?: string[];
    }> = [];
    
    for (const update of imageUpdates) {
      const book = await prisma.book.findUnique({
        where: { id: update.bookId }
      });
      
      if (!book) {
        results.push({
          bookId: update.bookId,
          status: 'not_found',
          message: 'Book not found'
        });
        continue;
      }
      
      console.log(`📚 Updating images for: ${book.title}`);
      console.log(`   Old images: ${book.images.join(', ')}`);
      console.log(`   New images: ${update.newImages.join(', ')}`);
      
      await prisma.book.update({
        where: { id: update.bookId },
        data: { images: update.newImages }
      });
      
      results.push({
        bookId: update.bookId,
        title: book.title,
        status: 'updated',
        oldImages: book.images,
        newImages: update.newImages
      });
      
      console.log(`✅ Successfully updated images for: ${book.title}`);
    }
    
    console.log('🎉 All production image updates completed!');
    
    return NextResponse.json({
      success: true,
      message: 'Book images updated successfully',
      results
    });
    
  } catch (error) {
    console.error('❌ Error updating book images in production:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update book images'
    }, { status: 500 });
  }
} 