import { prisma } from '../src/lib/prisma';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// Available categories matching our navbar dropdown
const categories = [
  'Quran & Tafsir',
  'Hadith & Sunnah',
  'Islamic History',
  'Fiqh & Islamic Law',
  'Aqeedah & Theology',
  'Biography & Seerah',
  'Islamic Ethics',
  'Dua & Dhikr',
  'Children\'s Books',
  'Islamic Literature'
];

// Auto-categorization rules based on keywords
const categoryKeywords = {
  'Quran & Tafsir': ['quran', 'tafsir', 'quranic', 'surah', 'verse', 'tajweed', 'recitation'],
  'Hadith & Sunnah': ['hadith', 'sunnah', 'bukhari', 'muslim', 'prophetic', 'tradition'],
  'Islamic History': ['history', 'empire', 'caliphate', 'conquest', 'civilization', 'timeline'],
  'Fiqh & Islamic Law': ['fiqh', 'law', 'ruling', 'fatwa', 'jurisprudence', 'halal', 'haram'],
  'Aqeedah & Theology': ['aqeedah', 'creed', 'theology', 'belief', 'faith', 'tawhid'],
  'Biography & Seerah': ['biography', 'seerah', 'prophet', 'muhammad', 'companion', 'sahaba'],
  'Islamic Ethics': ['ethics', 'morality', 'akhlaq', 'character', 'virtue', 'moral'],
  'Dua & Dhikr': ['dua', 'dhikr', 'prayer', 'supplication', 'remembrance', 'worship'],
  'Children\'s Books': ['children', 'kids', 'child', 'young', 'story', 'tale']
};

function suggestCategory(title: string, description: string): string {
  const text = (title + ' ' + description).toLowerCase();
  
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return category;
    }
  }
  
  return 'Islamic Literature'; // Default category
}

async function main() {
  console.log('📚 Book Category Assignment Tool');
  console.log('=================================\n');

  const books = await prisma.book.findMany({
    orderBy: { title: 'asc' }
  });

  console.log(`Found ${books.length} books to categorize.\n`);

  let processedCount = 0;
  let updatedCount = 0;

  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    
    console.log(`\n📖 Book ${i + 1} of ${books.length}`);
    console.log(`Title: "${book.title}"`);
    console.log(`Author: ${book.author}`);
    console.log(`Current Category: ${book.category}`);
    
    // Show a preview of the description
    const shortDescription = book.description.length > 150 
      ? book.description.substring(0, 150) + '...' 
      : book.description;
    console.log(`Description: ${shortDescription}`);
    
    // Suggest a category based on content
    const suggestedCategory = suggestCategory(book.title, book.description);
    if (suggestedCategory !== book.category) {
      console.log(`\n💡 Suggested Category: ${suggestedCategory}`);
    }
    
    console.log('\nAvailable Categories:');
    categories.forEach((cat, index) => {
      console.log(`${index + 1}. ${cat}`);
    });
    
    console.log('\nOptions:');
    console.log('a. Auto-assign suggested category');
    console.log('s. Skip this book');
    console.log('q. Quit');
    console.log('1-10. Choose category by number');
    
    const choice = await askQuestion('\nWhat would you like to do? ');
    
    if (choice.toLowerCase() === 'q') {
      console.log('\n✋ Stopping here. Progress saved!');
      break;
    }
    
    if (choice.toLowerCase() === 's') {
      console.log('⏭️  Skipped');
      processedCount++;
      continue;
    }
    
    let newCategory = book.category;
    
    if (choice.toLowerCase() === 'a') {
      newCategory = suggestedCategory;
    } else {
      const categoryIndex = parseInt(choice) - 1;
      if (categoryIndex >= 0 && categoryIndex < categories.length) {
        newCategory = categories[categoryIndex];
      } else {
        console.log('❌ Invalid choice, skipping...');
        processedCount++;
        continue;
      }
    }
    
    if (newCategory !== book.category) {
      await prisma.book.update({
        where: { id: book.id },
        data: { category: newCategory }
      });
      console.log(`✅ Updated to: ${newCategory}`);
      updatedCount++;
    } else {
      console.log('ℹ️  No change needed');
    }
    
    processedCount++;
  }

  console.log(`\n🎉 Categorization complete!`);
  console.log(`📊 Processed: ${processedCount} books`);
  console.log(`✏️  Updated: ${updatedCount} books`);

  rl.close();
  await prisma.$disconnect();
}

main().catch(console.error); 