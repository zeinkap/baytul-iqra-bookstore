import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Function to clean title by removing format suffixes
function cleanTitle(title: string): { cleanTitle: string; removedFormat: string | null } {
  // Common format patterns to remove
  const formatPatterns = [
    /\[(Paperback|Hardcover|E-book|Digital|Audiobook|CD|DVD)\]/i,
    /\((Paperback|Hardcover|E-book|Digital|Audiobook|CD|DVD)\)/i,
    /-(Paperback|Hardcover|E-book|Digital|Audiobook|CD|DVD)$/i,
    /(Paperback|Hardcover|E-book|Digital|Audiobook|CD|DVD)$/i
  ];

  for (const pattern of formatPatterns) {
    const match = title.match(pattern);
    if (match) {
      const removedFormat = match[1];
      const cleanTitle = title.replace(pattern, '').trim();
      return { cleanTitle, removedFormat };
    }
  }

  // If no format found, return original title and null
  return { cleanTitle: title, removedFormat: null };
}

async function cleanBookTitles() {
  try {
    console.log('🧹 Starting book title cleanup...');
    
    const books = await prisma.book.findMany({
      select: { id: true, title: true, format: true }
    });
    
    console.log(`📚 Found ${books.length} books to process`);
    
    let updatedCount = 0;
    let cleanedCount = 0;
    let unchangedCount = 0;
    
    for (const book of books) {
      const { cleanTitle: cleanedTitle, removedFormat } = cleanTitle(book.title);
      
      if (removedFormat) {
        cleanedCount++;
        console.log(`🧽 "${book.title}" -> Cleaned: "${cleanedTitle}" (removed: ${removedFormat})`);
        
        // Update the book with the clean title
        await prisma.book.update({
          where: { id: book.id },
          data: { title: cleanedTitle }
        });
      } else {
        unchangedCount++;
        console.log(`⏭️  "${book.title}" -> No changes needed`);
      }
      
      updatedCount++;
    }
    
    console.log(`\n✅ Title cleanup completed successfully!`);
    console.log(`📊 Total books processed: ${updatedCount}`);
    console.log(`🧽 Titles cleaned: ${cleanedCount}`);
    console.log(`⏭️  Titles unchanged: ${unchangedCount}`);
    
    if (cleanedCount > 0) {
      console.log(`\n💡 Note: Format information is preserved in the 'format' field`);
      console.log(`📖 You can now display clean titles with format badges separately`);
    }
    
  } catch (error) {
    console.error('❌ Error during title cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanBookTitles();
