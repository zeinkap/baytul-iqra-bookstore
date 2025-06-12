import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import * as readline from 'readline';

const prisma = new PrismaClient();

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

async function restoreFromBackup(backupFilePath?: string) {
  try {
    console.log('🔄 Starting database restore from backup...\n');
    
    const backupDir = path.join(process.cwd(), 'backups');
    
    // If no backup file specified, show available backups
    if (!backupFilePath) {
      if (!fs.existsSync(backupDir)) {
        console.log('❌ No backups directory found. Please create a backup first.');
        return;
      }
      
      const backupFiles = fs.readdirSync(backupDir)
        .filter(file => file.startsWith('books-backup-') && file.endsWith('.json'))
        .sort()
        .reverse(); // Latest first
      
      if (backupFiles.length === 0) {
        console.log('❌ No backup files found. Please create a backup first.');
        return;
      }
      
      console.log('📁 Available backup files:');
      backupFiles.forEach((file, index) => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        const size = (stats.size / 1024).toFixed(2);
        console.log(`   ${index + 1}. ${file} (${size} KB) - ${stats.mtime.toLocaleString()}`);
      });
      
      const choice = await askQuestion('\nSelect backup file number (or press Enter for latest): ');
      const selectedIndex = choice ? parseInt(choice) - 1 : 0;
      
      if (selectedIndex < 0 || selectedIndex >= backupFiles.length) {
        console.log('❌ Invalid selection');
        return;
      }
      
      backupFilePath = path.join(backupDir, backupFiles[selectedIndex]);
    }
    
    // Verify backup file exists
    if (!fs.existsSync(backupFilePath)) {
      console.log(`❌ Backup file not found: ${backupFilePath}`);
      return;
    }
    
    // Read and parse backup file
    const backupContent = fs.readFileSync(backupFilePath, 'utf-8');
    const backupData = JSON.parse(backupContent);
    
    console.log(`📖 Backup file: ${path.basename(backupFilePath)}`);
    console.log(`📅 Backup date: ${new Date(backupData.backupDate).toLocaleString()}`);
    console.log(`📚 Books in backup: ${backupData.totalBooks}`);
    
    // Check current database state
    const currentBookCount = await prisma.book.count();
    console.log(`📊 Current books in database: ${currentBookCount}`);
    
    if (currentBookCount > 0) {
      console.log('\n⚠️  WARNING: This will replace all existing books in the database!');
      const confirm = await askQuestion('Are you sure you want to continue? (yes/no): ');
      
      if (confirm.toLowerCase() !== 'yes') {
        console.log('❌ Restore cancelled');
        return;
      }
      
      // Clear existing books
      const deletedCount = await prisma.book.deleteMany({});
      console.log(`🗑️  Deleted ${deletedCount.count} existing books`);
    }
    
    // Restore books
    console.log('\n🔄 Restoring books...');
    let restoredCount = 0;
    
    for (const book of backupData.books) {
      // Remove the id to let the database auto-generate new ones
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...bookData } = book;
      
      // Convert date strings back to Date objects
      bookData.createdAt = new Date(book.createdAt);
      bookData.updatedAt = new Date(book.updatedAt);
      
      await prisma.book.create({ data: bookData });
      restoredCount++;
      
      if (restoredCount % 10 === 0) {
        console.log(`   ✅ Restored ${restoredCount}/${backupData.totalBooks} books...`);
      }
    }
    
    const finalCount = await prisma.book.count();
    console.log(`\n🎉 Successfully restored ${finalCount} books!`);
    
    // Show category distribution after restore
    const categories = await prisma.book.groupBy({
      by: ['category'],
      _count: { category: true }
    });
    
    console.log('\n📊 Restored category distribution:');
    categories
      .sort((a, b) => b._count.category - a._count.category)
      .forEach(cat => {
        console.log(`   ${cat.category}: ${cat._count.category} books`);
      });
    
    console.log('\n✅ Database restore completed successfully! 🚀');
    
  } catch (error) {
    console.error('❌ Error during restore:', error);
    throw error;
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  const backupFile = process.argv[2]; // Optional backup file path
  restoreFromBackup(backupFile).catch(console.error);
}

export default restoreFromBackup; 