import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function createBackup() {
  try {
    console.log("🔄 Starting database backup...");

    const books = await prisma.book.findMany({
      include: {
        categories: true, // This directly includes the related Category models.
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Also capture all categories (including those without books)
    const categories = await prisma.category.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    // Capture promo codes (excluding any order/linkage data)
    const promoCodes = await prisma.promoCode.findMany({
      select: {
        code: true,
        description: true,
        discountType: true,
        discountValue: true,
        minimumOrderAmount: true,
        maxUses: true,
        currentUses: true,
        validFrom: true,
        validUntil: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (books.length === 0) {
      console.log("⚠️ No books found in the database. Nothing to back up.");
      return;
    }

    const backupDir = path.join(process.cwd(), "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log(`📁 Created backup directory: ${backupDir}`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFileName = `dataset-backup-${timestamp}.json`;
    const latestBackupFileName = "dataset-backup-latest.json";

    const backupFilePath = path.join(backupDir, backupFileName);
    const latestBackupFilePath = path.join(backupDir, latestBackupFileName);

    const backupData = {
      backupDate: new Date().toISOString(),
      totalBooks: books.length,
      books: books, // Use the fetched books data directly.
      categories,
      promoCodes,
    };

    const jsonContent = JSON.stringify(backupData, null, 2);

    fs.writeFileSync(backupFilePath, jsonContent, "utf-8");
    console.log(`✅ Successfully created backup file: ${backupFileName}`);

    fs.writeFileSync(latestBackupFilePath, jsonContent, "utf-8");
    console.log(
      `✅ Successfully updated latest backup file: ${latestBackupFileName}`
    );

    console.log(`\n🎉 Backup complete! ${books.length} books saved.`);
  } catch (error) {
    console.error("❌ Error during backup:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  createBackup().catch(console.error);
}

export default createBackup;
