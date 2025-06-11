import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

async function migrateToPostgreSQL() {
  try {
    console.log('🐘 Setting up PostgreSQL database for production...\n');
    
    // Check if books already exist
    const existingBooks = await prisma.book.count();
    console.log(`Current books in database: ${existingBooks}`);
    
    if (existingBooks > 0) {
      console.log('✅ Database already has books. Migration complete!');
      return;
    }
    
    console.log('📚 No books found. Importing from CSV...');
    
    // Read and parse the CSV file
    const csvPath = path.join(process.cwd(), 'products_export_1.csv');
    
    if (!fs.existsSync(csvPath)) {
      console.error('❌ CSV file not found at:', csvPath);
      return;
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      delimiter: ','
    });

    console.log(`📖 Found ${records.length} books to import`);

    // Enhanced category mapping function
    function categorizeBook(title: string, description: string): string {
      const text = (title + ' ' + description).toLowerCase();
      
      // Children's Games - check first for specific game indicators
      if (text.includes('game') || text.includes('puzzle') || text.includes('box of') ||
          text.includes('what to say when') || text.includes('activity book') ||
          text.includes('sticker book')) {
        return 'Children\'s Games';
      }
      
      // Quran & Tafsir
      if (text.includes('quran') || text.includes('tafsir') || text.includes('recitation') ||
          text.includes('quranic') || text.includes('surah')) {
        return 'Quran & Tafsir';
      }
      
      // Hadith & Sunnah
      if (text.includes('hadith') || text.includes('sunnah') || text.includes('bukhari') || 
          text.includes('muslim') || text.includes('prophetic') || text.includes('prophet') ||
          text.includes('hajj') || text.includes('umrah') || text.includes('pilgrimage') ||
          text.includes('methodology')) {
        return 'Hadith & Sunnah';
      }
      
      // Biography & Seerah
      if (text.includes('biography') || text.includes('seerah') || text.includes('life of') ||
          text.includes('companion') || text.includes('sahaba') || text.includes('caliph') ||
          text.includes('khadijah') || text.includes('prophet') && text.includes('mercy')) {
        return 'Biography & Seerah';
      }
      
      // Children's Books
      if (text.includes('children') || text.includes('kids') || text.includes('little') ||
          text.includes('my first') || text.includes('touch & feel') || text.includes('ramadan') && text.includes('activity')) {
        return 'Children\'s Books';
      }
      
      // Dua & Dhikr
      if (text.includes('dua') || text.includes('dhikr') || text.includes('prayer') ||
          text.includes('supplication') || text.includes('daily') || text.includes('morning') ||
          text.includes('evening')) {
        return 'Dua & Dhikr';
      }
      
      // Islamic History
      if (text.includes('history') || text.includes('historical') || text.includes('conquest') ||
          text.includes('stories') && text.includes('sahaba')) {
        return 'Islamic History';
      }
      
      // Fiqh & Islamic Law
      if (text.includes('fiqh') || text.includes('law') || text.includes('legal') ||
          text.includes('jurisprudence') || text.includes('behind') || text.includes('guide') && text.includes('fasting')) {
        return 'Fiqh & Islamic Law';
      }
      
      // Aqeedah & Theology
      if (text.includes('aqeedah') || text.includes('theology') || text.includes('belief') ||
          text.includes('creed') || text.includes('allah') && text.includes('knows') ||
          text.includes('prophets') && text.includes('stories')) {
        return 'Aqeedah & Theology';
      }
      
      // Default to Islamic Literature
      return 'Islamic Literature';
    }

    // Import books with proper categories
    console.log('🔄 Importing books...\n');
    let importCount = 0;
    
    for (const record of records) {
      const book = {
        title: record.Title || 'Untitled',
        author: record.Author || 'Unknown Author',
        description: record.Description || '',
        price: parseFloat(record.Price) || 0,
        image: record.Image || '',
        stock: parseInt(record.Stock) || 0,
        category: categorizeBook(record.Title || '', record.Description || '')
      };

      await prisma.book.create({ data: book });
      importCount++;
      
      if (importCount % 10 === 0) {
        console.log(`✅ Imported ${importCount}/${records.length} books...`);
      }
    }

    const finalCount = await prisma.book.count();
    console.log(`\n🎉 Successfully imported ${finalCount} books!`);
    
    // Show category distribution
    const categories = await prisma.book.groupBy({
      by: ['category'],
      _count: { category: true }
    });
    
    console.log('\n📊 Category distribution:');
    categories
      .sort((a, b) => b._count.category - a._count.category)
      .forEach(cat => {
        console.log(`   ${cat.category}: ${cat._count.category} books`);
      });

    console.log('\n✅ PostgreSQL migration complete! 🚀');

  } catch (error) {
    console.error('❌ Error during PostgreSQL migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  migrateToPostgreSQL().catch(console.error);
}

export default migrateToPostgreSQL; 