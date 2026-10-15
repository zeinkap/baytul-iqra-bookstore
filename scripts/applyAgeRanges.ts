/**
 * Applies the reviewed CSV from suggestAgeRanges.ts to the database.
 * Dry run by default (no database access); pass --apply to write.
 *
 * Usage:
 *   npx tsx scripts/applyAgeRanges.ts [file.csv]                  # preview
 *   npx tsx scripts/applyAgeRanges.ts [file.csv] --apply          # write
 *   npx tsx scripts/applyAgeRanges.ts [file.csv] --apply --skip-low   # ignore low-confidence rows
 */
import { PrismaClient } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import { isValidAgeRange, loadEnv, normalizeAgeRange } from './ageRangeUtils';

loadEnv();

type Row = { id: string; title: string; currentAgeRange?: string; suggestedAgeRange?: string; confidence?: string };

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const skipLow = args.includes('--skip-low');
  const file = args.find((a) => !a.startsWith('--')) ?? 'age-range-suggestions.csv';

  if (!fs.existsSync(file)) throw new Error(`CSV not found: ${file}`);
  const rows: Row[] = parse(fs.readFileSync(file, 'utf8'), { columns: true, skip_empty_lines: true, trim: true, bom: true });

  const updates: { id: string; title: string; ageRange: string }[] = [];
  const invalid: string[] = [];
  let unchanged = 0;
  let skippedLow = 0;

  for (const r of rows) {
    const value = (r.suggestedAgeRange ?? '').trim();
    if (!value) continue;
    if (!isValidAgeRange(value)) {
      invalid.push(`${r.title}: "${value}"`);
      continue;
    }
    if (skipLow && r.confidence === 'low') {
      skippedLow++;
      continue;
    }
    const ageRange = normalizeAgeRange(value);
    if (ageRange === (r.currentAgeRange ?? '').trim()) {
      unchanged++;
      continue;
    }
    updates.push({ id: r.id, title: r.title, ageRange });
  }

  console.log(`${rows.length} row(s): ${updates.length} to update, ${unchanged} unchanged, ${skippedLow} low-confidence skipped, ${invalid.length} invalid.`);
  invalid.forEach((i) => console.log(`  invalid -> ${i}`));

  if (!apply) {
    updates.slice(0, 15).forEach((u) => console.log(`  ${u.title} -> ${u.ageRange}`));
    if (updates.length > 15) console.log(`  ...and ${updates.length - 15} more`);
    console.log('\nDry run only. Add --apply to write these to the database (run `npm run db:backup` first).');
    return;
  }

  const prisma = new PrismaClient();
  try {
    let done = 0;
    let missing = 0;
    for (const u of updates) {
      const res = await prisma.book.updateMany({ where: { id: u.id }, data: { ageRange: u.ageRange } });
      if (res.count === 0) missing++;
      else done++;
    }
    console.log(`✅ Updated ${done} book(s).${missing ? ` ${missing} id(s) not found.` : ''}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('❌', error instanceof Error ? error.message : error);
  process.exit(1);
});
