"use strict";
// updateBookImagesFromCSV.ts
// Usage: npx tsx scripts/updateBookImagesFromCSV.ts
// This script reads products_export_1.csv, collects all image URLs for each book (by Title),
// and updates the images array for each book in the database (matched by title) using Prisma.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const sync_1 = require("csv-parse/sync");
const prisma = new client_1.PrismaClient();
const CSV_PATH = path_1.default.join(__dirname, '../products_export_1.csv');
async function main() {
    var _a, _b, _c;
    // Read and parse CSV
    const csvContent = fs_1.default.readFileSync(CSV_PATH, 'utf8');
    const records = (0, sync_1.parse)(csvContent, {
        columns: true,
        skip_empty_lines: true,
    });
    // Map: handle -> { title, images: [{url, pos}] }
    const handleMap = {};
    for (const row of records) {
        const handle = (_a = row['Handle']) === null || _a === void 0 ? void 0 : _a.trim();
        const title = (_b = row['Title']) === null || _b === void 0 ? void 0 : _b.trim();
        const imageUrl = (_c = row['Image Src']) === null || _c === void 0 ? void 0 : _c.trim();
        const imagePos = parseInt(row['Image Position'] || '1', 10);
        if (!handle)
            continue;
        if (!handleMap[handle]) {
            handleMap[handle] = { title: title || '', images: [] };
        }
        // If this row has a title, prefer it (first row for this handle)
        if (title && !handleMap[handle].title) {
            handleMap[handle].title = title;
        }
        if (imageUrl && imageUrl.startsWith('https://cdn.shopify.com/s/files')) {
            if (!handleMap[handle].images.some(img => img.url === imageUrl)) {
                handleMap[handle].images.push({ url: imageUrl, pos: imagePos });
            }
        }
    }
    // Sort images by position for each handle
    for (const handle in handleMap) {
        handleMap[handle].images.sort((a, b) => a.pos - b.pos);
    }
    let updated = 0;
    const notFound = [];
    for (const { title, images } of Object.values(handleMap)) {
        if (!title)
            continue;
        const imageUrls = images.map(img => img.url);
        const book = await prisma.book.findFirst({ where: { title } });
        if (book) {
            await prisma.book.update({ where: { id: book.id }, data: { images: { set: imageUrls } } });
            updated++;
        }
        else {
            notFound.push(title);
        }
    }
    console.log(`Updated images for ${updated} books.`);
    if (notFound.length) {
        console.log('Titles not found in DB:', notFound);
    }
    await prisma.$disconnect();
}
main().catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
});
