import { prisma } from '../src/lib/prisma';

// Auto-categorization rules based on keywords
const categoryKeywords = {
  'Quran & Tafsir': ['quran', 'tafsir', 'quranic', 'surah', 'verse', 'tajweed', 'recitation', 'holy quran'],
  'Hadith & Sunnah': ['hadith', 'sunnah', 'bukhari', 'muslim', 'prophetic', 'tradition', 'sahih'],
  'Islamic History': ['history', 'empire', 'caliphate', 'conquest', 'civilization', 'timeline', 'islamic history'],
  'Fiqh & Islamic Law': ['fiqh', 'law', 'ruling', 'fatwa', 'jurisprudence', 'halal', 'haram', 'sharia'],
  'Aqeedah & Theology': ['aqeedah', 'creed', 'theology', 'belief', 'faith', 'tawhid', 'islamic belief'],
  'Biography & Seerah': ['biography', 'seerah', 'prophet', 'muhammad', 'companion', 'sahaba', 'life of'],
  'Islamic Ethics': ['ethics', 'morality', 'akhlaq', 'character', 'virtue', 'moral', 'manners'],
  'Dua & Dhikr': ['dua', 'dhikr', 'prayer', 'supplication', 'remembrance', 'worship', 'prayers'],
  'Children\'s Books': ['children', 'kids', 'child', 'young', 'story', 'tale', 'for children']
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
  console.log('🤖 Auto-Categorizing Books');
  console.log('===========================\n');

  const books = await prisma.book.findMany({
    orderBy: { title: 'asc' }
  });

  console.log(`Found ${books.length} books to auto-categorize.\n`);

  let updatedCount = 0;
  const categoryStats: { [key: string]: number } = {};

  for (const book of books) {
    const suggestedCategory = suggestCategory(book.title, book.description);
    
    if (suggestedCategory !== book.category) {
      await prisma.book.update({
        where: { id: book.id },
        data: { category: suggestedCategory }
      });
      console.log(`📚 "${book.title}" → ${suggestedCategory}`);
      updatedCount++;
    }
    
    // Track category statistics
    categoryStats[suggestedCategory] = (categoryStats[suggestedCategory] || 0) + 1;
  }

  console.log(`\n🎉 Auto-categorization complete!`);
  console.log(`✏️  Updated: ${updatedCount} books\n`);
  
  console.log('📊 Category Distribution:');
  console.log('========================');
  Object.entries(categoryStats)
    .sort(([,a], [,b]) => b - a)
    .forEach(([category, count]) => {
      console.log(`${category}: ${count} books`);
    });

  await prisma.$disconnect();
}

main().catch(console.error); 