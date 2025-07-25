import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Define the image updates you want to make
const imageUpdates: { bookId: string; newImages: string[] }[] = [
  // Example: Update a specific book's images
  {
    bookId: "36590090-5b6d-48a3-9a1f-75fd7a993c12",
    newImages: ["/book-images/blessed-birth.jpg"],
  },
  {
    bookId: "ebcda2fd-3981-4d5e-86a0-846380c1ec4b",
    newImages: ["/book-images/a-beautiful-patience.jpg"],
  },
];

async function updateBookImages() {
  console.log('🔄 Starting book image updates...');
  
  try {
    for (const update of imageUpdates) {
      const book = await prisma.book.findUnique({
        where: { id: update.bookId }
      });
      
      if (!book) {
        console.log(`❌ Book with ID ${update.bookId} not found`);
        continue;
      }
      
      console.log(`📚 Updating images for: ${book.title}`);
      console.log(`   Old images: ${book.images.join(', ')}`);
      console.log(`   New images: ${update.newImages.join(', ')}`);
      
      await prisma.book.update({
        where: { id: update.bookId },
        data: { images: update.newImages }
      });
      
      console.log(`✅ Successfully updated images for: ${book.title}`);
    }
    
    console.log('🎉 All image updates completed!');
  } catch (error) {
    console.error('❌ Error updating book images:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
updateBookImages(); 