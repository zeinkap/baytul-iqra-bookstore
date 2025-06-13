import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function backupDatabase() {
  try {
    console.log('💾 Starting database backup...\n');
    
    // Get current timestamp for backup files
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(process.cwd(), 'backups');
    
    // Create backups directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
      console.log('📁 Created backups directory');
    }
    
    // Fetch all books
    const books = await prisma.book.findMany({
      orderBy: { id: 'asc' },
      include: { categories: true },
    });
    
    console.log(`📚 Found ${books.length} books to backup`);
    
    // Create JSON backup
    const jsonBackupPath = path.join(backupDir, `books-backup-${timestamp}.json`);
    const jsonData = {
      backupDate: new Date().toISOString(),
      totalBooks: books.length,
      books: books
    };
    
    fs.writeFileSync(jsonBackupPath, JSON.stringify(jsonData, null, 2));
    console.log(`✅ JSON backup created: ${jsonBackupPath}`);
    
    // Create CSV backup
    const csvBackupPath = path.join(backupDir, `books-backup-${timestamp}.csv`);
    const csvHeaders = 'id,title,author,description,price,images,stock,categories,createdAt,updatedAt\n';
    
    const csvRows: string[] = [];
    const escapeCsv = (str: string) => {
      if (typeof str !== 'string') return '';
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const book of books as any[]) {
      const categories = book.categories.map((c: { name: string }) => c.name).join('; ');
      const images = Array.isArray(book.images) ? book.images.join('; ') : '';
      csvRows.push([
        book.id,
        escapeCsv(book.title),
        escapeCsv(book.author),
        escapeCsv(book.description),
        book.price,
        escapeCsv(images),
        book.stock,
        escapeCsv(categories),
        book.createdAt.toISOString(),
        book.updatedAt.toISOString(),
      ].join(','));
    }
    
    const csvData = csvRows.join('\n');
    fs.writeFileSync(csvBackupPath, csvHeaders + csvData);
    console.log(`✅ CSV backup created: ${csvBackupPath}`);
    
    // Create backup metadata
    const metadataPath = path.join(backupDir, `backup-metadata-${timestamp}.json`);
    const metadata = {
      backupDate: new Date().toISOString(),
      totalBooks: books.length,
      jsonFile: path.basename(jsonBackupPath),
      csvFile: path.basename(csvBackupPath),
      categoryDistribution: await getCategoryDistribution(),
      authorDistribution: await getAuthorDistribution()
    };
    
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`✅ Metadata created: ${metadataPath}`);
    
    // Create latest backup symlinks (for easy access)
    const latestJsonPath = path.join(backupDir, 'latest-books-backup.json');
    const latestCsvPath = path.join(backupDir, 'latest-books-backup.csv');
    
    // Remove existing symlinks if they exist
    if (fs.existsSync(latestJsonPath)) fs.unlinkSync(latestJsonPath);
    if (fs.existsSync(latestCsvPath)) fs.unlinkSync(latestCsvPath);
    
    // Create new symlinks
    fs.symlinkSync(path.basename(jsonBackupPath), latestJsonPath);
    fs.symlinkSync(path.basename(csvBackupPath), latestCsvPath);
    
    console.log(`🔗 Latest backup symlinks created`);
    
    // Show backup summary
    const jsonSize = (fs.statSync(jsonBackupPath).size / 1024).toFixed(2);
    const csvSize = (fs.statSync(csvBackupPath).size / 1024).toFixed(2);
    
    console.log('\n📊 Backup Summary:');
    console.log(`   Books backed up: ${books.length}`);
    console.log(`   JSON file size: ${jsonSize} KB`);
    console.log(`   CSV file size: ${csvSize} KB`);
    console.log(`   Backup directory: ${backupDir}`);
    
    console.log('\n✅ Database backup completed successfully! 🎉');
    
  } catch (error) {
    console.error('❌ Error during backup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function getCategoryDistribution() {
  const categories = await prisma.category.findMany({
    include: { books: true },
    orderBy: { name: 'asc' },
  });
  const dist: Record<string, number> = {};
  for (const cat of categories) {
    dist[cat.name] = cat.books.length;
  }
  return dist;
}

async function getAuthorDistribution() {
  const authors = await prisma.book.groupBy({
    by: ['author'],
    _count: { author: true }
  });
  
  return authors
    .sort((a, b) => b._count.author - a._count.author)
    .slice(0, 10) // Top 10 authors
    .reduce((acc, author) => {
      acc[author.author] = author._count.author;
      return acc;
    }, {} as Record<string, number>);
}

// Run if called directly
if (require.main === module) {
  backupDatabase().catch(console.error);
}

export default backupDatabase; 