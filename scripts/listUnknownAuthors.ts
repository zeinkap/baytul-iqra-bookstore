import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('📚 Books with "Unknown Author"');
  console.log('================================\n');

  const unknownAuthorBooks = await prisma.book.findMany({
    where: {
      author: 'Unknown Author'
    },
    select: {
      id: true,
      title: true,
      author: true,
      price: true,
      description: true
    },
    orderBy: {
      title: 'asc'
    }
  });

  if (unknownAuthorBooks.length === 0) {
    console.log('🎉 Great! All books already have author information.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${unknownAuthorBooks.length} books with "Unknown Author":\n`);

  unknownAuthorBooks.forEach((book, index) => {
    console.log(`${index + 1}. "${book.title}"`);
    console.log(`   ID: ${book.id}`);
    console.log(`   Price: $${book.price}`);
    
    // Show first 150 characters of description for context
    const shortDesc = book.description.length > 150 
      ? book.description.substring(0, 150) + '...' 
      : book.description;
    console.log(`   Description: ${shortDesc}`);
    console.log('');
  });

  console.log(`\n📊 Total books needing author information: ${unknownAuthorBooks.length}`);
  console.log('\n💡 Run "npx tsx scripts/manualAuthorEntry.ts" to interactively fix these!');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
}); 