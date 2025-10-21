"use strict";
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const csv_parse_1 = require("csv-parse");
const prisma_1 = require("../src/lib/prisma");
const csvPath = path_1.default.join(__dirname, '../products_export_1.csv');
/**
 * @typedef {Object} CsvBook
 * @property {string} Title
 * @property {string=} Vendor
 * @property {string=} 'Body (HTML)'
 * @property {string} 'Variant Price'
 * @property {string=} 'Image Src'
 * @property {string=} 'Variant Inventory Qty'
 */
async function main() {
    var _a, e_1, _b, _c;
    var _d, _e, _f;
    /** @type {CsvBook[]} */
    const records = [];
    const parser = fs_1.default
        .createReadStream(csvPath)
        .pipe((0, csv_parse_1.parse)({ columns: true, skip_empty_lines: true }));
    try {
        for (var _g = true, parser_1 = __asyncValues(parser), parser_1_1; parser_1_1 = await parser_1.next(), _a = parser_1_1.done, !_a; _g = true) {
            _c = parser_1_1.value;
            _g = false;
            const record = _c;
            // Only import rows with a title and price
            if (!record['Title'] || !record['Variant Price'])
                continue;
            records.push(record);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (!_g && !_a && (_b = parser_1.return)) await _b.call(parser_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    for (const record of records) {
        const title = record['Title'].trim();
        const author = ((_d = record['Vendor']) === null || _d === void 0 ? void 0 : _d.trim()) || 'Unknown';
        const description = ((_e = record['Body (HTML)']) === null || _e === void 0 ? void 0 : _e.trim()) || '';
        const price = parseFloat(record['Variant Price']) || 0;
        const images = ((_f = record['Image Src']) === null || _f === void 0 ? void 0 : _f.split(',').map((img) => img.trim())) || [];
        const stock = parseInt(record['Variant Inventory Qty'] || '0') || 0;
        // Avoid duplicates by title
        const exists = await prisma_1.prisma.book.findFirst({ where: { title } });
        if (exists)
            continue;
        await prisma_1.prisma.book.create({
            data: {
                title,
                author,
                description,
                price,
                images: { set: images },
                stock,
            },
        });
        console.log(`Imported: ${title}`);
    }
    console.log('Import complete!');
    await prisma_1.prisma.$disconnect();
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
