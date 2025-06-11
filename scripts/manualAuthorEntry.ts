import { prisma } from '../src/lib/prisma';
import * as readline from 'readline';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to ask questions
function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('📚 Manual Author Entry Tool');
  console.log('===============================\n');

  // Find all books with "Unknown Author"
  const unknownAuthorBooks = await prisma.book.findMany({
    where: {
      author: 'Unknown Author'
    },
    orderBy: {
      title: 'asc'
    }
  });

  if (unknownAuthorBooks.length === 0) {
    console.log('🎉 Great! All books already have author information.');
    rl.close();
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${unknownAuthorBooks.length} books with "Unknown Author"\n`);

  for (let i = 0; i < unknownAuthorBooks.length; i++) {
    const book = unknownAuthorBooks[i];
    
    console.log(`\n📖 Book ${i + 1} of ${unknownAuthorBooks.length}`);
    console.log(`Title: "${book.title}"`);
    console.log(`Current Author: ${book.author}`);
    console.log(`Price: $${book.price}`);
    
    // Show a preview of the description
    const shortDescription = book.description.length > 100 
      ? book.description.substring(0, 100) + '...' 
      : book.description;
    console.log(`Description: ${shortDescription}`);
    
    console.log('\nOptions:');
    console.log('1. Enter author name');
    console.log('2. Skip this book');
    console.log('3. Exit (save progress and quit)');
    
    const choice = await askQuestion('\nWhat would you like to do? (1/2/3): ');
    
    if (choice === '1') {
      const authorName = await askQuestion('Enter the author name: ');
      
      if (authorName && authorName.length > 0) {
        await prisma.book.update({
          where: { id: book.id },
          data: { author: authorName }
        });
        
        console.log(`✅ Updated "${book.title}" -> Author: ${authorName}`);
      } else {
        console.log('❌ No author name entered, skipping...');
      }
      
    } else if (choice === '2') {
      console.log('⏭️ Skipping this book...');
      
    } else if (choice === '3') {
      console.log('💾 Saving progress and exiting...');
      break;
      
    } else {
      console.log('❌ Invalid choice, skipping this book...');
    }
  }

  // Show final status
  const remainingUnknown = await prisma.book.count({
    where: { author: 'Unknown Author' }
  });

  console.log('\n📊 Final Status:');
  console.log(`Books remaining with "Unknown Author": ${remainingUnknown}`);
  
  if (remainingUnknown === 0) {
    console.log('🎉 Congratulations! All books now have author information!');
  }

  rl.close();
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Error:', e);
  rl.close();
  process.exit(1);
}); 