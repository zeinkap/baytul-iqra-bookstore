import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

async function setupProduction() {
  try {
    console.log('Setting up production database...\n');
    
    // Check if books already exist
    const existingBooks = await prisma.book.count();
    
    if (existingBooks > 0) {
      console.log(`Database already has ${existingBooks} books. Skipping import.`);
      return;
    }
    
    console.log('No books found. Importing from CSV...');
    
    // Read and parse the CSV file
    const csvPath = path.join(process.cwd(), 'products_export_1.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      delimiter: ','
    });

    console.log(`Found ${records.length} books to import`);

    // Category mapping function
    function categorizeBook(title: string, description: string): string {
      const text = (title + ' ' + description).toLowerCase();
      
      if (text.includes('quran') || text.includes('tafsir') || text.includes('recitation')) {
        return 'Quran & Tafsir';
      }
      if (text.includes('hadith') || text.includes('sunnah') || text.includes('bukhari') || 
          text.includes('muslim') || text.includes('prophetic') || text.includes('prophet') ||
          text.includes('hajj') || text.includes('umrah') || text.includes('pilgrimage')) {
        return 'Hadith & Sunnah';
      }
      if (text.includes('biography') || text.includes('seerah') || text.includes('life of') ||
          text.includes('companion') || text.includes('sahaba') || text.includes('caliph')) {
        return 'Biography & Seerah';
      }
      if (text.includes('children') || text.includes('kids') || text.includes('little') ||
          text.includes('stories') || text.includes('activity')) {
        return 'Children\'s Books';
      }
      if (text.includes('game') || text.includes('puzzle') || text.includes('box of') ||
          text.includes('what to say') || text.includes('activity book')) {
        return 'Children\'s Games';
      }
      if (text.includes('dua') || text.includes('dhikr') || text.includes('prayer') ||
          text.includes('supplication')) {
        return 'Dua & Dhikr';
      }
      if (text.includes('history') || text.includes('historical') || text.includes('conquest')) {
        return 'Islamic History';
      }
      if (text.includes('fiqh') || text.includes('law') || text.includes('legal') ||
          text.includes('jurisprudence')) {
        return 'Fiqh & Islamic Law';
      }
      if (text.includes('aqeedah') || text.includes('theology') || text.includes('belief') ||
          text.includes('creed')) {
        return 'Aqeedah & Theology';
      }
      
      return 'Islamic Literature';
    }

    // Import books with proper categories
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
    }

    const finalCount = await prisma.book.count();
    console.log(`✅ Successfully imported ${finalCount} books!`);
    
    // Show category distribution
    const categories = await prisma.book.groupBy({
      by: ['category'],
      _count: { category: true }
    });
    
    console.log('\nCategory distribution:');
    categories.forEach(cat => {
      console.log(`- ${cat.category}: ${cat._count.category} books`);
    });

  } catch (error) {
    console.error('Error setting up production database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupProduction(); 