import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addBook() {
  try {
    console.log('📚 Adding new book to database...\n');
    
    const newBook = {
      title: "25 Keys to a Happy Life [Hardcover]",
      author: "Ismail Kamdar",
      description:
        "In this book, Shaykh Ismail Kamdar explains 25 keys that unlock genuine happiness, inner peace, and contentment. These principles are taken from the Qur'an and Sunnah and are timeless in their application and effectiveness.",
      price: 15.0,
      image: "", // You can add an image URL later
      stock: 10, // Default stock
      category: "Islamic Literature",
    };

    // Check if book already exists
    const existingBook = await prisma.book.findFirst({
      where: { title: newBook.title }
    });

    if (existingBook) {
      console.log('❌ Book already exists in database:');
      console.log(`   Title: ${existingBook.title}`);
      console.log(`   Author: ${existingBook.author}`);
      return;
    }

    // Add the book
    const createdBook = await prisma.book.create({
      data: newBook
    });

    console.log('✅ Successfully added book:');
    console.log(`   Title: ${createdBook.title}`);
    console.log(`   Author: ${createdBook.author}`);
    console.log(`   Price: $${createdBook.price}`);
    console.log(`   Category: ${createdBook.category}`);
    console.log(`   Stock: ${createdBook.stock}`);
    console.log(`   ID: ${createdBook.id}`);

    // Show updated book count
    const totalBooks = await prisma.book.count();
    console.log(`\n📊 Total books in database: ${totalBooks}`);

  } catch (error) {
    console.error('❌ Error adding book:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  addBook().catch(console.error);
}

export default addBook; 