"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const prisma = new client_1.PrismaClient();
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
        if (books.length === 0) {
            console.log("⚠️ No books found in the database. Nothing to back up.");
            return;
        }
        const backupDir = path_1.default.join(process.cwd(), "backups");
        if (!fs_1.default.existsSync(backupDir)) {
            fs_1.default.mkdirSync(backupDir, { recursive: true });
            console.log(`📁 Created backup directory: ${backupDir}`);
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupFileName = `books-backup-${timestamp}.json`;
        const latestBackupFileName = "books-backup-latest.json";
        const backupFilePath = path_1.default.join(backupDir, backupFileName);
        const latestBackupFilePath = path_1.default.join(backupDir, latestBackupFileName);
        const backupData = {
            backupDate: new Date().toISOString(),
            totalBooks: books.length,
            books: books, // Use the fetched books data directly.
        };
        const jsonContent = JSON.stringify(backupData, null, 2);
        fs_1.default.writeFileSync(backupFilePath, jsonContent, "utf-8");
        console.log(`✅ Successfully created backup file: ${backupFileName}`);
        fs_1.default.writeFileSync(latestBackupFilePath, jsonContent, "utf-8");
        console.log(`✅ Successfully updated latest backup file: ${latestBackupFileName}`);
        console.log(`\n🎉 Backup complete! ${books.length} books saved.`);
    }
    catch (error) {
        console.error("❌ Error during backup:", error);
        throw error;
    }
    finally {
        await prisma.$disconnect();
    }
}
// Run if called directly
if (require.main === module) {
    createBackup().catch(console.error);
}
exports.default = createBackup;
