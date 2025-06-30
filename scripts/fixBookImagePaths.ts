import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixBookImagePaths() {
  try {
    const books = await prisma.book.findMany();
    for (const book of books) {
      const fixedImages = book.images.map(img => {
        if (img.startsWith('/book-images/http://') || img.startsWith('/book-images/https://')) {
          // Remove the /book-images/ prefix from remote URLs
          return img.replace(/^\/book-images\//, '');
        }
        if (
          img.startsWith('/book-images/') ||
          img.startsWith('http://') ||
          img.startsWith('https://')
        ) {
          return img;
        }
        return `/book-images/${img}`;
      });
      if (JSON.stringify(fixedImages) !== JSON.stringify(book.images)) {
        await prisma.book.update({
          where: { id: book.id },
          data: { images: fixedImages },
        });
        console.log(`✅ Fixed images for: ${book.title}`);
      }
    }
    console.log('All book image paths checked and fixed if needed.');
  } catch (error) {
    console.error('❌ Error fixing book image paths:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixBookImagePaths(); 