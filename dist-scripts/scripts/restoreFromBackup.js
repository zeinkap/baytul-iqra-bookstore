"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const readline = __importStar(require("readline"));
const prisma = new client_1.PrismaClient();
// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
// Helper function to ask questions
function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim());
        });
    });
}
async function restoreFromBackup(backupFilePath) {
    try {
        console.log('🔄 Starting database restore from backup...\n');
        console.log('Using DATABASE_URL:', process.env.DATABASE_URL);
        const backupDir = path_1.default.join(process.cwd(), 'backups');
        // If no backup file specified, show available backups
        if (!backupFilePath) {
            if (!fs_1.default.existsSync(backupDir)) {
                console.log('❌ No backups directory found. Please create a backup first.');
                return;
            }
            const backupFiles = fs_1.default.readdirSync(backupDir)
                .filter(file => file.startsWith('books-backup-') && file.endsWith('.json'))
                .sort()
                .reverse(); // Latest first
            if (backupFiles.length === 0) {
                console.log('❌ No backup files found. Please create a backup first.');
                return;
            }
            console.log('📁 Available backup files:');
            backupFiles.forEach((file, index) => {
                const filePath = path_1.default.join(backupDir, file);
                const stats = fs_1.default.statSync(filePath);
                const size = (stats.size / 1024).toFixed(2);
                console.log(`   ${index + 1}. ${file} (${size} KB) - ${stats.mtime.toLocaleString()}`);
            });
            const choice = await askQuestion('\nSelect backup file number (or press Enter for latest): ');
            const selectedIndex = choice ? parseInt(choice) - 1 : 0;
            if (selectedIndex < 0 || selectedIndex >= backupFiles.length) {
                console.log('❌ Invalid selection');
                return;
            }
            backupFilePath = path_1.default.join(backupDir, backupFiles[selectedIndex]);
        }
        // Verify backup file exists
        if (!fs_1.default.existsSync(backupFilePath)) {
            console.log(`❌ Backup file not found: ${backupFilePath}`);
            return;
        }
        // Read and parse backup file
        const backupContent = fs_1.default.readFileSync(backupFilePath, 'utf-8');
        const backupData = JSON.parse(backupContent);
        console.log(`📖 Backup file: ${path_1.default.basename(backupFilePath)}`);
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
            // Remove the id, category, image, and images to handle them separately
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, categories, category, image, images } = book, bookData = __rest(book, ["id", "categories", "category", "image", "images"]);
            // Convert date strings back to Date objects
            bookData.createdAt = new Date(book.createdAt);
            bookData.updatedAt = new Date(book.updatedAt);
            // Determine category names from backup data (handles both old and new formats)
            let categoryNames = [];
            if (categories && Array.isArray(categories) && categories.length > 0) {
                categoryNames = categories.map((cat) => cat.name).filter(Boolean);
            }
            else if (category && typeof category === 'string') {
                categoryNames = [category];
            }
            // Prepare category connections, creating any missing categories
            let categoryConnect = [];
            if (categoryNames.length > 0) {
                const allCategoryRecords = await Promise.all(categoryNames.map(name => prisma.category.upsert({
                    where: { name },
                    update: {},
                    create: { name },
                })));
                categoryConnect = allCategoryRecords.map(cat => ({ id: cat.id }));
            }
            // Use 'images' array for the new schema
            const imagesArray = images !== null && images !== void 0 ? images : (image ? [image] : []);
            await prisma.book.create({
                data: Object.assign(Object.assign({}, bookData), { images: imagesArray, categories: { connect: categoryConnect } })
            });
            restoredCount++;
            if (restoredCount % 10 === 0) {
                console.log(`   ✅ Restored ${restoredCount}/${backupData.totalBooks} books...`);
            }
        }
        const finalCount = await prisma.book.count();
        console.log(`\n🎉 Successfully restored ${finalCount} books!`);
        // Show category distribution after restore
        const categories = await getCategoryDistribution();
        console.log('\n📊 Restored category distribution:');
        Object.entries(categories)
            .sort((a, b) => b[1] - a[1])
            .forEach(([category, count]) => {
            console.log(`   ${category}: ${count} books`);
        });
        console.log('\n✅ Database restore completed successfully! 🚀');
    }
    catch (error) {
        console.error('❌ Error during restore:', error);
        throw error;
    }
    finally {
        rl.close();
        await prisma.$disconnect();
    }
}
// Run if called directly
if (require.main === module) {
    const backupFile = process.argv[2]; // Optional backup file path
    restoreFromBackup(backupFile).catch(console.error);
}
// Category distribution: count books per category
async function getCategoryDistribution() {
    const categories = await prisma.category.findMany({
        include: { books: true },
        orderBy: { name: 'asc' },
    });
    const dist = {};
    for (const cat of categories) {
        dist[cat.name] = cat.books.length;
    }
    return dist;
}
exports.default = restoreFromBackup;
