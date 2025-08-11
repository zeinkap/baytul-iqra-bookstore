import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Function to extract format from title
function extractFormat(title: string): { format: string | null } {
  // Common format patterns
  const formatPatterns = [
    /\[(Paperback|Hardcover|E-book|Digital|Audiobook|CD|DVD)\]/i,
    /\((Paperback|Hardcover|E-book|Digital|Audiobook|CD|DVD)\)/i,
    /-(Paperback|Hardcover|E-book|Digital|Audiobook|CD|DVD)$/i,
    /(Paperback|Hardcover|E-book|Digital|Audiobook|CD|DVD)$/i
  ];

  for (const pattern of formatPatterns) {
    const match = title.match(pattern);
    if (match) {
      const format = match[1];
      return { format };
    }
  }

  // If no format found, return null format
  return { format: null };
}

async function extractAndUpdateFormats() {
  try {
    console.log('🔍 Starting book format extraction...');

    // Get all books
    const books = await prisma.book.findMany();
    console.log(`📚 Found ${books.length} books to process`);

    let updatedCount = 0;
    let formatCount = 0;

    for (const book of books) {
      const { format } = extractFormat(book.title);
      
      if (format) {
        formatCount++;
        console.log(`📖 "${book.title}" -> Format: ${format}`);
      }

      // Update only the format field, keep the original title unchanged
      await prisma.book.update({
        where: { id: book.id },
        data: {
          format: format,
          // title: cleanTitle, // REMOVED - we don't want to change titles
        }
      });

      updatedCount++;
    }

    console.log(`\n✅ Process completed successfully!`);
    console.log(`📊 Total books processed: ${updatedCount}`);
    console.log(`🏷️  Books with identified formats: ${formatCount}`);
    console.log(`📝 Books without format (kept as null): ${updatedCount - formatCount}`);

  } catch (error) {
    console.error('❌ Error during format extraction:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
extractAndUpdateFormats();
